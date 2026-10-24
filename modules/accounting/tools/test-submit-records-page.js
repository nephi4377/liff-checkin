/**
 * Smoke: 送出紀錄＝新介面（主職改送審資料／同步審核；非歷史記帳改名）
 * node modules/accounting/tools/test-submit-records-page.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'submit_records.html'), 'utf8');
var index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var pay = fs.readFileSync(path.join(root, 'payment_request.html'), 'utf8');
var hist = fs.readFileSync(path.join(root, 'ledger_history.html'), 'utf8');
var api = fs.readFileSync(path.join(root, '../../shared/js/accounting_api.js'), 'utf8');
var spa = fs.readFileSync(path.join(root, '../../spa/app.js'), 'utf8');
var ui = fs.readFileSync(path.join(root, '../../shared/js/accounting_ui.js'), 'utf8');
var shell = fs.readFileSync(path.join(root, '../../shared/js/accounting_shell.js'), 'utf8');

assert(html.indexOf('<title>送出紀錄</title>') >= 0, 'page title');
assert(html.indexOf('新介面') >= 0, 'framed as new interface');
assert(html.indexOf('修改已送出的送審資料') >= 0, 'page hint leads with edit');
assert(html.indexOf('修改送審內容') >= 0, 'detail panel title edit-first');
assert(html.indexOf('找出要改的單') >= 0, 'filter card edit framing');
assert(html.indexOf('送審清單') >= 0, 'list card edit framing');
assert(html.indexOf('查已送出請款') < 0, 'no history-browser lead copy');
assert(html.indexOf('不是歷史記帳') >= 0 || html.indexOf('非歷史記帳') >= 0, 'not ledger-history rename');
assert(html.indexOf('record_kind: \'payment_request\'') >= 0, 'forces payment_request');
assert(html.indexOf('status_scope') >= 0, 'status_scope filter');
assert(html.indexOf('vendorPaymentUpdate') >= 0, 'edit via vendorPaymentUpdate');
assert(html.indexOf('已匯款') >= 0 && html.indexOf('鎖定') >= 0, 'paid lock copy');
assert(html.indexOf('submitted_by') >= 0, 'shows submitted_by');
assert(html.indexOf('include_allocations') >= 0, 'loads allocations');
assert(html.indexOf('accounting_api.js?v=111') >= 0, 'api cache bust v=111');
assert(html.indexOf('ledger_entry_map.js?v=5') >= 0, 'ledger map script');
assert(html.indexOf('canViewAllSubmitRecords') >= 0, 'view-all gated at boss perm');
assert(html.indexOf('readSubmitMineOnlyFlag') >= 0, 'mine_only respects permission');
assert(html.indexOf('data.mine_only !== undefined') >= 0, 'status label follows api mine_only');

assert(index.indexOf('linkSubmitRecords') < 0, 'hub card removed');
assert(index.indexOf('>送出紀錄<') < 0, 'hub has no 送出紀錄 label');
assert(index.indexOf('修改已送審請款') < 0, 'hub has no submit-records blurb');
assert(index.indexOf('submit_records.html') < 0, 'hub has no submit_records href');

assert(pay.indexOf('submit_records.html') >= 0, 'success card href');
assert(pay.indexOf('successSubmitRecordsLink') >= 0, 'success card submit-records id');
assert(pay.indexOf('id="navSubmitRecordsLink"') >= 0, 'payment_request header nav to 送出紀錄');
assert(pay.indexOf('>送出紀錄<') >= 0 || /textContent\s*=\s*'送出紀錄'/.test(pay), 'success card label 送出紀錄');
assert(pay.indexOf('successSubmitRecordsLink') < pay.indexOf('successReviewLink'), '送出紀錄 before 審核 on card');
assert(/id="successSubmitRecordsLink"[^>]*btn-primary|btn-primary[^>]*id="successSubmitRecordsLink"/.test(pay) ||
  pay.indexOf('id="successSubmitRecordsLink" href="submit_records.html">送出紀錄</a>') >= 0 &&
  /successSubmitRecordsLink[\s\S]{0,120}btn-primary/.test(pay) ||
  /btn-primary hidden" id="successSubmitRecordsLink"/.test(pay),
  'success card 送出紀錄 is primary CTA');
assert(pay.indexOf('查看歷史記帳紀錄') < 0, 'no ledger history on success card');
assert(pay.indexOf('查看送出紀錄') < 0, 'no 查看送出紀錄 wording');
assert(pay.indexOf('successHistoryLink') < 0, 'old history link id removed');
assert(pay.indexOf('下一步到「送出紀錄」可改送審內容') >= 0, 'success hint points to edit');

assert(hist.indexOf('histRecordKind" value="ledger"') >= 0 ||
  hist.indexOf("id=\"histRecordKind\" value=\"ledger\"") >= 0, 'history ledger-only');
assert(hist.indexOf('submit_records.html') >= 0, 'history points to submit records');
assert(hist.indexOf('id="navSubmitRecordsLink"') >= 0, 'ledger_history header nav to 送出紀錄');
assert(hist.indexOf('data-kind="payment_request"') < 0, 'history no payment tab');

var ingest = fs.readFileSync(path.join(root, 'accounting_ingest.html'), 'utf8');
assert(ingest.indexOf('id="navSubmitRecordsLink"') >= 0, 'ingest header nav to 送出紀錄');
assert(ingest.indexOf('submit_records.html') >= 0, 'ingest links submit records');
assert(ingest.indexOf('id="navLedgerHistoryLink"') >= 0 || ingest.indexOf('historyPageLink') >= 0,
  'ingest keeps 歷史記帳 sibling (not confused with 送出紀錄)');
assert(html.indexOf('id="navPaymentRequestLink"') >= 0, 'submit_records nav back to 請款');

assert(api.indexOf('opts.status_scope') >= 0, 'api status_scope');
assert(api.indexOf('opts.include_allocations') >= 0, 'api include_allocations');
assert(spa.indexOf('#/accounting/submit-records') >= 0, 'spa route');
assert(ui.indexOf("'submit_records.html': '送出紀錄'") >= 0, 'ui label');
assert(shell.indexOf("'submit_records.html': '送出紀錄'") >= 0, 'shell title');

console.log('OK test-submit-records-page');
