/**
 * Smoke: 歷史記帳頁僅收支登錄（請款已拆至送出紀錄）＋唯讀查詢
 * node modules/accounting/tools/test-ledger-history-mixed-sources.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=107') >= 0, 'cache bust v=107');
assert(html.indexOf('histRecordKind') >= 0, 'record kind hidden input');
assert(html.indexOf('value="ledger"') >= 0, 'forced ledger kind');
assert(html.indexOf('data-kind="payment_request"') < 0, 'no payment_request tab');
assert(html.indexOf('data-kind="all"') < 0, 'no all tab');
assert(html.indexOf('收支登錄') >= 0, 'ledger label copy');
assert(html.indexOf('submit_records.html') >= 0, 'points to 送出紀錄');
assert(html.indexOf('送出紀錄') >= 0, 'mentions 送出紀錄');
assert(html.indexOf('HISTORY_READ_ONLY = true') >= 0, 'history page read-only');
assert(api.indexOf('opts.record_kind') >= 0, 'api accepts record_kind');
assert(api.indexOf("action: 'accounting_ledger_recent'") >= 0, 'recent action');
assert(api.indexOf("actionName === 'accounting_ledger_recent'") >= 0, 'no HTML retry for recent');
assert(api.indexOf('maxAttempts = 1') >= 0, 'recent single attempt');

console.log('OK test-ledger-history-mixed-sources');
