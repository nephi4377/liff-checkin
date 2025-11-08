/*
* =============================================================================
* 檔案名稱: api.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 集中管理所有與後端 (Google Apps Script) 的通訊。
* =============================================================================
*/

import { state } from './state.js'; // [v389.0 修正] 引入共用 state 模組

// [核心修正] 讓 api 模組直接從全域 window 物件讀取 API 網址。
// 這確保了無論哪個模組呼叫 api.js 中的函式，都能使用到正確的後端網址。
const API_BASE_URL = window.API_BASE_URL;

/**
 * 透過 JSONP 方式從後端載入資料
 * @param {string} url - 請求的 API 網址
 * @returns {Promise<any>}
 */
export function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'jsonp_' + Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { cleanup(); reject(new Error('請求後端資料超時 (30秒)。')); }, 30000); // 超時時間延長至 30 秒
    function cleanup() { clearTimeout(timer); delete window[cb]; if (script.parentNode) script.parentNode.removeChild(script); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb; // 確保 URL 包含 callback 參數
    script.onerror = () => { cleanup(); reject(new Error(`載入後端資料失敗。請求 URL: ${script.src}`)); }; // 顯示失敗的 URL
    document.body.appendChild(script);
  });
}

/**
 * [架構重構 v5.0] 統一的非同步任務處理器。
 * 此函式會自動判斷 payload 中是否包含大型資料 (newPhotosBase64Array)，
 * 並智慧地選擇簡單提交或分塊上傳流程。
 * @param {object} payload - 包含 action 和其他資料的物件
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
export async function postTask(payload) {
    // 檢查 payload 中是否包含需要上傳的檔案陣列
    const uploadData = payload.newPhotosBase64Array;
    const hasUpload = Array.isArray(uploadData) && uploadData.length > 0;

    // 步驟 1：初始化任務，並取得 Job ID
    const jobId = await _initiateTask(payload, hasUpload);
    console.log(`[API] 成功建立後端任務，Job ID: ${jobId}`);

    // 步驟 2：如果有檔案，則執行分塊上傳
    if (hasUpload) {
        await _uploadChunks(jobId, uploadData);
    }

    // 步驟 3：統一輪詢任務的最終結果
    console.log(`[API] 開始輪詢 Job ID: ${jobId} 的最終結果...`);
    return await pollJobStatus(jobId);
}

/**
 * [內部函式] 步驟 1：向後端初始化一個任務，並回傳 jobId。
 * @param {object} payload - 完整的請求 payload。
 * @param {boolean} hasUpload - 是否為上傳任務。
 * @returns {Promise<string>} - 回傳從後端取得的 jobId。
 */
async function _initiateTask(payload, hasUpload) {
    let initialPayload;

    if (hasUpload) {
        // [架構重構 v8.0] 徹底封裝複雜性。
        // _initiateTask 的職責就是根據原始 payload，產生一個正確的「任務宣告」封包。
        const metaPayload = { ...payload };
        delete metaPayload.newPhotosBase64Array;

        // 建立一個扁平化的「宣告任務」封包
        initialPayload = {
            ...metaPayload, // 將所有元資料（如 projectId, content）展開到第一層
            action: 'createUploadJob', // 程序性指令：告訴後端「這是一個上傳任務的宣告」
            originalAction: payload.action, // 業務邏輯指令：告訴後端，上傳完畢後，真正要執行的指令是什麼
            totalChunks: Math.ceil((payload.newPhotosBase64Array.length || 1) / 10) || 1,
            totalPhotos: payload.newPhotosBase64Array.length // [v315.0 新增] 告訴後端總共有幾張照片
        };
        console.log('[CONSOLE] 任務宣告 (initialPayload):', initialPayload); // [v330.0 偵錯]
    } else {
        // 對於簡單任務，直接使用原始 payload
        initialPayload = payload;
    }

    const initialResult = await postToGas(initialPayload);
    if (!initialResult.success || !initialResult.jobId) {
        throw new Error(initialResult.message || '後端未能成功建立任務。');
    }
    return initialResult.jobId;
}

/**
 * [內部函式] 步驟 2：處理檔案的壓縮與分塊上傳。
 * @param {string} jobId - 任務 ID。
 * @param {Array<string>} largeDataArray - 包含 Base64 圖片的陣列。
 */
async function _uploadChunks(jobId, largeDataArray) {
    const compressedDataArray = await Promise.all(largeDataArray.map(base64 => compressImage_(base64)));
    const SUBMIT_CHUNK_SIZE = 10;
    const totalChunks = Math.ceil(compressedDataArray.length / SUBMIT_CHUNK_SIZE) || 1;

    for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * SUBMIT_CHUNK_SIZE;
        const chunkEnd = chunkStart + SUBMIT_CHUNK_SIZE;
        const chunkData = { data: compressedDataArray.slice(chunkStart, chunkEnd) };
        
        const chunkPayload = { action: 'uploadJobDataChunk', jobId, chunkIndex: i + 1, totalChunks, chunkData };
        await postToGas(chunkPayload); // 發後不理，不關心單一 chunk 的回傳
        console.log(`[API] 已上傳資料塊 ${i + 1}/${totalChunks} 至 Job ID: ${jobId}`);
    }
}

