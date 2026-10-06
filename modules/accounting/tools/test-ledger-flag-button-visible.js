/**
 * Smoke: 歷史記帳「錯誤記帳標示」— 請款＋收支每一列（perm≥3）；勿框選／置頂可標示區
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');
var nav = fs.readFileSync(path.join(root, '../../shared/js/accounting_nav.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=94') >= 0, 'cache bust v=94');
assert(html.indexOf('accounting_nav.js?v=3') >= 0, 'nav v=3');
assert(html.indexOf('hist-mod-bar') >= 0, 'sticky mod bar class');
assert(html.indexOf("setAttribute('data-role', 'flag-error')") >= 0, 'detail flag button role');
assert(html.indexOf('data-role="list-flag"') >= 0, 'list flag button role');
assert(html.indexOf('hist-list-flag') >= 0, 'list flag affordance');
assert(html.indexOf('錯誤記帳標示') >= 0, 'boss-facing button label');
assert(html.indexOf('histFlagReasonMask') >= 0, 'in-page reason dialog');
assert(!/\bwindow\.prompt\s*\(/.test(html), 'must not call window.prompt (LINE blocks)');
assert(html.indexOf('Math.max(authPerm, hubPerm)') >= 0, 'sessionPerm max hub');
assert(html.indexOf('不要系統先框選') >= 0, 'no curation copy');
assert(html.indexOf('function renderFlagPin') < 0, 'pin curator removed');
assert(html.indexOf('payment_request_id') >= 0, 'payment flag payload');
assert(html.indexOf('promptFlagReason') >= 0, 'prompt reason helper');
assert(html.indexOf('請填寫錯誤記帳原因') >= 0, 'reason required copy');
assert(api.indexOf('payment_request_id') >= 0 && api.indexOf('accountingLedgerFlag') >= 0,
  'api passes payment_request_id on flag');
assert(nav.indexOf('合併為較高權限') >= 0, 'withHubQuery merges permission');

/** 模擬 sessionCanFlag：perm≥3 且未標 → true（請款＋收支；即使 can_flag:false） */
function sessionCanFlagDetail(detail, sessionPerm) {
  if (detail && detail.error_flagged) return false;
  if (sessionPerm >= 3) return true;
  if (detail && detail.can_flag === true) return true;
  return false;
}

assert(sessionCanFlagDetail({ record_kind: 'ledger', can_flag: false }, 3), 'Yang sees ledger flag');
assert(sessionCanFlagDetail({
  record_kind: 'payment_request',
  payment_request_id: '568e45d0-6315-4f1d-b94c-13d84b717fe7',
  can_flag: false
}, 3), 'Yang sees payment flag (新弘例)');
assert(!sessionCanFlagDetail({ record_kind: 'ledger', error_flagged: true }, 3), 'already flagged');
assert(!sessionCanFlagDetail({ record_kind: 'payment_request', payment_request_id: 'p1', error_flagged: true }, 3),
  'flagged payment no button');
assert(!sessionCanFlagDetail({ record_kind: 'ledger' }, 2), 'perm 2 no flag');

console.log('OK test-ledger-flag-button-visible');
