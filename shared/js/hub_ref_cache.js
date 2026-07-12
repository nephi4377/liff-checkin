/**
 * 全站共用參考主檔快取 — 員工／案場／顧客名冊（非授權資料）
 * localStorage key: tanxin_ref_v1:{kind}；相容 legacy spa_hub_employees / spa_hub_projects
 */
var HubRefCache = (function () {
  var PREFIX = 'tanxin_ref_v1:';
  var LEGACY = {
    employees: 'spa_hub_employees',
    projects: 'spa_hub_projects'
  };
  var KINDS = {
    employees: { key: PREFIX + 'employees', days: 3, windowName: 'spaAllEmployees' },
    projects: { key: PREFIX + 'projects', days: 3, windowName: 'spaAllProjects' },
    customers: { key: PREFIX + 'customers', days: 1, windowName: null }
  };
  /** 與 AccountingListCache 單人 SWR 對齊：24 小時後背景重抓 */
  var SWR_MS = 24 * 60 * 60 * 1000;
  /** 顧客名冊 TTL（毫秒）— 24 小時 */
  var CUSTOMERS_TTL_MS = 24 * 60 * 60 * 1000;

  function memRoot() {
    if (!window.__tanxinRef) {
      window.__tanxinRef = { employees: null, projects: null, customers: null, ts: {} };
    }
    return window.__tanxinRef;
  }

  function cfg(kind) {
    return KINDS[kind] || null;
  }

  function daysFallback(legacyKey) {
    if (legacyKey === LEGACY.employees || legacyKey === LEGACY.projects) return 3;
    return 1;
  }

  function readWrapped(storageKey, legacyKey) {
    try {
      var raw = localStorage.getItem(storageKey);
      var fromLegacy = false;
      if (!raw && legacyKey) {
        raw = localStorage.getItem(legacyKey);
        fromLegacy = !!raw;
      }
      if (!raw) return null;
      var cache = JSON.parse(raw);
      if (Array.isArray(cache)) {
        var migrated = { data: cache, expires: Date.now() + daysFallback(legacyKey) * 86400000, savedAt: Date.now() };
        try { localStorage.setItem(storageKey, JSON.stringify(migrated)); } catch (e3) {}
        return migrated;
      }
      if (!cache || cache.expires < Date.now()) {
        try { localStorage.removeItem(storageKey); } catch (e) {}
        return null;
      }
      if (fromLegacy && legacyKey) {
        try { localStorage.setItem(storageKey, raw); } catch (e2) {}
      }
      return cache;
    } catch (e) {
      return null;
    }
  }

  function writeWrapped(storageKey, data, days) {
    var now = Date.now();
    var cache = { data: data, expires: now + days * 24 * 60 * 60 * 1000, savedAt: now };
    try {
      localStorage.setItem(storageKey, JSON.stringify(cache));
    } catch (e) {}
    return cache;
  }

  function publishWindow(kind, data) {
    var c = cfg(kind);
    if (!c || !c.windowName) return;
    try { window[c.windowName] = data; } catch (e) {}
  }

  function get(kind) {
    var c = cfg(kind);
    if (!c) return null;
    var m = memRoot();
    if (Array.isArray(m[kind])) return m[kind];
    var wrapped = readWrapped(c.key, LEGACY[kind]);
    if (!wrapped) return null;
    m[kind] = wrapped.data;
    m.ts[kind] = wrapped.savedAt || wrapped.expires - c.days * 24 * 60 * 60 * 1000;
    return wrapped.data;
  }

  function set(kind, data, opts) {
    opts = opts || {};
    var c = cfg(kind);
    if (!c || data == null) return;
    var days = opts.days != null ? opts.days : c.days;
    var m = memRoot();
    m[kind] = data;
    m.ts[kind] = Date.now();
    writeWrapped(c.key, data, days);
    publishWindow(kind, data);
    try {
      window.dispatchEvent(new CustomEvent('tanxin-ref-updated', { detail: { kind: kind } }));
    } catch (e) {}
  }

  function readFromParent(kind) {
    var c = cfg(kind);
    if (!c || !c.windowName) return null;
    try {
      if (!window.parent || window.parent === window) return null;
      var data = window.parent[c.windowName];
      return Array.isArray(data) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function read(kind, preferParent) {
    if (preferParent !== false) {
      var fromParent = readFromParent(kind);
      if (fromParent && fromParent.length) return fromParent;
    }
    return get(kind) || [];
  }

  function savedAt(kind) {
    var m = memRoot();
    if (m.ts[kind]) return m.ts[kind];
    var c = cfg(kind);
    if (!c) return 0;
    var wrapped = readWrapped(c.key, LEGACY[kind]);
    return wrapped ? (wrapped.savedAt || 0) : 0;
  }

  function isStale(kind) {
    var ts = savedAt(kind);
    return !ts || Date.now() - ts > SWR_MS;
  }

  function invalidate(kind) {
    var c = cfg(kind);
    if (!c) return;
    var m = memRoot();
    m[kind] = null;
    delete m.ts[kind];
    try {
      localStorage.removeItem(c.key);
      if (LEGACY[kind]) localStorage.removeItem(LEGACY[kind]);
    } catch (e) {}
  }

  function sourceLabel(kind) {
    if (readFromParent(kind)) return 'parent';
    if (get(kind)) return 'hub_ref_cache';
    return 'none';
  }

  function storageKey(kind) {
    var c = cfg(kind);
    return c ? c.key : null;
  }

  return {
    PREFIX: PREFIX,
    LEGACY: LEGACY,
    KINDS: KINDS,
    SWR_MS: SWR_MS,
    CUSTOMERS_TTL_MS: CUSTOMERS_TTL_MS,
    get: get,
    set: set,
    read: read,
    readFromParent: readFromParent,
    isStale: isStale,
    savedAt: savedAt,
    invalidate: invalidate,
    sourceLabel: sourceLabel,
    storageKey: storageKey
  };
})();
