import { loadJsonp } from './api.js';
/*
* =============================================================================
* 檔案名稱: main.js
* 專案名稱: 專案日誌管理主控台
* 版本: v13.0 (穩定版)
* 修改時間: 2025-09-27 10:54 (Asia/Taipei)
*
* 核心功能:
* 1.  **資料處理與API串接**:
* - 透過 JSONP 從 Google Apps Script 後端獲取專案總覽、排程、日誌與範本資料。
* - 處理後端回傳的資料，並將其存入前端狀態變數。
* - 負責將前端的修改（如文字編輯、照片管理、排程變更）傳送回後端儲存。
*
* 2.  **UI渲染與互動**:
* - **排程管理**: 顯示多色進度條、可編輯的任務卡片列表、並可從範本新增任務。
* - **日誌顯示**: 將日誌資料渲染成卡片列表，包含照片牆。
* - **互動功能**: 提供文字即時編輯、照片管理模組 (Modal)、圖片燈箱 (Lightbox) 等功能。
*
* 3.  **效能優化**:
* - **骨架屏 (Skeleton Screen)**: 在等待API資料時，顯示頁面輪廓以改善使用者體驗。
* - **圖片懶加載 (Lazy Loading)**: 日誌中的圖片會等到滾動至可視範圍才載入。
* - **日誌分頁 (Pagination)**: 日誌列表採用前端分頁，滾動到底部時自動載入下一批，避免一次性渲染大量DOM。
* =============================================================================
*/
import { logToPage } from './utils.js';
import { displaySkeletonLoader, displayError, renderLogPage, displayProjectInfo, createOrUpdateTradeDatalist, renderPostCreator, _buildLogCard } from './ui.js';
import * as Handlers from './handlers.js';
import * as ScheduleActions from './scheduleActions.js';
import * as LogActions from './logActions.js'; // [重構] 引入新的 logActions 模組
import { state } from './state.js';

/*
* 版本: v13.0 (穩定版)
* 修改時間: 2025-09-27 10:59 (Asia/Taipei)
* 說明: 為 handleDataResponse 函式加上專業的 DocBlock 註解。
*/

/**
 * @description 處理從後端 API (Google Apps Script) 成功獲取資料後的核心回呼函式 (Callback)。
 * 此函式是整個應用程式的入口點，負責解析後端資料，並依序觸發所有 UI 的渲染與更新。
 *
 * @param {object} data - 從後端 JSONP 傳回的資料物件，其結構應包含：
 * @param {object} [data.overview] - 專案總覽資訊，如案場名稱、起訖日期。
 * @param {Array<object>} [data.schedule] - 專案排程的任務列表。
 * @param {Array<object>} [data.dailyLogs] - 專案的每日日誌列表。
 * @param {Array<object>} [data.templates] - 可用於新增任務的範本列表。
 *
 * @returns {void} 此函式無回傳值。其主要作用是產生副作用 (Side Effect)，即更新頁面上的 DOM 元素。
 *
 * @functionality
 * 1.  將後端資料存入前端的全域變數 (currentLogsData, currentScheduleData, templateTasks)。
 * 2.  檢查專案排程是否為空，若是，則顯示「套用範本」按鈕。
 * 3.  對排程資料進行排序 (依狀態 > 依日期)。
 * 4.  呼叫 `displaySchedule()` 渲染排程區塊。
 * 5.  將任務範本資料填充至「新增任務」下拉選單。
 * 6.  初始化日誌分頁，並呼叫 `renderLogPage()` 僅渲染第一頁的日誌。
 * 7.  若日誌總數多於一頁，則呼叫 `setupScrollListener()` 啟動無限滾動功能。
 * 8.  更新頁面主標題。
 */
