/**
 * FB 發文工作室 — 前端邏輯（多圖／文案版本／標籤組合／精修強化）
 */
(function () {
  'use strict';

  var CFG = window.FB_POST_STUDIO_CONFIG || {};
  var DEFAULT_GAS = CFG.GAS_URL || '';
  var MAX_IMAGES = CFG.MAX_IMAGES || 10;
  var COPY_HISTORY_MAX = CFG.COPY_HISTORY_MAX || 40;
  var WIZARD_MAX = 5;

  var WIZARD_STEPS = [
    { n: 1, title: '選圖' },
    { n: 2, title: '寫文案' },
    { n: 3, title: '產圖精修' },
    { n: 4, title: '完成' },
    { n: 5, title: '短影音' }
  ];

  var BATCH_CONSISTENCY_SUFFIX_ =
    '【整組一致】這是多張同一貼文的照片，請維持與參考圖相同的色溫、對比、光線氛圍與調性，避免每張風格落差過大。';

  var state = {
    images: [],
    selectedId: null,
    logoImg: null,
    logoLabel: '',
    crop: 'free',
    sourceImg: null,
    tagIds: emptyTagIds(),
    refine: defaultRefine(),
    copyActiveId: null,
    wizardStep: 1,
    reelBlob: null,
    reelMeta: null,
    siteImport: {
      items: [],
      selected: {},
      nextCursor: null,
      projectCode: '',
      mediaType: 'image',
      loading: false,
      importing: false,
      restorePaths: null,
      loadTimerId: null,
      loadStartedAt: 0
    },
    lastImportedPaths: [],
    /** 實拍影片工單來源；只記錄路徑，不把影片位元組載入瀏覽器 */
    siteVideos: [],
    localVideoNames: [],
    workOrderBusy: false,
    reelAudioBlob: null,
    reelLastUrl: null,
    reelBgmPreview: null,
    dragThumbIdx: null,
    adoptPulseId: null,
    selectedEmojiId: null,
    emojiDrag: { active: false, id: null, offsetX: 0, offsetY: 0 },
    stickers: [],
    overlayImageCache: {}
  };

  function emptyTagIds() {
    return { prefixA: {}, prefixC: {}, middle: {}, suffix: {} };
  }

  function normalizeTagIds(raw) {
    var base = emptyTagIds();
    if (!raw || typeof raw !== 'object') return base;
    ['prefixA', 'prefixC', 'middle', 'suffix'].forEach(function (z) {
      if (raw[z] && typeof raw[z] === 'object') base[z] = Object.assign({}, raw[z]);
    });
    /* 舊草稿只有 prefix：忽略尺寸類，其餘併入 prefixA */
    if (raw.prefix && typeof raw.prefix === 'object') {
      Object.keys(raw.prefix).forEach(function (id) {
        if (/^(sq_1_1|vert_4_5|wide_16_9)$/.test(id)) return;
        if (id === 'keep_compose') base.prefixA.keep_lens = true;
        else if (id === 'closeup') base.prefixA.closer = true;
        else if (id === 'wide_shot') base.prefixA.pull_back = true;
        else base.prefixA[id] = true;
      });
    }
    return base;
  }

  function defaultRefine() {
    return {
      brightness: 0,
      contrast: 0,
      saturate: 0,
      sharpen: 0,
      rotateFine: 0,
      rotate90: 0,
      flipH: false,
      vignette: 0,
      warm: 0,
      filterId: 'none'
    };
  }

  function $(id) { return document.getElementById(id); }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function showError(msg) {
    var box = $('err-box');
    box.textContent = msg;
    box.classList.add('show');
    $('ok-box').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideError() { $('err-box').classList.remove('show'); }

  /** 步驟切換提示：不捲到頁頂，避免打斷操作 */
  function showGateMsg(msg) {
    var box = $('err-box');
    box.textContent = msg;
    box.classList.add('show');
    $('ok-box').classList.remove('show');
  }

  function showOk(msg) {
    var box = $('ok-box');
    box.textContent = msg;
    box.classList.add('show');
    hideError();
  }

  function setBusy(btn, busy, labelBusy, labelIdle) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) {
      if (!btn.dataset._busy) {
        btn.dataset._label = btn.innerHTML;
        btn.dataset._busy = '1';
      }
      if (labelBusy) btn.innerHTML = labelBusy;
    } else {
      if (labelIdle || btn.dataset._label) {
        btn.innerHTML = labelIdle || btn.dataset._label;
      }
      delete btn.dataset._label;
      delete btn.dataset._busy;
    }
  }

  function buildAuthPayload() {
    var body = {};
    if ($('dev-bypass').checked) body.dev_bypass = true;
    var secret = $('ingest-secret').value.trim();
    if (secret) body.secret = secret;
    return body;
  }

  function postGas(action, payload) {
    var url = $('gas-url').value.trim() || DEFAULT_GAS;
    if (!url) return Promise.reject(new Error('尚未設定 GAS URL'));
    var body = Object.assign({ action: action }, buildAuthPayload(), payload || {});
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error('後端回應不是 JSON（HTTP ' + res.status + '）');
      });
    });
  }

  function dataUrlFromPhoto(photo) {
    if (!photo) return '';
    if (photo.preview) return photo.preview;
    var mime = photo.mime_type || photo.mimeType || 'image/jpeg';
    var b64 = photo.data_base64 || photo.dataBase64 || '';
    return 'data:' + mime + ';base64,' + b64;
  }

  function setPreviewEl(el, photoOrUrl, emptyText) {
    if (!el) return;
    var url = typeof photoOrUrl === 'string' ? photoOrUrl : dataUrlFromPhoto(photoOrUrl);
    if (!url) {
      el.innerHTML = '<span class="preview-empty">' + (emptyText || '—') + '</span>';
      return;
    }
    el.innerHTML = '<img alt="preview" src="' + url + '">';
  }

  function photoPayload(photo) {
    return {
      data_base64: photo.data_base64,
      mime_type: photo.mime_type || 'image/jpeg',
      filename: photo.name || ''
    };
  }

  function getSelectedImage() {
    return state.images.find(function (im) { return im.id === state.selectedId; }) || null;
  }

  function getBatchImages(strict) {
    var list = state.images.filter(function (im) { return im.batch; });
    if (list.length) return list;
    if (strict) return [];
    return getSelectedImage() ? [getSelectedImage()] : [];
  }

  /* ---------- resize ---------- */

  function resizeImageFile(file, maxEdge, maxBytes, quality) {
    maxEdge = maxEdge || CFG.MAX_IMAGE_EDGE || 1600;
    maxBytes = maxBytes || CFG.MAX_BYTES || 4 * 1024 * 1024;
    quality = quality || CFG.JPEG_QUALITY || 0.82;

    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          var scale = 1;
          if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var q = quality;
          var dataUrl = canvas.toDataURL('image/jpeg', q);
          while (dataUrl.length * 0.75 > maxBytes && q > 0.45) {
            q -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', q);
          }
          resolve({
            data_base64: dataUrl.split(',')[1],
            mime_type: 'image/jpeg',
            preview: dataUrl,
            name: file.name || 'photo.jpg',
            width: w,
            height: h
          });
        };
        img.onerror = function () { reject(new Error('無法讀取圖片')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('讀檔失敗')); };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- settings ---------- */

  function loadSettings() {
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY + '_settings');
      var s = raw ? JSON.parse(raw) : {};
      $('gas-url').value = s.gasUrl || DEFAULT_GAS;
      $('ingest-secret').value = s.secret || '';
      $('dev-bypass').checked = s.devBypass !== false;
      if ($('mock-completion')) {
        var mockDefault = !!(CFG.COMPLETION_MEDIA && CFG.COMPLETION_MEDIA.USE_MOCK);
        if (window.location.hostname === 'info.tanxin.space') mockDefault = false;
        $('mock-completion').checked = s.mockCompletion != null ? !!s.mockCompletion : mockDefault;
      }
      if ($('import-project-code') && s.lastProjectCode) {
        $('import-project-code').value = s.lastProjectCode;
      }
    } catch (e) {
      $('gas-url').value = DEFAULT_GAS;
    }
    try {
      var q = new URLSearchParams(window.location.search || '');
      if (q.get('mock_completion') === '1' && $('mock-completion')) {
        $('mock-completion').checked = true;
      }
      if (/info\.tanxin\.space$/i.test(window.location.hostname) && $('mock-completion') && q.get('mock_completion') !== '1') {
        $('mock-completion').checked = false;
      }
    } catch (eQ) {}
    if (CFG.FB_PAGE_URL) {
      var link = $('fb-page-link');
      if (link) link.href = CFG.FB_PAGE_URL;
    }
    var maxLabel = $('max-images-label');
    if (maxLabel) maxLabel.textContent = String(MAX_IMAGES);
  }

  function saveSettings() {
    localStorage.setItem(CFG.STORAGE_KEY + '_settings', JSON.stringify({
      gasUrl: $('gas-url').value.trim(),
      secret: $('ingest-secret').value.trim(),
      devBypass: $('dev-bypass').checked,
      mockCompletion: $('mock-completion') ? $('mock-completion').checked : false,
      lastProjectCode: $('import-project-code') ? $('import-project-code').value.trim() : ''
    }));
    showOk('設定已儲存');
  }

  function isMockCompletionEnabled() {
    if ($('mock-completion') && $('mock-completion').checked) return true;
    return !!(CFG.COMPLETION_MEDIA && CFG.COMPLETION_MEDIA.USE_MOCK);
  }

  function fillToneOptions() {
    var sel = $('tone');
    sel.innerHTML = '';
    (CFG.TONE_OPTIONS || [{ value: '活潑親切', label: '活潑親切（預設）' }]).forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
    sel.value = (CFG.TONE_OPTIONS && CFG.TONE_OPTIONS[0] && CFG.TONE_OPTIONS[0].value) || '活潑親切';
  }

  /* ---------- tags → instruction ---------- */

  function selectedTagTexts(zone) {
    var tags = (CFG.EDIT_TAGS && CFG.EDIT_TAGS[zone]) || [];
    var picked = state.tagIds[zone] || {};
    return tags.filter(function (t) { return picked[t.id]; }).map(function (t) { return t.text; });
  }

  function composeInstruction() {
    var parts = []
      .concat(selectedTagTexts('prefixA'))
      .concat(selectedTagTexts('prefixC'))
      .concat(selectedTagTexts('middle'))
      .concat(selectedTagTexts('suffix'));
    var free = ($('edit-free-text').value || '').trim();
    if (free) parts.push(free);
    if (!parts.length) return '';
    return parts.join('；') + '。';
  }

  function updateInstrPreview() {
    var composed = composeInstruction();
    $('instr-preview').textContent = composed || '（請選擇標籤或填寫自由文字）';
    if (!$('instr-manual-lock').checked) {
      $('edit-instruction').value = composed;
    }
  }

  function renderTagZone(zone, elId) {
    var box = $(elId);
    if (!box) return;
    if (!state.tagIds[zone]) state.tagIds[zone] = {};
    box.innerHTML = '';
    var tags = (CFG.EDIT_TAGS && CFG.EDIT_TAGS[zone]) || [];
    tags.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.tagIds[zone][t.id] ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', function () {
        if (state.tagIds[zone][t.id]) delete state.tagIds[zone][t.id];
        else state.tagIds[zone][t.id] = true;
        btn.classList.toggle('active');
        updateInstrPreview();
      });
      box.appendChild(btn);
    });
  }

  function renderAllTags() {
    renderTagZone('prefixA', 'tag-prefix-a');
    renderTagZone('prefixC', 'tag-prefix-c');
    renderTagZone('middle', 'tag-middle');
    renderTagZone('suffix', 'tag-suffix');
    updateInstrPreview();
  }

  /* ---------- wizard ---------- */

  function wizardTitle(n) {
    var found = WIZARD_STEPS.filter(function (s) { return s.n === n; })[0];
    return found ? found.title : '';
  }

  function hasSavedCopyContent() {
    var h = ($('copy-headline') && $('copy-headline').value || '').trim();
    var b = ($('copy-body') && $('copy-body').value || '').trim();
    if (h || b) return true;
    return loadCopyHistory().length > 0;
  }

  function canEnterStep(n) {
    if (n <= 1) return { ok: true };
    if (n === 5) {
      return { ok: true };
    }
    if (n === 2 && hasSavedCopyContent()) {
      return { ok: true };
    }
    if (!state.images.length) {
      return { ok: false, msg: '請先上傳至少一張圖，才能進入下一步（有文案草稿或版本紀錄時可直接進「寫文案」）' };
    }
    if (n === 3 && !state.selectedId) {
      return { ok: false, msg: '請先在圖庫點選一張圖，再進產圖精修' };
    }
    return { ok: true };
  }

  function updateFinishSummary() {
    var el = $('finish-summary');
    if (!el) return;
    var headline = ($('copy-headline').value || '').trim();
    var body = ($('copy-body').value || '').trim();
    var nImg = state.images.length;
    var sel = getSelectedImage();
    var parts = [];
    parts.push('<strong>圖</strong>：' + nImg + ' 張' + (sel ? '（選中：' + (sel.name || sel.id) + '）' : ''));
    parts.push('<strong>文案</strong>：' + (headline || body ? (headline || body.slice(0, 40) + (body.length > 40 ? '…' : '')) : '尚未填寫'));
    parts.push('下一步：複製貼文 → 開粉專貼上；下載 JPG 一併上傳。');
    el.innerHTML = parts.join('<br>');
  }

  function setWizardStep(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(WIZARD_MAX, n | 0));
    if (!opts.force) {
      var gate = canEnterStep(n);
      if (!gate.ok) {
        showGateMsg(gate.msg);
        return false;
      }
    }
    state.wizardStep = n;
    document.querySelectorAll('.wizard-panel').forEach(function (panel) {
      var sn = parseInt(panel.getAttribute('data-step'), 10);
      panel.classList.toggle('hidden', sn !== n);
    });
    document.querySelectorAll('[data-goto-step]').forEach(function (btn) {
      var sn = parseInt(btn.getAttribute('data-goto-step'), 10);
      btn.classList.toggle('active', sn === n);
      btn.classList.toggle('done', sn < n);
    });
    var title = wizardTitle(n);
    if ($('wizard-progress')) {
      $('wizard-progress').textContent = '步驟 ' + n + '／' + WIZARD_MAX + ' · ' + title;
    }
    if ($('wizard-nav-meta')) $('wizard-nav-meta').textContent = n + '／' + WIZARD_MAX;
    if ($('btn-wizard-prev')) $('btn-wizard-prev').disabled = n <= 1;
    if ($('btn-wizard-next')) {
      if (n >= WIZARD_MAX) $('btn-wizard-next').textContent = '回到選圖';
      else if (n === 4) $('btn-wizard-next').textContent = '製作短影音';
      else $('btn-wizard-next').textContent = '下一步';
    }
    syncThumbStrip();
    if (n === 3) redrawCanvas();
    if (n === 4) updateFinishSummary();
    if (n === 5) {
      refreshReelSourceUi();
      renderSiteVideosPanel();
      syncReelBgmPreviewButtons(!!state.reelBgmPreview);
    }
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  function syncThumbStrip() {
    var strip = $('thumb-strip');
    if (!strip) return;
    var show = state.images.length > 0;
    strip.classList.toggle('hidden', !show);
  }

  /* ---------- copy history ---------- */

  function loadCopyHistory() {
    try {
      var raw = localStorage.getItem(CFG.COPY_HISTORY_KEY || (CFG.STORAGE_KEY + '_copy_history'));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCopyHistory(list) {
    localStorage.setItem(
      CFG.COPY_HISTORY_KEY || (CFG.STORAGE_KEY + '_copy_history'),
      JSON.stringify(list.slice(0, COPY_HISTORY_MAX))
    );
  }

  function pushCopyHistory(entry) {
    var list = loadCopyHistory();
    list.unshift(entry);
    if (list.length > COPY_HISTORY_MAX) list = list.slice(0, COPY_HISTORY_MAX);
    saveCopyHistory(list);
    state.copyActiveId = entry.id;
    renderCopyHistory();
  }

  function applyCopyToForm(d) {
    $('copy-headline').value = d.headline || '';
    $('copy-body').value = d.body || '';
    $('copy-cta').value = d.cta || '';
    $('copy-image-notes').value = d.image_notes || d.imageNotes || '';
    var tags = Array.isArray(d.hashtags) ? d.hashtags.join(' ') : (d.hashtags || '');
    $('copy-hashtags').value = tags;
    syncTagsPreview();
  }

  function renderCopyHistory() {
    var box = $('copy-history');
    var list = loadCopyHistory();
    if (!list.length) {
      box.innerHTML = '<div class="copy-hist-item"><span class="meta">尚無版本。每次「生成文案」會自動存一筆。</span></div>';
      return;
    }
    box.innerHTML = '';
    list.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'copy-hist-item' + (item.id === state.copyActiveId ? ' active' : '');
      var when = item.ts ? new Date(item.ts).toLocaleString('zh-TW') : '';
      var snip = (item.body || item.headline || '').replace(/\s+/g, ' ').slice(0, 80);
      div.innerHTML =
        '<div class="meta">' + when + ' · ' + (item.postType || '') + ' · ' + (item.tone || '') +
        ' · ' + (item.photoCount || 0) + ' 圖</div>' +
        '<div class="snip">' + (snip || '（無正文）') + '</div>' +
        '<div class="copy-hist-actions">' +
        '<button type="button" data-act="restore">還原</button>' +
        '<button type="button" data-act="copy">複製</button>' +
        '<button type="button" data-act="del">刪除</button>' +
        '</div>';
      div.querySelector('[data-act="restore"]').addEventListener('click', function (e) {
        e.stopPropagation();
        applyCopyToForm(item);
        state.copyActiveId = item.id;
        renderCopyHistory();
        showOk('已還原此版文案');
      });
      div.querySelector('[data-act="copy"]').addEventListener('click', function (e) {
        e.stopPropagation();
        applyCopyToForm(item);
        state.copyActiveId = item.id;
        renderCopyHistory();
        handleCopyText();
      });
      div.querySelector('[data-act="del"]').addEventListener('click', function (e) {
        e.stopPropagation();
        var next = loadCopyHistory().filter(function (x) { return x.id !== item.id; });
        saveCopyHistory(next);
        if (state.copyActiveId === item.id) state.copyActiveId = null;
        renderCopyHistory();
        showOk('已刪除該版');
      });
      div.addEventListener('click', function () {
        applyCopyToForm(item);
        state.copyActiveId = item.id;
        renderCopyHistory();
      });
      box.appendChild(div);
    });
  }

  function syncTagsPreview() {
    var raw = $('copy-hashtags').value || '';
    var tags = raw.split(/[\s,，]+/).map(function (t) {
      t = t.trim();
      if (!t) return '';
      if (t.charAt(0) !== '#') t = '#' + t.replace(/^#+/, '');
      return t;
    }).filter(Boolean);
    $('tags-preview').textContent = tags.join(' ');
  }

  function buildCopyClipboardText() {
    var parts = [];
    var headline = $('copy-headline').value.trim();
    var body = $('copy-body').value.trim();
    var cta = $('copy-cta').value.trim();
    var tags = $('tags-preview').textContent.trim();
    if (headline) parts.push(headline);
    if (body) parts.push(body);
    if (cta) parts.push(cta);
    if (tags) parts.push(tags);
    return parts.join('\n\n');
  }

  /* ---------- multi-image ---------- */

  function createImageEntry(photo) {
    return {
      id: uid('img'),
      name: photo.name || 'photo.jpg',
      original: photo,
      working: photo,
      currentEdit: null,
      versions: [{
        id: 'orig',
        preview: photo.preview,
        data_base64: photo.data_base64,
        mime_type: photo.mime_type,
        instruction: '（原圖）',
        note: ''
      }],
      selectedVersionId: 'orig',
      adopted: null,
      batch: false,
      emojiOverlays: []
    };
  }

  function updateCopyHint() {
    var n = state.images.length;
    $('copy-photo-hint').textContent = n
      ? ('將用全部 ' + n + ' 張圖一起寫文案。')
      : '請先上傳至少一張圖。';
    var sel = getSelectedImage();
    $('edit-target-hint').textContent = sel
      ? ('目前選中：' + sel.name + '。可勾選多張批次套用同一組標籤（逐張送出，注意 GAS 時限）。')
      : '請先選中一張圖再改圖。';
  }

  function moveImage(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= state.images.length || toIdx >= state.images.length) return;
    var item = state.images.splice(fromIdx, 1)[0];
    state.images.splice(toIdx, 0, item);
    renderThumbs();
    refreshReelSourceUi();
  }

  function flashAdoptedThumb(id) {
    state.adoptPulseId = id;
    renderThumbs();
    window.setTimeout(function () {
      if (state.adoptPulseId === id) {
        state.adoptPulseId = null;
        renderThumbs();
      }
    }, 800);
  }

  function renderThumbs() {
    var grid = $('thumb-grid');
    grid.innerHTML = '';
    state.images.forEach(function (im, idx) {
      var div = document.createElement('div');
      div.className = 'thumb' +
        (im.id === state.selectedId ? ' selected' : '') +
        (im.batch ? ' batch-on' : '') +
        (im.adopted ? ' adopted' : '') +
        (state.adoptPulseId === im.id ? ' adopted-pulse' : '');
      div.setAttribute('draggable', 'true');
      div.dataset.idx = String(idx);
      div.innerHTML =
        '<span class="badge">' + (idx + 1) + '</span>' +
        '<span class="adopt-mark" title="已採用"><i class="fa-solid fa-check"></i></span>' +
        '<button type="button" class="rm" title="移除">&times;</button>' +
        '<img alt="" src="' + (im.original.preview || '') + '">' +
        '<span class="order-btns">' +
        '<button type="button" class="order-up" title="往前">↑</button>' +
        '<button type="button" class="order-down" title="往後">↓</button>' +
        '</span>';
      div.addEventListener('click', function (e) {
        if (e.target && (e.target.classList.contains('rm') ||
            e.target.classList.contains('order-up') ||
            e.target.classList.contains('order-down'))) return;
        if (e.ctrlKey || e.metaKey) {
          im.batch = !im.batch;
          renderThumbs();
          return;
        }
        selectImage(im.id);
      });
      div.querySelector('.rm').addEventListener('click', function (e) {
        e.stopPropagation();
        removeImage(im.id);
      });
      var upBtn = div.querySelector('.order-up');
      var downBtn = div.querySelector('.order-down');
      if (upBtn) {
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          moveImage(idx, idx - 1);
        });
      }
      if (downBtn) {
        downBtn.disabled = idx === state.images.length - 1;
        downBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          moveImage(idx, idx + 1);
        });
      }
      div.addEventListener('dragstart', function (e) {
        state.dragThumbIdx = idx;
        div.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(idx));
        }
      });
      div.addEventListener('dragend', function () {
        state.dragThumbIdx = null;
        div.classList.remove('dragging');
        grid.querySelectorAll('.thumb.drag-over').forEach(function (el) {
          el.classList.remove('drag-over');
        });
      });
      div.addEventListener('dragover', function (e) {
        e.preventDefault();
        div.classList.add('drag-over');
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      });
      div.addEventListener('dragleave', function () {
        div.classList.remove('drag-over');
      });
      div.addEventListener('drop', function (e) {
        e.preventDefault();
        div.classList.remove('drag-over');
        var from = state.dragThumbIdx;
        if (from == null && e.dataTransfer) {
          from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        }
        if (!(from >= 0)) return;
        moveImage(from, idx);
      });
      grid.appendChild(div);
    });
    syncThumbStrip();
    $('upload-meta').textContent = state.images.length
      ? ('已載入 ' + state.images.length + ' / ' + MAX_IMAGES + ' 張')
      : '尚未上傳';
    updateCopyHint();
  }

  function selectImage(id) {
    state.selectedId = id;
    var im = getSelectedImage();
    renderThumbs();
    renderVersions();
    if (!im) {
      setPreviewEl($('compare-before'), null);
      setPreviewEl($('compare-after'), null, '尚未改圖');
      $('edit-note').textContent = '';
      return;
    }
    setPreviewEl($('compare-before'), im.original);
    if (im.currentEdit) {
      setPreviewEl($('compare-after'), im.currentEdit);
      $('edit-note').textContent = im.currentEdit.note || im.currentEdit.instruction || '';
    } else {
      setPreviewEl($('compare-after'), null, '尚未改圖');
      $('edit-note').textContent = '';
    }
    if (im.adopted) {
      adoptPhoto(im.adopted, '已採用圖', true);
    }
    ensureOverlayImagesLoaded(getEmojiOverlays(im)).then(function () {
      if (getSelectedImage() === im) redrawCanvas();
    });
    syncEmojiControls();
  }

  function removeImage(id) {
    state.images = state.images.filter(function (im) { return im.id !== id; });
    if (state.selectedId === id) {
      state.selectedId = state.images[0] ? state.images[0].id : null;
    }
    renderThumbs();
    selectImage(state.selectedId);
  }

  function clearImages() {
    state.images = [];
    state.selectedId = null;
    state.sourceImg = null;
    renderThumbs();
    selectImage(null);
    redrawCanvas();
    showOk('已清空圖片');
  }

  function addPhotos(photos) {
    var room = MAX_IMAGES - state.images.length;
    if (room <= 0) {
      showError('最多上傳 ' + MAX_IMAGES + ' 張');
      return;
    }
    var slice = photos.slice(0, room);
    slice.forEach(function (p) {
      state.images.push(createImageEntry(p));
    });
    if (!state.selectedId && state.images.length) {
      state.selectedId = state.images[0].id;
    }
    renderThumbs();
    selectImage(state.selectedId);
    if (photos.length > room) {
      showOk('已加入 ' + slice.length + ' 張（超過上限的已略過）');
    } else {
      showOk('已加入 ' + slice.length + ' 張');
    }
  }

  /* ---------- 從案場匯入完工照 ---------- */

  function setImportStatus(msg, kind) {
    var el = $('import-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'bad');
    if (kind === 'ok') el.classList.add('ok');
    if (kind === 'bad') el.classList.add('bad');
  }

  function clearLoadElapsedTimer() {
    if (state.siteImport.loadTimerId) {
      clearInterval(state.siteImport.loadTimerId);
      state.siteImport.loadTimerId = null;
    }
  }

  function startLoadElapsedStatus(baseMsg) {
    state.siteImport.loadStartedAt = Date.now();
    clearLoadElapsedTimer();
    state.siteImport.loadTimerId = setInterval(function () {
      var sec = Math.floor((Date.now() - state.siteImport.loadStartedAt) / 1000);
      var hint = sec >= 15 ? '（案場資料多時可能需 1～2 分鐘）' : '';
      setImportStatus(baseMsg + '…已 ' + sec + ' 秒' + hint);
    }, 1000);
  }

  function applyRestoreSelectionIfNeeded() {
    var paths = state.siteImport.restorePaths;
    if (!paths || !paths.length) return;
    var matched = 0;
    paths.forEach(function (p) {
      var hit = state.siteImport.items.some(function (it) {
        return (it.path || it.name) === p;
      });
      if (hit) {
        state.siteImport.selected[p] = true;
        matched++;
      }
    });
    state.siteImport.restorePaths = null;
    if (matched) {
      renderImportGrid();
      setImportStatus('已還原上次勾選 ' + matched + ' 張，可按「匯入所選」。', 'ok');
    }
  }

  function runPromisePool(items, worker, concurrency) {
    var idx = 0;
    var active = 0;
    return new Promise(function (resolve, reject) {
      function pump() {
        if (idx >= items.length && active === 0) {
          resolve();
          return;
        }
        while (active < concurrency && idx < items.length) {
          var i = idx++;
          active++;
          worker(items[i], i).then(function () {
            active--;
            pump();
          }).catch(reject);
        }
      }
      pump();
    });
  }

  function selectedImportCount() {
    return Object.keys(state.siteImport.selected).filter(function (k) {
      return state.siteImport.selected[k];
    }).length;
  }

  function syncImportActionButtons() {
    var actions = $('import-actions');
    var btn = $('btn-import-selected');
    var n = selectedImportCount();
    var hasItems = state.siteImport.items.length > 0;
    if (actions) actions.classList.toggle('hidden', !hasItems);
    if (btn) {
      btn.disabled = n === 0 || state.siteImport.importing || state.siteImport.loading;
      var videoOnly = state.siteImport.mediaType === 'video';
      btn.innerHTML = state.siteImport.importing
        ? '<i class="fa-solid fa-spinner fa-spin"></i> 處理中…'
        : ('<i class="fa-solid ' + (videoOnly ? 'fa-list-check' : 'fa-download') + '"></i> ' +
          (videoOnly ? '加入短影音工單' : '匯入所選') + (n ? '（' + n + '）' : ''));
    }
    var more = $('btn-load-more-completion');
    if (more) {
      more.classList.toggle('hidden', !state.siteImport.nextCursor);
      more.disabled = state.siteImport.loading || state.siteImport.importing;
    }
  }

  function makeMockPreviewDataUrl(label, color) {
    var canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = color || '#3b82f6';
    ctx.fillRect(0, 0, 320, 320);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 220, 320, 100);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(String(label || '圖').slice(0, 8), 24, 270);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  function buildMockCompletionResponse(projectCode, mediaType) {
    var code = projectCode || '734';
    var samples = [
      { name: '客廳.jpg', color: '#60a5fa', label: '客廳' },
      { name: '餐廳.jpg', color: '#34d399', label: '餐廳' },
      { name: '主臥.jpg', color: '#fbbf24', label: '主臥' },
      { name: '衛浴.jpg', color: '#a78bfa', label: '衛浴' }
    ];
    var items = samples.map(function (s, i) {
      return {
        name: s.name,
        path: '/mock/' + code + '/完工照/' + s.name,
        ext: 'jpg',
        kind: 'image',
        size: 120000 + i * 1000,
        preview_url: makeMockPreviewDataUrl(s.label, s.color)
      };
    });
    if (mediaType === 'video' || mediaType === 'all') {
      var vids = [
        {
          name: '實拍.mp4',
          path: '/mock/' + code + '/完工照/實拍.mp4',
          ext: 'mp4',
          kind: 'video',
          size: 5000000,
          preview_url: null
        },
        {
          name: '現場.mov',
          path: '/mock/' + code + '/完工照/現場.mov',
          ext: 'mov',
          kind: 'video',
          size: 8000000,
          preview_url: null
        }
      ];
      if (mediaType === 'video') items = vids;
      else items = items.concat(vids);
    }
    return {
      success: true,
      data: {
        project_code: code,
        project_folder: '/mock/' + code,
        completion_folders: ['/mock/' + code + '/完工照'],
        media_type: mediaType || 'image',
        items: items,
        count: items.length,
        truncated: false,
        next_cursor: null,
        _mock: true
      }
    };
  }

  function listCompletionMedia(opts) {
    opts = opts || {};
    var cm = CFG.COMPLETION_MEDIA || {};
    var projectCode = String(opts.project_code || '').trim();
    var mediaType = opts.media_type || cm.DEFAULT_MEDIA_TYPE || 'image';
    var payload = {
      project_code: projectCode,
      media_type: mediaType,
      limit: opts.limit != null ? opts.limit : (cm.LIMIT || 40),
      include_preview: mediaType === 'video'
        ? false
        : (opts.include_preview != null ? opts.include_preview : (cm.INCLUDE_PREVIEW !== false))
    };
    if (opts.cursor) payload.cursor = opts.cursor;

    if (isMockCompletionEnabled()) {
      return Promise.resolve(buildMockCompletionResponse(projectCode, mediaType));
    }
    return postGas('list_project_completion_media', payload);
  }

  /** 後端代理：依 path 取媒體 base64（解 Dropbox CORS） */
  function fetchCompletionMediaViaProxy(path, projectCode) {
    if (/\.(mp4|mov|m4v|webm)$/i.test(String(path || ''))) {
      return Promise.reject(new Error('實拍影片只送本機工單，不可經後端代理取檔'));
    }
    if (isMockCompletionEnabled()) {
      var name = String(path || '').split('/').pop() || 'mock.jpg';
      var dataUrl = makeMockPreviewDataUrl(name.replace(/\.[^.]+$/, ''), '#64748b');
      return Promise.resolve({
        success: true,
        data: {
          name: name,
          path: path,
          kind: 'image',
          mime_type: 'image/jpeg',
          delivery: 'base64',
          data_base64: dataUrl.split(',')[1],
          temp_url: null
        }
      });
    }
    return postGas('fetch_project_completion_media', {
      path: path,
      project_code: projectCode || state.siteImport.projectCode || ''
    });
  }

  function fetchBlobViaUrl(url) {
    if (!url) return Promise.reject(new Error('沒有可下載的網址'));
    if (url.indexOf('data:') === 0) {
      return fetch(url).then(function (r) { return r.blob(); });
    }
    var proxies = (CFG.COMPLETION_MEDIA && CFG.COMPLETION_MEDIA.IMAGE_CORS_PROXIES) || [];
    var attempts = [url].concat(proxies.map(function (fn) {
      try { return typeof fn === 'function' ? fn(url) : ''; } catch (e) { return ''; }
    }).filter(Boolean));

    var chain = Promise.reject(new Error('init'));
    attempts.forEach(function (u) {
      chain = chain.catch(function () {
        return fetch(u, { mode: 'cors' }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        });
      });
    });
    return chain.catch(function () {
      throw new Error('無法下載圖片（跨網域被擋）。請確認後端「取圖代理」已部署，或改本機上傳。');
    });
  }

  function base64ToBlob(b64, mime) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'application/octet-stream' });
  }

  function blobToNamedFile(blob, filename, mime) {
    var type = mime || blob.type || 'application/octet-stream';
    var name = filename || 'media';
    try {
      return new File([blob], name, { type: type });
    } catch (eFile) {
      blob.name = name;
      return blob;
    }
  }

  /**
   * 匯入一張照片：優先後端代理 base64，失敗再試 preview_url／CORS 代理
   */
  function importImageItem(it) {
    var cm = CFG.COMPLETION_MEDIA || {};
    var useProxy = cm.USE_MEDIA_PROXY !== false;
    var projectCode = state.siteImport.projectCode || '';

    function fromProxy() {
      return fetchCompletionMediaViaProxy(it.path, projectCode).then(function (res) {
        if (!res || res.success === false) {
          throw new Error((res && res.message) || '取圖代理失敗');
        }
        var d = res.data || {};
        if (d.delivery === 'base64' && d.data_base64) {
          var mime = d.mime_type || 'image/jpeg';
          var blob = base64ToBlob(d.data_base64, mime);
          return resizeImageFile(blobToNamedFile(blob, d.name || it.name, mime));
        }
        if (d.temp_url) {
          return resizeImageFromUrl(d.temp_url, d.name || it.name);
        }
        throw new Error((d.message) || '代理未回傳可用圖檔');
      });
    }

    function fromPreviewUrl() {
      if (!it.preview_url) {
        return Promise.reject(new Error('沒有預覽網址可備援'));
      }
      return resizeImageFromUrl(it.preview_url, it.name);
    }

    if (useProxy && it.path && String(it.path).indexOf('/mock/') !== 0) {
      return fromProxy().catch(function (e1) {
        if (!it.preview_url) throw e1;
        return fromPreviewUrl().catch(function () { throw e1; });
      });
    }
    if (useProxy && it.path && String(it.path).indexOf('/mock/') === 0) {
      return fromProxy();
    }
    return fromPreviewUrl();
  }

  /**
   * 實拍影片只記錄清單 API 回傳的路徑；不經後端代理抓影片。
   */
  function importVideoItem(it) {
    var ext = String(it.ext || (it.name || '').split('.').pop() || '').toLowerCase();
    return Promise.resolve({
      id: uid('vid'),
      name: it.name || '未命名影片',
      path: it.path || '',
      ext: ext,
      kind: 'video',
      size: it.size,
      source_type: 'dropbox_relative',
      project_code: state.siteImport.projectCode || '',
      note: '只記錄 Dropbox 路徑；影片不會進入瀏覽器。'
    });
  }

  function resizeImageFromUrl(url, filename) {
    return fetchBlobViaUrl(url).then(function (blob) {
      if (!blob || !blob.size) throw new Error('下載到空檔');
      var type = blob.type || 'image/jpeg';
      if (type.indexOf('image/') !== 0 && type !== 'application/octet-stream') {
        throw new Error('不是圖片檔（' + (type || '未知類型') + '）');
      }
      var name = filename || 'photo.jpg';
      return resizeImageFile(blobToNamedFile(blob, name, type.indexOf('image/') === 0 ? type : 'image/jpeg'));
    });
  }

  function renderImportGrid() {
    var grid = $('import-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var items = state.siteImport.items;
    if (!items.length) {
      grid.classList.add('hidden');
      syncImportActionButtons();
      return;
    }
    grid.classList.remove('hidden');
    items.forEach(function (it) {
      var key = it.path || it.name;
      var isVideo = it.kind === 'video';
      var picked = !!state.siteImport.selected[key];
      var div = document.createElement('div');
      div.className = 'thumb'
        + (picked ? ' pick-on' : '')
        + (isVideo ? ' kind-video' : '')
        + (!it.preview_url && !isVideo ? ' no-preview' : '');
      div.setAttribute('role', 'button');
      div.setAttribute('tabindex', '0');
      div.title = it.name + (isVideo ? '（只列檔名與路徑，不會下載影片）' : '');

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = isVideo ? '影片' : '照片';
      div.appendChild(badge);

      if (it.preview_url && !isVideo) {
        var img = document.createElement('img');
        img.alt = it.name;
        img.loading = 'lazy';
        img.src = it.preview_url;
        img.onerror = function () {
          div.classList.add('no-preview');
          img.remove();
          var fb = document.createElement('span');
          fb.textContent = it.name;
          div.appendChild(fb);
        };
        div.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.textContent = it.name || '（無檔名）';
        div.appendChild(span);
      }

      var mark = document.createElement('span');
      mark.className = 'pick-mark';
      mark.innerHTML = '<i class="fa-solid fa-check"></i>';
      div.appendChild(mark);

      var toggle = function () {
        if (state.siteImport.importing) return;
        if (state.siteImport.selected[key]) delete state.siteImport.selected[key];
        else state.siteImport.selected[key] = true;
        renderImportGrid();
      };
      div.addEventListener('click', toggle);
      div.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
      grid.appendChild(div);
    });
    syncImportActionButtons();
  }

  function applyCompletionListResult(res, append) {
    if (!res || res.success === false) {
      var msg = (res && res.message) ? res.message : '載入失敗';
      setImportStatus(msg + '。請確認案號、權限，或先開「案場匯入用假資料」測介面。', 'bad');
      if (!append) {
        state.siteImport.items = [];
        state.siteImport.selected = {};
        state.siteImport.nextCursor = null;
        renderImportGrid();
      }
      showError(msg);
      return;
    }
    var data = res.data || res;
    var items = Array.isArray(data.items) ? data.items : [];
    if (append) {
      state.siteImport.items = state.siteImport.items.concat(items);
    } else {
      state.siteImport.items = items;
      state.siteImport.selected = {};
    }
    state.siteImport.nextCursor = data.next_cursor || null;
    state.siteImport.projectCode = data.project_code || state.siteImport.projectCode;

    if (!state.siteImport.items.length) {
      setImportStatus(
        state.siteImport.mediaType === 'video'
          ? '找不到實拍影片。請確認完工照資料夾是否有 .mp4／.mov。'
          : '找不到完工照。請確認案號是否正確，或該案雲端資料夾是否有「完工照」夾。',
        'bad'
      );
      renderImportGrid();
      return;
    }
    var folderHint = (data.completion_folders && data.completion_folders[0])
      ? '（已對到完工照資料夾）'
      : '';
    var mockHint = data._mock ? '［假資料］' : '';
    var moreHint = state.siteImport.nextCursor ? '，可按「載入更多」' : '';
    var typeHint = state.siteImport.mediaType === 'video' ? '影片' : '照片';
    setImportStatus(
      mockHint + '已載入 ' + state.siteImport.items.length + ' 筆' + typeHint + folderHint + moreHint +
      '。' + (state.siteImport.mediaType === 'video'
        ? '勾選檔名後按「加入短影音工單」；只記錄路徑，不會下載影片。'
        : '點縮圖勾選後按「匯入所選」。'),
      'ok'
    );
    renderImportGrid();
    applyRestoreSelectionIfNeeded();
    if (!data._mock) showOk('案場清單已載入');
    else showOk('已用假資料載入（僅測介面）');
  }

  function handleLoadCompletion(append) {
    var codeEl = $('import-project-code');
    var typeEl = $('import-media-type');
    var projectCode = codeEl ? codeEl.value.trim() : '';
    if (!projectCode) {
      setImportStatus('請先填案號。', 'bad');
      if (codeEl) codeEl.focus();
      showError('請先填案號');
      return;
    }
    if (state.siteImport.loading || state.siteImport.importing) return;

    var mediaType = typeEl ? typeEl.value : 'image';
    if (mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'all') {
      mediaType = 'image';
    }
    if (append && !state.siteImport.nextCursor) return;

    state.siteImport.loading = true;
    state.siteImport.mediaType = mediaType;
    state.siteImport.projectCode = projectCode;
    setBusy($('btn-load-completion'), true, '<i class="fa-solid fa-spinner fa-spin"></i> 載入中…');
    setBusy($('btn-load-more-completion'), true);
    var loadBaseMsg = append ? '繼續載入' : ('正在向雲端查詢完工' + (mediaType === 'video' ? '影片' : '照'));
    startLoadElapsedStatus(loadBaseMsg);
    syncImportActionButtons();
    hideError();

    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY + '_settings');
      var s = raw ? JSON.parse(raw) : {};
      s.lastProjectCode = projectCode;
      localStorage.setItem(CFG.STORAGE_KEY + '_settings', JSON.stringify(s));
    } catch (eSave) {}

    listCompletionMedia({
      project_code: projectCode,
      media_type: mediaType,
      cursor: append ? state.siteImport.nextCursor : null
    }).then(function (res) {
      applyCompletionListResult(res, !!append);
    }).catch(function (e) {
      clearLoadElapsedTimer();
      var msg = (e && e.message) ? e.message : String(e);
      setImportStatus('載入失敗：' + msg + '。若後端尚未部署，可到頁底設定勾「案場匯入用假資料」。', 'bad');
      showError(msg);
      if (!append) {
        state.siteImport.items = [];
        state.siteImport.selected = {};
        renderImportGrid();
      }
    }).then(function () {
      state.siteImport.loading = false;
      clearLoadElapsedTimer();
      setBusy($('btn-load-completion'), false, null, '<i class="fa-solid fa-folder-open"></i> 載入');
      setBusy($('btn-load-more-completion'), false, null, '載入更多');
      syncImportActionButtons();
    });
  }

  function handleImportSelected() {
    var keys = Object.keys(state.siteImport.selected).filter(function (k) {
      return state.siteImport.selected[k];
    });
    if (!keys.length) {
      setImportStatus('請先勾選至少一筆。', 'bad');
      return;
    }
    if (state.siteImport.importing || state.siteImport.loading) return;

    var picked = keys.map(function (k) {
      return state.siteImport.items.find(function (it) {
        return (it.path || it.name) === k;
      });
    }).filter(Boolean);

    var images = picked.filter(function (it) { return it.kind !== 'video'; });
    var videos = picked.filter(function (it) { return it.kind === 'video'; });

    var room = MAX_IMAGES - state.images.length;
    if (images.length && room <= 0) {
      showError('圖庫已滿（最多 ' + MAX_IMAGES + ' 張），請先清空或刪除部分圖再匯入照片');
      if (!videos.length) return;
    }

    var toImportImg = images.slice(0, Math.max(0, room));
    state.siteImport.importing = true;
    setImportStatus('正在匯入…');
    syncImportActionButtons();
    hideError();

    var importedPhotos = [];
    var importedVideos = [];
    var importTasks = [];
    toImportImg.forEach(function (it) {
      importTasks.push({ type: 'image', item: it });
    });
    videos.forEach(function (it) {
      importTasks.push({ type: 'video', item: it });
    });
    var doneCount = 0;
    var importTotal = importTasks.length;

    var importChain = importTotal
      ? runPromisePool(importTasks, function (task) {
        var p = task.type === 'image'
          ? importImageItem(task.item).then(function (photo) {
            importedPhotos.push(photo);
          })
          : importVideoItem(task.item).then(function (vid) {
            importedVideos.push(vid);
          });
        return p.then(function () {
          doneCount++;
          setImportStatus('正在匯入（' + doneCount + '/' + importTotal + '）：' + task.item.name);
        });
      }, 3)
      : Promise.resolve();

    importChain.then(function () {
      if (importedPhotos.length) {
        state.lastImportedPaths = toImportImg.map(function (it) { return it.path || it.name; });
        state.siteImport.restorePaths = state.lastImportedPaths.slice();
      }
      if (importedPhotos.length) addPhotos(importedPhotos);
      if (importedVideos.length) {
        state.siteVideos = (state.siteVideos || []).concat(importedVideos);
        renderSiteVideosPanel();
      }
      picked.forEach(function (it) {
        delete state.siteImport.selected[it.path || it.name];
      });
      renderImportGrid();
      var parts = [];
      if (importedPhotos.length) parts.push('照片 ' + importedPhotos.length + ' 張進圖庫');
      if (importedVideos.length) parts.push('影片 ' + importedVideos.length + ' 支已加入步驟⑤工單');
      if (images.length > room && room >= 0) parts.push('超過圖庫上限的照片已略過');
      setImportStatus('已完成：' + (parts.join('；') || '無') + '。', 'ok');
      if (importedVideos.length) showOk('影片路徑已記錄，可到步驟⑤下載工單');
      else if (importedPhotos.length) showOk('已匯入照片');
      saveDraft({ silent: true });
    }).catch(function (e) {
      var msg = (e && e.message) ? e.message : String(e);
      setImportStatus('匯入失敗：' + msg, 'bad');
      showError(msg);
    }).then(function () {
      state.siteImport.importing = false;
      syncImportActionButtons();
    });
  }

  function bindSiteImport() {
    if (!$('btn-load-completion')) return;
    $('btn-load-completion').addEventListener('click', function () {
      handleLoadCompletion(false);
    });
    if ($('btn-load-more-completion')) {
      $('btn-load-more-completion').addEventListener('click', function () {
        handleLoadCompletion(true);
      });
    }
    if ($('btn-import-selected')) {
      $('btn-import-selected').addEventListener('click', handleImportSelected);
    }
    if ($('btn-import-select-all')) {
      $('btn-import-select-all').addEventListener('click', function () {
        state.siteImport.items.forEach(function (it) {
          state.siteImport.selected[it.path || it.name] = true;
        });
        renderImportGrid();
      });
    }
    if ($('btn-import-clear-sel')) {
      $('btn-import-clear-sel').addEventListener('click', function () {
        state.siteImport.selected = {};
        renderImportGrid();
      });
    }
    if ($('import-project-code')) {
      $('import-project-code').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleLoadCompletion(false);
        }
      });
    }
  }

  /* ---------- 短影音／案場影片 ---------- */

  function getReelSourcePhotos() {
    return state.images.map(function (im) {
      return im.adopted || im.currentEdit || (im.versions && im.versions[im.versions.length - 1]) || im.original;
    }).filter(Boolean);
  }

  function refreshReelSourceUi() {
    var grid = $('reel-source-grid');
    var meta = $('reel-source-meta');
    var photos = getReelSourcePhotos();
    if (grid) {
      grid.innerHTML = '';
      photos.slice(0, 10).forEach(function (p, i) {
        var div = document.createElement('div');
        div.className = 'thumb';
        div.innerHTML =
          '<span class="badge">' + (i + 1) + '</span>' +
          '<img alt="reel-' + i + '" src="' + (p.preview || dataUrlFromPhoto(p)) + '">';
        grid.appendChild(div);
      });
    }
    if (meta) {
      var adopted = state.images.filter(function (im) { return im.adopted; }).length;
      meta.textContent = '可用圖 ' + photos.length + ' 張（已採用 ' + adopted +
        '）。順序與上方圖庫相同；照片合成短影音建議 2～10 張。';
    }
    fillReelBgmOptions();
  }

  function setReelBgmPreviewStatus(msg, kind) {
    var el = $('reel-bgm-preview-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'bad');
    if (kind === 'ok') el.classList.add('ok');
    if (kind === 'bad') el.classList.add('bad');
  }

  function syncReelBgmPreviewButtons(playing) {
    var btnPlay = $('btn-reel-bgm-preview');
    var btnStop = $('btn-reel-bgm-preview-stop');
    var musicOff = $('reel-music-off') && $('reel-music-off').checked;
    if (btnPlay) btnPlay.disabled = !!musicOff;
    if (btnStop) btnStop.classList.toggle('hidden', !playing);
  }

  function stopReelBgmPreview(quiet) {
    if (state.reelBgmPreview && state.reelBgmPreview.stop) {
      try { state.reelBgmPreview.stop(); } catch (e0) {}
    }
    state.reelBgmPreview = null;
    syncReelBgmPreviewButtons(false);
    if (!quiet) setReelBgmPreviewStatus('已停止試播');
  }

  function handleReelBgmPreview() {
    var api = window.FbPostReel;
    if (!api || !api.previewBgm) {
      showError('短影音模組未載入');
      return;
    }
    if ($('reel-music-off') && $('reel-music-off').checked) {
      showError('已勾選「不要音樂」');
      return;
    }
    stopReelBgmPreview(true);
    var btn = $('btn-reel-bgm-preview');
    var preset = ($('reel-bgm') && $('reel-bgm').value) || ((CFG.REEL && CFG.REEL.BGM_DEFAULT) || 'track_serene');
    var label = '選項';
    if (state.reelAudioBlob) {
      label = '上傳音檔';
    } else if (preset === 'off') {
      showError('請先選一首音樂');
      return;
    } else {
      var track = (CFG.REEL && CFG.REEL.BGM_TRACKS || []).find(function (t) { return t.id === preset; });
      if (track) label = track.label;
      else {
        var ai = (CFG.REEL && CFG.REEL.BGM_PRESETS || []).find(function (p) { return p.id === preset; });
        if (ai) label = 'AI：' + ai.label;
      }
    }
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 準備試播…');
    setReelBgmPreviewStatus('正在載入「' + label + '」…');
    hideError();

    api.previewBgm(preset, {
      audioBlob: state.reelAudioBlob,
      previewSec: 14
    }).then(function (player) {
      state.reelBgmPreview = player;
      syncReelBgmPreviewButtons(true);
      setReelBgmPreviewStatus('試播中：' + label + '（約 14 秒，可按停止）', 'ok');
      if (player && player.audio) {
        player.audio.addEventListener('ended', function () {
          state.reelBgmPreview = null;
          syncReelBgmPreviewButtons(false);
          setReelBgmPreviewStatus('試播結束：' + label, 'ok');
        }, { once: true });
      }
    }).catch(function (e) {
      setReelBgmPreviewStatus((e && e.message) ? e.message : String(e), 'bad');
      showError((e && e.message) ? e.message : String(e));
      syncReelBgmPreviewButtons(false);
    }).then(function () {
      setBusy(btn, false, null, '<i class="fa-solid fa-play"></i> 試播');
    });
  }

  function fillReelBgmOptions() {
    var sel = $('reel-bgm');
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '';

    function addGroup(label) {
      var g = document.createElement('optgroup');
      g.label = label;
      sel.appendChild(g);
      return g;
    }
    function addOpt(group, id, text) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = text;
      group.appendChild(o);
    }

    var gOff = addGroup('無音樂');
    addOpt(gOff, 'off', '不要音樂');

    var tracks = (CFG.REEL && CFG.REEL.BGM_TRACKS) || [];
    if (tracks.length) {
      var gTracks = addGroup('免版權曲庫（真實伴奏）');
      tracks.forEach(function (t) {
        addOpt(gTracks, t.id, t.label);
      });
    }

    var presets = (CFG.REEL && CFG.REEL.BGM_PRESETS) || [];
    if (presets.length) {
      var gAi = addGroup('AI 氛圍作曲（本機生成）');
      presets.forEach(function (p) {
        addOpt(gAi, p.id, p.label);
      });
    }

    var def = (CFG.REEL && CFG.REEL.BGM_DEFAULT) || 'track_serene';
    var hasPrev = prev && sel.querySelector('option[value="' + prev + '"]');
    sel.value = hasPrev ? prev : def;
    updateReelBgmHint();
    syncReelBgmPreviewButtons(false);
  }

  function updateReelBgmHint() {
    var hint = $('reel-bgm-hint');
    var sel = $('reel-bgm');
    if (!hint || !sel) return;
    var val = sel.value || '';
    var track = (CFG.REEL && CFG.REEL.BGM_TRACKS || []).find(function (t) { return t.id === val; });
    if (track) {
      hint.innerHTML = '已選 <strong>免版權曲庫</strong>：' + track.label +
        '（' + (track.license || 'Mixkit') + '，可商用）。上傳音檔時會覆蓋此選項。';
      return;
    }
    if (val === 'off') {
      hint.textContent = '本次合成不加音樂。';
      return;
    }
    if (val) {
      hint.innerHTML = '已選 <strong>AI 氛圍作曲</strong>：瀏覽器即時生成、免版權，但較不像完整歌曲。上傳音檔時會覆蓋此選項。';
      return;
    }
    hint.innerHTML =
      '<strong>免版權曲庫</strong>：真實伴奏（Mixkit，可商用）。<strong>AI 氛圍作曲</strong>：瀏覽器即時生成、免版權但較像氛圍音。若上傳自己的音檔，會優先使用上傳檔（請確認你有使用權）。';
  }

  function renderSiteVideosPanel() {
    var wrap = $('site-videos-panel');
    var grid = $('site-videos-grid');
    var meta = $('site-videos-meta');
    var note = $('site-videos-limit-note');
    if (!wrap || !grid) return;
    var list = state.siteVideos || [];
    wrap.classList.toggle('hidden', list.length === 0 && state.wizardStep !== 5);
    if (state.wizardStep === 5) wrap.classList.remove('hidden');
    grid.innerHTML = '';
    list.forEach(function (v) {
      var div = document.createElement('div');
      div.className = 'thumb kind-video';
      div.title = v.name + (v.note ? ' — ' + v.note : '');
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = v.source_type === 'local_path' ? '本機' : '案場';
      div.appendChild(badge);
      var span = document.createElement('span');
      span.textContent = v.name || '影片';
      div.appendChild(span);
      var path = document.createElement('small');
      path.textContent = v.path || '尚無路徑';
      path.style.wordBreak = 'break-all';
      div.appendChild(path);
      var actions = document.createElement('div');
      actions.className = 'vid-actions';
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn btn-ghost';
      rm.textContent = '移除';
      rm.addEventListener('click', function (e) {
        e.stopPropagation();
        state.siteVideos = state.siteVideos.filter(function (x) { return x.id !== v.id; });
        renderSiteVideosPanel();
      });
      actions.appendChild(rm);
      div.appendChild(actions);
      grid.appendChild(div);
    });
    if (meta) {
      meta.textContent = list.length
        ? ('已選影片 ' + list.length + ' 支。下一步請下載工單 JSON。')
        : '尚未選影片。可回步驟①依案號勾選，或在下方貼本機完整路徑。';
    }
    if (note) {
      note.classList.toggle('hidden', list.length === 0);
      if (list.length) {
        note.classList.remove('hidden');
        note.textContent = '網頁只保存這些檔名與路徑，不會讀取影片內容。本機助手收到工單後才會從 Dropbox 同步資料夾讀檔。';
      }
    }
  }

  function setWorkOrderStatus(msg, kind) {
    var el = $('work-order-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('ok', 'bad');
    if (kind === 'ok') el.classList.add('ok');
    if (kind === 'bad') el.classList.add('bad');
  }

  function addLocalVideoPaths() {
    var input = $('local-video-paths');
    var raw = input ? input.value : '';
    var paths = raw.split(/\r?\n/).map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); }).filter(Boolean);
    if (!paths.length) {
      setWorkOrderStatus('請先貼上至少一支影片的完整路徑。', 'bad');
      if (input) input.focus();
      return;
    }
    var invalid = paths.filter(function (p) { return !/^[a-zA-Z]:\\.+\.(mov|mp4|m4v|webm)$/i.test(p); });
    if (invalid.length) {
      setWorkOrderStatus('有路徑不完整。請貼上從磁碟代號開始、含副檔名的完整路徑。', 'bad');
      return;
    }
    paths.forEach(function (p) {
      var exists = state.siteVideos.some(function (v) { return String(v.path).toLowerCase() === p.toLowerCase(); });
      if (exists) return;
      state.siteVideos.push({
        id: uid('vid'),
        name: p.split('\\').pop(),
        path: p,
        ext: (p.split('.').pop() || '').toLowerCase(),
        kind: 'video',
        source_type: 'local_path',
        project_code: ($('import-project-code') && $('import-project-code').value.trim()) || '',
        note: '本機完整路徑；影片不會上傳。'
      });
    });
    input.value = '';
    renderSiteVideosPanel();
    setWorkOrderStatus('本機影片已加入。確認清單後下載工單 JSON。', 'ok');
  }

  function normalizeDropboxRelativePath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function makeWorkOrder() {
    var videos = (state.siteVideos || []).map(function (v) {
      return {
        filename: v.name || '',
        source_type: v.source_type === 'local_path' ? 'local_path' : 'dropbox_relative',
        path: v.source_type === 'local_path' ? v.path : normalizeDropboxRelativePath(v.path)
      };
    });
    var projectCode = ($('import-project-code') && $('import-project-code').value.trim()) ||
      (state.siteImport && state.siteImport.projectCode) || '';
    var now = new Date();
    return {
      schema_version: 1,
      job_id: 'fb-reel-' + now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 6),
      case_id: projectCode,
      videos: videos,
      segs: (($('work-order-segs') && $('work-order-segs').value) || '').trim() || null,
      created_at: now.toISOString(),
      status: 'pending',
      status_message: '等待本機助手收單',
      source: 'fb-post-studio'
    };
  }

  function handleDownloadWorkOrder() {
    if (state.workOrderBusy) return;
    if (!state.siteVideos || !state.siteVideos.length) {
      setWorkOrderStatus('尚未選影片。請先從案場清單勾選，或貼上本機完整路徑。', 'bad');
      return;
    }
    var missingPath = state.siteVideos.some(function (v) { return !v.path; });
    if (missingPath) {
      setWorkOrderStatus('有影片缺少路徑，請移除後重新選取。', 'bad');
      return;
    }
    var btn = $('btn-download-work-order');
    state.workOrderBusy = true;
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 建立中…');
    setWorkOrderStatus('正在建立工單…');
    window.setTimeout(function () {
      try {
        var job = makeWorkOrder();
        var blob = new Blob([JSON.stringify(job, null, 2)], { type: 'application/json;charset=utf-8' });
        downloadBlob(blob, job.job_id + '.json');
        setWorkOrderStatus('工單已下載。請把 JSON 放進 queue 資料夾，再執行收單指令。', 'ok');
        showOk('短影音工單已下載');
      } catch (e) {
        setWorkOrderStatus('建立工單失敗：' + (e.message || String(e)), 'bad');
      }
      state.workOrderBusy = false;
      setBusy(btn, false, null, '<i class="fa-solid fa-file-arrow-down"></i> 下載工單 JSON');
    }, 0);
  }

  function copyPlainText(text, okMessage) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      showError('瀏覽器無法自動複製，請手動選取畫面上的文字。');
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      showOk(okMessage);
    }).catch(function () {
      showError('複製失敗，請手動選取文字。');
    });
  }

  function mapReelProgress(a, b, label) {
    var raw = String(label || '');
    var stage = '進行中';
    var pct = b > 0 ? Math.round((a / b) * 100) : 0;
    if (/載入|引擎|ffmpeg|ensure|CDN|wasm/i.test(raw) || raw.indexOf('載入') >= 0) {
      stage = '① 載入引擎';
      pct = Math.max(5, Math.min(25, pct || 10));
    } else if (/渲染|拼片|影格|即時錄製/.test(raw)) {
      stage = '② 拼片／渲染';
      pct = 25 + Math.round((pct / 100) * 45);
    } else if (/編碼|讀取成品/.test(raw)) {
      stage = '③ 編碼';
      pct = 70 + Math.round((pct / 100) * 25);
    } else if (/降級|WebM|改走/.test(raw)) {
      stage = '③′ 改走 WebM 降級';
      pct = Math.max(40, pct);
    } else if (/完成|匯出/.test(raw)) {
      stage = '④ 完成';
      pct = 100;
    }
    if ($('reel-progress')) {
      $('reel-progress').textContent = stage + ' · ' + raw + (b ? '（' + a + '/' + b + '）' : '');
      $('reel-progress').className = 'status-line';
    }
  }

  function handleReelCompose() {
    hideError();
    stopReelBgmPreview(true);
    var api = window.FbPostReel;
    if (!api || !api.composeReel) {
      showError('短影音模組未載入');
      return;
    }
    var photos = getReelSourcePhotos();
    if (photos.length < 2) {
      showError('照片合成至少需要 2 張圖。案場實拍影片請改用上方「下載工單 JSON」交給本機助手。');
      return;
    }
    var urls = photos.map(function (p) { return p.preview || dataUrlFromPhoto(p); }).filter(Boolean);
    var btn = $('btn-reel-compose');
    var note = $('reel-fallback-note');
    if (note) {
      note.classList.add('hidden');
      note.textContent = '';
    }
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 合成中…');
    if ($('reel-progress')) {
      $('reel-progress').textContent = '① 載入引擎 · 開始合成…';
      $('reel-progress').className = 'status-line';
    }

    var musicOff = $('reel-music-off') && $('reel-music-off').checked;
    var bgm = ($('reel-bgm') && $('reel-bgm').value) || ((CFG.REEL && CFG.REEL.BGM_DEFAULT) || 'track_serene');
    var sec = parseFloat($('reel-sec-per-slide') && $('reel-sec-per-slide').value) || 2.4;

    api.composeReel({
      imageUrls: urls,
      secPerSlide: sec,
      bgmPreset: bgm,
      audioBlob: state.reelAudioBlob,
      musicOff: musicOff,
      onProgress: mapReelProgress
    }).then(function (result) {
      if (state.reelLastUrl) {
        try { URL.revokeObjectURL(state.reelLastUrl); } catch (e0) {}
      }
      var url = URL.createObjectURL(result.blob);
      state.reelLastUrl = url;
      state.reelBlob = result.blob;
      state.reelMeta = result;
      var preview = $('reel-preview');
      var wrap = $('reel-preview-wrap');
      if (preview) preview.src = url;
      if (wrap) wrap.classList.remove('hidden');
      if ($('btn-reel-download')) $('btn-reel-download').disabled = false;
      if ($('reel-progress')) {
        $('reel-progress').textContent = result.note || '合成完成';
        $('reel-progress').className = 'status-line ok';
      }
      if (result.fallback && note) {
        note.classList.remove('hidden');
        note.textContent =
          '已自動降級為 WebM（引擎／CDN 不可用時的備援）。粉專有時較愛 MP4：可換瀏覽器、確認可連 CDN 後再重試。';
      }
      showOk(result.fallback ? '已降級匯出 WebM' : '短影音已合成，可下載');
    }).catch(function (e) {
      if ($('reel-progress')) {
        $('reel-progress').textContent = e.message || String(e);
        $('reel-progress').className = 'status-line bad';
      }
      if (note) {
        note.classList.remove('hidden');
        note.textContent = '合成失敗：' + (e.message || String(e)) +
          '。建議減少張數／縮短秒數，或檢查網路後重試。';
      }
      showError(e.message || String(e));
    }).then(function () {
      setBusy(btn, false, null, '<i class="fa-solid fa-clapperboard"></i> 開始合成');
    });
  }

  function handleReelDownload() {
    if (!state.reelBlob) {
      showError('尚未合成影片');
      return;
    }
    var ext = (state.reelMeta && state.reelMeta.ext) || 'mp4';
    downloadBlob(state.reelBlob, 'fb-reel-' + Date.now() + '.' + ext);
    showOk('已開始下載短影音');
  }

  function renderVersions() {
    var box = $('version-list');
    box.innerHTML = '';
    var im = getSelectedImage();
    if (!im) return;
    im.versions.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ver-btn' + (v.id === im.selectedVersionId ? ' active' : '');
      btn.title = v.instruction || v.id;
      btn.innerHTML = '<img alt="' + v.id + '" src="' + v.preview + '">';
      btn.addEventListener('click', function () {
        im.selectedVersionId = v.id;
        im.working = {
          data_base64: v.data_base64,
          mime_type: v.mime_type,
          preview: v.preview,
          name: v.id
        };
        if (v.id === 'orig') {
          im.currentEdit = null;
          setPreviewEl($('compare-before'), im.original);
          setPreviewEl($('compare-after'), null, '尚未改圖／已回退原圖');
        } else {
          im.currentEdit = v;
          setPreviewEl($('compare-before'), im.original);
          setPreviewEl($('compare-after'), v);
        }
        $('edit-note').textContent = v.note || v.instruction || '';
        renderVersions();
      });
      box.appendChild(btn);
    });
  }

  /* ---------- emoji + asset overlays ---------- */

  var EMOJI_FONT_STACK_ = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

  function overlayLabel(o) {
    if (!o) return '';
    if (o.type === 'asset' || o.assetId) return o.name || '素材';
    return o.char || '';
  }

  function findStickerById(id) {
    return (state.stickers || []).find(function (s) { return s.id === id; }) || null;
  }

  function resolveOverlayPreview(o) {
    if (!o) return '';
    if (o.preview) return o.preview;
    if (o.assetId) {
      var item = findStickerById(o.assetId);
      if (item && item.preview) {
        o.preview = item.preview;
        return item.preview;
      }
    }
    return '';
  }

  function overlayCacheKey(o) {
    return o.assetId || o.preview || o.id || '';
  }

  function preloadOverlayImage(o) {
    if (!o) return Promise.resolve(null);
    var key = overlayCacheKey(o);
    if (!key) return Promise.resolve(null);
    if (state.overlayImageCache[key]) return Promise.resolve(state.overlayImageCache[key]);
    var preview = resolveOverlayPreview(o);
    if (!preview) return Promise.resolve(null);
    var api = window.FbPostStickers;
    var loader = api && api.loadImageFromUrl
      ? api.loadImageFromUrl(preview)
      : loadImageFromPhoto({ preview: preview });
    return loader.then(function (img) {
      state.overlayImageCache[key] = img;
      return img;
    }).catch(function () {
      return null;
    });
  }

  function ensureOverlayImagesLoaded(overlays) {
    return Promise.all((overlays || []).map(preloadOverlayImage));
  }

  function getOverlayImage(o) {
    var key = overlayCacheKey(o);
    return key ? state.overlayImageCache[key] || null : null;
  }

  function overlayDrawSize(o, canvas) {
    var size = o.size || CFG.EMOJI_DEFAULT_SIZE || 52;
    var w = size;
    var h = size;
    if (o.type === 'asset' || o.assetId) {
      var img = getOverlayImage(o);
      if (img) {
        var ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width || 1);
        h = w * ratio;
      }
    }
    return {
      cx: o.x * canvas.width,
      cy: o.y * canvas.height,
      w: w,
      h: h
    };
  }

  function showConvertFailGuide(which, msg) {
    var guide = $(which === 'logo' ? 'logo-fail-guide' : 'sticker-fail-guide');
    if (guide) guide.classList.add('show');
    var friendly =
      '轉檔失敗。請用 Illustrator／其他工具匯出「透明 PNG」後再上傳（不要再傳複雜 .ai）。' +
      (msg ? '\n原因：' + msg : '');
    showError(friendly);
  }

  function hideConvertFailGuide(which) {
    var guide = $(which === 'logo' ? 'logo-fail-guide' : 'sticker-fail-guide');
    if (guide) guide.classList.remove('show');
  }

  function renderStickerGrid() {
    var box = $('sticker-grid');
    var status = $('sticker-status');
    if (!box) return;
    box.innerHTML = '';
    var list = state.stickers || [];
    if (status) {
      status.textContent = list.length
        ? ('本機素材 ' + list.length + ' 筆（可拖曳或點一下加到畫布）')
        : '尚無素材，請上傳 PNG／SVG';
      status.className = 'status-line' + (list.length ? ' ok' : '');
    }
    list.forEach(function (item) {
      var wrap = document.createElement('div');
      wrap.className = 'thumb';
      wrap.title = (item.category || '') + ' · ' + (item.name || '');
      wrap.setAttribute('draggable', 'true');
      wrap.innerHTML =
        '<img alt="sticker" src="' + item.preview + '">' +
        '<span class="badge">' + (item.category || '貼圖') + '</span>' +
        '<button type="button" class="rm" title="刪除">×</button>';
      wrap.addEventListener('dragstart', function (e) {
        if (e.dataTransfer) {
          e.dataTransfer.setData('application/x-fb-asset-id', item.id);
          e.dataTransfer.setData('text/plain', item.name || 'sticker');
          e.dataTransfer.effectAllowed = 'copy';
        }
      });
      wrap.querySelector('.rm').addEventListener('click', function (e) {
        e.stopPropagation();
        var api = window.FbPostStickers;
        if (!api) return;
        api.removeSticker(item.id).then(function () {
          return refreshStickers();
        }).then(function () {
          showOk('已刪除素材');
        });
      });
      wrap.addEventListener('click', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('rm')) return;
        addAssetOverlayAtCenter(item);
      });
      box.appendChild(wrap);
    });
  }

  function refreshStickers() {
    var api = window.FbPostStickers;
    if (!api) {
      if ($('sticker-status')) {
        $('sticker-status').textContent = '貼圖模組未載入';
        $('sticker-status').className = 'status-line bad';
      }
      return Promise.resolve();
    }
    return api.listStickers().then(function (list) {
      state.stickers = list || [];
      renderStickerGrid();
      return ensureOverlayImagesLoaded(state.stickers);
    }).catch(function (e) {
      if ($('sticker-status')) {
        $('sticker-status').textContent = e.message || String(e);
        $('sticker-status').className = 'status-line bad';
      }
    });
  }

  function handleStickerUpload(file) {
    var api = window.FbPostStickers;
    if (!api) {
      showError('貼圖模組未載入');
      return;
    }
    var cat = ($('sticker-category') && $('sticker-category').value) || '貼圖';
    hideConvertFailGuide('sticker');
    if ($('sticker-status')) {
      $('sticker-status').textContent = '轉換中…（.ai 可能需幾秒）';
      $('sticker-status').className = 'status-line';
    }
    api.addConvertedSticker(file, cat).then(function (entry) {
      hideConvertFailGuide('sticker');
      showOk((entry.note || '已加入素材庫') + '：' + (entry.name || ''));
      return refreshStickers();
    }).catch(function (e) {
      var msg = e.message || String(e);
      showConvertFailGuide('sticker', msg);
      if ($('sticker-status')) {
        $('sticker-status').textContent = '失敗 → 請改傳透明 PNG';
        $('sticker-status').className = 'status-line bad';
      }
    });
  }

  function getEmojiOverlays(im) {
    if (!im) return [];
    if (!Array.isArray(im.emojiOverlays)) im.emojiOverlays = [];
    return im.emojiOverlays;
  }

  function getSelectedEmojiOverlay(im) {
    im = im || getSelectedImage();
    if (!im || !state.selectedEmojiId) return null;
    return getEmojiOverlays(im).find(function (o) { return o.id === state.selectedEmojiId; }) || null;
  }

  function clampRatio(v) {
    return Math.max(0.05, Math.min(0.95, v));
  }

  function canvasPointFromClient(clientX, clientY) {
    var canvas = $('edit-canvas');
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0.5, y: 0.5, px: 0, py: 0 };
    var px = (clientX - rect.left) * (canvas.width / rect.width);
    var py = (clientY - rect.top) * (canvas.height / rect.height);
    return {
      x: clampRatio(px / canvas.width),
      y: clampRatio(py / canvas.height),
      px: px,
      py: py
    };
  }

  function hitTestEmoji(px, py, overlays, canvas) {
    var i;
    for (i = overlays.length - 1; i >= 0; i--) {
      var o = overlays[i];
      var box = overlayDrawSize(o, canvas);
      if (px >= box.cx - box.w / 2 && px <= box.cx + box.w / 2 &&
          py >= box.cy - box.h / 2 && py <= box.cy + box.h / 2) {
        return o;
      }
    }
    return null;
  }

  function addEmojiOverlay(char, x, y) {
    var im = getSelectedImage();
    if (!im) {
      showError('請先選中一張圖');
      return null;
    }
    if (!state.sourceImg) {
      showError('請先「採用此圖」或「採用原圖」再貼 emoji');
      return null;
    }
    var overlay = {
      id: uid('emo'),
      char: String(char || '').trim(),
      x: clampRatio(x == null ? 0.5 : x),
      y: clampRatio(y == null ? 0.5 : y),
      size: parseInt(($('emoji-size') && $('emoji-size').value) || CFG.EMOJI_DEFAULT_SIZE || 52, 10) || 52
    };
    if (!overlay.char) return null;
    getEmojiOverlays(im).push(overlay);
    state.selectedEmojiId = overlay.id;
    redrawCanvas();
    syncEmojiControls();
    return overlay;
  }

  function addEmojiAtCenter(char) {
    addEmojiOverlay(char, 0.5, 0.5);
  }

  function addAssetOverlay(item, x, y) {
    var im = getSelectedImage();
    if (!im) {
      showError('請先選中一張圖');
      return null;
    }
    if (!state.sourceImg) {
      showError('請先「採用此圖」或「採用原圖」再貼素材');
      return null;
    }
    if (!item || !item.preview) return null;
    var overlay = {
      id: uid('emo'),
      type: 'asset',
      assetId: item.id,
      name: item.name || '素材',
      preview: item.preview,
      x: clampRatio(x == null ? 0.5 : x),
      y: clampRatio(y == null ? 0.5 : y),
      size: parseInt(($('emoji-size') && $('emoji-size').value) || CFG.EMOJI_DEFAULT_SIZE || 52, 10) || 52
    };
    getEmojiOverlays(im).push(overlay);
    state.selectedEmojiId = overlay.id;
    preloadOverlayImage(overlay).then(function () {
      redrawCanvas();
      syncEmojiControls();
    });
    redrawCanvas();
    syncEmojiControls();
    return overlay;
  }

  function addAssetOverlayAtCenter(item) {
    addAssetOverlay(item, 0.5, 0.5);
  }

  function removeSelectedEmoji() {
    var im = getSelectedImage();
    if (!im || !state.selectedEmojiId) return;
    im.emojiOverlays = getEmojiOverlays(im).filter(function (o) {
      return o.id !== state.selectedEmojiId;
    });
    state.selectedEmojiId = null;
    redrawCanvas();
    syncEmojiControls();
  }

  function clearEmojiOverlays() {
    var im = getSelectedImage();
    if (!im) return;
    im.emojiOverlays = [];
    state.selectedEmojiId = null;
    redrawCanvas();
    syncEmojiControls();
    showOk('已清除本圖全部貼圖');
  }

  function syncEmojiControls() {
    var im = getSelectedImage();
    var overlays = getEmojiOverlays(im);
    var selected = getSelectedEmojiOverlay(im);
    var controls = $('emoji-controls');
    var status = $('emoji-status');
    if (controls) controls.classList.toggle('hidden', !selected);
    if (selected && $('emoji-size')) {
      $('emoji-size').value = String(selected.size || CFG.EMOJI_DEFAULT_SIZE || 52);
      if ($('val-emoji-size')) $('val-emoji-size').textContent = $('emoji-size').value;
    }
    if (status) {
      status.textContent = overlays.length
        ? ('本圖已有 ' + overlays.length + ' 個貼圖' +
          (selected ? '（已選：' + overlayLabel(selected) + '）' : ''))
        : '尚未加 emoji／素材';
      status.className = 'status-line' + (overlays.length ? ' ok' : '');
    }
  }

  function renderEmojiPalette() {
    var root = $('emoji-palette-root');
    if (!root) return;
    root.innerHTML = '';
    var groups = CFG.BUILTIN_EMOJIS || [];
    groups.forEach(function (group) {
      var title = document.createElement('div');
      title.className = 'emoji-group-title';
      title.textContent = group.category || 'Emoji';
      root.appendChild(title);
      var row = document.createElement('div');
      row.className = 'emoji-palette';
      (group.items || []).forEach(function (char) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-chip';
        btn.textContent = char;
        btn.title = '拖到畫布，或點一下加在中央';
        btn.setAttribute('draggable', 'true');
        btn.addEventListener('dragstart', function (e) {
          if (e.dataTransfer) {
            e.dataTransfer.setData('text/emoji', char);
            e.dataTransfer.setData('text/plain', char);
            e.dataTransfer.effectAllowed = 'copy';
          }
        });
        btn.addEventListener('click', function () {
          addEmojiAtCenter(char);
        });
        row.appendChild(btn);
      });
      root.appendChild(row);
    });
  }

  function drawEmojiOverlays(ctx, canvas, overlays, selectedId) {
    if (!overlays || !overlays.length) return;
    overlays.forEach(function (o) {
      var box = overlayDrawSize(o, canvas);
      ctx.save();
      if (o.type === 'asset' || o.assetId) {
        var img = getOverlayImage(o);
        if (img) {
          ctx.drawImage(img, box.cx - box.w / 2, box.cy - box.h / 2, box.w, box.h);
          if (selectedId && o.id === selectedId) {
            ctx.strokeStyle = 'rgba(96,165,250,0.95)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(box.cx - box.w / 2 - 4, box.cy - box.h / 2 - 4, box.w + 8, box.h + 8);
            ctx.setLineDash([]);
          }
        } else {
          preloadOverlayImage(o).then(function (loaded) {
            if (loaded) redrawCanvas();
          });
        }
      } else {
        var size = o.size || CFG.EMOJI_DEFAULT_SIZE || 52;
        ctx.font = size + 'px ' + EMOJI_FONT_STACK_;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.char, box.cx, box.cy);
        if (selectedId && o.id === selectedId) {
          var half = size / 2 + 4;
          ctx.strokeStyle = 'rgba(96,165,250,0.95)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(box.cx - half, box.cy - half, half * 2, half * 2);
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    });
  }

  function bindCanvasEmoji() {
    var canvas = $('edit-canvas');
    var stage = $('canvas-stage');
    if (!canvas || !stage) return;

    stage.addEventListener('dragover', function (e) {
      e.preventDefault();
      stage.classList.add('drop-target');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    stage.addEventListener('dragleave', function () {
      stage.classList.remove('drop-target');
    });
    stage.addEventListener('drop', function (e) {
      e.preventDefault();
      stage.classList.remove('drop-target');
      var pt = canvasPointFromClient(e.clientX, e.clientY);
      if (e.dataTransfer) {
        var assetId = e.dataTransfer.getData('application/x-fb-asset-id');
        if (assetId) {
          var item = findStickerById(assetId);
          if (item) {
            addAssetOverlay(item, pt.x, pt.y);
            return;
          }
        }
        var char = e.dataTransfer.getData('text/emoji') || e.dataTransfer.getData('text/plain');
        if (char) addEmojiOverlay(char, pt.x, pt.y);
      }
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (!state.sourceImg) return;
      var im = getSelectedImage();
      if (!im) return;
      var pt = canvasPointFromClient(e.clientX, e.clientY);
      var hit = hitTestEmoji(pt.px, pt.py, getEmojiOverlays(im), canvas);
      if (hit) {
        state.selectedEmojiId = hit.id;
        state.emojiDrag.active = true;
        state.emojiDrag.id = hit.id;
        state.emojiDrag.offsetX = pt.px - hit.x * canvas.width;
        state.emojiDrag.offsetY = pt.py - hit.y * canvas.height;
        try { canvas.setPointerCapture(e.pointerId); } catch (eCap) {}
      } else {
        state.selectedEmojiId = null;
      }
      redrawCanvas();
      syncEmojiControls();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!state.emojiDrag.active || !state.emojiDrag.id) return;
      var im = getSelectedImage();
      if (!im) return;
      var overlay = getEmojiOverlays(im).find(function (o) { return o.id === state.emojiDrag.id; });
      if (!overlay) return;
      var pt = canvasPointFromClient(e.clientX, e.clientY);
      overlay.x = clampRatio((pt.px - state.emojiDrag.offsetX) / canvas.width);
      overlay.y = clampRatio((pt.py - state.emojiDrag.offsetY) / canvas.height);
      redrawCanvas();
    });

    function endEmojiDrag(e) {
      if (!state.emojiDrag.active) return;
      state.emojiDrag.active = false;
      state.emojiDrag.id = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (eRel) {}
    }
    canvas.addEventListener('pointerup', endEmojiDrag);
    canvas.addEventListener('pointercancel', endEmojiDrag);
  }

  /* ---------- canvas refine ---------- */

  function loadImageFromPhoto(photo) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('精修圖載入失敗')); };
      img.src = dataUrlFromPhoto(photo);
    });
  }

  function cropRect(imgW, imgH, ratio) {
    if (!ratio || ratio === 'free') return { sx: 0, sy: 0, sw: imgW, sh: imgH };
    var parts = String(ratio).split(':');
    var rw = parseFloat(parts[0]);
    var rh = parseFloat(parts[1]);
    if (!(rw > 0 && rh > 0)) return { sx: 0, sy: 0, sw: imgW, sh: imgH };
    var target = rw / rh;
    var current = imgW / imgH;
    var sw, sh, sx, sy;
    if (current > target) {
      sh = imgH;
      sw = Math.round(imgH * target);
      sx = Math.round((imgW - sw) / 2);
      sy = 0;
    } else {
      sw = imgW;
      sh = Math.round(imgW / target);
      sx = 0;
      sy = Math.round((imgH - sh) / 2);
    }
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  function syncRefineSlidersFromState() {
    var r = state.refine;
    $('adj-brightness').value = r.brightness;
    $('adj-contrast').value = r.contrast;
    $('adj-saturate').value = r.saturate;
    $('adj-sharpen').value = r.sharpen;
    $('adj-rotate').value = r.rotateFine;
    $('adj-vignette').value = r.vignette;
    $('adj-warm').value = r.warm;
  }

  function readRefineFromSliders() {
    state.refine.brightness = parseInt($('adj-brightness').value, 10) || 0;
    state.refine.contrast = parseInt($('adj-contrast').value, 10) || 0;
    state.refine.saturate = parseInt($('adj-saturate').value, 10) || 0;
    state.refine.sharpen = parseInt($('adj-sharpen').value, 10) || 0;
    state.refine.rotateFine = parseFloat($('adj-rotate').value) || 0;
    state.refine.vignette = parseInt($('adj-vignette').value, 10) || 0;
    state.refine.warm = parseInt($('adj-warm').value, 10) || 0;
  }

  function applySharpen(ctx, w, h, amount) {
    if (!(amount > 0)) return;
    var strength = amount / 100;
    var src = ctx.getImageData(0, 0, w, h);
    var out = ctx.createImageData(w, h);
    var d = src.data;
    var o = out.data;
    var mix = strength * 0.65;
    var i, x, y, idx, sum, c;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        idx = (y * w + x) * 4;
        for (c = 0; c < 3; c++) {
          sum = d[idx + c] * 5
            - d[((y - 1) * w + x) * 4 + c]
            - d[((y + 1) * w + x) * 4 + c]
            - d[(y * w + (x - 1)) * 4 + c]
            - d[(y * w + (x + 1)) * 4 + c];
          o[idx + c] = Math.max(0, Math.min(255, d[idx + c] * (1 - mix) + sum * mix));
        }
        o[idx + 3] = d[idx + 3];
      }
    }
    // edges copy
    for (i = 0; i < d.length; i += 4) {
      if (o[i + 3] === 0 && d[i + 3]) {
        o[i] = d[i]; o[i + 1] = d[i + 1]; o[i + 2] = d[i + 2]; o[i + 3] = d[i + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function applyWarmTint(ctx, w, h, warm) {
    if (!warm) return;
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var amt = warm / 100;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = Math.max(0, Math.min(255, d[i] + amt * 40));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] - amt * 35));
    }
    ctx.putImageData(img, 0, 0);
  }

  function applyVignette(ctx, w, h, amount) {
    if (!(amount > 0)) return;
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (amount / 100) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function redrawCanvas() {
    var canvas = $('edit-canvas');
    var ctx = canvas.getContext('2d');
    var img = state.sourceImg;
    readRefineFromSliders();
    var r = state.refine;

    $('val-brightness').textContent = String(r.brightness);
    $('val-contrast').textContent = String(r.contrast);
    $('val-saturate').textContent = String(r.saturate);
    $('val-sharpen').textContent = String(r.sharpen);
    $('val-rotate').textContent = String(r.rotateFine);
    $('val-vignette').textContent = String(r.vignette);
    $('val-warm').textContent = String(r.warm);
    $('val-logo-scale').textContent = String($('logo-scale').value);
    $('val-logo-opacity').textContent = String($('logo-opacity').value);

    if (!img) {
      canvas.width = 800;
      canvas.height = 800;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a2336';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('請先「採用此圖」或「採用原圖」', canvas.width / 2, canvas.height / 2);
      return;
    }

    var srcW = img.naturalWidth || img.width;
    var srcH = img.naturalHeight || img.height;
    var rect = cropRect(srcW, srcH, state.crop);

    // temp canvas for crop + transform
    var tmp = document.createElement('canvas');
    var tctx = tmp.getContext('2d');
    var rot90 = ((r.rotate90 % 4) + 4) % 4;
    var croppedW = rect.sw;
    var croppedH = rect.sh;
    var baseW = (rot90 % 2 === 1) ? croppedH : croppedW;
    var baseH = (rot90 % 2 === 1) ? croppedW : croppedH;

    var fineRad = (r.rotateFine || 0) * Math.PI / 180;
    var pad = Math.abs(Math.sin(fineRad)) + Math.abs(Math.cos(fineRad));
    var outW = Math.ceil(baseW * (fineRad ? pad : 1));
    var outH = Math.ceil(baseH * (fineRad ? pad : 1));
    tmp.width = outW;
    tmp.height = outH;

    tctx.translate(outW / 2, outH / 2);
    tctx.rotate(rot90 * Math.PI / 2 + fineRad);
    if (r.flipH) tctx.scale(-1, 1);
    tctx.filter = 'brightness(' + (100 + r.brightness) + '%) contrast(' + (100 + r.contrast) +
      '%) saturate(' + (100 + r.saturate) + '%)';
    tctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, -croppedW / 2, -croppedH / 2, croppedW, croppedH);
    tctx.filter = 'none';
    tctx.setTransform(1, 0, 0, 1, 0, 0);

    applyWarmTint(tctx, outW, outH, r.warm);
    applySharpen(tctx, outW, outH, r.sharpen);
    applyVignette(tctx, outW, outH, r.vignette);

    var maxSide = 1200;
    var scale = Math.min(1, maxSide / Math.max(outW, outH));
    canvas.width = Math.max(1, Math.round(outW * scale));
    canvas.height = Math.max(1, Math.round(outH * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

    if ($('logo-enabled').value === '1' && state.logoImg) {
      var scalePct = (parseInt($('logo-scale').value, 10) || 14) / 100;
      var opacity = (parseInt($('logo-opacity').value, 10) || 90) / 100;
      var lw = canvas.width * scalePct;
      var ratio = (state.logoImg.naturalHeight || state.logoImg.height) /
        (state.logoImg.naturalWidth || state.logoImg.width || 1);
      var lh = lw * ratio;
      var margin = Math.round(canvas.width * 0.03);
      var pos = $('logo-pos').value;
      var x = margin;
      var y = margin;
      if (pos === 'br') { x = canvas.width - lw - margin; y = canvas.height - lh - margin; }
      else if (pos === 'bl') { x = margin; y = canvas.height - lh - margin; }
      else if (pos === 'tr') { x = canvas.width - lw - margin; y = margin; }
      else if (pos === 'tl') { x = margin; y = margin; }
      else if (pos === 'center') { x = (canvas.width - lw) / 2; y = (canvas.height - lh) / 2; }
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(state.logoImg, x, y, lw, lh);
      ctx.restore();
    }

    var im = getSelectedImage();
    drawEmojiOverlays(ctx, canvas, getEmojiOverlays(im), state.selectedEmojiId);
  }

  function adoptPhoto(photo, label, quiet) {
    if (!photo) {
      if (!quiet) showError('沒有可採用的圖片');
      return;
    }
    var im = getSelectedImage();
    if (im) im.adopted = photo;
    loadImageFromPhoto(photo).then(function (img) {
      state.sourceImg = img;
      redrawCanvas();
      if (!quiet) {
        showOk('已採用' + (label || '圖片') + '，可在下方精修');
        if (im) flashAdoptedThumb(im.id);
        var refine = $('refine-section');
        if (refine) refine.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }).catch(function (e) {
      if (!quiet) showError(e.message || String(e));
    });
  }

  function renderFilterPresets() {
    var box = $('filter-presets');
    box.innerHTML = '';
    (CFG.FILTER_PRESETS || []).forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.refine.filterId === f.id ? ' active' : '');
      btn.textContent = f.label;
      btn.addEventListener('click', function () {
        state.refine.filterId = f.id;
        state.refine.brightness = f.brightness || 0;
        state.refine.contrast = f.contrast || 0;
        state.refine.saturate = f.saturate || 0;
        state.refine.warm = f.warm || 0;
        syncRefineSlidersFromState();
        renderFilterPresets();
        redrawCanvas();
      });
      box.appendChild(btn);
    });
  }

  function resetRefine() {
    state.refine = defaultRefine();
    syncRefineSlidersFromState();
    renderFilterPresets();
    redrawCanvas();
    showOk('已重置精修參數');
  }

  function loadLogoFromUrl(url, label) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        state.logoImg = img;
        state.logoLabel = label || url;
        $('logo-status').textContent = '已載入：' + state.logoLabel;
        $('logo-status').className = 'status-line ok';
        redrawCanvas();
        resolve(img);
      };
      img.onerror = function () { reject(new Error('LOGO 載入失敗：' + url)); };
      img.src = url;
    });
  }

  function tryLoadDefaultLogo() {
    var primary = CFG.DEFAULT_LOGO_URL || 'assets/logo.png';
    var fallback = CFG.FALLBACK_LOGO_URL || 'assets/logo.svg';
    return loadLogoFromUrl(primary, '內建 logo.png').catch(function () {
      return loadLogoFromUrl(fallback, '內建 logo.svg');
    }).catch(function () {
      $('logo-status').textContent = '內建 LOGO 載入失敗，請上傳自訂 PNG／SVG';
      $('logo-status').className = 'status-line bad';
    });
  }

  /* ---------- API actions ---------- */

  function handleGenerateCopy() {
    hideError();
    if (!state.images.length) {
      showError('請先上傳至少一張原圖');
      return;
    }
    var btn = $('btn-generate-copy');
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 生成中…');
    var photos = state.images.map(function (im) { return photoPayload(im.original); });
    postGas('fb_post_generate', {
      photos: photos,
      photo: photos[0],
      post_type: $('post-type').value,
      tone: $('tone').value.trim(),
      extra_notes: $('extra-notes').value.trim(),
      model: CFG.COPY_MODEL
    }).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.message) || '文案生成失敗（若尚未部署多圖後端，屬預期）');
      }
      var d = res.data || {};
      applyCopyToForm(d);
      var names = state.images.map(function (im) { return im.name; }).join('、');
      var entry = {
        id: uid('copy'),
        ts: Date.now(),
        postType: $('post-type').value,
        tone: $('tone').value.trim(),
        photoCount: state.images.length,
        photoSummary: names.slice(0, 120),
        headline: d.headline || '',
        body: d.body || '',
        hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
        cta: d.cta || '',
        image_notes: d.image_notes || ''
      };
      pushCopyHistory(entry);
      saveDraft({ silent: true });
      showOk('文案已生成，已自動存草稿與版本紀錄（共 ' + state.images.length + ' 張圖）');
    }).catch(function (e) {
      showError(e.message || String(e));
    }).then(function () {
      setBusy(btn, false);
    });
  }

  function applyEditResult(im, source, res, instruction) {
    var img = res.image || {};
    var b64 = img.dataBase64 || img.data_base64;
    if (!b64) throw new Error('後端未回傳圖片資料');
    var mime = img.mimeType || img.mime_type || 'image/png';
    var preview = 'data:' + mime + ';base64,' + b64;
    var version = {
      id: 'v' + im.versions.length,
      preview: preview,
      data_base64: b64,
      mime_type: mime,
      instruction: instruction,
      note: res.note || ''
    };
    im.versions.push(version);
    im.selectedVersionId = version.id;
    im.currentEdit = version;
    im.working = {
      data_base64: b64,
      mime_type: mime,
      preview: preview,
      name: version.id
    };
    return { source: source, version: version, note: res.note || '' };
  }

  function editOneImage(im, instruction, aspect, referencePhoto) {
    var source = im.working || im.original;
    var payload = {
      photo: photoPayload(source),
      instruction: instruction,
      model: CFG.IMAGE_MODEL
    };
    if (aspect) payload.aspect_ratio = aspect;
    if (referencePhoto && (referencePhoto.data_base64 || referencePhoto.dataBase64)) {
      payload.reference_photo = photoPayload(referencePhoto);
    }
    return postGas('fb_post_edit_image', payload).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.message) || ('改圖失敗：' + (im.name || im.id)));
      }
      return applyEditResult(im, source, res, instruction);
    });
  }

  function handleEditImage() {
    hideError();
    var instruction = ($('edit-instruction').value || '').trim() || composeInstruction();
    if (!instruction) {
      showError('請選擇標籤或填寫改圖指令');
      return;
    }
    $('edit-instruction').value = instruction;

    var scope = $('edit-scope').value;
    var targets = scope === 'batch'
      ? getBatchImages(true)
      : (getSelectedImage() ? [getSelectedImage()] : []);
    if (!targets.length) {
      showError(scope === 'batch'
        ? '請先在縮圖勾選要批次的圖（或按「全選批次」）'
        : '請先選中一張圖');
      return;
    }

    var useConsistent = !($('edit-consistent-batch') && !$('edit-consistent-batch').checked);
    if (targets.length > 1 && useConsistent && instruction.indexOf('【整組一致】') < 0) {
      instruction = instruction.replace(/\s*$/, '');
      if (instruction && instruction.charAt(instruction.length - 1) !== '。') instruction += '。';
      instruction += BATCH_CONSISTENCY_SUFFIX_;
      $('edit-instruction').value = instruction;
    }

    var btn = $('btn-edit-image');
    var btnIdleHtml = '<i class="fa-solid fa-images"></i> 執行改圖';
    var aspect = $('edit-aspect').value;
    var i = 0;
    var styleReference = null;
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 改圖中 0/' + targets.length + '…');

    function next() {
      if (i >= targets.length) {
        setBusy(btn, false, null, btnIdleHtml);
        selectImage(state.selectedId);
        renderThumbs();
        showOk('改圖完成（' + targets.length + ' 張）');
        return;
      }
      var im = targets[i];
      setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 改圖中 ' + (i + 1) + '/' + targets.length + '…');
      editOneImage(im, instruction, aspect, styleReference).then(function (result) {
        if (useConsistent && targets.length > 1 && !styleReference && result.version) {
          styleReference = {
            data_base64: result.version.data_base64,
            mime_type: result.version.mime_type
          };
        }
        if (im.id === state.selectedId) {
          setPreviewEl($('compare-before'), result.source);
          setPreviewEl($('compare-after'), result.version);
          $('edit-note').textContent = result.note || '改圖完成';
          renderVersions();
        }
        i += 1;
        setTimeout(next, 400);
      }).catch(function (e) {
        setBusy(btn, false, null, btnIdleHtml);
        showError((e.message || String(e)) + '（已完成 ' + i + '/' + targets.length + '）');
        selectImage(state.selectedId);
      });
    }
    next();
  }

  function blobToPhotoPayload(blob, name) {
    return new Promise(function (resolve, reject) {
      if (!blob) {
        reject(new Error('無法匯出圖片'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        resolve({
          data_base64: dataUrl.split(',')[1],
          mime_type: blob.type || 'image/jpeg',
          preview: dataUrl,
          name: name || 'export.jpg'
        });
      };
      reader.onerror = function () { reject(new Error('讀取匯出圖失敗')); };
      reader.readAsDataURL(blob);
    });
  }

  function exportCurrentCanvasPhoto(name) {
    redrawCanvas();
    return canvasToBlob($('edit-canvas')).then(function (blob) {
      return blobToPhotoPayload(blob, name);
    });
  }

  function applyLogoToAll() {
    if (!state.logoImg) {
      showError('請先載入 LOGO（內建或上傳）');
      return;
    }
    if ($('logo-enabled').value !== '1') {
      showError('請先將「顯示 LOGO」設為「是」');
      return;
    }
    if (!state.images.length) {
      showError('尚無圖片');
      return;
    }
    var btn = $('btn-logo-all');
    var savedSelected = state.selectedId;
    var idx = 0;
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 套用中…');
    hideError();

    function step() {
      if (idx >= state.images.length) {
        if (savedSelected) selectImage(savedSelected);
        renderThumbs();
        setBusy(btn, false, null, '<i class="fa-solid fa-stamp"></i> 一鍵全部加上 LOGO');
        showOk('已為全部 ' + state.images.length + ' 張圖加上 LOGO（含精修設定）');
        return;
      }
      var im = state.images[idx];
      var photo = im.adopted || im.currentEdit || im.original;
      state.selectedId = im.id;
      loadImageFromPhoto(photo).then(function (img) {
        state.sourceImg = img;
        return exportCurrentCanvasPhoto(im.name || ('img-' + (idx + 1)));
      }).then(function (baked) {
        im.adopted = baked;
        flashAdoptedThumb(im.id);
        idx += 1;
        setTimeout(step, 100);
      }).catch(function () {
        idx += 1;
        setTimeout(step, 100);
      });
    }
    step();
  }

  function handleCopyText() {
    var text = buildCopyClipboardText();
    if (!text.trim()) {
      showError('尚無文案可複製');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showOk('已複製到剪貼簿');
      }).catch(function () {
        window.prompt('請手動複製：', text);
      });
    } else {
      window.prompt('請手動複製：', text);
    }
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', 0.92);
    });
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function handleDownload() {
    if (!state.sourceImg) {
      showError('請先採用一張圖再下載');
      return;
    }
    redrawCanvas();
    canvasToBlob($('edit-canvas')).then(function (blob) {
      if (!blob) {
        showError('無法匯出 JPG');
        return;
      }
      var im = getSelectedImage();
      var name = 'fb-post-' + new Date().toISOString().slice(0, 10) +
        (im ? '-' + (im.name || '').replace(/\.[^.]+$/, '') : '') + '.jpg';
      downloadBlob(blob, name);
      showOk('已開始下載 JPG');
    });
  }

  function handleDownloadAll() {
    if (!state.images.length) {
      showError('尚無圖片');
      return;
    }
    var btn = $('btn-download-all');
    setBusy(btn, true, '匯出中…');
    var list = state.images.slice();
    var idx = 0;
    var savedSelected = state.selectedId;
    var savedSource = state.sourceImg;

    function finish() {
      state.selectedId = savedSelected;
      state.sourceImg = savedSource;
      if (savedSource) redrawCanvas();
      setBusy(btn, false);
      showOk('已開始下載 ' + list.length + ' 張成品（請允許多檔下載）');
    }

    function step() {
      if (idx >= list.length) {
        finish();
        return;
      }
      var im = list[idx];
      var photo = im.adopted || (im.currentEdit) || im.original;
      state.selectedId = im.id;
      loadImageFromPhoto(photo).then(function (img) {
        state.sourceImg = img;
        redrawCanvas();
        return canvasToBlob($('edit-canvas'));
      }).then(function (blob) {
        if (blob) {
          downloadBlob(blob, 'fb-post-' + (idx + 1) + '-' +
            (im.name || 'img').replace(/\.[^.]+$/, '') + '.jpg');
        }
        idx += 1;
        setTimeout(step, 350);
      }).catch(function () {
        idx += 1;
        setTimeout(step, 200);
      });
    }
    step();
  }

  function saveDraft(opts) {
    opts = opts || {};
    try {
      var projectCode = $('import-project-code') ? $('import-project-code').value.trim() : '';
      var draft = {
        postType: $('post-type').value,
        tone: $('tone').value,
        extraNotes: $('extra-notes').value,
        headline: $('copy-headline').value,
        body: $('copy-body').value,
        hashtags: $('copy-hashtags').value,
        cta: $('copy-cta').value,
        imageNotes: $('copy-image-notes').value,
        instruction: $('edit-instruction').value,
        freeText: $('edit-free-text').value,
        aspect: $('edit-aspect').value,
        refine: state.refine,
        crop: state.crop,
        logoPos: $('logo-pos').value,
        logoScale: $('logo-scale').value,
        logoOpacity: $('logo-opacity').value,
        logoEnabled: $('logo-enabled').value,
        tagIds: state.tagIds,
        wizardStep: state.wizardStep,
        lastProjectCode: projectCode || state.siteImport.projectCode || '',
        lastImportedPaths: state.lastImportedPaths || [],
        siteImportSnapshot: {
          projectCode: projectCode || state.siteImport.projectCode || '',
          mediaType: state.siteImport.mediaType || 'image'
        },
        imagesMeta: state.images.map(function (im) {
          return { id: im.id, name: im.name };
        })
      };
      localStorage.setItem(CFG.STORAGE_KEY + '_draft', JSON.stringify(draft));
      if (!opts.silent) {
        showOk('草稿已儲存（文案／精修／標籤；多圖本體請重新上傳）');
      }
    } catch (e) {
      if (!opts.silent) showError('草稿儲存失敗：' + (e.message || e));
    }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY + '_draft');
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.postType) $('post-type').value = d.postType;
      if (d.tone != null) $('tone').value = d.tone;
      if (d.extraNotes != null) $('extra-notes').value = d.extraNotes;
      if (d.headline != null) $('copy-headline').value = d.headline;
      if (d.body != null) $('copy-body').value = d.body;
      if (d.hashtags != null) $('copy-hashtags').value = d.hashtags;
      if (d.cta != null) $('copy-cta').value = d.cta;
      if (d.imageNotes != null) $('copy-image-notes').value = d.imageNotes;
      if (d.instruction != null) $('edit-instruction').value = d.instruction;
      if (d.freeText != null) $('edit-free-text').value = d.freeText;
      if (d.aspect != null) $('edit-aspect').value = d.aspect;
      if (d.refine) state.refine = Object.assign(defaultRefine(), d.refine);
      if (d.crop) state.crop = d.crop;
      if (d.logoPos) $('logo-pos').value = d.logoPos;
      if (d.logoScale) $('logo-scale').value = d.logoScale;
      if (d.logoOpacity) $('logo-opacity').value = d.logoOpacity;
      if (d.logoEnabled != null) $('logo-enabled').value = d.logoEnabled;
      if (d.tagIds) state.tagIds = normalizeTagIds(d.tagIds);
      syncRefineSlidersFromState();
      syncTagsPreview();
      document.querySelectorAll('[data-crop]').forEach(function (chip) {
        chip.classList.toggle('active', chip.getAttribute('data-crop') === state.crop);
      });
      renderAllTags();
      renderFilterPresets();
      if (d.instruction) $('instr-manual-lock').checked = true;
      if (d.wizardStep) state.wizardStep = d.wizardStep;
      if (Array.isArray(d.lastImportedPaths) && d.lastImportedPaths.length) {
        state.lastImportedPaths = d.lastImportedPaths.slice();
        if (!state.images.length) {
          state.siteImport.restorePaths = d.lastImportedPaths.slice();
        }
      }
      if (d.lastProjectCode && $('import-project-code') && !$('import-project-code').value.trim()) {
        $('import-project-code').value = d.lastProjectCode;
      }
      if (d.siteImportSnapshot) {
        if (d.siteImportSnapshot.projectCode) {
          state.siteImport.projectCode = d.siteImportSnapshot.projectCode;
        }
        if (d.siteImportSnapshot.mediaType) {
          state.siteImport.mediaType = d.siteImportSnapshot.mediaType;
          if ($('import-media-type')) $('import-media-type').value = d.siteImportSnapshot.mediaType;
        }
      }
    } catch (e0) {}
  }

  /* ---------- upload ---------- */

  function bindUpload() {
    var zone = $('upload-zone');
    var input = $('input-photo');
    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('drag');
    });
    zone.addEventListener('dragleave', function () { zone.classList.remove('drag'); });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('drag');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) processFiles(files);
    });
    input.addEventListener('change', function () {
      if (input.files && input.files.length) processFiles(input.files);
      input.value = '';
    });
  }

  function processFiles(fileList) {
    hideError();
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && f.type && f.type.indexOf('image/') === 0;
    });
    if (!files.length) {
      showError('請選擇圖片檔（不支援 .ai）');
      return;
    }
    var chain = Promise.resolve([]);
    files.forEach(function (f) {
      chain = chain.then(function (acc) {
        return resizeImageFile(f).then(function (photo) {
          acc.push(photo);
          return acc;
        });
      });
    });
    chain.then(function (photos) {
      addPhotos(photos);
    }).catch(function (e) {
      showError(e.message || String(e));
    });
  }

  function bindUi() {
    $('btn-generate-copy').addEventListener('click', handleGenerateCopy);
    $('btn-edit-image').addEventListener('click', handleEditImage);
    $('btn-copy-text').addEventListener('click', handleCopyText);
    $('btn-open-fb').addEventListener('click', function () {
      window.open(CFG.FB_PAGE_URL || 'https://www.facebook.com/TainanTanXin', '_blank');
    });
    $('btn-clear-images').addEventListener('click', clearImages);
    $('btn-batch-all').addEventListener('click', function () {
      state.images.forEach(function (im) { im.batch = true; });
      if ($('edit-scope')) $('edit-scope').value = 'batch';
      renderThumbs();
      showOk('已全選批次（套用範圍已切為「批次：已勾選圖」）');
    });
    $('btn-batch-none').addEventListener('click', function () {
      state.images.forEach(function (im) { im.batch = false; });
      renderThumbs();
    });

    $('btn-adopt').addEventListener('click', function () {
      var im = getSelectedImage();
      if (!im) {
        showError('請先選中一張圖');
        return;
      }
      var v = im.versions.find(function (x) { return x.id === im.selectedVersionId; });
      if (!v) v = im.currentEdit || im.versions[im.versions.length - 1];
      if (!v) {
        showError('沒有可採用的版本');
        return;
      }
      adoptPhoto({
        data_base64: v.data_base64,
        mime_type: v.mime_type,
        preview: v.preview,
        name: v.id
      }, v.id === 'orig' ? '原圖' : '改圖版本');
    });

    $('btn-use-original').addEventListener('click', function () {
      var im = getSelectedImage();
      if (!im) {
        showError('尚無原圖');
        return;
      }
      adoptPhoto(im.original, '原圖');
    });

    $('btn-adopt-all-latest').addEventListener('click', function () {
      if (!state.images.length) {
        showError('尚無圖片');
        return;
      }
      state.images.forEach(function (im) {
        var v = im.currentEdit || im.versions[im.versions.length - 1] || im.original;
        im.adopted = {
          data_base64: v.data_base64 || im.original.data_base64,
          mime_type: v.mime_type || im.original.mime_type,
          preview: v.preview || im.original.preview,
          name: v.id || im.name
        };
      });
      var sel = getSelectedImage();
      if (sel && sel.adopted) adoptPhoto(sel.adopted, '最新版', true);
      renderThumbs();
      state.images.forEach(function (im) { flashAdoptedThumb(im.id); });
      showOk('全部圖已標記採用最新版（綠框＋✓）');
    });

    $('btn-download').addEventListener('click', handleDownload);
    $('btn-download-all').addEventListener('click', handleDownloadAll);
    $('btn-save-draft').addEventListener('click', saveDraft);
    if ($('btn-logo-all')) {
      $('btn-logo-all').addEventListener('click', applyLogoToAll);
    }
    if ($('btn-emoji-delete')) {
      $('btn-emoji-delete').addEventListener('click', removeSelectedEmoji);
    }
    if ($('btn-emoji-clear')) {
      $('btn-emoji-clear').addEventListener('click', clearEmojiOverlays);
    }
    if ($('emoji-size')) {
      $('emoji-size').addEventListener('input', function () {
        var selected = getSelectedEmojiOverlay();
        if (!selected) return;
        selected.size = parseInt($('emoji-size').value, 10) || CFG.EMOJI_DEFAULT_SIZE || 52;
        if ($('val-emoji-size')) $('val-emoji-size').textContent = String(selected.size);
        redrawCanvas();
      });
    }
    if ($('btn-sticker-upload')) {
      $('btn-sticker-upload').addEventListener('click', function () {
        $('input-sticker').click();
      });
    }
    if ($('btn-sticker-upload-png')) {
      $('btn-sticker-upload-png').addEventListener('click', function () {
        $('input-sticker').click();
      });
    }
    if ($('input-sticker')) {
      $('input-sticker').addEventListener('change', function () {
        var f = $('input-sticker').files && $('input-sticker').files[0];
        if (!f) return;
        handleStickerUpload(f);
        $('input-sticker').value = '';
      });
    }
    $('btn-save-settings').addEventListener('click', saveSettings);
    $('btn-reset-refine').addEventListener('click', resetRefine);
    $('btn-rot-90').addEventListener('click', function () {
      state.refine.rotate90 = (state.refine.rotate90 + 1) % 4;
      redrawCanvas();
    });
    $('btn-flip-h').addEventListener('click', function () {
      state.refine.flipH = !state.refine.flipH;
      redrawCanvas();
    });

    $('btn-ping').addEventListener('click', function () {
      var el = $('ping-status');
      el.textContent = '測試中…';
      el.className = 'status-line';
      postGas('fb_post_ping', {}).then(function (res) {
        if (res && res.success) {
          el.textContent = '連線 OK · ' + (res.image_model || '') + ' / ' + (res.copy_model || '');
          el.className = 'status-line ok';
          showOk('後端連線正常');
        } else {
          el.textContent = (res && res.message) || '失敗';
          el.className = 'status-line bad';
          showError((res && res.message) || 'ping 失敗');
        }
      }).catch(function (e) {
        el.textContent = e.message || String(e);
        el.className = 'status-line bad';
        showError(e.message || String(e));
      });
    });

    $('copy-hashtags').addEventListener('input', syncTagsPreview);
    $('edit-free-text').addEventListener('input', updateInstrPreview);
    $('instr-manual-lock').addEventListener('change', updateInstrPreview);

    [
      'adj-brightness', 'adj-contrast', 'adj-saturate', 'adj-sharpen',
      'adj-rotate', 'adj-vignette', 'adj-warm',
      'logo-scale', 'logo-opacity', 'logo-pos', 'logo-enabled'
    ].forEach(function (id) {
      $(id).addEventListener('input', redrawCanvas);
      $(id).addEventListener('change', redrawCanvas);
    });

    document.querySelectorAll('[data-crop]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-crop]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state.crop = chip.getAttribute('data-crop');
        redrawCanvas();
      });
    });

    $('btn-logo-default').addEventListener('click', function () {
      tryLoadDefaultLogo();
    });
    $('btn-logo-upload').addEventListener('click', function () {
      $('input-logo').click();
    });
    $('input-logo').addEventListener('change', function () {
      var f = $('input-logo').files && $('input-logo').files[0];
      if (!f) return;
      var name = (f.name || '').toLowerCase();
      if (name.endsWith('.ai')) {
        showError('不支援 .ai：請從 Illustrator 匯出透明 PNG 或 SVG 再上傳');
        $('input-logo').value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          state.logoImg = img;
          state.logoLabel = f.name;
          $('logo-status').textContent = '已載入自訂：' + f.name;
          $('logo-status').className = 'status-line ok';
          redrawCanvas();
        };
        img.onerror = function () { showError('自訂 LOGO 無法載入（請用 PNG／SVG）'); };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
      $('input-logo').value = '';
    });

    $('btn-wizard-prev').addEventListener('click', function () {
      setWizardStep(state.wizardStep - 1, { force: true });
    });
    $('btn-wizard-next').addEventListener('click', function () {
      if (state.wizardStep >= WIZARD_MAX) {
        setWizardStep(1, { force: true });
        return;
      }
      setWizardStep(state.wizardStep + 1);
    });
    document.querySelectorAll('[data-goto-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = parseInt(btn.getAttribute('data-goto-step'), 10);
        setWizardStep(n);
      });
    });
    [
      'copy-headline', 'copy-body', 'copy-cta', 'copy-hashtags'
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', function () {
        if (state.wizardStep === 4) updateFinishSummary();
      });
    });

    if ($('btn-go-reel')) {
      $('btn-go-reel').addEventListener('click', function () {
        setWizardStep(5);
      });
    }
    if ($('input-local-video')) {
      $('input-local-video').addEventListener('change', function () {
        var files = Array.prototype.slice.call($('input-local-video').files || []);
        state.localVideoNames = files.map(function (f) { return f.name; });
        var status = $('local-video-file-status');
        if (status) {
          status.textContent = files.length
            ? '已選 ' + files.length + ' 支：' + state.localVideoNames.join('、') + '。請在下方貼上完整路徑。'
            : '尚未選本機影片';
        }
      });
    }
    if ($('btn-add-local-videos')) {
      $('btn-add-local-videos').addEventListener('click', addLocalVideoPaths);
    }
    if ($('btn-download-work-order')) {
      $('btn-download-work-order').addEventListener('click', handleDownloadWorkOrder);
    }
    if ($('btn-copy-queue-path')) {
      $('btn-copy-queue-path').addEventListener('click', function () {
        copyPlainText(
          'D:\\Dropbox\\CodeBackups\\TanxinTools\\short-video-workflow\\queue\\',
          'queue 路徑已複製'
        );
      });
    }
    if ($('btn-copy-watch-command')) {
      $('btn-copy-watch-command').addEventListener('click', function () {
        copyPlainText(
          'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\\Dropbox\\CodeBackups\\TanxinTools\\short-video-workflow\\Watch-Queue.ps1" -Once',
          '收單指令已複製'
        );
      });
    }
    if ($('btn-reel-compose')) {
      $('btn-reel-compose').addEventListener('click', handleReelCompose);
    }
    if ($('btn-reel-download')) {
      $('btn-reel-download').addEventListener('click', handleReelDownload);
    }
    if ($('btn-reel-copy-caption')) {
      $('btn-reel-copy-caption').addEventListener('click', function () {
        if (typeof handleCopyText === 'function') handleCopyText();
        else showError('請先到步驟⑤準備文案');
      });
    }
    if ($('btn-reel-skip')) {
      $('btn-reel-skip').addEventListener('click', function () {
        setWizardStep(1, { force: true });
      });
    }
    if ($('reel-sec-per-slide') && $('val-reel-sec')) {
      $('reel-sec-per-slide').addEventListener('input', function () {
        $('val-reel-sec').textContent = $('reel-sec-per-slide').value;
      });
    }
    if ($('input-reel-audio')) {
      $('input-reel-audio').addEventListener('change', function () {
        var f = $('input-reel-audio').files && $('input-reel-audio').files[0];
        state.reelAudioBlob = f || null;
        var status = $('reel-audio-status');
        if (status) {
          status.textContent = f
            ? ('已選上傳音檔：' + f.name + '（合成時優先使用）')
            : '未上傳';
          status.className = 'status-line' + (f ? ' ok' : '');
        }
        if (f && $('reel-music-off')) $('reel-music-off').checked = false;
        stopReelBgmPreview(true);
        syncReelBgmPreviewButtons(false);
      });
    }
    if ($('reel-bgm')) {
      $('reel-bgm').addEventListener('change', function () {
        stopReelBgmPreview(true);
        updateReelBgmHint();
      });
    }
    if ($('btn-reel-bgm-preview')) {
      $('btn-reel-bgm-preview').addEventListener('click', handleReelBgmPreview);
    }
    if ($('btn-reel-bgm-preview-stop')) {
      $('btn-reel-bgm-preview-stop').addEventListener('click', function () {
        stopReelBgmPreview(false);
      });
    }
    if ($('reel-music-off')) {
      $('reel-music-off').addEventListener('change', function () {
        if ($('reel-music-off').checked) {
          if ($('reel-bgm')) $('reel-bgm').value = 'off';
          stopReelBgmPreview(true);
        }
        syncReelBgmPreviewButtons(false);
        updateReelBgmHint();
      });
    }
  }

  function init() {
    loadSettings();
    fillToneOptions();
    renderAllTags();
    renderFilterPresets();
    bindUpload();
    bindSiteImport();
    bindCanvasEmoji();
    bindUi();
    renderEmojiPalette();
    refreshStickers();
    syncTagsPreview();
    syncRefineSlidersFromState();
    renderCopyHistory();
    redrawCanvas();
    tryLoadDefaultLogo();
    loadDraft();
    updateCopyHint();
    setWizardStep(state.wizardStep || 1, { force: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
