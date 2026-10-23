import { describe, it, expect } from 'vitest';
import BudgetQuoteParser from '../../tools/budget-quote-parser-lib.js';

describe('budget-quote-parser-lib item ids', () => {
    it('同表 3 列相同 base id 從第 2 筆起加 _2、_3', () => {
        const used = new Set();
        const base = 'ITEM_1228_冷氣包管+窗簾盒';
        const id1 = BudgetQuoteParser.assignUniqueItemIdForSheet(used, base);
        const id2 = BudgetQuoteParser.assignUniqueItemIdForSheet(used, base);
        const id3 = BudgetQuoteParser.assignUniqueItemIdForSheet(used, base);
        expect(id1).toBe(base);
        expect(id2).toBe(`${base}_2`);
        expect(id3).toBe(`${base}_3`);
    });

    it('已有 ITEM_X_2 時，重複 base 跳號為 _3', () => {
        const used = new Set();
        expect(BudgetQuoteParser.assignUniqueItemIdForSheet(used, 'ITEM_X')).toBe('ITEM_X');
        expect(BudgetQuoteParser.assignUniqueItemIdForSheet(used, 'ITEM_X_2')).toBe('ITEM_X_2');
        expect(BudgetQuoteParser.assignUniqueItemIdForSheet(used, 'ITEM_X')).toBe('ITEM_X_3');
        expect(used.size).toBe(3);
    });

    it('stableItemContentHash 相同內容產生相同 hash', () => {
        const a = { name: '測試', spec: 'A', qty: '1', unit: '式', zone: '客廳' };
        expect(BudgetQuoteParser.stableItemContentHash(a)).toBe(
            BudgetQuoteParser.stableItemContentHash({ ...a }),
        );
    });
});
