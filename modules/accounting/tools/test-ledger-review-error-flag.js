/**
 * Smoke: 請款審核顯示／篩選「錯誤記帳」
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
assert(/accounting_api\.js\?v=97/.test(html), 'api cache bust v=97');
assert(/錯誤原因：/.test(html), 'shows error reason on list/detail');
assert(/沒有已標示「錯誤記帳」的請款/.test(html), 'empty hint for only-flagged filter');

console.log('\nAll ledger-review error-flag FE checks passed.');
