import { describe, it, expect } from 'vitest';
import {
    buildLayoutPlannerQuoteDraft,
    inferCategoryTag,
    budgetWebDraftToCsv,
    budgetWebDraftToCsvWithBom,
    formatCsvCell,
    formatDraftLinePrice,
    UTF8_CSV_BOM,
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

describe('formatDraftLinePrice', () => {
    it('保留 0 與負數', () => {
        expect(formatDraftLinePrice(0)).toBe('0');
        expect(formatDraftLinePrice(-1200)).toBe('-1200');
        expect(formatDraftLinePrice(99.6)).toBe('100');
    });
});

describe('buildLayoutPlannerQuoteDraft', () => {
    it('略過標題列並帶入 zone', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            grandTotal: 99999,
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
        expect(draft.items[0].layoutPlanner).toBeUndefined();
        expect(draft.total_summary.grand_total).toBe(5000);
    });

    it('grand_total 由工項加總（含 0 與負數），忽略不一致的 input.grandTotal', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            grandTotal: 100,
            lineItems: [
                { lineKey: 'a', name: '增項', group: 'G', unit: '式', quantity: 1, totalPrice: 5000 },
                { lineKey: 'b', name: '減項', group: 'G', unit: '式', quantity: 1, totalPrice: -2000 },
                { lineKey: 'c', name: '贈送', group: 'G', unit: '式', quantity: 1, totalPrice: 0 },
            ],
        });
        expect(draft.items.map((i) => i.price)).toEqual(['5000', '-2000', '0']);
        expect(draft.total_summary.grand_total).toBe(3000);
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

describe('formatCsvCell', () => {
    it('含逗號或雙引號時加引號', () => {
        expect(formatCsvCell('a,b')).toBe('"a,b"');
        expect(formatCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it('含換行或單獨 \\r 時加引號', () => {
        expect(formatCsvCell('line1\nline2')).toBe('"line1\nline2"');
        expect(formatCsvCell('only\rcarriage')).toBe('"only\rcarriage"');
    });

    it('公式注入：= + - @ Tab \\r 開頭加單引號', () => {
        expect(formatCsvCell('=1+1')).toBe("'=1+1");
        expect(formatCsvCell('+123')).toBe("'+123");
        expect(formatCsvCell('-100')).toBe("'-100");
        expect(formatCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
        expect(formatCsvCell('\tmalicious')).toBe("'\tmalicious");
        expect(formatCsvCell('\rlead')).toBe('"\'\rlead"');
    });

    it('qty／price 純數字欄不套公式前綴（含負數）', () => {
        const num = { numericQuantityOrPrice: true };
        expect(formatCsvCell('-50', num)).toBe('-50');
        expect(formatCsvCell('3.5', num)).toBe('3.5');
        expect(formatCsvCell('-100', num)).toBe('-100');
        expect(formatCsvCell('+123', num)).toBe("'+123");
    });
});

describe('budgetWebDraftToCsv', () => {
    it('品名含公式時 CSV 欄位已防護', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            lineItems: [{
                lineKey: 'x',
                name: '=cmd|',
                group: 'G',
                unit: '式',
                quantity: 1,
                totalPrice: -50,
            }],
        });
        const csv = budgetWebDraftToCsv(draft);
        expect(csv).toContain("'=cmd|");
        expect(csv).toMatch(/,1,-50,/);
    });
});

describe('budgetWebDraftToCsvWithBom', () => {
    it('開頭為 UTF-8 BOM', () => {
        const bytes = budgetWebDraftToCsvWithBom(
            buildLayoutPlannerQuoteDraft({
                lineItems: [{ lineKey: 'z', name: 'x', group: 'G', unit: '式', quantity: 0, totalPrice: 0 }],
            }),
        );
        expect(bytes[0]).toBe(UTF8_CSV_BOM[0]);
        expect(bytes[1]).toBe(UTF8_CSV_BOM[1]);
        expect(bytes[2]).toBe(UTF8_CSV_BOM[2]);
        const text = new TextDecoder().decode(bytes.slice(3));
        expect(text).toContain('0');
    });
});
