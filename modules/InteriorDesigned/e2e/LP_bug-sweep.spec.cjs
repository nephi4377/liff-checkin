/**
 * LP-BUG-SWEEP-1：2D 編輯真 bug 回歸
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const KEYGUARD_FIXTURE = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');
const WALL_ONLY_FIXTURE = path.join(__dirname, 'fixtures', 'lp-bug-sweep-wall-only.json');

test.describe('LP-BUG-SWEEP-1 2D', () => {
  test('點選牆體區域不拋錯且可顯示選取面板', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(WALL_ONLY_FIXTURE);
    await page.waitForFunction(() => document.querySelector('#drawn-areas-layer path'), { timeout: 20000 });

    const wallGroup = page.locator('#drawn-areas-layer g[data-id="area-demo-wall"]');
    await expect(wallGroup.locator('path')).toBeVisible();
    // 環狀牆 SVG 群組無填充，Playwright 點擊可能穿透；直接派發群組 click
    await wallGroup.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    await expect
      .poll(async () => page.evaluate(() => document.getElementById('selected-info')?.style.display))
      .toBe('block');
    expect(errors.filter((m) => /classList|polygon/i.test(m))).toHaveLength(0);
  });

  test('多選兩櫃 Delete 一次刪除兩件', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(KEYGUARD_FIXTURE);
    await page.waitForSelector('#keyguard-cab-1', { timeout: 15000 });

    await page.locator('#keyguard-cab-1').click({ force: true });
    await page.keyboard.press('Control+d');
    await expect(page.locator('.placed-cabinet')).toHaveCount(2);

    const secondId = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('.placed-cabinet')].map((el) => el.id);
      return ids.find((id) => id !== 'keyguard-cab-1');
    });
    expect(secondId).toBeTruthy();

    await page.locator(`#${secondId}`).click({ force: true });
    await page.locator('#keyguard-cab-1').dispatchEvent('mousedown', { button: 0, shiftKey: true, bubbles: true });

    const selectedCount = await page.evaluate(() => document.querySelectorAll('.placed-cabinet.selected').length);
    expect(selectedCount).toBe(2);

    await page.keyboard.press('Delete');
    await expect(page.locator('.placed-cabinet')).toHaveCount(0);
  });

  test('底圖拖曳後 Ctrl+Z 還原位置', async ({ page }) => {
    const bgFile = path.join(__dirname, 'fixtures', 'lp-tiny-bg.png');
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(bgFile);
    await page.waitForFunction(() => document.getElementById('bg-img')?.src?.startsWith('data:image'), { timeout: 10000 });
    await page.locator('#bg-edit-mode').check();
    const canvas = page.locator('#design-canvas');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 80);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const afterDrag = await page.evaluate(() => {
      const t = document.getElementById('bg-img')?.style.transform || '';
      const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
    });
    expect(Math.abs(afterDrag.x) + Math.abs(afterDrag.y)).toBeGreaterThan(5);
    await canvas.click();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => page.evaluate(() => {
      const t = document.getElementById('bg-img')?.style.transform || '';
      const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      const x = m ? parseFloat(m[1]) : 0;
      const y = m ? parseFloat(m[2]) : 0;
      return Math.abs(x) + Math.abs(y);
    })).toBeLessThan(1);
  });

  test('復原後底圖隱藏（無 data URL 快照）', async ({ page }) => {
    const bgFile = path.join(__dirname, 'fixtures', 'lp-tiny-bg.png');
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(bgFile);
    await page.waitForFunction(() => document.getElementById('bg-img')?.src?.startsWith('data:image'));
    await expect(page.locator('#bg-img')).toBeVisible();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => page.evaluate(() => {
      const img = document.getElementById('bg-img');
      return img?.style.display === 'none' || !img?.src?.startsWith('data:image');
    })).toBe(true);
  });

  test('圖層顯示切換可 Ctrl+Z 復原', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(KEYGUARD_FIXTURE);
    await page.waitForSelector('#keyguard-cab-1');
    const toggle = page.locator('#layer-visibility-list .layer-vis-toggle').first();
    const wasChecked = await toggle.isChecked();
    await toggle.setChecked(!wasChecked);
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+z');
    await expect(toggle).toBeChecked({ checked: wasChecked });
  });

  test('手動報價覆寫可 undo 復原（非 input 原生 undo）', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(KEYGUARD_FIXTURE);
    await page.waitForSelector('#keyguard-cab-1');
    await page.locator('#show-budget-modal-btn').click();
    await page.locator('#budget-edit-toggle-btn').click();
    const nameInput = page.locator('.budget-edit-input[data-field="name"]').first();
    await expect(nameInput).toBeVisible();
    const before = await nameInput.inputValue();
    await nameInput.fill(`${before}-SWEEP`);
    await nameInput.blur();
    await expect(page.locator('#undo-btn')).toBeEnabled();
    await page.evaluate(() => document.getElementById('undo-btn').click());
    await expect.poll(() => page.locator('.budget-edit-input[data-field="name"]').first().inputValue()).toBe(before);
  });

  test('手動報價覆寫可 redo', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(KEYGUARD_FIXTURE);
    await page.waitForSelector('#keyguard-cab-1');
    await page.locator('#show-budget-modal-btn').click();
    await page.locator('#budget-edit-toggle-btn').click();
    const nameInput = page.locator('.budget-edit-input[data-field="name"]').first();
    const before = await nameInput.inputValue();
    const edited = `${before}-REDO`;
    await nameInput.fill(edited);
    await nameInput.blur();
    await expect(page.locator('#undo-btn')).toBeEnabled();
    await page.evaluate(() => document.getElementById('undo-btn').click());
    await expect.poll(() => page.locator('.budget-edit-input[data-field="name"]').first().inputValue()).toBe(before);
    await expect(page.locator('#redo-btn')).toBeEnabled();
    await page.evaluate(() => document.getElementById('redo-btn').click());
    await expect.poll(() => page.locator('.budget-edit-input[data-field="name"]').first().inputValue()).toBe(edited);
  });

  test('手動報價連字輸入僅佔一步歷史', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(KEYGUARD_FIXTURE);
    await page.waitForSelector('#keyguard-cab-1');
    await page.locator('#show-budget-modal-btn').click();
    await page.locator('#budget-edit-toggle-btn').click();
    const nameInput = page.locator('.budget-edit-input[data-field="name"]').first();
    const before = await nameInput.inputValue();
    const typed = `${before}ABCDEFGHIJ`;
    await nameInput.fill(typed);
    await nameInput.blur();
    await expect(page.locator('#undo-btn')).toBeEnabled();
    await page.evaluate(() => document.getElementById('undo-btn').click());
    await expect.poll(() => page.locator('.budget-edit-input[data-field="name"]').first().inputValue()).toBe(before);
  });

  test('復原還原施工面積欄位（history 快照一致）', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    const field = page.locator('#construction-area');
    await field.fill('Sweep-A');
    await field.dispatchEvent('change');
    await field.fill('Sweep-B');
    await field.dispatchEvent('change');
    await page.keyboard.press('Control+z');
    await expect(field).toHaveValue('Sweep-A');
  });
});
