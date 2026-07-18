(function () {
  var lastLog = '';
  var busy = false;

  var el = {
    lobby: document.getElementById('lobby'),
    play: document.getElementById('play'),
    narrative: document.getElementById('narrative'),
    choices: document.getElementById('choices'),
    banner: document.getElementById('banner'),
    progress: document.getElementById('progress'),
    personaShort: document.getElementById('personaShort'),
    writerBadge: document.getElementById('writerBadge'),
    storyTitle: document.getElementById('storyTitle'),
    sidePhase: document.getElementById('sidePhase'),
    sideCast: document.getElementById('sideCast'),
    sideFlags: document.getElementById('sideFlags'),
    endingBox: document.getElementById('endingBox'),
    cloudLogSide: document.getElementById('cloudLogSide'),
    cloudLogEnding: document.getElementById('cloudLogEnding'),
    theme: document.getElementById('theme'),
    maxChoices: document.getElementById('maxChoices'),
    btnResume: document.getElementById('btnResume'),
    resumeHint: document.getElementById('resumeHint')
  };

  document.getElementById('btnStart').addEventListener('click', onStart);
  el.btnResume.addEventListener('click', onResume);
  document.getElementById('btnAgain').addEventListener('click', onAgain);
  document.getElementById('btnDownload').addEventListener('click', onDownload);
  document.getElementById('btnLobby').addEventListener('click', showLobby);

  refreshLobbyCacheUi();

  function setBanner(t) {
    el.banner.textContent = t || '';
  }

  function refreshLobbyCacheUi() {
    var sum = window.StoryStorage ? StoryStorage.peekSummary() : null;
    if (!sum) {
      el.btnResume.disabled = true;
      el.btnResume.textContent = '繼續上一局';
      if (el.resumeHint) el.resumeHint.textContent = '本機尚無可續進度（重整後可在期限內恢復）。';
      return;
    }
    el.btnResume.disabled = false;
    el.btnResume.textContent = sum.ended ? '查看上一局結局' : '繼續上一局';
    if (el.resumeHint) {
      var theme = sum.theme ? '「' + sum.theme + '」' : '上一局';
      el.resumeHint.textContent = sum.ended
        ? theme + '已結束 · 本機再留 3 天 · ' + (sum.choiceCount || 0) + '/' + (sum.maxChoices || '')
        : theme + '進行中 · 本機留 30 天 · ' + (sum.choiceCount || 0) + '/' + (sum.maxChoices || '');
    }
  }

  function showLobby() {
    el.lobby.classList.remove('hidden');
    el.play.classList.add('hidden');
    setBanner('');
    refreshLobbyCacheUi();
  }

  function showPlay() {
    el.lobby.classList.add('hidden');
    el.play.classList.remove('hidden');
  }

  async function onStart() {
    if (busy) return;
    busy = true;
    setBanner('正在寫本篇人物與前幾節…（約十餘秒）');
    try {
      // 重開清除：先清本機再開新局（api 內亦會清）
      await StoryApi.call('restart');
      var max = parseInt(el.maxChoices.value, 10) || 20;
      var data = await StoryApi.call('new_story', {
        theme: String(el.theme.value || '').trim(),
        maxChoices: max
      });
      if (!data.ok) throw new Error(data.message || data.error);
      el.narrative.innerHTML = '';
      render(data, true);
      showPlay();
      var writer = data.meta && data.meta.writer;
      if (writer === 'local') {
        setBanner('目前是本地草稿（AI 未成功）。重開一局或稍後再試。');
      } else if (writer === 'gemini') {
        setBanner('AI 執筆中——開局可能要等十餘秒。');
      } else {
        setBanner(data.meta && data.meta.generating ? '後續章節準備中…' : '');
      }
      refreshLobbyCacheUi();
    } catch (e) {
      setBanner(String(e.message || e));
    } finally {
      busy = false;
    }
  }

  async function onResume() {
    if (busy) return;
    busy = true;
    setBanner('讀取進度…');
    try {
      var data = await StoryApi.call('status');
      if (!data.ok) {
        // 伺服器沒有時，本機快取仍可顯示（本地模式 status 已含；遠端靠 cacheRun 還原）
        setBanner(data.message || '沒有可繼續的進度');
        refreshLobbyCacheUi();
        return;
      }
      el.narrative.innerHTML = '';
      render(data, true);
      showPlay();
      setBanner(data.player && data.player.ended ? '已從本機／伺服器恢復上一局。' : '');
    } catch (e) {
      setBanner(String(e.message || e));
    } finally {
      busy = false;
      refreshLobbyCacheUi();
    }
  }

  async function onAgain() {
    showLobby();
    el.maxChoices.focus();
  }

  function onDownload() {
    var text = lastLog || '';
    if (!text) {
      StoryApi.call('get_story_log').then(function (r) {
        downloadText(r.logText || '');
      });
      return;
    }
    downloadText(text);
  }

  function downloadText(text) {
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'story_' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderCloudLog(meta, player) {
    var url = (meta && meta.logFileUrl) || '';
    var show = !!(url && (player.ended || meta.logDriveOk || meta.logFileId));
    function fill(node) {
      if (!node) return;
      if (!show) {
        node.classList.add('hidden');
        node.innerHTML = '';
        return;
      }
      node.classList.remove('hidden');
      node.innerHTML = '';
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '本局雲端紀錄';
      node.appendChild(a);
      if (meta.logDriveError) {
        var tip = document.createElement('span');
        tip.className = 'cloud-err';
        tip.textContent = '（雲端寫入曾失敗）';
        node.appendChild(tip);
      }
    }
    fill(el.cloudLogSide);
    fill(el.cloudLogEnding);
  }

  function render(data, appendScene) {
    lastLog = data.logText || lastLog;
    var scene = data.scene;
    var meta = data.meta || {};
    var player = data.player || {};

    el.storyTitle.textContent = (scene && scene.storyTitle) || '副本文字冒險';
    el.progress.innerHTML =
      '<strong>' + (meta.choiceCount || 0) + '</strong> / ' + (meta.maxChoices || 100);
    el.personaShort.textContent = meta.personaShort || '—';
    if (el.writerBadge) {
      if (meta.writer === 'gemini') {
        el.writerBadge.textContent = '執筆：AI';
        el.writerBadge.className = 'writer-badge writer-ai';
      } else if (meta.writer === 'local') {
        el.writerBadge.textContent = '執筆：本地草稿';
        el.writerBadge.className = 'writer-badge writer-local';
      } else {
        el.writerBadge.textContent = '執筆：—';
        el.writerBadge.className = 'writer-badge';
      }
    }
    el.sidePhase.textContent = player.ended
      ? '結局：' + (player.endingId || '')
      : '進行中 · ' + (meta.writer === 'gemini' ? 'AI' : meta.writer === 'local' ? '本地草稿' : '—');
    if (el.sideCast) {
      var cast = data.cast || [];
      if (cast.length) {
        el.sideCast.textContent = cast
          .map(function (c) {
            return c.name + (c.role ? '（' + c.role + '）' : '');
          })
          .join('、');
      } else {
        el.sideCast.textContent = '（開局後顯示）';
      }
    }
    el.sideFlags.textContent =
      meta.writer === 'local' && meta.writerError
        ? 'AI 備註：' + String(meta.writerError).slice(0, 48)
        : '選項帶「·印」會被故事記住';

    renderCloudLog(meta, player);

    if (appendScene && scene) {
      var entry = document.createElement('div');
      entry.className = 'entry';
      entry.innerHTML = '<h3></h3><div class="body"></div>';
      entry.querySelector('h3').textContent = scene.title || '';
      entry.querySelector('.body').textContent = scene.narrative || '';
      el.narrative.appendChild(entry);
      el.narrative.scrollTop = el.narrative.scrollHeight;
    }

    el.choices.innerHTML = '';
    el.endingBox.classList.toggle('hidden', !player.ended);

    if (player.ended) {
      setBanner('本局結束，可下載文字檔或開雲端紀錄。');
      return;
    }

    (data.choices || []).forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = c.label;
      if (c.affectsStory) btn.classList.add('affect');
      btn.addEventListener('click', function () {
        onChoose(c);
      });
      el.choices.appendChild(btn);
    });
  }

  async function onChoose(c) {
    if (busy) return;
    busy = true;
    setBanner('');
    var line = document.createElement('div');
    line.className = 'choice-line';
    line.textContent = '→ ' + c.label + (c.affectsStory ? '（留下印記）' : '');
    el.narrative.appendChild(line);

    Array.prototype.forEach.call(el.choices.querySelectorAll('button'), function (b) {
      b.disabled = true;
    });

    try {
      var data = await StoryApi.call('choose', { choiceId: c.id });
      if (!data.ok) throw new Error(data.message || data.error);
      render(data, true);
      if (data.meta && data.meta.generating) setBanner('後續章節準備中…');
    } catch (e) {
      setBanner(String(e.message || e));
    } finally {
      busy = false;
    }
  }
})();
