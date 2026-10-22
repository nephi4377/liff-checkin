/**
 * LayoutPlanner 畫面回歸（2D / 3D 基準截圖 + console 無 error）
 * 示範配置：e2e/fixtures/lp-walk-keyguard.json（鍵盤守衛 E2E 沿用，非客戶資料）
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const DEMO_FIXTURE = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');

/** @param {import('@playwright/test').Page} page */
function attachStrictConsoleGuard(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

/** @param {import('@playwright/test').Page} page */
async function loadDemoLayout(page) {
  await page.locator('#layout-upload').setInputFiles(DEMO_FIXTURE);
  await expect(page.locator('.placed-cabinet')).toHaveCount(1);
  await expect(page.locator('#drawn-areas-layer polygon')).toHaveCount(1);
  await page.locator('#zoom-reset-btn').click();
  await page.waitForTimeout(400);
}

test.describe('LayoutPlanner 畫面回歸', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });

  test('示範配置：2D / 3D 基準圖與無 console error', async ({ page }) => {
    const consoleErrors = attachStrictConsoleGuard(page);

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#mobile-warning')).toBeHidden();
    await expect(page.locator('#toolbox-window')).toBeVisible();

    await loadDemoLayout(page);

    const canvas2d = page.locator('#design-canvas');
    await expect(canvas2d).toBeVisible();
    await page.waitForTimeout(300);

    await expect(canvas2d).toHaveScreenshot('lp-demo-2d.png', {
      animations: 'disabled',
      maxDiffPixels: 120,
      maxDiffPixelRatio: 0.01,
    });

    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-viewport canvas')).toHaveCount(1);
    await page.waitForTimeout(2800);

    const viewport3d = page.locator('#lp-3d-viewport');
    await expect(viewport3d).toBeVisible();

    await expect(viewport3d).toHaveScreenshot('lp-demo-3d-orbit.png', {
      animations: 'disabled',
      maxDiffPixels: 2500,
      maxDiffPixelRatio: 0.035,
    });

    expect(consoleErrors, `console 錯誤: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });
});
