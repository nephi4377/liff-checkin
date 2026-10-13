import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-d19b3ef0-82b4-446e-8016-9d87e5589e85/media'
const ART = '/opt/cursor/artifacts'
await mkdir(OUT, { recursive: true })
await mkdir(ART, { recursive: true })

const BASE = 'https://info.tanxin.space/employee-todo'
const v = Date.now()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  serviceWorkers: 'block',
})

try {
  await page.goto(`${BASE}/?role=ende&v=${v}`, { waitUntil: 'networkidle' })
  await page.locator('.worker-cat-stack, .office-panel, .person-title').first().waitFor({
    timeout: 25000,
  })
  await page.waitForTimeout(800)
  await page.screenshot({
    path: `${OUT}/employee-todo-live-ende-blocks.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-live-ende-blocks.png`,
    fullPage: true,
  })

  const hint = await page.locator('.done-hint').first().innerText().catch(() => '')
  const cats = await page.locator('.worker-cat-head h3').allTextContents()

  await page.goto(`${BASE}/?role=paigong&v=${v}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const start = page.getByRole('button', { name: '開始派工' })
  if (await start.count()) await start.click()
  await page.waitForTimeout(800)
  await page.screenshot({
    path: `${OUT}/employee-todo-live-paigong.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-live-paigong.png`,
    fullPage: true,
  })

  console.log(JSON.stringify({ ok: true, cats, hint, url: `${BASE}/?role=ende` }))
} finally {
  await browser.close().catch(() => {})
}
