/*
* =============================================================================
* 檔案名稱: state.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 集中管理所有模組共享的全域狀態。
* =============================================================================
*/

import { isMobile } from '/shared/js/utils.js'; // [v548.0 修正] 改為絕對路徑以解決本地測試 404 問題

// 統一的狀態管理物件，所有模組共享此狀態
export const state = {
    currentEditingLogId: null,
    currentLogsData: [],
    currentScheduleData: [],
    templateTasks: [],
    currentUserName: '未知使用者',
    currentPage: 1,
    LOGS_PER_PAGE: isMobile() ? 3 : 8,
    isLoadingNextPage: false,
    scrollObserver: null,
    // [v292.0 新增] 精細化的資料就緒狀態旗標，用於實現更可靠的非同步依賴管理
    dataReady: {
        userProfile: false,
        allEmployees: false,
        projectOverview: false,
        projectSchedule: false,
        projectDailyLogs: false,
        projectCommunicationHistory: false,
    },
    // [v292.0 新增] 追蹤當前正在進行的檔案上傳數量
    activeUploads: 0,
};