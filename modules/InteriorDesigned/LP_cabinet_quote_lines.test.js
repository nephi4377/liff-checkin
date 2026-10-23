import { describe, it, expect } from 'vitest';
import { buildCabinetQuoteLineItemsFromLayout } from './LP_cabinet_quote_lines.js';
import { PENDING_PRICE_LABEL } from './LP_quote_pricing_rules.js';

describe('buildCabinetQuoteLineItemsFromLayout', () => {
    it('產生區段標題與櫃體列（無捏造總價）', () => {
        const lines = buildCabinetQuoteLineItemsFromLayout([
            {
                id: 'c1',
                currentW: 90,
                currentH: 45,
                data: { name: '鞋櫃', group: '玄關', pricingType: 'width' },
                addons: {},
                addonsConfig: [],
            },
        ]);
        expect(lines[0].isHeader).toBe(true);
        expect(lines[0].name).toBe('玄關');
        const row = lines[1];
        expect(row.name).toBe('鞋櫃');
        expect(row.group).toBe('玄關');
        expect(row.categoryTag).toBe('系統櫃體');
        expect(row.specNote).toContain('寬90×深45×高');
        expect(row.totalPrice).toBe('');
        expect(row.priceStatus).toBe(PENDING_PRICE_LABEL);
    });
});
