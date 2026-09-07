/**
 * 會計模組共用單據燈箱（不跳頁）
 */
var AccountingLightbox = (function () {
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    var style = document.createElement('style');
    style.textContent =
      '.acct-lb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}' +
      '.acct-lb-overlay.hidden{display:none}' +
      '.acct-lb-toolbar{display:flex;gap:8px;margin-bottom:8px;width:100%;max-width:640px;justify-content:space-between;align-items:center;color:#fff}' +
      '.acct-lb-btn{background:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer}' +
      '.acct-lb-img{max-width:100%;max-height:78vh;border-radius:8px;background:#111}' +
      '.acct-lb-link{color:#8ab4f8;font-size:14px;text-decoration:none;margin-top:8px}';
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.className = 'acct-lb-overlay hidden';
    overlay.innerHTML =
      '<div class="acct-lb-toolbar">' +
      '<span id="acctLbTitle">單據</span>' +
      '<div><button type="button" class="acct-lb-btn" id="acctLbPrev">上一張</button>' +
      '<button type="button" class="acct-lb-btn" id="acctLbNext">下一張</button>' +
      '<button type="button" class="acct-lb-btn" id="acctLbClose">關閉</button></div></div>' +
      '<img class="acct-lb-img" id="acctLbImg" alt="單據" />' +
      '<a class="acct-lb-link" id="acctLbOpen" target="_blank" rel="noopener">在 Drive 開啟</a>';
    document.body.appendChild(overlay);

    overlay.querySelector('#acctLbClose').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    return overlay;
  }

  var urls = [];
  var idx = 0;

  function thumbUrl(url) {
    var m = String(url || '').match(/\/d\/([^/]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1200';
    return url;
  }

  function render() {
    if (!urls.length) return;
    var u = urls[idx];
    document.getElementById('acctLbImg').src = thumbUrl(u);
    document.getElementById('acctLbOpen').href = u;
    document.getElementById('acctLbTitle').textContent = '單據 ' + (idx + 1) + ' / ' + urls.length;
    document.getElementById('acctLbPrev').disabled = idx <= 0;
    document.getElementById('acctLbNext').disabled = idx >= urls.length - 1;
  }

  function open(urlList) {
    urls = (urlList || []).filter(Boolean);
    if (!urls.length) return false;
    idx = 0;
    ensureOverlay();
    overlay.classList.remove('hidden');
    render();
    overlay.querySelector('#acctLbPrev').onclick = function () {
      if (idx > 0) { idx--; render(); }
    };
    overlay.querySelector('#acctLbNext').onclick = function () {
      if (idx < urls.length - 1) { idx++; render(); }
    };
    return true;
  }

  function close() {
    if (overlay) overlay.classList.add('hidden');
    urls = [];
    idx = 0;
  }

  function mapAttachmentUrls_(data) {
    return (data && data.data ? data.data : []).map(function (r) {
      return String(r.drive_url || '').trim();
    }).filter(Boolean);
  }

  async function fetchAttachmentUrlsOnce_(session, filter) {
    var data = await AccountingApi.crudList(session, 'attachment', filter);
    if (!data || !data.success) {
      throw new Error((data && data.message) || '單據讀不到，請再試');
    }
    return mapAttachmentUrls_(data);
  }

  async function fetchAttachmentUrls(session, ref) {
    ref = ref || {};
    if (ref.attachment_urls && ref.attachment_urls.length) return ref.attachment_urls;
    if (!session || typeof AccountingApi === 'undefined') {
      throw new Error('單據暫時讀不到，請再試');
    }
    var filter = {};
    if (ref.payment_request_id) filter.payment_request_id = ref.payment_request_id;
    else if (ref.ingest_id) filter.ingest_id = ref.ingest_id;
    else return [];
    try {
      return await fetchAttachmentUrlsOnce_(session, filter);
    } catch (e1) {
      try {
        return await fetchAttachmentUrlsOnce_(session, filter);
      } catch (e2) {
        throw new Error((e2 && e2.message) || (e1 && e1.message) || '單據讀不到，請再試');
      }
    }
  }

  async function openForRef(session, ref) {
    var list = await fetchAttachmentUrls(session, ref);
    return open(list);
  }

  function makeButton(session, ref, label) {
    label = label || '看單據';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-muted acct-lb-trigger';
    btn.textContent = label;
    btn.style.display = 'none';
    var clickBound = false;

    function bindOpen(list) {
      btn.disabled = false;
      btn.textContent = label;
      btn.style.display = '';
      if (clickBound) return;
      clickBound = true;
      btn.addEventListener('click', function () { open(list); });
    }

    function showRetry() {
      btn.disabled = false;
      btn.style.display = '';
      btn.textContent = '單據讀不到，再試';
      btn.onclick = function () {
        btn.onclick = null;
        btn.disabled = true;
        btn.textContent = '讀取中…';
        fetchAttachmentUrls(session, ref).then(function (list) {
          if (!list.length) {
            btn.disabled = true;
            btn.textContent = '沒有單據';
            return;
          }
          bindOpen(list);
          open(list);
        }).catch(function () {
          showRetry();
        });
      };
    }

    fetchAttachmentUrls(session, ref).then(function (list) {
      if (list.length) bindOpen(list);
    }).catch(function () {
      showRetry();
    });
    return btn;
  }

  return {
    open: open,
    close: close,
    openForRef: openForRef,
    fetchAttachmentUrls: fetchAttachmentUrls,
    makeButton: makeButton
  };
})();
