/**
 * YY-88 sample-finish smoke（本機 serve@14 :8080）。
 * 無圖色號由 fixtures/no-photo-color.json 經 addInitScript 注入，不出現在一般瀏覽。
 */
import { chromium, devices } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.SAMPLE_FINISH_REPO || join(__dirname, "..");
const fixtureColors = JSON.parse(
  readFileSync(join(repoRoot, "modules/info/sample-finish/fixtures/no-photo-color.json"), "utf8")
);

const BASE = process.env.SAMPLE_FINISH_BASE || "http://127.0.0.1:8080/modules/info/sample-finish/";
const outDir = process.env.SAMPLE_FINISH_ARTIFACTS || "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const results = { base: BASE, scenarios: [] };

const browser = await chromium.launch();

async function newPageWithFixture(useFixture) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (useFixture) {
    await ctx.addInitScript((colors) => {
      window.__SAMPLE_FINISH_FIXTURE_COLORS__ = colors;
    }, fixtureColors);
  }
  return ctx.newPage();
}

try {
  const page = await newPageWithFixture(false);

  await page.goto(BASE, { waitUntil: "networkidle" });
  const swatchCount = await page.locator(".swatch").count();
  if (swatchCount !== 4) {
    throw new Error("Expected 4 swatches on production page, got " + swatchCount);
  }

  const fourColors = [];
  for (const id of ["W-01", "O-02", "G-03", "M-04"]) {
    await page.locator(`[data-id="${id}"]`).click();
    await page.waitForFunction(() => document.getElementById("photo").classList.contains("is-shown"), null, {
      timeout: 8000,
    });
    fourColors.push(
      await page.evaluate(() => ({
        id: document.querySelector(".swatch.is-active")?.dataset.id,
        src: document.getElementById("photo").getAttribute("src"),
        status: document.getElementById("status").textContent,
        caption: document.getElementById("caption").textContent,
      }))
    );
  }
  results.scenarios.push({ name: "four-colors-with-photos", pass: fourColors.every((r) => r.src?.includes("photos/")), fourColors });

  await page.close();

  const fixturePage = await newPageWithFixture(true);
  await fixturePage.goto(BASE, { waitUntil: "networkidle" });
  await fixturePage.locator('[data-id="T-00"]').click();
  await fixturePage.waitForTimeout(200);
  const noPhoto = await fixturePage.evaluate(() => ({
    active: document.querySelector(".swatch.is-active")?.dataset.id,
    src: document.getElementById("photo").getAttribute("src"),
    shown: document.getElementById("photo").classList.contains("is-shown"),
    status: document.getElementById("status").textContent,
    caption: document.getElementById("caption").textContent,
    title: document.getElementById("title").textContent,
    prevDisabled: document.getElementById("prev").disabled,
    nextDisabled: document.getElementById("next").disabled,
    swatchCount: document.querySelectorAll(".swatch").length,
  }));
  results.scenarios.push({
    name: "no-photo-color-fixture",
    pass:
      noPhoto.active === "T-00" &&
      noPhoto.swatchCount === 5 &&
      noPhoto.caption === "尚無公開完工照" &&
      !noPhoto.src &&
      !noPhoto.shown &&
      noPhoto.prevDisabled &&
      noPhoto.nextDisabled,
    noPhoto,
  });
  await fixturePage.screenshot({ path: `${outDir}/sample-finish-no-photo-fixture.png`, fullPage: true });

  await fixturePage.unroute("**/*");
  await fixturePage.route("**/warm-white-living-02.jpg", (route) => route.abort());
  await fixturePage.locator('[data-id="W-01"]').click();
  await fixturePage.locator("#next").click();
  await fixturePage.waitForTimeout(800);
  const broken = await fixturePage.evaluate(() => ({
    src: document.getElementById("photo").getAttribute("src"),
    shown: document.getElementById("photo").classList.contains("is-shown"),
    status: document.getElementById("status").textContent,
    caption: document.getElementById("caption").textContent,
    title: document.getElementById("title").textContent,
  }));
  results.scenarios.push({
    name: "broken-image-clears-viewer",
    pass: broken.caption === "此張完工照暫時無法顯示" && !broken.shown && broken.status.includes("無法顯示"),
    broken,
  });
  await fixturePage.screenshot({ path: `${outDir}/sample-finish-broken-then-clear.png`, fullPage: true });

  await fixturePage.unroute("**/warm-white-living-02.jpg");
  await fixturePage.locator('[data-id="G-03"]').click();
  await fixturePage.waitForFunction(() => document.getElementById("photo").classList.contains("is-shown"), null, {
    timeout: 8000,
  });
  const recovered = await fixturePage.evaluate(() => ({
    active: document.querySelector(".swatch.is-active")?.dataset.id,
    shown: document.getElementById("photo").classList.contains("is-shown"),
    status: document.getElementById("status").textContent,
    nw: document.getElementById("photo").naturalWidth,
  }));
  results.scenarios.push({
    name: "recover-after-broken",
    pass: recovered.active === "G-03" && recovered.shown && recovered.nw > 0,
    recovered,
  });

  await fixturePage.route("**/walnut-entry-01.jpg", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await fixturePage.locator('[data-id="M-04"]').click();
  await fixturePage.waitForTimeout(50);
  await fixturePage.locator('[data-id="W-01"]').click();
  await fixturePage.waitForTimeout(50);
  await fixturePage.locator('[data-id="O-02"]').click();
  await fixturePage.waitForFunction(() => document.getElementById("photo").classList.contains("is-shown"), null, {
    timeout: 8000,
  });
  const fast = await fixturePage.evaluate(() => ({
    active: document.querySelector(".swatch.is-active")?.dataset.id,
    src: document.getElementById("photo").getAttribute("src"),
    title: document.getElementById("title").textContent,
  }));
  results.scenarios.push({
    name: "fast-switch-no-stale-image",
    pass: fast.active === "O-02" && fast.src === "photos/smoke-grey-bedroom-01.jpg" && fast.title.includes("O-02"),
    fast,
  });

  await fixturePage.locator('[data-id="W-01"]').click();
  const o02Pager = await fixturePage.evaluate(() => {
    document.querySelector('[data-id="O-02"]').click();
    return {
      prev: document.getElementById("prev").disabled,
      next: document.getElementById("next").disabled,
    };
  });
  await fixturePage.waitForTimeout(500);
  await fixturePage.locator('[data-id="W-01"]').click();
  await fixturePage.waitForSelector("#photo.is-shown");
  await fixturePage.locator("#next").click();
  await fixturePage.waitForSelector("#photo.is-shown");
  const multi = await fixturePage.evaluate(() => ({
    caption: document.getElementById("caption").textContent,
    src: document.getElementById("photo").getAttribute("src"),
  }));
  results.scenarios.push({
    name: "single-vs-multi-pager",
    pass: o02Pager.prev && o02Pager.next && multi.caption.includes("2/2"),
    o02Pager,
    multi,
  });

  await fixturePage.close();

  const mobileCtx = await browser.newContext({ ...devices["iPhone 13"] });
  const mpage = await mobileCtx.newPage();
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  await mpage.waitForSelector("#photo.is-shown");
  const mobileLayout = await mpage.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    width: window.innerWidth,
    swatchCount: document.querySelectorAll(".swatch").length,
    status: document.getElementById("status").textContent,
  }));
  await mpage.screenshot({ path: `${outDir}/sample-finish-mobile-after-fix.png`, fullPage: true });
  results.scenarios.push({
    name: "mobile-layout",
    pass: !mobileLayout.overflowX && mobileLayout.swatchCount === 4,
    mobileLayout,
  });
  await mobileCtx.close();
} finally {
  await browser.close();
}

results.allPass = results.scenarios.every((s) => s.pass);
writeFileSync(`${outDir}/sample-finish-test-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
process.exit(results.allPass ? 0 : 1);
