/**
 * 一次性自測：日本跳轉 + 連續放大後地圖是否仍在視窗內
 * 執行：node _test_zoom.mjs
 */
import { chromium } from "playwright";

const URL = "http://127.0.0.1:5188/?t=autotest";

function inRange(v, lo, hi) {
  return v >= lo && v <= hi;
}

async function getMapState(page) {
  return page.evaluate(() => {
    const svg = document.getElementById("mapSvg");
    const frame = document.getElementById("mapFrame");
    if (!svg) return { ok: false, reason: "no svg" };
    const t = d3.zoomTransform(svg);
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    const gRoot = svg.querySelector("g");
    if (!gRoot) return { ok: false, reason: "no gRoot" };
    const paths = svg.querySelectorAll("path.land");
    if (!paths.length) return { ok: false, reason: "no land paths" };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach((p) => {
      const bb = p.getBBox();
      const x0 = t.k * bb.x + t.x;
      const y0 = t.k * bb.y + t.y;
      const x1 = t.k * (bb.x + bb.width) + t.x;
      const y1 = t.k * (bb.y + bb.height) + t.y;
      minX = Math.min(minX, x0, x1);
      maxX = Math.max(maxX, x0, x1);
      minY = Math.min(minY, y0, y1);
      maxY = Math.max(maxY, y0, y1);
    });
    const pad = 28;
    const visible =
      maxX > pad && minX < w - pad && maxY > pad && minY < h - pad;
    const markers = [...svg.querySelectorAll("g.marker")].map((g) => {
      const tr = g.getAttribute("transform") || "";
      const m = tr.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      if (!m) return null;
      const px = parseFloat(m[1]);
      const py = parseFloat(m[2]);
      return { sx: t.k * px + t.x, sy: t.k * py + t.y };
    }).filter(Boolean);
    const jpVisible = markers.some(function (m) {
      return m.sx >= pad && m.sx <= w - pad && m.sy >= pad && m.sy <= h - pad;
    });
    return {
      ok: true,
      k: t.k,
      x: t.x,
      y: t.y,
      w,
      h,
      bounds: { minX, maxX, minY, maxY },
      landVisible: visible,
      markerCount: markers.length,
      hasMarkerInView: jpVisible,
    };
  });
}

const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForFunction(() => {
    const s = document.getElementById("statusLine");
    return s && s.textContent.includes("521");
  }, { timeout: 20000 });

  const frame = page.locator("#mapFrame");
  const box = await frame.boundingBox();
  if (!box) throw new Error("map frame not found");

  await page.locator('li[data-country="JP"]').click();
  await page.waitForTimeout(1000);

  let state = await getMapState(page);
  console.log("After JP click:", JSON.stringify(state, null, 2));
  if (!state.landVisible || !state.hasMarkerInView) {
    throw new Error("After JP click: map or markers not in view");
  }

  const jp = await page.evaluate(() => {
    const svg = document.getElementById("mapSvg");
    const t = d3.zoomTransform(svg);
    const target = [...svg.querySelectorAll("g.marker")].map((g) => {
      const tr = g.getAttribute("transform") || "";
      const m = tr.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
      if (!m) return null;
      const px = parseFloat(m[1]);
      const py = parseFloat(m[2]);
      return { sx: t.k * px + t.x, sy: t.k * py + t.y, label: g.textContent || "" };
    }).filter(Boolean);
    const frame = document.getElementById("mapFrame").getBoundingClientRect();
    const east = target.filter((m) => m.sx > frame.width * 0.45);
    east.sort((a, b) => b.sx - a.sx);
    const pick = east[0] || target[0];
  return pick ? { cx: frame.x + pick.sx, cy: frame.y + pick.sy } : { cx: frame.x + frame.width / 2, cy: frame.y + frame.height / 2 };
  });

  const cx = jp.cx;
  const cy = jp.cy;
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);

  state = await getMapState(page);
  console.log("After 20x zoom:", JSON.stringify(state, null, 2));
  if (!state.landVisible) throw new Error("After zoom: land not visible in viewport");
  if (!state.hasMarkerInView) throw new Error("After zoom: no markers in viewport");

  await page.locator("#btnResetView").click();
  await page.waitForTimeout(1200);
  state = await getMapState(page);
  console.log("After reset:", { k: state.k, x: state.x, y: state.y });
  if (state.k > 1.15) throw new Error("Reset did not restore zoom (k=" + state.k + ")");

  await page.locator('[data-preset="satellite"]').click();
  await page.waitForTimeout(1200);
  const exportBtn = await page.locator("#btnExport").textContent();
  if (!exportBtn.includes("存圖")) throw new Error("Tile mode export label wrong: " + exportBtn);

  console.log("\n✅ ALL TESTS PASSED");
  process.exit(0);
} catch (err) {
  console.error("\n❌ TEST FAILED:", err.message);
  if (errors.length) console.error("Page errors:", errors);
  process.exit(1);
} finally {
  await browser.close();
}
