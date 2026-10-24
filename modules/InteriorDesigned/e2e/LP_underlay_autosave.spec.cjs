const { test, expect } = require('@playwright/test');
const path = require('path');

const DEMO_PLAN = path.join(__dirname, 'fixtures', 'demo-floorplan-underlay.png');

test.describe('FLOORPLAN-UNDERLAY autosave', () => {
  test('IndexedDB 備份：底圖 flush 後 session 含 blobId', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForFunction(() => document.getElementById('bg-img')?.src?.startsWith('data:image'));
    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.flushPersistToIndexedDB?.();
    });
    const blobId = await page.evaluate(async () => {
      const session = await window.__LP_TEST_HOOKS__?.loadLayoutSession?.();
      return session?.layout?.background?.blobId || null;
    });
    expect(blobId).toBeTruthy();
  });

  test('還原 srcOmitted 備份時提示重新匯入底圖', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.__LP_TEST_HOOKS__.loadLayoutFromData({
        version: '2.0',
        timestamp: Date.now(),
        placedCabinets: [],
        drawnAreas: [],
        placedAnnotations: [],
        background: {
          src: '',
          srcOmitted: true,
          position: { x: 0, y: 0 },
          scale: 1,
          rotationDeg: 0,
          opacity: 0.75,
          locked: false,
          hidden: false,
        },
      }, { successMessage: false });
    });
    const toast = await page.locator('#global-notification-container').textContent().catch(() => '');
    expect(toast).toMatch(/底圖未備份|重新匯入/);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(false);
  });

  test('底圖透明度 undo 後仍保留底圖', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForFunction(() => document.getElementById('bg-img')?.src?.startsWith('data:image'));
    const beforeOpacity = await page.inputValue('#bg-opacity-num');
    await page.locator('#bg-opacity').fill('0.35');
    await page.locator('#bg-opacity').dispatchEvent('input');
    await expect.poll(async () => page.inputValue('#bg-opacity-num')).not.toBe(beforeOpacity);
    await page.locator('#undo-btn').click();
    await expect(page.locator('#bg-opacity-num')).toHaveValue(beforeOpacity);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);
  });
});
