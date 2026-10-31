/**
 * LEDGER-PERM-2：權限／作廢／疑重待審／合計（單元＋頁面 smoke）
 * node modules/accounting/tools/test-ledger-perm-2.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');
var mapPath = path.join(__dirname, '../../../shared/js/ledger_entry_map.js');
var LedgerEntryMap = require(mapPath);

var sessionOwner = { auth: { user_id: 'U_OWNER', permission: 3 } };

var baseItem = {
  recorderUserId: 'U_OWNER',
  type: '支出',
  amount: 1000,
  sheet: '2026-01',
  row: 12,
  can_edit: true,
  can_void: true,
  can_clear_duplicate_review: false,
  can_delete: false
};

assert(LedgerEntryMap.showEditButton(baseItem), 'server can_edit');
assert(LedgerEntryMap.showVoidButton(baseItem), 'server can_void');
assert(!LedgerEntryMap.showDupClearButton(baseItem), 'no dup clear flag');

var noEdit = Object.assign({}, baseItem, { can_edit: false });
assert(!LedgerEntryMap.showEditButton(noEdit), 'can_edit false');

var voided = Object.assign({}, baseItem, { voided: true, can_edit: true, can_void: true });
assert(!LedgerEntryMap.showEditButton(voided), 'voided not editable');
assert(!LedgerEntryMap.showVoidButton(voided), 'voided not voidable again');

var dupItem = Object.assign({}, baseItem, {
  duplicate_review_pending: true,
  duplicate_review_status: 'pending',
  can_clear_duplicate_review: true
});
assert.strictEqual(LedgerEntryMap.isDupReviewPending(dupItem), true, 'dup pending field');
assert(LedgerEntryMap.showDupClearButton(dupItem), 'can_clear_duplicate_review');

var dupTagOnly = Object.assign({}, baseItem, {
  note: '測試 [dup_review:ing-demo-001 pending]',
  duplicate_review_status: ''
});
assert.strictEqual(LedgerEntryMap.isDupReviewPending(dupTagOnly), true, 'dup pending tag fallback');

var totals = LedgerEntryMap.computeTotals([
  { type: '收入', amount: 5000 },
  { type: '支出', amount: 1000 },
  Object.assign({}, baseItem, { voided: true, amount: 9999 })
]);
assert.strictEqual(totals.income, 5000, 'income total');
assert.strictEqual(totals.expense, 1000, 'expense excludes voided');
assert.strictEqual(totals.net, 4000, 'net');

assert.strictEqual(
  LedgerEntryMap.isEntryOwner(sessionOwner, { recorderUserId: 'U_OWNER' }),
  true,
  'recorderUserId'
);
assert.strictEqual(
  LedgerEntryMap.isEntryOwner(sessionOwner, { recorder_user_id: 'U_OWNER' }),
  true,
  'recorder_user_id alias'
);

assert(
  LedgerEntryMap.saveIndicatesDupReviewPending({
    duplicate_review_pending: true,
    item: { duplicate_review_status: 'pending' }
  }),
  'save pending via API field'
);

var voidReq = LedgerEntryMap.voidRequestBody(baseItem, 'test reason');
assert.strictEqual(voidReq.void_reason, 'test reason');
assert.strictEqual(voidReq.sheet, '2026-01');
assert.strictEqual(voidReq.row, 12);

assert(html.indexOf('ledger_entry_map.js?v=5') >= 0, 'ledger map script');
assert(html.indexOf('accounting_api.js?v=112') >= 0, 'api cache bust');
assert(html.indexOf('HISTORY_READ_ONLY') < 0, 'no read-only gate');
assert(html.indexOf('void-ledger') >= 0, 'void button role');
assert(html.indexOf('btn-edit') >= 0, 'edit button role');
assert(html.indexOf('dup-review-confirm') < 0, 'no dup confirm (clear only)');
assert(html.indexOf('renderHistoryTotals') >= 0, 'totals renderer');
assert(html.indexOf('作廢') >= 0, 'void copy');
assert(html.indexOf('刪除錯誤帳') < 0, 'no legacy delete label');
assert(html.indexOf('voidedByDisplay') >= 0, 'voided by name in detail');
assert(html.indexOf('recorderDisplay') >= 0, 'recorder name in detail');
assert(html.indexOf('記帳人 ID') < 0, 'no raw recorder id label');
assert(html.indexOf('LEDGER_MIN_VIEW_PERMISSION') >= 0, 'ledger boot min perm 1');
assert(html.indexOf('權限 ≥1') >= 0, 'copy perm 1');
assert(html.indexOf('LedgerEntryMap.showEditButton') >= 0, 'uses map for edit');
assert(html.indexOf('voidRequestBody') >= 0, 'void body helper');

assert(api.indexOf('LEDGER_VIEW_ALL_MIN_PERMISSION') >= 0, 'api exports view-all threshold');
assert(api.indexOf('LEDGER_MIN_VIEW_PERMISSION') >= 0, 'api exports ledger min view');
assert(api.indexOf('authPerm < LEDGER_VIEW_ALL_MIN_PERMISSION') >= 0, 'recent mine_only at 5');
assert(api.indexOf("action: 'accounting_ledger_void'") >= 0, 'void action');
assert(api.indexOf("action: 'accounting_ledger_dup_review_clear'") >= 0, 'dup clear action');

var sr = fs.readFileSync(path.join(root, 'submit_records.html'), 'utf8');
assert(sr.indexOf('accounting_api.js?v=112') >= 0, 'submit_records api v=111');

assert.strictEqual(LedgerEntryMap.recorderDisplay({ recorder_name: 'A' }), 'A');
assert.strictEqual(LedgerEntryMap.recorderDisplay({ recorderUserId: 'U' + 'a'.repeat(32) }), '—');
assert(sr.indexOf('readSubmitMineOnlyFlag') >= 0, 'submit_records mine_only gate');

console.log('OK test-ledger-perm-2');
