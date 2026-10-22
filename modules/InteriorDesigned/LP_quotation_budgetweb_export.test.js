import { describe, it, expect } from 'vitest';
import {
    buildLayoutPlannerQuoteDraft,
    inferCategoryTag,
    budgetWebDraftToCsv,
    LP_QUOTE_DRAFT_SCHEMA,
} from './LP_quotation_budgetweb_export.js';

describe('inferCategoryTag', () => {
    it('鞋櫃歸系統櫃體', () => {
        expect(inferCategoryTag('鞋櫃', '120×240cm')).toBe('系統櫃體');
    });
    it('平釘天花歸木作', () => {
        expect(inferCategoryTag('平釘天花板', '')).toBe('木作工程');
    });
});

describe('buildLayoutPlannerQuoteDraft', () => {
    it('略過標題列並帶入 zone', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            grandTotal: 5000,
            lineItems: [
                { isHeader: true, name: '客餐廳' },
                {
                    lineKey: 'cabinet_1',
                    name: '鞋櫃',
                    group: '客餐廳',
                    unit: '尺',
                    quantity: 4,
                    totalPrice: 5000,
                    specNote: '120×240cm',
                },
            ],
        });
        expect(draft.schema).toBe(LP_QUOTE_DRAFT_SCHEMA);
        expect(draft.items).toHaveLength(1);
        expect(draft.items[0].zone).toBe('客餐廳');
        expect(draft.items[0].qty).toBe('4');
        expect(draft.items[0].price).toBe('5000');
        expect(draft.items[0].spec).toBe('120×240cm');
    });

    it('CSV 含表頭與一筆資料', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            lineItems: [{ lineKey: 'a', name: '測試', group: 'G', unit: '式', quantity: 1, totalPrice: 100 }],
        });
        const csv = budgetWebDraftToCsv(draft);
        expect(csv.split('\n')[0]).toContain('品項');
        expect(csv).toContain('測試');
    });
});
