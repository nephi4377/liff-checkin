/**
 * 會計操作佇列 — 審核／匯款等動作串行處理，不鎖整頁按鈕
 */
var AccountingActionQueue = (function () {
  var queues = {};

  function getQueue(queueId) {
    var id = queueId || 'default';
    if (!queues[id]) {
      queues[id] = {
        items: [],
        running: false,
        pendingIds: {},
        done: 0,
        total: 0,
        statusEl: null
      };
    }
    return queues[id];
  }

  function ensureStatusEl(queue) {
    if (queue.statusEl && document.body.contains(queue.statusEl)) return queue.statusEl;
    var el = document.getElementById('acctQueueStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'acctQueueStatus';
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = [
        'position:fixed', 'bottom:128px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:10045', 'background:#1a73e8', 'color:#fff', 'font-size:13px', 'font-weight:600',
        'padding:6px 14px', 'border-radius:999px', 'box-shadow:0 2px 12px rgba(0,0,0,.2)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(el);
    }
    queue.statusEl = el;
    return el;
  }

  function updateStatus(queue) {
    var el = ensureStatusEl(queue);
    if (!queue.running && !queue.items.length) {
      el.style.display = 'none';
      queue.done = 0;
      queue.total = 0;
      return;
    }
    var cur = queue.done + (queue.running ? 1 : 0);
    el.textContent = '處理中 ' + cur + '/' + queue.total;
    el.style.display = 'block';
  }

  function setBtnBusy(btn, on, busyLabel) {
    if (!btn) return;
    if (typeof AccountingUi !== 'undefined' && AccountingUi.setBtnBusy) {
      AccountingUi.setBtnBusy(btn, on, busyLabel);
      return;
    }
    btn.disabled = !!on;
    if (on && busyLabel) btn.textContent = busyLabel;
  }

  async function drain(queue) {
    if (queue.running) return;
    queue.running = true;
    updateStatus(queue);
    while (queue.items.length) {
      var item = queue.items.shift();
      try {
        var result = await item.fn();
        item.resolve(result);
      } catch (e) {
        item.reject(e);
      } finally {
        queue.done += 1;
        delete queue.pendingIds[item.id];
        setBtnBusy(item.btn, false);
        updateStatus(queue);
      }
    }
    queue.running = false;
    queue.pendingIds = {};
    updateStatus(queue);
  }

  return {
    isPending: function (queueId, itemId) {
      if (!itemId) return false;
      return !!getQueue(queueId).pendingIds[itemId];
    },
    pendingCount: function (queueId) {
      var q = getQueue(queueId);
      return q.items.length + (q.running ? 1 : 0);
    },
    enqueue: function (opts) {
      opts = opts || {};
      var queue = getQueue(opts.queueId);
      var id = opts.id != null ? String(opts.id) : ('job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
      if (queue.pendingIds[id]) {
        return Promise.reject(new Error('此項目已在處理中'));
      }
      queue.pendingIds[id] = true;
      queue.total += 1;
      setBtnBusy(opts.btn, true, opts.busyLabel || '處理中…');
      updateStatus(queue);
      return new Promise(function (resolve, reject) {
        queue.items.push({
          id: id,
          fn: opts.fn,
          btn: opts.btn,
          resolve: resolve,
          reject: reject
        });
        drain(queue);
      });
    }
  };
})();
