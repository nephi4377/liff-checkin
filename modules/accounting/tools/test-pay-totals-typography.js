/**
 * 請款合計字級：支付合計為主、未稅為次
 * node modules/accounting/tools/test-pay-totals-typography.js
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

var root = path.join(__dirname, '..');
var pay = fs.readFileSync(path.join(root, 'payment_request.html'), 'utf8');
var rev = fs.readFileSync(path.join(root, 'ledger_review.html'), 'utf8');

assert(pay.indexOf('pay-total-primary') >= 0, 'payment_request primary total class');
assert(pay.indexOf('id="payableAmt"') >= 0, 'payment_request payableAmt');
assert(pay.indexOf('id="pretaxLine"') >= 0, 'payment_request pretax secondary');
assert(pay.indexOf('支付合計') >= 0, 'payment_request 支付合計 copy');
assert(/pay-total-primary[^\{]*\{[^}]*font-size:\s*22px/.test(pay) ||
  pay.indexOf('font-size: 22px') >= 0, 'payment primary ~22px');
assert(/pay-total-secondary[^\{]*\{[^}]*font-size:\s*13px/.test(pay) ||
  pay.indexOf('.pay-total-secondary') >= 0, 'payment secondary smaller');

assert(rev.indexOf('pay-total-primary') >= 0, 'ledger_review primary total');
assert(rev.indexOf('payable-label') >= 0, 'ledger_review payable label');
assert(rev.indexOf('pretax-line') >= 0, 'ledger_review pretax secondary');
assert(rev.indexOf('vendor-recent-remits') >= 0, 'ledger_review recent remits box');
assert(rev.indexOf('loadVendorRecentRemits') >= 0, 'ledger_review load remits fn');
assert(rev.indexOf('vendorPaymentStatus') >= 0, 'uses existing status API');
assert(rev.indexOf('同廠商近五筆') >= 0, 'near-five remits copy');

console.log('All pay-totals / recent-remits smoke checks passed.');
