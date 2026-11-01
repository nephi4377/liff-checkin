/**
 * Smoke: 歷史記帳改帳／作廢按鈕（LEDGER-PERM-2；舊檔名保留給 CI）
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=111') >= 0, 'cache bust');
assert(html.indexOf('LedgerEntryMap.showEditButton') >= 0, 'edit via server flag');
assert(html.indexOf("'btn-edit'") >= 0, 'edit button');
assert(html.indexOf("'void-ledger'") >= 0, 'void button');
assert(html.indexOf('sessionCanEditDetail') >= 0, 'edit gate');
assert(html.indexOf('sessionCanVoidDetail') >= 0, 'void gate');
assert(api.indexOf('accountingLedgerVoid') >= 0, 'void api');
assert(html.indexOf('錯誤記帳標示') < 0, 'legacy flag CTA removed from page');

console.log('OK test-ledger-flag-button-visible (perm-2)');
