import { describe, it, expect } from 'vitest';
import {
    PENDING_PRICE_LABEL,
    resolveCabinetPricingRule,
    computeQuantityFromPricingRule,
    formatCabinetWdhSpec,
    listPricingDecisionsForOwner,
    computeLineTotalPrice,
} from './LP_quote_pricing_rules.js';

describe('LP_quote_pricing_rules', () => {
    it('預設不帶數字單價', () => {
        const rule = resolveCabinetPricingRule({ data: { pricingType: 'width' } });
        expect(rule.unitPrice).toBeNull();
        expect(rule.priceStatus).toBe(PENDING_PRICE_LABEL);
        expect(computeLineTotalPrice(rule, 4)).toBe('');
    });

    it('寬邊尺數', () => {
        const cab = { data: { pricingType: 'width' }, currentW: 120, currentH: 60 };
        const rule = resolveCabinetPricingRule(cab);
        expect(computeQuantityFromPricingRule(cab, rule)).toBe(4);
    });

    it('寬深高規格字串', () => {
        const spec = formatCabinetWdhSpec({
            currentW: 100,
            currentH: 50,
            data: { height: 240 },
        });
        expect(spec).toBe('寬100×深50×高240cm');
    });

    it('豪哥待定價清單含各 pricingType', () => {
        const list = listPricingDecisionsForOwner();
        expect(list.some((r) => r.pricingType === 'width')).toBe(true);
        expect(list.every((r) => r.priceStatus === PENDING_PRICE_LABEL)).toBe(true);
    });
});