function handleDataResponse(data) {
  const logsContainer = document.getElementById('logs-container');
  // 檢查是否已存在發文區，避免重複加入
  if (logsContainer && !logsContainer.querySelector('.post-creator')) {
    // [整理] 呼叫 ui.js 中的函式來取得 HTML，讓此處程式碼更簡潔
    logsContainer.insertAdjacentHTML('afterbegin', renderPostCreator());

    // 【⭐️ 核心修正：為發文框綁定事件 ⭐️】
    const addPhotoBtn = document.getElementById('add-photo-to-post-btn');
    const submitPostBtn = document.getElementById('submit-post-btn');
    const photoInput = document.getElementById('new-log-photos-input');

    if (addPhotoBtn) {
      addPhotoBtn.addEventListener('click', () => photoInput?.click());
    }
    if (submitPostBtn) {
      submitPostBtn.addEventListener('click', Handlers.handleCreateNewPost);
    }
    if (photoInput) {
      photoInput.onchange = (e) => {
        const files = e.target.files;
        const previewContainer = document.getElementById('new-log-photo-preview');
        if (!previewContainer) return;

        for (const file of files) {
          if (!file.type.startsWith('image/')) continue;
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64String = event.target.result;
            const previewItem = document.createElement('div');
            previewItem.className = 'photo-preview-item';
            previewItem.dataset.name = file.name; // [優化] 儲存檔名
            previewItem.dataset.type = file.type; // [優化] 儲存檔案類型
            previewItem.dataset.base64 = base64String;
            previewItem.style.backgroundImage = `url(${base64String})`;
            previewItem.innerHTML = `<button class="remove-preview-btn" title="移除此照片">&times;</button>`;
            previewItem.querySelector('.remove-preview-btn').onclick = () => previewItem.remove();
            previewContainer.appendChild(previewItem);
          };
          reader.readAsDataURL(file);
        }
        e.target.value = ''; // 清空 input，以便可以再次選擇同一個檔案
      };
    }
  }

  logToPage('✅ 後端回應成功');
  // 清除任何可能存在的舊錯誤訊息
  document.getElementById('status-message')?.remove();
  if(data && data.error){ displayError({message:data.error}); return; }

  // [核心修正] 將從後端接收到的資料，存入統一的 state 物件
  state.currentLogsData = data.dailyLogs || [];
  state.currentScheduleData = data.schedule || [];
  state.templateTasks = data.templates || [];

  // 處理標題下拉選單
  const titleSelect = document.getElementById('post-title-select');
  if (titleSelect) {
    // [核心修正] 將選項精簡為幾個核心工程項目
    titleSelect.innerHTML = '<option value="">-- 自動產生標題 --</option>';
    const coreTrades = ['保護工程', '拆除工程', '水電工程', '泥作工程', '木作工程', '油漆工程', '系統櫃', '清潔工程', '其他事項'];
    coreTrades.forEach(trade => {
      titleSelect.innerHTML += `<option value="${trade}">${trade}</option>`;
    });
  }

  // 業務邏輯：如果這是一個沒有任何排程的既有專案，則顯示「套用範本」的按鈕
  if (state.currentScheduleData.length === 0 && state.projectId !== '0') { // [核心修正] 改為從 state.projectId 讀取
    const actionsContainer = document.getElementById('actions-container');
    if (actionsContainer) {
        actionsContainer.style.display = 'flex';
        document.getElementById('btn-import-new').addEventListener('click', () => ScheduleActions.showStartDatePicker('新屋案'));
        document.getElementById('btn-import-old').addEventListener('click', () => ScheduleActions.showStartDatePicker('老屋案'));
    }
  }
    // 業務邏輯：對排程資料進行排序，規則為：1. 依狀態 (已完成 > 施工中 > 未完成) 2. 依預計開始日期
  // 【⭐️ 核心修正：補上遺失的括號，並整理後續呼叫流程 ⭐️】
  if (Array.isArray(state.currentScheduleData)) {
    state.currentScheduleData.sort((a, b) => {
        const statusOrder = { '已完成': 1, '施工中': 2, '未完成': 3 };
        const statusA = statusOrder[a['狀態']] || 99;
        const statusB = statusOrder[b['狀態']] || 99;
        if (statusA !== statusB) {
            return statusA - statusB;
        }
        const dateA = new Date(a['預計開始日']);
        const dateB = new Date(b['預計開始日']);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateA - dateB;
    });
  }

  // 渲染UI：使用後端提供的案場名稱，更新頁面的主標題
  const titleEl = document.getElementById('project-title');
  if(data.overview && (data.overview.siteName || data.overview['案場名稱'])){
      titleEl.textContent = '主控台: ' + (data.overview.siteName || data.overview['案場名稱']);
  }

  // [新增] 呼叫新函式來渲染右側的專案資訊面板
  displayProjectInfo(data.overview, state.currentScheduleData);

  // [重構] 渲染UI：呼叫 scheduleActions.js 中的函式，將排序好的排程資料渲染成畫面
  ScheduleActions.renderSchedulePage(data.overview, state.currentScheduleData);

  // [重構] 渲染UI：初始化日誌分頁，並渲染第一頁
  state.currentPage = 1;
  renderLogPage();

  // [重構] 如果日誌超過一頁，則設定無限滾動監聽器
  if (state.currentLogsData.length > state.LOGS_PER_PAGE) {
    setupScrollListener();
  }

  // [核心修正] 在每次資料渲染完成後，都手動觸發一次圖片懶加載。
  // 這解決了從快取渲染時，圖片不會被載入的問題。
  lazyLoadImages();
}

