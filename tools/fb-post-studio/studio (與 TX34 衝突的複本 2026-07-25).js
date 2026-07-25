/**
 * FB 發文工作室 — 前端邏輯（多圖／文案版本／標籤組合／精修強化）
 */
(function () {
  'use strict';

  var CFG = window.FB_POST_STUDIO_CONFIG || {};
  var DEFAULT_GAS = CFG.GAS_URL || '';
  var MAX_IMAGES = CFG.MAX_IMAGES || 10;
  var COPY_HISTORY_MAX = CFG.COPY_HISTORY_MAX || 40;

  var WIZARD_STEPS = [
    { n: 1, title: '選圖' },
    { n: 2, title: '寫文案' },
    { n: 3, title: 'AI 改圖' },
    { n: 4, title: '精修＋LOGO' },
    { n: 5, title: '完成' },
    { n: 6, title: '短影音' }
  ];
  var WIZARD_MAX = 6;

  var state = {
    images: [],
    selectedId: null,
    logoImg: null,
    logoLabel: '',
    crop: 'free',
    sourceImg: null,
    tagIds: emptyTagIds(),
    copyTagIds: emptyCopyTagIds(),
    refine: defaultRefine(),
    copyActiveId: null,
    wizardStep: 1,
    stickers: [],
    reelAudioBlob: null,
    reelLastUrl: null
  };

  function emptyTagIds() {
    return { prefixA: {}, prefixC: {}, middle: {}, suffix: {} };
  }

  function emptyCopyTagIds() {
    return { prefix: {}, middle: {}, suffix: {} };
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

  function showOk(msg) {
    var box = $('ok-box');
    box.textContent = msg;
    box.classList.add('show');
    hideError();
  }

  function setBusy(btn, busy, labelBusy, labelIdle) {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy && labelBusy) btn.dataset._label = btn.innerHTML;
    if (busy && labelBusy) btn.innerHTML = labelBusy;
    if (!busy && (labelIdle || btn.dataset._label)) {
      btn.innerHTML = labelIdle || btn.dataset._label;
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

  function getBatchImages() {
    var list = state.images.filter(function (im) { return im.batch; });
    return list.length ? list : (getSelectedImage() ? [getSelectedImage()] : []);
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
    } catch (e) {
      $('gas-url').value = DEFAULT_GAS;
    }
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
      devBypass: $('dev-bypass').checked
    }));
    showOk('設定已儲存');
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

  /* ---------- copy tags ---------- */

  function selectedCopyTagTexts(zone) {
    var tags = (CFG.COPY_TAGS && CFG.COPY_TAGS[zone]) || [];
    var picked = state.copyTagIds[zone] || {};
    return tags.filter(function (t) { return picked[t.id]; }).map(function (t) { return t.text; });
  }

  function selectedCopyTagLabels(zone) {
    var tags = (CFG.COPY_TAGS && CFG.COPY_TAGS[zone]) || [];
    var picked = state.copyTagIds[zone] || {};
    return tags.filter(function (t) { return picked[t.id]; }).map(function (t) { return t.label; });
  }

  function composeCopyTagsPayload() {
    return []
      .concat(selectedCopyTagTexts('prefix'))
      .concat(selectedCopyTagTexts('middle'))
      .concat(selectedCopyTagTexts('suffix'));
  }

  function composeCopyTagsSummary() {
    var labels = []
      .concat(selectedCopyTagLabels('prefix'))
      .concat(selectedCopyTagLabels('middle'))
      .concat(selectedCopyTagLabels('suffix'));
    return labels;
  }

  function updateCopyTagPreview() {
    var el = $('copy-tag-preview');
    if (!el) return;
    var labels = composeCopyTagsSummary();
    el.textContent = labels.length
      ? labels.join(' · ')
      : '（未選標籤＝預設活潑親切＋適度 emoji）';
  }

  function renderCopyTagZone(zone, elId) {
    var box = $(elId);
    if (!box) return;
    if (!state.copyTagIds[zone]) state.copyTagIds[zone] = {};
    box.innerHTML = '';
    var tags = (CFG.COPY_TAGS && CFG.COPY_TAGS[zone]) || [];
    tags.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.copyTagIds[zone][t.id] ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', function () {
        if (state.copyTagIds[zone][t.id]) delete state.copyTagIds[zone][t.id];
        else state.copyTagIds[zone][t.id] = true;
        btn.classList.toggle('active');
        updateCopyTagPreview();
      });
      box.appendChild(btn);
    });
  }

  function renderAllCopyTags() {
    renderCopyTagZone('prefix', 'copy-tag-prefix');
    renderCopyTagZone('middle', 'copy-tag-middle');
    renderCopyTagZone('suffix', 'copy-tag-suffix');
    updateCopyTagPreview();
  }

  function snapshotCopyTagIds() {
    return {
      prefix: Object.assign({}, state.copyTagIds.prefix || {}),
      middle: Object.assign({}, state.copyTagIds.middle || {}),
      suffix: Object.assign({}, state.copyTagIds.suffix || {})
    };
  }

  function applyCopyTagIds(raw) {
    state.copyTagIds = emptyCopyTagIds();
    if (!raw || typeof raw !== 'object') {
      renderAllCopyTags();
      return;
    }
    ['prefix', 'middle', 'suffix'].forEach(function (z) {
      if (raw[z] && typeof raw[z] === 'object') {
        state.copyTagIds[z] = Object.assign({}, raw[z]);
      }
    });
    renderAllCopyTags();
  }

  /* ---------- wizard ---------- */

  function wizardTitle(n) {
    var found = WIZARD_STEPS.filter(function (s) { return s.n === n; })[0];
    return found ? found.title : '';
  }

  function canEnterStep(n) {
    if (n <= 1) return { ok: true };
    if (!state.images.length) {
      return { ok: false, msg: '請先上傳至少一張圖，才能進入下一步' };
    }
    if (n >= 3 && n <= 4 && !state.selectedId) {
      return { ok: false, msg: '請先在圖庫點選一張圖，再進 AI 改圖／精修' };
    }
    if (n === 6) {
      var photos = getReelSourcePhotos();
      if (photos.length < 2) {
        return { ok: false, msg: '短影音至少需要 2 張圖（請先上傳並建議採用／精修）' };
      }
    }
    return { ok: true };
  }

  function countCopyChars() {
    var headline = ($('copy-headline') && $('copy-headline').value || '').trim();
    var body = ($('copy-body') && $('copy-body').value || '').trim();
    var cta = ($('copy-cta') && $('copy-cta').value || '').trim();
    var tags = ($('tags-preview') && $('tags-preview').textContent || '').trim();
    var full = [headline, body, cta, tags].filter(Boolean).join('\n\n');
    return {
      headline: headline.length,
      body: body.length,
      total: full.replace(/\s+/g, '').length,
      hasAny: !!(headline || body || cta)
    };
  }

  function hasLogoOrStickerOn() {
    var enabled = !$('logo-enabled') || $('logo-enabled').value === '1';
    return !!(enabled && state.logoImg);
  }

  function selectedImageDownloadReady() {
    var sel = getSelectedImage();
    if (!sel) return false;
    return !!(sel.adopted || sel.currentEdit || sel.original ||
      (sel.versions && sel.versions.length));
  }

  /**
   * 發前檢查（步驟 5 為主；可回傳跨步提示）
   * FB 友善字數：正文約 80～600 字較好滑；總長 >1200 提醒偏長；<20 過短。
   */
  function evaluatePreflight() {
    var skipLogo = $('preflight-skip-logo') && $('preflight-skip-logo').checked;
    var privacyOk = $('preflight-privacy-ok') && $('preflight-privacy-ok').checked;
    var forceOk = $('preflight-force-ok') && $('preflight-force-ok').checked;
    var chars = countCopyChars();
    var items = [];
    var blockers = 0;
    var warnings = 0;

    /* LOGO／貼圖 */
    if (hasLogoOrStickerOn()) {
      items.push({ id: 'logo', level: 'ok', text: '已加上 LOGO／貼圖（精修疊圖開啟中）' });
    } else if (skipLogo) {
      items.push({ id: 'logo', level: 'ok', text: '本次不加 LOGO／貼圖（已勾選）' });
    } else {
      blockers += 1;
      items.push({
        id: 'logo',
        level: 'bad',
        text: '尚未加 LOGO／貼圖：請回步驟 4 疊圖，或勾「本次不加」'
      });
    }

    /* 文案長度 */
    if (!chars.hasAny) {
      blockers += 1;
      items.push({ id: 'copy', level: 'bad', text: '文案過空：請回步驟 2 生成或填寫標題／正文' });
    } else if (chars.total < 20) {
      warnings += 1;
      items.push({
        id: 'copy',
        level: 'warn',
        text: '文案偏短（約 ' + chars.total + ' 字）：粉專建議至少一小段正文＋CTA（約 80 字以上較好）'
      });
    } else if (chars.total > 1200) {
      warnings += 1;
      items.push({
        id: 'copy',
        level: 'warn',
        text: '文案偏長（約 ' + chars.total + ' 字）：FB 可發，但滑動閱讀較吃力，建議壓到約 600 字內'
      });
    } else if (chars.body > 0 && chars.body < 40) {
      warnings += 1;
      items.push({
        id: 'copy',
        level: 'warn',
        text: '正文偏短（' + chars.body + ' 字）：可再補空間亮點或 CTA（理想約 80～600 字）'
      });
    } else {
      items.push({
        id: 'copy',
        level: 'ok',
        text: '文案長度 OK（約 ' + chars.total + ' 字；粉專友善約 80～600 字）'
      });
    }

    /* 個資提醒（人工確認） */
    if (privacyOk) {
      items.push({
        id: 'privacy',
        level: 'ok',
        text: '已確認無門牌／真人臉／全名電話等個資（或已遮）'
      });
    } else {
      blockers += 1;
      items.push({
        id: 'privacy',
        level: 'bad',
        text: '個資提醒：請目視圖與文是否含門牌、真人臉、客戶全名／電話／地址，確認後勾選'
      });
    }

    /* 主圖可下載 */
    if (selectedImageDownloadReady()) {
      items.push({
        id: 'download',
        level: 'ok',
        text: '選中圖可下載（採用／改圖／原圖其中之一就緒）'
      });
    } else if (state.images.length) {
      warnings += 1;
      items.push({
        id: 'download',
        level: 'warn',
        text: '請先在圖庫點選一張圖，再下載目前 JPG（或用「下載全部」）'
      });
    } else {
      blockers += 1;
      items.push({ id: 'download', level: 'bad', text: '尚無圖片可下載：請回步驟 1 上傳' });
    }

    var softReady = blockers === 0;
    var ready = softReady || forceOk;
    return {
      items: items,
      blockers: blockers,
      warnings: warnings,
      softReady: softReady,
      ready: ready,
      forceOk: forceOk,
      crossHints: buildCrossStepHints(items)
    };
  }

  function buildCrossStepHints(items) {
    var hints = [];
    items.forEach(function (it) {
      if (it.level === 'ok') return;
      if (it.id === 'logo') hints.push('步驟 4：疊 LOGO／貼圖，或完成頁勾「本次不加」');
      if (it.id === 'copy') hints.push('步驟 2：補文案長度或重生成');
      if (it.id === 'privacy') hints.push('步驟 3／4：去人物隱私或遮門牌後再確認');
      if (it.id === 'download') hints.push('步驟 1／3：選圖並採用後再下載');
    });
    return hints;
  }

  function renderPreflight() {
    var result = evaluatePreflight();
    var list = $('preflight-list');
    var status = $('preflight-status');
    var cta = $('finish-cta');
    var hint = $('finish-cta-hint');
    if (list) {
      list.innerHTML = '';
      result.items.forEach(function (it) {
        var li = document.createElement('li');
        li.className = it.level;
        var mark = it.level === 'ok' ? '✓' : (it.level === 'warn' ? '!' : '×');
        li.innerHTML = '<span class="mark">' + mark + '</span><span>' + it.text + '</span>';
        list.appendChild(li);
      });
    }
    if (status) {
      if (result.softReady) {
        status.className = 'preflight-status ready';
        status.textContent = result.warnings
          ? '檢查通過（仍有 ' + result.warnings + ' 則提醒）。可放心複製／下載。'
          : '全部通過。下方複製文案／下載為主要操作。';
      } else if (result.forceOk) {
        status.className = 'preflight-status ready';
        status.textContent = '你已勾「仍要複製／下載」。請自行確認風險後操作。';
      } else {
        status.className = 'preflight-status blocked';
        status.textContent = '尚有 ' + result.blockers + ' 項未通過' +
          (result.crossHints.length ? ' → ' + result.crossHints[0] : '') +
          '。通過或勾「仍要…」後，下方會強調為主要 CTA。';
      }
    }
    if (cta) {
      cta.classList.toggle('dimmed', !result.ready);
      cta.classList.toggle('ready', !!result.ready);
    }
    if (hint) {
      hint.textContent = result.ready
        ? '發前檢查 OK：請優先「一鍵複製貼文」與「下載目前 JPG」，再到粉專貼上。'
        : '通過發前檢查（或勾「仍要複製／下載」）後，下方會成為主要操作。';
    }
    /* CTA 強調：通過時複製改 primary、下載維持 primary */
    var btnCopy = $('btn-copy-text');
    if (btnCopy) {
      btnCopy.className = 'btn ' + (result.ready ? 'btn-primary' : 'btn-secondary');
    }
    return result;
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
    parts.push('<strong>LOGO</strong>：' + (hasLogoOrStickerOn() ? '已疊加' : '未疊加'));
    parts.push('建議：先過發前檢查 → 複製貼文 → 開粉專；下載 JPG 一併上傳。');
    el.innerHTML = parts.join('<br>');
    renderPreflight();
  }

  function setWizardStep(n, opts) {
    opts = opts || {};
    var prev = state.wizardStep;
    n = Math.max(1, Math.min(WIZARD_MAX, n | 0));
    if (!opts.force) {
      var gate = canEnterStep(n);
      if (!gate.ok) {
        showError(gate.msg);
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
      else if (n === 5) $('btn-wizard-next').textContent = '下一步（短影音）';
      else $('btn-wizard-next').textContent = '下一步';
    }
    syncThumbStrip();
    if (n === 4) redrawCanvas();
    if (n === 5) updateFinishSummary();
    if (n === 6) refreshReelHint();
    if (prev === 4 && n === 5 && !hasLogoOrStickerOn()) {
      showOk('提醒：尚未疊 LOGO／貼圖。可勾「本次不加」，或回步驟 4 疊圖。');
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
      var tagLabels = Array.isArray(item.copyTagLabels) ? item.copyTagLabels.join('·') : '';
      div.innerHTML =
        '<div class="meta">' + when + ' · ' + (item.postType || '') + ' · ' + (item.tone || '') +
        ' · ' + (item.photoCount || 0) + ' 圖' +
        (tagLabels ? ' · 標籤:' + tagLabels : '') + '</div>' +
        '<div class="snip">' + (snip || '（無正文）') + '</div>' +
        '<div class="copy-hist-actions">' +
        '<button type="button" data-act="restore">還原</button>' +
        '<button type="button" data-act="copy">複製</button>' +
        '<button type="button" data-act="del">刪除</button>' +
        '</div>';
      div.querySelector('[data-act="restore"]').addEventListener('click', function (e) {
        e.stopPropagation();
        applyCopyToForm(item);
        if (item.copyTagIds) applyCopyTagIds(item.copyTagIds);
        state.copyActiveId = item.id;
        renderCopyHistory();
        showOk('已還原此版文案');
      });
      div.querySelector('[data-act="copy"]').addEventListener('click', function (e) {
        e.stopPropagation();
        applyCopyToForm(item);
        if (item.copyTagIds) applyCopyTagIds(item.copyTagIds);
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
        if (item.copyTagIds) applyCopyTagIds(item.copyTagIds);
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
      batch: false
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

  function renderThumbs() {
    var grid = $('thumb-grid');
    grid.innerHTML = '';
    state.images.forEach(function (im, idx) {
      var div = document.createElement('div');
      div.className = 'thumb' +
        (im.id === state.selectedId ? ' selected' : '') +
        (im.batch ? ' batch-on' : '');
      div.innerHTML =
        '<span class="badge">' + (idx + 1) + '</span>' +
        '<button type="button" class="rm" title="移除">&times;</button>' +
        '<img alt="" src="' + (im.original.preview || '') + '">';
      div.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('rm')) return;
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
        showOk('已採用' + (label || '圖片') + '，可到「精修＋LOGO」調整');
        setWizardStep(4, { force: true });
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
    var copyTags = composeCopyTagsPayload();
    var copyTagLabels = composeCopyTagsSummary();
    postGas('fb_post_generate', {
      photos: photos,
      photo: photos[0],
      post_type: $('post-type').value,
      tone: $('tone').value.trim(),
      extra_notes: $('extra-notes').value.trim(),
      copy_tags: copyTags,
      model: CFG.COPY_MODEL
    }).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.message) || '文案生成失敗（若尚未部署多圖／標籤後端，屬預期）');
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
        image_notes: d.image_notes || '',
        copyTags: copyTags.slice(),
        copyTagLabels: copyTagLabels.slice(),
        copyTagIds: snapshotCopyTagIds()
      };
      pushCopyHistory(entry);
      showOk('文案已生成並存入本機版本（共 ' + state.images.length + ' 張圖' +
        (copyTagLabels.length ? '；標籤 ' + copyTagLabels.length + ' 個' : '') + '）');
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

  function editOneImage(im, instruction, aspect) {
    var source = im.working || im.original;
    var payload = {
      photo: photoPayload(source),
      instruction: instruction,
      model: CFG.IMAGE_MODEL
    };
    if (aspect) payload.aspect_ratio = aspect;
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
    var targets = scope === 'batch' ? getBatchImages() : (getSelectedImage() ? [getSelectedImage()] : []);
    if (!targets.length) {
      showError('請先選中或勾選要改的圖');
      return;
    }

    var btn = $('btn-edit-image');
    var aspect = $('edit-aspect').value;
    var i = 0;
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 改圖中 0/' + targets.length + '…');

    function next() {
      if (i >= targets.length) {
        setBusy(btn, false);
        selectImage(state.selectedId);
        showOk('改圖完成（' + targets.length + ' 張）');
        return;
      }
      var im = targets[i];
      setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 改圖中 ' + (i + 1) + '/' + targets.length + '…');
      editOneImage(im, instruction, aspect).then(function (result) {
        if (im.id === state.selectedId) {
          setPreviewEl($('compare-before'), result.source);
          setPreviewEl($('compare-after'), result.version);
          $('edit-note').textContent = result.note || '改圖完成';
          renderVersions();
        }
        i += 1;
        // 小間隔，避免連續打爆 GAS
        setTimeout(next, 400);
      }).catch(function (e) {
        setBusy(btn, false);
        showError((e.message || String(e)) + '（已完成 ' + i + '/' + targets.length + '）');
        selectImage(state.selectedId);
      });
    }
    next();
  }

  function guardPreflightOrWarn() {
    var result = renderPreflight();
    if (result.ready) return true;
    showError('發前檢查尚未通過：請先處理清單項目，或勾「仍有提醒，但我確認可以複製／下載」。');
    return false;
  }

  function handleCopyText() {
    if (state.wizardStep === 5 && !guardPreflightOrWarn()) return;
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
    if (state.wizardStep === 5 && !guardPreflightOrWarn()) return;
    if (!state.sourceImg) {
      showError('請先採用一張圖再下載（步驟 3「採用此圖」或步驟 4 精修）');
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
    if (state.wizardStep === 5 && !guardPreflightOrWarn()) return;
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

  function saveDraft() {
    try {
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
        copyTagIds: snapshotCopyTagIds(),
        wizardStep: state.wizardStep,
        imagesMeta: state.images.map(function (im) {
          return { id: im.id, name: im.name };
        })
      };
      localStorage.setItem(CFG.STORAGE_KEY + '_draft', JSON.stringify(draft));
      showOk('草稿已儲存（文案／精修／標籤；多圖本體請重新上傳）');
    } catch (e) {
      showError('草稿儲存失敗：' + (e.message || e));
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
      if (d.copyTagIds) applyCopyTagIds(d.copyTagIds);
      else renderAllCopyTags();
      syncRefineSlidersFromState();
      syncTagsPreview();
      document.querySelectorAll('[data-crop]').forEach(function (chip) {
        chip.classList.toggle('active', chip.getAttribute('data-crop') === state.crop);
      });
      renderAllTags();
      renderFilterPresets();
      if (d.instruction) $('instr-manual-lock').checked = true;
      if (d.wizardStep) state.wizardStep = d.wizardStep;
    } catch (e0) {}
  }

  /* ---------- stickers + reel helpers ---------- */

  function getReelSourcePhotos() {
    return state.images.map(function (im) {
      return im.adopted || im.currentEdit || (im.versions && im.versions[im.versions.length - 1]) || im.original;
    }).filter(Boolean);
  }

  function refreshReelHint() {
    var el = $('reel-source-hint');
    if (!el) return;
    var photos = getReelSourcePhotos();
    var adopted = state.images.filter(function (im) { return im.adopted; }).length;
    el.textContent = '可用圖 ' + photos.length + ' 張（其中已採用 ' + adopted +
      '）。建議 2～10 張；不足會無法合成。';
  }

  function fillReelBgmOptions() {
    var sel = $('reel-bgm');
    if (!sel) return;
    sel.innerHTML = '';
    var presets = (CFG.REEL && CFG.REEL.BGM_PRESETS) || [
      { id: 'off', label: '無音樂' },
      { id: 'soft', label: '輕柔氛圍（內建）' }
    ];
    presets.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.label;
      sel.appendChild(o);
    });
    sel.value = 'soft';
  }

  function renderStickerGrid() {
    var box = $('sticker-grid');
    var status = $('sticker-status');
    if (!box) return;
    box.innerHTML = '';
    var list = state.stickers || [];
    if (status) {
      status.textContent = list.length ? ('本機素材 ' + list.length + ' 筆') : '尚無素材，請上傳轉換';
      status.className = 'status-line' + (list.length ? ' ok' : '');
    }
    list.forEach(function (item) {
      var wrap = document.createElement('div');
      wrap.className = 'thumb';
      wrap.title = (item.category || '') + ' · ' + (item.name || '');
      wrap.innerHTML =
        '<img alt="sticker" src="' + item.preview + '">' +
        '<span class="badge">' + (item.category || '貼圖') + '</span>' +
        '<button type="button" class="rm" title="刪除">×</button>';
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
      wrap.addEventListener('click', function () {
        applyStickerAsLogo(item);
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
    }).catch(function (e) {
      if ($('sticker-status')) {
        $('sticker-status').textContent = e.message || String(e);
        $('sticker-status').className = 'status-line bad';
      }
    });
  }

  function applyStickerAsLogo(item) {
    if (!item || !item.preview) return;
    var api = window.FbPostStickers;
    var loader = api && api.loadImageFromUrl
      ? api.loadImageFromUrl(item.preview)
      : loadImageFromPhoto({ preview: item.preview });
    loader.then(function (img) {
      state.logoImg = img;
      state.logoLabel = (item.category || '貼圖') + '／' + (item.name || 'sticker');
      if ($('logo-status')) {
        $('logo-status').textContent = '已套用素材：' + state.logoLabel;
        $('logo-status').className = 'status-line ok';
      }
      if ($('logo-enabled')) $('logo-enabled').value = '1';
      redrawCanvas();
      showOk('已套用貼圖為 LOGO／疊圖');
    }).catch(function (e) {
      showError(e.message || String(e));
    });
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

  function handleLogoFile(file) {
    if (!file) return;
    var name = (file.name || '').toLowerCase();
    var needsConvert = name.endsWith('.ai') || name.endsWith('.pdf') ||
      (file.type || '') === 'application/pdf';
    var api = window.FbPostStickers;
    hideConvertFailGuide('logo');

    function setFromDataUrl(dataUrl, label, note) {
      var img = new Image();
      img.onload = function () {
        state.logoImg = img;
        state.logoLabel = label || file.name;
        $('logo-status').textContent = '已載入：' + state.logoLabel + (note ? '（' + note + '）' : '');
        $('logo-status').className = 'status-line ok';
        if ($('logo-enabled')) $('logo-enabled').value = '1';
        redrawCanvas();
        showOk(note || 'LOGO 已載入');
        if (state.wizardStep === 5) renderPreflight();
      };
      img.onerror = function () { showError('LOGO 無法載入'); };
      img.src = dataUrl;
    }

    if (needsConvert) {
      if (!api) {
        showConvertFailGuide('logo', '貼圖模組未載入');
        return;
      }
      $('logo-status').textContent = '轉換中…（.ai／PDF）';
      api.convertToTransparentPng(file).then(function (conv) {
        hideConvertFailGuide('logo');
        setFromDataUrl(conv.preview, file.name, conv.note);
      }).catch(function (e) {
        var msg = e.message || String(e);
        showConvertFailGuide('logo', msg);
        $('logo-status').textContent = '失敗 → 請改傳透明 PNG';
        $('logo-status').className = 'status-line bad';
      });
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      hideConvertFailGuide('logo');
      setFromDataUrl(reader.result, file.name, '');
    };
    reader.readAsDataURL(file);
  }

  function setReelProgress(pct, stageText, statusText) {
    var wrap = $('reel-progress-wrap');
    var bar = $('reel-progress-bar');
    var stage = $('reel-stage');
    var status = $('reel-status');
    if (wrap) {
      wrap.classList.add('show');
      wrap.setAttribute('aria-hidden', 'false');
    }
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct | 0)) + '%';
    if (stage) stage.textContent = stageText || '';
    if (status && statusText) {
      status.textContent = statusText;
      status.className = 'status-line';
    }
  }

  function hideReelProgress() {
    var wrap = $('reel-progress-wrap');
    if (wrap) {
      wrap.classList.remove('show');
      wrap.setAttribute('aria-hidden', 'true');
    }
  }

  function mapReelProgress(a, b, label) {
    var raw = String(label || '');
    var stage = '進行中';
    var pct = b > 0 ? Math.round((a / b) * 100) : 0;
    if (/載入|引擎|ffmpeg\.load|ensure|CDN|wasm/i.test(raw) || raw.indexOf('載入') >= 0) {
      stage = '① 載入引擎';
      pct = Math.max(5, Math.min(25, pct || 10));
    } else if (/渲染|拼片|影格|即時錄製/.test(raw)) {
      stage = '② 拼片／渲染';
      pct = 25 + Math.round((pct / 100) * 45);
    } else if (/編碼|ffmpeg|讀取成品/.test(raw)) {
      stage = '③ 編碼';
      pct = 70 + Math.round((pct / 100) * 25);
    } else if (/降級|WebM|改走/.test(raw)) {
      stage = '③′ 改走 WebM 降級（引擎不可用，仍可匯出）';
      pct = Math.max(40, pct);
    } else if (/完成|匯出/.test(raw)) {
      stage = '④ 完成';
      pct = 100;
    }
    setReelProgress(pct, stage + ' · ' + raw, stage + ' ' + a + '/' + b);
  }

  function handleReelExport() {
    hideError();
    var api = window.FbPostReel;
    if (!api || !api.composeReel) {
      showError('短影音模組未載入');
      return;
    }
    var photos = getReelSourcePhotos();
    var urls = photos.map(function (p) { return p.preview || dataUrlFromPhoto(p); }).filter(Boolean);
    var btn = $('btn-reel-export');
    var status = $('reel-status');
    var note = $('reel-fallback-note');
    if (note) note.style.display = 'none';
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 合成中…');
    setReelProgress(3, '① 載入引擎', '開始合成（請稍候，勿以為當掉）…');

    var musicOff = $('reel-music-off') && $('reel-music-off').checked;
    var bgm = ($('reel-bgm') && $('reel-bgm').value) || 'soft';
    var sec = parseFloat($('reel-sec') && $('reel-sec').value) || 2.4;

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
      var preview = $('reel-preview');
      if (preview) {
        preview.innerHTML = '<video controls playsinline src="' + url +
          '" style="max-width:100%;max-height:360px;display:block;margin:0 auto"></video>';
      }
      downloadBlob(result.blob, 'fb-reel-' + Date.now() + '.' + (result.ext || 'mp4'));
      setReelProgress(100, '④ 完成', result.note || '匯出完成');
      if (status) status.className = 'status-line ok';
      if (result.fallback && note) {
        note.style.display = 'block';
        note.textContent =
          '已自動降級為 WebM（引擎／CDN 不可用時的備援）。' +
          '粉專有時較愛 MP4：可換瀏覽器、確認可連 unpkg CDN 後再按「合成並匯出」重試。' +
          (result.note ? '（' + result.note + '）' : '');
      }
      showOk(result.fallback ? '已降級匯出 WebM（可下載；可再重試 MP4）' : '短影音 MP4 已匯出');
    }).catch(function (e) {
      if (status) {
        status.textContent = e.message || String(e);
        status.className = 'status-line bad';
      }
      if ($('reel-stage')) {
        $('reel-stage').textContent = '合成失敗 — 可減少張數／時長後重試，或檢查網路';
      }
      if (note) {
        note.style.display = 'block';
        note.textContent =
          '合成失敗：' + (e.message || String(e)) +
          '。建議：① 檢查網路／CDN ② 張數改 2～6、每張秒數調短 ③ 再按合成重試。' +
          '若曾看到「改走降級」但仍失敗，可換 Chrome／Edge 再試。';
      }
      showError(e.message || String(e));
    }).then(function () {
      setBusy(btn, false);
      setTimeout(hideReelProgress, 2500);
    });
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
      renderThumbs();
      showOk('已全選批次');
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
      if (sel && sel.adopted) adoptPhoto(sel.adopted, '最新版');
      showOk('全部圖已標記採用最新版（可用「下載全部成品」）');
    });

    $('btn-download').addEventListener('click', handleDownload);
    $('btn-download-all').addEventListener('click', handleDownloadAll);
    $('btn-save-draft').addEventListener('click', saveDraft);
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
      $(id).addEventListener('change', function () {
        redrawCanvas();
        if (id === 'logo-enabled' && state.wizardStep === 5) renderPreflight();
      });
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
    if ($('btn-logo-upload-png')) {
      $('btn-logo-upload-png').addEventListener('click', function () {
        $('input-logo').click();
      });
    }
    $('input-logo').addEventListener('change', function () {
      var f = $('input-logo').files && $('input-logo').files[0];
      if (!f) return;
      handleLogoFile(f);
      $('input-logo').value = '';
    });

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

    fillReelBgmOptions();
    if ($('input-reel-audio')) {
      $('input-reel-audio').addEventListener('change', function () {
        var f = $('input-reel-audio').files && $('input-reel-audio').files[0];
        if (!f) return;
        state.reelAudioBlob = f;
        if ($('reel-audio-status')) {
          $('reel-audio-status').textContent = '已選：' + f.name;
          $('reel-audio-status').className = 'status-line ok';
        }
        if ($('reel-music-off')) $('reel-music-off').checked = false;
      });
    }
    if ($('btn-reel-export')) {
      $('btn-reel-export').addEventListener('click', handleReelExport);
    }
    if ($('btn-reel-copy-caption')) {
      $('btn-reel-copy-caption').addEventListener('click', handleCopyText);
    }
    if ($('btn-reel-skip')) {
      $('btn-reel-skip').addEventListener('click', function () {
        showOk('已跳過短影音');
        setWizardStep(1, { force: true });
      });
    }
    if ($('reel-music-off')) {
      $('reel-music-off').addEventListener('change', function () {
        if ($('reel-music-off').checked && $('reel-bgm')) $('reel-bgm').value = 'off';
      });
    }

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
        if (state.wizardStep === 5) updateFinishSummary();
      });
    });

    [
      'preflight-skip-logo', 'preflight-privacy-ok', 'preflight-force-ok'
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', function () {
        renderPreflight();
        hideError();
      });
    });
  }

  function init() {
    loadSettings();
    fillToneOptions();
    renderAllTags();
    renderAllCopyTags();
    renderFilterPresets();
    bindUpload();
    bindUi();
    syncTagsPreview();
    syncRefineSlidersFromState();
    renderCopyHistory();
    redrawCanvas();
    tryLoadDefaultLogo();
    loadDraft();
    updateCopyHint();
    refreshStickers();
    setWizardStep(state.wizardStep || 1, { force: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
