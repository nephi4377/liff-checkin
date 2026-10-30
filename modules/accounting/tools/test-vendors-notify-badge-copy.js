/**
 * 名冊匯款通知徽章文案（YY-57）
 * node modules/accounting/tools/test-vendors-notify-badge-copy.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(
  path.join(__dirname, '..', 'vendors.html'),
  'utf8'
);

assert(html.indexOf("notify_failed: '通知未送到'") >= 0, '失敗應改為通知未送到');
assert(html.indexOf("none: '尚無通知'") >= 0, '尚無紀錄應改為尚無通知');
assert(html.indexOf('pay-stage-scroll') >= 0, '已匯款區可獨立捲動');
assert(html.indexOf('sortPayHistoryNewestFirst') >= 0, '最新在上');
assert(html.indexOf('emailDraftHint') >= 0, 'EMAIL 草稿勿一律寫沒綁 LINE');
assert(html.indexOf('payment_line_uid_mismatch') >= 0, '應說明 UID 不一致');
assert(html.indexOf('帳已入；是通知沒送到') >= 0 || html.indexOf('帳已入') >= 0, '人話提示');

console.log('ok: vendors-notify-badge-copy');
