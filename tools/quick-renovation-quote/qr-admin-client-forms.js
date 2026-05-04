'use strict';

  /* ── 共用輔助：下拉選項 HTML ── */

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

  function fillTemplateSelect() {
    var sel = document.getElementById('c_template');
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
    var s = state.settings;
    if (document.getElementById('s_sheetId')) {
      document.getElementById('s_sheetId').value = s.priceSheetGvizId != null ? s.priceSheetGvizId : '';
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
    refreshMenuSchemeUI();
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
    var box = document.getElementById('adminItemPrices');
    box.innerHTML = '';
    /* 初始化 ② 規則編輯器的菜單大區下拉 */
    var bandFormSel = document.getElementById('s_formMenuBand');
    if (bandFormSel) bandFormSel.innerHTML = menuBandOptionsHtml('other');
    /* 刷新工作頁 datalist（從 knownPriceTabs） */
    refreshTabDatalist();
    s.itemDefs
      .slice()
      .sort(function (a, b) { return adminItemDefSortKey(a) - adminItemDefSortKey(b); })
      .forEach(function (it) {
        var w = document.createElement('div');
        w.className = 'item-price-card rounded-xl border border-stone-200/90 bg-white px-3 py-2.5 mb-2 last:mb-0 shadow-sm';
        w.setAttribute('data-card-itemid', it.id);
        var tab0 = (it.priceSheetTab != null ? it.priceSheetTab : '') || '';
        var pin0 = (it.priceSheetItem != null ? it.priceSheetItem : '') || '';
        var cn0  = (it.clientNote != null ? it.clientNote : '') || '';
        var lab0 = (it.label != null ? it.label : '') || '';
        w.innerHTML =
          /* 第一行：顯示名稱 + id */
          '<div class="flex items-center gap-2 mb-2">' +
          '<input type="text" class="item-label-inp flex-1 min-w-0 border border-stone-200 rounded-lg px-2 py-1.5 text-sm text-stone-900" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(lab0) + '" />' +
          '<code class="shrink-0 text-[10px] text-amber-900/70 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5 select-all" title="內用 id">' +
          esc(it.id) + '</code></div>' +
          /* 第二行：工作頁 | 品項（A欄） | 單價 — 三欄 */
          '<div class="grid grid-cols-1 sm:grid-cols-3 gap-x-2 gap-y-1.5 text-xs">' +
          '<label class="block text-stone-500">工作頁' +
          '<select class="item-ps-tab mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-900" data-itemid="' +
          escAttr(it.id) + '">' + buildTabSelectOptionsHtml(tab0) + '</select></label>' +
          '<label class="block text-stone-500">品項（試算表 A 欄）' +
          '<input type="text" list="qr-item-datalist" class="item-ps-name mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 text-stone-900" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(pin0) + '" placeholder="與試算表文字一致" /></label>' +
          '<label class="block text-stone-500">單價（元／' + esc(it.unit) + '）' +
          '<input type="number" min="0" step="1" data-itemid="' + escAttr(it.id) +
          '" class="item-price-inp mt-0.5 w-full border border-stone-200 rounded-lg px-2 py-1.5 text-stone-900" value="' +
          escAttr(String(it.price != null ? it.price : 0)) + '" /></label>' +
          '</div>' +
          /* 第三行：備註（淺色、選填感） */
          '<input type="text" class="item-client-note mt-1.5 w-full border border-stone-200/70 rounded-lg px-2 py-1 text-xs text-stone-500 placeholder:text-stone-300" data-itemid="' +
          escAttr(it.id) + '" value="' + escAttr(cn0) + '" placeholder="客戶可見備註（可留空）" />' +
          /* 子品項折疊區塊 */
          subItemsSectionHtml(it.id, it.subItems);
        box.appendChild(w);
      });

    /* 事件代理：工作頁改選 → 更新品項下拉清單；品項 focus → 同步清單 */
    if (!box._qrItemDatalistBound) {
      box._qrItemDatalistBound = true;
      box.addEventListener('change', function (ev) {
        if (ev.target && ev.target.classList.contains('item-ps-tab')) {
          refreshItemDatalist(ev.target.value);
        }
      });
      box.addEventListener('focusin', function (ev) {
        if (ev.target && ev.target.classList.contains('item-ps-name')) {
          var iid = ev.target.getAttribute('data-itemid');
          var tabSel = iid ? box.querySelector('select.item-ps-tab[data-itemid="' + iid + '"]') : null;
          refreshItemDatalist(tabSel ? tabSel.value : '');
        }
      });
    }
  }

  function readAdminForm() {
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
    var np = document.getElementById('adminNewPin').value.trim();
    if (np.length >= 4) s.adminPin = np;
    s.schemaVersion = SCHEMA_V;
  }
