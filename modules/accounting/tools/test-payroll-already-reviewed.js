/**
 * Smoke：薪資審核「已審過」前端判定（對齊 payroll_review.html）
 * node modules/accounting/tools/test-payroll-already-reviewed.js
 */
'use strict';

function isAlreadySettledReviewMsg_(msg) {
  var m = String(msg || '');
  return m === '此筆已審核過' ||
    m.indexOf('先前已核准') >= 0 ||
    m.indexOf('先前已退回') >= 0 ||
    m.indexOf('無法再核准') >= 0 ||
    m.indexOf('無法退回') >= 0;
}

function looksLikeBenignAlreadyDone_(text) {
  var t = String(text || '');
  return /此筆已審核過|先前已核准|先前已退回|此項目已在處理中/.test(t);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isAlreadySettledReviewMsg_('此筆已審核過'), 'legacy fail msg');
assert(isAlreadySettledReviewMsg_('此筆先前已核准，可至薪資待匯款處理'), 'new already_reviewed');
assert(isAlreadySettledReviewMsg_('此筆狀態為「已審」，無法退回（請先重新載入）'), 'reject guard');
assert(!isAlreadySettledReviewMsg_('權限不足'), 'real error');

assert(looksLikeBenignAlreadyDone_('此筆已審核過'), 'ui benign');
assert(looksLikeBenignAlreadyDone_('✕ 核准中… — 此筆已審核過'), 'ui benign with action prefix');
assert(!looksLikeBenignAlreadyDone_('連線逾時'), 'real error not benign');

// 待審列表：本頁已刷掉的 id 不得被 SWR 舊資料又畫回來
function filterPendingForRender(items, dismissed) {
  return (items || []).filter(function (row) {
    var rid = String(row.payroll_request_id || '');
    if (dismissed[rid]) return false;
    return String(row.review_status) === '待審';
  });
}
var dismissed = { PR1: true };
var rendered = filterPendingForRender([
  { payroll_request_id: 'PR1', review_status: '待審' },
  { payroll_request_id: 'PR2', review_status: '待審' }
], dismissed);
assert(rendered.length === 1 && rendered[0].payroll_request_id === 'PR2', 'dismissed id stays off pending list');

console.log('test-payroll-already-reviewed (frontend): ok');
