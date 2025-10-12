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

/**
 * [重構] 在主標題下方顯示一個全域的、暫時的通知橫幅。
 * @param {string} message - 要顯示的訊息文字。
 * @param {number} duration - 訊息顯示的持續時間（毫秒）。
 * @param {'info'|'success'|'error'} type - 訊息類型，決定橫幅顏色。
 */
export function showGlobalNotification(message, duration, type = 'info') {

  // [核心重構] 尋找或建立一個專門用來放置所有通知的容器
  let notificationContainer = document.getElementById('global-notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'global-notification-container';
    // [核心修正] 將容器改為 fixed 定位，使其漂浮在頁面頂部中央，不影響其他內容佈局。
    notificationContainer.style.cssText = `
      position: fixed;
      top: 1rem; /* 距離視窗頂部 1rem */
      left: 50%;
      transform: translateX(-50%); /* 水平置中 */
      z-index: 9999; /* 確保在最上層 */
      display: flex;
      flex-direction: column;
      align-items: center; /* 讓通知項目在容器內置中 */
      gap: 0.5rem; /* 通知之間的間距 */
    `;
    // [核心修正] 將容器直接附加到 body，使其獨立於頁面其他元素的佈局。
    document.body.appendChild(notificationContainer);
  }

  // 根據類型決定顏色 (邏輯不變)
  const colors = {
    info: { bg: '#dbeafe', text: '#1e40af' }, // 藍色
    success: { bg: '#dcfce7', text: '#166534' }, // 綠色
    error: { bg: '#fee2e2', text: '#991b1b' }  // 紅色
  };
  const selectedColor = colors[type] || colors.info;

  // 建立新的通知橫幅元素
  const notificationItem = document.createElement('div');
  notificationItem.className = 'global-notification-item';
  notificationItem.textContent = message;

  // 設定樣式
  notificationItem.style.cssText = `
    background-color: ${selectedColor.bg};
    color: ${selectedColor.text};
    padding: 0.75rem 1.5rem; /* 稍微增加左右內距，讓外觀更舒適 */
    border-radius: 0.5rem;
    text-align: center;
    font-weight: 600;
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1); /* 增加更明顯的陰影，突顯漂浮感 */
    min-width: 300px; /* 設定最小寬度，避免訊息太短時過窄 */
  `;

  notificationContainer.appendChild(notificationItem);

  // 設定計時器，在指定時間後自動移除通知
  setTimeout(() => {
    notificationItem.style.opacity = '0';
    notificationItem.style.transform = 'translateY(-20px)'; // 加上向上移出的動畫效果
    setTimeout(() => notificationItem.remove(), 500); // 等待淡出動畫結束後再移除 DOM
  }, duration);
}
