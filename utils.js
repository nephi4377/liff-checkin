/*
* =============================================================================
* 檔案名稱: utils.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 存放可供各處重複使用的輔助工具函式。
* =============================================================================
*/

const DEBUG_THUMBS = true;

/** 縮圖專用 logger */
export function thumbLog(msg) {
  if (!DEBUG_THUMBS) return;
  console.log('[THUMB]', msg);
  // logToPage(`[THUMB] ${msg}`); // Removed to break circular dependency
}

/** 將訊息輸出到頁面下方的除錯區塊 */
export function logToPage(message) {
  const el = document.getElementById('debug-log');
  if (!el) return;
  const t = new Date().toLocaleTimeString('zh-TW');
  el.textContent += `[${t}] ${message}\n`;
  el.scrollTop = el.scrollHeight;
}

/** 從各種 Google Drive 連結中提取檔案 ID */
export function driveFileId(u) {
  if (!u) return '';
  u = String(u).trim();
  let m;
  // [核心修正] 修正不合法的正規表示式，使其能正確匹配 id=... 或 fileId=... 等參數
  m = u.match(/[?&](?:id|ids|fileId)=([a-zA-Z0-9_-]+)/); if (m) return m[1];
  m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
  m = u.match(/\/open\?id=([a-zA-Z0-9_-]+)/); if (m) return m[1];
  return '';
}

/** 判斷是否為行動裝置 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}