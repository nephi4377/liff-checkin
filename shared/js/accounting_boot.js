/**
 * 會計靜態頁共用啟動：UI、導覽、登入（有快取先顯示，背景驗證）
 */
var AccountingBoot = (function () {
  function showApp() {
    var loading = document.getElementById('loading');
    var app = document.getElementById('app');
    if (loading) loading.classList.add('hidden');
    if (app) app.classList.remove('hidden');
  }

  function setLoading(text) {
    var loading = document.getElementById('loading');
    if (loading) loading.textContent = text;
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
      applySessionUi(fresh, opts);
      if (typeof AccountingUi !== 'undefined' && AccountingUi.setOperator) AccountingUi.setOperator(fresh);
      if (typeof opts.onRevalidate === 'function') opts.onRevalidate(fresh);
    }).catch(function () {});
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
    if (typeof AccountingUi !== 'undefined') AccountingUi.init();
    if (typeof AccountingNav !== 'undefined') AccountingNav.init();
    var initFn = opts.initSession || function () { return AccountingApi.initSession(); };
    var minPerm = opts.minPermission != null ? opts.minPermission : AccountingApi.MIN_PERMISSION;

    var cached = null;
    if (typeof AccountingApi.tryCachedSession === 'function') {
      try {
        cached = AccountingApi.tryCachedSession({
          minPermission: minPerm,
          authAction: opts.authAction
        });
      } catch (eCache) {
        cached = null;
      }
    }

    if (cached) {
      try {
        if ((cached.auth.permission || 0) < minPerm) {
          throw new Error(opts.deniedMsg || AccountingApi.PERM_DENIED_MSG);
        }
        applySessionUi(cached, opts);
        if (typeof opts.onReady === 'function') await opts.onReady(cached);
        backgroundRevalidate(initFn, cached, opts);
        return cached;
      } catch (eCachedRun) {
        setLoading(eCachedRun.message || String(eCachedRun));
        return null;
      }
    }

    try {
      var session = await initFn();
      if (!session) return null;
      if ((session.auth.permission || 0) < minPerm) {
        throw new Error(opts.deniedMsg || AccountingApi.PERM_DENIED_MSG);
      }
      applySessionUi(session, opts);
      if (typeof opts.onReady === 'function') await opts.onReady(session);
      return session;
    } catch (e) {
      setLoading(e.message || String(e));
      return null;
    }
  }

  return {
    run: run,
    showApp: showApp,
    setLoading: setLoading,
    formatUserLine: formatUserLine
  };
})();
