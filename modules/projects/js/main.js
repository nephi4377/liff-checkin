/*
 * =============================================================================
* 檔案名稱: main.js
* 專案名稱: 專案日誌管理主控台
* 版本: v13.0 (穩定版)
* 修改時間: 2025-09-27 10:54 (Asia/Taipei)
*
* 核心功能:
* 1.  **資料處理與API串接**:
* - 透過 projectApi 模組從 Google Apps Script 後端獲取專案總覽、排程、日誌與範本資料。
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

// [v521.0 修正] 移除多餘的 api.js 和 handlers.js 引入，並修正所有模組的相對路徑。
import { request as apiRequest } from './projectApi.js';
import { logToPage, showGlobalNotification } from '/shared/js/utils.js'; // [v544.0 修正] 改為絕對路徑
import { displaySkeletonLoader, displayError, renderLogPage, displayProjectInfo, renderPostCreator, _buildLogCard, renderCommunicationHistory, lazyLoadImages } from './ui.js';
import * as LogActions from './logActions.js';
import * as ScheduleActions from './scheduleActions.js';
import { state } from './state.js';
import { CONFIG } from '/shared/js/config.js'; // [v602.0 重構] 引入統一設定檔
import { initializeTaskSender, addRecipient } from '/shared/js/taskSender.js'; // [v544.0 修正] 改為絕對路徑

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
  // [核心修正] 在重新渲染前，先移除所有樂觀更新的臨時卡片，避免重複顯示。
  const optimisticCards = logsContainer.querySelectorAll('.card[id^="log-temp-"]');
  optimisticCards.forEach(card => card.remove());
  logToPage(`[Render] 已移除 ${optimisticCards.length} 張樂觀更新卡片。`);

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
      submitPostBtn.addEventListener('click', LogActions.handleCreateNewPost); // [v545.0 修正] 移除對已不存在的 Handlers 模組的呼叫
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
  if (data && data.error) {
    displayError({ message: data.error });
    return;
  }

  // [v301.0 核心修正] 將 overview 的預處理邏輯移至此處，確保在存入 state 前完成。
  // 這樣可以從根本上解決因 data.overview 為 null 或 undefined，導致預處理失效的問題。
  if (data.overview && data.overview.address && !data.overview['案場地址']) {
    data.overview['案場地址'] = data.overview.address;
  }

  // [v303.0 核心修正] 調整資料處理順序，確保 overview 和 schedule 的 dataReady 旗標能被一同觸發。
  // 舊的寫法將 overview 的處理放在函式末尾，可能導致依賴 'projectOverview' 的元件無法即時渲染。
  state.overview = data.overview || {};
  state.currentScheduleData = data.schedule || [];
  state.currentLogsData = data.dailyLogs || [];
  state.communicationHistory = data.communicationHistory || {};

  state.templateTasks = data.templates || [];

  // 將所有相關的 dataReady 旗標一起設定，確保依賴它們的任務能被正確觸發
  Object.assign(state.dataReady, {
    projectOverview: true,
    projectSchedule: true,
    projectDailyLogs: true,
    projectCommunicationHistory: true,
  });

  // [v307.0 核心修正] 修正 dependencyManager 的 notify 邏輯。
  // 舊的寫法傳遞的是後端原始 key (e.g., 'overview')，但依賴註冊的是 state.dataReady 的 key (e.g., 'projectOverview')，導致無法匹配。
  // 新的寫法明確地通知所有剛剛被設為 true 的 dataReady 旗標，確保依賴它們的元件能被正確觸發。
  dependencyManager.notify([
    'projectOverview',
    'projectSchedule',
    'projectDailyLogs',
    'projectCommunicationHistory'
  ]);

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
  if (state.currentScheduleData.length === 0 && state.projectId !== '0') {
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

  // [v292.0 核心重構] UI 渲染和事件綁定現在由 runWhenReady 觸發，不再直接在此處呼叫
  // 這樣確保了所有操作都在其依賴的資料就緒後才執行。
  // 例如，displayProjectInfo 會在 projectOverview 和 projectSchedule 就緒後執行。
  // initializeTaskSender 會在 allEmployees 和 projectCommunicationHistory 就緒後執行。

  // [v189.0 核心修正] 將事件綁定移至 displayProjectInfo 之後，確保按鈕已存在於 DOM 中
  const copyBtn = document.getElementById('copy-project-info-btn');
  if (copyBtn && !copyBtn.dataset.listenerAttached) { // 避免重複綁定
    copyBtn.addEventListener('click', () => {
      if (!state.overview) {
        showGlobalNotification('尚未載入專案資訊，無法複製。', 3000, 'error');
        return;
      }
      const get = (key) => state.overview[key] || '';
      const notes = [
        get('備註-管理中心電話').trim(),
        get('備註-施工時間').trim(),
        get('備註-特別注意事項').trim()
      ].filter(Boolean).join('\n');

      const infoText = `進場資訊
1.案名：${get('案場名稱').trim() || '未填寫'}
2.地址：${get('案場地址').trim() || '未填寫'}
3.停車方式：${get('停車方式').trim() || '未填寫'}
4.入門方式：${get('入門方式').trim() || '未填寫'}
5.設計師：${get('設計師').trim() || '未填寫'}
6.保證金事宜：${get('保證金事宜').trim() || '未填寫'}
7.衛浴使用說明：${get('衛浴使用說明').trim() || '無'}
8.案場注意事項：
${notes || '無'}`;

      navigator.clipboard.writeText(infoText).then(() => {
        showGlobalNotification('✅ 案場資訊已成功複製！', 3000, 'success');
      }).catch(err => {
        showGlobalNotification(`複製失敗: ${err.message}`, 5000, 'error');
      });
    });
    copyBtn.dataset.listenerAttached = 'true';
  }

  // [v199.0 新增] 結案按鈕功能
  const closeBtn = document.getElementById('close-project-btn');
  if (closeBtn && !closeBtn.dataset.listenerAttached) { // 避免重複綁定
    closeBtn.addEventListener('click', () => {
      if (confirm(`您確定要將專案 #${state.projectId} 標示為「已結案」嗎？\n\n此操作將無法復原。`)) {
        showGlobalNotification('正在處理結案...', 3000, 'info');
        apiRequest({ // [v317.0 API化] 改為使用統一請求函式
          action: 'updateProjectStatus',
          projectId: state.projectId,
          status: '已結案',
          userId: state.currentUserId,
          userName: state.currentUserName
        }).then(result => {
          if (result.success) {
            showGlobalNotification('專案已成功標示為「已結案」。', 5000, 'success');
            closeBtn.disabled = true; // 禁用按鈕，避免重複點擊
            closeBtn.textContent = '專案已結案';
          } else {
            showGlobalNotification(`結案失敗: ${finalJobState.result?.message || '未知錯誤'}`, 5000, 'error');
          }
        }).catch(err => showGlobalNotification(`結案請求失敗: ${err.message}`, 5000, 'error'));
      }
    });
    closeBtn.dataset.listenerAttached = 'true';
  }

  logToPage(`✅ 已載入 ${Object.keys(state.communicationHistory).length} 組溝通串流。`);
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
    // [v602.0 重構] 改為使用統一的 apiRequest 函式，不再直接使用 fetch。
    const fetchUrl = `${CONFIG.GAS_WEB_APP_URL}?page=project&id=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
    const response = await fetch(fetchUrl); // 維持 fetch，因為此函式在 apiRequest 之外
    const freshData = await response.json();

    const oldDataSignature = JSON.stringify({ overview: state.overview, schedule: state.currentScheduleData, dailyLogs: state.currentLogsData, communicationHistory: state.communicationHistory });
    const newDataSignature = JSON.stringify({ overview: freshData.overview, schedule: freshData.schedule, dailyLogs: freshData.dailyLogs, communicationHistory: freshData.communicationHistory });

    if (oldDataSignature !== newDataSignature) {
        await refreshProjectData(true); // 呼叫新的刷新函式，並顯示通知
    } else {
        logToPage('✅ 背景自動更新：資料無變動。');
    }
}

/**
 * [v291.0 新增] 輕量級的資料刷新函式，專門用於更新溝通紀錄。
 * 此函式只會獲取最新的溝通紀錄，並只重新渲染該區塊，避免整頁刷新。
 * @param {string} projectId - 專案 ID。
 * @param {string} userId - 使用者 ID。
 * @param {string} API_BASE_URL - 後端 API 網址。
 */
