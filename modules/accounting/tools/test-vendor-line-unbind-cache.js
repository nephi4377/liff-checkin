/**
 * 移除 LINE 綁定後，快取不可再 upsert 成仍有效
 * node modules/accounting/tools/test-vendor-line-unbind-cache.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var cacheSrc = fs.readFileSync(
  path.join(__dirname, '../../../shared/js/accounting_cache.js'),
  'utf8'
);
var vendorsSrc = fs.readFileSync(
  path.join(__dirname, '../vendors.html'),
  'utf8'
);

assert(/function removeMasterRow\s*\(/.test(cacheSrc), 'removeMasterRow helper');
assert(/res\.removed === true/.test(cacheSrc), 'afterCrudSuccess checks removed');
assert(/String\(row\.is_active \|\| ''\) === '否'/.test(cacheSrc), 'afterCrudSuccess checks is_active');
assert(/removeMasterRow\(session, entity, row\)/.test(cacheSrc), 'inactive binding deleted from cache');
assert(/AccountingCache\.removeMasterRow/.test(vendorsSrc), 'vendors.html drops cache row after remove');
assert(/立刻打 API，不必再按下方「更新」/.test(vendorsSrc), 'UX comment: remove is immediate');

console.log('ok: vendor line unbind cache');
