import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const OUT = '/cursor/stores/bc-d19b3ef0-82b4-446e-8016-9d87e5589e85/media'
const ART = '/opt/cursor/artifacts'
await mkdir(OUT, { recursive: true })
await mkdir(ART, { recursive: true })

const BASE = 'http://127.0.0.1:5173'
const v = Date.now()

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 900 },
  serviceWorkers: 'block',
})

try {
  // 派工：誰派的可新增
  await page.goto(`${BASE}/?role=paigong&demo=1&v=${v}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  const start = page.getByRole('button', { name: '開始派工' })
  if (await start.count()) await start.click()
  await page.getByRole('tab', { name: /恩德/ }).waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /加一件|新增/ }).first().click().catch(() => {})
  const addBar = page.locator('.simple-add-bar button, .simple-add-toggle, button:has-text("加一件")')
  if (await addBar.count()) {
    await addBar.first().click()
  }
  await page.waitForTimeout(400)
  const assigner = page.locator('select.assigner-select, select.task-assigner-select').first()
  if (await assigner.count()) {
    await assigner.selectOption({ label: '＋ 新增派工人' })
    await page.waitForTimeout(200)
    await page.locator('.assigner-add-input').fill('測試派工')
    await page.screenshot({
      path: `${OUT}/employee-todo-assigner-add.png`,
      fullPage: true,
    })
    await page.screenshot({
      path: `${ART}/employee-todo-assigner-add.png`,
      fullPage: true,
    })
    await page.locator('.assigner-add-ok').click()
    await page.waitForTimeout(300)
  }

  // 工務：四區塊 + 說明區
  await page.goto(`${BASE}/?role=ende&demo=1&v=${v}`, {
    waitUntil: 'networkidle',
  })
  await page.locator('.worker-cat-stack').waitFor({ timeout: 15000 })
  await page.screenshot({
    path: `${OUT}/employee-todo-worker-blocks.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-worker-blocks.png`,
    fullPage: true,
  })

  const noteBtn = page.locator('.worker-note').first()
  if (await noteBtn.count()) {
    await noteBtn.click()
    await page.locator('.worker-note-input').fill('現場備註：材料已到，明天補土')
    await page.screenshot({
      path: `${OUT}/employee-todo-worker-note.png`,
      fullPage: true,
    })
    await page.screenshot({
      path: `${ART}/employee-todo-worker-note.png`,
      fullPage: true,
    })
    await page.locator('.worker-note-save').click()
    await page.waitForTimeout(300)
  }

  // 已完成 10 天提示
  const hint = await page.locator('.done-hint').first().innerText()
  await page.screenshot({
    path: `${OUT}/employee-todo-done-10d-hint.png`,
    fullPage: true,
  })
  await page.screenshot({
    path: `${ART}/employee-todo-done-10d-hint.png`,
    fullPage: true,
  })

  console.log(JSON.stringify({ ok: true, doneHint: hint }))
} finally {
  await browser.close().catch(() => {})
}