async function refreshCommunicationHistory(projectId, userId, API_BASE_URL) {
    try {
        logToPage('🔄 輕量更新：正在請求最新的溝通紀錄...');
        // [重構] 改為使用統一的 apiRequest 函式，以保持一致性
        const result = await apiRequest({
            action: 'project',
            payload: { id: projectId, userId: userId }
        });

        if (result.success) {
            const freshData = result.data;
            state.communicationHistory = freshData.communicationHistory;
            renderCommunicationHistory(state.communicationHistory, state.currentUserId);
            logToPage('✅ 溝通紀錄已無縫更新。');
        } else {
            throw new Error('後端未回傳有效的溝通紀錄。');
        }
    } catch (err) {
        logToPage(`❌ 輕量更新失敗: ${err.message}`, 'error');
    }
}

/**
 * [v292.0 新增] 輕量級的資料刷新與局部渲染函式。
 * @param {boolean} [showNotification=false] - 是否在刷新後顯示通知。
 */
async function refreshProjectData(showNotification = false) {
    try {
        logToPage('🔄 輕量更新：正在請求最新的專案資料...');
        const result = await apiRequest({ // [v317.0 API化] 改為使用統一請求函式
            action: 'project',
            payload: { id: state.projectId, userId: state.currentUserId }
        });

        if (!result.success) throw new Error(result.error);
        const freshData = result.data;

        // 更新 state
        state.overview = freshData.overview || {};
        state.currentScheduleData = freshData.schedule || [];
        state.currentLogsData = freshData.dailyLogs || [];
        state.communicationHistory = freshData.communicationHistory || {};

        // [v304.0 核心修正] 移除對已不存在的 runWhenReady 函式的呼叫。
        // 在資料刷新後，直接呼叫渲染函式來更新畫面。
        displayProjectInfo(state.overview, state.currentScheduleData);
        ScheduleActions.renderSchedulePage(state.overview, state.currentScheduleData);

        if (showNotification) {
            showGlobalNotification('偵測到專案資料更新，畫面已自動刷新。', 3000, 'info');
        }
        logToPage('✅ 專案資料已無縫更新。');
    } catch (err) {
        logToPage(`❌ 輕量更新失敗: ${err.message}`, 'error');
    }
}

