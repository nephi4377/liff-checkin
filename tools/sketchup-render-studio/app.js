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
    staffUserId: '',
    userName: '',
    stylePresets: [],
    lightingPresets: [],
    lightSourceTags: [],
    globalPrompt: {
      roomType: '',
      style: '',
      lighting: '',
      extraNotes: '',
      lightSourceTags: [],
      lightCustomNote: '',
      allowAddLights: false,
      colorNotes: [],
      cabinetBodyMaterial: '',
      cabinetDoorMaterial: ''
    },
    items: [],
    activeIndex: 0,
    busy: false,
    suppressControlSync: false,
    paintEnabled: false,
    paintLightboxOpen: false,
    brushSize: 6,
    brushColor: '#ff4d4f',
    brushTool: 'pen'
  };

  var BUILTIN_LIGHT_TAGS = [
    '窗戶自然光', '間接照明', '嵌燈', '投射燈', '櫃內燈光', '燈帶', '吊燈主光', '檯燈氛圍',
    '壁燈', '軌道燈', '落地燈', '鏡前燈', '吸頂燈', '其他（自行描述）'
  ];
  var CUSTOM_LIGHT_TAG = '其他（自行描述）';

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
    if (state.staffUserId) {
      payload.user_id = state.staffUserId;
      payload.auth = payload.auth || {};
      payload.auth.user_id = state.staffUserId;
    }
    var wantBypass = CONFIG.authBypass || ($('devBypassInput') && $('devBypassInput').checked);
    if (wantBypass && !state.idToken && !state.staffUserId) {
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
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.text().then(function (text) {
        var trimmed = String(text || '').trim();
        if (res.status === 400 || /400 Bad Request/i.test(trimmed)) {
          throw new Error('連線失敗。請從主控台再開一次渲染工作室。');
        }
        if (!trimmed || trimmed.charAt(0) === '<') {
          throw new Error('後端回應不是 JSON（HTTP ' + res.status + '）');
        }
        try {
          return JSON.parse(trimmed);
        } catch (eParse) {
          throw new Error('後端回應不是 JSON（HTTP ' + res.status + '）');
        }
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

  function mergeLightTagList(fromPing) {
    var seen = {};
    var out = [];
    (fromPing || []).concat(BUILTIN_LIGHT_TAGS).forEach(function (t) {
      if (!t || seen[t] || t === '允許加燈') return;
      seen[t] = true;
      out.push(t);
    });
    return out;
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
        syncLightCustomVisibility(target);
      });
      wrap.appendChild(btn);
    });
  }

  function syncLightCustomVisibility(prompt) {
    var wrap = $('lightCustomWrap');
    if (!wrap) return;
    var tags = (prompt && prompt.lightSourceTags) || [];
    wrap.classList.toggle('hidden', tags.indexOf(CUSTOM_LIGHT_TAG) < 0);
  }

  function renderColorNoteChips(notes) {
    var wrap = $('colorNoteChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    (notes || []).forEach(function (n, idx) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip color-note-chip';
      btn.innerHTML = '<span class="color-swatch" style="background:' + escapeHtml(n.color) + '"></span>' +
        escapeHtml(n.area + ' ' + n.color) + ' ×';
      btn.addEventListener('click', function () {
        var target = getEditingPrompt();
        target.colorNotes.splice(idx, 1);
        renderColorNoteChips(target.colorNotes);
      });
      wrap.appendChild(btn);
    });
  }

  function addColorNote() {
    var place = ($('colorNotePlace') && $('colorNotePlace').value.trim()) || '';
    var color = ($('colorNotePicker') && $('colorNotePicker').value) || '';
    if (!place) {
      setStatus('請先填要上色的位置', 'error');
      return;
    }
    var target = getEditingPrompt();
    if (!target.colorNotes) target.colorNotes = [];
    target.colorNotes.push({ area: place, color: color });
    $('colorNotePlace').value = '';
    renderColorNoteChips(target.colorNotes);
  }

  function emptyPrompt() {
    return {
      roomType: '',
      style: '',
      lighting: '',
      extraNotes: '',
      lightSourceTags: [],
      lightCustomNote: '',
      allowAddLights: false,
      colorNotes: [],
      cabinetBodyMaterial: '',
      cabinetDoorMaterial: ''
    };
  }

  function clonePrompt(p) {
    p = p || emptyPrompt();
    return {
      roomType: p.roomType || '',
      style: p.style || '',
      lighting: p.lighting || '',
      extraNotes: p.extraNotes || '',
      lightSourceTags: (p.lightSourceTags || []).slice(),
      lightCustomNote: p.lightCustomNote || '',
      allowAddLights: !!p.allowAddLights,
      colorNotes: (p.colorNotes || []).map(function (n) {
        return { area: n.area, color: n.color };
      }),
      cabinetBodyMaterial: p.cabinetBodyMaterial || '',
      cabinetDoorMaterial: p.cabinetDoorMaterial || ''
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
    if ($('lightCustomNote')) target.lightCustomNote = $('lightCustomNote').value.trim();
    if ($('allowAddLights')) target.allowAddLights = !!$('allowAddLights').checked;
    if ($('cabinetBodyMaterial')) target.cabinetBodyMaterial = $('cabinetBodyMaterial').value.trim();
    if ($('cabinetDoorMaterial')) target.cabinetDoorMaterial = $('cabinetDoorMaterial').value.trim();
    var chips = $('lightTagChips').querySelectorAll('.chip.active');
    target.lightSourceTags = Array.prototype.map.call(chips, function (el) {
      return el.textContent.replace(/\s×$/, '');
    }).filter(function (t) { return t && t !== '允許加燈'; });
  }

  function writePromptToControls(prompt) {
    state.suppressControlSync = true;
    prompt = prompt || emptyPrompt();
    $('roomTypeInput').value = prompt.roomType || '';
    $('styleSelect').value = prompt.style || '';
    $('lightingSelect').value = prompt.lighting || '';
    $('extraNotes').value = prompt.extraNotes || '';
    if ($('lightCustomNote')) $('lightCustomNote').value = prompt.lightCustomNote || '';
    if ($('allowAddLights')) $('allowAddLights').checked = !!prompt.allowAddLights;
    if ($('cabinetBodyMaterial')) $('cabinetBodyMaterial').value = prompt.cabinetBodyMaterial || '';
    if ($('cabinetDoorMaterial')) $('cabinetDoorMaterial').value = prompt.cabinetDoorMaterial || '';
    renderLightTagChips(prompt.lightSourceTags || []);
    syncLightCustomVisibility(prompt);
    renderColorNoteChips(prompt.colorNotes || []);
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
        : (g.lightSourceTags || []).slice(),
      lightCustomNote: c.lightCustomNote || g.lightCustomNote || '',
      allowAddLights: c.allowAddLights != null ? !!c.allowAddLights : !!g.allowAddLights,
      colorNotes: (c.colorNotes && c.colorNotes.length)
        ? c.colorNotes.slice()
        : (g.colorNotes || []).slice(),
      cabinetBodyMaterial: c.cabinetBodyMaterial || g.cabinetBodyMaterial || '',
      cabinetDoorMaterial: c.cabinetDoorMaterial || g.cabinetDoorMaterial || ''
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

  function getSendSource(item) {
    if (!item) return null;
    if (item.sendSource === 'original' || item.sendSource == null) {
      return {
        kind: 'sketchup',
        key: 'original',
        label: '原圖（SketchUp）',
        previewUrl: item.previewUrl,
        photo: item.photo
      };
    }
    var idx = parseInt(item.sendSource, 10);
    var ver = item.versions[idx];
    if (!ver) {
      return {
        kind: 'sketchup',
        key: 'original',
        label: '原圖（SketchUp）',
        previewUrl: item.previewUrl,
        photo: item.photo
      };
    }
    var img = ver.image || {};
    return {
      kind: 'render',
      key: 'v' + idx,
      label: '版本 ' + (idx + 1),
      previewUrl: ver.previewUrl,
      photo: {
        mime_type: img.mimeType || img.mime_type || 'image/png',
        data_base64: img.dataBase64 || img.data_base64 || ''
      },
      versionIndex: idx
    };
  }

  function updateSendNowLine() {
    var el = $('sendNowLine');
    if (!el) return;
    var item = getActiveItem();
    if (!item) {
      el.textContent = '這次送出：尚未選圖';
      return;
    }
    var src = getSendSource(item);
    el.textContent = '這次送出：' + src.label + (item.markupHasStrokes ? '（含畫筆標示）' : '');
  }

  function setSendSource(item, key) {
    if (!item) return;
    item.sendSource = key;
    item.markupCanvas = null;
    item.markupHasStrokes = false;
    item.markupUndo = [];
    if (key !== 'original' && key != null) {
      var idx = parseInt(key, 10);
      if (!isNaN(idx)) item.activeVersionIndex = idx;
    }
    closePaintLightbox(true);
    updateCompareView();
  }

  function brushLineWidth(canvas) {
    var r = canvas.getBoundingClientRect();
    var scale = r.width ? (canvas.width / r.width) : 1;
    return Math.max(1, (state.brushSize || 6) * scale);
  }

  function pushMarkupUndo(item, canvas) {
    if (!item || !canvas || !canvas.width) return;
    try {
      var ctx = canvas.getContext('2d');
      var snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      item.markupUndo = item.markupUndo || [];
      item.markupUndo.push(snap);
      if (item.markupUndo.length > 8) item.markupUndo.shift();
    } catch (e) { /* 圖太大時略過還原 */ }
  }

  function undoMarkup(item) {
    if (!item || !item.markupCanvas || !item.markupUndo || !item.markupUndo.length) return;
    var canvas = item.markupCanvas;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(item.markupUndo.pop(), 0, 0);
    item.markupHasStrokes = true;
    updateSendNowLine();
  }

  function clearMarkup(item) {
    if (!item || !item.markupCanvas) return;
    var ctx = item.markupCanvas.getContext('2d');
    ctx.clearRect(0, 0, item.markupCanvas.width, item.markupCanvas.height);
    item.markupHasStrokes = false;
    item.markupUndo = [];
    updateSendNowLine();
    setStatus('已清除筆跡');
  }

  function bindPaintCanvas(canvas, item) {
    if (canvas.getAttribute('data-paint-bound') === '1') return;
    canvas.setAttribute('data-paint-bound', '1');
    var last = null;

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var pt = (e.touches && e.touches[0]) || e;
      if (!r.width || !r.height) return null;
      return {
        x: (pt.clientX - r.left) * (canvas.width / r.width),
        y: (pt.clientY - r.top) * (canvas.height / r.height)
      };
    }

    function strokeTo(p) {
      if (!state.paintEnabled || !last || !p) return;
      var ctx = canvas.getContext('2d');
      ctx.lineWidth = brushLineWidth(canvas);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (state.brushTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = state.brushColor || '#ff4d4f';
      }
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      last = p;
      item.markupHasStrokes = true;
      item.markupCanvas = canvas;
      updateSendNowLine();
    }

    function start(e) {
      if (!state.paintEnabled) return;
      e.preventDefault();
      pushMarkupUndo(item, canvas);
      last = pos(e);
    }
    function move(e) {
      if (!state.paintEnabled || last == null) return;
      e.preventDefault();
      strokeTo(pos(e));
    }
    function end() {
      last = null;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  function openPaintLightbox() {
    var item = getActiveItem();
    if (!item) {
      setStatus('請先加入圖片', 'error');
      return;
    }
    state.paintEnabled = true;
    state.paintLightboxOpen = false;
    renderSendUi();
    state.paintLightboxOpen = true;
    var wrap = $('sendStage') && $('sendStage').querySelector('.send-img-wrap');
    var lb = $('paintLightbox');
    var stage = $('paintLbStage');
    if (!wrap || !lb || !stage) return;
    stage.appendChild(wrap);
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden', 'false');
    if ($('btnPaint')) $('btnPaint').classList.add('active');
    syncBrushToolButtons();
  }

  function closePaintLightbox(keepEnabled) {
    var lb = $('paintLightbox');
    var stage = $('paintLbStage');
    var send = $('sendStage');
    var wrap = stage && stage.querySelector('.send-img-wrap');
    if (wrap && send) send.appendChild(wrap);
    if (lb) {
      lb.classList.add('hidden');
      lb.setAttribute('aria-hidden', 'true');
    }
    state.paintLightboxOpen = false;
    if (!keepEnabled) state.paintEnabled = false;
    if ($('btnPaint')) $('btnPaint').classList.toggle('active', !!state.paintEnabled);
  }

  function syncBrushToolButtons() {
    if ($('btnBrushPen')) $('btnBrushPen').classList.toggle('active', state.brushTool === 'pen');
    if ($('btnBrushEraser')) $('btnBrushEraser').classList.toggle('active', state.brushTool === 'eraser');
  }

  function renderSendUi() {
    var chips = $('sendSourceChips');
    var stage = $('sendStage');
    var btnPaint = $('btnPaint');
    if (!chips || !stage) return;
    if (state.paintLightboxOpen) {
      if (btnPaint) btnPaint.classList.add('active');
      return;
    }
    var item = getActiveItem();
    chips.innerHTML = '';
    if (item && item.markupCanvas && item.markupCanvas.parentNode) {
      item.markupCanvas.parentNode.removeChild(item.markupCanvas);
    }
    stage.innerHTML = '';
    if (btnPaint) btnPaint.classList.toggle('active', !!state.paintEnabled);

    if (!item) {
      stage.innerHTML = '<div class="placeholder">請先加入圖片</div>';
      updateSendNowLine();
      return;
    }

    function addChip(label, key, active) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (active ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', function () { setSendSource(item, key); });
      chips.appendChild(btn);
    }

    var src = getSendSource(item);
    addChip('原圖', 'original', src.key === 'original');
    item.versions.forEach(function (ver, idx) {
      addChip('版本 ' + (idx + 1), String(idx), src.key === ('v' + idx));
    });

    var wrap = document.createElement('div');
    wrap.className = 'send-img-wrap' + (state.paintEnabled ? ' paint-on' : '');
    var img = document.createElement('img');
    img.alt = src.label;
    img.src = src.previewUrl;

    var canvas = item.markupCanvas;
    if (!canvas || canvas.getAttribute('data-src') !== src.previewUrl) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('data-src', src.previewUrl);
      item.markupCanvas = canvas;
      item.markupHasStrokes = false;
    }

    function sizeCanvas() {
      if (!img.naturalWidth) return;
      if (!canvas.width) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
    }
    img.addEventListener('load', sizeCanvas);
    if (img.complete) sizeCanvas();

    wrap.appendChild(img);
    wrap.appendChild(canvas);
    stage.appendChild(wrap);
    bindPaintCanvas(canvas, item);
    updateSendNowLine();
  }

  function resolveSendPhoto(item) {
    var src = getSendSource(item);
    if (!src) return Promise.reject(new Error('請先加入圖片'));
    if (!item.markupHasStrokes || !item.markupCanvas) {
      return Promise.resolve({
        photo: src.photo,
        kind: src.kind,
        hasMarkup: false,
        label: src.label
      });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ctx.drawImage(item.markupCanvas, 0, 0, c.width, c.height);
        var dataUrl = c.toDataURL('image/jpeg', 0.92);
        var comma = dataUrl.indexOf(',');
        resolve({
          photo: {
            mime_type: 'image/jpeg',
            data_base64: dataUrl.slice(comma + 1)
          },
          kind: src.kind,
          hasMarkup: true,
          label: src.label
        });
      };
      img.onerror = function () { reject(new Error('無法合成畫筆圖')); };
      img.src = src.previewUrl;
    });
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
    renderSendUi();
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

  function collectRenderPayload(item, referencePhoto, modeOverride, variantIndex) {
    saveControlsToTarget();
    var prompt = getEffectivePromptForItem(item);
    var payload = {
      photo: item.photo,
      room_type: prompt.roomType,
      style: prompt.style,
      lighting: prompt.lighting,
      extra_notes: prompt.extraNotes,
      light_source_tags: prompt.lightSourceTags.slice(),
      light_custom_note: prompt.lightCustomNote || '',
      allow_add_lights: !!prompt.allowAddLights,
      color_notes: (prompt.colorNotes || []).slice(),
      cabinet_body_material: prompt.cabinetBodyMaterial || '',
      cabinet_door_material: prompt.cabinetDoorMaterial || ''
    };
    var settings = collectRenderSettings(modeOverride);
    payload.render_mode = settings.render_mode;
    payload.preserve = settings.preserve;
    if (variantIndex > 0) payload.variant_index = variantIndex;
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
      light_source_tags: g.lightSourceTags.slice(),
      light_custom_note: g.lightCustomNote || '',
      allow_add_lights: !!g.allowAddLights,
      color_notes: (g.colorNotes || []).slice(),
      cabinet_body_material: g.cabinetBodyMaterial || '',
      cabinet_door_material: g.cabinetDoorMaterial || ''
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

  function hashStr(s) {
    var h = 5381;
    var i;
    s = String(s || '');
    for (i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  function fingerprintPhoto(photo) {
    var b64 = (photo && (photo.data_base64 || photo.dataBase64)) || '';
    return String(b64.length) + ':' + b64.slice(0, 96) + ':' + b64.slice(-96);
  }

  function buildRenderCacheKey(item, modeOverride) {
    var p = collectRenderPayload(item, null, modeOverride, 0);
    return hashStr(JSON.stringify({
      photo: fingerprintPhoto(item.photo),
      send: item.sendSource == null ? 'original' : String(item.sendSource),
      markup: !!item.markupHasStrokes,
      room: p.room_type,
      style: p.style,
      lighting: p.lighting,
      extra: p.extra_notes,
      tags: p.light_source_tags,
      customLight: p.light_custom_note,
      allowAdd: p.allow_add_lights,
      colors: p.color_notes,
      cabinet: [p.cabinet_body_material, p.cabinet_door_material],
      mode: p.render_mode,
      preserve: p.preserve,
      aspect: p.aspect_ratio || ''
    }));
  }

  var renderResultCache = {};
  var SINGLE_VERSION_COUNT = 3;

  function applyCachedVersions(item, cached) {
    (cached || []).forEach(function (v) {
      addVersionToItem(item, v.image, v.note);
    });
  }

  function renderOneItem(item, referencePhoto, modeOverride, variantIndex) {
    item.rendering = true;
    updateCompareView();
    return resolveSendPhoto(item).then(function (send) {
      var payload = collectRenderPayload(item, referencePhoto, modeOverride, variantIndex);
      payload.photo = send.photo;
      payload.source_kind = send.kind === 'render' ? 'render' : 'sketchup';
      payload.has_markup = !!send.hasMarkup;
      return apiPost('sketchup_render', payload);
    })
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
    var send = getSendSource(item);
    var cacheKey = buildRenderCacheKey(item, mode);
    if (renderResultCache[cacheKey] && renderResultCache[cacheKey].length && !item.markupHasStrokes) {
      applyCachedVersions(item, renderResultCache[cacheKey]);
      setStatus('同一張圖與設定已有結果，未再呼叫模型', 'ok');
      updateCompareView();
      return;
    }
    var statusLabel = mode === 'fidelity' ? '保真渲染中' : '美化渲染中';
    state.busy = true;
    disableButtons(true);
    var anchor = getStyleAnchorImage();
    var ref = anchor && anchor !== (getActiveVersion(item) && getActiveVersion(item).image) ? anchor : null;
    var collected = [];
    var chain = Promise.resolve();
    var n = (send.kind === 'render' || item.markupHasStrokes) ? 1 : SINGLE_VERSION_COUNT;
    var i;
    for (i = 0; i < n; i++) {
      chain = chain.then((function (idx) {
        return function () {
          setStatus(
            statusLabel + '…' +
            (n > 1 ? ('版本 ' + (idx + 1) + ' / ' + n + '，') : '') +
            '送出「' + send.label + '」'
          );
          return renderOneItem(item, ref, mode, idx).then(function (res) {
            collected.push({ image: res.image, note: res.note });
            updateCompareView();
          });
        };
      })(i));
    }
    chain
      .then(function () {
        renderResultCache[cacheKey] = collected;
        setStatus('已產出 ' + collected.length + ' 個版本', 'ok');
        updateCompareView();
      })
      .catch(function (err) {
        if (collected.length) renderResultCache[cacheKey] = collected;
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
        setStatus('批次渲染中 ' + (idx + 1) + ' / ' + state.items.length + '…（出一張顯示一張）');
        state.activeIndex = idx;
        loadControlsForActiveItem();
        return renderOneItem(item, anchor, readRenderModeFromControls(), 0).then(function (res) {
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
    setStatus('分析中…（送出「' + (getSendSource(item) && getSendSource(item).label) + '」）');
    saveControlsToTarget();
    var prompt = getEffectivePromptForItem(item);
    var settings = collectRenderSettings();
    resolveSendPhoto(item).then(function (send) {
      return apiPost('sketchup_render_analyze', {
        photo: send.photo,
        room_type: prompt.roomType,
        style: prompt.style,
        lighting: prompt.lighting,
        light_source_tags: prompt.lightSourceTags.slice(),
        extra_notes: prompt.extraNotes,
        render_mode: settings.render_mode,
        preserve: settings.preserve,
        source_kind: send.kind === 'render' ? 'render' : 'sketchup',
        has_markup: !!send.hasMarkup,
        light_custom_note: prompt.lightCustomNote || '',
        allow_add_lights: !!prompt.allowAddLights,
        color_notes: (prompt.colorNotes || []).slice(),
        cabinet_body_material: prompt.cabinetBodyMaterial || '',
        cabinet_door_material: prompt.cabinetDoorMaterial || ''
      });
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
    ['btnAnalyze', 'btnRenderFidelity', 'btnRenderStyled', 'btnRenderAll', 'btnAdd', 'btnPaint', 'btnClearMarkup'].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !!disabled;
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
            sendSource: 'original',
            markupCanvas: null,
            markupHasStrokes: false,
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
    $('btnRenderAll').addEventListener('click', renderAll);
    $('btnAnalyze').addEventListener('click', analyzeCurrent);
    if ($('btnPaint')) {
      $('btnPaint').addEventListener('click', function () {
        if (state.paintLightboxOpen) closePaintLightbox(false);
        else openPaintLightbox();
      });
    }
    if ($('btnClearMarkup')) {
      $('btnClearMarkup').addEventListener('click', function () {
        clearMarkup(getActiveItem());
      });
    }
    if ($('btnClearMarkupLb')) {
      $('btnClearMarkupLb').addEventListener('click', function () {
        clearMarkup(getActiveItem());
      });
    }
    if ($('btnPaintDone')) {
      $('btnPaintDone').addEventListener('click', function () { closePaintLightbox(false); });
    }
    if ($('btnBrushPen')) {
      $('btnBrushPen').addEventListener('click', function () {
        state.brushTool = 'pen';
        syncBrushToolButtons();
      });
    }
    if ($('btnBrushEraser')) {
      $('btnBrushEraser').addEventListener('click', function () {
        state.brushTool = 'eraser';
        syncBrushToolButtons();
      });
    }
    if ($('btnBrushUndo')) {
      $('btnBrushUndo').addEventListener('click', function () { undoMarkup(getActiveItem()); });
    }
    if ($('brushSize')) {
      $('brushSize').addEventListener('input', function () {
        state.brushSize = parseInt(this.value, 10) || 6;
        if ($('brushSizeLabel')) $('brushSizeLabel').textContent = String(state.brushSize);
      });
    }
    if ($('brushColor')) {
      $('brushColor').addEventListener('input', function () {
        state.brushColor = this.value || '#ff4d4f';
      });
    }
    if ($('btnAddColorNote')) {
      $('btnAddColorNote').addEventListener('click', addColorNote);
    }
    if ($('allowAddLights')) {
      $('allowAddLights').addEventListener('change', function () {
        if (state.suppressControlSync) return;
        saveControlsToTarget();
      });
    }
    if ($('lightCustomNote')) {
      $('lightCustomNote').addEventListener('input', function () {
        if (state.suppressControlSync) return;
        saveControlsToTarget();
      });
    }

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

    ['roomTypeInput', 'styleSelect', 'lightingSelect', 'extraNotes', 'cabinetBodyMaterial', 'cabinetDoorMaterial'].forEach(function (id) {
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
    state.lightSourceTags = mergeLightTagList(data.light_source_tags || []);
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
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'accounting_policy' })
    }).then(function (r) { return r.text(); })
      .then(function (text) {
        var trimmed = String(text || '').trim();
        if (!trimmed || trimmed.charAt(0) === '<') return tryLoadPolicyCache() || {};
        var data = JSON.parse(trimmed);
        var policy = (data && data.policy) || data || {};
        if (policy && (policy.liffId || policy.accountingGasWebAppUrl || policy.gasApiUrl)) {
          if (policy.gasApiUrl && !policy.accountingGasWebAppUrl) {
            policy.accountingGasWebAppUrl = policy.gasApiUrl;
          }
          savePolicyCache(policy);
        }
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
      if (policy && policy.authBypass && isLocalOrDevBypassAllowed()) CONFIG.authBypass = true;
      if (policy && policy.liffId) CONFIG.liffId = policy.liffId;

      if (!CONFIG.apiUrl) {
        var q = new URLSearchParams(location.search);
        CONFIG.apiUrl = q.get('api') || CFG.GAS_URL || '';
      }
      if (!CONFIG.liffId && CFG.LIFF_ID) CONFIG.liffId = CFG.LIFF_ID;

      state.staffUserId = pickStaffUidFromUrl();

      if ((CONFIG.authBypass || ($('devBypassInput') && $('devBypassInput').checked)) && isLocalOrDevBypassAllowed()) {
        CONFIG.authBypass = true;
        state.userName = '開發模式';
        $('userLine').textContent = state.userName;
        setLoadingMsg('正在確認服務…');
        return apiPost('sketchup_render_ping', {});
      }

      if (state.staffUserId) {
        state.userName = state.staffUserId;
        $('userLine').textContent = '主控台身分';
        setLoadingMsg('正在確認服務…');
        return apiPost('sketchup_render_ping', {});
      }

      if (!CONFIG.liffId) {
        throw new Error('請從主控台開啟渲染工作室');
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
          if (p.userId) state.staffUserId = p.userId;
          setLoadingMsg('正在確認服務…');
          return apiPost('sketchup_render_ping', {});
        });
      }).catch(function (err) {
        var m = String((err && err.message) || err);
        if (/400|Bad Request/i.test(m)) {
          throw new Error('請從主控台開啟渲染工作室（外部瀏覽器無法用 LINE 登入）');
        }
        throw err;
      });
    });
  }

  function isLocalOrDevBypassAllowed() {
    var qs = new URLSearchParams(location.search);
    return qs.get('dev') === '1'
      || location.hostname === 'localhost'
      || location.hostname === '127.0.0.1';
  }

  function pickStaffUidFromUrl() {
    var qs = new URLSearchParams(location.search);
    return String(qs.get('uid') || qs.get('user_id') || qs.get('userId') || '').trim();
  }

  function boot() {
    bindEvents();
    var qs = new URLSearchParams(location.search);
    if ($('gasUrlInput')) $('gasUrlInput').value = qs.get('api') || CFG.GAS_URL || '';
    if ($('devBypassInput')) {
      $('devBypassInput').checked = isLocalOrDevBypassAllowed();
    }
    CONFIG.apiUrl = ($('gasUrlInput') && $('gasUrlInput').value.trim()) || CFG.GAS_URL || '';
    CONFIG.liffId = CFG.LIFF_ID || '';
    CONFIG.authBypass = isLocalOrDevBypassAllowed() && $('devBypassInput') && $('devBypassInput').checked;

    if (!CONFIG.apiUrl) {
      $('loading').textContent = '請在進階設定填 GAS URL，或網址加 ?api=…';
      return;
    }

    setLoadingMsg('正在連線後端…');
    loadPolicyAndSession()
      .then(function (ping) {
        if (!ping || !ping.success) throw new Error((ping && ping.message) || '連線失敗');
        if (ping.display_name) {
          state.userName = ping.display_name;
          $('userLine').textContent = ping.display_name;
        }
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
