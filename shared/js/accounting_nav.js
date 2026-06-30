/**
 * 會計模組內部導覽：保留 HUB 傳入的 uid／permission
 */
var AccountingNav = (function () {
  function withHubQuery(href) {
    if (!href) return href;
    if (href.indexOf('://') >= 0 || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return href;
    if (href.charAt(0) === '#') return href;
    if (href.indexOf('uid=') >= 0) return href;
    var qs = (typeof OperatorContext !== 'undefined') ? OperatorContext.hubQueryString() : '';
    if (!qs) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + qs;
  }

  function patchPageLinks(root) {
    var scope = root || document;
    scope.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      var patched = withHubQuery(href);
      if (patched !== href) a.setAttribute('href', patched);
    });
  }

  function init() {
    patchPageLinks(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    withHubQuery: withHubQuery,
    patchPageLinks: patchPageLinks,
    init: init
  };
})();
