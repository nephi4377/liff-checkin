/**
 * 會計表單：讀取 HUB 已快取的員工／案場（HubRefCache → 父層 SPA → localStorage）
 */
var AccountingContext = (function () {
  var STORE_OPTIONS = ['台南', '高雄', '工廠', '行政'];

  function readViaHubRef(kind) {
    if (typeof HubRefCache === 'undefined') return null;
    return HubRefCache.read(kind);
  }

  function readLocalLegacy(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (!parsed || parsed.expires < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function readTanxinKey(kind) {
    var key = kind === 'employees' ? 'tanxin_ref_v1:employees' : 'tanxin_ref_v1:projects';
    return readLocalLegacy(key);
  }

  function readEmployees() {
    var viaRef = readViaHubRef('employees');
    if (viaRef && viaRef.length) return viaRef;
    return readTanxinKey('employees') || readLocalLegacy('spa_hub_employees') || [];
  }

  function readProjectsRaw() {
    var viaRef = readViaHubRef('projects');
    if (viaRef && viaRef.length) return viaRef;
    return readTanxinKey('projects') || readLocalLegacy('spa_hub_projects') || [];
  }

  function normalizeProject(p) {
    if (!p) return null;
    var id = String(p.id || p.project_no || p['案號'] || '').trim();
    if (!id) return null;
    var name = String(p.name || p.client_name || p['案場名稱'] || p.siteName || '').trim();
    return {
      id: id,
      name: name,
      siteName: String(p.siteName || name || '').trim(),
      store: String(p.store || p['專案分區'] || '').trim()
    };
  }

  function mapStoreValue(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (STORE_OPTIONS.indexOf(s) >= 0) return s;
    if (s.indexOf('台南') >= 0) return '台南';
    if (s.indexOf('高雄') >= 0) return '高雄';
    if (s.indexOf('工廠') >= 0) return '工廠';
    if (s.indexOf('行政') >= 0) return '行政';
    return '';
  }

  function isActiveEmployee(emp) {
    if (!emp) return false;
    var leave = emp['離職日'];
    return leave === undefined || leave === null || String(leave).trim() === '';
  }

  function sourceFor(kind, hasData, extraField) {
    if (typeof HubRefCache !== 'undefined' && HubRefCache.readFromParent(kind)) return 'parent';
    if (typeof HubRefCache !== 'undefined' && HubRefCache.get(kind)) return 'hub_ref_cache';
    if (hasData) return 'localStorage';
    if (extraField) return 'api';
    return 'none';
  }

  function load(extra) {
    var employees = readEmployees();
    var projectsRaw = readProjectsRaw();
    var projects = [];
    var seen = {};
    (projectsRaw || []).forEach(function (p) {
      var n = normalizeProject(p);
      if (!n || seen[n.id]) return;
      seen[n.id] = true;
      projects.push(n);
    });
    projects.sort(function (a, b) {
      var na = parseInt(a.id, 10);
      var nb = parseInt(b.id, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na;
      return b.id.localeCompare(a.id, 'zh-Hant');
    });

    var activeEmployees = (employees || []).filter(isActiveEmployee).sort(function (a, b) {
      return String(a.userName || '').localeCompare(String(b.userName || ''), 'zh-Hant');
    });

    if (extra && extra.projects && extra.projects.length) {
      extra.projects.forEach(function (p) {
        var n = normalizeProject(p);
        if (!n || seen[n.id]) return;
        seen[n.id] = true;
        projects.push(n);
      });
      projects.sort(function (a, b) {
        var na = parseInt(a.id, 10);
        var nb = parseInt(b.id, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na;
        return b.id.localeCompare(a.id, 'zh-Hant');
      });
    }
    if (extra && extra.employees && extra.employees.length) {
      var empSeen = {};
      activeEmployees.forEach(function (e) { if (e.userName) empSeen[e.userName] = true; });
      extra.employees.forEach(function (e) {
        if (!e || !e.userName || empSeen[e.userName]) return;
        empSeen[e.userName] = true;
        activeEmployees.push({ userId: e.userId || '', userName: e.userName });
      });
      activeEmployees.sort(function (a, b) {
        return String(a.userName || '').localeCompare(String(b.userName || ''), 'zh-Hant');
      });
    }

    return {
      employees: activeEmployees,
      projects: projects,
      source: {
        employees: sourceFor('employees', activeEmployees.length > 0, extra && extra.employees && extra.employees.length),
        projects: sourceFor('projects', projects.length > 0, extra && extra.projects && extra.projects.length)
      }
    };
  }

  function findEmployeeByUserId(employees, userId) {
    if (!userId) return null;
    return (employees || []).find(function (e) {
      return String(e.userId || '').trim() === String(userId).trim();
    }) || null;
  }

  /** HUB iframe 內：主控台資料可能晚幾秒才到，短暫等待避免空白下拉 */
  function waitForHubData(opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 15000;
    var intervalMs = opts.intervalMs || 400;
    var start = Date.now();
    return new Promise(function (resolve) {
      function tick() {
        var ctx = load();
        if (ctx.employees.length || ctx.projects.length) return resolve(ctx);
        if (Date.now() - start >= timeoutMs) return resolve(ctx);
        setTimeout(tick, intervalMs);
      }
      tick();
    });
  }

  return {
    load: load,
    waitForHubData: waitForHubData,
    mapStoreValue: mapStoreValue,
    findEmployeeByUserId: findEmployeeByUserId,
    STORE_OPTIONS: STORE_OPTIONS
  };
})();
