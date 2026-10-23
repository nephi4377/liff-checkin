/** @param {import('@playwright/test').Page} page */
async function waitForLpBoot(page, timeoutMs = 30_000) {
  await page.waitForFunction(() => window.__lpBooted === true, null, { timeout: timeoutMs });
}

/** @param {import('@playwright/test').Page} page */
async function loadLayoutFixture(page, fixturePath) {
  await waitForLpBoot(page);
  await page.locator('#layout-upload').setInputFiles(fixturePath);
  await page.waitForFunction(
    () => document.querySelectorAll('.placed-cabinet').length > 0,
    null,
    { timeout: 15_000 },
  );
}

module.exports = { waitForLpBoot, loadLayoutFixture };
