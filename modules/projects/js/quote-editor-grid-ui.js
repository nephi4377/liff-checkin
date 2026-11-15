/**
 * 報價試算表畫面：點格子打字、貼上、加購、自動暫存。
 * 單價只在這份同事用的表上，客人頁不走這裡。
 */
(function (root) {
  var DEFAULT_TRADES = ['木作工程', '系統櫃', '油漆工程', '水電工程', '泥作工程', '其他', '自訂'];
  var DEFAULT_UNITS = ['式', '尺', '台尺', '坪', '才', '組', '個', '米', '樘', '處', '片', '只'];
  var ITEM_SUGGEST_LIMIT = 120;
  var CUSTOM_ITEM_LABEL = '（自填）';
  var UNIFIED_KEY = '__unified__';
  var NEW_ZONE_OPT = '__qe_new_zone__';
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

  function zoneSelectHtml(row, ctx) {
    var value = row.zone_id == null ? '' : String(row.zone_id);
    var zones = (ctx && ctx.getZones && ctx.getZones()) || [];
    var lock = sheetEditable ? '' : ' disabled';
    var html = '<select data-row-id="' + esc(row.row_id) + '" data-field="zone_id" aria-label="空間"' + lock + '>';
    html += '<option value=""></option>';
    zones.forEach(function (z) {
      if (!z || !z.zone_id) return;
      html += '<option value="' + esc(String(z.zone_id)) + '"' +
        (String(z.zone_id) === value ? ' selected' : '') + '>' + esc(z.name || z.zone_id) + '</option>';
    });
    html += '<option value="' + esc(NEW_ZONE_OPT) + '">＋新空間</option>';
    html += '</select>';
    return html;
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

  function rowHtml(row, st) {
    var child = isChild(row);
    var cabinet = !child && (row.is_cabinet || (grid() && grid().looksLikeCabinet(row.item, row.unit, row.note)));
    var amountText = String(row.item || '').trim() ? money(row.amount) : '';
    var bundle = cabinet && row.line_subtotal && row.line_subtotal !== row.amount
      ? '<div class="hint">含加購 ' + money(row.line_subtotal) + '</div>' : '';
    var lock = sheetEditable ? '' : ' disabled';
    var addonBtn = cabinet
      ? '<button type="button" class="btn-addon-add" data-act="addon" data-row-id="' + esc(row.row_id) + '" aria-label="加購"' + lock + '>＋加購</button>'
      : '';
    var zoneCell = child
      ? '<span class="hint">' + esc(resolveZoneLabel(row, st && st.ctx)) + '</span>'
      : zoneSelectHtml(row, st && st.ctx);
    return '<tr class="' + (child ? 'addon' : '') + '" data-row-id="' + esc(row.row_id) + '">' +
      '<td>' + zoneCell + '</td>' +
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

  function resolveZoneLabel(row, ctx) {
    var zid = String(row && row.zone_id || '').trim();
    if (!zid) return '—';
    var zones = (ctx && ctx.getZones && ctx.getZones()) || [];
    var hit = zones.filter(function (z) { return String(z.zone_id) === zid; })[0];
    return (hit && hit.name) || zid;
  }

  function writeDraft(st) {
    var store = storage();
    if (!store) return;
    var all = readAll(st.ctx) || { zones: {} };
    if (!all.zones) all.zones = {};
    if (st.unified) {
      var byZone = {};
      (st.rows || []).forEach(function (r) {
        if (!r || grid().isBlank(r)) return;
        var zid = String(r.zone_id || '').trim() || (st.ctx.pendingZoneId || '__unset__');
        if (!byZone[zid]) byZone[zid] = [];
        byZone[zid].push(r);
      });
      Object.keys(byZone).forEach(function (zid) {
        var chunk = byZone[zid].slice();
        grid().ensureTrailingBlank(chunk);
        grid().trimExtraTrailing(chunk);
        all.zones[zid] = {
          rows: chunk,
          deletedLineIds: ((st.deletedByZone && st.deletedByZone[zid]) || []).slice()
        };
      });
      if (st.deletedByZone) {
        Object.keys(st.deletedByZone).forEach(function (zid) {
          if (byZone[zid]) return;
          if (!all.zones[zid]) all.zones[zid] = { rows: [grid().blankRow({ zone_id: zid })], deletedLineIds: [] };
          all.zones[zid].deletedLineIds = (st.deletedByZone[zid] || []).slice();
        });
      }
    } else {
      all.zones[st.zone.zone_id] = { rows: st.rows, deletedLineIds: st.deleted || [] };
    }
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
    if (!any) {
      var ust = states[UNIFIED_KEY];
      if (ust && ust.lastResult) {
        pretax = Number(ust.lastResult.zone_subtotal) || 0;
        any = true;
      }
    }
    if (!any) return;
    var sample = states[UNIFIED_KEY] || null;
    if (!sample) {
      Object.keys(states).forEach(function (id) { if (!sample) sample = states[id]; });
    }
    var totals = grid().totalsFromPretax(pretax, sample ? feesOf(sample) : {});
    if (sample && sample.ctx && sample.ctx.onTotals) sample.ctx.onTotals(totals);
  }

  function publish(st) {
    var result = grid().recalc(st.rows, feesOf(st));
    st.lastResult = result;
    if (st.unified) {
      zoneSubs[UNIFIED_KEY] = { zone_subtotal: result.zone_subtotal };
    } else {
      zoneSubs[st.zone.zone_id] = { zone_subtotal: result.zone_subtotal };
    }
    var sumEl = st.host.querySelector('.trade-sum');
    if (sumEl) sumEl.textContent = summaryText(result);
    var card = st.host.parentElement;
    if (card) {
      var title = card.querySelector('[data-sheet-sub]');
      if (title) title.textContent = '工項小計 ' + money(result.zone_subtotal);
      if (!st.unified) {
        var zsub = card.querySelector('[data-zone-sub]');
        if (zsub) zsub.textContent = '空間小計 ' + money(result.zone_subtotal);
      }
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
      '<th>空間</th><th>工種</th><th>品名</th><th>單位</th><th>數量</th><th>單價</th><th>小計</th><th>說明</th><th>改價原因</th><th class="row-actions"></th>' +
      '</tr></thead><tbody>' +
      st.rows.map(function (r) { return rowHtml(r, st); }).join('') +
      '</tbody></table></div>' +
      '<div class="trade-sum hint"></div>' +
      '<p class="hint">空間可空或選「＋新空間」（請先在上方輸入名稱）。Tab 往右、Enter 往下；最底列 Enter 會加一列。可從 Excel 貼上多列。工種點品名可看細項（含「' + esc(CUSTOM_ITEM_LABEL) + '」）。</p>' +
      undo +
      '<div class="suggest" hidden></div>';
    publish(st);
    if (focus && focus.rowId) focusCell(st.host, focus.rowId, focus.field, focus.start);
  }

  function rememberDelete(st, lineId, zoneId) {
    if (!lineId || String(lineId).indexOf('local-') === 0) return;
    if (st.unified) {
      var zid = String(zoneId || '').trim();
      if (!st.deletedByZone) st.deletedByZone = {};
      if (!st.deletedByZone[zid]) st.deletedByZone[zid] = [];
      if (st.deletedByZone[zid].indexOf(lineId) < 0) st.deletedByZone[zid].push(lineId);
      return;
    }
    if (st.deleted.indexOf(lineId) < 0) st.deleted.push(lineId);
  }

  function showSuggest(st, input) {
    var box = st.host.querySelector('.suggest');
    if (!box) return;
    var q = input.value || '';
    var rowId = input.getAttribute('data-row-id');
    var idx = findIdx(st.rows, rowId);
    var row = st.rows[idx];
    var tab = row && row.tab;
    var hits = grid().suggestItems(catalog, q, tab, ITEM_SUGGEST_LIMIT);
    var html = '<button type="button" class="suggest-custom" data-suggest-custom="1">' +
      esc(CUSTOM_ITEM_LABEL) + '（名稱、單位、單價手打）</button>';
    if (!tab && !hits.length) {
      html += '<div class="hint" style="padding:0.45rem">請先選工種，或點「' + esc(CUSTOM_ITEM_LABEL) + '」手打</div>';
    } else if (tab && !hits.length && q) {
      html += '<div class="hint" style="padding:0.45rem">此工種沒有符合「' + esc(q) + '」的細項，可選自填</div>';
    }
    html += hits.map(function (hit, i) {
      return '<button type="button" data-suggest="' + i + '">' + esc(hit.item) + '｜' + esc(hit.unit) + '｜' + money(hit.price) + '</button>';
    }).join('');
    box.innerHTML = html;
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

  async function resolveRowZone(st, row) {
    if (!row || !st.ctx.ensureZoneForRow) return row.zone_id;
    try {
      row.zone_id = await st.ctx.ensureZoneForRow(row);
      return row.zone_id;
    } catch (e) {
      throw e;
    }
  }

  async function flush(st) {
    var plan = grid().autosavePlan(st.rows, {
      serverLineIdsByZone: st.unified ? st.serverIdsByZone : null,
      serverLineIds: st.unified ? null : st.serverIds
    });
    (plan.localDeletes || []).forEach(function (id) {
      var zid = '';
      if (st.unified && st.serverIdsByZone) {
        Object.keys(st.serverIdsByZone).forEach(function (z) {
          if ((st.serverIdsByZone[z] || []).indexOf(id) >= 0) zid = z;
        });
      }
      rememberDelete(st, id, st.unified ? zid : undefined);
    });
    var blocked = null;
    plan.ops.forEach(function (op) { if (op.type === 'blocked' && !blocked) blocked = op; });
    var needsZone = plan.ops.some(function (op) {
      return op.type === 'add' || op.type === 'update';
    });
    if (needsZone && st.ctx.ensureZoneForRow) {
      for (var zi = 0; zi < st.rows.length; zi++) {
        var rowZ = st.rows[zi];
        if (!rowZ || !String(rowZ.item || '').trim()) continue;
        try {
          await resolveRowZone(st, rowZ);
        } catch (eZone) {
          writeDraft(st);
          if (st.ctx.onStatus) {
            st.ctx.onStatus((eZone && eZone.message) || '建立空間失敗，這台仍留著剛才打的', 'err');
          }
          return;
        }
      }
    } else if (needsZone && st.ctx.ensureZone && !st.unified) {
      try {
        await st.ctx.ensureZone(st);
      } catch (eZone2) {
        writeDraft(st);
        if (st.ctx.onStatus) {
          st.ctx.onStatus((eZone2 && eZone2.message) || '建立空間失敗，這台仍留著剛才打的', 'err');
        }
        return;
      }
    }
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
        var zid = op.zone_id || row.zone_id || (st.zone && st.zone.zone_id);
        var sent = {
          type: op.type,
          row_id: op.row_id,
          line_id: row.line_id,
          zone_id: zid,
          payload: op.payload
        };
        var res = await st.ctx.saveOp(sent);
        if (res && res.line_id) row.line_id = res.line_id;
        row.dirty = false;
        row.saved_unit_price = row.unit_price;
        if (row.line_id) {
          if (st.unified) {
            if (!st.serverIdsByZone[zid]) st.serverIdsByZone[zid] = [];
            if (st.serverIdsByZone[zid].indexOf(row.line_id) < 0) st.serverIdsByZone[zid].push(row.line_id);
          } else if (st.serverIds.indexOf(row.line_id) < 0) {
            st.serverIds.push(row.line_id);
          }
        }
      } catch (e) {
        writeDraft(st);
        if (st.ctx.onStatus) st.ctx.onStatus((e && e.message) || '自動暫存失敗，這台仍留著剛才打的', 'err');
        return;
      }
    }
    var structural = grid().autosavePlan(st.rows, {
      serverLineIdsByZone: st.unified ? st.serverIdsByZone : null,
      serverLineIds: st.unified ? null : st.serverIds
    });
    var deleteOps = structural.ops.filter(function (op) { return op.type === 'delete'; });
    for (var d = 0; d < deleteOps.length; d++) {
      var dop = deleteOps[d];
      try {
        var dopZone = dop.zone_id;
        if (!dopZone) {
          st.rows.forEach(function (r) { if (r && r.line_id === dop.line_id) dopZone = r.zone_id; });
        }
        if (st.ctx.saveOp) {
          await st.ctx.saveOp({
            type: 'delete',
            line_id: dop.line_id,
            zone_id: dopZone || (st.zone && st.zone.zone_id)
          });
        }
        if (st.unified) {
          Object.keys(st.deletedByZone || {}).forEach(function (zid) {
            st.deletedByZone[zid] = (st.deletedByZone[zid] || []).filter(function (id) { return id !== dop.line_id; });
          });
          Object.keys(st.serverIdsByZone || {}).forEach(function (zid) {
            st.serverIdsByZone[zid] = (st.serverIdsByZone[zid] || []).filter(function (id) { return id !== dop.line_id; });
          });
        } else {
          st.deleted = (st.deleted || []).filter(function (id) { return id !== dop.line_id; });
          st.serverIds = (st.serverIds || []).filter(function (id) { return id !== dop.line_id; });
        }
      } catch (errDel) {
        writeDraft(st);
        if (st.ctx.onStatus) st.ctx.onStatus((errDel && errDel.message) || '刪除沒有存回報價，送出前會先擋住', 'err');
        return;
      }
    }
    var after = grid().autosavePlan(st.rows, {
      serverLineIdsByZone: st.unified ? st.serverIdsByZone : null,
      serverLineIds: st.unified ? null : st.serverIds
    });
    var reorders = after.ops.filter(function (op) { return op.type === 'reorder'; });
    for (var ri = 0; ri < reorders.length; ri++) {
      var reorder = reorders[ri];
      if (!reorder || !st.ctx.saveOp) continue;
      try {
        await st.ctx.saveOp({
          type: 'reorder',
          zone_id: reorder.zone_id || (st.zone && st.zone.zone_id),
          line_ids: reorder.line_ids
        });
        if (st.unified) {
          st.serverIdsByZone[reorder.zone_id] = (reorder.line_ids || []).slice();
        } else {
          st.serverIds = (reorder.line_ids || []).slice();
        }
      } catch (errRe) {
        writeDraft(st);
        if (st.ctx.onStatus) st.ctx.onStatus((errRe && errRe.message) || '順序沒有存回報價', 'err');
        return;
      }
    }
    writeDraft(st);
    var pendingDel = false;
    if (st.unified) {
      Object.keys(st.deletedByZone || {}).forEach(function (zid) {
        if ((st.deletedByZone[zid] || []).length) pendingDel = true;
      });
    } else if ((st.deleted || []).length) pendingDel = true;
    if (pendingDel && st.ctx.onStatus) {
      st.ctx.onStatus('有列還沒從報價刪掉，送出前會先擋住。', 'err');
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
    host.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!el || !el.getAttribute) return;
      if (el.getAttribute('data-field') === 'item' && el.tagName === 'INPUT') showSuggest(st, el);
    });
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
    if (field === 'tab') {
      var itemEl = st.host.querySelector('[data-row-id="' + rowId + '"][data-field="item"]');
      if (itemEl && document.activeElement === itemEl) showSuggest(st, itemEl);
    }
    if (field === 'zone_id' && el.value === NEW_ZONE_OPT) {
      var prevZone = st.rows[idx].zone_id || '';
      if (st.ctx.pickNewZone) {
        st.ctx.pickNewZone(st, rowId).then(function (zid) {
          st.rows[idx].zone_id = zid;
          render(st, { rowId: rowId, field: 'tab' });
          schedule(st);
        }).catch(function (err) {
          st.rows[idx].zone_id = prevZone;
          render(st, { rowId: rowId, field: 'zone_id' });
          if (st.ctx.onStatus) st.ctx.onStatus((err && err.message) || '新增空間失敗', 'err');
        });
      } else {
        st.rows[idx].zone_id = prevZone;
        render(st, { rowId: rowId, field: 'zone_id' });
      }
      return;
    }
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
    if (btn.getAttribute('data-suggest-custom') != null) {
      var boxCustom = st.host.querySelector('.suggest');
      var rowIdCustom = boxCustom && boxCustom._rowId;
      var idxCustom = findIdx(st.rows, rowIdCustom);
      if (idxCustom >= 0) {
        st.rows[idxCustom].catalog_key = '';
        st.rows[idxCustom].catalog_price = null;
        st.rows[idxCustom].custom = true;
        schedule(st);
        if (st.ctx.onStatus) st.ctx.onStatus('已選自填：名稱、單位、數量、單價請手打', 'ok');
      }
      if (boxCustom) { boxCustom.hidden = true; boxCustom.innerHTML = ''; }
      return;
    }
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
        (removed.removed.items || []).forEach(function (item) {
          rememberDelete(st, item.line_id, st.rows[idx] && st.rows[idx].zone_id);
        });
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
      if (st.ctx.onStatus) {
        st.ctx.onStatus(st.ctx.localOnly ? '順序已調整（這台先記住）' : '順序會存回這份草稿', 'ok');
      }
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

  function mountUnified(host, zones, ctx, preserveRows) {
    if (!host || !grid()) return;
    ctx = ctx || {};
    var all = readAll(ctx);
    var displayZones = (zones && zones.length) ? zones.slice() : [{
      zone_id: ctx.pendingZoneId || '__qe_pending_zone__',
      name: ctx.defaultZoneName || '未分區',
      lines: [],
      _pending: true
    }];
    var serverIdsByZone = {};
    var deletedByZone = {};
    var flat = preserveRows ? preserveRows.slice() : [];
    if (!preserveRows) {
      displayZones.forEach(function (zone) {
        var draft = all && all.zones && all.zones[zone.zone_id];
        var serverRows = grid().rowsFromZone(zone);
        serverRows.forEach(function (r) { r.zone_id = zone.zone_id; });
        var rows = draft ? grid().mergeLocal(serverRows, (draft.rows || []), draft.deletedLineIds || []) : serverRows;
        rows.forEach(function (r) { if (!r.zone_id) r.zone_id = zone.zone_id; });
        while (rows.length && grid().isBlank(rows[rows.length - 1])) rows.pop();
        flat = flat.concat(rows);
        serverIdsByZone[zone.zone_id] = collectIds(zone);
        deletedByZone[zone.zone_id] = (draft && draft.deletedLineIds) ? draft.deletedLineIds.slice() : [];
      });
      grid().ensureTrailingBlank(flat);
      grid().trimExtraTrailing(flat);
    }
    var st = {
      host: host,
      ctx: ctx,
      rows: flat,
      unified: true,
      zones: displayZones,
      serverIdsByZone: serverIdsByZone,
      deletedByZone: deletedByZone,
      lastRemoved: null,
      timer: null,
      composing: false
    };
    states[UNIFIED_KEY] = st;
    host.classList.add('sheet-host');
    render(st);
    bind(st);
  }

  function peekUnifiedRows() {
    var st = states[UNIFIED_KEY];
    return st && st.rows ? st.rows.map(function (r) { return Object.assign({}, r); }) : null;
  }

  function isUnified() {
    return !!states[UNIFIED_KEY];
  }

  function syncZonesFromStaff(ctx) {
    var st = states[UNIFIED_KEY];
    if (!st || !ctx || !ctx.getZones) return;
    st.ctx = ctx;
    st.zones = ctx.getZones() || [];
    var active = false;
    try { active = !!(document.activeElement && st.host.contains(document.activeElement)); } catch (e) { active = false; }
    if (!active) render(st);
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

  function migrateDraftZone(ctx, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    var store = storage();
    if (!store) return;
    var all = readAll(ctx);
    if (!all || !all.zones) return;
    if (all.zones[fromId]) {
      all.zones[toId] = all.zones[fromId];
      delete all.zones[fromId];
      try { store.setItem(draftKey(ctx), JSON.stringify(all)); } catch (e) { /* ignore */ }
    }
  }

  function renamedZoneState(oldId, newZone) {
    var st = states[oldId];
    if (!st || !newZone) return;
    st.zone = newZone;
    states[newZone.zone_id] = st;
    if (oldId !== newZone.zone_id) delete states[oldId];
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
    var unified = states[UNIFIED_KEY];
    if (unified && unified.unified) {
      Object.keys(unified.deletedByZone || {}).forEach(function (zid) {
        (unified.deletedByZone[zid] || []).forEach(function (lineId) {
          if (lineId && all.indexOf(lineId) < 0) all.push(lineId);
        });
      });
      return all;
    }
    Object.keys(states).forEach(function (id) {
      if (id === UNIFIED_KEY) return;
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
    var st = states[UNIFIED_KEY];
    if (!st) return;
    var active = false;
    try { active = !!(document.activeElement && st.host.contains(document.activeElement)); } catch (e) { active = false; }
    if (active) return;
    render(st);
  }

  function recalcFees() {
    var st = states[UNIFIED_KEY];
    if (st) publish(st);
  }

  var api = {
    mount: mount,
    mountUnified: mountUnified,
    peekUnifiedRows: peekUnifiedRows,
    isUnified: isUnified,
    syncZonesFromStaff: syncZonesFromStaff,
    setCatalog: setCatalog,
    setTrades: setTrades,
    pendingDeletes: pendingDeletes,
    clearTotals: clearTotals,
    recalcFees: recalcFees,
    refreshSheets: refreshSheets,
    migrateDraftZone: migrateDraftZone,
    renamedZoneState: renamedZoneState
  };
  root.QuoteEditorGridUi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
