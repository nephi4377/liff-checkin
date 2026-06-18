/**
 * accounting-gas API 共用（LIFF 靜態頁）
 */
var AccountingApi = (function () {
  var GAS_API = 'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';

  async function post(body) {
    var res = await fetch(GAS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  return {
    GAS_API: GAS_API,
    post: post,
    authMe: function (idToken) {
      return post({ action: 'accounting_auth_me', liff_id_token: idToken });
    },
    crudList: function (idToken, entity, filter) {
      return post({ action: 'crud_list', entity: entity, auth: { liff_id_token: idToken }, filter: filter || {} });
    },
    crudCreate: function (idToken, entity, payload) {
      return post({ action: 'crud_create', entity: entity, auth: { liff_id_token: idToken }, payload: payload });
    },
    crudUpdate: function (idToken, entity, id, payload) {
      return post({ action: 'crud_update', entity: entity, id: id, auth: { liff_id_token: idToken }, payload: payload });
    },
    vendorPaymentStatus: function (idToken, filter) {
      return post({ action: 'vendor_payment_status', auth: { liff_id_token: idToken }, filter: filter || {} });
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
      return { profile: profile, idToken: idToken, auth: auth };
    }
  };
})();
