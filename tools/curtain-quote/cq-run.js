/**
 * 窗簾估價 — 主程式
 */
(function () {
  'use strict';

  var CFG = globalThis.CQ_CONFIG;
  var CALC = globalThis.CQ_CALC;
  var PERSIST = globalThis.CQ_PERSIST;
  var RENDER = globalThis.CQ_QUOTE_RENDER;

  var state = CFG.createDefaultState();
  var saveTimer = null;
  var quoteVisible = false;

  var el = {
    windowList: document.getElementById('cqWindowList'),
    quotePanel: document.getElementById('cqQuotePanel'),
    quoteOut: document.getElementById('cqQuoteOut'),
    grandTotal: document.getElementById('cqGrandTotal'),
    windowCount: document.getElementById('cqWindowCount'),
    perWindowSummary: document.getElementById('cqPerWindowSummary'),
    quoteTitle: document.getElementById('cqQuoteTitle'),
    customerName: document.getElementById('cqCustomerName'),
    addBtn: document.getElementById('cqAddWindowBtn'),
    genBtn: document.getElementById('cqGenerateBtn'),
    printBtn: document.getElementById('cqPrintBtn'),
    draftStatus: document.getElementById('cqDraftStatus'),
    applyGlobalBtn: document.getElementById('cqApplyGlobalPrices'),
    globalFabric: document.getElementById('cqGlobalFabric')
  };

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (PERSIST.saveDraft(state)) {
        el.draftStatus.textContent = '草稿已自動儲存';
        el.draftStatus.classList.remove('hidden');
      }
    }, 400);
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSelectOptions(options, selectedId, emptyLabel) {
    var html = emptyLabel ? '<option value="">' + esc(emptyLabel) + '</option>' : '';
    options.forEach(function (o) {
      html += '<option value="' + o.id + '"' + (o.id === selectedId ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    });
    return html;
  }

  function buildTypeSelect(selectedId) {
    var curCat = '';
    var html = '';
    CFG.CURTAIN_TYPES.forEach(function (t) {
      if (t.category !== curCat) {
        if (curCat) html += '</optgroup>';
        curCat = t.category;
        html += '<optgroup label="' + esc(t.category) + '">';
      }
      html += '<option value="' + t.id + '"' + (t.id === selectedId ? ' selected' : '') + '>' + esc(t.label) + '</option>';
    });
    if (curCat) html += '</optgroup>';
    return html;
  }

  function buildOrderFieldsHtml(win, type) {
    var fields = CFG.getOrderFieldsForType(type.id);
    if (!fields.length) return '';
    var parts = [];

    if (fields.indexOf('openStyle') >= 0) {
      parts.push(
        '<label class="cq-field cq-field-compact"><span class="cq-label">開法</span>' +
        '<select data-field="openStyle" class="cq-input cq-select cq-input-compact">' +
        buildSelectOptions(CFG.OPEN_STYLES, win.openStyle) +
        '</select></label>'
      );
    }
    if (fields.indexOf('pullDirection') >= 0) {
      parts.push(
        '<label class="cq-field cq-field-compact"><span class="cq-label">收法</span>' +
        '<select data-field="pullDirection" class="cq-input cq-select cq-input-compact">' +
        buildSelectOptions(CFG.PULL_DIRECTIONS, win.pullDirection) +
        '</select></label>'
      );
    }
    if (fields.indexOf('layerCount') >= 0) {
      parts.push(
        '<label class="cq-field cq-field-compact"><span class="cq-label">層數</span>' +
        '<select data-field="layerCount" class="cq-input cq-select cq-input-compact">' +
        buildSelectOptions(CFG.LAYER_COUNTS, win.layerCount) +
        '</select></label>'
      );
    }
    if (fields.indexOf('trackType') >= 0) {
      parts.push(
        '<label class="cq-field cq-field-compact"><span class="cq-label">軌道</span>' +
        '<select data-field="trackType" class="cq-input cq-select cq-input-compact">' +
        buildSelectOptions(CFG.TRACK_TYPES, win.trackType) +
        '</select></label>'
      );
    }

    return '<div class="cq-order-row">' + parts.join('') + '</div>';
  }

  function buildAdvancedHtml(win, type) {
    var installPreview = CFG.computeInstallFee(win.openingWidthCm, type, win);
    var isPanel = type.pricingMode === 'fabric_panel_ma';
    return (
      '<details class="cq-advanced">' +
      '<summary>其他選項（安裝覆寫、備註）</summary>' +
      '<div class="cq-card-grid cq-advanced-grid">' +
      '<label class="cq-field"><span class="cq-label">安裝費覆寫（留空自動算）</span>' +
      '<input data-field="installFeeOverride" type="number" min="0" step="1" class="cq-input" placeholder="自動 ' + installPreview + ' 元" value="' + esc(win.installFeeOverride) + '" /></label>' +
      '<div class="cq-field cq-checks">' +
      (isPanel ? '<label class="cq-check"><input data-field="includeTrack" type="checkbox"' + (win.includeTrack !== false ? ' checked' : '') + ' /> 含軌道（40元／尺）</label>' : '') +
      (isPanel ? '<label class="cq-check"><input data-field="includeSewing" type="checkbox"' + (win.includeSewing !== false ? ' checked' : '') + ' /> 含車工</label>' : '') +
      '<label class="cq-check"><input data-field="includeInstall" type="checkbox"' + (win.includeInstall !== false ? ' checked' : '') + ' /> 含安裝</label>' +
      '</div>' +
      '<label class="cq-field cq-field-span2"><span class="cq-label">備註（選填）</span>' +
      '<input data-field="clientNote" type="text" class="cq-input" placeholder="例：全遮光、要電動" value="' + esc(win.clientNote) + '" /></label>' +
      '</div></details>'
    );
  }

  function formatCardPriceHtml(result) {
    if (!result.valid) {
      return '<span class="cq-card-price-pending">待輸入</span>';
    }
    return '<span class="cq-card-price-amount">' + RENDER.formatMoney(result.lineTotal) + '</span>';
  }

  function renderLineBreakdown(result) {
    if (!result.valid || !result.lineItems.length) return '';
    var rows = result.lineItems.map(function (item) {
      return (
        '<tr>' +
        '<td>' + esc(item.label) + '</td>' +
        '<td class="cq-bd-num">' + RENDER.formatMoney(item.subtotal) + '</td>' +
        '</tr>'
      );
    }).join('');
    return (
      '<table class="cq-breakdown-table">' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td>本窗小計</td><td class="cq-bd-num cq-bd-total">' + RENDER.formatMoney(result.lineTotal) + '</td></tr></tfoot>' +
      '</table>'
    );
  }

  function renderCalcPreview(win, result) {
    if (!result.valid) {
      return '<p class="cq-calc-hint cq-calc-warn">' + esc(result.warnings[0]) + '</p>';
    }
    var meta = [];
    if (result.pricingMode === 'fabric_panel_ma') {
      meta.push(result.computedPanels + ' 幅');
      if (win.includeTrack !== false) meta.push('軌道 ' + result.computedTrackShaku + ' 尺');
      if (win.includeSewing !== false) meta.push('含車工');
    } else {
      meta.push('約 ' + result.computedFabricCai + ' 才');
    }
    var warn = result.warnings.length
      ? '<p class="cq-calc-warn">' + esc(result.warnings.join(' ')) + '</p>'
      : '';
    return (
      '<p class="cq-calc-meta">' + esc(meta.join(' · ')) + '</p>' +
      renderLineBreakdown(result) +
      warn
    );
  }

  function updateCardPricing(card, win, result) {
    var priceEl = card.querySelector('[data-card-price]');
    if (priceEl) priceEl.innerHTML = formatCardPriceHtml(result);
    var previewEl = card.querySelector('[data-calc-preview]');
    if (previewEl) previewEl.innerHTML = renderCalcPreview(win, result);
  }

  function renderPerWindowSummary(quote) {
    if (!el.perWindowSummary) return;
    var items = quote.windows.map(function (w, i) {
      var label = w.roomLabel || '窗 ' + (i + 1);
      var price = w.valid
        ? '<span class="cq-summary-price">' + RENDER.formatMoney(w.lineTotal) + '</span>'
        : '<span class="cq-summary-pending">待輸入寬高</span>';
      return '<li class="cq-summary-item"><span class="cq-summary-room">' + esc(label) + '</span>' + price + '</li>';
    }).join('');
    var hasAny = quote.windows.some(function (w) { return w.valid; });
    el.perWindowSummary.innerHTML =
      '<h3 class="cq-summary-title">各窗價格</h3>' +
      '<ul class="cq-summary-list">' + items + '</ul>' +
      (hasAny
        ? '<p class="cq-summary-foot">合計 <strong>' + RENDER.formatMoney(quote.grandTotal) + '</strong>（未稅）</p>'
        : '<p class="cq-summary-foot cq-summary-pending">完成寬高與單價後顯示金額</p>');
    el.perWindowSummary.classList.toggle('hidden', !quote.windows.length);
  }

  function buildWindowCard(win, index) {
    var type = CFG.getTypeById(win.curtainTypeId);
    var result = CALC.computeWindow(win);
    var priceUnit = CFG.fabricPriceUnit(type);

    var card = document.createElement('article');
    card.className = 'cq-window-card';
    card.dataset.windowCard = '1';
    card.dataset.windowId = win.id;

    card.innerHTML =
      '<div class="cq-card-head">' +
      '<span class="cq-card-badge">窗 ' + (index + 1) + '</span>' +
      '<h3 class="cq-card-title">' + esc(win.roomLabel || '新窗戶') + '</h3>' +
      '<div class="cq-card-head-right">' +
      '<div class="cq-card-price" data-card-price aria-live="polite">' + formatCardPriceHtml(result) + '</div>' +
      '<div class="cq-card-actions no-print">' +
      '<button type="button" class="cq-btn-ghost" data-action="duplicate">複製</button>' +
      (state.windows.length > 1 ? '<button type="button" class="cq-btn-ghost cq-btn-danger" data-action="remove">刪除</button>' : '') +
      '</div></div></div>' +
      '<div class="cq-card-grid">' +
      '<label class="cq-field"><span class="cq-label">空間</span>' +
      '<input data-field="roomLabel" type="text" class="cq-input" placeholder="主臥、客廳" value="' + esc(win.roomLabel) + '" /></label>' +
      '<label class="cq-field"><span class="cq-label">窗簾種類</span>' +
      '<select data-field="curtainTypeId" class="cq-input cq-select">' + buildTypeSelect(win.curtainTypeId) + '</select></label>' +
      '<label class="cq-field cq-field-span2"><span class="cq-label">品牌／型號／色號</span>' +
      '<input data-field="brandModel" type="text" class="cq-input" placeholder="例：水星光 5F B5、#731" value="' + esc(win.brandModel) + '" /></label>' +
      '<label class="cq-field"><span class="cq-label">寬（cm）</span>' +
      '<input data-field="openingWidthCm" type="number" min="1" step="1" inputmode="decimal" class="cq-input" placeholder="210" value="' + esc(win.openingWidthCm) + '" /></label>' +
      '<label class="cq-field"><span class="cq-label">高（cm）</span>' +
      '<input data-field="openingHeightCm" type="number" min="1" step="1" inputmode="decimal" class="cq-input" placeholder="229" value="' + esc(win.openingHeightCm) + '" /></label>' +
      '<label class="cq-field cq-field-span2"><span class="cq-label">布料單價（元／' + priceUnit + '）<span class="cq-label-req">必填</span></span>' +
      '<input data-field="fabricPricePerCai" type="number" min="0" step="1" class="cq-input cq-input-emphasis" placeholder="例：' + esc(type.defaultFabricPrice) + '" value="' + esc(win.fabricPricePerCai) + '" /></label>' +
      '</div>' +
      buildOrderFieldsHtml(win, type) +
      '<p class="cq-field-hint" data-measure-hint>' + esc(type.measureHint) + '</p>' +
      buildAdvancedHtml(win, type) +
      '<div class="cq-calc-preview" data-calc-preview aria-live="polite">' + renderCalcPreview(win, result) + '</div>';

    return card;
  }

  function readMetaFromDom() {
    state.quoteTitle = el.quoteTitle.value.trim();
    state.customerName = el.customerName.value.trim();
  }

  function readWindowFromCard(card) {
    var id = card.dataset.windowId;
    var win = state.windows.find(function (w) { return w.id === id; });
    if (!win) return;

    win.roomLabel = card.querySelector('[data-field="roomLabel"]').value.trim();
    win.curtainTypeId = card.querySelector('[data-field="curtainTypeId"]').value;
    win.brandModel = card.querySelector('[data-field="brandModel"]').value.trim();
    win.openingWidthCm = card.querySelector('[data-field="openingWidthCm"]').value;
    win.openingHeightCm = card.querySelector('[data-field="openingHeightCm"]').value;
    win.fabricPricePerCai = card.querySelector('[data-field="fabricPricePerCai"]').value;

    var includeTrack = card.querySelector('[data-field="includeTrack"]');
    if (includeTrack) win.includeTrack = includeTrack.checked;
    var includeSewing = card.querySelector('[data-field="includeSewing"]');
    if (includeSewing) win.includeSewing = includeSewing.checked;

    var installOverride = card.querySelector('[data-field="installFeeOverride"]');
    if (installOverride) win.installFeeOverride = installOverride.value;

    var includeInstall = card.querySelector('[data-field="includeInstall"]');
    if (includeInstall) win.includeInstall = includeInstall.checked;

    win.clientNote = card.querySelector('[data-field="clientNote"]').value.trim();

    ['openStyle', 'pullDirection', 'layerCount', 'trackType'].forEach(function (field) {
      var node = card.querySelector('[data-field="' + field + '"]');
      if (node) win[field] = node.value;
    });
  }

  function readAllFromDom() {
    readMetaFromDom();
    el.windowList.querySelectorAll('[data-window-card]').forEach(readWindowFromCard);
  }

  function applyTypeDefaults(win, card) {
    var type = CFG.getTypeById(win.curtainTypeId);
    win.fabricPricePerCai = type.defaultFabricPrice;
    win.installFeeOverride = '';
    win.includeTrack = type.pricingMode === 'fabric_panel_ma';
    win.includeSewing = type.pricingMode === 'fabric_panel_ma';

    card.querySelector('[data-field="fabricPricePerCai"]').value = type.defaultFabricPrice;
    var priceLabel = card.querySelector('[data-field="fabricPricePerCai"]').closest('.cq-field').querySelector('.cq-label');
    if (priceLabel) {
      priceLabel.innerHTML = '布料單價（元／' + CFG.fabricPriceUnit(type) + '）<span class="cq-label-req">必填</span>';
    }
    card.querySelector('[data-field="fabricPricePerCai"]').placeholder = '例：' + type.defaultFabricPrice;
    var installOverride = card.querySelector('[data-field="installFeeOverride"]');
    if (installOverride) {
      installOverride.value = '';
      installOverride.placeholder = '自動 ' + CFG.computeInstallFee(win.openingWidthCm, type, win) + ' 元';
    }
    card.querySelector('[data-measure-hint]').textContent = type.measureHint;

    var orderRow = card.querySelector('.cq-order-row');
    var newOrderHtml = buildOrderFieldsHtml(win, type);
    if (orderRow) {
      if (newOrderHtml) orderRow.outerHTML = newOrderHtml;
      else orderRow.remove();
    } else if (newOrderHtml) {
      card.querySelector('[data-measure-hint]').insertAdjacentHTML('beforebegin', newOrderHtml);
    }

    var advanced = card.querySelector('.cq-advanced');
    if (advanced) advanced.outerHTML = buildAdvancedHtml(win, type);
  }

  function renderWindows() {
    el.windowList.innerHTML = '';
    state.windows.forEach(function (win, i) {
      el.windowList.appendChild(buildWindowCard(win, i));
    });
    updateSummaryBar();
  }

  function updateSummaryBar() {
    readAllFromDom();
    var quote = CALC.computeQuote(state);
    el.grandTotal.textContent = RENDER.formatMoney(quote.grandTotal);
    el.windowCount.textContent = String(state.windows.length);
    renderPerWindowSummary(quote);
    if (quoteVisible && quote.hasValid) {
      el.quoteOut.innerHTML = RENDER.renderQuoteHtml(state, quote);
    }
    scheduleSave();
  }

  function onCardInput(e) {
    var card = e.target.closest('[data-window-card]');
    if (!card) return;
    readWindowFromCard(card);

    var win = state.windows.find(function (w) { return w.id === card.dataset.windowId; });
    if (!win) return;

    if (e.target.dataset.field === 'curtainTypeId') {
      applyTypeDefaults(win, card);
    }
    if (e.target.dataset.field === 'roomLabel') {
      card.querySelector('.cq-card-title').textContent = win.roomLabel || '新窗戶';
    }

    var result = CALC.computeWindow(win);
    updateCardPricing(card, win, result);
    updateSummaryBar();
  }

  function onCardClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var card = btn.closest('[data-window-card]');
    var id = card.dataset.windowId;
    var action = btn.dataset.action;

    if (action === 'remove') {
      state.windows = state.windows.filter(function (w) { return w.id !== id; });
      renderWindows();
      return;
    }
    if (action === 'duplicate') {
      var src = state.windows.find(function (w) { return w.id === id; });
      if (src) {
        var copy = CFG.createWindow(JSON.parse(JSON.stringify(src)));
        copy.id = 'win-' + Date.now();
        copy.roomLabel = src.roomLabel ? src.roomLabel + '（複製）' : '';
        var idx = state.windows.findIndex(function (w) { return w.id === id; });
        state.windows.splice(idx + 1, 0, copy);
        renderWindows();
      }
    }
  }

  function applyGlobalPrices() {
    var fabric = el.globalFabric.value;
    if (fabric === '') return;
    state.windows.forEach(function (win) {
      win.fabricPricePerCai = fabric;
    });
    renderWindows();
  }

  function showQuote() {
    readAllFromDom();
    var quote = CALC.computeQuote(state);
    if (!quote.hasValid) {
      alert('請至少完成一扇窗的寬度與高度。');
      return;
    }
    quoteVisible = true;
    el.quotePanel.classList.remove('hidden');
    el.quoteOut.innerHTML = RENDER.renderQuoteHtml(state, quote);
    el.quotePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function loadDraftIfAny() {
    var draft = PERSIST.loadDraft();
    if (!draft || !draft.windows || !draft.windows.length) return;
    state.quoteTitle = draft.quoteTitle || '';
    state.customerName = draft.customerName || '';
    state.windows = draft.windows.map(function (w) { return CFG.createWindow(w); });
    el.quoteTitle.value = state.quoteTitle;
    el.customerName.value = state.customerName;
    el.draftStatus.textContent = '已載入上次草稿';
    el.draftStatus.classList.remove('hidden');
  }

  function bindEvents() {
    el.addBtn.addEventListener('click', function () {
      state.windows.push(CFG.createWindow({ roomLabel: '' }));
      renderWindows();
    });
    el.windowList.addEventListener('input', onCardInput);
    el.windowList.addEventListener('change', onCardInput);
    el.windowList.addEventListener('click', onCardClick);
    el.quoteTitle.addEventListener('input', updateSummaryBar);
    el.customerName.addEventListener('input', updateSummaryBar);
    el.applyGlobalBtn.addEventListener('click', applyGlobalPrices);
    el.genBtn.addEventListener('click', showQuote);
    el.printBtn.addEventListener('click', function () {
      if (el.quotePanel.classList.contains('hidden')) showQuote();
      setTimeout(function () { window.print(); }, 200);
    });
  }

  loadDraftIfAny();
  bindEvents();
  renderWindows();
})();
