/**
 * FLOORPLAN-QUOTE-2：對 raw.githack.com 真實 URL 煙霧測（匯出 JSON → BudgetWeb 合併）
 * 使用 LP_preview_hosts.js 內 PINNED_GITHACK_COMMIT（或環境變數 LP_GITHACK_SHA）
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARTIFACTS = process.env.LP_GITHACK_ARTIFACTS || '/opt/cursor/artifacts';

/** githack 對自動化／首次造訪會顯示「Open the page」閘門 */
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
        await passGithackInterstitialIfPresent(page);
        expect(page.url()).toContain('lpPreview=1');
        await expect(page.locator('#design-canvas')).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(2500);

        fs.mkdirSync(ARTIFACTS, { recursive: true });
        await page.screenshot({
            path: path.join(ARTIFACTS, 'githack-lp-2d-plan-export.png'),
            fullPage: false,
        });

        await page.waitForFunction(() => window.__lpQuotePreview?.showBudgetModal, null, {
            timeout: 60_000,
        });
        await page.evaluate(() => window.__lpQuotePreview.showBudgetModal());
        await expect(page.locator('#budget-modal')).toHaveCSS('display', 'flex', { timeout: 15_000 });
        await expect(page.locator('#export-quote-draft-btn')).toBeVisible();
        await page.evaluate(() => window.__lpQuotePreview.exportQuoteDraftDetails());
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
        const itemNames = (draft.items || []).map((i) => i.name);
        expect(itemNames.some((n) => /範例矮櫃|矮櫃/.test(n))).toBe(true);
        expect(itemNames.some((n) => /房門|落地窗/.test(n))).toBe(false);
        expect((draft.items || []).every((i) => !String(i.id).includes('door-demo') && !String(i.id).includes('win-demo'))).toBe(true);

        const bwLink = await page.locator('#quote-export-budgetweb-link').getAttribute('href');
        expect(bwLink).toContain('BudgetWeb_Standalone.html');
        expect(bwLink).toContain('lpPreview=1');

        await page.goto(bwUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await passGithackInterstitialIfPresent(page);
        await expect(page.locator('#lpImportBox')).toBeVisible({ timeout: 30_000 });

        await page.waitForFunction(() => window.__lpBudgetWebImportReady === true, null, {
            timeout: 60_000,
        });
        await page.locator('#lpDraftFileInput').setInputFiles(jsonPath);
        await expect(page.locator('#lpImportStatus')).toContainText('已讀取', { timeout: 20_000 });
        await expect(page.locator('#lpImportMergeBtn')).toBeEnabled({ timeout: 5_000 });
        await page.locator('#lpImportMergeBtn').click();

        await expect(page.locator('#previewArea')).toBeVisible({ timeout: 20_000 });
        const previewText = await page.locator('#previewBody').innerText();
        expect(previewText).toMatch(/範例矮櫃/);
        expect(previewText).not.toMatch(/房門|落地窗/);

        await page.screenshot({
            path: path.join(ARTIFACTS, 'githack-budgetweb-imported-lines.png'),
            fullPage: true,
        });
    });
});
