'use strict';

  /* ── 共用輔助：下拉選項 HTML ── */

  /** 最近一次試算表對照狀態（滑鼠移上可看細節） */
  function priceMatchBadgeHtml(ent) {
    var c = ent && ent.priceSheetMatchCode;
    var det = ent && ent.priceSheetMatchDetail ? String(ent.priceSheetMatchDetail) : '';
    if (!c) {
      return (
        '<span class="qr-match-badge shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 text-stone-500" title="尚未對表或未跑過對表">─</span>'
      );
    }
    var row = {
      tab_ok: { cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', lab: '對到' },
      tab_no_row: { cls: 'border-amber-300 bg-amber-50 text-amber-950', lab: '表無列' },
      tab_fetch_fail: { cls: 'border-red-300 bg-red-50 text-red-900', lab: '分頁敗' },
      no_table_pair: { cls: 'border-stone-300 bg-stone-100 text-stone-700', lab: '未填對照' },
      legacy_ok: { cls: 'border-teal-300 bg-teal-50 text-teal-900', lab: '簡表對到' },
      legacy_no_row: { cls: 'border-amber-300 bg-amber-50 text-amber-950', lab: '簡表無' },
      sync_error: { cls: 'border-red-400 bg-red-50 text-red-950', lab: '中斷' },
    };
    var m = row[c] || { cls: 'border-stone-200 bg-stone-50 text-stone-600', lab: String(c).slice(0, 8) };
    var title = det ? det : m.lab;
    return (
      '<span class="qr-match-badge shrink-0 text-[10px] px-1.5 py-0.5 rounded border ' +
      m.cls +
      '" title="' +
      escAttr(title) +
      '">' +
      esc(m.lab) +
      '</span>'
    );
  }

  /** 格式化 ISO 時間供快照列表（本機語系） */
  function qrFormatSnapDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('zh-TW', { hour12: false });
    } catch (e) {
      return String(iso);
    }
  }

  function renderAdminSnapshotsPanel() {
    var ul = document.getElementById('adminSnapshotsList');
    if (!ul || typeof qrReadSnapshotsRaw !== 'function') return;
    var arr = qrReadSnapshotsRaw();
    ul.innerHTML = '';
    if (!arr.length) {
      ul.innerHTML =
        '<li class="text-xs text-stone-500 py-2 list-none">尚無快照。輸入名稱後按「存成快照」。</li>';
      qrBindSnapshotsListOnce(ul);
      return;
    }
    arr.forEach(function (s) {
      if (!s || !s.id) return;
      var li = document.createElement('li');
      li.className =
        'list-none flex flex-wrap items-center gap-2 justify-between py-2 border-b border-stone-100';
      li.innerHTML =
        '<div class="min-w-0 flex-1">' +
        '<span class="text-sm text-stone-800 font-medium">' +
        esc(s.label || '（無名）') +
        '</span>' +
        '<span class="block text-[10px] text-stone-400 mt-0.5">' +
        esc(qrFormatSnapDate(s.savedAt)) +
        '</span></div>' +
        '<div class="flex flex-wrap gap-1.5 shrink-0">' +
        '<button type="button" class="text-xs px-2 py-1 rounded border bg-white hover:bg-stone-50 qr-snap-load" data-snap-id="' +
        escAttr(s.id) +
        '">載入</button>' +
        '<button type="button" class="text-xs px-2 py-1 rounded border border-red-200 bg-red-50/60 text-red-800 hover:bg-red-50 qr-snap-del" data-snap-id="' +
        escAttr(s.id) +
        '">刪除</button></div>';
      ul.appendChild(li);
    });
    qrBindSnapshotsListOnce(ul);
  }

  function qrBindSnapshotsListOnce(ul) {
    if (!ul || ul._qrSnapBound) return;
    ul._qrSnapBound = true;
    ul.addEventListener('click', function (ev) {
      var t = ev.target;
      var loadBtn = t.closest ? t.closest('.qr-snap-load') : null;
      var delBtn = t.closest ? t.closest('.qr-snap-del') : null;
      if (loadBtn) {
        var sid = loadBtn.getAttribute('data-snap-id');
        if (sid && typeof window.qrConfirmLoadSnapshot === 'function') window.qrConfirmLoadSnapshot(sid);
        return;
      }
      if (delBtn) {
        var sid2 = delBtn.getAttribute('data-snap-id');
        if (sid2 && typeof window.qrConfirmDeleteSnapshot === 'function') window.qrConfirmDeleteSnapshot(sid2);
      }
    });
  }

  /** 依 state.settings.knownPriceTabs 產生 <option> 串，currentTab 自動 selected */
  function buildTabSelectOptionsHtml(currentTab) {
    var tabs = (state.settings && state.settings.knownPriceTabs && state.settings.knownPriceTabs.length)
      ? state.settings.knownPriceTabs
      : ['木作工程', '油漆工程', '水電工程', '壁紙工程', '保護工程'];
    var html = '<option value="">（選擇工作頁）</option>';
    var found = false;
    html += tabs.map(function (t) {
      var sel = (t === currentTab);
      if (sel) found = true;
      return '<option value="' + escAttr(t) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
    if (currentTab && !found) {
      html += '<option value="' + escAttr(currentTab) + '" selected>' + esc(currentTab) + '</option>';
    }
    return html;
  }

  /** 產生單一子品項的可編輯行 HTML */
  function subItemRowHtml(parentId, sub) {
    return (
      '<div class="sub-item-row rounded-lg border border-stone-200 p-2 bg-stone-50 space-y-1.5 text-xs"' +
      ' data-subid="' + escAttr(sub.id) + '" data-parentid="' + escAttr(parentId) + '">' +
      /* 第一行：名稱 / 單位 / 單價 / 預設 */
      '<div class="flex flex-wrap items-center gap-1.5">' +
      '<input type="text" class="sub-label flex-1 min-w-[100px] border border-stone-200 rounded px-1.5 py-0.5" value="' + escAttr(sub.label || '') + '" placeholder="子品項名稱" />' +
      '<input type="text" class="sub-unit w-10 border border-stone-200 rounded px-1.5 py-0.5 text-center" value="' + escAttr(sub.unit || '個') + '" placeholder="單位" />' +
      '<input type="number" class="sub-price w-20 border border-stone-200 rounded px-1.5 py-0.5" min="0" step="1" value="' + escAttr(String(sub.price != null ? sub.price : 0)) + '" />' +
      '<label class="flex items-center gap-1 shrink-0"><input type="checkbox" class="sub-defaulton"' + (sub.defaultOn ? ' checked' : '') + ' /><span>預設勾</span></label>' +
      '<label class="flex items-center gap-1 shrink-0">預設量<input type="number" class="sub-defaultqty w-10 border border-stone-200 rounded px-1 py-0.5 ml-1" min="0" step="1" value="' + escAttr(String(sub.defaultQty != null ? sub.defaultQty : 1)) + '" /></label>' +
      '<button type="button" class="shrink-0 text-red-500 hover:text-red-700 border border-red-200 rounded px-1.5 py-0.5 bg-white" onclick="window._qrRemoveSubItem(\'' + parentId.replace(/'/g, "\\'") + '\',\'' + sub.id.replace(/'/g, "\\'") + '\')">移除</button>' +
      priceMatchBadgeHtml(sub) +
      '</div>' +
      /* 第二行：工作頁 + A欄品項 */
      '<div class="flex gap-1.5">' +
      '<select class="sub-tab flex-1 border border-stone-200 rounded px-1.5 py-0.5 bg-white">' + buildTabSelectOptionsHtml(sub.priceSheetTab || '') + '</select>' +
      '<input type="text" list="qr-item-datalist" class="sub-item flex-1 border border-stone-200 rounded px-1.5 py-0.5" placeholder="試算表 A 欄（可空）" value="' + escAttr(sub.priceSheetItem || '') + '" />' +
      '</div>' +
      /* 第三行：客戶備註 */
      '<input type="text" class="sub-note w-full border border-stone-200/70 rounded px-1.5 py-0.5 text-stone-500 placeholder:text-stone-300" placeholder="客戶備註（可空）" value="' + escAttr(sub.clientNote || '') + '" />' +
      '</div>'
    );
  }

  /** 產生折疊式子品項區塊 HTML */
  function subItemsSectionHtml(parentId, subItems) {
    var subs = Array.isArray(subItems) ? subItems : [];
    var count = subs.length;
    return (
      '<details class="mt-2 border-t border-stone-200/60 pt-2">' +
      '<summary class="cursor-pointer text-xs text-stone-500 hover:text-stone-700 select-none list-none flex items-center gap-1.5">' +
      '<span class="text-[10px] text-stone-400 details-arrow">▶</span>' +
      '子品項' + (count ? '（' + count + ' 項）' : '（無）') + '</summary>' +
      '<div class="mt-1.5 space-y-1.5">' + subs.map(function (s) { return subItemRowHtml(parentId, s); }).join('') + '</div>' +
      '<button type="button" class="mt-1.5 text-xs border border-stone-200 rounded px-2 py-0.5 bg-white text-stone-600 hover:bg-stone-50" onclick="window._qrAddSubItem(\'' + parentId.replace(/'/g, "\\'") + '\')">＋ 新增子品項</button>' +
      '</details>'
    );
  }

  function menuBandOptionsHtml(currentBand) {
    var cur = currentBand && MENU_BAND_LABEL_ZH[currentBand] != null ? currentBand : 'other';
    var keys = Object.keys(MENU_BAND_LABEL_ZH || {}).slice();
    keys.sort(function (a, b) { return menuBandOrderKey(a) - menuBandOrderKey(b); });
    return keys.map(function (k) {
      return '<option value="' + escAttr(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(MENU_BAND_LABEL_ZH[k] || k) + '</option>';
    }).join('');
  }

  /** 客戶頁就緒狀態：給頂部提示條用 */
  function qrGetClientReadiness() {
    var s = state.settings || {};
    var schemes = s.schemeMenus || [];
    var defs = s.itemDefs || [];
    var priced = 0;
    var sheetOk = 0;
    defs.forEach(function (it) {
      if (!it) return;
      if ((it.price || 0) > 0) priced++;
      var c = it.priceSheetMatchCode;
      if (c === 'tab_ok' || c === 'legacy_ok') sheetOk++;
    });
    var hasSheetId = !!(String(s.priceSheetGvizId || '').trim());
    var level = 'ok';
    var msg = '設定就緒，可直接試算。內建單價可報價；若已填試算表 ID，開頁會嘗試同步最新單價。';
    if (!schemes.length || !defs.length) {
      level = 'error';
      msg = '缺少方案或品項資料。請開「調單價／方案設定」→ 系統區按「一鍵完成初次設定」，或還原預設後儲存。';
    } else if (!hasSheetId) {
      level = 'warn';
      msg =
        '可用內建單價試算。若要跟公司試算表一致，請到管理頁「初次設定」貼上試算表 ID 並一鍵對表。';
    } else if (sheetOk < Math.min(8, defs.length * 0.3)) {
      level = 'warn';
      msg =
        '試算表 ID 已填，但多數品項尚未對到表（約 ' +
        sheetOk +
        '／' +
        defs.length +
        ' 筆）。建議到管理頁按「一鍵完成初次設定」或「立即對表」。';
    }
    return { level: level, msg: msg, priced: priced, sheetOk: sheetOk, total: defs.length };
  }

  function qrRenderClientSetupBanner() {
    var el = document.getElementById('c_setupBanner');
    if (!el) return;
    var r = qrGetClientReadiness();
    el.textContent = r.msg;
    el.classList.remove('hidden', 'border-emerald-200', 'bg-emerald-50', 'text-emerald-950', 'border-amber-200', 'bg-amber-50', 'text-amber-950', 'border-red-200', 'bg-red-50', 'text-red-900');
    if (r.level === 'error') el.classList.add('border-red-200', 'bg-red-50', 'text-red-900');
    else if (r.level === 'warn') el.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-950');
    else el.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-950');
  }

  function fillTemplateSelect() {
    var sel = document.getElementById('c_template');
    if (!sel) return;
    sel.innerHTML = '';
    state.settings.templates.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.name;
      sel.appendChild(o);
    });
  }

  function fillSchemeRadios() {
    var box = document.getElementById('c_schemeRadios');
    if (!box) return;
    var menus = state.settings.schemeMenus || [];
    if (!state.selectedSchemeId && menus[0]) state.selectedSchemeId = menus[0].id;
    if (menus.length && !menus.some(function (m) { return m.id === state.selectedSchemeId; })) {
      state.selectedSchemeId = menus[0].id;
    }
    box.innerHTML = '';
    menus.forEach(function (sc) {
      var lab = document.createElement('label');
      lab.className = 'inline-flex items-center gap-1';
      var chk = sc.id === state.selectedSchemeId ? ' checked' : '';
      lab.innerHTML =
        '<input type="radio" name="scheme" value="' +
        esc(sc.id) +
        '"' +
        chk +
        ' /> ' +
        esc(sc.name);
      box.appendChild(lab);
    });
    box.querySelectorAll('input[name=scheme]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        state.selectedSchemeId = this.value;
        var step3 = document.getElementById('cStep3');
        if (state.lastAlloc && step3 && !step3.classList.contains('hidden')) {
          applySchemeQtyToInputs();
        }
      });
    });
  }

  function fillFormMenuSelects() {
    var fs = document.getElementById('s_menuScheme');
    var fi = document.getElementById('s_formItem');
    var want = state._preservedMenuScheme;
    state._preservedMenuScheme = null;
    if (fs) {
      fs.innerHTML = '';
      (state.settings.schemeMenus || []).forEach(function (m) {
        var o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.name + '（' + m.id + '）';
        fs.appendChild(o);
      });
      if (want && (state.settings.schemeMenus || []).some(function (x) { return x.id === want; })) {
        fs.value = want;
      } else if (state.selectedSchemeId && (state.settings.schemeMenus || []).some(function (x) { return x.id === state.selectedSchemeId; })) {
        fs.value = state.selectedSchemeId;
      } else if (state.settings.schemeMenus[0]) {
        fs.value = state.settings.schemeMenus[0].id;
      }
    }
    if (fi) {
      fi.innerHTML = '';
      (state.settings.itemDefs || [])
        .slice()
        .sort(function (a, b) {
          return adminItemDefSortKey(a) - adminItemDefSortKey(b);
        })
        .forEach(function (it) {
        var o2 = document.createElement('option');
        o2.value = it.id;
        o2.textContent = it.id + ' — ' + it.label;
        fi.appendChild(o2);
      });
    }
  }

  function refreshMenuSchemeUI() {
    var sc = getMenuScheme();
    if (document.getElementById('s_schemeNameEdit') && sc) {
      document.getElementById('s_schemeNameEdit').value = sc.name || '';
    }
    if (document.getElementById('s_schemeIdView') && sc) {
      document.getElementById('s_schemeIdView').textContent = sc.id;
    } else if (document.getElementById('s_schemeIdView')) {
      document.getElementById('s_schemeIdView').textContent = '—';
    }
    renderRulesTable();
    loadFormFromCurrentItem();
    setRuleFormHelp();
  }

  function fillAdminForm() {
    if (!document.getElementById('adminSaveBtn') && !document.getElementById('adminSaveBtnTop')) return;
    var s = state.settings;
    var sheetVal = s.priceSheetGvizId != null ? s.priceSheetGvizId : '';
    if (document.getElementById('s_sheetId')) {
      document.getElementById('s_sheetId').value = sheetVal;
    }
    if (document.getElementById('qrQuickSetupSheetId')) {
      document.getElementById('qrQuickSetupSheetId').value = sheetVal;
    }
    if (document.getElementById('s_floorWaste')) {
      document.getElementById('s_floorWaste').value = s.floorWaste != null ? s.floorWaste : DEFAULTS.floorWaste;
    }
    if (document.getElementById('s_floorRound')) {
      document.getElementById('s_floorRound').value = s.floorRound || 'int';
    }
    if (document.getElementById('s_trimRate')) {
      document.getElementById('s_trimRate').value = s.trimMoldingRate != null ? s.trimMoldingRate : DEFAULTS.trimMoldingRate;
    }
    if (document.getElementById('s_touchup')) {
      document.getElementById('s_touchup').value = s.touchupLump != null ? s.touchupLump : DEFAULTS.touchupLump;
    }
    if (document.getElementById('s_mepBase')) {
      document.getElementById('s_mepBase').value = s.mepSocketBase != null ? s.mepSocketBase : DEFAULTS.mepSocketBase;
    }
    if (document.getElementById('s_mepPerRoom')) {
      var mpz = s.mepPerZone != null ? s.mepPerZone : s.mepPerRoom != null ? s.mepPerRoom : DEFAULTS.mepPerZone;
      document.getElementById('s_mepPerRoom').value = mpz;
    }
    if (document.getElementById('s_priceSheetAuto')) {
      document.getElementById('s_priceSheetAuto').checked = s.priceSheetAutoOnOpen !== false;
    }
    fillFormMenuSelects();
    document.getElementById('s_balcony').value = s.balconyPing;
    document.getElementById('s_baths').value = (s.bathroomPings || []).join(',');
    document.getElementById('s_lkMin').value = s.lkShareMin;
    document.getElementById('s_lkMax').value = s.lkShareMax;
    document.getElementById('s_master').value = s.masterVsBed2;
    document.getElementById('s_bed3').value = s.bed3VsBed2;
    document.getElementById('s_bed4').value = s.bed4VsBed2 != null ? s.bed4VsBed2 : 0.92;
    document.getElementById('s_long').value = s.rectLong;
    document.getElementById('s_short').value = s.rectShort;
    document.getElementById('adminSchemesJson').value = JSON.stringify(s.schemeMenus || [], null, 2);
    var bandFormSel = document.getElementById('s_formMenuBand');
    if (bandFormSel) bandFormSel.innerHTML = menuBandOptionsHtml('other');
    var box = document.getElementById('adminPriceGroups');
    /* 各大項／試算表分頁分組；同分頁的品項聚在一起 */
    var itemsSorted = s.itemDefs
      .slice()
      .sort(function (a, b) { return adminItemDefSortKey(a) - adminItemDefSortKey(b); });

    var tabBuckets = {};
    itemsSorted.forEach(function (it) {
      var g = (it.priceSheetTab && String(it.priceSheetTab).trim()) || '__none';
      if (!tabBuckets[g]) tabBuckets[g] = [];
      tabBuckets[g].push(it);
    });

    var tabRank = {};
    ((s.knownPriceTabs && s.knownPriceTabs.length)
      ? s.knownPriceTabs
      : ['木作工程', '油漆工程', '水電工程', '壁紙工程', '保護工程']
    ).forEach(function (t, i) { tabRank[String(t)] = i; });

    var tabKeys = Object.keys(tabBuckets).sort(function (a, b) {
      var ra = tabRank[a] != null ? tabRank[a] : 888;
      var rb = tabRank[b] != null ? tabRank[b] : 888;
      if (ra !== rb) return ra - rb;
      var na = a === '__none' ? 1 : 0;
      var nb = b === '__none' ? 1 : 0;
      if (na !== nb) return na - nb;
      return String(a).localeCompare(String(b), 'zh-Hant');
    });

    if (box) {
    box.innerHTML = '';

    tabKeys.forEach(function (tabKey) {
      var list = tabBuckets[tabKey];
      var secEl = document.createElement('section');
      secEl.className = 'rounded-xl border border-stone-200 bg-stone-50/50 overflow-hidden';
      var displayTab = tabKey === '__none' ? '（未指定試算表分頁／其他）' : tabKey;
      secEl.dataset.engineTabKey = tabKey;
      secEl.innerHTML =
        '<div class="sticky top-0 z-[1] flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-stone-200/90 bg-amber-100/40">' +
        '<span class="text-sm font-semibold text-amber-950">' +
        esc(displayTab) +
        '<span class="text-[11px] font-normal text-stone-500 ml-1">（' +
        String(list.length) +
        ' 筆）</span></span>' +
        '<button type="button" class="text-xs shrink-0 px-2 py-1 rounded-lg border border-amber-300 bg-white hover:bg-white text-amber-900 qr-add-item-in-tab" data-tabpreset="' +
        escAttr(tabKey === '__none' ? '' : tabKey) +
        '">＋ 此工程新增品項</button>' +
        '</div>' +
        '<div class="p-2 space-y-2 qr-tab-item-list"></div>';
      box.appendChild(secEl);
      var inner = secEl.querySelector('.qr-tab-item-list');
      list.forEach(function (it) {
        var w = document.createElement('div');
        w.className = 'item-price-card rounded-lg border border-stone-200/90 bg-white px-3 py-2 shadow-sm';
        w.setAttribute('data-card-itemid', it.id);
        var tab0 = (it.priceSheetTab != null ? it.priceSheetTab : '') || '';
        var pin0 = (it.priceSheetItem != null ? it.priceSheetItem : '') || '';
        var cn0  = (it.clientNote != null ? it.clientNote : '') || '';
        var lab0 = (it.label != null ? it.label : '') || '';
        w.innerHTML =
          '<div class="flex items-start gap-2 mb-2 flex-wrap">' +
          '<input type="text" class="item-label-inp flex-1 min-w-[8rem] border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-900" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(lab0) + '" />' +
          '<code class="shrink-0 text-[10px] text-amber-900/70 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 select-all max-w-[8rem] break-all">' +
          esc(it.id) + '</code>' +
          '<button type="button" class="shrink-0 text-xs px-2 py-1 rounded-lg border border-red-200 bg-red-50/80 text-red-800 hover:bg-red-50 qr-delete-item-def" data-itemid="' +
          escAttr(it.id) + '" title="刪除此品項">刪除</button>' +
          priceMatchBadgeHtml(it) +
          '</div>' +
          '<div class="grid grid-cols-1 gap-x-2 gap-y-1.5 text-xs">' +
          '<label class="block text-stone-500">工作頁' +
          '<select class="item-ps-tab mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-900" data-itemid="' +
          escAttr(it.id) + '">' + buildTabSelectOptionsHtml(tab0) + '</select></label>' +
          '<label class="block text-stone-500">表內品項（對到即自動帶<strong>單位／單價</strong>）' +
          '<input type="text" list="qr-item-datalist" class="item-ps-name mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 text-stone-900" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(pin0) + '" placeholder="與試算表 A 欄相同" autocomplete="off" /></label>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">' +
          '<label class="block text-stone-500">單位' +
          '<input type="text" class="item-unit-inp mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 bg-white" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(String(it.unit != null ? it.unit : '')) + '" /></label>' +
          '<label class="block text-stone-500">單價（元）' +
          '<input type="number" min="0" step="1" data-itemid="' + escAttr(it.id) +
          '" class="item-price-inp mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 text-stone-900" value="' +
          escAttr(String(it.price != null ? it.price : 0)) + '" /></label>' +
          '</div>' +
          '<input type="text" class="item-client-note mt-1.5 w-full border border-stone-200/70 rounded-lg px-2 py-1 text-xs text-stone-500 placeholder:text-stone-300" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(cn0) + '" placeholder="客戶可見備註（可留空）" />' +
          subItemsSectionHtml(it.id, it.subItems);
        inner.appendChild(w);
      });
    });

    qrBindGroupedPricePanels(box);

    box.querySelectorAll('.qr-add-item-in-tab').forEach(function (btn) {
      var preset = btn.getAttribute('data-tabpreset');
      preset = preset != null ? String(preset).trim() : '';
      btn.addEventListener('click', function () {
        addNewItemDef({
          priceSheetTab: preset,
          menuBand: preset ? priceTabToSuggestedMenuBand(preset) : 'other',
          quoteSection: preset || '',
          groupTitle: preset || '',
        });
      });
    });
    box.querySelectorAll('.qr-delete-item-def').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var aid = btn.getAttribute('data-itemid');
        if (aid) removeItemDef(aid);
      });
    });
    }

    document.querySelectorAll('#adminGlobalAddItemBtn').forEach(function (btn) {
      if (btn._qrGlobalAddBound) return;
      btn._qrGlobalAddBound = true;
      btn.addEventListener('click', function () { addNewItemDef({}); });
    });

    refreshTabDatalist();
    refreshMenuSchemeUI();
    renderAdminSnapshotsPanel();
  }

  function priceTabToSuggestedMenuBand(tabName) {
    var t = String(tabName || '');
    if (t.indexOf('木作') >= 0) return 'wood_full';
    if (t.indexOf('油漆') >= 0) return 'paint';
    if (t.indexOf('水電') >= 0) return 'mep';
    if (t.indexOf('壁紙') >= 0) return 'finish';
    if (t.indexOf('保護') >= 0) return 'protect';
    return 'other';
  }

  /** 依試算表分頁自動補上「段落名／抬頭」（僅填空欄，減少重複輸入） */
  function alignQuoteMetaFromTabs() {
    if (!document.getElementById('adminSaveBtn')) return;
    readAdminForm();
    (state.settings.itemDefs || []).forEach(function (d) {
      if (!d) return;
      var t = (d.priceSheetTab || '').trim();
      if (!t) return;
      var qs = String(d.quoteSection || '').trim();
      var gt = String(d.groupTitle || '').trim();
      if (!qs) {
        d.quoteSection = t;
        d.menuBand = priceTabToSuggestedMenuBand(t);
      }
      if (!gt) d.groupTitle = t;
    });
    saveSettings();
    fillFormMenuSelects();
    refreshMenuSchemeUI();
    fillAdminForm();
    alert('已將「段落名／群組抬頭」為空的品項補為工作頁名稱。（僅填空，不中斷你手動改過的值）');
  }

  /** 防抖：工作頁／表內品項改過後自動向試算表對一次單價（需在「試算表 ID」已填時） */
  function qrScheduleSheetPriceSync() {
    if (!(state.settings.priceSheetAutoOnOpen !== false)) return;
    if (!document.getElementById('adminSaveBtn')) return;
    if (!(state.settings.priceSheetGvizId || '').trim()) return;
    if (qrScheduleSheetPriceSync._t) clearTimeout(qrScheduleSheetPriceSync._t);
    qrScheduleSheetPriceSync._t = setTimeout(function () {
      qrScheduleSheetPriceSync._t = null;
      readAdminForm();
      syncPricesFromGviz({ silent: true });
    }, 850);
  }

  /** 區塊內委派：對價監聽與 tab datalist — 只做一次綁定在 #adminPriceGroups */

  /** @param box {HTMLElement} */
  function qrBindGroupedPricePanels(box) {
    if (!box || box._qrGroupedBound) return;
    box._qrGroupedBound = true;
    box.addEventListener('change', function (ev) {
      if (!ev.target) return;
      if (ev.target.classList.contains('item-ps-tab')) {
        refreshItemDatalist(ev.target.value);
      }
      if (ev.target.classList.contains('item-ps-tab') || ev.target.classList.contains('item-ps-name')) {
        qrScheduleSheetPriceSync();
      }
    });
    box.addEventListener('focusin', function (ev) {
      if (!ev.target || !ev.target.classList) return;
      if (ev.target.classList.contains('item-ps-name')) {
        var iid = ev.target.getAttribute('data-itemid');
        var tabSel = iid ? box.querySelector('select.item-ps-tab[data-itemid="' + iid + '"]') : null;
        refreshItemDatalist(tabSel ? tabSel.value : '');
      }
    });
    box.addEventListener('blur', function (ev) {
      if (!ev.target || !ev.target.classList) return;
      if (ev.target.classList.contains('item-ps-name')) qrScheduleSheetPriceSync();
    }, true);
  }

  /** 刪一品項並自各方案的 rules 拔除 */
  function removeItemDef(itemId) {
    if (!itemId || !confirm('確定刪除此品項？各方案若有規則一併移除。'))
      return;
    readAdminForm();
    state.settings.itemDefs = (state.settings.itemDefs || []).filter(function (d) { return d && d.id !== itemId; });
    (state.settings.schemeMenus || []).forEach(function (sc) {
      if (sc && sc.rules && Object.prototype.hasOwnProperty.call(sc.rules, itemId)) delete sc.rules[itemId];
    });
    saveSettings();
    state._preservedMenuScheme = (document.getElementById('s_menuScheme') && document.getElementById('s_menuScheme').value) || state._preservedMenuScheme;
    fillFormMenuSelects();
    renderRulesTable();
    loadFormFromCurrentItem();
    fillSchemeRadios();
    syncSchemesJsonTextarea();
    fillAdminForm();
  }

  function readAdminForm() {
    if (!document.getElementById('adminSaveBtn')) return;
    var s = state.settings;
    if (document.getElementById('s_sheetId')) s.priceSheetGvizId = document.getElementById('s_sheetId').value.trim();
    if (document.getElementById('s_floorWaste')) s.floorWaste = parseFloat(document.getElementById('s_floorWaste').value) || DEFAULTS.floorWaste;
    if (document.getElementById('s_floorRound')) s.floorRound = document.getElementById('s_floorRound').value || 'int';
    if (document.getElementById('s_trimRate')) s.trimMoldingRate = parseFloat(document.getElementById('s_trimRate').value);
    if (s.trimMoldingRate == null || isNaN(s.trimMoldingRate)) s.trimMoldingRate = DEFAULTS.trimMoldingRate;
    if (document.getElementById('s_touchup')) s.touchupLump = parseFloat(document.getElementById('s_touchup').value);
    if (s.touchupLump == null || isNaN(s.touchupLump)) s.touchupLump = DEFAULTS.touchupLump;
    if (document.getElementById('s_mepBase')) s.mepSocketBase = parseFloat(document.getElementById('s_mepBase').value);
    if (s.mepSocketBase == null || isNaN(s.mepSocketBase)) s.mepSocketBase = DEFAULTS.mepSocketBase;
    if (document.getElementById('s_mepPerRoom')) {
      s.mepPerZone = parseFloat(document.getElementById('s_mepPerRoom').value);
      if (s.mepPerZone == null || isNaN(s.mepPerZone)) s.mepPerZone = DEFAULTS.mepPerZone;
    }
    if (document.getElementById('s_priceSheetAuto')) {
      s.priceSheetAutoOnOpen = !!document.getElementById('s_priceSheetAuto').checked;
    }
    s.balconyPing = parseFloat(document.getElementById('s_balcony').value) || 0;
    s.bathroomPings = document
      .getElementById('s_baths')
      .value.split(/[,，]/)
      .map(function (x) { return parseFloat(x.trim()); })
      .filter(function (x) { return !isNaN(x); });
    s.lkShareMin = parseFloat(document.getElementById('s_lkMin').value) || 0.5;
    s.lkShareMax = parseFloat(document.getElementById('s_lkMax').value) || 0.6;
    s.masterVsBed2 = parseFloat(document.getElementById('s_master').value) || 1.3;
    s.bed3VsBed2 = parseFloat(document.getElementById('s_bed3').value) || 0.85;
    s.bed4VsBed2 = parseFloat(document.getElementById('s_bed4').value);
    if (isNaN(s.bed4VsBed2)) s.bed4VsBed2 = 0.92;
    s.rectLong = parseFloat(document.getElementById('s_long').value) || 6;
    s.rectShort = parseFloat(document.getElementById('s_short').value) || 4;
    try {
      var parsed = JSON.parse(document.getElementById('adminSchemesJson').value);
      if (Array.isArray(parsed)) s.schemeMenus = parsed;
    } catch (e) {
      alert('方案 JSON 格式錯誤，未更新方案');
    }
    document.querySelectorAll('.item-unit-inp').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.unit = (inp.value || '').trim() || '式';
      });
    });
    document.querySelectorAll('.item-price-inp').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.price = parseFloat(inp.value) || 0;
      });
    });
    document.querySelectorAll('.item-ps-tab').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.priceSheetTab = (inp.value || '').trim();
      });
    });
    document.querySelectorAll('.item-ps-name').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.priceSheetItem = (inp.value || '').trim();
      });
    });
    document.querySelectorAll('.item-client-note').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.clientNote = (inp.value || '').trim();
      });
    });
    document.querySelectorAll('.item-label-inp').forEach(function (inp) {
      var iid = (inp.getAttribute('data-itemid') || '').trim();
      if (!iid) return;
      s.itemDefs.forEach(function (d) {
        if (d && d.id === iid) d.label = (inp.value || '').trim();
      });
    });
    /* 分類欄位（menuBand / displayRank / groupTitle / quoteSection）
       現改由 ② 規則編輯器的 s_formMenuBand 等欄位管理；
       儲存設定時一併寫回目前選取中的品項。 */
    var classifyId = document.getElementById('s_formItem') ? document.getElementById('s_formItem').value : '';
    if (classifyId) {
      var mbV  = (document.getElementById('s_formMenuBand')    && document.getElementById('s_formMenuBand').value)               || 'other';
      var drV  = (document.getElementById('s_formDisplayRank') && document.getElementById('s_formDisplayRank').value)            || '';
      var gtV  = (document.getElementById('s_formGroupTitle')  && document.getElementById('s_formGroupTitle').value.trim())      || '';
      var qsV  = (document.getElementById('s_formQuoteSection')&& document.getElementById('s_formQuoteSection').value.trim())    || '';
      s.itemDefs.forEach(function (d) {
        if (!d || d.id !== classifyId) return;
        d.menuBand = mbV || 'other';
        if (drV !== '' && !isNaN(parseFloat(drV))) d.displayRank = parseFloat(drV);
        else delete d.displayRank;
        if (gtV) d.groupTitle = gtV;
        if (qsV) d.quoteSection = qsV;
      });
    }
    /* 讀取各品項的子品項（sub-items）*/
    document.querySelectorAll('.item-price-card[data-card-itemid]').forEach(function (card) {
      var parentId = card.getAttribute('data-card-itemid');
      var parentDef = (s.itemDefs || []).filter(function (d) { return d && d.id === parentId; })[0];
      if (!parentDef) return;
      parentDef.subItems = [];
      card.querySelectorAll('.sub-item-row[data-subid]').forEach(function (subRow) {
        var subId = subRow.getAttribute('data-subid') || '';
        var get = function (cls) { var el = subRow.querySelector('.' + cls); return el ? el.value : ''; };
        var chk = function (cls) { var el = subRow.querySelector('.' + cls); return el ? el.checked : false; };
        parentDef.subItems.push({
          id: subId,
          label: (get('sub-label') || '').trim(),
          unit: (get('sub-unit') || '個').trim() || '個',
          price: parseFloat(get('sub-price')) || 0,
          defaultOn: chk('sub-defaulton'),
          defaultQty: parseFloat(get('sub-defaultqty')) || 1,
          priceSheetTab: (get('sub-tab') || '').trim(),
          priceSheetItem: (get('sub-item') || '').trim(),
          clientNote: (get('sub-note') || '').trim(),
        });
      });
    });
    s.schemaVersion = SCHEMA_V;
  }
