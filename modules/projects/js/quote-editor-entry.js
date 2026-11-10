/**
 * 報價編輯頁自己的入口判斷。
 * 這一頁的網址不在 LINE 登入回跳清單；沒有既有身分時不要呼叫共用登入（會出現 error 400）。
 * 不改 accounting_api.js。包一層只活在這頁，之後報價表格那支分支重疊時，這層仍擋在登入前面。
 */
(function (root) {
  var OPEN_FROM_FINANCE_MSG = '請從後台『設計師客戶財務 → 線上報價』開啟';

  function hasOperatorUserId(operator) {
    return !!(operator && String(operator.userId || '').trim());
  }

  /** 沒有員工身分、也不在 LINE／主控台裡 → 不要走 LINE 登入 */
  function shouldBlockLineLogin(signals) {
    signals = signals || {};
    if (signals.hasOperator) return false;
    if (signals.inLiff) return false;
    if (signals.inHub) return false;
    return true;
  }

  /** 只帶案號。帳號、姓名、權限不是短效憑證，不放進網址。 */
  function financePageHref(projectNo) {
    var base = '../accounting/designer-customer-finance.html';
    var pno = String(projectNo || '').trim();
    if (!pno) return base;
    return base + '?project_no=' + encodeURIComponent(pno);
  }

  function readProjectNo(win) {
    try {
      var q = new URLSearchParams((win.location && win.location.search) || '');
      return q.get('project_no') || q.get('projectNo') || '';
    } catch (e) {
      return '';
    }
  }

  function detectInHub(win) {
    try {
      if (win.parent && win.parent !== win) return true;
    } catch (e) {
      return true;
    }
    try {
      if (win.top && win.top !== win) return true;
    } catch (e2) {
      return true;
    }
    return false;
  }

  function detectInLiff(win) {
    try {
      var liffObj = win.liff;
      if (liffObj && typeof liffObj.isInClient === 'function' && liffObj.isInClient()) return true;
    } catch (e) {}
    try {
      var ua = (win.navigator && win.navigator.userAgent) || '';
      if (/Line\//i.test(ua)) return true;
    } catch (e2) {}
    return false;
  }

  function readOperator(win) {
    var OC = win.OperatorContext;
    if (!OC || typeof OC.read !== 'function') return null;
    try { return OC.read(); } catch (e) { return null; }
  }

  function collectSignals(win) {
    var op = readOperator(win);
    return {
      hasOperator: hasOperatorUserId(op),
      inLiff: detectInLiff(win),
      inHub: detectInHub(win)
    };
  }

  function showOpenFromFinance(doc, projectNo) {
    if (!doc || typeof doc.getElementById !== 'function') return;
    var status = doc.getElementById('statusLine');
    if (status) {
      status.textContent = OPEN_FROM_FINANCE_MSG;
      status.className = 'status err';
    }
    var sub = doc.getElementById('headerSub');
    if (sub) {
      var pno = String(projectNo || '').trim();
      sub.textContent = pno ? ('案號 ' + pno + '｜請從後台開啟') : '請從後台開啟';
    }
    if (typeof doc.querySelectorAll === 'function') {
      var cards = doc.querySelectorAll('.wrap > .card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].hidden = true;
        if (cards[i].style) cards[i].style.display = 'none';
      }
    }
    if (doc.getElementById('backFinanceLink')) return;
    var p = doc.createElement('p');
    p.id = 'backFinanceLink';
    p.style.margin = '0.75rem 0 0';
    var a = doc.createElement('a');
    a.className = 'btn';
    a.href = financePageHref(projectNo);
    a.textContent = '回設計師客戶財務';
    a.style.display = 'inline-block';
    a.style.textDecoration = 'none';
    p.appendChild(a);
    if (status && status.parentNode && typeof status.parentNode.insertBefore === 'function') {
      status.parentNode.insertBefore(p, status.nextSibling || null);
    }
  }

  function installQuoteEditorEntryGuard(win) {
    win = win || root;
    var api = win.AccountingApi;
    if (!api || typeof api.initSession !== 'function' || api.initSession.__quoteEditorEntryGuard) return false;
    var orig = api.initSession;
    function guarded(opts) {
      if (shouldBlockLineLogin(collectSignals(win))) {
        showOpenFromFinance(win.document, readProjectNo(win));
        return Promise.resolve(null);
      }
      return orig.call(api, opts);
    }
    guarded.__quoteEditorEntryGuard = true;
    api.initSession = guarded;
    return true;
  }

  var apiExport = {
    OPEN_FROM_FINANCE_MSG: OPEN_FROM_FINANCE_MSG,
    hasOperatorUserId: hasOperatorUserId,
    shouldBlockLineLogin: shouldBlockLineLogin,
    financePageHref: financePageHref,
    collectSignals: collectSignals,
    showOpenFromFinance: showOpenFromFinance,
    installQuoteEditorEntryGuard: installQuoteEditorEntryGuard
  };

  root.QuoteEditorEntry = apiExport;
  if (typeof module !== 'undefined' && module.exports) module.exports = apiExport;

  if (typeof document !== 'undefined' && root.document && root.AccountingApi) {
    installQuoteEditorEntryGuard(root);
  }
})(typeof window !== 'undefined' ? window : globalThis);
