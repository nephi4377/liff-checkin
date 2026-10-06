/**
 * Smoke: 歷史記帳頁同時支援待付款請款＋收支登錄標籤／篩選
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=91') >= 0, 'cache bust v=91');
assert(html.indexOf('data-kind="all"') >= 0, 'tab all');
assert(html.indexOf('data-kind="payment_request"') >= 0, 'tab payment_request');
assert(html.indexOf('data-kind="ledger"') >= 0, 'tab ledger');
assert(html.indexOf('histRecordKind') >= 0, 'record kind hidden input');
assert(html.indexOf('待付款請款') >= 0, 'payment label copy');
assert(html.indexOf('收支登錄') >= 0, 'ledger label copy');
assert(html.indexOf('hist-kind-badge') >= 0, 'kind badge class');
assert(html.indexOf('isPaymentRequestItem') >= 0, 'payment item helper');
assert(html.indexOf('record_kind') >= 0, 'passes record_kind');
assert(html.indexOf('開啟請款審核') >= 0, 'detail link to review');
assert(api.indexOf('opts.record_kind') >= 0, 'api accepts record_kind');
assert(api.indexOf("action: 'accounting_ledger_recent'") >= 0, 'recent action');

console.log('OK test-ledger-history-mixed-sources');
