import { describe, it, expect } from 'vitest';
import { inferQuoteSourceTypeForPlacement, enrichPlacedCabinetQuoteMeta } from './LP_quote_placement_meta.js';

describe('LP_quote_placement_meta', () => {
    it('放置時寫入 quoteSourceType', () => {
        const cab = {
            id: 'c1',
            data: { name: '三人沙發', group: '系統櫃', width: 120, depth: 60 },
        };
        enrichPlacedCabinetQuoteMeta(cab);
        expect(cab.quoteSourceType).toBe('furniture');
        expect(cab.data.quoteExport).toBe(false);
    });

    it('系統櫃矮櫃為 floorplan_cabinet', () => {
        expect(
            inferQuoteSourceTypeForPlacement({ name: '矮櫃', group: '系統櫃', width: 80, depth: 55 }),
        ).toBe('floorplan_cabinet');
    });
});
