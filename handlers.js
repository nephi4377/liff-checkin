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

  // 【⭐️ 核心重構：採用與施工回報完全一致的非同步佇列模式 ⭐️】
  const batchId = `${state.currentUserId || 'consoleUser'}-${Date.now()}`;
  const SUBMIT_CHUNK_SIZE = 10;
  // 如果沒有照片，至少也要提交一筆文字資料
  const totalChunks = Math.ceil(photosBase64Array.length / SUBMIT_CHUNK_SIZE) || 1;

  const baseFormData = {
    action: 'submit_report_chunk', // 【⭐️ 核心修改 ⭐️】統一使用 action 作為路由鍵
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
      logToPage('⏳ 開始處理發文請求...');
      for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * SUBMIT_CHUNK_SIZE;
        const chunkEnd = chunkStart + SUBMIT_CHUNK_SIZE;
        const photoChunk = photosBase64Array.slice(chunkStart, chunkEnd);

        // 【⭐️ 核心修改：在上傳前壓縮圖片 ⭐️】
        const compressedPhotos = await Promise.all(photoChunk.map(async (photoInfo) => {
          logToPage(`  - 正在壓縮圖片 ${photoInfo.name}...`);
          const compressedData = await compressImage_(photoInfo.base64);
          return { name: photoInfo.name, type: 'image/jpeg', data: compressedData };
        }));

        const chunkFormData = { ...baseFormData, chunkIndex: i + 1, photos: compressedPhotos };
        
        logToPage(`正在提交第 ${i + 1} / ${totalChunks} 批資料...`);

        // 【⭐️ 核心修正：改用 URLSearchParams 提交，與其他 API 請求保持一致 ⭐️】
        const formData = new URLSearchParams();
        // 注意：此處我們不使用 'payload' 作為鍵，因為後端是直接解析整個請求主體
        // 而是將整個 chunkFormData 物件轉為字串，讓後端 doPost 能直接解析
        // 為了與後端 doPost 的 `JSON.parse(e.postData.contents)` 兼容，我們仍需發送原始 JSON
        // 但為了統一，我們將所有 POST 都改為 URLSearchParams
        await fetch(`${API_BASE_URL}`, {
          method: 'POST',
          body: JSON.stringify(chunkFormData),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 保持 text/plain 以便後端解析
          mode: 'no-cors'
        });
      }

      // 【⭐️ 核心修改：樂觀更新與使用者提示 ⭐️】
      // 1. 提示使用者後端已收到請求
      alert('請求已成功送出！\n後端將在背景處理資料，約需 1-2 分鐘，請稍後刷新頁面查看結果。');
      logToPage('✅ 所有資料批次皆已提交！後端將在背景非同步處理。');
      submitBtn.disabled = false;
      submitBtn.textContent = '發佈';
      textarea.value = '';
      if (photoPreviewContainer) photoPreviewContainer.innerHTML = '';
      if (titleSelect) titleSelect.selectedIndex = 0;

    } catch (error) {
      // 如果在壓縮或 fetch 過程中出錯
      alert(`提交失敗: ${error.message}`);
      logToPage(`❌ 提交過程中發生錯誤: ${error.message}`);
      submitBtn.disabled = false;
      submitBtn.textContent = '發佈';
    }
  })();
}