/**
 * 會計列表快取 — 整包列表一次取回；CRUD 後 patch／invalidate；手動重新載入仍有效
 *
 * 現行預設 MULTI_USER：列表 90 秒、SWR 30 秒 — 多人同審／同匯時較不易看舊單。
 * 單人長 TTL（3 天）保留為 SINGLE_USER，需要時再改 DEFAULT。
 *
 * searchMasterList — 顧客列表／LINE 聯絡人等主檔搜尋：localStorage 24h，先本地篩選，無結果或過期才打 GAS。
 */
var AccountingListCache = (function () {
  var PREFIX = 'tanxin_acct_list_v1:';
  var MASTER_PREFIX = 'tanxin_acct_master_list_v1:';
  /** 顧客列表／LINE 聯絡人名冊（使用者指定 24 小時） */
  var MASTER_LIST_TTL_MS = 24 * 60 * 60 * 1000;
  /** 多人協作（現行預設） */
  var MULTI_USER = { TTL_MS: 90000, SWR_MS: 30000 };
  /** 單人長暫存（可改回 DEFAULT） */
  var SINGLE_USER = { TTL_MS: 3 * 24 * 60 * 60 * 1000, SWR_MS: 24 * 60 * 60 * 1000 };
  var DEFAULT_TTL_MS = MULTI_USER.TTL_MS;
  var SWR_MS = MULTI_USER.SWR_MS;
  var _mem = {};
  var _inflight = {};

  function userId(session) {
    return (session && session.auth && session.auth.user_id) || 'anon';
  }

  function storageKey(session, listKey) {
    return PREFIX + userId(session) + ':' + listKey;
  }

  function isFresh(wrapped, ttlMs) {
    return wrapped && wrapped.data != null && (Date.now() - wrapped.ts <= ttlMs);
  }

  function readRaw(key, ttlMs, storage) {
    storage = storage || 'session';
    if (_mem[key] && isFresh(_mem[key], ttlMs)) return _mem[key];
    try {
      var store = storage === 'local' ? localStorage : sessionStorage;
      var raw = store.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!isFresh(parsed, ttlMs)) return null;
      _mem[key] = parsed;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function write(key, data, storage) {
    storage = storage || 'session';
    var wrapped = { ts: Date.now(), data: data };
    _mem[key] = wrapped;
    try {
      var store = storage === 'local' ? localStorage : sessionStorage;
      store.setItem(key, JSON.stringify(wrapped));
    } catch (e) {}
  }

  function clearKey(key) {
    delete _mem[key];
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch (e) {}
  }

  function isGlobalRefList(listKey) {
    return listKey === 'official_customer' && typeof HubRefCache !== 'undefined';
  }

  function masterKey(session, listKey) {
    if (isGlobalRefList(listKey)) return HubRefCache.storageKey('customers');
    return MASTER_PREFIX + userId(session) + ':' + listKey;
  }

  function readMasterRef(listKey, ttlMs) {
    if (listKey === 'official_customer' && typeof HubRefCache !== 'undefined') {
      var data = HubRefCache.get('customers');
      if (!data) return null;
      var ts = HubRefCache.savedAt('customers');
      if (!ts || Date.now() - ts > ttlMs) return null;
      return { ts: ts, data: data };
    }
    return null;
  }

  function writeMasterRef(listKey, items) {
    if (listKey === 'official_customer' && typeof HubRefCache !== 'undefined') {
      HubRefCache.set('customers', items);
      return;
    }
  }

  function invalidateMasterRef(listKey) {
    if (listKey === 'official_customer' && typeof HubRefCache !== 'undefined') {
      HubRefCache.invalidate('customers');
    }
  }

  function filterItemsByKeyword(items, keyword, fields) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return items.slice();
    fields = fields || ['name', 'line_id', 'project_codes', 'project_no'];
    return items.filter(function (it) {
      var hay = fields.map(function (f) { return String(it[f] || ''); }).join(' ').toLowerCase();
      return hay.indexOf(kw) >= 0;
    });
  }

  function backgroundRevalidate(key, fetchFn, ttlMs) {
    if (_inflight[key]) return;
    _inflight[key] = Promise.resolve(fetchFn()).then(function (data) {
      write(key, data);
      return data;
    }).catch(function () {
      return null;
    }).finally(function () {
      delete _inflight[key];
    });
  }

  return {
    SINGLE_USER: SINGLE_USER,
    MULTI_USER: MULTI_USER,
    TTL_MS: DEFAULT_TTL_MS,
    SWR_MS: SWR_MS,
    MASTER_LIST_TTL_MS: MASTER_LIST_TTL_MS,
    MASTER_KEYS: {
      official_customer: 'official_customer',
      line_contact: 'line_contact',
      portal_project: 'portal_project'
    },
    PORTAL_DATA_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    key: storageKey,
    masterKey: masterKey,
    load: async function (session, listKey, fetchFn, opts) {
      opts = opts || {};
      var ttl = opts.ttlMs || DEFAULT_TTL_MS;
      var swr = opts.swrMs != null ? opts.swrMs : SWR_MS;
      var force = !!opts.force;
      var key = storageKey(session, listKey);

      if (!force) {
        var cached = readRaw(key, ttl);
        if (cached) {
          var age = Date.now() - cached.ts;
          if (age > swr) backgroundRevalidate(key, fetchFn, ttl);
          return cached.data;
        }
      }

      if (_inflight[key]) return _inflight[key];

      _inflight[key] = Promise.resolve(fetchFn()).then(function (data) {
        write(key, data);
        return data;
      }).finally(function () {
        delete _inflight[key];
      });
      return _inflight[key];
    },
    patch: function (session, listKey, patchFn, ttlMs) {
      var key = storageKey(session, listKey);
      var cached = readRaw(key, ttlMs || DEFAULT_TTL_MS * 4);
      if (!cached) return false;
      var next = cached.data;
      if (typeof patchFn === 'function') patchFn(next);
      write(key, next);
      return true;
    },
    invalidate: function (session, listKey) {
      clearKey(storageKey(session, listKey));
    },
    invalidatePrefix: function (session, prefix) {
      var uid = userId(session);
      var needle = PREFIX + uid + ':' + prefix;
      Object.keys(_mem).forEach(function (k) {
        if (k.indexOf(needle) === 0) clearKey(k);
      });
      try {
        for (var i = sessionStorage.length - 1; i >= 0; i--) {
          var k = sessionStorage.key(i);
          if (k && k.indexOf(needle) === 0) sessionStorage.removeItem(k);
        }
      } catch (e) {}
    },
    clear: function (session, listKey) {
      clearKey(storageKey(session, listKey));
    },
    /**
     * 主檔名冊搜尋：快取整包 → 本地 keyword 篩選；無命中或過期才 refetch。
     * @param {object} opts.filterFields — 參與比對的 item 欄位
     * @param {number} opts.limit — 回傳筆數上限
     */
    searchMasterList: async function (session, listKey, keyword, fetchAllFn, opts) {
      opts = opts || {};
      var ttl = opts.ttlMs || MASTER_LIST_TTL_MS;
      var limit = opts.limit || 20;
      var fields = opts.filterFields;
      var force = !!opts.force;
      var key = masterKey(session, listKey);
      var kw = String(keyword || '').trim();

      function pick(items) {
        return filterItemsByKeyword(items, kw, fields).slice(0, limit);
      }

      if (!force) {
        var cached = isGlobalRefList(listKey)
          ? readMasterRef(listKey, ttl)
          : readRaw(key, ttl, 'local');
        if (!cached && isGlobalRefList(listKey)) {
          var legacyKey = MASTER_PREFIX + userId(session) + ':' + listKey;
          var legacy = readRaw(legacyKey, ttl, 'local');
          if (legacy && legacy.data) {
            writeMasterRef(listKey, legacy.data);
            cached = legacy;
          }
        }
        if (cached && cached.data) {
          var hits = pick(cached.data);
          if (hits.length || !kw) return hits;
        }
      }

      if (_inflight[key]) {
        var inflightItems = await _inflight[key];
        return pick(inflightItems || []);
      }

      _inflight[key] = Promise.resolve(fetchAllFn()).then(function (res) {
        var items = (res && res.items) ? res.items : (Array.isArray(res) ? res : []);
        if (isGlobalRefList(listKey)) writeMasterRef(listKey, items);
        else write(key, items, 'local');
        return items;
      }).catch(function () {
        return [];
      }).finally(function () {
        delete _inflight[key];
      });

      var freshItems = await _inflight[key];
      return pick(freshItems || []);
    },
    invalidateMasterList: function (session, listKey) {
      invalidateMasterRef(listKey);
      clearKey(masterKey(session, listKey));
    },
    /** 客戶 portal 案號資料 — 7 天快取 + 背景重讀 */
    loadPortalData: async function (session, projectNo, fetchFn, opts) {
      opts = opts || {};
      var ttl = opts.ttlMs || 7 * 24 * 60 * 60 * 1000;
      var swr = opts.swrMs != null ? opts.swrMs : 24 * 60 * 60 * 1000;
      var force = !!opts.force;
      var uid = userId(session);
      var pno = String(projectNo || '').trim();
      var key = MASTER_PREFIX + uid + ':portal:' + pno;
      if (!force) {
        var cached = readRaw(key, ttl, 'local');
        if (cached) {
          if (Date.now() - cached.ts > swr) {
            Promise.resolve(fetchFn()).then(function (data) {
              write(key, data, 'local');
            }).catch(function () {});
          }
          return cached.data;
        }
      }
      var data = await Promise.resolve(fetchFn());
      write(key, data, 'local');
      return data;
    },
    invalidatePortalData: function (session, projectNo) {
      var key = MASTER_PREFIX + userId(session) + ':portal:' + String(projectNo || '').trim();
      clearKey(key);
    }
  };
})();
