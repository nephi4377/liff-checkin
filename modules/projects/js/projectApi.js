/*
* =============================================================================
* 檔案名稱: projectApi.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 統一的 API 客戶端模組。所有前端元件都應透過此模組與後端溝通。
* =============================================================================
*/

// [v520.0 修正] 修正導入路徑，直接從根目錄的 api.js 引入，避免循環依賴。
import { postTask } from '../../../api.js';

// 定義哪些 action 是讀取型 (用 GET)，哪些是寫入型 (用 POST + 任務佇列)
// 注意：這裡的 action 名稱必須與後端 WebApp.js 中的 GET_ROUTES 和 processJob 的 switch case 完全對應。
const READ_ACTIONS = new Set([
    'project', // 獲取專案所有資料
    'getSingleLog'
]);

const WRITE_ACTIONS = new Set([
    'createLog',
    'updateLogText',
    'updateLogPhotosWithUploads',
    'deleteLog',
    'updateProjectStatus',
    'createFromTemplate',
    'updateSchedule'
]);

/**
 * 統一的 API 請求函式，作為所有後端請求的唯一入口。
 * @param {object} options - 請求選項
 * @param {string} options.action - 後端要執行的動作 (對應後端的 'page' 或 'action' 參數)。
 * @param {object} [options.payload={}] - 要傳遞的資料。
 * @returns {Promise<{success: boolean, data: any, message: string, error: string | null}>}
 */
export async function request({ action, payload = {} }) {
    try {
        let result;

        if (READ_ACTIONS.has(action)) {
            // --- 處理讀取型請求 (GET) ---
            const url = new URL(window.API_BASE_URL);
            // 根據後端 doGet 路由表，讀取型 action 放在 'page' 參數中
            url.searchParams.append('page', action);
            // [v318.0 核心修正] 將 payload 中的所有參數正確附加到 URL 上。
            for (const key in payload) {
                url.searchParams.append(key, payload[key]);
            }
            // [v318.0 API化] 改為使用標準 fetch API，不再使用 loadJsonp
            const response = await fetch(url.toString());
            result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

        } else if (WRITE_ACTIONS.has(action)) {
            // --- 處理寫入型請求 (POST + 非同步任務) ---
            const taskPayload = { ...payload, action }; // 將 action 合併到 payload
            const finalJobState = await postTask(taskPayload);

            if (finalJobState.status === 'completed' && finalJobState.result.success) {
                result = finalJobState.result; // result 的格式應為 { success: true, data: ..., message: ... }
            } else {
                throw new Error(finalJobState.result?.message || `後端任務執行失敗，狀態: ${finalJobState.status}`);
            }

        } else {
            throw new Error(`未知的 API 動作: ${action}`);
        }

        // 統一成功的回應格式
        return {
            success: true,
            // [v322.0 核心修正] 強化資料提取邏輯，以應對後端不同的回傳格式
            // 1. 如果 result 本身就有 data 或 newLogData，就使用它們。
            // 2. 如果 result.success 為 true，但沒有 data/newLogData (例如 project 路由)，則將整個 result 作為 data。
            // 3. 否則回傳 null。
            data: result.data || result.newLogData || (result.success ? result : null),
            message: result.message || '操作成功',
            error: null
        };

    } catch (error) {
        // 統一失敗的回應格式
        console.error(`[API Client] Action '${action}' 失敗:`, error);
        return {
            success: false,
            data: null,
            message: error.message,
            error: error.message
        };
    }
}