/**
 * [v292.0 新增] 獲取並快取所有員工資料。
 * 成功獲取資料後，會將 state.dataReady.allEmployees 設為 true。
 * @returns {Promise<void>}
 */
async function fetchEmployees() {
    if (state.dataReady.allEmployees) return;

    const employeeCacheKey = 'console_employees';
    const cachedItem = localStorage.getItem(employeeCacheKey);
    // [v602.0 重構] ATTENDANCE_API_URL 改為從 config.js 讀取

    if (cachedItem) {
        try {
            const { timestamp, data } = JSON.parse(cachedItem);
            if (Date.now() - timestamp < 24 * 60 * 60 * 1000) { // 快取 1 天
                state.allEmployees = data;
                state.dataReady.allEmployees = true;
                logToPage('⚡️ 從快取載入員工資料。');
                dependencyManager.notify('allEmployees'); // [v295.0] 發布 'allEmployees' 就緒通知
                return;
            }
        } catch (e) {
            localStorage.removeItem(employeeCacheKey);
        }
    }

    logToPage('🔄 正在從 CheckinSystem 請求所有員工資料...');
    try {
        // [v408.0 核心修正] 修正日誌中 requestor 為 N/A 的問題。
        // 在請求員工列表時，附上當前操作者的 userId 和 userName，以便後端能正確記錄請求來源。
        const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
        url.searchParams.set('page', 'attendance_api');
        url.searchParams.set('action', 'get_employees');
        url.searchParams.set('userId', state.currentUserId);
        url.searchParams.set('userName', state.currentUserName);
        const response = await fetch(url.toString());
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            state.allEmployees = result.data;
            state.dataReady.allEmployees = true;
            localStorage.setItem(employeeCacheKey, JSON.stringify({ timestamp: Date.now(), data: result.data }));
            logToPage('✅ 成功獲取並快取員工資料。');            
        } else {
            throw new Error(result.message || '後端未回傳有效資料');
        }
    } catch (err) {
        // [v293.0 核心改造] 根據您的指示，實作自動重試機制，而不是直接放棄
        logToPage(`❌ 獲取員工資料失敗: ${err.message}。將在 5 秒後重試...`, 'error');
        setTimeout(fetchEmployees, 15000); // [v294.0] 根據您的指示，將重試時間延長至 15 秒
        return; // 提前返回，不執行後續的 runAllPendingActions
    }

    // [v295.0] 發布 'allEmployees' 就緒通知
    dependencyManager.notify('allEmployees');
}

