/**
 * FB 發文工作室 — 前端設定
 * GAS URL 與 shared/js/config.js ACCOUNTING_GAS_WEB_APP_URL 對齊
 */
window.FB_POST_STUDIO_CONFIG = {
  GAS_URL:
    'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec',
  COPY_MODEL: 'gemini-2.5-flash',
  IMAGE_MODEL: 'gemini-3.1-flash-image',
  MAX_IMAGE_EDGE: 1600,
  MAX_BYTES: 4 * 1024 * 1024,
  JPEG_QUALITY: 0.82,
  /** 多圖上傳上限（可調） */
  MAX_IMAGES: 10,
  /** 文案版本 localStorage 保留筆數 */
  COPY_HISTORY_MAX: 40,
  DEFAULT_LOGO_URL: 'assets/logo.png',
  FALLBACK_LOGO_URL: 'assets/logo.svg',
  FB_PAGE_URL: 'https://www.facebook.com/TainanTanXin',
  STORAGE_KEY: 'tx_fb_post_studio_v1',
  COPY_HISTORY_KEY: 'tx_fb_post_studio_copy_history_v1',
  STICKER_DB_KEY: 'tx_fb_post_studio_stickers_v1',
  STICKER_MAX: 40,

  /** 語氣選項（預設活潑親切） */
  TONE_OPTIONS: [
    { value: '活潑親切', label: '活潑親切（預設）' },
    { value: '專業溫暖', label: '專業溫暖' },
    { value: '輕鬆聊天', label: '輕鬆聊天' },
    { value: '正式簡潔', label: '正式簡潔' }
  ],

  /**
   * 文案標籤（可多選組合）— 對齊改圖標籤 UX
   * 合成順序：prefix → middle → suffix → 自由補充（extra_notes）
   * 與類型／語氣一併送後端 fb_post_generate
   */
  COPY_TAGS: {
    prefix: [
      { id: 'hook', label: '開場鉤子', text: '開頭用一句吸睛鉤子抓住滑動中的讀者' },
      { id: 'finish_joy', label: '完工喜悅', text: '帶出完工喜悅與交付成就感' },
      { id: 'warm_daily', label: '溫馨日常', text: '溫馨日常、居家生活感' },
      { id: 'consult_pro', label: '專業諮詢感', text: '偏專業諮詢、可信賴的室內設計顧問口吻' },
      { id: 'promo_limit', label: '促銷限時', text: '帶出限時／活動感（勿虛構不實優惠）' },
      { id: 'story', label: '故事敘事', text: '用簡短故事帶出空間改變' }
    ],
    middle: [
      { id: 'space_highlight', label: '空間亮點', text: '著重空間動線與視覺亮點' },
      { id: 'material', label: '材質工法', text: '說明材質與工法細節（依圖實寫，勿瞎掰）' },
      { id: 'lifestyle', label: '生活場景', text: '連結真實生活使用場景' },
      { id: 'before_after', label: '前後對比', text: '若有對比感，輕描前後差異（勿造假）' },
      { id: 'client_feel', label: '客戶感受', text: '描述住起來的感受（禁止洩漏真實姓名／地址／電話等個資）' },
      { id: 'storage', label: '實用收納', text: '強調實用收納與生活機能' },
      { id: 'light', label: '採光氛圍', text: '突出採光、燈光與氛圍' }
    ],
    suffix: [
      { id: 'cta_line', label: 'CTA 加 LINE', text: '結尾 CTA 邀請加入官方 LINE 諮詢' },
      { id: 'cta_fb', label: 'CTA 私訊粉專', text: '結尾 CTA 邀請私訊粉專了解' },
      { id: 'cta_measure', label: '邀請預約丈量', text: '結尾邀請預約丈量或到府諮詢' },
      { id: 'htag_more', label: 'hashtag 偏多', text: 'hashtags 可偏多（約 6～8 個）' },
      { id: 'htag_less', label: 'hashtag 精簡', text: 'hashtags 精簡（約 3～5 個）' },
      { id: 'tone_casual', label: '語氣更口語', text: '語氣再更口語、像跟朋友聊天' },
      { id: 'tone_pro', label: '語氣更專業', text: '語氣再更專業穩重，仍保持親切' },
      { id: 'emoji_soft', label: '適度 emoji', text: '適度穿插 emoji，不要整篇貼滿' }
    ]
  },

  /**
   * 短影音 S1（瀏覽器合成；ffmpeg.wasm 走 CDN，不進 git）
   */
  REEL: {
    WIDTH: 720,
    HEIGHT: 1280,
    MIN_SLIDES: 2,
    MAX_SLIDES: 10,
    SEC_PER_SLIDE: 2.4,
    FPS: 24,
    MAX_TOTAL_SEC: 28,
    FFMPEG_CORE_BASE: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
    FFMPEG_JS: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js',
    FFMPEG_UTIL: 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/umd/index.js',
    /** 內建 BGM：瀏覽器程序生成，無二進位資產 */
    BGM_PRESETS: [
      { id: 'off', label: '無音樂' },
      { id: 'soft', label: '輕柔氛圍（內建）' },
      { id: 'warm', label: '溫暖居家（內建）' },
      { id: 'bright', label: '明亮節奏（內建）' }
    ]
  },

  /**
   * AI 改圖標籤（可多選組合）
   * 合成順序：prefixA（鏡頭／構圖）→ prefixC（用途／情境）→ middle → suffix → 自由文字
   * 尺寸／比例請在「精修」裁切調整，前綴不含 1:1／4:5／16:9
   */
  EDIT_TAGS: {
    prefixA: [
      { id: 'keep_lens', label: '保持原鏡頭', text: '保持原本鏡頭角度與構圖' },
      { id: 'closer', label: '稍微靠近主體', text: '稍微靠近主體，讓重點更清楚' },
      { id: 'pull_back', label: '拉開看全貌', text: '拉開視野，呈現空間全貌與動線' },
      { id: 'subject_left', label: '主體偏左', text: '主體視覺重心略偏左' },
      { id: 'subject_right', label: '主體偏右', text: '主體視覺重心略偏右' },
      { id: 'slight_high', label: '略微俯視感', text: '略帶俯視感，空間層次更清楚' },
      { id: 'eye_level', label: '平視自然', text: '維持平視、自然觀看角度' },
      { id: 'detail_focus', label: '對準細節', text: '對準材質或工藝細節作為主焦點' }
    ],
    prefixC: [
      { id: 'finish_hero', label: '完工主圖', text: '作為完工案例主視覺' },
      { id: 'detail_shot', label: '細節特寫', text: '強調細節特寫，適合材質與工藝說明' },
      { id: 'mood', label: '氛圍圖', text: '偏氛圍感，適合故事性發文' },
      { id: 'before_after', label: '對比前後', text: '適合前後對比發文的畫面感' },
      { id: 'promo_hero', label: '促銷主視覺', text: '適合作為促銷或活動主視覺' },
      { id: 'portfolio', label: '作品集展示', text: '乾淨利落，適合作品集展示' },
      { id: 'fb_feed', label: '粉專動態感', text: '適合 Facebook 粉專動態瀏覽' }
    ],
    middle: [
      { id: 'beautify', label: '空間美化', text: '調整光線與白平衡、適度去雜物，讓完工照更適合發文' },
      { id: 'commercial', label: '商業攝影感', text: '提高對比與色彩層次，偏專業室內攝影風格' },
      { id: 'declutter', label: '去雜物', text: '移除凌亂小物與地面散落物' },
      { id: 'privacy', label: '去人物／隱私', text: '移除或模糊人物、車牌、可辨識證件／信件文字與其他隱私物件' },
      { id: 'bg_clean', label: '背景淨化', text: '簡化雜亂背景，主體家具與空間結構不變' },
      { id: 'light_up', label: '光線提升', text: '提升整體亮度與層次，讓空間更明亮舒適' },
      { id: 'warm', label: '色溫偏暖', text: '色溫略偏暖、居家溫馨感' },
      { id: 'cool', label: '色溫偏冷', text: '色溫略偏冷、清爽現代感' },
      { id: 'material', label: '材質更清晰', text: '讓木皮、石材、布料等材質紋理更清晰自然' },
      { id: 'finish_show', label: '完工展示感', text: '強化完工展示感，乾淨利落適合作品集' },
      { id: 'lifestyle', label: '生活情境感', text: '增加自然生活情境氛圍（勿虛構可識別人物臉孔）' }
    ],
    suffix: [
      { id: 'keep_structure', label: '保留真實空間結構', text: '必須保留真實空間結構與主要家具位置' },
      { id: 'no_text', label: '不要亂加文字／LOGO', text: '不要在圖上加入任何文字、品牌名或 LOGO' },
      { id: 'no_furniture_move', label: '不要改變家具配置', text: '不要改變家具配置與格局' },
      { id: 'natural', label: '自然不過度', text: '效果自然不過度，避免假造感' },
      { id: 'fb_ready', label: '適合 FB 發文', text: '整體適合 Facebook 粉專發文' }
    ]
  },

  /** Canvas 濾鏡預設（簡易 CSS／參數近似） */
  FILTER_PRESETS: [
    { id: 'none', label: '無', brightness: 0, contrast: 0, saturate: 0, warm: 0 },
    { id: 'natural', label: '自然', brightness: 4, contrast: 4, saturate: 6, warm: 0 },
    { id: 'warm', label: '溫暖', brightness: 6, contrast: 2, saturate: 12, warm: 18 },
    { id: 'fresh', label: '清透', brightness: 10, contrast: 8, saturate: -4, warm: -6 },
    { id: 'punch', label: '對比加強', brightness: 2, contrast: 18, saturate: 10, warm: 0 }
  ]
};
