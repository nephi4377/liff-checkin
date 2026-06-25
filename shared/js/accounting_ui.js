/**
 * 會計靜態頁共用：按鈕忙碌狀態與明顯操作回饋（human-comfortable）
 */
var AccountingUi = (function () {
  var stylesInjected = false;
  var bar = null;
  var iconEl = null;
  var textEl = null;
  var hideTimer = null;
  var btnStates = new WeakMap();

  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.acct-fb{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;',
      'margin:10px 0 6px;font-size:15px;font-weight:600;line-height:1.45;box-shadow:0 2px 8px rgba(0,0,0,.08);',
      'animation:acct-fb-in .25s ease}',
      '.acct-fb.ok{background:#e6f4ea;color:#137333;border:1px solid #ceead6}',
      '.acct-fb.err{background:#fce8e6;color:#c5221f;border:1px solid #f5c6c2}',
      '.acct-fb.warn{background:#fef7e0;color:#b06000;border:1px solid #f9e5b8}',
      '.acct-fb-icon{font-size:18px;line-height:1.2;flex-shrink:0}',
      '.btn[aria-busy="true"]{opacity:.7;cursor:wait}',
      '@keyframes acct-fb-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureBar() {
    injectStyles();
    if (bar) return;
    bar = document.getElementById('acctFeedbackBar');
    if (bar) {
      iconEl = bar.querySelector('.acct-fb-icon');
      textEl = bar.querySelector('.acct-fb-text');
      return;
    }
    bar = document.createElement('div');
    bar.id = 'acctFeedbackBar';
    bar.className = 'acct-fb hidden';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span class="acct-fb-icon" aria-hidden="true"></span><span class="acct-fb-text"></span>';
    iconEl = bar.querySelector('.acct-fb-icon');
    textEl = bar.querySelector('.acct-fb-text');
    var anchor = document.getElementById('app') || document.body;
    var ref = anchor.querySelector('#userLine') || anchor.querySelector('h2') || anchor.firstElementChild;
    if (ref && ref.parentNode) ref.parentNode.insertBefore(bar, ref.nextSibling);
    else anchor.insertBefore(bar, anchor.firstChild);
  }

  function show(kind, text, autoHideMs) {
    ensureBar();
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!text) {
      bar.className = 'acct-fb hidden';
      textEl.textContent = '';
      return;
    }
    var icons = { ok: '✓', err: '✕', warn: '…', info: 'ℹ' };
    bar.className = 'acct-fb ' + (kind || 'ok');
    iconEl.textContent = icons[kind] || icons.info;
    textEl.textContent = text;
    try { bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
    if (autoHideMs > 0) {
      hideTimer = setTimeout(function () { show('', ''); }, autoHideMs);
    }
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

  return {
    show: show,
    ok: function (t, ms) { show('ok', t, ms == null ? 8000 : ms); },
    err: function (t) { show('err', t, 0); },
    warn: function (t, ms) { show('warn', t, ms == null ? 0 : ms); },
    clear: function () { show('', ''); },
    setBtnBusy: setBtnBusy,
    bindMsg: function (msgId, okId) {
      return {
        setMsg: function (t) {
          if (msgId) {
            var el = document.getElementById(msgId);
            if (el) el.textContent = t || '';
          }
          if (t) show('err', t, 0);
          else if (!okId || !document.getElementById(okId).textContent) show('', '');
        },
        setOk: function (t) {
          if (okId) {
            var el2 = document.getElementById(okId);
            if (el2) el2.textContent = t || '';
          }
          if (t) show('ok', t, 8000);
        },
        clear: function () {
          if (msgId) {
            var m = document.getElementById(msgId);
            if (m) m.textContent = '';
          }
          if (okId) {
            var o = document.getElementById(okId);
            if (o) o.textContent = '';
          }
          show('', '');
        },
        busy: function (t) { show('warn', t || '處理中，請稍候…', 0); }
      };
    },
    runAsync: async function (btn, opts, fn) {
      opts = opts || {};
      if (opts.clear !== false) show('', '');
      if (opts.startMessage) show('warn', opts.startMessage, 0);
      setBtnBusy(btn, true, opts.busyLabel || '處理中…');
      if (opts.lockSelectors) setButtonsDisabled(opts.lockSelectors, true);
      try {
        return await fn();
      } finally {
        setBtnBusy(btn, false);
        if (opts.lockSelectors) setButtonsDisabled(opts.lockSelectors, false);
      }
    }
  };
})();
