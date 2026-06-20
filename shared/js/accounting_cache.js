/**
 * 會計系統共用快取 — 進入 index 時 bootstrap 一次，子頁讀快取
 */
var AccountingCache = (function () {
  var STORAGE_KEY = 'tanxin_accounting_bootstrap_v1';

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

  function refreshInBackground(session) {
    if (!session || typeof AccountingApi === 'undefined') return;
    var p;
    if (typeof AccountingApi.bootstrap === 'function') {
      p = AccountingApi.bootstrap(session);
    } else if (typeof AccountingApi.post === 'function') {
      p = AccountingApi.post({
        action: 'accounting_bootstrap',
        auth: AccountingApi.buildAuth ? AccountingApi.buildAuth(session) : { dev_bypass: !!session.devBypass }
      });
    } else {
      return;
    }
    p.then(function (res) {
      if (res && res.success && res.bootstrap) write(session, res.bootstrap);
    }).catch(function () {});
  }

  return {
    clear: function (session) {
      try { sessionStorage.removeItem(storageKey(session)); } catch (e) {}
    },
    get: function (session) {
      return read(session);
    },
    load: async function (session, force) {
      if (!session) throw new Error('需要登入');
      if (!force) {
        var cached = read(session);
        if (cached) {
          mergeEnums(cached);
          refreshInBackground(session);
          return cached;
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
    patchVendor: function (session, vendor) {
      var c = read(session);
      if (!c || !c.masters || !c.masters.vendors) return;
      var list = c.masters.vendors;
      var idx = list.findIndex(function (v) { return v.vendor_id === vendor.vendor_id; });
      if (idx >= 0) list[idx] = vendor;
      else list.unshift(vendor);
      write(session, c);
    },
    vendorLineBindings: function (session, vendorId) {
      var c = read(session);
      var all = (c && c.masters && c.masters.vendor_line_bindings) || [];
      return all.filter(function (b) { return String(b.vendor_id) === String(vendorId); });
    },
    patchVendorLineBinding: function (session, binding) {
      var c = read(session);
      if (!c || !c.masters) return;
      c.masters.vendor_line_bindings = c.masters.vendor_line_bindings || [];
      var list = c.masters.vendor_line_bindings;
      var idx = list.findIndex(function (b) { return b.binding_id === binding.binding_id; });
      if (idx >= 0) list[idx] = binding;
      else list.unshift(binding);
      write(session, c);
    },
    removeVendor: function (session, vendorId) {
      var c = read(session);
      if (!c || !c.masters) return;
      c.masters.vendors = (c.masters.vendors || []).filter(function (v) {
        return v.vendor_id !== vendorId;
      });
      write(session, c);
    }
  };
})();
