
/*
* =============================================================================
* 檔案名稱: actionDispatcher.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 統一的 UI 動作分派器。
*       接收來自 main.js 的事件，並根據 action 名稱呼叫對應的處理函式。
* =============================================================================
*/

import * as LogActions from './logActions.js';
import * as ScheduleActions from './scheduleActions.js';
import { addRecipient } from '../../../shared/js/taskSender.js';
import { showGlobalNotification } from '../../../shared/js/utils.js';
import { state } from './state.js';

// 動作地圖：將 data-action 的值映射到實際的處理函式
const ACTION_HANDLERS = {
    // Log Actions
    // [v347.0 核心修正] 修正參數傳遞問題。
    // handleCreateNewPost 函式本身不需要參數，它會自行從 DOM 讀取所需資訊。
    // 因此，這裡提供一個不傳遞任何參數的箭頭函式。
    'handleCreateNewPost': () => LogActions.handleCreateNewPost(),
    'openPhotoModal': (target) => LogActions.openPhotoModal(target.dataset.logId, target.dataset.photoLinks),
    'handleEditText': (target) => LogActions.handleEditText(target.dataset.logId),
    'handlePublish': (target) => LogActions.handlePublish(target.dataset.logId),
    'deleteLog': (target) => {
        const card = document.getElementById(`log-${target.dataset.logId}`);
        const timestampText = card ? card.querySelector('.log-card-header small')?.textContent : `Log ID: ${target.dataset.logId}`;
        if (confirm(`您確定要永久刪除這篇於「${timestampText}」發佈的日誌嗎？`)) {
            LogActions.handleDeleteLog(target.dataset.logId);
        }
    },
    'triggerPhotoUpload': LogActions.triggerPhotoUpload,
    'savePhotos': LogActions.handleSavePhotos,
    'closePhotoModal': LogActions.closePhotoModal,
    'filterLogsByWorkType': (target) => LogActions.filterLogsByWorkType(target.value),

    // Schedule Actions
    'handleSaveSchedule': ScheduleActions.handleSaveSchedule,
    'handleAddTask': ScheduleActions.handleAddTask,
    'enableSaveButton': ScheduleActions.enableSaveButton,

    // Other Actions
    'add-recipient': (target) => addRecipient(target.dataset.name),
};

/**
 * 統一的動作處理入口函式
 * @param {string} action - 從 data-action 屬性讀取到的動作名稱
 * @param {HTMLElement} target - 觸發事件的 DOM 元素
 */
export function handleAction(action, target) {
    const handler = ACTION_HANDLERS[action];
    if (typeof handler === 'function') {
        handler(target);
    }
}
