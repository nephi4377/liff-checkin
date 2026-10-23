import { describe, it, expect } from 'vitest';
import {
    planLegacyQuotationIdRemap,
    prepareCloudQuotationSync,
    applyRemoteProgressByExactId,
    shouldSuggestCancelRemoteInflation,
    isLegacyRowNumberQuotationItemId,
} from './LP_budgetweb_cloud_sync.js';

/** 合成資料（非 778 真實內容） */
function synthLocal0818(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `ITEM_0818_${i + 1}`,
        name: `合成工項${i + 1}`,
        spec: `規格${i + 1}`,
        unit: '式',
        sheet_source: '0818',
        price: '1000',
    }));
}

function synthLegacyRowIds(count, progressAt = 0) {
    return Array.from({ length: count }, (_, i) => ({
        id: `ITEM_${i + 1}`,
        name: `合成工項${i + 1}`,
        spec: `規格${i + 1}`,
        unit: '式',
        sheet_source: '0818',
        completion_percent: i === 0 ? progressAt : 0,
        verification: { is_ok: i === 0 && progressAt > 0 },
    }));
}

describe('legacy quotation id remap (778-style synthetic)', () => {
    it('isLegacyRowNumberQuotationItemId', () => {
        expect(isLegacyRowNumberQuotationItemId('ITEM_6')).toBe(true);
        expect(isLegacyRowNumberQuotationItemId('ITEM_0818_6')).toBe(false);
    });

    it('舊 ITEM_<列號> 對應新 ITEM_0818_*，合併筆數不膨脹', () => {
        const local = synthLocal0818(5);
        const remote = synthLegacyRowIds(5);
        const prep = prepareCloudQuotationSync({ localItems: local, remoteContext: { items: remote } });
        expect(prep.blockingErrors).toEqual([]);
        expect(prep.legacyRemap.matched).toHaveLength(5);
        expect(prep.mergedItems).toHaveLength(5);
        expect(prep.diff.preservedRemoteOnly).toHaveLength(0);
        expect(prep.mergedItems.map((i) => i.id).sort()).toEqual(local.map((i) => i.id).sort());
    });

    it('進度從舊 id 帶入對應新 id', () => {
        const local = synthLocal0818(2);
        const remote = synthLegacyRowIds(2, 42);
        const legacy = planLegacyQuotationIdRemap(local, remote);
        const merged = [{ ...local[0] }, { ...local[1] }];
        const out = applyRemoteProgressByExactId(merged, remote, legacy);
        expect(out[0].completion_percent).toBe(42);
        expect(out[0].verification?.is_ok).toBe(true);
    });

    it('名稱重複一對多衝突 → blocking', () => {
        const local = [
            { id: 'ITEM_0818_A', name: '同名', spec: '1', unit: '式', sheet_source: '0818' },
            { id: 'ITEM_0818_B', name: '同名', spec: '1', unit: '式', sheet_source: '0818' },
        ];
        const remote = [
            { id: 'ITEM_1', name: '同名', spec: '1', unit: '式', sheet_source: '0818' },
        ];
        const prep = prepareCloudQuotationSync({ localItems: local, remoteContext: { items: remote } });
        expect(prep.blockingErrors.length).toBeGreaterThan(0);
        expect(prep.blockingErrors[0]).toMatch(/一對多/);
    });

    it('舊版無對應本地 → blocking，不保留幽靈筆', () => {
        const local = synthLocal0818(2);
        const remote = [
            ...synthLegacyRowIds(2),
            { id: 'ITEM_99', name: '僅雲端', spec: 'X', unit: '式', sheet_source: '0818' },
        ];
        const prep = prepareCloudQuotationSync({ localItems: local, remoteContext: { items: remote } });
        expect(prep.blockingErrors.some((e) => e.includes('無法對應'))).toBe(true);
    });

    it('shouldSuggestCancelRemoteInflation >10%', () => {
        expect(shouldSuggestCancelRemoteInflation(100, 11)).toBe(true);
        expect(shouldSuggestCancelRemoteInflation(100, 10)).toBe(false);
    });

    it('多一筆無法對應的舊版 id → blocking', () => {
        const local = synthLocal0818(10);
        const remote = [
            ...synthLegacyRowIds(10),
            { id: 'ITEM_11', name: '僅雲端舊版', spec: '無', unit: '式', sheet_source: '0818' },
        ];
        const legacy = planLegacyQuotationIdRemap(local, remote);
        expect(legacy.blockingErrors.some((e) => e.includes('無法對應'))).toBe(true);
    });
});
