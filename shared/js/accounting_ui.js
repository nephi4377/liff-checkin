/**
 * 會計系統共用 UI：浮動提示（10 秒）+ 可捲動訊息欄 + 操作紀錄
 * 紀錄儲存：localStorage（本機）+ 後端稽核試算表（accounting_client_log，背景上傳）
 */
var AccountingUi = (function () {
  var TOAST_MS_DEFAULT = 10000;
  var MAX_LOG = 100;
  var STORAGE_KEY = 'tanxin_acct_ui_log_v1';
  var STORAGE_MAX = 300;
  var logs = [];
  var mounted = false;
  var dockEl = null;
  var logListEl = null;
  var dockTitleEl = null;
  var toastStack = null;
  var btnStates = new WeakMap();
  var opts = { side: 'right' };
  var operator = { session: null, userId: '', displayName: '', permission: 0 };
  var _restoring = false;
  var _pendingNavIntent = null;

  var PAGE_LABELS = {
    'index.html': '會計功能選單',
    'payment_request.html': '待付款申請',
    'accounting_ingest.html': '收支登錄',
    'ledger_review.html': '請款審核',
    'vendor_payment_finance.html': '廠商待匯款',
    'vendors.html': '廠商名冊',
    'vendor_status.html': '款項進度',
    'attachments.html': '單據附件',
    'project_margin.html': '案件毛利',
    'payees.html': '收款帳戶',
    'vendor_register.html': '廠商自填',
    'vendor_payment_approve.html': '廠商請款審核'
  };

  var KIND_LABEL = { ok: '完成', err: '錯誤', warn: '注意', info: '訊息', action: '動作' };
  var parentLogBound = false;

  /** 單頁殼層內嵌子頁：狀態欄只掛在外層，子頁不重掛 */
  function isEmbedFrame() {
    try {
      if (new URLSearchParams(window.location.search).get('embed') !== '1') return false;
      return !!(window.parent && window.parent !== window);
    } catch (e) {
      return false;
    }
  }

  function injectStyles() {
    if (document.getElementById('acct-ui-styles')) return;
    var s = document.createElement('style');
    s.id = 'acct-ui-styles';
    s.textContent = [
      'body.acct-ui-mounted{box-sizing:border-box}',
      'body.acct-ui-mounted.acct-ui-side-right{padding-right:0}',
      'body.acct-ui-mounted.acct-ui-side-left{padding-left:0}',
      'body.acct-ui-embed{padding-right:0!important;padding-left:0!important;padding-bottom:0!important}',
      '#acctToastStack{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10050;',
      'display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:min(92vw,420px)}',
      '.acct-toast{padding:12px 16px;border-radius:12px;font-size:15px;font-weight:600;line-height:1.45;',
      'box-shadow:0 4px 20px rgba(0,0,0,.15);opacity:0;transform:translateY(-12px);transition:opacity .28s,transform .28s;',
      'pointer-events:auto;max-width:100%;word-break:break-word}',
      '.acct-toast-show{opacity:1;transform:translateY(0)}',
      '.acct-toast-ok{background:#137333;color:#fff}',
      '.acct-toast-err{background:#c5221f;color:#fff}',
      '.acct-toast-warn{background:#b06000;color:#fff}',
      '.acct-toast-info{background:#1a73e8;color:#fff}',
      '#acctMsgDock{position:fixed;z-index:10040;background:#1e293b;color:#e2e8f0;',
      'font-size:13px;line-height:1.4;display:flex;flex-direction:column;box-shadow:0 -4px 24px rgba(0,0,0,.2)}',
      '#acctMsgDock .acct-dock-hd{padding:8px 12px;font-weight:700;font-size:12px;letter-spacing:.04em;',
      'text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #334155;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;gap:6px}',
      '#acctMsgDock .acct-dock-actions{display:flex;gap:2px;flex-shrink:0}',
      '#acctMsgDock .acct-dock-clear{border:none;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;padding:4px 8px}',
      '#acctMsgDock .acct-dock-clear:hover{color:#fff}',
      '#acctMsgLog{overflow-y:auto;flex:1;padding:6px 10px;-webkit-overflow-scrolling:touch}',
      '.acct-log-row{padding:5px 4px;border-bottom:1px solid #334155;display:flex;gap:8px;align-items:flex-start}',
      '.acct-log-row:last-child{border-bottom:none}',
      '.acct-log-time{color:#64748b;flex-shrink:0;font-size:11px;font-variant-numeric:tabular-nums;min-width:4.5em}',
      '.acct-log-tag{flex-shrink:0;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;margin-top:1px}',
      '.acct-log-tag-ok{background:#166534;color:#bbf7d0}',
      '.acct-log-tag-err{background:#991b1b;color:#fecaca}',
      '.acct-log-tag-warn{background:#92400e;color:#fde68a}',
      '.acct-log-tag-info{background:#1e40af;color:#bfdbfe}',
      '.acct-log-tag-action{background:#475569;color:#e2e8f0}',
      '.acct-log-text{flex:1;word-break:break-word;white-space:pre-wrap}',
      '.acct-ui-hide-legacy#msg,.acct-ui-hide-legacy#ok,.acct-ui-hide-legacy#warn{display:none!important}',
      '.btn[aria-busy="true"]{opacity:.7;cursor:wait}',
      '@media (max-width:959px){',
      'body.acct-ui-mounted:not(.acct-ui-embed){padding-bottom:118px!important}',
      '#acctMsgDock{left:0;right:0;bottom:0;height:108px;border-radius:12px 12px 0 0}',
      '}',
      '@media (min-width:960px){',
      'body.acct-ui-mounted.acct-ui-side-right:not(.acct-ui-embed){padding-right:304px!important;padding-left:0;max-width:none!important;margin:0!important}',
      'body.acct-ui-mounted.acct-ui-side-left:not(.acct-ui-embed){padding-left:304px!important;padding-right:0;max-width:none!important;margin:0!important}',
      'body.acct-page.acct-ui-mounted.acct-ui-side-right:not(.acct-ui-embed){padding-left:32px!important}',
      '#acctMsgDock.acct-dock-right{top:0;right:0;bottom:0;width:288px;border-radius:0;border-left:1px solid #334155}',
      '#acctMsgDock.acct-dock-left{top:0;left:0;bottom:0;width:288px;border-radius:0;border-right:1px solid #334155}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  function formatTime() {
    var d = new Date();
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatTimeFromIso(iso) {
    if (!iso) return formatTime();
    var d = new Date(iso);
    if (isNaN(d.getTime())) return formatTime();
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function pageName() {
    try {
      var p = window.location.pathname || '';
      return p.split('/').pop() || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  function pageLabel() {
    return PAGE_LABELS[pageName()] || pageName();
  }

  function normalizeKind(kind) {
    if (kind === 'error') return 'err';
    if (kind === 'success') return 'ok';
    return kind || 'info';
  }

  function readStorageList() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeStorageList(list) {
    try {
      while (list.length > STORAGE_MAX) list.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
    updateDockTitle();
  }

  function updateDockTitle() {
    if (!dockTitleEl) return;
    var n = readStorageList().length;
    dockTitleEl.textContent = '狀態紀錄（本機 ' + n + '）';
  }

  function shouldSyncRemote(kind, text) {
    return true;
  }

  function flushPendingNavIntent() {
    if (!_pendingNavIntent) return;
    var msg = _pendingNavIntent;
    _pendingNavIntent = null;
    pushLog('action', msg);
  }

  function consumeNavIntent() {
    try {
      var raw = sessionStorage.getItem('acct_nav_intent');
      if (!raw) return;
      sessionStorage.removeItem('acct_nav_intent');
      var j = JSON.parse(raw);
      if (!j || !j.label) return;
      var href = String(j.href || '');
      var cur = pageName();
      if (href && cur && href !== cur && href.indexOf(cur) < 0) return;
      var msg = '進入：' + j.label;
      if (isEmbedFrame() || operator.session) pushLog('action', msg);
      else _pendingNavIntent = msg;
    } catch (e) {}
  }

  function persistEntry(kind, text) {
    if (_restoring) return;
    var entry = {
      at: new Date().toISOString(),
      page: pageName(),
      operator_id: operator.userId || '',
      operator_name: operator.displayName || '',
      permission: operator.permission || 0,
      kind: normalizeKind(kind),
      text: String(text)
    };
    var list = readStorageList();
    list.push(entry);
    writeStorageList(list);

    if (!shouldSyncRemote(kind, text)) return;
    if (!operator.session) return;
    if (typeof AccountingApi === 'undefined' || !AccountingApi.clientLog) return;
    var summary = entry.text.length > 500 ? entry.text.slice(0, 500) + '…' : entry.text;
    var detail = entry.text.length > 500 ? entry.text : '';
    AccountingApi.clientLog(operator.session, {
      page: entry.page,
      kind: entry.kind,
      summary: summary,
      detail: detail
    });
  }

  function restoreStoredLogs() {
    _restoring = true;
    try {
      var list = readStorageList();
      var recent = list.slice(-25);
      recent.forEach(function (e) {
        var prefix = e.operator_name ? '[' + e.operator_name + '] ' : '';
        logs.unshift({
          kind: normalizeKind(e.kind),
          text: prefix + (e.text || ''),
          at: formatTimeFromIso(e.at)
        });
      });
      if (logs.length > MAX_LOG) logs.length = MAX_LOG;
    } finally {
      _restoring = false;
    }
  }

  function renderLog() {
    if (!logListEl) return;
    logListEl.innerHTML = '';
    logs.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'acct-log-row';
      var tag = document.createElement('span');
      tag.className = 'acct-log-tag acct-log-tag-' + entry.kind;
      tag.textContent = KIND_LABEL[entry.kind] || entry.kind;
      var time = document.createElement('span');
      time.className = 'acct-log-time';
      time.textContent = entry.at;
      var text = document.createElement('span');
      text.className = 'acct-log-text';
      text.textContent = entry.text;
      row.appendChild(time);
      row.appendChild(tag);
      row.appendChild(text);
      logListEl.appendChild(row);
    });
    logListEl.scrollTop = 0;
  }

  function appendLocalLog(kind, text, atIso) {
    kind = normalizeKind(kind);
    logs.unshift({
      kind: kind,
      text: String(text),
      at: atIso ? formatTimeFromIso(atIso) : formatTime()
    });
    if (logs.length > MAX_LOG) logs.length = MAX_LOG;
    renderLog();
    persistEntry(kind, text);
  }

  function pushLog(kind, text) {
    if (!text) return;
    kind = normalizeKind(kind);
    if (isEmbedFrame()) {
      try {
        window.parent.postMessage({
          type: 'acct_ui_log',
          kind: kind,
          text: String(text),
          page: pageName(),
          at: new Date().toISOString()
        }, '*');
      } catch (e) {}
      return;
    }
    appendLocalLog(kind, text);
  }

  function onParentLogMessage(event) {
    if (!event || !event.data || event.data.type !== 'acct_ui_log') return;
    if (isEmbedFrame()) return;
    if (!dockEl) return;
    var text = event.data.text;
    if (!text) return;
    appendLocalLog(event.data.kind, text, event.data.at);
  }

  function bindParentLogListener() {
    if (parentLogBound || isEmbedFrame()) return;
    parentLogBound = true;
    window.addEventListener('message', onParentLogMessage);
  }

  function toast(kind, text, ms) {
    if (!text) return;
    ensureMount();
    kind = normalizeKind(kind);
    ms = ms == null ? TOAST_MS_DEFAULT : ms;
    var el = document.createElement('div');
    el.className = 'acct-toast acct-toast-' + kind;
    el.setAttribute('role', 'status');
    el.textContent = text;
    toastStack.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('acct-toast-show'); });
    setTimeout(function () {
      el.classList.remove('acct-toast-show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, ms);
  }

  function copyStoredLogs() {
    var list = readStorageList();
    var text = list.map(function (e) {
      return [
        e.at || '',
        e.operator_name || e.operator_id || '—',
        e.page || '',
        e.kind || '',
        e.text || ''
      ].join('\t');
    }).join('\n');
    if (!text) {
      pushLog('warn', '本機尚無已存紀錄');
      return;
    }
    var header = '時間\t操作人\t頁面\t類型\t內容\n';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(header + text).then(function () {
        toast('ok', '已複製 ' + list.length + ' 筆紀錄', 3000);
      }).catch(function () {
        pushLog('info', header + text);
      });
    } else {
      pushLog('info', header + text);
    }
  }

  function ensureMount() {
    if (mounted) return;
    mounted = true;
    injectStyles();
    document.body.classList.add('acct-ui-mounted');

    toastStack = document.createElement('div');
    toastStack.id = 'acctToastStack';
    document.body.appendChild(toastStack);

    ['msg', 'ok', 'warn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('acct-ui-hide-legacy');
    });
    var legacyBar = document.getElementById('acctFeedbackBar');
    if (legacyBar) legacyBar.classList.add('hidden');

    /* 單頁殼層內嵌：只保留浮動提示，狀態欄由外層掛一次 */
    if (isEmbedFrame()) {
      document.body.classList.add('acct-ui-embed');
      return;
    }

    document.body.classList.add(opts.side === 'left' ? 'acct-ui-side-left' : 'acct-ui-side-right');

    dockEl = document.createElement('aside');
    dockEl.id = 'acctMsgDock';
    dockEl.setAttribute('aria-label', '操作與狀態訊息');
    dockEl.className = opts.side === 'left' ? 'acct-dock-left' : 'acct-dock-right';
    dockEl.innerHTML =
      '<div class="acct-dock-hd">' +
      '<span id="acctDockTitle">狀態紀錄</span>' +
      '<div class="acct-dock-actions">' +
      '<button type="button" class="acct-dock-clear" id="acctDockCopy" title="複製本機紀錄">複製</button>' +
      '<button type="button" class="acct-dock-clear" id="acctDockClear" title="只清畫面">清除</button>' +
      '</div></div>' +
      '<div id="acctMsgLog" role="log" aria-live="polite"></div>';
    document.body.appendChild(dockEl);
    dockTitleEl = document.getElementById('acctDockTitle');
    logListEl = document.getElementById('acctMsgLog');
    document.getElementById('acctDockClear').addEventListener('click', function () {
      logs = [];
      renderLog();
    });
    document.getElementById('acctDockCopy').addEventListener('click', copyStoredLogs);
    updateDockTitle();
    bindParentLogListener();
  }

  function notify(kind, text, options) {
    options = options || {};
    kind = normalizeKind(kind);
    if (!text) return;
    pushLog(kind, text);
    if (options.logOnly) return;
    toast(kind, text, options.ms != null ? options.ms : TOAST_MS_DEFAULT);
  }

  function action(label, status, detail) {
    var k = 'action';
    var msg = String(label || '操作');
    if (status === 'start') msg = '▶ ' + msg + '…';
    else if (status === 'ok') { k = 'ok'; msg = '✓ ' + msg; }
    else if (status === 'fail') { k = 'err'; msg = '✕ ' + msg; }
    if (detail) msg += ' — ' + detail;
    pushLog(k, msg);
    if (status === 'ok') toast('ok', msg, TOAST_MS_DEFAULT);
    else if (status === 'fail') toast('err', msg, TOAST_MS_DEFAULT);
    else if (status === 'start') toast('info', msg, 4000);
  }

  function tap(label) {
    if (!label) return;
    pushLog('action', '點擊：' + String(label));
  }

  function detail(title, body) {
    if (!title && !body) return;
    var text = String(title || '');
    if (body) text += (text ? '\n' : '') + String(body);
    pushLog('info', text);
  }

  function setOperator(session) {
    if (!session) return;
    operator.session = session;
    operator.userId = (session.auth && session.auth.user_id) || (session.profile && session.profile.userId) || '';
    operator.displayName = (session.auth && session.auth.display_name) || (session.profile && session.profile.displayName) || '';
    operator.permission = (session.auth && session.auth.permission) || 0;
    flushPendingNavIntent();
  }

  function bindMenuCards(selector) {
    document.querySelectorAll(selector || '#app a.card, #menuPanel a.card').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (typeof AccountingNav !== 'undefined') {
        a.setAttribute('href', AccountingNav.withHubQuery(href));
      }
      a.addEventListener('click', function (e) {
        var h3 = a.querySelector('h3');
        var label = h3 ? h3.textContent.trim() : (a.getAttribute('href') || '');
        if (typeof AccountingShell !== 'undefined' && AccountingShell.isHost && AccountingShell.isHost()) {
          e.preventDefault();
          AccountingShell.navigateTo(a.getAttribute('href') || href);
        }
        try {
          sessionStorage.setItem('acct_nav_intent', JSON.stringify({
            label: label,
            href: a.getAttribute('href') || '',
            at: Date.now()
          }));
        } catch (err) {}
        tap('點選：' + label);
      });
    });
  }

  function setBtnBusy(btn, on, busyLabel) {
    if (!btn) return;
    if (on) {
      if (!btnStates.has(btn)) {
        btnStates.set(btn, { text: btn.textContent, disabled: btn.disabled });
      }
      btn.disabled = true;
      if (busyLabel) btn.textContent = busyLabel;
      btn.setAttribute('aria-busy', 'true');
    } else {
      var prev = btnStates.get(btn);
      if (prev) {
        btn.textContent = prev.text;
        btn.disabled = prev.disabled;
        btnStates.delete(btn);
      } else {
        btn.disabled = false;
      }
      btn.removeAttribute('aria-busy');
    }
  }

  function setButtonsDisabled(selectors, disabled) {
    (selectors || []).forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.disabled = !!disabled;
      });
    });
  }

  function feedback() {
    return {
      setMsg: function (t) { if (t) notify('err', t); },
      setOk: function (t) { if (t) notify('ok', t); },
      setWarn: function (t) { if (t) notify('warn', t); },
      clear: function () {},
      busy: function (t) { action(t || '處理中', 'start'); }
    };
  }

  return {
    TOAST_MS: TOAST_MS_DEFAULT,
    init: function (initOpts) {
      initOpts = initOpts || {};
      if (initOpts.side === 'left') opts.side = 'left';
      ensureMount();
      if (isEmbedFrame()) {
        /* 內嵌子頁：不重掛狀態欄、不重播本機紀錄；操作仍轉給外層 */
        consumeNavIntent();
        if (initOpts.session) setOperator(initOpts.session);
        return this;
      }
      restoreStoredLogs();
      consumeNavIntent();
      renderLog();
      pushLog('info', '就緒：' + pageLabel());
      if (initOpts.session) setOperator(initOpts.session);
      return this;
    },
    setOperator: setOperator,
    bindMenuCards: bindMenuCards,
    pageLabel: pageLabel,
    getStoredLogs: readStorageList,
    toast: toast,
    log: pushLog,
    notify: notify,
    action: action,
    tap: tap,
    detail: detail,
    feedback: feedback,
    clearLog: function () { logs = []; renderLog(); },
    show: function (kind, text, ms) { notify(normalizeKind(kind), text, { ms: ms }); },
    ok: function (t, ms) { notify('ok', t, { ms: ms }); },
    err: function (t, ms) { notify('err', t, { ms: ms }); },
    warn: function (t, ms) { notify('warn', t, { ms: ms }); },
    info: function (t, ms) { notify('info', t, { ms: ms }); },
    clear: function () {},
    setBtnBusy: setBtnBusy,
    bindMsg: function (msgId, okId) {
      return feedback();
    },
    runAsync: async function (btn, runOpts, fn) {
      runOpts = runOpts || {};
      var label = runOpts.actionLabel || runOpts.busyLabel || '處理中';

      if ((runOpts.queue || runOpts.itemId != null) && typeof AccountingActionQueue !== 'undefined') {
        return AccountingActionQueue.enqueue({
          id: runOpts.itemId != null ? String(runOpts.itemId) : undefined,
          btn: btn,
          busyLabel: runOpts.busyLabel || '處理中…',
          queueId: runOpts.queueId,
          fn: async function () {
            action(label, 'start');
            try {
              var qResult = await fn();
              action(label, 'ok');
              return qResult;
            } catch (eQ) {
              action(label, 'fail', eQ.message || String(eQ));
              throw eQ;
            }
          }
        });
      }

      action(label, 'start');
      setBtnBusy(btn, true, runOpts.busyLabel || '處理中…');
      if (runOpts.lockSelectors) setButtonsDisabled(runOpts.lockSelectors, true);
      try {
        var result = await fn();
        action(label, 'ok');
        return result;
      } catch (e) {
        action(label, 'fail', e.message || String(e));
        throw e;
      } finally {
        setBtnBusy(btn, false);
        if (runOpts.lockSelectors) setButtonsDisabled(runOpts.lockSelectors, false);
      }
    }
  };
})();
