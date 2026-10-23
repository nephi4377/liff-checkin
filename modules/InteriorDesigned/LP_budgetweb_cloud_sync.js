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

/** 舊解析器：ITEM_<純數字>（例 ITEM_6、ITEM_185） */
export function isLegacyRowNumberQuotationItemId(id) {
    return /^ITEM_\d+$/i.test(normStr(id));
}

export function inferSheetTokenFromNewItemId(id) {
    const m = normStr(id).match(/^ITEM_([^_]+)_/i);
    return m ? m[1] : '';
}

function inferDominantLocalSheetToken(localItems) {
    const counts = new Map();
    (localItems || []).forEach((it) => {
        const s = inferSheetTokenFromNewItemId(it?.id) || normStr(it.sheet_source);
        if (!s) return;
        counts.set(s, (counts.get(s) || 0) + 1);
    });
    let best = '';
    let max = 0;
    counts.forEach((c, s) => {
        if (c > max) {
            max = c;
            best = s;
        }
    });
    return best;
}

/**
 * 表名＋名稱＋規格＋單位（舊雲端 778／0818 對新 ITEM_0818_*）
 * @param {object} item
 * @param {string} [sheetFallback]
 */
export function buildLegacyQuotationMatchKey(item, sheetFallback = '') {
    const sheet = normStr(
        item?.sheet_source
            || item?.sheet
            || item?.sheetName
            || sheetFallback
            || inferSheetTokenFromNewItemId(item?.id),
    );
    return `${sheet}\u0001${normStr(item?.name)}\u0001${normStr(item?.spec)}\u0001${normStr(item?.unit)}`;
}

/**
 * @param {Array<object>} localItems
 * @param {Array<object>} remoteItems
 */
export function planLegacyQuotationIdRemap(localItems, remoteItems) {
    const locals = localItems || [];
    const remotes = remoteItems || [];
    const legacyRemotes = remotes.filter((r) => r?.id && isLegacyRowNumberQuotationItemId(r.id));
    if (!legacyRemotes.length) {
        return {
            active: false,
            effectiveRemote: remotes,
            matched: [],
            unmapped: [],
            ambiguous: [],
            blockingErrors: [],
            progressByLocalId: new Map(),
            sheetFallback: '',
        };
    }

    const sheetFallback = inferDominantLocalSheetToken(locals);
    const localByKey = new Map();
    locals.forEach((loc) => {
        const key = buildLegacyQuotationMatchKey(loc, sheetFallback);
        if (!normStr(loc?.name)) return;
        if (!localByKey.has(key)) localByKey.set(key, []);
        localByKey.get(key).push(loc);
    });

    const effectiveRemote = [];
    const matched = [];
    const unmapped = [];
    const ambiguous = [];
    /** @type {Map<string, object>} */
    const progressByLocalId = new Map();

    remotes.forEach((rem) => {
        if (!rem?.id || !isLegacyRowNumberQuotationItemId(rem.id)) {
            effectiveRemote.push(rem);
            return;
        }
        const key = buildLegacyQuotationMatchKey(rem, sheetFallback);
        const candidates = localByKey.get(key) || [];
        if (candidates.length === 1) {
            const localId = String(candidates[0].id);
            matched.push({ legacyId: String(rem.id), localId, name: rem.name || '' });
            progressByLocalId.set(localId, rem);
            effectiveRemote.push({ ...rem, id: localId });
        } else if (candidates.length > 1) {
            ambiguous.push({
                legacyId: String(rem.id),
                name: rem.name || '',
                localIds: candidates.map((c) => String(c.id)),
            });
        } else {
            unmapped.push({ legacyId: String(rem.id), name: rem.name || '' });
        }
    });

    const blockingErrors = [];
    if (ambiguous.length) {
        blockingErrors.push(
            `舊版 id 對應衝突（一對多）共 ${ambiguous.length} 筆，整次同步已中止；例：${ambiguous[0].legacyId} ↔ ${ambiguous[0].localIds.join(', ')}`,
        );
    }
    if (unmapped.length) {
        blockingErrors.push(
            `舊版 id 無法對應本地新 id 共 ${unmapped.length} 筆，整次同步已中止（不會部分寫入）；例：${unmapped[0].legacyId} ${unmapped[0].name}`,
        );
    }

    return {
        active: true,
        effectiveRemote,
        matched,
        unmapped,
        ambiguous,
        blockingErrors,
        progressByLocalId,
        sheetFallback,
    };
}

/** @param {number} localCount @param {number} preservedRemoteOnlyCount */
export function shouldSuggestCancelRemoteInflation(localCount, preservedRemoteOnlyCount) {
    if (!localCount || localCount <= 0) return false;
    return preservedRemoteOnlyCount / localCount > 0.1;
}

