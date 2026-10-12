/**
 * Smoke: 會計殼層重開功能頁必須能重掛 iframe
 * （子頁 location 跳走後 src 屬性仍舊 → 舊邏輯不重載 →「單據與存檔未更新」）
 */
var fs = require('fs');
var path = require('path');

var root = __dirname;
var shell = fs.readFileSync(path.join(root, '../../../shared/js/accounting_shell.js'), 'utf8');
var index = fs.readFileSync(path.join(root, '../index.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, '../payment_request.html'), 'utf8');
var qr = fs.readFileSync(path.join(root, '../quick_review.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(shell.indexOf('frameActualPage_') >= 0, 'reads iframe actual page');
assert(shell.indexOf('forceRemount') >= 0, 'supports forceRemount');
assert(shell.indexOf("about:blank") >= 0, 'blank-then-set to remount same src');
assert(/showFrame\(page,\s*extractPageQuery\(href\),\s*\{\s*forceRemount:\s*true\s*\}\)/.test(shell),
  'navigateTo force-remounts from menu');
assert(shell.indexOf("if (frameEl.getAttribute('src') !== src) frameEl.setAttribute('src', src);") < 0,
  'removed naive src-only skip');

assert(index.indexOf('accounting_shell.js?v=10') >= 0, 'shell cache bust v=10');

assert(pay.indexOf("sessionStorage.removeItem('acct_quick_review_list_v2')") >= 0,
  'payment success clears quick_review list cache');

assert(qr.indexOf("addEventListener('pageshow'") >= 0, 'quick_review pageshow refresh');

console.log('test-shell-iframe-remount: ok');
