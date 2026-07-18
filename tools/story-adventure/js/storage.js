/**
 * 副本文字冒險 — 本機快取記憶（localStorage）
 * - 進行中：updatedAt 起算 30 天
 * - 已結束：endedAt 起算 3 天
 * - 壞資料／過期自動清；不存 API key、不存 Gemini raw
 */
(function (global) {
  var RUN_KEY = 'sao_story_run';
  var DAY_MS = 24 * 60 * 60 * 1000;
  var TTL_ACTIVE_MS = 30 * DAY_MS;
  var TTL_ENDED_MS = 3 * DAY_MS;

  /** 從完整 run 抽出可續玩狀態（去掉 AI raw／金鑰） */
  function sanitizeRun(run) {
    if (!run || typeof run !== 'object') return null;
    if (!run.storyId || !run.nodeId) return null;
    var out = {
      playerId: run.playerId || '',
      name: run.name || '連線者',
      storyId: run.storyId,
      theme: run.theme || '',
      seed: run.seed || '',
      persona: run.persona || null,
      maxChoices: run.maxChoices || 100,
      choiceCount: run.choiceCount || 0,
      flags: run.flags || {},
      seeds: run.seeds || [],
      stallStreak: run.stallStreak || 0,
      forceEscalate: !!run.forceEscalate,
      nodes: run.nodes || {},
      nodeId: run.nodeId,
      ended: !!run.ended,
      endingId: run.endingId || null,
      chunksGenerated: run.chunksGenerated || 0,
      choicesSinceGen: run.choicesSinceGen || 0,
      outline: run.outline || '',
      cast: run.cast || [],
      summary: run.summary || '',
      logText: run.logText || '',
      generating: false,
      lastWriter: run.lastWriter || run.writer || '',
      lastWriterError: run.lastWriterError || '',
      logFileId: run.logFileId || null,
      logFileUrl: run.logFileUrl || null,
      logFolderUrl: run.logFolderUrl || null,
      logDriveOk: !!run.logDriveOk,
      logDriveError: run.logDriveError || '',
      updatedAt: run.updatedAt || null,
      endedAt: run.endedAt || null
    };
    if (!out.nodes[out.nodeId]) return null;
    return out;
  }

  function isExpired(run, now) {
    now = now || Date.now();
    if (run.ended) {
      var endedAt = Date.parse(run.endedAt || run.updatedAt || '');
      if (!endedAt || isNaN(endedAt)) return true;
      return now > endedAt + TTL_ENDED_MS;
    }
    var updatedAt = Date.parse(run.updatedAt || '');
    if (!updatedAt || isNaN(updatedAt)) return true;
    return now > updatedAt + TTL_ACTIVE_MS;
  }

  function clearRun() {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch (e) {}
  }

  function saveRun(run) {
    var clean = sanitizeRun(run);
    if (!clean) {
      clearRun();
      return false;
    }
    var nowIso = new Date().toISOString();
    clean.updatedAt = nowIso;
    if (clean.ended) {
      clean.endedAt = clean.endedAt || nowIso;
    } else {
      clean.endedAt = null;
    }
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(clean));
      return true;
    } catch (e) {
      clearRun();
      return false;
    }
  }

  function loadRun() {
    var raw;
    try {
      raw = localStorage.getItem(RUN_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    var run;
    try {
      run = JSON.parse(raw);
    } catch (e) {
      clearRun();
      return null;
    }
    var clean = sanitizeRun(run);
    if (!clean) {
      clearRun();
      return null;
    }
    // 舊快取無時間戳：補上並視為進行中
    if (!clean.updatedAt) {
      clean.updatedAt = new Date().toISOString();
      if (clean.ended && !clean.endedAt) clean.endedAt = clean.updatedAt;
      try {
        localStorage.setItem(RUN_KEY, JSON.stringify(clean));
      } catch (e2) {}
    }
    if (isExpired(clean)) {
      clearRun();
      return null;
    }
    return clean;
  }

  /** 大廳／按鈕用摘要（過期回 null） */
  function peekSummary() {
    var run = loadRun();
    if (!run) return null;
    return {
      storyId: run.storyId,
      theme: run.theme || '',
      choiceCount: run.choiceCount || 0,
      maxChoices: run.maxChoices || 100,
      ended: !!run.ended,
      updatedAt: run.updatedAt,
      endedAt: run.endedAt || null
    };
  }

  global.StoryStorage = {
    RUN_KEY: RUN_KEY,
    TTL_ACTIVE_MS: TTL_ACTIVE_MS,
    TTL_ENDED_MS: TTL_ENDED_MS,
    sanitizeRun: sanitizeRun,
    saveRun: saveRun,
    loadRun: loadRun,
    clearRun: clearRun,
    peekSummary: peekSummary,
    isExpired: isExpired
  };
})(window);
