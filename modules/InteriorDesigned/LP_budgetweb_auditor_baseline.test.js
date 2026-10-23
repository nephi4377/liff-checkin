import { describe, it, expect } from 'vitest';
import { shouldBlockQuotationWriteWithoutBaseline } from './LP_budgetweb_cloud_sync.js';

describe('shouldBlockQuotationWriteWithoutBaseline (Auditor V2)', () => {
    it('雲端節點存在但 baseline 為 null 時阻擋', () => {
        expect(shouldBlockQuotationWriteWithoutBaseline(true, null)).toBe(true);
    });

    it('新案或已有 baseline 時不阻擋', () => {
        expect(shouldBlockQuotationWriteWithoutBaseline(false, null)).toBe(false);
        expect(shouldBlockQuotationWriteWithoutBaseline(true, { itemsContentHash: 'x' })).toBe(false);
    });
});
