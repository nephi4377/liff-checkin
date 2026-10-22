const { test, expect } = require('@playwright/test');
const path = require('path');

const ARTIFACTS = process.env.LP_E2E_ARTIFACTS || '/opt/cursor/artifacts';

async function get3dCanvasCoverage(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('lp-3d-overlay');
    const canvas = document.querySelector('#lp-3d-viewport canvas');
    if (!overlay || !canvas) return null;
    const or = overlay.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const blockers = ['left-rail', 'right-rail', 'canvas-header', 'minimized-bar'];
    const overlaps = blockers.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return null;
      const r = el.getBoundingClientRect();
      const hit = !(cr.right < r.left || cr.left > r.right || cr.bottom < r.top || cr.top > r.bottom);
      return hit ? id : null;
    }).filter(Boolean);
    return {
      overlay: { w: or.width, h: or.height },
      canvas: { w: cr.width, h: cr.height, top: cr.top, left: cr.left },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overlaps,
    };
  });
}

test.describe('LayoutPlanner E2E', () => {
  test('頁面載入：工具箱可見、非手機遮罩、施工面積欄位存在', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#mobile-warning')).toBeHidden();
    await expect(page.locator('#toolbox-window')).toBeVisible();
    await expect(page.locator('#construction-area')).toBeVisible();

    await page.waitForTimeout(2000);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('施工面積變更寫入歷史後，Ctrl+Z 可復原', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#undo-btn')).toBeDisabled();

    const field = page.locator('#construction-area');
    await field.fill('測試_12坪');
    await field.dispatchEvent('change');

    await expect(page.locator('#undo-btn')).not.toBeDisabled();

    await page.click('body');
    await page.keyboard.press('Control+z');

    await expect(field).toHaveValue('');
    await expect(page.locator('#undo-btn')).toBeDisabled();
  });

  test('復原後 Ctrl+Y 可重做', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });

    const field = page.locator('#construction-area');
    await field.fill('重做測試');
    await field.dispatchEvent('change');

    await page.click('body');
    await page.keyboard.press('Control+z');
    await expect(field).toHaveValue('');

    await page.keyboard.press('Control+y');
    await expect(field).toHaveValue('重做測試');
  });

  test('3D 模組載入失敗時 2D 仍可用', async ({ page }) => {
    await page.route(/LP_3DViewer\.js/, (route) => route.abort('failed'));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolbox-window')).toBeVisible();

    await page.locator('#toggle-3d-view-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);

    const field = page.locator('#construction-area');
    await field.fill('2D仍可用');
    await field.dispatchEvent('change');
    await expect(field).toHaveValue('2D仍可用');
    await expect(page.locator('#undo-btn')).not.toBeDisabled();
  });

  test('連點 3D 按鈕只建立一個 canvas', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    const btn = page.locator('#toggle-3d-view-btn');
    await btn.dblclick();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-viewport canvas')).toHaveCount(1);
  });

  test('3D 模組載入失敗後再按可成功開啟', async ({ page }) => {
    let blockViewer = true;
    await page.route(/LP_3DViewer\.js/, (route) => {
      if (blockViewer) route.abort('failed');
      else route.continue();
    });

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    const btn = page.locator('#toggle-3d-view-btn');
    await btn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);

    blockViewer = false;
    await btn.click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-viewport canvas')).toHaveCount(1);
  });

  test('3D 畫布全螢幕不被側欄或底列遮住（桌機）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.waitForTimeout(2500);

    const cov = await get3dCanvasCoverage(page);
    expect(cov).not.toBeNull();
    expect(cov.overlaps).toEqual([]);
    expect(cov.canvas.w).toBeGreaterThan(cov.viewport.w * 0.92);
    expect(cov.canvas.h).toBeGreaterThan(cov.viewport.h * 0.55);

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-orbit-desktop.png'), fullPage: false });
    await page.locator('#lp-3d-btn-walk').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-walk-desktop.png'), fullPage: false });
  });

  test('3D 畫布在小視窗仍佔滿可視區（手機寬度）', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.getElementById('toggle-3d-view-btn')?.click());
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.waitForTimeout(2500);

    const cov = await get3dCanvasCoverage(page);
    expect(cov).not.toBeNull();
    expect(cov.overlaps).toEqual([]);
    expect(cov.canvas.w).toBeGreaterThan(360);

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-orbit-mobile.png'), fullPage: false });
  });

  test('3D 檢視切換不造成頁面錯誤', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-overlay')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);

    await page.locator('#lp-3d-btn-exit-2d').click();
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);
  });

  test('可開啟預算明細 Modal 並關閉', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#show-budget-modal-btn').click();
    await expect(page.locator('#budget-modal')).toBeVisible();
    await page.locator('#budget-modal-close-btn').click();
    await expect(page.locator('#budget-modal')).toBeHidden();
  });
});
