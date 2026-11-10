/**
 * 報價試算表畫面：點格子打字、貼上、加購、自動暫存。
 * 單價只在這份同事用的表上，客人頁不走這裡。
 */
(function (root) {
  var DEFAULT_TRADES = ['木作工程', '系統櫃', '油漆工程', '水電工程', '泥作工程', '其他', '自訂'];
  var DEFAULT_UNITS = ['式', '尺', '台尺', '坪', '才', '組', '個', '米', '樘', '處', '片', '只'];
  var states = {};
  var zoneSubs = {};
  var catalog = [];
  var trades = DEFAULT_TRADES.slice();
  var sheetEditable = true;

  function grid() {
    return root.QuoteEditorGrid;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    return (Number(n) || 0).toLocaleString('zh-TW');
  }

  function findIdx(rows, rowId) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].row_id === rowId) return i;
    }
    return -1;
  }

  function isChild(row) {
    return !!(row && (row.parent_row_id || row.parent_line_id));
  }

  function optionList(base, current) {
    var out = [];
    var seen = {};
    (base || []).concat(current ? [current] : []).forEach(function (name) {
      var v = String(name || '').trim();
      if (!v || seen[v]) return;
      seen[v] = true;
      out.push(v);
    });
    return out;
  }

  function selectHtml(row, field, label, options) {
    var value = row[field] == null ? '' : String(row[field]);
    var html = '<select data-row-id="' + esc(row.row_id) + '" data-field="' + field + '" aria-label="' + esc(label) + '"' +
      (sheetEditable ? '' : ' disabled') + '>';
    html += '<option value=""></option>';
    optionList(options, value).forEach(function (name) {
      html += '<option value="' + esc(name) + '"' + (name === value ? ' selected' : '') + '>' + esc(name) + '</option>';
    });
    html += '</select>';
    return html;
  }

  function textHtml(row, field, label) {
    var value = row[field] == null ? '' : String(row[field]);
    return '<input data-row-id="' + esc(row.row_id) + '" data-field="' + field + '" aria-label="' + esc(label) +
      '" value="' + esc(value) + '"' + (sheetEditable ? '' : ' disabled') + ' />';
  }

  function rowHtml(row) {
    var child = isChild(row);
    var cabinet = !child && (row.is_cabinet || (grid() && grid().looksLikeCabinet(row.item, row.unit, row.note)));
    var amountText = String(row.item || '').trim() ? money(row.amount) : '';
    var bundle = cabinet && row.line_subtotal && row.line_subtotal !== row.amount
      ? '<div class="hint">含加購 ' + money(row.line_subtotal) + '</div>' : '';
    var lock = sheetEditable ? '' : ' disabled';
    var addonBtn = cabinet
      ? '<button type="button" class="btn-addon-add" data-act="addon" data-row-id="' + esc(row.row_id) + '" aria-label="加購"' + lock + '>＋加購</button>'
      : '';
    return '<tr class="' + (child ? 'addon' : '') + '" data-row-id="' + esc(row.row_id) + '">' +
      '<td>' + selectHtml(row, 'tab', '工種', trades) + '</td>' +
      '<td class="item-cell">' + textHtml(row, 'item', child ? '加購名稱' : '品名') + '</td>' +
      '<td>' + selectHtml(row, 'unit', '單位', DEFAULT_UNITS) + '</td>' +
      '<td>' + textHtml(row, 'qty', '數量') + '</td>' +
      '<td>' + textHtml(row, 'unit_price', '單價（同事）') + '</td>' +
      '<td class="amt" data-amount-for="' + esc(row.row_id) + '">' + amountText + bundle + '</td>' +
      '<td>' + textHtml(row, 'note', '說明') + '</td>' +
      '<td>' + textHtml(row, 'price_override_reason', '改價原因') + '</td>' +
      '<td class="row-actions">' +
        '<button type="button" class="btn-row-delete" data-act="delete" data-row-id="' + esc(row.row_id) + '" aria-label="刪除這列"' + lock + '>刪</button>' +
        '<button type="button" class="btn-row-insert" data-act="insert" data-row-id="' + esc(row.row_id) + '" aria-label="在下方插一列"' + lock + '>插</button>' +
        '<button type="button" class="btn-row-up" data-act="up" data-row-id="' + esc(row.row_id) + '" aria-label="上移"' + lock + '>上</button>' +
        '<button type="button" class="btn-row-down" data-act="down" data-row-id="' + esc(row.row_id) + '" aria-label="下移"' + lock + '>下</button>' +
        addonBtn +
      '</td></tr>';
  }

  function summaryText(result) {
    if (!result) return '';
    var bits = (result.groups || []).map(function (g) {
      return g.tab + '小計 ' + money(g.subtotal);
    });
    bits.push('空間小計 ' + money(result.zone_subtotal));
    return bits.join('／');
  }

  function storage() {
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function draftKey(ctx) {
    return 'qe-sheet:' + (ctx.projectNo || '') + ':' + (ctx.version || 1);
  }

  function readAll(ctx) {
    var store = storage();
    if (!store) return null;
    try { return JSON.parse(store.getItem(draftKey(ctx)) || 'null'); } catch (e2) { return null; }
  }

  function writeDraft(st) {
    var store = storage();
    if (!store) return;
    var all = readAll(st.ctx) || { zones: {} };
    if (!all.zones) all.zones = {};
    all.zones[st.zone.zone_id] = { rows: st.rows, deletedLineIds: st.deleted || [] };
    try { store.setItem(draftKey(st.ctx), JSON.stringify(all)); } catch (e) { /* 滿了就略過 */ }
  }

  function collectIds(zone) {
    var ids = [];
    ((zone && zone.lines) || []).forEach(function (ln) {
      if (ln.line_id) ids.push(ln.line_id);
      (ln.addons || []).forEach(function (ad) { if (ad.line_id) ids.push(ad.line_id); });
    });
    return ids;
  }

  function feesOf(st) {
    if (st.ctx && typeof st.ctx.getFees === 'function') return st.ctx.getFees() || {};
    return {};
  }

  function reportTotals() {
    var pretax = 0;
    var any = false;
    Object.keys(zoneSubs).forEach(function (id) {
      any = true;
      pretax += Number(zoneSubs[id].zone_subtotal) || 0;
    });
    if (!any) return;
    var sample = null;
    Object.keys(states).forEach(function (id) { if (!sample) sample = states[id]; });
    var totals = grid().totalsFromPretax(pretax, sample ? feesOf(sample) : {});
    if (sample && sample.ctx && sample.ctx.onTotals) sample.ctx.onTotals(totals);
  }

  function publish(st) {
    var result = grid().recalc(st.rows, feesOf(st));
    st.lastResult = result;
    zoneSubs[st.zone.zone_id] = { zone_subtotal: result.zone_subtotal };
    var sumEl = st.host.querySelector('.trade-sum');
    if (sumEl) sumEl.textContent = summaryText(result);
    var card = st.host.parentElement;
    if (card) {
      var title = card.querySelector('[data-zone-sub]');
      if (title) title.textContent = '空間小計 ' + money(result.zone_subtotal);
    }
    st.rows.forEach(function (row) {
      var cell = st.host.querySelector('[data-amount-for="' + row.row_id + '"]');
      if (!cell) return;
      var text = String(row.item || '').trim() ? money(row.amount) : '';
      var child = isChild(row);
      var cabinet = !child && row.is_cabinet;
      var bundle = cabinet && row.line_subtotal && row.line_subtotal !== row.amount
        ? '<div class="hint">含加購 ' + money(row.line_subtotal) + '</div>' : '';
      cell.innerHTML = text + bundle;
    });
    reportTotals();
    return result;
  }

  function focusCell(host, rowId, field, caret) {
    var el = host.querySelector('[data-row-id="' + rowId + '"][data-field="' + field + '"]');
    if (!el) return;
    el.focus();
    if (el.setSelectionRange && caret != null) {
      var pos = Math.min(caret, String(el.value || '').length);
      try { el.setSelectionRange(pos, pos); } catch (e) { /* 下拉沒有游標 */ }
    }
  }

  function render(st, focus) {
    sheetEditable = !(st.ctx && st.ctx.editable === false);
    var undo = st.lastRemoved
      ? '<button type="button" class="ghost btn-undo" data-act="undo">復原剛刪的列</button>'
      : '';
    st.host.innerHTML =
      '<div class="sheet-wrap"><table class="sheet"><thead><tr>' +
      '<th>工種</th><th>品名</th><th>單位</th><th>數量</th><th>單價</th><th>小計</th><th>說明</th><th>改價原因</th><th class="row-actions"></th>' +
      '</tr></thead><tbody>' +
      st.rows.map(rowHtml).join('') +
      '</tbody></table></div>' +
      '<div class="trade-sum hint"></div>' +
      '<p class="hint">點格子就能打。Tab、方向鍵換格，Enter 往下。最底空白列打字會再留一列。從 Excel 貼上多列也可以。改完會自動暫存。抽屜、拉籃按「＋加購」。</p>' +
      undo +
      '<div class="suggest" hidden></div>';
    publish(st);
    if (focus && focus.rowId) focusCell(st.host, focus.rowId, focus.field, focus.start);
  }

  function rememberDelete(st, lineId) {
    if (!lineId || String(lineId).indexOf('local-') === 0) return;
    if (st.deleted.indexOf(lineId) < 0) st.deleted.push(lineId);
  }

  function showSuggest(st, input) {
    var box = st.host.querySelector('.suggest');
    if (!box) return;
    var q = input.value || '';
    var rowId = input.getAttribute('data-row-id');
    var idx = findIdx(st.rows, rowId);
    var row = st.rows[idx];
    var hits = grid().suggestItems(catalog, q, row && row.tab, 8);
    if (!hits.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.innerHTML = hits.map(function (hit, i) {
      return '<button type="button" data-suggest="' + i + '">' + esc(hit.item) + '｜' + esc(hit.unit) + '｜' + money(hit.price) + '</button>';
    }).join('');
    box.hidden = false;
    box._hits = hits;
    box._rowId = rowId;
    var rect = input.getBoundingClientRect();
    var hostRect = st.host.getBoundingClientRect();
    box.style.left = (rect.left - hostRect.left) + 'px';
    box.style.top = (rect.bottom - hostRect.top) + 'px';
  }

  function pickSuggest(st, hit, rowId) {
    var idx = findIdx(st.rows, rowId);
    if (idx < 0 || !hit) return;
    grid().applyCatalogHit(st.rows[idx], hit);
    var placed = grid().placeAddonIfNeeded(st.rows, idx);
    var focusId = st.rows[idx] ? st.rows[idx].row_id : rowId;
    if (placed.moved) {
      st.rows.forEach(function (r) { if (r.item === hit.item && isChild(r)) focusId = r.row_id; });
    }
    render(st, { rowId: focusId, field: 'qty' });
    schedule(st);
    if (st.ctx.onStatus) {
      st.ctx.onStatus(placed.moved ? '已掛到櫃子下面，單位和單價已帶入，仍可改' : '已帶入單位和單價，仍可改', 'ok');
    }
  }

  async function flush(st) {
    var plan = grid().autosavePlan(st.rows, { serverLineIds: st.serverIds });
    (plan.localDeletes || []).forEach(function (id) { rememberDelete(st, id); });
    var blocked = null;
    plan.ops.forEach(function (op) { if (op.type === 'blocked' && !blocked) blocked = op; });
    writeDraft(st);
    if (st.ctx.localOnly) {
      st.rows.forEach(function (row) {
        if (!String(row.item || '').trim()) return;
        if (!row.line_id) row.line_id = 'local-' + row.row_id;
        row.dirty = false;
        row.saved_unit_price = row.unit_price;
      });
      writeDraft(st);
      if (st.ctx.onStatus) {
        st.ctx.onStatus(blocked ? blocked.message : '已自動暫存', blocked ? 'err' : 'ok');
      }
      return;
    }
    if (st.ctx.onStatus) st.ctx.onStatus(blocked ? blocked.message : '暫存中…', blocked ? 'err' : '');
    for (var i = 0; i < plan.ops.length; i++) {
      var op = plan.ops[i];
      if (op.type !== 'add' && op.type !== 'update') continue;
      var row = null;
      st.rows.forEach(function (r) { if (r.row_id === op.row_id) row = r; });
      if (!row || !st.ctx.saveOp) continue;
      try {
        var sent = {
          type: op.type,
          row_id: op.row_id,
          line_id: row.line_id,
          zone_id: st.zone.zone_id,
          payload: op.payload
        };
        var res = await st.ctx.saveOp(sent);
        if (res && res.line_id) row.line_id = res.line_id;
        row.dirty = false;
        row.saved_unit_price = row.unit_price;
        if (row.line_id && st.serverIds.indexOf(row.line_id) < 0) st.serverIds.push(row.line_id);
      } catch (e) {
        writeDraft(st);
        if (st.ctx.onStatus) st.ctx.onStatus((e && e.message) || '自動暫存失敗，這台仍留著剛才打的', 'err');
        return;
      }
    }
    writeDraft(st);
    if (st.deleted.length && st.ctx.onStatus) {
      st.ctx.onStatus('格子已自動暫存。有列只在這台拿掉，換一台還看得到，送出前會先擋住。', 'err');
      return;
    }
    if (st.ctx.onStatus && !blocked) st.ctx.onStatus('已自動暫存', 'ok');
  }

  function schedule(st) {
    writeDraft(st);
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(function () { flush(st); }, 600);
  }

  function bind(st) {
    var host = st.host;
    host.addEventListener('compositionstart', function () { st.composing = true; });
    host.addEventListener('compositionend', function (e) {
      st.composing = false;
      onEdit(st, e);
    });
    host.addEventListener('input', function (e) {
      if (st.composing || e.isComposing) return;
      onEdit(st, e);
    });
    host.addEventListener('change', function (e) { onEdit(st, e); });
    host.addEventListener('keydown', function (e) { onKey(st, e); });
    host.addEventListener('paste', function (e) { onPaste(st, e); });
    host.addEventListener('click', function (e) { onClick(st, e); });
  }

  function onEdit(st, e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var field = el.getAttribute('data-field');
    var rowId = el.getAttribute('data-row-id');
    if (!field || !rowId) return;
    var idx = findIdx(st.rows, rowId);
    if (idx < 0) return;
    var before = st.rows.length;
    var caret = el.selectionStart;
    grid().touchCell(st.rows, idx, field, el.value);
    publish(st);
    if (st.rows.length !== before) {
      render(st, { rowId: rowId, field: field, start: caret });
    }
    if (field === 'item' && el.tagName === 'INPUT') showSuggest(st, el);
    schedule(st);
  }

  function onKey(st, e) {
    if (e.isComposing || e.keyCode === 229) return;
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var field = el.getAttribute('data-field');
    var rowId = el.getAttribute('data-row-id');
    if (!field || !rowId) return;
    var idx = findIdx(st.rows, rowId);
    var col = grid().COLS.indexOf(field);
    if (idx < 0 || col < 0) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      var res = grid().commitEnter(st.rows, idx);
      var next = st.rows[res.next];
      if (res.added) render(st, next ? { rowId: next.row_id, field: field } : null);
      else if (next) focusCell(st.host, next.row_id, field);
      publish(st);
      schedule(st);
      return;
    }
    var key = e.key;
    if (key === 'Tab') key = e.shiftKey ? 'ShiftTab' : 'Tab';
    if (key !== 'Tab' && key !== 'ShiftTab' && key.indexOf('Arrow') !== 0) return;
    e.preventDefault();
    var pos = grid().moveCell({ row: idx, col: col }, key, { rows: st.rows.length, cols: grid().COLS.length });
    if (!pos.moved) return;
    var dest = st.rows[pos.row];
    if (dest) focusCell(st.host, dest.row_id, grid().COLS[pos.col]);
  }

  function onPaste(st, e) {
    var text = '';
    try { text = (e.clipboardData && e.clipboardData.getData('text')) || ''; } catch (err) { text = ''; }
    if (text.indexOf('\t') === -1 && text.indexOf('\n') === -1) return;
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var field = el.getAttribute('data-field');
    var rowId = el.getAttribute('data-row-id');
    var idx = findIdx(st.rows, rowId);
    var col = grid().COLS.indexOf(field);
    if (idx < 0 || col < 0) return;
    e.preventDefault();
    grid().applyClipboard(st.rows, idx, col, text);
    render(st, { rowId: rowId, field: field });
    schedule(st);
    if (st.ctx.onStatus) st.ctx.onStatus('已貼上，小計已重算', 'ok');
  }

  function onClick(st, e) {
    var btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!btn || !st.host.contains(btn)) return;
    var suggest = btn.getAttribute('data-suggest');
    if (suggest != null) {
      var box = st.host.querySelector('.suggest');
      var hit = box && box._hits && box._hits[Number(suggest)];
      pickSuggest(st, hit, box && box._rowId);
      return;
    }
    var act = btn.getAttribute('data-act');
    if (act === 'undo') {
      if (st.lastRemoved) {
        grid().undoDelete(st.rows, st.lastRemoved);
        (st.lastRemoved.items || []).forEach(function (item) {
          st.deleted = (st.deleted || []).filter(function (id) { return id !== item.line_id; });
        });
        st.lastRemoved = null;
        render(st);
        schedule(st);
        if (st.ctx.onStatus) st.ctx.onStatus('已復原', 'ok');
      }
      return;
    }
    var rowId = btn.getAttribute('data-row-id');
    var idx = findIdx(st.rows, rowId);
    if (idx < 0 || !act) return;
    if (act === 'delete') {
      var removed = grid().deleteRow(st.rows, idx);
      st.lastRemoved = removed.removed;
      if (removed.removed) {
        (removed.removed.items || []).forEach(function (item) { rememberDelete(st, item.line_id); });
      }
      render(st);
      schedule(st);
      if (st.ctx.onStatus) st.ctx.onStatus('已刪除。按「復原剛刪的列」可救回。', 'ok');
      return;
    }
    if (act === 'insert') {
      var ins = grid().insertBelow(st.rows, idx);
      var neu = st.rows[ins.index];
      render(st, neu ? { rowId: neu.row_id, field: 'item' } : null);
      schedule(st);
      return;
    }
    if (act === 'up' || act === 'down') {
      grid().moveRow(st.rows, idx, act === 'up' ? -1 : 1);
      render(st, { rowId: rowId, field: 'item' });
      schedule(st);
      if (st.ctx.onStatus) st.ctx.onStatus('順序已調整（這台先記住）', 'ok');
      return;
    }
    if (act === 'addon') {
      var added = grid().addAddonRow(st.rows, idx);
      var child = st.rows[added.index];
      render(st, child ? { rowId: child.row_id, field: 'item' } : null);
      schedule(st);
      if (st.ctx.onStatus) st.ctx.onStatus('已在櫃子下面加一列，名稱、數量、單價可自填', 'ok');
    }
  }

  function mount(host, zone, ctx) {
    if (!host || !zone || !grid()) return;
    ctx = ctx || {};
    var draft = null;
    var all = readAll(ctx);
    if (all && all.zones && all.zones[zone.zone_id]) draft = all.zones[zone.zone_id];
    var serverRows = grid().rowsFromZone(zone);
    var rows = draft ? grid().mergeLocal(serverRows, draft.rows || [], draft.deletedLineIds || []) : serverRows;
    var st = {
      host: host,
      zone: zone,
      ctx: ctx,
      rows: rows,
      serverIds: collectIds(zone),
      deleted: (draft && draft.deletedLineIds) ? draft.deletedLineIds.slice() : [],
      lastRemoved: null,
      timer: null,
      composing: false
    };
    states[zone.zone_id] = st;
    host.classList.add('sheet-host');
    render(st);
    bind(st);
  }

  function setCatalog(items) {
    catalog = items || [];
  }

  function setTrades(list) {
    var seen = {};
    trades = [];
    DEFAULT_TRADES.concat(list || []).forEach(function (name) {
      var v = String(name || '').trim();
      if (!v || seen[v]) return;
      seen[v] = true;
      trades.push(v);
    });
  }

  function pendingDeletes() {
    var all = [];
    Object.keys(states).forEach(function (id) {
      (states[id].deleted || []).forEach(function (lineId) {
        if (lineId && all.indexOf(lineId) < 0) all.push(lineId);
      });
    });
    return all;
  }

  function clearTotals() {
    zoneSubs = {};
  }

  function refreshSheets() {
    Object.keys(states).forEach(function (id) {
      var st = states[id];
      var active = false;
      try { active = !!(document.activeElement && st.host.contains(document.activeElement)); } catch (e) { active = false; }
      if (active) return;
      render(st);
    });
  }

  function recalcFees() {
    Object.keys(states).forEach(function (id) { publish(states[id]); });
  }

  var api = {
    mount: mount,
    setCatalog: setCatalog,
    setTrades: setTrades,
    pendingDeletes: pendingDeletes,
    clearTotals: clearTotals,
    recalcFees: recalcFees,
    refreshSheets: refreshSheets
  };
  root.QuoteEditorGridUi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
