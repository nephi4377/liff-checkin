import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-d19b3ef0-82b4-446e-8016-9d87e5589e85/media'
const ART = '/opt/cursor/artifacts'
await mkdir(OUT, { recursive: true })
await mkdir(ART, { recursive: true })

const BASE = process.env.CAPTURE_BASE || 'http://127.0.0.1:5173'
const v = Date.now()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  serviceWorkers: 'block',
})

try {
  // 派工：派工說明欄位
  await page.goto(`${BASE}/?role=paigong&demo=1&v=${v}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  const start = page.getByRole('button', { name: '開始派工' })
  if (await start.count()) await start.click()
  await page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 20000 })

  // 打開新增表單以顯示「派工說明」標籤
  const addBtn = page.getByRole('button', { name: /加一件|新增/ }).first()
  if (await addBtn.count()) await addBtn.click()
  await page.waitForTimeout(300)
  await page.locator('.detail-field-label', { hasText: '派工說明' }).first().waitFor({
    timeout: 10000,
  })

  // 也捲到任務卡上的派工說明／工務說明
  await page.locator('.task-detail, .detail-field-label').first().scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `${OUT}/employee-todo-dispatch-note.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-dispatch-note.png`,
    fullPage: true,
  })

  // 工務：任務下方工務說明
  await page.goto(`${BASE}/?role=ende&demo=1&v=${v}`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.worker-cat-stack').waitFor({ timeout: 15000 })
  const note = page.locator('.worker-note').first()
  await note.scrollIntoViewIfNeeded()
  await note.click()
  await page.locator('.worker-note-input').waitFor({ timeout: 5000 })
  await page.screenshot({
    path: `${OUT}/employee-todo-worker-note-field.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-worker-note-field.png`,
    fullPage: true,
  })

  console.log('OK dual-notes screenshots')
} finally {
  await browser.close()
}
