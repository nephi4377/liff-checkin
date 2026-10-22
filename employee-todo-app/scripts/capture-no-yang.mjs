import { chromium } from 'playwright'

const OUT = '/cursor/stores/bc-01a12e27-c0cd-77e9-acf6-84755fc3d76b/media'
const v = Date.now()

function assertNoYang(text) {
  const lower = text.toLowerCase()
  if (lower.includes('yang') || lower.includes('surge.sh')) {
    throw new Error(`found yang/domain in UI: ${text.slice(0, 200)}`)
  }
}

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  })

  await page.goto(`https://yang-employee-todo.surge.sh/?v=${v}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: '選擇入口' }).waitFor({ timeout: 20000 })
  const subs = await page.locator('.entry-btn-sub').allTextContents()
  assertNoYang(subs.join('\n'))
  await page.screenshot({ path: `${OUT}/no-yang-hub-buttons.png`, fullPage: true })

  for (const [host, file] of [
    ['yang-paigong.surge.sh', 'no-yang-paigong.png'],
    ['yang-ende.surge.sh', 'no-yang-ende.png'],
    ['yang-ayong.surge.sh', 'no-yang-ayong.png'],
  ]) {
    await page.goto(`https://${host}/?v=${v}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)
    const body = await page.locator('body').innerText()
    assertNoYang(body)
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true })
  }

  await page.goto(`https://yang-paigong.surge.sh/?v=${v}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  const startBtn = page.getByRole('button', { name: '開始派工' })
  if (await startBtn.count()) await startBtn.click()
  await page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 20000 })
  const priorityCol = page.locator('.list-priority .task-list')
  await priorityCol.waitFor({ timeout: 10000 })
  const firstCard = priorityCol.locator('.task-card').first()
  await firstCard.getByRole('button', { name: '不急' }).click()
  await page.waitForTimeout(400)
  await firstCard.getByRole('button', { name: '緊急' }).click()
  await page.waitForTimeout(400)
  const badges = await priorityCol.locator('.urgency-badge').allTextContents()
  const order = badges.map((b) => b.trim())
  const rank = (l) => (l === '緊急' ? 0 : l === '普通' ? 1 : l === '不急' ? 2 : 9)
  for (let i = 1; i < order.length; i++) {
    if (rank(order[i]) < rank(order[i - 1])) {
      throw new Error(`priority sort: ${order.join(' > ')}`)
    }
  }
  await page.screenshot({ path: `${OUT}/priority-urgency-auto-sort.png`, fullPage: true })

  console.log(JSON.stringify({ ok: true, hubSubs: subs, priorityOrder: order }))
} finally {
  try {
    await browser.close()
  } catch {
    /* EAGAIN on close in some environments */
  }
}
