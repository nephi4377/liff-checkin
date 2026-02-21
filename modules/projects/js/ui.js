/*
* =============================================================================
* 檔案名稱: ui.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 專門負責將資料渲染成 HTML 畫面。
* =============================================================================
*/

import { state } from './state.js'; // 同一層
// [v406.0 重構] 移除舊的 driveFileId，改為使用新的 extractDriveFileId 函式。
import { logToPage, extractDriveFileId } from '/shared/js/utils.js'; // [v546.0 修正] 改為絕對路徑以解決本地測試 404 問題

/**
 * 在等待 API 資料時，於主要內容區塊顯示骨架屏（載入中的動畫效果）。
 * @returns {void}
 */
/** 顯示骨架屏 */
export function displaySkeletonLoader() {
    const scheduleContainer = document.getElementById('schedule-container');
    const logsContainer = document.getElementById('logs-container');

    const skeletonCardHTML = `
      <div class="skeleton-card">
        <div class="skeleton title"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line-short"></div>
      </div>
    `;

    if (scheduleContainer) {
        scheduleContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML}</div>`;
    }
    if (logsContainer) {
        logsContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML.repeat(3)}</div>`;
        logsContainer.style.display = 'block';
    }
}

/**
 * 當發生嚴重錯誤時，清空主內容區塊並顯示一個格式化的錯誤訊息。
 * @param {Error} err - 從 try-catch 捕捉到的錯誤物件。
 * @returns {void}
 */
/** 顯示錯誤訊息 */
export function displayError(err) {
    const msg = (err && err.message) ? err.message : '發生未知錯誤。';
    console.error('PAGE ERROR: ' + msg); // Log to console instead
    const statusContainer = document.getElementById('main-content'); // This might be null
    const errorHtml = `<div id="status-message" style="border:1px solid red;background:#ffebee;color:#c62828;padding:1rem;white-space:pre-wrap;margin:1rem;">
            <strong>載入失敗！</strong>\n\n
            <strong>錯誤訊息：</strong>\n${msg}\n\n
            <strong>建議：</strong>請檢查 Apps Script 後端日誌與路由設定（project）。
            </div>`;

    // 【您的要求】修正錯誤顯示邏輯，增加防禦性程式碼
    if (statusContainer) {
        statusContainer.innerHTML = errorHtml;
    } else {
        // 如果主容器不存在，直接將錯誤訊息寫入 body，確保使用者能看到
        document.body.innerHTML = errorHtml;
    }
}

/**
 * 專門渲染來自 Google Drive 的圖片。它會建立一個可點擊的圖片燈箱。
 * @param {string} fileId - Google Drive 檔案的 ID。
 * @returns {HTMLDivElement} 包含圖片的 div 容器。
 */
/** 渲染 Google Drive 圖片 */
function renderSmartImg(fileId) {
    const wrap = document.createElement('div'); wrap.className = 'photo-item';
    const img = document.createElement('img');
    img.className = 'photo-thumb lazy';
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    const largeUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    img.dataset.full = largeUrl;
    img.dataset.src = thumbnailUrl;
    // [v27.0 修正] 移除此處的事件綁定，統一由 buildPhotoGrid 處理
    img.onerror = () => { const ph = document.createElement('div'); ph.className = 'photo-placeholder'; ph.textContent = '縮圖載入失敗'; wrap.replaceChildren(ph); };
    wrap.appendChild(img); return wrap;
}

/**
 * 渲染直接的圖片連結（非 Google Drive）或 Base64 圖片。
 * @param {string} src - 圖片的 URL 或 Base64 字串。
 * @returns {HTMLDivElement} 包含圖片的 div 容器。
 */
