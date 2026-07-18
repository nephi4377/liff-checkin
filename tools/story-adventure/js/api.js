(function (global) {
  function playerId() {
    return LocalEngine.getPlayerId();
  }

  async function call(action, body) {
    var cfg = window.STORY_CONFIG || {};
    if (cfg.USE_LOCAL || !cfg.API_URL) {
      return callLocal(action, body || {});
    }
    var payload = Object.assign({ action: action, playerId: playerId() }, body || {});
    var res = await fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  function callLocal(action, body) {
    if (action === 'new_story') return LocalEngine.newStory(body);
    if (action === 'choose') return LocalEngine.choose(body.choiceId);
    if (action === 'status') return LocalEngine.status();
    if (action === 'restart') return LocalEngine.restart();
    if (action === 'get_story_log' || action === 'get_log') return LocalEngine.getLog();
    return { ok: false, error: 'BAD_ACTION', message: action };
  }

  global.StoryApi = { call: call, playerId: playerId };
})(window);
