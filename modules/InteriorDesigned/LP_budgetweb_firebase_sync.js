/**
 * BudgetWeb「同步至雲端」可測流程（不含真實 Firebase SDK）
 */

import {
    prepareCloudQuotationSync,
    formatSyncDiffForConfirm,
    buildQuotationFirebaseUpdatePayload,
    applyRemoteProgressByExactId,
    findNameSpecHintsForSync,
} from './LP_budgetweb_cloud_sync.js';

/**
 * @param {object} opts
 * @param {string} opts.projectNo
 * @param {Array<object>} opts.localItems
 * @param {(path: string) => Promise<{ exists: () => boolean, val: () => any }>} opts.readQuotationSnapshot
 * @param {(path: string, payload: object) => Promise<void>} opts.updateQuotation
 * @param {() => boolean} [opts.confirmFn]
 * @param {(msg: string) => void} [opts.alertFn]
 */
export async function runBudgetWebQuotationCloudSync(opts) {
    const alertFn = opts.alertFn || (() => {});
    const confirmFn = opts.confirmFn || (() => true);
    const projectNo = String(opts.projectNo || '').trim();
    if (!projectNo) {
        return { ok: false, reason: 'missing_project_no' };
    }

    let snapshot;
    try {
        snapshot = await opts.readQuotationSnapshot(`quotations/${projectNo}`);
    } catch (readErr) {
        alertFn(`無法讀取雲端報價資料，同步已中止（未寫入）。\n${readErr?.message || readErr}`);
        return { ok: false, reason: 'read_failed', error: readErr };
    }

    const isNewQuotationNode = !snapshot.exists();
    const existingData = isNewQuotationNode ? null : snapshot.val();
    const remoteContext = existingData?.context || null;
    const remoteItems = remoteContext?.items || [];

    const { mergedItems, diff, blockingErrors } = prepareCloudQuotationSync({
        localItems: opts.localItems || [],
        remoteContext,
    });

    if (blockingErrors?.length) {
        alertFn(`同步已中止：\n${blockingErrors.join('\n')}`);
        return { ok: false, reason: 'blocking_validation', blockingErrors };
    }

    if (diff.removed.length > 0) {
        alertFn(`合併結果將刪除雲端工項，已中止。\n${diff.removed.map((i) => i.id).join(', ')}`);
        return { ok: false, reason: 'would_remove_remote' };
    }

    const hints = findNameSpecHintsForSync(opts.localItems || [], remoteItems);
    const confirmText = formatSyncDiffForConfirm(diff, hints);
    if (diff.hasChanges || diff.preservedRemoteOnly.length > 0 || hints.length) {
        if (!confirmFn(confirmText)) {
            return { ok: false, reason: 'user_cancelled' };
        }
    }

    const exportItems = applyRemoteProgressByExactId(mergedItems, remoteItems);

    const finalExport = {
        案號: projectNo,
        total_summary: {
            ...(opts.totalSummary || {}),
            siteName: remoteContext?.total_summary?.siteName || '載入中...',
            overall_completion:
                Math.round(
                    exportItems.reduce((acc, cur) => acc + (cur.completion_percent || 0), 0) / exportItems.length,
                ) || 0,
        },
        items: exportItems,
    };

    const updatePayload = buildQuotationFirebaseUpdatePayload({
        finalContext: finalExport,
        isNewQuotationNode,
    });

    await opts.updateQuotation(`quotations/${projectNo}`, updatePayload);

    return { ok: true, updatePayload, exportItems, isNewQuotationNode };
}
