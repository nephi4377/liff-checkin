/**
 * 會計系統共用快取 — bootstrap 進 sessionStorage；CRUD 成功清除，下次 load 重抓
 */
var AccountingCache = (function () {
  var STORAGE_KEY = 'tanxin_accounting_bootstrap_v1';

  /** 寫入 bootstrap.masters 的 entity；CRUD 後整包清除。見 SPEC/18 §6.1.1 */
  var BOOTSTRAP_INVALIDATE_ENTITIES = {
    vendor: true,
    payee: true,
    category: true,
    order_project_map: true,
    vendor_line_binding: true
  };

  function storageKey(session) {
    var uid = (session && session.auth && session.auth.user_id) || 'anon';
    return STORAGE_KEY + ':' + uid;
  }

  function read(session) {
    try {
      var raw = sessionStorage.getItem(storageKey(session));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      if (Date.now() - parsed.ts > (AccountingMasterData.TTL_MS || 300000)) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function write(session, data) {
    try {
      sessionStorage.setItem(storageKey(session), JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
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
    try { sessionStorage.removeItem(storageKey(session)); } catch (e) {}
  }

  function afterCrudSuccess(session, entity) {
    if (!entity || !BOOTSTRAP_INVALIDATE_ENTITIES[entity]) return;
    clear(session);
  }

  return {
    clear: clear,
    afterCrudSuccess: afterCrudSuccess,
    get: function (session) {
      return read(session);
    },
    load: async function (session, force) {
      if (!session) throw new Error('需要登入');
      if (!force) {
        var cached = read(session);
        if (cached) {
          return mergeEnums(cached);
        }
      }
      if (typeof AccountingApi === 'undefined') {
        throw new Error('AccountingApi 未載入，請確認 accounting_api.js 已引入');
      }
      var res;
      if (typeof AccountingApi.bootstrap === 'function') {
        res = await AccountingApi.bootstrap(session);
      } else if (typeof AccountingApi.post === 'function') {
        res = await AccountingApi.post({
          action: 'accounting_bootstrap',
          auth: AccountingApi.buildAuth ? AccountingApi.buildAuth(session) : { dev_bypass: !!session.devBypass }
        });
      } else {
        throw new Error('AccountingApi 版本過舊，請強制重新整理（Ctrl+F5）');
      }
      if (!res.success || !res.bootstrap) throw new Error(res.message || '載入主檔失敗');
      write(session, res.bootstrap);
      return mergeEnums(res.bootstrap);
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
