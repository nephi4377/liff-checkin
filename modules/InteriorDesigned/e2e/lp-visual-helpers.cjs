/**
 * LayoutPlanner 視覺回歸共用：CDN 攔截、字型、遮罩、console 過濾、3D 等待。
 * 僅供 e2e 使用，不修改產品程式。
 */
const path = require('path');
const { expect } = require('@playwright/test');

const TAILWIND_PINNED = path.join(__dirname, 'fixtures', 'tailwindcss.cdn.pinned.js');

const CDN_HOST_RE =
  /(?:cdn\.tailwindcss\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/i;

/**
 * @param {string} text
 */
function isIgnorableConsoleError(text) {
  if (!text || typeof text !== 'string') return false;
  if (CDN_HOST_RE.test(text)) return true;
  if (/Failed to load resource/i.test(text) && CDN_HOST_RE.test(text)) return true;
  if (/tailwindcss\.com/i.test(text)) return true;
  return false;
}

/**
 * @param {import('@playwright/test').Page} page
 */
function attachStrictConsoleGuard(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isIgnorableConsoleError(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function installLayoutPlannerVisualRoutes(page) {
  await page.route(/https:\/\/cdn\.tailwindcss\.com\/?/, (route) =>
    route.fulfill({
      path: TAILWIND_PINNED,
      contentType: 'application/javascript; charset=utf-8',
    }),
  );
}

/**
 * 與 GitHub Actions ubuntu-latest + fonts-noto-cjk 對齊的字型堆疊。
 * @param {import('@playwright/test').Page} page
 */
async function installDeterministicFonts(page) {
  await page.addStyleTag({
    content: `
      html, body, #app-shell, #app-shell * {
        font-family: "Noto Sans CJK TC", "Noto Sans CJK SC", "Noto Sans CJK JP",
          "Noto Sans Mono CJK TC", sans-serif !important;
      }
      #global-notification-container { visibility: hidden !important; pointer-events: none !important; }
    `,
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {import('@playwright/test').Locator[]}
 */
function visualRegressionMasks(page) {
  return [
    page.locator('#toolbox-window'),
    page.locator('#info-window'),
    page.locator('#minimized-bar'),
    page.locator('#global-notification-container'),
    page.locator('#canvas-header'),
    page.locator('#design-canvas .size-label'),
  ];
}

/**
 * 示範配置幾何範圍（地板多邊形 + 櫃體），縮小 2D 比對面積、避開大面積空白與邊欄字體。
 * @param {import('@playwright/test').Page} page
 */
async function getDemoGeometryClip(page) {
  const clip = await page.evaluate(() => {
    const canvas = document.getElementById('design-canvas');
    const poly = document.querySelector('#drawn-areas-layer polygon');
    const cab = document.querySelector('.placed-cabinet');
    if (!canvas || !poly || !cab) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const pad = 12;
    const rects = [poly.getBoundingClientRect(), cab.getBoundingClientRect()];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of rects) {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }

    const x = Math.max(0, left - canvasRect.left - pad);
    const y = Math.max(0, top - canvasRect.top - pad);
    const width = Math.min(canvasRect.width - x, right - left + pad * 2);
    const height = Math.min(canvasRect.height - y, bottom - top + pad * 2);
    if (width < 8 || height < 8) return null;
    return { x, y, width, height };
  });
  return clip;
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function waitFor3dRenderSettle(page) {
  await expect(page.locator('#lp-3d-viewport canvas')).toHaveCount(1);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

module.exports = {
  attachStrictConsoleGuard,
  installLayoutPlannerVisualRoutes,
  installDeterministicFonts,
  visualRegressionMasks,
  getDemoGeometryClip,
  waitFor3dRenderSettle,
  isIgnorableConsoleError,
};
