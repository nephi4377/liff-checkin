import { describe, it, expect } from 'vitest';
import {
    resolveAuditorFirebaseWriteGate,
    buildAuditorCloudWriteBaselineFromFirebaseNode,
    shouldBlockQuotationWriteWithoutBaseline,
    AUDITOR_MISSING_BASELINE_MESSAGE,
} from './LP_budgetweb_auditor_sync.js';
import {
    normalizeQuotationFirebaseSnapshot,
    buildRemoteQuotationSyncBaseline,
} from './LP_budgetweb_cloud_sync.js';

describe('resolveAuditorFirebaseWriteGate (Auditor 實際寫入路徑)', () => {
    it('雲端存在但 baseline null → missing_baseline（shouldBlockQuotationWriteWithoutBaseline）', () => {
        expect(shouldBlockQuotationWriteWithoutBaseline(true, null)).toBe(true);
        const gate = resolveAuditorFirebaseWriteGate({
            remoteExists: true,
            baseline: null,
            freshVal: { context: { items: [] } },
        });
        expect(gate).toEqual({
            blocked: true,
            reason: 'missing_baseline',
            message: AUDITOR_MISSING_BASELINE_MESSAGE,
        });
    });

    it('新案（remote 不存在）無 baseline 不阻擋', () => {
        const gate = resolveAuditorFirebaseWriteGate({
            remoteExists: false,
            baseline: null,
        });
        expect(gate.blocked).toBe(false);
    });

    it('舊格式僅 total_summary：可建 baseline，寫入閘不會因缺 context 永久擋住', () => {
        const legacy = {
            last_updated: '2020-01-01',
            total_summary: { siteName: '舊案', overall_completion: 0 },
        };
        const normalized = normalizeQuotationFirebaseSnapshot(legacy);
        expect(normalized?.context?.total_summary?.siteName).toBe('舊案');
        expect(normalized?.context?.items).toEqual([]);

        const baseline = buildAuditorCloudWriteBaselineFromFirebaseNode(legacy);
        expect(baseline).not.toBeNull();
        expect(baseline.itemCount).toBe(0);

        const gate = resolveAuditorFirebaseWriteGate({
            remoteExists: true,
            baseline,
            freshVal: legacy,
        });
        expect(gate.blocked).toBe(false);
    });

    it('fresh 與 baseline 不一致 → remote_changed', () => {
        const base = {
            last_updated: 't1',
            context: { items: [{ id: 'A', name: 'x', qty: '1', unit: '式' }] },
        };
        const baseline = buildRemoteQuotationSyncBaseline(base);
        const gate = resolveAuditorFirebaseWriteGate({
            remoteExists: true,
            baseline,
            freshVal: {
                last_updated: 't2',
                context: { items: [{ id: 'A', name: 'x', qty: '1', unit: '式' }] },
            },
        });
        expect(gate.blocked).toBe(true);
        expect(gate.reason).toBe('remote_changed');
    });
});
