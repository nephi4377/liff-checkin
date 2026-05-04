'use strict';
  function qrFbReadMergedConfig() {
    try {
      return Object.assign({}, FB_CONFIG_DEFAULT, JSON.parse(localStorage.getItem(FB_CONFIG_STORAGE_KEY)) || {});
    } catch (e) {
      return Object.assign({}, FB_CONFIG_DEFAULT);
    }
  }

  function qrFbAuthConfigured(cfg) {
    var c = cfg || qrFbReadMergedConfig();
    return !!(String(c.apiKey || '').trim() && String(c.authDomain || '').trim() && String(c.projectId || '').trim());
  }

  function qrFbInitOptions(cfg) {
    var c = cfg || qrFbReadMergedConfig();
    var o = { databaseURL: c.databaseURL || FB_CONFIG_DEFAULT.databaseURL };
    if (qrFbAuthConfigured(c)) {
      o.apiKey = String(c.apiKey).trim();
      o.authDomain = String(c.authDomain).trim();
      o.projectId = String(c.projectId).trim();
    }
    return o;
  }

  function qrFbEnsureApp() {
    if (typeof firebase === 'undefined') return null;
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(qrFbInitOptions());
      }
    } catch (e) {
      console.warn('[QuickQuote Firebase]', e);
      return null;
    }
    try {
      if (qrFbAuthConfigured() && firebase.auth) {
        firebase.auth().onAuthStateChanged(function (u) {
          state.fbAuthUid = u && u.uid ? u.uid : null;
        });
        firebase.auth().signInAnonymously().catch(function (e2) {
          console.warn('[QuickQuote Firebase] 匿名登入失敗', e2 && e2.message);
        });
      }
    } catch (e3) {
      console.warn('[QuickQuote Firebase]', e3);
    }
    state.fbReady = true;
    return firebase.database();
  }

  function qrFbSettingsRef(db) {
    return db.ref(FB_RTDB_SETTINGS_PATH);
  }

  function qrFbSetSyncNote(text) {
    state.fbLoadNote = text || '';
    var el = document.getElementById('qrFbSyncStatus');
    if (el) el.textContent = text || '（無訊息）';
  }

  function qrApplyLoadedSettingsObject(parsed) {
    state.settings = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), parsed);
    if (state.settings.mepPerZone == null && state.settings.mepPerRoom != null) {
      state.settings.mepPerZone = state.settings.mepPerRoom;
    }
  }

  function normalizeSettingsAfterLoad() {
    if (state.settings.mepPerZone == null && state.settings.mepPerRoom != null) {
      state.settings.mepPerZone = state.settings.mepPerRoom;
    }
    if (state.settings.bed4VsBed2 == null) state.settings.bed4VsBed2 = DEFAULTS.bed4VsBed2;
    if (!Array.isArray(state.settings.schemeMenus) || !state.settings.schemeMenus.length) {
      state.settings.schemeMenus = defaultSchemeMenus();
    }
    var defs = state.settings.itemDefs;
    var hasSchema4 =
      Array.isArray(defs) &&
      defs.some(function (x) { return x && x.id === 'floor_p' && x.perFloor; }) &&
      defs.some(function (x) { return x && x.id === 'trim_molding' && x.lineKind === 'trim'; });
    if (!state.settings.schemaVersion || state.settings.schemaVersion < 4 || !hasSchema4) {
      state.settings.itemDefs = JSON.parse(JSON.stringify(DEFAULTS.itemDefs));
      state.settings.schemeMenus = defaultSchemeMenus();
      state.settings.schemaVersion = SCHEMA_V;
      if (state.settings.mepPerZone == null && state.settings.mepPerRoom != null) {
        state.settings.mepPerZone = state.settings.mepPerRoom;
      }
      if (!state.settings.priceSheetGvizId && state.settings.gvizId) {
        state.settings.priceSheetGvizId = state.settings.gvizId;
      }
      saveSettingsLocalOnly();
    } else if (state.settings.schemaVersion < SCHEMA_V) {
      mergeMissingItemDefsFromDefaults();
      ensureProtectSiteInAllSchemes();
      state.settings.schemaVersion = SCHEMA_V;
      saveSettingsLocalOnly();
    }
    if (!Array.isArray(state.settings.itemDefs) || !state.settings.itemDefs.length) {
      state.settings.itemDefs = JSON.parse(JSON.stringify(DEFAULTS.itemDefs));
    }
    alignItemDefLayoutFromDefaults();
    /* 從獨立快取 key 還原工作頁清單（避免被還原全預設清掉） */
    try {
      var cachedTabs = JSON.parse(localStorage.getItem(TABS_CACHE_KEY));
      if (Array.isArray(cachedTabs) && cachedTabs.length > 0) {
        state.settings.knownPriceTabs = cachedTabs;
      }
    } catch (e) { /* ignore */ }
    if (!state.settings.knownPriceItems || typeof state.settings.knownPriceItems !== 'object' || Array.isArray(state.settings.knownPriceItems)) {
      state.settings.knownPriceItems = {};
    }
  }

  function saveSettingsLocalOnly() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function qrFbPushCurrentSettings(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var db = qrFbEnsureApp();
    if (!db) {
      if (!silent) alert('無法連線 Firebase（程式未載入或初始化失敗）。');
      return Promise.resolve(false);
    }
    return qrFbSettingsRef(db)
      .set(state.settings)
      .then(function () {
        qrFbSetSyncNote('已上傳至雲端（' + FB_RTDB_SETTINGS_PATH + '）。');
        if (!silent) alert('已上傳到 Firebase。');
        return true;
      })
      .catch(function (e) {
        var msg = (e && e.message) || String(e);
        qrFbSetSyncNote('上傳失敗：' + msg);
        if (!silent) alert('上傳失敗：' + msg);
        console.warn('[QuickQuote Firebase] push', e);
        return false;
      });
  }

  function qrFbPullOnce(opts) {
    opts = opts || {};
    var silent = !!opts.silent;
    var preferRemote = !!opts.preferRemote;
    var db = qrFbEnsureApp();
    if (!db) {
      if (!silent) qrFbSetSyncNote('未載入 Firebase SDK 或無法初始化。');
      return Promise.resolve(false);
    }
    return qrFbSettingsRef(db)
      .once('value')
      .then(function (snap) {
        var val = snap.val();
        if (val == null || typeof val !== 'object') {
          qrFbSetSyncNote('雲端尚無資料（路徑 ' + FB_RTDB_SETTINGS_PATH + '）。沿用本機。');
          return false;
        }
        try {
          qrApplyLoadedSettingsObject(val);
          normalizeSettingsAfterLoad();
          saveSettingsLocalOnly();
          qrFbSetSyncNote(
            preferRemote
              ? '已從雲端載入並覆寫本機（' + FB_RTDB_SETTINGS_PATH + '）。'
              : '已從雲端拉下並寫入本機。'
          );
          if (!silent && !preferRemote) alert('已從雲端拉下並寫入本機。');
          return true;
        } catch (e) {
          qrFbSetSyncNote('雲端資料格式異常：' + (e && e.message));
          if (!silent) alert('雲端資料無法解析。');
          return false;
        }
      })
      .catch(function (e) {
        var msg = (e && e.message) || String(e);
        qrFbSetSyncNote('讀取雲端失敗：' + msg + '（沿用本機）');
        if (!silent) alert('讀取雲端失敗：' + msg);
        console.warn('[QuickQuote Firebase] pull', e);
        return false;
      });
  }

  function syncSchemesJsonTextarea() {
    var t = document.getElementById('adminSchemesJson');
    if (t) t.value = JSON.stringify(state.settings.schemeMenus || [], null, 2);
  }

  function getMenuScheme() {
    var el = document.getElementById('s_menuScheme');
    if (!el) return null;
    var id = el.value;
    if (!id) return null;
    return (state.settings.schemeMenus || []).filter(function (x) { return x && x.id === id; })[0] || null;
  }

  function ruleToSummary(r) {
    if (!r || !r.type) return '— 未設規則（不計算）';
    var t = r.type;
    var eLong = r.edge === 'long';
    if (t === 'fixed_shaku') return '定量：' + (r.value != null ? r.value : '0');
    if (t === 'floor_115') return '分空間地坪：每區實鋪×損耗＋取整';
    if (t === 'ceil_ping_lk_beds') return '變量：客＋臥坪合、向上取整（天花用）';
    if (t === 'sum_ping_paints') return '變量：面漆參考坪＝上列和';
    if (t === 'sum_ac_shaku_paint') return '變量：各空間包管短邊一邊加總（台尺）';
    if (t === 'recess_15x') return '變量：嵌燈盞數參考';
    if (t === 'mep_sockets_bed') return '變量：出線點（底＋臥參與，見管理員）';
    if (t === 'short_shaku_zone') {
      return '變量：' + (r.zone ? r.zone + ' ' : '逐空間帶入 ') + (eLong ? '長邊' : '短邊') + '一邊滿尺';
    }
    if (t === 'shaku_edge_scaled') {
      return '變量：' + (r.zone || '?') + ' 的' + (eLong ? '長' : '短') + '邊×' + (r.scale != null ? Math.round(r.scale * 100) : '') + '%';
    }
    if (t === 'short_shaku_scaled') {
      return '變量：' + (r.zone || '?') + ' ' + (eLong ? '長' : '短') + '邊×' + (r.scale != null ? Math.round(r.scale * 100) : '') + '%';
    }
    if (t === 'short_shaku_full') {
      return '變量：' + (r.zone || '?') + ' ' + (eLong ? '長' : '短') + '邊滿尺';
    }
    if (t === 'avg_secondary_short_shaku_scaled') {
      return '變量：次臥短邊平均×' + (r.scale != null ? Math.round(r.scale * 100) : '') + '%';
    }
    if (t === 'trim_placeholder' || t === 'touchup_from_settings') {
      return t === 'trim_placeholder' ? '佔位：收邊（%另行）' : '佔位：細清定額（管理員）';
    }
    return t;
  }

  function setRuleFormHelp() {
    var h = document.getElementById('s_formRuleHelp');
    if (!h) return;
    var t = (document.getElementById('s_formRule') && document.getElementById('s_formRule').value) || '';
    var m = {
      remove: '將從本方案刪除這一筆。若品項內建預設有勾，數量可能仍帶 0，請在客戶端不勾或改手動。',
      floor_115: '地坪不用選空間：一條規則就會分別套在客、主、各次臥。',
      sum_ping_paints: '面漆、包管漆等不需填 zone。',
      mep_sockets_bed: '出線的底數在「水電參考」欄，不在此。',
    };
    h.textContent = m[t] != null ? m[t] : '依需要填定值、比例、空間、牆邊。次臥可逐間的品通常不必填「哪一臥」— 程式會每間帶一個。';
  }

  function loadRuleFieldsFromRule(r) {
    var ruleSel = document.getElementById('s_formRule');
    if (ruleSel) ruleSel.value = r.type || 'fixed_shaku';
    if (document.getElementById('s_formValue')) {
      document.getElementById('s_formValue').value = r.value != null && !isNaN(r.value) ? r.value : '';
    }
    if (document.getElementById('s_formScale')) {
      document.getElementById('s_formScale').value = r.scale != null && !isNaN(r.scale) ? r.scale : '';
    }
    var z = r.zone;
    if (z === 'lk' || z === 'master') {
      if (document.getElementById('s_formZone')) document.getElementById('s_formZone').value = z;
      if (document.getElementById('s_formZoneExtra')) document.getElementById('s_formZoneExtra').value = '';
    } else if (z) {
      if (document.getElementById('s_formZone')) document.getElementById('s_formZone').value = '';
      if (document.getElementById('s_formZoneExtra')) document.getElementById('s_formZoneExtra').value = z;
    } else {
      if (document.getElementById('s_formZone')) document.getElementById('s_formZone').value = '';
      if (document.getElementById('s_formZoneExtra')) document.getElementById('s_formZoneExtra').value = '';
    }
    if (document.getElementById('s_formEdge')) {
      document.getElementById('s_formEdge').value = r.edge === 'long' ? 'long' : 'short';
    }
    setRuleFormHelp();
  }

  function scrollToSchemeRuleEditor() {
    var el = document.getElementById('schemeRuleEditor');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function loadItemIntoRuleForm(itemId) {
    if (!itemId) return;
    if (document.getElementById('s_formItem')) document.getElementById('s_formItem').value = itemId;
    loadFormFromCurrentItem();
    scrollToSchemeRuleEditor();
  }

  function loadFormFromCurrentItem() {
    var itId = document.getElementById('s_formItem') && document.getElementById('s_formItem').value;
    if (!itId) return;
    var sc = getMenuScheme();
    if (!sc) return;
    var r = (sc.rules && sc.rules[itId]) || null;
    if (!r) {
      if (document.getElementById('s_formRule')) document.getElementById('s_formRule').value = 'fixed_shaku';
      if (document.getElementById('s_formValue')) document.getElementById('s_formValue').value = '';
      if (document.getElementById('s_formScale')) document.getElementById('s_formScale').value = '';
      if (document.getElementById('s_formZone')) document.getElementById('s_formZone').value = '';
      if (document.getElementById('s_formZoneExtra')) document.getElementById('s_formZoneExtra').value = '';
      if (document.getElementById('s_formEdge')) document.getElementById('s_formEdge').value = 'short';
      setRuleFormHelp();
    } else {
      loadRuleFieldsFromRule(r);
    }
    /* 讀品項的分類欄位（跨方案共用，存在 itemDefs） */
    var itDefs = (state.settings && state.settings.itemDefs) || [];
    var itDef = null;
    for (var i = 0; i < itDefs.length; i++) {
      if (itDefs[i] && itDefs[i].id === itId) { itDef = itDefs[i]; break; }
    }
    if (itDef) {
      if (document.getElementById('s_formMenuBand'))
        document.getElementById('s_formMenuBand').value = itDef.menuBand || 'other';
      if (document.getElementById('s_formDisplayRank')) {
        var drVal = itDef.displayRank != null && !isNaN(itDef.displayRank)
          ? itDef.displayRank
          : (itDef.sortKey != null ? itDef.sortKey : '');
        document.getElementById('s_formDisplayRank').value = drVal !== '' ? String(drVal) : '';
      }
      if (document.getElementById('s_formGroupTitle'))
        document.getElementById('s_formGroupTitle').value = itDef.groupTitle || '';
      if (document.getElementById('s_formQuoteSection'))
        document.getElementById('s_formQuoteSection').value = itDef.quoteSection || '';
    }
  }

  function renderRulesTable() {
    var bod = document.getElementById('s_rulesTableBody');
    if (!bod) return;
    var sc = getMenuScheme();
    bod.innerHTML = '';
    var statsEl = document.getElementById('s_schemeRuleStats');
    if (!sc) {
      if (statsEl) statsEl.textContent = '';
      return;
    }
    var allDefs = (state.settings.itemDefs || []).slice().sort(function (a, b) {
      return adminItemDefSortKey(a) - adminItemDefSortKey(b);
    });
    var rules = sc.rules || {};
    var setCount = allDefs.filter(function (d) {
      return d && rules[d.id] && rules[d.id].type;
    }).length;
    var qRaw = document.getElementById('s_rulesFilter') ? document.getElementById('s_rulesFilter').value : '';
    var q = String(qRaw || '')
      .trim()
      .toLowerCase();
    var defs = allDefs;
    if (q) {
      defs = allDefs.filter(function (def) {
        if (!def) return false;
        var hay = (
          (def.id || '') +
          ' ' +
          (def.label || '') +
          ' ' +
          ruleToSummary(rules[def.id])
        ).toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    if (statsEl) {
      statsEl.textContent =
        '此方案已設定規則：' +
        setCount +
        '／' +
        allDefs.length +
        ' 筆品項' +
        (q ? '（篩選顯示 ' + defs.length + ' 筆）' : '。');
    }
    if (defs.length === 0) {
      var trE = document.createElement('tr');
      trE.innerHTML =
        '<td colspan="3" class="p-4 text-center text-stone-500 text-xs">沒有符合「' +
        esc(qRaw.trim()) +
        '」的品項，請換關鍵字或清空搜尋。</td>';
      bod.appendChild(trE);
    }
    var lastBand = null;
    defs.forEach(function (def) {
      if (!def) return;
      var band = def.menuBand || 'other';
      if (band !== lastBand) {
        lastBand = band;
        var trH = document.createElement('tr');
        trH.className = 'bg-amber-50/80 border-b border-amber-100 s-rules-band-row';
        var lab = MENU_BAND_LABEL_ZH[band] || MENU_BAND_LABEL_ZH.other;
        trH.innerHTML =
          '<td colspan="3" class="p-2 text-xs font-semibold text-amber-950">' + esc(lab) + '</td>';
        bod.appendChild(trH);
      }
      var r = rules[def.id];
      var hasRule = !!(r && r.type);
      var mm = '';
      if (def.menuMatrix) {
        mm =
          '<details class="mt-1 text-[10px] max-w-md"><summary class="cursor-pointer text-amber-900/90 hover:underline select-none">欄位 model（點開參考）</summary><p class="text-stone-500 leading-snug mt-1 pl-2 border-l-2 border-amber-100">' +
          esc(def.menuMatrix) +
          '</p></details>';
      }
      var tr = document.createElement('tr');
      tr.className =
        'border-b border-stone-100 s-rule-data-row cursor-pointer transition-colors hover:bg-amber-50/50 ' +
        (hasRule ? 'border-l-[3px] border-l-emerald-500' : 'border-l-[3px] border-l-stone-200');
      tr.setAttribute('data-item-id', def.id);
      tr.innerHTML =
        '<td class="p-2 align-top"><span class="font-mono text-[11px] text-stone-400">' +
        esc(def.id) +
        '</span><br><span class="text-stone-800">' +
        esc(def.label) +
        '</span>' +
        mm +
        '</td><td class="p-2 align-top text-stone-700">' +
        esc(ruleToSummary(r)) +
        '</td><td class="p-2 align-top text-center"><button type="button" class="px-1.5 py-0.5 text-[11px] border border-stone-300 rounded bg-white hover:bg-stone-50 s-load-item" data-item-id="' +
        esc(def.id) +
        '">載入</button></td>';
      bod.appendChild(tr);
    });
    bod.querySelectorAll('.s-load-item').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var iid = btn.getAttribute('data-item-id');
        loadItemIntoRuleForm(iid);
        btn.blur();
      });
    });
    var wrap = document.getElementById('s_rulesTableScroll');
    if (wrap && !wrap._qrRowNav) {
      wrap._qrRowNav = true;
      wrap.addEventListener('click', function (ev) {
        if (ev.target.closest && ev.target.closest('.s-load-item')) return;
        if (ev.target.closest && ev.target.closest('details')) return;
        var tr = ev.target.closest && ev.target.closest('tr.s-rule-data-row');
        if (!tr) return;
        var iid = tr.getAttribute('data-item-id');
        if (iid) loadItemIntoRuleForm(iid);
      });
    }
    var rf = document.getElementById('s_rulesFilter');
    if (rf && !rf._qrBound) {
      rf._qrBound = true;
      rf.addEventListener('input', function () {
        renderRulesTable();
      });
    }
  }

  function deepMerge(a, b) {
    if (!b || typeof b !== 'object') return a;
    Object.keys(b).forEach(function (k) {
      if (Array.isArray(b[k])) a[k] = b[k].slice();
      else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) {
        a[k] = a[k] || {};
        deepMerge(a[k], b[k]);
      } else a[k] = b[k];
    });
    return a;
  }

  function alignItemDefLayoutFromDefaults() {
    var by = {};
    DEFAULTS.itemDefs.forEach(function (d) {
      if (d && d.id) by[d.id] = d;
    });
    (state.settings.itemDefs || []).forEach(function (d) {
      var b0 = d && d.id && by[d.id];
      if (!b0) return;
      var keys = [
        'quoteSection',
        'displayRank',
        'menuMatrix',
        'groupTitle',
        'group',
        'perSecondary',
        'perFloor',
        'zoneScope',
        'lineKind',
        'quoteNote',
        'label',
        'unit',
        'sortKey',
        'priceSheetTab',
        'priceSheetItem',
        'clientNote',
        'menuBand',
      ];
      keys.forEach(function (k) {
        if (b0[k] !== undefined && d[k] === undefined) d[k] = b0[k];
      });
    });
  }

  function mergeMissingItemDefsFromDefaults() {
    var list = state.settings.itemDefs;
    if (!Array.isArray(list)) list = state.settings.itemDefs = [];
    var byId = {};
    list.forEach(function (d) {
      if (d && d.id) byId[d.id] = true;
    });
    DEFAULTS.itemDefs.forEach(function (d) {
      if (!d || !d.id || byId[d.id]) return;
      list.push(JSON.parse(JSON.stringify(d)));
      byId[d.id] = true;
    });
  }

  function ensureProtectSiteInAllSchemes() {
    var pr = defaultSchemeRulesBase().protect_site;
    if (!pr) return;
    (state.settings.schemeMenus || []).forEach(function (sc) {
      if (!sc) return;
      if (!sc.rules) sc.rules = {};
      if (!sc.rules.protect_site) sc.rules.protect_site = JSON.parse(JSON.stringify(pr));
    });
  }

  function adminItemDefSortKey(def) {
    if (!def) return 1e9;
    var band = menuBandOrderKey(def.menuBand);
    return band * 100000 + (def.displayRank != null ? def.displayRank : def.sortKey || 0);
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.settings = deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), JSON.parse(raw));
      else state.settings = JSON.parse(JSON.stringify(DEFAULTS));
    } catch (e) {
      state.settings = JSON.parse(JSON.stringify(DEFAULTS));
    }
    normalizeSettingsAfterLoad();
    return state.settings;
  }

  function saveSettings() {
    saveSettingsLocalOnly();
    return qrFbPushCurrentSettings({ silent: true });
  }

  function randBetween(a, b) {
    return a + Math.random() * (b - a);
  }

  function rectDimsCm(ping, s) {
    var m2 = ping * PING_TO_M2;
    var ratio = s.rectLong / s.rectShort;
    var W = Math.sqrt(m2 / ratio);
    var L = m2 / W;
    return { L: Math.round(L * 100), W: Math.round(W * 100), Lm: L, Wm: W };
  }

  function shakuFromCm(cm) {
    return Math.max(1, Math.round(cm / 30.3));
  }

  /** 小數一位（衣櫃 8.5×0.6 類） */
  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  function getZone(alloc, key) {
    var z = alloc.zones.filter(function (x) { return x.key === key; })[0];
    return z || null;
  }

  function edgeShakuZone(alloc, zoneKey, edge) {
    var z = getZone(alloc, zoneKey);
    if (!z || !z.dims) return 0;
    var e = edge === 'long' ? 'long' : 'short';
    var cm = e === 'long' ? Math.max(z.dims.L, z.dims.W) : Math.min(z.dims.L, z.dims.W);
    return shakuFromCm(cm);
  }

  function shortShakuZone(alloc, zoneKey) {
    return edgeShakuZone(alloc, zoneKey, 'short');
  }

  function mergeRuleForZoneInject(rule, ctx) {
    if (!ctx || !ctx.zoneKey) return rule;
    if (!rule || !rule.type) return rule;
    if (ctx.zoneKey && (rule.zone == null || rule.zone === '')) {
      var t = rule.type;
      if (
        t === 'short_shaku_zone' ||
        t === 'short_shaku_scaled' ||
        t === 'shaku_edge_scaled' ||
        t === 'short_shaku_full' ||
        t === 'floor_115'
      ) {
        return Object.assign({}, rule, { zone: ctx.zoneKey });
      }
    }
    return rule;
  }

  function sumAcShakuAllAlloc(alloc) {
    var t = 0;
    t += shortShakuZone(alloc, 'lk');
    t += shortShakuZone(alloc, 'master');
    getSecondaryBeds(alloc).forEach(function (b) {
      t += shortShakuZone(alloc, b.key);
    });
    return t;
  }

  function roundAfterWastePing(raw, mode) {
    if (raw <= 0) return 0;
    if (mode === 'half') return Math.max(0.5, Math.ceil(raw * 2) / 2);
    return Math.max(1, Math.ceil(raw));
  }

  function floorQtyForZone(alloc, zoneKey, s) {
    var z = getZone(alloc, zoneKey);
    if (!z) return 0;
    var waste = typeof s.floorWaste === 'number' ? s.floorWaste : 1.15;
    var mode = s.floorRound === 'half' ? 'half' : 'int';
    return roundAfterWastePing(z.ping * waste, mode);
  }

  function mepSocketCountFromAlloc(alloc, s) {
    if (!alloc || !alloc.template) return 0;
    var base = typeof s.mepSocketBase === 'number' ? s.mepSocketBase : 30;
    var pz = typeof s.mepPerZone === 'number' ? s.mepPerZone : 6;
    return Math.max(0, Math.round(base + pz * (1 + alloc.template.bedrooms)));
  }

  function avgSecondaryShortShaku(alloc) {
    var beds = alloc.zones.filter(function (z) { return z.kind === 'bed' && z.key !== 'master'; });
    if (!beds.length) return 0;
    var t = 0;
    beds.forEach(function (b) {
      t += shakuFromCm(Math.min(b.dims.L, b.dims.W));
    });
    return round1(t / beds.length);
  }

  function sumPingLkBeds(alloc) {
    var s = 0;
    alloc.zones.forEach(function (z) {
      if (z.key === 'lk' || z.kind === 'bed') s += z.ping;
    });
    return s;
  }

  function computeQtyFromRule(rule, itemId, alloc, ctx) {
    if (!rule || !rule.type) return 0;
    var r0 = rule;
    if (ctx) r0 = mergeRuleForZoneInject(rule, ctx);
    var r = r0;
    switch (r.type) {
      case 'ceil_ping_lk_beds':
        return Math.ceil(sumPingLkBeds(alloc));
      case 'floor_ping_lk_beds':
        return Math.ceil(sumPingLkBeds(alloc));
      case 'short_shaku_zone': {
        var zKey = r.zone != null && r.zone !== '' ? r.zone : 'lk';
        return edgeShakuZone(alloc, zKey, r.edge || 'short');
      }
      case 'shaku_edge_scaled': {
        var ze = r.zone != null && r.zone !== '' ? r.zone : 'lk';
        var base = edgeShakuZone(alloc, ze, r.edge || 'long');
        var sc0 = typeof r.scale === 'number' ? r.scale : 0.3;
        return Math.max(0.1, round1(base * sc0));
      }
      case 'short_shaku_scaled': {
        var z2 = r.zone != null && r.zone !== '' ? r.zone : 'master';
        var sh = edgeShakuZone(alloc, z2, r.edge || 'short');
        var scc = typeof r.scale === 'number' ? r.scale : 0.6;
        return Math.max(0.1, round1(sh * scc));
      }
      case 'short_shaku_full': {
        var z3 = r.zone != null && r.zone !== '' ? r.zone : 'master';
        return edgeShakuZone(alloc, z3, r.edge || 'short');
      }
      case 'avg_secondary_short_shaku_scaled': {
        var avg2 = avgSecondaryShortShaku(alloc);
        var sc2 = typeof r.scale === 'number' ? r.scale : 0.6;
        if (!alloc.zones.some(function (z) { return z.kind === 'bed' && z.key !== 'master'; })) return 0;
        return Math.max(0.1, round1(avg2 * sc2));
      }
      case 'fixed_shaku':
        return typeof r.value === 'number' ? r.value : 0;
      case 'floor_115': {
        var zf = r.zone;
        if (!zf) return 0;
        return floorQtyForZone(alloc, zf, state.settings);
      }
      case 'sum_ping_paints':
        return Math.ceil(sumPingLkBeds(alloc));
      case 'sum_ac_shaku_paint':
        return sumAcShakuAllAlloc(alloc);
      case 'recess_15x':
        return Math.max(0, Math.ceil(sumPingLkBeds(alloc) * 1.5));
      case 'mep_sockets_bed':
        return mepSocketCountFromAlloc(alloc, state.settings);
      case 'trim_placeholder':
        return 1;
      case 'touchup_from_settings':
        return 1;
      default:
        return 0;
    }
  }

  function getSchemeById(sid) {
    var s = state.settings;
    var m = (s.schemeMenus || []).filter(function (x) { return x.id === sid; })[0];
    return m || (s.schemeMenus && s.schemeMenus[0]) || { id: 'simple', name: '精簡', rules: {} };
  }

  function getSecondaryBeds(alloc) {
    return alloc.zones.filter(function (z) {
      return z.kind === 'bed' && z.key !== 'master';
    });
  }

  function getDisplayItemRows(alloc) {
    var rows = [];
    var defs = (state.settings.itemDefs || []).slice();
    var pushRow = function (def, ex) {
      if (!def) return;
      var rid = (ex && ex.rowId) || def.id;
      var band = (ex && ex.menuBand) || def.menuBand || 'other';
      var bo = menuBandOrderKey(band);
      var dr = def.displayRank != null ? def.displayRank : def.sortKey || 0;
      var sortVal = ex && ex.sort != null ? ex.sort : bo * 100000 + dr;
      rows.push({
        def: def,
        rowId: rid,
        instanceZoneKey: ex && ex.zk != null ? ex.zk : null,
        roomLabel: ex && ex.label ? ex.label : null,
        menuBand: band,
        subGroupTitle: ex && ex.subGroupTitle != null ? ex.subGroupTitle : null,
        groupTitle: (ex && ex.gTitle != null) ? ex.gTitle : def.groupTitle || def.group,
        quoteSection: (ex && ex.quoteSection != null) ? ex.quoteSection : def.quoteSection || def.groupTitle || def.group,
        sort: sortVal,
      });
    };
    var rank = function (d) {
      return d.displayRank != null ? d.displayRank : d.sortKey || 0;
    };
    var defFloor = defs.filter(function (d) {
      return d.perFloor;
    })[0];

    ['ceiling', 'wardrobe2'].forEach(function (iid) {
      var d = defs.filter(function (x) { return x && x.id === iid; })[0];
      if (!d) return;
      pushRow(d, {
        menuBand: 'wood_full',
        gTitle: d.groupTitle || '全室木作',
        quoteSection: d.quoteSection,
        sort: menuBandOrderKey('wood_full') * 100000 + rank(d),
      });
    });

    defs
      .filter(function (d) {
        return d.zoneScope === 'lk' && !d.perFloor;
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'zone_lk',
          gTitle: '客餐廳',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('zone_lk') * 100000 + rank(def),
        });
      });
    if (defFloor && getZone(alloc, 'lk')) {
      pushRow(defFloor, {
        rowId: 'floor_p__lk',
        zk: 'lk',
        menuBand: 'zone_lk',
        gTitle: '客餐廳',
        quoteSection: '客餐廳',
        sort: menuBandOrderKey('zone_lk') * 100000 + 800 + rank(defFloor),
      });
    }

    defs
      .filter(function (d) {
        return d.zoneScope === 'master' && !d.perFloor;
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'zone_master',
          gTitle: '主臥',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('zone_master') * 100000 + rank(def),
        });
      });
    if (defFloor && getZone(alloc, 'master')) {
      pushRow(defFloor, {
        rowId: 'floor_p__master',
        zk: 'master',
        menuBand: 'zone_master',
        gTitle: '主臥',
        quoteSection: '主臥',
        sort: menuBandOrderKey('zone_master') * 100000 + 800 + rank(defFloor),
      });
    }

    getSecondaryBeds(alloc).forEach(function (b, bedIdx) {
      defs
        .filter(function (d) {
          return d.perSecondary;
        })
        .sort(function (a, b2) {
          return rank(a) - rank(b2);
        })
        .forEach(function (def) {
          pushRow(def, {
            rowId: def.id + '__' + b.key,
            zk: b.key,
            label: b.name,
            menuBand: 'zone_bed',
            gTitle: '次臥 · ' + b.name,
            quoteSection: def.quoteSection,
            sort: menuBandOrderKey('zone_bed') * 100000 + bedIdx * 500 + rank(def),
          });
        });
      if (defFloor && getZone(alloc, b.key)) {
        pushRow(defFloor, {
          rowId: 'floor_p__' + b.key,
          zk: b.key,
          menuBand: 'zone_bed',
          gTitle: '次臥 · ' + b.name,
          quoteSection: '次臥 · ' + b.name,
          sort: menuBandOrderKey('zone_bed') * 100000 + bedIdx * 500 + 800 + rank(defFloor),
        });
      }
    });

    defs
      .filter(function (d) {
        if (d.perSecondary || d.perFloor) return false;
        if (d.id === 'ceiling' || d.id === 'wardrobe2') return false;
        return d.zoneScope === 'all' && d.menuBand === 'paint';
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'paint',
          gTitle: def.groupTitle || '油漆工程',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('paint') * 100000 + rank(def),
        });
      });

    defs
      .filter(function (d) {
        if (d.perSecondary || d.perFloor) return false;
        if (d.id === 'ceiling' || d.id === 'wardrobe2') return false;
        return d.zoneScope === 'all' && d.menuBand === 'mep';
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'mep',
          gTitle: def.groupTitle || '水電工程',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('mep') * 100000 + rank(def),
        });
      });

    defs
      .filter(function (d) {
        return d.zoneScope === 'all' && d.menuBand === 'protect';
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'protect',
          gTitle: def.groupTitle || '保護工程',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('protect') * 100000 + rank(def),
        });
      });

    defs
      .filter(function (d) {
        if (d.perSecondary || d.perFloor) return false;
        if (d.id === 'ceiling' || d.id === 'wardrobe2') return false;
        return d.zoneScope === 'all' && d.menuBand === 'finish';
      })
      .sort(function (a, b) {
        return rank(a) - rank(b);
      })
      .forEach(function (def) {
        pushRow(def, {
          menuBand: 'finish',
          gTitle: def.groupTitle || '收邊與細清',
          quoteSection: def.quoteSection,
          sort: menuBandOrderKey('finish') * 100000 + rank(def),
        });
      });

    rows.sort(function (a, b) {
      if (a.sort === b.sort) {
        if (a.rowId < b.rowId) return -1;
        if (a.rowId > b.rowId) return 1;
        return 0;
      }
      return a.sort - b.sort;
    });
    return rows;
  }

  function getQtyForDisplayRow(row, alloc, scheme) {
    var def = row.def;
    if (!def) return 0;
    if (def.id === 'touchup_clean') {
      return 1;
    }
    if (def.id === 'trim_molding') {
      return 1;
    }
    if (row.instanceZoneKey) {
      var r0 = scheme.rules && scheme.rules[def.id];
      if (!r0) return 0;
      return computeQtyFromRule(r0, def.id, alloc, { zoneKey: row.instanceZoneKey });
    }
    var r2 = scheme.rules && (scheme.rules[def.id] || (def.legacyId ? scheme.rules[def.legacyId] : null));
    if (!r2) return 0;
    return computeQtyFromRule(r2, def.id, alloc, null);
  }

  function qtyForItemWithScheme(itemId, alloc, scheme) {
    var r = scheme.rules && scheme.rules[itemId];
    if (r) return computeQtyFromRule(r, itemId, alloc, null);
    return 0;
  }

  function computeAllocation(totalPing, templateId, s) {
    var tpl = s.templates.filter(function (t) { return t.id === templateId; })[0] || s.templates[0];
    var balcony = s.balconyPing;
    var baths = (s.bathroomPings && s.bathroomPings.length >= tpl.baths)
      ? s.bathroomPings.slice(0, tpl.baths)
      : s.bathroomPings.slice();
    while (baths.length < tpl.baths) baths.push(1);
    var bathSum = baths.reduce(function (x, y) { return x + y; }, 0);
    var R = totalPing - balcony - bathSum;
    if (R <= 0) R = 0.1;
    var lkPct = randBetween(s.lkShareMin, s.lkShareMax);
    var lk = R * lkPct;
    var R_br = R - lk;
    var zones = [];
    zones.push({ key: 'balcony', name: '陽台', ping: balcony, kind: 'fixed' });
    baths.forEach(function (bp, i) {
      zones.push({ key: 'bath' + (i + 1), name: '浴廁' + (i + 1), ping: bp, kind: 'fixed' });
    });
    zones.push({ key: 'lk', name: '客廳+廚房', ping: round2(lk), kind: 'lk' });
    var beds = [];
    if (tpl.bedrooms === 2) {
      var b2 = R_br / (s.masterVsBed2 + 1);
      beds = [
        { key: 'master', name: '主臥', ping: round2(s.masterVsBed2 * b2) },
        { key: 'bed2', name: '次卧', ping: round2(b2) },
      ];
    } else if (tpl.bedrooms === 3) {
      var den = s.masterVsBed2 + 1 + s.bed3VsBed2;
      var b2a = R_br / den;
      beds = [
        { key: 'master', name: '主臥', ping: round2(s.masterVsBed2 * b2a) },
        { key: 'bed2', name: '次卧一', ping: round2(b2a) },
        { key: 'bed3', name: '次卧二', ping: round2(s.bed3VsBed2 * b2a) },
      ];
    } else if (tpl.bedrooms === 4) {
      var r4 = s.bed4VsBed2 != null ? s.bed4VsBed2 : 0.92;
      var d4 = s.masterVsBed2 + 1 + s.bed3VsBed2 + r4;
      var b2b = R_br / d4;
      beds = [
        { key: 'master', name: '主臥', ping: round2(s.masterVsBed2 * b2b) },
        { key: 'bed2', name: '次卧一', ping: round2(b2b) },
        { key: 'bed3', name: '次卧二', ping: round2(s.bed3VsBed2 * b2b) },
        { key: 'bed4', name: '次卧三', ping: round2(r4 * b2b) },
      ];
    }
    beds.forEach(function (b) {
      zones.push({ key: b.key, name: b.name, ping: b.ping, kind: 'bed' });
    });
    var sumCheck = zones.reduce(function (a, z) { return a + z.ping; }, 0);
    var drift = round2(totalPing - sumCheck);
    if (Math.abs(drift) >= 0.01) {
      var lkZ = zones.filter(function (z) { return z.key === 'lk'; })[0];
      if (lkZ) lkZ.ping = round2(lkZ.ping + drift);
    }
    zones.forEach(function (z) {
      z.dims = rectDimsCm(z.ping, s);
    });
    return { template: tpl, totalPing: totalPing, R: R, lkPct: lkPct, zones: zones, bathPingsUsed: baths };
  }

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function money(n) {
    return Math.round(Number(n) || 0).toLocaleString('zh-TW');
  }

  function parseGvizResponseText(text) {
    var a = text.indexOf('{');
    var b = text.lastIndexOf('}');
    if (a < 0 || b < a) {
      throw new Error('回應格式無法辨識（表須已「發佈到網路」或讓有連結者可檢視，並確認 ID）');
    }
    return JSON.parse(text.substring(a, b + 1));
  }

  function gvizGetCellString(ch) {
    if (!ch) return '';
    if (ch.f != null && String(ch.f) !== '') return String(ch.f);
    if (ch.v == null) return '';
    return typeof ch.v === 'number' && !isNaN(ch.v) ? String(ch.v) : String(ch.v);
  }

  function gvizRowsToNameUnitPriceMatrix(j) {
    var out = [];
    var rows = (j && j.table && j.table.rows) || [];
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i].c || [];
      if (!c.length) continue;
      out.push([gvizGetCellString(c[0]), gvizGetCellString(c[1]), gvizGetCellString(c[2])]);
    }
    return out;
  }

  function normNameKey(s) {
    return String(s == null ? '' : s)
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findRowUnitPriceByName(matrix, nameKey) {
    var n = normNameKey(nameKey);
    if (!n) return null;
    var r, a0, u, pnum;
    for (r = 0; r < matrix.length; r++) {
      a0 = normNameKey(matrix[r][0]);
      if (!a0) continue;
      pnum = parseFloat(String(matrix[r][2] || '').replace(/,/g, ''));
      if (isNaN(pnum) || pnum <= 0) continue;
      if (a0 === n) {
        u = normNameKey(matrix[r][1]) || '式';
        return { unit: u, price: pnum };
      }
    }
    for (r = 0; r < matrix.length; r++) {
      a0 = normNameKey(matrix[r][0]);
      if (!a0) continue;
      pnum = parseFloat(String(matrix[r][2] || '').replace(/,/g, ''));
      if (isNaN(pnum) || pnum <= 0) continue;
      if (a0.indexOf(n) >= 0 || n.indexOf(a0) >= 0) {
        u = normNameKey(matrix[r][1]) || '式';
        return { unit: u, price: pnum };
      }
    }
    return null;
  }

  function fetchGvizUrl(url) {
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(parseGvizResponseText);
  }

  function showPriceSyncBar(msg, isError) {
    var bar = document.getElementById('c_priceSyncBar');
    if (!bar) return;
    bar.textContent = msg;
    bar.className = isError
      ? 'no-print text-xs mt-2 py-1.5 px-2 rounded border border-red-200 bg-red-50/90 text-red-900'
      : 'no-print text-xs mt-2 py-1.5 px-2 rounded border border-amber-200 bg-amber-50/80 text-amber-950';
    bar.classList.remove('hidden');
    if (!isError) {
      setTimeout(function () {
        if (bar.textContent === msg) {
          bar.classList.add('hidden');
          bar.textContent = '';
        }
      }, 8000);
    }
  }

  function buildLegacyGvizUrl(sheetId, rawG) {
    var u =
      'https://docs.google.com/spreadsheets/d/' +
      encodeURIComponent(sheetId) +
      '/gviz/tq?tqx=out:json&headers=1&range=A1%3AB2000';
    if (rawG) {
      if (/^\d+$/.test(rawG)) u += '&gid=' + encodeURIComponent(rawG);
      else u += '&sheet=' + encodeURIComponent(rawG);
    }
    return u;
  }

  function buildTabGvizUrl(sheetId, tabName) {
    return (
      'https://docs.google.com/spreadsheets/d/' +
      encodeURIComponent(sheetId) +
      '/gviz/tq?tqx=out:json&headers=1&range=A1%3AD2000&sheet=' +
      encodeURIComponent(tabName)
    );
  }

  function parseLegacyIdPriceMapFromJ(j) {
    var map = {};
    var tab = j && j.table;
    if (!tab || !tab.rows || !tab.rows.length) return map;
    tab.rows.forEach(function (row) {
      var c = row.c;
      if (!c || c.length < 2) return;
      var c0 = c[0];
      if (!c0) return;
      var idCell = c0.v != null && c0.v !== '' ? c0.v : c0.f;
      if (idCell == null) return;
      var id2 = String(idCell).trim();
      if (!id2) return;
      var c1a = c[1];
      if (c1a == null) return;
      var pCell = c1a.v != null && c1a.v !== '' ? c1a.v : c1a.f;
      var pr = parseFloat(pCell);
      if (isNaN(pr)) return;
      map[id2] = pr;
    });
    return map;
  }

  function uniquePriceSheetTabNames() {
    var seen = Object.create(null);
    (state.settings.itemDefs || []).forEach(function (it) {
      if (it && it.priceSheetTab && (it.priceSheetItem || '').trim()) {
        seen[it.priceSheetTab.replace(/\s+/g, ' ').trim()] = true;
      }
    });
    return Object.keys(seen);
  }

  /** 是否有品項未填「工作表＋表內品項」而仍可能依內用 id／簡表對價（舊路徑）。預設菜單每筆皆已對表，故多為 false。 */
  function anyItemNeedsLegacyIdMap() {
    var defs = state.settings.itemDefs || [];
    for (var i = 0; i < defs.length; i++) {
      var it = defs[i];
      if (!it) continue;
      if (it.priceSheetTab && String(it.priceSheetItem || '').trim()) continue;
      return true;
    }
    return false;
  }

  function syncPricesFromGviz(options) {
    options = options || {};
    var silent = !!options.silent;
    var id = (state.settings.priceSheetGvizId || '').trim();
    if (!id) {
      if (!silent) alert('請先填寫試算表 ID（網址內 /d/ 之後 44 字元那段）');
      return Promise.resolve(0);
    }
    if (silent) {
      showPriceSyncBar('正在從試算表讀取最新單價…', false);
    }
    var runLegacy = anyItemNeedsLegacyIdMap();
    var legacyPromise = runLegacy
      ? fetchGvizUrl(buildLegacyGvizUrl(id, (state.settings.priceSheetGid || '').trim())).then(function (j) {
          var map = parseLegacyIdPriceMapFromJ(j);
          var nLegacy = 0;
          state.settings.itemDefs.forEach(function (it) {
            if (it && it.priceSheetTab && (it.priceSheetItem || '').trim()) return;
            if (Object.prototype.hasOwnProperty.call(map, it.id)) {
              it.price = map[it.id];
              nLegacy++;
            }
          });
          return nLegacy;
        })
      : Promise.resolve(0);

    return legacyPromise.then(function (nLegacy) {
        var tabNames = uniquePriceSheetTabNames();
        if (!tabNames.length) {
          return { nLegacy: nLegacy, nByTab: 0 };
        }
        var byTab = {};
        return tabNames
          .reduce(function (p, tabName) {
            return p.then(function () {
              return fetchGvizUrl(buildTabGvizUrl(id, tabName))
                .then(function (j) {
                  var matrix = gvizRowsToNameUnitPriceMatrix(j);
                  byTab[tabName] = matrix;
                  /* 快取 A 欄品項名稱 */
                  var names = matrix.map(function (r) { return r[0]; }).filter(function (n) { return n && n.trim(); });
                  state.settings.knownPriceItems = state.settings.knownPriceItems || {};
                  state.settings.knownPriceItems[tabName] = names;
                })
                .catch(function () {
                  byTab[tabName] = null;
                });
            });
          }, Promise.resolve())
          .then(function () {
            /* 將成功取得資料的工作頁名稱加入 knownPriceTabs */
            var known = state.settings.knownPriceTabs || [];
            Object.keys(byTab).forEach(function (tn) {
              if (byTab[tn] !== null && known.indexOf(tn) < 0) known.push(tn);
            });
            state.settings.knownPriceTabs = known;
            refreshTabDatalist();
            var nBy = 0;
            state.settings.itemDefs.forEach(function (it) {
              if (!it || !it.priceSheetTab || !(it.priceSheetItem || '').trim()) return;
              var tn = it.priceSheetTab.replace(/\s+/g, ' ').trim();
              var matrix = byTab[tn];
              if (!matrix) return;
              var found = findRowUnitPriceByName(matrix, it.priceSheetItem);
              if (!found) return;
              it.unit = found.unit;
              it.price = found.price;
              nBy++;
            });
            /* 同步 subItems 單價（工作頁空白時繼承父品項的工作頁） */
            state.settings.itemDefs.forEach(function (it) {
              if (!it || !Array.isArray(it.subItems)) return;
              it.subItems.forEach(function (sub) {
                var tn = ((sub.priceSheetTab || it.priceSheetTab || '').replace(/\s+/g, ' ')).trim();
                if (!tn || !(sub.priceSheetItem || '').trim()) return;
                var matrix = byTab[tn];
                if (!matrix) return;
                var found = findRowUnitPriceByName(matrix, sub.priceSheetItem);
                if (!found) return;
                sub.unit = found.unit;
                sub.price = found.price;
                nBy++;
              });
            });
            return { nLegacy: nLegacy, nByTab: nBy };
          });
      })
      .then(function (summary) {
        var nL = summary && typeof summary.nLegacy === 'number' ? summary.nLegacy : 0;
        var nB = summary && typeof summary.nByTab === 'number' ? summary.nByTab : 0;
        saveSettings();
        fillAdminForm();
        if (silent) {
          showPriceSyncBar(
            nL > 0
              ? '單價已與試算表同步（表頁＋品項 ' + nB + ' 筆；未填表之品項另以 id 簡表 ' + nL + ' 筆）。'
              : '單價已與試算表同步（各品項依表頁＋品項對照，共 ' + nB + ' 筆，以表為準）。',
            false
          );
        } else {
          alert(
            nL > 0
              ? '已從試算表帶入：表頁＋品項對照 ' + nB + ' 筆；另有未填表頁／品項者以 id 簡表 ' + nL + ' 筆。'
              : '已從試算表帶入：各品項依「表頁名＋表內品項」更新 ' + nB + ' 筆。'
          );
        }
        return nL + nB;
      })
      .catch(function (e) {
        var errText = e && e.message ? e.message : String(e);
        if (silent) {
          showPriceSyncBar('試算表讀取失敗，本場先沿用本機上次的單價。（' + errText + '）', true);
        } else {
          alert('讀取失敗：' + errText + '。可改用匯出 JSON 手動帶入或檢查表可公開讀。');
        }
        return 0;
      });
  }

  function loadPricesFromGviz() {
    readAdminForm();
    syncPricesFromGviz({ silent: false });
  }

  /**
   * 用 gviz API 平行試探候選工作頁名稱（gviz 有效時才能用，v3 Feeds API 已封鎖）。
   * 有 j.table 代表工作頁存在；無 table / status=error 代表不存在。
   */
  function fetchAndCacheSheetTabs(sheetId) {
    if (!sheetId) return Promise.resolve([]);
    /* 候選清單：內建常見名稱 ＋ 目前已知清單 ＋ itemDefs 內用到的 tab */
    var seed = ['木作工程', '油漆工程', '水電工程', '壁紙工程', '保護工程',
      '拆除工程', '泥作工程', '玻璃工程', '鐵件工程', '系統家具', '空調工程',
      '弱電工程', '木地板', '磁磚工程', '衛浴工程', '廚具工程', '窗簾工程',
      '燈具工程', '清潔工程'];
    var extra = (state.settings.knownPriceTabs || []).concat(uniquePriceSheetTabNames());
    extra.forEach(function (t) { if (t && seed.indexOf(t) < 0) seed.push(t); });
    /* 平行 gviz 請求：回傳有 table 的即存在 */
    return Promise.all(seed.map(function (tabName) {
      return fetchGvizUrl(buildTabGvizUrl(sheetId, tabName))
        .then(function (j) { return (j && j.table) ? tabName : null; })
        .catch(function () { return null; });
    })).then(function (results) {
      var found = results.filter(Boolean);
      if (found.length) {
        state.settings.knownPriceTabs = found;
        try { localStorage.setItem(TABS_CACHE_KEY, JSON.stringify(found)); } catch (e) { /* ignore */ }
        refreshTabDatalist();
        saveSettings();
      }
      return found;
    });
  }

  /** 用 state.settings.knownPriceTabs 刷新頁面上所有 select.item-ps-tab 的選項，保留目前選取值 */
  function refreshTabDatalist() {
    var tabs = (state.settings.knownPriceTabs && state.settings.knownPriceTabs.length)
      ? state.settings.knownPriceTabs
      : ['木作工程', '油漆工程', '水電工程', '壁紙工程', '保護工程'];
    document.querySelectorAll('select.item-ps-tab').forEach(function (sel) {
      var cur = sel.value;
      var inList = tabs.indexOf(cur) >= 0;
      sel.innerHTML = tabs.map(function (t) {
        return '<option value="' + escAttr(t) + '"' + (t === cur ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('');
      /* 保留原值（若不在新清單中，補一個選項） */
      if (cur && !inList) {
        sel.innerHTML += '<option value="' + escAttr(cur) + '" selected>' + esc(cur) + '</option>';
      }
    });
  }

  /** 依工作頁名稱，更新品項 datalist */
  function refreshItemDatalist(tabName) {
    var dl = document.getElementById('qr-item-datalist');
    if (!dl) return;
    var items = (tabName && state.settings.knownPriceItems && state.settings.knownPriceItems[tabName]) || [];
    dl.innerHTML = items.map(function (n) {
      return '<option value="' + escAttr(n) + '">';
    }).join('');
  }

  /** 子品項：新增到指定父品項 */
  window._qrAddSubItem = function (parentId) {
    readAdminForm();
    var parent = (state.settings.itemDefs || []).filter(function (d) { return d && d.id === parentId; })[0];
    if (!parent) return;
    if (!Array.isArray(parent.subItems)) parent.subItems = [];
    parent.subItems.push({
      id: 'sub_' + Date.now(),
      label: '新子品項',
      unit: '個',
      price: 0,
      defaultOn: false,
      defaultQty: 1,
      priceSheetTab: parent.priceSheetTab || '', /* 預設繼承父工作頁 */
      priceSheetItem: '',
      clientNote: '',
    });
    saveSettings();
    fillAdminForm();
  };

  /** 子品項：從指定父品項中移除 */
  window._qrRemoveSubItem = function (parentId, subId) {
    readAdminForm();
    var parent = (state.settings.itemDefs || []).filter(function (d) { return d && d.id === parentId; })[0];
    if (!parent || !Array.isArray(parent.subItems)) return;
    parent.subItems = parent.subItems.filter(function (s) { return s && s.id !== subId; });
    saveSettings();
    fillAdminForm();
  };

  /** 新增一筆空白品項到 itemDefs */
  function addNewItemDef() {
    readAdminForm();
    var newId = 'custom_' + Date.now();
    state.settings.itemDefs.push({
      id: newId, label: '新品項', unit: '式', price: 0,
      priceSheetTab: '', priceSheetItem: '', clientNote: '',
      menuBand: 'other', sortKey: 9000, displayRank: 9000,
      groupTitle: '其他', quoteSection: '其他',
      zoneScope: 'all', defaultOn: false, cabWood: false,
    });
    saveSettings();
    fillAdminForm();
    /* 捲動到新卡片 */
    var box = document.getElementById('adminItemPrices');
    if (box && box.lastElementChild) {
      box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function buildMenuRuleObject(ruleType, v, sca, zRaw, edgStr) {
    var z = (zRaw && String(zRaw).trim()) || undefined;
    var edg = edgStr === 'long' ? 'long' : 'short';
    var r;
    switch (ruleType) {
      case 'fixed_shaku':
        r = { type: 'fixed_shaku', value: isNaN(v) ? 0 : v };
        break;
      case 'floor_115':
        r = { type: 'floor_115' };
        break;
      case 'ceil_ping_lk_beds':
      case 'sum_ping_paints':
      case 'sum_ac_shaku_paint':
      case 'recess_15x':
      case 'mep_sockets_bed':
      case 'trim_placeholder':
      case 'touchup_from_settings':
        r = { type: ruleType };
        break;
      case 'shaku_edge_scaled': {
        r = { type: 'shaku_edge_scaled', edge: edg === 'long' ? 'long' : 'short' };
        if (z) r.zone = z;
        if (!isNaN(sca)) r.scale = sca;
        break;
      }
      case 'short_shaku_scaled':
      case 'short_shaku_full':
      case 'short_shaku_zone': {
        r = { type: ruleType, edge: edg === 'long' ? 'long' : 'short' };
        if (z) r.zone = z;
        if (ruleType === 'short_shaku_scaled' && !isNaN(sca)) r.scale = sca;
        break;
      }
      case 'avg_secondary_short_shaku_scaled': {
        r = { type: 'avg_secondary_short_shaku_scaled' };
        if (!isNaN(sca)) r.scale = sca;
        break;
      }
      default:
        return null;
    }
    return r;
  }

  function setDraftError(msg) {
    var d = document.getElementById('s_draftError');
    if (!d) return;
    if (msg) {
      d.textContent = msg;
      d.classList.remove('hidden');
    } else {
      d.textContent = '';
      d.classList.add('hidden');
    }
  }

  function parseAndApplyMenuDraft() {
    if (document.getElementById('s_schemeNameEdit') && getMenuScheme()) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    setDraftError('');
    var sc = getMenuScheme();
    if (!sc) {
      setDraftError('請先選一組要編輯的方案。');
      return;
    }
    var box = document.getElementById('s_menuDraft');
    if (!box) return;
    var mode = (document.querySelector('input[name="s_draftMode"]:checked') || {}).value || 'merge';
    var base = mode === 'replace' ? {} : Object.assign({}, sc.rules || {});
    var err = [];
    var nOk = 0;
    (box.value || '').split('\n').forEach(function (line, idx) {
      var s = String(line).trim();
      if (!s || s.charAt(0) === '#') return;
      var parts = s.split('|').map(function (x) { return String(x).trim(); });
      if (parts.length < 2) {
        err.push('第 ' + (idx + 1) + ' 行欄位不足，至少要「品項id|規則代碼」。');
        return;
      }
      var itemId = parts[0];
      var rt = parts[1];
      if (!itemId) {
        err.push('第 ' + (idx + 1) + ' 行缺品項 id。');
        return;
      }
      if (rt === 'remove' || rt === 'delete' || rt === '刪') {
        delete base[itemId];
        nOk++;
        return;
      }
      var pV = parts[2] === '' || parts[2] == null ? NaN : parseFloat(parts[2]);
      var pS = parts[3] === '' || parts[3] == null ? NaN : parseFloat(parts[3]);
      var pZ = parts[4] != null && parts[4] !== '' ? String(parts[4]).trim() : undefined;
      var pE = parts[5] != null && String(parts[5]).trim() !== '' ? String(parts[5]).trim() : 'short';
      var rule = buildMenuRuleObject(rt, pV, pS, pZ, pE);
      if (!rule) {
        err.push('第 ' + (idx + 1) + ' 行：無法辨識規則代碼「' + rt + '」');
        return;
      }
      base[itemId] = rule;
      nOk++;
    });
    if (mode === 'replace' && nOk === 0) {
      setDraftError((err.length ? '' : '整包取代需至少一筆有效內容（# 註解不算）。') + (err.length ? ' 尚有錯誤未處理。' : ''));
      return;
    }
    if (nOk === 0) {
      setDraftError('沒有成功讀到任何一筆（可檢查｜ 與規則代碼是否正確）。' + (err.length ? ' ' + err[0] : ''));
      return;
    }
    if (err.length) {
      setDraftError('部分行未套用：' + err.slice(0, 4).join('；') + (err.length > 4 ? '…' : ''));
    } else {
      setDraftError('');
    }
    sc.rules = base;
    syncSchemesJsonTextarea();
    saveSettings();
    state._preservedMenuScheme = sc.id;
    fillFormMenuSelects();
    renderRulesTable();
    loadFormFromCurrentItem();
    fillSchemeRadios();
    alert('已從速寫更新規則（' + nOk + ' 筆）。' + (err.length ? ' 部分行有誤，請看紅字。' : ' 已一併寫入 JSON 與本機。'));
  }

  function exportMenuDraftFromScheme() {
    if (getMenuScheme() && document.getElementById('s_schemeNameEdit')) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    setDraftError('');
    var sc = getMenuScheme();
    if (!sc) return;
    var rules = sc.rules || {};
    var defOrder = {};
    (state.settings.itemDefs || []).forEach(function (d, i) { defOrder[d.id] = i; });
    var keys = Object.keys(rules).sort(function (a, b) {
      return (defOrder[a] != null && defOrder[b] != null ? defOrder[a] - defOrder[b] : 0) || a.localeCompare(b);
    });
    var lines = [
      '# 欄位：品項id | 規則代碼 | 定值 | 比例(小數) | 空間 | 邊(長/短) — 每行 6 欄，5 條 |',
      '# 產生自：' + (sc.name || sc.id),
    ];
    keys.forEach(function (k) {
      var r = rules[k];
      if (!r || !r.type) return;
      var v0 = typeof r.value === 'number' && !isNaN(r.value) ? String(r.value) : '';
      var s0 = typeof r.scale === 'number' && !isNaN(r.scale) ? String(r.scale) : '';
      var z0 = r.zone != null && r.zone !== '' ? String(r.zone) : '';
      var e0 = '';
      if (r.type === 'shaku_edge_scaled' || r.type === 'short_shaku_scaled' || r.type === 'short_shaku_full' || r.type === 'short_shaku_zone') {
        e0 = r.edge === 'long' ? 'long' : 'short';
      }
      lines.push([k, r.type, v0, s0, z0, e0].join('|'));
    });
    var t = document.getElementById('s_menuDraft');
    if (t) t.value = lines.join('\n');
    setDraftError('');
  }

  function applyFormRuleToScheme() {
    if (document.getElementById('s_schemeNameEdit') && getMenuScheme()) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    var elI = document.getElementById('s_formItem');
    var elR = document.getElementById('s_formRule');
    if (!elI || !elR) return;
    var itemId = elI.value;
    var ruleType = elR.value;
    if (!itemId || !ruleType) {
      alert('請選品項與規則型別');
      return;
    }
    var sc = getMenuScheme();
    if (!sc) {
      alert('請先選要編輯的方案');
      return;
    }
    sc.rules = sc.rules || {};
    if (ruleType === 'remove') {
      delete sc.rules[itemId];
    } else {
      var z0 = (document.getElementById('s_formZone') && document.getElementById('s_formZone').value) || '';
      var zEx = (document.getElementById('s_formZoneExtra') && document.getElementById('s_formZoneExtra').value.trim()) || '';
      var z = (zEx || z0).trim() || undefined;
      var v2 = parseFloat(document.getElementById('s_formValue') && document.getElementById('s_formValue').value);
      var sca2 = parseFloat(document.getElementById('s_formScale') && document.getElementById('s_formScale').value);
      var edg2 = (document.getElementById('s_formEdge') && document.getElementById('s_formEdge').value) || 'short';
      var r = buildMenuRuleObject(ruleType, v2, sca2, z, edg2);
      if (!r) {
        alert('不支援的規則型別');
        return;
      }
      sc.rules[itemId] = r;
    }
    /* 將分類欄位（menuBand / displayRank / groupTitle / quoteSection）
       寫回 itemDefs（跨方案共用，不存在個別方案的 rules 內） */
    var mbW  = (document.getElementById('s_formMenuBand')     && document.getElementById('s_formMenuBand').value)                || 'other';
    var drW  = (document.getElementById('s_formDisplayRank')  && document.getElementById('s_formDisplayRank').value)             || '';
    var gtW  = (document.getElementById('s_formGroupTitle')   && document.getElementById('s_formGroupTitle').value.trim())       || '';
    var qsW  = (document.getElementById('s_formQuoteSection') && document.getElementById('s_formQuoteSection').value.trim())     || '';
    (state.settings.itemDefs || []).forEach(function (d) {
      if (!d || d.id !== itemId) return;
      d.menuBand = mbW || 'other';
      if (drW !== '' && !isNaN(parseFloat(drW))) d.displayRank = parseFloat(drW);
      else delete d.displayRank;
      if (gtW) d.groupTitle = gtW;
      if (qsW) d.quoteSection = qsW;
    });
    syncSchemesJsonTextarea();
    saveSettings();
    state._preservedMenuScheme = sc.id;
    fillFormMenuSelects();
    renderRulesTable();
    loadFormFromCurrentItem();
    fillSchemeRadios();
    alert('已寫入方案「' + (sc.name || sc.id) + '」並已儲存。');
  }

  function menuAddScheme() {
    if (getMenuScheme() && document.getElementById('s_schemeNameEdit')) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    var nid = 's_' + Date.now();
    var menus = state.settings.schemeMenus = state.settings.schemeMenus || [];
    menus.push({ id: nid, name: '新方案', rules: {} });
    syncSchemesJsonTextarea();
    saveSettings();
    state._preservedMenuScheme = nid;
    fillAdminForm();
    fillSchemeRadios();
  }

  function menuDuplicateScheme() {
    if (getMenuScheme() && document.getElementById('s_schemeNameEdit')) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    var cur = getMenuScheme();
    if (!cur) return;
    var nid = 's_' + Date.now();
    var c2 = JSON.parse(JSON.stringify(cur));
    c2.id = nid;
    c2.name = (cur.name || '方案') + '（複本）';
    c2.rules = c2.rules || {};
    (state.settings.schemeMenus = state.settings.schemeMenus || []).push(c2);
    syncSchemesJsonTextarea();
    saveSettings();
    state._preservedMenuScheme = nid;
    fillAdminForm();
    fillSchemeRadios();
  }

  function menuDeleteScheme() {
    var menus = state.settings.schemeMenus || [];
    if (menus.length < 2) {
      alert('至少保留一組方案，無法刪除。');
      return;
    }
    if (!confirm('確定刪除這一組方案？此動作可再用「匯出／還原」救回。')) return;
    if (getMenuScheme() && document.getElementById('s_schemeNameEdit')) {
      var nm0 = (document.getElementById('s_schemeNameEdit').value || '').trim();
      if (nm0) getMenuScheme().name = nm0;
    }
    syncSchemesJsonTextarea();
    readAdminForm();
    var id = (document.getElementById('s_menuScheme') && document.getElementById('s_menuScheme').value) || '';
    state.settings.schemeMenus = menus.filter(function (m) { return m.id !== id; });
    state._preservedMenuScheme = (state.settings.schemeMenus[0] && state.settings.schemeMenus[0].id) || 'simple';
    if (state.selectedSchemeId === id) state.selectedSchemeId = state._preservedMenuScheme;
    syncSchemesJsonTextarea();
    saveSettings();
    fillAdminForm();
    fillSchemeRadios();
  }
