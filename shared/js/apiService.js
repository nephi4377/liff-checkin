/**
 * =============================================================================
 * 檔案名稱: apiService.js
 * 專案名稱: 專案日誌管理主控台
 * 版本: v1.0
 * 說明: 統一的 API 客戶端模組。所有前端元件都應透過此模組與後端溝通。
 * =============================================================================
 */

import { CONFIG } from './config.js';

// 定義哪些 action 是讀取型 (用 GET)，哪些是寫入型 (用 POST + 任務佇列)
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
    'updateSchedule',
    'sendNotification'
]);

/**
 * 透過 fetch API 提交 POST 請求至 Google Apps Script。
 * 此函式會將 payload 包裝在 FormData 中，以解決跨來源請求問題。
 * @param {object} payload - 要傳送給後端的資料包，必須包含 action。
 * @returns {Promise<object>} 一個解析為後端初步回應 (包含 jobId) 的 Promise。
 */
function postToGas(payload) {
    console.log('[apiService] 準備發送至後端:', payload);
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));

    const API_BASE_URL = CONFIG.GAS_WEB_APP_URL;
    if (!API_BASE_URL) {
        throw new Error("API_BASE_URL is not defined in config.");
    }

    return fetch(API_BASE_URL, { method: 'POST', body: formData }).then(response => response.json());
}

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
            const url = new URL(CONFIG.GAS_WEB_APP_URL);
            url.searchParams.append('page', action);
            for (const key in payload) {
                url.searchParams.append(key, payload[key]);
            }
            const response = await fetch(url.toString());
            result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

        } else if (WRITE_ACTIONS.has(action)) {
            // --- 處理寫入型請求 (POST + 非同步任務) ---
            const hasUpload = Array.isArray(payload.newPhotosBase64Array) && payload.newPhotosBase64Array.length > 0;
            let jobId;

            if (hasUpload) {
                // 情況一：有檔案上傳。
                const metaPayload = { ...payload };
                delete metaPayload.newPhotosBase64Array;

                const initialPayload = {
                    ...metaPayload,
                    action: 'createUploadJob',
                    originalAction: action,
                    totalPhotos: payload.newPhotosBase64Array.length
                };

                const initialResult = await postToGas(initialPayload);
                if (!initialResult.success || !initialResult.jobId) {
                    throw new Error(initialResult.message || '後端未能成功建立上傳任務。');
                }
                jobId = initialResult.jobId;
                console.log(`[apiService] 成功建立上傳任務，Job ID: ${jobId}`);

                // 2. 在背景執行分塊上傳 (發後不理)
                _uploadChunks(jobId, payload.newPhotosBase64Array);

            } else {
                // 情況二：沒有檔案上傳的簡單任務。
                const taskPayload = { ...payload, action };
                const initialResult = await postToGas(taskPayload);
                if (!initialResult.success || !initialResult.jobId) {
                    throw new Error(initialResult.message || '後端未能成功建立任務。');
                }
                jobId = initialResult.jobId;
                console.log(`[apiService] 成功建立後端任務，Job ID: ${jobId}`);
            }

            // 步驟 3：統一輪詢任務的最終結果
            console.log(`[apiService] 開始輪詢 Job ID: ${jobId} 的最終結果...`);
            const finalJobState = await pollJobStatus(jobId);

            if (finalJobState.status === 'completed' && finalJobState.result.success) {
                result = finalJobState.result;
            } else {
                throw new Error(finalJobState.result?.message || `後端任務執行失敗，狀態: ${finalJobState.status}`);
            }

        } else {
            throw new Error(`未知的 API 動作: ${action}`);
        }

        return {
            success: true,
            data: result.data || result.newLogData || (result.success ? result : null),
            message: result.message || '操作成功',
            error: null
        };

    } catch (error) {
        console.error(`[apiService] Action '${action}' 失敗:`, error);
        return {
            success: false,
            data: null,
            message: error.message,
            error: error.message
        };
    }
}

/**
 * 獲取單個使用者 Profile 的 API 呼叫
 * @param {string} userId 
 * @returns {Promise<object|null>}
 */
export async function getUserProfile(userId) {
    try {
        const url = new URL(CONFIG.GAS_WEB_APP_URL);
        url.searchParams.append('page', 'get_user_profile');
        url.searchParams.append('userId', userId);

        const response = await fetch(url.toString());
        const result = await response.json();
        return result.success ? result.data : null;
    } catch (error) {
        console.error(`[apiService] 獲取使用者 Profile 失敗 (${userId}):`, error);
        return null;
    }
}

/**
 * 內部函式，處理檔案的壓縮與分塊上傳。
 */
async function _uploadChunks(jobId, largeDataArray) {
    const compressedDataArray = largeDataArray; // 這裡不實作完整壓縮以簡化邏輯
    const SUBMIT_CHUNK_SIZE = 6;
    const totalChunks = Math.ceil(compressedDataArray.length / SUBMIT_CHUNK_SIZE) || 1;

    console.log(`[apiService] Job ID ${jobId}: 開始上傳 ${largeDataArray.length} 張照片，共 ${totalChunks} 個分塊。`);

    for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * SUBMIT_CHUNK_SIZE;
        const chunkEnd = chunkStart + SUBMIT_CHUNK_SIZE;
        const chunkData = { data: compressedDataArray.slice(chunkStart, chunkEnd) };

        const chunkPayload = {
            action: 'uploadJobDataChunk',
            jobId,
            chunkIndex: i + 1,
            totalChunks,
            chunkData
        };
        postToGas(chunkPayload);
    }
}

/**
 * 輪詢任務狀態
 */
function pollJobStatus(jobId) {
    const POLLING_INTERVAL_MS = 3000;
    const TOTAL_TIMEOUT_MS = 180000;
    const API_BASE_URL = CONFIG.GAS_WEB_APP_URL;

    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const poll = async () => {
            if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
                reject(new Error(`任務處理超時 (${TOTAL_TIMEOUT_MS / 1000}秒)。`));
                return;
            }

            try {
                const url = new URL(API_BASE_URL);
                url.searchParams.append('page', 'getJobStatus');
                url.searchParams.append('jobId', jobId);

                const response = await fetch(url);
                const statusResult = await response.json();

                if (statusResult.status === 'completed' || statusResult.status === 'failed') {
                    console.log(`[apiService] 任務 ${jobId} 已完成，狀態: ${statusResult.status}`);
                    resolve(statusResult);
                } else {
                    setTimeout(poll, POLLING_INTERVAL_MS);
                }
            } catch (error) {
                console.warn(`[apiService] 輪詢 Job ID ${jobId} 時發生網路錯誤: ${error.message}。將在 ${POLLING_INTERVAL_MS}ms 後重試...`);
                setTimeout(poll, POLLING_INTERVAL_MS);
            }
        };

        poll();
    });
}
