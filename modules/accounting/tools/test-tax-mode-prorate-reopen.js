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
var legacyOpts = { taxAmount: '' };
var legacyRestored = Tax.restoreProratePretaxRows(legacySaved, legacyOpts);
assert(legacyRestored[0].amount === 49085, '舊單 legacy #785 → 49085，得 ' + legacyRestored[0].amount);
assert(legacyRestored[1].amount === 45190, '舊單 legacy #792 → 45190，得 ' + legacyRestored[1].amount);
assert(legacyOpts.restoredTax === 4714, '舊單 legacy 回填整張稅 4714，得 ' + legacyOpts.restoredTax);
assert(sumAmt(Tax.applyModeToRows(legacyRestored, 'prorate', {
  prevMode: 'prorate',
  taxAmount: String(legacyOpts.restoredTax)
})) === 98989, '舊單再套用仍 98989');
assert(Tax.summarize(legacyRestored, 'prorate', String(legacyOpts.restoredTax)).payable === 98989,
  '舊單回填稅後應付 98989');

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

// —— 僅用【整張稅】、無〔未稅〕標記 ——
var byTaxOnly = Tax.restoreProratePretaxRows(
  [{ amount: 1100, item_desc: '請款 (含稅)', tax_inclusive: true }],
  { taxAmount: 100 }
);
assert(byTaxOnly[0].amount === 1000, '只靠整張稅還原 1000');

// —— 有〔未稅〕基數但缺【整張稅】：含稅合計−基數合計回填稅 ——
var baseNoTaxOpts = { taxAmount: '' };
var baseNoTax = Tax.restoreProratePretaxRows(
  [{ amount: 1100, item_desc: 'A (含稅) 〔未稅1000〕', tax_inclusive: true, note: '【未稅】1000' }],
  baseNoTaxOpts
);
assert(baseNoTax[0].amount === 1000, '有基數缺整張稅：重開未稅 1000');
assert(baseNoTaxOpts.restoredTax === 100, '有基數缺整張稅：回填稅 100，得 ' + baseNoTaxOpts.restoredTax);
assert(Tax.summarize(baseNoTax, 'prorate', String(baseNoTaxOpts.restoredTax)).payable === 1100,
  '有基數缺整張稅：應付維持 1100（不是空白×5%→1050）');
assert(Tax.summarize(baseNoTax, 'prorate', '').payable === 1050, '對照：空白稅欄會變成 1050');

// —— legacy 推算失敗（原稅 0、[10,10,1]）：稅欄回填 0，應付維持 21 ——
var legacyFailOpts = { taxAmount: '' };
var legacyFailRows = [
  { amount: 10, item_desc: 'a', tax_inclusive: true },
  { amount: 10, item_desc: 'b', tax_inclusive: true },
  { amount: 1, item_desc: 'c', tax_inclusive: true }
];
assert(Tax.inferLegacyProratePretax(legacyFailRows) === null, 'legacy [10,10,1] 推算失敗');
var legacyFail = Tax.restoreProratePretaxRows(legacyFailRows, legacyFailOpts);
assert(legacyFailOpts.restoredTax === 0, 'legacy 失敗回填稅 0，得 ' + legacyFailOpts.restoredTax);
assert(sumAmt(legacyFail) === 21, 'legacy 失敗維持原額合計 21');
assert(Tax.summarize(legacyFail, 'prorate', '0').payable === 21, 'legacy 失敗應付 21（稅=0）');
assert(Tax.summarize(legacyFail, 'prorate', '').payable === 22, '對照：空白稅欄會變成 22');
assert(sumAmt(Tax.applyModeToRows(legacyFail, 'prorate', {
  prevMode: 'prorate',
  taxAmount: '0'
})) === 21, 'legacy 失敗再存檔合計仍 21');

// —— 舊單沒標記又有折讓：含稅 1040、−200 → 未稅 1000、−200，稅 40，應付 840 ——
var legacyAllowSaved = [
  { project_no: '1', amount: 1040, item_desc: '出貨 (含稅)', tax_inclusive: true },
  { project_no: '9', amount: -200, item_desc: '折讓', tax_inclusive: false }
];
var legacyAllowOpts = { taxAmount: '' };
var legacyAllow = Tax.restoreProratePretaxRows(legacyAllowSaved, legacyAllowOpts);
assert(legacyAllow[0].amount === 1000, '舊單折讓重開未稅正列 1000，得 ' + legacyAllow[0].amount);
assert(legacyAllow[1].amount === -200, '舊單折讓重開未稅折讓 −200');
assert(legacyAllowOpts.restoredTax === 40, '舊單折讓回填稅 40，得 ' + legacyAllowOpts.restoredTax);
var legacyAllowPay = Tax.summarize(legacyAllow, 'prorate', String(legacyAllowOpts.restoredTax));
assert(legacyAllowPay.payable === 840, '舊單折讓應付 840，得 ' + legacyAllowPay.payable);
assert(legacyAllowPay.tax === 40, '舊單折讓稅欄 40（空白不會再×5% 成 830）');
assert(sumAmt(Tax.applyModeToRows(legacyAllow, 'prorate', {
  prevMode: 'prorate',
  taxAmount: String(legacyAllowOpts.restoredTax)
})) === 840, '舊單折讓再存檔合計仍 840');

