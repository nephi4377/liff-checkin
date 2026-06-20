/**
 * 會計表單：讀取 HUB 已快取的員工／案場（localStorage 或父層 SPA）
 */
var AccountingContext = (function () {
  var CACHE_KEYS = {
    employees: 'spa_hub_employees',
    projects: 'spa_hub_projects'
  };
  var STORE_OPTIONS = ['台南', '高雄', '工廠', '行政'];

  function readLocalCache(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var cache = JSON.parse(raw);
      if (!cache || cache.expires < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return cache.data;
    } catch (e) {
      return null;
    }
  }

  function readParentArray(name) {
    try {
      if (!window.parent || window.parent === window) return null;
      var data = window.parent[name];
      return Array.isArray(data) ? data : null;
    } catch (e) {
      return null;
    }
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

  function load(extra) {
    var employees = readParentArray('spaAllEmployees') || readLocalCache(CACHE_KEYS.employees) || [];
    var projectsRaw = readParentArray('spaAllProjects') || readLocalCache(CACHE_KEYS.projects) || [];
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
        employees: activeEmployees.length ? (readParentArray('spaAllEmployees') ? 'parent' : (extra && extra.employees ? 'api' : 'localStorage')) : ((extra && extra.employees && extra.employees.length) ? 'api' : 'none'),
        projects: projects.length ? (readParentArray('spaAllProjects') ? 'parent' : (extra && extra.projects ? 'api' : 'localStorage')) : ((extra && extra.projects && extra.projects.length) ? 'api' : 'none')
      }
    };
  }

  function findEmployeeByUserId(employees, userId) {
    if (!userId) return null;
    return (employees || []).find(function (e) {
      return String(e.userId || '').trim() === String(userId).trim();
    }) || null;
  }

  return {
    load: load,
    mapStoreValue: mapStoreValue,
    findEmployeeByUserId: findEmployeeByUserId,
    STORE_OPTIONS: STORE_OPTIONS
  };
})();
