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
  DEFAULT_LOGO_URL: 'assets/logo.png',
  FALLBACK_LOGO_URL: 'assets/logo.svg',
  FB_PAGE_URL: 'https://www.facebook.com/TainanTanXin',
  STORAGE_KEY: 'tx_fb_post_studio_v1',
  /** 快捷改圖指令（後端仍會再包一層「保留結構／禁止畫 LOGO」守則） */
  EDIT_PRESETS: [
    {
      id: 'beautify',
      label: '空間美化',
      instruction:
        '調整光線與白平衡、適度去雜物與凌亂小物，讓完工照更適合發文；保留真實空間結構、主要家具與鏡頭角度，不要重建空間。'
    },
    {
      id: 'commercial',
      label: '商業攝影感',
      instruction:
        '提高對比與色彩層次，偏專業室內攝影風格與自然色溫；不要改變格局、家具位置或材質本質。'
    },
    {
      id: 'privacy',
      label: '去人物／隱私',
      instruction:
        '移除或模糊人物、車牌、可辨識證件／信件文字與其他隱私物件；其餘空間與家具保持不變。'
    },
    {
      id: 'bg_clean',
      label: '背景淨化',
      instruction:
        '簡化雜亂背景與地面散落物，主體家具與空間結構不變；不要新增不存在的裝潢。'
    },
    {
      id: 'compose',
      label: '構圖建議（直式／方）',
      instruction:
        '在保留真實空間的前提下，微調裁切與視覺重心，讓構圖更適合 Facebook 貼文（偏直式或方圖）；不要大幅扭曲透視。'
    }
  ]
};
