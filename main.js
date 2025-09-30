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
import { displaySkeletonLoader, displayError, displaySchedule, renderLogPage, displayProjectInfo, createOrUpdateTradeDatalist, renderPostCreator } from './ui.js';
import * as Handlers from './handlers.js';
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
function handleDataResponse(data){
  const logsContainer = document.getElementById('logs-container');
  // 檢查是否已存在發文區，避免重複加入
  if (logsContainer && !logsContainer.querySelector('.post-creator')) {
    // [整理] 呼叫 ui.js 中的函式來取得 HTML，讓此處程式碼更簡潔
    logsContainer.insertAdjacentHTML('afterbegin', renderPostCreator());
  }

  logToPage('✅ 後端回應成功');
  // 清除任何可能存在的舊錯誤訊息
  document.getElementById('status-message')?.remove();
  if(data && data.error){ displayError({message:data.error}); return; }

  // [核心修正] 將從後端接收到的資料，存入統一的 state 物件
  state.currentLogsData = data.dailyLogs || [];
  state.currentScheduleData = data.schedule || [];
  state.templateTasks = data.templates || [];

  // [核心修正] 將事件綁定移至此處，確保每次資料刷新後都能正確綁定
  const addPhotoBtn = document.getElementById('add-photo-to-post-btn');
  const submitPostBtn = document.getElementById('submit-post-btn');
  const photoInput = document.getElementById('new-log-photos-input');
  const titleSelect = document.getElementById('post-title-select');

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
          previewItem.dataset.base64 = base64String;
          // [核心修正] 改用 div 的背景圖來顯示縮圖，而非直接用 img 標籤
          previewItem.style.backgroundImage = `url(${base64String})`;
          previewItem.innerHTML = `
            <button class="remove-preview-btn" title="移除此照片">&times;</button>
          `;
          previewItem.querySelector('.remove-preview-btn').onclick = () => previewItem.remove();
          previewContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    };
  }
  if (titleSelect && state.templateTasks.length > 0) {
    // [核心修正] 將選項精簡為幾個核心工程項目
    titleSelect.innerHTML = '<option value="">-- 自動產生標題 --</option>';
    const coreTrades = ['保護工程', '拆除工程', '水電工程', '泥作工程', '木作工程', '油漆工程', '系統櫃', '清潔工程', '其他事項'];
    coreTrades.forEach(trade => {
      titleSelect.innerHTML += `<option value="${trade}">${trade}</option>`;
    });
  }

  // 業務邏輯：如果這是一個沒有任何排程的既有專案，則顯示「套用範本」的按鈕
  if (state.currentScheduleData.length === 0 && (new URLSearchParams(location.search).get('id') !== '0')) {
    const actionsContainer = document.getElementById('actions-container');
    if (actionsContainer) {
        actionsContainer.style.display = 'flex';
        document.getElementById('btn-import-new').addEventListener('click', () => Handlers.showStartDatePicker('新屋案'));
        document.getElementById('btn-import-old').addEventListener('click', () => Handlers.showStartDatePicker('老屋案'));
    }
  }
  
  // 業務邏輯：對排程資料進行排序，規則為：1. 依狀態 (已完成 > 施工中 > 未完成) 2. 依預計開始日期
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
    
  // 渲染UI：呼叫 displaySchedule 函式，將排序好的排程資料渲染成畫面
  displaySchedule(data.overview, state.currentScheduleData);

  // [核心修正] 呼叫函式以建立「工種」欄位的 datalist 下拉建議選單
  createOrUpdateTradeDatalist(state.templateTasks);

  // [修復] 重新加入日誌渲染的邏輯
  // 效能優化：初始化分頁計數器，並呼叫 renderLogPage 函式僅渲染第一頁的日誌
  state.currentPage = 1;
  renderLogPage();
  lazyLoadImages(); // [核心修正] 在渲染第一頁後，立即觸發一次懶加載
  
  // 效能優化：如果日誌總數超過一頁的數量，則啟動滾動監聽，用於實現無限滾動加載
  if (state.currentLogsData.length > state.LOGS_PER_PAGE) {
      setupScrollListener();
  }

  // 渲染UI：使用後端提供的案場名稱，更新頁面的主標題
  const titleEl = document.getElementById('project-title');
  if(data.overview && (data.overview.siteName || data.overview['案場名稱'])){
      titleEl.textContent = '主控台: ' + (data.overview.siteName || data.overview['案場名稱']);
  }

  // [新增] 呼叫新函式來渲染右側的專案資訊面板
  displayProjectInfo(data.overview, state.currentScheduleData);
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
async function initializeApp() {
  // [核心修改] 新增本地測試環境判斷，方便在本機電腦上進行開發與除錯
  const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  const url = new URLSearchParams(location.search);
  const id = url.get('id');
  logToPage('URL id=' + (id || '(未帶入)'));
  if (!id) { displayError({ message: '未指定 id。請在網址加上 ?id=0（草稿）或 ?id=案號。' }); return; }

  const CACHE_KEY = `project_data_${id}`;
  const CACHE_DURATION_MS = 45 * 60 * 1000; // 45 分鐘
  let hasRenderedFromCache = false;

  // [核心重構] 步驟 1: 將快取檢查與渲染提到所有非同步操作之前
  // 這是確保「立即顯示」效果的關鍵。
  if (!isLocalTest) {
    try {
      const cachedItem = localStorage.getItem(CACHE_KEY);
      if (cachedItem) {
        const { timestamp, data } = JSON.parse(cachedItem);
        if (Date.now() - timestamp < CACHE_DURATION_MS) {
          logToPage('⚡️ 優先從快取渲染畫面...');
          handleDataResponse(data);
          hasRenderedFromCache = true;
        } else {
          logToPage('🗑️ 快取已過期，清除中...');
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      logToPage(`❌ 讀取快取失敗: ${e.message}`, 'error');
      localStorage.removeItem(CACHE_KEY);
    }
  }

  if (isLocalTest) {
    // 本地測試環境：直接設定假的使用者，並跳過 LIFF
    state.currentUserName = '測試員A';
    logToPage('⚡️ [本地測試] 偵測到本地環境，已繞過 LIFF 驗證。');
  } else {
    // 線上正式環境：執行完整的 LIFF 初始化與身分驗證流程
    try {
      // [核心修改] 步驟 1: 先從後端取得設定檔 (包含 LIFF ID)
      logToPage('正在從後端取得設定...');
      const configUrl = `${API_BASE_URL}?page=attendance_api&action=get_config`;
      const config = await loadJsonp(configUrl);
      const consoleLiffId = config.consoleLiffId;

      if (!consoleLiffId) {
        throw new Error('後端未提供主控台 LIFF ID，請檢查 Apps Script 屬性設定。');
      }
      logToPage(`取得 LIFF ID: ${consoleLiffId}`);

      // [核心修改] 步驟 2: 使用取得的 LIFF ID 進行初始化
      logToPage('正在初始化 LIFF...');
      await liff.init({ liffId: consoleLiffId });
      if (!liff.isLoggedIn()) {
        logToPage('使用者未登入，將導向至 LINE 登入頁面...');
        liff.login(); // 會自動跳轉，後續程式碼不會執行
        return;
      }
      const profile = await liff.getProfile();
      state.currentUserName = profile.displayName;
    } catch (err) {
      displayError({ message: `LIFF 初始化或身分驗證失敗: ${err.message}` });
      return;
    }
  }

  // 無論是本地測試或線上環境，都顯示歡迎訊息
  logToPage(`✅ 操作者已設定為: ${state.currentUserName}`);
  const welcomeMsg = document.createElement('p');
  welcomeMsg.textContent = `歡迎，${state.currentUserName}${isLocalTest ? ' (本地測試模式)' : ''}`;
  welcomeMsg.className = 'muted';
  document.querySelector('header > div:first-child').appendChild(welcomeMsg);

  // 如果沒有從快取渲染，則顯示骨架屏
  if (!hasRenderedFromCache) {
    displaySkeletonLoader();
  }

  // [核心修正] 使用 setTimeout 將背景同步的邏輯延後到下一個事件循環
  // 這能確保瀏覽器有足夠的時間先完成快取畫面的繪製 (Paint)
  setTimeout(async () => {
    // 2. 無論如何，都去後端請求最新資料
    const profile = isLocalTest ? { userId: 'local_test_user', displayName: state.currentUserName } : await liff.getProfile();
    const fetchUrl = `${API_BASE_URL}?page=project&id=${encodeURIComponent(id)}&userId=${profile.userId}`;
    logToPage('🔄 背景同步資料中... API: ' + fetchUrl);

    try {
      const freshData = await loadJsonp(fetchUrl);
      // 檢查後端是否回傳權限錯誤
      if (freshData.error === 'Forbidden') {
        logToPage(`❌ 權限檢查失敗，用戶 ${profile.displayName} 無權存取。`);
        const errorHtml = `
          <div style="text-align: center; padding: 2rem; font-size: 1.1rem; line-height: 1.6;">
            <h2 style="font-size: 1.5rem; font-weight: bold; color: #dc2626; margin-bottom: 1rem;">存取被拒絕</h2>
            <p>很抱歉，您的 LINE 帳號 <strong>${profile.displayName}</strong> 無法存取此專案主控台。</p>
            <p>請確認您是否為授權的員工或廠商，<br>若有疑問請聯繫管理員。</p>
          </div>`;
        document.getElementById('main-content').innerHTML = errorHtml;
        return;
      }
      logToPage('✅ 權限驗證通過，背景同步成功');
      // 將新資料存入快取
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: freshData }));
      // [核心修正] 只有在尚未從快取渲染過畫面的情況下，才用新資料來渲染。
      // 如果已經從快取渲染，則不做任何事，讓使用者停留在舊畫面上，直到他們手動刷新。
      if (hasRenderedFromCache) return;
      handleDataResponse(freshData);
    } catch (err) {
      logToPage(`❌ 背景同步失敗: ${err.message}`, 'error');
      if (!hasRenderedFromCache) {
        displayError(err);
      }
    }
  }, 0);
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
                Handlers.enableSaveButton();
            }
            break;
        case 'openPhotoModal':
            Handlers.openPhotoModal(logId, target.dataset.photoLinks);
            break;
        case 'handleEditText':
            Handlers.handleEditText(logId);
            break;
        case 'handlePublish':
            Handlers.handlePublish(logId);
            break;
        case 'handleSaveSchedule':
            Handlers.handleSaveSchedule();
            break;
        case 'handleAddTask':
            Handlers.handleAddTask();
            break;
        case 'enableSaveButton':
            Handlers.enableSaveButton();
            break;
        case 'filterLogsByWorkType':
            Handlers.filterLogsByWorkType(target.value);
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
