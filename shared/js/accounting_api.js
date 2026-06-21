/**
 * accounting-gas API 共用（LIFF 靜態頁）
 */
var AccountingApi = (function () {
  var GAS_API = 'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';
  var MIN_PERMISSION = 4;
  var SUPERVISOR_MIN_PERMISSION = 3;
  var VENDOR_PAYMENT_APPROVE_MIN_PERMISSION = 5;
  var PERM_DENIED_MSG = '權限不足（需財務／老闆，權限 ≥ 4）';
  var SUPERVISOR_DENIED_MSG = '權限不足（需主管，權限 ≥ 3）';
  var VENDOR_PAYMENT_APPROVE_DENIED_MSG = '權限不足（廠商請款審核需權限 ≥ 5）';

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
    SUPERVISOR_MIN_PERMISSION: SUPERVISOR_MIN_PERMISSION,
    VENDOR_PAYMENT_APPROVE_MIN_PERMISSION: VENDOR_PAYMENT_APPROVE_MIN_PERMISSION,
    PERM_DENIED_MSG: PERM_DENIED_MSG,
    SUPERVISOR_DENIED_MSG: SUPERVISOR_DENIED_MSG,
    VENDOR_PAYMENT_APPROVE_DENIED_MSG: VENDOR_PAYMENT_APPROVE_DENIED_MSG,
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
    vendorUploadPhotos: function (sessionOrToken, vendorId, photos) {
      return post({
        action: 'vendor_upload_photos',
        auth: resolveAuth(sessionOrToken),
        vendor_id: vendorId,
        photos: photos || []
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
    formContext: function (sessionOrToken) {
      return post({ action: 'accounting_form_context', auth: resolveAuth(sessionOrToken) });
    },
    initSupervisorSession: async function (opts) {
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
      if ((session.auth.permission || 0) < SUPERVISOR_MIN_PERMISSION) {
        throw new Error(SUPERVISOR_DENIED_MSG);
      }
      return session;
    },
    initVendorPaymentApproveSession: async function (opts) {
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
      if ((session.auth.permission || 0) < VENDOR_PAYMENT_APPROVE_MIN_PERMISSION) {
        throw new Error(VENDOR_PAYMENT_APPROVE_DENIED_MSG);
      }
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
      return post({
        action: 'vendor_payment_approve',
        auth: resolveAuth(sessionOrToken),
        payment_request_id: paymentRequestId,
        project_no: patch && patch.project_no,
        amount: patch && patch.amount,
        item_desc: patch && patch.item_desc
      });
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
        doc_type: patch.doc_type
      });
    },
    vendorPaymentExportCtbc: function (sessionOrToken, paymentRequestIds) {
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