/**
 * @param {Array<object>|null|undefined} items
 * @returns {string[]} duplicate ids
 */
/**
 * 同步前 id 檢查（等同 check-quotation-duplicate-ids，不 migrate）
 * @param {Array<object>} localItems
 */
export function fingerprintLocalItemsForSyncCheck(localItems) {
    return (localItems || [])
        .map((it, index) => {
            const id = normStr(it?.id);
            return id ? id : `__missing@${index}`;
        })
        .join('|');
}

export function runLocalQuotationIdDuplicateCheck(localItems) {
    const missing = findItemsMissingId(localItems, 'local');
    const duplicateIds = findDuplicateItemIds(localItems);
    const fingerprint = fingerprintLocalItemsForSyncCheck(localItems);
    const ok = missing.length === 0 && duplicateIds.length === 0;
    let message = '工項 id 檢查通過，可進行同步前確認。';
    if (!ok) {
        const parts = [];
        if (duplicateIds.length) parts.push(`重複 id：${duplicateIds.join(', ')}`);
        if (missing.length) {
            parts.push(
                `缺 id：${missing.map((r) => `第 ${r.index + 1} 筆 ${r.name}`).join('；')}`,
            );
        }
        message = `工項 id 檢查未通過（請修正後再同步，勿自動 migrate）：\n${parts.join('\n')}`;
    }
    return { ok, fingerprint, duplicateIds, missingRows: missing, message };
}

/**
 * 寫回前重讀比對：雲端 items 進度指紋 + last_updated
 * @param {object|null} existingData quotations/{projectNo} 節點
 */
/** FNV-1a 32-bit（瀏覽器／Node 共用，無 crypto 依賴） */
export function stableHashString(input) {
    const s = String(input ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * 寫回安全閘：單筆工項完整欄位（穩定排序前正規化）
 * @param {object} it
 */
export function normalizeItemForRemoteSyncGuard(it) {
    if (!it?.id || !normStr(it.id)) return null;
    const v = it.verification?.is_ok;
    return {
        id: normStr(it.id),
        name: normStr(it.name),
        spec: normStr(it.spec),
        qty: normStr(it.qty),
        unit: normStr(it.unit),
        price: normStr(it.price),
        zone: normStr(it.zone),
        category_tag: normStr(it.category_tag),
        completion_percent:
            it.completion_percent === undefined || it.completion_percent === null
                ? null
                : Number(it.completion_percent),
        verification_is_ok: v === true ? true : v === false ? false : null,
    };
}

/**
 * 整份 items 內容 hash（id 排序後 JSON，含名稱／單價／數量／進度等）
 * @param {Array<object>} items
 */
export function fingerprintRemoteItemsForSyncGuard(items) {
    const normalized = (items || [])
        .map(normalizeItemForRemoteSyncGuard)
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id, 'en'));
    return stableHashString(JSON.stringify(normalized));
}

/**
 * 舊 RTDB 形狀：工項／摘要可能在節點根層（無 context 包裝），僅 total_summary 亦視為有效節點。
 * @param {object|null|undefined} nodeVal quotations/{案號} 整包
 * @returns {object|null} 標準形狀（含 context）或 null
 */
export function normalizeQuotationFirebaseSnapshot(nodeVal) {
    if (!nodeVal || typeof nodeVal !== 'object') return null;
    if (nodeVal.context && typeof nodeVal.context === 'object') {
        return nodeVal;
    }
    const hasLegacyShape =
        nodeVal.total_summary != null
        || Array.isArray(nodeVal.items)
        || normStr(nodeVal.案號);
    if (!hasLegacyShape) return null;
    const {
        total_summary,
        items,
        案號,
        is_closed,
        closed_at,
        closed_by,
        audit_last_updated,
        last_updated,
        sync_by,
        ...metaRest
    } = nodeVal;
    return {
        ...metaRest,
        audit_last_updated: audit_last_updated ?? last_updated ?? null,
        last_updated: last_updated ?? audit_last_updated ?? null,
        sync_by,
        is_closed: is_closed ?? undefined,
        closed_at: closed_at ?? undefined,
        closed_by: closed_by ?? undefined,
        context: {
            total_summary: total_summary || {},
            items: Array.isArray(items) ? items : [],
            ...(normStr(案號) ? { 案號: normStr(案號) } : {}),
            ...(is_closed != null ? { is_closed } : {}),
            ...(closed_at != null ? { closed_at } : {}),
            ...(closed_by != null ? { closed_by } : {}),
        },
    };
}

