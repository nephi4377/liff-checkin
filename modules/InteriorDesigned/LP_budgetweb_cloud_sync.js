/**
 * BudgetWeb 同步雲端前：驗證 id、union 合併、diff 供確認。
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

/** 比對前：本地空價格先補雲端值，避免誇大「變更」 */
export function normalizeLocalItemForDiff(localItem, remoteItem) {
    if (!localItem) return localItem;
    const out = { ...localItem };
    if (!normStr(out.price) && remoteItem && normStr(remoteItem.price)) {
        out.price = remoteItem.price;
    }
    return out;
}

export function buildNameSpecKey(it) {
    if (!it) return '';
    return `${normStr(it.name)}||${normStr(it.spec)}`;
}

/**
 * @param {Array<object>|null|undefined} items
 * @returns {string[]} duplicate ids
 */
export function findDuplicateItemIds(items) {
    const seen = new Set();
    const dups = new Set();
    (items || []).forEach((it) => {
        if (!it?.id) return;
        const id = String(it.id);
        if (seen.has(id)) dups.add(id);
        else seen.add(id);
    });
    return [...dups];
}

/**
 * @param {Array<object>|null|undefined} items
 * @param {'local'|'remote'} side
 */
export function findItemsMissingId(items, side) {
    return (items || [])
        .map((it, index) => ({ it, index }))
        .filter(({ it }) => !it || !normStr(it.id))
        .map(({ index, it }) => ({
            side,
            index,
            name: it?.name || '(無名稱)',
        }));
}

/**
 * @param {Array<object>} localItems
 * @param {Array<object>} remoteItems
 * @returns {string[]} blocking error messages (empty = ok)
 */
export function validateQuotationItemsForSync(localItems, remoteItems) {
    const errors = [];
    const local = localItems || [];
    const remote = remoteItems || [];

    findItemsMissingId(local, 'local').forEach((row) => {
        errors.push(`本地工項第 ${row.index + 1} 筆（${row.name}）缺少 id，無法同步。`);
    });
    findItemsMissingId(remote, 'remote').forEach((row) => {
        errors.push(`雲端工項第 ${row.index + 1} 筆（${row.name}）缺少 id，同步會導致資料遺失，已中止。`);
    });

    const localDups = findDuplicateItemIds(local);
    if (localDups.length) {
        errors.push(`本地工項 id 重複：${localDups.join(', ')}（請修正後再同步）。`);
    }
    const remoteDups = findDuplicateItemIds(remote);
    if (remoteDups.length) {
        errors.push(`雲端工項 id 重複：${remoteDups.join(', ')}（請聯繫開發處理雲端資料）。`);
    }

    return errors;
}

/**
 * @param {Array<object>} localItems
 * @param {Array<object>} remoteItems
 */
export function mergeQuotationItemsById(localItems, remoteItems) {
    const errors = validateQuotationItemsForSync(localItems, remoteItems);
    if (errors.length) {
        throw new Error(errors.join('\n'));
    }

    const byId = new Map();
    (remoteItems || []).forEach((it) => {
        byId.set(String(it.id), { ...it });
    });
    (localItems || []).forEach((it) => {
        const id = String(it.id);
        const prev = byId.get(id);
        byId.set(id, prev ? { ...prev, ...it } : { ...it });
    });
    return Array.from(byId.values());
}

/**
 * 雲端對應列：先 id，再唯一的名稱+規格（備援 ITEM_* 位移）
 * @param {object} localItem
 * @param {Array<object>} remoteItems
 */
export function matchRemoteItemForLocal(localItem, remoteItems) {
    const list = remoteItems || [];
    if (!localItem?.id) return null;
    const byId = list.find((r) => r?.id && String(r.id) === String(localItem.id));
    if (byId) return byId;

    const key = buildNameSpecKey(localItem);
    if (!key || key === '||') return null;
    const matches = list.filter((r) => buildNameSpecKey(r) === key);
    if (matches.length === 1) return matches[0];
    return null;
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

    const remoteMissingId = findItemsMissingId(remote, 'remote');
    const localMissingId = findItemsMissingId(local, 'local');

    const added = local.filter((i) => i?.id && !remoteById.has(String(i.id)));
    const removed = remote.filter((i) => i?.id && !mergedIds.has(String(i.id)));
    const changed = [];
    local.forEach((loc) => {
        if (!loc?.id) return;
        const id = String(loc.id);
        const rem = remoteById.get(id) || matchRemoteItemForLocal(loc, remote);
        if (!rem) return;
        const locNorm = normalizeLocalItemForDiff(loc, rem);
        if (itemSnapshot(rem) !== itemSnapshot(locNorm)) {
            changed.push({ id, before: rem, after: loc });
        }
    });
    const preservedRemoteOnly = remote.filter((i) => i?.id && !localById.has(String(i.id)));

    const blockingErrors = validateQuotationItemsForSync(local, remote);

    return {
        added,
        removed,
        changed,
        preservedRemoteOnly,
        remoteMissingId,
        localMissingId,
        blockingErrors,
        hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
    };
}

