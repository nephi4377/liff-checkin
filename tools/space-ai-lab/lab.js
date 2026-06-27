/**
 * 空間 AI 實驗室 — 前端邏輯
 * 後端 action: ai_lab_ping / ai_lab_analyze
 */
(function () {
  'use strict';

  var MODEL_RATES = {
    'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', input: 0.30, output: 2.50 },
    'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', input: 1.25, output: 10.00 }
  };

  var DEFAULT_GAS_URL =
    'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec';

  var state = {
    floorPlan: null,
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

  function loadSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem('tx_space_ai_lab_settings') || '{}'); } catch (e) {}
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
    $('extra-prompt').value = s.extraPrompt || '';
    $('project-no').value = s.projectNo || '';

    var sel = $('param-model');
    sel.innerHTML = '';
    Object.keys(MODEL_RATES).forEach(function (k) {
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = MODEL_RATES[k].name;
      sel.appendChild(opt);
    });
    sel.value = s.model || 'gemini-2.5-flash';
  }

  function saveSettings() {
    var data = {
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
      projectNo: $('project-no').value.trim()
    };
    localStorage.setItem('tx_space_ai_lab_settings', JSON.stringify(data));
    alert('設定已儲存');
  }

  function getParams() {
    return {
      model: $('param-model').value,
      thinkingBudget: parseInt($('param-thinking').value, 10),
      maxOutputTokens: parseInt($('param-max-tokens').value, 10),
      temperature: parseFloat($('param-temperature').value),
      confidenceHigh: parseFloat($('param-conf-high').value),
      confidenceLow: parseFloat($('param-conf-low').value)
    };
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem('tx_space_ai_lab_session');
      if (!raw) return;
      var sess = JSON.parse(raw);
      if (sess.spaces) state.spaces = sess.spaces;
      if (sess.lastSpaceMatch) state.lastSpaceMatch = sess.lastSpaceMatch;
      if (sess.history) state.history = sess.history;
    } catch (e) {}
    renderSpaces();
    renderHistory();
    refreshFpSummary();
  }

  function saveSession() {
    localStorage.setItem('tx_space_ai_lab_session', JSON.stringify({
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
      list.innerHTML = '<p class="step-hint">尚無空間。點「新增空間」開始。</p>';
      return;
    }
    state.spaces.forEach(function (sp, idx) {
      var div = document.createElement('div');
      div.className = 'space-item';
      var badge = sp.fingerprint
        ? '<span class="badge badge-ok">已建指紋</span>'
        : '<span class="badge badge-muted">未建指紋</span>';
      div.innerHTML =
        '<header>' +
          '<strong>' + escapeHtml(sp.roomLabel || '未命名') + '</strong>' +
          badge +
        '</header>' +
        '<div class="field" style="margin-bottom:0.4rem">' +
          '<label>空間名稱</label>' +
          '<input type="text" data-idx="' + idx + '" class="space-label-input" value="' + escapeHtml(sp.roomLabel || '') + '">' +
        '</div>' +
        '<div class="field" style="margin-bottom:0.35rem">' +
          '<label>施工前參考照（' + (sp.refPhotos ? sp.refPhotos.length : 0) + ' 張）</label>' +
          '<div class="upload space-upload" data-idx="' + idx + '">上傳參考照</div>' +
          '<div class="thumbs space-thumbs" data-idx="' + idx + '"></div>' +
        '</div>' +
        '<div class="inline-btns">' +
          '<button type="button" class="btn btn-secondary btn-gen-one" data-idx="' + idx + '">產生此空間指紋</button>' +
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
    $('fp-count').textContent = String(fps.length);
    $('fp-summary').textContent = fps.length
      ? fps.map(function (f) { return f.roomLabel || '？'; }).join('、')
      : '請先在「開案指紋」建立至少一個空間指紋';
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
    var rate = MODEL_RATES[model] || { input: 0.3, output: 2.5 };
    var fx = parseFloat($('param-fx').value) || 32.5;
    var inTok = usage.prompt_token_count || 0;
    var outTok = usage.candidates_token_count || 0;
    var usd = (inTok / 1e6) * rate.input + (outTok / 1e6) * rate.output;
    var twd = usd * fx;
    $('tok-in').textContent = inTok.toLocaleString();
    $('tok-out').textContent = outTok.toLocaleString();
    $('cost-usd').textContent = '$' + usd.toFixed(6);
    $('cost-twd').textContent = 'NT$ ' + twd.toFixed(4);
    $('cost-model').textContent = MODEL_RATES[model] ? MODEL_RATES[model].name : model;
    return { usd: usd, twd: twd, inTok: inTok, outTok: outTok };
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

  function runFingerprint(spaceIdx) {
    hideError();
    var indices = [];
    if (spaceIdx != null && !isNaN(spaceIdx)) {
      indices = [spaceIdx];
    } else {
      state.spaces.forEach(function (_, i) { indices.push(i); });
    }
    if (!indices.length) { showError('請先新增空間'); return; }

    var btn = $('btn-gen-fingerprint');
    setLoading(btn, true, '<i class="fa-solid fa-fingerprint"></i> 產生選定空間指紋');

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
          extra_prompt: $('extra-prompt').value.trim(),
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
        return postGas('ai_lab_analyze', payload).then(function (res) {
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
      setLoading(btn, false, '<i class="fa-solid fa-fingerprint"></i> 產生選定空間指紋');
    });
  }

  function runMatch() {
    hideError();
    var fps = getReadyFingerprints();
    if (!fps.length) { showError('請先在開案指紋建立至少一個空間指紋'); return; }
    if (!state.matchPhotos.length) { showError('請上傳施工照'); return; }

    var btn = $('btn-run-match');
    setLoading(btn, true, '<i class="fa-solid fa-bolt"></i> 執行空間比對');

    postGas('ai_lab_analyze', {
      mode: 'space_match',
      project_no: $('project-no').value.trim(),
      fingerprints: fps,
      match_photos: state.matchPhotos.map(function (p) {
        return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id };
      }),
      params: getParams(),
      extra_prompt: $('extra-prompt').value.trim()
    }).then(function (res) {
      if (!res.success) throw new Error(res.message || '比對失敗');
      state.lastSpaceMatch = res.space_match;
      var cost = res.usage ? updateCostPanel(res.usage, res.model) : { twd: 0 };
      showJsonOutput(res.space_match);
      pushHistory({
        time: new Date().toLocaleString('zh-TW', { hour12: false }),
        mode: '空間比對',
        tokens: (res.usage && res.usage.total_token_count) || 0,
        twd: cost.twd || 0,
        usage: res.usage,
        model: res.model,
        result: res.space_match
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
      mode: 'site_report',
      project_no: $('project-no').value.trim(),
      work_type: $('work-type').value.trim(),
      work_description: workDesc,
      problem_description: problemDesc,
      photos: photos.map(function (p) {
        return { data_base64: p.data_base64, mime_type: p.mime_type, photo_id: p.photo_id };
      }),
      params: getParams(),
      extra_prompt: $('extra-prompt').value.trim()
    };
    if ($('attach-space-match').checked && state.lastSpaceMatch) {
      payload.space_match = state.lastSpaceMatch;
    }

    postGas('ai_lab_analyze', payload).then(function (res) {
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

  function pingGas() {
    hideError();
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

    $('btn-add-space').onclick = addSpace;
    $('btn-gen-fingerprint').onclick = function () { runFingerprint(null); };
    $('btn-run-match').onclick = runMatch;
    $('btn-run-report').onclick = runReport;
    $('btn-save-settings').onclick = saveSettings;
    $('btn-ping').onclick = pingGas;
    $('btn-clear-history').onclick = function () {
      if (!confirm('清除本機測試紀錄？')) return;
      state.history = [];
      saveSession();
      renderHistory();
    };
    $('use-match-photos').onchange = function () {
      $('report-photo-field').classList.toggle('hidden', $('use-match-photos').checked);
    };

    if (!state.spaces.length) {
      addSpace();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
