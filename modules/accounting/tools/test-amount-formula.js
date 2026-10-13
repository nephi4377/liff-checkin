/**
 * 金額 =算式：解析、預覽文案、頁面接線煙測
 * node modules/accounting/tools/test-amount-formula.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

var root = path.resolve(__dirname, '../../..');
var src = fs.readFileSync(path.join(root, 'shared/js/accounting_amount_formula.js'), 'utf8');
var sandbox = { console: console };
vm.runInNewContext(src, sandbox);
var F = sandbox.AccountingAmountFormula;

assert(F.parseAmount('1050') === 1050, 'plain int');
assert(F.parseAmount('1,050') === 1050, 'thousands comma');
assert(F.parseAmount('=1000+50') === 1050, 'add');
assert(F.parseAmount('=100*1.05') === 105, 'mul round');
assert(F.parseAmount('=(1000+50)*1.05') === 1103, 'parens round 1102.5→1103');
assert(F.parseAmount('=-30000') === -30000, 'unary minus');
assert(F.parseAmount('=1000-200-50') === 750, 'chain subtract');
assert(isNaN(F.parseAmount('=10/0')), 'div0 is NaN');
assert(isNaN(F.parseAmount('=1000+')), 'incomplete → NaN');
assert(isNaN(F.parseAmount('=alert(1)')), 'reject code');
assert(F.isFormula('=1+1') === true, 'isFormula true');
assert(F.isFormula('100') === false, 'isFormula false');
assert(F.previewText('=1000+50') === '結果 $1,050', 'preview ok: ' + F.previewText('=1000+50'));
assert(F.previewText('=1000+') === '算式有誤', 'preview error');
assert(F.previewText('1000') === '', 'no preview for plain');

var taxSrc = fs.readFileSync(path.join(root, 'shared/js/accounting_tax_mode.js'), 'utf8');
var taxBox = { console: console, AccountingAmountFormula: F };
vm.runInNewContext(taxSrc, taxBox);
assert(taxBox.AccountingTaxMode.parseAmount('=200+5') === 205, 'tax_mode uses formula parser');

var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
assert(pay.indexOf('accounting_amount_formula.js') >= 0, 'payment_request loads formula js');
assert(pay.indexOf('data-amount-formula') >= 0, 'payment_request marks amount fields');
assert(pay.indexOf('type="text"') >= 0 && pay.indexOf('inp-amt') >= 0, 'payment_request amt is text');

var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(rev.indexOf('accounting_amount_formula.js') >= 0, 'ledger_review loads formula js');

var sr = fs.readFileSync(path.join(root, 'modules/accounting/submit_records.html'), 'utf8');
assert(sr.indexOf('accounting_amount_formula.js') >= 0, 'submit_records loads formula js');
assert(sr.indexOf('data-amount-formula') >= 0, 'submit_records amount formula attr');

var ingest = fs.readFileSync(path.join(root, 'modules/accounting/accounting_ingest.html'), 'utf8');
assert(ingest.indexOf('accounting_amount_formula.js') >= 0, 'ingest loads formula js');

var helpers = fs.readFileSync(path.join(root, 'shared/js/accounting_form_helpers.js'), 'utf8');
assert(helpers.indexOf('AccountingAmountFormula') >= 0, 'form_helpers uses formula');
assert(helpers.indexOf('alloc-amt') >= 0 && helpers.indexOf('data-amount-formula') >= 0, 'form_helpers amt formula attr');

var css = fs.readFileSync(path.join(root, 'shared/css/accounting_layout.css'), 'utf8');
assert(css.indexOf('.amt-formula-preview') >= 0, 'css preview class');

console.log('All amount-formula checks passed.');
