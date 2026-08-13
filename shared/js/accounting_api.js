/**
 * accounting-gas API 共用（LIFF 靜態頁）
 */
var AccountingApi = (function () {
  var GAS_API = 'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';
  /** 選材 API — project-console（與 shared/js/config.js GAS_WEB_APP_URL 相同） */
  var PROJECT_CONSOLE_API = 'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';
  var SESSION_POLICY_KEY = 'tanxin_accounting_policy_v1';
  var SESSION_AUTH_PREFIX = 'tanxin_accounting_auth_v1:';
  var SESSION_TOKEN_KEY = 'tanxin_accounting_liff_token_v1';
  var POLICY_TTL_MS = 24 * 60 * 60 * 1000;
  var AUTH_TTL_MS = 12 * 60 * 60 * 1000;
  var MIN_PERMISSION = 4;
  var INGEST_MIN_PERMISSION = 2;
  var CUSTOMER_FINANCE_MIN_PERMISSION = 2;
  var SUPERVISOR_MIN_PERMISSION = 3;
  var VENDOR_PAYMENT_APPROVE_MIN_PERMISSION = 5;
  /** 匯款請款／款項進度：在職員工即可（對齊「登入即可送審」） */
  var PAYMENT_REQUEST_MIN_PERMISSION = 1;
  var PERM_DENIED_MSG = '權限不足（需財務／老闆，權限 ≥ 4）';
  var PAYMENT_REQUEST_DENIED_MSG = '權限不足（需為在職員工或已登記廠商）';
  var INGEST_PERM_DENIED_MSG = '權限不足（收支登錄需權限 ≥ 2）';
  var CUSTOMER_FINANCE_DENIED_MSG = '權限不足（追加減與收款需權限 ≥ 2）';
  var SUPERVISOR_DENIED_MSG = '權限不足（需主管，權限 ≥ 3）';
  var VENDOR_PAYMENT_APPROVE_DENIED_MSG = '權限不足（廠商請款審核需權限 ≥ 5）';
  var HUB_RELOGIN_MSG = '請從主控台重新開啟會計';
  function logApiFailure_(actionName, err, notify) {
    if (actionName === 'accounting_error_report' || actionName === 'accounting_client_log') return;
    if (typeof AccountingUi === 'undefined' || !AccountingUi.reportFailure) return;
    try {
      AccountingUi.reportFailure({
        action: actionName,
        message: (err && err.message) || String(err || 'API 失敗'),
        notify: !!notify
      });
    } catch (eRep) {}
  }
  /** IdToken 距過期少於此秒數視為不可用（略早於 LINE 約 1 小時效期） */
  var LIFF_TOKEN_SKEW_SEC = 60;

  function clearStoredLiffToken_() {
    try { sessionStorage.removeItem(SESSION_TOKEN_KEY); } catch (eClr) {}
  }

  /** 解析 LIFF JWT payload（僅讀 exp／sub，不驗簽） */
  function decodeJwtPayload_(token) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = null;
      if (typeof atob === 'function') {
        json = decodeURIComponent(Array.prototype.map.call(atob(b64), function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      }
      return json ? JSON.parse(json) : null;
    } catch (eJwt) {
      return null;
    }
  }

  /** true＝尚可用；空白／無法解析／已過期 → false */
  function isLiffIdTokenFresh_(token) {
    if (!token) return false;
    var payload = decodeJwtPayload_(token);
    if (!payload || payload.exp == null) return false;
    var expSec = parseInt(payload.exp, 10) || 0;
    if (!expSec) return false;
    return expSec > (Math.floor(Date.now() / 1000) + LIFF_TOKEN_SKEW_SEC);
  }

  async function parseJsonResponse_(res, textOpt) {
    var text = textOpt != null ? String(textOpt) : await res.text();
    var trimmed = (text || '').trim();
    if (!trimmed) {
      throw new Error('會計 API 回傳空白（HTTP ' + res.status + '）');
    }
    if (trimmed.charAt(0) === '<') {
      throw new Error('會計 API 回傳 HTML 而非 JSON（HTTP ' + res.status + '）。若剛部署請等 1～2 分鐘重試；仍失敗請回報時間點');
    }
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      throw new Error('會計 API JSON 解析失敗（HTTP ' + res.status + '）');
    }
  }

  function shouldRetryGasHtml_(res, text) {
    var trimmed = String(text || '').trim();
    if (!trimmed || trimmed.charAt(0) !== '<') return false;
    var code = res && res.status;
    return code === 404 || code === 502 || code === 503;
  }

  async function postToUrl_(apiUrl, body, timeoutMs, apiLabel) {
    var actionName = (body && body.action) || 'api';
    var trackUi = actionName !== 'accounting_client_log' && actionName !== 'accounting_error_report';
    var t0 = Date.now();
    if (trackUi && typeof AccountingUi !== 'undefined' && AccountingUi.apiStart) {
      AccountingUi.apiStart(actionName);
    }
    var opts = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    };
    var timer = null;
    if (timeoutMs && timeoutMs > 0) {
      var ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
    }
    try {
      var res = null;
      var text = '';
      var attempt = 0;
      var maxAttempts = 3;
      while (attempt < maxAttempts) {
        attempt += 1;
        res = await fetch(apiUrl, opts);
        text = await res.text();
        if (attempt < maxAttempts && shouldRetryGasHtml_(res, text)) {
          await new Promise(function (r) { setTimeout(r, 2000 * attempt); });
          continue;
        }
        break;
      }
      var parsed = parseJsonResponse_(res, text);
      if (trackUi && typeof AccountingUi !== 'undefined' && AccountingUi.apiEnd) {
        var extra = parsed && parsed.success === false && parsed.message ? parsed.message : '';
        if (parsed && parsed.gas_cached) extra = (extra ? extra + ' · ' : '') + (apiLabel || 'GAS') + ' 快取';
        AccountingUi.apiEnd(actionName, Date.now() - t0, !!(parsed && parsed.success !== false), extra);
      }
      if (parsed && parsed.success === false) {
        logApiFailure_(actionName, { message: parsed.message || '失敗' }, false);
      }
      return parsed;
    } catch (e) {
      if (trackUi && typeof AccountingUi !== 'undefined' && AccountingUi.apiEnd) {
        AccountingUi.apiEnd(actionName, Date.now() - t0, false, e.message || String(e));
      }
      logApiFailure_(actionName, e, false);
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function post(body, timeoutMs) {
    return postToUrl_(GAS_API, body, timeoutMs, '會計');
  }

  /** 選材專用 — 打 project-console，不再經 accounting-gas */
  async function postMaterial(body, timeoutMs) {
    return postToUrl_(PROJECT_CONSOLE_API, body, timeoutMs, '主控台');
  }

  async function initStaffSessionCore_(opts) {
    opts = opts || {};
    var hubOp = readHubOperator_();
    if (hubOp) {
      var action = opts.authAction || 'accounting_auth_me';
      var auth = await post({
        action: action,
        user_id: hubOp.userId,
        auth: { user_id: hubOp.userId }
      });
      if (!auth.success) throw new Error(auth.message || '驗證失敗');
      return buildHubSession_(auth);
    }
    return AccountingApi.initLiff(opts);
  }

  function readDevBypassQuery_() {
    if (typeof OperatorContext !== 'undefined') {
      OperatorContext.mergeFromUrl();
      return OperatorContext.devBypassPayload();
    }
    var perm = 0;
    var uid = '';
    try {
      var q = new URLSearchParams(window.location.search);
      var permStr = q.get('perm') || q.get('dev_perm') || q.get('permission') || '';
      uid = q.get('dev_user') || q.get('dev_user_id') || q.get('uid') || '';
      if (!permStr && !uid) {
        permStr = sessionStorage.getItem('acct_dev_perm') || '';
        uid = sessionStorage.getItem('acct_dev_user') || '';
      } else {
        if (permStr) sessionStorage.setItem('acct_dev_perm', permStr);
        if (uid) sessionStorage.setItem('acct_dev_user', uid);
      }
      perm = permStr ? parseInt(permStr, 10) : 0;
    } catch (e) {}
    return { dev_permission: perm > 0 ? perm : 0, dev_user_id: uid };
  }

  function readHubLiffIdFromQuery_() {
    if (typeof OperatorContext !== 'undefined') {
      var id = OperatorContext.hubLiffId();
      if (id) return id;
    }
    try {
      var q = new URLSearchParams(window.location.search);
      return q.get('hub_liff_id') || q.get('hub_liff') || '';
    } catch (e) {
      return '';
    }
  }

  function isInHubIframe_() {
    if (!window.parent || window.parent === window) return false;
    try {
      if (window.top && window.top !== window) return true;
    } catch (eTop) {}
    if (typeof AccountingNav !== 'undefined' && AccountingNav.isEmbed && AccountingNav.isEmbed()) return true;
    if (typeof OperatorContext !== 'undefined') {
      var op = OperatorContext.read();
      if (op && op.userId && op.hubLiffId) return true;
    }
    return !!readHubLiffIdFromQuery_();
  }

  /** 會計殼層內嵌 iframe 須向最外層 HUB 要 token，不可只找直接 parent */
  function getHubMessageTarget_() {
    try {
      if (window.top && window.top !== window) return window.top;
    } catch (e) {}
    return (window.parent && window.parent !== window) ? window.parent : null;
  }

  function requestParentHubLiffTokenOnce_() {
    var target = getHubMessageTarget_();
    if (!target) return Promise.resolve('');
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve(''); }
      }, 4000);
      function onMsg(e) {
        if (!e.data || e.data.type !== 'hub_liff_token') return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve(e.data.token || '');
      }
      window.addEventListener('message', onMsg);
      try {
        target.postMessage({ type: 'request_hub_liff_token' }, '*');
      } catch (err) {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        resolve('');
      }
    });
  }

  async function requestParentHubLiffToken_(opts) {
    opts = opts || {};
    var attempts = opts.attempts || 4;
    var delayMs = opts.delayMs || 800;
    for (var i = 0; i < attempts; i++) {
      var tok = await requestParentHubLiffTokenOnce_();
      if (tok) return tok;
      if (i < attempts - 1) {
        await new Promise(function (r) { setTimeout(r, delayMs); });
      }
    }
    return '';
  }

  function resolveLiffIdForInit_(opts, policy) {
    if (opts && opts.liffId) return opts.liffId;
    return (policy && policy.liffId) || '';
  }

  function primeHubIdentityFromUrl_() {
    if (typeof OperatorContext !== 'undefined') OperatorContext.mergeFromUrl();
    else readDevBypassQuery_();
  }

  function devBypassAuthBody_(action) {
    var opts = readDevBypassQuery_();
    var body = { action: action, dev_bypass: true };
    if (opts.dev_permission) body.dev_permission = opts.dev_permission;
    if (opts.dev_user_id) body.dev_user_id = opts.dev_user_id;
    return { body: body, opts: opts };
  }

  function simpleHash_(s) {
    var h = 0;
    var str = String(s || '');
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return String(h);
  }

  function readSessionWrapped_(key, ttlMs) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.data == null) return null;
      if (ttlMs && (Date.now() - parsed.ts > ttlMs)) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeSessionWrapped_(key, data, ttlMs) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data, ttl: ttlMs || 0 }));
    } catch (e) {}
  }

  function authCacheKey_(sessionOrToken) {
    if (typeof sessionOrToken === 'object' && sessionOrToken) {
      if (sessionOrToken.devBypass) {
        return SESSION_AUTH_PREFIX + 'dev:' + (sessionOrToken.devUserId || '') + ':' + (sessionOrToken.devPermission || 0);
      }
      if (sessionOrToken.fromHub && sessionOrToken.auth && sessionOrToken.auth.user_id) {
        return SESSION_AUTH_PREFIX + 'uid:' + sessionOrToken.auth.user_id;
      }
      var tok = sessionOrToken.idToken || '';
      if (tok) return SESSION_AUTH_PREFIX + 'liff:' + simpleHash_(tok);
      if (sessionOrToken.auth && sessionOrToken.auth.user_id) {
        return SESSION_AUTH_PREFIX + 'uid:' + sessionOrToken.auth.user_id;
      }
    }
    if (typeof sessionOrToken === 'string' && sessionOrToken) {
      return SESSION_AUTH_PREFIX + 'liff:' + simpleHash_(sessionOrToken);
    }
    return SESSION_AUTH_PREFIX + 'anon';
  }

  function rememberSession_(session) {
    if (!session || !session.auth) return;
    writeSessionWrapped_(authCacheKey_(session), session.auth, AUTH_TTL_MS);
    if (session.idToken) {
      try { sessionStorage.setItem(SESSION_TOKEN_KEY, session.idToken); } catch (eTok) {}
    }
    if (session.devBypass) {
      writeSessionWrapped_(SESSION_AUTH_PREFIX + 'mode:dev', true, AUTH_TTL_MS);
    }
  }

  function readCachedAuth_(sessionOrToken) {
    return readSessionWrapped_(authCacheKey_(sessionOrToken), AUTH_TTL_MS);
  }

  function invalidateBootstrapAfterCrud_(sessionOrToken, entity, res) {
    try {
      if (typeof AccountingCache !== 'undefined' && AccountingCache.afterCrudSuccess) {
        var sess = typeof sessionOrToken === 'object' ? sessionOrToken : null;
        AccountingCache.afterCrudSuccess(sess, entity, res);
      }
    } catch (e) {}
  }

  function notifyUiOperator_(session) {
    try {
      if (session) rememberSession_(session);
    } catch (eRem) {}
    try {
      if (session && typeof OperatorContext !== 'undefined') OperatorContext.applySession(session);
    } catch (eOp) {}
    try {
      if (session && typeof AccountingUi !== 'undefined' && AccountingUi.setOperator) {
        AccountingUi.setOperator(session);
      }
    } catch (e) {}
  }

  function buildDevBypassSession_(auth, opts) {
    return {
      devBypass: true,
      devPermission: opts.dev_permission || auth.permission || 0,
      devUserId: opts.dev_user_id || '',
      profile: { userId: auth.user_id, displayName: auth.display_name },
      idToken: '',
      auth: auth
    };
  }

  function buildHubSession_(auth) {
    return {
      fromHub: true,
      devBypass: false,
      profile: { userId: auth.user_id, displayName: auth.display_name },
      idToken: '',
      auth: auth
    };
  }

  function readHubOperator_() {
    primeHubIdentityFromUrl_();
    if (typeof OperatorContext === 'undefined') return null;
    var op = OperatorContext.read();
    if (!op || !op.userId) return null;
    var fromHub = isInHubIframe_() || op.source === 'hub_iframe' || op.source === 'hub' || !!op.hubLiffId;
    if (!fromHub) return null;
    return op;
  }

  function isHubStaffSession_(session) {
    if (!session || session.devBypass) return false;
    if (session.fromHub) return true;
    if (!session.idToken && session.auth && session.auth.user_id) return true;
    return false;
  }

  function buildAuth(session) {
    if (!session) return {};
    if (session.devBypass) {
      var a = { dev_bypass: true };
      if (session.devPermission) a.dev_permission = session.devPermission;
      if (session.devUserId) a.dev_user_id = session.devUserId;
      return a;
    }
    if (isHubStaffSession_(session)) {
      var uid = (session.auth && session.auth.user_id) || (session.profile && session.profile.userId) || '';
      return uid ? { user_id: uid } : {};
    }
    return { liff_id_token: session.idToken || '' };
  }

  function resolveAuth(sessionOrToken) {
    if (typeof sessionOrToken === 'string') {
      return { liff_id_token: sessionOrToken };
    }
    return buildAuth(sessionOrToken);
  }

  /** 選材設計師 API：dev_bypass／liff_id_token 同時寫在 body 頂層（對齊 project-console MaterialPortalAccess） */
  function buildMaterialPostBody_(sessionOrToken, body) {
    var out = Object.assign({}, body || {}, { auth: resolveAuth(sessionOrToken) });
    var auth = out.auth || {};
    if (auth.dev_bypass) {
      out.dev_bypass = true;
      if (auth.dev_permission) out.dev_permission = auth.dev_permission;
      if (auth.dev_user_id) out.dev_user_id = auth.dev_user_id;
    }
    if (auth.liff_id_token) {
      out.liff_id_token = auth.liff_id_token;
    }
    if (auth.user_id) {
      out.user_id = auth.user_id;
    }
    return out;
  }

  return {
    GAS_API: GAS_API,
    PROJECT_CONSOLE_API: PROJECT_CONSOLE_API,
    MIN_PERMISSION: MIN_PERMISSION,
    PAYMENT_REQUEST_MIN_PERMISSION: PAYMENT_REQUEST_MIN_PERMISSION,
    INGEST_MIN_PERMISSION: INGEST_MIN_PERMISSION,
    CUSTOMER_FINANCE_MIN_PERMISSION: CUSTOMER_FINANCE_MIN_PERMISSION,
    SUPERVISOR_MIN_PERMISSION: SUPERVISOR_MIN_PERMISSION,
    VENDOR_PAYMENT_APPROVE_MIN_PERMISSION: VENDOR_PAYMENT_APPROVE_MIN_PERMISSION,
    PERM_DENIED_MSG: PERM_DENIED_MSG,
    PAYMENT_REQUEST_DENIED_MSG: PAYMENT_REQUEST_DENIED_MSG,
    INGEST_PERM_DENIED_MSG: INGEST_PERM_DENIED_MSG,
    CUSTOMER_FINANCE_DENIED_MSG: CUSTOMER_FINANCE_DENIED_MSG,
    SUPERVISOR_DENIED_MSG: SUPERVISOR_DENIED_MSG,
    VENDOR_PAYMENT_APPROVE_DENIED_MSG: VENDOR_PAYMENT_APPROVE_DENIED_MSG,
    post: post,
    postMaterial: postMaterial,
    buildAuth: buildAuth,
    authMe: function (sessionOrToken) {
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        var pack = devBypassAuthBody_('accounting_auth_me');
        if (sessionOrToken.devPermission) pack.body.dev_permission = sessionOrToken.devPermission;
        if (sessionOrToken.devUserId) pack.body.dev_user_id = sessionOrToken.devUserId;
        return post(pack.body);
      }
      if (typeof sessionOrToken === 'object' && sessionOrToken && isHubStaffSession_(sessionOrToken)) {
        var hubUid = (sessionOrToken.auth && sessionOrToken.auth.user_id)
          || (sessionOrToken.profile && sessionOrToken.profile.userId) || '';
        return post({ action: 'accounting_auth_me', user_id: hubUid, auth: { user_id: hubUid } });
      }
      var token = typeof sessionOrToken === 'string' ? sessionOrToken : (sessionOrToken && sessionOrToken.idToken);
      return post({ action: 'accounting_auth_me', liff_id_token: token });
    },
    crudList: function (sessionOrToken, entity, filter) {
      return post({ action: 'crud_list', entity: entity, auth: resolveAuth(sessionOrToken), filter: filter || {} });
    },
    crudCreate: function (sessionOrToken, entity, payload) {
      return post({ action: 'crud_create', entity: entity, auth: resolveAuth(sessionOrToken), payload: payload })
        .then(function (res) {
          if (res && res.success) invalidateBootstrapAfterCrud_(sessionOrToken, entity, res);
          return res;
        });
    },
    crudUpdate: function (sessionOrToken, entity, id, payload) {
      return post({ action: 'crud_update', entity: entity, id: id, auth: resolveAuth(sessionOrToken), payload: payload })
        .then(function (res) {
          if (res && res.success) invalidateBootstrapAfterCrud_(sessionOrToken, entity, res);
          return res;
        });
    },
    /** 銀行代碼＋分行名稱 → 財金 7 碼對照（廠商名冊存檔前檢查） */
    ctbcLookupBranch: function (sessionOrToken, bankCode, branchName) {
      return post({
        action: 'ctbc_lookup_branch',
        auth: resolveAuth(sessionOrToken),
        bank_code: bankCode || '',
        branch_name: branchName || ''
      });
    },
    vendorPaymentStatus: function (sessionOrToken, filter) {
      return post({ action: 'vendor_payment_status', auth: resolveAuth(sessionOrToken), filter: filter || {} });
    },
    bootstrap: function (sessionOrToken, timeoutMs) {
      return post({ action: 'accounting_bootstrap', auth: resolveAuth(sessionOrToken) }, timeoutMs || 120000);
    },
    /** 失敗寫 Logs Explorer；notify=true 才寄信（失敗不擋畫面） */
    reportError: function (sessionOrToken, payload) {
      payload = payload || {};
      var cachedPolicy = readSessionWrapped_(SESSION_POLICY_KEY, POLICY_TTL_MS);
      if (cachedPolicy && cachedPolicy.errorReportEnabled === false) {
        return Promise.resolve({ success: true, skipped: true });
      }
      var body = {
        action: 'accounting_error_report',
        page: payload.page || '',
        message: payload.message || '',
        report_text: payload.report_text || payload.detail || '',
        url: payload.url || '',
        fail_count: payload.fail_count || 1,
        notify: !!payload.notify
      };
      if (sessionOrToken) {
        body.auth = resolveAuth(sessionOrToken);
        if (body.auth && body.auth.user_id) body.user_id = body.auth.user_id;
      } else if (typeof OperatorContext !== 'undefined') {
        var op = OperatorContext.read();
        if (op && op.userId) body.user_id = op.userId;
      }
      return post(body).catch(function () { return { success: false }; });
    },
    /** 瀏覽器操作紀錄（背景上傳，失敗不影響 UI） */
    clientLog: function (sessionOrToken, payload) {
      if (!sessionOrToken) return Promise.resolve({ success: false });
      return post({
        action: 'accounting_client_log',
        auth: resolveAuth(sessionOrToken),
        page: (payload && payload.page) || '',
        kind: (payload && payload.kind) || 'info',
        summary: (payload && payload.summary) || '',
        detail: (payload && payload.detail) || ''
      }).catch(function () { return { success: false }; });
    },
    vendorEnsureFolder: function (sessionOrToken, vendorId) {
      return post({ action: 'vendor_ensure_folder', auth: resolveAuth(sessionOrToken), vendor_id: vendorId })
        .then(function (res) {
          if (res && res.success) {
            var patchRes = res;
            if (res.folder && !res.data) {
              patchRes = { success: true, data: { vendor_id: vendorId, drive_folder_id: res.folder } };
            }
            invalidateBootstrapAfterCrud_(sessionOrToken, 'vendor', patchRes);
          }
          return res;
        });
    },
    vendorSyncLegacyDrive: function (sessionOrToken, options) {
      options = options || {};
      return post({
        action: 'vendor_sync_legacy_drive',
        auth: resolveAuth(sessionOrToken),
        confirm: !!options.confirm,
        create_missing: options.create_missing !== false,
        include_empty: !!options.include_empty
      }).then(function (res) {
        if (res && res.success && options.confirm) {
          invalidateBootstrapAfterCrud_(sessionOrToken, 'vendor', res);
        }
        return res;
      });
    },
    lineContactSearch: function (sessionOrToken, keyword, limit) {
      return post({
        action: 'line_contact_search',
        auth: resolveAuth(sessionOrToken),
        keyword: keyword,
        limit: limit || 20
      });
    },
    lineContactList: function (sessionOrToken, limit) {
      return post({
        action: 'line_contact_search',
        auth: resolveAuth(sessionOrToken),
        fetch_all: true,
        limit: limit || 5000
      });
    },
    cachedLineContactSearch: async function (sessionOrToken, keyword, limit) {
      if (typeof AccountingListCache === 'undefined') {
        return AccountingApi.lineContactSearch(sessionOrToken, keyword, limit);
      }
      var items = await AccountingListCache.searchMasterList(
        sessionOrToken,
        AccountingListCache.MASTER_KEYS.line_contact,
        keyword,
        function () { return AccountingApi.lineContactList(sessionOrToken); },
        { limit: limit || 20, filterFields: ['name', 'line_id', 'project_no'] }
      );
      return { success: true, items: items, source: 'accounting_line_contact', cached: true };
    },
    vendorListFiles: function (sessionOrToken, driveFolderId, limit) {
      return post({
        action: 'vendor_list_files',
        auth: resolveAuth(sessionOrToken),
        drive_folder_id: driveFolderId,
        limit: limit || 30
      });
    },
    vendorUploadPhotos: function (sessionOrToken, vendorId, photos) {
      return post({
        action: 'vendor_upload_photos',
        auth: resolveAuth(sessionOrToken),
        vendor_id: vendorId,
        photos: photos || []
      }).then(function (res) {
        if (res && res.success) invalidateBootstrapAfterCrud_(sessionOrToken, 'vendor', res);
        return res;
      });
    },
    vendorDocSubmit: function (sessionOrToken, payload) {
      return post({
        action: 'vendor_doc_submit',
        auth: resolveAuth(sessionOrToken),
        payload: payload || {}
      });
    },
    vendorDocList: function (sessionOrToken, filter) {
      return post({
        action: 'vendor_doc_list',
        auth: resolveAuth(sessionOrToken),
        filter: filter || {}
      });
    },
    vendorDocOcrAnalyze: function (sessionOrToken, payload, timeoutMs) {
      return post({
        action: 'vendor_doc_ocr_analyze',
        auth: resolveAuth(sessionOrToken),
        payload: payload || {}
      }, timeoutMs || 120000);
    },
    vendorDocDeactivate: function (sessionOrToken, vendorDocId) {
      return post({
        action: 'vendor_doc_deactivate',
        auth: resolveAuth(sessionOrToken),
        vendor_doc_id: vendorDocId
      });
    },
    /** LINE 單據快審清單（≥2） */
    quickReviewList: function (sessionOrToken, filter) {
      return post({
        action: 'quick_review_list',
        auth: resolveAuth(sessionOrToken),
        filter: filter || {}
      }, 45000);
    },
    /** 快審五類分類；請款回傳 payment_url／pending_token */
    quickReviewClassify: function (sessionOrToken, payload) {
      return post({
        action: 'quick_review_classify',
        auth: resolveAuth(sessionOrToken),
        quick_review_id: (payload && payload.quick_review_id) || '',
        category: (payload && payload.category) || '',
        vendor_id: (payload && payload.vendor_id) || '',
        note: (payload && payload.note) || ''
      }, 45000);
    },
    marginListOverview: function (sessionOrToken, opts) {
      opts = opts || {};
      return post({
        action: 'margin_list_overview',
        auth: resolveAuth(sessionOrToken),
        backfill_missing_status: !!opts.backfill_missing_status
      });
    },
    marginBackfillOverviewStatus: function (sessionOrToken) {
      return post({
        action: 'margin_backfill_overview_status',
        auth: resolveAuth(sessionOrToken)
      });
    },
    marginListLines: function (sessionOrToken, filter) {
      return post({
        action: 'margin_list_lines',
        auth: resolveAuth(sessionOrToken),
        project_no: (filter && filter.project_no) || '',
        tab_name: (filter && filter.tab_name) || ''
      });
    },
    marginAddLine: function (sessionOrToken, payload) {
      return post({ action: 'margin_add_line', auth: resolveAuth(sessionOrToken), payload: payload || {} });
    },
    marginUpdateLine: function (sessionOrToken, tabName, rowIndex, payload, projectNo) {
      return post({
        action: 'margin_update_line',
        auth: resolveAuth(sessionOrToken),
        tab_name: tabName,
        row_index: rowIndex,
        project_no: projectNo || '',
        payload: payload || {}
      });
    },
    marginDeleteLine: function (sessionOrToken, tabName, rowIndex, projectNo) {
      return post({
        action: 'margin_delete_line',
        auth: resolveAuth(sessionOrToken),
        tab_name: tabName,
        row_index: rowIndex,
        project_no: projectNo || ''
      });
    },
    marginGetDetail: function (sessionOrToken, filter) {
      return post({
        action: 'margin_get_detail',
        auth: resolveAuth(sessionOrToken),
        project_no: (filter && filter.project_no) || '',
        tab_name: (filter && filter.tab_name) || ''
      });
    },
    marginSaveContractAmount: function (sessionOrToken, payload) {
      return post({
        action: 'margin_save_contract_amount',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || '',
        contract_amount: payload.contract_amount,
        use_quotation: payload.use_quotation,
        refresh_auto: payload.refresh_auto
      });
    },
    marginSaveDuration: function (sessionOrToken, payload) {
      return post({
        action: 'margin_save_duration',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || '',
        duration_start: payload.duration_start,
        duration_end: payload.duration_end
      });
    },
    marginRecalcBaseCost: function (sessionOrToken, payload) {
      return post({
        action: 'margin_recalc_base_cost',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || ''
      });
    },
    marginSaveBonusAllocations: function (sessionOrToken, payload) {
      return post({
        action: 'margin_save_bonus_allocations',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        bonus_allocations: payload.bonus_allocations || []
      });
    },
    marginApplyBonus: function (sessionOrToken, payload) {
      return post({
        action: 'margin_apply_bonus',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        suggested_amount: payload.suggested_amount,
        note: payload.note || ''
      });
    },
    marginSaveLaborWages: function (sessionOrToken, payload) {
      return post({
        action: 'margin_save_labor_wages',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        labor_wages: payload.labor_wages || {}
      });
    },
    marginRecalcLaborWages: function (sessionOrToken, payload) {
      return post({
        action: 'margin_recalc_labor_wages',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || ''
      });
    },
    marginSaveVendors: function (sessionOrToken, payload) {
      var body = {
        action: 'margin_save_vendors',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || ''
      };
      if (payload.vendor_slots && typeof payload.vendor_slots === 'object') {
        body.vendor_slots = payload.vendor_slots;
        if (payload.vendor_slots_manual != null) {
          body.vendor_slots_manual = payload.vendor_slots_manual;
        }
      } else {
        body.selected_vendors = payload.selected_vendors || [];
      }
      return post(body);
    },
    marginSaveHasFurnitureOrder: function (sessionOrToken, payload) {
      return post({
        action: 'margin_save_has_furniture_order',
        auth: resolveAuth(sessionOrToken),
        project_no: payload.project_no,
        tab_name: payload.tab_name || '',
        has_furniture_order: !!payload.has_furniture_order
      });
    },
    loadPolicy: async function (opts) {
      opts = opts || {};
      var cached = !opts.force ? readSessionWrapped_(SESSION_POLICY_KEY, POLICY_TTL_MS) : null;
      if (cached && !opts.background) {
        post({ action: 'accounting_policy' }).then(function (data) {
          var policy = (data && data.policy) || {};
          writeSessionWrapped_(SESSION_POLICY_KEY, policy, POLICY_TTL_MS);
        }).catch(function () {});
        return cached;
      }
      var data = await post({ action: 'accounting_policy' });
      var policy = (data && data.policy) || {};
      writeSessionWrapped_(SESSION_POLICY_KEY, policy, POLICY_TTL_MS);
      return policy;
    },
    tryCachedSession: function (opts) {
      opts = opts || {};
      var minPerm = opts.minPermission != null ? opts.minPermission : MIN_PERMISSION;
      primeHubIdentityFromUrl_();
      var hubOp = readHubOperator_();
      if (hubOp) {
        var authUid = readSessionWrapped_(SESSION_AUTH_PREFIX + 'uid:' + hubOp.userId, AUTH_TTL_MS);
        var auth = authUid || {
          user_id: hubOp.userId,
          display_name: hubOp.displayName || hubOp.userName || '',
          permission: hubOp.permission || 0
        };
        if ((auth.permission || 0) < minPerm) return null;
        return buildHubSession_(auth);
      }
      var token = '';
      try { token = sessionStorage.getItem(SESSION_TOKEN_KEY) || ''; } catch (eTok) {}
      if (!token || !isLiffIdTokenFresh_(token)) {
        if (token) clearStoredLiffToken_();
        return null;
      }
      var authHub = readSessionWrapped_(SESSION_AUTH_PREFIX + 'liff:' + simpleHash_(token), AUTH_TTL_MS);
      if (!authHub || (authHub.permission || 0) < minPerm) return null;
      return {
        devBypass: false,
        profile: { userId: authHub.user_id, displayName: authHub.display_name },
        idToken: token,
        auth: authHub
      };
    },
    /** 從主控台進來：先用本分頁記住的人顯示畫面，背景再向後端核對員工表 */
    tryProvisionalSession: function (opts) {
      opts = opts || {};
      if (typeof OperatorContext === 'undefined') return null;
      primeHubIdentityFromUrl_();
      var op = OperatorContext.read();
      if (!op || !op.userId) return null;
      var minPerm = opts.minPermission != null ? opts.minPermission : 0;
      if ((op.permission || 0) < minPerm) return null;
      var hubOp = readHubOperator_();
      var cachedUid = readSessionWrapped_(SESSION_AUTH_PREFIX + 'uid:' + op.userId, AUTH_TTL_MS);
      if (hubOp) {
        return Object.assign(buildHubSession_(cachedUid || {
          user_id: op.userId,
          display_name: op.displayName || op.userName || '',
          permission: op.permission || 0
        }), { provisional: true });
      }
      if (cachedUid && (cachedUid.permission || 0) >= minPerm) {
        return {
          fromHub: false,
          provisional: true,
          profile: { userId: cachedUid.user_id, displayName: cachedUid.display_name },
          idToken: '',
          auth: cachedUid
        };
      }
      return null;
    },
    cacheSession: function (session) {
      notifyUiOperator_(session);
    },
    formContext: function (sessionOrToken) {
      return post({ action: 'accounting_form_context', auth: resolveAuth(sessionOrToken) });
    },
    initSupervisorSession: async function (opts) {
      var session = await initStaffSessionCore_(opts);
      if (!session) return null;
      if ((session.auth.permission || 0) < SUPERVISOR_MIN_PERMISSION) {
        throw new Error(SUPERVISOR_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    initVendorPaymentApproveSession: async function (opts) {
      var session = await initStaffSessionCore_(opts);
      if (!session) return null;
      if ((session.auth.permission || 0) < VENDOR_PAYMENT_APPROVE_MIN_PERMISSION) {
        throw new Error(VENDOR_PAYMENT_APPROVE_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    vendorPaymentList: function (sessionOrToken, status) {
      return post({
        action: 'vendor_payment_list',
        auth: resolveAuth(sessionOrToken),
        status: status || 'pending_review'
      });
    },
    vendorPaymentApprove: function (sessionOrToken, paymentRequestId, patch) {
      var body = {
        action: 'vendor_payment_approve',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId,
        project_no: patch && patch.project_no,
        amount: patch && patch.amount,
        item_desc: patch && patch.item_desc
      };
      if (patch && patch.allocations && patch.allocations.length) {
        body.allocations = patch.allocations;
      }
      if (patch && patch.note != null) body.note = patch.note;
      return post(body);
    },
    vendorPaymentReject: function (sessionOrToken, paymentRequestId, reason) {
      return post({
        action: 'vendor_payment_reject',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId,
        reject_reason: reason || ''
      });
    },
    vendorPaymentCreate: function (sessionOrToken, payload) {
      return post({
        action: 'vendor_payment_create',
        auth: resolveAuth(sessionOrToken),
        vendor_id: payload.vendor_id,
        employee_user_id: payload.employee_user_id,
        vendor_name: payload.vendor_name,
        amount: payload.amount,
        project_no: payload.project_no,
        item_desc: payload.item_desc,
        txn_date: payload.txn_date,
        note: payload.note,
        bank_code: payload.bank_code,
        account_no: payload.account_no,
        account_name: payload.account_name,
        doc_type: payload.doc_type
      });
    },
    paymentRequestContext: function (sessionOrToken) {
      return post({
        action: 'payment_request_context',
        auth: resolveAuth(sessionOrToken)
      });
    },
    staffPaymentSubmit: function (sessionOrToken, payload) {
      return post({
        action: 'staff_payment_submit',
        auth: resolveAuth(sessionOrToken),
        vendor_id: payload.vendor_id,
        employee_user_id: payload.employee_user_id,
        vendor_name: payload.vendor_name,
        amount: payload.amount,
        project_no: payload.project_no,
        item_desc: payload.item_desc,
        txn_date: payload.txn_date,
        note: payload.note,
        bank_code: payload.bank_code,
        account_no: payload.account_no,
        account_name: payload.account_name,
        doc_type: payload.doc_type,
        drive_urls: payload.drive_urls
      });
    },
    paymentRequestComposeSubmit: function (sessionOrToken, payload) {
      return post({
        action: 'payment_request_compose_submit',
        auth: resolveAuth(sessionOrToken),
        vendor_id: payload.vendor_id,
        employee_user_id: payload.employee_user_id,
        vendor_name: payload.vendor_name,
        doc_type: payload.doc_type,
        order_no: payload.order_no,
        note: payload.note,
        bank_code: payload.bank_code,
        account_no: payload.account_no,
        account_name: payload.account_name,
        allocations: payload.allocations || [],
        photos: payload.photos || [],
        from_line: payload.from_line
      });
    },
    paymentRequestComposeDraft: function (sessionOrToken, draftToken) {
      return post({
        action: 'payment_request_compose_draft',
        auth: resolveAuth(sessionOrToken),
        draft_token: draftToken
      });
    },
    paymentRequestOcrAnalyze: function (sessionOrToken, payload, timeoutMs) {
      return post({
        action: 'payment_request_ocr_analyze',
        auth: resolveAuth(sessionOrToken),
        draft_id: payload.draft_id,
        photo_ids: payload.photo_ids || [],
        photos: payload.photos || [],
        vendor_id: payload.vendor_id || '',
        project_no: payload.project_no || '',
        force_vendor_hint: !!payload.force_vendor_hint,
        ocr_stage: payload.ocr_stage || '',
        prefer_vendor_hint: payload.prefer_vendor_hint || ''
      }, timeoutMs || 0);
    },
    vendorPaymentOcrCommonHintGet: function (sessionOrToken) {
      return post({
        action: 'vendor_payment_ocr_common_hint_get',
        auth: resolveAuth(sessionOrToken)
      });
    },
    vendorPaymentOcrCommonHintSet: function (sessionOrToken, commonHint) {
      return post({
        action: 'vendor_payment_ocr_common_hint_set',
        auth: resolveAuth(sessionOrToken),
        common_hint: commonHint == null ? '' : String(commonHint)
      });
    },
    paymentRequestSubmit: function (sessionOrToken, payload) {
      return post({
        action: 'payment_request_submit',
        auth: resolveAuth(sessionOrToken),
        submit_mode: payload.submit_mode || 'review',
        draft_id: payload.draft_id,
        vendor_id: payload.vendor_id,
        employee_user_id: payload.employee_user_id,
        vendor_name: payload.vendor_name,
        doc_type: payload.doc_type,
        order_no: payload.order_no,
        txn_date: payload.txn_date,
        note: payload.note,
        bank_code: payload.bank_code,
        account_no: payload.account_no,
        account_name: payload.account_name,
        allocations: payload.allocations || [],
        photos: payload.photos || [],
        from_line: payload.from_line
      });
    },
    vendorPaymentUpdate: function (sessionOrToken, paymentRequestId, patch) {
      return post({
        action: 'vendor_payment_update',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId,
        amount: patch.amount,
        project_no: patch.project_no,
        item_desc: patch.item_desc,
        txn_date: patch.txn_date,
        note: patch.note,
        bank_code: patch.bank_code,
        account_no: patch.account_no,
        account_name: patch.account_name,
        doc_type: patch.doc_type,
        remit_fee_apply: patch.remit_fee_apply
      });
    },
    vendorPaymentExportCtbc: function (sessionOrToken, paymentRequestIds, options) {
      options = options || {};
      return post({
        action: 'vendor_payment_export_ctbc',
        auth: resolveAuth(sessionOrToken),
        payment_request_ids: paymentRequestIds || []
      });
    },
    vendorPaymentDelete: function (sessionOrToken, paymentRequestId) {
      return post({
        action: 'vendor_payment_delete',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId
      });
    },
    vendorPaymentMarkPaid: function (sessionOrToken, paymentRequestIds, options) {
      options = options || {};
      return post({
        action: 'vendor_payment_mark_paid',
        auth: resolveAuth(sessionOrToken),
        payment_request_ids: paymentRequestIds || [],
        mark_all: options.mark_all === true,
        line_push: options.line_push !== false,
        repair_missing_ledger: options.repair_missing_ledger === true
      });
    },
    /** 已匯款但缺收支列 → 補寫（不推播） */
    vendorPaymentRepairLedger: function (sessionOrToken, opts) {
      opts = opts || {};
      return post({
        action: 'vendor_payment_repair_ledger',
        auth: resolveAuth(sessionOrToken),
        payment_request_ids: opts.payment_request_ids || opts.ids || [],
        ingest_ids: opts.ingest_ids || []
      });
    },
    ledgerReviewBundle: function (sessionOrToken, filter) {
      return post({
        action: 'ledger_review_bundle',
        auth: resolveAuth(sessionOrToken),
        filter: filter || {}
      });
    },
    cleanupTestData: function (sessionOrToken, confirm) {
      return post({
        action: 'accounting_cleanup_test',
        auth: resolveAuth(sessionOrToken),
        confirm: !!confirm
      });
    },
    initLiff: async function (opts) {
      opts = opts || {};
      if (isInHubIframe_()) {
        var hubOpInline = readHubOperator_();
        if (hubOpInline) {
          var authInline = await post({
            action: 'accounting_auth_me',
            user_id: hubOpInline.userId,
            auth: { user_id: hubOpInline.userId }
          });
          if (!authInline.success) throw new Error(authInline.message || '驗證失敗');
          return buildHubSession_(authInline);
        }
        throw new Error(HUB_RELOGIN_MSG);
      }
      var policy = await AccountingApi.loadPolicy();
      var liffId = resolveLiffIdForInit_(opts, policy);
      if (!liffId) throw new Error('LIFF 尚未設定');
      if (typeof liff === 'undefined') throw new Error('請用 LINE 開啟');
      await liff.init({ liffId: liffId });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return null;
      }
      var profile = await liff.getProfile();
      var idToken = liff.getIDToken();
      var auth = await AccountingApi.authMe(idToken);
      if (!auth.success) throw new Error(auth.message || '驗證失敗');
      return { devBypass: false, profile: profile, idToken: idToken, auth: auth };
    },
    /** 從主控台進來用本分頁身分；直接開網址才走 LINE。門檻預設 ≥4（財務頁）；選單／日常頁請傳 minPermission */
    initSession: async function (opts) {
      opts = opts || {};
      var session = await initStaffSessionCore_(opts);
      if (!session) return null;
      var minPerm = opts.minPermission != null ? opts.minPermission : MIN_PERMISSION;
      if ((session.auth.permission || 0) < minPerm) {
        var denied = opts.deniedMsg;
        if (!denied) {
          if (minPerm >= MIN_PERMISSION) denied = PERM_DENIED_MSG;
          else if (minPerm >= SUPERVISOR_MIN_PERMISSION) denied = SUPERVISOR_DENIED_MSG;
          else if (minPerm >= INGEST_MIN_PERMISSION) denied = INGEST_PERM_DENIED_MSG;
          else denied = '權限不足（需權限 ≥ ' + minPerm + '）';
        }
        throw new Error(denied);
      }
      notifyUiOperator_(session);
      return session;
    },
    /** 收支登錄：權限 ≥ 2 */
    initIngestSession: async function (opts) {
      var session = await initStaffSessionCore_(opts);
      if (!session) return null;
      if ((session.auth.permission || 0) < INGEST_MIN_PERMISSION) {
        throw new Error(INGEST_PERM_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    /** 待付款申請／款項進度：在職員工或已登記廠商（登入即可） */
    initPaymentRequestSession: async function (opts) {
      opts = opts || {};
      var hubOpPr = readHubOperator_();
      var session;
      if (hubOpPr) {
        var authPr = await post({
          action: 'payment_request_auth_me',
          user_id: hubOpPr.userId,
          auth: { user_id: hubOpPr.userId }
        });
        if (!authPr.success) throw new Error(authPr.message || '驗證失敗');
        session = buildHubSession_(authPr);
      } else {
        session = await AccountingApi.initLiff(opts);
        if (!session) return null;
        var authBody = isHubStaffSession_(session)
          ? { action: 'payment_request_auth_me', user_id: session.auth.user_id, auth: { user_id: session.auth.user_id } }
          : { action: 'payment_request_auth_me', liff_id_token: session.idToken };
        var authRes = await post(authBody);
        if (!authRes.success) throw new Error(authRes.message || '驗證失敗');
        session.auth = authRes;
      }
      if (!session) return null;
      if (String(session.auth.status || '') === '廠商') {
        notifyUiOperator_(session);
        return session;
      }
      if ((session.auth.permission || 0) < PAYMENT_REQUEST_MIN_PERMISSION) {
        throw new Error(PAYMENT_REQUEST_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    /** 廠商自填頁：LIFF 登入，不需員工權限 */
    initVendorSession: async function (opts) {
      opts = opts || {};
      var policy = await AccountingApi.loadPolicy();
      if (policy.authBypass) {
        var auth = await post({ action: 'vendor_register_auth_me', dev_bypass: true });
        if (!auth.success) throw new Error(auth.message || '驗證失敗');
        return {
          devBypass: true,
          profile: { userId: auth.user_id, displayName: auth.display_name },
          idToken: '',
          auth: auth,
          vendor: auth.vendor || null,
          bindings: auth.bindings || []
        };
      }
      var liffId = opts.liffId || policy.liffId || '';
      if (!liffId) throw new Error('LIFF 尚未設定');
      if (typeof liff === 'undefined') throw new Error('請用 LINE 開啟此頁面');
      await liff.init({ liffId: liffId });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return null;
      }
      var profile = await liff.getProfile();
      var idToken = liff.getIDToken();
      var authRes = await post({ action: 'vendor_register_auth_me', liff_id_token: idToken });
      if (!authRes.success) throw new Error(authRes.message || '驗證失敗');
      var ctx = null;
      try { ctx = liff.getContext(); } catch (eCtx) {}
      return {
        devBypass: false,
        profile: profile,
        idToken: idToken,
        liffContext: ctx,
        auth: authRes,
        vendor: authRes.vendor || null,
        bindings: authRes.bindings || []
      };
    },
    vendorRegisterGet: function (session) {
      var body = { action: 'vendor_register_get', liff_id_token: session.idToken || '' };
      if (session.devBypass) body.dev_bypass = true;
      return post(body);
    },
    vendorRegisterSubmit: function (session, payload) {
      var body = {
        action: 'vendor_register_submit',
        liff_id_token: session.idToken || '',
        payload: payload || {}
      };
      if (session.devBypass) body.dev_bypass = true;
      return post(body);
    },
    vendorRegisterOcr: function (session, photo, kind) {
      var body = {
        action: 'vendor_register_ocr',
        liff_id_token: session.idToken || '',
        photo: photo || {},
        kind: kind || (photo && photo.kind) || 'passbook'
      };
      if (session.devBypass) body.dev_bypass = true;
      return post(body);
    },
    employeeBankOcr: function (sessionOrToken, photo, kind, operatorUserId) {
      var auth = resolveAuth(sessionOrToken);
      var body = {
        action: 'employee_bank_ocr',
        photo: photo || {},
        kind: kind || (photo && photo.kind) || 'passbook',
        operatorUserId: operatorUserId || ''
      };
      if (auth.liff_id_token) body.liff_id_token = auth.liff_id_token;
      if (auth.dev_bypass) {
        body.dev_bypass = true;
        if (auth.dev_permission) body.dev_permission = auth.dev_permission;
        if (auth.dev_user_id) body.dev_user_id = auth.dev_user_id;
      }
      return post(body);
    },
    payrollRequestList: function (sessionOrToken, filter) {
      return post(Object.assign({
        action: 'payroll_request_list',
        auth: resolveAuth(sessionOrToken)
      }, filter || {}));
    },
    payrollRequestApprove: function (sessionOrToken, payload) {
      return post(Object.assign({
        action: 'payroll_request_approve',
        auth: resolveAuth(sessionOrToken)
      }, payload || {}));
    },
    payrollRequestReject: function (sessionOrToken, payload) {
      return post(Object.assign({
        action: 'payroll_request_reject',
        auth: resolveAuth(sessionOrToken)
      }, payload || {}));
    },
    payrollRequestExport: function (sessionOrToken, payrollRequestIds, options) {
      return post(Object.assign({
        action: 'payroll_request_export',
        auth: resolveAuth(sessionOrToken),
        payroll_request_ids: payrollRequestIds || []
      }, options || {}), 120000);
    },
    payrollRequestMarkPaid: function (sessionOrToken, payrollRequestIds, options) {
      return post(Object.assign({
        action: 'payroll_request_mark_paid',
        auth: resolveAuth(sessionOrToken),
        payroll_request_ids: payrollRequestIds || []
      }, options || {}), 120000);
    },
    payrollRequestNotifyPayslip: function (sessionOrToken, payrollRequestId) {
      return post({
        action: 'payroll_request_notify_payslip',
        auth: resolveAuth(sessionOrToken),
        payroll_request_id: payrollRequestId
      });
    },
    payrollRequestManualBackfill: function (sessionOrToken, payload) {
      return post(Object.assign({
        action: 'payroll_request_manual_backfill',
        auth: resolveAuth(sessionOrToken)
      }, payload || {}), 120000);
    },
    cfOverview: function (sessionOrToken, showClosed) {
      return post({
        action: 'margin_customer_finance_overview',
        auth: resolveAuth(sessionOrToken),
        show_closed: !!showClosed
      });
    },
    cfDetail: function (sessionOrToken, projectNo) {
      return post({
        action: 'margin_customer_finance_detail',
        auth: resolveAuth(sessionOrToken),
        project_no: projectNo
      });
    },
    cfTodos: function (sessionOrToken, openOnly) {
      return post({
        action: 'margin_customer_finance_todos',
        auth: resolveAuth(sessionOrToken),
        open_only: openOnly !== false
      });
    },
    cfAdjCreate: function (sessionOrToken, payload) {
      return post(Object.assign({ action: 'margin_adjustment_create', auth: resolveAuth(sessionOrToken) }, payload || {}));
    },
    cfAdjUpdate: function (sessionOrToken, payload) {
      return post(Object.assign({ action: 'margin_adjustment_update', auth: resolveAuth(sessionOrToken) }, payload || {}));
    },
    cfAdjSubmit: function (sessionOrToken, adjustmentId) {
      return post({ action: 'margin_adjustment_submit', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId });
    },
    cfAdjWithdraw: function (sessionOrToken, adjustmentId) {
      return post({ action: 'margin_adjustment_withdraw', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId });
    },
    cfAdjVoid: function (sessionOrToken, adjustmentId, reason) {
      return post({ action: 'margin_adjustment_void', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId, void_reason: reason || '' });
    },
    cfAdjCompanyConfirm: function (sessionOrToken, adjustmentId) {
      return post({ action: 'margin_adjustment_company_confirm', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId });
    },
    cfRecCreate: function (sessionOrToken, payload) {
      return post(Object.assign({ action: 'margin_receipt_create', auth: resolveAuth(sessionOrToken) }, payload || {}));
    },
    cfRecUpdate: function (sessionOrToken, payload) {
      return post(Object.assign({ action: 'margin_receipt_update', auth: resolveAuth(sessionOrToken) }, payload || {}));
    },
    cfRecSubmit: function (sessionOrToken, receiptId) {
      return post({ action: 'margin_receipt_submit', auth: resolveAuth(sessionOrToken), receipt_id: receiptId });
    },
    cfRecSignDesigner: function (sessionOrToken, receiptId) {
      return post({ action: 'margin_receipt_sign_designer', auth: resolveAuth(sessionOrToken), receipt_id: receiptId });
    },
    cfRecSignFinance: function (sessionOrToken, receiptId) {
      return post({ action: 'margin_receipt_sign_finance', auth: resolveAuth(sessionOrToken), receipt_id: receiptId });
    },
    cfRecVoid: function (sessionOrToken, receiptId, reason) {
      return post({ action: 'margin_receipt_void', auth: resolveAuth(sessionOrToken), receipt_id: receiptId, void_reason: reason || '' });
    },
    cfRecIncomeApprove: function (sessionOrToken, receiptId, note) {
      return post({
        action: 'margin_receipt_income_approve',
        auth: resolveAuth(sessionOrToken),
        receipt_id: receiptId,
        note: note || ''
      });
    },
    cfRecIncomeReject: function (sessionOrToken, receiptId, note) {
      return post({
        action: 'margin_receipt_income_reject',
        auth: resolveAuth(sessionOrToken),
        receipt_id: receiptId,
        note: note || ''
      });
    },
    cfRecIncomeApproveBulk: function (sessionOrToken, projectNo, note) {
      return post({
        action: 'margin_receipt_income_approve_bulk',
        auth: resolveAuth(sessionOrToken),
        project_no: projectNo,
        note: note || ''
      });
    },
    cfAdjExportPdf: function (sessionOrToken, adjustmentId) {
      return post({
        action: 'margin_adjustment_export_pdf',
        auth: resolveAuth(sessionOrToken),
        adjustment_id: adjustmentId
      });
    },
    cfPortalBind: function (sessionOrToken, payload) {
      return post(Object.assign({ action: 'client_portal_bind', auth: resolveAuth(sessionOrToken) }, payload || {}));
    },
    cfPortalRevoke: function (sessionOrToken, bindingId) {
      return post({ action: 'client_portal_revoke', auth: resolveAuth(sessionOrToken), binding_id: bindingId });
    },
    officialCustomerSearch: function (sessionOrToken, keyword, limit) {
      return post({
        action: 'official_customer_search',
        auth: resolveAuth(sessionOrToken),
        keyword: keyword,
        limit: limit || 20
      });
    },
    officialCustomerList: function (sessionOrToken, limit) {
      return post({
        action: 'official_customer_search',
        auth: resolveAuth(sessionOrToken),
        fetch_all: true,
        limit: limit || 5000
      });
    },
    cachedOfficialCustomerSearch: async function (sessionOrToken, keyword, limit) {
      if (typeof AccountingListCache === 'undefined') {
        return AccountingApi.officialCustomerSearch(sessionOrToken, keyword, limit);
      }
      var items = await AccountingListCache.searchMasterList(
        sessionOrToken,
        AccountingListCache.MASTER_KEYS.official_customer,
        keyword,
        function () { return AccountingApi.officialCustomerList(sessionOrToken); },
        { limit: limit || 20, filterFields: ['name', 'line_id', 'project_codes'] }
      );
      return { success: true, items: items, cached: true };
    },
    /** 選材 — 設計師寫入（project-console） */
    materialCreate: function (sessionOrToken, payload) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, Object.assign({ action: 'margin_material_create' }, payload || {})));
    },
    materialUpdate: function (sessionOrToken, payload) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, Object.assign({ action: 'margin_material_update' }, payload || {})));
    },
    materialVoid: function (sessionOrToken, materialId) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, { action: 'margin_material_void', material_id: materialId }));
    },
    materialUploadPhoto: function (sessionOrToken, payload) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, {
        action: 'margin_material_upload_photo',
        material_id: payload.material_id,
        project_no: payload.project_no,
        photos: payload.photos || []
      }));
    },
    materialDesignerList: function (sessionOrToken, projectNo) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, { action: 'margin_material_designer_list', project_no: projectNo }));
    },
    materialAuditLog: function (sessionOrToken, filter) {
      return postMaterial(buildMaterialPostBody_(sessionOrToken, {
        action: 'margin_material_audit_log',
        material_id: (filter && filter.material_id) || '',
        project_no: (filter && filter.project_no) || ''
      }));
    },
    /** 選材 — 客戶唯讀（project-console） */
    materialPortalList: function (sessionOrToken, projectNo, opts) {
      opts = opts || {};
      var body = buildMaterialPostBody_(sessionOrToken, {
        action: 'margin_material_portal_list',
        project_no: projectNo
      });
      if (opts.staffPreview) {
        body.staff_preview = true;
        if (body.auth) body.auth.staff_preview = true;
      }
      return postMaterial(body);
    },
    materialPortalDetail: function (sessionOrToken, materialId, opts) {
      opts = opts || {};
      var body = buildMaterialPostBody_(sessionOrToken, {
        action: 'margin_material_portal_detail',
        material_id: materialId
      });
      if (opts.staffPreview) {
        body.staff_preview = true;
        if (body.auth) body.auth.staff_preview = true;
      }
      return postMaterial(body);
    },
    cfPortalAuth: function (sessionOrToken, opts) {
      opts = opts || {};
      var body = { action: 'margin_customer_finance_portal_auth', auth: resolveAuth(sessionOrToken) };
      if (opts.staffPreview) body.staff_preview = true;
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
        if (sessionOrToken.devPermission) body.dev_permission = sessionOrToken.devPermission;
      }
      return post(body);
    },
    cfPortalData: function (sessionOrToken, projectNo, opts) {
      opts = opts || {};
      var body = { action: 'margin_customer_finance_portal_data', auth: resolveAuth(sessionOrToken), project_no: projectNo };
      if (opts.staffPreview) body.staff_preview = true;
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
        if (sessionOrToken.devPermission) body.dev_permission = sessionOrToken.devPermission;
      }
      return post(body);
    },
    cfAdjCustomerConfirm: function (sessionOrToken, adjustmentId) {
      var body = { action: 'margin_adjustment_customer_confirm_content', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.staffPreview) {
        body.staff_preview = true;
      }
      return post(body);
    },
    cfAdjCustomerSign: function (sessionOrToken, adjustmentId, signData) {
      var body = { action: 'margin_adjustment_customer_sign', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId, sign_data_base64: signData || '' };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.staffPreview) {
        body.staff_preview = true;
      }
      return post(body);
    },
    cfRecCustomerStage1: function (sessionOrToken, receiptId) {
      var body = { action: 'margin_receipt_customer_confirm_stage1', auth: resolveAuth(sessionOrToken), receipt_id: receiptId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.staffPreview) {
        body.staff_preview = true;
      }
      return post(body);
    },
    cfRecCustomerStage2: function (sessionOrToken, receiptId) {
      var body = { action: 'margin_receipt_customer_confirm_stage2', auth: resolveAuth(sessionOrToken), receipt_id: receiptId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.staffPreview) {
        body.staff_preview = true;
      }
      return post(body);
    },
    initCustomerFinanceSession: async function (opts) {
      var session = await initStaffSessionCore_(opts);
      if (!session) return null;
      if ((session.auth.permission || 0) < CUSTOMER_FINANCE_MIN_PERMISSION) {
        throw new Error(CUSTOMER_FINANCE_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    /**
     * 客戶 LIFF 登入；opts.staffPreview=true 時改走員工身分，可看全部案號（唯讀）。
     * 開發測試（略過登入）同樣走員工預覽，才列得出全部案件。
     */
    initCustomerPortalSession: async function (opts) {
      opts = opts || {};
      var policyForPreview = await AccountingApi.loadPolicy();
      var wantStaffPreview = !!(opts.staffPreview || (policyForPreview && policyForPreview.authBypass));
      if (wantStaffPreview) {
        if (policyForPreview && policyForPreview.authBypass) {
          var packStaff = devBypassAuthBody_('margin_customer_finance_portal_auth');
          packStaff.body.staff_preview = true;
          var portalBypass = await post(packStaff.body);
          if (!portalBypass.success) throw new Error(portalBypass.message || '員工預覽驗證失敗');
          return {
            devBypass: true,
            staffPreview: true,
            devUserId: packStaff.opts.dev_user_id || '',
            idToken: '',
            profile: { userId: portalBypass.user_id, displayName: portalBypass.display_name },
            portal: portalBypass
          };
        }
        var empSession = AccountingApi.tryCachedSession({
          minPermission: CUSTOMER_FINANCE_MIN_PERMISSION,
          authAction: 'accounting_auth_me'
        });
        if (!empSession) {
          empSession = await AccountingApi.initCustomerFinanceSession(opts);
        }
        if (!empSession) return null;
        var portalStaff = await AccountingApi.cfPortalAuth(empSession, { staffPreview: true });
        if (!portalStaff.success) throw new Error(portalStaff.message || '員工預覽驗證失敗');
        empSession.staffPreview = true;
        empSession.portal = portalStaff;
        notifyUiOperator_(empSession);
        return empSession;
      }
      var session = await AccountingApi.initLiff(opts);
      if (!session || !session.idToken) throw new Error('LIFF 登入失敗');
      var portal = await AccountingApi.cfPortalAuth(session);
      if (!portal.success) throw new Error(portal.message || '客戶綁定驗證失敗');
      session.portal = portal;
      return session;
    },
    primeHubIdentityFromUrl: primeHubIdentityFromUrl_,
    requestParentHubLiffToken: requestParentHubLiffToken_
  };
})();
if (typeof OperatorContext === 'undefined') {
  AccountingApi.primeHubIdentityFromUrl();
}
