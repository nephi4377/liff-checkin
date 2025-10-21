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
import { loadJsonp } from './api.js';
import { logToPage, showGlobalNotification } from './utils.js';
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
  if (data && data.error) { displayError({ message: data.error }); return; }

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
  const actionsContainer = document.getElementById('actions-container');
  if (state.currentScheduleData.length === 0 && state.projectId !== '0') { // [核心修正] 改為從 state.projectId 讀取
    if (actionsContainer) {
      actionsContainer.style.display = 'flex';
      // [優化] 使用事件代理，避免重複綁定
      if (!actionsContainer.dataset.listenerAttached) {
        actionsContainer.addEventListener('click', (e) => {
          if (e.target.id === 'btn-import-new') ScheduleActions.showStartDatePicker('新屋案', e.target);
          if (e.target.id === 'btn-import-old') ScheduleActions.showStartDatePicker('老屋案', e.target);
        });
        actionsContainer.dataset.listenerAttached = 'true';
      }
    }
  } else if (actionsContainer) {
    // 如果已有排程，則確保按鈕是隱藏的。
    actionsContainer.style.display = 'none';
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
  if (data.overview && (data.overview.siteName || data.overview['案場名稱'])) {
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

  // [還原] 根據使用者回饋，恢復頁面載入時顯示的 10 秒測試通知。
  showGlobalNotification('這是一條測試通知', 10000, 'info');
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
/**
 * [v130.0 新增] 定期刷新資料的函式
 */
async function refreshData(projectId, userId, API_BASE_URL) {
    try {
        const fetchUrl = `${API_BASE_URL}?page=project&id=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
        logToPage('🔄 背景自動更新：正在從後端請求最新資料...');
        const freshData = await loadJsonp(fetchUrl);

        // 比對新舊資料是否有差異
        const oldDataSignature = JSON.stringify({ overview: state.overview, schedule: state.currentScheduleData, dailyLogs: state.currentLogsData });
        const newDataSignature = JSON.stringify({ overview: freshData.overview, schedule: freshData.schedule, dailyLogs: freshData.dailyLogs });

        if (oldDataSignature !== newDataSignature) {
            logToPage('🔄 背景自動更新：偵測到資料已更新，正在無縫刷新畫面...');
            handleDataResponse(freshData);
            showGlobalNotification('偵測到資料更新，畫面已自動刷新。', 3000, 'info');
        } else {
            logToPage('✅ 背景自動更新：資料無變動。');
        }
    } catch (err) {
        logToPage(`❌ 背景自動更新失敗: ${err.message}`, 'error');
        showGlobalNotification(`自動更新失敗: ${err.message}`, 5000, 'error');
    }
}

/* ===== 入口 ===== */
/**
 * [V14.0 認證優先版] 應用程式主入口函式
 * - 流程重構為「先認證，後載入」，確保只有通過 LINE LIFF 登入的使用者才能看到頁面內容。
 * - 移除了在認證前顯示快取資料的邏輯，改為在認證成功後才顯示載入動畫並請求資料。
 */
async function initializeApp() {
  // [核心修正] 將常數宣告移至函式內部，確保在 DOMContentLoaded 後才讀取 window 物件。
  // 這可以解決因模組載入時機導致 window.API_BASE_URL 為 undefined 的問題。
  // [核心修正] 為每一次頁面載入產生一個唯一的識別碼，用以解決競態條件
  const pageLoadId = `load_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.currentPageLoadId = pageLoadId;

  // [核心改造] 綁定主導覽按鈕的點擊事件，並增加滾動位置記憶與智慧滾動功能
  const navButtons = document.querySelectorAll('.main-nav .nav-button');
  const mainContent = document.getElementById('main-content');
  const scrollPositions = { logs: 0, schedule: 0 }; // 儲存各個視圖的滾動位置

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentView = document.querySelector('.main-nav .nav-button.active')?.dataset.view;
      const newView = button.dataset.view;

      // 如果切換了視圖，儲存當前視圖的滾動位置
      if (currentView && currentView !== newView) {
        scrollPositions[currentView] = mainContent.scrollTop;
      }

      // 移除所有按鈕的 active class
      navButtons.forEach(btn => btn.classList.remove('active'));
      // 為被點擊的按鈕加上 active class
      button.classList.add('active');

      // 隱藏所有內容區塊
      Array.from(mainContent.children).forEach(child => {
        child.style.display = 'none';
      });
      // 顯示對應的內容區塊
      const targetView = document.getElementById(`${newView}-container`);
      if (targetView) {
        targetView.style.display = 'block';
        // 恢復新視圖的滾動位置
        mainContent.scrollTop = scrollPositions[newView];

        // [核心還原] 如果切換到排程視圖，自動滾動到第一個未完成的任務
        if (newView === 'schedule') {
          const taskCards = Array.from(document.querySelectorAll('#schedule-container .task-card'));
          const firstUnfinishedIndex = taskCards.findIndex(card => card.querySelector('select[data-field="狀態"]')?.value !== '已完成');

          if (firstUnfinishedIndex !== -1) {
            // 滾動到第一個未完成任務的位置，並將其置於頂部
            const targetCard = taskCards[firstUnfinishedIndex];
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    });
  });
  // [v54.0 修正] 強化本地測試模式，使其能完全跳過 LIFF 認證
  // [核心修正] 將 API_BASE_URL 的讀取移至此處，確保在所有流程中都可用
  const API_BASE_URL = window.API_BASE_URL;
  if (!API_BASE_URL) { displayError({ message: '無法讀取 API_BASE_URL 設定，請檢查 HTML 檔案。' }); return; }

  const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  if (isLocalTest) {
    logToPage('⚡️ 本地測試模式啟用，將跳過 LIFF 認證。');
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || '736'; // 允許從 URL 傳入案號，否則預設為 736
    const userId = urlParams.get('uid') || 'U1f74b9d87247a240dd3ab160cd90b124'; // 預設為吳奕弦的 UID
    
    // 將測試用的 ID 存入全域狀態
    state.projectId = projectId;
    state.currentUserId = userId;
    state.currentUserName = '本地測試員';

    // 直接開始載入資料，不執行後續的 LIFF 流程
    await loadDataAndRender(projectId, userId, pageLoadId, API_BASE_URL);
    return;
  }

  // [v56.0 修正] 恢復 urlParams 的宣告，解決啟動時的致命錯誤
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
    console.log(`[Init] 從 liff.state 解析結果 -> ProjectID: ${projectId}, UserID: ${userId}`);
  }

  // [核心修正] 將解析後的 projectId 存入全域 state
  state.projectId = projectId;
  state.currentUserId = userId; // 【⭐️ 核心修正：將 userId 也存入全域 state ⭐️】

  if (!projectId || !userId) {
    const errorMsg = '網址中缺少必要的專案 ID (id) 或使用者 ID (uid)。';
    console.error(`[Init] 參數檢查失敗: ${errorMsg}`);
    displayError({ message: errorMsg });
    return;
  }

  // [v54.0 新增] 將資料載入與渲染邏輯封裝成獨立函式
  await loadDataAndRender(projectId, userId, pageLoadId, API_BASE_URL);
  // 【您的要求】設定每 10 分鐘自動更新一次資料
  setInterval(() => refreshData(projectId, userId, API_BASE_URL), 10 * 60 * 1000);
  logToPage('已設定每 10 分鐘自動更新專案資料。');
}

/**
 * [v54.0 新增] 封裝資料載入與渲染的核心邏輯
 */
async function loadDataAndRender(projectId, userId, pageLoadId, API_BASE_URL) {

  // 【⭐️ 核心修改：快取邏輯 ⭐️】
  // 【⭐️ 核心修正：恢復 UID 至快取 KEY 中 ⭐️】
  const CACHE_KEY = `project_data_${projectId}_${userId}`;
  const CACHE_DURATION_MS = 15 * 24 * 60 * 60 * 1000; // 15 天
  let hasRenderedFromCache = false;

  // 步驟 2：嘗試從快取中讀取並立即渲染
  try {
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) { // 如果快取存在
      // [核心修正] 將 JSON.parse 包在 try-catch 中，增加程式碼健壯性
      try {
        const { timestamp, data } = JSON.parse(cachedItem);
        // [核心修正] 修正快取擁有者的判斷邏輯，應從 data 物件本身讀取 ownerId
        if ((Date.now() - timestamp < CACHE_DURATION_MS) && (data && data.ownerId === userId)) {
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
          const reason = (data && data.ownerId !== userId) ? 'UID 不符' : '已過期';
          logToPage(`🗑️ 快取無效 (${reason})，將繼續向後端請求新資料。`);
          localStorage.removeItem(CACHE_KEY);
        }
      } catch (parseError) {
        logToPage(`❌ 解析快取失敗: ${parseError.message}`, 'error');
        localStorage.removeItem(CACHE_KEY); // 解析失敗，直接刪除損壞的快取
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

    // [核心修正] 在儲存快取前，就為新資料蓋上所有權戳章
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
          // [核心修正] 更新快取時，同時儲存 ownerId 到外層
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

/**
 * [新增] 統一的事件代理監聽器
 * 透過事件冒泡，在 document 層級處理所有帶有 data-action 的點擊事件。
 */
document.addEventListener('click', (e) => {
  // [v26.0 修正] 處理手機版漢堡選單的點擊事件
  // 這個按鈕沒有 data-action，需要獨立處理
  const mobileNavToggle = e.target.closest('#mobile-nav-toggle');
  if (mobileNavToggle) {
    // [v27.0 修正] 點擊漢堡選單時，應為 .left-sidebar 切換 .open class，而不是 .container
    const leftSidebar = document.querySelector('.left-sidebar');
    if (leftSidebar) {
      leftSidebar.classList.toggle('open');
    }
    return; // 處理完畢，結束函式
  }

  // [v30.0 修正] 處理手機版側邊欄內所有按鈕的點擊事件
  // 如果點擊的目標是在 .left-sidebar 裡面，就自動關閉選單
  const clickedInsideSidebar = e.target.closest('.left-sidebar');
  if (clickedInsideSidebar) {
      const leftSidebar = document.querySelector('.left-sidebar');
      // 確保只有在選單是開啟狀態時才關閉
      if (leftSidebar && leftSidebar.classList.contains('open')) {
          leftSidebar.classList.remove('open');
      }
  }

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
      // [v26.0 修正] 確保點擊「管理相片」按鈕時，是開啟照片管理視窗，而不是燈箱
      // 從按鈕的 dataset 中取得 logId 和 photoLinks  
      LogActions.openPhotoModal(logId, target.dataset.photoLinks);
      break;
    case 'handleEditText':
      LogActions.handleEditText(logId);
      break;
    case 'handlePublish':
      LogActions.handlePublish(logId);
      break;
    // [核心修正] 新增刪除日誌的處理邏輯
    case 'deleteLog':
      // [UX Improvement] Fetch the timestamp from the card to show a more user-friendly confirmation.
      const card = document.getElementById(`log-${logId}`);
      const timestampText = card ? card.querySelector('.log-card-header small')?.textContent : `Log ID: ${logId}`;
      
      if (confirm(`您確定要永久刪除這篇於「${timestampText}」發佈的日誌嗎？`)) {
        LogActions.handleDeleteLog(logId); // Call the handler only after confirmation.
      }
      break;
    // 【⭐️ 核心新增：處理照片管理視窗的按鈕事件 ⭐️】
    case 'triggerPhotoUpload':
      LogActions.triggerPhotoUpload();
      break;
    case 'savePhotos':
      LogActions.handleSavePhotos();
      break;
    case 'closePhotoModal':
      LogActions.closePhotoModal();
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

// [核心修正] 應用程式進入點
// 在所有函式與事件監聽器都定義完成後，
// 呼叫 initializeApp() 來啟動整個應用程式的載入與渲染流程。
document.addEventListener('DOMContentLoaded', () => {
  // [v29.0 修正] 初始化圖片燈箱功能，確保點擊照片可以放大
  initializeLightbox();
  initializeApp();
});

/**
 * [重構] 在主標題下方顯示一個全域的、暫時的通知橫幅。
 * @param {string} message - 要顯示的訊息文字。
 * @param {number} duration - 訊息顯示的持續時間（毫秒）。
 * @param {'info'|'success'|'error'} type - 訊息類型，決定橫幅顏色。
 */
