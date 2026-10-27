const { test, expect } = require('@playwright/test');

test('mirrored fixture 的 3D 標籤 scale.x 為正（不反字）', async ({ page }) => {
  await page.goto(
    '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-mirrored-cab.json&lp3d=orbit',
    { waitUntil: 'load' },
  );
  await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 15000 });
  await page.waitForFunction(() => {
    const scales = window.__LP3D_TEST_HOOKS__?.getLabelSpriteScaleX?.() ?? [];
    return scales.length > 0;
  });
  const scales = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getLabelSpriteScaleX?.() ?? []);
  expect(scales.length).toBeGreaterThan(0);
  for (const x of scales) {
    expect(x).toBeGreaterThan(0);
  }
});
