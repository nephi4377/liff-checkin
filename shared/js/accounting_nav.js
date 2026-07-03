/**
 * 會計模組內部導覽：保留 HUB 傳入的 uid／permission；SPA 殼層內切換不整頁重載
 */
var AccountingNav = (function () {
  function isEmbed() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (e) {
      return false;
    }
  }

  function isInShellFrame() {
    return isEmbed() && window.parent && window.parent !== window;
  }

  function applyEmbedChrome() {
    if (!isEmbed()) return;
    document.body.classList.add('acct-embed');
    document.querySelectorAll('.nav, #userLine, .acct-shell-hide').forEach(function (el) {
      el.classList.add('acct-shell-hide');
    });
  }

  function withHubQuery(href) {
    if (!href) return href;
    if (href.indexOf('://') >= 0 || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return href;
    if (href.charAt(0) === '#') return href;
    var qs = (typeof OperatorContext !== 'undefined') ? OperatorContext.hubQueryString() : '';
    if (!qs && href.indexOf('uid=') >= 0) return href;
    if (!qs) return href;
    return href + (href.indexOf('?') >= 0 ? '&' : '?') + qs;
  }

  function isMenuLink(href) {
    if (!href) return false;
    var page = (typeof AccountingShell !== 'undefined' && AccountingShell.normalizePage)
      ? AccountingShell.normalizePage(href)
      : href.split('?')[0].split('#')[0];
    return !page || /index\.html$/i.test(String(href));
  }

  function navigateBackToMenu(e) {
    if (!isInShellFrame()) return false;
    if (e && e.preventDefault) e.preventDefault();
    try {
      window.parent.postMessage({ type: 'acct_shell_nav', route: '' }, '*');
    } catch (err) {}
    return true;
  }

  function bindLink(a) {
    var href = a.getAttribute('href');
    if (!href) return;
    var patched = withHubQuery(href);
    if (patched !== href) a.setAttribute('href', patched);
    if (a.__acctNavBound) return;
    a.__acctNavBound = true;
    a.addEventListener('click', function (e) {
      var h = a.getAttribute('href') || '';
      if (isMenuLink(h)) {
        if (navigateBackToMenu(e)) return;
        if (typeof AccountingShell !== 'undefined' && AccountingShell.isHost && AccountingShell.isHost()) {
          e.preventDefault();
          AccountingShell.navigateTo('');
          return;
        }
      }
      if (typeof AccountingShell !== 'undefined' && AccountingShell.isHost && AccountingShell.isHost()) {
        var page = AccountingShell.normalizePage(h);
        if (page && h.indexOf('://') < 0 && h.charAt(0) !== '#') {
          e.preventDefault();
          AccountingShell.navigateTo(h);
        }
      }
    });
  }

  function patchPageLinks(root) {
    var scope = root || document;
    scope.querySelectorAll('a[href]').forEach(bindLink);
  }

  function init() {
    applyEmbedChrome();
    patchPageLinks(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    isEmbed: isEmbed,
    isInShellFrame: isInShellFrame,
    withHubQuery: withHubQuery,
    patchPageLinks: patchPageLinks,
    navigateBackToMenu: navigateBackToMenu,
    init: init
  };
})();
