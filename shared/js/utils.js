/**
 * =============================================================================
 * 檔案名稱: utils.js
 * 專案名稱: 前端共用工具函式庫
 * 版本: v1.0
 * 說明:
 *   此檔案包含所有前端頁面可共用的輔助函式，例如：
 *   - 檔案處理 (轉 Base64)
 *   - UI 互動 (全域通知)
 *
 * 如何使用:
 *   在 HTML 檔案中，使用 <script type="module"> 引入此檔案，
 *   並透過 import { functionName } from './utils.js'; 來使用。
 * =============================================================================
 */

/**
 * 將 File 物件非同步讀取為純 Base64 字串。
 * @param {File} file - 要讀取的檔案。
 * @returns {Promise<string>} - 一個解析為 Base64 資料字串的 Promise。
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // 成功讀取後，移除 data-url 的前綴 (e.g., "data:image/jpeg;base64,")，只回傳純資料
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * 在 Console 中輸出帶有時間戳的日誌訊息。
 * @param {string} message - 要記錄的訊息。
 * @param {'log'|'warn'|'error'} [type='log'] - 日誌類型。
 */
export function logToPage(message, type = 'log') {
  const t = new Date().toLocaleTimeString('zh-TW');
  const formattedMessage = `[${t}] ${message}`;

  switch (type) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
      break;
  }
}

/** 判斷是否為行動裝置 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * [v406.0 重構] 從各種 Google Drive 連結中提取檔案 ID。
 * 此函式取代了舊的 driveFileId，使用更穩健的正規表示式。
 * @param {string} url - 完整的 Google Drive URL。
 * @returns {string|null} 檔案 ID 或 null。
 */
export function extractDriveFileId(url) {
  if (!url) return null;
  const idRegex = /\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/;
  const match = url.match(idRegex);
  return match ? (match[1] || match[2]) : null;
}

/**
 * 在畫面頂部顯示一個全域的、可自動消失的通知橫幅。
 * @param {string} message - 要顯示的訊息文字。
 * @param {number} [duration=3000] - 訊息顯示的持續時間（毫秒）。
 * @param {'info'|'success'|'error'} [type='info'] - 訊息類型，決定橫幅顏色。
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

/**
 * [v416.0 SPA化] 快取管理函式：儲存資料到 localStorage。
 * (從 main.js 移入)
 * @param {string} key - 快取的鍵名。
 * @param {object} data - 要儲存的資料。
 * @param {number} [days=7] - 快取有效期（天）。
 */
export function saveCache(key, data, days = 7) {
  const cache = {
    data: data,
    expires: Date.now() + days * 24 * 60 * 60 * 1000
  };
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (e) {
    console.error('儲存快取失敗:', e);
  }
}

/**
 * [v416.0 SPA化] 快取管理函式：從 localStorage 載入資料。
 * (從 main.js 移入)
 * @param {string} key - 快取的鍵名。
 * @returns {object|null} - 快取資料或 null。
 */
export function loadCache(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  const cache = JSON.parse(cached);
  if (cache.expires < Date.now()) {
    localStorage.removeItem(key);
    return null;
  }
  return cache.data;
}

