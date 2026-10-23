import { describe, it, expect } from 'vitest';
import {
    mergeLayoutPlannerDraftIntoProcessedData,
    validateLayoutPlannerQuoteDraft,
} from './LP_budgetweb_import_merge.js';
import { buildLayoutPlannerQuoteDraft } from './LP_quotation_budgetweb_export.js';

describe('mergeLayoutPlannerDraftIntoProcessedData', () => {
    it('追加新列且不覆蓋既有 id', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            lineItems: [
                { lineKey: 'cabinet_a', name: '矮櫃', group: '客廳', unit: '尺', quantity: 3, totalPrice: '' },
            ],
        });
        const existing = {
            total_summary: {},
            items: [{
                type: 'item',
                raw: 'old',
                data: { id: 'LP_cabinet_a', name: '舊資料', zone: '客廳' },
            }, {
                type: 'item',
                raw: 'keep',
                data: { id: 'KEEP_1', name: '保留', zone: '客廳' },
            }],
        };
        const { merged, stats } = mergeLayoutPlannerDraftIntoProcessedData(existing, draft);
        expect(stats.added).toBe(0);
        expect(stats.skippedDuplicate).toBe(1);
        expect(merged.items).toHaveLength(2);
        expect(merged.items[1].data.id).toBe('KEEP_1');
    });

    it('空列表時全部追加', () => {
        const draft = buildLayoutPlannerQuoteDraft({
            lineItems: [
                { lineKey: 'cabinet_b', name: '高櫃', group: '房間', unit: '尺', quantity: 2, totalPrice: '' },
            ],
        });
        const { merged, stats } = mergeLayoutPlannerDraftIntoProcessedData(null, draft);
        expect(stats.added).toBe(1);
        expect(merged.items).toHaveLength(1);
        expect(merged.items[0].type).toBe('item');
    });

    it('validate 草稿 schema', () => {
        expect(validateLayoutPlannerQuoteDraft({ schema: 'x' }).ok).toBe(false);
        const draft = buildLayoutPlannerQuoteDraft({ lineItems: [] });
        expect(validateLayoutPlannerQuoteDraft(draft).ok).toBe(true);
    });
});
