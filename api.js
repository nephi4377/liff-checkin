/*
* =============================================================================
* 檔案名稱: api.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 集中管理所有與後端 (Google Apps Script) 的通訊。
* =============================================================================
*/

/**
 * 透過 JSONP 方式從後端載入資料
 * @param {string} url - 請求的 API 網址
 * @returns {Promise<any>}
 */
export function loadJsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'jsonp_' + Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { cleanup(); reject(new Error('請求後端資料超時 (15秒)。')); }, 15000);
    function cleanup() { clearTimeout(timer); delete window[cb]; if (script.parentNode) script.parentNode.removeChild(script); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    script.onerror = () => { cleanup(); reject(new Error('載入後端資料失敗。')); };
    document.body.appendChild(script);
  });
}

/**
 * [新增] 處理簡單的非同步任務 (無檔案上傳)
 * @param {object} payload - 包含 action 和其他資料的物件
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
export async function postAsyncTask(payload) {
    // 1. 立即提交任務
    const initialResult = await postToGas(payload);
    if (!initialResult.success || !initialResult.jobId) {
        throw new Error('無法建立後端任務。');
    }
    const { jobId } = initialResult;
    console.log(`[API] 成功建立後端任務，Job ID: ${jobId}`);

    // 2. 開始輪詢任務狀態
    console.log(`[API] 開始輪詢 Job ID: ${jobId} 的最終結果...`);
    const finalResult = await pollJobStatus(jobId);

    // 3. 回傳最終結果
    return finalResult;
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
 * [新增] 處理需要大型資料上傳的非同步任務
 * @param {object} metaPayload - 包含任務元資料的物件 (不含大型資料)
 * @param {Array} largeDataArray - 包含大型資料的完整陣列 (例如，完整的照片陣列)
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
export async function postAsyncTaskWithUpload(metaPayload, largeDataArray) {
    // [V17.0 核心功能] 在上傳前，先對所有圖片進行壓縮
    console.log(`[API] 準備壓縮 ${largeDataArray.length} 張圖片...`);
    const compressedDataArray = await Promise.all(largeDataArray.map(base64 => compressImage_(base64)));
    console.log(`[API] 圖片壓縮完成。`);

    // [V3.0 職責轉移] 將分塊邏輯封裝在此函式內部
    const SUBMIT_CHUNK_SIZE = 10; // 每批次上傳10張照片
    const totalChunks = Math.ceil(compressedDataArray.length / SUBMIT_CHUNK_SIZE) || 1;

    const dataChunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * SUBMIT_CHUNK_SIZE;
        const chunkEnd = chunkStart + SUBMIT_CHUNK_SIZE;
        // [V3.0 統一結構] 將分塊後的資料包裝在一個通用的 `data` 屬性中
        dataChunks.push({ data: compressedDataArray.slice(chunkStart, chunkEnd) });
    }

    // 1. 宣告任務，取得 jobId
    const createJobPayload = {
        action: 'createUploadJob',
        originalAction: metaPayload.action,
        meta: { ...metaPayload, totalChunks: totalChunks }
    };
    const initialResult = await postToGas(createJobPayload);
    if (!initialResult.success || !initialResult.jobId) {
        throw new Error(initialResult.message || '後端未能成功建立上傳任務。');
    }
    const { jobId } = initialResult;
    console.log(`[API] 上傳任務已建立，Job ID: ${jobId}`);

    // 2. 在背景逐一上傳資料塊
    for (let i = 0; i < dataChunks.length; i++) {
        const chunkPayload = {
            action: 'uploadJobDataChunk',
            jobId: jobId,
            chunkIndex: i + 1,
            totalChunks: dataChunks.length,
            chunkData: dataChunks[i]
        };
        await postToGas(chunkPayload); // 發後不理，不關心單一 chunk 的回傳
        console.log(`[API] 已上傳資料塊 ${i + 1}/${dataChunks.length}`);
    }

    // 3. 所有資料上傳完畢後，開始輪詢最終結果
    return pollJobStatus(jobId);
}

/**
 * [新增] 輪詢任務狀態
 * @param {string} jobId - 要查詢的任務 ID
 * @returns {Promise<object>} 當任務完成或失敗時，解析為最終的結果物件。
 */
function pollJobStatus(jobId) {
    const MAX_ATTEMPTS = 30; // 最多輪詢 30 次 (約 60 秒)
    const INTERVAL_MS = 2000; // 每 2 秒輪詢一次
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            attempts++;
            if (attempts > MAX_ATTEMPTS) {
                clearInterval(intervalId);
                reject(new Error('任務處理超時，請稍後刷新頁面查看結果。'));
                return;
            }

            try {
                const url = `${API_BASE_URL}?page=getJobStatus&jobId=${jobId}`;
                const statusResult = await loadJsonp(url);

                if (statusResult.status === 'completed' || statusResult.status === 'failed') {
                    clearInterval(intervalId);
                    console.log(`[API] 任務 ${jobId} 已完成，狀態: ${statusResult.status}`);
                    resolve(statusResult);
                }
            } catch (error) {
                clearInterval(intervalId);
                reject(new Error(`輪詢任務狀態時發生網路錯誤: ${error.message}`));
            }
        }, INTERVAL_MS);
    });
}

/**
 * 儲存文字變更
 * @param {string} logId - 日誌 ID
 * @param {string} newText - 新的文字內容
 * @param {Array<Node>} originalButtons - 原始按鈕，用於取消時還原
 */
export function saveText(logId, newText, originalButtons) {
    const payload = {
        action: 'updateLogText',
        id: logId,
        content: newText
    };
    // 呼叫 postToGas 會觸發非同步任務，並回傳一個包含 jobId 的 Promise
    return postToGas(payload);
}

/**
 * 儲存照片變更
 * @param {string} logId - 日誌 ID
 * @param {string} keepCsv - 保留的照片連結
 * @param {Array<string>} uploads - 新上傳的 Base64 照片陣列
 * @param {string} deleteCsv - 要刪除的照片連結
 */
export function savePhotos(logId, keepCsv, uploads, deleteCsv) {
    const payload = {
        action: 'updateLogPhotosWithUploads',
        logId: logId,
        existingLinksCsv: keepCsv,
        newPhotosBase64Array: uploads,
        deleteLinksCsv: deleteCsv
    };
    return postToGas(payload);
}

/**
 * 發布日誌
 * @param {string} logId - 日誌 ID
 */
export function publishLog(logId) {
    const payload = {
        action: 'publish',
        logId: logId,
        newStatus: '已發布'
    };

    return postToGas(payload);
}

/**
 * [新增] 刪除日誌
 * @param {string} logId - 日誌 ID
 */
export function deleteLog(logId) {
    const payload = {
        action: 'deleteLog',
        id: logId
    };
    // 使用 POST 請求來執行刪除操作
    return postToGas(payload);
}