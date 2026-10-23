/**
 * Contract: LEDGER_PERM_API example fixtures + map helpers
 * node modules/accounting/tools/test-ledger-perm-api-contract.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var fixturesPath = path.join(__dirname, '../fixtures/ledger-perm-api.examples.json');
var fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
var LedgerEntryMap = require(path.join(__dirname, '../../../shared/js/ledger_entry_map.js'));
var api = fs.readFileSync(path.join(__dirname, '../../../shared/js/accounting_api.js'), 'utf8');

assert.strictEqual(fixtures.view_all_min_perm, 5, 'view_all_min_perm');
assert.strictEqual(fixtures.actions.void, 'accounting_ledger_void', 'void action');
assert.strictEqual(
  fixtures.actions.dup_review_clear,
  'accounting_ledger_dup_review_clear',
  'dup clear action'
);
assert.strictEqual(LedgerEntryMap.API.voidAction, fixtures.actions.void, 'map void action');
assert.strictEqual(
  LedgerEntryMap.API.dupReviewClearAction,
  fixtures.actions.dup_review_clear,
  'map dup clear action'
);

assert(api.indexOf("action: 'accounting_ledger_void'") >= 0, 'api void action');
assert(api.indexOf("action: 'accounting_ledger_dup_review_clear'") >= 0, 'api dup clear action');
assert(api.indexOf('accounting_ledger_duplicate_review') < 0, 'no legacy dup review action');

var recent = fixtures.examples.ledger_recent_mine_only;
assert(recent.success && recent.mine_only === true, 'recent mine_only example');
assert.strictEqual(recent.view_all_min_perm, 5, 'recent view_all_min_perm');
var row = recent.items[0];
assert.strictEqual(LedgerEntryMap.recorderUserId(row), 'U_OWNER_DEMO', 'recorderUserId');
assert.strictEqual(row.recorder_user_id, 'U_OWNER_DEMO', 'recorder_user_id on row');
assert.strictEqual(row.can_delete, false, 'can_delete always false');
assert(LedgerEntryMap.isDupReviewPending(row), 'dup pending from API fields');
assert.strictEqual(row.duplicate_review_status, 'pending', 'dup status pending');
assert(LedgerEntryMap.showEditButton(row), 'can_edit drives edit');
assert(LedgerEntryMap.showVoidButton(row), 'can_void');
assert(LedgerEntryMap.showDupClearButton(row), 'can_clear_duplicate_review');

var voidBody = LedgerEntryMap.voidRequestBody(row, '重複登錄');
assert.strictEqual(voidBody.sheet, '2026-01');
assert.strictEqual(voidBody.row, 42);
assert.strictEqual(voidBody.ingest_id, 'ing-demo-001');
assert.strictEqual(voidBody.void_reason, '重複登錄');
assert.strictEqual(voidBody.reason, '重複登錄');

var detailVoided = fixtures.examples.ledger_detail_voided.item;
assert(LedgerEntryMap.isVoided(detailVoided), 'detail voided still returned');
assert.strictEqual(detailVoided.voided_by, 'U_BOSS');
assert.strictEqual(detailVoided.void_reason, '重複登錄');
assert(!LedgerEntryMap.showEditButton(detailVoided), 'no edit on voided');
assert(!LedgerEntryMap.showVoidButton(detailVoided), 'no void again');

var voidSuccess = fixtures.examples.ledger_void_success;
assert.strictEqual(voidSuccess.voided, true);
assert(voidSuccess.voided_at);
assert.strictEqual(voidSuccess.voided_by, 'U_OWNER_DEMO');
assert.strictEqual(voidSuccess.void_reason, '重複登錄');
assert(LedgerEntryMap.isVoided(voidSuccess.item), 'voided item in response');

assert(!LedgerEntryMap.isVoided({ recorderUserId: 'x', voided: false }), 'not voided');

var tagged = fixtures.examples.ledger_update_dup_flagged;
assert(LedgerEntryMap.saveIndicatesDupReviewPending(tagged), 'update duplicate_review_pending');

var cleared = fixtures.examples.dup_review_clear_success.item;
assert.strictEqual(cleared.duplicate_review_status, 'cleared');
assert(!LedgerEntryMap.isDupReviewPending(cleared), 'cleared dup');

var tagFallback = {
  note: 'x [dup_review:ing-demo-001 pending]',
  duplicate_review_status: ''
};
assert(LedgerEntryMap.isDupReviewPending(tagFallback), 'note tag fallback');
assert.strictEqual(LedgerEntryMap.parseDupReviewTag(tagFallback.note).payload, 'ing-demo-001');

Object.keys(fixtures.error_examples).forEach(function (code) {
  var ex = fixtures.error_examples[code];
  assert.strictEqual(ex.error_code, code, 'fixture error_code key');
  var msg = LedgerEntryMap.friendlyLedgerError(ex, 'fallback');
  assert(msg && msg !== 'fallback', 'friendly message for ' + code);
  assert.strictEqual(msg, LedgerEntryMap.ERROR_MESSAGES[code], 'message map has ' + code);
});

assert(
  LedgerEntryMap.friendlyLedgerError({ error_code: 'LEDGER_DELETE_DISABLED', use_void: true }, 'x').indexOf('作廢') >= 0,
  'delete disabled hints void'
);

console.log('OK test-ledger-perm-api-contract');
