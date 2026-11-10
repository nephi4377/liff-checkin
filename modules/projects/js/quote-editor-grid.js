/**
 * 報價編輯器試算表：格子移動、貼上、加購、即時金額、自動暫存計畫。
 * 純資料，不碰畫面、不碰功能開關。客人用的列由 toCustomerLines 去掉單價。
 */
(function (root) {
  var COLS = ['tab', 'item', 'unit', 'qty', 'unit_price', 'note', 'price_override_reason'];
  var seq = 1;

  function roundMoney(n) {
    return Math.round(Number(n) || 0);
  }

  function parseNum(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
    var n = Number(String(raw == null ? '' : raw).replace(/[,，\s元]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function looksLikeCabinet(item, unit, note) {
    var hay = String(item || '') + ' ' + String(note || '');
    if (/櫃|衣櫃|系統櫃/.test(hay)) return true;
    var u = String(unit || '').trim();
    if ((u === '尺' || u === '台尺') && /層板|門片|推拉門|基本尺\s*是?\s*1\.5/.test(hay)) return true;
    return false;
  }

  function looksLikeAddon(item, note) {
    var hay = String(item || '') + ' ' + String(note || '');
    return /抽屜|拉籃|五金|鉸鍊|滑軌|把手|特殊五金/.test(hay);
  }

  function blankRow(extra) {
    var row = {
      row_id: 'r' + (seq++),
      line_id: '',
      parent_line_id: '',
      parent_row_id: '',
      depth: 0,
      tab: '',
      item: '',
      unit: '',
      qty: '',
      unit_price: '',
      note: '',
      price_override_reason: '',
      catalog_key: '',
      catalog_price: null,
      saved_unit_price: null,
      custom: false,
      is_cabinet: false,
      amount: 0,
      line_subtotal: 0,
      dirty: false
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    }
    return row;
  }

  function isBlank(row) {
    if (!row) return true;
    for (var i = 0; i < COLS.length; i++) {
      if (String(row[COLS[i]] == null ? '' : row[COLS[i]]).trim() !== '') return false;
    }
    return true;
  }

  function isChild(row) {
    if (!row) return false;
    return !!(String(row.parent_row_id || '').trim() || String(row.parent_line_id || '').trim());
  }

  function isChildOf(row, parent) {
    if (!row || !parent) return false;
    if (parent.row_id && row.parent_row_id && row.parent_row_id === parent.row_id) return true;
    if (parent.line_id && row.parent_line_id && row.parent_line_id === parent.line_id) return true;
    return false;
  }

  function trimExtraTrailing(rows) {
    while (rows.length >= 2 && isBlank(rows[rows.length - 1]) && isBlank(rows[rows.length - 2])) {
      rows.pop();
    }
    return rows;
  }

  function ensureTrailingBlank(rows) {
    if (!rows.length || !isBlank(rows[rows.length - 1])) rows.push(blankRow());
    return rows;
  }

  function touchCell(rows, index, field, value) {
    var row = rows[index];
    if (!row) return { rows: rows, added: false };
    row[field] = value;
    row.dirty = true;
    var added = false;
    if (index === rows.length - 1 && !isBlank(row)) {
      rows.push(blankRow());
      added = true;
    }
    return { rows: rows, added: added };
  }

  function commitEnter(rows, rowIndex) {
    var row = rows[rowIndex];
    if (!row) return { rows: rows, next: rowIndex, added: false };
    if (rowIndex < rows.length - 1) {
      return { rows: rows, next: rowIndex + 1, added: false };
    }
    if (!isBlank(row)) {
      rows.push(blankRow());
      return { rows: rows, next: rows.length - 1, added: true };
    }
    return { rows: rows, next: rowIndex, added: false };
  }

  function moveCell(pos, key, bounds) {
    var row = pos.row;
    var col = pos.col;
    var rowCount = bounds.rows;
    var colCount = bounds.cols;
    if (key === 'Tab') {
      col += 1;
      if (col >= colCount) { col = 0; row += 1; }
    } else if (key === 'ShiftTab') {
      col -= 1;
      if (col < 0) { col = colCount - 1; row -= 1; }
    } else if (key === 'ArrowRight') col += 1;
    else if (key === 'ArrowLeft') col -= 1;
    else if (key === 'ArrowDown') row += 1;
    else if (key === 'ArrowUp') row -= 1;
    else if (key === 'Enter') row += 1;
    else return { row: pos.row, col: pos.col, moved: false, needRow: false };

    if (col < 0 || col >= colCount || row < 0) {
      return { row: pos.row, col: pos.col, moved: false, needRow: false };
    }
    if (row >= rowCount) {
      return {
        row: pos.row,
        col: pos.col,
        moved: false,
        needRow: key === 'Enter' || key === 'ArrowDown'
      };
    }
    return { row: row, col: col, moved: true, needRow: false };
  }

  var HEADER_MAP = {
    '工種': 'tab',
    '項目': 'item',
    '品名': 'item',
    '品項': 'item',
    '名稱': 'item',
    '單位': 'unit',
    '數量': 'qty',
    '單價': 'unit_price',
    '說明': 'note',
    '備註': 'note',
    '改價原因': 'price_override_reason'
  };

  function parseClipboard(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var matrix = [];
    lines.forEach(function (line) {
      if (String(line).trim() === '') return;
      matrix.push(String(line).split('\t').map(function (cell) { return String(cell).trim(); }));
    });
    if (!matrix.length) return { matrix: [], fields: null };
    var fields = matrix[0].map(function (cell) { return HEADER_MAP[cell] || null; });
    var hits = 0;
    fields.forEach(function (f) { if (f) hits += 1; });
    if (hits >= 2) return { matrix: matrix.slice(1), fields: fields };
    return { matrix: matrix, fields: null };
  }

  function cleanPasted(field, val) {
    var text = String(val == null ? '' : val).trim();
    if (field === 'qty' || field === 'unit_price') text = text.replace(/[,，\s元]/g, '');
    return text;
  }

  function applyClipboard(rows, startRow, startCol, text) {
    var parsed = parseClipboard(text);
    if (!parsed.matrix.length) return { rows: rows, count: 0 };
    if (!rows.length) rows.push(blankRow());
    var r = startRow < 0 ? 0 : startRow;
    parsed.matrix.forEach(function (cells) {
      if (r >= rows.length) rows.push(blankRow());
      var row = rows[r];
      cells.forEach(function (val, c) {
        var field = parsed.fields ? parsed.fields[c] : COLS[startCol + c];
        if (!field) return;
        row[field] = cleanPasted(field, val);
      });
      if (!row.catalog_key) row.custom = true;
      row.dirty = true;
      r += 1;
    });
    ensureTrailingBlank(rows);
    trimExtraTrailing(rows);
    return { rows: rows, count: parsed.matrix.length };
  }

  function cleanHit(it) {
    return {
      item: it.item,
      unit: it.unit,
      price: it.price,
      tab: it.tab || '',
      note: it.note || '',
      catalog_key: it.catalog_key || '',
      likely_addon: !!(it.likely_addon || looksLikeAddon(it.item, it.note)),
      likely_cabinet: !!(it.likely_cabinet || looksLikeCabinet(it.item, it.unit, it.note))
    };
  }

  function suggestItems(catalog, query, tab, limit) {
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var max = limit || 8;
    var list = (catalog || []).filter(function (it) {
      var hay = (String(it.item || '') + ' ' + String(it.note || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
      if (tab && String(it.tab || '') !== String(tab)) return false;
      return true;
    });
    return list.slice(0, max).map(cleanHit);
  }

  function applyCatalogHit(row, hit) {
    if (!row || !hit) return row;
    var keepNote = String(row.note || '').trim();
    row.item = hit.item;
    row.unit = hit.unit || row.unit;
    row.unit_price = hit.price;
    row.tab = hit.tab || row.tab;
    row.catalog_key = hit.catalog_key || '';
    row.catalog_price = hit.price;
    if (!keepNote && hit.note) row.note = hit.note;
    row.custom = false;
    row.dirty = true;
    if (hit.likely_cabinet || looksLikeCabinet(row.item, row.unit, row.note)) row.is_cabinet = true;
    return row;
  }

  function placeAddonIfNeeded(rows, index) {
    var row = rows[index];
    if (!row || !looksLikeAddon(row.item, row.note)) return { rows: rows, moved: false };
    if (isChild(row)) return { rows: rows, moved: false };
    var cabinets = [];
    rows.forEach(function (r, i) {
      if (!r || isBlank(r) || isChild(r)) return;
      if (r.is_cabinet || looksLikeCabinet(r.item, r.unit, r.note)) cabinets.push(i);
    });
    if (!cabinets.length) return { rows: rows, moved: false };
    var target = cabinets[0];
    cabinets.forEach(function (i) { if (i < index) target = i; });
    var parent = rows[target];
    var item = rows.splice(index, 1)[0];
    item.parent_row_id = parent.row_id;
    item.parent_line_id = parent.line_id || '';
    item.depth = 1;
    if (!item.catalog_key) item.custom = true;
    var pIndex = 0;
    rows.forEach(function (r, i) { if (r.row_id === parent.row_id) pIndex = i; });
    var insertAt = pIndex + 1;
    while (insertAt < rows.length && isChildOf(rows[insertAt], parent)) insertAt += 1;
    rows.splice(insertAt, 0, item);
    ensureTrailingBlank(rows);
    return { rows: rows, moved: true };
  }

  function totalsFromPretax(pretax, fees) {
    pretax = roundMoney(pretax);
    var tax = roundMoney(pretax * 0.05);
    var withTax = roundMoney(pretax + tax);
    fees = fees || {};
    var deducted = roundMoney(parseNum(fees.measure) + parseNum(fees.startup) + parseNum(fees.planning));
    var payable = roundMoney(Math.max(0, withTax - deducted));
    return {
      pretax: pretax,
      tax: tax,
      tax_rate: 0.05,
      with_tax: withTax,
      deducted: deducted,
      payable: payable
    };
  }

  function recalc(rows, fees) {
    (rows || []).forEach(function (row) {
      if (!row || !String(row.item || '').trim()) {
        if (row) {
          row.amount = 0;
          row.line_subtotal = 0;
        }
        return;
      }
      row.amount = roundMoney(parseNum(row.qty) * parseNum(row.unit_price));
      if (!isChild(row) && looksLikeCabinet(row.item, row.unit, row.note)) row.is_cabinet = true;
    });
    (rows || []).forEach(function (row) {
      if (!row || isChild(row)) {
        if (row) row.line_subtotal = row.amount || 0;
        return;
      }
      var sum = row.amount || 0;
      rows.forEach(function (ch) {
        if (isChildOf(ch, row)) sum += ch.amount || 0;
      });
      row.line_subtotal = roundMoney(sum);
    });
    var map = {};
    var order = [];
    var zone = 0;
    (rows || []).forEach(function (row) {
      if (!row || !String(row.item || '').trim()) return;
      zone += row.amount || 0;
      var tab = String(row.tab || '其他').trim() || '其他';
      if (!map[tab]) {
        map[tab] = { tab: tab, subtotal: 0, line_count: 0 };
        order.push(tab);
      }
      map[tab].subtotal = roundMoney(map[tab].subtotal + (row.amount || 0));
      map[tab].line_count += 1;
    });
    zone = roundMoney(zone);
    return {
      rows: rows,
      groups: order.map(function (tab) { return map[tab]; }),
      zone_subtotal: zone,
      totals: totalsFromPretax(zone, fees)
    };
  }

  function addAddonRow(rows, index) {
    var parent = rows[index];
    if (!parent || isBlank(parent)) return { rows: rows, index: -1 };
    if (isChild(parent)) {
      var host = null;
      rows.forEach(function (r) {
        if (parent.parent_row_id && r.row_id === parent.parent_row_id) host = r;
        if (parent.parent_line_id && r.line_id === parent.parent_line_id) host = r;
      });
      if (!host) return { rows: rows, index: -1 };
      parent = host;
    }
    if (!(parent.is_cabinet || looksLikeCabinet(parent.item, parent.unit, parent.note))) {
      return { rows: rows, index: -1 };
    }
    parent.is_cabinet = true;
    var neu = blankRow({
      parent_row_id: parent.row_id,
      parent_line_id: parent.line_id || '',
      depth: 1,
      tab: parent.tab || '',
      unit: '組',
      custom: true
    });
    var at = rows.indexOf(parent) + 1;
    while (at < rows.length && isChildOf(rows[at], parent)) at += 1;
    rows.splice(at, 0, neu);
    ensureTrailingBlank(rows);
    return { rows: rows, index: at };
  }

  function deleteRow(rows, index) {
    if (index < 0 || index >= rows.length) return { rows: rows, removed: null };
    var row = rows[index];
    if (!row || isBlank(row)) return { rows: rows, removed: null };
    var len = 1;
    if (!isChild(row)) {
      while (index + len < rows.length && isChildOf(rows[index + len], row)) len += 1;
    }
    var items = rows.splice(index, len);
    ensureTrailingBlank(rows);
    trimExtraTrailing(rows);
    return { rows: rows, removed: { index: index, items: items } };
  }

  function undoDelete(rows, removed) {
    if (!removed || !removed.items || !removed.items.length) return rows;
    var at = removed.index;
    if (at < 0) at = 0;
    removed.items.forEach(function (item, i) {
      rows.splice(at + i, 0, item);
    });
    trimExtraTrailing(rows);
    ensureTrailingBlank(rows);
    return rows;
  }

  function insertBelow(rows, index) {
    var row = rows[index];
    if (!row) return { rows: rows, index: -1 };
    var neu = blankRow();
    var at = index + 1;
    if (isChild(row)) {
      neu.parent_row_id = row.parent_row_id;
      neu.parent_line_id = row.parent_line_id;
      neu.depth = 1;
      neu.tab = row.tab || '';
      neu.unit = row.unit || '組';
      neu.custom = true;
    } else {
      while (at < rows.length && isChildOf(rows[at], row)) at += 1;
    }
    rows.splice(at, 0, neu);
    ensureTrailingBlank(rows);
    trimExtraTrailing(rows);
    return { rows: rows, index: at };
  }

  function topBlocks(rows) {
    var blocks = [];
    var i = 0;
    while (i < rows.length) {
      if (isBlank(rows[i]) && i === rows.length - 1) break;
      if (isChild(rows[i])) {
        blocks.push({ start: i, len: 1 });
        i += 1;
        continue;
      }
      var len = 1;
      while (i + len < rows.length && isChildOf(rows[i + len], rows[i])) len += 1;
      blocks.push({ start: i, len: len });
      i += len;
    }
    return blocks;
  }

  function moveRow(rows, index, dir) {
    var row = rows[index];
    if (!row || isBlank(row)) return rows;
    if (isChild(row)) {
      var sibs = [];
      rows.forEach(function (r, i) {
        if (!isChild(r)) return;
        var same = (row.parent_row_id && r.parent_row_id === row.parent_row_id) ||
          (row.parent_line_id && r.parent_line_id === row.parent_line_id);
        if (same) sibs.push(i);
      });
      var pos = sibs.indexOf(index);
      var target = sibs[pos + dir];
      if (pos < 0 || target == null) return rows;
      var tmp = rows[index];
      rows[index] = rows[target];
      rows[target] = tmp;
      return rows;
    }
    var blocks = topBlocks(rows);
    var bi = -1;
    blocks.forEach(function (blk, i) {
      if (index >= blk.start && index < blk.start + blk.len) bi = i;
    });
    var bj = bi + dir;
    if (bi < 0 || bj < 0 || bj >= blocks.length) return rows;
    var pieces = blocks.map(function (blk) { return rows.slice(blk.start, blk.start + blk.len); });
    var swap = pieces[bi];
    pieces[bi] = pieces[bj];
    pieces[bj] = swap;
    var trailing = (rows.length && isBlank(rows[rows.length - 1])) ? rows[rows.length - 1] : null;
    var flat = [];
    pieces.forEach(function (piece) {
      piece.forEach(function (r) { flat.push(r); });
    });
    rows.length = 0;
    flat.forEach(function (r) {
      if (trailing && r === trailing) return;
      rows.push(r);
    });
    if (trailing) rows.push(trailing);
    ensureTrailingBlank(rows);
    trimExtraTrailing(rows);
    return rows;
  }

  function parentLineId(row, rows) {
    if (row.parent_line_id) return String(row.parent_line_id);
    if (!row.parent_row_id) return '';
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].row_id === row.parent_row_id) return String(rows[i].line_id || '');
    }
    return '';
  }

  function priceChanged(row) {
    var next = roundMoney(parseNum(row.unit_price));
    if (row.catalog_price != null && row.catalog_price !== '' && roundMoney(row.catalog_price) !== next) return true;
    if (row.saved_unit_price != null && row.saved_unit_price !== '' && roundMoney(row.saved_unit_price) !== next) return true;
    return false;
  }

  function needsReason(row) {
    if (!priceChanged(row)) return false;
    return !String(row.price_override_reason || '').trim();
  }

  function isPersistable(row) {
    if (!row || isBlank(row)) return false;
    if (!String(row.item || '').trim()) return false;
    if (!String(row.unit || '').trim()) return false;
    if (!(parseNum(row.qty) > 0)) return false;
    if (!(parseNum(row.unit_price) > 0)) return false;
    return true;
  }

  function toPayload(row, rows) {
    var pid = parentLineId(row, rows);
    var custom = !String(row.catalog_key || '').trim();
    var reason = String(row.price_override_reason || '').trim();
    if (!reason && custom) reason = pid ? '特殊五金自填' : '自訂項';
    return {
      custom: custom,
      catalog_key: row.catalog_key || '',
      item: String(row.item || '').trim(),
      note: String(row.note || '').trim(),
      unit: String(row.unit || '').trim(),
      qty: row.qty,
      unit_price: row.unit_price,
      tab: String(row.tab || '').trim() || '自訂',
      parent_line_id: pid,
      price_override_reason: reason
    };
  }

  function autosavePlan(rows, opts) {
    opts = opts || {};
    var ops = [];
    var seen = {};
    (rows || []).forEach(function (row) {
      if (row && row.line_id) seen[String(row.line_id)] = true;
      if (!isPersistable(row)) return;
      if (needsReason(row)) {
        ops.push({
          type: 'blocked',
          row_id: row.row_id,
          message: '改了單價，請填原因後會自動存'
        });
        return;
      }
      if (!row.line_id) {
        var pid = parentLineId(row, rows);
        if ((row.parent_row_id || row.parent_line_id) && !pid) {
          ops.push({ type: 'wait', row_id: row.row_id, message: '等櫃子先存好，再存加購' });
          return;
        }
        ops.push({ type: 'add', row_id: row.row_id, payload: toPayload(row, rows) });
        return;
      }
      if (row.dirty) {
        ops.push({ type: 'update', row_id: row.row_id, payload: toPayload(row, rows) });
      }
    });
    var localDeletes = [];
    (opts.serverLineIds || []).forEach(function (id) {
      if (id && !seen[String(id)]) localDeletes.push(id);
    });
    return { ops: ops, localDeletes: localDeletes };
  }

  function toCustomerLines(rows) {
    var tops = [];
    var byRow = {};
    (rows || []).forEach(function (row) {
      if (!row || !String(row.item || '').trim()) return;
      var amount = roundMoney(row.amount != null ? row.amount : parseNum(row.qty) * parseNum(row.unit_price));
      var view = {
        line_id: row.line_id || row.row_id,
        item: row.item,
        unit: row.unit,
        qty: row.qty,
        amount: amount,
        note: row.note || '',
        tab: row.tab || '',
        is_cabinet: !!row.is_cabinet && !isChild(row),
        line_subtotal: amount,
        addons: []
      };
      if (isChild(row)) {
        var parent = null;
        (rows || []).forEach(function (r) {
          if (row.parent_row_id && r.row_id === row.parent_row_id) parent = r;
          if (!parent && row.parent_line_id && r.line_id === row.parent_line_id) parent = r;
        });
        var host = parent && byRow[parent.row_id];
        if (host) host.addons.push(view);
        else tops.push(view);
      } else {
        tops.push(view);
        byRow[row.row_id] = view;
      }
    });
    tops.forEach(function (top) {
      var extra = 0;
      (top.addons || []).forEach(function (ad) { extra += ad.amount || 0; });
      top.line_subtotal = roundMoney((top.amount || 0) + extra);
    });
    return tops;
  }

  function rowFromLine(ln, depth, parentRow) {
    return blankRow({
      line_id: ln.line_id || '',
      parent_line_id: ln.parent_line_id || (parentRow && parentRow.line_id) || '',
      parent_row_id: parentRow ? parentRow.row_id : '',
      depth: depth,
      tab: ln.tab || '',
      item: ln.item || '',
      unit: ln.unit || '',
      qty: ln.qty == null ? '' : ln.qty,
      unit_price: ln.unit_price == null ? '' : ln.unit_price,
      note: ln.note || '',
      price_override_reason: ln.price_override_reason || '',
      catalog_key: ln.catalog_key || '',
      custom: !!ln.custom,
      is_cabinet: !!ln.is_cabinet || (!parentRow && looksLikeCabinet(ln.item, ln.unit, ln.note)),
      amount: roundMoney(ln.amount),
      saved_unit_price: ln.unit_price == null || ln.unit_price === '' ? null : ln.unit_price,
      dirty: false
    });
  }

  function rowsFromZone(zone) {
    var rows = [];
    ((zone && zone.lines) || []).forEach(function (ln) {
      var top = rowFromLine(ln, 0, null);
      rows.push(top);
      (ln.addons || []).forEach(function (ad) {
        rows.push(rowFromLine(ad, 1, top));
      });
    });
    ensureTrailingBlank(rows);
    return rows;
  }

  function mergeLocal(serverRows, localRows, deletedIds) {
    var deleted = {};
    (deletedIds || []).forEach(function (id) { if (id) deleted[String(id)] = true; });
    var localById = {};
    var unsaved = [];
    (localRows || []).forEach(function (r) {
      if (!r || isBlank(r)) return;
      if (r.line_id && deleted[String(r.line_id)]) return;
      if (r.line_id) localById[String(r.line_id)] = r;
      else unsaved.push(r);
    });
    var out = [];
    (serverRows || []).forEach(function (r) {
      if (!r || isBlank(r)) return;
      if (r.line_id && deleted[String(r.line_id)]) return;
      var local = r.line_id ? localById[String(r.line_id)] : null;
      if (local && local.dirty) {
        var merged = Object.assign({}, r);
        ['tab', 'item', 'unit', 'qty', 'unit_price', 'note', 'price_override_reason', 'catalog_key', 'custom'].forEach(function (k) {
          if (local[k] != null) merged[k] = local[k];
        });
        merged.dirty = true;
        merged.line_id = r.line_id;
        merged.row_id = r.row_id;
        out.push(merged);
      } else {
        out.push(Object.assign({}, r));
      }
    });
    unsaved.forEach(function (u) {
      var copy = Object.assign({}, u);
      if (copy.parent_line_id || copy.parent_row_id) {
        var idx = -1;
        for (var i = 0; i < out.length; i++) {
          if ((copy.parent_line_id && out[i].line_id === copy.parent_line_id) ||
              (copy.parent_row_id && out[i].row_id === copy.parent_row_id)) idx = i;
        }
        if (idx >= 0) out.splice(idx + 1, 0, copy);
        else out.push(copy);
      } else {
        out.push(copy);
      }
    });
    ensureTrailingBlank(out);
    trimExtraTrailing(out);
    return out;
  }

  var api = {
    COLS: COLS,
    roundMoney: roundMoney,
    parseNum: parseNum,
    looksLikeCabinet: looksLikeCabinet,
    looksLikeAddon: looksLikeAddon,
    blankRow: blankRow,
    isBlank: isBlank,
    ensureTrailingBlank: ensureTrailingBlank,
    touchCell: touchCell,
    commitEnter: commitEnter,
    moveCell: moveCell,
    parseClipboard: parseClipboard,
    applyClipboard: applyClipboard,
    suggestItems: suggestItems,
    applyCatalogHit: applyCatalogHit,
    placeAddonIfNeeded: placeAddonIfNeeded,
    totalsFromPretax: totalsFromPretax,
    recalc: recalc,
    addAddonRow: addAddonRow,
    deleteRow: deleteRow,
    undoDelete: undoDelete,
    insertBelow: insertBelow,
    moveRow: moveRow,
    autosavePlan: autosavePlan,
    toCustomerLines: toCustomerLines,
    rowsFromZone: rowsFromZone,
    mergeLocal: mergeLocal
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuoteEditorGrid = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
