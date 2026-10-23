/**
 * BudgetWeb「同步至雲端」可測流程（不含真實 Firebase SDK）
 */

import {
    prepareCloudQuotationSync,
    formatSyncDiffForConfirm,
    buildQuotationFirebaseUpdatePayload,
    applyRemoteProgressByExactId,
    findNameSpecHintsForSync,
    buildRemoteQuotationSyncBaseline,
    remoteQuotationSyncBaselineChanged,
    formatRemoteChangedAbortMessage,
    fingerprintLocalItemsForSyncCheck,
    runLocalQuotationIdDuplicateCheck,
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

    if (opts.allowProductionSync === false) {
        alertFn(
            '預覽模式（lpPreview=1）禁止正式「同步至雲端」。\n請使用正式站 BudgetWeb，並完成工項 id 檢查後再同步。',
        );
        return { ok: false, reason: 'preview_mode' };
    }

    const localItems = opts.localItems || [];
    const idCheck =
        opts.localIdDuplicateCheck || runLocalQuotationIdDuplicateCheck(localItems);
    if (
        !idCheck.ok
        || idCheck.fingerprint !== fingerprintLocalItemsForSyncCheck(localItems)
    ) {
        alertFn(idCheck.message || '同步前請先執行工項 id 檢查並修正問題。');
        return { ok: false, reason: 'id_check_failed', idCheck };
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
    const remoteBaseline = buildRemoteQuotationSyncBaseline(existingData);

    const { mergedItems, diff, blockingErrors } = prepareCloudQuotationSync({
        localItems,
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

    const hints = findNameSpecHintsForSync(localItems, remoteItems);
    const confirmText = formatSyncDiffForConfirm(diff, hints);
    if (diff.hasChanges || diff.preservedRemoteOnly.length > 0 || hints.length) {
        if (!confirmFn(confirmText)) {
            return { ok: false, reason: 'user_cancelled' };
        }
    }

    let freshSnapshot;
    try {
        freshSnapshot = await opts.readQuotationSnapshot(`quotations/${projectNo}`);
    } catch (readErr) {
        alertFn(`寫回前重讀雲端失敗，同步已中止（未寫入）。\n${readErr?.message || readErr}`);
        return { ok: false, reason: 'reread_failed', error: readErr };
    }
    const freshExists = freshSnapshot.exists();
    const freshData = freshExists ? freshSnapshot.val() : null;
    if (remoteQuotationSyncBaselineChanged(remoteBaseline, freshData)) {
        alertFn(formatRemoteChangedAbortMessage());
        return { ok: false, reason: 'remote_changed_since_baseline' };
    }

    const freshRemoteItems = freshData?.context?.items || remoteItems;
    const exportItems = applyRemoteProgressByExactId(mergedItems, freshRemoteItems);

    const finalExport = {
        案號: projectNo,
        total_summary: {
            ...(opts.totalSummary || {}),
            siteName: freshData?.context?.total_summary?.siteName
                || remoteContext?.total_summary?.siteName
                || '載入中...',
            overall_completion:
                Math.round(
                    exportItems.reduce((acc, cur) => acc + (cur.completion_percent || 0), 0) / exportItems.length,
                ) || 0,
        },
        items: exportItems,
    };

    const updatePayload = buildQuotationFirebaseUpdatePayload({
        finalContext: finalExport,
        isNewQuotationNode: !freshExists,
    });

    await opts.updateQuotation(`quotations/${projectNo}`, updatePayload);

    return { ok: true, updatePayload, exportItems, isNewQuotationNode };
}
