/**
 * 窗簾估價 — 估價單 HTML 渲染
 */
(function (global) {
  'use strict';

  var CFG = global.CQ_CONFIG;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMoney(n) {
    return 'NT$ ' + Number(n || 0).toLocaleString('zh-TW');
  }

  function formatDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
  }

  function renderSpecsTable(windows) {
    var valid = windows.filter(function (w) { return w.valid; });
    if (!valid.length) return '';

    var rows = valid.map(function (w) {
      var specLines = [esc(w.typeLabel)];
      if (w.brandModel) specLines.push(esc(w.brandModel));
      if (w.orderSpecs) specLines.push(esc(w.orderSpecs));
      return (
        '<tr>' +
        '<td>' + esc(w.roomLabel) + '</td>' +
        '<td>' + esc(w.openingSize) + '</td>' +
        '<td>' + specLines.join('<br>') + '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<section class="cq-specs-section">' +
      '<h3 class="cq-specs-title">下單規格摘要</h3>' +
      '<table class="cq-specs-table">' +
      '<thead><tr><th>空間</th><th>尺寸</th><th>種類／品牌／開法收法</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</section>'
    );
  }

  function renderQuoteHtml(state, quote) {
    var title = state.quoteTitle || '窗簾估價參考單';
    var customer = state.customerName ? '<p class="cq-quote-meta">客戶：' + esc(state.customerName) + '</p>' : '';
    var rows = '';

    quote.windows.forEach(function (w) {
      if (!w.valid) return;
      var rowSpan = w.lineItems.length;
      w.lineItems.forEach(function (item, idx) {
        var roomCell = '';
        if (idx === 0) {
          var sub = [w.typeLabel];
          if (w.brandModel) sub.push(w.brandModel);
          if (w.orderSpecs) sub.push(w.orderSpecs);
          roomCell =
            '<td rowspan="' + rowSpan + '" class="cq-td-room">' +
            esc(w.roomLabel) + '<br><span class="cq-td-sub">' +
            esc(sub.join(' · ')) + '<br>' + esc(w.openingSize) + '</span></td>';
        }
        rows +=
          '<tr>' + roomCell +
          '<td>' + esc(item.label) + (item.detail ? '<br><span class="cq-td-sub">' + esc(item.detail) + '</span>' : '') + '</td>' +
          '<td class="cq-td-num">' + item.qty + ' ' + esc(item.unit) + '</td>' +
          '<td class="cq-td-num">' + formatMoney(item.unitPrice) + '</td>' +
          '<td class="cq-td-num cq-td-total">' + formatMoney(item.subtotal) + '</td>' +
          '</tr>';
      });
      if (w.clientNote) {
        rows += '<tr class="cq-note-row"><td colspan="5">備註：' + esc(w.clientNote) + '</td></tr>';
      }
    });

    var disclaimer = (CFG.DEFAULT_DISCLAIMER || '').split('\n').map(function (line) {
      return '<li>' + esc(line) + '</li>';
    }).join('');

    return (
      '<div class="cq-quote-doc">' +
      '<header class="cq-quote-header">' +
      '<div class="cq-quote-brand">' +
      '<p class="cq-quote-brand-name">添心設計</p>' +
      '<p class="cq-quote-brand-sub">窗簾估價參考單</p>' +
      '</div>' +
      '<div class="cq-quote-head-right">' +
      '<h2 class="cq-quote-title">' + esc(title) + '</h2>' +
      customer +
      '<p class="cq-quote-meta">日期：' + formatDate(quote.generatedAt) + '</p>' +
      '<p class="cq-quote-meta">價本參考：' + esc(state.priceBookVersionDate || '—') + '</p>' +
      '</div>' +
      '</header>' +
      renderSpecsTable(quote.windows) +
      '<table class="cq-quote-table">' +
      '<thead><tr>' +
      '<th>空間</th><th>品項</th><th>數量</th><th>單價</th><th>小計</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr>' +
      '<td colspan="4" class="cq-td-foot-label">合計（未稅）</td>' +
      '<td class="cq-td-num cq-grand-total">' + formatMoney(quote.grandTotal) + '</td>' +
      '</tr></tfoot>' +
      '</table>' +
      '<section class="cq-disclaimer">' +
      '<p class="cq-disclaimer-title">免責聲明</p>' +
      '<ul>' + disclaimer + '</ul>' +
      '</section>' +
      '<p class="cq-quote-footer">花色與材質以現場確認為準 · 添心設計 tanxin.space</p>' +
      '</div>'
    );
  }

  global.CQ_QUOTE_RENDER = {
    renderQuoteHtml: renderQuoteHtml,
    formatMoney: formatMoney
  };
})(typeof window !== 'undefined' ? window : globalThis);
