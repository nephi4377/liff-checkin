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

/** 處理建立新日誌 */
export function handleCreateNewPost() {
  const textarea = document.getElementById('post-creator-textarea');
  const submitBtn = document.getElementById('submit-post-btn');
  const titleSelect = document.getElementById('post-title-select');
  const photoPreviewContainer = document.getElementById('new-log-photo-preview');

  const content = textarea.value.trim();
  const photosBase64Array = photoPreviewContainer
    // [優化] 讀取完整的照片資訊，而不只是 base64
    ? Array.from(photoPreviewContainer.querySelectorAll('.photo-preview-item')).map(item => ({
        name: item.dataset.name || `console-upload-${Date.now()}.jpg`,
        type: item.dataset.type || 'image/jpeg',
        base64: item.dataset.base64
      }))
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

  // [核心重構] 採用 report.html 的分批、佇列上傳模式
  const batchId = `${state.currentUserId || 'consoleUser'}-${Date.now()}`;
  const SUBMIT_CHUNK_SIZE = 10;
  // 如果沒有照片，至少也要提交一筆文字資料
  const totalChunks = Math.ceil(photosBase64Array.length / SUBMIT_CHUNK_SIZE) || 1;

  const baseFormData = {
    source: 'liff_report_form_chunk', // 偽裝成來自 report.html 的請求，觸發後端佇列邏輯
    batchId,
    totalChunks,
    userId: state.currentUserId || 'ConsoleUser',
    userName: state.currentUserName,
    projectId: projectId,
    workType: title, // 將標題對應到施工項目
    workDescription: content, // 將內容對應到施工說明
    problemDescription: '', // 主控台沒有這個欄位，留空
  };

  (async () => {
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * SUBMIT_CHUNK_SIZE;
        const chunkEnd = chunkStart + SUBMIT_CHUNK_SIZE;
        const photoChunk = photosBase64Array.slice(chunkStart, chunkEnd);

        // 將 Base64 轉為後端期望的 { data: '...' } 格式，並移除 data URI 前綴
        const processedPhotos = photoChunk.map(photoInfo => ({
          name: photoInfo.name,
          type: photoInfo.type,
          data: photoInfo.base64.split(',')[1]
        }));

        const chunkFormData = { ...baseFormData, chunkIndex: i + 1, photos: processedPhotos };

        logToPage(`正在提交第 ${i + 1} / ${totalChunks} 批資料...`);
        await fetch(`${API_BASE_URL}`, {
          method: 'POST',
          body: JSON.stringify(chunkFormData),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          mode: 'no-cors' // 沿用 report.html 的穩定模式
        });
      }

      // 所有批次提交完成後的 UI 清理 (樂觀更新)
      logToPage('✅ 所有資料皆已提交！後端將在背景處理。');
      submitBtn.disabled = false;
      submitBtn.textContent = '發佈';
      textarea.value = '';
      if (photoPreviewContainer) photoPreviewContainer.innerHTML = '';
      if (titleSelect) titleSelect.selectedIndex = 0;

    } catch (error) {
      alert(`提交失敗: ${error.message}`);
      logToPage(`❌ 提交過程中發生錯誤: ${error.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = '發佈';
    }
  })();
}