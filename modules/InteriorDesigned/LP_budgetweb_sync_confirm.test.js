import { describe, it, expect } from 'vitest';
import {
    budgetWebSyncConfirmEnterProceeds,
    confirmBudgetWebWriteProceed,
} from './LP_budgetweb_sync_confirm.js';

describe('budgetWebSyncConfirmEnterProceeds', () => {
    it('dangerous（defaultProceed false）時 Enter 不繼續', () => {
        expect(budgetWebSyncConfirmEnterProceeds(false)).toBe(false);
    });

    it('一般確認（defaultProceed true）時 Enter 可繼續', () => {
        expect(budgetWebSyncConfirmEnterProceeds(true)).toBe(true);
    });
});

describe('confirmBudgetWebWriteProceed (node)', () => {
    it('無 DOM 時回傳 defaultProceed', async () => {
        await expect(confirmBudgetWebWriteProceed('x', { defaultProceed: false })).resolves.toBe(false);
        await expect(confirmBudgetWebWriteProceed('x', { defaultProceed: true })).resolves.toBe(true);
    });
});
