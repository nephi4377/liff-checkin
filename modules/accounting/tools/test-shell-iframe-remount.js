/**
 * Smoke: 會計殼層重開功能頁必須能重掛 iframe
 * （子頁 location 跳走後 src 屬性仍舊 → 舊邏輯不重載 →「單據與存檔未更新」）
 * Follow-up: 重掛清 session 清單快取；embed 不先畫快取；SPA IframeView 依 route key 重掛
 */
var fs = require('fs');
var path = require('path');

var cacheBust = require('./test-cache-bust-helper');
var root = __dirname;
var shell = fs.readFileSync(path.join(root, '../../../shared/js/accounting_shell.js'), 'utf8');
var index = fs.readFileSync(path.join(root, '../index.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, '../payment_request.html'), 'utf8');
var qr = fs.readFileSync(path.join(root, '../quick_review.html'), 'utf8');
var iframeView = fs.readFileSync(path.join(root, '../../../spa/IframeView.js'), 'utf8');
var appJs = fs.readFileSync(path.join(root, '../../../spa/app.js'), 'utf8');
var hubIndex = fs.readFileSync(path.join(root, '../../../index.html'), 'utf8');

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
assert(shell.indexOf('bustQuickReviewListCache_') >= 0, 'busts quick_review list cache on remount');
assert(shell.indexOf("removeItem('acct_quick_review_list_v2')") >= 0, 'clears acct_quick_review_list_v2');

cacheBust.assertNumericCacheBust(index, cacheBust.RE.accountingShell, 'accounting index accounting_shell.js cache bust');

assert(pay.indexOf("sessionStorage.removeItem('acct_quick_review_list_v2')") >= 0,
  'payment success clears quick_review list cache');

assert(qr.indexOf("addEventListener('pageshow'") >= 0, 'quick_review pageshow refresh');
assert(qr.indexOf("get('embed') === '1'") >= 0 || qr.indexOf('embed') === '1' || /isEmbed.*embed/.test(qr),
  'embed skips session list cache paint');
assert(qr.indexOf("nav.type === 'back_forward'") >= 0, 'pageshow reloads on back_forward');

assert(iframeView.indexOf('about:blank') >= 0, 'IframeView blank-remount on src change');
assert(iframeView.indexOf('watch(') >= 0, 'IframeView watches src');
assert(/:key="\(currentView\.src/.test(appJs) || appJs.indexOf(':key="(currentView.src') >= 0,
  'app.js keys IframeView by src+params');
cacheBust.assertCacheBustToken(hubIndex, cacheBust.RE.hubAppJs, 'hub index app.js cache bust');

console.log('test-shell-iframe-remount: ok');
