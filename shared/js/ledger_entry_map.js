/**
 * LEDGER-PERM API 前端對照（Backend_GAS accounting-gas/SPEC/LEDGER_PERM_API.md）
 */
var LedgerEntryMap = (function () {
  var LEDGER_VIEW_ALL_MIN_PERMISSION = 5;

  var API = {
    voidAction: 'accounting_ledger_void',
    dupReviewClearAction: 'accounting_ledger_dup_review_clear'
  };

  /** Fallback only when API omits duplicate_review_* */
  var DUP_REVIEW_TAG_RE = /\[dup_review:([^\]]+)\s+pending\]/i;

  var ERROR_MESSAGES = {
    LEDGER_PERM_DENIED: '權限不足，無法執行此操作。',
    LEDGER_UNKNOWN_OWNER: '無法確認這筆記帳的記帳人，請聯絡工程師。',
    LEDGER_DELETE_DISABLED: '不能刪除收支列，請使用「作廢」保留紀錄。'
  };

  var LINE_UID_RE = /^U[a-f0-9]{32}$/i;

  function looksLikeLineUserId(value) {
    return LINE_UID_RE.test(String(value || '').trim());
  }

  function recorderUserId(item) {
    if (!item) return '';
    return String(item.recorderUserId || item.recorder_user_id || '').trim();
  }

  function firstDisplayName(item, nameKeys) {
    if (!item || !nameKeys || !nameKeys.length) return '';
    for (var i = 0; i < nameKeys.length; i++) {
      var v = String(item[nameKeys[i]] != null ? item[nameKeys[i]] : '').trim();
      if (!v || looksLikeLineUserId(v)) continue;
      return v;
    }
    return '';
  }

  /** 詳情顯示用；勿露出 LINE UID */
  function displayPersonName(item, nameKeys) {
    var n = firstDisplayName(item, nameKeys);
    return n || '—';
  }

  function voidedByDisplay(item) {
    return displayPersonName(item, ['voided_by_name', 'voided_by_display_name']);
  }

  function recorderDisplay(item) {
    return displayPersonName(item, [
      'recorder_name',
      'recorder_display_name',
      'recorded_by_name',
      'recorded_by_display_name'
    ]);
  }

  function parseDupReviewTag(text) {
    var s = String(text || '');
    var m = s.match(DUP_REVIEW_TAG_RE);
    if (!m) return { pending: false, payload: null, raw: null };
    return { pending: true, payload: String(m[1] || '').trim(), raw: m[0] };
  }

  function noteText(item) {
    if (!item) return '';
    return String(item.note != null ? item.note : '');
  }

  function isVoided(item) {
    if (!item) return false;
    return item.voided === true;
  }

  function isDupReviewPending(item) {
    if (!item) return false;
    if (item.duplicate_review_pending === true) return true;
    var st = String(item.duplicate_review_status || '').trim().toLowerCase();
    if (st === 'pending') return true;
    if (st === 'cleared' || st === '') {
      if (item.duplicate_review_pending === false) return false;
    }
    return parseDupReviewTag(noteText(item)).pending;
  }

  function sessionUserId(session) {
    return String(
      (session && session.auth && session.auth.user_id) ||
      (session && session.profile && session.profile.userId) ||
      ''
    ).trim();
  }

  function isEntryOwner(session, item) {
    var rid = recorderUserId(item);
    var uid = sessionUserId(session);
    if (!rid || !uid) return false;
    return rid === uid;
  }

  function authPerm(session) {
    return Number((session && session.auth && session.auth.permission) || 0);
  }

  function isBossPerm(perm) {
    return Number(perm || 0) >= LEDGER_VIEW_ALL_MIN_PERMISSION;
  }

  function canViewAllLedger(authPermVal) {
    return isBossPerm(authPermVal);
  }

  /** 依伺服器 can_edit（已含 owner／≥5 與非作廢／非 error_flag 規則） */
  function showEditButton(item) {
    if (!item || isVoided(item)) return false;
    if (item.error_flagged) return false;
    return item.can_edit === true;
  }

  function showVoidButton(item) {
    if (!item || isVoided(item)) return false;
    return item.can_void === true;
  }

  function showDupClearButton(item) {
    if (!item || isVoided(item)) return false;
    return item.can_clear_duplicate_review === true;
  }

  function amountForTotal(item) {
    if (isVoided(item)) return 0;
    var n = Number(item && item.amount);
    return isFinite(n) ? n : 0;
  }

  function computeTotals(items) {
    var income = 0;
    var expense = 0;
    (items || []).forEach(function (it) {
      if (isVoided(it)) return;
      var amt = amountForTotal(it);
      var t = String(it.type || '');
      if (t === '收入') income += amt;
      else if (t === '支出') expense += amt;
    });
    return { income: income, expense: expense, net: income - expense };
  }

  function saveIndicatesDupReviewPending(data) {
    if (!data) return false;
    if (data.duplicate_review_pending === true) return true;
    var item = data.item;
    if (item && item.duplicate_review_pending === true) return true;
    if (item && isDupReviewPending(item)) return true;
    return false;
  }

  function errorCodeFromResponse(data) {
    if (!data) return '';
    return String(data.error_code || data.code || '').trim();
  }

  function friendlyLedgerError(data, fallback) {
    var code = errorCodeFromResponse(data);
    if (code && ERROR_MESSAGES[code]) {
      var msg = ERROR_MESSAGES[code];
      if (code === 'LEDGER_DELETE_DISABLED' && data && data.use_void === true) {
        return msg;
      }
      return msg;
    }
    if (data && data.message) return String(data.message);
    return fallback || '操作失敗';
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return item;
    var out = Object.assign({}, item);
    var rid = recorderUserId(item);
    if (rid) {
      out.recorderUserId = rid;
      out.recorder_user_id = item.recorder_user_id != null ? item.recorder_user_id : rid;
    }
    return out;
  }

  function locBodyFromItem(item) {
    var o = {
      sheet: item && item.sheet,
      ingest_id: item && item.ingest_id,
      record_kind: 'ledger'
    };
    var rowVal = item && item.row;
    if (rowVal != null && rowVal !== '' && Number(rowVal) > 0) o.row = rowVal;
    return o;
  }

  function voidRequestBody(item, voidReason) {
    var body = locBodyFromItem(item);
    var reason = String(voidReason || '').trim();
    if (reason) {
      body.void_reason = reason;
      body.reason = reason;
    }
    return body;
  }

  var exported = {
    API: API,
    DUP_REVIEW_TAG_RE: DUP_REVIEW_TAG_RE,
    ERROR_MESSAGES: ERROR_MESSAGES,
    LEDGER_VIEW_ALL_MIN_PERMISSION: LEDGER_VIEW_ALL_MIN_PERMISSION,
    parseDupReviewTag: parseDupReviewTag,
    looksLikeLineUserId: looksLikeLineUserId,
    recorderUserId: recorderUserId,
    displayPersonName: displayPersonName,
    voidedByDisplay: voidedByDisplay,
    recorderDisplay: recorderDisplay,
    isVoided: isVoided,
    isDupReviewPending: isDupReviewPending,
    sessionUserId: sessionUserId,
    isEntryOwner: isEntryOwner,
    authPerm: authPerm,
    canViewAllLedger: canViewAllLedger,
    showEditButton: showEditButton,
    showVoidButton: showVoidButton,
    showDupClearButton: showDupClearButton,
    computeTotals: computeTotals,
    saveIndicatesDupReviewPending: saveIndicatesDupReviewPending,
    errorCodeFromResponse: errorCodeFromResponse,
    friendlyLedgerError: friendlyLedgerError,
    normalizeItem: normalizeItem,
    locBodyFromItem: locBodyFromItem,
    voidRequestBody: voidRequestBody
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  return exported;
})();