// [核心修正] 將 lazyLoadImages 掛載到 window 物件上，使其成為一個全域可用的函式
// 這樣其他模組就可以透過 window.lazyLoadImages() 來呼叫它，從而打破模組間的循環依賴。
window.lazyLoadImages = lazyLoadImages;
export let lazyImageObserver;

function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');

  if ("IntersectionObserver" in window) {
    // 如果已有觀察者，先中斷舊的
    if (lazyImageObserver) {
      lazyImageObserver.disconnect();
    }

    lazyImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const lazyImage = entry.target;
          lazyImage.src = lazyImage.dataset.src;
          lazyImage.classList.remove("lazy");
          observer.unobserve(lazyImage);
        }
      });
    });

    lazyImages.forEach((lazyImage) => {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    // Fallback for older browsers
    lazyImages.forEach((lazyImage) => {
        lazyImage.src = lazyImage.dataset.src;
        lazyImage.classList.remove("lazy");
    });
  }
}

/**
 * [V2.0 升級] 初始化功能更完整的圖片燈箱 (Lightbox)
 * - 支援鍵盤左右鍵、滑鼠點擊按鈕切換圖片。
 * - 支援 Esc 鍵關閉。
 * - 將開啟函式掛載到 window 物件，供其他模組呼叫。
 */
function initializeLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector('.lb-img');
  const closeBtn = lightbox.querySelector('.lb-close');
  const prevBtn = document.createElement('button');
  prevBtn.className = 'lb-prev'; prevBtn.ariaLabel = '上一張'; prevBtn.innerHTML = '&#10094;';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'lb-next'; nextBtn.ariaLabel = '下一張'; nextBtn.innerHTML = '&#10095;';
  lightbox.querySelector('.lb-wrap').append(prevBtn, nextBtn);

  let currentImages = [];
  let currentIndex = 0;

  function showImage(index) {
    // [優化] 增加保護，避免在沒有圖片時出錯
    if (!currentImages || currentImages.length === 0) return;
    currentIndex = index;
    lightboxImg.src = currentImages[currentIndex];

    // [核心修正] 如果圖片超過一張，則永遠顯示左右按鈕，以支援循環瀏覽
    const showNav = currentImages.length > 1;
    prevBtn.style.display = showNav ? 'block' : 'none';
    nextBtn.style.display = showNav ? 'block' : 'none';
  }

  function openLightbox(urls, index) {
    currentImages = urls;
    showImage(index);
    lightbox.classList.add('open');
    lightbox.ariaHidden = 'false';
    document.addEventListener('keydown', handleKeydown);
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.ariaHidden = 'true';
    lightboxImg.src = ''; // 清空圖片，避免殘影
    currentImages = [];
    document.removeEventListener('keydown', handleKeydown);
  }

  function showPrev() {
    // [核心修正] 增加循環邏輯，當在第一張時，跳到最後一張
    const newIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
    showImage(newIndex);
  }

  function showNext() {
    // [核心修正] 增加循環邏輯，當在最後一張時，跳到第一張
    const newIndex = (currentIndex + 1) % currentImages.length;
    showImage(newIndex);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
  }

  // 綁定事件
  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);
  // 點擊燈箱背景也能關閉
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // 將開啟函式掛載到全域，供 ui.js 呼叫
  window.__openLightbox__ = openLightbox;
}

