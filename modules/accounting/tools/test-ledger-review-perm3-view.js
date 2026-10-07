/**
 * 請款審核：權限 3 可檢視、寫入仍 ≥5（靜態對照）
 * node modules/accounting/tools/test-ledger-review-perm3-view.js
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
var index = fs.readFileSync(path.join(root, 'modules/accounting/index.html'), 'utf8');
var hub = fs.readFileSync(path.join(root, 'spa/HubLeftSidebar.js'), 'utf8');
var app = fs.readFileSync(path.join(root, 'spa/app.js'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/minPermission:\s*AccountingApi\.SUPERVISOR_MIN_PERMISSION/.test(review), 'ledger_review boot ≥3');
assert(/查看詳情/.test(review), 'ledger_review has view-only detail button');
assert(/檢視模式：核准需權限 ≥ 5/.test(review), 'ledger_review vendor view-only hint');
assert(/applyPanelViewOnly/.test(review), 'ledger_review disables write controls in view-only');
assert(/檢視 ≥3 · 核准 ≥5/.test(index), 'menu tag shows view ≥3 / approve ≥5');
assert(/linkLedgerReview/.test(index) && /reviewLink\.classList\.remove\('hidden'\)/.test(index),
  'menu shows ledger review for supervisor section');
assert(/hasPaymentSection = computed\(\(\) => perm\.value >= 3\)/.test(hub), 'hub payment section ≥3');
assert(/showPendingReview = computed\(\(\) => perm\.value >= 3\)/.test(hub), 'hub pending review ≥3');
assert(/if \(perm < 3\)/.test(app) && /vendor_payment_list[\s\S]*pending_review/.test(app),
  'hub fetch pending_review from ≥3');
assert(/VENDOR_PAYMENT_APPROVE_MIN_PERMISSION = 5/.test(api), 'approve threshold still 5');
assert(/SUPERVISOR_MIN_PERMISSION = 3/.test(api), 'supervisor view threshold 3');

console.log('\nAll ledger-review perm3 view checks passed.');
