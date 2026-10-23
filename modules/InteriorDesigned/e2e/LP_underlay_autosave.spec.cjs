const { test, expect } = require('@playwright/test');
const path = require('path');

const DEMO_PLAN = path.join(__dirname, 'fixtures', 'demo-floorplan-underlay.png');

test.describe('FLOORPLAN-UNDERLAY autosave', () => {
  test('QuotaExceeded 時寫入 srcOmitted 備份並提示', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());

    await page.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'layoutPlanner_autosave_v1' && value.includes('data:image')) {
          const err = new DOMException('quota', 'QuotaExceededError');
          throw err;
        }
        return orig.call(this, key, value);
      };
    });

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.runAutoSave?.(true);
    });
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('layoutPlanner_autosave_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    });
    expect(saved?.background?.srcOmitted).toBe(true);
    expect(saved?.background?.src || '').not.toMatch(/^data:image/);

    const toast = await page.locator('#global-notification-container').textContent().catch(() => '');
    expect(toast).toMatch(/底圖過大|自動備份/);
  });

  test('底圖透明度 undo 後仍保留底圖', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForFunction(() => document.getElementById('bg-img')?.src?.startsWith('data:image'));
    await page.waitForTimeout(300);
    const beforeOpacity = await page.inputValue('#bg-opacity-num');
    await page.locator('#bg-opacity').fill('0.35');
    await page.locator('#bg-opacity').dispatchEvent('input');
    await page.waitForTimeout(400);
    await page.locator('#undo-btn').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#bg-opacity-num')).toHaveValue(beforeOpacity);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);
  });
});
