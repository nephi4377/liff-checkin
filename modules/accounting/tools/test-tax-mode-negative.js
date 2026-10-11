/**
 * 折讓負數含稅：未稅反推與自選模式標記（嘉義大林現金折扣例）
 * node modules/accounting/tools/test-tax-mode-negative.js
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
var src = fs.readFileSync(path.join(root, 'shared/js/accounting_tax_mode.js'), 'utf8');
var sandbox = { console: console };
vm.runInNewContext(src, sandbox);
var Tax = sandbox.AccountingTaxMode;

assert(Tax.removeTax(9400) === 8952, '正數含稅反推未稅 9400 → 8952');
assert(Tax.removeTax(-285) === -271, '負數含稅反推未稅 −285 → −271');
assert(Tax.removeTax(-271) === -258, '負數未稅誤勾含稅時仍按公式反推（保留號）');
assert(Tax.addTax(-271) === -271, '逐筆加稅不對折讓負數加成');
assert(Tax.addTax(8952) === 9400, '逐筆加稅正數 8952 → 9400');

var hintNeg = Tax.rowHintText({ amount: -285, tax_inclusive: true }, 'inclusive');
assert(hintNeg === '未稅 $-271' || hintNeg.indexOf('-271') >= 0, '列旁 hint 負數含稅 → −271：' + hintNeg);

var hintPos = Tax.rowHintText({ amount: 9400, tax_inclusive: true }, 'inclusive');
assert(hintPos.indexOf('8,952') >= 0 || hintPos.indexOf('8952') >= 0, '列旁 hint 正數含稅 → 8952：' + hintPos);

assert(Tax.rowHintText({ amount: -285, tax_inclusive: false }, 'inclusive') === '', '未勾含稅不顯示 hint');

var applied = Tax.applyModeToRows(
  [
    { project_no: '793', amount: 9400, tax_inclusive: true, item_desc: '出貨' },
    { project_no: '999', amount: -285, tax_inclusive: true, item_desc: '現金折扣' }
  ],
  'inclusive',
  { prevMode: 'inclusive' }
);
assert(applied[0].tax_inclusive === true && applied[0].amount === 9400, '自選模式正數保留含稅標記與金額');
assert(applied[1].tax_inclusive === true && applied[1].amount === -285, '自選模式負數保留含稅標記與金額');
assert(String(applied[1].item_desc).indexOf('含稅') >= 0, '負數品項標 (含稅)');

var pretax = Tax.toPretaxRows(applied, 'inclusive');
assert(pretax[0].amount === 8952, '切換還原：9400 含稅 → 未稅 8952');
assert(pretax[1].amount === -271, '切換還原：−285 含稅 → 未稅 −271');
assert(pretax[1].tax_inclusive === false, '還原後清含稅標記');

var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(!/taxDisabled\s*=\s*!isNaN\(amt\)\s*&&\s*amt\s*<\s*0/.test(pay), 'payment_request 不再因負數禁用含稅');
assert(!/taxDisabled\s*=\s*!isNaN\(amt\)\s*&&\s*amt\s*<\s*0/.test(rev), 'ledger_review 不再因負數禁用含稅');
assert(!/setTaxControlsDisabled\(row,\s*!isNaN\(a\)\s*&&\s*a\s*<\s*0\)/.test(pay), 'payment_request 輸入時不禁用含稅');
assert(!/setTaxControlsDisabled\(row,\s*!isNaN\(a\)\s*&&\s*a\s*<\s*0\)/.test(rev), 'ledger_review 輸入時不禁用含稅');
assert(/accounting_tax_mode\.js\?v=7/.test(pay) && /accounting_tax_mode\.js\?v=7/.test(rev), 'cache bust v=7');

console.log('\nAll negative tax-inclusive checks passed.');
