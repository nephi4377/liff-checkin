/**
 * Smoke: 請款審核「報價對應查核」面板＋API wrapper
 * node modules/accounting/tools/test-vendor-payment-quote-audit-ui.js
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
var html = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/accounting_api\.js\?v=103/.test(html), 'api cache bump v=103');
assert(/報價對應查核/.test(html), 'panel title');
assert(/loadQuoteAuditForItem/.test(html), 'load helper');
assert(/renderQuoteAuditInto/.test(html), 'render helper');
assert(/vendorPaymentQuoteAudit/.test(html) && /vendorPaymentQuoteAudit/.test(api), 'API wired');
assert(/quoteLocalCacheUpsert/.test(api), 'upsert wrapper');
assert(/quote_local_cache_upsert/.test(api), 'upsert action');
assert(/vendor_payment_quote_audit/.test(api), 'audit action');
assert(/只顯示不寫回/.test(html), 'R0 copy');
assert(/quote_local_cache_upsert/.test(html), 'ingest hint in UI');
assert(/gross_margin_pct/.test(html) || /毛利/.test(html), 'margin display');
assert(/conf-pill/.test(html), 'confidence pills');

console.log('\nAll FE quote-audit UI smoke checks passed.');