function setupScrollListener() {
    state.scrollObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !state.isLoadingNextPage) {
            state.currentPage++;
            logToPage(`滾動到底部，載入第 ${state.currentPage} 頁...`);
            renderLogPage();
            lazyLoadImages(); // [核心修正] 在載入下一頁後，再次觸發懶加載
        }
    }, { threshold: 0.1 });

    const initialLoader = document.getElementById('log-loader');
    if (initialLoader) {
        state.scrollObserver.observe(initialLoader);
    }
}

/* ===== 入口 ===== */
/**
 * [V14.0 認證優先版] 應用程式主入口函式
 * - 流程重構為「先認證，後載入」，確保只有通過 LINE LIFF 登入的使用者才能看到頁面內容。
 * - 移除了在認證前顯示快取資料的邏輯，改為在認證成功後才顯示載入動畫並請求資料。
 */
async function initializeApp() {
  // [核心修正] 為每一次頁面載入產生一個唯一的識別碼，用以解決競態條件
  const pageLoadId = `load_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.currentPageLoadId = pageLoadId;

  logToPage('應用程式啟動 (快取優先模式)...');

  // 【⭐️ 核心修改：加入啟動時的通知測試 ⭐️】
  // 根據您的要求，在應用程式啟動時立即顯示一條測試通知，以確認其功能正常。
  showGlobalNotification('這是一條測試通知，用於確認顯示功能是否正常。', 10000, 'info');

  const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

  // 步驟 1：從 URL 讀取 projectId 和 userId
  const urlParams = new URLSearchParams(window.location.search);
  let projectId = urlParams.get('id');
  let userId = urlParams.get('uid');

  // 【⭐️ 核心修正：處理 LIFF 重新導向的 liff.state 參數 ⭐️】
  // LIFF 會將原始參數包在 liff.state 中，我們需要手動解析它。
  if (urlParams.has('liff.state')) {
    const liffState = decodeURIComponent(urlParams.get('liff.state')).replace(/^\?/, ''); // 【⭐️ 核心修正 ⭐️】先解碼 liff.state 的值，再移除開頭可能存在的 '?'
    const liffParams = new URLSearchParams(liffState);
    if (liffParams.has('id')) projectId = liffParams.get('id');
    if (liffParams.has('uid')) userId = liffParams.get('uid');
  }

  // [核心修正] 將解析後的 projectId 存入全域 state
  state.projectId = projectId;
  state.currentUserId = userId; // 【⭐️ 核心修正：將 userId 也存入全域 state ⭐️】

  // 【⭐️ 核心修正：補上遺失的括號，並整理邏輯 ⭐️】
  if (isLocalTest) {
    if (!projectId) projectId = '999';
    if (!userId) userId = 'Ud58333430513b7527106fa71d2e30151';
    logToPage(`⚡️ 本地測試模式啟用，使用預設 ID: ${projectId}`);
  }

  if (!projectId || !userId) {
    const errorMsg = '網址中缺少必要的專案 ID (id) 或使用者 ID (uid)。';
    displayError({ message: errorMsg });
    return;
  }
  logToPage(`目標專案 ID: ${projectId}`);
  logToPage(`操作者 UID: ${userId}`);

  // 【⭐️ 核心修改：快取邏輯 ⭐️】
  // 【⭐️ 核心修正：恢復 UID 至快取 KEY 中 ⭐️】
  const CACHE_KEY = `project_data_${projectId}_${userId}`;
  const CACHE_DURATION_MS = 15 * 24 * 60 * 60 * 1000; // 15 天
  let hasRenderedFromCache = false;

  // 步驟 2：嘗試從快取中讀取並立即渲染
  try {
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) { // 如果快取存在
        const { timestamp, data } = JSON.parse(cachedItem);
        // [核心修正] 使用 if-else 結構，確保有效和無效的邏輯互斥
        if ((Date.now() - timestamp < CACHE_DURATION_MS) && (data.ownerId === userId)) {
            // --- 情況一：快取有效 ---
            logToPage('⚡️ 偵測到有效快取，立即渲染畫面...');
 
            state.projectId = projectId;
            // 【⭐️ 核心修正：不要修改原始 data 物件，而是將處理結果存入 state ⭐️】
            state.currentUserName = data.userName || `使用者 (${userId.slice(-6)})`; // 優先使用快取中的名稱

            // 【⭐️ 核心修正：建立一個 data 的深層複本來進行操作，保持原始 data 的純淨性 ⭐️】
            const dataForRender = JSON.parse(JSON.stringify(data));

            // 使用複本來更新案號，這樣就不會污染原始的 data 物件
            if (dataForRender.schedule && Array.isArray(dataForRender.schedule)) {
                dataForRender.schedule.forEach(task => task['案號'] = projectId);
                logToPage('🔄 已使用最新案號更新快取排程資料...');
            }
            handleDataResponse(dataForRender); // 使用處理過的複本來渲染畫面
            hasRenderedFromCache = true;
        } else {
            // --- 情況二：快取無效 (過期或使用者不符) ---
            const reason = data.ownerId !== userId ? 'UID 不符' : '已過期';
            logToPage(`🗑️ 快取無效 (${reason})，將繼續向後端請求新資料。`);
            localStorage.removeItem(CACHE_KEY);
        }
    }
  } catch (e) {
    logToPage(`❌ 讀取快取失敗: ${e.message}`, 'error');
    localStorage.removeItem(CACHE_KEY);
  }

  // [核心修正] 如果沒有從快取渲染，才顯示骨架屏
  if (!hasRenderedFromCache) {
    displaySkeletonLoader(); // 顯示載入動畫
  }

  try {
    const fetchUrl = `${API_BASE_URL}?page=project&id=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
    logToPage('🔄 正在從後端請求專案資料...');
    const freshData = await loadJsonp(fetchUrl);

    // [核心修正] 檢查此回呼是否屬於當前的頁面載入，若不屬於則直接中止
    if (window.currentPageLoadId !== pageLoadId) {
      logToPage(`🟡 偵測到過時的背景請求，已將其忽略。`);
      return;
    }

    // 【⭐️ 核心修正：使用後端傳來的使用者名稱 ⭐️】
    state.currentUserName = freshData.userName || `使用者 (${userId.slice(-6)})`;
    logToPage(`✅ 操作者已設定: ${state.currentUserName}`);

    // 由前端為新資料蓋上所有權戳章
    freshData.ownerId = userId;

    if (!hasRenderedFromCache) {
      // 情況一：沒有快取，這是第一次載入。直接渲染畫面並設定快取。
      logToPage('✅ 首次載入資料，正在渲染畫面並建立快取...');
      handleDataResponse(freshData);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: freshData }));
    } else {
      // 情況二：畫面已由快取渲染，在背景比對新舊資料。
      const cachedItem = localStorage.getItem(CACHE_KEY);
      if (cachedItem) {
        const { data: oldData } = JSON.parse(cachedItem);
        // 為了避免因時間戳或 ownerId 不同而誤判，只比較核心資料
        const oldDataSignature = JSON.stringify({ overview: oldData.overview, schedule: oldData.schedule, dailyLogs: oldData.dailyLogs });
        const newDataSignature = JSON.stringify({ overview: freshData.overview, schedule: freshData.schedule, dailyLogs: freshData.dailyLogs });
        
        // [核心修正] 只有在資料確定有變動時，才執行畫面更新與快取寫入
        if (oldDataSignature !== newDataSignature) {
          logToPage('🔄 偵測到後端資料已更新，正在無縫刷新畫面...');
          
          // 【⭐️ 核心修正：保留樂觀更新的卡片 ⭐️】
          // 在重新渲染前，先找出所有「處理中」的卡片並暫存起來。
          const optimisticCards = Array.from(document.querySelectorAll('.card[id^="temp-"]'));
          
          handleDataResponse(freshData); // 使用新資料重新渲染畫面
          
          // 如果有暫存的卡片，將它們重新插入到列表頂部。
          const logsContainer = document.getElementById('logs-container');
          optimisticCards.reverse().forEach(card => logsContainer.insertBefore(card, logsContainer.children[1]));

          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: freshData })); // 更新快取
        }
      }
    }

  } catch (err) {
    logToPage(`❌ 應用程式初始化失敗: ${err.message}`, 'error');
    displayError(err);
  }
}