/**
 * [核心] 透過 fetch API 提交 POST 請求至 Google Apps Script。
 * 此函式會將 payload 包裝在 FormData 中，以解決跨來源請求問題。
 * 它會觸發後端的非同步任務佇列，並立即回傳一個包含 jobId 的 Promise。
 * @param {object} payload - 要傳送給後端的資料包，必須包含 action。
 * @returns {Promise<object>} 一個解析為後端初步回應 (包含 jobId) 的 Promise。
 */
export function postToGas(payload) {
    // 【⭐️ 核心新增：增加除錯日誌 ⭐️】
    // 在每次發送請求時，於主控台印出 payload 內容，方便開發階段除錯。
    console.log('[API Request] 準備發送至後端:', payload);
    const formData = new FormData();
    formData.append('payload', JSON.stringify(payload));

    const promise = fetch(API_BASE_URL, {
        method: 'POST',
        body: formData
    }).then(response => response.json());
    // [核心修正] 補上 return 語句，確保 Promise 被正確回傳
    return promise;
}

/**
 * [新增] 圖片壓縮輔助函式 (從 handlers.js 移入)
 * @param {string} base64Str - 包含 data URI 前綴的 Base64 字串
 * @param {number} quality - 壓縮品質 (0 到 1)
 * @returns {Promise<string>} - 回傳壓縮後的 Base64 字串 (包含 data URI 前綴)
 */
function compressImage_(base64Str, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1920; // 設定最大寬度
      
      // 如果圖片寬度大於最大寬度，則進行縮放
      if (img.width > MAX_WIDTH) {
        const scaleRatio = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleRatio;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // 將 canvas 內容轉換為 JPEG 格式的 Base64
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = error => reject(error);
  });
}

/**
 * [新增] 輪詢任務狀態
 * @param {string} jobId - 要查詢的任務 ID
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
function pollJobStatus(jobId) {
    // [架構重構 v6.0] 重構為基於 setTimeout 的遞迴模式，以增強網路容錯能力。
    const POLLING_INTERVAL_MS = 3000; // [v325.0] 延長輪詢間隔為 3 秒
    const TOTAL_TIMEOUT_MS = 180000; // [v325.0] 根據您的要求，將總超時時間延長至 180 秒 (3分鐘)，以應對多張照片處理

    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const poll = async () => {
            // 檢查是否已超過總超時時間
            if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
                reject(new Error(`任務處理超時 (${TOTAL_TIMEOUT_MS / 1000}秒)，請稍後刷新頁面查看結果。`));
                return; // 終止輪詢
            }

            try {
                // [v318.0 API化] 輪詢狀態的 API 現在回傳標準 JSON，應改用 fetch 處理。
                // 這解決了 "Unexpected token '('" 的錯誤。
                const url = new URL(API_BASE_URL);
                url.searchParams.append('page', 'getJobStatus');
                url.searchParams.append('jobId', jobId);
                url.searchParams.append('userId', state.currentUserId); // [v389.0 修正] 改為從 state 模組讀取 userId
                const response = await fetch(url);
                const statusResult = await response.json();

                // 檢查後端回傳的任務狀態
                if (statusResult.status === 'completed' || statusResult.status === 'failed') {
                    console.log(`[API] 任務 ${jobId} 已完成，狀態: ${statusResult.status}`);
                    resolve(statusResult); // 成功取得最終結果，結束輪詢
                } else {
                    // 任務仍在處理中，安排下一次輪詢
                    setTimeout(poll, POLLING_INTERVAL_MS);
                }
            } catch (error) {
                // 捕獲單次的網路錯誤 (例如 loadJsonp 超時或失敗)
                console.warn(`[API] 輪詢 Job ID ${jobId} 時發生網路錯誤: ${error.message}。將在 ${POLLING_INTERVAL_MS}ms 後重試...`);
                // 不立即 reject，而是安排下一次輪詢，給予網路恢復的機會
                setTimeout(poll, POLLING_INTERVAL_MS);
            }
        };

        poll(); // 立即開始第一次輪詢
    });
}

// [v244.0 新增] 獲取單個使用者 Profile 的 API 呼叫
// [v250.0 修正] 將此函式移至 api.js 並匯出，解決 main.js 中的 ReferenceError
export async function getUserProfile(userId) {
  try {
    const url = `${API_BASE_URL}?page=get_user_profile&userId=${encodeURIComponent(userId)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error(`[API] 獲取使用者 Profile 失敗 (${userId}):`, error);
    return null;
  }
}