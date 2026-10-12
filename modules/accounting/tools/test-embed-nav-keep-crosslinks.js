/**
 * Smoke: embed 模式只藏「回選單」，保留同模組交叉連結（如送出紀錄）
 * node modules/accounting/tools/test-embed-nav-keep-crosslinks.js
 */
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var shared = path.join(__dirname, '../../../shared');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var navJs = fs.readFileSync(path.join(shared, 'js/accounting_nav.js'), 'utf8');
var css = fs.readFileSync(path.join(shared, 'css/accounting_layout.css'), 'utf8');

assert(navJs.indexOf('querySelectorAll(\'.nav, #userLine') < 0, 'must not wholesale hide .nav');
assert(navJs.indexOf('acct-nav-back') >= 0, 'embed chrome respects acct-nav-back');
assert(navJs.indexOf('keepCount') >= 0 || navJs.indexOf('hasKeep') >= 0, 'keeps cross-page nav links');

assert(!/body\.acct-embed\s+\.nav\s*,/.test(css) && !/body\.acct-embed\s+\.nav\s*\{/.test(css),
  'CSS must not display:none all .nav in embed');

['payment_request.html', 'accounting_ingest.html', 'ledger_history.html', 'submit_records.html'].forEach(function (name) {
  var html = fs.readFileSync(path.join(root, name), 'utf8');
  assert(html.indexOf('acct-nav-back') >= 0, name + ' marks menu back for embed hide');
  if (name === 'submit_records.html') {
    assert(html.indexOf('id="navPaymentRequestLink"') >= 0, name + ' has 待付款請款 cross-link');
  } else {
    assert(html.indexOf('id="navSubmitRecordsLink"') >= 0, name + ' has 送出紀錄 cross-link');
  }
  assert(/accounting_nav\.js\?v=4/.test(html), name + ' bumps accounting_nav cache');
  assert(/accounting_layout\.css\?v=7/.test(html), name + ' bumps layout cache');
});

var pay = fs.readFileSync(path.join(root, 'payment_request.html'), 'utf8');
assert(pay.indexOf('id="navSubmitRecordsLink"') >= 0, 'payment_request keeps 送出紀錄 id');
assert(pay.indexOf("getElementById('navSubmitRecordsLink')") >= 0 &&
  /navSubmitRecordsLink'\)[\s\S]{0,200}classList\.add\('hidden'\)/.test(pay),
  'vendor self hides nav 送出紀錄');

console.log('OK test-embed-nav-keep-crosslinks');
