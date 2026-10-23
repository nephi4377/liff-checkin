const { test, expect } = require('@playwright/test');
const path = require('path');

const DEMO_PLAN = path.join(__dirname, 'fixtures', 'demo-floorplan-underlay.png');

test.describe('FLOORPLAN-UNDERLAY autosave', () => {
  test('IndexedDB 備份：底圖 flush 後 session 含 blobId', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(600);
    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.flushPersistToIndexedDB?.();
    });
    const blobId = await page.evaluate(async () => {
      const session = await window.__LP_TEST_HOOKS__?.loadLayoutSession?.();
      return session?.layout?.background?.blobId || null;
    });
    expect(blobId).toBeTruthy();
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
