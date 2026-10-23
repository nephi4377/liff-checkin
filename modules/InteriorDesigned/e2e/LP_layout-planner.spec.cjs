const { test, expect } = require('@playwright/test');
const fs = require('fs');
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

  test('拖曳櫃體後單次 Ctrl+Z 回到拖曳前位置', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(fixture);
    await page.waitForTimeout(800);

    const cab = page.locator('#keyguard-cab-1');
    await expect(cab).toBeVisible();
    const box = await cab.boundingBox();
    expect(box).toBeTruthy();

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60);
    await page.mouse.up();

    await page.waitForTimeout(150);
    const afterDrag = await page.evaluate(() => ({
      x: document.getElementById('keyguard-cab-1')?.style.left,
      y: document.getElementById('keyguard-cab-1')?.style.top,
    }));
    expect(afterDrag.x).not.toBe('800px');
    expect(afterDrag.y).not.toBe('800px');

    await page.keyboard.press('Control+z');
    await expect.poll(async () => page.evaluate(() => document.getElementById('keyguard-cab-1')?.style.left)).toBe('800px');
    await expect.poll(async () => page.evaluate(() => document.getElementById('keyguard-cab-1')?.style.top)).toBe('800px');
  });

  test('視窗外放開滑鼠仍結束拖曳手勢，單次復原有效', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(fixture);
    await page.waitForTimeout(800);

    const cab = page.locator('#keyguard-cab-1');
    const box = await cab.boundingBox();
    expect(box).toBeTruthy();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 70, startY + 50);
    const vp = page.viewportSize();
    await page.mouse.move(-20, vp.height / 2);
    await page.mouse.up();

    await page.waitForTimeout(150);
    const afterDrag = await page.evaluate(() => ({
      x: document.getElementById('keyguard-cab-1')?.style.left,
      y: document.getElementById('keyguard-cab-1')?.style.top,
    }));
    expect(afterDrag.x).not.toBe('800px');

    await page.keyboard.press('Control+z');
    await expect.poll(async () => page.evaluate(() => document.getElementById('keyguard-cab-1')?.style.left)).toBe('800px');
    await expect.poll(async () => page.evaluate(() => document.getElementById('keyguard-cab-1')?.style.top)).toBe('800px');
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

  test('3D 模組載入失敗時 2D 仍可用並顯示錯誤通知', async ({ page }) => {
    await page.route(/LP_3DViewer\.js/, (route) => route.abort('failed'));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#toolbox-window')).toBeVisible();

    await page.locator('#toggle-3d-view-btn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#global-notification-container')).toContainText('3D 模組載入失敗');

    const notifZ = await page.evaluate(() => {
      const n = document.getElementById('global-notification-container');
      const o = document.getElementById('lp-3d-overlay');
      if (!n) return null;
      const nz = parseInt(window.getComputedStyle(n).zIndex, 10) || 0;
      const oz = o ? parseInt(window.getComputedStyle(o).zIndex, 10) || 0 : 0;
      return { notifZ: nz, overlayZ: oz };
    });
    expect(notifZ?.notifZ).toBeGreaterThan(notifZ?.overlayZ || 0);

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

  test('3D 示範佈局：牆體／門窗開口／櫃體標籤（FLOORPLAN-3D-5）', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-3d-spec-demo.json');
    expect(fs.existsSync(fixture)).toBe(true);

    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-before-demo-layout.png'), fullPage: false });

    await page.locator('#lp-3d-btn-exit-2d').click();
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);
    await page.locator('#layout-upload').setInputFiles(fixture);
    await page.waitForTimeout(800);

    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.waitForTimeout(3000);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-after-demo-layout.png'), fullPage: false });
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

  test('3D 室內漫遊撞牆不穿透（FLOORPLAN-3D-WALK-2）', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=walk',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 15000 });
    await page.waitForTimeout(2000);

    const before = await page.evaluate(() => {
      const h = window.__LP3D_TEST_HOOKS__;
      h?.setWalkPosition(-250, -650);
      h?.lookWalkAt(-250, -720);
      return h?.getCameraXZ();
    });
    expect(before).toBeTruthy();

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('w');
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(400);

    const after = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getCameraXZ());
    expect(after.z).toBeLessThan(before.z);
    expect(after.z).toBeGreaterThan(-700 + 18);

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-walk-wall-bump.png'), fullPage: false });
  });

  test('3D 測試預覽連結：自動載入示範並進入室內漫遊（FLOORPLAN-3D-WALK-1）', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-3d-spec-demo.json');
    expect(fs.existsSync(fixture)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=walk',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 15000 });
    await expect(page.locator('#lp-3d-btn-walk')).toHaveClass(/lp-3d-active/);
    await page.waitForTimeout(2500);

    const cam = await page.evaluate(() => {
      const h = window.__LP3D_TEST_HOOKS__;
      if (!h) return null;
      return {
        viewMode: h.getViewMode(),
        eyeHeightCm: h.getEyeHeightCm(),
        cameraY: h.getCameraY(),
      };
    });
    expect(cam?.viewMode).toBe('walk');
    expect(cam?.eyeHeightCm).toBe(160);
    expect(cam?.cameraY).toBe(160);

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-walk-preview-auto.png'), fullPage: false });
    await page.locator('#lp-3d-btn-orbit').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-orbit-after-walk-toggle.png'), fullPage: false });
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

  test('3D 室內行走時 D 與方向鍵不影響 2D 櫃體', async ({ page }) => {
    const fixture = path.join(__dirname, 'fixtures', 'lp-walk-keyguard.json');
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#layout-upload').setInputFiles(fixture);
    await page.waitForTimeout(800);

    await page.locator('#keyguard-cab-1').click();
    const before = await page.evaluate(() => {
      const el = document.getElementById('keyguard-cab-1');
      const count = document.querySelectorAll('.placed-cabinet').length;
      return {
        count,
        left: el?.style.left,
        top: el?.style.top,
        undoDisabled: document.getElementById('undo-btn')?.disabled,
      };
    });
    expect(before.count).toBe(1);

    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await page.locator('#lp-3d-btn-walk').click();
    await page.waitForTimeout(500);
    await page.keyboard.press('d');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);

    await page.locator('#lp-3d-btn-exit-2d').click();
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);

    const after = await page.evaluate(() => {
      const el = document.getElementById('keyguard-cab-1');
      const count = document.querySelectorAll('.placed-cabinet').length;
      return {
        count,
        left: el?.style.left,
        top: el?.style.top,
        undoDisabled: document.getElementById('undo-btn')?.disabled,
      };
    });
    expect(after.count).toBe(1);
    expect(after.left).toBe(before.left);
    expect(after.top).toBe(before.top);
    expect(after.undoDisabled).toBe(before.undoDisabled);
  });

  test('3D 儲存圖片與預設角度按鈕可操作', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await expect(page.locator('#lp-3d-btn-save-png')).toBeVisible();
    await page.locator('#lp-3d-btn-preset-top').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-snap-before-top.png'), fullPage: false });
    await page.locator('#lp-3d-btn-preset-corner').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-snap-after-corner.png'), fullPage: false });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#lp-3d-btn-save-png').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^layout-3d-\d{8}-\d{4}\.png$/);
  });

  test('3D 工具列窄螢幕：預設視角收合為下拉（375px）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(
      '/LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit',
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 20000 });
    await expect(page.locator('#lp-3d-preset-select')).toBeVisible();
    await expect(page.locator('#lp-3d-btn-preset-top')).toBeHidden();
    await page.selectOption('#lp-3d-preset-select', 'top');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-toolbar-mobile-375.png'), fullPage: false });
  });

  test('3D 檢視切換不造成頁面錯誤', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#toggle-3d-view-btn').click();
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/);
    await expect(page.locator('#lp-3d-overlay')).toBeVisible();
    await expect(page.locator('#lp-3d-btn-save-png')).toBeHidden();
    await expect(page.locator('#lp-3d-btn-preset-top')).toBeHidden();
    await expect(page.locator('#lp-3d-preset-select')).toBeHidden();
    await page.waitForTimeout(3000);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);

    await page.locator('#lp-3d-btn-exit-2d').click();
    await expect(page.locator('body')).not.toHaveClass(/lp-3d-mode/);
  });

  test('繪製地板：移動游標顯示即時段長 (FLOORPLAN-2D-3)', async ({ page }) => {
    const shotDir = path.join(__dirname, '..', 'test-results', 'floorplan-2d-3-segment');
    fs.mkdirSync(shotDir, { recursive: true });
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#zoom-reset-btn').click();
    await expect(page.locator('#zoom-level-display')).toHaveText('100%');
    await page.locator('#draw-floor-btn').click();
    const canvas = page.locator('#design-canvas');
    await canvas.click({ position: { x: 200, y: 200 } });
    await page.screenshot({ path: path.join(shotDir, 'lp-draw-segment-before-move.png') });
    await canvas.hover({ position: { x: 350, y: 200 } });
    await expect(page.locator('#drawing-preview-segment-label')).toHaveText('150 cm', { timeout: 5000 });
    await page.screenshot({ path: path.join(shotDir, 'lp-draw-segment-after-label.png') });
  });

  test('3D 房間預覽連結：自動載入示範並鳥瞰（FLOORPLAN-3D-ROOM-1）', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/LP_LayoutPlanner_3d_room_preview.html', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/lp3d=orbit/, { timeout: 15000 });
    await expect(page.locator('body')).toHaveClass(/lp-3d-mode/, { timeout: 15000 });
    await expect(page.locator('#lp-3d-btn-orbit')).toHaveClass(/lp-3d-active/);
    await expect(page.locator('#lp-3d-ceiling-toggle')).not.toBeChecked();
    await page.waitForTimeout(2500);
    expect(errors, `頁面錯誤: ${errors.join('; ')}`).toHaveLength(0);

    const snapshot = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getRoomAcceptanceSnapshot());
    expect(snapshot?.ceilingVisible).toBe(false);
    expect(snapshot?.wallsHiddenTopDown, '俯視應隱藏牆體立面').toBe(true);
    expect(snapshot?.wallCapsVisibleTopDown, '俯視應顯示牆頂描邊').toBe(true);
    expect(snapshot?.floorBoundsMatchInner, '地板外框應貼齊牆內圈（≤2cm）').toBe(true);
    expect(snapshot?.doorLeafMeshCount, '每扇門僅一塊門片 mesh').toBe(1);
    const cabPixel = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.sampleCabinetTopDownPixel?.());
    expect(cabPixel?.differsFromFloor, '俯視櫃體中心像素應與地板色不同').toBe(true);
    expect(snapshot?.cabinetMeshVisible, '鳥瞰應看見櫃體 mesh（非僅標籤）').toBe(true);
    expect(snapshot?.cabinetMeshScreen?.pixelArea ?? 0, '櫃體螢幕投影面積應足夠').toBeGreaterThan(100);
    expect(snapshot?.labelCount).toBeGreaterThanOrEqual(1);
    expect(snapshot?.labelScreen?.textReadable, '櫃體標籤應達可讀像素尺寸').toBe(true);
    for (const hit of snapshot?.openingWallHits ?? []) {
      expect(hit.intersectsWall, `${hit.kind} ${hit.id} 應貼齊牆體`).toBe(true);
      expect(hit.csgCut, `${hit.kind} ${hit.id} 應在牆帶內開洞`).toBe(true);
      expect(hit.subMeshesInWall, `${hit.kind} ${hit.id} 子 mesh 應在牆帶內`).toBe(true);
    }
    for (const cab of snapshot?.cabinetsInsideFloor ?? []) {
      expect(cab.inside, `櫃體 ${cab.id} 應在地板內`).toBe(true);
    }

    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-room-preview-orbit.png'), fullPage: false });
    await page.locator('#lp-3d-btn-preset-top').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-room-preview-topdown.png'), fullPage: false });

    await page.locator('#lp-3d-btn-preset-corner').click();
    await page.waitForTimeout(800);
    const obliqueSnap = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getRoomAcceptanceSnapshot());
    for (const op of obliqueSnap?.obliqueOpeningTops ?? []) {
      expect(op.withinWallTop, `${op.kind} ${op.id} 頂部應不高出牆頂`).toBe(true);
    }
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-room-preview-oblique.png'), fullPage: false });

    await page.locator('#lp-3d-btn-walk').click();
    await expect(page.locator('#lp-3d-btn-walk')).toHaveClass(/lp-3d-active/);
    await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.resetWalkRoomPreview?.());
    await page.waitForTimeout(900);
    const walkSnap = await page.evaluate(() => window.__LP3D_TEST_HOOKS__?.getRoomAcceptanceSnapshot());
    expect(walkSnap?.labelScreen?.textReadable).toBe(true);
    expect(walkSnap?.walkCamera?.y, '室內視角眼高').toBeGreaterThan(155);
    expect(walkSnap?.walkCamera?.y).toBeLessThan(165);
    expect(
        Math.abs((walkSnap?.walkCamera?.standoffSouthCm ?? 0) - 150),
        '應距南牆約 150cm',
    ).toBeLessThanOrEqual(25);
    expect(walkSnap?.floorMeshScreen?.inFrustum, '室內應看見地板').toBe(true);
    expect(walkSnap?.cabinetMeshVisible, '室內應看見櫃體').toBe(true);
    expect(walkSnap?.cabinetMeshScreen?.inFrustum, '櫃體應在視野內').toBe(true);
    expect(Math.abs(walkSnap?.walkCameraRollRad ?? 1), '室內 horizon roll 應≈0').toBeLessThan(0.02);
    expect(walkSnap?.walkCameraUp?.y ?? 0, 'camera.up 應為世界 Y').toBeGreaterThan(0.99);
    expect(walkSnap?.doorLeafMeshCount).toBe(1);
    await page.screenshot({ path: path.join(ARTIFACTS, 'lp-3d-room-preview-walk.png'), fullPage: false });
  });

  test('可開啟預算明細 Modal 並關閉', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#show-budget-modal-btn').click();
    await expect(page.locator('#budget-modal')).toBeVisible();
    await page.locator('#budget-modal-close-btn').click();
    await expect(page.locator('#budget-modal')).toBeHidden();
  });

  test('匯出報價明細僅 lpPreview 顯示且一般模式無法觸發', async ({ page }) => {
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#show-budget-modal-btn').click();
    await expect(page.locator('#budget-modal')).toBeVisible();
    await expect(page.locator('#export-quote-draft-btn')).toBeHidden();
    const draftOpenedInNormal = await page.evaluate(() => {
      const btn = document.getElementById('export-quote-draft-btn');
      btn?.click();
      const modal = document.getElementById('quote-export-draft-modal');
      return modal && modal.style.display !== 'none';
    });
    expect(draftOpenedInNormal).toBe(false);

    await page.goto('/LP_LayoutPlanner?lpPreview=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#show-budget-modal-btn').click();
    await expect(page.locator('#export-quote-draft-btn')).toBeVisible();
  });

  test('元件表讀失敗時分類區顯示再試，不可裝成還沒載入', async ({ page }) => {
    await page.route('**/spreadsheets/**', (route) => route.abort());
    await page.goto('/LP_LayoutPlanner.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#btnRetrySheetLoadLayer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#layer-visibility-list')).toContainText('元件表讀不到');
    await expect(page.locator('#layer-visibility-list')).not.toContainText('載入元件後顯示分類');
  });
});
