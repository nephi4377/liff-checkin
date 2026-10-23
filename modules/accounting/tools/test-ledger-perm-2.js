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
var sessionOther = { auth: { user_id: 'U_OTHER', permission: 3 } };
var sessionBoss = { auth: { user_id: 'U_BOSS', permission: 5 } };

var baseItem = {
  recorderUserId: 'U_OWNER',
  type: '支出',
  amount: 1000,
  sheet: '2026-01',
  row: 12
};

assert.strictEqual(LedgerEntryMap.canEditEntry(sessionOwner, baseItem, 3), true, 'owner can edit');
assert.strictEqual(LedgerEntryMap.canEditEntry(sessionOther, baseItem, 3), false, 'non-owner perm3 cannot edit');
assert.strictEqual(LedgerEntryMap.canEditEntry(sessionBoss, baseItem, 5), true, 'boss can edit');
assert.strictEqual(LedgerEntryMap.canVoidEntry(sessionOwner, baseItem, 3), true, 'owner can void');
assert.strictEqual(LedgerEntryMap.canVoidEntry(sessionOther, baseItem, 3), false, 'non-owner cannot void');
assert.strictEqual(LedgerEntryMap.canVoidEntry(sessionBoss, baseItem, 5), true, 'boss can void');

var voided = Object.assign({}, baseItem, { voided: true });
assert.strictEqual(LedgerEntryMap.canEditEntry(sessionOwner, voided, 3), false, 'voided not editable');
assert.strictEqual(LedgerEntryMap.canVoidEntry(sessionOwner, voided, 3), false, 'voided not voidable again');

var dupItem = Object.assign({}, baseItem, { duplicate_review_pending: true });
assert.strictEqual(LedgerEntryMap.isDupReviewPending(dupItem), true, 'dup pending');
assert.strictEqual(LedgerEntryMap.canDupReviewControl(4), false, 'perm4 no dup control');
assert.strictEqual(LedgerEntryMap.canDupReviewControl(5), true, 'perm5 dup control');

var totals = LedgerEntryMap.computeTotals([
  { type: '收入', amount: 5000 },
  { type: '支出', amount: 1000 },
  Object.assign({}, baseItem, { voided: true, amount: 9999 })
]);
assert.strictEqual(totals.income, 5000, 'income total');
assert.strictEqual(totals.expense, 1000, 'expense excludes voided');
assert.strictEqual(totals.net, 4000, 'net');

assert.strictEqual(
  LedgerEntryMap.isEntryOwner(sessionOwner, { recorder_user_id: 'U_OWNER' }),
  true,
  'recorder_user_id fallback'
);

assert(LedgerEntryMap.saveIndicatesDupReviewPending({ saved_as_pending_review: true }), 'save pending flag');

assert(html.indexOf('ledger_entry_map.js?v=1') >= 0, 'ledger map script');
assert(html.indexOf('accounting_api.js?v=108') >= 0, 'api cache bust');
assert(html.indexOf('HISTORY_READ_ONLY') < 0, 'no read-only gate');
assert(html.indexOf('void-ledger') >= 0, 'void button role');
assert(html.indexOf('btn-edit') >= 0, 'edit button role');
assert(html.indexOf('dup-review-confirm') >= 0, 'dup confirm role');
assert(html.indexOf('renderHistoryTotals') >= 0, 'totals renderer');
assert(html.indexOf('作廢') >= 0, 'void copy');
assert(html.indexOf('刪除錯誤帳') < 0, 'no legacy delete label');
assert(html.indexOf('recorderUserId') >= 0 || html.indexOf('LedgerEntryMap.recorderUserId') >= 0,
  'recorder id in page');
assert(html.indexOf('LedgerEntryMap.canEditEntry') >= 0, 'uses map for edit');

assert(api.indexOf('LEDGER_VIEW_ALL_MIN_PERMISSION') >= 0, 'api exports view-all threshold');
assert(api.indexOf('authPerm < LEDGER_VIEW_ALL_MIN_PERMISSION') >= 0, 'recent mine_only at 5');
assert(api.indexOf("action: 'accounting_ledger_void'") >= 0, 'void action');
assert(api.indexOf("action: 'accounting_ledger_duplicate_review'") >= 0, 'dup review action');

console.log('OK test-ledger-perm-2');