/** 渲染一般圖片 */
function renderDirectImg(src) {
    const wrap = document.createElement('div'); wrap.className = 'photo-item';
    const img = document.createElement('img');
    img.className = 'photo-thumb lazy';

    if (src.startsWith('data:image/')) {
        img.dataset.src = src;
        img.dataset.full = src;
    } else {
        const lazySrc = src + (src.includes('?') ? '&' : '?') + '_=' + Date.now();
        img.dataset.src = lazySrc;
        img.dataset.full = src;
    }

    img.onload = () => logToPage('IMG OK ' + img.src);
    img.onerror = () => {
        const ph = document.createElement('div'); ph.className = 'photo-placeholder';
        ph.textContent = '無法載入縮圖（點此開啟原圖）'; ph.style.cursor = 'pointer';
        ph.onclick = () => window.open(src, '_blank', 'noopener,noreferrer');
        wrap.replaceChildren(ph); logToPage('IMG ERROR ' + img.src, 'error');
    };
    wrap.appendChild(img); return wrap;
}

/**
 * 根據一個包含多個圖片連結的字串，建立一個包含多張圖片的照片牆。
 * @param {string} htmlLinksCsv - 以逗號分隔的圖片 URL 字串。
 * @returns {HTMLDivElement} 包含所有圖片的 photo-grid 容器。
 */
/** 建立照片牆 */
function buildPhotoGrid(htmlLinksCsv) {
    const container = document.createElement('div');
    container.className = 'photo-grid';
    if (!htmlLinksCsv) return container;
    // [v350.0 核心修正] 優先判斷傳入的是否為陣列 (來自樂觀更新)。
    // 如果是字串 (來自後端)，才執行 split(',')。這使其能同時處理兩種資料來源。
    const links = Array.isArray(htmlLinksCsv) ? htmlLinksCsv : String(htmlLinksCsv).split(',').filter(Boolean);

    links.forEach(link => {
        const u = (link || '').trim(); if (!u) return;
        // 【⭐️ 核心修正：修正樂觀更新的縮圖顯示邏輯 ⭐️】
        // 1. 優先判斷是否為 Base64 字串，如果是，則直接渲染。
        if (u.startsWith('data:image/')) {
            container.appendChild(renderDirectImg(u));
        } else {
            const id = extractDriveFileId(u); // [v406.0 重構] 改為呼叫新的函式
            // 2. 如果不是 Base64，再判斷是 Google Drive 連結還是一般圖片連結。
            if (id) container.appendChild(renderSmartImg(id));
            else container.appendChild(renderDirectImg(u));
        }
    });

    return container;
}

// [核心修正] 將 buildPhotoGrid 導出，以便 handlers.js 可以呼叫
export { buildPhotoGrid };

/**
 * 根據單筆日誌資料，建立一個完整的日誌卡片 HTML 元素。
 * @param {object} log - 包含日誌資訊的物件 (LogID, Title, Content, PhotoLinks 等)。
 * @param {boolean} isDraftMode - 是否為草稿模式。若是，則會顯示「發布」按鈕。
 * @returns {HTMLDivElement} 一個 class 為 'card' 的 div 元素。
 */
