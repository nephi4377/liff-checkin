(function () {
  'use strict';

  var CFG = window.SKETCHUP_RENDER_CONFIG || {};
  var CONFIG = {
    liffId: '',
    apiUrl: CFG.GAS_URL || '',
    authBypass: false
  };

  var state = {
    idToken: '',
    userName: '',
    stylePresets: [],
    lightingPresets: [],
    lightSourceTags: [],
    globalPrompt: {
      roomType: '',
      style: '',
      lighting: '',
      extraNotes: '',
      lightSourceTags: []
    },
    items: [],
    activeIndex: 0,
    busy: false,
    suppressControlSync: false
  };

  var $ = function (id) { return document.getElementById(id); };

  function setStatus(msg, type) {
    var el = $('statusMsg');
    el.textContent = msg || '';
    el.className = 'status-msg' + (type ? ' ' + type : '');
  }

  function showApp() {
    $('loading').classList.add('hidden');
    $('app').classList.remove('hidden');
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = String(reader.result || '');
        var comma = dataUrl.indexOf(',');
        resolve({
          mime_type: file.type || 'image/jpeg',
          data_base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function setLoadingMsg(msg) {
    var el = $('loading');
    if (el && !el.classList.contains('hidden')) el.textContent = msg || '載入中…';
  }

  var POLICY_CACHE_KEY = 'sketchup_render_policy_v1';

  function tryLoadPolicyCache() {
    try {
      var raw = sessionStorage.getItem(POLICY_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts || Date.now() - obj.ts > 300000) return null;
      return obj.policy || null;
    } catch (e) {
      return null;
    }
  }

  function savePolicyCache(policy) {
    try {
      sessionStorage.setItem(POLICY_CACHE_KEY, JSON.stringify({ ts: Date.now(), policy: policy }));
    } catch (e) { /* ignore */ }
  }

  var ALLOWED_ASPECT = [
    { key: '1:1', r: 1 },
    { key: '4:5', r: 0.8 },
    { key: '16:9', r: 16 / 9 },
    { key: '3:2', r: 1.5 },
    { key: '4:3', r: 4 / 3 }
  ];

  function pickAspectRatio(w, h) {
    if (!w || !h) return '';
    var ratio = w / h;
    var best = ALLOWED_ASPECT[0];
    var bestDiff = Math.abs(ratio - best.r);
    for (var i = 1; i < ALLOWED_ASPECT.length; i++) {
      var diff = Math.abs(ratio - ALLOWED_ASPECT[i].r);
      if (diff < bestDiff) {
        best = ALLOWED_ASPECT[i];
        bestDiff = diff;
      }
    }
    return best.key;
  }

  function measurePreviewAspect(previewUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        resolve(pickAspectRatio(img.naturalWidth, img.naturalHeight));
      };
      img.onerror = function () { resolve(''); };
      img.src = previewUrl;
    });
  }

  function apiPost(action, payload) {
    payload = payload || {};
    payload.action = action;
    if (state.idToken) payload.liff_id_token = state.idToken;
    if (CONFIG.authBypass || ($('devBypassInput') && $('devBypassInput').checked)) {
      payload.dev_bypass = true;
    }
    if ($('ingestSecretInput')) {
      var secret = $('ingestSecretInput').value.trim();
      if (secret) payload.secret = secret;
    }
    var url = ($('gasUrlInput') && $('gasUrlInput').value.trim()) || CONFIG.apiUrl;
    if (!url) return Promise.reject(new Error('尚未設定 GAS URL'));
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () {
        throw new Error('後端回應不是 JSON（HTTP ' + res.status + '）');
      });
    });
  }

  function renderSelectOptions(selectEl, options, placeholder) {
    selectEl.innerHTML = '';
    if (placeholder) {
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = placeholder;
      selectEl.appendChild(opt0);
    }
    (options || []).forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    });
  }

  function renderLightTagChips(selectedTags) {
    var wrap = $('lightTagChips');
    var active = selectedTags || (getEditingPrompt().lightSourceTags || []);
    wrap.innerHTML = '';
    state.lightSourceTags.forEach(function (tag) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (active.indexOf(tag) >= 0 ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', function () {
        if (state.suppressControlSync) return;
        var target = getEditingPrompt();
        var idx = target.lightSourceTags.indexOf(tag);
        if (idx >= 0) target.lightSourceTags.splice(idx, 1);
        else target.lightSourceTags.push(tag);
        renderLightTagChips(target.lightSourceTags);
      });
      wrap.appendChild(btn);
    });
  }

  function emptyPrompt() {
    return {
      roomType: '',
      style: '',
      lighting: '',
      extraNotes: '',
      lightSourceTags: []
    };
  }

  function clonePrompt(p) {
    p = p || emptyPrompt();
    return {
      roomType: p.roomType || '',
      style: p.style || '',
      lighting: p.lighting || '',
      extraNotes: p.extraNotes || '',
      lightSourceTags: (p.lightSourceTags || []).slice()
    };
  }

  function getActiveItem() {
    return state.items[state.activeIndex] || null;
  }

  function isCustomMode() {
    var item = getActiveItem();
    return !!(item && item.useCustomPrompt);
  }

  function getEditingPrompt() {
    var item = getActiveItem();
    if (item && item.useCustomPrompt) {
      if (!item.customPrompt) item.customPrompt = clonePrompt(state.globalPrompt);
      return item.customPrompt;
    }
    return state.globalPrompt;
  }

  function readControlsIntoPrompt(target) {
    target.roomType = $('roomTypeInput').value.trim();
    target.style = $('styleSelect').value;
    target.lighting = $('lightingSelect').value;
    target.extraNotes = $('extraNotes').value.trim();
    var chips = $('lightTagChips').querySelectorAll('.chip.active');
    target.lightSourceTags = Array.prototype.map.call(chips, function (el) { return el.textContent; });
  }

  function writePromptToControls(prompt) {
    state.suppressControlSync = true;
    prompt = prompt || emptyPrompt();
    $('roomTypeInput').value = prompt.roomType || '';
    $('styleSelect').value = prompt.style || '';
    $('lightingSelect').value = prompt.lighting || '';
    $('extraNotes').value = prompt.extraNotes || '';
    renderLightTagChips(prompt.lightSourceTags || []);
    updatePromptScopeUi();
    state.suppressControlSync = false;
  }

  function saveControlsToTarget() {
    readControlsIntoPrompt(getEditingPrompt());
  }

  function loadControlsForActiveItem() {
    var item = getActiveItem();
    $('useCustomPrompt').checked = !!(item && item.useCustomPrompt);
    writePromptToControls(item && item.useCustomPrompt
      ? (item.customPrompt || clonePrompt(state.globalPrompt))
      : state.globalPrompt);
  }

  function updatePromptScopeUi() {
    var custom = isCustomMode();
    $('promptScopeHint').textContent = custom
      ? '此圖自訂：只影響目前選取的圖片'
      : '未勾選：全部圖片沿用下方全域設定';
    $('controlsPanel').classList.toggle('custom-mode', custom);
  }

  function getEffectivePromptForItem(item) {
    if (!item || !item.useCustomPrompt || !item.customPrompt) {
      return clonePrompt(state.globalPrompt);
    }
    var g = state.globalPrompt;
    var c = item.customPrompt;
    return {
      roomType: c.roomType || g.roomType,
      style: c.style || g.style,
      lighting: c.lighting || g.lighting,
      extraNotes: c.extraNotes || g.extraNotes,
      lightSourceTags: (c.lightSourceTags && c.lightSourceTags.length)
        ? c.lightSourceTags.slice()
        : (g.lightSourceTags || []).slice()
    };
  }

  function buildItemOverride(item) {
    if (!item || !item.useCustomPrompt || !item.customPrompt) return { use_global: true };
    var c = item.customPrompt;
    var g = state.globalPrompt;
    var out = {};
    if ((c.roomType || '') !== (g.roomType || '')) out.room_type = c.roomType;
    if ((c.style || '') !== (g.style || '')) out.style = c.style;
    if ((c.lighting || '') !== (g.lighting || '')) out.lighting = c.lighting;
    if ((c.extraNotes || '') !== (g.extraNotes || '')) out.extra_notes = c.extraNotes;
    var tagsSame = JSON.stringify(c.lightSourceTags || []) === JSON.stringify(g.lightSourceTags || []);
    if (!tagsSame && c.lightSourceTags && c.lightSourceTags.length) {
      out.light_source_tags = c.lightSourceTags.slice();
    }
    if (item.aspectRatio) out.aspect_ratio = item.aspectRatio;
    if (!Object.keys(out).length) return { use_global: true };
    return out;
  }

  function getActiveVersion(item) {
    if (!item || !item.versions.length) return null;
    return item.versions[item.activeVersionIndex] || item.versions[item.versions.length - 1];
  }

  function updateCompareView() {
    var item = getActiveItem();
    var origPane = $('paneOriginal');
    var rendPane = $('paneRendered');
    origPane.innerHTML = '';
    rendPane.innerHTML = '';

    if (!item) {
      origPane.innerHTML = '<div class="placeholder">請加入 SketchUp 截圖</div>';
      rendPane.innerHTML = '<div class="placeholder" id="renderPlaceholder">選擇圖片後按「渲染」</div>';
      $('versionRow').classList.add('hidden');
      $('filmMeta').textContent = '';
      return;
    }

    var origImg = document.createElement('img');
    origImg.src = item.previewUrl;
    origImg.alt = item.name;
    origPane.appendChild(origImg);

    var version = getActiveVersion(item);
    if (version && version.previewUrl) {
      var rendImg = document.createElement('img');
      rendImg.src = version.previewUrl;
      rendImg.alt = '渲染結果';
      rendPane.appendChild(rendImg);
    } else if (item.rendering) {
      rendPane.classList.add('rendering');
      rendPane.innerHTML = '<div class="placeholder">渲染中…</div>';
    } else {
      rendPane.innerHTML = '<div class="placeholder">尚未渲染</div>';
    }
    rendPane.classList.toggle('rendering', !!item.rendering);

    $('filmMeta').textContent = (state.activeIndex + 1) + ' / ' + state.items.length;
    renderThumbRow();
    renderVersionRow();
  }

  function selectItem(idx) {
    if (idx === state.activeIndex) return;
    saveControlsToTarget();
    state.activeIndex = idx;
    updateCompareView();
    loadControlsForActiveItem();
  }

  function renderThumbRow() {
    var row = $('thumbRow');
    row.innerHTML = '';
    state.items.forEach(function (item, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb' + (idx === state.activeIndex ? ' active' : '');
      btn.innerHTML =
        (item.useCustomPrompt ? '<span class="custom-dot" title="此圖自訂 Prompt"></span>' : '') +
        '<img src="' + item.previewUrl + '" alt="" />' +
        '<div class="cap">' + escapeHtml(item.name) + '</div>' +
        (item.versions.length ? '<span class="badge">' + item.versions.length + '</span>' : '');
      btn.addEventListener('click', function () { selectItem(idx); });
      row.appendChild(btn);
    });
  }

  function renderVersionRow() {
    var item = getActiveItem();
    var row = $('versionRow');
    var thumbs = $('versionThumbs');
    thumbs.innerHTML = '';
    if (!item || !item.versions.length) {
      row.classList.add('hidden');
      return;
    }
    row.classList.remove('hidden');
    item.versions.forEach(function (ver, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'version-thumb' + (idx === item.activeVersionIndex ? ' active' : '');
      btn.innerHTML =
        '<img src="' + ver.previewUrl + '" alt="" />' +
        '<div class="cap">版本 ' + (idx + 1) + '</div>';
      btn.addEventListener('click', function () {
        item.activeVersionIndex = idx;
        updateCompareView();
      });
      thumbs.appendChild(btn);
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function readRenderModeFromControls() {
    var checked = document.querySelector('input[name="renderMode"]:checked');
    return checked ? checked.value : 'fidelity';
  }

  function readPreserveFromControls() {
    return {
      ceiling_type: !!($('preserveCeiling') && $('preserveCeiling').checked),
      beam_color: !!($('preserveBeam') && $('preserveBeam').checked),
      wall_paint: !!($('preserveWall') && $('preserveWall').checked),
      lines_openings: !!($('preserveLines') && $('preserveLines').checked),
      furniture_layout: !!($('preserveLayout') && $('preserveLayout').checked)
    };
  }

  function collectRenderSettings(modeOverride) {
    return {
      render_mode: modeOverride || readRenderModeFromControls(),
      preserve: readPreserveFromControls()
    };
  }

  function hideAnalyzeSummary() {
    var el = $('analyzeSummary');
    if (!el) return;
    el.classList.add('hidden');
    el.innerHTML = '';
  }

  function showAnalyzeSummary(d) {
    var el = $('analyzeSummary');
    if (!el) return;
    d = d || {};
    var parts = [];
    if (d.room_type) parts.push('空間：' + d.room_type);
    if (d.detected_ceiling_type) parts.push('天花：' + d.detected_ceiling_type);
    if (d.detected_beam_notes) parts.push('樑柱：' + d.detected_beam_notes);
    if (d.material_notes) parts.push('材質：' + d.material_notes);
    if (d.render_hints) parts.push('渲染建議：' + d.render_hints);
    var warns = d.warnings || [];
    if (warns.length) parts.push('注意：' + warns.join('；'));
    if (!parts.length) {
      hideAnalyzeSummary();
      return;
    }
    el.innerHTML = parts.map(function (p) {
      if (p.indexOf('注意：') === 0) {
        return '<div class="warn">' + escapeHtml(p) + '</div>';
      }
      return '<div>' + escapeHtml(p) + '</div>';
    }).join('');
    el.classList.remove('hidden');
  }

  function collectRenderPayload(item, referencePhoto, modeOverride) {
    saveControlsToTarget();
    var prompt = getEffectivePromptForItem(item);
    var payload = {
      photo: item.photo,
      room_type: prompt.roomType,
      style: prompt.style,
      lighting: prompt.lighting,
      extra_notes: prompt.extraNotes,
      light_source_tags: prompt.lightSourceTags.slice()
    };
    var settings = collectRenderSettings(modeOverride);
    payload.render_mode = settings.render_mode;
    payload.preserve = settings.preserve;
    if (item.aspectRatio) payload.aspect_ratio = item.aspectRatio;
    if (referencePhoto) payload.reference_photo = referencePhoto;
    return payload;
  }

  function collectGlobalPayloadBase(modeOverride) {
    saveControlsToTarget();
    var g = state.globalPrompt;
    var payload = {
      room_type: g.roomType,
      style: g.style,
      lighting: g.lighting,
      extra_notes: g.extraNotes,
      light_source_tags: g.lightSourceTags.slice()
    };
    var settings = collectRenderSettings(modeOverride);
    payload.render_mode = settings.render_mode;
    payload.preserve = settings.preserve;
    return payload;
  }

  function imageObjToPreview(image) {
    var mime = image.mimeType || image.mime_type || 'image/png';
    var b64 = image.dataBase64 || image.data_base64 || '';
    return 'data:' + mime + ';base64,' + b64;
  }

  function addVersionToItem(item, image, note) {
    var previewUrl = imageObjToPreview(image);
    item.versions.push({
      previewUrl: previewUrl,
      image: image,
      note: note || '',
      createdAt: Date.now()
    });
    item.activeVersionIndex = item.versions.length - 1;
  }

  function renderOneItem(item, referencePhoto, modeOverride) {
    item.rendering = true;
    updateCompareView();
    return apiPost('sketchup_render', collectRenderPayload(item, referencePhoto, modeOverride))
      .then(function (res) {
        item.rendering = false;
        if (!res.success) throw new Error(res.message || '渲染失敗');
        addVersionToItem(item, res.image, res.note);
        return res;
      })
      .catch(function (err) {
        item.rendering = false;
        throw err;
      });
  }

  function getStyleAnchorImage() {
    for (var i = 0; i < state.items.length; i++) {
      var item = state.items[i];
      var ver = getActiveVersion(item) || (item.versions.length ? item.versions[item.versions.length - 1] : null);
      if (ver && ver.image) return ver.image;
    }
    return null;
  }

  function renderCurrent(modeOverride) {
    if (state.busy) return;
    var item = getActiveItem();
    if (!item) {
      setStatus('請先加入圖片', 'error');
      return;
    }
    var mode = modeOverride || readRenderModeFromControls();
    var statusLabel = mode === 'fidelity' ? '保真渲染中…' : '美化渲染中…';
    state.busy = true;
    setStatus(statusLabel + '（第 ' + (state.activeIndex + 1) + ' 張）');
    disableButtons(true);
    var anchor = getStyleAnchorImage();
    var ref = anchor && anchor !== (getActiveVersion(item) && getActiveVersion(item).image) ? anchor : null;
    renderOneItem(item, ref, mode)
      .then(function () {
        setStatus('渲染完成', 'ok');
        updateCompareView();
      })
      .catch(function (err) {
        setStatus(err.message || String(err), 'error');
        updateCompareView();
      })
      .finally(function () {
        state.busy = false;
        disableButtons(false);
      });
  }

  function renderAll() {
    if (state.busy || !state.items.length) return;
    state.busy = true;
    disableButtons(true);
    var anchor = null;
    var chain = Promise.resolve();
    state.items.forEach(function (item, idx) {
      chain = chain.then(function () {
        setStatus('批次渲染中 ' + (idx + 1) + ' / ' + state.items.length + '…');
        state.activeIndex = idx;
        return renderOneItem(item, anchor, readRenderModeFromControls()).then(function (res) {
          if (!anchor && res && res.image) anchor = res.image;
          updateCompareView();
        }).catch(function (err) {
          setStatus('第 ' + (idx + 1) + ' 張失敗：' + (err.message || err), 'error');
          updateCompareView();
        });
      });
    });
    chain.finally(function () {
      state.busy = false;
      disableButtons(false);
      setStatus('批次渲染結束', 'ok');
    });
  }

  function renderAllViaBatchApi() {
    if (state.busy || !state.items.length) return;
    state.busy = true;
    disableButtons(true);
    setStatus('批次渲染中（整案風格一致）…');
    var payload = collectGlobalPayloadBase(readRenderModeFromControls());
    payload.photos = state.items.map(function (it) { return it.photo; });
    payload.items = state.items.map(function (it) { return buildItemOverride(it); });
    var anchor = getStyleAnchorImage();
    if (anchor) payload.style_anchor = anchor;

    apiPost('sketchup_render_batch', payload)
      .then(function (res) {
        if (!res.success && !(res.results && res.results.length)) {
          throw new Error(res.message || '批次渲染失敗');
        }
        (res.results || []).forEach(function (r) {
          var item = state.items[r.index];
          if (!item) return;
          if (r.success && r.image) addVersionToItem(item, r.image, r.note);
        });
        setStatus('完成 ' + (res.rendered_count || 0) + ' / ' + (res.photo_count || state.items.length) + ' 張', 'ok');
        updateCompareView();
      })
      .catch(function (err) {
        setStatus(err.message || String(err), 'error');
      })
      .finally(function () {
        state.busy = false;
        disableButtons(false);
      });
  }

  function analyzeCurrent() {
    var item = getActiveItem();
    if (!item || state.busy) return;
    state.busy = true;
    disableButtons(true);
    setStatus('分析中…');
    saveControlsToTarget();
    var prompt = getEffectivePromptForItem(item);
    var settings = collectRenderSettings();
    apiPost('sketchup_render_analyze', {
      photo: item.photo,
      room_type: prompt.roomType,
      style: prompt.style,
      lighting: prompt.lighting,
      light_source_tags: prompt.lightSourceTags.slice(),
      extra_notes: prompt.extraNotes,
      render_mode: settings.render_mode,
      preserve: settings.preserve
    }).then(function (res) {
      if (!res.success) throw new Error(res.message || '分析失敗');
      var d = res.data || {};
      var target = getEditingPrompt();
      if (d.room_type) target.roomType = d.room_type;
      if (settings.render_mode !== 'fidelity' && d.suggested_style) target.style = d.suggested_style;
      if (d.suggested_lighting) target.lighting = d.suggested_lighting;
      if (Array.isArray(d.suggested_light_source_tags)) {
        target.lightSourceTags = d.suggested_light_source_tags.slice();
      }
      var notes = [];
      if (d.render_hints) notes.push(d.render_hints);
      if (d.detected_ceiling_type) notes.push('保留天花：' + d.detected_ceiling_type);
      if (d.detected_beam_notes) notes.push('樑柱：' + d.detected_beam_notes);
      if (notes.length) target.extraNotes = notes.join('；');
      writePromptToControls(target);
      showAnalyzeSummary(d);
      setStatus('分析完成' + (d.room_type ? ('｜' + d.room_type) : '') + '，請確認上方摘要後再渲染', 'ok');
    }).catch(function (err) {
      setStatus(err.message || String(err), 'error');
    }).finally(function () {
      state.busy = false;
      disableButtons(false);
    });
  }

  function disableButtons(disabled) {
    ['btnAnalyze', 'btnRenderFidelity', 'btnRenderStyled', 'btnRenderAll', 'btnAdd'].forEach(function (id) {
      $(id).disabled = !!disabled;
    });
  }

  function addFiles(fileList) {
    var files = Array.from(fileList || []);
    if (!files.length) return;
    var remain = 8 - state.items.length;
    if (remain <= 0) {
      setStatus('最多 8 張圖', 'error');
      return;
    }
    files = files.slice(0, remain);
    Promise.all(files.map(function (file, idx) {
      return fileToBase64(file).then(function (photo) {
        var previewUrl = 'data:' + photo.mime_type + ';base64,' + photo.data_base64;
        return measurePreviewAspect(previewUrl).then(function (aspectRatio) {
          state.items.push({
            id: 'img_' + Date.now() + '_' + idx,
            name: file.name || ('圖 ' + (state.items.length + 1)),
            previewUrl: previewUrl,
            photo: photo,
            aspectRatio: aspectRatio,
            versions: [],
            activeVersionIndex: 0,
            rendering: false,
            useCustomPrompt: false,
            customPrompt: null
          });
        });
      });
    })).then(function () {
      if (state.activeIndex >= state.items.length) state.activeIndex = 0;
      updateCompareView();
      loadControlsForActiveItem();
      setStatus('已加入 ' + files.length + ' 張圖', 'ok');
    }).catch(function (err) {
      setStatus(err.message || String(err), 'error');
    });
  }

  function bindEvents() {
    $('btnAdd').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) {
      addFiles(e.target.files);
      e.target.value = '';
    });
    $('btnRenderFidelity').addEventListener('click', function () { renderCurrent('fidelity'); });
    $('btnRenderStyled').addEventListener('click', function () { renderCurrent(null); });
    $('btnRenderAll').addEventListener('click', renderAllViaBatchApi);
    $('btnAnalyze').addEventListener('click', analyzeCurrent);

    $('useCustomPrompt').addEventListener('change', function () {
      var item = getActiveItem();
      if (!item) {
        this.checked = false;
        return;
      }
      saveControlsToTarget();
      item.useCustomPrompt = this.checked;
      if (item.useCustomPrompt && !item.customPrompt) {
        item.customPrompt = clonePrompt(state.globalPrompt);
      }
      loadControlsForActiveItem();
      renderThumbRow();
    });

    ['roomTypeInput', 'styleSelect', 'lightingSelect', 'extraNotes'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        if (state.suppressControlSync) return;
        saveControlsToTarget();
        if (isCustomMode()) renderThumbRow();
      });
      $(id).addEventListener('change', function () {
        if (state.suppressControlSync) return;
        saveControlsToTarget();
        if (isCustomMode()) renderThumbRow();
      });
    });
  }

  function initFromPing(data) {
    state.stylePresets = data.style_presets || [];
    state.lightingPresets = data.lighting_presets || [];
    state.lightSourceTags = data.light_source_tags || [];
    renderSelectOptions($('styleSelect'), state.stylePresets, '（依原圖，不另改風格）');
    renderSelectOptions($('lightingSelect'), state.lightingPresets, '（依原圖光線）');
    renderLightTagChips(state.globalPrompt.lightSourceTags);
    updatePromptScopeUi();
  }

  function fetchAccountingPolicy() {
    var url = ($('gasUrlInput') && $('gasUrlInput').value.trim()) || CONFIG.apiUrl || CFG.GAS_URL || '';
    if (!url) return Promise.resolve({});
    var cached = tryLoadPolicyCache();
    if (cached) return Promise.resolve(cached);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'accounting_policy' })
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        var policy = (data && data.policy) || data || {};
        if (policy && (policy.liffId || policy.accountingGasWebAppUrl)) savePolicyCache(policy);
        return policy;
      })
      .catch(function () { return tryLoadPolicyCache() || {}; });
  }

  function loadPolicyAndSession() {
    return fetchAccountingPolicy().then(function (policy) {
      policy = policy || {};
      if (policy && policy.accountingGasWebAppUrl) {
        CONFIG.apiUrl = policy.accountingGasWebAppUrl;
        if ($('gasUrlInput')) $('gasUrlInput').value = CONFIG.apiUrl;
      }
      if (policy && policy.authBypass) CONFIG.authBypass = true;
      if (policy && policy.liffId) CONFIG.liffId = policy.liffId;

      if (!CONFIG.apiUrl) {
        var q = new URLSearchParams(location.search);
        CONFIG.apiUrl = q.get('api') || CFG.GAS_URL || '';
      }
      if (!CONFIG.liffId && CFG.LIFF_ID) CONFIG.liffId = CFG.LIFF_ID;

      if (CONFIG.authBypass || ($('devBypassInput') && $('devBypassInput').checked)) {
        CONFIG.authBypass = true;
        state.userName = '開發模式';
        $('userLine').textContent = state.userName;
        setLoadingMsg('正在確認服務…');
        return apiPost('sketchup_render_ping', {});
      }

      if (!CONFIG.liffId) {
        throw new Error('尚未設定 LIFF（請從 LINE 開啟，或稍後再試）');
      }
      if (typeof liff === 'undefined') {
        throw new Error('LINE 登入元件未載入，請重新整理');
      }

      setLoadingMsg('正在登入 LINE…');
      return liff.init({ liffId: CONFIG.liffId }).then(function () {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: location.href.split('#')[0] });
          return Promise.reject(new Error('導向登入'));
        }
        return liff.getProfile().then(function (p) {
          state.userName = p.displayName || p.userId;
          $('userLine').textContent = state.userName;
          state.idToken = liff.getIDToken();
          setLoadingMsg('正在確認服務…');
          return apiPost('sketchup_render_ping', {});
        });
      });
    });
  }

  function boot() {
    bindEvents();
    var qs = new URLSearchParams(location.search);
    if ($('gasUrlInput')) $('gasUrlInput').value = qs.get('api') || CFG.GAS_URL || '';
    if ($('devBypassInput')) {
      $('devBypassInput').checked = qs.get('dev') === '1'
        || location.hostname === 'localhost'
        || location.hostname === '127.0.0.1';
    }
    CONFIG.apiUrl = ($('gasUrlInput') && $('gasUrlInput').value.trim()) || CFG.GAS_URL || '';
    CONFIG.liffId = CFG.LIFF_ID || '';
    CONFIG.authBypass = $('devBypassInput') && $('devBypassInput').checked;

    if (!CONFIG.apiUrl) {
      $('loading').textContent = '請在進階設定填 GAS URL，或網址加 ?api=…';
      return;
    }

    setLoadingMsg('正在連線後端…');
    loadPolicyAndSession()
      .then(function (ping) {
        if (!ping || !ping.success) throw new Error((ping && ping.message) || '連線失敗');
        initFromPing(ping);
        showApp();
        setStatus('就緒');
      })
      .catch(function (err) {
        if (String(err.message || err).indexOf('導向登入') >= 0) return;
        $('loading').textContent = '載入失敗：' + (err.message || err);
      });
  }

  boot();
})();
