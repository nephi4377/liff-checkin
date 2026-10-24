const { test, expect } = require('@playwright/test');
const path = require('path');

/** TINA r6：真點擊／tap，驗證 hit-test 與 44px 觸控目標 */
async function expectMobilePanelCloseWorks(page, closeSelector) {
  const btn = page.locator(closeSelector);
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box, `${closeSelector} boundingBox`).toBeTruthy();
  expect(box.width, `${closeSelector} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${closeSelector} height`).toBeGreaterThanOrEqual(44);

  const hitOk = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return top === el || el.contains(top);
  }, closeSelector);
  expect(hitOk, `elementFromPoint 應命中 ${closeSelector}`).toBe(true);

  await btn.click();
}

test.describe('LayoutPlanner mobile / tablet', () => {
  test('?lpMobile=1：啟用觸控 UI、不顯示舊版全螢幕阻擋', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#mobile-warning')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/lp-touch-mode/);
    await expect(page.locator('body')).toHaveClass(/lp-ui-dock-tb-float-bi/);
    await expect(page.locator('#design-canvas')).toBeVisible();
    await expect(page.locator('#canvas-wrapper')).toBeVisible();

    await page.waitForTimeout(1500);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('窄螢幕：可開啟工具箱與預算視窗', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolbox-window')).toBeHidden();
    await page.locator('#toggle-toolbox-btn').click();
    await expect(page.locator('#toolbox-window')).toBeVisible();

    await expect(page.locator('#info-window')).toBeHidden();
    await page.locator('#toggle-info-btn').click();
    await expect(page.locator('#info-window')).toBeVisible();
  });

  test('窄螢幕：標題列 ✕ 可關閉工具箱與預算視窗', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });

    await page.locator('#toggle-toolbox-btn').click();
    await expect(page.locator('#toolbox-window')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/lp-mobile-panel-open/);
    await expectMobilePanelCloseWorks(page, '#toggle-toolbox-btn-header');
    await expect(page.locator('#toolbox-window')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/lp-mobile-panel-open/);

    await page.locator('#toggle-info-btn').click();
    await expect(page.locator('#info-window')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/lp-mobile-panel-open/);
    await expectMobilePanelCloseWorks(page, '#toggle-info-btn-header');
    await expect(page.locator('#info-window')).toBeHidden();
  });

  test('觸控路徑：載入佈局後可拖曳櫃體', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');
    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(fixture);
    await page.waitForTimeout(800);

    const cab = page.locator('#keyguard-cab-1');
    await expect(cab).toBeVisible();
    const before = await cab.evaluate((el) => ({ left: el.style.left, top: el.style.top }));

    const box = await cab.boundingBox();
    expect(box).toBeTruthy();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.evaluate(
      ({ id, dx, dy }) => {
        const el = document.getElementById(id);
        if (!el) throw new Error('cab missing');
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        el.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: cx,
            clientY: cy,
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            isPrimary: true,
          }),
        );
        document.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: cx + dx,
            clientY: cy + dy,
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            isPrimary: true,
          }),
        );
        window.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            clientX: cx + dx,
            clientY: cy + dy,
            pointerId: 1,
            pointerType: 'touch',
            button: 0,
            isPrimary: true,
          }),
        );
      },
      { id: 'keyguard-cab-1', dx: 60, dy: 40 },
    );

    await page.waitForTimeout(300);
    const after = await cab.evaluate((el) => ({ left: el.style.left, top: el.style.top }));
    const moved = before.left !== after.left || before.top !== after.top;
    expect(moved, `拖曳前 ${JSON.stringify(before)} 拖曳後 ${JSON.stringify(after)}`).toBe(true);
  });

  test('3D 檢視可在觸控模式下開啟', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-viewport canvas')).toBeVisible({ timeout: 20_000 });
  });
});
