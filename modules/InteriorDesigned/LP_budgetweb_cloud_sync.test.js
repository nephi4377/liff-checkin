import { describe, it, expect } from 'vitest';
import {
    mergeQuotationItemsById,
    computeQuotationSyncDiff,
    prepareCloudQuotationSync,
    formatSyncDiffForConfirm,
    validateQuotationItemsForSync,
    findDuplicateItemIds,
    normalizeLocalItemForDiff,
    matchRemoteItemForLocal,
    buildQuotationFirebaseUpdatePayload,
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
        const { mergedItems, diff, blockingErrors } = prepareCloudQuotationSync({
            localItems: [{ id: 'L1', name: 'x' }],
            remoteContext: { items: [{ id: 'R1', name: 'y' }] },
        });
        expect(blockingErrors).toEqual([]);
        expect(mergedItems).toHaveLength(2);
        expect(diff.hasChanges).toBe(true);
    });

    it('無 id 的本地或雲端列會 blocking', () => {
        const errors = validateQuotationItemsForSync(
            [{ name: '缺 id' }],
            [{ id: 'R1', name: 'ok' }],
        );
        expect(errors.some((e) => e.includes('本地') && e.includes('缺少 id'))).toBe(true);

        const prep = prepareCloudQuotationSync({
            localItems: [{ id: 'L1', name: 'a' }],
            remoteContext: { items: [{ name: '雲端缺 id' }] },
        });
        expect(prep.blockingErrors.length).toBeGreaterThan(0);
        expect(prep.mergedItems).toHaveLength(0);
    });

    it('重複 id 會 blocking', () => {
        expect(findDuplicateItemIds([{ id: 'A' }, { id: 'A' }])).toEqual(['A']);
        const errors = validateQuotationItemsForSync(
            [{ id: 'DUP', name: 'a' }, { id: 'DUP', name: 'b' }],
            [],
        );
        expect(errors.some((e) => e.includes('重複'))).toBe(true);
        expect(() => mergeQuotationItemsById([{ id: 'X' }, { id: 'X' }], [])).toThrow();
    });

    it('本地空價格補雲端後不比為變更', () => {
        const loc = { id: 'R1', name: '雲端保留', spec: 'a', qty: '1', unit: '式', price: '' };
        const rem = remote[0];
        const merged = mergeQuotationItemsById([loc], remote);
        const diff = computeQuotationSyncDiff(remote, [loc], merged);
        expect(diff.changed).toHaveLength(0);
        expect(normalizeLocalItemForDiff(loc, rem).price).toBe('100');
    });

    it('名稱+規格備援對應雲端列（id 不同）', () => {
        const remoteItems = [{ id: 'ITEM_OLD_R0', name: '木作', spec: 'W120', qty: '1', unit: '尺', price: '10' }];
        const local = [{ id: 'ITEM_NEW_R0', name: '木作', spec: 'W120', qty: '1', unit: '尺', price: '' }];
        const match = matchRemoteItemForLocal(local[0], remoteItems);
        expect(match?.id).toBe('ITEM_OLD_R0');
        const merged = mergeQuotationItemsById(local, remoteItems);
        expect(merged).toHaveLength(2);
    });

    it('buildQuotationFirebaseUpdatePayload 只更新 context 子路徑', () => {
        const payload = buildQuotationFirebaseUpdatePayload({
            finalContext: {
                案號: 'P1',
                total_summary: { siteName: '測試' },
                items: [{ id: '1' }],
            },
            isNewQuotationNode: false,
        });
        expect(payload['context/items']).toHaveLength(1);
        expect(payload['context/total_summary']).toBeTruthy();
        expect(payload['context/案號']).toBe('P1');
        expect(payload.is_closed).toBeUndefined();
        expect(payload.context).toBeUndefined();
    });
});
