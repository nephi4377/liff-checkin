/*
* =============================================================================
* 檔案名稱: projectApi.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 統一的 API 客戶端模組。所有前端元件都應透過此模組與後端溝通。
* =============================================================================
*/ // [v602.0 重構] 引入統一設定檔
import { CONFIG } from '/shared/js/config.js';

// [v520.0 修正] 修正導入路徑，直接從根目錄的 api.js 引入，避免循環依賴。
// [v555.0 重構] 移除對外部 api.js 的依賴，將 postTask 邏輯內化，解決 API_BASE_URL 為 undefined 的問題。
// import { postTask } from '../../../api.js';

/**
 * [v555.0 內化] 透過 fetch API 提交 POST 請求至 Google Apps Script。
 * 此函式會將 payload 包裝在 FormData 中，以解決跨來源請求問題。
 * @param {object} payload - 要傳送給後端的資料包，必須包含 action。
 * @returns {Promise<object>} 一個解析為後端初步回應 (包含 jobId) 的 Promise。
 */
function postToGas(payload) {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));
 
    // [v602.0 重構] 直接從 config.js 讀取 URL，不再依賴 window 物件
    const API_BASE_URL = CONFIG.GAS_WEB_APP_URL;
 
    return fetch(API_BASE_URL, { method: 'POST', body: formData }).then(response => response.json());
}
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
    'updateSchedule',
    'sendNotification', // [v553.0] 將發送通知也納入非同步任務佇列
    'process_notification_action' // [v601.1] 新增：處理溝通紀錄的互動 (回覆/完成/封存)
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
            const url = new URL(CONFIG.GAS_WEB_APP_URL);
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
            // [v561.0 核心修正] 重新引入智慧判斷邏輯，解決 '引數過大' 的問題。
            // [v606.0 核心修正] 必須在前端就判斷是否包含大型檔案，並選擇不同的後端 API 入口點。
            // 同時檢查新的 'photos' 屬性 (來自建立日誌) 和舊的 'newPhotosBase64Array' 屬性 (來自編輯照片)，以確保相容性。
            const photosToUpload = payload.photos || payload.newPhotosBase64Array;
            const hasUpload = Array.isArray(photosToUpload) && photosToUpload.length > 0;
            let jobId;

            if (hasUpload) {
                // 情況一：有檔案上傳。
                // 1. 先發送一個不含照片的「任務宣告」請求。
                const metaPayload = { ...payload };
                delete metaPayload.photos; // [v606.0] 移除 photos 屬性
                delete metaPayload.newPhotosBase64Array; // [v606.0] 移除舊的屬性

                const initialPayload = {
                    ...metaPayload,
                    action: 'createUploadJob', // 強制 action 為 createUploadJob
                    originalAction: action,    // 將原始 action (如 createLog) 附帶過去
                    totalPhotos: photosToUpload.length // [v606.0] 使用新的變數
                };

                const initialResult = await postToGas(initialPayload);
                if (!initialResult.success || !initialResult.jobId) {
                    throw new Error(initialResult.message || '後端未能成功建立上傳任務。');
                }
                jobId = initialResult.jobId;
                console.log(`[projectApi] 成功建立上傳任務，Job ID: ${jobId}`);

                // 2. 在背景執行分塊上傳 (發後不理)
                _uploadChunks(jobId, photosToUpload); // [v606.0] 使用新的變數

            } else {
                // 情況二：沒有檔案上傳的簡單任務。
                const taskPayload = { ...payload, action };
                const initialResult = await postToGas(taskPayload);
                if (!initialResult.success || !initialResult.jobId) {
                    throw new Error(initialResult.message || '後端未能成功建立任務。');
                }
                jobId = initialResult.jobId;
                console.log(`[projectApi] 成功建立後端任務，Job ID: ${jobId}`);
            }

            // 步驟 3：統一輪詢任務的最終結果
            console.log(`[projectApi] 開始輪詢 Job ID: ${jobId} 的最終結果...`);
            const finalJobState = await pollJobStatus(jobId);

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

/**
 * [v561.0 新增] 內部函式，處理檔案的壓縮與分塊上傳。
 * @param {string} jobId - 任務 ID。
 * @param {Array<string>} largeDataArray - 包含 Base64 圖片的陣列。
 */
async function _uploadChunks(jobId, largeDataArray) {
    // 簡易壓縮，這裡不實作完整壓縮以簡化邏輯
    const compressedDataArray = largeDataArray; // 在實際應用中應加入壓縮邏輯
    const SUBMIT_CHUNK_SIZE = 6; // 每 10 張照片一個 chunk
    const totalChunks = Math.ceil(compressedDataArray.length / SUBMIT_CHUNK_SIZE) || 1;

    console.log(`[projectApi] Job ID ${jobId}: 開始上傳 ${largeDataArray.length} 張照片，共 ${totalChunks} 個分塊。`);

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
        postToGas(chunkPayload); // 發後不理，不關心單一 chunk 的回傳
    }
}

/**
 * [v555.0 內化] 輪詢任務狀態
 * @param {string} jobId - 要查詢的任務 ID
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
function pollJobStatus(jobId) {
    const POLLING_INTERVAL_MS = 3000;
    const TOTAL_TIMEOUT_MS = 180000;
    // [v602.0 重構] 直接從 config.js 讀取 URL
    const API_BASE_URL = CONFIG.GAS_WEB_APP_URL;

    if (!API_BASE_URL) {
        return Promise.reject(new Error("輪詢失敗：找不到 API_BASE_URL。"));
    }
   // 回傳一個 Promise，讓上層程式碼可以 await 它的最終結果
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        // 定義一個會自我重複呼叫的內部函式
        const poll = async () => {
            // 檢查是否超過總等待時間
            if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
                reject(new Error(`任務處理超時 (${TOTAL_TIMEOUT_MS / 1000}秒)。`));
                return;
            }

            try {
                // 1. 組合查詢用的 URL
                const url = new URL(API_BASE_URL);
                url.searchParams.append('page', 'getJobStatus');
                url.searchParams.append('jobId', jobId);
                
                // 2. 發送 GET 請求到後端
                // [v630.0 穩健性修正] 根據您的建議，明確指定 method 為 'GET'，使程式碼意圖更清晰，避免潛在問題。
                const response = await fetch(url, {
                    method: 'GET'
                });
                const statusResult = await response.json();

                // 4. 判斷任務狀態
                if (statusResult.status === 'completed' || statusResult.status === 'failed') {
                    // 如果任務已結束 (成功或失敗)，就結束輪詢                    
                    console.log(`[projectApi] 任務 ${jobId} 已完成，狀態: ${statusResult.status}`);
                    resolve(statusResult);
                } else {
                    // 如果任務還在進行中，就安排下一次查詢
                    setTimeout(poll, POLLING_INTERVAL_MS);
                }
            } catch (error) {
                // 如果單次查詢失敗 (例如網路不穩)，會在 console 顯示警告，並繼續嘗試下一次輪詢
                console.warn(`[projectApi] 輪詢 Job ID ${jobId} 時發生網路錯誤: ${error.message}。將在 ${POLLING_INTERVAL_MS}ms 後重試...`);
                setTimeout(poll, POLLING_INTERVAL_MS);
            }
        };

        poll(); // 啟動第一次輪詢
    });
}