(function (global) {
  function playerId() {
    return LocalEngine.getPlayerId();
  }

  function attachCache(body) {
    var out = Object.assign({}, body || {});
    if (global.StoryStorage) {
      var run = StoryStorage.loadRun();
      if (run) out.cacheRun = StoryStorage.sanitizeRun(run);
    }
    return out;
  }

  function rememberFromResponse(data) {
    if (!global.StoryStorage || !data || !data.ok) return;
    if (data.cacheRun) {
      StoryStorage.saveRun(data.cacheRun);
      return;
    }
  }

  async function call(action, body) {
    var cfg = window.STORY_CONFIG || {};
    if (cfg.USE_LOCAL || !cfg.API_URL) {
      return callLocal(action, body || {});
    }
    var payload = Object.assign(
      { action: action, playerId: playerId() },
      attachCache(body || {})
    );
    // 開新局／重開：先清本機，避免上一局擋路；也不把舊 cacheRun 送上去
    if (action === 'restart' || action === 'new_story') {
      if (global.StoryStorage) StoryStorage.clearRun();
      delete payload.cacheRun;
    }
    var res = await fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (action === 'restart') {
      if (global.StoryStorage) StoryStorage.clearRun();
    } else {
      rememberFromResponse(data);
    }
    return data;
  }

  function callLocal(action, body) {
    if (action === 'new_story') {
      if (global.StoryStorage) StoryStorage.clearRun();
      return LocalEngine.newStory(body);
    }
    if (action === 'choose') return LocalEngine.choose(body.choiceId);
    if (action === 'status') return LocalEngine.status();
    if (action === 'restart') return LocalEngine.restart();
    if (action === 'get_story_log' || action === 'get_log') return LocalEngine.getLog();
    return { ok: false, error: 'BAD_ACTION', message: action };
  }

  global.StoryApi = { call: call, playerId: playerId };
})(window);
