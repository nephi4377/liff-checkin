/**
 * 客人施工進度：載入成功／真的沒紀錄／讀失敗要分開。
 * 失敗不可畫成「尚無已發布紀錄」或「尚無同步資料」。
 */

export function messageFromErr(errOrMsg) {
  if (typeof errOrMsg === 'string') return errOrMsg;
  if (errOrMsg && errOrMsg.message) return String(errOrMsg.message);
  return '';
}

export function humanNetworkFail(errOrMsg, fallback) {
  const fallbackText = fallback || '暫時連不上，請再試一次';
  const failMsg = messageFromErr(errOrMsg) || fallbackText;
  if (
    /Failed to fetch|NetworkError|Load failed|Network request failed|Unexpected token|JSON/i.test(
      failMsg
    )
  ) {
    return fallbackText;
  }
  return failMsg;
}

export function humanLogsFail(errOrMsg) {
  return humanNetworkFail(errOrMsg, '施工紀錄暫時載入不到，請再試一次');
}

export function humanAuditFail(errOrMsg) {
  return humanNetworkFail(errOrMsg, '施工項目暫時載入不到，請再試一次');
}

/** @returns {'fail'|'empty'|'ok'} */
export function logsViewState(fetchOk, logCount) {
  if (!fetchOk) return 'fail';
  if (!logCount) return 'empty';
  return 'ok';
}

/** @returns {'fail'|'empty'|'ok'} */
export function auditViewState(fetchOk, hasSheetSignal) {
  if (!fetchOk) return 'fail';
  if (!hasSheetSignal) return 'empty';
  return 'ok';
}

export async function retryOnce(fn) {
  try {
    return await fn();
  } catch (_) {
    return await fn();
  }
}
