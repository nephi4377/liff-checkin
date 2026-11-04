/**
 * 待付款請款／送出紀錄：版面不溢出白卡（含「寬視窗＋窄 iframe」情境）
 * 執行：node modules/accounting/tools/test-accounting-layout-overflow.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var root = path.resolve(__dirname, '../../..');
var layoutCss = fs.readFileSync(path.join(root, 'shared/css/accounting_layout.css'), 'utf8');
var payHtml = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var srHtml = fs.readFileSync(path.join(root, 'modules/accounting/submit_records.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(/container-type:\s*inline-size/.test(layoutCss), 'layout.css 應設 container-type');
assert(/@container\s+acct-pay/.test(layoutCss), 'layout.css 應有 acct-pay container query');
assert(/acct-page-wide/.test(layoutCss), 'layout.css 應有 acct-page-wide 寬主欄');
assert(/minmax\(0,\s*1fr\)/.test(layoutCss), '兩欄應可收縮（minmax 0）');
assert(!/minmax\(300px,\s*1fr\)\s+minmax\(380px/.test(layoutCss), '不應再強制 300+380 最小欄寬（窄 iframe 會溢出）');

assert(/acct-page-wide/.test(payHtml), 'payment_request body 應有 acct-page-wide');
assert(/accounting_layout\.css\?v=9/.test(payHtml), 'payment_request 應指 layout v=9');
assert(/acct-nav-current/.test(payHtml), 'payment_request 應標目前頁導覽');

assert(/accounting_layout\.css\?v=9/.test(srHtml), 'submit_records 應指 layout v=9');
assert(/acct-nav-current/.test(srHtml), 'submit_records 應標目前頁導覽');
assert(/for="srAmount"[\s\S]*?class="full"/.test(srHtml) || /class="full"[\s\S]*?for="srAmount"/.test(srHtml),
  '金額欄應占滿列（full），避免半欄留白');

console.log('OK test-accounting-layout-overflow.js');
