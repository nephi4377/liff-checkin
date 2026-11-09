/**
 * QUOTE-EDITOR-3：客戶／列印 payload 淨化（前端再擋一層）
 * 成本／廠商價／單價不得出現在對客資料。
 */
(function (root) {
  var FORBIDDEN = [
    'cost', 'cost_unit', 'cost_price', 'cost_total', 'internal_cost',
    'vendor_price', 'vendor', 'supplier_price', 'designer_price',
    'margin', 'profit', 'markup',
    '成本', '廠商價', '廠商', '成本單價', '成本合計'
  ];

  function isForbiddenKey(key) {
    var k = String(key || '').trim();
    if (!k) return false;
    var lower = k.toLowerCase();
    for (var i = 0; i < FORBIDDEN.length; i++) {
      var f = FORBIDDEN[i];
      if (k === f || lower === String(f).toLowerCase()) return true;
    }
    return false;
  }

  function stripForbiddenDeep(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
      return value.map(function (v) { return stripForbiddenDeep(v); });
    }
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (k) {
        if (isForbiddenKey(k)) return;
        if (k === 'unit_price') return;
        out[k] = stripForbiddenDeep(value[k]);
      });
      return out;
    }
    return value;
  }

  function payloadContainsForbiddenToken(payload) {
    var text = '';
    try { text = JSON.stringify(payload); } catch (e) { text = String(payload); }
    var needles = [
      '"cost"', '"cost_unit"', '"cost_price"', '"vendor_price"', '"designer_price"',
      '"margin"', '"profit"', '"成本"', '"廠商價"', '"internal_cost"', '"supplier_price"',
      '"unit_price"'
    ];
    for (var i = 0; i < needles.length; i++) {
      if (text.indexOf(needles[i]) !== -1) return needles[i];
    }
    return '';
  }

  function toCustomerLine(line) {
    line = line || {};
    var addons = (line.addons || []).map(toCustomerLine);
    var amount = Math.round(Number(line.amount) || 0);
    var lineSubtotal = line.line_subtotal != null
      ? Math.round(Number(line.line_subtotal) || 0)
      : amount + addons.reduce(function (s, a) { return s + (Number(a.amount) || 0); }, 0);
    return stripForbiddenDeep({
      line_id: line.line_id,
      custom: !!line.custom,
      tab: line.tab || '',
      item: line.item,
      unit: line.unit,
      qty: line.qty,
      amount: amount,
      note: line.note || '',
      parent_line_id: line.parent_line_id || '',
      is_cabinet: !!line.is_cabinet,
      line_subtotal: lineSubtotal,
      addons: addons
    });
  }

  function toCustomerQuote(quote) {
    quote = quote || {};
    function roundMoney(n) { return Math.round(Number(n) || 0); }
    var zones = (quote.zones || []).map(function (z) {
      var lines = (z.lines || []).map(toCustomerLine);
      var sub = 0;
      function walk(list) {
        (list || []).forEach(function (ln) {
          sub += Number(ln.amount) || 0;
          walk(ln.addons);
        });
      }
      walk(lines);
      return {
        zone_id: z.zone_id,
        name: z.name,
        lines: lines,
        zone_subtotal: z.zone_subtotal != null ? roundMoney(z.zone_subtotal) : Math.round(sub),
        trade_groups: (z.trade_groups || []).map(function (g) {
          return { tab: g.tab, subtotal: roundMoney(g.subtotal), line_count: g.line_count };
        })
      };
    });
    var fees = quote.fees_received || {};
    var totals = quote.totals || {};
    return stripForbiddenDeep({
      project_no: quote.project_no,
      quote_id: quote.quote_id,
      version: quote.version,
      status: quote.status,
      quote_date: quote.quote_date || '',
      zones: zones,
      fees_received: {
        measure: roundMoney(fees.measure),
        startup: roundMoney(fees.startup),
        planning: roundMoney(fees.planning)
      },
      totals: {
        pretax: roundMoney(totals.pretax),
        tax: roundMoney(totals.tax),
        tax_rate: totals.tax_rate,
        with_tax: roundMoney(totals.with_tax),
        deducted: roundMoney(totals.deducted),
        payable: roundMoney(totals.payable)
      },
      notes: quote.notes || '',
      can_confirm: !!quote.can_confirm,
      confirmed_at: quote.confirmed_at || '',
      sent_at: quote.sent_at || ''
    });
  }

  var api = {
    FORBIDDEN_KEYS: FORBIDDEN.slice(),
    isForbiddenKey: isForbiddenKey,
    stripForbiddenDeep: stripForbiddenDeep,
    payloadContainsForbiddenToken: payloadContainsForbiddenToken,
    toCustomerLine: toCustomerLine,
    toCustomerQuote: toCustomerQuote
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.QuoteEditorSanitize = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