// —— 重開後修改未稅金額再存檔：1000→2000、稅 100 → 應付 2100 ——
var reopenEdit = Tax.restoreProratePretaxRows(
  [{ amount: 1100, item_desc: 'A (含稅) 〔未稅1000〕', tax_inclusive: true, note: '【未稅】1000' }],
  { taxAmount: 100 }
);
assert(reopenEdit[0].amount === 1000, '修改前重開未稅 1000');
// 模擬使用者改金額：更新 amount，並同步基數（對齊 inp-amt oninput）
var edited = Object.assign({}, reopenEdit[0], {
  amount: 2000,
  _base_amount: 2000,
  item_desc: Tax.embedBaseInDesc(reopenEdit[0].item_desc, 2000),
  note: Tax.encodeBaseInAllocNote(reopenEdit[0].note, 2000),
  tax_inclusive: false
});
assert(!/\(含稅\)/.test(edited.item_desc), '改金額後非含稅列');
var editedSaved = Tax.applyModeToRows([edited], 'prorate', {
  prevMode: 'prorate',
  taxAmount: '100'
});
assert(editedSaved[0].amount === 2100, '改未稅 2000 再存檔含稅 2100，得 ' + editedSaved[0].amount);
assert(editedSaved[0]._base_amount === 2000, '改金額後基數更新為 2000');
assert(Tax.summarize([edited], 'prorate', '100').payable === 2100, '改金額後應付 2100');

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

// —— stripTaxTag 保護 〔未稅N〕 ——
assert(Tax.stripTaxTag('請款 〔未稅1000〕') === '請款 〔未稅1000〕', 'stripTaxTag 保留〔未稅1000〕');
assert(Tax.stripTaxTag('請款 (含稅) 〔未稅1000〕').indexOf('〔未稅1000〕') >= 0, 'stripTaxTag 去(含稅)留基數');
assert(Tax.stripTaxTag('請款 (含稅) 〔未稅1000〕').indexOf('〔1000〕') < 0, 'stripTaxTag 不可變成〔1000〕');
assert(Tax.formatInclusiveTaxTag('木作 〔未稅1000〕', false).indexOf('〔未稅1000〕') >= 0,
  'formatInclusiveTaxTag 保留基數');

// —— 取消勾選：呼叫實際 setRowTaxInclusive（對齊 onTaxInclusiveChange）——
function simulateUncheck(row) {
  return Tax.setRowTaxInclusive(row, false);
}
var inclusiveRow = { amount: 1050, tax_inclusive: true, item_desc: '木作 (含稅)' };
var afterInc = simulateUncheck(inclusiveRow);
assert(afterInc.amount === 1050, 'inclusive 取消勾選金額不變');
assert(afterInc.tax_inclusive === false, 'inclusive 取消後 tax_inclusive=false');
assert(/未稅/.test(afterInc.item_desc), 'inclusive 取消後標 (未稅)');

var perRow = Tax.applyModeToRows(
  [{ amount: 1000, tax_inclusive: false, item_desc: 'x' }],
  'per_row',
  { prevMode: 'inclusive' }
);
assert(perRow[0].amount === 1050, 'per_row 加稅後 1050');
var afterPer = simulateUncheck(perRow[0]);
assert(afterPer.amount === 1050, 'per_row 取消勾選金額不變');

var mixedInc = { amount: 1050, tax_inclusive: true, item_desc: '含 (含稅) 〔未稅1000〕' };
var mixedUn = { amount: 800, tax_inclusive: false, item_desc: '未' };
var afterMixed = simulateUncheck(mixedInc);
assert(afterMixed.amount === 1050, '混合含稅列取消勾選金額不變');
assert(afterMixed.item_desc.indexOf('〔未稅1000〕') >= 0, '混合取消勾選保留〔未稅〕');
assert(mixedUn.amount === 800, '混合未稅列金額不變');

// HTML 必須走 setRowTaxInclusive／保護 stripTaxTag
var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var rev = fs.readFileSync(path.join(root, 'modules/accounting/ledger_review.html'), 'utf8');
assert(/accounting_tax_mode\.js\?v=14/.test(pay) && /accounting_tax_mode\.js\?v=14/.test(rev), 'cache bust v=14');
assert(/setRowTaxInclusive/.test(pay) && /setRowTaxInclusive/.test(rev), 'onTaxInclusiveChange 呼叫 setRowTaxInclusive');
assert(/AccountingTaxMode\.stripTaxTag/.test(pay) && /AccountingTaxMode\.stripTaxTag/.test(rev), 'HTML stripTaxTag 走共用');
assert(/restoredTax/.test(rev), 'ledger_review 回填 restoredTax');
assert(/embedBaseInDesc/.test(pay) && /embedBaseInDesc/.test(rev), '改金額時更新〔未稅〕');
assert(/restoreProratePretaxRows/.test(rev), 'ledger_review 重開走 restoreProratePretaxRows');
assert(/syncProrateTaxNote/.test(pay) && /syncProrateTaxNote/.test(rev), '存檔寫【整張稅】');

// 切換／存檔路徑：未稅畫面列不得被稅額倒扣
var pretaxUi = Tax.applyModeToRows(
  [{ amount: 1000, item_desc: 'A', tax_inclusive: false }],
  'prorate',
  { prevMode: 'prorate', displayOnly: true, taxAmount: '100' }
);
assert(pretaxUi[0].amount === 1000, 'prorate displayOnly 維持未稅 1000');

console.log('\nAll prorate-reopen restore checks passed.');
