const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const { resolveE2eArtifactsDir } = require('./lp-e2e-artifacts.cjs');
const ARTIFACTS = resolveE2eArtifactsDir();
const ITERATIONS = Number(process.env.LP_3D_PERF_ITERATIONS || 20);
const LARGE_FIXTURE = path.join(__dirname, 'fixtures', 'lp-perf-large.json');

/** @returns {Promise<{ samples: number[], avgMs: number }>} */
async function sampleFrameTimes(page, sampleCount = 12) {
  return page.evaluate(async (count) => {
    const samples = [];
    let last = performance.now();
    await new Promise((resolve) => {
      let n = 0;
      function frame(now) {
        samples.push(now - last);
        last = now;
        n += 1;
        if (n < count) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    const avgMs = samples.reduce((a, b) => a + b, 0) / samples.length;
    return { samples, avgMs };
  }, sampleCount);
}

function readHeap(page) {
  return page.evaluate(() => {
    const mem = performance.memory;
    if (!mem) return null;
    return { bytes: mem.usedJSHeapSize, mb: Math.round(mem.usedJSHeapSize / (1024 * 1024)) };
  });
}

async function runToggleCycle(page) {
  const toggle = page.locator('#toggle-3d-view-btn');
  await toggle.click();
  await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
  await page.waitForTimeout(1200);
  const frame = await sampleFrameTimes(page);
  const diagOpen = await page.evaluate(() => document.getElementById('lp-3d-viewport')?.__lp3dGetDiagnostics?.());
  expect(diagOpen?.animationFrameScheduled).toBe(true);

  await page.locator('#lp-3d-btn-exit-2d').click();
  await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);
  await page.waitForTimeout(400);
  const diagClosed = await page.evaluate(() => document.getElementById('lp-3d-viewport')?.__lp3dGetDiagnostics?.());
  expect(diagClosed?.isOpen).toBe(false);
  expect(diagClosed?.animationFrameScheduled).toBe(false);
  expect(diagClosed?.walkCreateCount ?? 1).toBe(1);

  return frame.avgMs;
}

test.describe('LayoutPlanner 3D perf / memory', () => {
  test('大型配置反覆 2D↔3D 切換：heap 與 RAF 不洩漏', async ({ page, browserName }) => {
    test.setTimeout(180000);
    test.skip(browserName !== 'chromium', 'performance.memory 僅 Chromium');

    await page.goto('/LP_LayoutPlanner?lpPreview=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(LARGE_FIXTURE);
    await page.waitForTimeout(600);

    const cabinetCount = await page.evaluate(() => document.querySelectorAll('.placed-cabinet').length);
    expect(cabinetCount).toBeGreaterThanOrEqual(60);

    await page.waitForTimeout(500);
    const heapStart = await readHeap(page);

    const frameTimes = [];
    for (let i = 0; i < ITERATIONS; i += 1) {
      frameTimes.push(await runToggleCycle(page));
    }

    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.waitForTimeout(1500);
    const heapBeforeRebuild = await readHeap(page);
    for (let i = 0; i < ITERATIONS; i += 1) {
      await page.evaluate(() => document.getElementById('lp-3d-viewport')?.__lp3dRebuild?.());
      await page.waitForTimeout(350);
    }
    const heapAfterRebuild = await readHeap(page);
    await page.locator('#lp-3d-btn-exit-2d').click();

    await page.waitForTimeout(800);
    const heapEnd = await readHeap(page);
    const canvasCount = await page.locator('#lp-3d-viewport canvas').count();
    expect(canvasCount).toBe(1);

    const avgFrameMs = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const heapDeltaBytes = heapStart && heapEnd ? heapEnd.bytes - heapStart.bytes : null;
    const rebuildStressDeltaBytes = heapBeforeRebuild && heapAfterRebuild
      ? heapAfterRebuild.bytes - heapBeforeRebuild.bytes
      : null;

    const report = {
      taskId: 'FLOORPLAN-3D-PERF-1',
      iterations: ITERATIONS,
      cabinetCount,
      heapStart,
      heapEnd,
      heapDeltaBytes,
      heapDeltaMbRounded: heapStart && heapEnd ? heapEnd.mb - heapStart.mb : null,
      rebuildStressDeltaBytes,
      avgFrameMs: Math.round(avgFrameMs * 100) / 100,
      maxFrameMs: Math.round(Math.max(...frameTimes) * 100) / 100,
      timestamp: new Date().toISOString(),
      branch: 'after-fix',
    };

    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const outPath = path.join(ARTIFACTS, 'lp-3d-perf-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    if (heapDeltaBytes != null) {
      expect(heapDeltaBytes, `JS heap 增長 ${heapDeltaBytes} bytes`).toBeLessThan(95 * 1024 * 1024);
    }
    if (rebuildStressDeltaBytes != null) {
      expect(rebuildStressDeltaBytes, `3D 內 rebuild 後 heap +${rebuildStressDeltaBytes}`).toBeLessThan(60 * 1024 * 1024);
    }
    expect(avgFrameMs, `平均幀時間 ${avgFrameMs}ms`).toBeLessThan(120);
  });
});
