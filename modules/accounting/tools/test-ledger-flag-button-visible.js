/**
 * Smoke: 歷史記帳改為唯讀 — 不再顯示「錯誤記帳標示」操作（標示改走其他頁）
 * （舊名保留以便既有 CI／習慣指令仍可跑）
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var cacheBust = require('./test-cache-bust-helper');
var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

cacheBust.assertNumericCacheBust(html, cacheBust.RE.accountingApi, 'ledger_history accounting_api.js cache bust', 106);
assert(html.indexOf('HISTORY_READ_ONLY = true') >= 0, 'HISTORY_READ_ONLY');
assert(html.indexOf('data-role="list-flag"') < 0, 'list flag button removed from markup');
assert(html.indexOf('每一列可按「錯誤記帳標示」') < 0, 'no per-row flag CTA copy');
assert(html.indexOf('點開看詳情與圖片') >= 0, 'read-only detail hint');
// API 仍保留 flag action（其他頁／相容）；本頁 UI 不呼叫
assert(api.indexOf('accountingLedgerFlag') >= 0, 'api still has flag for other surfaces');

var canFlagSlice = html.slice(html.indexOf('function sessionCanFlagDetail'));
canFlagSlice = canFlagSlice.slice(0, 280);
assert(canFlagSlice.indexOf('HISTORY_READ_ONLY') >= 0, 'flag short-circuits on read-only');

console.log('OK test-ledger-flag-button-visible (read-only)');
