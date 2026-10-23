import { describe, it, expect } from 'vitest';
import BudgetQuoteParser from '../../tools/budget-quote-parser-lib.js';

describe('budget-quote-parser-lib item ids', () => {
    it('同表 3 列相同 base id 從第 2 筆起加 _2、_3', () => {
        const counts = new Map();
        const base = 'ITEM_1228_冷氣包管+窗簾盒';
        const id1 = BudgetQuoteParser.assignUniqueItemIdForSheet(counts, base);
        const id2 = BudgetQuoteParser.assignUniqueItemIdForSheet(counts, base);
        const id3 = BudgetQuoteParser.assignUniqueItemIdForSheet(counts, base);
        expect(id1).toBe(base);
        expect(id2).toBe(`${base}_2`);
        expect(id3).toBe(`${base}_3`);
    });

    it('stableItemContentHash 相同內容產生相同 hash', () => {
        const a = { name: '測試', spec: 'A', qty: '1', unit: '式', zone: '客廳' };
        expect(BudgetQuoteParser.stableItemContentHash(a)).toBe(
            BudgetQuoteParser.stableItemContentHash({ ...a }),
        );
    });
});
