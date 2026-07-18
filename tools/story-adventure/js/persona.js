(function (global) {
  var TONE = ['冷淡', '戲謔', '詩意', '公文', '偏執', '溫柔'];
  var PACING = ['極慢描寫', '跳躍剪接', '對話密集', '流水帳'];
  var MORAL = ['犬儒', '理想', '混亂中立', '殘酷現實'];
  var FOCUS = ['物件細節', '人際關係', '空間迷向', '系統規則'];
  var VOICE = ['第二人稱緊貼', '旁白疏離', '不可靠敘事'];

  function pick(a) {
    return a[Math.floor(Math.random() * a.length)];
  }

  function rollPersona() {
    return {
      tone: pick(TONE),
      pacing: pick(PACING),
      moral: pick(MORAL),
      focus: pick(FOCUS),
      chaos: 1 + Math.floor(Math.random() * 5),
      voice: pick(VOICE)
    };
  }

  function personaShort(p) {
    return p ? p.tone + '・' + p.moral + '・chaos' + p.chaos : '';
  }

  function uid(prefix) {
    return (
      prefix +
      '_' +
      Math.random().toString(16).slice(2) +
      Date.now().toString(16).slice(-6)
    );
  }

  function pad3(n) {
    return String(n).padStart(3, '0');
  }

  global.StoryUtil = {
    rollPersona: rollPersona,
    personaShort: personaShort,
    uid: uid,
    pad3: pad3,
    pick: pick
  };
})(window);