/* ===== 程式進入點 ===== */
window.addEventListener('load', () => {
  // 1. 立即設定好 UI 的初始狀態
  document.getElementById('schedule-container').style.display = 'none';
  document.getElementById('logs-container').style.display = 'block';
  const fab = document.getElementById('fab-add-task-btn');
  if (fab) fab.style.display = 'none'; // 手機版懸浮按鈕預設隱藏

  document.getElementById('version-display').textContent = '版本：' + (typeof FRONTEND_VERSION !== 'undefined' ? FRONTEND_VERSION : '未知');
  logToPage('頁面載入完成，準備啟動應用程式...');

  // [新增] 呼叫函式來初始化燈箱功能
  initializeLightbox();

  // [重構] 呼叫函式來初始化日誌動作模組
  LogActions.initializeLogActions();

  // 2. 呼叫主應用程式初始化函式
  initializeApp();
});


/**
 * [新增] 統一的事件代理監聽器
 * 透過事件冒泡，在 document 層級處理所有帶有 data-action 的點擊事件。
 */
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const logId = target.dataset.logId;

    switch (action) {
        case 'deleteTask':
            if (confirm(`確定要刪除任務「${target.dataset.taskName}」嗎？`)) {
                const card = target.closest('.task-card');
                card.style.display = 'none';
                state.currentScheduleData[target.dataset.taskIndex] = null;
                ScheduleActions.enableSaveButton();
            }
            break;
        case 'openPhotoModal':
            LogActions.openPhotoModal(logId, target.dataset.photoLinks);
            break;
        case 'handleEditText':
            LogActions.handleEditText(logId);
            break;
        case 'handlePublish':
            LogActions.handlePublish(logId);
            break;
        case 'handleSaveSchedule':
            ScheduleActions.handleSaveSchedule();
            break;
        case 'handleAddTask':
            ScheduleActions.handleAddTask();
            break;
        case 'enableSaveButton':
            ScheduleActions.enableSaveButton();
            break;
        case 'filterLogsByWorkType':
            LogActions.filterLogsByWorkType(target.value);
            break;
    }
});

