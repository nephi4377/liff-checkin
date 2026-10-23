import { describe, it, expect } from 'vitest';
import {
    inferQuoteSourceTypeForPlacement,
    serializePlacedCabinetForLayoutSave,
    isCabinetLikeProductName,
} from './LP_quote_placement_meta.js';
import { isQuoteExportablePlacedCabinet } from './LP_cabinet_quote_filter.js';

describe('LP_quote_placement_meta', () => {
    it('櫃體名稱優先於沙發／床／家電字樣', () => {
        const names = [
            '沙發背櫃',
            '沙發側半腰櫃',
            '床邊櫃',
            '床頭吊櫃',
            '床頭收納櫃',
            '掀床收納櫃',
            '冰箱櫃',
            '冰箱高櫃',
            '冰箱上櫃',
            '洗衣機櫃',
            '洗碗機下櫃',
            '微波爐電器櫃',
        ];
        names.forEach((name) => {
            expect(isCabinetLikeProductName(name)).toBe(true);
            expect(inferQuoteSourceTypeForPlacement({ name, group: '系統櫃' })).toBe('floorplan_cabinet');
            expect(isQuoteExportablePlacedCabinet({ id: 'x', data: { name, group: '系統櫃' } })).toBe(true);
        });
    });

    it('serializePlacedCabinetForLayoutSave 不寫入推斷旗標', () => {
        const cab = {
            id: 'c1',
            quoteSourceType: 'furniture',
            quoteExport: false,
            data: { name: '三人沙發', group: '系統櫃', quoteExport: false },
        };
        const saved = serializePlacedCabinetForLayoutSave(cab);
        expect(saved.quoteSourceType).toBeUndefined();
        expect(saved.quoteExport).toBeUndefined();
        expect(saved.data.quoteExport).toBeUndefined();
    });

    it('使用者明確旗標可存檔', () => {
        const cab = {
            id: 'c2',
            quoteFlagsUserSet: true,
            quoteExport: false,
            data: { name: '房門', group: '門窗工程' },
        };
        const saved = serializePlacedCabinetForLayoutSave(cab);
        expect(saved.quoteExport).toBe(false);
        expect(saved.quoteFlagsUserSet).toBe(true);
    });

    it('第二次存檔仍保留 quoteFlagsUserSet', () => {
        const cab = {
            id: 'c3',
            quoteFlagsUserSet: true,
            quoteExport: true,
            data: { name: '矮櫃', group: '系統櫃' },
        };
        const once = serializePlacedCabinetForLayoutSave(cab);
        const twice = serializePlacedCabinetForLayoutSave(once);
        expect(twice.quoteFlagsUserSet).toBe(true);
        expect(twice.quoteExport).toBe(true);
    });
});
