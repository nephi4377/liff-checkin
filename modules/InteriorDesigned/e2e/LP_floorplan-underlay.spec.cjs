const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DEMO_PLAN = path.join(__dirname, 'fixtures', 'demo-floorplan-underlay.png');

test.describe('FLOORPLAN-UNDERLAY-1', () => {
  test('匯入示範底圖、儲存 JSON 再載入仍保留', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html?lpPreview=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await expect.poll(async () => page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image'))).toBe(true);

    const exported = await page.evaluate(() => {
      const bg = document.getElementById('bg-img')?.src || '';
      return { hasBg: bg.startsWith('data:image'), len: bg.length };
    });
    expect(exported.hasBg).toBe(true);
    expect(exported.len).toBeGreaterThan(100);

    const jsonPath = path.join(__dirname, '..', 'test-results', 'underlay-roundtrip.json');
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

    const layoutJson = await page.evaluate(() => {
      const constructionAreaEl = document.getElementById('construction-area');
      return JSON.stringify({
        version: '2.0',
        placedCabinets: [],
        drawnAreas: [],
        placedAnnotations: [],
        workspaceSize: 2000,
        background: window.__LP_TEST_HOOKS__?.getSerializedBackground?.() || {},
        constructionArea: constructionAreaEl ? constructionAreaEl.value : '',
      });
    });

    fs.writeFileSync(jsonPath, layoutJson);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(jsonPath);
    await page.waitForTimeout(500);
    await expect.poll(async () => page.evaluate(() => document.getElementById('bg-img')?.src?.startsWith('data:image'))).toBe(true);

    expect(errors, errors.join('; ')).toHaveLength(0);
  });

  test('描牆段長輸入：固定 200cm', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#draw-wall-btn').click();
    await page.locator('#wall-segment-length-input').fill('200');
    await page.locator('#wall-segment-length-input').dispatchEvent('change');
    const canvas = page.locator('#design-canvas');
    await canvas.click({ position: { x: 300, y: 300 } });
    await canvas.click({ position: { x: 500, y: 380 } });
    const pts = await page.evaluate(() => window.__LP_TEST_HOOKS__?.getDrawingPoints?.() || []);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const dx = Math.abs(pts[1].x - pts[0].x);
    const dy = Math.abs(pts[1].y - pts[0].y);
    const len = Math.hypot(dx, dy);
    expect(len).toBeGreaterThan(195);
    expect(len).toBeLessThan(205);
  });

  test('匯出截圖時隱藏底圖層', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(400);
    const hiddenDuringExport = await page.evaluate(() => {
      document.body.classList.add('lp-export-no-underlay');
      const layer = document.getElementById('bg-layer');
      const style = window.getComputedStyle(layer);
      const vis = style.visibility;
      document.body.classList.remove('lp-export-no-underlay');
      return vis;
    });
    expect(hiddenDuringExport).toBe('hidden');
  });

  test('手機視窗：底圖控制仍可操作', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#bg-upload').setInputFiles(DEMO_PLAN);
    await page.waitForTimeout(500);
    await page.locator('#bg-opacity').fill('0.5');
    await page.locator('#bg-opacity').dispatchEvent('input');
    const opacity = await page.evaluate(() => parseFloat(document.getElementById('bg-img')?.style.opacity || '0'));
    expect(opacity).toBeCloseTo(0.5, 1);
  });
});