/** 主控台今日打卡燈號 localStorage 鍵（依日期，與班表快取策略一致） */
export function hubPresenceCacheKey(date = new Date()) {
  const d = date;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `spa_hub_presence_${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 今日日期鍵 YYYY-MM-DD（燈號快取校驗用） */
export function hubPresenceTodayStr(date = new Date()) {
  const d = date;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 清除非今日的燈號快取（隔天不重複使用昨日資料） */
export function purgeStaleHubPresenceCaches() {
  const todayKey = hubPresenceCacheKey();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('spa_hub_presence_') && k !== todayKey) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {
    console.warn('[Hub] 清除舊燈號快取失敗', e);
  }
}

/** 讀取今日燈號快取；非今日或格式不符則回傳 null */
export function loadHubPresenceCache() {
  purgeStaleHubPresenceCaches();
  const today = hubPresenceTodayStr();
  const raw = loadCache(hubPresenceCacheKey());
  if (!raw || typeof raw !== 'object') return null;
  if (raw.date && raw.date !== today) return null;
  if (raw.presence && typeof raw.presence === 'object') return raw.presence;
  return null;
}

/** 次日凌晨 00:00（本地時區） */
export function getNextMidnightMs(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 依日期鍵寫入快取（過期：隔日 00:00） */
export function saveDailyCache(key, data, dateStr = hubPresenceTodayStr()) {
  const cache = {
    data: { date: dateStr, payload: data },
    expires: getNextMidnightMs()
  };
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (e) {
    console.error('儲存每日快取失敗:', e);
  }
}

/** 讀取依日期鍵的快取；非今日則回傳 null */
export function loadDailyCache(key, dateStr = hubPresenceTodayStr()) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  try {
    const cache = JSON.parse(cached);
    if (cache.expires < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    const raw = cache.data;
    if (!raw || raw.date !== dateStr) return null;
    return raw.payload ?? null;
  } catch (e) {
    return null;
  }
}

/** 清除非今日的 `prefix_YYYY-MM-DD` 快取 */
export function purgeStaleDailyCaches(prefix) {
  const todaySuffix = hubPresenceTodayStr();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && !k.endsWith(todaySuffix)) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {
    console.warn('[Hub] 清除舊每日快取失敗', e);
  }
}

/** 主控台側欄快取鍵（依日期） */
export function hubSidebarDailyCacheKey(prefix, date = new Date()) {
  const d = date;
  const pad2 = (n) => String(n).padStart(2, '0');
  const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return `${prefix}_${ds}`;
}

/** 由燈號資料組 Google Maps 連結 */
export function buildPresenceMapUrl(presence) {
  if (!presence) return '';
  if (presence.mapUrl) return presence.mapUrl;
  const lat = parseFloat(presence.lat);
  const lng = parseFloat(presence.lng);
  if (!isNaN(lat) && !isNaN(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
  const label = presence.locationLabel || presence.proximityStatus || presence.closestSiteName || presence.address || '';
  if (!label) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
}

/** 打卡範圍顯示文字（優先 proximity，其次地址／案場名） */
export function buildPresenceLocationLabel(presence) {
  if (!presence) return '';
  if (presence.locationLabel) return presence.locationLabel;
  const prox = String(presence.proximityStatus || '').trim();
  if (prox) return prox;
  if (presence.address) return presence.address;
  if (presence.closestSiteName) return presence.closestSiteName;
  return '';
}

/** 寫入今日燈號快取（內含 date 欄位，過期時間為隔日 00:00） */
export function saveHubPresenceCache(presence) {
  const key = hubPresenceCacheKey();
  const cache = {
    data: { date: hubPresenceTodayStr(), presence },
    expires: getNextMidnightMs()
  };
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (e) {
    console.error('儲存燈號快取失敗:', e);
  }
}

/**
 * 出席 chip 側邊燈號 class；僅「上班／加班」顯示，休假不顯示。
 * 應上班且尚無打卡資料時先顯示紅燈（含隔日無快取、背景更新中）。
 */
export function resolvePresenceDotClass({ dayKey, statusKind, presence, presenceLoading }) {
  if (dayKey !== 'today') return 'presence-none';
  if (statusKind === 'leave' || statusKind === 'off') return 'presence-none';
  if (statusKind !== 'work' && statusKind !== 'overtime') return 'presence-none';
  const p = presence;
  if (p && p.light && p.light !== 'none') return `presence-${p.light}`;
  if (presenceLoading || !p || !p.hasCheckIn) return 'presence-red';
  return 'presence-none';
}

/** HH:mm → 當日分鐘數；無效回傳 null */
export function parseTimeToMinutes(hm) {
  const m = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** 遲到分鐘（扣彈性後）；≤0 表示準時或彈性內 */
export function computeLateMinutes(checkInTime, shiftStart, flexibleMinutes = 0) {
  const ci = parseTimeToMinutes(checkInTime);
  const ss = parseTimeToMinutes(shiftStart);
  if (ci == null || ss == null) return 0;
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  return Math.max(0, ci - ss - flex);
}

/**
 * [v552.0 新增] 以 GET 請求方式發送 API Payload，用於繞過 CORS 問題。
 * @param {string} baseUrl - 後端 API 的基礎 URL。
 * @param {object} payload - 要發送的資料物件。
 * @returns {Promise<string>} - 一個解析為後端回應文字 (如 "OK") 的 Promise。
 */
export function sendApiRequestAsGet(baseUrl, payload) {
  const url = new URL(baseUrl);
  url.searchParams.set('payload', JSON.stringify(payload));
  return fetch(url, { method: 'GET' })
    .then(res => res.text());
}
/**
 * 壓縮圖片共用函式
 * 依賴 browser-image-compression 函式庫 (需在 HTML 中引入 CDN)
 * 
 * @param {File} file - 原始檔案物件
 * @param {number} maxSizeMB - 最大檔案大小 (MB)，預設 1MB
 * @param {number} maxWidthOrHeight - 最大寬或高 (px)，預設 1920px
 * @returns {Promise<File>} - 壓縮後的檔案物件，若壓縮失敗則回傳原檔
 */
export async function compressImage(file, maxSizeMB = 1, maxWidthOrHeight = 1920) {
  // 1. 基本檢查：若不是圖片或檔案不存在，直接回傳原檔
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  // 2. 檢查全域變數 imageCompression 是否存在
  if (typeof imageCompression === 'undefined') {
    console.warn('browser-image-compression library not loaded. Skipping compression.');
    return file;
  }

  const options = {
    maxSizeMB: maxSizeMB,
    maxWidthOrHeight: maxWidthOrHeight,
    useWebWorker: true
  };

  try {
    // 3. 執行壓縮
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    // 4. 錯誤處理：壓縮失敗時回傳原檔，不中斷流程
    console.error('圖片壓縮失敗，將使用原圖上傳:', error);
    return file;
  }
}