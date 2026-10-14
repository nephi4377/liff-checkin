import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-01a12e27-c0cd-77e9-acf6-84755fc3d76b/media'
await mkdir(OUT, { recursive: true })
const url = 'https://yang-employee-todo.surge.sh/?v=' + Date.now()

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '開始' }).click()
await page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 15000 })
await page
  .waitForFunction(() => document.body.innerText.includes('已同步'), null, {
    timeout: 20000,
  })
  .catch(() => {})
await page.waitForTimeout(1500)

// Stale completed (>10d) must be purged
if (await page.getByText('過期測試應被清掉').count()) {
  throw new Error('stale completed task was not purged')
}

// Urgency controls
if ((await page.locator('.urgency-toggle').count()) < 1) {
  throw new Error('missing urgency toggles')
}

await page.screenshot({
  path: `${OUT}/urgency-levels-ende.png`,
  fullPage: true,
})

// Complete a 待辦 task → 已完成
const todoCard = page.locator('.list-todo .task-card').first()
const activeTitle = (
  await todoCard.locator('.task-title').textContent()
)?.trim()
await todoCard.locator('.task-check').click()
await page.waitForTimeout(1200)

await page.locator('.list-done').waitFor({ timeout: 5000 })
const inDone = await page
  .locator('.list-done .task-title', { hasText: activeTitle || '' })
  .count()
if (!inDone) throw new Error('completed task not in 已完成 section')
const stillActive = await page
  .locator('.list-todo .task-title', { hasText: activeTitle || '' })
  .count()
if (stillActive) throw new Error('completed task still in 待辦')

await page.screenshot({ path: `${OUT}/done-section-ende.png`, fullPage: true })

// Uncheck restores to active lists
const doneCard = page
  .locator('.list-done .task-card', { hasText: activeTitle || '' })
  .first()
await doneCard.locator('.task-check').click()
await page.waitForTimeout(1200)
const restored = await page
  .locator('.list-priority .task-title, .list-todo .task-title', {
    hasText: activeTitle || '',
  })
  .count()
if (!restored) throw new Error('uncheck did not restore to active')

// Change urgency + persist
await page.locator('.list-todo .urgency-btn', { hasText: '緊急' }).first().click()
await page.waitForTimeout(1500)
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('tab', { name: /恩德/ }).waitFor()
await page.waitForTimeout(2000)
const urgentActive = await page
  .locator('.list-todo .urgency-btn.is-active.urgency-urgent, .list-priority .urgency-btn.is-active.urgency-urgent')
  .count()
if (!urgentActive) throw new Error('urgency not persisted')

await page.screenshot({ path: `${OUT}/urgency-persisted.png`, fullPage: true })

// Field badges
await page.getByRole('button', { name: '⋯' }).click()
await page.getByRole('button', { name: /工務查看/ }).click()
await page.locator('input[inputmode="numeric"]').fill('2468')
await page.locator('button.btn-primary').last().click()
await page.waitForTimeout(1000)
if ((await page.locator('.urgency-badge').count()) < 1) {
  throw new Error('field missing urgency badges')
}
await page.screenshot({
  path: `${OUT}/urgency-field-visible.png`,
  fullPage: true,
})

console.log(
  JSON.stringify(
    {
      ok: true,
      purgedStale: true,
      doneSection: true,
      restore: true,
      urgencyPersist: true,
      completedTitle: activeTitle,
    },
    null,
    2,
  ),
)
await browser.close()
