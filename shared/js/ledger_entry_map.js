/**
 * LEDGER-PERM API 前端對照（契約：Backend_GAS
 * `accounting-gas/SPEC/LEDGER_PERM_API.md` @ cursor/acct-sec-11-ledger-history-own-ba72）
 */
var LedgerEntryMap = (function () {
  var LEDGER_VIEW_ALL_MIN_PERMISSION = 5;

  var API = {
    voidAction: 'accounting_ledger_void',
    dupReviewClearAction: 'accounting_ledger_dup_review_clear'
  };

  /** § dup_review tag in 備註／note：`[dup_review:<payload> pending]` */
  var DUP_REVIEW_TAG_RE = /\[dup_review:([^\]]+)\s+pending\]/;

  var ERROR_MESSAGES = {
    LEDGER_DELETE_DISABLED: '不能刪除收支列，請使用「作廢」保留紀錄。',
    LEDGER_VOID_DENIED: '沒有權限作廢這筆記帳。',
    LEDGER_VOID_ALREADY: '這筆已經作廢。',
    LEDGER_ALREADY_VOIDED: '這筆已經作廢。',
    LEDGER_EDIT_DENIED: '沒有權限修改這筆記帳。',
    LEDGER_DUP_REVIEW_CLEAR_DENIED: '僅權限 5 可清除疑重待審標記。',
    LEDGER_NOT_FOUND: '找不到這筆記帳。',
    LEDGER_VIEW_DENIED: '沒有權限查看這筆記帳。',
    LEDGER_PERM_DENIED: '權限不足，無法執行此操作。'
  };

  function recorderUserId(item) {
    if (!item) return '';
    return String(item.recorderUserId || '').trim();
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

  function canEditEntry(session, item, authPermVal) {
    if (!item || isVoided(item)) return false;
    if (isBossPerm(authPermVal)) return true;
    if (item.can_edit === true) return true;
    if (item.can_edit === false) return false;
    return isEntryOwner(session, item);
  }

  function canVoidEntry(session, item, authPermVal) {
    if (!item || isVoided(item)) return false;
    if (item.can_void === false) return false;
    if (isBossPerm(authPermVal)) return true;
    if (item.can_void === true) return true;
    return isEntryOwner(session, item);
  }

  function canDupReviewClear(authPermVal) {
    return isBossPerm(authPermVal);
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
    var item = data.item;
    if (item && isDupReviewPending(item)) return true;
    return false;
  }

  function errorCodeFromResponse(data) {
    if (!data) return '';
    return String(data.error_code || data.code || '').trim();
  }

  function friendlyLedgerError(data, fallback) {
    var code = errorCodeFromResponse(data);
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (data && data.message) return String(data.message);
    return fallback || '操作失敗';
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return item;
    var out = Object.assign({}, item);
    var rid = recorderUserId(item);
    if (rid) out.recorderUserId = rid;
    var dup = parseDupReviewTag(noteText(out));
    if (dup.pending) out._dupReviewPayload = dup.payload;
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

  var exported = {
    API: API,
    DUP_REVIEW_TAG_RE: DUP_REVIEW_TAG_RE,
    ERROR_MESSAGES: ERROR_MESSAGES,
    LEDGER_VIEW_ALL_MIN_PERMISSION: LEDGER_VIEW_ALL_MIN_PERMISSION,
    parseDupReviewTag: parseDupReviewTag,
    recorderUserId: recorderUserId,
    isVoided: isVoided,
    isDupReviewPending: isDupReviewPending,
    sessionUserId: sessionUserId,
    isEntryOwner: isEntryOwner,
    authPerm: authPerm,
    canViewAllLedger: canViewAllLedger,
    canEditEntry: canEditEntry,
    canVoidEntry: canVoidEntry,
    canDupReviewClear: canDupReviewClear,
    computeTotals: computeTotals,
    saveIndicatesDupReviewPending: saveIndicatesDupReviewPending,
    errorCodeFromResponse: errorCodeFromResponse,
    friendlyLedgerError: friendlyLedgerError,
    normalizeItem: normalizeItem,
    locBodyFromItem: locBodyFromItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  return exported;
})();
