import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-01a12e27-c0cd-77e9-acf6-84755fc3d76b/media'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.clear()
})
await page.reload({ waitUntil: 'networkidle' })

// First-run link as 羊
await page.getByRole('heading', { name: '與你連結為行政助理' }).waitFor()
await page.getByPlaceholder('羊').fill('羊')
await page.getByRole('button', { name: '連結為行政助理' }).click()
await page.waitForTimeout(300)

await page.getByText('你好，羊').waitFor()
await page.screenshot({ path: `${OUT}/linked-assistant-home.png`, fullPage: true })

await page.getByPlaceholder('例如：現場管線複測').fill('測試派工任務')
await page.locator('.assign-form select').nth(1).selectOption('priority')
await page.getByRole('button', { name: '派發任務' }).click()
await page.waitForTimeout(200)

const titles = await page.locator('.list-priority .task-title').allTextContents()
if (!titles.includes('測試派工任務')) {
  throw new Error(`Assign failed: ${JSON.stringify(titles)}`)
}

const cards = page.locator('.list-priority .task-card')
const firstBefore = (await cards.nth(0).locator('.task-title').textContent())?.trim()
await cards.nth(1).getByRole('button', { name: '上移' }).click()
await page.waitForTimeout(200)
if ((await cards.nth(0).locator('.task-title').textContent())?.trim() === firstBefore) {
  throw new Error('Assistant reorder failed')
}

// Field mode via PIN
await page.getByRole('button', { name: '工務模式' }).click()
await page.getByPlaceholder('請輸入數字').fill('2468')
await page.getByRole('button', { name: '進入' }).click()
await page.waitForTimeout(200)
await page.getByRole('heading', { name: '工務模式' }).waitFor()
await page.getByRole('tab', { name: '王建宏' }).click()

const fieldCards = page.locator('.list-priority .task-card')
const dragEnabled = await fieldCards
  .first()
  .locator('.drag-handle:not([disabled])')
  .count()
if (dragEnabled > 0) throw new Error('Field should not reorder')

await fieldCards.first().locator('input[type="checkbox"]').check()
await page.screenshot({ path: `${OUT}/linked-field-mode.png`, fullPage: true })

await page.getByRole('button', { name: '返回行政助理' }).click()
await page.getByText('你好，羊').waitFor()

// Persist across reload
await page.reload({ waitUntil: 'networkidle' })
await page.getByText('你好，羊').waitFor()
const profile = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('employee-todo-profile-v1') || 'null'),
)
if (profile?.displayName !== '羊' || profile?.role !== 'assistant') {
  throw new Error(`Profile not persisted: ${JSON.stringify(profile)}`)
}

console.log(JSON.stringify({ ok: true, linkedAs: '羊', persisted: true }, null, 2))
await browser.close()
