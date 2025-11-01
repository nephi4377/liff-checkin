/*
 * =============================================================================
 * 檔案名稱: gantt_main.js
 * 專案名稱: 專案日誌管理主控台 (甘特圖獨立頁面)
 * 版本: v1.0
 * 說明: 這是專案甘特圖獨立頁面的主要進入點，負責初始化、資料載入與事件處理。
 * =============================================================================
 */

import * as api from './api.js';
import { logToPage, showGlobalNotification, saveCache, loadCache } from './utils.js';
import * as GanttScheduleLogic from './gantt_schedule_logic.js';
import { state } from './state.js';

/**
 * 處理從後端 API 成功獲取資料後的核心回呼函式。
 * @param {object} data - 從後端 JSONP 傳回的資料物件。
 */
function handleDataResponse(data) {
    logToPage('✅ 後端回應成功');

    if (data && data.error) {
        // 如果後端回傳錯誤，則不進行任何渲染或快取操作，直接顯示錯誤。
        localStorage.removeItem(state.cacheKey); // 清除可能存在的錯誤快取
        showGlobalNotification(`載入失敗: ${data.error}`, 8000, 'error');
        document.getElementById('main-content').innerHTML = `<div class="text-red-600 p-4">${data.error}</div>`;
        return;
    }

    // 更新全域狀態
    state.overview = data.overview || {};
    state.currentScheduleData = data.schedule || [];
    state.currentUserName = data.userName || `使用者 (${state.currentUserId.slice(-6)})`;
    state.currentUserName = data.userName || `使用者 (${state.currentUserId.slice(-6)})`; // 確保 userName 也被更新
    state.templateTasks = data.templates || [];

    // 更新頁面標題
    const projectTitleEl = document.getElementById('project-title');
    if (projectTitleEl && (state.overview.siteName || state.overview['案場名稱'])) {
        projectTitleEl.textContent = '甘特圖排程: ' + (state.overview.siteName || state.overview['案場名稱']);
    }

    // 業務邏輯：如果這是一個沒有任何排程的既有專案，則顯示「套用範本」的按鈕
    const actionsContainer = document.getElementById('actions-container');
    if (state.currentScheduleData.length === 0 && state.projectId !== '0') {
        if (actionsContainer) {
            actionsContainer.style.display = 'flex';
            // [優化] 使用事件代理，避免重複綁定
            if (!actionsContainer.dataset.listenerAttached) {
                actionsContainer.addEventListener('click', (e) => {
                    if (e.target.id === 'btn-import-new') GanttScheduleLogic.showStartDatePicker('新屋案', e.target);
                    if (e.target.id === 'btn-import-old') GanttScheduleLogic.showStartDatePicker('老屋案', e.target);
                });
                actionsContainer.dataset.listenerAttached = 'true';
            }
        }
    } else if (actionsContainer) {
        // 如果已有排程，則確保按鈕是隱藏的。
        actionsContainer.style.display = 'none';
    }

    // 儲存快取
    saveCache(state.cacheKey, { overview: state.overview, schedule: state.currentScheduleData, userName: state.currentUserName, templateTasks: state.templateTasks });
    logToPage(`✅ 資料已儲存至快取 (${state.cacheKey})。`);

    // 渲染甘特圖
    GanttScheduleLogic.renderGanttSchedulePage(state.overview, state.currentScheduleData);
}

/**
 * 應用程式主入口函式。
 * - 負責從 URL 獲取專案 ID 和使用者 ID。
 * - 載入資料並渲染甘特圖。
 */
async function initializeApp() {
    // 顯示版本號
    document.getElementById('version-display').textContent = `版本: ${window.FRONTEND_VERSION}`;

    // 1. 從 URL 獲取專案 ID 和使用者 ID
    const urlParams = new URLSearchParams(window.location.search);
    let projectId = urlParams.get('id');
    let userId = urlParams.get('uid');

    // 【本地測試模式】
    const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    if (isLocalTest && (!projectId || !userId)) {
        logToPage('⚡️ 本地測試模式啟用，使用預設專案與使用者資訊。');
        projectId = projectId || '715'; // 預設專案 ID
        userId = userId || 'Ud58333430513b7527106fa71d2e30151'; // 預設使用者 ID
        state.currentUserName = '本地測試員';
    }

    if (!projectId || !userId) {
        const errorMsg = '網址中缺少必要的專案 ID (id) 或使用者 ID (uid)。請確認連結是否正確。';
        showGlobalNotification(errorMsg, 0, 'error');
        document.getElementById('loading-or-error-message').innerHTML = `<div class="text-red-600 p-4">${errorMsg}</div>`;
        return;
    }

    // 儲存到全域狀態
    state.projectId = projectId;
    state.currentUserId = userId;

    // 【優化】建立快取鍵
    state.cacheKey = `gantt_project_data_${projectId}_${userId}`;

    // 【優化】步驟 1: 嘗試從快取中讀取並立即渲染
    const cachedData = loadCache(state.cacheKey);
    if (cachedData) {
        logToPage('⚡️ 偵測到有效快取，立即渲染畫面...');
        // 直接使用快取資料渲染，不顯示載入動畫
        handleDataResponse(cachedData);
        document.getElementById('loading-or-error-message').style.display = 'none';
    } else {
        // 如果沒有快取，才顯示載入動畫
        document.getElementById('loading-or-error-message').style.display = 'block';
    }

    // 2. 載入資料
    // 【優化】無論是否有快取，都在背景（延遲後）向後端請求最新資料。
    // 這樣可以確保畫面快速顯示，同時資料保持最新。
    setTimeout(async () => {
        try {
            logToPage('🔄 正在從後端請求最新專案資料...');
            const fetchUrl = `${window.API_BASE_URL}?page=project&id=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(userId)}`;
            const freshData = await api.loadJsonp(fetchUrl);
            
            // 【優化】只有在新舊資料不同時才更新畫面和快取
            const oldDataSignature = JSON.stringify(loadCache(state.cacheKey) || {});
            const newDataSignature = JSON.stringify(freshData);

            if (oldDataSignature !== newDataSignature) {
                logToPage('🔄 偵測到後端資料已更新，正在無縫刷新畫面...');
                handleDataResponse(freshData); // 使用新資料重新渲染畫面並更新快取
                showGlobalNotification('專案資料已自動更新。', 3000, 'info');
            } else {
                logToPage('✅ 背景自動更新：資料無變動。');
            }
        } catch (err) {
            logToPage(`❌ 背景資料更新失敗: ${err.message}`, 'error');
            // 只有在沒有快取（即首次載入失敗）時才顯示錯誤
            if (!cachedData) {
                showGlobalNotification(`載入資料失敗: ${err.message}`, 0, 'error');
                document.getElementById('loading-or-error-message').innerHTML = `<div class="text-red-600 p-4">${err.message}</div>`;
            }
        } finally {
            // 確保載入動畫最終會被隱藏
            document.getElementById('loading-or-error-message').style.display = 'none';
        }
    }, cachedData ? 500 : 0); // 如果有快取，延遲 0.5 秒再請求，讓畫面先顯示
}

/**
 * 綁定事件監聽器。
 */
function bindEventListeners() {
    document.getElementById('save-schedule-btn')?.addEventListener('click', GanttScheduleLogic.handleSaveSchedule);
    document.getElementById('add-task-btn')?.addEventListener('click', GanttScheduleLogic.handleAddTask);
}

/* ===== 程式進入點 ===== */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    bindEventListeners();
});
/* ===== 程式進入點 ===== */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    bindEventListeners();
});