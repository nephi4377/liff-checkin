import { describe, it, expect } from 'vitest';
import {
    mergeQuotationItemsById,
    computeQuotationSyncDiff,
    prepareCloudQuotationSync,
    formatSyncDiffForConfirm,
} from './LP_budgetweb_cloud_sync.js';

describe('LP_budgetweb_cloud_sync', () => {
    const remote = [
        { id: 'R1', name: '雲端保留', spec: 'a', qty: '1', unit: '式', price: '100' },
        { id: 'R2', name: '將被本地更新', spec: '舊', qty: '1', unit: '式', price: '50' },
    ];

    it('union 保留僅雲端有的 id', () => {
        const local = [
            { id: 'R2', name: '將被本地更新', spec: '新', qty: '2', unit: '式', price: '50' },
            { id: 'L1', name: '本地新增', spec: '', qty: '1', unit: '尺', price: '' },
        ];
        const merged = mergeQuotationItemsById(local, remote);
        expect(merged.map((i) => i.id).sort()).toEqual(['L1', 'R1', 'R2']);
        expect(merged.find((i) => i.id === 'R2').spec).toBe('新');
        expect(merged.find((i) => i.id === 'R1').name).toBe('雲端保留');
    });

    it('diff 標示新增與變更，removed 為空', () => {
        const local = [
            { id: 'R2', name: '將被本地更新', spec: '新', qty: '2', unit: '式', price: '50' },
            { id: 'L1', name: '本地新增', spec: '', qty: '1', unit: '尺', price: '' },
        ];
        const merged = mergeQuotationItemsById(local, remote);
        const diff = computeQuotationSyncDiff(remote, local, merged);
        expect(diff.removed).toHaveLength(0);
        expect(diff.added.map((i) => i.id)).toEqual(['L1']);
        expect(diff.changed).toHaveLength(1);
        expect(diff.preservedRemoteOnly.map((i) => i.id)).toEqual(['R1']);
        expect(diff.hasChanges).toBe(true);
        expect(formatSyncDiffForConfirm(diff)).toContain('保留雲端獨有');
    });

    it('prepareCloudQuotationSync 封裝', () => {
        const { mergedItems, diff } = prepareCloudQuotationSync({
            localItems: [{ id: 'L1', name: 'x' }],
            remoteContext: { items: [{ id: 'R1', name: 'y' }] },
        });
        expect(mergedItems).toHaveLength(2);
        expect(diff.hasChanges).toBe(true);
    });
});
