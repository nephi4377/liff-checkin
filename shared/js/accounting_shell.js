/**
 * 會計模組 SPA 殼層：登入／主檔 bootstrap 只跑一次，子功能在內嵌 iframe 切換
 */
var AccountingShell = (function () {
  var MENU_HASH = '#/menu';
  var isHost = false;
  var frameEl = null;
  var menuEl = null;
  var backEl = null;
  var currentPage = '';

  var PAGE_TITLES = {
    'accounting_ingest.html': '收支登錄',
    'payment_request.html': '待付款申請',
    'payment_request_compose.html': '精細請款建單',
    'vendor_status.html': '款項進度',
    'vendors.html': '廠商名冊',
    'payees.html': '收款帳戶',
    'ledger_review.html': '請款審核',
    'payroll_review.html': '薪資審核',
    'payroll_finance.html': '薪資待匯款',
    'vendor_payment_finance.html': '廠商待匯款',
    'vendor_payment_approve.html': '廠商請款審核',
    'attachments.html': '單據附件',
    'project_margin.html': '案件毛利',
    'designer-customer-finance.html': '追加減與收款',
    'customer-finance-portal.html': '客戶案件紀錄',
    'vendor_register.html': '廠商自填'
  };

  function normalizePage(href) {
    if (!href) return '';
    var raw = String(href).split('?')[0].split('#')[0].trim();
    if (!raw || raw === '.' || raw === './') return '';
    if (/index\.html$/i.test(raw)) return '';
    if (raw.indexOf('/') >= 0) raw = raw.split('/').pop();
    return raw;
  }

  function pageFromHash() {
    var h = (window.location.hash || '').replace(/^#\/?/, '');
    if (!h || h === 'menu') return '';
    return normalizePage(h);
  }

  function setHash(page) {
    var next = page ? '#/' + page.replace(/^\//, '') : MENU_HASH;
    if (window.location.hash !== next) window.location.hash = next;
  }

  function buildFrameSrc(page) {
    var base = page + (page.indexOf('?') >= 0 ? '&' : '?') + 'embed=1';
    if (typeof AccountingNav !== 'undefined') return AccountingNav.withHubQuery(base);
    return base;
  }

  function setTitle(page) {
    var label = PAGE_TITLES[page] || page || '添心會計';
    document.title = page ? ('添心會計 · ' + label) : '添心會計';
  }

  function showMenu() {
    currentPage = '';
    if (menuEl) menuEl.classList.remove('hidden');
    if (frameEl) frameEl.classList.add('hidden');
    if (backEl) backEl.classList.add('hidden');
    setTitle('');
  }

  function showFrame(page) {
    if (!frameEl || !page) {
      showMenu();
      return;
    }
    currentPage = page;
    var src = buildFrameSrc(page);
    if (frameEl.getAttribute('src') !== src) frameEl.setAttribute('src', src);
    if (menuEl) menuEl.classList.add('hidden');
    frameEl.classList.remove('hidden');
    if (backEl) backEl.classList.remove('hidden');
    setTitle(page);
  }

  function navigateTo(href) {
    if (!isHost) return;
    var page = normalizePage(href);
    if (!page) {
      showMenu();
      setHash('');
      return;
    }
    showFrame(page);
    setHash(page);
  }

  function onHashChange() {
    var page = pageFromHash();
    if (!page) showMenu();
    else showFrame(page);
  }

  function readRouteQuery() {
    try {
      return new URLSearchParams(window.location.search).get('route') || '';
    } catch (e) {
      return '';
    }
  }

  function bindShellUi() {
    var backLink = document.getElementById('shellBackLink');
    if (backLink) {
      backLink.addEventListener('click', function (e) {
        e.preventDefault();
        navigateTo('');
      });
    }
  }

  function handleMessage(event) {
    if (!event || !event.data) return;
    var type = event.data.type;
    if (isHost && type === 'acct_shell_nav') {
      navigateTo(event.data.route || '');
      return;
    }
    if (type === 'request_hub_liff_token') {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'request_hub_liff_token', forwardFrom: 'acct_shell' }, '*');
        }
      } catch (eFwd) {}
      return;
    }
    if (type === 'hub_liff_token' && isHost && event.source && typeof event.source.postMessage === 'function') {
      try {
        var frame = document.getElementById('acctContentFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'hub_liff_token', token: event.data.token || '' }, '*');
        }
      } catch (eRelay) {}
    }
  }

  function initHost() {
    if (isHost) return;
    frameEl = document.getElementById('acctContentFrame');
    menuEl = document.getElementById('menuPanel');
    backEl = document.getElementById('shellBack');
    if (!menuEl) return;
    isHost = true;
    document.body.classList.add('acct-shell-host');
    bindShellUi();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('message', handleMessage);
    var route = normalizePage(readRouteQuery());
    if (route) {
      navigateTo(route);
      return;
    }
    onHashChange();
  }

  return {
    isHost: function () { return isHost; },
    initHost: initHost,
    navigateTo: navigateTo,
    normalizePage: normalizePage,
    currentPage: function () { return currentPage; }
  };
})();