export function buildRemoteQuotationSyncBaseline(existingData) {
    const isNewQuotationNode = !existingData;
    const normalized = existingData ? normalizeQuotationFirebaseSnapshot(existingData) : null;
    const node = normalized || existingData;
    const remoteContext = node?.context || null;
    const remoteItems = remoteContext?.items || [];
    return {
        isNewQuotationNode,
        auditLastUpdated: node?.audit_last_updated ?? null,
        quotationLastUpdated: node?.last_updated ?? null,
        itemCount: remoteItems.length,
        itemsContentHash: fingerprintRemoteItemsForSyncGuard(remoteItems),
    };
}

/**
 * @param {ReturnType<typeof buildRemoteQuotationSyncBaseline>} baseline
 * @param {object|null} freshExistingData
 */
export function remoteQuotationSyncBaselineChanged(baseline, freshExistingData) {
    const freshExists = Boolean(freshExistingData);
    if (baseline.isNewQuotationNode) {
        return freshExists;
    }
    if (!freshExists) {
        return true;
    }
    const fresh = buildRemoteQuotationSyncBaseline(freshExistingData);
    return (
        fresh.auditLastUpdated !== baseline.auditLastUpdated
        || fresh.quotationLastUpdated !== baseline.quotationLastUpdated
        || fresh.itemsContentHash !== baseline.itemsContentHash
        || fresh.itemCount !== baseline.itemCount
    );
}

/** 雲端節點已存在但無法建立寫回 baseline 時應阻擋寫入 */
export function shouldBlockQuotationWriteWithoutBaseline(remoteNodeExists, baseline) {
    return Boolean(remoteNodeExists) && !baseline;
}

export function formatRemoteChangedAbortMessage() {
    return (
        '雲端報價資料在您確認後已變更（last_updated 或工項完整內容與開始同步時的快照不同）。\n' +
        '為避免覆蓋他人更新，同步已中止。\n' +
        '請重新載入雲端資料、再次檢查 id 後再同步。'
    );
}

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
 * 僅完全相同 id（進度／驗收不得走名稱備援）
 * @param {object} localItem
 * @param {Array<object>} remoteItems
 */
export function matchRemoteItemByExactId(localItem, remoteItems) {
    if (!localItem?.id) return null;
    return (remoteItems || []).find((r) => r?.id && String(r.id) === String(localItem.id)) || null;
}

/**
 * 確認視窗用：本地 id 在雲端找不到，但名稱+規格有候選（不套用進度）
 */
export function findNameSpecHintsForSync(localItems, remoteItems) {
    const remote = remoteItems || [];
    const remoteById = new Map(remote.filter((i) => i?.id).map((i) => [String(i.id), i]));
    const hints = [];

    (localItems || []).forEach((loc) => {
        if (!loc?.id || remoteById.has(String(loc.id))) return;
        const key = buildNameSpecKey(loc);
        if (!key || key === '||') return;
        const matches = remote.filter((r) => buildNameSpecKey(r) === key);
        if (!matches.length) return;
        hints.push({
            localId: String(loc.id),
            localName: loc.name || '',
            candidates: matches.map((m) => ({ id: m.id, name: m.name || '' })),
        });
    });
    return hints;
}

/**
 * @param {Array<object>} mergedItems
 * @param {Array<object>} remoteItems
 */
