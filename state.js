/*
* =============================================================================
* 檔案名稱: state.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 集中管理所有模組共享的全域狀態。
* =============================================================================
*/

import { isMobile } from './utils.js';

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
    scrollObserver: null
};