/**
 * 待付款稅別三模式（請款／審核共用）
 * inclusive＝已含稅只標不改；per_row＝逐筆×1.05；prorate＝整張稅比例分攤
 */
var AccountingTaxMode = (function () {
  var MODES = [
    { id: 'inclusive', label: '已含稅' },
    { id: 'per_row', label: '未稅・逐筆加 5%' },
    { id: 'prorate', label: '未稅・整張加稅分攤' }
  ];
  var MODE_NOTE_MARKER = '【稅模式】';
  var TAX_RATE = 0.05;

  function parseAmount(v) {
    var n = parseInt(String(v == null ? '' : v).replace(/[,，\s]/g, ''), 10);
    return isNaN(n) ? NaN : n;
  }

  function addTax(amt) {
    if (isNaN(amt) || amt <= 0) return amt;
    return Math.round(amt * (1 + TAX_RATE));
  }

  function removeTax(amt) {
    if (isNaN(amt) || amt <= 0) return amt;
    return Math.round(amt / (1 + TAX_RATE));
  }

  function applyTaxTag(desc, on) {
    var s = String(desc || '').replace(/\s*[（(]含稅[）)]\s*/g, ' ').trim();
    if (on) s = (s ? s + ' ' : '') + '(含稅)';
    return s.trim();
  }

  function normalizeMode(raw) {
    var m = String(raw || '').trim();
    if (m === 'inclusive' || m === '已含稅') return 'inclusive';
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

  /** 依目前列還原為「套用模式前」基數（已含稅列用反推未稅） */
  function rowBaseAmount(row, prevMode) {
    var amt = parseAmount(row.amount);
    if (isNaN(amt)) return 0;
    if (amt < 0) return amt;
    if (row._base_amount != null && String(row._base_amount) !== '') {
      var stored = parseAmount(row._base_amount);
      if (!isNaN(stored)) return stored;
    }
    var mode = normalizeMode(prevMode) || 'inclusive';
    if (mode === 'per_row' && (row.tax_add_applied || row.tax_inclusive)) {
      return removeTax(amt);
    }
    if (mode === 'prorate' && row.tax_inclusive && !row.ocr_tax_inclusive) {
      return removeTax(amt);
    }
    return amt;
  }

  /**
   * 畫面用：還原成未稅列（不加稅）。整張分攤時欄位應一直是未稅。
   */
  function toPretaxRows(rows, prevMode) {
    var prev = normalizeMode(prevMode) || '';
    return (rows || []).map(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      var base = amt;
      if (amt > 0) {
        if (prev === 'inclusive' && r.tax_inclusive) {
          base = removeTax(amt);
        } else {
          base = rowBaseAmount(r, prev || (r.tax_add_applied ? 'per_row' : 'inclusive'));
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

  function resolveProrateTax(pretaxPositive, taxAmount) {
    var raw = String(taxAmount == null ? '' : taxAmount).trim();
    var tax = parseAmount(raw);
    if (raw === '' || isNaN(tax) || tax < 0) {
      return Math.round((pretaxPositive || 0) * TAX_RATE);
    }
    return tax;
  }

  /** 未稅合計、稅金、含稅合計（整張分攤：稅金看欄位，不改列上數字） */
  function summarize(rows, mode, taxAmount) {
    var m = normalizeMode(mode) || 'inclusive';
    var pretax = 0;
    var pretaxPos = 0;
    var payableShown = 0;
    (rows || []).forEach(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      payableShown += amt;
      if (m === 'prorate') {
        pretax += amt;
        if (amt > 0) pretaxPos += amt;
        return;
      }
      if (amt < 0) {
        pretax += amt;
        return;
      }
      var base = rowBaseAmount(r, m);
      pretax += isNaN(base) ? amt : base;
      if (base > 0) pretaxPos += isNaN(base) ? amt : base;
    });
    if (m === 'inclusive') {
      return { pretax: payableShown, tax: 0, payable: payableShown };
    }
    if (m === 'prorate') {
      var tax = resolveProrateTax(pretaxPos, taxAmount);
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
    if (isNaN(amt) || amt <= 0) return '';
    var m = normalizeMode(mode) || 'inclusive';
    if (m === 'prorate') return '';
    if (!row.tax_inclusive && !row.tax_add_applied) return '';
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

  function prorateTax(rows, taxAmount) {
    var positives = [];
    var subtotal = 0;
    (rows || []).forEach(function (r, i) {
      var base = parseAmount(r.amount);
      if (isNaN(base)) base = 0;
      if (base > 0) {
        positives.push({ i: i, base: base });
        subtotal += base;
      }
    });
    if (!positives.length || subtotal <= 0) {
      return (rows || []).map(function (r) {
        return Object.assign({}, r, {
          tax_inclusive: !!r.tax_inclusive,
          tax_add_applied: false
        });
      });
    }
    var tax = resolveProrateTax(subtotal, taxAmount);
    var distributed = 0;
    var out = (rows || []).map(function (r) {
      return Object.assign({}, r);
    });
    positives.forEach(function (p, idx) {
      var share = (idx === positives.length - 1)
        ? tax - distributed
        : Math.round(tax * p.base / subtotal);
      distributed += share;
      out[p.i].amount = p.base + share;
      out[p.i].item_desc = applyTaxTag(out[p.i].item_desc, true);
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
        var mark = amt > 0;
        return Object.assign({}, r, {
          amount: amt,
          _base_amount: amt,
          tax_inclusive: mark,
          tax_add_applied: false,
          item_desc: applyTaxTag(r.item_desc, mark)
        });
      });
    }

    var bases = toPretaxRows(rows, prev || (rows && rows[0] && rows[0].tax_add_applied ? 'per_row' : 'inclusive'));

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

  function parseModeFromNote(noteText) {
    var m = String(noteText || '').match(/【稅模式】([^；\n]*)/);
    if (!m) return '';
    return normalizeMode(m[1]);
  }

  function segHtml(selectedId, namePrefix) {
    var prefix = namePrefix || 'taxMode';
    var cur = normalizeMode(selectedId) || 'inclusive';
    var html = '<div class="tax-mode-seg seg" data-tax-mode-wrap="1" role="radiogroup" aria-label="稅別模式">';
    MODES.forEach(function (m) {
      html += '<button type="button" class="' + (m.id === cur ? 'active' : '') + '" data-tax-mode="' + m.id + '" data-tax-mode-btn="' + prefix + '">' +
        m.label + '</button>';
    });
    html += '</div>';
    html += '<div class="tax-mode-prorate-row' + (cur === 'prorate' ? '' : ' hidden') + '" data-tax-prorate-wrap="1">' +
      '<label>稅金（上面填未稅；這裡算整張。空白＝未稅合計×5%。核准才分進各案）</label>' +
      '<div class="row2"><input type="number" inputmode="numeric" class="inp-tax-amount" placeholder="可空白" />' +
      '<button type="button" class="btn btn-secondary btn-tax-5pct" style="margin-top:4px">未稅合計×5%</button></div></div>';
    return html;
  }

  return {
    MODES: MODES,
    MODE_NOTE_MARKER: MODE_NOTE_MARKER,
    parseAmount: parseAmount,
    addTax: addTax,
    removeTax: removeTax,
    applyTaxTag: applyTaxTag,
    normalizeMode: normalizeMode,
    modeLabel: modeLabel,
    applyModeToRows: applyModeToRows,
    toPretaxRows: toPretaxRows,
    resolveProrateTax: resolveProrateTax,
    rowBaseAmount: rowBaseAmount,
    summarize: summarize,
    rowHintText: rowHintText,
    taxSanityMessage: taxSanityMessage,
    prorateTax: prorateTax,
    suggestModeFromOcr: suggestModeFromOcr,
    syncModeNote: syncModeNote,
    parseModeFromNote: parseModeFromNote,
    segHtml: segHtml
  };
})();
