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
 * [核心] 透過隱藏的 iframe 和 form 提交 POST 請求至 Google Apps Script。
 * 這是解決跨來源 no-cors 限制下，仍需接收後端 postMessage 回應的標準作法。
 * @param {object} payload - 要傳送給後端的資料包，必須包含 action。
 * @returns {void} 此函式不直接回傳 Promise，後端結果由全域的 'message' 事件監聽器處理。
 */
export function postToGas(payload) {
  // 移除任何前一次操作可能殘留的 iframe 和 form
  const oldIframe = document.getElementById('gas-comm-iframe');
  if (oldIframe) oldIframe.remove();
  const oldForm = document.getElementById('gas-comm-form');
  if (oldForm) oldForm.remove();

  // 建立一個隱藏的 iframe 作為表單提交的目標
  const iframe = document.createElement('iframe');
  iframe.id = 'gas-comm-iframe';
  iframe.name = 'gas-comm-iframe'; // form 的 target 需要這個 name
  iframe.style.display = 'none';
  // [核心修正 v2.0] 設定 iframe 的沙箱 (sandbox) 屬性。
  // - "allow-scripts": 允許 iframe 執行腳本 (我們的 postMessage 腳本)。
  // - "allow-forms": 允許 iframe 作為表單提交的目標。
  // - [移除] "allow-popups": 嘗試移除此權限，看是否能解決 'dropping postMessage' 問題。
  //   如果移除後 'wardeninit' 的 CORS 錯誤依然存在，則可能需要重新評估。
  // [重要] 移除了 "allow-same-origin"，因為它與 "allow-scripts" 一起使用會導致沙箱逃逸，
  // 從而被父視窗的安全策略攔截 postMessage。postMessage 機制本身不需要同源權限。
  iframe.sandbox = 'allow-scripts allow-forms';
  document.body.appendChild(iframe);

  // 建立一個表單
  const form = document.createElement('form');
  form.id = 'gas-comm-form';
  form.target = iframe.name; // 指向我們建立的 iframe
  form.method = 'POST';
  form.action = API_BASE_URL; // 後端 Web App 的 URL

  // 建立一個隱藏的 input 欄位來存放我們的 payload
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'payload'; // 後端會從 e.parameter.payload 接收
  input.value = JSON.stringify(payload);
  form.appendChild(input);

  document.body.appendChild(form);
  // [核心修正] 恢復為直接提交表單的模式。
  // 這是最直接且可靠的方式。當表單提交時，瀏覽器會自動處理目標 iframe 的載入流程，
  // 將後端的回應內容載入到 iframe 中，從而觸發 postMessage 腳本。
  // 這避免了手動管理 onload 事件可能引發的競爭條件問題。
  form.submit();
}

/**
 * 儲存文字變更
 * @param {string} logId - 日誌 ID
 * @param {string} newText - 新的文字內容
 * @param {Array<Node>} originalButtons - 原始按鈕，用於取消時還原
 */
export function saveText(logId, newText, originalButtons) {
    // 【⭐️ 核心修正：改用 iframe 提交模式，與其他 POST 請求保持一致 ⭐️】
    const payload = {
        action: 'updateLogText',
        id: logId,
        content: newText
    };
    // 此函式不直接回傳 Promise，後端結果由全域的 'message' 事件監聽器處理
    postToGas(payload);
}

/**
 * 儲存照片變更
 * @param {string} logId - 日誌 ID
 * @param {string} keepCsv - 保留的照片連結
 * @param {Array<string>} uploads - 新上傳的 Base64 照片陣列
 */
export function savePhotos(logId, keepCsv, uploads) {
    // 【⭐️ 核心修正：改用 iframe 提交模式，與其他 POST 請求保持一致 ⭐️】
    const payload = {
        action: 'updateLogPhotosWithUploads',
        logId: logId,
        existingLinksCsv: keepCsv,
        newPhotosBase64Array: uploads
    };
    // 此函式不直接回傳 Promise，後端結果由全域的 'message' 事件監聽器處理
    postToGas(payload);
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

    // 【⭐️ 核心修正：改用 iframe 提交模式 ⭐️】
    postToGas(payload);
}