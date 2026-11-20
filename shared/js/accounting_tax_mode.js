/**
 * 待付款稅別三模式（請款／審核共用）
 * inclusive＝未稅／含稅自選（金額不改，各列自己勾）；per_row＝逐筆×1.05；prorate＝整張稅比例分攤
 */
var AccountingTaxMode = (function () {
  var MODES = [
    { id: 'inclusive', label: '未稅／含稅自選' },
    { id: 'per_row', label: '未稅・逐筆加 5%' },
    { id: 'prorate', label: '未稅・整張加稅分攤' }
  ];
  var MODE_NOTE_MARKER = '【稅模式】';
  var PRORATE_TAX_NOTE_MARKER = '【整張稅】';
  var BASE_DESC_RE = /〔未稅(-?\d+)〕/;
  var BASE_NOTE_RE = /【未稅】(-?\d+)/;
  var TAX_RATE = 0.05;

  function parseAmount(v) {
    if (typeof AccountingAmountFormula !== 'undefined') {
      return AccountingAmountFormula.parseAmount(v);
    }
    var n = parseInt(String(v == null ? '' : v).replace(/[,，\s]/g, ''), 10);
    return isNaN(n) ? NaN : n;
  }

  function addTax(amt) {
    // 逐筆加稅：折讓負數不動（SPEC 23）
    if (isNaN(amt) || amt <= 0) return amt;
    return Math.round(amt * (1 + TAX_RATE));
  }

  function removeTax(amt) {
    // 含稅反推未稅：正負都適用（例 −285 → −271）；整張分攤重開勿用此路徑
    if (isNaN(amt) || amt === 0) return amt;
    return Math.round(amt / (1 + TAX_RATE));
  }

  function stripBaseMark(desc) {
    return String(desc || '').replace(/〔未稅-?\d+〕/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function embedBaseInDesc(desc, base) {
    var n = parseAmount(base);
    var s = stripBaseMark(desc);
    if (isNaN(n)) return s;
    return (s ? s + ' ' : '') + '〔未稅' + n + '〕';
  }

  function parseBaseFromDesc(desc) {
    var m = String(desc || '').match(BASE_DESC_RE);
    return m ? parseInt(m[1], 10) : NaN;
  }

  function encodeBaseInAllocNote(note, base) {
    var n = parseAmount(base);
    var stripped = String(note || '').replace(/【未稅】-?\d+/g, '').replace(/\s+/g, ' ').trim();
    if (isNaN(n)) return stripped;
    var line = '【未稅】' + n;
    return stripped ? stripped + ' ' + line : line;
  }

  function parseBaseFromAllocNote(note) {
    var m = String(note || '').match(BASE_NOTE_RE);
    return m ? parseInt(m[1], 10) : NaN;
  }

  /** 列上已存的未稅基數：_base_amount → 品項〔未稅N〕→ 分攤 note【未稅】N */
  function readStoredProrateBase(row) {
    row = row || {};
    if (row._base_amount != null && String(row._base_amount) !== '') {
      var stored = parseAmount(row._base_amount);
      if (!isNaN(stored)) return stored;
    }
    var fromDesc = parseBaseFromDesc(row.item_desc);
    if (!isNaN(fromDesc)) return fromDesc;
    var fromNote = parseBaseFromAllocNote(row.note);
    if (!isNaN(fromNote)) return fromNote;
    return NaN;
  }

  /**
   * 去掉畫面「(含稅)/(未稅)」標，保留 〔未稅N〕（勿讓 未稅 二字被剝成 〔1000〕）。
   */
  function stripTaxTag(desc) {
    var marks = [];
    var s = String(desc || '').replace(/〔未稅-?\d+〕/g, function (m) {
      marks.push(m);
      return '\uE000' + (marks.length - 1) + '\uE001';
    });
    s = s
      .replace(/\s*[（(]含稅[）)]\s*/g, ' ')
      .replace(/\s*[（(]未稅[）)]\s*/g, ' ')
      .replace(/(^|[\s　])含稅(?=[\s　]|$)/g, '$1')
      .replace(/(^|[\s　])未稅(?=[\s　]|$)/g, '$1');
    for (var i = 0; i < marks.length; i++) {
      s = s.replace('\uE000' + i + '\uE001', marks[i]);
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  /** 分攤存檔用：有 (含稅) 就標，否則清掉含稅標（可留 〔未稅N〕） */
  function applyTaxTag(desc, on) {
    var baseMark = '';
    var m = String(desc || '').match(/〔未稅-?\d+〕/);
    if (m) baseMark = m[0];
    var s = stripTaxTag(stripBaseMark(desc));
    if (on) s = (s ? s + ' ' : '') + '(含稅)';
    if (baseMark) s = (s ? s + ' ' : '') + baseMark;
    return s.trim();
  }

  /** 請款／審核勾選用：標成 (含稅) 或 (未稅)，保留 〔未稅N〕 */
  function formatInclusiveTaxTag(desc, inclusive) {
    var base = stripTaxTag(desc);
    var tag = inclusive ? '(含稅)' : '(未稅)';
    return base ? base + ' ' + tag : tag;
  }

  /** 對齊 onTaxInclusiveChange：只改標記，不改金額 */
  function setRowTaxInclusive(row, checked) {
    row = row || {};
    return Object.assign({}, row, {
      tax_inclusive: !!checked,
      item_desc: formatInclusiveTaxTag(row.item_desc, !!checked)
    });
  }

  function normalizeMode(raw) {
    var m = String(raw || '').trim();
    if (m === 'inclusive' || m === '已含稅' || m === '未稅／含稅自選' || m === '未稅/含稅自選' || m === '自選') return 'inclusive';
    if (m === 'per_row' || m === '逐筆' || m === '未稅逐筆' || m === '未稅・逐筆加 5%') return 'per_row';
    if (m === 'prorate' || m === '整張' || m === '整張分攤' || m === '未稅・整張加稅分攤') return 'prorate';
    return '';
  }

  function modeLabel(id) {
    var n = normalizeMode(id);
    for (var i = 0; i < MODES.length; i++) {
      if (MODES[i].id === n) return MODES[i].label;
    }
    return '';
  }

  /**
   * 整張稅：淨未稅≤0 → 稅＝0（即使手填正稅，與 prorateTax 一致，無處可分攤）。
   * 空白＝未稅淨合計×5%；手填優先（僅淨額>0）。
   */
  function resolveProrateTax(pretaxNet, taxAmount) {
    var base = pretaxNet || 0;
    if (base <= 0) return 0;
    var raw = String(taxAmount == null ? '' : taxAmount).trim();
    var tax = parseAmount(raw);
    if (raw === '' || isNaN(tax) || tax < 0) {
      return Math.round(base * TAX_RATE);
    }
    return tax;
  }

  /** 依目前列還原為「套用模式前」基數（已含稅列用反推未稅；整張分攤見 restoreProratePretaxRows） */
  function rowBaseAmount(row, prevMode) {
    var amt = parseAmount(row.amount);
    if (isNaN(amt)) return 0;
    var mode = normalizeMode(prevMode) || 'inclusive';
    if (mode === 'prorate') {
      var storedPr = readStoredProrateBase(row);
      if (!isNaN(storedPr)) return storedPr;
      // 整張分攤勿用 ÷1.05；無存檔基數時交由 restoreProratePretaxRows
      return amt;
    }
    if (amt < 0) {
      // 折讓含稅：自選模式下反推未稅；逐筆則金額不動
      if (mode === 'inclusive' && row.tax_inclusive) return removeTax(amt);
      return amt;
    }
    if (row._base_amount != null && String(row._base_amount) !== '') {
      var stored = parseAmount(row._base_amount);
      if (!isNaN(stored)) return stored;
    }
    if (mode === 'per_row' && (row.tax_add_applied || row.tax_inclusive)) {
      return removeTax(amt);
    }
    return amt;
  }

  /**
   * 舊單無未稅基數／整張稅時：以「整張含稅合計」反推稅額（勿逐列÷1.05，折讓會偏）。
   * 僅當再套用可還原原含稅額才採用（多為 5% 歷史單）。回傳 { rows, tax } 供稅欄回填。
   */
  function inferLegacyProratePretax(rows) {
    var list = rows || [];
    if (!list.length) return null;
    var inclusiveSum = 0;
    var i;
    for (i = 0; i < list.length; i++) {
      var amt = parseAmount(list[i].amount);
      if (isNaN(amt)) amt = 0;
      inclusiveSum += amt;
    }
    var pretaxNet = removeTax(inclusiveSum);
    var taxGuess = inclusiveSum - pretaxNet;
    if (taxGuess < 0) return null;
    var guess = restoreProratePretaxByTax(list, taxGuess);
    var reapplied = prorateTax(guess, taxGuess);
    for (i = 0; i < reapplied.length; i++) {
      if (parseAmount(reapplied[i].amount) !== parseAmount(list[i].amount)) return null;
    }
    return { rows: guess, tax: taxGuess };
  }

  function readOptsProrateTax(opts) {
    opts = opts || {};
    var taxRaw = opts.taxAmount;
    if (taxRaw == null || String(taxRaw).trim() === '') {
      return opts.paymentNote != null ? parseProrateTaxFromNote(opts.paymentNote) : NaN;
    }
    return parseAmount(taxRaw);
  }

  /** 含稅列合計 − 未稅基數合計 → 整張稅（缺【整張稅】時回填用） */
  function inferTaxFromInclusiveMinusBases(inclusiveRows, pretaxRows) {
    var inclusiveSum = 0;
    var baseSum = 0;
    var i;
    for (i = 0; i < (inclusiveRows || []).length; i++) {
      var inc = parseAmount(inclusiveRows[i].amount);
      if (isNaN(inc)) inc = 0;
      inclusiveSum += inc;
    }
    for (i = 0; i < (pretaxRows || []).length; i++) {
      var base = parseAmount(pretaxRows[i].amount);
      if (isNaN(base)) base = 0;
      baseSum += base;
    }
    var tax = inclusiveSum - baseSum;
    return tax >= 0 ? tax : NaN;
  }

  /**
   * 含稅分攤列 → 未稅列（勿用每列÷1.05）。
   * 優先：列上未稅基數；否則：含稅合計 − 已存稅額，再按正數列比例還原。
   * 若 opts 傳入物件，寫入 opts.restoredTax（供空白稅欄回填；失敗時為 0，避免再自動×5%）。
   */
  function restoreProratePretaxRows(rows, opts) {
    opts = opts || {};
    var list = rows || [];
    if (!list.length) return [];
    delete opts.restoredTax;

    var taxRaw = readOptsProrateTax(opts);

    var allHaveBase = true;
    var fromStored = list.map(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      var base = readStoredProrateBase(r);
      if (isNaN(base)) {
        allHaveBase = false;
        base = amt;
      }
      return Object.assign({}, r, {
        amount: base,
        _base_amount: base,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(embedBaseInDesc(r.item_desc, base), false),
        note: encodeBaseInAllocNote(r.note, base)
      });
    });
    if (allHaveBase) {
      if (!isNaN(taxRaw) && taxRaw >= 0) {
        opts.restoredTax = taxRaw;
      } else {
        // 有〔未稅〕／基數但缺【整張稅】：含稅合計 − 基數合計
        var inferred = inferTaxFromInclusiveMinusBases(list, fromStored);
        opts.restoredTax = !isNaN(inferred) ? inferred : 0;
      }
      return fromStored;
    }

    if (!isNaN(taxRaw) && taxRaw >= 0) {
      opts.restoredTax = taxRaw;
      return restoreProratePretaxByTax(list, taxRaw);
    }

    var legacy = inferLegacyProratePretax(list);
    if (legacy) {
      opts.restoredTax = legacy.tax;
      return legacy.rows;
    }

    // 無法安全還原：維持原含稅合計；稅欄回填 0，避免空白再自動×5% 加一次稅
    opts.restoredTax = 0;
    return list.map(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      return Object.assign({}, r, {
        amount: amt,
        _base_amount: amt,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(embedBaseInDesc(r.item_desc, amt), false),
        note: encodeBaseInAllocNote(r.note, amt)
      });
    });
  }

  /** 含稅總額 − 稅額＝未稅淨合計；正數列按含稅額比例分攤未稅，折讓列維持原額 */
  function restoreProratePretaxByTax(rows, tax) {
    var list = rows || [];
    var positives = [];
    var positiveSum = 0;
    var negSum = 0;
    var inclusiveSum = 0;
    list.forEach(function (r, i) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      inclusiveSum += amt;
      if (amt > 0) {
        positives.push({ i: i, amt: amt });
        positiveSum += amt;
      } else {
        negSum += amt;
      }
    });
    var pretaxNet = inclusiveSum - tax;
    var pretaxPosPool = pretaxNet - negSum;
    var out = list.map(function (r) {
      return Object.assign({}, r);
    });
    if (!positives.length || positiveSum <= 0 || pretaxPosPool < 0) {
      return restoreProratePretaxRowsFallbackNoTax(list);
    }
    var distributed = 0;
    positives.forEach(function (p, idx) {
      var share = (idx === positives.length - 1)
        ? pretaxPosPool - distributed
        : Math.round(pretaxPosPool * p.amt / positiveSum);
      distributed += share;
      out[p.i].amount = share;
      out[p.i]._base_amount = share;
      out[p.i].tax_inclusive = false;
      out[p.i].tax_add_applied = false;
      out[p.i].item_desc = applyTaxTag(embedBaseInDesc(out[p.i].item_desc, share), false);
      out[p.i].note = encodeBaseInAllocNote(out[p.i].note, share);
    });
    list.forEach(function (r, i) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      if (amt > 0) return;
      out[i].amount = amt;
      out[i]._base_amount = amt;
      out[i].tax_inclusive = false;
      out[i].tax_add_applied = false;
      out[i].item_desc = applyTaxTag(embedBaseInDesc(out[i].item_desc, amt), false);
      out[i].note = encodeBaseInAllocNote(out[i].note, amt);
    });
    return out;
  }

  function restoreProratePretaxRowsFallbackNoTax(list) {
    return (list || []).map(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      return Object.assign({}, r, {
        amount: amt,
        _base_amount: amt,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(r.item_desc, false)
      });
    });
  }

  /** 列是否已是「整張分攤後的含稅額」（重開要還原）。不可用「金額≠基數」判斷（使用者改未稅會誤判）。 */
  function rowLooksProrateTaxInclusive(row) {
    row = row || {};
    if (row.tax_inclusive) return true;
    if (/\(含稅\)|（含稅）/.test(String(row.item_desc || ''))) return true;
    return false;
  }

  function rowsNeedProrateRestore(rows) {
    for (var i = 0; i < (rows || []).length; i++) {
      if (rowLooksProrateTaxInclusive(rows[i])) return true;
    }
    return false;
  }

  /**
   * 畫面用：還原成未稅列（不加稅）。整張分攤時欄位應一直是未稅。
   * 注意：prevMode=prorate 且列已是未稅時，以欄位金額為基數（使用者改過就更新，勿鎖舊 〔未稅〕）。
   */
  function toPretaxRows(rows, prevMode, opts) {
    var prev = normalizeMode(prevMode) || '';
    if (prev === 'prorate') {
      if (rowsNeedProrateRestore(rows)) {
        return restoreProratePretaxRows(rows, opts || {});
      }
      return (rows || []).map(function (r) {
        var amt = parseAmount(r.amount);
        if (isNaN(amt)) amt = 0;
        // 未稅編輯中：欄位金額即基數
        return Object.assign({}, r, {
          amount: amt,
          _base_amount: amt,
          tax_inclusive: false,
          tax_add_applied: false,
          item_desc: applyTaxTag(embedBaseInDesc(r.item_desc, amt), false),
          note: encodeBaseInAllocNote(r.note, amt)
        });
      });
    }
    return (rows || []).map(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      var base = amt;
      if (amt !== 0) {
        if (prev === 'inclusive' && r.tax_inclusive) {
          base = removeTax(amt);
        } else if (amt > 0) {
          base = rowBaseAmount(r, prev || (r.tax_add_applied ? 'per_row' : 'inclusive'));
        } else {
          base = rowBaseAmount(r, prev || 'inclusive');
        }
      }
      return Object.assign({}, r, {
        amount: base,
        _base_amount: base,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(r.item_desc, false)
      });
    });
  }

  /** 未稅合計、稅金、含稅合計（整張分攤：稅金看欄位，不改列上數字） */
  function summarize(rows, mode, taxAmount) {
    var m = normalizeMode(mode) || 'inclusive';
    var pretax = 0;
    var payableShown = 0;
    (rows || []).forEach(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      payableShown += amt;
      if (m === 'prorate') {
        pretax += amt;
        return;
      }
      if (amt < 0) {
        // 折讓列：合計用填入金額（含稅折讓填 −285）；未稅反推只在列旁 hint
        pretax += amt;
        return;
      }
      var base = rowBaseAmount(r, m);
      pretax += isNaN(base) ? amt : base;
    });
    if (m === 'inclusive') {
      return { pretax: payableShown, tax: 0, payable: payableShown };
    }
    if (m === 'prorate') {
      var tax = resolveProrateTax(pretax, taxAmount);
      return { pretax: pretax, tax: tax, payable: pretax + tax };
    }
    return { pretax: pretax, tax: payableShown - pretax, payable: payableShown };
  }

  /**
   * 列旁「未稅」說明：整張分攤用真正基數，不要一律 ÷1.05（否則會和合計的稅金打架）。
   */
  function rowHintText(row, mode) {
    row = row || {};
    var amt = parseAmount(row.amount);
    if (isNaN(amt) || amt === 0) return '';
    var m = normalizeMode(mode) || 'inclusive';
    if (m === 'prorate') return '';
    if (!row.tax_inclusive && !row.tax_add_applied) return '';
    if (amt < 0) {
      return '未稅 $' + removeTax(amt).toLocaleString('zh-TW');
    }
    if (m === 'per_row') {
      var base = rowBaseAmount(row, m);
      if (isNaN(base) || base <= 0) base = removeTax(amt);
      return '未稅 $' + base.toLocaleString('zh-TW');
    }
    return '未稅 $' + removeTax(amt).toLocaleString('zh-TW');
  }

  /** 整張／逐筆加稅後，稅金和 5% 差太多時的人話（不擋送出） */
  function taxSanityMessage(pretax, tax, mode) {
    var m = normalizeMode(mode) || '';
    if (m !== 'prorate' && m !== 'per_row') return '';
    pretax = parseAmount(pretax);
    tax = parseAmount(tax);
    if (isNaN(pretax) || pretax <= 0 || isNaN(tax) || tax < 0) return '';
    var expected = Math.round(pretax * TAX_RATE);
    if (expected < 1) return '';
    var lo = Math.round(expected * 0.8);
    var hi = Math.round(expected * 1.2);
    if (tax >= lo && tax <= hi) return '';
    return '稅金 $' + tax.toLocaleString('zh-TW') +
      ' 和約 5%（$' + expected.toLocaleString('zh-TW') + '）差太多，請對過發票再核准';
  }

  function resolveRowPretaxBase(r) {
    var base = parseAmount(r.amount);
    if (isNaN(base)) base = 0;
    // 僅當列上已是含稅分攤額時，才改用存檔未稅基數（未稅編輯中以欄位為準）
    if (r.tax_inclusive || /\(含稅\)|（含稅）/.test(String(r.item_desc || ''))) {
      var stored = readStoredProrateBase(r);
      if (!isNaN(stored)) return stored;
    }
    return base;
  }

  function prorateTax(rows, taxAmount) {
    var positives = [];
    var positiveSum = 0;
    var net = 0;
    var bases = [];
    (rows || []).forEach(function (r, i) {
      var base = resolveRowPretaxBase(r);
      bases[i] = base;
      net += base;
      if (base > 0) {
        positives.push({ i: i, base: base });
        positiveSum += base;
      }
    });
    // 淨未稅≤0 或沒有正數列：不加稅；折讓列維持原未稅金額
    if (!positives.length || positiveSum <= 0 || net <= 0) {
      return (rows || []).map(function (r, i) {
        var base = bases[i];
        return Object.assign({}, r, {
          amount: base,
          _base_amount: base,
          tax_inclusive: false,
          tax_add_applied: false,
          item_desc: applyTaxTag(embedBaseInDesc(r.item_desc, base), false),
          note: encodeBaseInAllocNote(r.note, base)
        });
      });
    }
    var tax = resolveProrateTax(net, taxAmount);
    var distributed = 0;
    var out = (rows || []).map(function (r, i) {
      var base = bases[i];
      return Object.assign({}, r, {
        amount: base,
        _base_amount: base,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(embedBaseInDesc(r.item_desc, base), false),
        note: encodeBaseInAllocNote(r.note, base)
      });
    });
    // 稅池依淨合計算；分攤只進正數列（SPEC：按各案正數比例）
    positives.forEach(function (p, idx) {
      var share = (idx === positives.length - 1)
        ? tax - distributed
        : Math.round(tax * p.base / positiveSum);
      distributed += share;
      out[p.i].amount = p.base + share;
      out[p.i]._base_amount = p.base;
      out[p.i].item_desc = applyTaxTag(embedBaseInDesc(out[p.i].item_desc, p.base), true);
      out[p.i].note = encodeBaseInAllocNote(out[p.i].note, p.base);
      out[p.i].tax_inclusive = true;
      out[p.i].tax_add_applied = false;
    });
    return out;
  }

  /**
   * 將列套用稅別模式。prevMode 用於還原；taxAmount 僅 prorate 用。
   * displayOnly：整張分攤只還原未稅、不加進欄位（核准時才分攤）。
   */
  function applyModeToRows(rows, nextMode, opts) {
    opts = opts || {};
    var mode = normalizeMode(nextMode) || 'inclusive';
    var prev = normalizeMode(opts.prevMode) || '';

    if (mode === 'inclusive') {
      return (rows || []).map(function (r) {
        var amt = parseAmount(r.amount);
        if (isNaN(amt)) amt = 0;
        // 正負列都可標含稅（折讓現金折扣同廠商對帳單）
        var mark = amt !== 0 && !!r.tax_inclusive;
        return Object.assign({}, r, {
          amount: amt,
          _base_amount: amt,
          tax_inclusive: mark,
          tax_add_applied: false,
          item_desc: applyTaxTag(r.item_desc, mark)
        });
      });
    }

    var bases = toPretaxRows(
      rows,
      prev || (rows && rows[0] && rows[0].tax_add_applied ? 'per_row' : 'inclusive'),
      { taxAmount: opts.taxAmount, paymentNote: opts.paymentNote }
    );

    if (mode === 'per_row') {
      return bases.map(function (r) {
        var amt = parseAmount(r.amount);
        if (isNaN(amt) || amt <= 0) {
          return Object.assign({}, r, { tax_inclusive: false, tax_add_applied: false });
        }
        return Object.assign({}, r, {
          amount: addTax(amt),
          tax_inclusive: true,
          tax_add_applied: true,
          item_desc: applyTaxTag(r.item_desc, true)
        });
      });
    }

    if (opts.displayOnly) return bases;
    return prorateTax(bases, opts.taxAmount);
  }

  /** OCR 結果建議模式（對齊 SPEC 23） */
  function suggestModeFromOcr(ocr) {
    if (!ocr) return 'inclusive';
    if (ocr.is_tax_inclusive || (parseInt(ocr.tax_amount, 10) || 0) > 0) return 'inclusive';
    return 'prorate';
  }

  function syncModeNote(noteText, modeId) {
    var label = modeLabel(modeId);
    var cur = String(noteText || '');
    var stripped = cur.replace(/【稅模式】[^；\n]*/g, '').replace(/^[；\s]+|[；\s]+$/g, '').trim();
    if (!label) return stripped;
    var line = MODE_NOTE_MARKER + label;
    return stripped ? stripped + '；' + line : line;
  }

  /** 母單備註寫入／清除【整張稅】N（整張分攤存檔用） */
  function syncProrateTaxNote(noteText, taxAmount, modeId) {
    var cur = String(noteText || '');
    var stripped = cur.replace(/【整張稅】\d*/g, '').replace(/；{2,}/g, '；').replace(/^[；\s]+|[；\s]+$/g, '').trim();
    if (normalizeMode(modeId) !== 'prorate') return stripped;
    var tax = parseAmount(taxAmount);
    if (isNaN(tax) || tax < 0) return stripped;
    var line = PRORATE_TAX_NOTE_MARKER + tax;
    return stripped ? stripped + '；' + line : line;
  }

  function parseProrateTaxFromNote(noteText) {
    var m = String(noteText || '').match(/【整張稅】(\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  }

  function parseModeFromNote(noteText) {
    var m = String(noteText || '').match(/【稅模式】([^；\n]*)/);
    if (!m) return '';
    return normalizeMode(m[1]);
  }

  function segHtml(selectedId, namePrefix) {
    var prefix = namePrefix || 'taxMode';
    var cur = normalizeMode(selectedId) || 'inclusive';
    var html = '<div class="tax-mode-seg seg" data-tax-mode-wrap="1" role="radiogroup" aria-label="稅別模式">';
    // per_row 計算仍保留（舊單／廠商預設）；畫面上不再顯示「未稅・逐筆加 5%」選項
    MODES.forEach(function (m) {
      if (m.id === 'per_row') return;
      html += '<button type="button" class="' + (m.id === cur ? 'active' : '') + '" data-tax-mode="' + m.id + '" data-tax-mode-btn="' + prefix + '">' +
        m.label + '</button>';
    });
    html += '</div>';
    html += '<div class="tax-mode-prorate-row' + (cur === 'prorate' ? '' : ' hidden') + '" data-tax-prorate-wrap="1">' +
      '<label>稅金（填的時候各列都是未稅；稅只在這裡一次加。空白＝未稅合計×5%）</label>' +
      '<div class="row2"><input type="number" inputmode="numeric" class="inp-tax-amount" placeholder="可空白" />' +
      '<button type="button" class="btn btn-secondary btn-tax-5pct" style="margin-top:4px">未稅合計×5%</button></div></div>';
    return html;
  }

  return {
    MODES: MODES,
    MODE_NOTE_MARKER: MODE_NOTE_MARKER,
    PRORATE_TAX_NOTE_MARKER: PRORATE_TAX_NOTE_MARKER,
    parseAmount: parseAmount,
    addTax: addTax,
    removeTax: removeTax,
    stripTaxTag: stripTaxTag,
    applyTaxTag: applyTaxTag,
    formatInclusiveTaxTag: formatInclusiveTaxTag,
    setRowTaxInclusive: setRowTaxInclusive,
    normalizeMode: normalizeMode,
    modeLabel: modeLabel,
    applyModeToRows: applyModeToRows,
    toPretaxRows: toPretaxRows,
    restoreProratePretaxRows: restoreProratePretaxRows,
    inferLegacyProratePretax: inferLegacyProratePretax,
    resolveProrateTax: resolveProrateTax,
    rowBaseAmount: rowBaseAmount,
    readStoredProrateBase: readStoredProrateBase,
    summarize: summarize,
    rowHintText: rowHintText,
    taxSanityMessage: taxSanityMessage,
    prorateTax: prorateTax,
    suggestModeFromOcr: suggestModeFromOcr,
    syncModeNote: syncModeNote,
    syncProrateTaxNote: syncProrateTaxNote,
    parseProrateTaxFromNote: parseProrateTaxFromNote,
    parseModeFromNote: parseModeFromNote,
    embedBaseInDesc: embedBaseInDesc,
    parseBaseFromDesc: parseBaseFromDesc,
    encodeBaseInAllocNote: encodeBaseInAllocNote,
    parseBaseFromAllocNote: parseBaseFromAllocNote,
    segHtml: segHtml
  };
})();
