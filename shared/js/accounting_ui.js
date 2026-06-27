/**
 * 會計系統共用 UI：浮動提示（10 秒）+ 可捲動訊息欄（窄螢幕底／寬螢幕右側）+ 操作紀錄
 */
var AccountingUi = (function () {
  var TOAST_MS_DEFAULT = 10000;
  var MAX_LOG = 100;
  var logs = [];
  var mounted = false;
  var dockEl = null;
  var logListEl = null;
  var toastStack = null;
  var btnStates = new WeakMap();
  var opts = { side: 'right' };

  var KIND_LABEL = { ok: '完成', err: '錯誤', warn: '注意', info: '訊息', action: '動作' };

  function injectStyles() {
    if (document.getElementById('acct-ui-styles')) return;
    var s = document.createElement('style');
    s.id = 'acct-ui-styles';
    s.textContent = [
      'body.acct-ui-mounted{box-sizing:border-box}',
      'body.acct-ui-mounted.acct-ui-side-right{padding-right:0}',
      'body.acct-ui-mounted.acct-ui-side-left{padding-left:0}',
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
      'text-transform:uppercase;color:#94a3b8;border-bottom:1px solid #334155;flex-shrink:0;display:flex;justify-content:space-between;align-items:center}',
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
      'body.acct-ui-mounted{padding-bottom:118px!important}',
      '#acctMsgDock{left:0;right:0;bottom:0;height:108px;border-radius:12px 12px 0 0}',
      '}',
      '@media (min-width:960px){',
      'body.acct-ui-mounted.acct-ui-side-right{padding-right:304px!important}',
      'body.acct-ui-mounted.acct-ui-side-left{padding-left:304px!important}',
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

  function normalizeKind(kind) {
    if (kind === 'error') return 'err';
    if (kind === 'success') return 'ok';
    return kind || 'info';
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

  function pushLog(kind, text) {
    if (!text) return;
    logs.unshift({ kind: normalizeKind(kind), text: String(text), at: formatTime() });
    if (logs.length > MAX_LOG) logs.length = MAX_LOG;
    renderLog();
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

  function ensureMount() {
    if (mounted) return;
    mounted = true;
    injectStyles();
    document.body.classList.add('acct-ui-mounted');
    document.body.classList.add(opts.side === 'left' ? 'acct-ui-side-left' : 'acct-ui-side-right');

    toastStack = document.createElement('div');
    toastStack.id = 'acctToastStack';
    document.body.appendChild(toastStack);

    dockEl = document.createElement('aside');
    dockEl.id = 'acctMsgDock';
    dockEl.setAttribute('aria-label', '操作與狀態訊息');
    dockEl.className = opts.side === 'left' ? 'acct-dock-left' : 'acct-dock-right';
    dockEl.innerHTML =
      '<div class="acct-dock-hd"><span>狀態紀錄</span><button type="button" class="acct-dock-clear" id="acctDockClear">清除</button></div>' +
      '<div id="acctMsgLog" role="log" aria-live="polite"></div>';
    document.body.appendChild(dockEl);
    logListEl = document.getElementById('acctMsgLog');
    document.getElementById('acctDockClear').addEventListener('click', function () {
      logs = [];
      renderLog();
    });

    ['msg', 'ok', 'warn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('acct-ui-hide-legacy');
    });
    var legacyBar = document.getElementById('acctFeedbackBar');
    if (legacyBar) legacyBar.classList.add('hidden');
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

  /** 按鈕／切換等點擊 — 只寫訊息欄，不跳 Toast */
  function tap(label) {
    if (!label) return;
    pushLog('action', '點擊：' + String(label));
  }

  /** 多行詳情（如送出表單摘要）— 只寫訊息欄 */
  function detail(title, body) {
    if (!title && !body) return;
    var text = String(title || '');
    if (body) text += (text ? '\n' : '') + String(body);
    pushLog('info', text);
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
      pushLog('info', '頁面已就緒');
      return this;
    },
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
