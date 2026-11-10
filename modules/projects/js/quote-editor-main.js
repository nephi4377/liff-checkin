/**
 * QUOTE-EDITOR-3 主控台編輯頁（豪哥：可編輯／工種／附加自填／客人無單價）
 */
(function () {
  var session = null;
  var projectNo = '';
  var staffView = null;
  var busy = false;
  var tradeTabs = [];
  var addonParentId = '';

  function $(id) { return document.getElementById(id); }
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function setStatus(msg, kind) {
    var el = $('statusLine');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function money(n) {
    return (Number(n) || 0).toLocaleString('zh-TW');
  }

  function setBusy(on) {
    busy = !!on;
    ['btnAddZone', 'btnSearch', 'btnPreflight', 'btnPrint', 'btnRefresh',
      'btnSaveFees', 'btnSend', 'btnNewVersion', 'btnAddCustom', 'btnSaveCustom'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = busy;
    });
  }

  function statusLabel(st) {
    var map = { draft: '草稿', sent: '已送出', confirmed: '客人已確認' };
    return map[st] || st || '—';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fillFeesFromStaff() {
    var fees = (staffView && staffView.quote && staffView.quote.fees_received) || {};
    if ($('feeMeasure')) $('feeMeasure').value = fees.measure != null ? fees.measure : 0;
    if ($('feeStartup')) $('feeStartup').value = fees.startup != null ? fees.startup : 0;
    if ($('feePlanning')) $('feePlanning').value = fees.planning != null ? fees.planning : 0;
    if ($('quoteDate')) $('quoteDate').value = (staffView && staffView.quote && staffView.quote.quote_date) || '';
  }

  function fillCustomParentOptions(preferZoneId) {
    var sel = $('customParent');
    if (!sel) return;
    var zones = (staffView && staffView.quote && staffView.quote.zones) || [];
    var zoneId = preferZoneId || ($('zoneSelect') && $('zoneSelect').value) || '';
    var zone = zones.filter(function (z) { return String(z.zone_id) === String(zoneId); })[0];
    var opts = ['<option value=\"\">掛在空間（主項）</option>'];
    if (zone) {
      (zone.lines || []).forEach(function (ln) {
        if (ln.is_cabinet || /櫃/.test(String(ln.item || ''))) {
          opts.push('<option value=\"' + escapeHtml(ln.line_id) + '\">附加於：' + escapeHtml(ln.item) + '</option>');
        }
      });
    }
    var prev = sel.value || addonParentId || '';
    sel.innerHTML = opts.join('');
    if (prev) sel.value = prev;
  }

  function renderVersions() {
    var box = $('versionsBox');
    if (!box) return;
    var list = (staffView && staffView.versions) || [];
    if (!list.length) {
      box.textContent = '尚無版本紀錄';
      return;
    }
    box.innerHTML = '<table><thead><tr><th>版本</th><th>狀態</th><th>含稅</th><th>應付</th><th>更新</th></tr></thead><tbody>' +
      list.map(function (v) {
        return '<tr><td>v' + escapeHtml(String(v.version)) + '</td><td>' + escapeHtml(statusLabel(v.status)) +
          '</td><td>' + money(v.with_tax) + '</td><td>' + money(v.payable) + '</td><td>' +
          escapeHtml(String(v.updated_at || '').slice(0, 16)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function lineEditRow(ln, isAddon) {
    var cls = isAddon ? ' class=\"addon\"' : '';
    return '<tr' + cls + ' data-line=\"' + escapeHtml(ln.line_id) + '\">' +
      '<td><input data-f=\"item\" value=\"' + escapeHtml(ln.item) + '\" style=\"width:100%\" />' +
      '<div class=\"hint\">' + (ln.custom ? '自訂' : escapeHtml(ln.tab || '')) +
      (ln.is_cabinet ? '｜櫃子小計 ' + money(ln.line_subtotal) : '') + '</div>' +
      '<input data-f=\"note\" value=\"' + escapeHtml(ln.note || '') + '\" placeholder=\"說明／規格／材質／色號\" style=\"width:100%;margin-top:0.2rem\" /></td>' +
      '<td><input data-f=\"unit\" value=\"' + escapeHtml(ln.unit) + '\" style=\"width:4rem\" /></td>' +
      '<td><input data-f=\"qty\" type=\"number\" value=\"' + escapeHtml(String(ln.qty)) + '\" style=\"width:4.5rem\" /></td>' +
      '<td><input data-f=\"unit_price\" type=\"number\" value=\"' + escapeHtml(String(ln.unit_price)) + '\" style=\"width:5.5rem\" /></td>' +
      '<td>' + money(ln.amount) +
      '<div class=\"row\" style=\"margin:0.25rem 0 0\">' +
      '<input data-f=\"price_override_reason\" placeholder=\"改價原因\" value=\"' + escapeHtml(ln.price_override_reason || '') + '\" style=\"min-width:6rem;flex:1\" />' +
      '<button type=\"button\" class=\"ghost btn-save-line\" data-id=\"' + escapeHtml(ln.line_id) + '\">存</button>' +
      (ln.is_cabinet
        ? '<button type=\"button\" class=\"ghost btn-addon-hang\" data-id=\"' + escapeHtml(ln.line_id) + '\">掛附加</button>' +
          '<button type=\"button\" class=\"ghost btn-addon-custom\" data-id=\"' + escapeHtml(ln.line_id) + '\">自填附加</button>'
        : '') +
      '</div></td></tr>';
  }

  /** 空間內主項依工種分組（附加項跟在所屬櫃體下） */
  function groupLinesByTrade(lines) {
    var order = [];
    var map = {};
    (lines || []).forEach(function (ln) {
      var tab = String(ln.tab || '其他').trim() || '其他';
      if (!map[tab]) {
        map[tab] = [];
        order.push(tab);
      }
      map[tab].push(ln);
    });
    return order.map(function (tab) { return { tab: tab, lines: map[tab] }; });
  }

  function renderZones() {
    var box = $('zonesBox');
    var sel = $('zoneSelect');
    if (!box || !sel) return;
    var zones = (staffView && staffView.quote && staffView.quote.zones) || [];
    var prevZone = sel.value || '';
    sel.innerHTML = zones.map(function (z) {
      return '<option value=\"' + String(z.zone_id).replace(/\"/g, '') + '\">' + escapeHtml(z.name) + '</option>';
    }).join('') || '<option value=\"\">（尚未新增空間）</option>';
    if (prevZone) {
      var still = zones.some(function (z) { return String(z.zone_id) === String(prevZone); });
      if (still) sel.value = prevZone;
    }
    fillCustomParentOptions(sel.value);

    if (!zones.length) {
      box.innerHTML = '<div class=\"card hint\">尚未新增空間。先在上方加入一個空間（例如客廳）。</div>';
      return;
    }
    box.innerHTML = zones.map(function (z) {
      var tradeBits = (z.trade_groups || []).map(function (g) {
        return escapeHtml(g.tab) + ' ' + money(g.subtotal);
      }).join('／') || '—';
      var groups = groupLinesByTrade(z.lines || []);
      var subMap = {};
      (z.trade_groups || []).forEach(function (g) { subMap[g.tab] = g.subtotal; });
      var rows = '';
      if (!groups.length) {
        rows = '<tr><td colspan=\"5\" class=\"hint\">尚無工項</td></tr>';
      } else {
        groups.forEach(function (g) {
          rows += '<tr class=\"trade-head\"><td colspan=\"5\"><strong>' + escapeHtml(g.tab) +
            '</strong> <span class=\"hint\">工種小計 ' + money(subMap[g.tab]) + '</span></td></tr>';
          g.lines.forEach(function (ln) {
            rows += lineEditRow(ln, false);
            (ln.addons || []).forEach(function (ad) {
              rows += lineEditRow(ad, true);
            });
          });
        });
      }
      return '<div class=\"card\"><div class=\"zone-title\">' + escapeHtml(z.name) +
        ' <span class=\"hint\">空間小計 ' + money(z.zone_subtotal) +
        '｜工種 ' + tradeBits + '</span></div>' +
        '<table><thead><tr><th>項目／說明</th><th>單位</th><th>數量</th><th>單價（員工）</th><th>金額</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    }).join('');

    Array.prototype.forEach.call(box.querySelectorAll('.btn-save-line'), function (btn) {
      btn.onclick = function () { saveLineEdits(btn.getAttribute('data-id')); };
    });
    Array.prototype.forEach.call(box.querySelectorAll('.btn-addon-hang'), function (btn) {
      btn.onclick = function () {
        addonParentId = btn.getAttribute('data-id') || '';
        fillCustomParentOptions();
        if ($('customParent')) $('customParent').value = addonParentId;
        setStatus('已選櫃子：接著搜尋抽屜／拉籃等價目並點選加入', 'ok');
      };
    });
    Array.prototype.forEach.call(box.querySelectorAll('.btn-addon-custom'), function (btn) {
      btn.onclick = function () {
        addonParentId = btn.getAttribute('data-id') || '';
        if ($('customBox')) $('customBox').hidden = false;
        fillCustomParentOptions();
        if ($('customParent')) $('customParent').value = addonParentId;
        setStatus('請填特殊五金自填後按「儲存自填」', 'ok');
      };
    });
  }

  function resolveAddonParentId() {
    return String(
      addonParentId ||
      ($('customParent') && $('customParent').value) ||
      ''
    ).trim();
  }

  function zoneCabinetIds(zoneId) {
    var zones = (staffView && staffView.quote && staffView.quote.zones) || [];
    var z = zones.filter(function (x) { return String(x.zone_id) === String(zoneId); })[0];
    if (!z) return [];
    return (z.lines || []).filter(function (ln) { return !!ln.is_cabinet; }).map(function (ln) {
      return ln.line_id;
    });
  }

  function renderTotals() {
    var el = $('totalsBox');
    if (!el) return;
    var t = (staffView && staffView.totals) || {};
    var handoff = (staffView && staffView.contract_handoff) || {};
    var fees = (staffView && staffView.quote && staffView.quote.fees_received) || {};
    var editable = !(staffView && staffView.editable === false);
    el.innerHTML =
      '未稅合計：' + money(t.pretax) + '<br/>' +
      '稅（5%）：' + money(t.tax) + '<br/>' +
      '含稅總計：' + money(t.with_tax) + '<br/>' +
      '丈量費 ' + money(fees.measure) + '／啟動金 ' + money(fees.startup) + '／規劃費 ' + money(fees.planning) + '<br/>' +
      '已扣合計：' + money(t.deducted) + '<br/>' +
      '應付：' + money(t.payable) + '<br/>' +
      '<span class=\"hint\">合約交接 stub 總價：' + money(handoff.total_with_tax) +
      '｜目前' + (editable ? '可編輯' : '已鎖定（請開新版本）') + '</span>';
  }

  function applyStaff(res, okMsg) {
    staffView = res.staff;
    renderZones();
    fillFeesFromStaff();
    renderTotals();
    renderVersions();
    var q = staffView.quote || {};
    var flag = staffView.feature_enabled ? '正式開放中' : (staffView.project_allowed ? '測試案可用' : '未開放');
    $('headerSub').textContent = '案號 ' + projectNo + '｜版本 v' + (q.version || 1) +
      '｜' + statusLabel(q.status) + '｜' + flag;
    setStatus(okMsg || '已更新', 'ok');
  }

  async function refresh() {
    setStatus('更新中…');
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorGet(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '載入失敗');
      applyStaff(res, '已更新');
      await loadTradeTabs();
    } catch (e) {
      setStatus((e && e.message) || '載入失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function loadTradeTabs() {
    var sel = $('tradeSelect');
    if (!sel) return;
    try {
      var res = await AccountingApi.quoteEditorCatalog(session, projectNo, {});
      if (!res || !res.success) return;
      tradeTabs = res.tabs || [];
      var prev = sel.value || '';
      sel.innerHTML = '<option value=\"\">先選工種…</option>' + tradeTabs.map(function (t) {
        return '<option value=\"' + escapeHtml(t) + '\">' + escapeHtml(t) + '</option>';
      }).join('');
      if (prev) sel.value = prev;
    } catch (e) { /* ignore */ }
  }

  async function addZone() {
    var name = ($('zoneName') && $('zoneName').value || '').trim();
    if (!name) { setStatus('請輸入空間名稱', 'err'); return; }
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorAddZone(session, projectNo, name);
      if (!res || !res.success) throw new Error((res && res.message) || '新增失敗');
      if ($('zoneName')) $('zoneName').value = '';
      applyStaff(res, '已加入空間「' + name + '」');
    } catch (e) {
      setStatus((e && e.message) || '新增失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function searchCatalog() {
    var tab = ($('tradeSelect') && $('tradeSelect').value) || '';
    if (!tab) { setStatus('請先選擇工種', 'err'); return; }
    var q = ($('catalogQ') && $('catalogQ').value || '').trim();
    var box = $('catalogBox');
    if (!box) return;
    setBusy(true);
    setStatus('搜尋價目表…');
    try {
      var res = await AccountingApi.quoteEditorCatalog(session, projectNo, { q: q, tab: tab });
      if (!res || !res.success) throw new Error((res && res.message) || '搜尋失敗');
      var items = res.items || [];
      if (typeof QuoteEditorSanitize !== 'undefined') {
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(items);
        if (leaked) throw new Error('價目表含禁止欄位 ' + leaked + '（已擋下）');
      }
      box.hidden = false;
      if (!items.length) {
        box.innerHTML = '<div class=\"hint\" style=\"padding:0.6rem\">此工種找不到符合品項</div>';
        setStatus('無結果', 'err');
        return;
      }
      box.innerHTML = items.map(function (it) {
        var addonHint = it.likely_addon
          ? '<div class=\"hint\">櫃體加購（請先按櫃子「掛附加」再點）</div>'
          : '';
        return '<button type=\"button\" data-key=\"' + escapeHtml(it.catalog_key) + '\" data-likely-addon=\"' +
          (it.likely_addon ? '1' : '0') + '\">' +
          escapeHtml(it.item) + '｜' + escapeHtml(it.unit) + '｜' + money(it.price) +
          (it.note ? '<div class=\"hint\">' + escapeHtml(it.note) + '</div>' : '') +
          addonHint +
          '</button>';
      }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('button[data-key]'), function (btn) {
        btn.onclick = function () {
          if (busy) return;
          btn.disabled = true;
          addLine(btn.getAttribute('data-key'), btn.getAttribute('data-likely-addon') === '1')
            .finally(function () {
              if (btn && btn.isConnected) btn.disabled = false;
            });
        };
      });
      setStatus('找到 ' + items.length + ' 筆，點選加入', 'ok');
    } catch (e) {
      setStatus((e && e.message) || '搜尋失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function addLine(catalogKey, likelyAddon) {
    if (busy) return;
    var zoneId = ($('zoneSelect') && $('zoneSelect').value) || '';
    if (!zoneId) { setStatus('請先新增並選擇空間', 'err'); return; }
    var qty = ($('qty') && $('qty').value) || '';
    if (Number(qty) > 9999) { setStatus('數量不可超過 9999', 'err'); return; }
    var overridePrice = ($('overridePrice') && $('overridePrice').value) || '';
    var reason = ($('overrideReason') && $('overrideReason').value) || '';
    var parentId = resolveAddonParentId();
    var cabinets = zoneCabinetIds(zoneId);
    if (likelyAddon && cabinets.length && !parentId) {
      if (cabinets.length === 1) {
        parentId = cabinets[0];
        addonParentId = parentId;
        if ($('customParent')) $('customParent').value = parentId;
      } else {
        setStatus('此品項是櫃體加購：請先按某櫃的「掛附加」，再點價目加入', 'err');
        return;
      }
    }
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorAddLine(session, {
        project_no: projectNo,
        zone_id: zoneId,
        catalog_key: catalogKey,
        qty: qty,
        unit_price: overridePrice === '' ? undefined : overridePrice,
        price_override_reason: reason,
        parent_line_id: parentId || undefined
      });
      if (!res || !res.success) throw new Error((res && res.message) || '加入失敗');
      addonParentId = '';
      applyStaff(res, '已加入工項');
    } catch (e) {
      setStatus((e && e.message) || '加入失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function saveCustom() {
    if (busy) return;
    var zoneId = ($('zoneSelect') && $('zoneSelect').value) || '';
    if (!zoneId) { setStatus('請先選擇空間', 'err'); return; }
    var parentId = ($('customParent') && $('customParent').value) || addonParentId || '';
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorAddLine(session, {
        project_no: projectNo,
        zone_id: zoneId,
        custom: true,
        item: ($('customItem') && $('customItem').value) || '',
        note: ($('customNote') && $('customNote').value) || '',
        unit: ($('customUnit') && $('customUnit').value) || '',
        qty: ($('customQty') && $('customQty').value) || 1,
        unit_price: ($('customPrice') && $('customPrice').value) || '',
        tab: ($('tradeSelect') && $('tradeSelect').value) || '自訂',
        parent_line_id: parentId || undefined,
        price_override_reason: parentId ? '特殊五金自填' : '自訂項'
      });
      if (!res || !res.success) throw new Error((res && res.message) || '自填失敗');
      addonParentId = '';
      if ($('customBox')) $('customBox').hidden = true;
      applyStaff(res, '已儲存自填項');
    } catch (e) {
      setStatus((e && e.message) || '自填失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function saveLineEdits(lineId) {
    if (busy || !lineId) return;
    var tr = document.querySelector('tr[data-line=\"' + lineId + '\"]');
    if (!tr) return;
    function val(f) {
      var el = tr.querySelector('[data-f=\"' + f + '\"]');
      return el ? el.value : '';
    }
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorUpdateLine(session, {
        project_no: projectNo,
        line_id: lineId,
        item: val('item'),
        note: val('note'),
        unit: val('unit'),
        qty: val('qty'),
        unit_price: val('unit_price'),
        price_override_reason: val('price_override_reason')
      });
      if (!res || !res.success) throw new Error((res && res.message) || '儲存失敗');
      applyStaff(res, '已更新工項');
    } catch (e) {
      setStatus((e && e.message) || '儲存失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function saveFees() {
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorSetFees(session, projectNo, {
        measure: ($('feeMeasure') && $('feeMeasure').value) || 0,
        startup: ($('feeStartup') && $('feeStartup').value) || 0,
        planning: ($('feePlanning') && $('feePlanning').value) || 0
      }, { quote_date: ($('quoteDate') && $('quoteDate').value) || '' });
      if (!res || !res.success) throw new Error((res && res.message) || '儲存失敗');
      applyStaff(res, '已儲存扣費');
    } catch (e) {
      setStatus((e && e.message) || '儲存失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function sendQuote() {
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorSend(session, projectNo, {
        version_note: ($('versionNote') && $('versionNote').value) || ''
      });
      if (!res || !res.success) {
        var box = $('preflightBox');
        if (box && res) {
          box.hidden = false;
          box.textContent = JSON.stringify({
            ok_to_send: res.ok_to_send, blockers: res.blockers, warnings: res.warnings, message: res.message
          }, null, 2);
        }
        throw new Error((res && res.message) || '送出失敗');
      }
      if (typeof QuoteEditorSanitize !== 'undefined' && res.customer_preview) {
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(res.customer_preview);
        if (leaked) throw new Error('送出資料含禁止欄位 ' + leaked);
        if (JSON.stringify(res.customer_preview).indexOf('"unit_price"') !== -1) {
          throw new Error('送出資料仍含單價，已擋下');
        }
      }
      applyStaff(res, '已送出給客人（此版鎖定）');
    } catch (e) {
      setStatus((e && e.message) || '送出失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function newVersion() {
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorNewVersion(session, projectNo, {
        version_note: ($('versionNote') && $('versionNote').value) || ''
      });
      if (!res || !res.success) throw new Error((res && res.message) || '開新版本失敗');
      applyStaff(res, '已開新版本草稿');
    } catch (e) {
      setStatus((e && e.message) || '開新版本失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function preflight() {
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorPreflight(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '檢查失敗');
      var box = $('preflightBox');
      if (box) {
        box.hidden = false;
        box.textContent = JSON.stringify({
          ok_to_send: res.ok_to_send, blockers: res.blockers, warnings: res.warnings,
          totals: res.totals, contract_handoff: res.contract_handoff
        }, null, 2);
      }
      setStatus(res.ok_to_send ? '檢查通過，可準備給客人' : '尚有需處理項目', res.ok_to_send ? 'ok' : 'err');
    } catch (e) {
      setStatus((e && e.message) || '檢查失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  function renderCustomerLines(lines, indent) {
    indent = indent || false;
    return (lines || []).map(function (ln) {
      var note = ln.note ? '<div class=\"hint\">' + escapeHtml(ln.note) + '</div>' : '';
      var sub = ln.line_subtotal != null && ln.addons && ln.addons.length
        ? '（含附加小計 ' + money(ln.line_subtotal) + '）' : '';
      var row = '<tr' + (indent ? ' class=\"addon\"' : '') + '><td>' + escapeHtml(ln.item) + note + sub +
        '</td><td>' + escapeHtml(ln.unit) + '</td><td>' + escapeHtml(String(ln.qty)) +
        '</td><td>' + money(ln.amount) + '</td></tr>';
      return row + renderCustomerLines(ln.addons || [], true);
    }).join('');
  }

  function renderCustomerLinesByTrade(zone) {
    var groups = groupLinesByTrade(zone.lines || []);
    var subMap = {};
    (zone.trade_groups || []).forEach(function (g) { subMap[g.tab] = g.subtotal; });
    if (!groups.length) return '<tr><td colspan=\"4\">（無項目）</td></tr>';
    return groups.map(function (g) {
      return '<tr class=\"trade-head\"><td colspan=\"4\"><strong>' + escapeHtml(g.tab) +
        '</strong> <span class=\"hint\">小計 ' + money(subMap[g.tab]) + '</span></td></tr>' +
        renderCustomerLines(g.lines);
    }).join('');
  }

  async function printPreview() {
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorPrint(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '列印失敗');
      var print = res.print || {};
      if (typeof QuoteEditorSanitize !== 'undefined') {
        print = QuoteEditorSanitize.toCustomerQuote(print);
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(print);
        if (leaked) throw new Error('列印資料含禁止欄位 ' + leaked);
        if (JSON.stringify(print).indexOf('"unit_price"') !== -1) {
          throw new Error('列印資料含單價，已擋下');
        }
      }
      var w = window.open('', '_blank');
      if (!w) throw new Error('瀏覽器阻擋彈窗');
      var zonesHtml = (print.zones || []).map(function (z) {
        var trade = (z.trade_groups || []).map(function (g) {
          return escapeHtml(g.tab) + ' ' + money(g.subtotal);
        }).join('／');
        return '<h3>' + escapeHtml(z.name) + '（小計 ' + money(z.zone_subtotal) +
          (trade ? '｜' + trade : '') + '）</h3>' +
          '<table border=\"1\" cellpadding=\"4\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%\">' +
          '<tr><th>項目</th><th>單位</th><th>數量</th><th>金額</th></tr>' +
          renderCustomerLinesByTrade(z) + '</table>';
      }).join('');
      var t = print.totals || {};
      var f = print.fees_received || {};
      w.document.write('<html><head><title>報價列印</title></head><body style=\"font-family:sans-serif;padding:16px\">' +
        '<h2>工程報價單</h2><div>案號 ' + escapeHtml(print.project_no || projectNo) + '</div>' +
        zonesHtml +
        '<p>未稅 ' + money(t.pretax) + '｜稅 ' + money(t.tax) + '｜含稅 ' + money(t.with_tax) + '</p>' +
        '<p>已收丈量費 ' + money(f.measure) + '／啟動金 ' + money(f.startup) + '／規劃費 ' + money(f.planning) +
        '<br/>已扣 ' + money(t.deducted) + '｜應付 ' + money(t.payable) + '</p></body></html>');
      w.document.close();
      w.focus();
      w.print();
      setStatus('已開列印預覽', 'ok');
    } catch (e) {
      setStatus((e && e.message) || '列印失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function boot() {
    projectNo = qs('project_no') || qs('projectNo') || '';
    if (!projectNo) {
      $('headerSub').textContent = '網址缺少案號 project_no';
      setStatus('請從主控台案號進入', 'err');
      return;
    }
    $('headerSub').textContent = '案號 ' + projectNo + '｜登入中…';
    try {
      session = await AccountingApi.initSession({ minPermission: 2 });
      await refresh();
    } catch (e) {
      setStatus((e && e.message) || '登入失敗', 'err');
    }
  }

  $('btnAddZone').onclick = addZone;
  $('btnSearch').onclick = searchCatalog;
  $('btnPreflight').onclick = preflight;
  $('btnPrint').onclick = printPreview;
  $('btnRefresh').onclick = refresh;
  if ($('btnSaveFees')) $('btnSaveFees').onclick = saveFees;
  if ($('btnSend')) $('btnSend').onclick = sendQuote;
  if ($('btnNewVersion')) $('btnNewVersion').onclick = newVersion;
  if ($('btnAddCustom')) $('btnAddCustom').onclick = function () {
    if ($('customBox')) $('customBox').hidden = !$('customBox').hidden;
    fillCustomParentOptions();
  };
  if ($('btnSaveCustom')) $('btnSaveCustom').onclick = saveCustom;
  if ($('zoneSelect')) $('zoneSelect').onchange = function () { fillCustomParentOptions(); };
  boot();
})();
