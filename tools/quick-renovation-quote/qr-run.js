'use strict';
  function renderAllocTable(alloc) {
    var html =
      '<table class="w-full border text-left"><thead><tr class="bg-stone-100">' +
      '<th class="p-2 border">空間</th><th class="p-2 border">坪數</th><th class="p-2 border">長×寬（cm）</th><th class="p-2 border">長邊尺／短邊尺（約）</th></tr></thead><tbody>';
    alloc.zones.forEach(function (z) {
      var longS = shakuFromCm(Math.max(z.dims.L, z.dims.W));
      var shortS = shakuFromCm(Math.min(z.dims.L, z.dims.W));
      html +=
        '<tr><td class="p-2 border">' +
        esc(z.name) +
        '</td><td class="p-2 border">' +
        z.ping +
        '</td><td class="p-2 border">' +
        z.dims.L +
        ' × ' +
        z.dims.W +
        '</td><td class="p-2 border">' +
        longS +
        ' ／ ' +
        shortS +
        '</td></tr>';
    });
    html += '</tbody></table>';
    html +=
      '<p class="mt-2 text-xs text-stone-600">扣陽台與浴廁後餘額 <strong>' +
      round2(alloc.R) +
      '</strong> 坪；本次客廚占餘額 <strong>' +
      round2(alloc.lkPct * 100) +
      '%</strong>。</p>';
    var ageEl = document.querySelector('input[name=c_houseAge]:checked');
    if (ageEl && ageEl.value === 'old') {
      html +=
        '<p class="mt-2 text-xs text-amber-950 border border-amber-200 bg-amber-50/90 rounded-lg px-2 py-2 leading-relaxed">您選擇「舊屋」：拆除、現況修補與管線變動差異大，<strong>本表仍以新屋邏輯試算</strong>，合價僅供方向參考，請務必現場評估。</p>';
    }
    document.getElementById('c_allocTable').innerHTML = html;
  }

  function getSelectedSchemeId() {
    var el = document.querySelector('input[name=scheme]:checked');
    if (el) {
      state.selectedSchemeId = el.value;
      return el.value;
    }
    if (state.selectedSchemeId) return state.selectedSchemeId;
    return (state.settings.schemeMenus[0] && state.settings.schemeMenus[0].id) || 'simple';
  }

  function applySchemeQtyToInputs() {
    if (!state.lastAlloc) return;
    var scheme = getSchemeById(getSelectedSchemeId());
    var drows = getDisplayItemRows(state.lastAlloc);
    drows.forEach(function (drow) {
      var q = getQtyForDisplayRow(drow, state.lastAlloc, scheme);
      var inp = document.querySelector('.it-qty[data-id="' + drow.rowId + '"]');
      if (inp) inp.value = q;
    });
  }

  function buildItemRows(alloc) {
    var scheme = getSchemeById(getSelectedSchemeId());
    if (document.getElementById('c_schemeNameStep3')) {
      document.getElementById('c_schemeNameStep3').textContent = scheme.name;
    }
    var drows = getDisplayItemRows(alloc);
    var box = document.getElementById('c_itemRows');
    box.innerHTML = '';
    var lastSectionLabel = null;
    drows.forEach(function (drow) {
      var it = drow.def;
      var band = drow.menuBand || it.menuBand || 'other';
      var sl =
        ((drow.subGroupTitle && String(drow.subGroupTitle).trim()) || '') ||
        (drow.quoteSection && String(drow.quoteSection).trim()) ||
        (it.groupTitle && String(it.groupTitle).trim()) ||
        (MENU_BAND_LABEL_ZH[band] || MENU_BAND_LABEL_ZH.other);
      if (sl !== lastSectionLabel) {
        var h3 = document.createElement('h3');
        h3.className =
          'text-sm font-bold text-stone-800 border-b border-stone-200 pb-1.5 mt-4 first:mt-0 tracking-tight';
        h3.textContent = sl;
        box.appendChild(h3);
        lastSectionLabel = sl;
      }
      var qty = getQtyForDisplayRow(drow, alloc, scheme);
      var showLabel = drow.roomLabel ? drow.def.label + '（' + drow.roomLabel + '）' : drow.def.label;
      var noteC = (it.clientNote && String(it.clientNote).trim()) || '';
      if (!noteC) noteC = (it.hint && String(it.hint).trim()) || '';
      var row = document.createElement('div');
      row.className = 'flex flex-wrap items-center gap-2 border rounded-lg p-2';
      var rid = drow.rowId;
      row.innerHTML =
        '<label class="inline-flex items-center gap-2 min-w-[200px]">' +
        '<input type="checkbox" class="it-check" data-id="' +
        esc(rid) +
        '" />' +
        '<span>' +
        esc(showLabel) +
        '</span></label>' +
        '<span class="text-stone-500 text-xs max-w-[280px] leading-snug">' +
        noteC +
        '</span>' +
        '<span class="ml-auto">數量</span>' +
        '<input type="number" min="0" step="0.5" inputmode="decimal" title="以 0.5 或整數為單位" class="it-qty border rounded px-2 py-1 w-24" data-id="' +
        esc(rid) +
        '" value="' +
        qty +
        '" />' +
        '<span>' +
        esc(it.unit) +
        '</span>' +
        '<span class="text-stone-600">@' +
        money(it.price) +
        '</span>';
      box.appendChild(row);
      /* 子品項（subItems）：縮排顯示於父品項下方 */
      if (Array.isArray(it.subItems) && it.subItems.length) {
        it.subItems.forEach(function (sub) {
          var subRid = drow.rowId + '::' + sub.id;
          var subRow = document.createElement('div');
          subRow.className = 'flex flex-wrap items-center gap-2 border border-stone-200 rounded-lg p-2 pl-6 ml-4 bg-stone-50/70 text-sm';
          subRow.innerHTML =
            '<label class="inline-flex items-center gap-2 min-w-[160px]">' +
            '<input type="checkbox" class="it-subcheck" data-id="' + esc(subRid) + '"' + (sub.defaultOn ? ' checked' : '') + ' />' +
            '<span class="text-stone-600">└ ' + esc(sub.label || '子品項') + '</span></label>' +
            '<span class="text-stone-400 text-xs max-w-[200px] leading-snug">' + esc(sub.clientNote || '') + '</span>' +
            '<span class="ml-auto text-xs text-stone-500">數量</span>' +
            '<input type="number" min="0" step="1" class="it-subqty border rounded px-2 py-1 w-16" data-id="' + esc(subRid) + '" value="' + esc(String(sub.defaultQty != null ? sub.defaultQty : 1)) + '" />' +
            '<span class="text-xs">' + esc(sub.unit || '個') + '</span>' +
            '<span class="text-stone-500 text-xs">@' + money(sub.price || 0) + '</span>';
          box.appendChild(subRow);
        });
      }
    });
    drows.forEach(function (drow) {
      if (drow.def.defaultOn) {
        var c = document.querySelector('.it-check[data-id="' + escDataIdForSelector(drow.rowId) + '"]');
        if (c) c.checked = true;
      }
    });
  }

  function escDataIdForSelector(s) {
    return String(s);
  }

  function collectQuoteLines() {
    var out = [];
    if (!state.lastAlloc) return out;
    var s = state.settings;
    var drows = getDisplayItemRows(state.lastAlloc);
    var wood = 0;
    drows.forEach(function (drow) {
      var id = drow.rowId;
      var it = drow.def;
      var ch = document.querySelector('.it-check[data-id="' + id + '"]');
      if (!it.lineKind && ch && ch.checked) {
        var qInp = document.querySelector('.it-qty[data-id="' + id + '"]');
        var q = parseFloat(qInp && qInp.value ? qInp.value : '0') || 0;
        if (it.cabWood) {
          wood += Math.round(q * (it.price || 0));
        }
      }
    });
    drows.forEach(function (drow) {
      var id = drow.rowId;
      var it = drow.def;
      var ch = document.querySelector('.it-check[data-id="' + id + '"]');
      if (!ch || !ch.checked) return;
      if (it.lineKind === 'trim' || it.lineKind === 'touchup') {
        if (it.lineKind === 'trim') {
          var r = typeof s.trimMoldingRate === 'number' ? s.trimMoldingRate : 0.05;
          var st = Math.round(wood * r);
          out.push({
            section: drow.quoteSection || drow.groupTitle || it.group,
            label: it.label + '（木作+系統參考小計 ' + money(wood) + ' 元×' + Math.round(r * 100) + '%）',
            clientNote: (it.clientNote && String(it.clientNote).trim()) || '',
            unit: it.unit,
            qty: 1,
            unitPrice: st,
            sub: st,
          });
        } else {
          var lump2 = typeof s.touchupLump === 'number' ? s.touchupLump : 20000;
          out.push({
            section: drow.quoteSection || drow.groupTitle || it.group,
            label: it.label,
            clientNote: (it.clientNote && String(it.clientNote).trim()) || '',
            unit: it.unit,
            qty: 1,
            unitPrice: lump2,
            sub: Math.round(lump2),
          });
        }
        return;
      }
      var qInp2 = document.querySelector('.it-qty[data-id="' + id + '"]');
      var q2 = parseFloat(qInp2 && qInp2.value ? qInp2.value : '0') || 0;
      var lab2 = drow.roomLabel ? it.label + '（' + drow.roomLabel + '）' : it.label;
      if (drow.groupTitle) lab2 = lab2;
      out.push({
        section: drow.quoteSection || drow.groupTitle || it.group,
        label: lab2,
        clientNote: (it.clientNote && String(it.clientNote).trim()) || '',
        unit: it.unit,
        qty: q2,
        unitPrice: it.price,
        sub: Math.round(q2 * (it.price || 0)),
      });
      /* 子品項：各自獨立勾選，金額加到同一 section */
      if (Array.isArray(it.subItems) && it.subItems.length) {
        it.subItems.forEach(function (sub) {
          var subRid = drow.rowId + '::' + sub.id;
          var subCh = document.querySelector('.it-subcheck[data-id="' + subRid + '"]');
          if (!subCh || !subCh.checked) return;
          var subQInp = document.querySelector('.it-subqty[data-id="' + subRid + '"]');
          var subQ = parseFloat(subQInp && subQInp.value ? subQInp.value : '1') || 1;
          out.push({
            section: drow.quoteSection || drow.groupTitle || it.group,
            label: '　└ ' + (sub.label || '子品項'),
            clientNote: (sub.clientNote || '').trim(),
            unit: sub.unit || '個',
            qty: subQ,
            unitPrice: sub.price || 0,
            sub: Math.round(subQ * (sub.price || 0)),
          });
        });
      }
    });
    return out;
  }

  function renderQuote() {
    var lines = collectQuoteLines();
    var total = lines.reduce(function (a, l) { return a + l.sub; }, 0);
    var title = document.getElementById('c_title').value.trim() || '（未命名）';
    var sc = getSchemeById(getSelectedSchemeId());
    var allocHtml = document.getElementById('c_allocTable').innerHTML;
    var bySec = [];
    var lastSec = null;
    var cur = [];
    lines.forEach(function (l) {
      var sn = l.section != null && l.section !== '' ? l.section : '未分組';
      if (lastSec !== null && sn !== lastSec) {
        bySec.push({ title: lastSec, lines: cur });
        cur = [];
      }
      lastSec = sn;
      cur.push(l);
    });
    if (lastSec !== null) bySec.push({ title: lastSec, lines: cur });
    var lineRows = bySec
      .map(function (blk) {
        var subTable = blk.lines
          .map(function (l) {
            return (
              '<tr><td class="p-1 border">' +
              esc(l.label) +
              (l.clientNote
                ? '<p class="text-stone-500 m-0 mt-0.5 text-[11px] leading-snug">' + esc(l.clientNote) + '</p>'
                : '') +
              '</td><td class="p-1 border text-right">' +
              l.qty +
              '</td><td class="p-1 border">' +
              esc(l.unit) +
              '</td><td class="p-1 border text-right">' +
              money(l.unitPrice) +
              '</td><td class="p-1 border text-right">' +
              money(l.sub) +
              '</td></tr>'
            );
          })
          .join('');
        return (
          '<div class="text-xs font-semibold text-amber-900 border-b border-amber-200 pb-0.5 mt-2 first:mt-0">' +
          esc(blk.title) +
          '</div><table class="w-full text-xs table-fixed break-words"><thead class="bg-stone-200"><tr><th class="p-1 text-left w-[36%]">項目／備註</th><th class="p-1 text-right w-14">數量</th><th class="p-1 w-12">單位</th><th class="p-1 text-right w-20">單價</th><th class="p-1 text-right w-20">小計</th></tr></thead><tbody>' +
          subTable +
          '</tbody></table>'
        );
      })
      .join('');
    if (!lineRows) lineRows = '<p class="text-stone-500 p-2">未勾選項目</p>';
    document.getElementById('c_quoteOut').innerHTML =
      '<div class="font-semibold">' +
      esc(title) +
      '</div>' +
      '<div class="text-stone-600 text-xs">方案菜單：<strong>' +
      esc(sc.name) +
      '</strong>（數量依菜單規則帶入，可手改）</div>' +
      '<div class="text-xs text-stone-500 mt-2">— 坪數推估 —</div><div class="text-xs">' +
      allocHtml +
      '</div>' +
      '<div class="text-xs text-stone-500 mt-2">— 拆項（依分區小表）—</div>' +
      (lineRows || '<p class="p-2 text-stone-500">未勾選項目</p>') +
      '<div class="text-right text-lg font-bold mt-2">參考合計：' +
      money(total) +
      ' 元</div>';
    document.getElementById('cStep4').classList.remove('hidden');
  }

  function showClient() {
    var c = document.getElementById('clientSection');
    var a = document.getElementById('adminSection');
    if (c) c.classList.remove('hidden');
    if (a) a.classList.add('hidden');
    var navC = document.getElementById('navClient');
    var navA = document.getElementById('navAdmin');
    if (navC) navC.className = 'flex-1 py-2 rounded-lg bg-amber-800 text-white font-medium';
    if (navA) navA.className = 'flex-1 py-2 rounded-lg bg-stone-300 text-stone-800 font-medium';
  }

  function showAdmin() {
    var c = document.getElementById('clientSection');
    var a = document.getElementById('adminSection');
    if (c) c.classList.add('hidden');
    if (a) a.classList.remove('hidden');
    var navC = document.getElementById('navClient');
    var navA = document.getElementById('navAdmin');
    if (navA) navA.className = 'flex-1 py-2 rounded-lg bg-amber-800 text-white font-medium';
    if (navC) navC.className = 'flex-1 py-2 rounded-lg bg-stone-300 text-stone-800 font-medium';
    fillAdminForm();
  }

  if (document.getElementById('navClient') && document.getElementById('navAdmin')) {
    document.getElementById('navClient').addEventListener('click', showClient);
    document.getElementById('navAdmin').addEventListener('click', showAdmin);
  }

  function qrFlashAdminAction(msg, level) {
    var bar = document.getElementById('qrAdminActionBar');
    if (!bar || !msg) return;
    if (bar._qrT) clearTimeout(bar._qrT);
    bar.textContent = msg;
    bar.classList.remove('hidden', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-900', 'border-amber-200', 'bg-amber-50', 'text-amber-900');
    if (level === 'warn') bar.className = 'max-w-[1600px] mx-auto mt-2 px-4 text-xs py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900';
    else bar.className = 'max-w-[1600px] mx-auto mt-2 px-4 text-xs py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900';
    bar._qrT = setTimeout(function () {
      bar.classList.add('hidden');
    }, 3200);
  }

  window.qrAdminHintSave = function (msg) {
    qrFlashAdminAction(msg || '已套用規則，記得按右上「儲存設定」。', 'warn');
  };

  if (document.getElementById('adminSaveBtn')) {
    var saveFn = function () {
      if (getMenuScheme() && document.getElementById('s_schemeNameEdit')) {
        var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
        if (nm0) getMenuScheme().name = nm0;
      }
      syncSchemesJsonTextarea();
      readAdminForm();
      saveSettings().then(function (cloudOk) {
        qrFlashAdminAction(cloudOk ? '設定已儲存（本機＋Firebase）。' : '設定已寫入本機；Firebase 暫時未同步。', cloudOk ? 'ok' : 'warn');
        alert(
          cloudOk
            ? '已儲存（本機與 Firebase）。'
            : '已寫入本機；Firebase 同步失敗或未連線（見下方 Firebase 區狀態）。'
        );
      });
    };
    document.getElementById('adminSaveBtn').addEventListener('click', saveFn);
    var topSaveBtn = document.getElementById('adminSaveBtnTop');
    if (topSaveBtn) topSaveBtn.addEventListener('click', saveFn);
    document.getElementById('adminResetBtn').addEventListener('click', function () {
      if (!confirm('還原全部預設？')) return;
      state.settings = JSON.parse(JSON.stringify(DEFAULTS));
      try {
        var cachedTabs = JSON.parse(localStorage.getItem(TABS_CACHE_KEY));
        if (Array.isArray(cachedTabs) && cachedTabs.length > 0) {
          state.settings.knownPriceTabs = cachedTabs;
        }
      } catch (e) { /* ignore */ }
      saveSettings();
      fillAdminForm();
    });
    var alignQuoteBtn = document.getElementById('adminAlignQuoteFromTabsBtn');
    if (alignQuoteBtn) {
      alignQuoteBtn.addEventListener('click', function () { alignQuoteMetaFromTabs(); });
    }
    document.getElementById('adminResetSchemesBtn').addEventListener('click', function () {
      if (!confirm('將方案菜單還原成內建三組（精簡／收納／造型）？自訂方案會被刪除。')) return;
      state.settings.schemeMenus = defaultSchemeMenus();
      state.selectedSchemeId = 'simple';
      state._preservedMenuScheme = 'simple';
      syncSchemesJsonTextarea();
      saveSettings();
      fillAdminForm();
      fillSchemeRadios();
      alert('已還原內建三組方案。');
    });
    document.getElementById('adminExportBtn').addEventListener('click', function () {
      readAdminForm();
      var blob = new Blob([JSON.stringify(state.settings, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'quick-quote-settings-v2.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById('adminImportFile').addEventListener('change', function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          state.settings = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), JSON.parse(r.result));
          if (state.settings.mepPerZone == null && state.settings.mepPerRoom != null) {
            state.settings.mepPerZone = state.settings.mepPerRoom;
          }
          saveSettings();
          fillAdminForm();
          alert('匯入完成');
        } catch (e) {
          alert('JSON 無效');
        }
      };
      r.readAsText(f);
      ev.target.value = '';
    });
    var sid = document.getElementById('s_sheetId');
    if (sid) sid.addEventListener('blur', function () { qrScheduleSheetPriceSync(); });
    var pauto = document.getElementById('s_priceSheetAuto');
    if (pauto) {
      pauto.addEventListener('change', function () {
        readAdminForm();
        qrScheduleSheetPriceSync();
      });
    }
    var ssb = document.getElementById('adminSnapshotSaveBtn');
    if (ssb && !ssb._qrSnapSaveBound) {
      ssb._qrSnapSaveBound = true;
      ssb.addEventListener('click', function () {
        readAdminForm();
        var inp = document.getElementById('adminSnapshotName');
        var nm = inp ? inp.value : '';
        if (typeof qrSaveCurrentSettingsSnapshot !== 'function') return;
        if (qrSaveCurrentSettingsSnapshot(nm)) {
          if (inp) inp.value = '';
          if (typeof renderAdminSnapshotsPanel === 'function') renderAdminSnapshotsPanel();
          alert('已存入本機快照（上限 ' + SNAPSHOTS_MAX + ' 筆，超過會刪最舊）。');
        }
      });
    }
  }

  window.qrConfirmLoadSnapshot = function (snapId) {
    if (
      !snapId ||
      !confirm('載入快照會覆寫目前本機主設定檔。（若要同步 Firebase 請之後再按儲存／上傳。）確定？')
    )
      return;
    if (typeof qrApplySnapshot !== 'function' || !qrApplySnapshot(snapId)) {
      alert('無法載入（找不到快照或資料毀損）。');
      return;
    }
    if (state.settings.schemeMenus && state.settings.schemeMenus[0]) state._preservedMenuScheme = state.settings.schemeMenus[0].id;
    fillAdminForm();
    fillSchemeRadios();
    alert('已載入快照。');
  };

  window.qrConfirmDeleteSnapshot = function (snapId) {
    if (!snapId || !confirm('刪除此快照？')) return;
    if (typeof qrDeleteSnapshot === 'function') qrDeleteSnapshot(snapId);
    if (typeof renderAdminSnapshotsPanel === 'function') renderAdminSnapshotsPanel();
  };

  function qrUpdateBuildingHint() {
    var h = document.getElementById('c_buildingHint');
    var sel = document.querySelector('input[name=c_building]:checked');
    if (!h || !sel) return;
    if (sel.value === 'house') {
      h.textContent =
        '透天案之樓層、外推與屋況與大樓差異大，試算公式尚未納入。請暫選「大樓／公寓」或改由設計師線下估價；後續版本會另開透天專用流程。';
      h.classList.remove('hidden');
    } else {
      h.textContent = '';
      h.classList.add('hidden');
    }
  }

  function runClientStep1Alloc() {
    loadSettings();
    var bEl = document.querySelector('input[name=c_building]:checked');
    if (bEl && bEl.value === 'house') {
      alert('目前僅開放「大樓／公寓 · 新屋」自動試算。透天請改選大樓或洽設計師現場估價。');
      return;
    }
    var T = parseFloat(document.getElementById('c_totalPing').value);
    if (isNaN(T) || T <= 0) {
      alert('請輸入有效總坪數');
      return;
    }
    var alloc = computeAllocation(T, document.getElementById('c_template').value, state.settings);
    state.lastAlloc = alloc;
    renderAllocTable(alloc);
    getSelectedSchemeId();
    fillSchemeRadios();
    document.getElementById('cStep2').classList.remove('hidden');
    document.getElementById('cStep3').classList.add('hidden');
    document.getElementById('cStep4').classList.add('hidden');
  }
  var cCalcBtn = document.getElementById('c_calcBtn');
  if (cCalcBtn) {
    cCalcBtn.addEventListener('click', function () {
      var go = function () { runClientStep1Alloc(); };
      if (priceSyncPromise && typeof priceSyncPromise.finally === 'function') {
        priceSyncPromise.finally(go);
      } else {
        go();
      }
    });
  }
  var cToItemsBtn = document.getElementById('c_toItemsBtn');
  if (cToItemsBtn) {
    cToItemsBtn.addEventListener('click', function () {
      if (!state.lastAlloc) return;
      getSelectedSchemeId();
      buildItemRows(state.lastAlloc);
      document.getElementById('cStep3').classList.remove('hidden');
      if (document.getElementById('c_schemeNameStep3')) {
        var sc2 = getSchemeById(getSelectedSchemeId());
        document.getElementById('c_schemeNameStep3').textContent = sc2.name;
      }
      setTimeout(function () {
        var el = document.getElementById('cStep3');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  }
  var cBackToSchemeBtn = document.getElementById('c_backToSchemeBtn');
  if (cBackToSchemeBtn) {
    cBackToSchemeBtn.addEventListener('click', function () {
      document.getElementById('cStep3').classList.add('hidden');
      var box = document.getElementById('c_schemeRadios');
      if (box) {
        setTimeout(function () {
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
      }
    });
  }
  var cQuoteBtn = document.getElementById('c_quoteBtn');
  if (cQuoteBtn) cQuoteBtn.addEventListener('click', renderQuote);
  var cPrintBtn = document.getElementById('c_printBtn');
  if (cPrintBtn) {
    cPrintBtn.addEventListener('click', function () {
      window.print();
    });
  }
  if (document.getElementById('s_loadSheetBtn')) {
    document.getElementById('s_loadSheetBtn').addEventListener('click', function () {
      loadPricesFromGviz();
    });
  }
  if (document.getElementById('s_fetchTabsBtn')) {
    document.getElementById('s_fetchTabsBtn').addEventListener('click', function () {
      readAdminForm();
      var id = (state.settings.priceSheetGvizId || '').trim();
      if (!id) { alert('請先填入試算表 ID 再取得工作頁清單。'); return; }
      var btn = this;
      btn.disabled = true;
      btn.textContent = '取得中…';
      fetchAndCacheSheetTabs(id)
        .then(function (tabs) {
          btn.disabled = false;
          btn.textContent = '取得工作頁清單';
          if (tabs.length) {
            fillAdminForm();
            alert('已取得 ' + tabs.length + ' 個工作頁：' + tabs.join('、'));
          } else {
            alert('未取得任何工作頁（試算表需設為「任何人可檢視」）。');
          }
        });
    });
  }
  if (document.getElementById('s_applyRuleBtn')) {
    document.getElementById('s_applyRuleBtn').addEventListener('click', function () {
      applyFormRuleToScheme();
    });
  }
  if (document.getElementById('s_menuScheme')) {
    document.getElementById('s_menuScheme').addEventListener('change', function () {
      refreshMenuSchemeUI();
    });
  }
  if (document.getElementById('s_formItem')) {
    document.getElementById('s_formItem').addEventListener('change', function () {
      loadFormFromCurrentItem();
    });
  }
  if (document.getElementById('s_formRule')) {
    document.getElementById('s_formRule').addEventListener('change', function () {
      setRuleFormHelp();
    });
  }
  if (document.getElementById('s_schemeNameEdit')) {
    document.getElementById('s_schemeNameEdit').addEventListener('blur', function () {
      var sc = getMenuScheme();
      if (!sc) return;
      var nm = (this.value || '').trim();
      if (nm) sc.name = nm;
      syncSchemesJsonTextarea();
      saveSettings();
    });
  }
  if (document.getElementById('menuAddScheme')) {
    document.getElementById('menuAddScheme').addEventListener('click', menuAddScheme);
  }
  if (document.getElementById('menuDupScheme')) {
    document.getElementById('menuDupScheme').addEventListener('click', menuDuplicateScheme);
  }
  if (document.getElementById('menuDelScheme')) {
    document.getElementById('menuDelScheme').addEventListener('click', menuDeleteScheme);
  }
  if (document.getElementById('s_parseDraftBtn')) {
    document.getElementById('s_parseDraftBtn').addEventListener('click', function () {
      parseAndApplyMenuDraft();
    });
  }
  if (document.getElementById('s_exportDraftBtn')) {
    document.getElementById('s_exportDraftBtn').addEventListener('click', function () {
      exportMenuDraftFromScheme();
    });
  }

  var clientSectionEl = document.getElementById('clientSection');
  if (clientSectionEl) {
    clientSectionEl.addEventListener(
      'blur',
      function (e) {
        if (!e.target || !e.target.classList || !e.target.classList.contains('it-qty')) return;
        var v = parseFloat(e.target.value);
        if (isNaN(v) || v < 0) return;
        e.target.value = String(Math.max(0, Math.round(v * 2) / 2));
      },
      true
    );
  }

  function qrAfterSettingsReady() {
    if (state.settings.priceSheetAutoOnOpen !== false && (state.settings.priceSheetGvizId || '').trim()) {
      priceSyncPromise = syncPricesFromGviz({ silent: true });
    }
    fillTemplateSelect();
    qrUpdateBuildingHint();
    if (!document.body.dataset.qrBuildingHintBound) {
      document.body.dataset.qrBuildingHintBound = '1';
      document.querySelectorAll('input[name=c_building]').forEach(function (r) {
        r.addEventListener('change', qrUpdateBuildingHint);
      });
    }
  }

  /** 管理員獨立頁：左側分段導覽，只顯示一個主面板；上次分區記在 sessionStorage。 */
  function qrAdminShellInitNavigation() {
    if (!document.body || document.body.dataset.qrStandaloneAdmin !== '1') return;
    var nav = document.getElementById('qrAdminNav');
    if (!nav || nav.dataset.qrNavInit === '1') return;
    nav.dataset.qrNavInit = '1';

    function panelId(seg) {
      return seg === 'schemes' ? 'adminPanelSchemes' : seg === 'system' ? 'adminPanelSystem' : 'adminPanelPrices';
    }

    function show(seg) {
      if (seg !== 'prices' && seg !== 'schemes' && seg !== 'system') seg = 'prices';
      ['prices', 'schemes', 'system'].forEach(function (s) {
        var el = document.getElementById(panelId(s));
        if (el) el.classList.toggle('hidden', s !== seg);
      });
      nav.querySelectorAll('[data-admin-section]').forEach(function (btn) {
        var s = btn.getAttribute('data-admin-section') || '';
        var on = s === seg;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
        btn.classList.toggle('bg-amber-900', on);
        btn.classList.toggle('text-white', on);
        btn.classList.toggle('border-amber-800', on);
        btn.classList.toggle('shadow-md', on);
        btn.classList.toggle('bg-stone-100', !on);
        btn.classList.toggle('text-stone-800', !on);
        btn.classList.toggle('border-transparent', !on);
        btn.classList.toggle('hover:bg-amber-50', !on);
        btn.classList.toggle('hover:border-amber-200/80', !on);
        var sub = btn.querySelectorAll('span');
        if (sub.length > 1) {
          sub[1].classList.toggle('text-stone-500', !on);
          sub[1].classList.toggle('text-amber-100/90', on);
        }
      });
      try {
        sessionStorage.setItem('qr_admin_section_v2', seg);
      } catch (_e) { /* ignore */
      }
      var main = nav.nextElementSibling;
      if (main && typeof main.scrollTop === 'number') main.scrollTop = 0;
    }

    var pref = 'prices';
    try {
      var t = sessionStorage.getItem('qr_admin_section_v2');
      if (t === 'schemes' || t === 'system' || t === 'prices') pref = t;
    } catch (_e2) { /* ignore */
    }

    nav.querySelectorAll('[data-admin-section]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        show(btn.getAttribute('data-admin-section') || 'prices');
      });
    });

    show(pref);
  }

  function qrAdminPageReady() {
    var st = document.getElementById('qrFbSyncStatus');
    if (st && state.fbLoadNote) st.textContent = state.fbLoadNote;
    fillAdminForm();
    refreshMenuSchemeUI();
    if (state.settings.priceSheetAutoOnOpen !== false && (state.settings.priceSheetGvizId || '').trim()) {
      priceSyncPromise = syncPricesFromGviz({ silent: true });
    }
  }

  var isAdminStandalonePage = !!(document.body && document.body.dataset.qrStandaloneAdmin === '1');
  if (isAdminStandalonePage) qrAdminShellInitNavigation();

  loadSettings();
  qrFbPullOnce({ silent: true, preferRemote: true })
    .then(function () {
      if (isAdminStandalonePage) qrAdminPageReady();
      else qrAfterSettingsReady();
    })
    .catch(function () {
      if (isAdminStandalonePage) qrAdminPageReady();
      else qrAfterSettingsReady();
    });

  var pullBtn = document.getElementById('qrFbPullBtn');
  if (pullBtn) {
    pullBtn.addEventListener('click', function () {
      qrFbPullOnce({ silent: false, preferRemote: true }).then(function (ok) {
        if (ok) {
          fillTemplateSelect();
          fillSchemeRadios();
          if (document.getElementById('adminSaveBtn')) fillAdminForm();
        }
      });
    });
  }
  var pushBtn = document.getElementById('qrFbPushBtn');
  if (pushBtn) {
    pushBtn.addEventListener('click', function () {
      readAdminForm();
      qrFbPushCurrentSettings({ silent: false });
    });
  }
