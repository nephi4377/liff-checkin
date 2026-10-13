import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-01a12e27-c0cd-77e9-acf6-84755fc3d76b/media'
await mkdir(OUT, { recursive: true })
const url = 'https://yang-employee-todo.surge.sh/?v=' + Date.now()

const browser = await chromium.launch({ headless: true })

async function openPhone() {
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
  return { context, page }
}

const a = await openPhone()
const b = await openPhone()

const icons = await a.page.locator('.drag-dots').allTextContents()
if (!icons.length || icons.some((t) => t.trim() !== '⋮')) {
  throw new Error('drag handle not three-dots: ' + JSON.stringify(icons))
}

await a.page.getByRole('tab', { name: /恩德/ }).click()
await a.page.waitForTimeout(400)
const titlesBefore = await a.page.locator('.task-title').allTextContents()
if (!titlesBefore.some((t) => t.includes('補土'))) {
  throw new Error('no 補土 task: ' + JSON.stringify(titlesBefore))
}

const card = a.page.locator('.task-card', { hasText: '補土' }).first()
await card.getByRole('button', { name: '刪除' }).click()
await a.page.waitForTimeout(1500)

if ((await a.page.locator('.task-title', { hasText: '補土' }).count()) !== 0) {
  throw new Error('delete UI failed')
}

await a.page.reload({ waitUntil: 'networkidle' })
await a.page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 15000 })
await a.page.waitForTimeout(2500)
const afterReload = await a.page.locator('.task-title').allTextContents()
if (afterReload.some((t) => t.includes('補土'))) {
  throw new Error('DELETED TASK REAPPEARED: ' + JSON.stringify(afterReload))
}

const parsed = await a.page.evaluate(() =>
  JSON.parse(localStorage.getItem('employee-todo-v3') || '{}'),
)
if (!parsed.deletedIds?.includes('task-ende-751-putu')) {
  throw new Error('tombstone missing: ' + JSON.stringify(parsed.deletedIds))
}

await a.page.screenshot({
  path: `${OUT}/delete-persists-after-reload.png`,
  fullPage: true,
})

await b.page.reload({ waitUntil: 'networkidle' })
await b.page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 15000 })
await b.page.waitForTimeout(3000)
const bTitles = await b.page.locator('.task-title').allTextContents()
if (bTitles.some((t) => t.includes('補土'))) {
  throw new Error('sync failed B still has 補土: ' + JSON.stringify(bTitles))
}
await b.page.screenshot({ path: `${OUT}/sync-second-device.png`, fullPage: true })

await b.page.locator('.task-title-btn').first().click()
await b.page.locator('.task-edit-input').fill('同步測試標題XYZ')
await b.page.locator('.task-edit-input').press('Enter')
await b.page
  .waitForFunction(
    () =>
      document.body.innerText.includes('已同步') &&
      document.body.innerText.includes('同步測試標題XYZ'),
    null,
    { timeout: 15000 },
  )
  .catch(() => {})
await b.page.waitForTimeout(1000)

// Confirm cloud has the edit before A reloads
for (let i = 0; i < 10; i++) {
  const cloud = await (
    await fetch('https://mantledb.sh/v2/yang-employee-todo-1791806583/room')
  ).json()
  const titles = (cloud.tasks || []).map((t) => t.title)
  if (titles.some((t) => String(t).includes('同步測試標題XYZ'))) break
  if (i === 9) throw new Error('cloud missing edit: ' + JSON.stringify(titles))
  await new Promise((r) => setTimeout(r, 500))
}

await a.page.reload({ waitUntil: 'networkidle' })
await a.page.getByRole('tab', { name: /恩德/ }).waitFor()
await a.page.waitForTimeout(3000)
const aAfterEdit = await a.page.locator('.task-title').allTextContents()
if (!aAfterEdit.some((t) => t.includes('同步測試標題XYZ'))) {
  throw new Error('edit did not sync to A: ' + JSON.stringify(aAfterEdit))
}

await a.page.screenshot({ path: `${OUT}/sync-edit-shared.png`, fullPage: true })
await a.page.screenshot({
  path: `${OUT}/drag-handle-three-dots.png`,
  fullPage: true,
})

console.log(
  JSON.stringify(
    {
      ok: true,
      deletePersists: true,
      syncDeleteToB: true,
      syncEditToA: true,
      dragIcon: icons[0]?.trim(),
      aAfterEdit,
    },
    null,
    2,
  ),
)

await a.context.close()
await b.context.close()
await browser.close()
