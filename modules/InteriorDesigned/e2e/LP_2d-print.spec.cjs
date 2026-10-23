/**
 * FLOORPLAN-2D-PRINT-1：平面尺寸標註與 A3/A4 出圖
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { resolveE2eArtifactsDir } = require('./lp-e2e-artifacts.cjs');

const ARTIFACTS = resolveE2eArtifactsDir();

function parsePngSize(buffer) {
  if (buffer.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    if (buffer[i] !== sig[i]) return null;
  }
  const w = buffer.readUInt32BE(16);
  const h = buffer.readUInt32BE(20);
  return { width: w, height: h };
}

test.describe('LayoutPlanner 2D 出圖（FLOORPLAN-2D-PRINT-1）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForFunction(() => document.querySelectorAll('.placed-cabinet').length >= 1, { timeout: 25000 });
  });

  test('尺寸標註開關會渲染 SVG 標註', async ({ page }) => {
    await page.locator('#lp-2d-dimensions-toggle').check();
    await page.waitForTimeout(400);
    const count = await page.locator('#lp-2d-dimension-layer .lp-2d-dim').count();
    expect(count).toBeGreaterThan(0);
    await page.locator('#lp-2d-dimensions-toggle').uncheck();
    await page.waitForTimeout(200);
    await expect(page.locator('#lp-2d-dimension-layer')).toBeHidden();
  });

  test('A4 平面出圖 PNG 尺寸正確且非空白', async ({ page }) => {
    await page.locator('#lp-2d-dimensions-toggle').check();
    await page.locator('#lp-2d-print-toolbar-btn').click();
    await expect(page.locator('#lp-2d-print-modal')).toBeVisible();
    await page.selectOption('#lp-2d-print-sheet-select', 'A4_LANDSCAPE');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator('#lp-2d-print-png-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^layout-2d-print-A4-\d{8}-\d{4}\.png$/);
    const tmpPath = path.join(ARTIFACTS, 'lp-2d-print-a4.png');
    await download.saveAs(tmpPath);
    const buf = fs.readFileSync(tmpPath);
    const size = parsePngSize(buf);
    expect(size).not.toBeNull();
    expect(size.width).toBe(1123);
    expect(size.height).toBe(794);
    const sample = buf.subarray(0, Math.min(buf.length, 8000));
    const uniq = new Set(sample);
    expect(uniq.size).toBeGreaterThan(8);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-2d-print-modal.png'), fullPage: false });
  });
});
