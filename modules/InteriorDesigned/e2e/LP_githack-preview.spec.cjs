/**
 * 主頁 LP_LayoutPlanner.html?lpPreview=…&lp3d=…（與 raw.githack 相同 query，本地 serve 驗收）
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { resolveE2eArtifactsDir } = require('./lp-e2e-artifacts.cjs');

const ARTIFACTS = resolveE2eArtifactsDir();
const MAIN_PREVIEW_QUERY = 'lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json';

test.describe('Githack 主頁 3D smoke（LP_LayoutPlanner.html）', () => {
  test('orbit + walk：牆／地板／櫃體像素與場景 bbox', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1024, height: 640 });

    await page.goto(`/LP_LayoutPlanner?${MAIN_PREVIEW_QUERY}&lp3d=orbit`, {
      waitUntil: 'load',
    });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await expect(page.locator('#lp-3d-btn-orbit')).toHaveClass(/lp-3d-active/, { timeout: 15000 });
    await page.waitForTimeout(2800);
    expect(errors).toHaveLength(0);

    await page.locator('#lp-3d-btn-preset-top').click();
    await page.waitForTimeout(900);

    const topSnap = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getRoomAcceptanceSnapshot());
    expect(topSnap?.floorWallInnerDelta?.maxEdge ?? 99, '地板 mesh vs 牆內面/cap（≤2cm）').toBeLessThanOrEqual(2);
    await page.waitForFunction(
      () => window.__LP3D_TEST_HOOKS__?.isTopDownPresentationReady?.(),
      { timeout: 15000 },
    );
    const screenshotGap = await page.evaluate(() => (
      window.__LP3D_TEST_HOOKS__?.verifyTopDownScreenshotWallFloorNoGap?.()
    ));
    expect(screenshotGap?.ok, '俯視截圖牆內緣與地板間不得有 >2px 背景').toBe(true);
    for (const row of Object.values(screenshotGap?.rows ?? {})) {
      expect(row.ok, `俯視水平掃描 bg gap ${row.gap}px`).toBe(true);
    }
    for (const col of Object.values(screenshotGap?.cols ?? {})) {
      expect(col.ok, `俯視垂直掃描 bg gap ${col.gap}px`).toBe(true);
    }
    const cabPx = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.sampleCabinetTopDownPixel?.());
    expect(cabPx?.isCabinetColor, '俯視櫃體中心像素應為櫃體色').toBe(true);

    await page.screenshot({ path: path.join(ARTIFACTS, 'githack-main-orbit.png'), fullPage: false });
    await page.screenshot({ path: path.join(ARTIFACTS, 'githack-main-topdown.png'), fullPage: false });

    await page.locator('#lp-3d-btn-preset-corner').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACTS, 'githack-main-oblique.png'), fullPage: false });

    await page.locator('#lp-3d-btn-walk').click();
    await expect(page.locator('#lp-3d-btn-walk')).toHaveClass(/lp-3d-active/);
    await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.resetWalkRoomPreview?.());
    await page.waitForTimeout(1200);

    const wallPx = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.sampleWalkCenterWallPixels?.());
    expect(wallPx?.leftIsWall, 'walk 左側應為牆色').toBe(true);
    expect(wallPx?.rightIsWall, 'walk 右側應為牆色').toBe(true);

    const walkSnap = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getRoomAcceptanceSnapshot());
    expect(Math.abs(walkSnap?.walkCameraRollRad ?? 1)).toBeLessThan(0.02);
    expect(walkSnap?.walkCameraUp?.y ?? 0).toBeGreaterThan(0.99);

    await page.screenshot({ path: path.join(ARTIFACTS, 'githack-main-walk.png'), fullPage: false });
  });

  test('lp3d=walk 冷啟動（主頁 query）', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 640 });
    await page.goto(`/LP_LayoutPlanner?${MAIN_PREVIEW_QUERY}&lp3d=walk`, { waitUntil: 'load' });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await expect(page.locator('#lp-3d-btn-walk')).toHaveClass(/lp-3d-active/);
    await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.resetWalkRoomPreview?.());
    await page.waitForTimeout(1000);
    const wallPx = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.sampleWalkCenterWallPixels?.());
    expect(wallPx?.leftIsWall).toBe(true);
    expect(wallPx?.rightIsWall).toBe(true);
  });
});
