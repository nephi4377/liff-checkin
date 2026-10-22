/**
 * 會計模組共用單據燈箱（不跳頁）
 * 失敗與「真的沒附件」分開：API 失敗會提示並可再試，不靜默當成沒單據。
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
      '.acct-lb-link{color:#8ab4f8;font-size:14px;text-decoration:none;margin-top:8px}' +
      '.btn.acct-lb-trigger.acct-lb-error,.acct-lb-trigger.acct-lb-error{background:#fce8e6!important;color:#c5221f!important;border:1px solid #f5c2c0!important}';
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

  /** Drive 網址才轉縮圖；data:/blob: 原樣用（base64 常含 "/d/"，誤判會放大空白）。 */
  function thumbUrl(url) {
    var s = String(url || '');
    if (!s || /^data:/i.test(s) || /^blob:/i.test(s)) return s;
    var m = s.match(/\/d\/([^/?#]+)/);
    if (m) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(m[1]) + '&sz=w1200';
    return s;
  }

  function onKey(e) {
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowLeft') {
      if (idx > 0) { idx--; render(); }
    } else if (e.key === 'ArrowRight') {
      if (idx < urls.length - 1) { idx++; render(); }
    }
  }

  function render() {
    if (!urls.length) return;
    var u = urls[idx];
    var img = document.getElementById('acctLbImg');
    var src = thumbUrl(u);
    img.onerror = function () {
      img.alt = '單據圖片載入失敗';
      img.removeAttribute('src');
      notifyErr('單據圖片載入失敗，請關閉後重試或改在新分頁開啟');
    };
    img.alt = '單據';
    img.src = src;
    var link = document.getElementById('acctLbOpen');
    if (/^https?:\/\//i.test(String(u || ''))) {
      link.href = u;
      link.style.display = '';
      link.textContent = '在新分頁開啟';
    } else if (/^data:/i.test(String(u || ''))) {
      link.href = u;
      link.style.display = '';
      link.textContent = '在新分頁開啟';
    } else {
      link.removeAttribute('href');
      link.style.display = 'none';
    }
    document.getElementById('acctLbTitle').textContent = '單據 ' + (idx + 1) + ' / ' + urls.length;
    document.getElementById('acctLbPrev').disabled = idx <= 0;
    document.getElementById('acctLbNext').disabled = idx >= urls.length - 1;
    document.getElementById('acctLbPrev').style.display = urls.length > 1 ? '' : 'none';
    document.getElementById('acctLbNext').style.display = urls.length > 1 ? '' : 'none';
  }

  function open(urlList, startIndex) {
    urls = (urlList || []).filter(Boolean);
    if (!urls.length) return false;
    idx = Math.max(0, Math.min(Number(startIndex) || 0, urls.length - 1));
    ensureOverlay();
    overlay.classList.remove('hidden');
    render();
    overlay.querySelector('#acctLbPrev').onclick = function () {
      if (idx > 0) { idx--; render(); }
    };
    overlay.querySelector('#acctLbNext').onclick = function () {
      if (idx < urls.length - 1) { idx++; render(); }
    };
    document.removeEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    return true;
  }

  function close() {
    if (overlay) overlay.classList.add('hidden');
    document.removeEventListener('keydown', onKey);
    urls = [];
    idx = 0;
  }

  function notifyErr(msg) {
    if (typeof AccountingUi !== 'undefined' && AccountingUi.notify) {
      AccountingUi.notify('err', msg);
    } else if (typeof AccountingUi !== 'undefined' && AccountingUi.err) {
      AccountingUi.err(msg);
    }
  }

  function notifyInfo(msg) {
    if (typeof AccountingUi !== 'undefined' && AccountingUi.notify) {
      AccountingUi.notify('info', msg);
    } else if (typeof AccountingUi !== 'undefined' && AccountingUi.info) {
      AccountingUi.info(msg);
    }
  }

  function localAttachFailMock() {
    var host = window.location && window.location.hostname;
    if (host !== '127.0.0.1' && host !== 'localhost') return false;
    try {
      return String(new URLSearchParams(window.location.search).get('mock') || '') === 'attachfail';
    } catch (eMock) {
      return false;
    }
  }

  function mapAttachmentUrls_(data) {
    return (data && data.data ? data.data : []).map(function (r) {
      return String(r.drive_url || '').trim();
    }).filter(Boolean);
  }

  async function fetchAttachmentUrlsOnce_(session, filter) {
    if (localAttachFailMock()) {
      var mockErr = new Error('單據讀不到，請再試');
      mockErr.code = 'ATTACH_FETCH_FAILED';
      throw mockErr;
    }
    var data = await AccountingApi.crudList(session, 'attachment', filter);
    if (!data || !data.success) {
      var err = new Error((data && data.message) || '單據讀不到，請再試');
      err.code = 'ATTACH_FETCH_FAILED';
      throw err;
    }
    return mapAttachmentUrls_(data);
  }

  /**
   * 成功回傳 URL 陣列（可為空＝真的沒附件）。
   * API／網路失敗會 throw，勿當成空陣列。
   */
  async function fetchAttachmentUrls(session, ref) {
    ref = ref || {};
    if (ref.attachment_urls && ref.attachment_urls.length) return ref.attachment_urls;
    if (!session || typeof AccountingApi === 'undefined') {
      var noApi = new Error('單據暫時讀不到，請再試');
      noApi.code = 'ATTACH_FETCH_FAILED';
      throw noApi;
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
        var finalErr = new Error((e2 && e2.message) || (e1 && e1.message) || '單據讀不到，請再試');
        finalErr.code = 'ATTACH_FETCH_FAILED';
        throw finalErr;
      }
    }
  }

  async function openForRef(session, ref) {
    try {
      var list = await fetchAttachmentUrls(session, ref);
      if (!list.length) {
        notifyInfo('這筆沒有上傳單據');
        return false;
      }
      return open(list);
    } catch (e) {
      notifyErr((e && e.message) || '單據讀不到，請再試');
      return false;
    }
  }

  function makeButton(session, ref, label) {
    label = label || '看單據';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-muted acct-lb-trigger';
    btn.textContent = label + '…';
    btn.style.display = '';

    function clearHandlers() {
      btn.onclick = null;
    }

    function bindOpen(list) {
      clearHandlers();
      btn.classList.remove('acct-lb-error');
      btn.textContent = label;
      btn.style.display = '';
      btn.disabled = false;
      btn.onclick = function () { open(list); };
    }

    function showFail(msg) {
      clearHandlers();
      btn.classList.add('acct-lb-error');
      btn.textContent = '單據讀不到，再試';
      btn.style.display = '';
      btn.disabled = false;
      notifyErr(msg || '單據讀不到，請再試');
      btn.onclick = function () { load(); };
    }

    function showEmpty() {
      clearHandlers();
      btn.classList.remove('acct-lb-error');
      btn.textContent = '沒有單據';
      btn.style.display = '';
      btn.disabled = true;
    }

    function load() {
      clearHandlers();
      btn.classList.remove('acct-lb-error');
      btn.textContent = label + '…';
      btn.style.display = '';
      btn.disabled = true;
      fetchAttachmentUrls(session, ref).then(function (list) {
        if (list.length) bindOpen(list);
        else showEmpty();
      }).catch(function (e) {
        showFail((e && e.message) || '單據讀不到，請再試');
      });
    }

    load();
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
