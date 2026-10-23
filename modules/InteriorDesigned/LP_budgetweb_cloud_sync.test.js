import { describe, it, expect } from 'vitest';
import {
    mergeQuotationItemsById,
    computeQuotationSyncDiff,
    prepareCloudQuotationSync,
    formatSyncDiffForConfirm,
    validateQuotationItemsForSync,
    findDuplicateItemIds,
    normalizeLocalItemForDiff,
    matchRemoteItemByExactId,
    applyRemoteProgressByExactId,
    findNameSpecHintsForSync,
} from './LP_budgetweb_cloud_sync.js';

describe('LP_budgetweb_cloud_sync', () => {
    const remote = [
        { id: 'R1', name: '雲端保留', spec: 'a', qty: '1', unit: '式', price: '100', completion_percent: 10 },
        { id: 'R2', name: '將被本地更新', spec: '舊', qty: '1', unit: '式', price: '50' },
    ];

    it('union 保留僅雲端有的 id', () => {
        const local = [
            { id: 'R2', name: '將被本地更新', spec: '新', qty: '2', unit: '式', price: '50' },
            { id: 'L1', name: '本地新增', spec: '', qty: '1', unit: '尺', price: '' },
        ];
        const merged = mergeQuotationItemsById(local, remote);
        expect(merged.map((i) => i.id).sort()).toEqual(['L1', 'R1', 'R2']);
    });

    it('進度只依完全相同 id，名稱+規格相同但 id 不同不帶入', () => {
        const remoteItems = [
            {
                id: 'CLOUD_1',
                name: '系統櫃',
                spec: 'W120',
                completion_percent: 80,
                verification: { is_ok: true },
            },
        ];
        const merged = [
            { id: 'NEW_1', name: '系統櫃', spec: 'W120' },
            { id: 'NEW_2', name: '系統櫃', spec: 'W120' },
        ];
        const out = applyRemoteProgressByExactId(merged, remoteItems);
        expect(out[0].completion_percent).toBeUndefined();
        expect(out[0].verification).toBeUndefined();
        expect(out[1].completion_percent).toBeUndefined();
        expect(matchRemoteItemByExactId({ id: 'NEW_1' }, remoteItems)).toBeNull();
    });

    it('同名同規格僅產生提示，不當成 match', () => {
        const local = [{ id: 'L-new', name: '木作', spec: 'W120' }];
        const remoteItems = [{ id: 'ITEM_OLD', name: '木作', spec: 'W120' }];
        const hints = findNameSpecHintsForSync(local, remoteItems);
        expect(hints).toHaveLength(1);
        expect(hints[0].candidates[0].id).toBe('ITEM_OLD');
        const text = formatSyncDiffForConfirm({ added: [], removed: [], changed: [], preservedRemoteOnly: [], hasChanges: false }, hints);
        expect(text).toContain('不會自動帶入驗收進度');
    });

    it('無 id / 重複 id blocking', () => {
        const prep = prepareCloudQuotationSync({
            localItems: [{ id: 'L1', name: 'a' }],
            remoteContext: { items: [{ name: '雲端缺 id' }] },
        });
        expect(prep.blockingErrors.length).toBeGreaterThan(0);
        expect(findDuplicateItemIds([{ id: 'A' }, { id: 'A' }])).toEqual(['A']);
    });

    it('本地空價格補雲端後不比為變更', () => {
        const loc = { id: 'R1', name: '雲端保留', spec: 'a', qty: '1', unit: '式', price: '' };
        const merged = mergeQuotationItemsById([loc], remote);
        const diff = computeQuotationSyncDiff(remote, [loc], merged);
        expect(diff.changed).toHaveLength(0);
        expect(normalizeLocalItemForDiff(loc, remote[0]).price).toBe('100');
    });

    it('變更過半時確認文案含 id 位移警示', () => {
        const diff = {
            added: [],
            removed: [],
            changed: [{ id: 'a', before: {}, after: {} }, { id: 'b', before: {}, after: {} }],
            preservedRemoteOnly: [],
            hasChanges: true,
        };
        const text = formatSyncDiffForConfirm(diff);
        expect(text).toContain('變更筆數超過');
    });

    it('確認視窗列出保留的雲端獨有列', () => {
        const diff = computeQuotationSyncDiff(
            [{ id: 'ONLY_CLOUD', name: '遠端獨有工項' }],
            [],
            [{ id: 'ONLY_CLOUD', name: '遠端獨有工項' }],
        );
        const text = formatSyncDiffForConfirm(diff);
        expect(text).toContain('ONLY_CLOUD');
        expect(text).toContain('遠端獨有工項');
    });
});
