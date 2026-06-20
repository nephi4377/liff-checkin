/**
 * accounting-gas API 共用（LIFF 靜態頁）
 */
var AccountingApi = (function () {
  var GAS_API = 'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';
  var MIN_PERMISSION = 4;
  var PERM_DENIED_MSG = '權限不足（需財務／老闆，權限 ≥ 4）';

  async function post(body) {
    var res = await fetch(GAS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  function buildAuth(session) {
    if (!session) return {};
    if (session.devBypass) return { dev_bypass: true };
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
    PERM_DENIED_MSG: PERM_DENIED_MSG,
    post: post,
    buildAuth: buildAuth,
    authMe: function (sessionOrToken) {
      if (typeof sessionOrToken === 'object' && sessionOrToken && sessionOrToken.devBypass) {
        return post({ action: 'accounting_auth_me', dev_bypass: true });
      }
      var token = typeof sessionOrToken === 'string' ? sessionOrToken : (sessionOrToken && sessionOrToken.idToken);
      return post({ action: 'accounting_auth_me', liff_id_token: token });
    },
    crudList: function (sessionOrToken, entity, filter) {
      return post({ action: 'crud_list', entity: entity, auth: resolveAuth(sessionOrToken), filter: filter || {} });
    },
    crudCreate: function (sessionOrToken, entity, payload) {
      return post({ action: 'crud_create', entity: entity, auth: resolveAuth(sessionOrToken), payload: payload });
    },
    crudUpdate: function (sessionOrToken, entity, id, payload) {
      return post({ action: 'crud_update', entity: entity, id: id, auth: resolveAuth(sessionOrToken), payload: payload });
    },
    vendorPaymentStatus: function (sessionOrToken, filter) {
      return post({ action: 'vendor_payment_status', auth: resolveAuth(sessionOrToken), filter: filter || {} });
    },
    bootstrap: function (sessionOrToken) {
      return post({ action: 'accounting_bootstrap', auth: resolveAuth(sessionOrToken) });
    },
    vendorEnsureFolder: function (sessionOrToken, vendorId) {
      return post({ action: 'vendor_ensure_folder', auth: resolveAuth(sessionOrToken), vendor_id: vendorId });
    },
    lineContactSearch: function (sessionOrToken, keyword, limit) {
      return post({
        action: 'line_contact_search',
        auth: resolveAuth(sessionOrToken),
        keyword: keyword,
        limit: limit || 20
      });
    },
    vendorListFiles: function (sessionOrToken, driveFolderId, limit) {
      return post({
        action: 'vendor_list_files',
        auth: resolveAuth(sessionOrToken),
        drive_folder_id: driveFolderId,
        limit: limit || 30
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
    marginUpdateLine: function (sessionOrToken, tabName, rowIndex, payload) {
      return post({
        action: 'margin_update_line',
        auth: resolveAuth(sessionOrToken),
        tab_name: tabName,
        row_index: rowIndex,
        payload: payload || {}
      });
    },
    loadPolicy: async function () {
      var data = await post({ action: 'accounting_policy' });
      return (data && data.policy) || {};
    },
    initLiff: async function (opts) {
      opts = opts || {};
      var policy = await AccountingApi.loadPolicy();
      var liffId = opts.liffId || policy.liffId || '';
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
        var auth = await post({ action: 'accounting_auth_me', dev_bypass: true });
        if (!auth.success) throw new Error(auth.message || '驗證失敗');
        session = {
          devBypass: true,
          profile: { userId: auth.user_id, displayName: auth.display_name },
          idToken: '',
          auth: auth
        };
      } else {
        session = await AccountingApi.initLiff(opts);
      }
      if (!session) return null;
      if ((session.auth.permission || 0) < MIN_PERMISSION) {
        throw new Error(PERM_DENIED_MSG);
      }
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
    }
  };
})();
