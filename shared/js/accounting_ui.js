/**
 * 會計系統共用 UI：浮動提示 +（僅 debug=1）右側狀態紀錄
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
  var _bootAt = Date.now();
  var _actionTimers = {};
  var _progressEl = null;
  var _apiInflight = 0;

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch (e) {
      return false;
    }
  }

  function formatMs(ms) {
    var n = Math.max(0, Math.round(ms || 0));
    if (n < 1000) return n + ' 毫秒';
    return (n / 1000).toFixed(1) + ' 秒';
  }

  function formatAgeMs(ms) {
    var n = Math.max(0, Math.round(ms || 0));
    if (n < 60000) return Math.round(n / 1000) + ' 秒前';
    if (n < 3600000) return Math.round(n / 60000) + ' 分鐘前';
    return Math.round(n / 3600000) + ' 小時前';
  }

  function ensureProgressEl() {
    var loading = document.getElementById('loading');
    if (!loading || _progressEl) return;
    _progressEl = document.createElement('p');
    _progressEl.className = 'acct-loading-detail';
    _progressEl.setAttribute('aria-live', 'polite');
    loading.appendChild(_progressEl);
  }

  function setProgress(text) {
    ensureProgressEl();
    if (_progressEl) _progressEl.textContent = text || '';
  }

  function clearProgress() {
    if (_progressEl) _progressEl.textContent = '';
  }

  var PAGE_LABELS = {
    'index.html': '會計功能選單',
    'payment_request.html': '待付款請款',
    'quick_review.html': '單據與存檔',
    'vendor_docs.html': '單據與存檔',
    'accounting_ingest.html': '收支登錄',
    'ledger_review.html': '請款審核',
    'vendor_payment_finance.html': '廠商待匯款',
    'vendors.html': '廠商名冊',
    'vendor_status.html': '款項進度',
    'attachments.html': '單據附件',
    'project_margin.html': '案件毛利',
    'payees.html': '收款帳戶（已廢棄）',
    'vendor_register.html': '廠商自填',
    'vendor_payment_approve.html': '廠商請款審核',
    'payroll_review.html': '薪資審核',
    'payroll_finance.html': '薪資待匯款',
    'designer-customer-finance.html': '追加減與收款',
    'customer-finance-portal.html': '客戶案件紀錄',
    'designer-material-selection.html': '選材管理',
    'payment_request_compose.html': '精細請款建單'
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
      '.acct-loading-detail{margin:8px 0 0;font-size:13px;color:#64748b;line-height:1.45}',
      '.acct-fatal-err{max-width:420px;margin:0 auto;text-align:left;padding:8px 4px}',
      '.acct-fatal-err h3{margin:0 0 8px;font-size:17px;color:#991b1b}',
      '.acct-fatal-err .acct-fatal-msg{margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;word-break:break-word}',
      '.acct-fatal-err .acct-fatal-hint{margin:0 0 14px;font-size:13px;color:#64748b;line-height:1.45}',
      '.acct-fatal-err .err-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}',
      '.acct-fatal-err .err-actions .btn{min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid #cbd5e1;',
      'background:#fff;color:#0f172a;font-size:14px;font-weight:600;cursor:pointer}',
      '.acct-fatal-err .err-actions .btn-primary{background:#0f766e;border-color:#0f766e;color:#fff}',
      '.acct-fatal-err .err-actions .btn-mail{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
      '.acct-fatal-err .err-fallback{margin:0;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;',
      'font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}',
      '.acct-fatal-err .err-fallback.hidden{display:none}',
      '.acct-ui-hide-legacy#msg,.acct-ui-hide-legacy#ok,.acct-ui-hide-legacy#warn{display:none!important}',
      '.btn[aria-busy="true"]{opacity:.7;cursor:wait}',
      '.acct-dlg-overlay{position:fixed;inset:0;z-index:10060;background:rgba(15,23,42,.45);',
      'display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box}',
      '@media (min-width:640px){.acct-dlg-overlay{align-items:center}}',
      '.acct-dlg{width:min(92vw,420px);max-height:min(88vh,640px);overflow:auto;background:#fff;',
      'border-radius:16px;padding:18px 16px 16px;box-shadow:0 16px 48px rgba(15,23,42,.28)}',
      '.acct-dlg h3{margin:0 0 8px;font-size:18px;color:#0f172a}',
      '.acct-dlg .acct-dlg-sum{margin:0 0 10px;font-size:15px;font-weight:600;color:#1a73e8;word-break:break-word}',
      '.acct-dlg .acct-dlg-hint{margin:0 0 14px;font-size:14px;line-height:1.45;color:#475569}',
      '.acct-dlg-actions{display:flex;flex-direction:column;gap:8px;margin-top:12px}',
      '.acct-dlg-cancel{width:100%;min-height:48px;padding:12px 16px;border:none;border-radius:10px;',
      'background:#e8eaed;color:#0f172a;font-size:16px;font-weight:700;cursor:pointer}',
      '.acct-dlg-next,.acct-dlg-ok{width:100%;min-height:44px;padding:10px 16px;border:none;border-radius:10px;',
      'font-size:15px;font-weight:600;cursor:pointer}',
      '.acct-dlg-next{background:#1a73e8;color:#fff}',
      '.acct-dlg-ok{background:#f9ab00;color:#333}',
      '.acct-dlg-chips{display:flex;flex-direction:column;gap:8px}',
      '.acct-dlg-chip{min-height:48px;padding:12px 14px;border:2px solid #e2e8f0;border-radius:12px;',
      'background:#f8fafc;color:#0f172a;font-size:16px;font-weight:600;text-align:left;cursor:pointer}',
      '.acct-dlg-chip:hover,.acct-dlg-chip:focus{border-color:#1a73e8;background:#eff6ff}',
      '.acct-dlg-chip.is-on{border-color:#1a73e8;background:#dbeafe;box-shadow:inset 0 0 0 1px #1a73e8}',
      '.acct-dlg-other{margin-top:10px}',
      '.acct-dlg-other.hidden{display:none}',
      '.acct-dlg-other textarea{width:100%;min-height:72px;margin-top:6px;padding:10px;box-sizing:border-box;',
      'border:1px solid #cbd5e1;border-radius:8px;font-size:16px}',
      '.acct-dlg-step.hidden{display:none}',
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

  function shouldSyncRemote() {
    return false;
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
    if (!text || !isDebugMode()) return;
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
    copyText(header + text, { okToast: '已複製 ' + list.length + ' 筆紀錄' });
  }

  /**
   * 複製文字到剪貼簿；失敗時可回傳 false，呼叫端可顯示可選取備援
   * @return {Promise<boolean>}
   */
  function copyText(text, options) {
    options = options || {};
    var payload = String(text || '');
    if (!payload) {
      toast('warn', options.emptyToast || '沒有可複製的內容', 3000);
      return Promise.resolve(false);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(payload).then(function () {
        if (options.okToast !== false) {
          toast('ok', options.okToast || '已複製', 3000);
        }
        return true;
      }).catch(function () {
        if (options.failToast !== false) {
          toast('warn', options.failToast || '無法自動複製，請手動選取文字', 4000);
        }
        return false;
      });
    }
    if (options.failToast !== false) {
      toast('warn', options.failToast || '無法自動複製，請手動選取文字', 4000);
    }
    return Promise.resolve(false);
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

    if (!isDebugMode()) return;

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

  function action(label, status, detail, opts) {
    opts = opts || {};
    var k = 'action';
    var msg = String(label || '操作');
    var key = msg.replace(/^▶\s|^✓\s|^✕\s/, '').replace(/…$/, '');
    if (status === 'start') {
      _actionTimers[key] = Date.now();
      msg = '▶ ' + msg + '…';
    } else if (status === 'ok') {
      k = 'ok';
      msg = '✓ ' + msg;
      var elapsedOk = _actionTimers[key] ? Date.now() - _actionTimers[key] : 0;
      delete _actionTimers[key];
      if (elapsedOk && !detail) detail = formatMs(elapsedOk);
      else if (elapsedOk && detail) detail = detail + ' · ' + formatMs(elapsedOk);
    } else if (status === 'fail') {
      k = 'err';
      msg = '✕ ' + msg;
      var elapsedFail = _actionTimers[key] ? Date.now() - _actionTimers[key] : 0;
      delete _actionTimers[key];
      if (elapsedFail && !detail) detail = formatMs(elapsedFail);
      else if (elapsedFail && detail) detail = detail + ' · ' + formatMs(elapsedFail);
    }
    if (detail) msg += ' — ' + detail;
    pushLog(k, msg);
    var allowToast = opts.toast !== false;
    if (!allowToast) return;
    if (status === 'ok') toast('ok', msg, TOAST_MS_DEFAULT);
    else if (status === 'fail') toast('err', msg, TOAST_MS_DEFAULT);
    else if (status === 'start' && isDebugMode()) toast('info', msg, 4000);
  }

  function step(label, detail) {
    if (!label || !isDebugMode()) return;
    var msg = String(label);
    if (detail) msg += ' — ' + detail;
    msg += ' · 已耗 ' + formatMs(Date.now() - _bootAt);
    pushLog('info', msg);
  }

  var API_LABELS = {
    accounting_auth_me: '驗證身分',
    accounting_policy: '讀取設定',
    accounting_bootstrap: '載入主檔',
    accounting_form_context: '表單資料',
    payment_request_auth_me: '請款身分',
    crud_list: '讀取列表',
    vendor_payment_list: '讀取請款',
    ledger_review_bundle: '讀取審核包'
  };

  function apiLabel(action) {
    return API_LABELS[action] || ('API ' + action);
  }

  function apiStart(action) {
    _apiInflight += 1;
    var label = apiLabel(action);
    setProgress(label + '…' + (_apiInflight > 1 ? '（' + _apiInflight + ' 項進行中）' : ''));
    if (isDebugMode()) action(label, 'start');
  }

  function apiEnd(action, ms, ok, extra) {
    _apiInflight = Math.max(0, _apiInflight - 1);
    var label = apiLabel(action);
    var slow = ms >= 1200;
    var detail = (extra || '') + (extra ? ' · ' : '') + formatMs(ms);
    if (_apiInflight <= 0) clearProgress();
    else setProgress('還有 ' + _apiInflight + ' 項資料載入中…');
    if (isDebugMode() || slow || action === 'accounting_bootstrap' || action === 'accounting_auth_me') {
      var tag = (extra && extra.indexOf('GAS 快取') >= 0) ? '（GAS 快取）' : '';
      if (ok) step(label + (slow ? '（偏慢）' : '') + tag, detail);
      else action(label, 'fail', detail);
    }
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

  /** 失敗回報預設收件（與薪資／匯款 fallback 一致） */
  var ERROR_REPORT_EMAIL = 'nephihuang@gmail.com';
  var _lastReportKey = '';
  var _lastReportAt = 0;

  function reportFailure(ctx) {
    ctx = ctx || {};
    var notify = !!ctx.notify;
    var report = notify ? buildErrorReportText(ctx) : '';
    if (notify) {
      var key = String(ctx.action || '') + '|' + String(ctx.message || '');
      if (key === _lastReportKey && (Date.now() - _lastReportAt) < 30000) {
        return Promise.resolve({ success: true, deduped: true });
      }
      _lastReportKey = key;
      _lastReportAt = Date.now();
    }
    if (typeof AccountingApi === 'undefined' || !AccountingApi.reportError) {
      return Promise.resolve({ success: false });
    }
    return AccountingApi.reportError(operator.session, {
      page: ctx.page || pageLabel(),
      message: ctx.message || '',
      report_text: report,
      url: typeof location !== 'undefined' ? String(location.href || '') : '',
      fail_count: ctx.fail_count || 1,
      notify: notify
    });
  }

  function reportPersistentError(ctx) {
    ctx = ctx || {};
    ctx.notify = true;
    return reportFailure(ctx);
  }

  function buildErrorReportText(ctx) {
    ctx = ctx || {};
    var lines = [
      '【添心會計・錯誤回報】',
      '時間：' + new Date().toLocaleString('zh-TW', { hour12: false }),
      '頁面：' + (ctx.page || pageLabel()),
      '網址：' + (typeof location !== 'undefined' ? String(location.href || '').slice(0, 240) : ''),
      '動作：' + (ctx.action || '開啟頁面')
    ];
    if (operator.displayName || operator.userId) {
      lines.push('操作人：' + (operator.displayName || '—') + (operator.userId ? '（' + operator.userId + '）' : ''));
    }
    if (ctx.project_no || ctx.client_name) {
      lines.push('案號：' + (ctx.project_no || '—') + (ctx.client_name ? '　客戶：' + ctx.client_name : ''));
    }
    lines.push('錯誤：' + (ctx.message || '未知錯誤'));
    if (ctx.tech) lines.push('技術摘要：' + String(ctx.tech).slice(0, 400));
    return lines.join('\n');
  }

  function buildErrorMailtoUrl(reportText, ctx) {
    ctx = ctx || {};
    var subject = '添心會計錯誤回報・' + (ctx.page || pageLabel());
    var body = String(reportText || '').slice(0, 1600);
    return 'mailto:' + encodeURIComponent(ERROR_REPORT_EMAIL) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  /**
   * 致命／開頁失敗：人話說明 + 再試 + 複製 + 開信寄到信箱
   * @param {HTMLElement|string} target - 容器或 id（預設 #loading）
   * @param {object} ctx - { message, action, page, tech, onRetry }
   */
  function showFatalError(target, ctx) {
    ctx = ctx || {};
    ensureMount();
    var el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) el = document.getElementById('loading');
    if (!el) {
      toast('err', ctx.message || '發生錯誤', 8000);
      return null;
    }
    var report = buildErrorReportText(ctx);
    el.classList.remove('hidden');
    el.innerHTML = '';
    _progressEl = null;

    var wrap = document.createElement('div');
    wrap.className = 'acct-fatal-err';
    wrap.setAttribute('role', 'alert');

    var title = document.createElement('h3');
    title.textContent = '無法繼續';
    wrap.appendChild(title);

    var msg = document.createElement('p');
    msg.className = 'acct-fatal-msg';
    msg.textContent = ctx.message || '發生錯誤';
    wrap.appendChild(msg);

    var hint = document.createElement('p');
    hint.className = 'acct-fatal-hint';
    hint.textContent = '錯誤紀錄產生中…可再試一次，或按「複製錯誤」。';
    wrap.appendChild(hint);

    var actions = document.createElement('div');
    actions.className = 'err-actions';

    var retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-primary';
    retryBtn.textContent = '再試一次';
    retryBtn.addEventListener('click', function () {
      if (typeof ctx.onRetry === 'function') {
        setBtnBusy(retryBtn, true, '重試中…');
        Promise.resolve(ctx.onRetry()).catch(function () {}).finally(function () {
          setBtnBusy(retryBtn, false);
        });
      } else {
        location.reload();
      }
    });
    actions.appendChild(retryBtn);

    var fallback = document.createElement('pre');
    fallback.className = 'err-fallback hidden';
    fallback.textContent = report;

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn';
    copyBtn.textContent = '複製錯誤';
    copyBtn.addEventListener('click', function () {
      setBtnBusy(copyBtn, true, '複製中…');
      copyText(report, { okToast: '已複製錯誤內容' }).then(function (ok) {
        setBtnBusy(copyBtn, false);
        if (ok) {
          copyBtn.textContent = '已複製';
          setTimeout(function () { copyBtn.textContent = '複製錯誤'; }, 1600);
        } else {
          fallback.classList.remove('hidden');
          try {
            var range = document.createRange();
            range.selectNodeContents(fallback);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (eSel) {}
        }
      });
    });
    actions.appendChild(copyBtn);

    var mailBtn = document.createElement('a');
    mailBtn.className = 'btn btn-mail';
    mailBtn.textContent = '寄送中…';
    mailBtn.href = buildErrorMailtoUrl(report, ctx);
    mailBtn.addEventListener('click', function () {
      tap('傳送到信箱（錯誤回報）');
    });
    actions.appendChild(mailBtn);

    wrap.appendChild(actions);
    wrap.appendChild(fallback);
    el.appendChild(wrap);
    pushLog('err', ctx.message || '無法繼續');
    reportPersistentError(ctx).then(function (res) {
      if (res && (res.emailed || res.deduped)) {
        hint.textContent = '錯誤已記錄並寄到 ' + ERROR_REPORT_EMAIL + '。可再試一次，或按「複製錯誤」。';
        mailBtn.textContent = res.deduped ? '稍早已寄過' : '已寄到信箱';
      } else if (res && res.logged && !res.emailed) {
        hint.textContent = '錯誤已寫入紀錄。寄信未送出時，請按「複製錯誤」或開信寄出。';
        mailBtn.textContent = '開信寄出';
      } else {
        hint.textContent = '請按「複製錯誤」；也可開信寄到 ' + ERROR_REPORT_EMAIL + '。';
        mailBtn.textContent = '開信寄出';
      }
    }).catch(function () {
      hint.textContent = '請按「複製錯誤」，或開信寄到 ' + ERROR_REPORT_EMAIL + '。';
      mailBtn.textContent = '開信寄出';
    });
    return wrap;
  }

  var REJECT_CHIPS = [
    '金額或明細不對',
    '附件不足／看不清',
    '對象或案號不對',
    '先退回、請重送'
  ];

  /**
   * 退回二階段確認：先問要不要退，再點現成原因（或填其他）。
   * 取消／關掉／點遮罩 → resolve(null)，不送後端。
   * 點現成標籤 → 立刻 resolve({ reason })；「其他」需再按確定退回。
   */
  function confirmReject(opts) {
    opts = opts || {};
    var chips = (opts.chips && opts.chips.length) ? opts.chips : REJECT_CHIPS;
    var summary = String(opts.summary || '').trim();
    var preset = String(opts.reason || '').trim();

    injectStyles();
    return new Promise(function (resolve) {
      var prev = document.getElementById('acctRejectDlg');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

      var settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }

      var overlay = document.createElement('div');
      overlay.id = 'acctRejectDlg';
      overlay.className = 'acct-dlg-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'acctRejectTitle1');

      overlay.innerHTML =
        '<div class="acct-dlg">' +
          '<div class="acct-dlg-step" data-step="1">' +
            '<h3 id="acctRejectTitle1">確定要退回這筆？</h3>' +
            (summary ? '<p class="acct-dlg-sum"></p>' : '') +
            '<p class="acct-dlg-hint">取消或關掉視窗＝不會退回。下一步才選原因。</p>' +
            '<div class="acct-dlg-actions">' +
              '<button type="button" class="acct-dlg-cancel" data-act="cancel">取消</button>' +
              '<button type="button" class="acct-dlg-next" data-act="next">下一步：選原因</button>' +
            '</div>' +
          '</div>' +
          '<div class="acct-dlg-step hidden" data-step="2">' +
            '<h3 id="acctRejectTitle2">為什麼退回？</h3>' +
            '<p class="acct-dlg-hint">點一個現成原因即可，不必打字。點了就送出。</p>' +
            '<div class="acct-dlg-chips"></div>' +
            '<div class="acct-dlg-other hidden">' +
              '<label for="acctRejectOther">其他原因</label>' +
              '<textarea id="acctRejectOther" rows="3" placeholder="可留空，或寫給對方看的說明"></textarea>' +
              '<div class="acct-dlg-actions">' +
                '<button type="button" class="acct-dlg-ok" data-act="ok">確定退回</button>' +
              '</div>' +
            '</div>' +
            '<div class="acct-dlg-actions">' +
              '<button type="button" class="acct-dlg-cancel" data-act="cancel">取消</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var sumEl = overlay.querySelector('.acct-dlg-sum');
      if (sumEl) sumEl.textContent = summary;

      var chipBox = overlay.querySelector('.acct-dlg-chips');
      var otherWrap = overlay.querySelector('.acct-dlg-other');
      var otherInput = overlay.querySelector('#acctRejectOther');
      var matchedChip = false;
      chips.forEach(function (label) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'acct-dlg-chip';
        btn.textContent = label;
        if (preset && preset === label) {
          btn.classList.add('is-on');
          matchedChip = true;
        }
        btn.addEventListener('click', function () {
          if (settled) return;
          overlay.querySelectorAll('.acct-dlg-chip').forEach(function (c) {
            c.classList.remove('is-on');
            c.disabled = true;
          });
          btn.classList.add('is-on');
          finish({ reason: label });
        });
        chipBox.appendChild(btn);
      });
      var otherChip = document.createElement('button');
      otherChip.type = 'button';
      otherChip.className = 'acct-dlg-chip';
      otherChip.textContent = '其他（自己寫）';
      if (preset && !matchedChip) otherChip.classList.add('is-on');
      otherChip.addEventListener('click', function () {
        overlay.querySelectorAll('.acct-dlg-chip').forEach(function (c) { c.classList.remove('is-on'); });
        otherChip.classList.add('is-on');
        otherWrap.classList.remove('hidden');
        otherInput.focus();
      });
      chipBox.appendChild(otherChip);
      if (preset && !matchedChip) {
        otherInput.value = preset;
        otherWrap.classList.remove('hidden');
      }

      function showStep2() {
        overlay.querySelector('[data-step="1"]').classList.add('hidden');
        overlay.querySelector('[data-step="2"]').classList.remove('hidden');
        overlay.setAttribute('aria-labelledby', 'acctRejectTitle2');
      }

      overlay.addEventListener('click', function (e) {
        var actEl = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
        var act = actEl ? actEl.getAttribute('data-act') : '';
        if (e.target === overlay || act === 'cancel') {
          finish(null);
          return;
        }
        if (act === 'next') {
          showStep2();
          return;
        }
        if (act === 'ok') {
          finish({ reason: String(otherInput.value || '').trim() });
        }
      });

      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      var cancelBtn = overlay.querySelector('[data-step="1"] .acct-dlg-cancel');
      if (cancelBtn) cancelBtn.focus();
    });
  }

  return {
    ERROR_REPORT_EMAIL: ERROR_REPORT_EMAIL,
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
      if (isDebugMode()) {
        restoreStoredLogs();
        consumeNavIntent();
        renderLog();
        pushLog('info', '就緒：' + pageLabel());
      } else {
        consumeNavIntent();
      }
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
    copyText: copyText,
    buildErrorReportText: buildErrorReportText,
    buildErrorMailtoUrl: buildErrorMailtoUrl,
    showFatalError: showFatalError,
    confirmReject: confirmReject,
    REJECT_CHIPS: REJECT_CHIPS,
    reportPersistentError: reportPersistentError,
    reportFailure: reportFailure,
    action: action,
    step: step,
    setProgress: setProgress,
    clearProgress: clearProgress,
    apiStart: apiStart,
    apiEnd: apiEnd,
    isDebugMode: isDebugMode,
    formatMs: formatMs,
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
      // toastOnOk／toastOnFail：頁面已有專屬成功列時可關，避免雙重提示重疊
      var toastOnOk = runOpts.toastOnOk !== false;
      var toastOnFail = runOpts.toastOnFail !== false;

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
              action(label, 'ok', null, { toast: toastOnOk });
              return qResult;
            } catch (eQ) {
              action(label, 'fail', eQ.message || String(eQ), { toast: toastOnFail });
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
        action(label, 'ok', null, { toast: toastOnOk });
        return result;
      } catch (e) {
        action(label, 'fail', e.message || String(e), { toast: toastOnFail });
        throw e;
      } finally {
        setBtnBusy(btn, false);
        if (runOpts.lockSelectors) setButtonsDisabled(runOpts.lockSelectors, false);
      }
    }
  };
})();
