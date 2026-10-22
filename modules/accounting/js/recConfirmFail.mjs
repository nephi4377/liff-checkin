/**
 * 客人按①②確認收款時的人話失敗句。
 * 網路失敗／後端狀態對不上時，不要露出工程用語，也不要讓人以為已經記下。
 */
var FALLBACK = '這次沒送到，還沒幫您記下確認。請再按一次。這不代表款項有問題。';

function rawMessage(errOrMsg) {
  if (typeof errOrMsg === 'string') return errOrMsg;
  if (errOrMsg && errOrMsg.message) return String(errOrMsg.message);
  return '';
}

export function humanReceiptConfirmFail(errOrMsg) {
  var msg = rawMessage(errOrMsg) || FALLBACK;
  if (/Failed to fetch|NetworkError|Load failed|Network request failed|連線逾時|abort/i.test(msg)) {
    return FALLBACK;
  }
  if (/找不到收款/.test(msg)) {
    return '找不到這一筆收款，請重新整理後再看。還沒幫您記下確認。';
  }
  if (/無權存取/.test(msg)) {
    return '這一筆不屬於您目前的案件，請重新整理。還沒幫您記下確認。';
  }
  if (/目前狀態無法第一階段/.test(msg)) {
    return '這一筆現在不能做第一次確認，可能已經確認過。請重新整理看最新狀態。';
  }
  if (/請先完成第一階段/.test(msg)) {
    return '請先按「確認此收款紀錄」，或重新整理看最新狀態。還沒幫您記下最終確認。';
  }
  if (/驗證失敗|請用 LINE|LIFF/.test(msg)) {
    return '身分暫時確認不到，請重新登入 LINE 再試。還沒幫您記下確認。';
  }
  if (/員工預覽/.test(msg)) {
    return '員工預覽不能代客人確認。請客人用自己的 LINE 打開。';
  }
  return msg;
}

export var RECEIPT_CONFIRM_FAIL_FALLBACK = FALLBACK;

if (typeof window !== 'undefined') {
  window.RecConfirmFail = {
    humanReceiptConfirmFail: humanReceiptConfirmFail,
    FALLBACK: FALLBACK
  };
}