// [v295.0 核心重構] 引入事件驅動的依賴管理器，取代原有的 runWhenReady/runAllPendingActions
const dependencyManager = {
    subscribers: [],

    /**
     * 訂閱一個或多個資料依賴。當所有依賴都就緒時，執行回呼函式。
     * @param {string[]} dependencies - 依賴的資料鍵名陣列 (來自 state.dataReady)。
     * @param {Function} callback - 當依賴滿足時要執行的回呼函式。
     * @param {string} name - (可選) 動作的名稱，用於日誌記錄。
     */
    subscribe(dependencies, callback, name = '未命名動作') {
        const subscription = {
            name,
            dependencies,
            callback,
            isReady: () => dependencies.every(dep => state.dataReady[dep]),
            executed: false
        };

        // 註冊時立即檢查一次，如果條件已滿足，直接執行
        if (subscription.isReady()) {
            logToPage(`[DepManager] ${name} 的依賴項已滿足，立即執行。`);
            callback();
            subscription.executed = true;
        }

        this.subscribers.push(subscription);
    },

    /**
     * 發布一個或多個資料已就緒的通知。
     * @param {string|string[]} event - 已就緒的資料鍵名。
     */
    notify(event) {
        const events = Array.isArray(event) ? event : [event];
        logToPage(`[DepManager] 收到就緒通知: ${events.join(', ')}`);

        // [v362.0 核心修正] 修正背景刷新時 UI 不更新的問題。
        // 每次收到通知時，都應該重新檢查所有訂閱，而不是只處理未執行過的。
        this.subscribers.forEach(sub => {
            // 如果此訂閱尚未執行，且其依賴項包含剛剛觸發的事件之一
            if (sub.dependencies.some(dep => events.includes(dep))) {
                // 重新檢查此訂閱的所有依賴是否都已滿足
                if (sub.isReady()) {
                    logToPage(`[DepManager] ${sub.name} 的依賴項現已全部滿足，開始執行...`);
                    sub.callback();
                    // 移除 sub.executed = true，允許任務被重複觸發
                }
            }
        });
    }
};

/**
 * [v292.0 新增] 封裝初始化任務交辦中心的邏輯。
 */
function initializeTaskSenderForConsole() {
    const taskSenderContainer = document.getElementById('task-sender-container');
    if (!taskSenderContainer || document.getElementById('task-sender-wrapper')) return;
    // [v602.0 重構] 移除對 window.API_BASE_URL 的依賴
    const config = { state: { ...state }, callbacks: { onSuccess: () => refreshCommunicationHistory(state.projectId, state.currentUserId), onOptimisticUpdate: window.addOptimisticCommunicationCard } };
    initializeTaskSender(taskSenderContainer, config, { style: 'console', defaultAction: 'ReplyText' });
}
// [v292.0] 將 refreshProjectData 掛載到 window，以便其他模組呼叫

/**
 * [v296.0 新增] 全域函式，用於以真實卡片替換樂觀更新的臨時卡片。
 * @param {string} tempId - 臨時卡片的 ID (e.g., 'temp-12345')。
 * @param {object} finalLogData - 後端回傳的、包含真實 LogID 的完整日誌資料。
 */
window.replaceOptimisticCard = function(tempId, finalLogData) {
    // [v323.0 核心修正] 修正樂觀更新卡片無法被替換的問題。
    // _buildLogCard 在建立卡片時，會為 ID 加上 'log-' 前綴，因此在尋找時也必須加上。
    const tempCard = document.getElementById('log-' + tempId);
    if (!tempCard) return;

    // 1. 根據最終資料，建立一張全新的、完整的卡片
    const finalCard = _buildLogCard(finalLogData, false);

    // 2. 在臨時卡片的位置，用新卡片替換掉它
    tempCard.parentNode.replaceChild(finalCard, tempCard);

    // 3. 觸發新卡片中可能存在的圖片懶加載
    lazyLoadImages();
};

/**
 * [v305.0 新增] 註冊所有元件的渲染依賴。
 * 將此邏輯從 initializeApp 中抽離，使其成為一個獨立的設定步驟。
 */
