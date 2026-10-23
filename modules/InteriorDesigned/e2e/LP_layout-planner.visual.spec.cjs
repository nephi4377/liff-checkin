/**
 * LayoutPlanner 畫面回歸（2D / 3D 基準截圖 + console 無 error）
 * 示範配置：e2e/fixtures/lp-walk-keyguard.json（鍵盤守衛 E2E 沿用，非客戶資料）
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  attachStrictConsoleGuard,
  installLayoutPlannerVisualRoutes,
  installDeterministicFonts,
  visualRegressionMasks,
  getDemoGeometryClip,
  waitFor3dRenderSettle,
} = require('./lp-visual-helpers.cjs');
const { waitForLpBoot, loadLayoutFixture } = require('./lp-e2e-helpers.cjs');

const DEMO_FIXTURE = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');

/** @param {import('@playwright/test').Page} page */
async function loadDemoLayout(page) {
  await loadLayoutFixture(page, DEMO_FIXTURE);
  await expect(page.locator('.placed-cabinet')).toHaveCount(1);
  await expect(page.locator('#drawn-areas-layer polygon')).toHaveCount(1);
  await page.locator('#zoom-reset-btn').click();
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

test.describe('LayoutPlanner 畫面回歸', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });

  test.beforeEach(async ({ page }) => {
    await installLayoutPlannerVisualRoutes(page);
  });

  test('示範配置：2D / 3D 基準圖與無 console error', async ({ page }) => {
    const consoleErrors = attachStrictConsoleGuard(page);

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await waitForLpBoot(page);
    await installDeterministicFonts(page);
    await expect(page.locator('#mobile-warning')).toBeHidden();
    await expect(page.locator('#toolbox-window')).toBeVisible();

    await loadDemoLayout(page);

    await expect(page.locator('#design-canvas')).toBeVisible();

    const clip2d = await getDemoGeometryClip(page);
    expect(clip2d, '示範幾何 clip 應可計算').not.toBeNull();

    await expect(page).toHaveScreenshot('lp-demo-2d.png', {
      animations: 'disabled',
      maxDiffPixels: 150,
      mask: visualRegressionMasks(page),
      clip: clip2d,
    });

    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await waitFor3dRenderSettle(page);

    const viewport3d = page.locator('#lp-3d-viewport');
    await expect(viewport3d).toBeVisible();

    await expect(viewport3d).toHaveScreenshot('lp-demo-3d-orbit.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.028,
    });

    expect(consoleErrors, `console 錯誤: ${consoleErrors.join('; ')}`).toHaveLength(0);
  });
});
