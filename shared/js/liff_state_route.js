/**
 * 既有 LIFF 入口（收支登錄、客戶 portal）收到 liff.state 路徑時，同網域轉到報價編輯／客人報價。
 * 不變更 LINE Endpoint；搭配 liff.line.me/{id}/modules/projects/quote-*.html?…
 */
(function (root) {
  var ALLOWED = {
    '/modules/projects/quote-editor.html': '/modules/projects/quote-editor.html',
    '/quote-editor.html': '/modules/projects/quote-editor.html',
    '/modules/projects/quote-view.html': '/modules/projects/quote-view.html',
    '/quote-view.html': '/modules/projects/quote-view.html'
  };

  function parseLiffStateRedirect_(search) {
    try {
      var params = new URLSearchParams(search || '');
      var raw = params.get('liff.state');
      if (!raw) return '';
      var decoded = decodeURIComponent(raw);
      if (!decoded || decoded.charAt(0) !== '/') return '';
      var qIdx = decoded.indexOf('?');
      var pathOnly = qIdx >= 0 ? decoded.slice(0, qIdx) : decoded;
      var targetPath = ALLOWED[pathOnly];
      if (!targetPath) return '';
      var qs = qIdx >= 0 ? decoded.slice(qIdx) : '';
      return targetPath + qs;
    } catch (e) {
      return '';
    }
  }

  function tryLiffStateRedirect() {
    var dest = parseLiffStateRedirect_(typeof location !== 'undefined' ? location.search : '');
    if (!dest || typeof location === 'undefined') return false;
    var current = location.pathname + location.search;
    if (current === dest) return false;
    location.replace(dest);
    return true;
  }

  var api = {
    ALLOWED_PATHS: Object.keys(ALLOWED),
    parseLiffStateRedirect: parseLiffStateRedirect_,
    tryLiffStateRedirect: tryLiffStateRedirect
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.LiffStateRoute = api;

  if (typeof location !== 'undefined') {
    tryLiffStateRedirect();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
