/**
 * FLOORPLAN-QUOTE-3：raw.githack.com 預覽實際渲染與 lpPreview 同步閘
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function passGithackInterstitialIfPresent(page) {
    const btn = page.getByRole('button', { name: /Open the page/i });
    try {
        if (await btn.isVisible({ timeout: 4000 })) {
            await btn.click();
            await page.waitForLoadState('domcontentloaded');
        }
    } catch {
        /* 已直達內容頁 */
    }
}

function readPinnedSha() {
    if (process.env.LP_GITHACK_SHA) return process.env.LP_GITHACK_SHA.trim();
    const src = fs.readFileSync(path.join(__dirname, '..', 'LP_preview_hosts.js'), 'utf8');
    const m = src.match(/PINNED_GITHACK_COMMIT = '([a-f0-9]{40})'/);
    if (!m) throw new Error('PINNED_GITHACK_COMMIT not found');
    return m[1];
}

test.describe('Githack render gate (QUOTE-3)', () => {
    test.setTimeout(180_000);

    test('LayoutPlanner：畫布實際渲染', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'githack 僅 chromium');
        const sha = readPinnedSha();
        const url =
            `https://raw.githack.com/nephi4377/liff-checkin/${sha}/modules/InteriorDesigned/LP_LayoutPlanner.html`
            + '?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json';

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await passGithackInterstitialIfPresent(page);
        await expect(page.locator('#design-canvas')).toBeVisible({ timeout: 60_000 });
        const box = await page.locator('#design-canvas').boundingBox();
        expect(box).toBeTruthy();
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
    });

    test('BudgetWeb lpPreview=1：同步按鈕 disabled', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'githack 僅 chromium');
        const sha = readPinnedSha();
        const url =
            `https://raw.githack.com/nephi4377/liff-checkin/${sha}/tools/BudgetWeb_Standalone.html?lpPreview=1`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await passGithackInterstitialIfPresent(page);
        await expect(page.locator('h1')).toContainText(/報價單預處理器|報價/, { timeout: 30_000 });
        await expect(page.locator('#floatSyncBtn')).toBeDisabled();
        await expect(page.locator('#syncCloudBtn')).toBeDisabled();
    });
});
