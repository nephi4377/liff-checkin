/**
 * Smoke: 歷史記帳唯讀查詢＋金額／廠商搜尋；無錯誤記帳標示操作
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=107') >= 0, 'cache bust v=107');
assert(html.indexOf('HISTORY_READ_ONLY = true') >= 0, 'read-only flag');
assert(html.indexOf('parseHistoryAmountQuery') >= 0, 'amount query normalizer');
assert(html.indexOf('廠商名／金額') >= 0 || html.indexOf('廠商／金額') >= 0, 'vendor/amount copy');
assert(html.indexOf('本頁不做標記') >= 0 || html.indexOf('不做標記') >= 0, 'no mark copy');
assert(html.indexOf('點開看詳情與圖片') >= 0, 'detail+image hint');
assert(html.indexOf('id="histScope"') >= 0, 'scope select for finance');
assert(html.indexOf('>全部</option>') >= 0, 'all scope option');
assert(html.indexOf('canViewAllLedgerHistory') >= 0, 'scope gated by permission');
assert(html.indexOf('authSessionPerm()') >= 0, 'all-scope uses auth permission only');
assert(html.indexOf('權限更新中，請重新整理') >= 0, 'hub-ahead refresh hint');
assert(html.indexOf('readHistoryMineOnlyFlag') >= 0, 'mine_only from scope');
assert(html.indexOf('AccountingApi.MIN_PERMISSION') >= 0, 'uses MIN_PERMISSION threshold');
assert(api.indexOf('authPerm < MIN_PERMISSION') >= 0, 'api enforces mine_only below MIN_PERMISSION');
assert(api.indexOf('ACCT-SEC-11') >= 0, 'api documents ACCT-SEC-11');
assert(html.indexOf('attRef.payment_request_id') >= 0 ||
  html.indexOf('payment_request_id = pid') >= 0, 'payment attachments via payment_request_id');
assert(html.indexOf('renderHistoryAttachments(panel, merged)') >= 0, 'payment detail shows attachments');

// 唯讀：sessionCan* 先擋 HISTORY_READ_ONLY
var canFlagFn = html.slice(html.indexOf('function sessionCanFlagDetail'));
canFlagFn = canFlagFn.slice(0, canFlagFn.indexOf('function sessionCanDeleteDetail'));
assert(canFlagFn.indexOf('HISTORY_READ_ONLY') >= 0, 'flag gated by read-only');

// 列表不再渲染／綁定 list-flag 按鈕
assert(html.indexOf('data-role="list-flag"') < 0, 'no list-flag selector');
assert(html.indexOf('每一列可按「錯誤記帳標示」') < 0, 'no flag status copy');
assert(html.indexOf('listFlagBtn') < 0, 'no list flag handler');

assert(api.indexOf('body.amount = amtBody') >= 0 || api.indexOf('body.amount = amtBody') >= 0,
  'api normalizes amount');
assert(api.indexOf("replace(/^(NT\\$|nt\\$|NT|nt|\\$|＄|￥)/") >= 0, 'api strips currency prefix');

/** 對齊 parseHistoryAmountQuery */
function parseHistoryAmountQuery(raw) {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[,，\s]/g, '');
  s = s.replace(/^(NT\$|nt\$|NT|nt|\$|＄|￥)/, '');
  if (/元$/.test(s)) s = s.slice(0, -1);
  var wan = s.match(/^(\d+(?:\.\d+)?)[萬万]$/);
  if (wan) {
    var wn = parseFloat(wan[1]);
    return isNaN(wn) ? null : Math.round(wn * 10000);
  }
  var qian = s.match(/^(\d+(?:\.\d+)?)千$/);
  if (qian) {
    var qn = parseFloat(qian[1]);
    return isNaN(qn) ? null : Math.round(qn * 1000);
  }
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
assert.strictEqual(parseHistoryAmountQuery('1500'), 1500, 'plain');
assert.strictEqual(parseHistoryAmountQuery('1,500'), 1500, 'comma');
assert.strictEqual(parseHistoryAmountQuery('$1,500'), 1500, 'dollar');
assert.strictEqual(parseHistoryAmountQuery('NT$2000'), 2000, 'NT$');
assert.strictEqual(parseHistoryAmountQuery(''), null, 'empty');

console.log('OK test-ledger-history-search-readonly');
