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
 * 儲存文字變更
 * @param {string} logId - 日誌 ID
 * @param {string} newText - 新的文字內容
 * @param {Array<Node>} originalButtons - 原始按鈕，用於取消時還原
 */
export function saveText(logId, newText, originalButtons) {
    const params = new URLSearchParams({ page: 'updateLogText', id: logId, content: newText });
    return loadJsonp(`${API_BASE_URL}?${params.toString()}`);
}

/**
 * 儲存照片變更
 * @param {string} logId - 日誌 ID
 * @param {string} keepCsv - 保留的照片連結
 * @param {Array<string>} uploads - 新上傳的 Base64 照片陣列
 */
export function savePhotos(logId, keepCsv, uploads) {
    const btn = document.getElementById('save-photos-button');
    // 這段邏輯比較特殊，回傳 Promise
    return new Promise((resolve, reject) => {
        if (window.google && google.script && google.script.run) {
            google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).updateLogPhotosWithUploads(logId, keepCsv, uploads);
        } else {
            const payload = encodeURIComponent(JSON.stringify({ id: logId, keep: keepCsv, uploads }));
            loadJsonp(`${API_BASE_URL}?page=updatePhotosCompat&payload=${payload}`).then(resolve).catch(reject);
        }
    });
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

    // 【⭐️ 核心修正：統一為標準表單提交模式 ⭐️】
    const formData = new URLSearchParams();
    formData.append('payload', JSON.stringify(payload));

    return fetch(API_BASE_URL, { // 【⭐️ 核心修改 ⭐️】移除 URL 中的 ?page=project
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        mode: 'no-cors'
    });
}