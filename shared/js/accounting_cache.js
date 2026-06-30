/**
 * 會計系統共用快取 — bootstrap 進 sessionStorage；CRUD 成功清除，下次 load 重抓
 */
var AccountingCache = (function () {
  var STORAGE_KEY = 'tanxin_accounting_bootstrap_v1';
  var BOOTSTRAP_TIMEOUT_MS = 120000;
  var _mem = {};
  var _inflight = {};

  /** 寫入 bootstrap.masters 的 entity；CRUD 後整包清除。見 SPEC/18 §6.1.1 */
  var BOOTSTRAP_INVALIDATE_ENTITIES = {
    vendor: true,
    payee: true,
    category: true,
    order_project_map: true,
    vendor_line_binding: true
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

  function afterCrudSuccess(session, entity) {
    if (!entity || !BOOTSTRAP_INVALIDATE_ENTITIES[entity]) return;
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
