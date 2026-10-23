/**
 * 以目前工作區 LP_3DViewer.js 量測（修正前可 git show main 覆蓋後執行）
 * node scripts/lp-3d-perf-baseline.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ITERATIONS = Number(process.env.LP_3D_PERF_ITERATIONS || 20);
const ARTIFACTS = process.env.LP_E2E_ARTIFACTS || '/opt/cursor/artifacts';
const cwd = path.join(__dirname, '..');

function readHeap(page) {
  return page.evaluate(() => {
    const mem = performance.memory;
    if (!mem) return null;
    return { bytes: mem.usedJSHeapSize, mb: Math.round(mem.usedJSHeapSize / (1024 * 1024)) };
  });
}

(async () => {
  const server = spawn('npx', ['--yes', 'serve@14', '-l', '8766', '.'], { cwd, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const fixture = path.join(cwd, 'e2e/fixtures/lp-perf-large.json');
  await page.goto('http://127.0.0.1:8766/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#layout-upload').setInputFiles(fixture);
  await page.waitForTimeout(800);

  const heapStart = await readHeap(page);
  const toggle = page.locator('#toggle-3d-view-btn');
  for (let i = 0; i < ITERATIONS; i += 1) {
    await toggle.click();
    await page.waitForTimeout(1200);
    await page.locator('#lp-3d-btn-exit-2d').click();
    await page.waitForTimeout(400);
  }

  const in3dAfterToggles = await page.evaluate(() => document.body.classList.contains('lp-3d-mode'));
  if (!in3dAfterToggles) {
    await toggle.click();
    await page.waitForTimeout(1500);
  }
  const heapBeforeRebuild = await readHeap(page);
  const hasRebuildHook = await page.evaluate(
    () => typeof document.getElementById('lp-3d-viewport')?.__lp3dRebuild === 'function',
  );
  if (hasRebuildHook) {
    for (let i = 0; i < ITERATIONS; i += 1) {
      await page.evaluate(() => document.getElementById('lp-3d-viewport').__lp3dRebuild());
      await page.waitForTimeout(350);
    }
  }
  const heapAfterRebuild = hasRebuildHook ? await readHeap(page) : null;
  await page.locator('#lp-3d-btn-exit-2d').click();
  await page.waitForTimeout(400);
  const heapEnd = await readHeap(page);

  const report = {
    label: process.env.LP_3D_PERF_LABEL || 'baseline',
    iterations: ITERATIONS,
    heapStart,
    heapEnd,
    heapDeltaBytes: heapStart && heapEnd ? heapEnd.bytes - heapStart.bytes : null,
    rebuildStressDeltaBytes: heapBeforeRebuild && heapAfterRebuild
      ? heapAfterRebuild.bytes - heapBeforeRebuild.bytes
      : null,
    timestamp: new Date().toISOString(),
  };

  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const out = path.join(ARTIFACTS, `lp-3d-perf-${report.label}.json`);
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  server.kill();
  await browser.close();
})();
