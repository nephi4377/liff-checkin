/**
 * Smoke: 請款審核 AI 預審 123.1／123.2／123.3＋直送待匯款 ≥5
 * node modules/accounting/tools/test-ai-preaudit-review-banner.js
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
var review = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/ai-preaudit/.test(review), 'review has ai-preaudit styles');
assert(/aiPreauditBannerHtml/.test(review), 'review banner helper');
assert(/預審尚未完成，可直接審/.test(review), '123.1 missing copy');
assert(/item\.ai_preaudit/.test(review), 'reads item.ai_preaudit');
var apiVer = cacheBust.readCacheBustVersion(review, 'accounting_api.js');
assert(apiVer, 'review api cache bust present');
assert(parseInt(apiVer, 10) >= 105, 'review api cache bust >= v105 (got v=' + apiVer + ')');
assert(!/載入報價對應/.test(review), 'no #140 button-as-product UX');
assert(!/btn-quote-audit/.test(review), 'no quote-audit button class');

// 123.2
assert(/aiEvidenceTableHtml/.test(review), '123.2 evidence table helper');
assert(/手填 vs 圖／報價/.test(review), '123.2 side-by-side title');
assert(/jumpToAiRedRows/.test(review), '123.2 jump to red');
assert(/btn-jump-red|data-jump-red/.test(review), '123.2 jump button');
assert(/ai-ev-table/.test(review), '123.2 table class');

// 123.3
assert(/aiPreauditDisagrees/.test(review), '123.3 disagree helper');
assert(/maybeAskAiOverrideReason/.test(review), '123.3 optional reason prompt');
assert(/inp-ai-override/.test(review), '123.3 override input');
assert(/與 AI 判斷不同時的短原因/.test(review), '123.3 override label');
assert(/ai_override_reason/.test(api), 'API sends ai_override_reason');
assert(/skipOverridePrompt/.test(review), 'avoid double prompt');

assert(/VENDOR_PAYMENT_APPROVE_MIN_PERMISSION/.test(pay), 'finance gate uses approve min');
assert(/略過 AI／人審/.test(pay), 'finance button copy mentions skip AI');
assert(/cache-bust companions:.*\?v=\d+/.test(api), 'api cache-bust comment');

console.log('\nAll ai-preaudit review UX smoke checks passed.');
