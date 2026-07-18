(function (global) {
  var MIN_CHOICES = 3;
  var CHUNK = 5;

  var MEMORY = {
    took_stairs: '你還喘著爬梯的氣，大腿隱隱發酸',
    forced_door: '你還記得自己剛才硬撬過那扇門，指節仍隱隱發麻',
    tried_key: '口袋裡那把剛試過的鑰匙還帶著金屬的涼',
    has_key: '溫熱的鑰匙貼著你的掌心，像在催你別停',
    heard_broadcast: '廣播裡那個說「回聲」的聲音，還在耳膜邊打轉',
    silenced_tower: '你關掉廣播後，整座塔忽然安靜得不像話',
    talked_to_void: '你對刻痕說過話——走廊似乎因此多聽了一點',
    accepted_glitch: '你已經接受過一次錯亂，世界也沒因此變穩',
    fled_up: '剛才往上逃的那幾步，還留在小腿的肌肉記憶裡',
    climbed_higher: '你無視鑰匙繼續往上爬，樓層在腳下一層層後退',
    used_key_memory: '你曾用鑰匙碰過某個鎖孔，那聲輕響還在'
  };

  var SCENES = [
    {
      title: '鏡廊',
      sensory: '無數鏡子把你的臉撕成碎片，每一片呼吸的節奏都不一樣',
      tension: '最深處有一面鏡子沒有反射——那裡像被挖空了',
      labels: ['伸手碰那面空鏡', '沿廊壁後退', '對自己的倒影質問']
    },
    {
      title: '伺服器艙',
      sensory: '風扇低鳴像遠方海潮，機櫃縫隙漏出藍白閃光',
      tension: '一塊螢幕忽然跳出半行字，又自己刪掉',
      labels: ['湊近讀那行字', '拔掉最近的接線', '跟著風扇節奏數拍']
    },
    {
      title: '廢棄便利店',
      sensory: '冷藏櫃還在嗡嗡響，架上只剩過期便當與一張手寫便條',
      tension: '收銀台後有人影一晃——再看卻只剩塑膠袋晃動',
      labels: ['撿起便條細讀', '繞到收銀台後', '把便當推回貨架']
    },
    {
      title: '垂直花園',
      sensory: '藤蔓沿著鋼梁往上爬，花瓣帶著淡淡的金屬腥',
      tension: '某處枝葉分開，露出一條僅容一人通過的縫',
      labels: ['鑽進藤蔓縫', '摘下一片花瓣察看', '沿著鋼梁往上攀']
    },
    {
      title: '訊號死角',
      sensory: '這裡靜得連呼吸都顯得吵，UI 邊框整片灰掉',
      tension: '遠處傳來斷斷續續的呼叫，像有人卡在頻道裡',
      labels: ['朝呼叫聲走去', '原地閉眼聽風', '試著大聲回覆']
    },
    {
      title: '記憶冷庫',
      sensory: '冷氣撲面，玻璃櫃裡漂著半透明的畫面碎片',
      tension: '其中一片畫面裡，有人正回頭看你',
      labels: ['觸碰那片畫面', '後退關上門', '對畫面裡的人揮手']
    },
    {
      title: '無人月台',
      sensory: '月台燈管一明一滅，軌道深處吹來潮濕的風',
      tension: '電燈板上顯示下一班車：永不抵達',
      labels: ['跳下軌道查看', '坐在長椅上等', '沿著月台往隧道走']
    },
    {
      title: '玻璃溫室',
      sensory: '霧氣凝在玻璃上，外面的城市輪廓模糊成色塊',
      tension: '溫室中央的噴泉忽然停了，水面映出另一張臉',
      labels: ['擦開玻璃往外看', '伸手攪動噴泉', '沿著霧氣追那張臉']
    },
    {
      title: '電梯井邊緣',
      sensory: '鋼纜輕晃，深井裡落下細碎回音，像有人在底層低語',
      tension: '對側維修門半開，縫裡漏出橘紅色的緊急燈光',
      labels: ['跨過鋼纜縫隙', '推開維修門', '對井底喊一聲']
    },
    {
      title: '檔案室走廊',
      sensory: '紙箱堆到天花板，標籤全是亂碼，空氣裡有舊墨氣味',
      tension: '某箱蓋子微微掀起，裡面有一捲還在轉的錄音帶',
      labels: ['打開那箱', '沿標籤找規律', '關掉走廊燈試聽']
    }
  ];

  var BEATS = [
    '腳步聲在你身後停住——回頭卻只有空走廊',
    '空氣忽然變甜，像有人剛走過並留下香水尾韻',
    '牆上的逃生圖自己重繪，出口箭頭指向你來的方向',
    '有人用你的聲音，從通風口輕輕喊你的名字',
    '地面浮現一行即將消散的字：別相信下一扇門',
    '雨從天花板往上落，打濕衣角卻不沾地板',
    '一個 NPC 走到一半忘詞，愣住看著你，像在等人提詞',
    '任務面板閃過亂碼，又變成一句私人悄悄話'
  ];

  var THEME_READY = [
    '漲潮前必須還的書與孩子',
    '最後一班車前的託孤',
    '雨夜市場的舊債',
    '停擺遊樂園的師徒決裂',
    '地下溫室裡的守密或揭發',
    '無人車站的相愛相殺',
    '潮汐圖書館的失憶片段',
    '夜班醫院的錯寄訊息',
    '漂浮碼頭的合約到期',
    '霧中碼頭誰在說謊'
  ];
  var THEME_PLACES = [
    '雨夜市場',
    '停擺遊樂園',
    '地下溫室',
    '無人車站',
    '潮汐圖書館',
    '夜班醫院',
    '玻璃溫室',
    '記憶冷庫'
  ];
  var THEME_RELATIONS = [
    '舊債',
    '師徒決裂',
    '相愛相殺',
    '陌生人託孤',
    '守密或揭發',
    '誰說謊'
  ];

  function pickRandomTheme() {
    if (Math.random() < 0.55) {
      return THEME_READY[Math.floor(Math.random() * THEME_READY.length)];
    }
    return (
      THEME_PLACES[Math.floor(Math.random() * THEME_PLACES.length)] +
      '·' +
      THEME_RELATIONS[Math.floor(Math.random() * THEME_RELATIONS.length)]
    ).slice(0, 40);
  }

  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /** 空 theme 由引擎抽樣；此處不再回落「斷線的通訊塔」 */
  function fixtureOpening(theme, startId) {
    var t = theme || pickRandomTheme();
    var n0 = startId || 'n_001';
    var n1 = nextId(n0);
    var n2 = nextId(n1);
    var axis = hashStr(t) % 3;
    if (axis === 1) {
      return {
        outline:
          '主題「' + t + '」：潮水將至；小棠託孤，老紀守閘。主衝突＝救人／守規則／付代價。',
        cast: [
          {
            name: '小棠',
            role: '託孤者',
            want: '在期限前把孩子交到對的人手上',
            secret: '不確定對方還能不能信',
            traits: {
              lookOrVoice: '聲音輕，句子常像怕被風吹散',
              fearOrLine: '再託錯一次人就完了',
              stanceToYou: '把你當唯一趕得上的人',
              quirks: ['反覆確認時間']
            }
          },
          {
            name: '老紀',
            role: '閘門調度',
            want: '規則不被感情沖垮',
            secret: '欠過一次人情',
            traits: {
              lookOrVoice: '話短、像蓋章',
              fearOrLine: '破例一次就會塌',
              stanceToYou: '先把你當麻煩',
              quirks: ['先問你帶什麼來']
            }
          }
        ],
        nodes: [
          scene(n0, '漲潮警報', '「' + t + '」告示還濕著。小棠把包裹塞給你：「你帶他走，還是交給老紀？」老紀抬眼：「破例一次，整座館都會沉。」', [
            choice(n0, 'a', '答應小棠：帶走', n1, true, { promised_alin: true }, '答應小棠帶走託孤'),
            choice(n0, 'b', '先聽老紀的規則', n2, true, { asked_price: true }, '先站到老紀那邊'),
            choice(n0, 'c', '要求雙方說清楚', n1, true, { confronted_zhou: true }, '要求雙方說清楚')
          ]),
          scene(n1, '底層書庫', '水線漫過階梯。小棠看錶。老紀敲閘門：「帶走可以——你得簽代價。」', [
            choice(n1, 'a', '簽字並帶走', n2, true, { has_key: true }, '簽代價並帶走'),
            choice(n1, 'b', '拒簽，硬闖閘門', n2, true, { forced_door: true }, '拒簽硬闖'),
            choice(n1, 'c', '請老紀一起走', n2, true, { zhou_comes: true }, '請老紀一起走')
          ]),
          scene(n2, '最後一班閘', '警報連響。小棠說別把孩子交回規則。老紀扔來濕鑰匙：「選吧。」', [
            choice(n2, 'a', '對小棠守約到底', 'PENDING', true, { promised_alin: true }, '對小棠守約'),
            choice(n2, 'b', '關閘保館', 'PENDING', true, { silenced_tower: true }, '關閘保館'),
            choice(n2, 'c', '逼老紀說舊債', 'PENDING', true, { confronted_zhou: true }, '逼老紀說舊債')
          ])
        ]
      };
    }
    if (axis === 2) {
      return {
        outline: '主題「' + t + '」：雨夜市場舊債；阿澤要公道，林姨知情不說。',
        cast: [
          {
            name: '阿澤',
            role: '舊債難分',
            want: '把舊帳一次算清',
            secret: '帳本有一行被塗掉',
            traits: {
              lookOrVoice: '笑著說話，笑不到眼底',
              fearOrLine: '被當傻瓜再一次',
              stanceToYou: '試探你會不會站邊',
              quirks: ['敲桌三下']
            }
          },
          {
            name: '林姨',
            role: '市場知情者',
            want: '保住還能過的日子',
            secret: '知道誰動了手',
            traits: {
              lookOrVoice: '低聲、像怕牆有耳',
              fearOrLine: '連累還在場上的人',
              stanceToYou: '半信半疑',
              quirks: ['擦同一隻杯子']
            }
          }
        ],
        nodes: [
          scene(n0, '雨棚下的帳', '「' + t + '」霓虹碎在水窪。阿澤敲桌：「討公道，或幫林姨封口？」林姨低聲：「別站中間。」', [
            choice(n0, 'a', '答應阿澤討公道', n1, true, { promised_zhou: true }, '答應討公道'),
            choice(n0, 'b', '先護林姨的沉默', n2, true, { promised_alin: true }, '護林姨沉默'),
            choice(n0, 'c', '逼問帳本塗改', n1, true, { confronted_zhou: true }, '逼問塗改')
          ]),
          scene(n1, '後巷與代價', '阿澤塞半張帳頁：「塗掉的是林姨親戚。」林姨：「說出去，街會少一攤。」', [
            choice(n1, 'a', '收下帳頁並守口', n2, true, { has_key: true }, '收下並守口'),
            choice(n1, 'b', '當眾揭開塗改', n2, true, { broke_promise: true }, '當眾揭開'),
            choice(n1, 'c', '要求兩人對質', n2, true, { asked_price: true }, '要求對質')
          ]),
          scene(n2, '收攤鈴聲', '收攤鈴響。公道與沉默對峙。鉤子咬住：討債、護人，或讓舊帳濕在雨裡。', [
            choice(n2, 'a', '幫阿澤收束舊債', 'PENDING', true, { promised_zhou: true }, '收束舊債'),
            choice(n2, 'b', '幫林姨埋掉秘密', 'PENDING', true, { silenced_tower: true }, '埋掉秘密'),
            choice(n2, 'c', '公布真相給整街', 'PENDING', true, { confronted_zhou: true }, '公布真相')
          ])
        ]
      };
    }
    return {
      outline:
        '主題「' +
        t +
        '」：你被請去找卡在訊號裡的阿琳；老周守開關，怕再按一次燒光。',
      cast: [
        {
          name: '阿琳',
          role: '訊號迴圈值班員',
          want: '有人聽完她沒說完的話',
          secret: '關掉迴圈可能連最後訊號也斷',
          traits: {
            lookOrVoice: '嗓音卡在迴圈裡，句子常半截',
            fearOrLine: '再被關掉就徹底消失',
            stanceToYou: '把你當唯一可能聽完的人',
            quirks: ['重複同一半句']
          }
        },
        {
          name: '老周',
          role: '守夜技師',
          want: '兌現不讓人失聯的承諾',
          secret: '舊事故與他有關',
          traits: {
            lookOrVoice: '話少，動作比言語先到',
            fearOrLine: '再按錯一次就全毀',
            stanceToYou: '把你當變數',
            quirks: ['答應前沉默兩秒']
          }
        }
      ],
      nodes: [
        scene(
          n0,
          '請柬與停電',
          '登入畫面剛亮起「' +
            t +
            '」，大廳就停電了。廣播裡女人的聲音卡在半句。老周抬眼：「你是來找阿琳的？還是來關這裡的？」',
          [
            choice(n0, 'a', '答應老周：先救人', n1, true, { promised_zhou: true }, '答應先救人'),
            choice(n0, 'b', '跟著阿琳的聲音走', n2, true, { heard_broadcast: true }, '跟著阿琳走'),
            choice(n0, 'c', '先問清代價再動', n1, true, { asked_price: true }, '先問清代價')
          ]
        ),
        scene(
          n1,
          '樓梯與承諾',
          '老周把溫熱鑰匙塞進你掌心：「上面有她最後的值班紀錄。我答應過——再不讓人失聯。」',
          [
            choice(n1, 'a', '握緊鑰匙，答應他', n2, true, { has_key: true, trusted_zhou: true }, '握鑰匙答應'),
            choice(n1, 'b', '拒絕承諾，自己上去', n2, true, { refused_promise: true }, '拒絕承諾'),
            choice(n1, 'c', '請他一起上樓', n2, true, { zhou_comes: true }, '請他一起上樓')
          ]
        ),
        scene(
          n2,
          '迴圈裡的她',
          '阿琳對準你：「別讓老周再按一次。」日誌寫著：密碼是回聲。鉤子已咬住。',
          [
            choice(n2, 'a', '對阿琳承諾：拉你回來', 'PENDING', true, { promised_alin: true }, '承諾拉回阿琳'),
            choice(n2, 'b', '關掉迴圈，保住這裡', 'PENDING', true, { silenced_tower: true }, '關迴圈保設施'),
            choice(n2, 'c', '逼老周說出當年真相', 'PENDING', true, { confronted_zhou: true }, '逼問真相')
          ]
        )
      ]
    };
  }

  function scene(id, title, narrative, choices) {
    return { id: id, title: title, type: 'scene', narrative: narrative, choices: choices };
  }

  function choice(nid, suf, label, to, affects, setFlags, plantsSeed) {
    return {
      id: nid + '_' + suf,
      label: label,
      to: to,
      affectsStory: !!affects,
      setFlags: setFlags || {},
      plantsSeed: plantsSeed || null
    };
  }

  function nextId(id) {
    var m = String(id).match(/n_(\d+)/);
    var n = m ? parseInt(m[1], 10) + 1 : 1;
    return 'n_' + StoryUtil.pad3(n);
  }

  function maxNodeNum(run) {
    var max = 0;
    Object.keys(run.nodes || {}).forEach(function (id) {
      var m = id.match(/n_(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max;
  }

  function activeFlagKeys(flags) {
    return Object.keys(flags || {}).filter(function (k) { return flags[k]; });
  }

  function memorySentences(flags) {
    var keys = activeFlagKeys(flags);
    var lines = [];
    for (var i = 0; i < keys.length; i++) {
      if (MEMORY[keys[i]]) lines.push(MEMORY[keys[i]]);
    }
    if (!lines.length) return '';
    // 最多織兩句記憶，避免清單感
    if (lines.length === 1) return lines[0] + '。';
    var a = lines[Math.floor(Math.random() * lines.length)];
    var b = lines[Math.floor(Math.random() * lines.length)];
    if (a === b && lines.length > 1) b = lines[(lines.indexOf(a) + 1) % lines.length];
    return a + '；' + b + '。';
  }

  function toneFlavor(persona) {
    var t = persona.tone || '';
    if (t === '冷淡') return '語氣像在記錄天氣，沒有多餘的驚嘆';
    if (t === '戲謔') return '荒謬裡仍帶著一點好笑的輕';
    if (t === '詩意') return '光影在牆縫裡拉出細長的句子';
    if (t === '公文') return '一切發生得乾淨、清楚，像被歸檔過';
    if (t === '偏執') return '每個細節都像在對你說：有東西不對勁';
    if (t === '溫柔') return '即使危險，空氣裡仍殘留一點被照顧過的溫';
    return '';
  }

  function focusHook(persona, place) {
    var f = persona.focus || '';
    if (f.indexOf('物件') >= 0) return '你注意到地上一枚還在轉的螺絲，轉速與心跳幾乎同步。';
    if (f.indexOf('人際') >= 0) return '某處傳來壓低的對話，兩個聲音忽然同時停住，像發現了你。';
    if (f.indexOf('空間') >= 0) return place + '的邊界在微微扭曲，出口與入口交換了位置。';
    if (f.indexOf('系統') >= 0) return '規則面板在眼角閃了一下：本層禁止「回頭」。';
    return '';
  }

  function pacingJoin(persona, parts) {
    var p = persona.pacing || '';
    var clean = parts.filter(Boolean);
    if (p.indexOf('跳躍') >= 0) return clean.slice(0, 3).join('——');
    if (p.indexOf('對話') >= 0) {
      return clean.join('') + '有人在暗處低聲說：「你還要選多久？」';
    }
    if (p.indexOf('流水') >= 0) {
      // 流水帳：多保留細節，用輕連接，避免句句「然後」
      return clean.join('');
    }
    // 極慢描寫：保留較多感官
    return clean.join('');
  }

  function buildNarrative(persona, flags, sceneDef, beat) {
    var mem = memorySentences(flags);
    var flavor = toneFlavor(persona);
    var hook = focusHook(persona, sceneDef.title);
    var parts = [
      '你走進「' + sceneDef.title + '」。',
      sceneDef.sensory + '。',
      flavor ? flavor + '。' : '',
      mem,
      beat + '。',
      sceneDef.tension + '。',
      hook
    ];
    var text = pacingJoin(persona, parts);
    // 清理重複句號
    text = text.replace(/。+/g, '。').replace(/；。/g, '。').replace(/。——/g, '——');
    return voiceWrap(persona, text);
  }

  function sceneChoiceLabels(persona, chaos, sceneDef) {
    var pack = (sceneDef.labels || ['往深處走', '停下來觀察', '跟聲音走']).slice();
    var weird = ['對空氣道歉', '數自己的手指', '邀請錯誤發生', '把劇情吃掉'];
    if (chaos >= 3) pack[2] = weird[Math.floor(Math.random() * weird.length)];
    if (chaos >= 5) pack[1] = weird[Math.floor(Math.random() * weird.length)];
    if (persona.moral === '犬儒') pack[0] = '嘲笑這層任務目標';
    if (persona.moral === '理想') pack[0] = '先找還能救的人';
    if (persona.moral === '殘酷現實') pack[1] = '先顧自己再說話';
    return pack;
  }

  function meaningfulFlagKey(id, c, sceneDef) {
    var map = [
      'lingered_' + sceneDef.title,
      'touched_' + sceneDef.title,
      'defied_' + sceneDef.title
    ];
    // 用穩定英文 key，但不進敘事；敘事走 MEMORY 或通用回憶
    return 'f_' + id + '_' + c;
  }

  function endingIdFromFlags(flags) {
    var keys = activeFlagKeys(flags);
    if (keys.indexOf('has_key') >= 0 || keys.indexOf('tried_key') >= 0) return 'ending_connect';
    if (keys.indexOf('forced_door') >= 0 || keys.indexOf('climbed_higher') >= 0) return 'ending_disconnect';
    if (keys.indexOf('accepted_glitch') >= 0) return 'ending_loop';
    if (keys.length >= 8) return 'ending_heavy';
    return 'ending_drift';
  }

  function generateLocal(run, needEnding) {
    var persona = run.persona || {};
    var flags = run.flags || {};
    var startNum = maxNodeNum(run) + 1;
    if (needEnding) {
      var eid = endingIdFromFlags(flags);
      var nid = 'n_' + StoryUtil.pad3(startNum);
      return {
        nodes: [{
          id: nid,
          title: endingTitle(eid),
          type: 'ending',
          endingId: eid,
          narrative: endingNarrative(eid, persona, flags, run),
          choices: []
        }]
      };
    }
    var nodes = [];
    var chaos = Number(persona.chaos) || 3;
    for (var i = 0; i < CHUNK; i++) {
      var id = 'n_' + StoryUtil.pad3(startNum + i);
      var sceneDef = SCENES[Math.floor(Math.random() * SCENES.length)];
      var beat = BEATS[Math.floor(Math.random() * BEATS.length)];
      var narrative = buildNarrative(persona, flags, sceneDef, beat);
      var labels = sceneChoiceLabels(persona, chaos, sceneDef);
      var choices = [];
      for (var c = 0; c < MIN_CHOICES; c++) {
        var affects = c === 0 || (c === 1 && Math.random() < 0.55);
        var setFlags = {};
        if (affects) setFlags[meaningfulFlagKey(id, c, sceneDef)] = true;
        if (affects && flags.has_key && c === 0) setFlags.used_key_memory = true;
        var to = i === CHUNK - 1 ? 'PENDING' : 'n_' + StoryUtil.pad3(startNum + i + 1);
        if (i < CHUNK - 1 && c === 2 && Math.random() < 0.5) {
          to = 'n_' + StoryUtil.pad3(Math.min(startNum + i + 2, startNum + CHUNK - 1));
        }
        choices.push(choice(id, String.fromCharCode(97 + c), labels[c], to, affects, setFlags));
      }
      nodes.push(scene(id, sceneDef.title, narrative, choices));
    }
    return { nodes: nodes };
  }

  function voiceWrap(persona, text) {
    if ((persona.voice || '').indexOf('不可靠') >= 0) return text + '也許這不是真的。';
    if ((persona.voice || '').indexOf('疏離') >= 0) return '有人遠看著這一切：' + text;
    return text;
  }

  function endingTitle(eid) {
    return ({
      ending_connect: '結局：接通',
      ending_disconnect: '結局：斷線',
      ending_loop: '結局：循環',
      ending_heavy: '結局：過重的存檔',
      ending_drift: '結局：漂移'
    })[eid] || '結局';
  }

  function endingNarrative(eid, persona, flags, run) {
    var mem = memorySentences(flags);
    var memLead = mem ? mem.replace(/。$/, '——') : '';
    var soft = toneFlavor(persona);
    var softTail = soft ? soft + '。' : '';
    return ({
      ending_connect:
        memLead +
        '你守住了承諾。主懸念合上，有人輕聲說：連線完成。' +
        softTail,
      ending_disconnect:
        memLead +
        '你選了斷。訊號像被抽走的線。登出前最後一瞬，你只記住風的味道，與那句沒兌現的話。' +
        softTail,
      ending_loop:
        memLead +
        '你接受了錯亂——於是又落回同一則故事的入口。故事沒有結束，只是從同一句開頭再聽你選一次。' +
        softTail,
      ending_heavy:
        memLead +
        '你帶著太多沒說完的選擇。系統輕輕合上這頁：不是失敗，只是這局已經太滿。' +
        softTail,
      ending_drift:
        memLead +
        '沒有爆炸，也沒有勝利。你在沉默裡走出這則短篇，像走完一場未完的夢。' +
        softTail
    })[eid];
  }

  global.StoryGen = {
    fixtureOpening: fixtureOpening,
    pickRandomTheme: pickRandomTheme,
    generateLocal: generateLocal,
    endingIdFromFlags: endingIdFromFlags,
    nextId: nextId
  };
})(window);