function registerComponentDependencies() {
  dependencyManager.subscribe(['projectOverview'], () => {
    const titleEl = document.getElementById('project-title');
    if (titleEl && (state.overview.siteName || state.overview['案場名稱'])) {
      titleEl.textContent = '主控台: ' + (state.overview.siteName || state.overview['案場名稱']);
    }
  }, '更新頁面標題');

  dependencyManager.subscribe(['projectOverview', 'projectSchedule'], () => {
    displayProjectInfo(state.overview, state.currentScheduleData);
    ScheduleActions.renderSchedulePage(state.overview, state.currentScheduleData);
  }, '渲染專案資訊與排程');

  dependencyManager.subscribe(['projectDailyLogs'], () => {
    state.currentPage = 1;
    renderLogPage();
    if (state.currentLogsData.length > state.LOGS_PER_PAGE) {
      setupScrollListener();
    }
    lazyLoadImages();
  }, '渲染日誌');

  dependencyManager.subscribe(['projectCommunicationHistory'], () => {
    if (document.querySelector('.main-nav .nav-button.active')?.dataset.view === 'collaboration') {
      renderCommunicationHistory(state.communicationHistory, state.currentUserId);
    }
  }, '渲染溝通紀錄');

  dependencyManager.subscribe(['allEmployees', 'projectCommunicationHistory'], initializeTaskSenderForConsole, '初始化任務交辦中心');
}

window.refreshProjectData = refreshProjectData;



/* ===== 入口 ===== */
/**
 * [V14.0 認證優先版] 應用程式主入口函式
 * - 流程重構為「先認證，後載入」，確保只有通過 LINE LIFF 登入的使用者才能看到頁面內容。
 * - 移除了在認證前顯示快取資料的邏輯，改為在認證成功後才顯示載入動畫並請求資料。
 */
