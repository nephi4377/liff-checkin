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

  /** 語氣選項（預設活潑親切） */
  TONE_OPTIONS: [
    { value: '活潑親切', label: '活潑親切（預設）' },
    { value: '專業溫暖', label: '專業溫暖' },
    { value: '輕鬆聊天', label: '輕鬆聊天' },
    { value: '正式簡潔', label: '正式簡潔' }
  ],

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
