/**
 * Smoke: 歷史記帳查詢＋LEDGER-PERM-2（列表依 API、作廢／改帳／合計）
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');

assert(html.indexOf('accounting_api.js?v=109') >= 0, 'cache bust v=109');
assert(html.indexOf('ledger_entry_map.js?v=2') >= 0, 'ledger map');
assert(html.indexOf('parseHistoryAmountQuery') >= 0, 'amount query normalizer');
assert(html.indexOf('id="histScope"') >= 0, 'scope select for boss');
assert(html.indexOf('>全部</option>') >= 0, 'all scope option');
assert(html.indexOf('canViewAllLedgerHistory') >= 0, 'scope gated by permission');
assert(html.indexOf('authSessionPerm()') >= 0, 'all-scope uses auth permission only');
assert(html.indexOf('權限更新中，請重新整理') >= 0, 'hub-ahead refresh hint');
assert(html.indexOf('readHistoryMineOnlyFlag') >= 0, 'mine_only from scope');
assert(html.indexOf('LedgerEntryMap.canViewAllLedger') >= 0, 'view-all via map');
assert(api.indexOf('authPerm < LEDGER_VIEW_ALL_MIN_PERMISSION') >= 0, 'api mine_only below 5');
assert(html.indexOf('historyTotals') >= 0, 'totals element');
assert(html.indexOf('attRef.payment_request_id') >= 0 ||
  html.indexOf('payment_request_id = pid') >= 0, 'payment attachments via payment_request_id');
assert(html.indexOf('renderHistoryAttachments(panel, merged)') >= 0, 'payment detail shows attachments');

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