/** 建立單張日誌卡片 */
export function _buildLogCard(log, isDraftMode) {
    const card = document.createElement('div'); card.className = 'card'; card.id = 'log-' + log.LogID;

    const timestamp = log.Timestamp ? new Date(log.Timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '-';
    // [v363.0 核心修正] 增加 String() 轉換，確保即使 log.Content 是數字 0 或其他非字串類型，
    // 也能安全地呼叫 .replace() 函式，避免因快取資料類型不一致導致的渲染錯誤。
    const displayContent = String(log.Content || '無內容').replace(/^\[更新 .*?\]\n/, '');

    const headerDiv = document.createElement('div');
    headerDiv.className = 'log-card-header';
    headerDiv.innerHTML = `
      <h3>${log.Title || '無標題'} <span class="muted">by ${log.UserName || '未知'}</span></h3>
      <small class="muted">${timestamp}</small>
    `;

    const contentDiv = document.createElement('div'); contentDiv.id = 'content-' + log.LogID;
    contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.textContent = displayContent;
    contentDiv.style.marginTop = '0.75rem';

    const buttonContainer = document.createElement('div'); buttonContainer.className = 'button-group'; buttonContainer.style.marginTop = '1rem';

    card.appendChild(headerDiv);
    card.appendChild(contentDiv);
    card.appendChild(buttonContainer);

    if (log.PhotoLinks) {
        const photoContainer = document.createElement('div');
        card.insertBefore(photoContainer, buttonContainer); // 將照片容器插入到按鈕區塊之前
        const photoGrid = buildPhotoGrid(log.PhotoLinks);
        photoContainer.appendChild(photoGrid);

        // [v28.0 修正] 為卡片內的每張照片綁定開啟燈箱的事件
        const images = Array.from(photoGrid.querySelectorAll('img.photo-thumb'));
        images.forEach((img, index) => {
            img.addEventListener('click', () => {
                const urls = images.map(i => i.dataset.full);
                // 呼叫掛載在 window 上的全域函式來開啟燈箱
                if (window.__openLightbox__) window.__openLightbox__(urls, index);
            });
        });
    }

    // 【⭐️ 核心修正：移除行內樣式，改用 CSS class 統一管理顏色 ⭐️】
    const btnManagePhotos = document.createElement('button'); btnManagePhotos.textContent = '管理相片';
    btnManagePhotos.className = 'btn btn-green'; // 1. 移除 style.background, 2. 套用 .btn-green class
    btnManagePhotos.dataset.action = 'openPhotoModal'; btnManagePhotos.dataset.logId = log.LogID; btnManagePhotos.dataset.photoLinks = log.PhotoLinks; buttonContainer.appendChild(btnManagePhotos);

    const btnEditText = document.createElement('button'); btnEditText.textContent = '編輯文字';
    btnEditText.dataset.action = 'handleEditText'; btnEditText.dataset.logId = log.LogID; buttonContainer.appendChild(btnEditText);

    if (isDraftMode) {
        const btnPublish = document.createElement('button');
        btnPublish.id = 'btn-' + log.LogID;
        btnPublish.textContent = '審核與發布';
        btnPublish.style.background = '#16a34a';
        btnPublish.dataset.action = 'handlePublish'; btnPublish.dataset.logId = log.LogID;
        buttonContainer.appendChild(btnPublish);
    }

    // 【⭐️ 核心修正：將刪除按鈕移入按鈕群組，並套用正確樣式 ⭐️】
    const btnDelete = document.createElement('button');
    // 1. 套用 .btn 和 .btn-danger class，使其與其他按鈕大小一致並顯示為紅色系。
    btnDelete.className = 'btn btn-danger';
    btnDelete.textContent = '刪除';
    btnDelete.title = '刪除此日誌';
    btnDelete.dataset.action = 'deleteLog';
    btnDelete.dataset.logId = log.LogID;
    // 2. 將刪除按鈕也加入到 buttonContainer 中，確保與其他按鈕在同一行。
    buttonContainer.appendChild(btnDelete);

    return card;
}

/**
 * 建立日誌發文區塊的 HTML 字串。
 * @returns {string} 包含 textarea、照片預覽區和按鈕的 HTML 字串。
 */
/**
 * 建立或更新日誌發文區塊
 */
export function renderPostCreator() {
    const wallPostCreatorHTML = `
    <div class="card post-creator">
      <textarea id="post-creator-textarea" class="form-textarea" placeholder="今天有什麼新進度嗎？"></textarea>
      <!-- [核心新增] 新增標題下拉選單 -->
      <div class="mt-1">
        <label for="post-title-select" class="form-label">日誌標題 (可選)</label>
        <select id="post-title-select" class="form-select"></select>
      </div>
      <!-- [核心修正] 新增照片預覽容器和隱藏的檔案輸入框 -->
      <div id="new-log-photo-preview" class="photo-preview-container"></div>
      <input type="file" id="new-log-photos-input" multiple accept="image/*" style="display: none;">
      
      <div class="post-creator-actions">
        <div class="action-buttons">
          <button class="action-btn" id="add-photo-to-post-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.452a1.125 1.125 0 0 1-1.591 0z" clip-rule="evenodd" /></svg>
            <span>附加檔案</span>
          </button>
        </div>
        <button id="submit-post-btn" class="btn btn-primary">發佈</button>
      </div>
    </div>
  `;
    return wallPostCreatorHTML;
}

/**
 * 根據當前的分頁狀態 (state.currentPage)，渲染對應頁數的日誌卡片。
 * @returns {void}
 */
/** 渲染日誌分頁 */
export function renderLogPage() {
    if (state.isLoadingNextPage) return;
    state.isLoadingNextPage = true;

    const logsContainer = document.getElementById('logs-container');
    const startIndex = (state.currentPage - 1) * state.LOGS_PER_PAGE;
    const endIndex = startIndex + state.LOGS_PER_PAGE;
    const logsToShow = state.currentLogsData.slice(startIndex, endIndex);

    if (state.currentPage === 1) {
        Array.from(logsContainer.children).forEach(child => {
            if (!child.classList.contains('post-creator')) {
                child.remove();
            }
        });
    }

    document.getElementById('log-loader')?.remove();

    if (logsToShow.length > 0) {
        const isDraftMode = (state.projectId === '0'); // [核心修正] 改為從全域 state 讀取 projectId
        logsToShow.forEach(log => { logsContainer.appendChild(_buildLogCard(log, isDraftMode)); });
        // [核心修正] 移除此處的呼叫，將其職責交還給 main.js
        // lazyLoadImages();
    }

    if (endIndex < state.currentLogsData.length) {
        const loaderElement = document.createElement('div');
        loaderElement.id = 'log-loader';
        loaderElement.innerHTML = '<div class="spinner" style="width:2rem;height:2rem;margin:1rem auto;"></div>';
        logsContainer.appendChild(loaderElement);
        if (state.scrollObserver) state.scrollObserver.observe(loaderElement);
    }
    state.isLoadingNextPage = false;
}

/**
 * 根據單筆任務資料，建立一個可編輯的任務卡片 HTML 元素。
 * @param {object} task - 包含任務資訊的物件 (階段, 工種, 任務項目 等)。
 * @param {number} index - 該任務在排程陣列中的索引。
 * @returns {HTMLDivElement} 一個 class 為 'task-card' 的 div 元素。
 */
/** 渲染單張任務卡片 */

/**
 * 渲染右側的專案資訊面板，顯示案場基本資料、團隊成員、現場資訊等。
 * @param {object} overview - 專案總覽資訊物件。
 * @param {Array<object>} schedule - 專案排程資料，用於提取工班資訊。
 * @returns {void}
 */
/** 渲染右側專案資訊面板 */
export function displayProjectInfo(overview, schedule) {
    console.log('Rendering project info panel with overview:', overview, 'and schedule:', schedule);

    const panel = document.getElementById('project-info-panel');
    if (!panel) return;
    if (!overview) { panel.innerHTML = '<p class="muted">無專案資訊</p>'; return; }

    const get = (key) => overview[key] || '未提供';
    
    // [v215.0 核心修正] 將結案按鈕的 HTML 產生邏輯移至 panel.innerHTML 內部。
    // 舊寫法將其放在外部，導致 innerHTML 賦值時沒有包含此按鈕。
    const closeProjectButtonHtml = overview['專案狀態'] !== '已結案'
      ? `<button id="close-project-btn" class="btn btn-danger w-full mt-4">將此專案結案</button>`
      : `<div class="text-center p-2 bg-gray-200 text-gray-600 rounded-md mt-4">此專案已結案</div>`;
    panel.innerHTML = `
      <!-- [v188.0 新增] 複製案場資訊按鈕 -->
      <button id="copy-project-info-btn" class="btn btn-info w-full mb-4">複製案場資訊</button>
      <div class="project-info-section">
        <h4 class="info-header">專案基本資料</h4>
        <ul class="info-list">
          <li><strong>案場名稱:</strong> ${get('案場名稱')}</li>
          <li><strong>案場地址:</strong> <a href="https://www.google.com/maps?q=${encodeURIComponent(get('案場地址'))}" target="_blank" rel="noopener noreferrer">${get('案場地址')}</a></li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">團隊成員</h4>
        <ul class="info-list">
          <li><strong>設計師:</strong> ${get('設計師')}</li>
          <li><strong>助理:</strong> ${get('助理')}</li>
          <li><strong>工務:</strong> ${get('工務')}</li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">現場資訊</h4>
        <ul class="info-list">
          <li><strong>入門方式:</strong> ${get('入門方式')}</li>
          <li><strong>停車方式:</strong> ${get('停車方式')}</li>
          <li><strong>施工進場時間:</strong> ${get('施工進場時間')}</li>
          <li><strong>保證金事宜:</strong> ${get('保證金事宜')}</li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">備註</h4>
        <ul class="info-list">
          <li><strong>管理中心電話:</strong> <a href="tel:${get('備註-管理中心電話')}">${get('備註-管理中心電話')}</a></li>
          <li><strong>施工時間:</strong> ${get('備註-施工時間')}</li>
          <li style="white-space: pre-wrap;"><strong>衛浴使用說明:</strong><br>${get('衛浴使用說明')}</li>
          <li style="white-space: pre-wrap;"><strong>特別注意事項:</strong><br>${get('備註-特別注意事項')}</li>
        </ul>
      </div>
      ${closeProjectButtonHtml}`; // [v220.0 核心修正] 將結案按鈕的 HTML 包含進 innerHTML 的模板字串中

    const tradeContacts = new Map();
    if (schedule && schedule.length > 0) {
        schedule.forEach(task => {
            const trade = task['工種'];
            const person = task['負責人/工班'];
            if (trade && person) {
                if (!tradeContacts.has(trade)) tradeContacts.set(trade, new Set());
                tradeContacts.get(trade).add(person);
            }
        });
    }

    if (tradeContacts.size > 0) {
        let tradeHtml = '<hr class="info-divider"><div class="project-info-section"><h4 class="info-header">工班資訊</h4><ul class="info-list">';
        tradeContacts.forEach((persons, trade) => {
            tradeHtml += `<li><strong>${trade}:</strong> ${Array.from(persons).join(', ')}</li>`;
        });
        tradeHtml += '</ul></div>';
        panel.innerHTML += tradeHtml;
    }
}

/**
 * 建立或更新「工種」輸入框的 datalist，提供使用者輸入建議。
 * @returns {void}
 */
/** 建立或更新工種的 datalist */
export function createOrUpdateTradeDatalist() {
    const coreTrades = ['木作工程', '系統工程', '水電工程', '泥作工程', '石材工程', '玻璃工程', '窗簾工程', '保護工程', '清潔工程'];
    let datalist = document.getElementById('trade-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'trade-datalist';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = '';
    coreTrades.forEach(trade => {
        datalist.innerHTML += `<option value="${trade}"></option>`;
    });
}

/**
 * [v284.0 新增] 渲染單張樂觀更新的溝通紀錄卡片
 * @param {object} notification - 模擬的通知物件
 */
function addOptimisticCommunicationCard(notification) {
    const container = document.getElementById('communication-history-list');
    if (!container) return;

    // 移除可能存在的「無紀錄」提示
    const placeholder = container.querySelector('.muted');
    if (placeholder) placeholder.remove();

    const card = document.createElement('div');
    card.className = 'card communication-thread optimistic'; // 加上 optimistic class 以便識別
    card.id = `thread-${notification.TaskID}`;

    const deadline = notification.ActionDeadline ? new Date(notification.ActionDeadline).toLocaleString('sv').slice(0, 16) : null;

    card.innerHTML = `
      <div class="thread-header">
        <div class="thread-title-bar"><h4>${notification.Title || '系統訊息'}</h4><span class="text-xs text-gray-500 flex-shrink-0">${new Date(notification.Timestamp).toLocaleString('sv').slice(0, 16)}</span></div>
      </div>
      <div class="task-meta-bar">
        <span class="meta-item">發起人: <strong>${notification.SenderName}</strong></span>
        <span class="meta-item">收件人: <strong>${notification.RecipientName || '未指定'}</strong></span>
        <span>要求: <strong>${notification.ActionType || '無'}</strong></span>
        ${deadline ? `<span class="deadline">時限: <strong>${deadline}</strong></span>` : ''}
      </div>
      <div class="task-content"><p>${notification.Content}</p></div>
      <div class="replies-container"><div class="reply-card"><div class="reply-footer"><span class="status-tag bg-yellow-100 text-yellow-800">${notification.Status}</span></div></div></div>
    `;
    container.prepend(card); // 將新卡片插入到列表的最頂部
}
// 將函式掛載到 window，以便 taskSender.js 呼叫
window.addOptimisticCommunicationCard = addOptimisticCommunicationCard;

/**
 * [v372.0 重構] 圖片懶加載 (Lazy Loading) 函式。
 * 使用 IntersectionObserver API，當圖片進入可視範圍時才載入。
 * @returns {void}
 */
let lazyImageObserver;
const imageQueue = new Set(); // 圖片請求佇列
let activeRequests = 0; // [v596.0] 追蹤當前正在處理的請求數量
const MAX_CONCURRENT_REQUESTS = 5; // [v624.0 優化] 根據您的要求，將並行請求數提高到 5，加快圖片載入

export function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');

  /**
   * [內部函式] 處理圖片請求佇列。
   * [v596.0 重構] 此函式現在作為一個「總調度員」。
   * 它會以極短的間隔不斷檢查，只要佇列中有圖片且當前請求數未達上限，就立即派出新的「工人」去載入。
   */
  async function processQueue() {
      // 如果佇列已空，或請求數已達上限，則暫停，等待下一次被喚醒
      if (imageQueue.size === 0 || activeRequests >= MAX_CONCURRENT_REQUESTS) {
          return;
      }

      activeRequests++; // 派出一個工人，計數+1
      const lazyImage = imageQueue.values().next().value; // 取出佇列中的第一張圖片
      imageQueue.delete(lazyImage); // 從佇列中移除
      
      // 真正載入圖片的「工人」
      const loadImage = new Promise((resolve) => {
          lazyImage.onload = () => resolve();
          lazyImage.onerror = () => resolve(); // 無論成功或失敗都算完成
          lazyImage.src = lazyImage.dataset.src;
      });

      // 當這個工人完成工作後
      loadImage.then(() => {
          lazyImage.classList.remove("lazy");
          activeRequests--; // 工人回來了，計數-1
          processQueue(); // 立刻檢查是否能派出下一個工人
      });
      
      // 立刻檢查是否能派出更多工人（如果還沒達到上限）
      setTimeout(processQueue, 50); // [v624.0 優化] 根據您的要求，將批次間隔縮短為 50ms，讓載入更連貫
  }

  if ("IntersectionObserver" in window) {
    if (lazyImageObserver) {
      lazyImageObserver.disconnect();
      }

    lazyImageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                imageQueue.add(entry.target); // 將圖片加入佇列
                processQueue(); // 每次有新圖片進入視野，都嘗試啟動調度員
                observer.unobserve(entry.target); // 立即停止觀察，避免重複加入佇列
            }
        });
    });

    lazyImages.forEach((lazyImage) => {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    lazyImages.forEach((lazyImage) => {
      lazyImage.src = lazyImage.dataset.src;
      lazyImage.classList.remove("lazy");
    });
  }
}

