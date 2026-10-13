import { chromium } from 'playwright'

const BASE = process.env.CAPTURE_BASE || 'http://127.0.0.1:5173'
const v = Date.now()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  serviceWorkers: 'block',
})

try {
  await page.goto(`${BASE}/?role=paigong&demo=1&v=${v}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  const start = page.getByRole('button', { name: '開始派工' })
  if (await start.count()) await start.click()
  await page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 20000 })

  const options = await page
    .locator('select[aria-label="誰派的"] option')
    .evaluateAll((els) => els.map((e) => (e.textContent || '').trim()))
  const yang = options.filter((t) => t === '羊')
  if (yang.length) {
    throw new Error(`派工下拉仍有羊: ${JSON.stringify(options)}`)
  }
  console.log('派工下拉 OK', options)

  // 工務頁無「誰派的」下拉；確認頁面選項集合不出現可選羊
  await page.goto(`${BASE}/?role=ende&demo=1&v=${v}`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.worker-cat-stack').waitFor({ timeout: 15000 })
  const selects = await page.locator('select').count()
  const workerOpts = await page
    .locator('select option')
    .evaluateAll((els) => els.map((e) => (e.textContent || '').trim()))
  if (workerOpts.includes('羊')) {
    throw new Error(`工務頁 select 仍有羊: ${JSON.stringify(workerOpts)}`)
  }
  console.log('工務頁 select 數', selects, 'options', workerOpts)
  console.log('OK no 羊 in assigner dropdowns')
} finally {
  await browser.close()
}
