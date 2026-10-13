/**
 * 前端快審清單：created_at 新→舊（對齊後端 quickReviewTimeMs_）
 * 執行：node modules/accounting/tools/test-quick-review-created-sort.js
 */
'use strict';
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '../quick_review.html'), 'utf8');
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

assert(html.indexOf('function createdAtMs') >= 0, 'createdAtMs helper');
assert(html.indexOf('sortItemsNewestFirst') >= 0, 'sortItemsNewestFirst');
assert(html.indexOf('sortItemsNewestFirst(data.items') >= 0, 'reload sorts items');
assert(html.indexOf('sortItemsNewestFirst(cached.items)') >= 0, 'cache path sorts');

// 抽出排序邏輯做數值驗
function createdAtMs(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && isFinite(v)) return v > 1e11 ? v : 0;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    var iso = m[1] + '-' + m[2] + '-' + m[3] + 'T' +
      (m[4].length === 1 ? '0' + m[4] : m[4]) + ':' + m[5] + ':' + (m[6] || '00');
    var t = Date.parse(iso);
    return isNaN(t) ? 0 : t;
  }
  var t2 = Date.parse(s);
  return isNaN(t2) ? 0 : t2;
}
function sortItemsNewestFirst(list) {
  return (list || []).slice().sort(function (a, b) {
    return createdAtMs(b.created_at) - createdAtMs(a.created_at);
  });
}
var sorted = sortItemsNewestFirst([
  { id: 'a', created_at: '2026-08-04 9:38:31' },
  { id: 'b', created_at: '2026-10-13 14:23:37' },
  { id: 'c', created_at: '2026-10-13 13:52:03' }
]);
assert(sorted[0].id === 'b' && sorted[1].id === 'c' && sorted[2].id === 'a', 'newest first');

console.log('OK test-quick-review-created-sort');
