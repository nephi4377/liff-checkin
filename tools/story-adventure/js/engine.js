(function (global) {
  var REFILL = 4;
  var KEY = 'sao_story_player_id';
  var RUN_KEY = 'sao_story_run';

  function getPlayerId() {
    var id = localStorage.getItem(KEY);
    if (!id) {
      id = StoryUtil.uid('p');
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function saveRun(run) {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  }

  function loadRun() {
    try {
      return JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function logInit(run) {
    var p = run.persona || {};
    run.logText = [
      '# 副本文字冒險 故事紀錄',
      'storyId: ' + run.storyId,
      'seed: ' + run.seed,
      'theme: ' + run.theme,
      'maxChoices: ' + run.maxChoices,
      'createdAt: ' + new Date().toISOString(),
      '',
      '## 編寫人人格',
      'tone: ' + p.tone,
      'pacing: ' + p.pacing,
      'moral: ' + p.moral,
      'focus: ' + p.focus,
      'chaos: ' + p.chaos,
      'voice: ' + p.voice,
      '',
      '## 正文'
    ].join('\n');
  }

  function logScene(run, node, step) {
    run.logText += '\n\n### [' + step + '] ' + (node.title || node.id) + '\n' + (node.narrative || '');
  }

  function logChoice(run, choice) {
    run.logText +=
      '\n\n> 你的選擇 (' +
      run.choiceCount +
      '/' +
      run.maxChoices +
      '): ' +
      choice.label +
      '  [影響:' +
      (choice.affectsStory ? '是' : '否') +
      ']';
  }

  function logEnding(run) {
    run.logText +=
      '\n\n## 結束\nchoiceCount: ' +
      run.choiceCount +
      '\nendingId: ' +
      run.endingId +
      '\nflags: ' +
      JSON.stringify(run.flags || {});
  }

  function mergeChunk(run, chunk, fromNodeId) {
    var nodes = (chunk && chunk.nodes) || [];
    nodes.forEach(function (n) {
      run.nodes[n.id] = n;
    });
    if (fromNodeId && run.nodes[fromNodeId] && nodes.length) {
      (run.nodes[fromNodeId].choices || []).forEach(function (ch, c) {
        if (ch.to === 'PENDING' || !run.nodes[ch.to]) {
          ch.to = nodes[Math.min(c, nodes.length - 1)].id;
        }
      });
    }
  }

  function bufferDepth(run) {
    var depth = 0;
    var id = run.nodeId;
    var seen = {};
    while (id && run.nodes[id] && !seen[id] && depth < 20) {
      seen[id] = true;
      var n = run.nodes[id];
      if (n.type === 'ending') return depth;
      var next = null;
      for (var i = 0; i < (n.choices || []).length; i++) {
        var t = n.choices[i].to;
        if (t && t !== 'PENDING' && run.nodes[t]) {
          next = t;
          break;
        }
      }
      if (!next) return depth;
      id = next;
      depth++;
    }
    return depth;
  }

  function payload(run) {
    var node = run.nodes[run.nodeId];
    var choices = [];
    if (node && node.type !== 'ending') {
      choices = (node.choices || []).map(function (c) {
        return { id: c.id, label: c.label, affectsStory: !!c.affectsStory };
      });
    }
    var castPublic = (run.cast || []).map(function (c) {
      return { name: c.name, role: c.role || '' };
    });
    return {
      ok: true,
      player: {
        playerId: run.playerId,
        name: run.name,
        flags: run.flags,
        ended: !!run.ended,
        endingId: run.endingId,
        choiceCount: run.choiceCount,
        maxChoices: run.maxChoices,
        persona: run.persona,
        generating: !!run.generating
      },
      cast: castPublic,
      scene: node
        ? {
            storyTitle: run.theme,
            storyId: run.storyId,
            nodeId: node.id,
            title: node.title,
            narrative: node.narrative,
            phase: node.type === 'ending' ? 'ending' : 'story'
          }
        : null,
      choices: choices,
      meta: {
        choiceCount: run.choiceCount,
        maxChoices: run.maxChoices,
        generating: !!run.generating,
        personaShort: StoryUtil.personaShort(run.persona),
        bufferRemaining: bufferDepth(run),
        writer: 'local'
      },
      logText: run.logText || ''
    };
  }

  function newStory(opts) {
    opts = opts || {};
    var playerId = getPlayerId();
    var maxChoices = Math.max(5, Math.min(500, parseInt(opts.maxChoices, 10) || 100));
    var theme = String(opts.theme || '').trim();
    if (!theme) theme = StoryGen.pickRandomTheme();
    theme = theme.slice(0, 40);
    var run = {
      playerId: playerId,
      name: opts.name || '連線者',
      storyId: StoryUtil.uid('s'),
      theme: theme,
      seed: new Date().toISOString(),
      persona: StoryUtil.rollPersona(),
      maxChoices: maxChoices,
      choiceCount: 0,
      flags: {},
      seeds: [],
      stallStreak: 0,
      forceEscalate: false,
      nodes: {},
      nodeId: 'n_001',
      ended: false,
      endingId: null,
      chunksGenerated: 1,
      choicesSinceGen: 0,
      outline: '',
      cast: [],
      summary: theme,
      logText: '',
      generating: false
    };
    logInit(run);
    var chunk = StoryGen.fixtureOpening(theme, 'n_001');
    run.outline = chunk.outline || theme;
    run.cast = chunk.cast || [];
    run.summary = run.outline;
    mergeChunk(run, chunk, null);
    run.nodeId = 'n_001';
    if (!run.nodes[run.nodeId]) {
      mergeChunk(run, StoryGen.fixtureOpening(theme, 'n_001'), null);
    }
    logScene(run, run.nodes[run.nodeId], 0);
    saveRun(run);
    return payload(run);
  }

  function choose(choiceId) {
    var run = loadRun();
    if (!run) return { ok: false, error: 'NO_RUN', message: '請先開始新故事' };
    if (run.ended) return { ok: false, error: 'ENDED', message: '本局已結束' };
    var node = run.nodes[run.nodeId];
    var choice = (node.choices || []).find(function (c) { return c.id === choiceId; });
    if (!choice) return { ok: false, error: 'INVALID_CHOICE', message: '無效選項' };

    run.choiceCount += 1;
    if (choice.affectsStory && choice.setFlags) {
      Object.keys(choice.setFlags).forEach(function (k) {
        run.flags[k] = choice.setFlags[k];
      });
    }
    if (choice.affectsStory) {
      run.seeds = run.seeds || [];
      run.seeds.push({
        id: 's_' + run.choiceCount + '_' + String(choice.id || '').slice(-4),
        promise:
          choice.plantsSeed ||
          '你選了「' + String(choice.label || '').slice(0, 20) + '」，這會改變後續',
        plantedAt: run.choiceCount,
        dueFrom: run.choiceCount + 2,
        dueTo: run.choiceCount + 8,
        status: 'pending',
        hardness: 'hard',
        relatedCast: []
      });
    }
    logChoice(run, choice);

    var needEnding = run.choiceCount >= run.maxChoices;
    var to = choice.to;

    if (to === 'PENDING' || !run.nodes[to]) {
      run.generating = true;
      var chunk = StoryGen.generateLocal(run, needEnding);
      mergeChunk(run, chunk, run.nodeId);
      run.chunksGenerated += 1;
      run.choicesSinceGen = 0;
      run.generating = false;
      to = choice.to;
      if (to === 'PENDING' || !run.nodes[to]) {
        to = chunk.nodes[0].id;
        choice.to = to;
      }
    }

    run.nodeId = to;
    var next = run.nodes[run.nodeId];
    logScene(run, next, run.choiceCount);

    if (next.type === 'ending' || needEnding) {
      if (next.type !== 'ending') {
        var force = StoryGen.generateLocal(run, true);
        mergeChunk(run, force, run.nodeId);
        run.nodeId = force.nodes[0].id;
        next = run.nodes[run.nodeId];
        logScene(run, next, run.choiceCount);
      }
      run.ended = true;
      run.endingId = next.endingId;
      logEnding(run);
    }

    run.choicesSinceGen = (run.choicesSinceGen || 0) + 1;
    if (!run.ended && run.choicesSinceGen >= REFILL && bufferDepth(run) < 2) {
      run.generating = true;
      var pre = StoryGen.generateLocal(run, run.choiceCount >= run.maxChoices - 2);
      mergeChunk(run, pre, run.nodeId);
      run.chunksGenerated += 1;
      run.choicesSinceGen = 0;
      run.generating = false;
    }

    saveRun(run);
    return payload(run);
  }

  function status() {
    var run = loadRun();
    if (!run || !run.storyId) return { ok: false, error: 'NO_RUN', message: '尚無進度' };
    return payload(run);
  }

  function restart() {
    localStorage.removeItem(RUN_KEY);
    return { ok: true, player: { playerId: getPlayerId() }, scene: null, choices: [] };
  }

  function getLog() {
    var run = loadRun();
    return { ok: !!run, logText: (run && run.logText) || '' };
  }

  global.LocalEngine = {
    getPlayerId: getPlayerId,
    newStory: newStory,
    choose: choose,
    status: status,
    restart: restart,
    getLog: getLog
  };
})(window);
