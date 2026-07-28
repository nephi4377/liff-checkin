/**
 * SketchUp 渲染工作室 — 前端設定
 * GAS URL 與 shared/js/config.js ACCOUNTING_GAS_WEB_APP_URL 對齊
 */
window.SKETCHUP_RENDER_CONFIG = {
  GAS_URL:
    'https://script.google.com/macros/s/AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA/exec',
  PUBLIC_URL: 'https://info.tanxin.space/tools/sketchup-render-studio/',
  MAX_IMAGES: 8,
  /** policy 連線失敗時的 LIFF 後備（正式以 accounting_policy 回傳為準） */
  LIFF_ID: '2010425298-2WzpdELs'
};
