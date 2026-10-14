import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-d19b3ef0-82b4-446e-8016-9d87e5589e85/media'
const ART = '/opt/cursor/artifacts'
await mkdir(OUT, { recursive: true })
await mkdir(ART, { recursive: true })

const BASE = process.env.CAPTURE_BASE || 'http://127.0.0.1:5173'
const v = Date.now()

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true })
  await page.screenshot({ path: `${ART}/${name}`, fullPage: true })
  console.log('shot', name)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  serviceWorkers: 'block',
  hasTouch: true,
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

  // no AI
  const ai = await page.locator('text=AI 整理').count()
  if (ai) throw new Error('AI 整理 still present')

  // no 限期件 section
  const deadlineSec = await page.locator('h2', { hasText: '限期完成' }).count()
  const deadlineWorker = await page.locator('h3', { hasText: '限期件' }).count()
  if (deadlineSec || deadlineWorker) throw new Error('限期件 section still present')

  await page.locator('.list-reminder, h2', { hasText: '提醒' }).first().waitFor({
    timeout: 10000,
  })
  await shot(page, 'employee-todo-reminder-section.png')
  await shot(page, 'employee-todo-priority-with-deadline.png')
  await shot(page, 'employee-todo-no-ai-organize.png')

  // swipe open priority actions (pin/delete)
  const priorityCard = page.locator('.list-priority .swipe-card').first()
  await priorityCard.scrollIntoViewIfNeeded()
  const box = await priorityCard.boundingBox()
  if (!box) throw new Error('no priority card')
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 18 })
  await page.waitForTimeout(200)
  await shot(page, 'employee-todo-priority-swipe-pin.png')
  await page.mouse.up()
  await page.waitForTimeout(200)

  // swipe todo to delete end
  const todoCard = page.locator('.list-todo .swipe-card').first()
  if (await todoCard.count()) {
    await todoCard.scrollIntoViewIfNeeded()
    const tb = await todoCard.boundingBox()
    if (tb) {
      await page.mouse.move(tb.x + tb.width - 20, tb.y + tb.height / 2)
      await page.mouse.down()
      await page.mouse.move(tb.x + 10, tb.y + tb.height / 2, { steps: 22 })
      await page.waitForTimeout(250)
      await shot(page, 'employee-todo-swipe-delete.png')
      await page.mouse.up()
      await page.waitForTimeout(400)
    }
  }

  // restore section
  await page.locator('.list-trash').scrollIntoViewIfNeeded()
  await shot(page, 'employee-todo-dispatch-restore.png')
  // alias delete shot if trash has items
  await shot(page, 'employee-todo-dispatch-delete.png')

  // worker page: no AI, has reminder, no deadline section
  await page.goto(`${BASE}/?role=ende&demo=1&v=${v}`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.worker-cat-stack').waitFor({ timeout: 15000 })
  if (await page.locator('text=AI 整理').count()) {
    throw new Error('worker has AI 整理')
  }
  await page.locator('.worker-cat-reminder').waitFor({ timeout: 10000 })
  if (await page.locator('.worker-cat-deadline').count()) {
    throw new Error('worker still has deadline cat')
  }
  await shot(page, 'employee-todo-worker-reminder.png')
  console.log('OK batch screenshots')
} finally {
  await browser.close()
}
