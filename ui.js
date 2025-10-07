/*
* =============================================================================
* 檔案名稱: ui.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 專門負責將資料渲染成 HTML 畫面。
* =============================================================================
*/

import { state } from './state.js';
import { thumbLog, driveFileId } from './utils.js';

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
    const statusContainer = document.getElementById('main-content');
    if (statusContainer) {
        statusContainer.innerHTML =
            `<div id="status-message" style="border:1px solid red;background:#ffebee;color:#c62828;padding:1rem;white-space:pre-wrap;margin:1rem;">
            <strong>載入失敗！</strong>\n\n
            <strong>錯誤訊息：</strong>\n${msg}\n\n
            <strong>建議：</strong>請檢查 Apps Script 後端日誌與路由設定（project）。
            </div>`;
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
    // [核心修正] 補上遺漏的點擊事件，使其能夠觸發圖片燈箱
    img.addEventListener('click', (e) => {
        const grid = e.target.closest('.photo-grid');
        const allImages = Array.from(grid.querySelectorAll('img.photo-thumb'));
        const urls = allImages.map(i => i.dataset.full);
        const currentIndex = allImages.indexOf(e.target);
        if (window.__openLightbox__) window.__openLightbox__(urls, currentIndex);
    });
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

    img.onload = () => thumbLog('IMG OK ' + img.src);
    img.onerror = () => {
        const ph = document.createElement('div'); ph.className = 'photo-placeholder';
        ph.textContent = '無法載入縮圖（點此開啟原圖）'; ph.style.cursor = 'pointer';
        ph.onclick = () => window.open(src, '_blank', 'noopener,noreferrer');
        wrap.replaceChildren(ph); thumbLog('IMG ERROR ' + img.src);
    };
    // [核心修正] 修正語法錯誤，將 __openLightbox__ 改為 window.__openLightbox__
    img.addEventListener('click', (e) => {
        const grid = e.target.closest('.photo-grid');
        const allImages = Array.from(grid.querySelectorAll('img.photo-thumb'));
        const urls = allImages.map(i => i.dataset.full);
        const currentIndex = allImages.indexOf(e.target);
        if (window.__openLightbox__) window.__openLightbox__(urls, currentIndex);
    });
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

    const links = Array.isArray(htmlLinksCsv) ? htmlLinksCsv : String(htmlLinksCsv).split(',');

    links.forEach(link => {
        const u = (link || '').trim(); if (!u) return;
        if (u.startsWith('data:image/')) {
            container.appendChild(renderDirectImg(u));
        } else if (u.charAt(0) === '/') {
            const ph = document.createElement('div'); ph.className = 'photo-placeholder'; ph.textContent = 'Dropbox 內部路徑（僅佔位）'; container.appendChild(ph);
        } else {
            const id = driveFileId(u);
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
    const displayContent = (log.Content || '無內容').replace(/^\[更新 .*?\]\n/, '');

    const headerDiv = document.createElement('div');
    headerDiv.className = 'log-card-header';
    headerDiv.innerHTML = `
      <h3>${log.Title || '無標題'} <span class="muted">by ${log.UserName || '未知'}</span></h3>
      <small class="muted">${timestamp}</small>
    `;

    const contentDiv = document.createElement('div'); contentDiv.id = 'content-' + log.LogID;
    contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.textContent = displayContent;
    contentDiv.style.marginTop = '0.75rem';

    const photoContainer = document.createElement('div');
    const buttonContainer = document.createElement('div'); buttonContainer.className = 'button-group'; buttonContainer.style.marginTop = '1rem';

    card.appendChild(headerDiv);
    card.appendChild(contentDiv);
    card.appendChild(photoContainer);
    card.appendChild(buttonContainer);

    if (log.PhotoLinks) { photoContainer.appendChild(buildPhotoGrid(log.PhotoLinks)); }

    const btnManagePhotos = document.createElement('button'); btnManagePhotos.textContent = '管理相片'; btnManagePhotos.style.background = '#f59e0b';
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

    // [核心修正] 新增刪除按鈕
    const btnDelete = document.createElement('button');
    btnDelete.className = 'delete-log-btn'; // 使用 class 以便設定樣式
    btnDelete.innerHTML = '&#128465;'; // 垃圾桶圖示
    btnDelete.title = '刪除此日誌';
    btnDelete.dataset.action = 'deleteLog';
    btnDelete.dataset.logId = log.LogID;
    card.appendChild(btnDelete);

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
        <label for="post-title-select" class="form-label">標題 (可選)</label>
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
    const panel = document.getElementById('project-info-panel');
    if (!panel) return;
    if (!overview) { panel.innerHTML = '<p class="muted">無專案資訊</p>'; return; }

    const get = (key) => overview[key] || '未提供';
    panel.innerHTML = `
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
          <li style="white-space: pre-wrap;"><strong>特別注意事項:</strong><br>${get('備註-特別注意事項')}</li>
        </ul>
      </div>
    `;

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