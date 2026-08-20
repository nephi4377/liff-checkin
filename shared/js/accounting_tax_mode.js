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

  /** 未稅合計、稅金、含稅合計（給畫面合計列） */
  function summarize(rows, mode) {
    var payable = 0;
    var pretax = 0;
    (rows || []).forEach(function (r) {
      var amt = parseAmount(r.amount);
      if (isNaN(amt)) amt = 0;
      payable += amt;
      if (amt < 0) {
        pretax += amt;
        return;
      }
      var base = rowBaseAmount(r, mode);
      pretax += isNaN(base) ? amt : base;
    });
    var m = normalizeMode(mode) || 'inclusive';
    if (m === 'inclusive') {
      return { pretax: payable, tax: 0, payable: payable };
    }
    return { pretax: pretax, tax: payable - pretax, payable: payable };
  }

  function prorateTax(rows, taxAmount) {
    var tax = parseAmount(taxAmount);
    if (isNaN(tax) || tax < 0) tax = 0;
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
    if (tax <= 0) tax = Math.round(subtotal * TAX_RATE);
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

    var bases = (rows || []).map(function (r) {
      var base = rowBaseAmount(r, prev || (r.tax_add_applied ? 'per_row' : 'inclusive'));
      return Object.assign({}, r, {
        amount: base,
        _base_amount: base,
        tax_inclusive: false,
        tax_add_applied: false,
        item_desc: applyTaxTag(r.item_desc, false)
      });
    });

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
      '<label>稅金（整張分攤；空白＝未稅合計×5%）</label>' +
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
    rowBaseAmount: rowBaseAmount,
    summarize: summarize,
    prorateTax: prorateTax,
    suggestModeFromOcr: suggestModeFromOcr,
    syncModeNote: syncModeNote,
    parseModeFromNote: parseModeFromNote,
    segHtml: segHtml
  };
})();
