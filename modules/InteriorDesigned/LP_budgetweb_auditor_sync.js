/**
 * BudgetAuditor V2 雲端寫入閘（與 HTML 實際路徑一致，可單測）
 */
import {
    shouldBlockQuotationWriteWithoutBaseline,
    buildRemoteQuotationSyncBaseline,
    remoteQuotationSyncBaselineChanged,
    normalizeQuotationFirebaseSnapshot,
} from './LP_budgetweb_cloud_sync.js';

export { shouldBlockQuotationWriteWithoutBaseline, normalizeQuotationFirebaseSnapshot };

export const AUDITOR_MISSING_BASELINE_MESSAGE =
    '無法建立雲端安全基線（模組載入失敗或僅本地快取）。請重新從雲端載入案場後再同步。';

export const AUDITOR_REMOTE_CHANGED_MESSAGE =
    '雲端資料已變更（與載入時不同），同步已中止。請重新載入案場。';

/**
 * @param {{ remoteExists: boolean, baseline: object|null, freshVal?: object|null }} input
 * @returns {{ blocked: boolean, reason?: string, message?: string }}
 */
export function resolveAuditorFirebaseWriteGate(input) {
    const remoteExists = Boolean(input.remoteExists);
    const baseline = input.baseline;
    if (shouldBlockQuotationWriteWithoutBaseline(remoteExists, baseline)) {
        return { blocked: true, reason: 'missing_baseline', message: AUDITOR_MISSING_BASELINE_MESSAGE };
    }
    if (remoteExists && baseline && input.freshVal) {
        const normalized =
            normalizeQuotationFirebaseSnapshot(input.freshVal) || input.freshVal;
        if (remoteQuotationSyncBaselineChanged(baseline, normalized)) {
            return { blocked: true, reason: 'remote_changed', message: AUDITOR_REMOTE_CHANGED_MESSAGE };
        }
    }
    return { blocked: false };
}

/** 雲端載入後建立 baseline（舊格式僅 total_summary 亦可） */
export function buildAuditorCloudWriteBaselineFromFirebaseNode(nodeVal) {
    const normalized = normalizeQuotationFirebaseSnapshot(nodeVal);
    if (!normalized) return null;
    return buildRemoteQuotationSyncBaseline(normalized);
}

/**
 * 寫入後 baseline：payload 的 audit_last_updated + 寫入前雲端既有的 last_updated（Auditor 不覆寫）
 * @param {{ audit_last_updated?: string, context?: object, is_closed?: boolean, closed_at?: *, closed_by?: * }} payload
 * @param {object|null} [priorRemoteNodeVal] 寫入前 `snap.val()`，保留 quotation last_updated
 */
export function buildAuditorCloudWriteBaselineAfterPayload(payload, priorRemoteNodeVal = null) {
    if (!payload?.context) return null;
    const prior =
        priorRemoteNodeVal && typeof priorRemoteNodeVal === 'object' ? priorRemoteNodeVal : null;
    return buildRemoteQuotationSyncBaseline({
        audit_last_updated: payload.audit_last_updated ?? null,
        last_updated: prior?.last_updated ?? null,
        context: payload.context,
        is_closed: payload.is_closed,
        closed_at: payload.closed_at,
        closed_by: payload.closed_by,
    });
}
