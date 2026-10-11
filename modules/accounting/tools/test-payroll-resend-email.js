/**
 * Smoke: 薪資待匯款頁有「補寄 EMAIL」並呼叫 notify API
 * 執行：node modules/accounting/tools/test-payroll-resend-email.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, '..', 'payroll_finance.html'), 'utf8');
assert(html.indexOf('已發薪 · 補寄 EMAIL') >= 0, '需有補寄區塊標題');
assert(html.indexOf('loadResendList') >= 0, '需載入已發薪補寄清單');
assert(html.indexOf('runResendPayslip') >= 0, '需有補寄動作');
assert(html.indexOf('payrollRequestNotifyPayslip') >= 0, '需呼叫補寄 API');
assert(html.indexOf('payment_status: \'已匯款\'') >= 0 ||
  html.indexOf('payment_status: "已匯款"') >= 0, '補寄清單應查已匯款');
assert(html.indexOf('manual_required') >= 0, '補寄失敗應可顯示手動草稿');

var api = fs.readFileSync(path.join(__dirname, '../../../shared/js/accounting_api.js'), 'utf8');
assert(api.indexOf('payroll_request_notify_payslip') >= 0, 'accounting_api 需有 notify action');

console.log('ok: payroll-resend-email');
