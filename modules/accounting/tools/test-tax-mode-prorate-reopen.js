/**
 * 整張加稅分攤：重開已存含稅分攤列時須反推未稅，不可再加一次稅
 * 情境：785/792 未稅 49085+45190、稅 4714 → 存檔 51539+47450；
 * 重開若誤把「(含稅)」當 OCR 原生含稅而不反推 → 畫面 103703（98989+4714）
 * node modules/accounting/tools/test-tax-mode-prorate-reopen.js
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

// 模擬審核頁：品項有 (含稅)、誤標 ocr_tax_inclusive（舊行為）
var savedWrongOcrFlag = [
  { project_no: '785', amount: 51539, item_desc: '請款 (含稅)', tax_inclusive: true, ocr_tax_inclusive: true },
  { project_no: '792', amount: 47450, item_desc: '請款 (含稅)', tax_inclusive: true, ocr_tax_inclusive: true }
];
var pretax = Tax.toPretaxRows(savedWrongOcrFlag, 'prorate');
assert(pretax[0].amount === 49085, '重開反推 #785 → 49085，得 ' + pretax[0].amount);
assert(pretax[1].amount === 45190, '重開反推 #792 → 45190，得 ' + pretax[1].amount);

var sumBlank = Tax.summarize(pretax, 'prorate', '');
assert(sumBlank.pretax === 94275, '重開未稅合計 94275');
assert(sumBlank.tax === 4714, '空白稅金＝94275×5% → 4714');
assert(sumBlank.payable === 98989, '重開支付合計 98989（非 103703）');

var sumFilled = Tax.summarize(pretax, 'prorate', '4714');
assert(sumFilled.payable === 98989, '手填稅 4714 仍 98989');

// 核准／儲存：再套用整張分攤應回到原含稅分攤，不可變成 10xxxx
var reapplied = Tax.applyModeToRows(pretax, 'prorate', { prevMode: 'prorate', taxAmount: '4714' });
var reSum = reapplied.reduce(function (s, r) { return s + r.amount; }, 0);
assert(reapplied[0].amount === 51539, '再分攤 #785 → 51539');
assert(reapplied[1].amount === 47450, '再分攤 #792 → 47450');
assert(reSum === 98989, '再分攤合計 98989，得 ' + reSum);

// 正確首次送出：畫面未稅 → 送出含稅分攤
var first = Tax.applyModeToRows(
  [
    { project_no: '785', amount: 49085, item_desc: '請款', tax_inclusive: false },
    { project_no: '792', amount: 45190, item_desc: '請款', tax_inclusive: false }
  ],
  'prorate',
  { prevMode: 'prorate', taxAmount: '4714' }
);
assert(first[0].amount === 51539 && first[1].amount === 47450, '首次送出分攤正確');

var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(!/ocrInc\s*=\s*true;\s*\n\s*\} else \{/.test(rev) ||
  rev.indexOf('不是 OCR 原生含稅') >= 0,
  'ledger_review 不再把品項含稅字樣當 OCR 原生');
assert(/accounting_tax_mode\.js\?v=11/.test(rev), 'cache bust v=11');

console.log('\nAll prorate-reopen double-tax checks passed.');