/* ===== 新增：三欄式佈局互動 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-button');
  const mobileNavToggle = document.getElementById('mobile-nav-toggle');
  const leftSidebar = document.querySelector('.left-sidebar');
  const scheduleContainer = document.getElementById('schedule-container');
  const logsContainer = document.getElementById('logs-container');
  const wallContainer = document.getElementById('wall-container'); // [新增] 取得專案牆容器
  const mainContent = document.getElementById('main-content');

  // 漢堡選單開關
  if (mobileNavToggle && leftSidebar) {
    mobileNavToggle.addEventListener('click', () => {
      leftSidebar.classList.toggle('open');
    });
  }

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有按鈕的 active class
      navButtons.forEach(btn => btn.classList.remove('active'));
      // 為當前點擊的按鈕加上 active class
      button.classList.add('active');

      const view = button.dataset.view;

      // 根據 data-view 屬性顯示或隱藏對應的區塊
      scheduleContainer.style.display = (view === 'schedule') ? 'block' : 'none';
      logsContainer.style.display = (view === 'logs') ? 'block' : 'none';

      // [新增] 根據當前視圖，顯示或隱藏手機版的懸浮新增按鈕
      const fab = document.getElementById('fab-add-task-btn');
      if (fab) fab.style.display = (view === 'schedule') ? 'flex' : 'none';
      // [新增] 當切換到工程排程時，觸發滾動
      if (view === 'schedule') {
        setTimeout(() => {
          // [修改] 尋找第一個「未完成」或「施工中」的任務索引
          const focusTaskIndex = state.currentScheduleData.findIndex(task => task['狀態'] !== '已完成');

          const focusCard = document.getElementById(`task-card-${focusTaskIndex}`);
          if (focusCard) {
              focusCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              logToPage(`✅ 已自動滾動至任務 #${focusTaskIndex + 1}`);
          }
        }, 50); // 使用短延遲確保區塊顯示後再滾動
      }
      // [核心修正] 當切換回日誌視圖時，將主內容區的捲動條歸零
      // 解決從排程切換回來時，日誌頁面不在頂部的問題
      const mainContent = document.getElementById('main-content');
      if (view === 'logs' && mainContent) {
        mainContent.scrollTop = 0;
      }

      // 在手機版上，點擊後自動關閉選單
      if (leftSidebar && leftSidebar.classList.contains('open')) {
        leftSidebar.classList.remove('open');
      }
    });
  });
});

/**
 * [新增] 監聽來自後端 iframe 的 postMessage 事件
 * 這是為了解決 no-cors 限制下，前端無法得知後端處理結果的問題。
 * 所有後端 API 的回饋都會透過此管道送達。
 */
