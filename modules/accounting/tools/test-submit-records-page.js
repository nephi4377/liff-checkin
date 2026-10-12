/**
 * Smoke: 送出紀錄頁（由歷史記帳請款側演進）
 * node modules/accounting/tools/test-submit-records-page.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'submit_records.html'), 'utf8');
var index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, 'payment_request.html'), 'utf8');
var hist = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');
var spa = fs.readFileSync(path.join(root, '../../spa/app.js'), 'utf8');
var ui = fs.readFileSync(path.join(root, '../../shared/js/accounting_ui.js'), 'utf8');
var shell = fs.readFileSync(path.join(root, '../../shared/js/accounting_shell.js'), 'utf8');

assert(html.indexOf('<title>送出紀錄</title>') >= 0, 'page title');
assert(html.indexOf('record_kind: \'payment_request\'') >= 0, 'forces payment_request');
assert(html.indexOf('status_scope') >= 0, 'status_scope filter');
assert(html.indexOf('vendorPaymentUpdate') >= 0, 'edit via vendorPaymentUpdate');
assert(html.indexOf('已匯款') >= 0 && html.indexOf('鎖定') >= 0, 'paid lock copy');
assert(html.indexOf('submitted_by') >= 0, 'shows submitted_by');
assert(html.indexOf('include_allocations') >= 0, 'loads allocations');
assert(html.indexOf('accounting_api.js?v=106') >= 0, 'api cache bust');

assert(index.indexOf('submit_records.html') >= 0, 'hub menu card');
assert(index.indexOf('linkSubmitRecords') >= 0, 'hub link id');
assert(index.indexOf('>送出紀錄<') >= 0, 'hub label');

assert(pay.indexOf('submit_records.html') >= 0, 'success card href');
assert(pay.indexOf('查看送出紀錄') >= 0, 'success card label');
assert(pay.indexOf('查看歷史記帳紀錄') < 0, 'no old success history label');

assert(hist.indexOf('histRecordKind" value="ledger"') >= 0 ||
  hist.indexOf("id=\"histRecordKind\" value=\"ledger\"") >= 0, 'history ledger-only');
assert(hist.indexOf('submit_records.html') >= 0, 'history points to submit records');
assert(hist.indexOf('data-kind="payment_request"') < 0, 'history no payment tab');

assert(api.indexOf('opts.status_scope') >= 0, 'api status_scope');
assert(api.indexOf('opts.include_allocations') >= 0, 'api include_allocations');
assert(spa.indexOf('#/accounting/submit-records') >= 0, 'spa route');
assert(ui.indexOf("'submit_records.html': '送出紀錄'") >= 0, 'ui label');
assert(shell.indexOf("'submit_records.html': '送出紀錄'") >= 0, 'shell title');

console.log('OK test-submit-records-page');
