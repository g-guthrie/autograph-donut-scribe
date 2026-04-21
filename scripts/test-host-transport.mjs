import {execFileSync} from 'node:child_process'
import puppeteer from '/Users/gguthrie/Desktop/CS1.5/.tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const APP_URL = 'http://127.0.0.1:3000'
const STATUS_URL = 'http://127.0.0.1:27016/status'
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchStatus = async () => {
  const response = await fetch(STATUS_URL)
  if (!response.ok) {
    throw new Error(`status fetch failed (${response.status})`)
  }
  return response.json()
}

const getState = async (page) => page.evaluate(() => window.__cs15TestState ?? null)

const waitForTransportAndSession = async (page, consoleMessages) => {
  const deadline = Date.now() + 120_000
  let lastSnapshot = null

  while (Date.now() < deadline) {
    const [state, status] = await Promise.all([
      getState(page).catch(() => null),
      fetchStatus().catch(() => null),
    ])
    lastSnapshot = {state, status}

    if (
      state?.transportConnected &&
      status?.session_ready &&
      status?.txid &&
      state?.connectedServer === `${status.connect_host}:${status.connect_port}`
    ) {
      return {state, status}
    }

    await sleep(1000)
  }

  const recentConsole = consoleMessages.slice(-40)
  throw new Error(`transport/session never became ready: ${JSON.stringify(lastSnapshot)}; console=${JSON.stringify(recentConsole)}`)
}

if (!process.env.CS15_SKIP_START) {
  execFileSync('bash', ['/Users/gguthrie/Desktop/CS1.5/scripts/start-local-mp.sh'], {
    stdio: 'inherit',
  })
}

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
})

const dialogs = []
const consoleMessages = []
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

await page.evaluate(() => {
  window.__cs15TestMenuDriver.openMultiplayer()
  window.__cs15TestMenuDriver.openSandbox()
  window.__cs15TestMenuDriver.selectCreateGameMap('de_dust2')
  window.__cs15TestMenuDriver.confirmCreateGame()
})

const {state, status} = await waitForTransportAndSession(page, consoleMessages)
if (!status?.session_ready) {
  throw new Error('backend never reported session_ready')
}
if (!status?.txid) {
  throw new Error('missing host transaction id')
}
if (state?.connectedServer !== `${status.connect_host}:${status.connect_port}`) {
  throw new Error(`connected to unexpected server ${state?.connectedServer}`)
}
if (dialogs.length) {
  throw new Error(`unexpected dialogs: ${dialogs.join(' | ')}`)
}

console.log('host transport smoke passed')

await browser.close()
