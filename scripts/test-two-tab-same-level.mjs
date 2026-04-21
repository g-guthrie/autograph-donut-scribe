import {execFileSync} from 'node:child_process'
import puppeteer from '/Users/gguthrie/Desktop/CS1.5/.tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const APP_URL = 'http://127.0.0.1:3000'
const STATUS_URL = 'http://127.0.0.1:27016/status'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EXPECTED_MAP = 'de_dust2'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchStatus = async () => {
  const response = await fetch(STATUS_URL)
  if (!response.ok) {
    throw new Error(`status fetch failed (${response.status})`)
  }
  return response.json()
}

const getState = async (page) => page.evaluate(() => window.__cs15TestState ?? null)

const openClient = async (browser, dialogs, consoleMessages) => {
  const page = await browser.newPage()
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  page.on('console', async (message) => {
    consoleMessages.push(`[${message.type()}] ${await message.text()}`)
  })
  await page.goto(APP_URL, {
    waitUntil: 'networkidle2',
    timeout: 120_000,
  })
  await page.waitForFunction(
    () => window.__cs15TestState?.phase === 'menu' && !!window.__cs15TestMenuDriver,
    {timeout: 180_000},
  )
  return page
}

const hostSandboxRoom = async (page) => {
  await page.evaluate(() => {
    window.__cs15TestMenuDriver.openMultiplayer()
    window.__cs15TestMenuDriver.openSandbox()
    window.__cs15TestMenuDriver.selectCreateGameMap('de_dust2')
    window.__cs15TestMenuDriver.confirmCreateGame()
  })
  await page.waitForFunction(
    () => !!window.__cs15TestState?.trace?.txid,
    {timeout: 30_000},
  )
  return page.evaluate(() => window.__cs15TestState?.trace?.txid ?? null)
}

const joinSandboxRoom = async (page) => {
  await page.evaluate(() => {
    window.__cs15TestMenuDriver.openMultiplayer()
    window.__cs15TestMenuDriver.openInternetGame()
    window.__cs15TestMenuDriver.refreshInternetGames()
  })

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(1500)
    await page.evaluate(() => {
      window.__cs15TestMenuDriver.selectInternetGameRow(0)
      window.__cs15TestMenuDriver.joinInternetGame()
    }).catch(() => null)
  }
}

const waitForSession = async (page, label, consoleMessages, minPlayers, expectedTxid = null) => {
  const deadline = Date.now() + 240_000
  let lastSnapshot = null

  while (Date.now() < deadline) {
    const [state, status] = await Promise.all([
      getState(page).catch(() => null),
      fetchStatus().catch(() => null),
    ])
    lastSnapshot = {state, status}

    if (
      status?.session_ready &&
      status?.map === EXPECTED_MAP &&
      (status?.players ?? 0) >= minPlayers &&
      (!expectedTxid || status?.txid === expectedTxid)
    ) {
      return {state, status}
    }

    await sleep(1000)
  }

  const recentConsole = consoleMessages.slice(-60)
  throw new Error(`${label}: never reached backend session: ${JSON.stringify(lastSnapshot)}; console=${JSON.stringify(recentConsole)}`)
}

execFileSync('bash', ['/Users/gguthrie/Desktop/CS1.5/scripts/start-local-mp.sh'], {
  stdio: 'inherit',
})

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  protocolTimeout: 600_000,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})

const dialogs = []
const consoleMessages = []

const hostPage = await openClient(browser, dialogs, consoleMessages)
const hostTxid = await hostSandboxRoom(hostPage)
const hostResult = await waitForSession(hostPage, 'host', consoleMessages, 1, hostTxid)

const joinPage = await openClient(browser, dialogs, consoleMessages)
await joinSandboxRoom(joinPage)
const joinResult = await waitForSession(joinPage, 'joiner', consoleMessages, 2, hostResult.status.txid)

if (hostResult.status.txid !== joinResult.status.txid) {
  throw new Error(`tabs ended in different sessions: host=${hostResult.status.txid} joiner=${joinResult.status.txid}`)
}
if (hostResult.status.map !== joinResult.status.map) {
  throw new Error(`tabs ended on different maps: host=${hostResult.status.map} joiner=${joinResult.status.map}`)
}
if (dialogs.length) {
  throw new Error(`unexpected dialogs: ${dialogs.join(' | ')}`)
}

console.log(`two-tab same-level test passed: txid=${joinResult.status.txid} map=${joinResult.status.map} players=${joinResult.status.players}`)

await browser.close()
