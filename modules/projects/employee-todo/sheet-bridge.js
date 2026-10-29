/**
 * Mantle UI → Google Sheet（project-console todo_*）資料橋。
 * 攔截 mantledb.sh fetch；不寫回 Mantle。
 * ?preview=1／?demo=1：本機示範文件，不打 GAS。
 */
(function employeeTodoSheetBridge() {
  'use strict';

  var GAS_WEB_APP_URL =
    'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';
  var LIFF_ID = '2007974938-U374uwei';
  var CACHE_KEY = 'employee-todo-sheet-bridge-v1';
  var MANTLE_HOST = 'mantledb.sh';

  var lastRemote = null;
  var liffReady = null;

  function isPreview() {
    try {
      var q = new URLSearchParams(window.location.search);
      return q.get('preview') === '1' || q.get('demo') === '1';
    } catch (e) {
      return false;
    }
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
      deletedIds: [],
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
      deletedIds: [
        'task-ende-751-putu',
        'task-ende-786-pp',
        'task-ende-photo-trim',
        'task-ende-hao-790',
        'task-ende-reorder-qty',
        'task-ayong-trim-knife',
        'task-renkai-trim-knife',
      ],
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

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.tasks)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveCache(doc) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(doc));
    } catch (e) {
      /* ignore */
    }
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

  /** 外開瀏覽器勿自動導向 LINE Login（否則整頁被蓋掉，看起來像「沒有變」） */
  function showLoginHint() {
    if (document.getElementById('et-sheet-login-hint')) return;
    function mount() {
      if (document.getElementById('et-sheet-login-hint')) return;
      var el = document.createElement('button');
      el.id = 'et-sheet-login-hint';
      el.type = 'button';
      el.textContent = '用 LINE 登入同步試算表';
      el.setAttribute(
        'style',
        'position:fixed;z-index:40;left:50%;top:max(.65rem,env(safe-area-inset-top));' +
          'transform:translateX(-50%);border:0;border-radius:999px;padding:.55rem 1rem;' +
          'font:700 .82rem/1 "Noto Sans TC",sans-serif;color:#fff;background:#06c755;' +
          'box-shadow:0 6px 18px #00000033;cursor:pointer;max-width:min(92vw,22rem);',
      );
      el.addEventListener('click', function () {
        if (!window.liff || typeof window.liff.login !== 'function') {
          window.alert('LINE 登入尚未就緒，請稍後再試或用 LINE 內建瀏覽器開啟');
          return;
        }
        window.liff.login({ redirectUri: buildLoginRedirectUri() });
      });
      document.body.appendChild(el);
      try {
        document.documentElement.style.setProperty('--et-login-hint-pad', '3.25rem');
        if (document.body) {
          document.body.style.paddingTop =
            'max(3.25rem, calc(env(safe-area-inset-top) + 2.6rem))';
        }
      } catch (e) {}
    }
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }

  function waitForLiff() {
    if (isPreview()) return Promise.resolve(null);
    if (liffReady) return liffReady;
    liffReady = new Promise(function (resolve) {
      var tries = 0;
      function tick() {
        tries += 1;
        if (window.liff && typeof window.liff.init === 'function') {
          window.liff
            .init({ liffId: LIFF_ID })
            .then(function () {
              if (window.liff.isLoggedIn()) {
                var hint = document.getElementById('et-sheet-login-hint');
                if (hint) hint.remove();
                try {
                  if (document.body) document.body.style.paddingTop = '';
                } catch (e) {}
                resolve(window.liff.getIDToken() || null);
                return;
              }
              // 已在 LINE App 內可自動登入；外開只顯示按鈕，不整頁跳轉
              var inClient =
                typeof window.liff.isInClient === 'function' && window.liff.isInClient();
              if (inClient) {
                window.liff.login({ redirectUri: buildLoginRedirectUri() });
                resolve(null);
                return;
              }
              showLoginHint();
              resolve(null);
            })
            .catch(function () {
              showLoginHint();
              resolve(null);
            });
          return;
        }
        if (tries > 80) {
          showLoginHint();
          resolve(null);
          return;
        }
        setTimeout(tick, 50);
      }
      tick();
    });
    return liffReady;
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

  async function handlePull() {
    if (isPreview()) {
      var local = loadCache() || previewDoc();
      lastRemote = JSON.parse(JSON.stringify(local));
      return jsonResponse(local);
    }
    var cached = loadCache();
    var token = await waitForLiff();
    if (!token) {
      if (cached) {
        lastRemote = JSON.parse(JSON.stringify(cached));
        return jsonResponse(cached);
      }
      return jsonResponse(emptyDoc());
    }
    try {
      var doc = await pullFromSheet(token);
      return jsonResponse(doc);
    } catch (e) {
      if (cached) {
        lastRemote = JSON.parse(JSON.stringify(cached));
        return jsonResponse(cached);
      }
      return jsonResponse(emptyDoc(), 200);
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
      saveCache(next);
      return jsonResponse({ ok: true });
    }
    var token = await waitForLiff();
    if (!token) {
      // 無 token：只存本機，不碰 Sheet／Mantle
      saveCache(next);
      return jsonResponse({ ok: true });
    }
    try {
      await applyPushDiff(lastRemote || loadCache(), next, token);
      return jsonResponse({ ok: true });
    } catch (e) {
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
    cacheKey: CACHE_KEY,
  };
})();
