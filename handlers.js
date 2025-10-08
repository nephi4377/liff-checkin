/*
* =============================================================================
* 檔案名稱: handlers.js
* 專案名稱: 專案日誌管理主控台
* 版本: v2.0 (重構版)
* 說明: 專門處理「建立新日誌」的相關邏輯。
* =============================================================================
*/

import { state } from './state.js';
import { logToPage } from './utils.js';
import { _buildLogCard } from './ui.js'; // 【⭐️ 核心修改：引入建立卡片的函式 ⭐️】
import { showGlobalNotification } from './main.js'; // 【⭐️ 核心修正：引入全域通知函式 ⭐️】
import * as api from './api.js'; // [統一] 引入完整的 api 模組

/**
 * [新增] 圖片壓縮輔助函式
 * @param {string} base64Str - 包含 data URI 前綴的 Base64 字串
 * @param {number} quality - 壓縮品質 (0 到 1)
 * @returns {Promise<string>} - 回傳壓縮後的 Base64 字串 (不含 data URI 前綴)
 */
function compressImage_(base64Str, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1920; // 設定最大寬度
      const scaleRatio = MAX_WIDTH / img.width;
      
      // 如果圖片寬度大於最大寬度，則進行縮放
      if (img.width > MAX_WIDTH) {
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleRatio;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // 將 canvas 內容轉換為 JPEG 格式的 Base64，並移除 data URI 前綴
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = error => reject(error);
  });
}

/** 處理建立新日誌 */
export function handleCreateNewPost() {
  const textarea = document.getElementById('post-creator-textarea');
  const submitBtn = document.getElementById('submit-post-btn');
  const titleSelect = document.getElementById('post-title-select');
  const photoPreviewContainer = document.getElementById('new-log-photo-preview');

  const content = textarea.value.trim();
  const photosBase64Array = photoPreviewContainer
    ? Array.from(photoPreviewContainer.querySelectorAll('.photo-preview-item')).map(item => item.dataset.base64)
    : [];

  if (!content && photosBase64Array.length === 0) {
    alert('請輸入一些內容或附加照片！');
    textarea.focus();
    return;
  }

  if (!submitBtn) { console.error('無法找到發佈按鈕 (submit-post-btn)'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = '發佈中...';

  const projectId = state.projectId; // [優化] 從全域 state 讀取 projectId
  const title = titleSelect ? titleSelect.value : '';

  // [升級] 準備元資料 (不含照片)，使用新的 createLog action
  const metaPayload = {
    action: 'createLog',
    userId: state.currentUserId || 'ConsoleUser',
    userName: state.currentUserName,
    projectId: projectId,
    projectName: state.projectName,
    title: title,
    content: content,
  };

  // [架構重構 v5.0] 將照片陣列直接放入 payload，交由 postTask 處理
  metaPayload.newPhotosBase64Array = photosBase64Array;

  // 【⭐️ 核心修改：在送出請求的當下，立即建立並顯示「處理中」卡片 ⭐️】
  const displayTitle = title
    ? `${new Date().toLocaleDateString('sv')} ${title} 進度回報 (處理中...)`
    : `${new Date().toLocaleDateString('sv')} 主控台更新 (處理中...)`;
  const optimisticLog = {
    LogID: `temp-${Date.now()}`,
    Title: displayTitle,
    Content: content,
    UserName: state.currentUserName || '管理員',
    Timestamp: new Date().toISOString(),
    PhotoLinks: photosBase64Array.join(',') // 讓樂觀更新的卡片也能顯示預覽
  };

  // 呼叫 ui.js 的函式來建立卡片 DOM 元素
  const newCard = _buildLogCard(optimisticLog, false);
  newCard.style.opacity = '0.7'; // 讓處理中的卡片呈現半透明狀態

  // 將新卡片插入到列表最頂端 (發文框下方)
  const logsContainer = document.getElementById('logs-container');
  const postCreator = logsContainer.querySelector('.post-creator');
  if (logsContainer && postCreator) {
    logsContainer.insertBefore(newCard, postCreator.nextSibling);
  }

  // [架構重構 v5.0] 統一呼叫 postTask，它會自動處理 newPhotosBase64Array 的上傳
  api.postTask(metaPayload)
    .then(finalJobState => {
        if (finalJobState.result && finalJobState.result.success) {
            showGlobalNotification(finalJobState.result.message || '日誌已成功建立！', 5000, 'success');
            newCard.style.opacity = '1'; // 成功後，移除半透明效果
            if (finalJobState.result.logId) {
                newCard.id = `log-${finalJobState.result.logId}`; // 用後端回傳的真實 ID 替換臨時 ID
            }
        } else {
            showGlobalNotification(`建立日誌失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
            newCard.style.border = '2px solid red';
            newCard.querySelector('h3').textContent += ' (發佈失敗)';
        }
    })
    .catch(error => {
        showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error');
        newCard.style.border = '2px solid red';
        newCard.querySelector('h3').textContent += ' (發佈失敗)';
    });
  
  // 樂觀更新：立即清空輸入框
  submitBtn.disabled = false;
  submitBtn.textContent = '發佈';
  textarea.value = '';
  if (photoPreviewContainer) photoPreviewContainer.innerHTML = '';
  if (titleSelect) titleSelect.selectedIndex = 0;
}
