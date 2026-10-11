/**
 * Smoke: 請款審核顯示「錯誤記帳」＋≥3 改廠商／分攤／備註／刪除（無標示寫入）
 * node modules/accounting/tools/test-ledger-review-error-flag.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

var root = path.resolve(__dirname, '../../..');
var html = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');

assert(/filterErrorFlag/.test(html), 'has error-flag filter select');
assert(/只看已標示錯誤/.test(html), 'filter option: only flagged');
assert(/隱藏已標示錯誤/.test(html), 'filter option: exclude flagged');
assert(/已標示錯誤記帳/.test(html), 'list badge copy');
assert(/is-error-flagged/.test(html), 'flagged row highlight class');
assert(/error_flagged/.test(html) && /buildFilter/.test(html), 'passes error_flagged in filter');
assert(/accounting_api\.js\?v=101/.test(html), 'api cache bust v=101');
assert(/錯誤原因：/.test(html) || /歷史已標錯誤/.test(html), 'shows error reason on list/detail');
assert(/沒有已標示「錯誤記帳」的請款/.test(html), 'empty hint for only-flagged filter');
assert(!/reviewFlagReasonMask/.test(html), 'no flag-reason dialog on review');
assert(!/appendFlagButton/.test(html) && !/canFlagItem/.test(html), 'no flag button helpers');
assert(!/accountingLedgerFlag/.test(html), 'does not call accountingLedgerFlag');
assert(!/錯誤記帳標示/.test(html), 'no 錯誤記帳標示 write UI on review');
assert(/btn-save-content/.test(html) && /儲存修改/.test(html), 'perm≥3 save content button');
assert(/saveVendorContent/.test(html) && /vendorPaymentUpdate/.test(html), 'save via vendorPaymentUpdate');
assert(/inp-vendor/.test(html) && /bindVendorCombobox/.test(html), 'vendor picker for ≥3 edit');
assert(/appendDeleteButton/.test(html) && /vendorPaymentDelete/.test(html), 'delete unpaid via API');
assert(/修改內容/.test(html), 'edit content entry for non-approvers');
assert(/廠商／分攤／稅別／備註/.test(html), 'copy lists editable fields');
assert(/核准需 ≥5；≥3 可改/.test(html) || /核准\/退回需權限 ≥ 5/.test(html),
  'approve stays ≥5 while edit ≥3');

var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');
assert(/allocations:\s*patch\.allocations/.test(api) || /body\.allocations = patch\.allocations/.test(api),
  'API update passes allocations');
assert(/body\.vendor_id = patch\.vendor_id/.test(api), 'API update passes vendor_id');
assert(/body\.vendor_name = patch\.vendor_name/.test(api), 'API update passes vendor_name');

console.log('\nAll ledger-review error-flag FE checks passed.');
