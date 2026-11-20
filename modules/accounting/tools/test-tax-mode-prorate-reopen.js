/**
 * 整張加稅分攤：存檔未稅基數／整張稅 → 重開還原 → 再套用總額不變
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

function sumAmt(rows) {
  return (rows || []).reduce(function (s, r) {
    return s + (parseInt(r.amount, 10) || 0);
  }, 0);
}

function roundTrip(Tax, pretaxRows, taxAmount, label, expectInclusiveSum) {
  // 畫面列為未稅（prevMode=prorate），存檔時才把稅加進各列
  var saved = Tax.applyModeToRows(pretaxRows, 'prorate', {
    prevMode: 'prorate',
    taxAmount: String(taxAmount)
  });
  var savedSum = sumAmt(saved);
  assert(savedSum === expectInclusiveSum, label + ' 存檔含稅合計 ' + expectInclusiveSum + '，得 ' + savedSum);
  saved.forEach(function (r, i) {
    assert(r._base_amount === pretaxRows[i].amount, label + ' 存檔列' + i + ' 保留未稅基數');
    assert(/〔未稅-?\d+〕/.test(String(r.item_desc || '')), label + ' 存檔列' + i + ' 品項寫〔未稅〕');
  });
  var note = Tax.syncProrateTaxNote(
    Tax.syncModeNote('', 'prorate'),
    taxAmount,
    'prorate'
  );
  assert(Tax.parseProrateTaxFromNote(note) === taxAmount, label + ' 備註寫【整張稅】');
  // 模擬審核重開：只帶回 amount／item_desc／note（無 _base_amount 記憶體）
  var loaded = saved.map(function (r) {
    return {
      project_no: r.project_no,
      amount: r.amount,
      item_desc: r.item_desc,
      note: r.note,
      tax_inclusive: true
    };
  });
  var taxFromNote = Tax.parseProrateTaxFromNote(note);
  var restored = Tax.restoreProratePretaxRows(loaded, {
    taxAmount: taxFromNote,
    paymentNote: note
  });
  pretaxRows.forEach(function (r, i) {
    assert(restored[i].amount === r.amount, label + ' 重開未稅列' + i + '＝' + r.amount + '，得 ' + restored[i].amount);
  });
  var again = Tax.applyModeToRows(restored, 'prorate', {
    prevMode: 'prorate',
    taxAmount: String(taxFromNote)
  });
  assert(sumAmt(again) === savedSum, label + ' 重開再套用總額不變：' + sumAmt(again) + '＝' + savedSum);
  again.forEach(function (r, i) {
    assert(r.amount === saved[i].amount, label + ' 列' + i + ' 金額還原 ' + r.amount);
  });
  return { saved: saved, restored: restored, again: again, note: note };
}

var root = path.resolve(__dirname, '../../..');
var src = fs.readFileSync(path.join(root, 'shared/js/accounting_tax_mode.js'), 'utf8');
var sandbox = { console: console };
vm.runInNewContext(src, sandbox);
var Tax = sandbox.AccountingTaxMode;

// —— 785／792（含舊資料：無〔未稅〕標記、僅 (含稅)）——
var legacySaved = [
  { project_no: '785', amount: 51539, item_desc: '請款 (含稅)', tax_inclusive: true, ocr_tax_inclusive: true },
  { project_no: '792', amount: 47450, item_desc: '請款 (含稅)', tax_inclusive: true, ocr_tax_inclusive: true }
];
var legacyRestored = Tax.restoreProratePretaxRows(legacySaved, { taxAmount: '' });
assert(legacyRestored[0].amount === 49085, '舊單 legacy #785 → 49085，得 ' + legacyRestored[0].amount);
assert(legacyRestored[1].amount === 45190, '舊單 legacy #792 → 45190，得 ' + legacyRestored[1].amount);
assert(sumAmt(Tax.applyModeToRows(legacyRestored, 'prorate', {
  prevMode: 'prorate',
  taxAmount: '4714'
})) === 98989, '舊單再套用仍 98989');

roundTrip(
  Tax,
  [
    { project_no: '785', amount: 49085, item_desc: '請款', tax_inclusive: false },
    { project_no: '792', amount: 45190, item_desc: '請款', tax_inclusive: false }
  ],
  4714,
  '785/792',
  98989
);

// —— 手填稅非 5%：未稅 1000、稅 100 → 1100（÷1.05 會錯）——
var non5 = roundTrip(
  Tax,
  [{ project_no: '1', amount: 1000, item_desc: 'A', tax_inclusive: false }],
  100,
  '非5%',
  1100
);
assert(non5.saved[0].amount === 1100, '非5% 存檔 1100');
assert(non5.restored[0].amount === 1000, '非5% 重開未稅 1000（不是 1048）');
assert(Tax.removeTax(1100) === 1048, '對照：÷1.05 會得 1048');

// —— 折讓：1000、−200，稅 40 → 合計 840 ——
var allow = roundTrip(
  Tax,
  [
    { project_no: '1', amount: 1000, item_desc: '出貨', tax_inclusive: false },
    { project_no: '9', amount: -200, item_desc: '折讓', tax_inclusive: false }
  ],
  40,
  '折讓',
  840
);
assert(allow.restored[1].amount === -200, '折讓列重開維持 −200');

// —— 捨入：未稅 1、1、8，稅 1 ——
var rnd = roundTrip(
  Tax,
  [
    { project_no: '1', amount: 1, item_desc: 'a', tax_inclusive: false },
    { project_no: '2', amount: 1, item_desc: 'b', tax_inclusive: false },
    { project_no: '3', amount: 8, item_desc: 'c', tax_inclusive: false }
  ],
  1,
  '捨入',
  11
);
assert(sumAmt(rnd.restored) === 10, '捨入重開未稅合計 10');

// —— 僅用【整張稅】、無〔未稅〕標記（舊列＋新稅註記）——
var byTaxOnly = Tax.restoreProratePretaxRows(
  [
    { amount: 1100, item_desc: '請款 (含稅)', tax_inclusive: true },
  ],
  { taxAmount: 100 }
);
assert(byTaxOnly[0].amount === 1000, '只靠整張稅還原 1000');

// —— summarize 與 prorateTax：淨額≤0 手填正稅 → 稅＝0 ——
assert(Tax.resolveProrateTax(-50, '100') === 0, '淨額負＋手填稅 → 0');
assert(Tax.summarize(
  [{ amount: -100 }, { amount: 50 }],
  'prorate',
  '20'
).tax === 0, 'summarize 淨額≤0 稅＝0');
assert(sumAmt(Tax.prorateTax(
  [{ amount: -100, item_desc: '折讓' }, { amount: 50, item_desc: 'A' }],
  '20'
)) === -50, 'prorateTax 淨額≤0 不加稅');

// —— 取消勾選含稅：金額不變（ledger_review onTaxInclusiveChange 只改標）——
function simulateUncheck(row) {
  return Object.assign({}, row, {
    tax_inclusive: false,
    item_desc: Tax.applyTaxTag(row.item_desc, false)
  });
}
function inferOcrIncLikeLedger(desc, taxInc, rowOcr) {
  // 對齊 ledger_review inferAllocRowTax：品項含稅 → ocrInc／uncheckFree 預設 true
  var ocrInc = false;
  if (desc.indexOf('含稅') >= 0) ocrInc = true;
  if (rowOcr != null) ocrInc = !!rowOcr;
  else if (!ocrInc && taxInc && desc.indexOf('含稅') >= 0) ocrInc = true;
  return ocrInc;
}

var inclusiveRow = { amount: 1050, tax_inclusive: true, item_desc: '木作 (含稅)' };
assert(inferOcrIncLikeLedger(inclusiveRow.item_desc, true, null) === true, 'inclusive：含稅字樣 → uncheckFree');
var afterInc = simulateUncheck(inclusiveRow);
assert(afterInc.amount === 1050, 'inclusive 取消勾選金額不變');

var perRow = Tax.applyModeToRows(
  [{ amount: 1000, tax_inclusive: false, item_desc: 'x' }],
  'per_row',
  { prevMode: 'inclusive' }
);
assert(perRow[0].amount === 1050, 'per_row 加稅後 1050');
assert(inferOcrIncLikeLedger(perRow[0].item_desc, true, null) === true, 'per_row：含稅字樣 → uncheckFree');
assert(simulateUncheck(perRow[0]).amount === 1050, 'per_row 取消勾選金額不變');

var mixed = [
  { amount: 1050, tax_inclusive: true, item_desc: '含 (含稅)' },
  { amount: 800, tax_inclusive: false, item_desc: '未' }
];
assert(inferOcrIncLikeLedger(mixed[0].item_desc, true, null) === true, '混合含稅列 uncheckFree');
assert(simulateUncheck(mixed[0]).amount === 1050, '混合含稅列取消勾選金額不變');
assert(mixed[1].amount === 800, '混合未稅列金額不變');

// 切換／存檔路徑：未稅畫面列不得被稅額倒扣
var pretaxUi = Tax.applyModeToRows(
  [{ amount: 1000, item_desc: 'A', tax_inclusive: false }],
  'prorate',
  { prevMode: 'prorate', displayOnly: true, taxAmount: '100' }
);
assert(pretaxUi[0].amount === 1000, 'prorate displayOnly 維持未稅 1000');

var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(/accounting_tax_mode\.js\?v=12/.test(pay) && /accounting_tax_mode\.js\?v=12/.test(rev), 'cache bust v=12');
assert(/restoreProratePretaxRows/.test(rev), 'ledger_review 重開走 restoreProratePretaxRows');
assert(/syncProrateTaxNote/.test(pay) && /syncProrateTaxNote/.test(rev), '存檔寫【整張稅】');
assert(/ocrInc\s*=\s*true/.test(rev), '含稅字樣仍可推 ocrInc（uncheckFree／非 prorate）');
assert(/只標記，不改金額/.test(rev) && /只標記，不改金額/.test(pay), '取消含稅只改標');

console.log('\nAll prorate-reopen restore checks passed.');
