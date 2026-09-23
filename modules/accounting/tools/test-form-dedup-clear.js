/**
 * Smoke: LIFF form dup-confirm + clear-after-success (no browser).
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(
  path.join(__dirname, '..', 'accounting_ingest.html'),
  'utf8'
);

assert(html.indexOf('needs_dup_confirm') >= 0, 'handles needs_dup_confirm');
assert(html.indexOf('force_duplicate') >= 0, 'resubmits with force_duplicate');
assert(
  html.indexOf('看起來和剛才一樣') >= 0,
  'confirm copy aligns with group「看起來和剛才一樣」'
);
assert(html.indexOf('window.confirm') >= 0, 'uses confirm dialog');
assert(
  /clearVolatileFields\s*\(\s*true\s*\)/.test(html),
  'clears form after successful submit'
);
assert(html.indexOf('expense_month') >= 0 && html.indexOf("['party_name_b', 'amount_b', 'expense_month']") >= 0,
  'expense clear includes amount and month');
assert(html.indexOf("petty_cash').value = '否'") >= 0 || html.indexOf('petty_cash\').value = \'否\'') >= 0,
  'income clear resets petty_cash');
assert(html.indexOf('表單已清空') >= 0, 'success copy mentions form cleared');

console.log('ok: form-dedup-clear smoke');
