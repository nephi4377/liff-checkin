import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-01a12e27-c0cd-77e9-acf6-84755fc3d76b/media'
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const pixel = devices['Pixel 7']
const context = await browser.newContext({
  ...pixel,
  locale: 'zh-TW',
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })

await page.getByRole('button', { name: '重設示範資料' }).click()
await page.waitForTimeout(200)

await page.getByPlaceholder('例如：現場管線複測').fill('手機派工測試')
await page.locator('.assign-form select').nth(1).selectOption('priority')
await page.getByRole('button', { name: '派發任務' }).click()
await page.waitForTimeout(250)

const assigned = await page.locator('.list-priority .task-title').allTextContents()
if (!assigned.includes('手機派工測試')) {
  throw new Error(`Mobile assign failed: ${JSON.stringify(assigned)}`)
}

const cards = page.locator('.list-priority .task-card')
if ((await cards.count()) < 2) throw new Error('Need >=2 priority tasks')

const firstBefore = (await cards.nth(0).locator('.task-title').textContent())?.trim()
await cards.nth(1).getByRole('button', { name: '上移' }).click()
await page.waitForTimeout(250)
if ((await cards.nth(0).locator('.task-title').textContent())?.trim() === firstBefore) {
  throw new Error('Assistant mobile ↑ failed')
}

// Touch drag (行政助理)
const firstBeforeDrag = (await cards.nth(0).locator('.task-title').textContent())?.trim()
const handle = cards.nth(1).locator('.drag-handle')
const boxFrom = await handle.boundingBox()
const boxTo = await cards.nth(0).boundingBox()
if (!boxFrom || !boxTo) throw new Error('Missing drag boxes')

const startX = boxFrom.x + boxFrom.width / 2
const startY = boxFrom.y + boxFrom.height / 2
const endX = boxTo.x + boxTo.width / 2
const endY = boxTo.y + 12

const client = await context.newCDPSession(page)
await client.send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: startX, y: startY, id: 1 }],
})
await page.waitForTimeout(230)
for (let i = 1; i <= 12; i++) {
  const t = i / 12
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        x: startX + (endX - startX) * t,
        y: startY + (endY - startY) * t,
        id: 1,
      },
    ],
  })
}
await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await page.waitForTimeout(400)

const firstAfterDrag = (await cards.nth(0).locator('.task-title').textContent())?.trim()
if (firstAfterDrag === firstBeforeDrag) {
  throw new Error('Assistant touch drag failed')
}

await page.screenshot({
  path: `${OUT}/role-assistant-phone.png`,
  fullPage: true,
})

await page.getByRole('button', { name: '工務', exact: true }).click()
await page.waitForTimeout(200)
await page.getByRole('tab', { name: '王建宏' }).click()

const fieldCards = page.locator('.list-priority .task-card')
await fieldCards.first().locator('input[type="checkbox"]').check()
if (
  !(await fieldCards.first().evaluate((el) => el.classList.contains('is-done')))
) {
  throw new Error('Field mobile checkbox failed')
}

const dragEnabled = await fieldCards
  .first()
  .locator('.drag-handle:not([disabled])')
  .count()
if (dragEnabled > 0) throw new Error('Field should not reorder')

await page.screenshot({
  path: `${OUT}/role-field-phone.png`,
  fullPage: true,
})

console.log(
  JSON.stringify(
    {
      ok: true,
      viewport: `${pixel.viewport.width}x${pixel.viewport.height}`,
      assistantAssignReorder: true,
      fieldCompleteOnly: true,
    },
    null,
    2,
  ),
)

await browser.close()
