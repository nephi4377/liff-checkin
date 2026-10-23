/**
 * LEDGER-PERM-2：收支列欄位與後端契約對照（Backend_GAS #218）。
 * 若 #218 定稿欄位名不同，只改此檔即可對齊。
 *
 * API 假設（待與 #218 核對）：
 * - 作廢：action accounting_ledger_void；可選 void_reason／reason
 * - 疑重待審：列上 duplicate_review_pending（或 dup_review_pending／pending_duplicate_review）
 * - 疑重審核：action accounting_ledger_duplicate_review；review_decision = confirm | clear
 * - 記帳人：recorderUserId（備援 recorder_user_id／recorded_by_user_id）
 * - 作廢狀態：voided／is_voided／status=void／voided_at
 * - 查全部人：session.auth.permission ≥ 5（LEDGER_VIEW_ALL_MIN_PERMISSION）
 */
var LedgerEntryMap = (function () {
  var LEDGER_VIEW_ALL_MIN_PERMISSION = 5;

  var API = {
    voidAction: 'accounting_ledger_void',
    dupReviewAction: 'accounting_ledger_duplicate_review',
    voidReasonKeys: ['void_reason', 'reason'],
    dupReviewDecisionKey: 'review_decision'
  };

  function recorderUserId(item) {
    if (!item) return '';
    return String(
      item.recorderUserId ||
      item.recorder_user_id ||
      item.recorded_by_user_id ||
      ''
    ).trim();
  }

  function isVoided(item) {
    if (!item) return false;
    if (item.voided === true || item.is_voided === true) return true;
    var st = String(item.status || item.ledger_status || '').trim().toLowerCase();
    if (st === 'void' || st === 'voided' || st === '作廢') return true;
    if (item.voided_at) return true;
    return false;
  }

  function isDupReviewPending(item) {
    if (!item) return false;
    if (item.duplicate_review_pending === true) return true;
    if (item.dup_review_pending === true) return true;
    if (item.pending_duplicate_review === true) return true;
    var st = String(item.duplicate_review_status || item.dup_review_status || '').trim().toLowerCase();
    return st === 'pending' || st === '待審';
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

  function canDupReviewControl(authPermVal) {
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
    if (data.duplicate_review_pending === true) return true;
    if (data.dup_review_pending === true) return true;
    if (data.pending_duplicate_review === true) return true;
    if (data.saved_as_pending_review === true) return true;
    var item = data.item;
    if (item && isDupReviewPending(item)) return true;
    return false;
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return item;
    var out = Object.assign({}, item);
    var rid = recorderUserId(item);
    if (rid) out.recorderUserId = rid;
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
    LEDGER_VIEW_ALL_MIN_PERMISSION: LEDGER_VIEW_ALL_MIN_PERMISSION,
    recorderUserId: recorderUserId,
    isVoided: isVoided,
    isDupReviewPending: isDupReviewPending,
    sessionUserId: sessionUserId,
    isEntryOwner: isEntryOwner,
    authPerm: authPerm,
    canViewAllLedger: canViewAllLedger,
    canEditEntry: canEditEntry,
    canVoidEntry: canVoidEntry,
    canDupReviewControl: canDupReviewControl,
    computeTotals: computeTotals,
    saveIndicatesDupReviewPending: saveIndicatesDupReviewPending,
    normalizeItem: normalizeItem,
    locBodyFromItem: locBodyFromItem
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
  return exported;
})();
