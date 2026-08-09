/**
 * 會計靜態頁共用啟動：UI、導覽、登入（有快取先顯示，背景驗證）
 */
var AccountingBoot = (function () {
  function showApp() {
    var loading = document.getElementById('loading');
    var app = document.getElementById('app') || document.getElementById('shell');
    if (loading) loading.classList.add('hidden');
    if (app) app.classList.remove('hidden');
  }

  function setLoading(text) {
    var loading = document.getElementById('loading');
    if (loading) loading.textContent = text;
    if (typeof AccountingUi !== 'undefined' && AccountingUi.setProgress) {
      AccountingUi.setProgress(text ? '' : '');
    }
  }

  function showBootError(message, opts) {
    opts = opts || {};
    var msg = message || '開啟失敗';
    if (typeof AccountingUi !== 'undefined' && AccountingUi.showFatalError) {
      AccountingUi.clearProgress();
      AccountingUi.showFatalError('loading', {
        message: msg,
        action: opts.action || '開啟頁面',
        page: opts.page,
        tech: opts.tech,
        onRetry: opts.onRetry || function () { location.reload(); }
      });
      return;
    }
    setLoading(msg);
  }

  function traceStep(label, detail) {
    if (typeof AccountingUi !== 'undefined' && AccountingUi.step) AccountingUi.step(label, detail);
  }

  function traceProgress(text) {
    if (typeof AccountingUi !== 'undefined' && AccountingUi.setProgress) AccountingUi.setProgress(text);
  }

  function formatUserLine(session, extra) {
    var auth = session.auth || {};
    var name = auth.display_name || (session.profile && session.profile.displayName) || '—';
    var perm = auth.permission || 0;
    var mode = session.devBypass ? ' · 測試模式（無登入）' : '';
    var suffix = extra ? (' · ' + extra) : '';
    return name + ' · 權限 ' + perm + mode + suffix;
  }

  function applySessionUi(session, opts) {
    if (typeof OperatorContext !== 'undefined') OperatorContext.applySession(session);
    var userLine = document.getElementById('userLine');
    if (userLine) userLine.textContent = formatUserLine(session, opts.userExtra || '');
    showApp();
    if (opts.preloadBootstrap && typeof AccountingCache !== 'undefined' && !AccountingCache.get(session)) {
      AccountingCache.load(session).catch(function () {});
    }
  }

  function backgroundRevalidate(initFn, session, opts) {
    initFn().then(function (fresh) {
      if (!fresh) return;
      traceStep('背景驗證', '身分已更新');
      applySessionUi(fresh, opts);
      if (typeof AccountingUi !== 'undefined' && AccountingUi.setOperator) AccountingUi.setOperator(fresh);
      if (typeof opts.onRevalidate === 'function') opts.onRevalidate(fresh);
    }).catch(function (e) {
      var msg = (e && e.message) || String(e);
      traceStep('背景驗證', '失敗 — ' + msg);
      // 登入過期：勿 silently 略過（否則畫面像已登入、寫入卻失敗）
      if (/過期|重新從 LINE|登入憑證/.test(msg)) {
        showBootError(msg, {
          action: '重新驗證身分',
          onRetry: function () { location.reload(); }
        });
      }
    });
  }

  /**
   * @param {object} opts
   * @param {function} [opts.initSession] - 預設 AccountingApi.initSession
   * @param {number} [opts.minPermission]
   * @param {string} [opts.deniedMsg]
   * @param {function} [opts.onReady] - async (session) => void，showApp 之後執行
   * @param {boolean} [opts.preloadBootstrap] - 背景 AccountingCache.load
   */
  async function run(opts) {
    opts = opts || {};
    if (typeof AccountingNav !== 'undefined' && AccountingNav.isEmbed && AccountingNav.isEmbed()) {
      opts.preloadBootstrap = false;
    }
    if (typeof AccountingUi !== 'undefined') AccountingUi.init();
    if (typeof AccountingNav !== 'undefined') AccountingNav.init();
    if (typeof AccountingUi !== 'undefined') AccountingUi.action('啟動頁面', 'start');
    traceProgress('檢查本機登入…');
    var minPerm = opts.minPermission != null ? opts.minPermission : AccountingApi.MIN_PERMISSION;
    var initOpts = { minPermission: minPerm, deniedMsg: opts.deniedMsg, authAction: opts.authAction };
    var initFn = opts.initSession || function (bootOpts) { return AccountingApi.initSession(bootOpts); };
    var runInit = function () { return initFn(initOpts); };

    var cached = null;
    if (typeof AccountingApi.tryCachedSession === 'function') {
      try {
        cached = AccountingApi.tryCachedSession({
          minPermission: minPerm,
          authAction: opts.authAction
        });
        if (cached) traceStep('登入快取', '直接沿用上次驗證');
      } catch (eCache) {
        cached = null;
      }
    }
    if (!cached && typeof AccountingApi.tryProvisionalSession === 'function') {
      try {
        cached = AccountingApi.tryProvisionalSession({
          minPermission: minPerm,
          authAction: opts.authAction
        });
        if (cached) traceStep('暫用身分', '先顯示畫面，背景再驗證');
      } catch (eProv) {
        cached = null;
      }
    }

    if (cached) {
      try {
        if ((cached.auth.permission || 0) < minPerm) {
          throw new Error(opts.deniedMsg || AccountingApi.PERM_DENIED_MSG);
        }
        applySessionUi(cached, opts);
        if (typeof AccountingUi !== 'undefined') {
          AccountingUi.action('啟動頁面', 'ok', '快取登入');
          AccountingUi.clearProgress();
        }
        if (typeof opts.onReady === 'function') await opts.onReady(cached);
        // 背景驗證成功後也要重跑選單／門檻（否則升權後仍沿用舊畫面）
        var revalOpts = Object.assign({}, opts, {
          onRevalidate: async function (fresh) {
            if (typeof opts.onRevalidate === 'function') await opts.onRevalidate(fresh);
            else if (typeof opts.onReady === 'function'
                && Number((cached.auth && cached.auth.permission) || 0)
                  !== Number((fresh.auth && fresh.auth.permission) || 0)) {
              await opts.onReady(fresh);
            }
          }
        });
        traceProgress('背景重新驗證身分…');
        backgroundRevalidate(runInit, cached, revalOpts);
        return cached;
      } catch (eCachedRun) {
        var msgCache = eCachedRun.message || String(eCachedRun);
        showBootError(msgCache, { action: '快取登入', tech: String(eCachedRun && eCachedRun.stack || msgCache).slice(0, 400) });
        if (typeof AccountingUi !== 'undefined') AccountingUi.action('啟動頁面', 'fail', msgCache);
        return null;
      }
    }

    try {
      traceProgress('向後端驗證身分…');
      var session = await runInit();
      if (!session) return null;
      if ((session.auth.permission || 0) < minPerm) {
        throw new Error(opts.deniedMsg || AccountingApi.PERM_DENIED_MSG);
      }
      applySessionUi(session, opts);
      if (typeof AccountingUi !== 'undefined') {
        AccountingUi.action('啟動頁面', 'ok');
        AccountingUi.clearProgress();
      }
      if (typeof opts.onReady === 'function') await opts.onReady(session);
      return session;
    } catch (e) {
      var msg = e.message || String(e);
      showBootError(msg, { action: '驗證身分', tech: String(e && e.stack || msg).slice(0, 400) });
      if (typeof AccountingUi !== 'undefined') AccountingUi.action('啟動頁面', 'fail', msg);
      return null;
    }
  }

  return {
    run: run,
    showApp: showApp,
    setLoading: setLoading,
    showBootError: showBootError,
    formatUserLine: formatUserLine
  };
})();
