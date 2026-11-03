/**
 * Mantle UI → Google Sheet（project-console todo_*）資料橋。
 * 攔截 mantledb.sh fetch；不寫回 Mantle。
 * ?preview=1／?demo=1：僅 localhost 示範，不打 GAS。
 * 正式站：LIFF 登入後 todo_list 成功才回傳清單（CONSOLE-REVIEW-3 精神）。
 */
(function employeeTodoSheetBridge() {
  'use strict';

  var GAS_WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';
  var LIFF_ID = '2007974938-U374uwei';
  var LEGACY_CACHE_KEY = 'employee-todo-sheet-bridge-v1';
  var LOGIN_ATTEMPT_KEY = 'et-liff-login-attempt-v1';
  var MANTLE_HOST = 'mantledb.sh';
  var LIFF_TOKEN_SKEW_SEC = 60;
  /** Mantle 內建示範單：未登入／空文件時必須 tombstone，否則會看起來像「又變回舊版」 */
  var MANTLE_SEED_DELETED_IDS = [
    'task-ende-751-putu',
    'task-ende-786-pp',
    'task-ende-photo-trim',
    'task-ende-hao-790',
    'task-ende-reorder-qty',
    'task-ayong-trim-knife',
    'task-renkai-trim-knife',
  ];

  var lastRemote = null;
  var liffReady = null;
  var sessionListVerified = false;
  var savesBlocked = false;

  function purgeLegacyTaskCache() {
    try {
      localStorage.removeItem(LEGACY_CACHE_KEY);
      var keys = [];
      for (var i = 0; i < localStorage.length; i += 1) {
        var k = localStorage.key(i);
        if (k && k.indexOf('employee-todo-doc-v1:') === 0) keys.push(k);
      }
      keys.forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (e) {
      /* ignore */
    }
  }
  purgeLegacyTaskCache();

  function isLocalhost() {
    try {
      var h = window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
    } catch (e) {
      return false;
    }
  }

  function decodeJwtPayload(token) {
    try {
      if (!token) return null;
      var parts = String(token).split('.');
      if (parts.length < 2) return null;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json = decodeURIComponent(
        Array.prototype.map
          .call(atob(b64), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join(''),
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  function isTokenFresh(token) {
    if (!token) return false;
    var payload = decodeJwtPayload(token);
    if (!payload || payload.exp == null) return false;
    var expSec = parseInt(payload.exp, 10) || 0;
    if (!expSec) return false;
    return expSec > Math.floor(Date.now() / 1000) + LIFF_TOKEN_SKEW_SEC;
  }

  function isPreview() {
    if (!isLocalhost()) return false;
    try {
      var q = new URLSearchParams(window.location.search);
      return q.get('preview') === '1' || q.get('demo') === '1';
    } catch (e) {
      return false;
    }
  }

  function withSeedTombstones(doc) {
    doc = doc || emptyDoc();
    var set = {};
    (doc.deletedIds || []).forEach(function (id) {
      if (id) set[id] = true;
    });
    MANTLE_SEED_DELETED_IDS.forEach(function (id) {
      set[id] = true;
    });
    doc.deletedIds = Object.keys(set);
    doc.tasks = (doc.tasks || []).filter(function (t) {
      return t && t.id && !set[t.id];
    });
    return doc;
  }

  function emptyDoc() {
    return {
      workers: [
        { id: 'ops-ende', name: '恩德' },
        { id: 'ops-ayong', name: '阿勇' },
      ],
      tasks: [],
      officeTasks: [],
      assigners: ['豪哥', '雯姐'],
      deletedIds: MANTLE_SEED_DELETED_IDS.slice(),
      updatedAt: Date.now(),
    };
  }

  function previewDoc() {
    var now = Date.now() + 86400000; // 略新於本機 seed，LWW 以預覽為準
    return {
      workers: [
        { id: 'ops-ende', name: '恩德' },
        { id: 'ops-ayong', name: '阿勇' },
        { id: 'ops-w-yifang', name: '宜芳' },
      ],
      assigners: ['豪哥', '雯姐'],
      // 擋掉 Mantle 內建 seed，避免預覽混進舊示範單
      deletedIds: MANTLE_SEED_DELETED_IDS.slice(),
      updatedAt: now,
      officeTasks: [],
      tasks: [
        {
          id: 'preview-1',
          caseNo: '799',
          title: '雪婷 施作保護工程',
          assigneeId: 'ops-ende',
          category: 'priority',
          urgency: 'urgent',
          order: 0,
          pinned: true,
          completed: false,
          detail: '車位要保護',
          workerNote: '明天上午先量車位再做保護',
          assigner: '雯姐',
          createdAt: now - 86400000,
        },
        {
          id: 'preview-2',
          caseNo: '797',
          title: '保護工程',
          assigneeId: 'ops-ende',
          category: 'priority',
          urgency: 'urgent',
          order: 1,
          completed: false,
          detail: '現場確認邊界',
          workerNote: '缺黑布 2 卷，下午補',
          assigner: '豪哥',
          createdAt: now - 80000000,
        },
        {
          id: 'preview-3',
          caseNo: '999',
          title: '現場補料確認',
          assigneeId: 'ops-ende',
          category: 'todo',
          urgency: 'normal',
          order: 0,
          completed: false,
          assigner: '豪哥',
          workerNote: '已跟廠商約週三送',
          createdAt: now - 70000000,
        },
        {
          id: 'preview-self-1',
          title: '自己記：帶修邊刀',
          assigneeId: 'ops-ende',
          category: 'todo',
          urgency: 'normal',
          order: 2,
          completed: false,
          assigner: '工務自建',
          detail: '樓下白色抽屜',
          createdAt: now - 65000000,
        },
        {
          id: 'preview-4',
          caseNo: '785',
          title: '收邊條位置拍照',
          assigneeId: 'ops-ende',
          category: 'todo',
          urgency: 'normal',
          order: 1,
          completed: false,
          createdAt: now - 60000000,
        },
        {
          id: 'preview-5',
          caseNo: '774',
          title: '送料',
          assigneeId: 'ops-ende',
          category: 'todo',
          urgency: 'normal',
          order: 0,
          completed: true,
          completedAt: now - 3600000,
          createdAt: now - 90000000,
        },
        {
          id: 'preview-6',
          caseNo: '790',
          title: '拿抽煙管來現場',
          assigneeId: 'ops-ende',
          category: 'todo',
          urgency: 'low',
          order: 1,
          completed: true,
          completedAt: now - 7200000,
          createdAt: now - 95000000,
        },
        {
          id: 'preview-7',
          caseNo: '801',
          title: '阿勇明日進場',
          assigneeId: 'ops-ayong',
          category: 'reminder',
          urgency: 'normal',
          order: 0,
          isReminder: true,
          completed: false,
          assigner: '雯姐',
          createdAt: now - 50000000,
        },
      ],
    };
  }

  function saveCache(_doc) {
    /* tasks 不再寫 localStorage */
  }

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function ensureWorkers(doc) {
    var workers = Array.isArray(doc.workers) ? doc.workers.slice() : [];
    var ids = {};
    workers.forEach(function (w) {
      if (w && w.id) ids[w.id] = true;
    });
    ;[
      { id: 'ops-ende', name: '恩德' },
      { id: 'ops-ayong', name: '阿勇' },
    ].forEach(function (w) {
      if (!ids[w.id]) workers.push(w);
    });
    (doc.tasks || []).forEach(function (t) {
      var id = t && t.assigneeId;
      if (!id || ids[id]) return;
      if (String(id).indexOf('ops-') !== 0) return;
      ids[id] = true;
      var name = String(id).replace(/^ops-w-/, '').replace(/^ops-/, '') || id;
      workers.push({ id: id, name: name });
    });
    doc.workers = workers;
    return doc;
  }

  function normalizeDoc(raw) {
    var doc = {
      workers: Array.isArray(raw.workers) ? raw.workers : [],
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      officeTasks: Array.isArray(raw.officeTasks) ? raw.officeTasks : [],
      assigners: Array.isArray(raw.assigners) ? raw.assigners : [],
      deletedIds: Array.isArray(raw.deletedIds) ? raw.deletedIds : [],
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    };
    doc.tasks = doc.tasks.map(function (t) {
      if (!t || typeof t !== 'object') return t;
      var out = Object.assign({}, t);
      if (out.isReminder || out.category === 'reminder') {
        out.category = 'reminder';
        out.isReminder = true;
      }
      if (out.done != null && out.completed == null) out.completed = !!out.done;
      return out;
    });
    return ensureWorkers(doc);
  }

  function buildLoginRedirectUri() {
    var u = new URL('https://info.tanxin.space/modules/projects/employee-todo/');
    var role = new URLSearchParams(window.location.search).get('role');
    if (role) u.searchParams.set('role', role);
    return u.href.split('#')[0];
  }

  function hideLoginRetry() {
    var panel = document.getElementById('et-sheet-login-retry-panel');
    if (panel) panel.remove();
    try {
      if (document.body) document.body.style.paddingTop = '';
    } catch (e) {}
  }

  /** 一次性 login 被取消時，讓使用者手動重試並清掉 session 旗標 */
  function showLoginRetry(hintText) {
    if (isPreview()) return;
    function mount() {
      if (document.getElementById('et-sheet-login-retry-panel')) return;
      var panel = document.createElement('div');
      panel.id = 'et-sheet-login-retry-panel';
      panel.setAttribute(
        'style',
        'position:fixed;z-index:40;left:50%;top:max(.65rem,env(safe-area-inset-top));' +
          'transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:.45rem;' +
          'max-width:min(92vw,22rem);pointer-events:auto;',
      );
      var msg = document.createElement('p');
      msg.textContent =
        hintText || '請用 LINE 登入後才能載入試算表上的待辦';
      msg.setAttribute(
        'style',
        'margin:0;padding:0 .35rem;font:500 .78rem/1.35 "Noto Sans TC",sans-serif;color:#1e2a32;text-align:center;',
      );
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '用 LINE 登入';
      btn.setAttribute(
        'style',
        'border:0;border-radius:999px;padding:.55rem 1.1rem;' +
          'font:700 .82rem/1 "Noto Sans TC",sans-serif;color:#fff;background:#06c755;' +
          'box-shadow:0 6px 18px #00000033;cursor:pointer;width:100%;',
      );
      btn.addEventListener('click', function () {
        clearLoginAttemptFlag();
        liffReady = null;
        hideLoginRetry();
        if (!triggerLiffLogin()) {
          showLoginRetry('若未跳轉，請再按一次或改用 LINE 內建瀏覽器開啟');
        }
      });
      panel.appendChild(msg);
      panel.appendChild(btn);
      document.body.appendChild(panel);
      try {
        if (document.body) {
          document.body.style.paddingTop =
            'max(3.5rem, calc(env(safe-area-inset-top) + 2.8rem))';
        }
      } catch (e) {}
    }
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  function clearLoginAttemptFlag() {
    try {
      sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    } catch (e) {}
  }

  function triggerLiffLogin() {
    if (!window.liff || typeof window.liff.login !== 'function') {
      showLoginRetry('LINE 登入尚未就緒，請稍後再按');
      return false;
    }
    try {
      if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY) === '1') {
        showLoginRetry('登入未完成，請再按下方按鈕');
        return false;
      }
      sessionStorage.setItem(LOGIN_ATTEMPT_KEY, '1');
    } catch (e) {}
    window.liff.login({ redirectUri: buildLoginRedirectUri() });
    return true;
  }

  function waitForLiff() {
    if (isPreview()) return Promise.resolve(null);
    if (liffReady) return liffReady;
    liffReady = new Promise(function (resolve) {
      var tries = 0;
      function finish(token) {
        resolve(token || null);
      }
      function tick() {
        tries += 1;
        if (window.liff && typeof window.liff.init === 'function') {
          window.liff
            .init({ liffId: LIFF_ID })
            .then(function () {
              if (!window.liff.isLoggedIn()) {
                triggerLiffLogin();
                showLoginRetry();
                finish(null);
                return;
              }
              var token = window.liff.getIDToken() || '';
              if (!isTokenFresh(token)) {
                triggerLiffLogin();
                showLoginRetry('登入已過期，請重新登入');
                finish(null);
                return;
              }
              clearLoginAttemptFlag();
              hideLoginRetry();
              finish(token);
            })
            .catch(function (err) {
              console.warn('[employee-todo bridge] liff.init', err);
              triggerLiffLogin();
              showLoginRetry('無法初始化 LINE 登入');
              finish(null);
            });
          return;
        }
        if (tries > 80) {
          showLoginRetry('LINE 登入元件載入逾時');
          finish(null);
          return;
        }
        setTimeout(tick, 50);
      }
      tick();
    });
    return liffReady;
  }

  /** 每次 POST 前重新取 token（過期則導向 login） */
  function requireFreshToken() {
    if (isPreview()) return Promise.resolve(null);
    try {
      if (window.liff && window.liff.isLoggedIn && window.liff.isLoggedIn()) {
        var live = window.liff.getIDToken() || '';
        if (isTokenFresh(live)) return Promise.resolve(live);
      }
    } catch (e) {}
    liffReady = null;
    return waitForLiff();
  }

  function clientRoleFromUrl() {
    try {
      var role = new URLSearchParams(window.location.search).get('role') || '';
      if (role === 'paigong' || role === 'dispatch') return 'dispatch';
      if (role === 'ende' || role === 'ayong' || role.indexOf('ops-') === 0) return 'worker';
      return '';
    } catch (e) {
      return '';
    }
  }

  function postGas(body) {
    var payload = Object.assign({}, body);
    if (!isPreview() && !payload.liff_id_token) {
      return Promise.reject(new Error('缺少 liff_id_token'));
    }
    var cr = clientRoleFromUrl();
    if (cr && !payload.clientRole) payload.clientRole = cr;
    return fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error('GAS 非 JSON');
        }
        if (!data || data.success === false) {
          throw new Error((data && data.message) || 'GAS 失敗');
        }
        return data;
      });
    });
  }

  function pullFromSheet(token) {
    return postGas({ action: 'todo_list', liff_id_token: token }).then(function (data) {
      var doc = normalizeDoc(data);
      lastRemote = JSON.parse(JSON.stringify(doc));
      saveCache(doc);
      return doc;
    });
  }

  function taskFingerprint(t) {
    if (!t) return '';
    return JSON.stringify({
      id: t.id,
      title: t.title,
      caseNo: t.caseNo,
      detail: t.detail,
      workerNote: t.workerNote,
      assigner: t.assigner,
      assigneeId: t.assigneeId,
      category: t.category,
      urgency: t.urgency,
      order: t.order,
      completed: !!t.completed,
      dueDate: t.dueDate,
      pinned: !!t.pinned,
      trashedAt: t.trashedAt || null,
      isReminder: !!t.isReminder,
    });
  }

  function applyPushDiff(prev, next, token) {
    prev = prev || emptyDoc();
    next = normalizeDoc(next || emptyDoc());
    var prevMap = {};
    (prev.tasks || []).forEach(function (t) {
      if (t && t.id) prevMap[t.id] = t;
    });
    var nextMap = {};
    (next.tasks || []).forEach(function (t) {
      if (t && t.id) nextMap[t.id] = t;
    });
    var deleted = new Set(next.deletedIds || []);
    var chain = Promise.resolve();

    Object.keys(prevMap).forEach(function (id) {
      if (!nextMap[id] || deleted.has(id)) {
        chain = chain.then(function () {
          return postGas({
            action: 'todo_delete',
            liff_id_token: token,
            taskId: id,
          }).catch(function () {
            /* keep going */
          });
        });
      }
    });

    Object.keys(nextMap).forEach(function (id) {
      if (deleted.has(id)) return;
      var n = nextMap[id];
      var p = prevMap[id];
      if (!p) {
        chain = chain.then(function () {
          return postGas({
            action: 'todo_add',
            liff_id_token: token,
            task: n,
          });
        });
        return;
      }
      if (taskFingerprint(p) !== taskFingerprint(n)) {
        chain = chain.then(function () {
          return postGas({
            action: 'todo_update',
            liff_id_token: token,
            task: n,
          });
        });
      }
    });

    var orderItems = (next.tasks || [])
      .filter(function (t) {
        return t && t.id && !t.completed && !deleted.has(t.id);
      })
      .map(function (t) {
        return { id: t.id, order: Number(t.order) || 0 };
      });
    if (orderItems.length) {
      chain = chain.then(function () {
        return postGas({
          action: 'todo_reorder',
          liff_id_token: token,
          orders: orderItems,
        }).catch(function () {
          /* optional */
        });
      });
    }

    return chain.then(function () {
      lastRemote = JSON.parse(JSON.stringify(next));
      saveCache(next);
      return next;
    });
  }

  function authBlockedDoc(message) {
    var doc = withSeedTombstones(emptyDoc());
    doc.authRequired = true;
    if (message) doc.authMessage = message;
    return doc;
  }

  function pullErrorResponse(message) {
    if (sessionListVerified && lastRemote) {
      var stale = JSON.parse(JSON.stringify(lastRemote));
      stale.syncError = message || '無法載入待辦';
      stale.syncStale = true;
      return jsonResponse(stale, 503);
    }
    return jsonResponse(authBlockedDoc(message), 401);
  }

  async function handlePull() {
    if (isPreview()) {
      var local = withSeedTombstones(lastRemote || previewDoc());
      lastRemote = JSON.parse(JSON.stringify(local));
      return jsonResponse(local);
    }
    var token = await requireFreshToken();
    if (!token) {
      savesBlocked = true;
      showLoginRetry();
      return jsonResponse(authBlockedDoc('請先以 LINE 登入'), 401);
    }
    try {
      var doc = withSeedTombstones(await pullFromSheet(token));
      sessionListVerified = true;
      savesBlocked = false;
      return jsonResponse(doc);
    } catch (e) {
      savesBlocked = true;
      var msg = (e && e.message) || '無法載入待辦';
      return pullErrorResponse(msg);
    }
  }

  async function handlePush(bodyText) {
    var next;
    try {
      next = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText;
    } catch (e) {
      return jsonResponse({ ok: false }, 400);
    }
    next = normalizeDoc(next || {});
    if (isPreview()) {
      next.updatedAt = Date.now();
      lastRemote = JSON.parse(JSON.stringify(next));
      return jsonResponse({ ok: true });
    }
    if (savesBlocked || !sessionListVerified || !lastRemote) {
      return jsonResponse(
        { ok: false, message: '伺服器同步未完成，已阻擋儲存以免誤刪試算表' },
        409,
      );
    }
    var token = await requireFreshToken();
    if (!token) {
      return jsonResponse({ ok: false, message: '請先 LINE 登入' }, 401);
    }
    try {
      await applyPushDiff(lastRemote, next, token);
      return jsonResponse({ ok: true });
    } catch (e) {
      savesBlocked = true;
      return jsonResponse({ ok: false, message: String(e && e.message) }, 500);
    }
  }

  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = '';
    try {
      url = typeof input === 'string' ? input : String(input && input.url);
    } catch (e) {
      url = '';
    }
    if (url.indexOf(MANTLE_HOST) === -1) {
      return origFetch(input, init);
    }
    var method = String((init && init.method) || 'GET').toUpperCase();
    if (method === 'GET') return handlePull();
    if (method === 'POST') return handlePush(init && init.body);
    return jsonResponse({ ok: false }, 405);
  };

  window.__employeeTodoSheetBridge = {
    isPreview: isPreview,
    isLocalhost: isLocalhost,
    legacyCacheKey: LEGACY_CACHE_KEY,
  };
})();