export function applyRemoteProgressByExactId(mergedItems, remoteItems, legacyPlan = null) {
    const remote = remoteItems || [];
    return (mergedItems || []).map((newItem) => {
        let oldMatch = matchRemoteItemByExactId(newItem, remote);
        if (!oldMatch && legacyPlan?.active && legacyPlan.progressByLocalId) {
            oldMatch = legacyPlan.progressByLocalId.get(String(newItem.id)) || null;
        }
        if (!oldMatch) return { ...newItem };
        const out = { ...newItem };
        out.completion_percent = oldMatch.completion_percent ?? out.completion_percent ?? 0;
        out.verification = oldMatch.verification || out.verification || { is_ok: false };
        out.status =
            out.completion_percent === 100 ? 'DONE' : out.completion_percent > 0 ? 'PROCESS' : 'PENDING';
        if (!normStr(out.price) && normStr(oldMatch.price)) out.price = oldMatch.price;
        return out;
    });
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
        const rem = remoteById.get(id);
        if (!rem) return;
        const locNorm = normalizeLocalItemForDiff(loc, rem);
        if (itemSnapshot(rem) !== itemSnapshot(locNorm)) {
            changed.push({ id, before: rem, after: loc });
        }
    });
    const preservedRemoteOnly = merged.filter((i) => i?.id && !localById.has(String(i.id)));

    const blockingErrors = validateQuotationItemsForSync(local, remote);

    const suggestCancelInflation = shouldSuggestCancelRemoteInflation(
        local.length,
        preservedRemoteOnly.length,
    );

    return {
        added,
        removed,
        changed,
        preservedRemoteOnly,
        remoteMissingId,
        localMissingId,
        blockingErrors,
        hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
        suggestCancelInflation,
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
            legacyRemap: null,
        };
    }

    const legacyRemap = planLegacyQuotationIdRemap(localItems, remoteItems);
    if (legacyRemap.blockingErrors.length) {
        return {
            mergedItems: [],
            diff: computeQuotationSyncDiff(remoteItems, localItems, []),
            blockingErrors: legacyRemap.blockingErrors,
            legacyRemap,
        };
    }

    const mergedItems = mergeQuotationItemsById(localItems, legacyRemap.effectiveRemote);
    const diff = computeQuotationSyncDiff(remoteItems, localItems, mergedItems);
    diff.legacyRemap = legacyRemap;
    if (legacyRemap.active && legacyRemap.matched?.length) {
        const legacyIdsRemapped = new Set(legacyRemap.matched.map((m) => String(m.legacyId)));
        diff.removed = diff.removed.filter((r) => !legacyIdsRemapped.has(String(r.id)));
        diff.hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
    }
    return { mergedItems, diff, blockingErrors: [], legacyRemap };
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
export function formatSyncDiffForConfirm(diff, nameSpecHints = []) {
    const lines = ['同步前請確認：', ''];
    if (diff.suggestCancelInflation) {
        lines.push(
            '【強烈建議按「取消」】同步後「雲端獨有」工項超過本地 10%，可能造成筆數膨脹或重複。',
        );
        lines.push('僅在已核對舊版 id 對應與下列清單後，才按「確定」繼續。');
        lines.push('');
    }
    if (diff.legacyRemap?.active && diff.legacyRemap.matched?.length) {
        lines.push(`【舊版 ITEM_<列號> 已對應新 id：${diff.legacyRemap.matched.length} 筆】（表名+名稱+規格+單位，進度將帶入）`);
        diff.legacyRemap.matched.slice(0, 12).forEach((m) => {
            lines.push(`  ↔ ${m.legacyId} → ${m.localId} ${m.name || ''}`);
        });
        if (diff.legacyRemap.matched.length > 12) {
            lines.push(`  …另有 ${diff.legacyRemap.matched.length - 12} 筆`);
        }
        lines.push('');
    }
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
    if (nameSpecHints.length) {
        lines.push(`【提示：名稱+規格相似但 id 不同 ${nameSpecHints.length} 筆】（不會自動帶入驗收進度）`);
        nameSpecHints.slice(0, 8).forEach((h) => {
            const cand = h.candidates.map((c) => c.id).join(', ');
            lines.push(`  ? 本地 ${h.localId} ${h.localName} ↔ 雲端候選: ${cand}`);
        });
        if (nameSpecHints.length > 8) lines.push(`  …另有 ${nameSpecHints.length - 8} 筆`);
        lines.push('');
    }
    const remoteCount = (diff.preservedRemoteOnly?.length || 0) + (diff.changed?.length || 0);
    const denom = remoteCount > 0 ? remoteCount : diff.changed.length;
    if (denom > 0 && diff.changed.length / denom > 0.5) {
        lines.push(
            '【警示】變更筆數超過雲端工項一半，可能曾發生 id 位移或大量覆寫，請仔細核對後再同步。',
        );
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
    if (diff.remoteMissingId?.length) {
        lines.push(`【雲端缺 id ${diff.remoteMissingId.length} 筆】（同步前必須修正）`);
        lines.push('');
    }
    if (diff.preservedRemoteOnly.length) {
        lines.push(`【保留雲端獨有 ${diff.preservedRemoteOnly.length} 筆】（未在本地列表；非舊版 id 對應者）`);
        diff.preservedRemoteOnly.slice(0, 15).forEach((i) => lines.push(`  · ${i.id} ${i.name || ''}`));
        if (diff.preservedRemoteOnly.length > 15) {
            lines.push(`  …另有 ${diff.preservedRemoteOnly.length - 15} 筆`);
        }
        lines.push('');
    }
    if (!diff.hasChanges && !diff.preservedRemoteOnly.length && !diff.blockingErrors?.length) {
        lines.push('與雲端工項一致，無新增或變更。');
    }
    lines.push('確定要寫入雲端？');
    return lines.join('\n');
}
