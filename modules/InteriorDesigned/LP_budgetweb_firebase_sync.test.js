import { describe, it, expect, vi } from 'vitest';
import { runBudgetWebQuotationCloudSync } from './LP_budgetweb_firebase_sync.js';
import {
    buildRemoteQuotationSyncBaseline,
    remoteQuotationSyncBaselineChanged,
    runLocalQuotationIdDuplicateCheck,
} from './LP_budgetweb_cloud_sync.js';

const baseRemote = {
    last_updated: '2026-01-01 10:00',
    context: {
        items: [{ id: 'R1', name: '工項', qty: '1', unit: '式', completion_percent: 5 }],
        total_summary: { siteName: '測試案場' },
    },
};

function makeSyncOpts(overrides = {}) {
    let readCount = 0;
    const remote = overrides.remoteData ?? baseRemote;
    const localItems = overrides.localItems || [{ id: 'R1', name: '工項', qty: '1', unit: '式' }];
    const base = {
        projectNo: 'P1',
        localItems,
        totalSummary: {},
        allowProductionSync: true,
        localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck(localItems),
        readQuotationSnapshot: async () => {
            readCount += 1;
            if (overrides.onRead) overrides.onRead(readCount);
            const data = overrides.remoteOnSecondRead && readCount > 1
                ? overrides.remoteOnSecondRead
                : remote;
            const exists = data != null;
            return {
                exists: () => exists,
                val: () => data,
            };
        },
        updateQuotation: overrides.updateQuotation || vi.fn(),
        confirmFn: overrides.confirmFn || (() => true),
        alertFn: overrides.alertFn || (() => {}),
    };
    return {
        ...base,
        ...overrides,
        localItems,
        localIdDuplicateCheck: overrides.localIdDuplicateCheck || base.localIdDuplicateCheck,
    };
}

