/**
 * Grok r6 / TINA：俯視截圖地板貼牆、俯視→walk、rebuild 牆環數量（SwiftShader 1280×800）
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const ARTIFACTS = '/opt/cursor/artifacts';
const PREVIEW = '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit';

const SWIFT_SHADER_ARGS = [
  '--use-gl=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { args: SWIFT_SHADER_ARGS },
});

async function waitTopDownReady(page) {
  await page.waitForFunction(
    () => window.__LP3D_TEST_HOOKS__?.isTopDownPresentationReady?.(),
    { timeout: 20000 },
  );
}

test.describe('Orbit 俯視截圖地板貼牆（SwiftShader）', () => {
  test('俯視：截圖掃描 + 四向射線無背景帶', async ({ page }) => {
    await page.goto(PREVIEW, { waitUntil: 'load' });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await waitTopDownReady(page);

    const scan = await page.evaluate(() => (
      window.__LP3D_TEST_HOOKS__?.verifyTopDownScreenshotWallFloorNoGap?.()
    ));
    expect(scan?.ok, `截圖掃描 ${JSON.stringify(scan)}`).toBe(true);
    for (const row of Object.values(scan?.rows ?? {})) {
      expect(row.ok, `俯視水平掃描 bg gap ${row.gap}px`).toBe(true);
    }
    for (const col of Object.values(scan?.cols ?? {})) {
      expect(col.ok, `俯視垂直掃描 bg gap ${col.gap}px`).toBe(true);
    }

    await page.screenshot({ path: path.join(ARTIFACTS, 'tina-orbit-topdown-swiftshader.png'), fullPage: false });
  });

  test('俯視→walk：門口地上無平面牆環色帶', async ({ page }) => {
    await page.goto(PREVIEW, { waitUntil: 'load' });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await waitTopDownReady(page);

    await page.locator('#lp-3d-btn-walk').click();
    await expect(page.locator('#lp-3d-btn-walk')).toHaveClass(/lp-3d-active/);
    await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.resetWalkRoomPreview?.());
    await page.waitForTimeout(800);

    const doorBand = await page.evaluate(() => (
      window.__LP3D_TEST_HOOKS__?.sampleWalkDoorFloorNoPlanRingBand?.()
    ));
    expect(doorBand?.planRingsVisible, 'walk 時平面牆環應隱藏').toBe(false);
    expect(doorBand?.ok, '門口地面不應出現俯視牆環深色帶').toBe(true);

    await page.screenshot({ path: path.join(ARTIFACTS, 'tina-orbit-to-walk-door.png'), fullPage: false });
  });

  test('連續 rebuild 後 wallPlanRingMeshes 數量不累積', async ({ page }) => {
    await page.goto(PREVIEW, { waitUntil: 'load' });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await waitTopDownReady(page);

    const afterStress = await page.evaluate(async () => {
      const hooks = window.__LP3D_TEST_HOOKS__;
      const rebuild = document.querySelector('#lp-3d-viewport')?.__lp3dRebuild;
      if (!hooks || !rebuild) return null;
      const counts = [];
      for (let i = 0; i < 8; i++) {
        rebuild();
        counts.push(hooks.getWallPlanRingMeshCount());
      }
      return { counts, final: counts[counts.length - 1] };
    });
    expect(afterStress?.final, 'rebuild 後牆環 mesh 數').toBe(1);
    for (const n of afterStress?.counts ?? []) {
      expect(n, '每次 rebuild 牆環數應固定為 1').toBe(1);
    }
  });
});
