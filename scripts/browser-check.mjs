import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from '/Users/gguthrie/Desktop/CS1.5/.tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const outDir = '/Users/gguthrie/Desktop/CS1.5/browser-check'
await fs.mkdir(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-web-security'],
  defaultViewport: { width: 1400, height: 900 },
})

const page = await browser.newPage()

const events = []
const push = async (type, payload) => {
  const entry = { ts: new Date().toISOString(), type, ...payload }
  events.push(entry)
  console.log(JSON.stringify(entry))
}

page.on('console', msg => {
  push('console', { level: msg.type(), text: msg.text() })
})

page.on('pageerror', err => {
  push('pageerror', { text: err.message, stack: err.stack })
})

page.on('dialog', async dialog => {
  await push('dialog', { kind: dialog.type(), text: dialog.message() })
  await dialog.accept()
})

page.on('requestfailed', request => {
  push('requestfailed', {
    url: request.url(),
    method: request.method(),
    failure: request.failure()?.errorText ?? 'unknown',
  })
})

page.on('response', async response => {
  const url = response.url()
  if (url.includes('/game/manifest.json') || url.includes('emscripten') || url.includes('xash.wasm')) {
    await push('response', {
      url,
      status: response.status(),
      contentType: response.headers()['content-type'] ?? null,
    })
  }
})

await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 120000 })

await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.includes('Bot Match'))
  button?.click()
})
await push('input', { text: 'clicked Bot Match launcher button' })

for (let i = 0; i < 12; i += 1) {
  await page.screenshot({ path: path.join(outDir, `step-${i}.png`) })
  const statusText = await page.evaluate(() => {
    return document.querySelector('.status')?.textContent?.trim() ?? null
  })
  await push('status', { text: statusText })
  if (i === 2) {
    await page.mouse.click(700, 450)
    await page.keyboard.press('1')
    await page.keyboard.press('1')
    await page.keyboard.down('w')
    await new Promise(resolve => setTimeout(resolve, 1000))
    await page.keyboard.up('w')
    await page.mouse.move(900, 450)
    await page.mouse.move(1050, 450)
    await push('input', { text: 'clicked canvas, sent 1 1, held W, moved mouse' })
  }
  await new Promise(resolve => setTimeout(resolve, 5000))
}

await fs.writeFile(path.join(outDir, 'events.json'), JSON.stringify(events, null, 2))
await browser.close()
