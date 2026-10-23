/**
 * Grok r6：俯視截圖掃描牆內緣與地板之間不得有 >2px 背景空隙（SwiftShader 1280×800）
 */
const { test, expect } = require('@playwright/test');

const SWIFT_SHADER_ARGS = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { args: SWIFT_SHADER_ARGS },
});

test.describe('Orbit 俯視截圖地板貼牆（SwiftShader）', () => {
  test('lp3d=orbit 等 9s：水平/垂直掃描無背景帶', async ({ page }) => {
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit',
      { waitUntil: 'load' },
    );
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await page.waitForTimeout(9000);

    const scan = await page.evaluate(() => (
      window.__LP3D_TEST_HOOKS__?.verifyTopDownScreenshotWallFloorNoGap?.({ scanY: 437 })
    ));
    expect(scan?.ok, `截圖掃描牆→地板背景帶 max=${JSON.stringify(scan)}`).toBe(true);
    for (const [y, row] of Object.entries(scan?.rows ?? {})) {
      expect(row.ok, `row y=${y} bg gap ${row.gap}px`).toBe(true);
    }
    for (const [x, col] of Object.entries(scan?.cols ?? {})) {
      expect(col.ok, `col x=${x} bg gap ${col.gap}px`).toBe(true);
    }
  });
});
