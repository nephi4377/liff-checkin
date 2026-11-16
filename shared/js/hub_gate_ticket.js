/**
 * hub_gate_ticket：主控台（Hub）身分只帶 user_id 呼叫 accounting-gas 時附的短效憑證。
 *
 * - 用 LIFF id_token 向 project-console POST action=accounting_hub_gate_ticket 換票（Backend_GAS
 *   project-console/AccountingHubGateTicket.js；後端 TTL 120 秒、上限 600 秒）。
 * - 票依 ticket 內 exp 快取在 sessionStorage（同分頁的主控台與 iframe 共用），到期前 20 秒才換新。
 * - 取不到票時照常送出請求（accounting-gas HubUserIdGate audit 模式只記 WARN），console 留
 *   [HubGateTicket][WARN]；失敗後退避 60 秒，避免每個請求都卡在問 token／取票。
 *
 * 瀏覽器：window.HubGateTicket（預設 client）；Node 測試：module.exports（含 create）。
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = lib;
  if (root && !root.HubGateTicket) root.HubGateTicket = lib;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /** 與 shared/js/config.js GAS_WEB_APP_URL、accounting_api.js PROJECT_CONSOLE_API 相同 */
  var DEFAULT_CONSOLE_API = 'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';
  var TICKET_ACTION = 'accounting_hub_gate_ticket';
  var CACHE_KEY = 'tanxin_hub_gate_ticket_v1';
  var FAIL_KEY = 'tanxin_hub_gate_ticket_fail_v1';
  /** accounting_api.js SESSION_TOKEN_KEY：LIFF 模式會計頁存的 id_token */
  var LIFF_TOKEN_STORAGE_KEY = 'tanxin_accounting_liff_token_v1';
  var REFRESH_BEFORE_EXP_MS = 20 * 1000;
  var DEFAULT_TICKET_LIFE_MS = 120 * 1000;
  /** 後端 HUB_GATE_TICKET_MAX_TTL_SEC_ */
  var MAX_TICKET_LIFE_MS = 600 * 1000;
  var LIFF_TOKEN_SKEW_SEC = 60;
  var FAIL_BACKOFF_MS = 60 * 1000;
  var FETCH_TIMEOUT_MS = 10 * 1000;
  var PARENT_TOKEN_TIMEOUT_MS = 2500;
  /** 單一請求最多等票的時間；超過就先送出，票取回後給下一個請求用 */
  var ATTACH_BUDGET_MS = 5000;
  var WARN_THROTTLE_MS = 60 * 1000;

  function b64UrlDecode_(seg) {
    var s = String(seg || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin;
    if (typeof atob === 'function') bin = atob(s);
    else if (typeof Buffer !== 'undefined') bin = Buffer.from(s, 'base64').toString('binary');
    else return '';
    try {
      return decodeURIComponent(Array.prototype.map.call(bin, function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (eUtf) {
      return bin;
    }
  }

  function decodeJson_(seg) {
    try {
      var txt = b64UrlDecode_(seg);
      return txt ? JSON.parse(txt) : null;
    } catch (e) {
      return null;
    }
  }

  /** LIFF id_token 未過期（只讀 exp，不驗簽） */
  function isLiffTokenFresh(token, nowMs) {
    var parts = String(token || '').split('.');
    if (parts.length < 2) return false;
    var payload = decodeJson_(parts[1]);
    var exp = payload ? (parseInt(payload.exp, 10) || 0) : 0;
    return exp > Math.floor((nowMs != null ? nowMs : Date.now()) / 1000) + LIFF_TOKEN_SKEW_SEC;
  }

  /** ticket "payloadB64.sig" 的 payload（uid／exp／purpose） */
  function readTicketPayload(ticket) {
    var parts = String(ticket || '').split('.');
    if (parts.length !== 2) return null;
    return decodeJson_(parts[0]);
  }

  /** 後端 gate 比對的身分：AuthBridge 用 user_id；存摺 OCR（hub_operator）用 operatorUserId */
  function pickClaimedUid(body) {
    if (!body || typeof body !== 'object') return '';
    var auth = body.auth && typeof body.auth === 'object' ? body.auth : {};
    return String(auth.user_id || body.user_id || body.operatorUserId || '').trim();
  }

  function maskUid_(uid) {
    var s = String(uid || '');
    return s.length > 4 ? '…' + s.slice(-4) : '****';
  }

  function browserGetLiffToken_(storage, nowFn) {
    var now = nowFn();
    try {
      var stored = storage && storage.getItem(LIFF_TOKEN_STORAGE_KEY);
      if (stored && isLiffTokenFresh(stored, now)) return Promise.resolve(stored);
    } catch (eStore) {}
    try {
      if (typeof liff !== 'undefined' && liff && liff.isLoggedIn && liff.isLoggedIn()) {
        var live = liff.getIDToken && liff.getIDToken();
        if (live && isLiffTokenFresh(live, now)) return Promise.resolve(live);
      }
    } catch (eLiff) {}
    return requestTokenFromHub_();
  }

  /** 在主控台 iframe 內：向最外層主控台要 LIFF id_token（spa/app.js 回 hub_liff_token） */
  function requestTokenFromHub_() {
    if (typeof window === 'undefined') return Promise.resolve('');
    var target = null;
    try {
      if (window.top && window.top !== window) target = window.top;
    } catch (eTop) {}
    if (!target && window.parent && window.parent !== window) target = window.parent;
    if (!target) return Promise.resolve('');
    return new Promise(function (resolve) {
      var done = false;
      function finish(tok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve(tok || '');
      }
      function onMsg(e) {
        if (!e || !e.data || e.data.type !== 'hub_liff_token') return;
        if (e.origin && window.location && e.origin !== window.location.origin) return;
        finish(String(e.data.token || ''));
      }
      var timer = setTimeout(function () { finish(''); }, PARENT_TOKEN_TIMEOUT_MS);
      window.addEventListener('message', onMsg);
      try {
        target.postMessage({ type: 'request_hub_liff_token', forwardFrom: 'hub_gate_ticket' }, '*');
      } catch (ePost) {
        finish('');
      }
    });
  }

  function defaultStorage_() {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {{ fetch?: Function, storage?: Storage|null, now?: () => number, consoleApiUrl?: string,
   *   getLiffToken?: () => Promise<string>, logger?: { warn: Function }, budgetMs?: number }} [deps]
   */
  function create(deps) {
    deps = deps || {};
    var fetchImpl = deps.fetch || (typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : undefined) : null);
    var storage = deps.storage !== undefined ? deps.storage : defaultStorage_();
    var now = deps.now || function () { return Date.now(); };
    var consoleApiUrl = deps.consoleApiUrl || DEFAULT_CONSOLE_API;
    var getLiffToken = deps.getLiffToken || function () { return browserGetLiffToken_(storage, now); };
    var logger = deps.logger || (typeof console !== 'undefined' ? console : { warn: function () {} });
    var budgetMs = deps.budgetMs != null ? deps.budgetMs : ATTACH_BUDGET_MS;

    var mem = null;
    var failMem = null;
    var inflight = null;
    var warnedAt = {};

    function readJson_(key) {
      try {
        var raw = storage && storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function writeJson_(key, val) {
      try {
        if (!storage) return;
        if (val == null) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify(val));
      } catch (e) {}
    }

    function readCache_(uid) {
      var entry = mem && mem.uid === uid ? mem : null;
      if (!entry) {
        var stored = readJson_(CACHE_KEY);
        if (stored && stored.uid === uid && stored.ticket) entry = stored;
      }
      if (!entry || !(entry.expMs - now() > REFRESH_BEFORE_EXP_MS)) return null;
      mem = entry;
      return entry;
    }

    function readFail_() {
      var f = failMem || readJson_(FAIL_KEY);
      if (!f || !(f.untilMs > now())) return null;
      return f;
    }

    function writeFail_(reason) {
      failMem = { reason: reason, untilMs: now() + FAIL_BACKOFF_MS };
      writeJson_(FAIL_KEY, failMem);
    }

    function warn_(reason, action, uid) {
      var key = reason + '|' + action;
      var t = now();
      if (warnedAt[key] && t - warnedAt[key] < WARN_THROTTLE_MS) return;
      warnedAt[key] = t;
      try {
        logger.warn('[HubGateTicket][WARN] 未附 hub_gate_ticket reason=' + reason +
          ' action=' + (action || '(none)') + ' uid=' + maskUid_(uid) +
          '（audit 期間照常送出；accounting-gas 會記 HubUserIdGate WARN）');
      } catch (eLog) {}
    }

    function fetchTicket_(token) {
      if (!fetchImpl) return Promise.reject(new Error('console_error:no_fetch'));
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS) : null;
      var init = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: TICKET_ACTION, liff_id_token: token })
      };
      if (ctrl) init.signal = ctrl.signal;
      return Promise.resolve()
        .then(function () { return fetchImpl(consoleApiUrl, init); })
        .then(function (res) { return res.text(); }, function (e) {
          throw new Error('console_error:' + ((e && e.name === 'AbortError') ? 'timeout' : 'network'));
        })
        .then(function (text) {
          var trimmed = String(text || '').trim();
          var data = null;
          if (trimmed && trimmed.charAt(0) !== '<') {
            try { data = JSON.parse(trimmed); } catch (eParse) { data = null; }
          }
          if (!data) throw new Error('console_bad_response');
          if (!data.success || !data.hub_gate_ticket) throw new Error('console_rejected');
          var payload = readTicketPayload(data.hub_gate_ticket) || {};
          var t = now();
          var expMs = payload.exp ? parseInt(payload.exp, 10) * 1000
            : t + ((parseInt(data.expires_in_sec, 10) || 0) * 1000 || DEFAULT_TICKET_LIFE_MS);
          expMs = Math.min(expMs, t + MAX_TICKET_LIFE_MS);
          return {
            ticket: String(data.hub_gate_ticket),
            uid: String(payload.uid || data.user_id || '').trim(),
            expMs: expMs
          };
        })
        .then(function (entry) {
          if (timer) clearTimeout(timer);
          return entry;
        }, function (err) {
          if (timer) clearTimeout(timer);
          throw err;
        });
    }

    /** 回 { ticket, reason }；reason 只用於 log */
    function getTicketDetailed(opts) {
      opts = opts || {};
      var uid = String(opts.uid || '').trim();
      if (!uid) return Promise.resolve({ ticket: '', reason: 'no_uid' });
      var cached = readCache_(uid);
      if (cached) return Promise.resolve({ ticket: cached.ticket, reason: 'cached' });
      var explicit = opts.liffToken && isLiffTokenFresh(opts.liffToken, now()) ? String(opts.liffToken) : '';
      var fail = readFail_();
      if (fail && !(explicit && fail.reason === 'no_liff_token')) {
        return Promise.resolve({ ticket: '', reason: fail.reason });
      }
      if (!inflight) {
        inflight = Promise.resolve(explicit || getLiffToken())
          .then(function (tok) {
            if (!tok || !isLiffTokenFresh(tok, now())) throw new Error('no_liff_token');
            return fetchTicket_(tok);
          })
          .then(function (entry) {
            mem = entry;
            writeJson_(CACHE_KEY, entry);
            failMem = null;
            writeJson_(FAIL_KEY, null);
            return entry;
          }, function (err) {
            var reason = String((err && err.message) || 'console_error');
            if (!/^(no_liff_token|console_)/.test(reason)) reason = 'console_error:' + reason.slice(0, 40);
            writeFail_(reason);
            throw new Error(reason);
          })
          .then(function (entry) {
            inflight = null;
            return entry;
          }, function (err) {
            inflight = null;
            throw err;
          });
      }
      return inflight.then(function (entry) {
        if (entry.uid && entry.uid !== uid) return { ticket: '', reason: 'uid_mismatch' };
        return { ticket: entry.ticket, reason: 'fetched' };
      }, function (err) {
        return { ticket: '', reason: (err && err.message) || 'console_error' };
      });
    }

    function getTicket(opts) {
      return getTicketDetailed(opts).then(function (r) { return r.ticket; });
    }

    /**
     * 有 user_id／operatorUserId 時附 hub_gate_ticket（會改到傳入的 body）；永不丟錯。
     * @param {object} body
     * @param {{ liffToken?: string, action?: string }} [opts]
     */
    function attach(body, opts) {
      opts = opts || {};
      var uid = pickClaimedUid(body);
      if (!uid || body.hub_gate_ticket || (body.auth && body.auth.hub_gate_ticket)) {
        return Promise.resolve(body);
      }
      var liffToken = opts.liffToken || body.liff_id_token || (body.auth && body.auth.liff_id_token) || '';
      var action = opts.action || body.action || '';
      var timer = null;
      var budget = new Promise(function (resolve) {
        timer = setTimeout(function () { resolve({ ticket: '', reason: 'timeout' }); }, budgetMs);
      });
      return Promise.race([getTicketDetailed({ uid: uid, liffToken: liffToken }), budget])
        .then(function (r) {
          clearTimeout(timer);
          if (r.ticket) {
            body.hub_gate_ticket = r.ticket;
            if (body.auth && typeof body.auth === 'object') body.auth.hub_gate_ticket = r.ticket;
          } else {
            warn_(r.reason, action, uid);
          }
          return body;
        }, function () {
          clearTimeout(timer);
          warn_('unexpected', action, uid);
          return body;
        });
    }

    /** 同步讀快取（不發請求） */
    function peek(uid) {
      var entry = readCache_(String(uid || '').trim());
      return entry ? entry.ticket : '';
    }

    function clear() {
      mem = null;
      failMem = null;
      writeJson_(CACHE_KEY, null);
      writeJson_(FAIL_KEY, null);
    }

    return {
      attach: attach,
      getTicket: getTicket,
      getTicketDetailed: getTicketDetailed,
      peek: peek,
      clear: clear
    };
  }

  var lib = create();
  lib.create = create;
  lib.pickClaimedUid = pickClaimedUid;
  lib.isLiffTokenFresh = isLiffTokenFresh;
  lib.readTicketPayload = readTicketPayload;
  lib.CONSOLE_API = DEFAULT_CONSOLE_API;
  return lib;
});
