/**
 * QUOTE-EDITOR-3：客戶／列印 payload 淨化（前端再擋一層）
 * 成本／廠商價等禁止鍵不得出現在對客資料。
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
      '"margin"', '"profit"', '"成本"', '"廠商價"', '"internal_cost"', '"supplier_price"'
    ];
    for (var i = 0; i < needles.length; i++) {
      if (text.indexOf(needles[i]) !== -1) return needles[i];
    }
    return '';
  }

  /** 客人看的報價列：只留售價側欄位 */
  function toCustomerLine(line) {
    line = line || {};
    return stripForbiddenDeep({
      line_id: line.line_id,
      item: line.item,
      unit: line.unit,
      qty: line.qty,
      unit_price: line.unit_price,
      amount: line.amount,
      note: line.note || '',
      price_override_reason: line.price_override_reason || ''
    });
  }

  function toCustomerQuote(quote) {
    quote = quote || {};
    var zones = (quote.zones || []).map(function (z) {
      return {
        zone_id: z.zone_id,
        name: z.name,
        lines: (z.lines || []).map(toCustomerLine)
      };
    });
    return stripForbiddenDeep({
      project_no: quote.project_no,
      quote_id: quote.quote_id,
      version: quote.version,
      status: quote.status,
      zones: zones,
      fees_received: quote.fees_received || {},
      totals: quote.totals || {},
      notes: quote.notes || ''
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
