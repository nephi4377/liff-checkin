/**
 * QUOTE-EDITOR-3 主控台編輯頁（切片 1–2）
 */
(function () {
  var session = null;
  var projectNo = '';
  var staffView = null;
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function setStatus(msg, kind) {
    var el = $('statusLine');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function money(n) {
    var x = Number(n) || 0;
    return x.toLocaleString('zh-TW');
  }

  function setBusy(on) {
    busy = !!on;
    ['btnAddZone', 'btnSearch', 'btnPreflight', 'btnPrint', 'btnRefresh',
      'btnSaveFees', 'btnSend', 'btnNewVersion'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = busy;
    });
  }

  function statusLabel(st) {
    var map = { draft: '草稿', sent: '已送出', confirmed: '客人已確認' };
    return map[st] || st || '—';
  }

  function fillFeesFromStaff() {
    var fees = (staffView && staffView.quote && staffView.quote.fees_received) || {};
    if ($('feeMeasure')) $('feeMeasure').value = fees.measure != null ? fees.measure : 0;
    if ($('feeStartup')) $('feeStartup').value = fees.startup != null ? fees.startup : 0;
    if ($('feePlanning')) $('feePlanning').value = fees.planning != null ? fees.planning : 0;
    if ($('quoteDate')) $('quoteDate').value = (staffView && staffView.quote && staffView.quote.quote_date) || '';
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

  function renderZones() {
    var box = $('zonesBox');
    var sel = $('zoneSelect');
    if (!box || !sel) return;
    var zones = (staffView && staffView.quote && staffView.quote.zones) || [];
    sel.innerHTML = zones.map(function (z) {
      return '<option value="' + String(z.zone_id).replace(/"/g, '') + '">' + escapeHtml(z.name) + '</option>';
    }).join('') || '<option value="">（尚未新增空間）</option>';

    if (!zones.length) {
      box.innerHTML = '<div class="card hint">尚未新增空間。先在上方加入一個空間（例如客廳）。</div>';
      return;
    }
    box.innerHTML = zones.map(function (z) {
      var rows = (z.lines || []).map(function (ln) {
        return '<tr><td>' + escapeHtml(ln.item) + '</td><td>' + escapeHtml(ln.unit) + '</td><td>' +
          escapeHtml(String(ln.qty)) + '</td><td>' + money(ln.unit_price) + '</td><td>' + money(ln.amount) +
          '</td><td>' + escapeHtml(ln.price_override_reason || '') + '</td></tr>';
      }).join('') || '<tr><td colspan="6" class="hint">尚無工項</td></tr>';
      return '<div class="card"><div class="zone-title">' + escapeHtml(z.name) + '</div>' +
        '<table><thead><tr><th>項目</th><th>單位</th><th>數量</th><th>單價</th><th>金額</th><th>改價原因</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>';
    }).join('');
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
      '<span class="hint">合約交接 stub 總價：' + money(handoff.total_with_tax) +
      '｜目前' + (editable ? '可編輯' : '已鎖定（請開新版本）') + '</span>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function refresh() {
    setStatus('更新中…');
    setBusy(true);
    try {
      var res = await AccountingApi.quoteEditorGet(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '載入失敗');
      staffView = res.staff;
      renderZones();
      fillFeesFromStaff();
      renderTotals();
      renderVersions();
      var q = staffView.quote || {};
      var flag = staffView.feature_enabled ? '正式開放中' : (staffView.project_allowed ? '測試案可用' : '未開放');
      $('headerSub').textContent = '案號 ' + projectNo + '｜版本 v' + (q.version || 1) +
        '｜' + statusLabel(q.status) + '｜' + flag;
      setStatus('已更新', 'ok');
    } catch (e) {
      setStatus((e && e.message) || '載入失敗', 'err');
    } finally {
      setBusy(false);
    }
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

  async function addZone() {
    var name = ($('zoneName') && $('zoneName').value || '').trim();
    if (!name) { setStatus('請輸入空間名稱', 'err'); return; }
    setBusy(true);
    setStatus('新增空間中…');
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
    var q = ($('catalogQ') && $('catalogQ').value || '').trim();
    var box = $('catalogBox');
    if (!box) return;
    setBusy(true);
    setStatus('搜尋價目表…');
    try {
      var res = await AccountingApi.quoteEditorCatalog(session, projectNo, { q: q });
      if (!res || !res.success) throw new Error((res && res.message) || '搜尋失敗');
      var items = res.items || [];
      if (typeof QuoteEditorSanitize !== 'undefined') {
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(items);
        if (leaked) throw new Error('價目表含禁止欄位 ' + leaked + '（已擋下）');
      }
      if (!items.length) {
        box.hidden = false;
        box.innerHTML = '<div class="hint" style="padding:0.6rem">找不到符合的品項</div>';
        setStatus('無結果', 'err');
        return;
      }
      box.hidden = false;
      box.innerHTML = items.map(function (it) {
        return '<button type="button" data-key="' + escapeHtml(it.catalog_key) + '">' +
          escapeHtml(it.tab) + '｜' + escapeHtml(it.item) +
          '｜' + escapeHtml(it.unit) + '｜' + money(it.price) +
          (it.note ? '<div class="hint">' + escapeHtml(it.note) + '</div>' : '') +
          '</button>';
      }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('button[data-key]'), function (btn) {
        btn.onclick = function () { addLine(btn.getAttribute('data-key')); };
      });
      setStatus('找到 ' + items.length + ' 筆，點選加入', 'ok');
    } catch (e) {
      setStatus((e && e.message) || '搜尋失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function addLine(catalogKey) {
    var zoneId = ($('zoneSelect') && $('zoneSelect').value) || '';
    if (!zoneId) { setStatus('請先新增並選擇空間', 'err'); return; }
    var qty = ($('qty') && $('qty').value) || '';
    var overridePrice = ($('overridePrice') && $('overridePrice').value) || '';
    var reason = ($('overrideReason') && $('overrideReason').value) || '';
    setBusy(true);
    setStatus('加入工項中…');
    try {
      var res = await AccountingApi.quoteEditorAddLine(session, {
        project_no: projectNo,
        zone_id: zoneId,
        catalog_key: catalogKey,
        qty: qty,
        unit_price: overridePrice === '' ? undefined : overridePrice,
        price_override_reason: reason
      });
      if (!res || !res.success) throw new Error((res && res.message) || '加入失敗');
      applyStaff(res, '已加入工項');
    } catch (e) {
      setStatus((e && e.message) || '加入失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function saveFees() {
    setBusy(true);
    setStatus('儲存扣費中…');
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
    setStatus('送出前檢查並送出…');
    try {
      var res = await AccountingApi.quoteEditorSend(session, projectNo, {
        version_note: ($('versionNote') && $('versionNote').value) || ''
      });
      if (!res || !res.success) {
        var box = $('preflightBox');
        if (box && res) {
          box.hidden = false;
          box.textContent = JSON.stringify({
            ok_to_send: res.ok_to_send,
            blockers: res.blockers,
            warnings: res.warnings,
            message: res.message
          }, null, 2);
        }
        throw new Error((res && res.message) || '送出失敗');
      }
      if (typeof QuoteEditorSanitize !== 'undefined' && res.customer_preview) {
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(res.customer_preview);
        if (leaked) throw new Error('送出資料含禁止欄位 ' + leaked);
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
    setStatus('開新版本中…');
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
    setStatus('檢查中…');
    try {
      var res = await AccountingApi.quoteEditorPreflight(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '檢查失敗');
      var box = $('preflightBox');
      if (box) {
        box.hidden = false;
        box.textContent = JSON.stringify({
          ok_to_send: res.ok_to_send,
          blockers: res.blockers,
          warnings: res.warnings,
          totals: res.totals,
          contract_handoff: res.contract_handoff
        }, null, 2);
      }
      setStatus(res.ok_to_send ? '檢查通過，可準備給客人' : '尚有需處理項目', res.ok_to_send ? 'ok' : 'err');
    } catch (e) {
      setStatus((e && e.message) || '檢查失敗', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function printPreview() {
    setBusy(true);
    setStatus('準備列印資料…');
    try {
      var res = await AccountingApi.quoteEditorPrint(session, projectNo);
      if (!res || !res.success) throw new Error((res && res.message) || '列印失敗');
      var print = res.print || {};
      if (typeof QuoteEditorSanitize !== 'undefined') {
        print = QuoteEditorSanitize.toCustomerQuote(print);
        var leaked = QuoteEditorSanitize.payloadContainsForbiddenToken(print);
        if (leaked) throw new Error('列印資料含禁止欄位 ' + leaked);
      }
      var w = window.open('', '_blank');
      if (!w) throw new Error('瀏覽器阻擋彈窗');
      var zonesHtml = (print.zones || []).map(function (z) {
        var lines = (z.lines || []).map(function (ln) {
          return '<tr><td>' + escapeHtml(ln.item) + '</td><td>' + escapeHtml(ln.unit) + '</td><td>' +
            escapeHtml(String(ln.qty)) + '</td><td>' + money(ln.unit_price) + '</td><td>' + money(ln.amount) + '</td></tr>';
        }).join('');
        return '<h3>' + escapeHtml(z.name) + '</h3><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%">' +
          '<tr><th>項目</th><th>單位</th><th>數量</th><th>單價</th><th>金額</th></tr>' + lines + '</table>';
      }).join('');
      var t = print.totals || {};
      w.document.write('<html><head><title>報價列印</title></head><body style="font-family:sans-serif;padding:16px">' +
        '<h2>工程報價單</h2><div>案號 ' + escapeHtml(print.project_no || projectNo) + '</div>' +
        zonesHtml +
        '<p>未稅 ' + money(t.pretax) + '｜稅 ' + money(t.tax) + '｜含稅 ' + money(t.with_tax) + '</p>' +
        '</body></html>');
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
  boot();
})();
