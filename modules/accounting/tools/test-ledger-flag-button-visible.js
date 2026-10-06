/**
 * Smoke: 歷史記帳「標註錯誤」對 privilege ≥3 可見／可按（列表＋詳情置頂）
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var nav = fs.readFileSync(path.join(root, '../../shared/js/accounting_nav.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=91') >= 0, 'cache bust v=91');
assert(html.indexOf('accounting_nav.js?v=3') >= 0, 'nav v=3');
assert(html.indexOf('hist-mod-bar') >= 0, 'sticky mod bar class');
assert(html.indexOf("setAttribute('data-role', 'flag-error')") >= 0, 'detail flag button role');
assert(html.indexOf('data-role="list-flag"') >= 0, 'list flag button role');
assert(html.indexOf('hist-list-flag') >= 0, 'list flag affordance');
assert(html.indexOf('Math.max(authPerm, hubPerm)') >= 0, 'sessionPerm max hub');
assert(html.indexOf('勿因 API can_flag:false') >= 0, 'ignore false can_flag when session ≥3');
assert(html.indexOf('先放標註／刪除／修改（置頂可按）') >= 0, 'actions before attachments');
assert(html.indexOf('標註錯誤只在藍標') >= 0, 'page hint blue-only');
assert(html.indexOf('promptFlagReason') >= 0, 'prompt reason helper');
assert(html.indexOf('錯誤原因') >= 0, 'shows error reason field');
assert(html.indexOf('請輸入錯誤記帳原因') >= 0, 'prompt copy');
assert(nav.indexOf('合併為較高權限') >= 0, 'withHubQuery merges permission');

/** 模擬 sessionCanFlag：perm≥3 且非請款且未標 → true（即使 can_flag:false） */
function isPaymentRequestItem(it) {
  return !!(it && (it.record_kind === 'payment_request' || it.payment_request_id) &&
    it.record_kind !== 'ledger');
}
function sessionCanFlagDetail(detail, sessionPerm) {
  if (isPaymentRequestItem(detail)) return false;
  if (detail && detail.error_flagged) return false;
  if (sessionPerm >= 3) return true;
  if (detail && detail.can_flag === true) return true;
  return false;
}

assert(sessionCanFlagDetail({ record_kind: 'ledger', can_flag: false }, 3), 'Yang sees flag despite API false');
assert(!sessionCanFlagDetail({ record_kind: 'payment_request', payment_request_id: 'p1', can_flag: false }, 3), 'payment no flag');
assert(!sessionCanFlagDetail({ record_kind: 'ledger', error_flagged: true }, 3), 'already flagged');
assert(!sessionCanFlagDetail({ record_kind: 'ledger' }, 2), 'perm 2 no flag');

console.log('OK test-ledger-flag-button-visible');
