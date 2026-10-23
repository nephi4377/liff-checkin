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
