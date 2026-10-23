/**
 * BudgetWeb 同步雲端前：以 id union 合併，保留僅存在於雲端的列，並產生 diff 供確認。
 * 不含 Firebase；由 BudgetWeb 傳入已讀取的 remote context。
 */

const DIFF_FIELDS = ['name', 'spec', 'qty', 'unit', 'price', 'zone', 'category_tag'];

function normStr(v) {
    return String(v == null ? '' : v).trim();
}

function itemSnapshot(it) {
    if (!it) return '';
    return DIFF_FIELDS.map((f) => normStr(it[f])).join('|');
}

/**
 * @param {Array<object>} localItems sanitize 後、將寫入的本地工項
 * @param {Array<object>} remoteItems 雲端既有 context.items
 * @returns {Array<object>} 合併後工項（遠端獨有 id 一律保留；同 id 以本地欄位覆寫）
 */
export function mergeQuotationItemsById(localItems, remoteItems) {
    const byId = new Map();
    (remoteItems || []).forEach((it) => {
        if (!it || !it.id) return;
        byId.set(String(it.id), { ...it });
    });
    (localItems || []).forEach((it) => {
        if (!it || !it.id) return;
        const id = String(it.id);
        const prev = byId.get(id);
        byId.set(id, prev ? { ...prev, ...it } : { ...it });
    });
    return Array.from(byId.values());
}

/**
 * @param {Array<object>} remoteItems
 * @param {Array<object>} localItems
 * @param {Array<object>} mergedItems
 */
export function computeQuotationSyncDiff(remoteItems, localItems, mergedItems) {
    const remote = remoteItems || [];
    const local = localItems || [];
    const merged = mergedItems || [];
    const remoteById = new Map(remote.filter((i) => i?.id).map((i) => [String(i.id), i]));
    const localById = new Map(local.filter((i) => i?.id).map((i) => [String(i.id), i]));
    const mergedIds = new Set(merged.filter((i) => i?.id).map((i) => String(i.id)));

    const added = local.filter((i) => i?.id && !remoteById.has(String(i.id)));
    const removed = remote.filter((i) => i?.id && !mergedIds.has(String(i.id)));
    const changed = [];
    local.forEach((loc) => {
        if (!loc?.id) return;
        const id = String(loc.id);
        const rem = remoteById.get(id);
        if (!rem) return;
        if (itemSnapshot(rem) !== itemSnapshot(loc)) {
            changed.push({ id, before: rem, after: loc });
        }
    });
    const preservedRemoteOnly = remote.filter((i) => i?.id && !localById.has(String(i.id)));

    return {
        added,
        removed,
        changed,
        preservedRemoteOnly,
        hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    };
}

/**
 * @param {{ localItems: Array, remoteContext?: { items?: Array } }} input
 */
export function prepareCloudQuotationSync(input) {
    const remoteItems = input?.remoteContext?.items || [];
    const localItems = input?.localItems || [];
    const mergedItems = mergeQuotationItemsById(localItems, remoteItems);
    const diff = computeQuotationSyncDiff(remoteItems, localItems, mergedItems);
    return { mergedItems, diff };
}

/**
 * @param {ReturnType<typeof computeQuotationSyncDiff>} diff
 * @returns {string}
 */
export function formatSyncDiffForConfirm(diff) {
    const lines = ['同步前請確認（合併後不會默默刪除僅存在於雲端的工項）：', ''];
    if (diff.added.length) {
        lines.push(`【新增 ${diff.added.length} 筆】（本地新工項）`);
        diff.added.slice(0, 15).forEach((i) => lines.push(`  + ${i.id} ${i.name || ''}`));
        if (diff.added.length > 15) lines.push(`  …另有 ${diff.added.length - 15} 筆`);
        lines.push('');
    }
    if (diff.changed.length) {
        lines.push(`【變更 ${diff.changed.length} 筆】（同 id，內容與雲端不同）`);
        diff.changed.slice(0, 10).forEach((c) => lines.push(`  ~ ${c.id} ${c.before?.name || ''}`));
        if (diff.changed.length > 10) lines.push(`  …另有 ${diff.changed.length - 10} 筆`);
        lines.push('');
    }
    if (diff.removed.length) {
        lines.push(`【警告：將從雲端消失 ${diff.removed.length} 筆】（不應發生，請取消並檢查）`);
        diff.removed.slice(0, 10).forEach((i) => lines.push(`  - ${i.id} ${i.name || ''}`));
        lines.push('');
    }
    if (diff.preservedRemoteOnly.length) {
        lines.push(`【保留雲端獨有 ${diff.preservedRemoteOnly.length} 筆】（未在本地列表，仍會保留）`);
        lines.push('');
    }
    if (!diff.hasChanges && !diff.preservedRemoteOnly.length) {
        lines.push('與雲端工項一致，無新增或變更。');
    }
    lines.push('確定要寫入雲端？');
    return lines.join('\n');
}
