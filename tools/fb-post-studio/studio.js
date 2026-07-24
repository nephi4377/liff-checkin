/**
 * FB 發文工作室 — 前端邏輯
 */
(function () {
  'use strict';

  var CFG = window.FB_POST_STUDIO_CONFIG || {};
  var DEFAULT_GAS = CFG.GAS_URL || '';

  var state = {
    original: null,       // { data_base64, mime_type, preview, name }
    working: null,        // 目前改圖來源（原圖或上一版）
    currentEdit: null,    // 最新一次改圖結果
    versions: [],         // [{ id, preview, data_base64, mime_type, instruction, note }]
    selectedVersionId: null,
    adopted: null,        // 精修用圖
    logoImg: null,
    logoLabel: '',
    crop: 'free',
    sourceImg: null       // HTMLImageElement for canvas
  };

  function $(id) { return document.getElementById(id); }

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
    if (!url) {
      return Promise.reject(new Error('尚未設定 GAS URL'));
    }
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
          // 若仍過大，逐步降品質
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

  function photoPayload(photo) {
    return {
      data_base64: photo.data_base64,
      mime_type: photo.mime_type || 'image/jpeg',
      filename: photo.name || ''
    };
  }

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
  }

  function saveSettings() {
    localStorage.setItem(CFG.STORAGE_KEY + '_settings', JSON.stringify({
      gasUrl: $('gas-url').value.trim(),
      secret: $('ingest-secret').value.trim(),
      devBypass: $('dev-bypass').checked
    }));
    showOk('設定已儲存');
  }

  function renderPresets() {
    var grid = $('preset-grid');
    grid.innerHTML = '';
    (CFG.EDIT_PRESETS || []).forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.textContent = p.label;
      btn.addEventListener('click', function () {
        grid.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        $('edit-instruction').value = p.instruction;
      });
      grid.appendChild(btn);
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

  function onPhotoLoaded(photo) {
    state.original = photo;
    state.working = photo;
    state.currentEdit = null;
    state.versions = [{
      id: 'orig',
      preview: photo.preview,
      data_base64: photo.data_base64,
      mime_type: photo.mime_type,
      instruction: '（原圖）',
      note: ''
    }];
    state.selectedVersionId = 'orig';
    state.adopted = null;
    setPreviewEl($('orig-preview'), photo);
    setPreviewEl($('compare-before'), photo);
    setPreviewEl($('compare-after'), null, '尚未改圖');
    $('upload-meta').textContent = (photo.name || 'photo') + ' · ' +
      (photo.width || '?') + '×' + (photo.height || '?');
    renderVersions();
    $('edit-note').textContent = '';
  }

  function renderVersions() {
    var box = $('version-list');
    box.innerHTML = '';
    state.versions.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ver-btn' + (v.id === state.selectedVersionId ? ' active' : '');
      btn.title = v.instruction || v.id;
      btn.innerHTML = '<img alt="' + v.id + '" src="' + v.preview + '">';
      btn.addEventListener('click', function () {
        state.selectedVersionId = v.id;
        state.working = {
          data_base64: v.data_base64,
          mime_type: v.mime_type,
          preview: v.preview,
          name: v.id
        };
        if (v.id === 'orig') {
          state.currentEdit = null;
          setPreviewEl($('compare-before'), state.original);
          setPreviewEl($('compare-after'), null, '尚未改圖／已回退原圖');
        } else {
          state.currentEdit = v;
          setPreviewEl($('compare-before'), state.original);
          setPreviewEl($('compare-after'), v);
        }
        $('edit-note').textContent = v.note || v.instruction || '';
        renderVersions();
      });
      box.appendChild(btn);
    });
  }

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

  function redrawCanvas() {
    var canvas = $('edit-canvas');
    var ctx = canvas.getContext('2d');
    var img = state.sourceImg;
    if (!img) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1a2336';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('請先「採用此圖」或「採用原圖」', canvas.width / 2, canvas.height / 2);
      return;
    }

    var bright = parseInt($('adj-brightness').value, 10) || 0;
    var contrast = parseInt($('adj-contrast').value, 10) || 0;
    var saturate = parseInt($('adj-saturate').value, 10) || 0;
    $('val-brightness').textContent = String(bright);
    $('val-contrast').textContent = String(contrast);
    $('val-saturate').textContent = String(saturate);
    $('val-logo-scale').textContent = String($('logo-scale').value);
    $('val-logo-opacity').textContent = String($('logo-opacity').value);

    var rect = cropRect(img.naturalWidth || img.width, img.naturalHeight || img.height, state.crop);
    var outW = rect.sw;
    var outH = rect.sh;
    var maxSide = 1200;
    var scale = Math.min(1, maxSide / Math.max(outW, outH));
    canvas.width = Math.max(1, Math.round(outW * scale));
    canvas.height = Math.max(1, Math.round(outH * scale));

    ctx.filter = 'brightness(' + (100 + bright) + '%) contrast(' + (100 + contrast) +
      '%) saturate(' + (100 + saturate) + '%)';
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

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

  function adoptPhoto(photo, label) {
    if (!photo) {
      showError('沒有可採用的圖片');
      return;
    }
    state.adopted = photo;
    loadImageFromPhoto(photo).then(function (img) {
      state.sourceImg = img;
      redrawCanvas();
      showOk('已採用' + (label || '圖片') + '，可在右側精修');
    }).catch(function (e) {
      showError(e.message || String(e));
    });
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
      $('logo-status').textContent = '內建 LOGO 載入失敗，請上傳自訂 PNG';
      $('logo-status').className = 'status-line bad';
    });
  }

  function handleGenerateCopy() {
    hideError();
    if (!state.original) {
      showError('請先上傳原圖');
      return;
    }
    var btn = $('btn-generate-copy');
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 生成中…');
    postGas('fb_post_generate', {
      photo: photoPayload(state.original),
      post_type: $('post-type').value,
      tone: $('tone').value.trim(),
      extra_notes: $('extra-notes').value.trim(),
      model: CFG.COPY_MODEL
    }).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.message) || '文案生成失敗（若尚未部署後端，屬預期）');
      }
      var d = res.data || {};
      $('copy-headline').value = d.headline || '';
      $('copy-body').value = d.body || '';
      $('copy-cta').value = d.cta || '';
      $('copy-image-notes').value = d.image_notes || '';
      var tags = Array.isArray(d.hashtags) ? d.hashtags.join(' ') : '';
      $('copy-hashtags').value = tags;
      syncTagsPreview();
      showOk('文案已生成，可直接編輯後複製');
    }).catch(function (e) {
      showError(e.message || String(e));
    }).then(function () {
      setBusy(btn, false);
    });
  }

  function handleEditImage() {
    hideError();
    var source = state.working || state.original;
    if (!source) {
      showError('請先上傳原圖');
      return;
    }
    var instruction = $('edit-instruction').value.trim();
    if (!instruction) {
      showError('請選擇快捷預設或填寫改圖指令');
      return;
    }
    var btn = $('btn-edit-image');
    setBusy(btn, true, '<i class="fa-solid fa-spinner fa-spin"></i> 改圖中（約 1 次）…');
    var payload = {
      photo: photoPayload(source),
      instruction: instruction,
      model: CFG.IMAGE_MODEL
    };
    var aspect = $('edit-aspect').value;
    if (aspect) payload.aspect_ratio = aspect;

    postGas('fb_post_edit_image', payload).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.message) || '改圖失敗（若尚未部署後端，屬預期）');
      }
      var img = res.image || {};
      var b64 = img.dataBase64 || img.data_base64;
      if (!b64) throw new Error('後端未回傳圖片資料');
      var mime = img.mimeType || img.mime_type || 'image/png';
      var preview = 'data:' + mime + ';base64,' + b64;
      var version = {
        id: 'v' + (state.versions.length),
        preview: preview,
        data_base64: b64,
        mime_type: mime,
        instruction: instruction,
        note: res.note || ''
      };
      state.versions.push(version);
      state.selectedVersionId = version.id;
      state.currentEdit = version;
      state.working = {
        data_base64: b64,
        mime_type: mime,
        preview: preview,
        name: version.id
      };
      setPreviewEl($('compare-before'), source);
      setPreviewEl($('compare-after'), version);
      $('edit-note').textContent = res.note || '改圖完成，可繼續迭代或採用此圖';
      renderVersions();
      showOk('改圖完成（可再下指令繼續改）');
    }).catch(function (e) {
      showError(e.message || String(e));
    }).then(function () {
      setBusy(btn, false);
    });
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

  function handleDownload() {
    if (!state.sourceImg) {
      showError('請先採用一張圖再下載');
      return;
    }
    redrawCanvas();
    var canvas = $('edit-canvas');
    canvas.toBlob(function (blob) {
      if (!blob) {
        showError('無法匯出 JPG');
        return;
      }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fb-post-' + new Date().toISOString().slice(0, 10) + '.jpg';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      showOk('已開始下載 JPG');
    }, 'image/jpeg', 0.92);
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
        aspect: $('edit-aspect').value,
        brightness: $('adj-brightness').value,
        contrast: $('adj-contrast').value,
        saturate: $('adj-saturate').value,
        crop: state.crop,
        logoPos: $('logo-pos').value,
        logoScale: $('logo-scale').value,
        logoOpacity: $('logo-opacity').value,
        logoEnabled: $('logo-enabled').value,
        adoptedPreview: state.adopted ? state.adopted.preview : null,
        adoptedB64: state.adopted ? state.adopted.data_base64 : null,
        adoptedMime: state.adopted ? state.adopted.mime_type : null,
        originalPreview: state.original ? state.original.preview : null,
        originalB64: state.original ? state.original.data_base64 : null,
        originalMime: state.original ? state.original.mime_type : null,
        originalName: state.original ? state.original.name : null
      };
      localStorage.setItem(CFG.STORAGE_KEY + '_draft', JSON.stringify(draft));
      showOk('草稿已儲存（含目前採用圖）');
    } catch (e) {
      showError('草稿儲存失敗（可能超過 localStorage 容量）：' + (e.message || e));
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
      if (d.aspect != null) $('edit-aspect').value = d.aspect;
      if (d.brightness != null) $('adj-brightness').value = d.brightness;
      if (d.contrast != null) $('adj-contrast').value = d.contrast;
      if (d.saturate != null) $('adj-saturate').value = d.saturate;
      if (d.crop) state.crop = d.crop;
      if (d.logoPos) $('logo-pos').value = d.logoPos;
      if (d.logoScale) $('logo-scale').value = d.logoScale;
      if (d.logoOpacity) $('logo-opacity').value = d.logoOpacity;
      if (d.logoEnabled != null) $('logo-enabled').value = d.logoEnabled;
      syncTagsPreview();
      document.querySelectorAll('[data-crop]').forEach(function (chip) {
        chip.classList.toggle('active', chip.getAttribute('data-crop') === state.crop);
      });
      if (d.originalB64) {
        var orig = {
          data_base64: d.originalB64,
          mime_type: d.originalMime || 'image/jpeg',
          preview: d.originalPreview || ('data:image/jpeg;base64,' + d.originalB64),
          name: d.originalName || 'draft.jpg'
        };
        onPhotoLoaded(orig);
      }
      if (d.adoptedB64) {
        adoptPhoto({
          data_base64: d.adoptedB64,
          mime_type: d.adoptedMime || 'image/jpeg',
          preview: d.adoptedPreview || ('data:image/jpeg;base64,' + d.adoptedB64)
        }, '草稿圖');
      }
    } catch (e0) {}
  }

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
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) processFile(f);
    });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (f) processFile(f);
      input.value = '';
    });
  }

  function processFile(file) {
    hideError();
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      showError('請選擇圖片檔');
      return;
    }
    resizeImageFile(file).then(function (photo) {
      onPhotoLoaded(photo);
      showOk('原圖已載入');
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
    $('btn-adopt').addEventListener('click', function () {
      var v = state.versions.find(function (x) { return x.id === state.selectedVersionId; });
      if (!v && state.currentEdit) v = state.currentEdit;
      if (!v) v = state.versions[state.versions.length - 1];
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
      if (!state.original) {
        showError('尚無原圖');
        return;
      }
      adoptPhoto(state.original, '原圖');
    });
    $('btn-download').addEventListener('click', handleDownload);
    $('btn-save-draft').addEventListener('click', saveDraft);
    $('btn-save-settings').addEventListener('click', saveSettings);
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

    ['adj-brightness', 'adj-contrast', 'adj-saturate', 'logo-scale', 'logo-opacity', 'logo-pos', 'logo-enabled']
      .forEach(function (id) {
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
        img.onerror = function () { showError('自訂 LOGO 無法載入'); };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
      $('input-logo').value = '';
    });
  }

  function init() {
    loadSettings();
    renderPresets();
    bindUpload();
    bindUi();
    syncTagsPreview();
    redrawCanvas();
    tryLoadDefaultLogo();
    loadDraft();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
