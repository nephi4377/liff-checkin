/**
 * HUB／會計子頁共用操作者身分（sessionStorage，分頁關閉即清除）
 * 見 SPEC/19_HUB與會計全域身分傳承.md §6
 */
var OperatorContext = (function () {
  var STORAGE_KEY = 'tanxin_operator_v1';
  var LEGACY_UID = 'acct_dev_user';
  var LEGACY_PERM = 'acct_dev_perm';

  function read() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.userId) return parsed;
      }
    } catch (e) {}
    var uid = '';
    var perm = 0;
    try {
      uid = sessionStorage.getItem(LEGACY_UID) || '';
      perm = parseInt(sessionStorage.getItem(LEGACY_PERM) || '0', 10) || 0;
    } catch (e2) {}
    if (!uid && !perm) return null;
    return {
      userId: uid,
      userName: '',
      displayName: '',
      permission: perm,
      hubLiffId: '',
      source: 'legacy',
      ts: Date.now()
    };
  }

  function write(op) {
    if (!op || !op.userId) return;
    var rec = {
      userId: String(op.userId || '').trim(),
      userName: String(op.userName || op.displayName || '').trim(),
      displayName: String(op.displayName || op.userName || '').trim(),
      permission: parseInt(op.permission, 10) || 0,
      hubLiffId: String(op.hubLiffId || '').trim(),
      source: op.source || 'unknown',
      ts: Date.now()
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
      sessionStorage.setItem(LEGACY_UID, rec.userId);
      if (rec.permission) sessionStorage.setItem(LEGACY_PERM, String(rec.permission));
    } catch (e) {}
  }

  /** 只解析網址參數（不依賴 sessionStorage；寫入失敗仍回傳身分） */
  function peekFromUrl() {
    try {
      var q = new URLSearchParams(window.location.search);
      var uid = q.get('uid') || q.get('dev_user_id') || q.get('dev_user') || '';
      var name = q.get('name') || '';
      var permStr = q.get('permission') || q.get('perm') || q.get('dev_perm') || '';
      var hubLiff = q.get('hub_liff_id') || q.get('hub_liff') || '';
      if (!uid && !name && !permStr && !hubLiff) return null;
      return {
        userId: String(uid || '').trim(),
        userName: String(name || '').trim(),
        displayName: String(name || '').trim(),
        permission: permStr ? (parseInt(permStr, 10) || 0) : 0,
        hubLiffId: String(hubLiff || '').trim(),
        source: 'hub_iframe',
        ts: Date.now()
      };
    } catch (e) {
      return null;
    }
  }

  function mergeFromUrl() {
    try {
      var fromUrl = peekFromUrl();
      if (!fromUrl) return read();
      var prev = read() || {};
      var op = {
        userId: fromUrl.userId || prev.userId || '',
        userName: fromUrl.userName || prev.userName || '',
        displayName: fromUrl.displayName || prev.displayName || '',
        permission: fromUrl.permission || prev.permission || 0,
        hubLiffId: fromUrl.hubLiffId || prev.hubLiffId || '',
        source: 'hub_iframe',
        ts: Date.now()
      };
      if (op.userId) write(op);
      // 即使 sessionStorage 寫入失敗，仍回傳網址上的身分（避免卡在驗證身分 60 秒）
      return op.userId ? op : read();
    } catch (e) {
      return read();
    }
  }

  /** 優先網址，其次本分頁記憶；供會計啟動／主控台進門使用 */
  function readPreferUrl() {
    var merged = mergeFromUrl();
    if (merged && merged.userId) return merged;
    return read();
  }

  function devBypassPayload() {
    var op = read();
    return {
      dev_permission: (op && op.permission) ? op.permission : 0,
      dev_user_id: (op && op.userId) ? op.userId : ''
    };
  }

  function applySession(session) {
    if (!session) return;
    var auth = session.auth || {};
    var profile = session.profile || {};
    var prev = read();
    var uid = auth.user_id || profile.userId || '';
    var authPerm = parseInt(auth.permission, 10) || 0;
    // HUB iframe 帶入的權限較新時，勿被會計舊身分快取往下蓋（升權後選單會消失）
    var hubPerm = 0;
    if (prev && String(prev.userId || '') === String(uid)
        && (prev.source === 'hub_iframe' || prev.source === 'hub')) {
      hubPerm = parseInt(prev.permission, 10) || 0;
    }
    write({
      userId: uid,
      userName: auth.display_name || profile.displayName || '',
      displayName: auth.display_name || profile.displayName || '',
      permission: Math.max(authPerm, hubPerm),
      hubLiffId: prev ? (prev.hubLiffId || '') : '',
      source: session.fromHub ? 'hub_iframe' : (session.devBypass ? 'dev_bypass' : 'liff')
    });
  }

  function hubQueryString() {
    var op = read();
    if (!op || !op.userId) return '';
    var parts = [
      'uid=' + encodeURIComponent(op.userId),
      'name=' + encodeURIComponent(op.displayName || op.userName || ''),
      'permission=' + encodeURIComponent(String(op.permission || 1))
    ];
    if (op.hubLiffId) parts.push('hub_liff_id=' + encodeURIComponent(op.hubLiffId));
    return parts.join('&');
  }

  function hubLiffId() {
    var op = read();
    return (op && op.hubLiffId) ? op.hubLiffId : '';
  }

  function clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_UID);
      sessionStorage.removeItem(LEGACY_PERM);
    } catch (e) {}
  }

  return {
    read: read,
    write: write,
    peekFromUrl: peekFromUrl,
    mergeFromUrl: mergeFromUrl,
    readPreferUrl: readPreferUrl,
    devBypassPayload: devBypassPayload,
    applySession: applySession,
    hubQueryString: hubQueryString,
    hubLiffId: hubLiffId,
    clear: clear
  };
})();
OperatorContext.mergeFromUrl();
