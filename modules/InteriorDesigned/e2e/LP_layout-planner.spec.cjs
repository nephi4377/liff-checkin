const { test, expect } = require('@playwright/test');

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

  test('3D 檢視切換不造成頁面錯誤', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-overlay')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);

    await page.locator('#toggle-3d-view-btn').click();
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
