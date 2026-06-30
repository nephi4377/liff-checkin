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

  function mergeFromUrl() {
    try {
      var q = new URLSearchParams(window.location.search);
      var uid = q.get('uid') || q.get('dev_user_id') || q.get('dev_user') || '';
      var name = q.get('name') || '';
      var permStr = q.get('permission') || q.get('perm') || q.get('dev_perm') || '';
      var hubLiff = q.get('hub_liff_id') || q.get('hub_liff') || '';
      if (!uid && !name && !permStr && !hubLiff) return read();
      var prev = read() || {};
      var op = {
        userId: uid || prev.userId || '',
        userName: name || prev.userName || '',
        displayName: name || prev.displayName || '',
        permission: permStr ? parseInt(permStr, 10) : (prev.permission || 0),
        hubLiffId: hubLiff || prev.hubLiffId || '',
        source: 'hub_iframe'
      };
      if (op.userId) write(op);
      return op.userId ? op : read();
    } catch (e) {
      return read();
    }
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
    write({
      userId: auth.user_id || profile.userId || '',
      userName: auth.display_name || profile.displayName || '',
      displayName: auth.display_name || profile.displayName || '',
      permission: auth.permission || 0,
      hubLiffId: read() ? (read().hubLiffId || '') : '',
      source: session.devBypass ? 'dev_bypass' : 'liff'
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
    mergeFromUrl: mergeFromUrl,
    devBypassPayload: devBypassPayload,
    applySession: applySession,
    hubQueryString: hubQueryString,
    hubLiffId: hubLiffId,
    clear: clear
  };
})();
OperatorContext.mergeFromUrl();
