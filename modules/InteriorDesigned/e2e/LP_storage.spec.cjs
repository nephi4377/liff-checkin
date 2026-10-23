const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEMO_PLAN = path.join(__dirname, 'fixtures', 'demo-floorplan-underlay.png');

test.describe('LP-STORAGE-1', () => {
  test('IndexedDB 自動備份：底圖 flush 後重載仍保留', async ({ page }) => {
    let restoreOnNextDialog = false;
    page.on('dialog', (d) => {
      if (restoreOnNextDialog) d.accept();
      else d.dismiss();
    });

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);

    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.flushPersistToIndexedDB?.();
    });

    const blobId = await page.evaluate(async () => {
      const session = await window.__LP_TEST_HOOKS__?.loadLayoutSession?.();
      return session?.layout?.background?.blobId || null;
    });
    expect(blobId).toBeTruthy();

    restoreOnNextDialog = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);
  });

  test('legacy localStorage 搬移', async ({ page }) => {
    const legacy = {
      version: '2.0',
      timestamp: Date.now(),
      prettyTime: 'test',
      placedCabinets: [],
      drawnAreas: [],
      placedAnnotations: [],
      workspaceSize: 2000,
      background: {
        src:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        scale: 1,
        position: { x: 0, y: 0 },
      },
      constructionArea: '',
    };

    await page.addInitScript((payload) => {
      localStorage.setItem('layoutPlanner_autosave_v1', payload);
    }, JSON.stringify(legacy));

    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const migrated = await page.evaluate(() => {
      const idx = window.__LP_TEST_HOOKS__?.readStorageIndex?.();
      const legacyKey = localStorage.getItem('layoutPlanner_autosave_v1');
      return { idx, legacyKey };
    });
    expect(migrated.idx?.migratedFromLegacy).toBe(true);
    expect(migrated.legacyKey).toBeNull();
  });

  test('專案檔匯出匯入', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(400);

    const projectPath = path.join(__dirname, '..', 'test-results', 'lp-project-roundtrip.json');
    fs.mkdirSync(path.dirname(projectPath), { recursive: true });

    const projectJson = await page.evaluate(() => {
      const layout = {
        version: '3.0',
        placedCabinets: [],
        drawnAreas: [],
        placedAnnotations: [],
        workspaceSize: 2000,
        background: window.__LP_TEST_HOOKS__?.getSerializedBackground?.() || {},
        constructionArea: '',
      };
      return JSON.stringify(
        window.__LP_TEST_HOOKS__?.buildProjectFileExport?.(layout),
      );
    });
    fs.writeFileSync(projectPath, projectJson);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#project-upload').setInputFiles(projectPath);
    await page.waitForTimeout(600);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);
  });
});
