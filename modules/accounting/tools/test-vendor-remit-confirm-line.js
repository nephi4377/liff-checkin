/**
 * 待匯款頁：失敗／提醒可一鍵確認「這個 LINE 就是該廠商」
 * node modules/accounting/tools/test-vendor-remit-confirm-line.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'vendor_payment_finance.html'), 'utf8');
var api = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('這個 LINE 就是該廠商') >= 0, '一鍵按鈕文案');
assert(html.indexOf('renderVendorConfirmLineActions') >= 0, '標記結果會畫出確認鈕');
assert(html.indexOf('名冊未綁 LINE，請先綁定') >= 0, '未綁文案');
assert(html.indexOf('vendorAliasAdd') >= 0, '先寫別名或綁定');
assert(html.indexOf('vendorRemitNotifyResend') >= 0, '再重送');
assert(api.indexOf("action: 'vendor_alias_add'") >= 0, 'api alias');
assert(api.indexOf("action: 'vendor_remit_notify_resend'") >= 0, 'api resend');
assert(html.indexOf("c.mode === 'bind'") >= 0, '只有明確要綁定才送 line_id');

console.log('ok: vendor-remit-confirm-line');
