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

  test('legacy localStorage 搬移（保留舊 key）', async ({ page }) => {
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
    const payload = JSON.stringify(legacy);

    await page.addInitScript((p) => {
      localStorage.setItem('layoutPlanner_autosave_v1', p);
    }, payload);

    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const migrated = await page.evaluate(() => ({
      idx: window.__LP_TEST_HOOKS__?.readStorageIndex?.(),
      legacyKey: window.__LP_TEST_HOOKS__?.readLegacyAutosaveRaw?.(),
    }));
    expect(migrated.idx?.migratedFromLegacy).toBe(true);
    expect(migrated.legacyKey).toBe(payload);
  });

  test('專案檔匯出匯入 roundtrip', async ({ page }) => {
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
      return JSON.stringify(window.__LP_TEST_HOOKS__?.buildProjectFileExport?.(layout));
    });
    fs.writeFileSync(projectPath, projectJson);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#project-upload').setInputFiles(projectPath);
    await page.waitForTimeout(600);
    await expect.poll(async () =>
      page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image')),
    ).toBe(true);
  });

  test('舊版 2.0 layout JSON 仍可匯入', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    const legacyPath = path.join(__dirname, '..', 'test-results', 'lp-layout-v2.json');
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({
        version: '2.0',
        placedCabinets: [],
        drawnAreas: [],
        workspaceSize: 2000,
        background: { src: '', scale: 1, position: { x: 0, y: 0 } },
      }),
    );
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(legacyPath);
    await page.waitForTimeout(400);
    await expect(page.locator('#design-canvas')).toBeVisible();
  });

  test('配額滿時 flush 顯示警告', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      window.__LP_TEST_HOOKS__?.forceNextStorageError?.('QUOTA_EXCEEDED');
    });
    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.flushPersistToIndexedDB?.();
    });
    const toast = await page.locator('#global-notification-container').textContent();
    expect(toast).toMatch(/空間不足|專案檔/);
    const idx = await page.evaluate(() => window.__LP_TEST_HOOKS__?.readStorageIndex?.());
    expect(idx?.lastError).toBeTruthy();
  });
});

test.describe('LP-STORAGE-1 mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('手機 viewport：匯入底圖後可 flush 並讀回 session', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
    await page.goto('/LP_LayoutPlanner.html?lpMobile=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      await window.__LP_TEST_HOOKS__?.flushPersistToIndexedDB?.();
    });
    const hasBlob = await page.evaluate(async () => {
      const s = await window.__LP_TEST_HOOKS__?.loadLayoutSession?.();
      return !!(s?.layout?.background?.blobId);
    });
    expect(hasBlob).toBe(true);
  });
});
