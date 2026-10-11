/**
 * Smoke: 請款審核 AI 預審橫幅（123.1）＋直送待匯款 ≥5
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
var review = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/ai-preaudit/.test(review), 'review has ai-preaudit styles');
assert(/aiPreauditBannerHtml/.test(review), 'review banner helper');
assert(/預審尚未完成，可直接審/.test(review), '123.1 missing copy');
assert(/item\.ai_preaudit/.test(review), 'reads item.ai_preaudit');
assert(/accounting_api\.js\?v=104/.test(review), 'review api v=104');
assert(!/載入報價對應/.test(review), 'no #140 button-as-product UX');
assert(!/btn-quote-audit/.test(review), 'no quote-audit button class');

assert(/VENDOR_PAYMENT_APPROVE_MIN_PERMISSION/.test(pay), 'finance gate uses approve min');
assert(/略過 AI／人審/.test(pay), 'finance button copy mentions skip AI');
assert(/accounting_api\.js\?v=104/.test(pay), 'payment_request api v=104');
assert(/v=104（AI 預審橫幅）/.test(api), 'api cache-bust comment');

console.log('\nAll ai-preaudit review banner smoke checks passed.');
