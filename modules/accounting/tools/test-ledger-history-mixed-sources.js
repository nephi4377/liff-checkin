/**
 * Smoke: 歷史記帳頁同時支援待付款請款＋收支登錄標籤／篩選
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=92') >= 0, 'cache bust v=92');
assert(html.indexOf('data-kind="all"') >= 0, 'tab all');
assert(html.indexOf('data-kind="payment_request"') >= 0, 'tab payment_request');
assert(html.indexOf('data-kind="ledger"') >= 0, 'tab ledger');
assert(html.indexOf('histRecordKind') >= 0, 'record kind hidden input');
assert(html.indexOf('待付款請款') >= 0, 'payment label copy');
assert(html.indexOf('收支登錄') >= 0, 'ledger label copy');
assert(html.indexOf('hist-kind-badge') >= 0, 'kind badge class');
assert(html.indexOf('is-ledger') >= 0 && html.indexOf('is-payment') >= 0, 'blue+yellow badge classes');
assert(html.indexOf('ledger_count') >= 0 && html.indexOf('payment_count') >= 0, 'shows blue/yellow counts');
assert(html.indexOf('isPaymentRequestItem') >= 0, 'payment item helper');
assert(html.indexOf('record_kind') >= 0, 'passes record_kind');
assert(html.indexOf('開啟請款審核') >= 0, 'detail link to review');
assert(api.indexOf('opts.record_kind') >= 0, 'api accepts record_kind');
assert(api.indexOf("action: 'accounting_ledger_recent'") >= 0, 'recent action');
assert(api.indexOf("actionName === 'accounting_ledger_recent'") >= 0, 'no HTML retry for recent');
assert(api.indexOf('maxAttempts = 1') >= 0, 'recent single attempt');

console.log('OK test-ledger-history-mixed-sources');
