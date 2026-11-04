/**
 * 快審卡：來源代碼人話化；未知使用者顯示「來自{來源}」
 * 執行：node modules/accounting/tools/test-quick-review-source-label.js
 */
'use strict';
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '../quick_review.html'), 'utf8');
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

assert(html.indexOf('function sourceDisplayLabel') >= 0, 'sourceDisplayLabel helper');
assert(html.indexOf('function senderDisplayText') >= 0, 'senderDisplayText helper');
assert(html.indexOf('function isUnresolvedSender') >= 0, 'isUnresolvedSender helper');
assert(html.indexOf("c === 'accounting_group'") >= 0, 'maps accounting_group');
assert(html.indexOf("return '會計群組'") >= 0, 'accounting_group → 會計群組');
assert(html.indexOf("return 'LINE 廠商群'") >= 0, 'line_vendor → LINE 廠商群');
assert(html.indexOf('senderDisplayText(it)') >= 0, 'render uses senderDisplayText');
assert(html.indexOf('sourceDisplayLabel(it.source)') >= 0, 'render uses sourceDisplayLabel');
assert(html.indexOf("esc(it.source || '')") < 0, 'no longer dumps raw source code in tag');

function sourceDisplayLabel(code) {
  var c = String(code || '').trim();
  if (!c) return '';
  if (c === 'accounting_group') return '會計群組';
  if (c === 'invoice_group') return '轉貼群';
  if (c === 'line_vendor') return 'LINE 廠商群';
  if (c === 'line_group') return 'LINE 群組';
  if (c === 'line_dm') return 'LINE 私訊';
  if (c === 'staff_request') return '員工申請';
  return c;
}

function isUnresolvedSender(name) {
  var s = String(name || '').trim();
  if (!s) return true;
  if (s === '未知使用者' || s === '未知' || /^unknown/i.test(s)) return true;
  if (/^U[0-9a-fA-F]{32}$/.test(s)) return true;
  return false;
}

function senderDisplayText(it) {
  var who = String((it && it.created_by) || '').trim();
  var origin = sourceDisplayLabel(it && it.source);
  if (!isUnresolvedSender(who)) return who;
  if (origin) return '來自' + origin;
  return '未知來源';
}

assert(sourceDisplayLabel('accounting_group') === '會計群組', 'label accounting_group');
assert(sourceDisplayLabel('line_vendor') === 'LINE 廠商群', 'label line_vendor');
assert(sourceDisplayLabel('') === '', 'empty source');
assert(isUnresolvedSender('未知使用者'), '未知使用者 unresolved');
assert(isUnresolvedSender('U' + 'a'.repeat(32)), 'LINE uid unresolved');
assert(!isUnresolvedSender('郭振仁'), 'known name ok');
assert(
  senderDisplayText({ created_by: '未知使用者', source: 'accounting_group' }) === '來自會計群組',
  'unknown → 來自會計群組'
);
assert(
  senderDisplayText({ created_by: '郭振仁', source: 'line_vendor' }) === '郭振仁',
  'known name kept'
);
assert(
  senderDisplayText({ created_by: '', source: 'line_vendor' }) === '來自LINE 廠商群',
  'blank → 來自LINE 廠商群'
);

console.log('OK test-quick-review-source-label');
