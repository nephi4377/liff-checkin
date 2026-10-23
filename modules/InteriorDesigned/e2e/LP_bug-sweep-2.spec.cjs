/**
 * LP-BUG-SWEEP-2：3D／2D→3D 回歸
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const DEMO_FIXTURE = path.join(__dirname, 'fixtures', 'lp-3d-spec-demo.json');

test.describe('LP-BUG-SWEEP-2 3D', () => {
  test('示範佈局開啟 3D 可渲染 canvas', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(DEMO_FIXTURE);
    await page.waitForTimeout(800);
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 15000 });
    const canvas = page.locator('#lp-3d-viewport canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const size = await canvas.evaluate((el) => ({
      w: el.clientWidth,
      h: el.clientHeight,
    }));
    expect(size.w).toBeGreaterThan(100);
    expect(size.h).toBeGreaterThan(100);
    expect(errors.filter((m) => /WebGL|classList/i.test(m))).toHaveLength(0);
    await page.screenshot({
      path: '/opt/cursor/artifacts/lp-bug-sweep-2-3d-render.png',
      fullPage: false,
    });
  });
});