window.addEventListener('message', (event) => {
  // 簡單的來源驗證，確保訊息來自我們的 Apps Script 後端
  // [優化] 在收到任何後端訊息時，顯示一個除錯通知，方便確認通訊是否成功
    // 【⭐️ 除錯新增：在 Console 中印出收到的完整事件物件 ⭐️】
  // 這可以讓我們看到訊息的來源(origin)、資料(data)等所有細節。
  console.log('📬 成功收到來自 iframe 的 postMessage 事件:', event);
  
  // 【⭐️ 除錯新增：單獨印出最重要的資料部分 ⭐️】
  // event.data 就是您後端 result 物件的內容。
  console.log('📦 後端回傳的資料 (event.data):', event.data);
  showGlobalNotification(`📬 收到後端回覆: ${JSON.stringify(event.data)}`, 8000, 'info');
  if (!event.origin.includes('google.com')) {
    return;
  }

  const result = event.data;
  // [核心修正] 增加更嚴格的檢查，並將除錯通知的呼叫移至此處
  if (!result || typeof result !== 'object') { // 暫時放寬 action 檢查，以便觀察所有訊息
    logToPage(`📬 收到一個無效的後端回覆: ${JSON.stringify(result)}`);
    return;
  }

  logToPage(`📬 收到後端回覆: Action=${result.action}, Success=${result.success}`);

  // 根據後端回傳的 action，執行對應的 UI 更新
  switch (result.action) {
    case 'submit_report_chunk':
      if (result.success) {
        // 這個 case 代表施工回報或主控台發文的「非同步請求」已成功提交到後端佇列。
        // 前端的 UI (如清空輸入框、跳出提示) 已在發送 fetch 後立即執行 (樂觀更新)。
        // 此處我們可以在 console 留下記錄，或顯示一個更細微的成功提示。
        // 【⭐️ 核心修改：改用全域通知函式 ⭐️】
        const notificationMessage = '✅ 已成功加入上傳佇列！資料更新約需 10 分鐘後完成。';
        showGlobalNotification(notificationMessage, 600000, 'info'); // 顯示 600,000 毫秒 = 10 分鐘
        logToPage('✅ 後端已確認收到非同步提交請求。');
        
        // 【⭐️ 核心修改：移除在此處建立卡片的邏輯 ⭐️】
        // 卡片建立的動作已移至 handlers.js，在點擊發佈時立即執行。
        // 此處只負責顯示後端已收到請求的通知。
      } else {
        // 如果後端在接收階段就發生錯誤
        logToPage(`❌ 非同步提交失敗: ${result.message}`, 'error');
        alert(`提交失敗：${result.message}`);
      }
      break;

    case 'publish':
      if (result.success && result.logId) {
        // 當「發布」動作成功後，將對應的草稿卡片從畫面上移除
        const card = document.getElementById('log-' + result.logId);
        if (card) { card.style.transition = 'opacity .5s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 500); }
      }
      break;
    
    // 【⭐️ 核心修改：用通知列取代 alert ⭐️】
    case 'createFromTemplate':
      if (result.success) {
        // 當從範本建立排程成功後，顯示成功訊息，並在短暫延遲後重新載入頁面
        showGlobalNotification(result.message || '範本已成功匯入！頁面即將重新載入...', 5000, 'success');
        setTimeout(() => window.location.reload(), 2000); // 延遲 2 秒後重載
      } else {
        showGlobalNotification(`匯入範本失敗：${result.message || '未知錯誤'}`, 8000, 'error');
      }
      break;

    case 'updateSchedule':
      if (result.success) {
        // 當排程儲存成功後，顯示一個簡短的成功提示
        showGlobalNotification(result.message || '排程已成功儲存！', 5000, 'success');
      } else {
        showGlobalNotification(`排程儲存失敗：${result.message || '未知錯誤'}`, 8000, 'error');
      }
      break;
    // [核心修正] 新增 default 區塊，處理未知的 action
    default:
      const errorMessage = `收到未知的後端動作: "${result.action}"`;
      logToPage(`❌ ${errorMessage}`);
      showGlobalNotification(errorMessage, 10000, 'error');
      break;
  }
}, false);

/**
 * [重構] 在主標題下方顯示一個全域的、暫時的通知橫幅。
 * @param {string} message - 要顯示的訊息文字。
 * @param {number} duration - 訊息顯示的持續時間（毫秒）。
 * @param {'info'|'success'|'error'} type - 訊息類型，決定橫幅顏色。
 */
function showGlobalNotification(message, duration, type = 'info') {
  
  const targetElement = document.getElementById('project-title');
  if (!targetElement) return;

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

  // [核心重構] 移除「刪除舊通知」的邏輯，以允許訊息堆疊

  // 根據類型決定顏色 (邏輯不變)
  const colors = {
    info:    { bg: '#dbeafe', text: '#1e40af' }, // 藍色
    success: { bg: '#dcfce7', text: '#166534' }, // 綠色
    error:   { bg: '#fee2e2', text: '#991b1b' }  // 紅色
  };
  const selectedColor = colors[type] || colors.info;

  // 建立新的通知橫幅元素
  const notificationItem = document.createElement('div');
  // [核心重構] 使用 class 而不是 id，允許多個通知存在
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

  // [核心重構] 將新的通知項目附加到容器的末尾
  notificationContainer.appendChild(notificationItem);

  // 設定計時器，在指定時間後自動移除通知
  setTimeout(() => {
    notificationItem.style.opacity = '0';
    notificationItem.style.transform = 'translateY(-20px)'; // 加上向上移出的動畫效果
    setTimeout(() => notificationItem.remove(), 500); // 等待淡出動畫結束後再移除 DOM
  }, duration);
}