/**
 * [v213.0 新增] 渲染溝通紀錄頁面
 * @param {object} groupedNotifications - 以 TaskID 分組的通知物件
 * @param {string} currentUserId - 當前登入者的 User ID
 */
export function renderCommunicationHistory(groupedNotifications, currentUserId) {
  const container = document.getElementById('communication-history-list'); // [v244.0 修正] 渲染到新的列表容器
  if (!container) { console.error('找不到 #communication-history-list 容器'); return; }


  if (Object.keys(groupedNotifications).length === 0) {
    container.innerHTML = '<p class="muted text-center p-8">此專案沒有任何溝通紀錄。</p>';
    return;
  }

  // [v284.0 修正] 在重新渲染前，移除所有樂觀更新的卡片
  container.querySelectorAll('.optimistic').forEach(card => card.remove());

  // 將任務串流依照最後一則訊息的時間排序，最新的在最上面
  const sortedTaskIds = Object.keys(groupedNotifications).sort((a, b) => {
    const lastMsgA = groupedNotifications[a][groupedNotifications[a].length - 1];
    const lastMsgB = groupedNotifications[b][groupedNotifications[b].length - 1];
    return new Date(lastMsgB.Timestamp) - new Date(lastMsgA.Timestamp);
  });

  const fragment = document.createDocumentFragment();
  sortedTaskIds.forEach(taskId => {
    const taskThread = groupedNotifications[taskId];
    if (!taskThread || taskThread.length === 0) return;

    // [v238.0 核心重構] 區分原始任務與後續回覆，解決多收件人任務被誤判為回覆的問題。
    const initialTasks = taskThread.filter(msg => msg.SenderID !== 'SYSTEM');
    const replies = taskThread.filter(msg => msg.SenderID === 'SYSTEM');

    // 如果沒有找到任何原始任務，則跳過此串流，避免出錯。
    if (initialTasks.length === 0) return;

    const firstMessage = initialTasks[0]; // 以第一筆原始任務作為代表
    // [v284.0 修正] 找出屬於當前使用者的那則通知，以判斷其個人狀態
    const userSpecificMessage = taskThread.find(msg => msg.RecipientID === currentUserId) || taskThread.find(msg => msg.SenderID === 'SYSTEM');
    const lastMessage = userSpecificMessage || taskThread[taskThread.length - 1];

    // [v238.0 核心修正] 從所有原始任務中提取收件人姓名，並去除重複。
    const recipients = [...new Set(initialTasks.map(msg => msg.RecipientName || msg.RecipientID))].join(', ');
    const deadline = firstMessage.ActionDeadline ? new Date(firstMessage.ActionDeadline).toLocaleString('sv').slice(0, 16) : null;
    const isOverdue = deadline && new Date() > new Date(firstMessage.ActionDeadline);
    const hasUnread = taskThread.some(msg => msg.Status === 'Unread');

    const card = document.createElement('div');
    card.className = 'card communication-thread';
    card.id = `thread-${taskId}`; // 為卡片加上 ID

    // [v223.0 新增] 根據狀態決定卡片樣式
    if (isOverdue) {
      card.classList.add('overdue');
    } else if (hasUnread) {
      card.classList.add('unread');
    }

    // [v232.0 修正] 根據使用者建議，將狀態文字中文化
    const statusTextMap = {
      'Unread': '未讀',
      'Overdue': '已逾時',
      'Read': '已讀',
      'Completed': '已完成',
      'Archived': '已封存'
    };

    // [v231.0 修正] 根據使用者建議，為狀態標籤定義更清晰的樣式
    const statusTagClasses = {
      'Unread': 'bg-blue-100 text-blue-800',
      'Overdue': 'bg-red-100 text-red-800 font-bold',
      'Read': 'bg-gray-100 text-gray-800',
      'Completed': 'bg-green-100 text-green-800',
      'Archived': 'bg-gray-100 text-gray-500'
    };
    const tagClass = statusTagClasses[lastMessage.Status] || 'bg-gray-100 text-gray-800';

    // [v223.0 重構] 建立更豐富的標頭
    // [v232.0 重構] 根據使用者理想的版面重新設計
    let threadHtml = `
      <div class="thread-header">
        <!-- [v235.0] 根據使用者建議，將標題與時間放在同一行 -->
        <div class="thread-title-bar">
          <h4>${firstMessage.Title || '系統訊息'}</h4>
          <!-- [v237.0 核心修正] 根據使用者建議，顯示完整的日期與時間 -->
          <span class="text-xs text-gray-500 flex-shrink-0">${new Date(firstMessage.Timestamp).toLocaleString('sv').slice(0, 16)}</span>
        </div>
      </div>
      <!-- [v234.0 重構] 根據使用者建議，將任務細節整合為單行，聚焦收件人，並移除發起人欄位 -->
      <div class="task-meta-bar">
        <span class="meta-item">發起人: <strong>${firstMessage.SenderName}</strong></span>
        <span class="meta-item">收件人: <strong>${recipients || '未指定'}</strong></span>
        <span>要求: <strong>${firstMessage.ActionType || '無'}</strong></span>
        ${deadline ? `<span class="deadline ${isOverdue ? 'is-overdue' : ''}">時限: <strong>${deadline}</strong></span>` : ''}
      </div>
      <div class="task-content">
        <p>${firstMessage.Content}</p>
      </div>
      <!-- [v284.0 新增] 互動區塊 -->
      <div class="thread-actions" data-notification-id="${lastMessage.NotificationID}" data-action-type="${firstMessage.ActionType}">
          ${(() => {
            // [v309.0 核心修正] 根據使用者回饋，重構按鈕顯示邏輯，使其更合理。
            if (lastMessage.RecipientID !== currentUserId || ['Completed', 'Archived'].includes(lastMessage.Status)) {
              return ''; // 如果不是收件人，或任務已完成/封存，則不顯示任何按鈕。
            }
            let buttonsHtml = '';
            if (firstMessage.ActionType === 'ReplyText') {
              buttonsHtml += `<div class="action-reply-wrapper"><input type="text" class="action-input" placeholder="輸入回覆內容..."><button class="action-btn-sm action-btn-primary" data-action="reply">回覆</button></div>`;
            }
            if (firstMessage.ActionType === 'ConfirmCompletion') {
              buttonsHtml += `<button class="action-btn-sm action-btn-green" data-action="complete">我已完成</button>`;
            }
            // 只有當任務是純資訊型(None)，且狀態不是已讀時，才顯示「標示已讀」按鈕。
            if (firstMessage.ActionType === 'None' && lastMessage.Status !== 'Read') {
              buttonsHtml += `<button class="action-btn-sm action-btn-secondary" data-action="mark_read">標示已讀</button>`;
            }
            return buttonsHtml;
          })()}
      </div>
      <div class="replies-container">
    `;

    // [v238.0 核心修正] 只遍歷被歸類為「回覆」的訊息。
    replies.forEach(msg => {
      const time = new Date(msg.Timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      const date = new Date(msg.Timestamp).toLocaleDateString('sv');
      const statusDisplay = statusTextMap[msg.Status] || msg.Status;

      threadHtml += `
        <div class="reply-card">
          <div class="reply-header">
            <!-- [v238.0 核心修正] 回覆訊息的發送者是操作者，而非收件人 -->
            <span class="font-semibold">${msg.SenderName}</span>
            <span class="text-xs text-gray-500" title="${date}">${time}</span>
          </div>
          <div class="reply-body">
            <p>${msg.Content}</p>
          </div>
          <div class="reply-footer">
            <span class="status-tag ${statusTagClasses[msg.Status] || 'bg-gray-100'}">${statusDisplay}</span>
          </div>
                        </div>
      `;
    });

    threadHtml += '</div>'; // 關閉 replies-container
    card.innerHTML = threadHtml;
    fragment.appendChild(card);
  });

  container.innerHTML = ''; // 清空舊內容
  container.appendChild(fragment);
}

/**
 * [v284.0 新增] 為溝通紀錄卡片加上專屬的互動樣式
 */
function addCommunicationCardStyles() {
    const styleId = 'communication-card-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .action-reply-wrapper { display: flex; gap: 0.5rem; align-items: center; }
        .action-input { flex-grow: 1; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.3rem 0.6rem; font-size: 0.875rem; }
        .action-btn-sm { padding: 0.3rem 0.8rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600; transition: background-color 0.2s; cursor: pointer; border: none; }
        .action-btn-primary { background-color: #3b82f6; color: white; } .action-btn-primary:hover { background-color: #2563eb; }
        .action-btn-green { background-color: #16a34a; color: white; } .action-btn-green:hover { background-color: #15803d; }
        .action-btn-secondary { background-color: #e5e7eb; color: #374151; } .action-btn-secondary:hover { background-color: #d1d5db; }
    `;
    document.head.appendChild(style);
}
addCommunicationCardStyles();