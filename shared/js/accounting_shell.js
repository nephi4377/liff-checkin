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
  var pendingTokenRequestSource = null;

  var PAGE_TITLES = {
    'accounting_ingest.html': '收支登錄',
    'ledger_history.html': '歷史記帳紀錄',
    'submit_records.html': '送出紀錄',
    'payment_request.html': '待付款請款',
    'quick_review.html': '單據與存檔',
    'payment_request_compose.html': '精細請款建單',
    'vendor_status.html': '款項進度',
    'vendors.html': '廠商名冊',
    'payees.html': '收款帳戶（已廢棄）',
    'ledger_review.html': '請款審核',
    'payroll_review.html': '薪資審核',
    'payroll_finance.html': '薪資待匯款',
    'vendor_payment_finance.html': '廠商待匯款',
    'vendor_payment_approve.html': '廠商請款審核',
    'attachments.html': '單據附件',
    'project_margin.html': '案件毛利',
    'designer-customer-finance.html': '追加減與收款',
    'customer-finance-portal.html': '客戶案件紀錄',
    'vendor_register.html': '廠商自填',
    'vendor_docs.html': '單據與存檔'
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

  function readShellForwardQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      var parts = [];
      params.forEach(function (val, key) {
        if (key === 'route' || key === 'embed') return;
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
      });
      return parts.length ? '&' + parts.join('&') : '';
    } catch (e) {
      return '';
    }
  }

  function extractPageQuery(href) {
    try {
      var q = String(href || '').split('?')[1] || '';
      q = q.split('#')[0];
      if (!q) return '';
      var params = new URLSearchParams(q);
      params.delete('embed');
      params.delete('route');
      var s = params.toString();
      return s ? '&' + s : '';
    } catch (e) {
      return '';
    }
  }

  function buildFrameSrc(page, pageQuery) {
    var base = page + (page.indexOf('?') >= 0 ? '&' : '?') + 'embed=1' +
      (pageQuery || '') + readShellForwardQuery();
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

  /** iframe 目前實際頁（子頁 location.href 跳轉後，src 屬性不會跟著變） */
  function frameActualPage_() {
    try {
      if (!frameEl || !frameEl.contentWindow) return '';
      var loc = frameEl.contentWindow.location;
      if (!loc || !loc.href || loc.href.indexOf('about:blank') === 0) return '';
      return normalizePage(loc.pathname || loc.href);
    } catch (e) {
      return '';
    }
  }

  /** 與 quick_review 同 origin：重掛前清清單快取，避免 iframe 重載仍先畫 90 秒內舊列表 */
  function bustQuickReviewListCache_() {
    try {
      sessionStorage.removeItem('acct_quick_review_list_v2');
    } catch (eBust) {}
  }

  /**
   * 載入子頁。forceRemount：選單再點同一功能也重抓（避免清單／狀態過期）。
   * 另：子頁內跳轉後殼層 src 屬性仍舊時，必須重掛，否則會卡在請款成功頁等舊畫面。
   */
  function showFrame(page, pageQuery, opts) {
    if (!frameEl || !page) {
      showMenu();
      return;
    }
    opts = opts || {};
    var src = buildFrameSrc(page, pageQuery);
    var attr = frameEl.getAttribute('src') || '';
    var actual = frameActualPage_();
    var mustLoad = !!opts.forceRemount || attr !== src || (actual && actual !== page);
    currentPage = page;
    if (mustLoad) {
      if (opts.forceRemount || page === 'quick_review.html' || page === 'vendor_docs.html') {
        bustQuickReviewListCache_();
      }
      if (attr === src) {
        // 同 URL 瀏覽器可能不重載：先 blank 再設回（雙 rAF 降低 LINE WebView 卡空白）
        frameEl.setAttribute('src', 'about:blank');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (currentPage === page) frameEl.setAttribute('src', src);
          });
        });
      } else {
        frameEl.setAttribute('src', src);
      }
    }
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
    // 選單點進來一律重掛，確保單據清單等會重打 API
    showFrame(page, extractPageQuery(href), { forceRemount: true });
    setHash(page);
  }

  function onHashChange() {
    var page = pageFromHash();
    if (!page) showMenu();
    // 僅 hash 變化：若子頁已自行跳走，仍要纠正；已在正確頁則不強制重掛
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
    if (type === 'acct_bootstrap_ready' && isHost) {
      try {
        var bootFrame = document.getElementById('acctContentFrame');
        if (bootFrame && bootFrame.contentWindow) {
          bootFrame.contentWindow.postMessage({
            type: 'acct_bootstrap_ready',
            userId: event.data.userId || ''
          }, '*');
        }
      } catch (eBoot) {}
      return;
    }
    if (type === 'request_hub_liff_token') {
      pendingTokenRequestSource = event.source || null;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'request_hub_liff_token', forwardFrom: 'acct_shell' }, '*');
        }
      } catch (eFwd) {}
      return;
    }
    if (type === 'hub_liff_token' && isHost) {
      var tok = event.data.token || '';
      if (pendingTokenRequestSource && typeof pendingTokenRequestSource.postMessage === 'function') {
        try {
          pendingTokenRequestSource.postMessage({ type: 'hub_liff_token', token: tok }, '*');
        } catch (eRelaySrc) {}
        pendingTokenRequestSource = null;
      }
      try {
        var frame = document.getElementById('acctContentFrame');
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: 'hub_liff_token', token: tok }, '*');
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
