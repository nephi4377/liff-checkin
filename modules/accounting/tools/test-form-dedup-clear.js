/**
 * Smoke: LIFF form dup-confirm + clear-after-success + three outcome banners (no browser).
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
assert(html.indexOf('submitResult') >= 0, 'persistent submit result banner');
assert(html.indexOf('未成功，請重試') >= 0, 'hard-fail copy');
assert(html.indexOf('已記入') >= 0 && html.indexOf('後續補資料失敗') >= 0, 'partial-success copy');
assert(html.indexOf('deferred_token') >= 0, 'background flush after main row');
assert(html.indexOf('toastOnOk: false') >= 0, 'avoids generic ok toast masking outcome');

var api = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'js', 'accounting_api.js'),
  'utf8'
);
assert(api.indexOf('accountingFormFlushDeferred') >= 0, 'API has form flush deferred');
assert(api.indexOf('accounting_form_submit') >= 0 && api.indexOf('等太久了') >= 0,
  'form timeout warns not to resubmit blindly');

console.log('ok: form-dedup-clear smoke');