describe('runBudgetWebQuotationCloudSync', () => {
    it('讀取失敗時不寫入', async () => {
        const update = vi.fn();
        const alerts = [];
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P1',
            localItems: [{ id: 'A', name: 'x' }],
            allowProductionSync: true,
            localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck([{ id: 'A', name: 'x' }]),
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
            allowProductionSync: true,
            localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck([
                { id: 'L1', name: '工項', qty: '1', unit: '式' },
            ]),
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

    it('雲端無變動時確認後可寫入（寫回前重讀一致）', async () => {
        const update = vi.fn();
        let reads = 0;
        const result = await runBudgetWebQuotationCloudSync(
            makeSyncOpts({
                updateQuotation: update,
                onRead: (n) => {
                    reads = n;
                },
            }),
        );
        expect(result.ok).toBe(true);
        expect(reads).toBeGreaterThanOrEqual(2);
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('寫回前重讀發現 last_updated 變動則中止', async () => {
        const update = vi.fn();
        const alerts = [];
        const changed = {
            ...baseRemote,
            last_updated: '2026-01-01 11:00',
        };
        const result = await runBudgetWebQuotationCloudSync(
            makeSyncOpts({
                updateQuotation: update,
                remoteOnSecondRead: changed,
                alertFn: (m) => alerts.push(m),
            }),
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('remote_changed_since_baseline');
        expect(update).not.toHaveBeenCalled();
        expect(alerts[0]).toMatch(/同步已中止/);
    });

    function secondReadSameTimestamp(patchItems) {
        return {
            ...baseRemote,
            last_updated: baseRemote.last_updated,
            context: {
                ...baseRemote.context,
                items: patchItems,
            },
        };
    }

    it.each([
        ['名稱', [{ id: 'R1', name: '工項已改名', qty: '1', unit: '式', completion_percent: 5 }]],
        ['單價', [{ id: 'R1', name: '工項', qty: '1', unit: '式', price: '999', completion_percent: 5 }]],
        ['進度', [{ id: 'R1', name: '工項', qty: '1', unit: '式', completion_percent: 88 }]],
        [
            '筆數',
            [
                { id: 'R1', name: '工項', qty: '1', unit: '式', completion_percent: 5 },
                { id: 'R2', name: '新增', qty: '1', unit: '式' },
            ],
        ],
    ])('寫回前重讀僅雲端工項%s變動（last_updated 相同）則中止', async (_label, items) => {
        const update = vi.fn();
        const result = await runBudgetWebQuotationCloudSync(
            makeSyncOpts({
                updateQuotation: update,
                remoteOnSecondRead: secondReadSameTimestamp(items),
            }),
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('remote_changed_since_baseline');
        expect(update).not.toHaveBeenCalled();
    });

    it('lpPreview 模式禁止正式同步', async () => {
        const update = vi.fn();
        const result = await runBudgetWebQuotationCloudSync(
            makeSyncOpts({
                allowProductionSync: false,
                updateQuotation: update,
            }),
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('preview_mode');
        expect(update).not.toHaveBeenCalled();
    });

    it('雲端獨有 >10% 時第二次確認拒絕則不寫入', async () => {
        const update = vi.fn();
        const local = Array.from({ length: 10 }, (_, i) => ({
            id: `ITEM_0818_${i + 1}`,
            name: `工${i}`,
            spec: `s${i}`,
            unit: '式',
            sheet_source: '0818',
        }));
        const remoteItems = [
            ...Array.from({ length: 10 }, (_, i) => ({
                id: `ITEM_${i + 1}`,
                name: `工${i}`,
                spec: `s${i}`,
                unit: '式',
                sheet_source: '0818',
            })),
            { id: 'ONLY_A', name: '雲端A', spec: 'a', unit: '式' },
            { id: 'ONLY_B', name: '雲端B', spec: 'b', unit: '式' },
        ];
        let confirmCalls = 0;
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P778',
            localItems: local,
            allowProductionSync: true,
            localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck(local),
            readQuotationSnapshot: async () => ({
                exists: () => true,
                val: () => ({
                    last_updated: 't0',
                    context: { items: remoteItems, total_summary: { siteName: 'x' } },
                }),
            }),
            updateQuotation: update,
            confirmFn: () => {
                confirmCalls += 1;
                return confirmCalls === 1;
            },
            confirmInflationFn: () => false,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('inflation_warning_declined');
        expect(update).not.toHaveBeenCalled();
    });

    it('100 筆舊 id 對應後寫入 payload 仍 100 筆', async () => {
        const update = vi.fn();
        const n = 100;
        const local = Array.from({ length: n }, (_, i) => ({
            id: `ITEM_0818_${i + 1}`,
            name: `合成工項${i + 1}`,
            spec: `規格${i + 1}`,
            unit: '式',
            sheet_source: '0818',
        }));
        const remoteItems = Array.from({ length: n }, (_, i) => ({
            id: `ITEM_${i + 1}`,
            name: `合成工項${i + 1}`,
            spec: `規格${i + 1}`,
            unit: '式',
            sheet_source: '0818',
            completion_percent: 0,
        }));
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P100',
            localItems: local,
            allowProductionSync: true,
            localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck(local),
            readQuotationSnapshot: async () => ({
                exists: () => true,
                val: () => ({
                    last_updated: 't0',
                    context: { items: remoteItems, total_summary: { siteName: 'x' } },
                }),
            }),
            updateQuotation: update,
            confirmFn: () => true,
        });
        expect(result.ok).toBe(true);
        const items = update.mock.calls[0][1]['context/items'];
        expect(items).toHaveLength(100);
    });

    it('本地 id 重複時未通過檢查，不讀雲端', async () => {
        const read = vi.fn();
        const update = vi.fn();
        const localItems = [{ id: 'DUP', name: 'a' }, { id: 'DUP', name: 'b' }];
        const result = await runBudgetWebQuotationCloudSync({
            projectNo: 'P3',
            localItems,
            allowProductionSync: true,
            localIdDuplicateCheck: runLocalQuotationIdDuplicateCheck(localItems),
            readQuotationSnapshot: read,
            updateQuotation: update,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('id_check_failed');
        expect(read).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
});

describe('remoteQuotationSyncBaselineChanged', () => {
    it('last_updated 不同視為變動', () => {
        const baseline = buildRemoteQuotationSyncBaseline(baseRemote);
        const changed = { ...baseRemote, last_updated: 'later' };
        expect(remoteQuotationSyncBaselineChanged(baseline, changed)).toBe(true);
    });
});
