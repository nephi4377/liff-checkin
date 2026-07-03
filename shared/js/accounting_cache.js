/**
 * 會計系統共用快取 — bootstrap 進 sessionStorage；CRUD 成功 patch 快取（安全時）
 */
var AccountingCache = (function () {
  var STORAGE_KEY = 'tanxin_accounting_bootstrap_v1';
  var BOOTSTRAP_TIMEOUT_MS = 120000;
  var _mem = {};
  var _inflight = {};

  /** 寫入 bootstrap.masters 的 entity；CRUD 後優先 patch，無法 patch 才整包清除 */
  var BOOTSTRAP_INVALIDATE_ENTITIES = {
    vendor: true,
    payee: true,
    category: true,
    order_project_map: true,
    vendor_line_binding: true
  };

  var ENTITY_MASTER_KEY = {
    vendor: 'vendors',
    payee: 'payees',
    category: 'categories',
    order_project_map: 'order_project_map',
    vendor_line_binding: 'vendor_line_bindings'
  };

  var ENTITY_ID_FIELD = {
    vendor: 'vendor_id',
    payee: 'payee_id',
    category: 'category_id',
    order_project_map: 'order_no',
    vendor_line_binding: 'binding_id'
  };

  function ttlMs() {
    return (typeof AccountingMasterData !== 'undefined' && AccountingMasterData.TTL_MS) || 300000;
  }

  function storageKey(session) {
    var uid = (session && session.auth && session.auth.user_id) || 'anon';
    return STORAGE_KEY + ':' + uid;
  }

  function isFresh(wrapped) {
    return wrapped && wrapped.data && (Date.now() - wrapped.ts <= ttlMs());
  }

  function read(session) {
    var key = storageKey(session);
    if (_mem[key] && isFresh(_mem[key])) return _mem[key].data;
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!isFresh(parsed)) return null;
      _mem[key] = parsed;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function write(session, data) {
    var key = storageKey(session);
    var wrapped = { ts: Date.now(), data: data };
    _mem[key] = wrapped;
    try {
      sessionStorage.setItem(key, JSON.stringify(wrapped));
    } catch (e) {
      /* sessionStorage 滿了仍保留本分頁記憶體快取 */
    }
  }

  function mergeEnums(data) {
    if (!data || !data.enums) return data;
    var e = data.enums;
    AccountingMasterData.vendor_trade_categories = e.vendor_trade_categories || AccountingMasterData.vendor_trade_categories;
    AccountingMasterData.vendor_cost_types = e.vendor_cost_types || AccountingMasterData.vendor_cost_types;
    AccountingMasterData.vendor_coop_statuses = e.vendor_coop_statuses || AccountingMasterData.vendor_coop_statuses;
    AccountingMasterData.vendor_payment_terms_presets = e.vendor_payment_terms_presets || AccountingMasterData.vendor_payment_terms_presets;
    AccountingMasterData.vendor_service_area_presets = e.vendor_service_area_presets || AccountingMasterData.vendor_service_area_presets;
    return data;
  }

  function clear(session) {
    var key = storageKey(session);
    delete _mem[key];
    try { sessionStorage.removeItem(key); } catch (e) {}
  }

  function upsertMasterRow_(masters, masterKey, idField, row) {
    if (!masters || !masterKey || !row) return false;
    if (!masters[masterKey]) masters[masterKey] = [];
    var list = masters[masterKey];
    var id = row[idField];
    if (id == null || id === '') return false;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i][idField]) === String(id)) { idx = i; break; }
    }
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], row);
    else list.push(row);
    return true;
  }

  function patchMaster(session, entity, row) {
    if (!entity || !row || !BOOTSTRAP_INVALIDATE_ENTITIES[entity]) return false;
    var data = read(session);
    if (!data) return false;
    var masterKey = ENTITY_MASTER_KEY[entity];
    var idField = ENTITY_ID_FIELD[entity];
    if (!masterKey || !idField) return false;
    if (!data.masters) data.masters = {};
    if (!upsertMasterRow_(data.masters, masterKey, idField, row)) return false;
    write(session, data);
    return true;
  }

  function patchVendorFields(session, vendorId, fields) {
    if (!vendorId || !fields) return false;
    var data = read(session);
    if (!data || !data.masters || !data.masters.vendors) return false;
    var list = data.masters.vendors;
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].vendor_id) === String(vendorId)) { idx = i; break; }
    }
    if (idx < 0) return false;
    list[idx] = Object.assign({}, list[idx], fields);
    write(session, data);
    return true;
  }

  function afterCrudSuccess(session, entity, res) {
    if (!entity || !BOOTSTRAP_INVALIDATE_ENTITIES[entity]) return;
    var row = res && res.data;
    if (row && patchMaster(session, entity, row)) return;
    clear(session);
  }

  function peekBootstrapRaw() {
    try {
      var prefix = STORAGE_KEY + ':';
      for (var i = 0; i < sessionStorage.length; i++) {
        var key = sessionStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        var parsed = JSON.parse(sessionStorage.getItem(key));
        if (!isFresh(parsed)) continue;
        return parsed.data;
      }
    } catch (e) {}
    return null;
  }

  function mastersFromPeek(entity) {
    var b = peekBootstrapRaw();
    return (b && b.masters && b.masters[entity]) || [];
  }

  return {
    clear: clear,
    patchMaster: patchMaster,
    patchVendorFields: patchVendorFields,
    afterCrudSuccess: afterCrudSuccess,
    get: function (session) {
      return read(session);
    },
    peekBootstrap: function () {
      return peekBootstrapRaw();
    },
    peekVendors: function () {
      return mastersFromPeek('vendors');
    },
    peekPayees: function () {
      return mastersFromPeek('payees');
    },
    load: async function (session, force) {
      if (!session) throw new Error('需要登入');
      if (!force) {
        var cached = read(session);
        if (cached) return mergeEnums(cached);
      }
      var key = storageKey(session);
      if (_inflight[key]) return _inflight[key];

      _inflight[key] = (async function () {
        if (typeof AccountingApi === 'undefined') {
          throw new Error('AccountingApi 未載入，請確認 accounting_api.js 已引入');
        }
        var res;
        if (typeof AccountingApi.bootstrap === 'function') {
          res = await AccountingApi.bootstrap(session, BOOTSTRAP_TIMEOUT_MS);
        } else if (typeof AccountingApi.post === 'function') {
          res = await AccountingApi.post({
            action: 'accounting_bootstrap',
            auth: AccountingApi.buildAuth ? AccountingApi.buildAuth(session) : { dev_bypass: !!session.devBypass }
          }, BOOTSTRAP_TIMEOUT_MS);
        } else {
          throw new Error('AccountingApi 版本過舊，請強制重新整理（Ctrl+F5）');
        }
        if (!res.success || !res.bootstrap) throw new Error(res.message || '載入主檔失敗');
        write(session, res.bootstrap);
        return mergeEnums(res.bootstrap);
      })();

      try {
        return await _inflight[key];
      } finally {
        delete _inflight[key];
      }
    },
    vendors: function (session) {
      var c = read(session);
      return (c && c.masters && c.masters.vendors) || [];
    },
    payees: function (session) {
      var c = read(session);
      return (c && c.masters && c.masters.payees) || [];
    },
    enums: function (session) {
      var c = read(session);
      return (c && c.enums) || AccountingMasterData;
    },
    vendorLineBindings: function (session, vendorId) {
      var c = read(session);
      var all = (c && c.masters && c.masters.vendor_line_bindings) || [];
      return all.filter(function (b) { return String(b.vendor_id) === String(vendorId); });
    }
  };
})();
