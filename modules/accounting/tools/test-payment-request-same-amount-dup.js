/**
 * Smoke: 待付款請款同廠商同金額軟提醒（無瀏覽器）
 * node modules/accounting/tools/test-payment-request-same-amount-dup.js
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

var html = fs.readFileSync(
  path.resolve(__dirname, '../payment_request.html'),
  'utf8'
);
var review = fs.readFileSync(
  path.resolve(__dirname, '../ledger_review.html'),
  'utf8'
);
var api = fs.readFileSync(
  path.resolve(__dirname, '../../../shared/js/accounting_api.js'),
  'utf8'
);

assert(html.indexOf('needs_dup_confirm') >= 0, 'payment_request handles needs_dup_confirm');
assert(html.indexOf('askDupConfirm') >= 0, 'payment_request in-page dup confirm');
assert(html.indexOf('force_duplicate') >= 0, 'payment_request resubmits with force_duplicate');
assert(html.indexOf('同廠商同金額提醒') >= 0, 'chinese dialog title');
assert(html.indexOf('繼續送出') >= 0, 'continue CTA');
assert(/accounting_api\.js\?v=113/.test(html), 'payment_request api cache bust');

assert(review.indexOf('needs_dup_confirm') >= 0, 'ledger_review handles needs_dup_confirm');
assert(review.indexOf('force_duplicate') >= 0, 'ledger_review approve force_duplicate');
assert(/accounting_api\.js\?v=113/.test(review), 'ledger_review api cache bust');

assert(/paymentRequestSubmit[\s\S]*force_duplicate/.test(api) ||
  /force_duplicate[\s\S]*payment_request_submit/.test(api),
  'api paymentRequestSubmit passes force_duplicate');
assert(/vendorPaymentApprove[\s\S]*force_duplicate/.test(api),
  'api vendorPaymentApprove passes force_duplicate');

console.log('\nAll payment-request same-amount-dup smoke checks passed.');
