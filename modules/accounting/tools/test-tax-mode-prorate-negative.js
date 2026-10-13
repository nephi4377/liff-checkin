/**
 * 整張稅（prorate）：未稅淨合計×5%，折讓負數須計入稅基
 * 例：8952 + (−271) → 稅 434、含稅合計 9115（勿算成只加正數的 448／9129）
 * node modules/accounting/tools/test-tax-mode-prorate-negative.js
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

var rows = [
  { project_no: '793', amount: 8952, item_desc: '出貨' },
  { project_no: '999', amount: -271, item_desc: '現金折扣' }
];

assert(Tax.resolveProrateTax(8681, '') === 434, '空白稅金：淨未稅 8681×5% → 434');
assert(Tax.resolveProrateTax(8952, '') === 448, '僅正數基數仍可得 448（對照誤算）');
assert(Tax.resolveProrateTax(0, '') === 0, '淨額 0 → 稅 0');
assert(Tax.resolveProrateTax(-100, '') === 0, '淨額負 → 稅 0');
assert(Tax.resolveProrateTax(8681, '400') === 400, '手填稅金優先');

var sumBlank = Tax.summarize(rows, 'prorate', '');
assert(sumBlank.pretax === 8681, 'summarize 未稅淨合計 8681：' + sumBlank.pretax);
assert(sumBlank.tax === 434, 'summarize 空白稅＝434（非 448）：' + sumBlank.tax);
assert(sumBlank.payable === 9115, 'summarize 含稅合計 9115：' + sumBlank.payable);

var sumFilled = Tax.summarize(rows, 'prorate', '434');
assert(sumFilled.tax === 434 && sumFilled.payable === 9115, '手填 434 合計 9115');

var applied = Tax.prorateTax(rows, '');
assert(applied[0].amount === 9386, '正數列 8952＋434 → 9386：' + applied[0].amount);
assert(applied[1].amount === -271, '折讓列不加稅、維持 −271：' + applied[1].amount);
assert(String(applied[0].item_desc).indexOf('含稅') >= 0, '正數列標含稅');
assert(String(applied[1].item_desc).indexOf('含稅') < 0, '折讓列不標含稅');
assert(applied[0].amount + applied[1].amount === 9115, '分攤後合計 9115');

var multi = Tax.prorateTax(
  [
    { amount: 5000, item_desc: 'A' },
    { amount: 4000, item_desc: 'B' },
    { amount: -500, item_desc: '折讓' }
  ],
  ''
);
var multiSum = multi.reduce(function (s, r) { return s + r.amount; }, 0);
assert(multiSum === 8500 + 425, '兩正一負：淨 8500＋稅 425＝8925，得 ' + multiSum);
assert(multi[2].amount === -500, '多案折讓維持 −500');

var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(/accounting_tax_mode\.js\?v=10/.test(pay) && /accounting_tax_mode\.js\?v=10/.test(rev), 'cache bust v=10');
assert(!/a\s*>\s*0\)\s*pretax\s*\+=/.test(pay), 'payment_request ×5% 不再只加正數');
assert(!/a\s*>\s*0\)\s*pretax\s*\+=/.test(rev), 'ledger_review ×5% 不再只加正數');
assert(/summarize\(readAllocRows\(\),\s*'prorate',\s*''\)/.test(pay), 'payment ×5% 走 summarize');
assert(/summarize\(readAllocRowsFromPanel\(panel\),\s*'prorate',\s*''\)/.test(rev), 'review ×5% 走 summarize');

console.log('\nAll prorate+negative allowance checks passed.');
