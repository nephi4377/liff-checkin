const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('LayoutPlanner mobile / tablet', () => {
  test('?lpMobile=1：啟用觸控 UI、不顯示舊版全螢幕阻擋', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#mobile-warning')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/lp-touch-mode/);
    await expect(page.locator('#design-canvas')).toBeVisible();
    await expect(page.locator('#canvas-wrapper')).toBeVisible();

    await page.waitForTimeout(1500);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);
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
