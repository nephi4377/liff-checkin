/**
 * accounting-gas API 共用（LIFF 靜態頁）
 */
var AccountingApi = (function () {
  var GAS_API = 'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';
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

  async function post(body, timeoutMs) {
    var actionName = (body && body.action) || 'api';
    var trackUi = actionName !== 'accounting_client_log';
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
      var res = await fetch(GAS_API, opts);
      var text = await res.text();
      if (shouldRetryGasHtml_(res, text)) {
        await new Promise(function (r) { setTimeout(r, 2000); });
        res = await fetch(GAS_API, opts);
        text = await res.text();
      }
      var parsed = parseJsonResponse_(res, text);
      if (trackUi && typeof AccountingUi !== 'undefined' && AccountingUi.apiEnd) {
        var extra = parsed && parsed.success === false && parsed.message ? parsed.message : '';
        if (parsed && parsed.gas_cached) extra = (extra ? extra + ' · ' : '') + 'GAS 快取';
        AccountingUi.apiEnd(actionName, Date.now() - t0, !!(parsed && parsed.success !== false), extra);
      }
      return parsed;
    } catch (e) {
      if (trackUi && typeof AccountingUi !== 'undefined' && AccountingUi.apiEnd) {
        AccountingUi.apiEnd(actionName, Date.now() - t0, false, e.message || String(e));
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
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

  function buildAuth(session) {
    if (!session) return {};
    if (session.devBypass) {
      var a = { dev_bypass: true };
      if (session.devPermission) a.dev_permission = session.devPermission;
      if (session.devUserId) a.dev_user_id = session.devUserId;
      return a;
    }
    return { liff_id_token: session.idToken || '' };
  }

  function resolveAuth(sessionOrToken) {
    if (typeof sessionOrToken === 'string') {
      return { liff_id_token: sessionOrToken };
    }
    return buildAuth(sessionOrToken);
  }

  return {
    GAS_API: GAS_API,
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
    buildAuth: buildAuth,
    authMe: function (sessionOrToken) {
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        var pack = devBypassAuthBody_('accounting_auth_me');
        if (sessionOrToken.devPermission) pack.body.dev_permission = sessionOrToken.devPermission;
        if (sessionOrToken.devUserId) pack.body.dev_user_id = sessionOrToken.devUserId;
        return post(pack.body);
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
    vendorPaymentStatus: function (sessionOrToken, filter) {
      return post({ action: 'vendor_payment_status', auth: resolveAuth(sessionOrToken), filter: filter || {} });
    },
    bootstrap: function (sessionOrToken, timeoutMs) {
      return post({ action: 'accounting_bootstrap', auth: resolveAuth(sessionOrToken) }, timeoutMs || 120000);
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
    marginListOverview: function (sessionOrToken) {
      return post({ action: 'margin_list_overview', auth: resolveAuth(sessionOrToken) });
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
      var policy = readSessionWrapped_(SESSION_POLICY_KEY, POLICY_TTL_MS);
      if (!policy) return null;
      var minPerm = opts.minPermission != null ? opts.minPermission : MIN_PERMISSION;
      if (policy.authBypass || readSessionWrapped_(SESSION_AUTH_PREFIX + 'mode:dev', AUTH_TTL_MS)) {
        var pack = devBypassAuthBody_(opts.authAction || 'accounting_auth_me');
        var auth = readSessionWrapped_(SESSION_AUTH_PREFIX + 'dev:' + (pack.opts.dev_user_id || '') + ':' + (pack.opts.dev_permission || 0), AUTH_TTL_MS);
        if (!auth || (auth.permission || 0) < minPerm) return null;
        return buildDevBypassSession_(auth, pack.opts);
      }
      var token = '';
      try { token = sessionStorage.getItem(SESSION_TOKEN_KEY) || ''; } catch (eTok) {}
      if (!token) return null;
      var authHub = readSessionWrapped_(SESSION_AUTH_PREFIX + 'liff:' + simpleHash_(token), AUTH_TTL_MS);
      if (!authHub || (authHub.permission || 0) < minPerm) return null;
      return {
        devBypass: false,
        profile: { userId: authHub.user_id, displayName: authHub.display_name },
        idToken: token,
        auth: authHub
      };
    },
    /** 身分快取未命中時：用 HUB 已寫入的操作者 + 政策快取先顯示，背景再 initSession */
    tryProvisionalSession: function (opts) {
      opts = opts || {};
      if (typeof OperatorContext === 'undefined') return null;
      var policy = readSessionWrapped_(SESSION_POLICY_KEY, POLICY_TTL_MS);
      if (!policy) return null;
      var op = OperatorContext.read();
      if (!op || !op.userId) return null;
      var minPerm = opts.minPermission != null ? opts.minPermission : 0;
      if ((op.permission || 0) < minPerm) return null;
      var token = '';
      try { token = sessionStorage.getItem(SESSION_TOKEN_KEY) || ''; } catch (eTok) {}
      return {
        devBypass: !!(policy.authBypass),
        devPermission: op.permission || 0,
        devUserId: op.userId,
        profile: { userId: op.userId, displayName: op.displayName || op.userName || '' },
        idToken: token,
        auth: {
          user_id: op.userId,
          display_name: op.displayName || op.userName || '',
          permission: op.permission || 0
        },
        provisional: true
      };
    },
    cacheSession: function (session) {
      notifyUiOperator_(session);
    },
    formContext: function (sessionOrToken) {
      return post({ action: 'accounting_form_context', auth: resolveAuth(sessionOrToken) });
    },
    initSupervisorSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var pack = devBypassAuthBody_('accounting_auth_me');
        var auth = await post(pack.body);
        if (!auth.success) throw new Error(auth.message || '驗證失敗');
        session = buildDevBypassSession_(auth, pack.opts);
      } else {
        session = await AccountingApi.initLiff(opts);
      }
      if (!session) return null;
      if ((session.auth.permission || 0) < SUPERVISOR_MIN_PERMISSION) {
        throw new Error(SUPERVISOR_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    initVendorPaymentApproveSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var pack2 = devBypassAuthBody_('accounting_auth_me');
        var auth2 = await post(pack2.body);
        if (!auth2.success) throw new Error(auth2.message || '驗證失敗');
        session = buildDevBypassSession_(auth2, pack2.opts);
      } else {
        session = await AccountingApi.initLiff(opts);
      }
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
        photos: payload.photos || []
      }, timeoutMs || 0);
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
        payment_request_ids: paymentRequestIds || [],
        line_push: options.line_push !== false
      });
    },
    vendorPaymentDelete: function (sessionOrToken, paymentRequestId) {
      return post({
        action: 'vendor_payment_delete',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId
      });
    },
    vendorPaymentMarkPaid: function (sessionOrToken, paymentRequestIds) {
      return post({
        action: 'vendor_payment_mark_paid',
        auth: resolveAuth(sessionOrToken),
        payment_request_ids: paymentRequestIds || []
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
      var policy = await AccountingApi.loadPolicy();
      if (isInHubIframe_()) {
        if (typeof AccountingUi !== 'undefined' && AccountingUi.setProgress) {
          AccountingUi.setProgress('向主控台索取登入憑證…');
        }
        var parentToken = await requestParentHubLiffToken_();
        if (parentToken) {
          var authHub = await AccountingApi.authMe(parentToken);
          if (authHub.success) {
            try { sessionStorage.setItem(SESSION_TOKEN_KEY, parentToken); } catch (eTokHub) {}
            return {
              devBypass: false,
              profile: { userId: authHub.user_id, displayName: authHub.display_name },
              idToken: parentToken,
              auth: authHub
            };
          }
        }
        var provHub = AccountingApi.tryProvisionalSession({
          minPermission: opts.minPermission != null ? opts.minPermission : 0,
          authAction: 'accounting_auth_me'
        });
        if (provHub && provHub.auth && provHub.auth.userId) {
          console.warn('[Accounting] Hub LIFF token 未取得，暫用 HUB 操作者身分');
          return provHub;
        }
        throw new Error('無法從主控台取得登入憑證，請關閉後重新從 LINE 開啟主控台');
      }
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
    /** policy 開 authBypass 時略過 LIFF；否則走 initLiff */
    initSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var pack3 = devBypassAuthBody_('accounting_auth_me');
        var auth3 = await post(pack3.body);
        if (!auth3.success) throw new Error(auth3.message || '驗證失敗');
        session = buildDevBypassSession_(auth3, pack3.opts);
      } else {
        session = await AccountingApi.initLiff(opts);
      }
      if (!session) return null;
      if ((session.auth.permission || 0) < MIN_PERMISSION) {
        throw new Error(PERM_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    /** 收支登錄：權限 ≥ 2 */
    initIngestSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var packIng = devBypassAuthBody_('accounting_auth_me');
        var authIng = await post(packIng.body);
        if (!authIng.success) throw new Error(authIng.message || '驗證失敗');
        session = buildDevBypassSession_(authIng, packIng.opts);
      } else {
        session = await AccountingApi.initLiff(opts);
      }
      if (!session) return null;
      if ((session.auth.permission || 0) < INGEST_MIN_PERMISSION) {
        throw new Error(INGEST_PERM_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    /** 待付款申請／款項進度：在職員工或已登記廠商（登入即可） */
    initPaymentRequestSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var packPr = devBypassAuthBody_('payment_request_auth_me');
        var authPr = await post(packPr.body);
        if (!authPr.success) throw new Error(authPr.message || '驗證失敗');
        session = buildDevBypassSession_(authPr, packPr.opts);
        session.auth = authPr;
      } else {
        session = await AccountingApi.initLiff(opts);
        if (!session) return null;
        var authRes = await post({ action: 'payment_request_auth_me', liff_id_token: session.idToken });
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
    payrollRequestExport: function (sessionOrToken, payrollRequestIds) {
      return post({
        action: 'payroll_request_export',
        auth: resolveAuth(sessionOrToken),
        payroll_request_ids: payrollRequestIds || []
      }, 120000);
    },
    payrollRequestMarkPaid: function (sessionOrToken, payrollRequestIds) {
      return post({
        action: 'payroll_request_mark_paid',
        auth: resolveAuth(sessionOrToken),
        payroll_request_ids: payrollRequestIds || []
      }, 120000);
    },
    payrollRequestNotifyPayslip: function (sessionOrToken, payrollRequestId) {
      return post({
        action: 'payroll_request_notify_payslip',
        auth: resolveAuth(sessionOrToken),
        payroll_request_id: payrollRequestId
      });
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
    cfPortalAuth: function (sessionOrToken) {
      var body = { action: 'margin_customer_finance_portal_auth', auth: resolveAuth(sessionOrToken) };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    cfPortalData: function (sessionOrToken, projectNo) {
      var body = { action: 'margin_customer_finance_portal_data', auth: resolveAuth(sessionOrToken), project_no: projectNo };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    cfAdjCustomerConfirm: function (sessionOrToken, adjustmentId) {
      var body = { action: 'margin_adjustment_customer_confirm_content', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    cfAdjCustomerSign: function (sessionOrToken, adjustmentId, signData) {
      var body = { action: 'margin_adjustment_customer_sign', auth: resolveAuth(sessionOrToken), adjustment_id: adjustmentId, sign_data_base64: signData || '' };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    cfRecCustomerStage1: function (sessionOrToken, receiptId) {
      var body = { action: 'margin_receipt_customer_confirm_stage1', auth: resolveAuth(sessionOrToken), receipt_id: receiptId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    cfRecCustomerStage2: function (sessionOrToken, receiptId) {
      var body = { action: 'margin_receipt_customer_confirm_stage2', auth: resolveAuth(sessionOrToken), receipt_id: receiptId };
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        body.dev_bypass = true;
        if (sessionOrToken.devUserId) body.dev_user_id = sessionOrToken.devUserId;
      }
      return post(body);
    },
    initCustomerFinanceSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      var session;
      if (policy.authBypass) {
        var pack = devBypassAuthBody_('accounting_auth_me');
        var auth = await post(pack.body);
        if (!auth.success) throw new Error(auth.message || '驗證失敗');
        session = buildDevBypassSession_(auth, pack.opts);
      } else {
        session = await AccountingApi.initLiff(opts);
      }
      if (!session) return null;
      if ((session.auth.permission || 0) < CUSTOMER_FINANCE_MIN_PERMISSION) {
        throw new Error(CUSTOMER_FINANCE_DENIED_MSG);
      }
      notifyUiOperator_(session);
      return session;
    },
    initCustomerPortalSession: async function (opts) {
      var policy = await AccountingApi.loadPolicy();
      if (policy.authBypass) {
        var pack = devBypassAuthBody_('margin_customer_finance_portal_auth');
        var portal = await post(pack.body);
        if (!portal.success) throw new Error(portal.message || '客戶綁定驗證失敗');
        return {
          devBypass: true,
          devUserId: pack.opts.dev_user_id || '',
          idToken: '',
          profile: { userId: portal.user_id, displayName: portal.display_name },
          portal: portal
        };
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
