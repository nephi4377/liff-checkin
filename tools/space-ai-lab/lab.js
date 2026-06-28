/**
 * 空間 AI 實驗室 — 前端邏輯
 * 雲端：accounting-gas → Gemini
 * 本機：Ollama OpenAI 相容端點（多模態視覺模型）
 */
(function () {
  'use strict';

  var MODEL_RATES = {
    'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', input: 0.30, output: 2.50 },
    'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', input: 1.25, output: 10.00 }
  };

  var LOCAL_MODEL_RATES = {
    'qwen2.5vl:7b': { name: 'Qwen 2.5 VL 7B（本機）', input: 0, output: 0 }
  };

  var DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434/v1';
  var DEFAULT_EXTRA_PROMPT = '請一律使用繁體中文撰寫 JSON 內所有文字欄位與說明。';
  /** 指紋分階段：每批掃描照片數（較小批次 → 每張特徵較完整） */
  var FINGERPRINT_SCAN_BATCH_SIZE = 4;
  /** 每張照片至少幾個結構特徵值 */
  var MIN_STRUCTURAL_FEATURES = 8;
  /** 低信心重分配最多幾輪 */
  var MAX_REFINE_ITERATIONS = 5;
  /** 空間比對：施工照超過此數量時分批 */
  var MATCH_PHOTO_BATCH_SIZE = 8;

  var PLACEHOLDER_SIGNATURE_PATTERNS = [
    '特徵指紋短句',
    '供跨批比對',
    '40字內',
    '…',
    '...'
  ];

  var DEFAULT_GAS_URL =
    'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';

  var state = {
    floorPlan: null,
    batchPhotos: [],
    spaces: [],
    matchPhotos: [],
    reportPhotos: [],
    lastSpaceMatch: null,
    history: []
  };

  function $(id) { return document.getElementById(id); }

  function showError(msg) {
    var box = $('err-box');
    box.textContent = msg;
    box.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideError() { $('err-box').classList.remove('show'); }

  function isLocalProvider() {
    return ($('provider-mode') && $('provider-mode').value) === 'local';
  }

  function refreshModelSelect(savedModel) {
    var sel = $('param-model');
    var rates = isLocalProvider() ? LOCAL_MODEL_RATES : MODEL_RATES;
    sel.innerHTML = '';
    Object.keys(rates).forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = rates[k].name;
      sel.appendChild(opt);
    });
    var keys = Object.keys(rates);
    var pick = savedModel && rates[savedModel] ? savedModel : keys[0];
    sel.value = pick;
  }

  function toggleProviderUI() {
    var local = isLocalProvider();
    ['gas-fields', 'field-fx'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.toggle('hidden', local);
    });
    var ollamaFields = $('ollama-fields');
    if (ollamaFields) ollamaFields.classList.toggle('hidden', !local);
    var thinkingField = $('field-thinking');
    if (thinkingField) thinkingField.classList.toggle('hidden', local);
    var costHint = $('cost-local-hint');
    if (costHint) costHint.classList.toggle('hidden', !local);
    var maxTokField = $('field-max-tokens');
    if (maxTokField) maxTokField.classList.toggle('hidden', local);
    refreshModelSelect($('param-model').value);
  }

  function parseAiLabJson(text) {
    if (!text) return null;
    var raw = String(text).trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(raw); } catch (e0) {}
    var start = raw.indexOf('{');
    if (start < 0) return null;
    var depth = 0;
    for (var i = start; i < raw.length; i++) {
      if (raw.charAt(i) === '{') depth++;
      else if (raw.charAt(i) === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(raw.substring(start, i + 1)); } catch (e2) { return null; }
        }
      }
    }
    return null;
  }

  function buildBatchFingerprintSystemPrompt() {
    return [
      '你是室內裝修案場的開案空間分析助理。',
      '請一律使用繁體中文。',
      '任務：依平面圖（若有）與全部開案現場照，將照片分類到各空間，並為每個空間產出 spf_v1 視覺指紋。',
      '錨點優先：窗戶位置與型態、樑柱、門洞、管線走向、格局形狀。',
      '禁止把油漆色、已封板完成度等施工後才穩定的特徵當主要錨點。',
      '每張現場照必須分配到某一空間（photoIndices）；僅在無法判斷時放入 unassignedPhotoIndices。',
      '必須產出與使用者指定數量相同個數的 spaces（若名稱提示不足，請合理命名）。',
      '僅回傳一個 JSON 物件，不要 markdown、不要 ```、不要其他文字。'
    ].join('\n');
  }

  function buildBatchFingerprintUserPrompt(ctx) {
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '預期空間數量 spaceCount：' + ctx.spaceCount,
      '空間名稱提示（若有）：' + (ctx.spaceNamesHint || '（無，請自行命名）'),
      '',
      '【附圖順序】',
      ctx.hasFloorPlan
        ? '第 1 張＝平面配置圖；第 2～' + ctx.totalPhotos + ' 張＝開案現場照（photoIndex 從 1 起算，含平面圖）。'
        : '第 1～' + ctx.totalPhotos + ' 張＝開案現場照（photoIndex 從 1 起算）。',
      '現場照共 ' + ctx.sitePhotoCount + ' 張。',
      '',
      '請輸出 spf_batch_v1：',
      '{',
      '  "schema": "spf_batch_v1",',
      '  "spaceCount": ' + ctx.spaceCount + ',',
      '  "spaces": [{',
      '    "roomLabel": "空間名",',
      '    "photoIndices": [2, 5],',
      '    "fingerprint": {',
      '      "schema": "spf_v1",',
      '      "roomLabel": "空間名",',
      '      "anchors": [{"type":"window|beam|pipe|door|other","position":"…","shape":"…","notes":"…"}],',
      '      "layout": {"approxShape":"…","doorCount":0,"adjacentSpaces":[],"distinctiveNotes":"…"},',
      '      "visualCues": ["…"],',
      '      "confidenceNotes": "…"',
      '    }',
      '  }],',
      '  "unassignedPhotoIndices": [],',
      '  "summary": "整體分類與不確定處說明"',
      '}'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充指示 ---', String(ctx.extraPrompt));
    return lines.join('\n');
  }

  function buildFingerprintSystemPrompt() {
    return [
      '你是室內裝修案場的空間視覺分析助理。',
      '請一律使用繁體中文。',
      '任務：為指定空間建立 spf_v1 視覺指紋 JSON。',
      '錨點優先且必寫：窗戶（位置/型態/數量）、門洞（位置/開向）、樑柱（暴露/位置）、管線（天花/牆面走向）、插座（相對門窗位置）。',
      '禁止把油漆色、完成度等施工後才穩定的特徵當主要錨點。',
      '輸出必須完全符合 spf_v1 結構（anchors 陣列、layout 物件、visualCues 陣列），不可自創欄位名稱。',
      '僅回傳一個 JSON 物件，不要 markdown、不要 ```、不要其他文字。'
    ].join('\n');
  }

  function buildFingerprintUserPrompt(ctx) {
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '目標空間名稱 roomLabel：' + (ctx.roomLabel || ''),
      '',
      '【附圖說明】',
      '若有多張圖：第一張為平面配置圖（若有），其後為該空間施工前參考照。',
      '',
      '請輸出符合 spf_v1 的 JSON，結構如下：',
      '{',
      '  "schema": "spf_v1",',
      '  "roomLabel": "空間名",',
      '  "anchors": [{"type":"window|beam|pipe|door|other","position":"…","shape":"…","notes":"…"}],',
      '  "layout": {"approxShape":"…","doorCount":0,"adjacentSpaces":[],"distinctiveNotes":"…"},',
      '  "visualCues": ["…"],',
      '  "confidenceNotes": "與其他空間的差異（若有）"',
      '}'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充指示 ---', String(ctx.extraPrompt));
    return lines.join('\n');
  }

  function buildMatchSystemPrompt() {
    return [
      '你是室內裝修案場的照片空間比對助理。',
      '請一律使用繁體中文。',
      '任務：將施工照片與各空間視覺指紋比對，輸出 spm_v1 JSON。',
      '比對優先結構錨點（窗、樑、管線、門洞），局部照允許較低 confidence。',
      'confidence 為 0～1 的小數；alternatives 最多 2 個。',
      '僅回傳一個 JSON 物件，不要 markdown、不要 ```、不要其他文字。'
    ].join('\n');
  }

  function buildMatchUserPrompt(ctx) {
    var fpText = '[]';
    try { fpText = JSON.stringify(ctx.fingerprints || [], null, 0); } catch (e0) {}
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '',
      '【本案空間指紋列表】',
      fpText,
      '',
      '【附圖】依上傳順序為待比對施工照（photoIndex 從 1 起算）。',
      '',
      '請輸出 spm_v1：',
      '{',
      '  "schema": "spm_v1",',
      '  "photos": [{',
      '    "photoIndex": 1,',
      '    "topMatch": {"roomLabel":"…","confidence":0.0},',
      '    "alternatives": [{"roomLabel":"…","confidence":0.0}],',
      '    "matchMethod": "ai"',
      '  }],',
      '  "needsHumanReview": false',
      '}'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充指示 ---', String(ctx.extraPrompt));
    return lines.join('\n');
  }

  function buildSiteReportSystemPrompt() {
    return [
      '# 角色',
      '你是施工現場分析助理。只描述照片中可見事實，不推測意圖，不含寒暄。',
      '請一律使用繁體中文。',
      '',
      '# 輸出',
      '僅回傳一個 JSON 物件；禁止 markdown 程式碼區塊。',
      '',
      '# 看圖邏輯',
      '審查：木作骨架、系統櫃、水電配管、成品保護。',
      '施工期正常（不要當缺失）：釘孔未補、接縫未批土、插座未裝、粉塵木屑、通道暫堆料。',
      '有把握才警告：保護未做、骨架明顯下陷歪斜、需立即處理的安全問題。',
      '',
      '# JSON 結構',
      '{',
      '  "photo_observations":[{"photo_index":1,"description":"40字內客觀描述"}],',
      '  "text_photo_consistency":{"match":true,"report_quote":"…","note":"…"},',
      '  "phase_detected":"施工階段",',
      '  "phase_confidence":"high|medium|low",',
      '  "quality_observations":[{"issue":"…","severity":"high|medium|low","photo_indices":[1]}],',
      '  "problem_photos_reviewed":true,',
      '  "limitations":[],',
      '  "suggested_signal":"green|yellow|red",',
      '  "confidence":"high|medium|low"',
      '}'
    ].join('\n');
  }

  function buildSiteReportUserPrompt(ctx) {
    var lines = [
      '--- 回報內容 ---',
      '案號：' + (ctx.projectNo || ''),
      '施工項目：' + (ctx.workType || '（無）'),
      '施工內容：' + (ctx.workDescription || '（無）'),
      '問題回報：' + (ctx.problemDescription || '（無）'),
      '',
      '--- 照片 ---',
      '共 ' + (ctx.photoCount || 0) + ' 張，索引 1～' + (ctx.photoCount || 0)
    ];
    if (ctx.spaceMatchJson) lines.push('', '--- 空間比對參考（若有）---', String(ctx.spaceMatchJson));
    if (ctx.extraPrompt) lines.push('', '--- 補充指示 ---', String(ctx.extraPrompt));
    return lines.join('\n');
  }

  function applyMatchThresholds(parsed, params) {
    if (!parsed || !parsed.photos) return parsed;
    var high = parseFloat(params.confidenceHigh);
    var low = parseFloat(params.confidenceLow);
    if (isNaN(high)) high = 0.75;
    if (isNaN(low)) low = 0.45;
    var needsReview = false;
    parsed.photos.forEach(function (p) {
      var c = p.topMatch && p.topMatch.confidence != null ? parseFloat(p.topMatch.confidence) : 0;
      if (c < high) needsReview = true;
      p._band = c >= high ? 'high' : (c >= low ? 'medium' : 'low');
    });
    parsed.needsHumanReview = needsReview;
    parsed._thresholds = { confidence_high: high, confidence_low: low };
    return parsed;
  }

  function photoToOllamaPart(photo) {
    var b64 = photo.data_base64 || photo.dataBase64 || '';
    var mime = photo.mime_type || photo.mimeType || 'image/jpeg';
    if (b64.indexOf(',') >= 0) b64 = b64.split(',')[1];
    return {
      type: 'image_url',
      image_url: { url: 'data:' + mime + ';base64,' + b64 }
    };
  }

  function callOllamaVision(systemPrompt, userPrompt, photos, params) {
    var base = ($('ollama-url') && $('ollama-url').value.trim()) || DEFAULT_OLLAMA_URL;
    var url = base.replace(/\/$/, '') + '/chat/completions';
    var content = [{ type: 'text', text: userPrompt }];
    (photos || []).forEach(function (p) {
      if (p && (p.data_base64 || p.dataBase64)) content.push(photoToOllamaPart(p));
    });
    var body = {
      model: params.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      stream: false,
      temperature: params.temperature != null ? params.temperature : 0.1
    };
    if (isLocalProvider()) {
      // 本機 Ollama：不設 max_tokens，避免輸出被截斷
      body.options = { num_predict: -1 };
    } else {
      body.max_tokens = params.maxOutputTokens || 4096;
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var errMsg = (json && json.error && json.error.message) || ('HTTP ' + res.status);
          throw new Error('Ollama：' + errMsg);
        }
        return json;
      });
    }).then(function (json) {
      var text = '';
      try {
        text = String(json.choices[0].message.content || '');
      } catch (e1) {}
      if (!text) throw new Error('Ollama 回傳為空');
      var usage = json.usage || {};
      return {
        model: params.model,
        response_text: text,
        parsed: parseAiLabJson(text),
        usage: {
          prompt_token_count: parseInt(usage.prompt_tokens, 10) || 0,
          candidates_token_count: parseInt(usage.completion_tokens, 10) || 0,
          total_token_count: parseInt(usage.total_tokens, 10) || 0
        }
      };
    });
  }

  function getExtraPrompt() {
    var extra = $('extra-prompt').value.trim();
    if (!extra) return DEFAULT_EXTRA_PROMPT;
    if (extra.indexOf('繁體中文') >= 0) return extra;
    return extra + '\n' + DEFAULT_EXTRA_PROMPT;
  }

  function loadSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem('tx_space_ai_lab_settings') || '{}'); } catch (e) {}
    $('provider-mode').value = s.provider || 'local';
    $('ollama-url').value = s.ollamaUrl || DEFAULT_OLLAMA_URL;
    $('gas-url').value = s.gasUrl || DEFAULT_GAS_URL;
    $('ingest-secret').value = s.secret || '';
    $('dev-bypass').checked = s.devBypass !== false;
    $('param-thinking').value = s.thinking != null ? s.thinking : 0;
    $('param-max-tokens').value = s.maxTokens || 4096;
    $('param-temperature').value = s.temperature != null ? s.temperature : 0.1;
    $('param-conf-high').value = s.confHigh != null ? s.confHigh : 0.75;
    $('param-conf-low').value = s.confLow != null ? s.confLow : 0.45;
    $('param-fx').value = s.fx || 32.5;
    $('param-img-max').value = s.imgMax || 1280;
    $('extra-prompt').value = s.extraPrompt != null ? s.extraPrompt : DEFAULT_EXTRA_PROMPT;
    $('project-no').value = s.projectNo || '';
    if ($('space-count')) $('space-count').value = s.spaceCount != null ? s.spaceCount : 4;
    if ($('space-names-hint')) $('space-names-hint').value = s.spaceNamesHint || '';
    refreshModelSelect(s.model);
    toggleProviderUI();
  }

  function saveSettings() {
    var data = {
      provider: $('provider-mode').value,
      ollamaUrl: $('ollama-url').value.trim(),
      gasUrl: $('gas-url').value.trim(),
      secret: $('ingest-secret').value.trim(),
      devBypass: $('dev-bypass').checked,
      model: $('param-model').value,
      thinking: parseInt($('param-thinking').value, 10),
      maxTokens: parseInt($('param-max-tokens').value, 10),
      temperature: parseFloat($('param-temperature').value),
      confHigh: parseFloat($('param-conf-high').value),
      confLow: parseFloat($('param-conf-low').value),
      fx: parseFloat($('param-fx').value),
      imgMax: parseInt($('param-img-max').value, 10),
      extraPrompt: $('extra-prompt').value.trim(),
      projectNo: $('project-no').value.trim(),
      spaceCount: parseInt($('space-count') && $('space-count').value, 10) || 4,
      spaceNamesHint: ($('space-names-hint') && $('space-names-hint').value.trim()) || ''
    };
    localStorage.setItem('tx_space_ai_lab_settings', JSON.stringify(data));
    alert('設定已儲存');
  }

  function getParams() {
    var p = {
      model: $('param-model').value,
      thinkingBudget: parseInt($('param-thinking').value, 10),
      temperature: parseFloat($('param-temperature').value),
      confidenceHigh: parseFloat($('param-conf-high').value),
      confidenceLow: parseFloat($('param-conf-low').value)
    };
    if (!isLocalProvider()) {
      p.maxOutputTokens = parseInt($('param-max-tokens').value, 10) || 4096;
    }
    return p;
  }

  function updateBatchPhotoHint() {
    var el = $('batch-photo-hint');
    if (!el) return;
    var n = state.batchPhotos.length;
    if (!n) {
      el.textContent = '建議一次上傳全部開案照；執行時每 ' + FINGERPRINT_SCAN_BATCH_SIZE + ' 張一批掃描（每張 ≥' + MIN_STRUCTURAL_FEATURES + ' 結構特徵），再依特徵比對分群定案。';
      return;
    }
    el.textContent = '已上傳 ' + n + ' 張。執行時每 ' + FINGERPRINT_SCAN_BATCH_SIZE + ' 張一批掃描（每張 ≥' + MIN_STRUCTURAL_FEATURES + ' 特徵：樑柱門窗、插座相對位置），再分群、重分配、定案 spf_v1；右側 JSON 即時記錄。';
  }

  function applyBatchFingerprintResult(batch) {
    if (!batch || !batch.spaces || !batch.spaces.length) {
      throw new Error('AI 未回傳任何空間指紋');
    }
    state.spaces = batch.spaces.map(function (item, idx) {
      var fp = item.fingerprint || item;
      if (typeof fp === 'string') {
        try { fp = JSON.parse(fp); } catch (e) { fp = {}; }
      }
      if (!fp.schema) fp.schema = 'spf_v1';
      if (!fp.roomLabel) fp.roomLabel = item.roomLabel || fp.roomLabel || ('空間 ' + (idx + 1));
      fp = normalizeSpfV1Fingerprint(fp, {
        projectNo: ($('project-no') && $('project-no').value.trim()) || fp.caseNumber || '',
        roomLabel: fp.roomLabel,
        photoIndices: item.photoIndices || fp.photoIndices || [],
        featureTheme: '',
        groupFeatures: []
      });
      return {
        id: 'sp_' + Date.now() + '_' + idx,
        roomLabel: item.roomLabel || fp.roomLabel,
        photoIndices: item.photoIndices || [],
        refPhotos: [],
        fingerprint: fp,
        status: 'ready'
      };
    });
    renderSpaces();
    saveSession();
    refreshFpSummary();
    return batch;
  }

  function mergeMatchResults(parts) {
    var merged = { schema: 'spm_v1', photos: [], needsHumanReview: false };
    parts.forEach(function (part) {
      if (!part || !part.photos) return;
      part.photos.forEach(function (p) { merged.photos.push(p); });
      if (part.needsHumanReview) merged.needsHumanReview = true;
    });
    merged.photos.sort(function (a, b) {
      return (a.photoIndex || 0) - (b.photoIndex || 0);
    });
    return merged;
  }

  function sumUsage(list) {
    var u = { prompt_token_count: 0, candidates_token_count: 0, total_token_count: 0 };
    (list || []).forEach(function (item) {
      var usage = item && item.usage;
      if (!usage) return;
      u.prompt_token_count += usage.prompt_token_count || usage.prompt_tokens || 0;
      u.candidates_token_count += usage.candidates_token_count || usage.completion_tokens || 0;
      u.total_token_count += usage.total_token_count || usage.total_tokens || 0;
    });
    return u;
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem('tx_space_ai_lab_session');
      if (!raw) return;
      var sess = JSON.parse(raw);
      if (sess.spaces) state.spaces = sess.spaces;
      if (sess.lastSpaceMatch) state.lastSpaceMatch = sess.lastSpaceMatch;
      if (sess.history) state.history = sess.history;
      if (sess.batchPhotos) state.batchPhotos = sess.batchPhotos;
    } catch (e) {}
    renderSpaces();
    renderHistory();
    refreshFpSummary();
    updateBatchPhotoHint();
    renderThumbs('thumb-batch-photos', state.batchPhotos, function (idx) {
      state.batchPhotos.splice(idx, 1);
      renderThumbs('thumb-batch-photos', state.batchPhotos, arguments.callee);
      updateBatchPhotoHint();
      saveSession();
    });
  }

  function saveSession() {
    localStorage.setItem('tx_space_ai_lab_session', JSON.stringify({
      batchPhotos: state.batchPhotos.map(function (p) {
        return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id, name: p.name, preview: p.preview };
      }),
      spaces: state.spaces.map(function (sp) {
        return {
          id: sp.id,
          roomLabel: sp.roomLabel,
          fingerprint: sp.fingerprint,
          status: sp.status
        };
      }),
      lastSpaceMatch: state.lastSpaceMatch,
      history: state.history.slice(0, 50)
    }));
  }

  function resizeImageFile(file, maxWidth) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          if (w > maxWidth) {
            h = Math.round(h * maxWidth / w);
            w = maxWidth;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({
            data_base64: dataUrl.split(',')[1],
            mime_type: 'image/jpeg',
            preview: dataUrl,
            name: file.name
          });
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function imgMax() {
    return parseInt($('param-img-max').value, 10) || 1280;
  }

  function renderThumbs(containerId, photos, onRemove) {
    var el = $(containerId);
    el.innerHTML = '';
    photos.forEach(function (p, idx) {
      var div = document.createElement('div');
      div.className = 'thumb';
      div.innerHTML = '<img src="' + (p.preview || ('data:' + p.mime_type + ';base64,' + p.data_base64)) + '" alt="">' +
        '<button type="button" title="移除">&times;</button>';
      div.querySelector('button').onclick = function (e) {
        e.stopPropagation();
        onRemove(idx);
      };
      el.appendChild(div);
    });
  }

  function setupFileUpload(uploadId, inputId, thumbId, targetArr, single) {
    $(uploadId).onclick = function () { $(inputId).click(); };
    $(inputId).onchange = function (ev) {
      var files = Array.from(ev.target.files || []);
      if (!files.length) return;
      if (single) targetArr.length = 0;
      var pending = files.map(function (f) { return resizeImageFile(f, imgMax()); });
      Promise.all(pending).then(function (items) {
        items.forEach(function (item) {
          item.photo_id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          targetArr.push(item);
        });
        renderThumbs(thumbId, targetArr, function (idx) {
          targetArr.splice(idx, 1);
          renderThumbs(thumbId, targetArr, arguments.callee);
        });
        ev.target.value = '';
      }).catch(function (err) {
        showError('圖片處理失敗：' + err.message);
      });
    };
  }

  function renderSpaces() {
    var list = $('space-list');
    list.innerHTML = '';
    if (!state.spaces.length) {
      list.innerHTML = '<p class="step-hint">尚無指紋。填空間數、上傳照片後按「AI 一次產出全部指紋」。</p>';
      return;
    }
    state.spaces.forEach(function (sp, idx) {
      var div = document.createElement('div');
      div.className = 'space-item';
      var badge = sp.fingerprint
        ? '<span class="badge badge-ok">已建指紋</span>'
        : '<span class="badge badge-muted">未建指紋</span>';
      var photoHint = (sp.photoIndices && sp.photoIndices.length)
        ? ('<p class="step-hint" style="margin:0.25rem 0">AI 分類照片 #' + sp.photoIndices.join(', #') + '</p>')
        : '';
      div.innerHTML =
        '<header>' +
          '<strong>' + escapeHtml(sp.roomLabel || '未命名') + '</strong>' +
          badge +
        '</header>' +
        photoHint +
        '<div class="field" style="margin-bottom:0.4rem">' +
          '<label>空間名稱</label>' +
          '<input type="text" data-idx="' + idx + '" class="space-label-input" value="' + escapeHtml(sp.roomLabel || '') + '">' +
        '</div>' +
        '<div class="field" style="margin-bottom:0.35rem">' +
          '<label>施工前參考照（' + (sp.refPhotos ? sp.refPhotos.length : 0) + ' 張，進階補強用）</label>' +
          '<div class="upload space-upload" data-idx="' + idx + '">上傳參考照</div>' +
          '<div class="thumbs space-thumbs" data-idx="' + idx + '"></div>' +
        '</div>' +
        '<div class="inline-btns">' +
          '<button type="button" class="btn btn-secondary btn-gen-one" data-idx="' + idx + '">重新產生此空間</button>' +
          '<button type="button" class="btn btn-secondary btn-del-space" data-idx="' + idx + '">刪除</button>' +
        '</div>';
      list.appendChild(div);

      if (!sp.refPhotos) sp.refPhotos = [];
      var thumbEl = div.querySelector('.space-thumbs');
      thumbEl.innerHTML = '';
      sp.refPhotos.forEach(function (p, pi) {
        var t = document.createElement('div');
        t.className = 'thumb';
        t.innerHTML = '<img src="' + (p.preview || '') + '"><button type="button">&times;</button>';
        t.querySelector('button').onclick = function () {
          sp.refPhotos.splice(pi, 1);
          renderSpaces();
          saveSession();
        };
        thumbEl.appendChild(t);
      });
    });

    list.querySelectorAll('.space-label-input').forEach(function (inp) {
      inp.onchange = function () {
        var i = parseInt(inp.getAttribute('data-idx'), 10);
        state.spaces[i].roomLabel = inp.value.trim();
        saveSession();
      };
    });

    list.querySelectorAll('.space-upload').forEach(function (up) {
      up.onclick = function () {
        var i = parseInt(up.getAttribute('data-idx'), 10);
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = function (ev) {
          var files = Array.from(ev.target.files || []);
          Promise.all(files.map(function (f) { return resizeImageFile(f, imgMax()); }))
            .then(function (items) {
              state.spaces[i].refPhotos = state.spaces[i].refPhotos || [];
              items.forEach(function (it) { state.spaces[i].refPhotos.push(it); });
              renderSpaces();
              saveSession();
            });
        };
        input.click();
      };
    });

    list.querySelectorAll('.btn-gen-one').forEach(function (btn) {
      btn.onclick = function () {
        runFingerprint(parseInt(btn.getAttribute('data-idx'), 10));
      };
    });

    list.querySelectorAll('.btn-del-space').forEach(function (btn) {
      btn.onclick = function () {
        var i = parseInt(btn.getAttribute('data-idx'), 10);
        state.spaces.splice(i, 1);
        renderSpaces();
        saveSession();
        refreshFpSummary();
      };
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function addSpace() {
    state.spaces.push({
      id: 'sp_' + Date.now(),
      roomLabel: '空間 ' + (state.spaces.length + 1),
      refPhotos: [],
      fingerprint: null,
      status: 'draft'
    });
    renderSpaces();
    saveSession();
  }

  function getReadyFingerprints() {
    return state.spaces
      .filter(function (sp) { return sp.fingerprint; })
      .map(function (sp) {
        var fp = sp.fingerprint;
        if (typeof fp === 'object') return fp;
        try { return JSON.parse(fp); } catch (e) { return null; }
      })
      .filter(Boolean);
  }

  function refreshFpSummary() {
    var fps = getReadyFingerprints();
    document.querySelectorAll('.fp-count-el').forEach(function (el) {
      el.textContent = String(fps.length);
    });
    var summaryEl = $('fp-summary');
    if (summaryEl) {
      summaryEl.textContent = fps.length
        ? fps.map(function (f) { return f.roomLabel || '？'; }).join('、')
        : '請先在「開案指紋」建立至少一個空間指紋';
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
    var url = $('gas-url').value.trim() || DEFAULT_GAS_URL;
    var body = Object.assign({ action: action }, buildAuthPayload(), payload);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }

  function updateCostPanel(usage, model) {
    if (!usage) return;
    var rates = isLocalProvider()
      ? (LOCAL_MODEL_RATES[model] || { input: 0, output: 0, name: model })
      : (MODEL_RATES[model] || { input: 0.3, output: 2.5, name: model });
    var fx = parseFloat($('param-fx').value) || 32.5;
    var inTok = usage.prompt_token_count || 0;
    var outTok = usage.candidates_token_count || 0;
    var usd = (inTok / 1e6) * rates.input + (outTok / 1e6) * rates.output;
    var twd = usd * fx;
    $('tok-in').textContent = inTok.toLocaleString();
    $('tok-out').textContent = outTok.toLocaleString();
    $('cost-usd').textContent = isLocalProvider() ? '本機 $0' : ('$' + usd.toFixed(6));
    $('cost-twd').textContent = isLocalProvider() ? '本機 NT$ 0' : ('NT$ ' + twd.toFixed(4));
    $('cost-model').textContent = rates.name || model;
    return { usd: usd, twd: twd, inTok: inTok, outTok: outTok };
  }

  function analyzeLocal(mode, payload) {
    var params = getParams();
    var extra = getExtraPrompt();
    var projectNo = $('project-no').value.trim();

    if (mode === 'space_fingerprint_batch') {
      var imageParts = [];
      if (payload.floor_plan) imageParts.push(payload.floor_plan);
      (payload.site_photos || []).forEach(function (p) { imageParts.push(p); });
      var siteCount = (payload.site_photos || []).length;
      var totalPhotos = imageParts.length;
      return callOllamaVision(
        buildBatchFingerprintSystemPrompt(),
        buildBatchFingerprintUserPrompt({
          projectNo: projectNo,
          spaceCount: payload.space_count,
          spaceNamesHint: payload.space_names_hint || '',
          hasFloorPlan: !!payload.floor_plan,
          sitePhotoCount: siteCount,
          totalPhotos: totalPhotos,
          extraPrompt: extra
        }),
        imageParts,
        params
      ).then(function (metrics) {
        if (!metrics.parsed) {
          var errB = new Error('AI 回傳非 JSON（可能被截斷，可減少照片或改用較大模型）');
          errB.raw_text = metrics.response_text;
          throw errB;
        }
        if (!metrics.parsed.schema) metrics.parsed.schema = 'spf_batch_v1';
        return {
          success: true,
          mode: 'space_fingerprint_batch',
          batch: metrics.parsed,
          raw_text: metrics.response_text,
          usage: metrics.usage,
          model: metrics.model
        };
      });
    }

    if (mode === 'space_fingerprint') {
      var refPhotos = payload.reference_photos || [];
      var imageParts = [];
      if (payload.floor_plan) imageParts.push(payload.floor_plan);
      refPhotos.forEach(function (p) { imageParts.push(p); });
      return callOllamaVision(
        buildFingerprintSystemPrompt(),
        buildFingerprintUserPrompt({
          projectNo: projectNo,
          roomLabel: payload.room_label,
          extraPrompt: extra
        }),
        imageParts,
        params
      ).then(function (metrics) {
        if (!metrics.parsed) {
          var err = new Error('AI 回傳非 JSON');
          err.raw_text = metrics.response_text;
          throw err;
        }
        if (!metrics.parsed.schema) metrics.parsed.schema = 'spf_v1';
        if (!metrics.parsed.roomLabel) metrics.parsed.roomLabel = payload.room_label;
        return {
          success: true,
          mode: 'space_fingerprint',
          room_label: payload.room_label,
          fingerprint: metrics.parsed,
          raw_text: metrics.response_text,
          usage: metrics.usage,
          model: metrics.model
        };
      });
    }

    if (mode === 'space_match') {
      var matchPhotos = payload.match_photos || [];
      var batchSize = payload._batch_size || matchPhotos.length;
      var batchOffset = payload._batch_offset || 0;
      return callOllamaVision(
        buildMatchSystemPrompt(),
        buildMatchUserPrompt({
          projectNo: projectNo,
          fingerprints: payload.fingerprints,
          extraPrompt: extra + (batchOffset > 0
            ? '\n本批為施工照第 ' + (batchOffset + 1) + '～' + (batchOffset + matchPhotos.length) + ' 張；photoIndex 請從 ' + (batchOffset + 1) + ' 起算。'
            : '')
        }),
        matchPhotos,
        params
      ).then(function (metrics) {
        if (!metrics.parsed) {
          var errM = new Error('AI 回傳非 JSON');
          errM.raw_text = metrics.response_text;
          throw errM;
        }
        return {
          success: true,
          mode: 'space_match',
          space_match: applyMatchThresholds(metrics.parsed, params),
          raw_text: metrics.response_text,
          usage: metrics.usage,
          model: metrics.model
        };
      });
    }

    if (mode === 'site_report') {
      var photos = payload.photos || [];
      var spaceMatchJson = '';
      if (payload.space_match) {
        try {
          spaceMatchJson = typeof payload.space_match === 'string'
            ? payload.space_match
            : JSON.stringify(payload.space_match);
        } catch (eSm) { spaceMatchJson = ''; }
      }
      return callOllamaVision(
        buildSiteReportSystemPrompt(),
        buildSiteReportUserPrompt({
          projectNo: projectNo,
          workType: payload.work_type,
          workDescription: payload.work_description,
          problemDescription: payload.problem_description,
          photoCount: photos.length,
          spaceMatchJson: spaceMatchJson,
          extraPrompt: extra
        }),
        photos,
        params
      ).then(function (metrics) {
        if (!metrics.parsed) {
          var errR = new Error('AI 回傳非 JSON');
          errR.raw_text = metrics.response_text;
          throw errR;
        }
        return {
          success: true,
          mode: 'site_report',
          report: metrics.parsed,
          raw_text: metrics.response_text,
          usage: metrics.usage,
          model: metrics.model
        };
      });
    }

    return Promise.reject(new Error('未知 mode'));
  }

  function postAnalyze(mode, payload) {
    if (isLocalProvider()) return analyzeLocal(mode, payload);
    if (mode === 'space_fingerprint_batch') {
      return Promise.reject(new Error('「一次產出全部指紋」目前僅支援本機 Ollama；雲端請改用進階「單一空間補強」。'));
    }
    return postGas('ai_lab_analyze', Object.assign({ mode: mode }, payload));
  }

  function showJsonOutput(obj) {
    $('output-json').textContent = typeof obj === 'string'
      ? obj
      : JSON.stringify(obj, null, 2);
  }

  function pushHistory(entry) {
    state.history.unshift(entry);
    if (state.history.length > 50) state.history.length = 50;
    saveSession();
    renderHistory();
  }

  function renderHistory() {
    var tbody = $('history-body');
    if (!state.history.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--muted)">尚無紀錄</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    state.history.forEach(function (h, idx) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(h.time) + '</td>' +
        '<td>' + escapeHtml(h.mode) + '</td>' +
        '<td>' + (h.tokens || 0).toLocaleString() + '</td>' +
        '<td>NT$ ' + (h.twd || 0).toFixed(4) + '</td>';
      tr.onclick = function () {
        showJsonOutput(h.result);
        if (h.usage) updateCostPanel(h.usage, h.model);
      };
      tbody.appendChild(tr);
    });
  }

  function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> 處理中…'
      : label;
  }

  function chunkArray(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function photoPayloadFromState(photos) {
    return (photos || []).map(function (p) {
      return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id, filename: p.name };
    });
  }

  function setPipelineStatus(msg) {
    var el = $('pipeline-status');
    if (!el) return;
    if (!msg) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    el.classList.remove('hidden');
    el.textContent = msg;
  }

  function showPipelineOutput(pipeline) {
    showJsonOutput(pipeline);
  }

  function appendPipelineStep(pipeline, entry) {
    pipeline.pipelineLog.push(entry);
    pipeline.totalSteps = pipeline.pipelineLog.length;
    showPipelineOutput(pipeline);
  }

  function buildPhaseScanSystemPrompt() {
    return [
      '你是室內裝修案場的開案照片「結構特徵掃描」助理。',
      '請一律使用繁體中文。',
      '任務：逐張分析現場照，每張必須產出至少 ' + MIN_STRUCTURAL_FEATURES + ' 個可量化的結構特徵值。',
      '優先辨識：窗戶、門洞、樑、柱、管線、格局形狀；插座須寫「相對於門/窗/樑」的位置。',
      'structuralFeatures 每一項都要寫 category、element、position、relativeTo、detail（不可空、不可複製範例文字）。',
      'featureVectorKey 為本張照片的特徵摘要鍵（例如「左側大窗+右側門洞+天花明管+門左下插座」），禁止輸出「特徵指紋短句」等占位符。',
      '禁止把油漆色、完成度當主要特徵。',
      '僅回傳一個 JSON 物件，不要 markdown、不要 ```。'
    ].join('\n');
  }

  function buildPhaseScanUserPrompt(ctx) {
    var featExample = [
      '{"category":"window","element":"橫拉窗","position":"畫面左側佔1/3","relativeTo":"門洞在其右側約1m","detail":"三扇橫拉、窗框白色","confidence":0.9}',
      '{"category":"door","element":"單開門洞","position":"畫面右側","relativeTo":"窗在其左","detail":"無門片、可見門框","confidence":0.85}',
      '{"category":"beam","element":"天花樑","position":"畫面上方橫跨","relativeTo":"窗上方","detail":"混凝土樑暴露","confidence":0.8}',
      '{"category":"pipe","element":"PVC管","position":"天花","relativeTo":"沿樑底走","detail":"白色排水管","confidence":0.75}',
      '{"category":"socket","element":"雙孔插座","position":"門洞左側牆面","relativeTo":"距門框約30cm、高度約30cm","detail":"白面板","confidence":0.85}',
      '{"category":"column","element":"柱角","position":"畫面左後方","relativeTo":"窗與門之間","detail":"直角柱、貼齊牆","confidence":0.7}',
      '{"category":"layout","element":"長方形格局","position":"整體","relativeTo":"—","detail":"窄長型、深度大於寬度","confidence":0.75}',
      '{"category":"other","element":"配電箱","position":"畫面右下","relativeTo":"遠離窗門","detail":"金屬箱門微開","confidence":0.8}'
    ].join(',\n    ');
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '目標空間數：' + ctx.spaceCount,
      '本批：第 ' + ctx.batchIndex + ' / ' + ctx.totalBatches + ' 批',
      '本批現場照 global photoIndex：' + ctx.globalPhotoStart + '～' + ctx.globalPhotoEnd + '（共 ' + ctx.batchPhotoCount + ' 張，每張都要輸出）',
      ctx.hasFloorPlan ? '附圖第 1 張為平面配置圖（不計入 photoIndex）。' : '本批無平面圖。',
      '',
      '【前批特徵鍵摘要（供跨批比對，勿重複照抄）】',
      ctx.priorVectorKeys || '（首批）',
      '',
      '輸出 spp_scan_v1（photos 陣列長度必須等於本批現場照張數 ' + ctx.batchPhotoCount + '）：',
      '{',
      '  "schema": "spp_scan_v1",',
      '  "batchIndex": ' + ctx.batchIndex + ',',
      '  "photos": [{',
      '    "photoIndex": ' + ctx.globalPhotoStart + ',',
      '    "featureSummary": "本張整體空間描述（60字內）",',
      '    "featureVectorKey": "左窗+右門+天花明管+門左插座（依實際填寫）",',
      '    "structuralFeatures": [',
      '    ' + featExample,
      '    ],',
      '    "anchorTags": ["window","door","beam","pipe","socket"],',
      '    "confidence": 0.85,',
      '    "confidenceLevel": "high|medium|low",',
      '    "suggestedAction": "keep|defer|reassign"',
      '  }],',
      '  "batchNotes": "本批整體觀察",',
      '  "suggestedNextStep": "continue_scan|cluster|refine",',
      '  "suggestedNextStepReason": "為何建議下一步"',
      '}'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充 ---', ctx.extraPrompt);
    return lines.join('\n');
  }


  function isPlaceholderText(text) {
    var s = String(text || '').trim();
    if (!s) return true;
    for (var i = 0; i < PLACEHOLDER_SIGNATURE_PATTERNS.length; i++) {
      if (s.indexOf(PLACEHOLDER_SIGNATURE_PATTERNS[i]) >= 0) return true;
    }
    return false;
  }

  function mapCategoryToAnchorType(cat) {
    var c = String(cat || '').toLowerCase();
    if (c === 'window') return 'window';
    if (c === 'door') return 'door';
    if (c === 'beam') return 'beam';
    if (c === 'pipe') return 'pipe';
    if (c === 'column') return 'column';
    if (c === 'socket') return 'socket';
    return 'other';
  }

  function normalizeStructuralFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (sf, idx) {
      return {
        id: sf.id || ('f' + (idx + 1)),
        category: sf.category || 'other',
        element: sf.element || '',
        position: sf.position || '',
        relativeTo: sf.relativeTo || '',
        detail: sf.detail || '',
        confidence: sf.confidence != null ? sf.confidence : 0.7
      };
    }).filter(function (sf) {
      return sf.element || sf.position || sf.detail;
    });
  }

  function normalizePhotoScanRecord(p, globalStart, localIdx, batchIndex) {
    var gi = p.photoIndex != null ? parseInt(p.photoIndex, 10) : (globalStart + localIdx);
    var structuralFeatures = normalizeStructuralFeatures(p.structuralFeatures);
    var vectorKey = p.featureVectorKey || p.featureSignature || '';
    if (isPlaceholderText(vectorKey)) vectorKey = '';
    var quality = structuralFeatures.length >= MIN_STRUCTURAL_FEATURES && vectorKey ? 'ok' : 'low';
    return {
      photoIndex: gi,
      featureSummary: p.featureSummary || '',
      featureVectorKey: vectorKey,
      structuralFeatures: structuralFeatures,
      anchorTags: p.anchorTags || [],
      featureSignature: vectorKey,
      confidence: p.confidence != null ? p.confidence : (quality === 'ok' ? 0.85 : 0.5),
      confidenceLevel: p.confidenceLevel || (quality === 'ok' ? 'high' : 'low'),
      suggestedAction: p.suggestedAction || (quality === 'ok' ? 'keep' : 'defer'),
      needsRescan: quality !== 'ok',
      featureCount: structuralFeatures.length,
      fromBatch: batchIndex
    };
  }

  function buildPriorVectorKeysSummary(photoFeatures, limit) {
    var slice = (photoFeatures || []).slice(-(limit || 12));
    if (!slice.length) return '（首批）';
    return slice.map(function (p) {
      var key = p.featureVectorKey || p.featureSignature || '(無鍵)';
      var tags = (p.anchorTags || []).join(',');
      var n = (p.structuralFeatures || []).length;
      return '#' + p.photoIndex + ':' + key + ' [' + tags + '] (' + n + '特徵)';
    }).join('\n');
  }

  function buildCompactFeaturesForCluster(photoFeatures) {
    return (photoFeatures || []).map(function (p) {
      return {
        photoIndex: p.photoIndex,
        featureVectorKey: p.featureVectorKey || p.featureSignature || '',
        anchorTags: p.anchorTags || [],
        structuralFeatures: (p.structuralFeatures || []).map(function (sf) {
          return {
            category: sf.category,
            element: sf.element,
            position: sf.position,
            relativeTo: sf.relativeTo
          };
        }),
        confidence: p.confidence,
        confidenceLevel: p.confidenceLevel,
        needsRescan: !!p.needsRescan
      };
    });
  }

  function getAssignedPhotoIndices(cluster) {
    var set = {};
    (cluster.provisionalGroups || []).forEach(function (g) {
      (g.photoIndices || []).forEach(function (idx) { set[idx] = true; });
    });
    return Object.keys(set).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
  }

  function getUnassignedPhotoIndices(totalPhotos, cluster) {
    var assigned = {};
    getAssignedPhotoIndices(cluster).forEach(function (i) { assigned[i] = true; });
    var out = [];
    for (var i = 1; i <= totalPhotos; i++) {
      if (!assigned[i]) out.push(i);
    }
    return out;
  }

  function validateAndFixClusterCoverage(cluster, totalPhotos) {
    var unassigned = getUnassignedPhotoIndices(totalPhotos, cluster);
    if (!unassigned.length) return cluster;
    cluster.needsRefinementPass = true;
    cluster.lowConfidencePhotos = cluster.lowConfidencePhotos || [];
    unassigned.forEach(function (idx) {
      var exists = cluster.lowConfidencePhotos.some(function (p) { return p.photoIndex === idx; });
      if (!exists) {
        cluster.lowConfidencePhotos.push({
          photoIndex: idx,
          reason: '未分配至任何群組，需依 structuralFeatures 重新歸類',
          suggestedAction: 'reassign',
          targetGroupId: null
        });
      }
    });
    cluster.coverageWarning = '尚有 ' + unassigned.length + ' 張未分配：#' + unassigned.join(', #');
    return cluster;
  }

  function getRefineFocusIndices(cluster, totalPhotos, photoFeatures) {
    var focus = {};
    (cluster.lowConfidencePhotos || []).forEach(function (p) {
      if (p.photoIndex) focus[p.photoIndex] = true;
    });
    getUnassignedPhotoIndices(totalPhotos, cluster).forEach(function (idx) { focus[idx] = true; });
    (photoFeatures || []).forEach(function (p) {
      if (p.needsRescan || (p.structuralFeatures || []).length < MIN_STRUCTURAL_FEATURES) {
        focus[p.photoIndex] = true;
      }
    });
    return Object.keys(focus).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
  }

  function anchorsFromGroupFeatures(groupFeatures) {
    var anchors = [];
    var seen = {};
    (groupFeatures || []).forEach(function (pf) {
      (pf.structuralFeatures || []).forEach(function (sf) {
        var key = [sf.category, sf.element, sf.position].join('|');
        if (seen[key]) return;
        seen[key] = true;
        anchors.push({
          type: mapCategoryToAnchorType(sf.category),
          position: sf.position || '',
          shape: sf.element || '',
          notes: [sf.relativeTo, sf.detail].filter(Boolean).join('；')
        });
      });
    });
    return anchors;
  }

  function isValidSpfV1(fp) {
    return fp && fp.schema === 'spf_v1' &&
      Array.isArray(fp.anchors) && fp.anchors.length >= 3 &&
      fp.layout && typeof fp.layout === 'object' &&
      Array.isArray(fp.visualCues);
  }

  function normalizeSpfV1Fingerprint(fp, ctx) {
    var raw = fp || {};
    if (raw.spf_v1 && typeof raw.spf_v1 === 'object' && !Array.isArray(raw.anchors)) {
      raw = Object.assign({}, raw, raw.spf_v1);
    }
    var groupFeatures = ctx.groupFeatures || [];
    var out = {
      schema: 'spf_v1',
      caseNumber: ctx.projectNo || raw.caseNumber || '',
      roomLabel: ctx.roomLabel || raw.roomLabel || '',
      photoIndices: ctx.photoIndices || raw.photoIndices || [],
      anchors: Array.isArray(raw.anchors) ? raw.anchors : [],
      layout: raw.layout && typeof raw.layout === 'object'
        ? raw.layout
        : { approxShape: '', doorCount: 0, adjacentSpaces: [], distinctiveNotes: '' },
      visualCues: Array.isArray(raw.visualCues) ? raw.visualCues : [],
      confidenceNotes: raw.confidenceNotes || ''
    };
    if (out.anchors.length < 3) {
      out.anchors = anchorsFromGroupFeatures(groupFeatures);
    }
    if (!out.visualCues.length) {
      groupFeatures.forEach(function (pf) {
        if (pf.featureVectorKey) out.visualCues.push(pf.featureVectorKey);
        else if (pf.featureSummary) out.visualCues.push(pf.featureSummary);
      });
    }
    if (!out.layout.distinctiveNotes && ctx.featureTheme) {
      out.layout.distinctiveNotes = ctx.featureTheme;
    }
    if (!out.confidenceNotes) {
      out.confidenceNotes = isValidSpfV1(raw)
        ? 'AI 直接產出 spf_v1'
        : '由 structuralFeatures 彙整為 spf_v1（AI 格式不符時後處理）';
    }
    return out;
  }

  function buildPhaseClusterSystemPrompt() {
    return [
      '你是室內裝修案場的空間分群助理。',
      '請一律使用繁體中文。',
      '任務：依每張照片的 structuralFeatures（≥8 項）與 featureVectorKey 比對，將同一空間的照片歸為 provisionalGroups。',
      '比對優先：窗/門/樑/柱位置是否一致、插座相對門窗位置、管線走向、格局形狀。',
      '硬性規則：photoIndex 1～totalPhotos 每一張都必須且只能出現在一個群組的 photoIndices 中，不可遺漏、不可重複。',
      '目標群組數應接近 spaceCount；特徵明顯不同者拆群，特徵高度重疊者合併。',
      'confidence 低或 needsRescan 的照片放入 lowConfidencePhotos；若仍有未分配或低品質特徵，設 needsRefinementPass=true。',
      '僅回傳一個 JSON 物件，不要 markdown、不要 ```。'
    ].join('\n');
  }

  function buildPhaseClusterUserPrompt(ctx) {
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '目標空間數 spaceCount：' + ctx.spaceCount,
      '總照片數 totalPhotos：' + ctx.totalPhotos + '（必須全部分配）',
      '空間名稱提示：' + (ctx.spaceNamesHint || '（無）'),
      '',
      '【已掃描照片結構特徵（精簡）】',
      ctx.allFeaturesJson,
      '',
      '輸出 spp_cluster_v1：',
      '{',
      '  "schema": "spp_cluster_v1",',
      '  "provisionalGroups": [{',
      '    "groupId": "g1",',
      '    "proposedRoomLabel": "主臥",',
      '    "photoIndices": [1, 3, 5],',
      '    "featureTheme": "左側大窗+右門洞+天花明管",',
      '    "matchingFeatures": ["窗位置一致","門左側插座"],',
      '    "avgConfidence": 0.8,',
      '    "mergeReason": "structuralFeatures 中窗門樑位置高度重疊"',
      '  }],',
      '  "lowConfidencePhotos": [{',
      '    "photoIndex": 2,',
      '    "reason": "特徵不足或與多群皆部分相似",',
      '    "suggestedAction": "reassign|defer|merge_to_group",',
      '    "targetGroupId": "g1"',
      '  }],',
      '  "unassignedPhotoIndices": [],',
      '  "needsRefinementPass": false,',
      '  "suggestedNextStep": "refine|finalize",',
      '  "clusterNotes": "分群說明（含如何依樑柱門窗比對）"',
      '}'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充 ---', ctx.extraPrompt);
    return lines.join('\n');
  }

  function buildPhaseRefineSystemPrompt() {
    return [
      '你是室內裝修案場的空間分群修正助理。',
      '請一律使用繁體中文。',
      '任務：修正 provisionalGroups，確保 totalPhotos 全部分配且不重複。',
      '依 structuralFeatures 比對樑柱門窗與插座相對位置，合併同空間、拆分混淆群組。',
      'needsRefinementPass 僅在仍有未分配、重複分配或低品質特徵時為 true。',
      '僅回傳 spp_cluster_v1 JSON，不要 markdown、不要 ```。'
    ].join('\n');
  }

  function buildPhaseRefineUserPrompt(ctx) {
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '目標空間數：' + ctx.spaceCount,
      '總照片數 totalPhotos：' + ctx.totalPhotos + '（修正後須全部分配）',
      '修正輪次：' + ctx.refineIteration,
      '',
      '【目前分群】',
      ctx.currentClusterJson,
      '',
      '【待修正照片結構特徵】',
      ctx.focusFeaturesJson,
      '',
      '請輸出修正後的 spp_cluster_v1（unassignedPhotoIndices 必須為空陣列）。'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充 ---', ctx.extraPrompt);
    return lines.join('\n');
  }

  function buildPhaseFinalizeSystemPrompt() {
    return buildFingerprintSystemPrompt();
  }

  function buildPhaseFinalizeUserPrompt(ctx) {
    var lines = [
      '案號：' + (ctx.projectNo || '（未填）'),
      '定案空間名稱：' + (ctx.roomLabel || ''),
      '所屬群組 groupId：' + (ctx.groupId || ''),
      '群組 photoIndices：' + (ctx.photoIndices || []).join(', '),
      '',
      '【群組特徵主題】' + (ctx.featureTheme || ''),
      '【群組內各照片 structuralFeatures】',
      ctx.groupFeaturesJson,
      '',
      '附圖：若有平面圖為第 1 張，其後為本群組代表現場照。',
      '請彙整群組內 structuralFeatures，產出標準 spf_v1（anchors 至少 3 項，含窗/門/樑/管/插座相對位置）：',
      '{',
      '  "schema": "spf_v1",',
      '  "caseNumber": "' + (ctx.projectNo || '') + '",',
      '  "roomLabel": "' + (ctx.roomLabel || '') + '",',
      '  "photoIndices": [' + (ctx.photoIndices || []).join(', ') + '],',
      '  "anchors": [{"type":"window|door|beam|column|pipe|socket|other","position":"…","shape":"…","notes":"相對位置與細節"}],',
      '  "layout": {"approxShape":"…","doorCount":0,"adjacentSpaces":[],"distinctiveNotes":"與其他空間的結構差異"},',
      '  "visualCues": ["特徵向量鍵1","特徵向量鍵2"],',
      '  "confidenceNotes": "定案信心與不確定處"',
      '}',
      '禁止輸出 door:true、嵌套 spf_v1、groupFeatures 等非標準欄位。'
    ];
    if (ctx.extraPrompt) lines.push('', '--- 補充 ---', ctx.extraPrompt);
    return lines.join('\n');
  }

  function callPhasedVision(phase, ctx, imagePhotos) {
    var params = getParams();
    var extra = getExtraPrompt();
    var sys = '';
    var user = '';
    if (phase === 'scan') {
      sys = buildPhaseScanSystemPrompt();
      user = buildPhaseScanUserPrompt(Object.assign({}, ctx, { extraPrompt: extra }));
    } else if (phase === 'cluster') {
      sys = buildPhaseClusterSystemPrompt();
      user = buildPhaseClusterUserPrompt(Object.assign({}, ctx, { extraPrompt: extra }));
    } else if (phase === 'refine') {
      sys = buildPhaseRefineSystemPrompt();
      user = buildPhaseRefineUserPrompt(Object.assign({}, ctx, { extraPrompt: extra }));
    } else if (phase === 'finalize') {
      sys = buildPhaseFinalizeSystemPrompt();
      user = buildPhaseFinalizeUserPrompt(Object.assign({}, ctx, { extraPrompt: extra }));
    } else {
      return Promise.reject(new Error('未知 phase: ' + phase));
    }
    return callOllamaVision(sys, user, imagePhotos || [], params).then(function (metrics) {
      if (!metrics.parsed) {
        var err = new Error('階段「' + phase + '」AI 回傳非 JSON');
        err.raw_text = metrics.response_text;
        throw err;
      }
      return metrics;
    });
  }

  function getPhotoFeaturesByIndices(allFeatures, indices) {
    var set = {};
    (indices || []).forEach(function (i) { set[i] = true; });
    return (allFeatures || []).filter(function (f) { return set[f.photoIndex]; });
  }

  function getPhotosByIndices(batchPhotos, indices) {
    return (indices || []).map(function (idx) {
      return batchPhotos[idx - 1];
    }).filter(Boolean);
  }

  function normalizeClusterResult(parsed, totalPhotos) {
    if (!parsed.provisionalGroups) parsed.provisionalGroups = [];
    if (!parsed.lowConfidencePhotos) parsed.lowConfidencePhotos = [];
    parsed.needsRefinementPass = !!parsed.needsRefinementPass;
    if (totalPhotos) validateAndFixClusterCoverage(parsed, totalPhotos);
    return parsed;
  }

  function runPhasedFingerprintLocal() {
    var spaceCount = parseInt($('space-count').value, 10);
    var projectNo = $('project-no').value.trim();
    var spaceNamesHint = ($('space-names-hint') && $('space-names-hint').value.trim()) || '';
    var extra = getExtraPrompt();
    var batchPhotos = state.batchPhotos;
    var chunks = chunkArray(batchPhotos, FINGERPRINT_SCAN_BATCH_SIZE);
    var totalUsage = [];
    var globalOffset = 0;

    var pipeline = {
      schema: 'spf_pipeline_v1',
      status: 'running',
      startedAt: new Date().toISOString(),
      projectNo: projectNo,
      targetSpaceCount: spaceCount,
      spaceNamesHint: spaceNamesHint,
      totalPhotos: batchPhotos.length,
      scanBatchSize: FINGERPRINT_SCAN_BATCH_SIZE,
      minStructuralFeatures: MIN_STRUCTURAL_FEATURES,
      photoFeatures: [],
      provisionalGroups: [],
      lowConfidencePhotos: [],
      spaces: [],
      pipelineLog: [],
      totalSteps: 0,
      aiSuggestedSteps: []
    };
    showPipelineOutput(pipeline);

    var chain = Promise.resolve();

    chunks.forEach(function (chunk, bi) {
      chain = chain.then(function () {
        var batchIndex = bi + 1;
        var globalStart = globalOffset + 1;
        var globalEnd = globalOffset + chunk.length;
        setPipelineStatus('階段 1/4：掃描照片特徵 — 第 ' + batchIndex + ' / ' + chunks.length + ' 批（#' + globalStart + '～#' + globalEnd + '）');

        var hasFloorPlan = bi === 0 && !!state.floorPlan;
        var images = [];
        if (hasFloorPlan) images.push(state.floorPlan);
        chunk.forEach(function (p) { images.push(p); });

        var priorSlice = pipeline.photoFeatures.slice(-12);

        return callPhasedVision('scan', {
          projectNo: projectNo,
          spaceCount: spaceCount,
          batchIndex: batchIndex,
          totalBatches: chunks.length,
          globalPhotoStart: globalStart,
          globalPhotoEnd: globalEnd,
          batchPhotoCount: chunk.length,
          hasFloorPlan: hasFloorPlan,
          priorVectorKeys: buildPriorVectorKeysSummary(priorSlice, 12)
        }, photoPayloadFromState(images)).then(function (metrics) {
          totalUsage.push(metrics.usage);
          var scan = metrics.parsed;
          if (scan.suggestedNextStep) {
            pipeline.aiSuggestedSteps.push({
              afterPhase: 'scan_batch_' + batchIndex,
              step: scan.suggestedNextStep,
              reason: scan.suggestedNextStepReason || scan.batchNotes || ''
            });
          }
          (scan.photos || []).forEach(function (p, localIdx) {
            pipeline.photoFeatures.push(normalizePhotoScanRecord(p, globalStart, localIdx, batchIndex));
          });
          if (!(scan.photos && scan.photos.length)) {
            for (var fi = 0; fi < chunk.length; fi++) {
              pipeline.photoFeatures.push(normalizePhotoScanRecord({
                featureSummary: '(掃描未回傳，待分群階段補判)',
                structuralFeatures: [],
                confidence: 0.3,
                confidenceLevel: 'low',
                suggestedAction: 'defer'
              }, globalStart, fi, batchIndex));
            }
          }
          appendPipelineStep(pipeline, {
            step: pipeline.pipelineLog.length + 1,
            phase: 'scan_batch',
            batchIndex: batchIndex,
            globalPhotoRange: [globalStart, globalEnd],
            input: { photoCount: chunk.length, hasFloorPlan: hasFloorPlan },
            output: scan,
            usage: metrics.usage,
            model: metrics.model
          });
          globalOffset += chunk.length;
        });
      });
    });

    chain = chain.then(function () {
      setPipelineStatus('階段 2/4：特徵分群 — 依 structuralFeatures 比對歸類…');
      var compactFeatures = buildCompactFeaturesForCluster(pipeline.photoFeatures);
      return callPhasedVision('cluster', {
        projectNo: projectNo,
        spaceCount: spaceCount,
        spaceNamesHint: spaceNamesHint,
        totalPhotos: batchPhotos.length,
        allFeaturesJson: JSON.stringify(compactFeatures, null, 0)
      }, state.floorPlan ? [state.floorPlan] : []).then(function (metrics) {
        totalUsage.push(metrics.usage);
        var cluster = normalizeClusterResult(metrics.parsed, batchPhotos.length);
        pipeline.provisionalGroups = cluster.provisionalGroups;
        pipeline.lowConfidencePhotos = cluster.lowConfidencePhotos;
        if (cluster.suggestedNextStep) {
          pipeline.aiSuggestedSteps.push({
            afterPhase: 'cluster',
            step: cluster.suggestedNextStep,
            reason: cluster.clusterNotes || ''
          });
        }
        appendPipelineStep(pipeline, {
          step: pipeline.pipelineLog.length + 1,
          phase: 'cluster',
          output: cluster,
          usage: metrics.usage,
          model: metrics.model
        });
        return cluster;
      });
    });

    chain = chain.then(function (cluster) {
      var refineIter = 0;
      var current = cluster;

      function refineLoop() {
        var unassigned = getUnassignedPhotoIndices(batchPhotos.length, current);
        if ((!current.needsRefinementPass && !unassigned.length) || refineIter >= MAX_REFINE_ITERATIONS) {
          return Promise.resolve(current);
        }
        refineIter += 1;
        setPipelineStatus('階段 3/4：重分配 — 第 ' + refineIter + ' 輪（未分配 ' + unassigned.length + ' 張）…');
        var focusIndices = getRefineFocusIndices(current, batchPhotos.length, pipeline.photoFeatures);
        var focusFeatures = getPhotoFeaturesByIndices(pipeline.photoFeatures, focusIndices);
        var focusPhotos = getPhotosByIndices(batchPhotos, focusIndices);
        var images = [];
        if (state.floorPlan) images.push(state.floorPlan);
        focusPhotos.forEach(function (p) { if (p) images.push(p); });

        return callPhasedVision('refine', {
          projectNo: projectNo,
          spaceCount: spaceCount,
          totalPhotos: batchPhotos.length,
          refineIteration: refineIter,
          currentClusterJson: JSON.stringify(current, null, 0),
          focusFeaturesJson: JSON.stringify(buildCompactFeaturesForCluster(focusFeatures), null, 0)
        }, photoPayloadFromState(images)).then(function (metrics) {
          totalUsage.push(metrics.usage);
          current = normalizeClusterResult(metrics.parsed, batchPhotos.length);
          pipeline.provisionalGroups = current.provisionalGroups;
          pipeline.lowConfidencePhotos = current.lowConfidencePhotos;
          if (current.suggestedNextStep) {
            pipeline.aiSuggestedSteps.push({
              afterPhase: 'refine_' + refineIter,
              step: current.suggestedNextStep,
              reason: current.clusterNotes || ''
            });
          }
          appendPipelineStep(pipeline, {
            step: pipeline.pipelineLog.length + 1,
            phase: 'refine',
            refineIteration: refineIter,
            focusPhotoIndices: focusIndices,
            output: current,
            usage: metrics.usage,
            model: metrics.model
          });
          return refineLoop();
        });
      }

      return refineLoop();
    });

    chain = chain.then(function (finalCluster) {
      pipeline.provisionalGroups = finalCluster.provisionalGroups || [];
      var groups = pipeline.provisionalGroups;
      if (!groups.length) throw new Error('分群結果為空，無法定案指紋');

      var finChain = Promise.resolve();
      groups.forEach(function (group, gi) {
        finChain = finChain.then(function () {
          setPipelineStatus('階段 4/4：定案指紋 — ' + (gi + 1) + ' / ' + groups.length + '（' + (group.proposedRoomLabel || group.groupId) + '）');
          var indices = group.photoIndices || [];
          var groupPhotos = getPhotosByIndices(batchPhotos, indices);
          var groupFeatures = getPhotoFeaturesByIndices(pipeline.photoFeatures, indices);
          var images = [];
          if (state.floorPlan) images.push(state.floorPlan);
          groupPhotos.forEach(function (p) { images.push(p); });

          return callPhasedVision('finalize', {
            projectNo: projectNo,
            roomLabel: group.proposedRoomLabel || ('空間' + (gi + 1)),
            groupId: group.groupId || ('g' + (gi + 1)),
            photoIndices: indices,
            featureTheme: group.featureTheme || '',
            groupFeaturesJson: JSON.stringify(groupFeatures, null, 0)
          }, photoPayloadFromState(images)).then(function (metrics) {
            totalUsage.push(metrics.usage);
            var fp = normalizeSpfV1Fingerprint(metrics.parsed, {
              projectNo: projectNo,
              roomLabel: group.proposedRoomLabel || ('空間' + (gi + 1)),
              photoIndices: indices,
              featureTheme: group.featureTheme || '',
              groupFeatures: groupFeatures
            });
            var spaceEntry = {
              groupId: group.groupId,
              roomLabel: fp.roomLabel,
              photoIndices: indices,
              featureTheme: group.featureTheme,
              fingerprint: fp
            };
            pipeline.spaces.push(spaceEntry);
            appendPipelineStep(pipeline, {
              step: pipeline.pipelineLog.length + 1,
              phase: 'finalize',
              groupId: group.groupId,
              roomLabel: fp.roomLabel,
              photoIndices: indices,
              output: fp,
              usage: metrics.usage,
              model: metrics.model
            });
          });
        });
      });
      return finChain;
    });

    return chain.then(function () {
      pipeline.status = 'completed';
      pipeline.completedAt = new Date().toISOString();
      var assignedCount = getAssignedPhotoIndices({ provisionalGroups: pipeline.provisionalGroups }).length;
      var lowQualityCount = pipeline.photoFeatures.filter(function (p) { return p.needsRescan; }).length;
      pipeline.summary = '共 ' + pipeline.totalSteps + ' 步；掃描 ' + batchPhotos.length + ' 張（每張目標 ≥' + MIN_STRUCTURAL_FEATURES + ' 特徵）→ ' +
        pipeline.provisionalGroups.length + ' 群（已分配 ' + assignedCount + '/' + batchPhotos.length + '）→ 定案 ' + pipeline.spaces.length + ' 個 spf_v1 指紋' +
        (lowQualityCount ? '；特徵不足 ' + lowQualityCount + ' 張' : '');
      pipeline.totalUsage = sumUsage(totalUsage.map(function (u) { return { usage: u }; }));
      setPipelineStatus('完成：' + pipeline.summary);

      applyBatchFingerprintResult({
        spaces: pipeline.spaces.map(function (s) {
          return {
            roomLabel: s.roomLabel,
            photoIndices: s.photoIndices,
            fingerprint: s.fingerprint
          };
        }),
        unassignedPhotoIndices: (pipeline.lowConfidencePhotos || []).map(function (p) { return p.photoIndex; }),
        summary: pipeline.summary
      });
      showPipelineOutput(pipeline);
      return {
        pipeline: pipeline,
        usage: pipeline.totalUsage,
        model: getParams().model
      };
    });
  }

  function runPhasedFingerprint() {
    hideError();
    if (!isLocalProvider()) {
      showError('分階段指紋目前僅支援本機 Ollama；請在參數頁選「本機 Ollama」。');
      return;
    }
    var spaceCount = parseInt($('space-count').value, 10);
    if (!spaceCount || spaceCount < 1) { showError('請填寫預期空間數量'); return; }
    if (!state.batchPhotos.length) { showError('請上傳至少一張開案現場照'); return; }

    var btn = $('btn-gen-fingerprint');
    setLoading(btn, true, '<i class="fa-solid fa-layer-group"></i> 分階段產出全部指紋');
    setPipelineStatus('啟動分階段管線…');

    runPhasedFingerprintLocal().then(function (res) {
      var cost = res.usage ? updateCostPanel(res.usage, res.model) : { twd: 0 };
      pushHistory({
        time: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: '分階段指紋×' + (res.pipeline.spaces ? res.pipeline.spaces.length : 0),
        tokens: (res.usage && res.usage.total_token_count) || 0,
        twd: cost.twd || 0,
        usage: res.usage,
        model: res.model,
        result: res.pipeline
      });
    }).catch(function (err) {
      showError(err.message || String(err));
      if (err.raw_text) showJsonOutput(err.raw_text);
      setPipelineStatus('');
    }).finally(function () {
      setLoading(btn, false, '<i class="fa-solid fa-layer-group"></i> 分階段產出全部指紋');
    });
  }

  function runBatchFingerprint() {
    runPhasedFingerprint();
  }

  function runFingerprint(spaceIdx) {
    hideError();
    var indices = [];
    if (spaceIdx != null && !isNaN(spaceIdx)) {
      indices = [spaceIdx];
    } else {
      state.spaces.forEach(function (_, i) { indices.push(i); });
    }
    if (!indices.length) { showError('請先新增空間'); return; }

    var btn = spaceIdx != null ? null : $('btn-gen-fingerprint-one');
    if (btn) setLoading(btn, true, '<i class="fa-solid fa-fingerprint"></i> 僅產生選定空間');

    var chain = Promise.resolve();
    indices.forEach(function (idx) {
      chain = chain.then(function () {
        var sp = state.spaces[idx];
        if (!sp) return;
        if (!sp.roomLabel || !sp.roomLabel.trim()) {
          throw new Error('空間 ' + (idx + 1) + ' 缺少名稱');
        }
        if (!sp.refPhotos || !sp.refPhotos.length) {
          throw new Error('「' + sp.roomLabel + '」請上傳至少一張參考照');
        }
        var payload = {
          mode: 'space_fingerprint',
          project_no: $('project-no').value.trim(),
          room_label: sp.roomLabel.trim(),
          params: getParams(),
          extra_prompt: getExtraPrompt(),
          reference_photos: sp.refPhotos.map(function (p) {
            return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id, filename: p.name };
          })
        };
        if (state.floorPlan) {
          payload.floor_plan = {
            data_base64: state.floorPlan.data_base64,
            mime_type: state.floorPlan.mime_type
          };
        }
        return postAnalyze('space_fingerprint', payload).then(function (res) {
          if (!res.success) throw new Error(res.message || '指紋建立失敗');
          sp.fingerprint = res.fingerprint;
          sp.status = 'ready';
          var cost = res.usage ? updateCostPanel(res.usage, res.model) : { twd: 0 };
          showJsonOutput(res.fingerprint);
          pushHistory({
            time: new Date().toLocaleString('zh-TW', { hour12: false }),
            mode: '指紋:' + sp.roomLabel,
            tokens: (res.usage && res.usage.total_token_count) || 0,
            twd: cost.twd || 0,
            usage: res.usage,
            model: res.model,
            result: res.fingerprint
          });
        });
      });
    });

    chain.then(function () {
      renderSpaces();
      saveSession();
      refreshFpSummary();
    }).catch(function (err) {
      showError(err.message || String(err));
    }).finally(function () {
      if (btn) setLoading(btn, false, '<i class="fa-solid fa-fingerprint"></i> 僅產生選定空間');
    });
  }

  function runMatchBatched(allPhotos, fps, params, extra) {
    var chunks = [];
    for (var i = 0; i < allPhotos.length; i += MATCH_PHOTO_BATCH_SIZE) {
      chunks.push({ photos: allPhotos.slice(i, i + MATCH_PHOTO_BATCH_SIZE), offset: i });
    }
    var results = [];
    var usages = [];
    var chain = Promise.resolve();
    chunks.forEach(function (chunk, ci) {
      chain = chain.then(function () {
        $('output-json').textContent = '空間比對中… 第 ' + (ci + 1) + ' / ' + chunks.length + ' 批（每批最多 ' + MATCH_PHOTO_BATCH_SIZE + ' 張）';
        return postAnalyze('space_match', {
          project_no: $('project-no').value.trim(),
          fingerprints: fps,
          match_photos: chunk.photos,
          _batch_offset: chunk.offset,
          _batch_size: chunk.photos.length,
          params: params,
          extra_prompt: extra
        }).then(function (res) {
          if (!res.success) throw new Error(res.message || '比對失敗');
          results.push(res.space_match);
          usages.push({ usage: res.usage, model: res.model });
        });
      });
    });
    return chain.then(function () {
      return {
        space_match: applyMatchThresholds(mergeMatchResults(results), params),
        usage: sumUsage(usages),
        model: usages[0] && usages[0].model
      };
    });
  }

  function runMatch() {
    hideError();
    var fps = getReadyFingerprints();
    if (!fps.length) { showError('請先在開案指紋建立至少一個空間指紋'); return; }
    if (!state.matchPhotos.length) { showError('請上傳施工照'); return; }

    var btn = $('btn-run-match');
    setLoading(btn, true, '<i class="fa-solid fa-bolt"></i> 執行空間比對');

    var params = getParams();
    var extra = getExtraPrompt();
    var photoPayload = state.matchPhotos.map(function (p) {
      return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id };
    });

    var runPromise;
    if (isLocalProvider() && photoPayload.length > MATCH_PHOTO_BATCH_SIZE) {
      runPromise = runMatchBatched(photoPayload, fps, params, extra);
    } else {
      runPromise = postAnalyze('space_match', {
        project_no: $('project-no').value.trim(),
        fingerprints: fps,
        match_photos: photoPayload,
        params: params,
        extra_prompt: extra
      }).then(function (res) {
        if (!res.success) throw new Error(res.message || '比對失敗');
        return {
          space_match: res.space_match,
          usage: res.usage,
          model: res.model
        };
      });
    }

    runPromise.then(function (res) {
      state.lastSpaceMatch = applyMatchThresholds(res.space_match, params);
      var cost = res.usage ? updateCostPanel(res.usage, res.model) : { twd: 0 };
      showJsonOutput(state.lastSpaceMatch);
      pushHistory({
        time: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: '空間比對',
        tokens: (res.usage && res.usage.total_token_count) || 0,
        twd: cost.twd || 0,
        usage: res.usage,
        model: res.model,
        result: state.lastSpaceMatch
      });
      saveSession();
    }).catch(function (err) {
      showError(err.message || String(err));
      if (err.raw_text) showJsonOutput(err.raw_text);
    }).finally(function () {
      setLoading(btn, false, '<i class="fa-solid fa-bolt"></i> 執行空間比對');
    });
  }

  function runReport() {
    hideError();
    var photos = [];
    if ($('use-match-photos').checked && state.matchPhotos.length) {
      photos = state.matchPhotos.slice();
    } else {
      photos = state.reportPhotos.slice();
    }
    if (!photos.length) { showError('請上傳施工照，或先完成空間比對並勾選沿用'); return; }

    var workDesc = $('work-desc').value.trim();
    var problemDesc = $('problem-desc').value.trim();
    if (!workDesc && !problemDesc) { showError('請填寫施工內容或問題回報'); return; }

    var btn = $('btn-run-report');
    setLoading(btn, true, '<i class="fa-solid fa-bolt"></i> 執行施工回報分析');

    var payload = {
      project_no: $('project-no').value.trim(),
      work_type: $('work-type').value.trim(),
      work_description: workDesc,
      problem_description: problemDesc,
      photos: photos.map(function (p) {
        return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id };
      }),
      params: getParams(),
      extra_prompt: getExtraPrompt()
    };
    if ($('attach-space-match').checked && state.lastSpaceMatch) {
      payload.space_match = state.lastSpaceMatch;
    }

    postAnalyze('site_report', payload).then(function (res) {
      if (!res.success) throw new Error(res.message || '分析失敗');
      var cost = res.usage ? updateCostPanel(res.usage, res.model) : { twd: 0 };
      showJsonOutput(res.report);
      pushHistory({
        time: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: '施工回報',
        tokens: (res.usage && res.usage.total_token_count) || 0,
        twd: cost.twd || 0,
        usage: res.usage,
        model: res.model,
        result: res.report
      });
    }).catch(function (err) {
      showError(err.message || String(err));
    }).finally(function () {
      setLoading(btn, false, '<i class="fa-solid fa-bolt"></i> 執行施工回報分析');
    });
  }

  function pingConnection() {
    hideError();
    if (isLocalProvider()) {
      var base = ($('ollama-url') && $('ollama-url').value.trim()) || DEFAULT_OLLAMA_URL;
      var tagsUrl = base.replace(/\/v1\/?$/, '') + '/api/tags';
      fetch(tagsUrl)
        .then(function (res) { return res.json(); })
        .then(function (json) {
          var models = (json.models || []).map(function (m) { return m.name; });
          var sel = $('param-model').value;
          var hasModel = models.some(function (n) { return n.indexOf(sel.split(':')[0]) >= 0 || n === sel; });
          alert(
            '本機 Ollama 連線成功\n' +
            '端點：' + base + '\n' +
            '已安裝模型數：' + models.length + '\n' +
            '目前選擇：' + sel + (hasModel ? '（已找到）' : '（請 ollama pull ' + sel + '）') + '\n' +
            '回覆語言：繁體中文（已寫入 prompt）'
          );
        })
        .catch(function (err) {
          showError('本機 Ollama 連線失敗：' + (err.message || err) + '。請確認 Ollama 已啟動。');
        });
      return;
    }
    postGas('ai_lab_ping', {}).then(function (res) {
      if (!res.success) throw new Error(res.message || '連線失敗');
      alert(
        '連線成功\n' +
        '版本：' + res.version + '\n' +
        'Gemini：' + (res.gemini_configured ? '已設定' : '未設定') + '\n' +
        '預設模型：' + res.default_model + '\n' +
        'AUTH_BYPASS：' + (res.auth_bypass ? '開' : '關')
      );
    }).catch(function (err) {
      showError('連線失敗：' + (err.message || err));
    });
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    ['fingerprint', 'match', 'report', 'settings'].forEach(function (id) {
      var panel = $('panel-' + id);
      if (panel) panel.classList.toggle('hidden', id !== tabId);
    });
    if (tabId === 'match') refreshFpSummary();
    if (tabId === 'report') {
      $('report-photo-field').classList.toggle('hidden', $('use-match-photos').checked);
    }
  }

  function init() {
    loadSettings();
    loadSession();

    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () { switchTab(t.getAttribute('data-tab')); };
    });

    $('upload-floor-plan').onclick = function () { $('input-floor-plan').click(); };
    $('input-floor-plan').onchange = function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      resizeImageFile(file, imgMax()).then(function (item) {
        state.floorPlan = item;
        $('thumb-floor-plan').innerHTML =
          '<div class="thumb"><img src="' + item.preview + '"><button type="button">&times;</button></div>';
        $('thumb-floor-plan').querySelector('button').onclick = function () {
          state.floorPlan = null;
          $('thumb-floor-plan').innerHTML = '';
        };
        ev.target.value = '';
      });
    };

    setupFileUpload('upload-match', 'input-match', 'thumb-match', state.matchPhotos, false);
    setupFileUpload('upload-report', 'input-report', 'thumb-report', state.reportPhotos, false);

    $('upload-batch-photos').onclick = function () { $('input-batch-photos').click(); };
    $('input-batch-photos').onchange = function (ev) {
      var files = Array.from(ev.target.files || []);
      if (!files.length) return;
      Promise.all(files.map(function (f) { return resizeImageFile(f, imgMax()); }))
        .then(function (items) {
          items.forEach(function (item) {
            item.photo_id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
            state.batchPhotos.push(item);
          });
          renderThumbs('thumb-batch-photos', state.batchPhotos, function (idx) {
            state.batchPhotos.splice(idx, 1);
            renderThumbs('thumb-batch-photos', state.batchPhotos, arguments.callee);
            updateBatchPhotoHint();
            saveSession();
          });
          updateBatchPhotoHint();
          saveSession();
          ev.target.value = '';
        })
        .catch(function (err) { showError('圖片處理失敗：' + err.message); });
    };

    $('btn-add-space').onclick = addSpace;
    $('btn-gen-fingerprint').onclick = runPhasedFingerprint;
    $('btn-gen-fingerprint-one').onclick = function () { runFingerprint(null); };
    $('btn-run-match').onclick = runMatch;
    $('btn-run-report').onclick = runReport;
    $('btn-save-settings').onclick = saveSettings;
    $('btn-ping').onclick = pingConnection;
    $('provider-mode').onchange = function () {
      toggleProviderUI();
    };
    $('btn-clear-history').onclick = function () {
      if (!confirm('清除本機測試紀錄？')) return;
      state.history = [];
      saveSession();
      renderHistory();
    };
    $('use-match-photos').onchange = function () {
      $('report-photo-field').classList.toggle('hidden', $('use-match-photos').checked);
    };

    updateBatchPhotoHint();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
