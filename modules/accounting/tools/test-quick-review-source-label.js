/**
 * 快審卡：來源用真實群名；不硬編「會計群組」、不顯示「未知使用者」
 * 執行：node modules/accounting/tools/test-quick-review-source-label.js
 */
'use strict';
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '../quick_review.html'), 'utf8');
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

assert(html.indexOf('function originDisplayLabel') >= 0, 'originDisplayLabel helper');
assert(html.indexOf('function senderDisplayText') >= 0, 'senderDisplayText helper');
assert(html.indexOf("return '會計群組'") < 0, 'must not hardcode 會計群組');
assert(html.indexOf("return '來自'") < 0 && html.indexOf("'來自' +") < 0, 'must not invent 來自{來源}');
assert(html.indexOf('origin_label') >= 0, 'reads origin_label');
assert(html.indexOf('senderDisplayText(it)') >= 0, 'render uses senderDisplayText');

function isUnresolvedSender(name) {
  var s = String(name || '').trim();
  if (!s) return true;
  if (s === '未知使用者' || s === '未知' || s === '未知來源' || s === '會計群組') return true;
  if (/^unknown/i.test(s)) return true;
  if (/^來自/.test(s)) return true;
  if (/^U[0-9a-fA-F]{32}$/.test(s)) return true;
  return false;
}

function originDisplayLabel(it) {
  var o = String((it && (it.origin_label || it.line_group_name)) || '').trim();
  if (o && !isUnresolvedSender(o)) return o;
  return String((it && it.source) || '').trim();
}

function senderDisplayText(it) {
  var who = String((it && it.created_by) || '').trim();
  if (isUnresolvedSender(who)) return '';
  return who;
}

assert(isUnresolvedSender('未知使用者'), '未知 unresolved');
assert(isUnresolvedSender('會計群組'), '會計群組 fake');
assert(isUnresolvedSender('來自會計群組'), '來自… fake');
assert(!isUnresolvedSender('郭振仁'), 'real name');

assert(
  originDisplayLabel({
    origin_label: '進出款項討論',
    source: 'accounting_group',
    created_by: '未知使用者'
  }) === '進出款項討論',
  'real group name wins'
);
assert(
  originDisplayLabel({
    origin_label: '',
    line_group_name: '',
    source: 'accounting_group'
  }) === 'accounting_group',
  'raw source last resort'
);
assert(
  originDisplayLabel({ origin_label: '會計群組', source: 'accounting_group' }) === 'accounting_group',
  'reject invented 會計群組 → fall back to code'
);
assert(
  senderDisplayText({ created_by: '未知使用者', origin_label: '進出款項討論' }) === '',
  'no 未知 in time line'
);
assert(
  senderDisplayText({ created_by: '來自會計群組' }) === '',
  'legacy 來自… hidden'
);
assert(senderDisplayText({ created_by: '郭振仁' }) === '郭振仁', 'keep real person');

console.log('OK test-quick-review-source-label');