async function initializeApp() {
      // [v425.0 架構優化] 支援混合模式 (從主控台內嵌 或 直接LIFF開啟)
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get('id');
    let userId = urlParams.get('uid');
    let userName = urlParams.get('name');

  // 3. 判斷環境並賦值
  const isLocalTest = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

  if (isLocalTest) {
    logToPage('⚡️ 本地測試模式啟用...');
    projectId = urlParams.get('id') || '999';
    userId = urlParams.get('uid') || 'Ud58333430513b7527106fa71d2e30151';
    state.currentUserName = '本地測試員';
  } else {

    if (userId && userName) {
        // 模式一：從主控台內嵌，已取得 uid 和 name
        logToPage('⚡️ 偵測到 uid，以內嵌模式啟動...');
        state.currentUserName = userName;
    } else {
        // 模式二：直接開啟，需執行 LIFF 驗證
        logToPage('🔄 未偵測到 uid，以獨立 LIFF 模式啟動...');
        await liff.init({ liffId: CONFIG.PROJECT_CONSOLE_LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        const profile = await liff.getProfile();
        userId = profile.userId;
        state.currentUserName = profile.displayName;
        // [v425.1 修正] 補回對 liff.state 的處理，確保從 LINE 直接開啟時能正確讀取案號
        if (urlParams.has('liff.state')) {
            const liffState = decodeURIComponent(urlParams.get('liff.state')).replace(/^\?/, '');
            const liffParams = new URLSearchParams(liffState);
            if (liffParams.has('id')) projectId = liffParams.get('id');
            // uid 已從 getProfile() 取得，此處無需再讀取
        }
    }
  }

  const pageLoadId = `load_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  // [v602.0 重構] 不再從 window 讀取，projectApi 會自行引入

  // 2. 初始設定 (不依賴環境)
  window.currentPageLoadId = pageLoadId;
  if (!CONFIG.GAS_WEB_APP_URL) {
    displayError({ message: '無法讀取 API_BASE_URL 設定，請檢查 HTML 檔案。' });
    return;
  }
  setupNavigation();
  fetchEmployees().catch(err => console.warn('初始化時預先獲取員工資料失敗，將在需要時重試。'));

  // 5. 將 ID 存入全域狀態
  state.projectId = projectId;
  state.currentUserId = userId;

  // 6. 執行共用的後續邏輯
  state.dataReady.userProfile = true;
  dependencyManager.notify('userProfile');

  registerComponentDependencies();

  await loadDataAndRender(projectId, userId, pageLoadId);

  setInterval(() => refreshData(state.projectId, state.currentUserId), 10 * 60 * 1000);
  logToPage('已設定每 10 分鐘自動更新專案資料。');
}

/**
 * [v306.0 新增] 封裝導覽列的事件綁定邏輯。
 */
function setupNavigation() {
  const navButtons = document.querySelectorAll('.main-nav .nav-button');
  const mainContent = document.getElementById('main-content');
  const scrollPositions = { logs: 0, schedule: 0, collaboration: 0 };

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentView = document.querySelector('.main-nav .nav-button.active')?.dataset.view;
      const newView = button.dataset.view;

      if (currentView && currentView !== newView) {
        scrollPositions[currentView] = mainContent.scrollTop;
      }

      navButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      Array.from(mainContent.children).forEach(child => {
        child.style.display = 'none';
      });

      const targetView = document.getElementById(`${newView}-container`);
      if (targetView) {
        targetView.style.display = 'block';
        mainContent.scrollTop = scrollPositions[newView];

        if (newView === 'schedule') {
          const taskCards = Array.from(document.querySelectorAll('#schedule-container .task-card'));
          const firstUnfinishedIndex = taskCards.findIndex(card => card.querySelector('select[data-field="狀態"]')?.value !== '已完成');
          if (firstUnfinishedIndex !== -1) {
            taskCards[firstUnfinishedIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else if (newView === 'collaboration' && state.dataReady.projectCommunicationHistory) {
          renderCommunicationHistory(state.communicationHistory, state.currentUserId);
          initializeTaskSenderForConsole();
        }
      }
    });
  });
}

/**
 * [v284.0 新增] 處理溝通紀錄卡片上的動作 (回覆, 完成, 封存)
 */
async function handleCommunicationAction(action, notificationId, content = '') {
  // [v308.0 核心修正] 修正 'urlParams is not defined' 錯誤。改為從全域 state 物件讀取 ID。
  const { projectId, currentUserId: userId } = state;

  const payload = {
    action: 'process_notification_action',
    subAction: action,
    notificationId: notificationId,
    content: content,
    userName: state.currentUserName,
    userId: state.currentUserId
  };

  // [v309.0 核心修正] 針對「標示已讀」操作，採用樂觀更新，立即移除卡片以提升體驗。
  if (action === 'mark_read') {
    const card = document.getElementById(`thread-${notificationId}`);
    if (card) {
      card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      card.style.opacity = '0';
      card.style.transform = 'translateX(20px)';
      setTimeout(() => card.remove(), 300);
    }
  }

  try {
    // [v601.0 重構] 改為使用統一的 apiRequest 函式，與專案其他部分保持一致。
    // apiRequest 內部已包含輪詢機制，此處只需等待最終結果。
    const backendResult = await apiRequest({
      action: payload.action,
      payload: payload
    });
    
    if (!backendResult || !backendResult.success) throw new Error(backendResult.message || '後端處理失敗');
    showGlobalNotification(backendResult.message || '操作成功！', 3000, 'success');

    // [v309.0 核心修正] 只有在「回覆」或「完成」等需要更新畫面的操作後，才執行刷新。
    // 「標示已讀」已透過樂觀更新處理，無需刷新。
    if (action === 'reply' || action === 'complete') {
      // [v602.0 重構] 移除對 window.API_BASE_URL 的依賴
      await refreshCommunicationHistory(state.projectId, state.currentUserId);
    }
  } catch (error) {
    showGlobalNotification(`操作失敗: ${error.message}`, 5000, 'error');
  }
}
/**
 * [v54.0 新增] 封裝資料載入與渲染的核心邏輯
 */
async function loadDataAndRender(projectId, userId, pageLoadId) {

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
        // [v202.0 核心修正] 增加對快取內容的健康檢查。
        // 如果快取中儲存的是一筆錯誤的回應，則將其視為無效快取，並繼續向後端請求。
        if (data.error) {
          logToPage('🗑️ 快取中包含錯誤紀錄，將其視為無效並清除。');
          localStorage.removeItem(CACHE_KEY);
        } else {
          logToPage('⚡️ 偵測到有效快取，立即渲染畫面...');
          state.projectId = projectId;
          state.currentUserName = data.userName || `使用者 (${userId.slice(-6)})`;
          
          // 直接使用從快取解析出的 data 物件進行渲染
          handleDataResponse(data);
          hasRenderedFromCache = true;
        }
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

  // [v249.0 重構] 移除 includeEmployees 參數，因為員工資料已由前端獨立獲取
  try {
    logToPage('🔄 正在從後端請求專案資料...');
    const result = await apiRequest({ // [v317.0 API化] 改為使用統一請求函式
        action: 'project',
        payload: { id: projectId, userId: userId }
    });

    // [v201.0 核心修正] 在處理任何資料前，先檢查後端是否回傳錯誤。
    if (!result.success) {
        const freshData = result.data || {}; // 即使失敗，也嘗試從 data 中取錯誤訊息
        // 如果後端回傳錯誤，則不進行任何渲染或快取操作，直接顯示錯誤。
        logToPage(`❌ 後端回傳錯誤: ${freshData.error}`, 'error');
        displayError({ message: freshData.error });
        return;
    }

    // 【⭐️ 核心修正：使用後端傳來的使用者名稱 ⭐️】
    const freshData = result.data;
    // [v318.0 核心修正] 增加防禦性檢查，防止後端在某些情況下 (如找不到專案) 回傳 null 的 data，導致前端崩潰。
    if (!freshData) {
        const errorMsg = `後端未回傳有效的專案資料 (ID: ${projectId})，可能該專案不存在或已被刪除。`;
        logToPage(`❌ ${errorMsg}`, 'error');
        displayError({ message: errorMsg });
        return;
    }
    state.currentUserName = freshData.userName || `使用者 (${userId.slice(-6)})`;
    logToPage(`✅ 操作者已設定: ${state.currentUserName}`);

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
        const oldDataSignature = JSON.stringify({ 
          overview: oldData.overview, 
          schedule: oldData.schedule, 
          dailyLogs: oldData.dailyLogs, 
          communicationHistory: oldData.communicationHistory 
        });
        // [核心修正] 從 freshData 物件本身提取對應的屬性來產生簽名，而不是從它的下一層。
        const newDataSignature = JSON.stringify({ overview: freshData.overview, schedule: freshData.schedule, dailyLogs: freshData.dailyLogs, communicationHistory: freshData.communicationHistory });
        
        // [核心修正] 只有在資料確定有變動時，才執行畫面更新與快取寫入
        if (oldDataSignature !== newDataSignature) {
          logToPage('🔄 偵測到後端資料已更新，正在執行畫面刷新...');

          // [v358.0 核心修正] 偵測到資料更新時，不再手動更新部分畫面，
          // 而是直接呼叫 handleDataResponse 函式，用最新的資料完整地、
          // 從頭重新渲染整個頁面（包含排程、日誌、專案資訊等所有元件），
          // 確保畫面的一致性。
          handleDataResponse(freshData);

          // 將新資料寫入快取
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: freshData }));

          showGlobalNotification('偵測到專案資料更新，畫面已自動刷新。', 3000, 'info');
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

  if (action === 'handleCreateNewPost') {
    LogActions.handleCreateNewPost();
    return;
  }
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
    // [v262.0 新增] 處理點擊成員姓名按鈕的事件，將其加入任務交辦中心的收件人
    case 'add-recipient':
      addRecipient(target.dataset.name);
      break;
    // [v286.0 核心修正] 處理溝通紀錄卡片上的動作 (回覆, 完成, 標示已讀)
    // [v286.0 核心修正] 將 archive 改為 mark_read，並增加按鈕禁用與樂觀更新邏輯
    case 'reply':
    case 'complete':
    case 'mark_read':
      {
        const actionWrapper = target.closest('.thread-actions');
        if (!actionWrapper) return;

        // 禁用所有按鈕防止重複點擊
        actionWrapper.querySelectorAll('button').forEach(btn => btn.disabled = true);
        target.textContent = '處理中...';

        const notificationId = actionWrapper.dataset.notificationId;
        let content = '';

        if (action === 'reply') {
          const input = actionWrapper.querySelector('input[type="text"]');
          content = input.value.trim();
          if (!content) {
            showGlobalNotification('請輸入回覆內容。', 3000, 'error');
            actionWrapper.querySelectorAll('button').forEach(btn => btn.disabled = false); // 恢復按鈕
            target.textContent = '回覆';
            return;
          }
        }
        handleCommunicationAction(action, notificationId, content);
      }
      break;
  }
});

// [核心修正] 應用程式進入點
// 在所有函式與事件監聽器都定義完成後，
// 呼叫 initializeApp() 來啟動整個應用程式的載入與渲染流程。
document.addEventListener('DOMContentLoaded', () => {
  // [v29.0 修正] 初始化圖片燈箱功能，���保點擊照片可以放大
  initializeLightbox();
  initializeApp();
});
