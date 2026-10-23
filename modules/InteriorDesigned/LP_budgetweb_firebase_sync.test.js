import { describe, it, expect, vi } from 'vitest';
import { runBudgetWebQuotationCloudSync } from './LP_budgetweb_firebase_sync.js';

describe('runBudgetWebQuotationCloudSync', () => {
    it('讀取失敗時不寫入', async () => {
        const update = vi.fn();
        const alerts = [];
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P1',
            localItems: [{ id: 'A', name: 'x' }],
            readQuotationSnapshot: async () => {
                throw new Error('network');
            },
            updateQuotation: update,
            alertFn: (m) => alerts.push(m),
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('read_failed');
        expect(update).not.toHaveBeenCalled();
        expect(alerts[0]).toMatch(/無法讀取/);
    });

    it('新案成功 update 路徑 payload', async () => {
        const update = vi.fn();
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P2',
            localItems: [{ id: 'L1', name: '工項', qty: '1', unit: '式' }],
            totalSummary: {},
            readQuotationSnapshot: async () => ({
                exists: () => false,
                val: () => null,
            }),
            updateQuotation: update,
            confirmFn: () => true,
        });
        expect(result.ok).toBe(true);
        expect(update).toHaveBeenCalledTimes(1);
        const payload = update.mock.calls[0][1];
        expect(payload['context/items']).toHaveLength(1);
        expect(payload.is_closed).toBeUndefined();
    });
});
