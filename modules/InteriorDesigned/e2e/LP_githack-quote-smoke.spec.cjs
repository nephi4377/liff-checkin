/**
 * FLOORPLAN-QUOTE-2：對 raw.githack.com 真實 URL 煙霧測（匯出 JSON → BudgetWeb 合併）
 * 使用 LP_preview_hosts.js 內 PINNED_GITHACK_COMMIT（或環境變數 LP_GITHACK_SHA）
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACTS = process.env.LP_GITHACK_ARTIFACTS || '/opt/cursor/artifacts';

function readPinnedSha() {
    if (process.env.LP_GITHACK_SHA) return process.env.LP_GITHACK_SHA.trim();
    const src = fs.readFileSync(path.join(__dirname, '..', 'LP_preview_hosts.js'), 'utf8');
    const m = src.match(/PINNED_GITHACK_COMMIT = '([a-f0-9]{40})'/);
    if (!m) throw new Error('PINNED_GITHACK_COMMIT not found');
    return m[1];
}

test.describe('Githack quote smoke', () => {
    test.setTimeout(180_000);

    test('LayoutPlanner 匯出 → BudgetWeb 合併（raw.githack.com）', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'githack smoke 僅跑 chromium');

        const sha = readPinnedSha();
        const lpUrl =
            `https://raw.githack.com/nephi4377/liff-checkin/${sha}/modules/InteriorDesigned/LP_LayoutPlanner.html`
            + '?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json';
        const bwUrl =
            `https://raw.githack.com/nephi4377/liff-checkin/${sha}/tools/BudgetWeb_Standalone.html?lpPreview=1`;

        page.on('dialog', (d) => d.accept());

        await page.goto(lpUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await expect(page.locator('#design-canvas')).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(2500);

        fs.mkdirSync(ARTIFACTS, { recursive: true });
        await page.screenshot({
            path: path.join(ARTIFACTS, 'githack-lp-2d-plan-export.webp'),
            fullPage: false,
        });

        await page.locator('#toggle-info-btn').click();
        await page.locator('#show-budget-modal-btn').click();
        await expect(page.locator('#budget-modal')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('#export-quote-draft-btn')).toBeVisible();
        await page.locator('#export-quote-draft-btn').click();
        await expect(page.locator('#quote-export-draft-modal')).toBeVisible();
        await expect(page.locator('#quote-export-draft-tbody tr').first()).toBeVisible();

        const downloadPromise = page.waitForEvent('download');
        await page.locator('#quote-export-draft-json-btn').click();
        const download = await downloadPromise;
        const jsonPath = path.join(os.tmpdir(), `lp-quote-draft-${Date.now()}.json`);
        await download.saveAs(jsonPath);
        const draft = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        expect(draft.schema).toBe('layout-planner-quote-draft-v1');
        expect((draft.items || []).length).toBeGreaterThan(0);

        const bwLink = await page.locator('#quote-export-budgetweb-link').getAttribute('href');
        expect(bwLink).toContain('BudgetWeb_Standalone.html');
        expect(bwLink).toContain('lpPreview=1');

        await page.goto(bwUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await expect(page.locator('#lpImportBox')).toBeVisible({ timeout: 30_000 });

        await page.locator('#lpDraftFileInput').setInputFiles(jsonPath);
        await expect(page.locator('#lpImportMergeBtn')).toBeEnabled({ timeout: 15_000 });
        await page.locator('#lpImportMergeBtn').click();

        await expect(page.locator('#previewArea')).toBeVisible({ timeout: 20_000 });
        const previewText = await page.locator('#previewBody').innerText();
        expect(previewText).toMatch(/鞋櫃|櫃|LayoutPlanner/);

        await page.screenshot({
            path: path.join(ARTIFACTS, 'githack-budgetweb-imported-lines.webp'),
            fullPage: true,
        });
    });
});
