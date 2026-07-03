/**
 * 會計列表快取 — 整包列表一次取回；CRUD 後 patch／invalidate；手動重新載入仍有效
 *
 * 單人使用：長 TTL（與 bootstrap 同為 3 天），SWR 24 小時 — 靠 CRUD patch 維新，少打背景 API。
 * 多人協作時：改回 MULTI_USER（列表 90 秒、SWR 30 秒），他人改動較快反映。
 */
var AccountingListCache = (function () {
  var PREFIX = 'tanxin_acct_list_v1:';
  /** 多人協作建議值（改 DEFAULT 時參考） */
  var MULTI_USER = { TTL_MS: 90000, SWR_MS: 30000 };
  /** 單人使用（現行預設） */
  var SINGLE_USER = { TTL_MS: 3 * 24 * 60 * 60 * 1000, SWR_MS: 24 * 60 * 60 * 1000 };
  var DEFAULT_TTL_MS = SINGLE_USER.TTL_MS;
  var SWR_MS = SINGLE_USER.SWR_MS;
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

  function readRaw(key, ttlMs) {
    if (_mem[key] && isFresh(_mem[key], ttlMs)) return _mem[key];
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!isFresh(parsed, ttlMs)) return null;
      _mem[key] = parsed;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function write(key, data) {
    var wrapped = { ts: Date.now(), data: data };
    _mem[key] = wrapped;
    try {
      sessionStorage.setItem(key, JSON.stringify(wrapped));
    } catch (e) {}
  }

  function clearKey(key) {
    delete _mem[key];
    try { sessionStorage.removeItem(key); } catch (e) {}
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
    key: storageKey,
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
    }
  };
})();
