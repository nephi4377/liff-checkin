/**
 * 會計靜態頁共用啟動：UI、導覽、登入
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
    try {
      var session = await initFn();
      if (!session) return null;
      if (typeof OperatorContext !== 'undefined') OperatorContext.applySession(session);
      var minPerm = opts.minPermission != null ? opts.minPermission : AccountingApi.MIN_PERMISSION;
      if ((session.auth.permission || 0) < minPerm) {
        throw new Error(opts.deniedMsg || AccountingApi.PERM_DENIED_MSG);
      }
      var userLine = document.getElementById('userLine');
      if (userLine) userLine.textContent = formatUserLine(session, opts.userExtra || '');
      showApp();
      if (opts.preloadBootstrap && typeof AccountingCache !== 'undefined' && !AccountingCache.get(session)) {
        AccountingCache.load(session).catch(function () {});
      }
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