/**
 * @param {{ localItems: Array, remoteContext?: { items?: Array } }} input
 */
export function prepareCloudQuotationSync(input) {
    const remoteItems = input?.remoteContext?.items || [];
    const localItems = input?.localItems || [];
    const blockingErrors = validateQuotationItemsForSync(localItems, remoteItems);
    if (blockingErrors.length) {
        return {
            mergedItems: [],
            diff: computeQuotationSyncDiff(remoteItems, localItems, []),
            blockingErrors,
        };
    }
    const mergedItems = mergeQuotationItemsById(localItems, remoteItems);
    const diff = computeQuotationSyncDiff(remoteItems, localItems, mergedItems);
    return { mergedItems, diff, blockingErrors: [] };
}

/**
 * @param {object} params
 * @param {object} params.finalContext — { 案號, total_summary, items }
 * @param {boolean} params.isNewQuotationNode — snapshot.exists() === false
 */
export function buildQuotationFirebaseUpdatePayload(params) {
    const ctx = params.finalContext || {};
    const projectNo = normStr(ctx.案號);
    const payload = {
        'context/items': ctx.items || [],
        'context/total_summary': ctx.total_summary || {},
        last_updated: new Date().toLocaleString(),
        sync_by: 'AI_PREPROCESSOR',
    };
    if (projectNo) payload['context/案號'] = projectNo;
    if (params.isNewQuotationNode) {
        payload['context/siteName'] = ctx.total_summary?.siteName || '載入中...';
    }
    return payload;
}

/**
 * @param {ReturnType<typeof computeQuotationSyncDiff>} diff
 * @returns {string}
 */
export function formatSyncDiffForConfirm(diff) {
    const lines = ['同步前請確認（合併後不會默默刪除僅存在於雲端的工項）：', ''];
    if (diff.blockingErrors?.length) {
        lines.push('【無法同步】');
        diff.blockingErrors.forEach((e) => lines.push(`  ! ${e}`));
        lines.push('');
    }
    if (diff.added.length) {
        lines.push(`【新增 ${diff.added.length} 筆】（本地新工項）`);
        diff.added.slice(0, 15).forEach((i) => lines.push(`  + ${i.id} ${i.name || ''}`));
        if (diff.added.length > 15) lines.push(`  …另有 ${diff.added.length - 15} 筆`);
        lines.push('');
    }
    if (diff.changed.length) {
        lines.push(`【變更 ${diff.changed.length} 筆】（同 id 或名稱+規格對上，內容與雲端不同）`);
        diff.changed.slice(0, 10).forEach((c) => lines.push(`  ~ ${c.id} ${c.before?.name || ''}`));
        if (diff.changed.length > 10) lines.push(`  …另有 ${diff.changed.length - 10} 筆`);
        lines.push('');
    }
    if (diff.removed.length) {
        lines.push(`【警告：將從雲端消失 ${diff.removed.length} 筆】（不應發生，請取消並檢查）`);
        diff.removed.slice(0, 10).forEach((i) => lines.push(`  - ${i.id} ${i.name || ''}`));
        lines.push('');
    }
    if (diff.remoteMissingId?.length) {
        lines.push(`【雲端缺 id ${diff.remoteMissingId.length} 筆】（同步前必須修正）`);
        lines.push('');
    }
    if (diff.preservedRemoteOnly.length) {
        lines.push(`【保留雲端獨有 ${diff.preservedRemoteOnly.length} 筆】（未在本地列表，仍會保留）`);
        lines.push('');
    }
    if (!diff.hasChanges && !diff.preservedRemoteOnly.length && !diff.blockingErrors?.length) {
        lines.push('與雲端工項一致，無新增或變更。');
    }
    lines.push('確定要寫入雲端？');
    return lines.join('\n');
}
