import { describe, it, expect } from 'vitest';
import {
    PINNED_GITHACK_COMMIT,
    resolveLiffCheckinRepoRootFromPathname,
    buildGithackLayoutPlannerPreviewUrl,
    buildGithackBudgetWebPreviewUrl,
    buildBudgetWebPreviewUrl,
    getLayoutPlannerModuleUrl,
} from './LP_preview_hosts.js';

describe('LP_preview_hosts', () => {
    it('githack URL 含 .html 與完整 SHA', () => {
        const url = buildGithackLayoutPlannerPreviewUrl({ commitSha: PINNED_GITHACK_COMMIT });
        expect(url).toContain('raw.githack.com');
        expect(url).toContain('LP_LayoutPlanner.html');
        expect(url).toContain(PINNED_GITHACK_COMMIT);
        expect(url).toContain('lpPreview=1');
    });

    it('從 githack pathname 推算同源 BudgetWeb', () => {
        const loc = {
            origin: 'https://raw.githack.com',
            hostname: 'raw.githack.com',
            pathname: `/nephi4377/liff-checkin/${PINNED_GITHACK_COMMIT}/modules/InteriorDesigned/LP_LayoutPlanner.html`,
        };
        const bw = buildBudgetWebPreviewUrl(loc);
        expect(bw).toBe(
            `https://raw.githack.com/nephi4377/liff-checkin/${PINNED_GITHACK_COMMIT}/tools/BudgetWeb_Standalone.html?lpPreview=1`,
        );
    });

    it('模組 cache-bust', () => {
        expect(getLayoutPlannerModuleUrl('abcdef1234567890')).toMatch(/\?v=abcdef123456/);
    });

    it('BudgetWeb githack 連結', () => {
        const u = buildGithackBudgetWebPreviewUrl();
        expect(u).toContain('BudgetWeb_Standalone.html?lpPreview=1');
    });

    it('repo root 解析', () => {
        const root = resolveLiffCheckinRepoRootFromPathname(
            `/nephi4377/liff-checkin/abc/tools/BudgetWeb_Standalone.html`,
        );
        expect(root).toBe('/nephi4377/liff-checkin/abc');
    });
});
