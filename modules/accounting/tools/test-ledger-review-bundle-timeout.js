/**
 * Smoke: 請款審核「讀取審核包」逾時餘裕
 * node modules/accounting/tools/test-ledger-review-bundle-timeout.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

var root = path.resolve(__dirname, '../../..');
var cacheBust = require('./lib/read-cache-bust');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
var ui = fs.readFileSync(path.join(root, 'shared/js/accounting_ui.js'), 'utf8');

assert(/ledger_review_bundle:\s*'讀取審核包'/.test(ui), 'UI maps action to 讀取審核包');
assert(/action === 'ledger_review_bundle'[\s\S]*90000/.test(api) ||
  /ledger_review_bundle'\)[\s\S]{0,80}ms = 90000/.test(api),
  'ledger_review_bundle timeout 90s');
var apiVer = cacheBust.readCacheBustVersion(html, 'accounting_api.js');
assert(apiVer, 'api cache bust present');
assert(parseInt(apiVer, 10) >= 102, 'api cache bust >= v102 (got v=' + apiVer + ')');
assert(/ledgerReviewBundle/.test(html) && /ledger_review_bundle/.test(api),
  'page loads via ledgerReviewBundle');

console.log('\nAll ledger-review bundle timeout FE checks passed.');
