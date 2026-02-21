/*
* =============================================================================
* 檔案名稱: logActions.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 專門處理「施工日誌」卡片上的所有互動事件，如編輯、照片管理等。
* =============================================================================
*/

import { state } from './state.js'; // 同一層
// [v547.0 修正] 將相對路徑改為絕對路徑，並合併重複的 import
import { logToPage, extractDriveFileId, showGlobalNotification } from '/shared/js/utils.js';
import { buildPhotoGrid, _buildLogCard } from './ui.js'; // 同一層
import { request as apiRequest } from './projectApi.js'; // [v317.0 API化] 引入新的統一請求函式

/** 處理文字編輯 */
export function handleEditText(logId) {
    const contentDiv = document.getElementById('content-' + logId);
    const btnBox = contentDiv.closest('.card').querySelector('.button-group');
    const originalButtons = Array.from(btnBox.childNodes);

    contentDiv.dataset.originalContent = contentDiv.innerText;
    contentDiv.contentEditable = true; contentDiv.focus();
    contentDiv.style.cssText += 'border:1px solid #3b82f6;padding:.5rem;border-radius:.25rem;background:#f9fafb';

    const bCancel = document.createElement('button'); bCancel.textContent = '取消'; bCancel.style.background = '#6b7280';
    bCancel.onclick = () => handleCancelEdit(logId, originalButtons);
    const bSave = document.createElement('button'); bSave.textContent = '儲存文字'; bSave.style.background = '#16a34a';
    bSave.onclick = () => handleSaveText(logId, originalButtons);
    btnBox.innerHTML = ''; btnBox.appendChild(bCancel); btnBox.appendChild(bSave);
}

/** 取消文字編輯 */
function handleCancelEdit(logId, originalButtons) {
    const contentDiv = document.getElementById('content-' + logId);
    const btnBox = contentDiv.closest('.card').querySelector('.button-group');
    contentDiv.contentEditable = false; contentDiv.style.border = 'none'; contentDiv.style.padding = '0'; contentDiv.style.background = 'transparent';
    contentDiv.innerText = contentDiv.dataset.originalContent;
    btnBox.innerHTML = '';
    originalButtons.forEach(b => btnBox.appendChild(b));
}

/** 儲存文字變更 */
function handleSaveText(logId, originalButtons) {
    const contentDiv = document.getElementById(`content-${logId}`);
    if (!contentDiv) return;

    const newText = contentDiv.innerText.trim();
    const btnBox = contentDiv.closest('.card')?.querySelector('.button-group');

    // 【⭐️ 核心修正 1/3：執行樂觀更新，立即還原 UI ⭐️】
    // 1. 立即將新內容更新到畫面上
    contentDiv.innerText = newText;
    // 2. 立刻將 UI 切換回正常瀏覽模式
    contentDiv.contentEditable = false;
    contentDiv.style.cssText = 'white-space: pre-wrap; margin-top: 0.75rem;';
    if (btnBox) {
        btnBox.innerHTML = '';
        originalButtons.forEach(b => btnBox.appendChild(b));
    }

    // 【⭐️ 核心修正 2/3：立即更新本地快取 ⭐️】
    const CACHE_KEY = `project_data_${state.projectId}_${state.currentUserId}`;
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) {
        const cacheData = JSON.parse(cachedItem);
        const logToUpdate = cacheData.data.dailyLogs.find(log => log.LogID === logId);
        if (logToUpdate) {
            logToUpdate.Content = newText;
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            logToPage(`[Cache] 已樂觀更新日誌 ${logId} 的文字內容。`);
        }
    }

    // 【⭐️ 核心修正 3/3：在背景執行後端同步 ⭐️】
    // [架構重構 v5.0] 統一呼叫 postTask
    apiRequest({ // [v317.0 API化] 改為使用統一請求函式
        action: 'updateLogText',
        payload: { id: logId, content: newText, userId: state.currentUserId, userName: state.currentUserName }
    })
        .then(result => {
            if (result.success) {
                showGlobalNotification(result.message || '文字已成功更新！', 5000, 'success');
            } else {
                showGlobalNotification(`文字更新失敗: ${result.error || '未知錯誤'}`, 8000, 'error');
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'));
}

/** 開啟照片管理視窗 */
export function openPhotoModal(logId, photoLinksCsv) {
    state.currentEditingLogId = logId;
    const modal = document.getElementById('photo-modal');
    const grid = document.getElementById('modal-photo-grid-container');
    grid.innerHTML = '';
    const links = photoLinksCsv ? photoLinksCsv.split(',').map(v => v.trim()).filter(Boolean) : [];
    if (links.length) {
        links.forEach(link => {
            const item = document.createElement('div'); item.className = 'modal-photo-item'; item.dataset.link = link;            
            const img = document.createElement('img'); 
            const id = extractDriveFileId(link); // [v407.0 修正] 改為呼叫新的函式
            img.src = id ? (`https://drive.google.com/thumbnail?id=${id}&sz=w300`) : link; 
            img.loading = 'lazy';
            const del = document.createElement('button'); 
            del.type = 'button'; // [問題1 修正] 避免觸發 form submit 導致頁面重整
            del.className = 'delete-photo-btn'; del.innerHTML = '&times;'; del.title = '標記刪除';
            del.onclick = () => { item.style.opacity = '.3'; item.classList.add('deleted'); };
            item.appendChild(img); item.appendChild(del); grid.appendChild(item);
        });
    } else {
        grid.innerHTML = '<p class="muted">目前沒有照片可供管理。</p>';
    }
    modal.style.display = 'flex';

    // 【⭐️ 核心修正：將檔案輸入框的建立與事件綁定邏輯，全部移至此處 ⭐️】
    // 確保每次 Modal 開啟時，都能為一個存在的 input 元素正確綁定事件。
    const fileInputId = 'modal-photo-file-input';
    let fileInput = document.getElementById(fileInputId);
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = fileInputId;
        fileInput.style.display = 'none';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        modal.appendChild(fileInput);

        // 為這個新建立的 input 綁定 change 事件
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files) return;

            // 呼叫一個新的輔助函式來處理預覽圖的產生
            handlePhotoPreviews(files);

            e.target.value = ''; // 清空 input，以便可以再次選擇同一個檔案
        });
    }
}

/** 關閉照片管理視窗 */
export function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
    state.currentEditingLogId = null;

    // 【⭐️ 核心修正：關閉時移除動態建立的檔案輸入框，保持頁面乾淨 ⭐️】
    const fileInput = document.getElementById('modal-photo-file-input');
    if (fileInput) {
        fileInput.remove();
    }
}

/**
 * [新增] 處理儲存照片的變更
 */
export function handleSavePhotos() {
    const btn = document.getElementById('save-photos-button');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '儲存中...';

    const grid = document.getElementById('modal-photo-grid-container');
    if (!grid) {
        showGlobalNotification('錯誤：找不到照片容器。', 5000, 'error');
        return;
    }

    // 1. 收集要保留的舊照片連結
    const keepLinks = Array.from(grid.querySelectorAll('.modal-photo-item:not(.new-upload):not(.deleted)'))
        .map(item => item.dataset.link);

    // 2. 收集新上傳的 Base64 照片資料
    // [v603.0 核心修正] 將 Base64 字串轉換為後端 _manageProjectFiles_ 函式預期的物件格式。
    // 後端預期格式為 { data: string, type: string, name: string }
    const newUploads = Array.from(grid.querySelectorAll('.modal-photo-item.new-upload:not(.deleted)')).map(item => {
        const fullDataUrl = item.dataset.fullUrl;
        if (!fullDataUrl) return null;
        const match = fullDataUrl.match(/^data:(image\/.+);base64,(.+)$/);
        if (!match) return null;
        return {
            data: match[2], // 純 Base64 資料
            type: match[1], // MIME 類型, e.g., 'image/jpeg'
            name: `upload_${Date.now()}.jpg` // 提供一個預設檔名
        };
    }).filter(Boolean); // 過濾掉解析失敗的 null

    // [v588.0 新增] 3. 收集要刪除的舊照片的 File ID
    const deleteIds = Array.from(grid.querySelectorAll('.modal-photo-item.deleted:not(.new-upload)'))
        .map(item => extractDriveFileId(item.dataset.link))
        .filter(Boolean); // 過濾掉無法解析 ID 的連結

    // 3. 取得當前正在編輯的日誌 ID
    const logIdToUpdate = state.currentEditingLogId; // [v359.0 核心修正] 修正屬性名稱，應為 state.currentEditingLogId
    if (!logIdToUpdate) {
        showGlobalNotification('錯誤：找不到當前編輯的日誌 ID，無法儲存。', 5000, 'error');
        btn.disabled = false;
        btn.textContent = '儲存變更';
        return;
    }

    // 4. 關閉 Modal 並在背景執行後端同步
    closePhotoModal();

    // [v362.0 核心修正] 執行樂觀更新，立即在畫面上反映變更。
    const cardToUpdate = document.getElementById(`log-${logIdToUpdate}`);
    if (cardToUpdate) {
        const photoContainer = cardToUpdate.querySelector('.photo-grid')?.parentNode;
        if (photoContainer) {
            // [v603.0] 樂觀更新時，一樣使用完整的 Data URL 來顯示預覽
            const optimisticLinks = [...keepLinks, ...newUploads];
            // 建立一個新的照片牆並替換掉舊的
            const newPhotoGrid = buildPhotoGrid(optimisticLinks);
            photoContainer.innerHTML = ''; // 清空舊照片
            photoContainer.appendChild(newPhotoGrid);
            // 為新照片綁定燈箱事件
            const images = Array.from(newPhotoGrid.querySelectorAll('img.photo-thumb'));
            images.forEach((img, index) => img.addEventListener('click', () => window.__openLightbox__(images.map(i => i.dataset.full), index)));
        }
        cardToUpdate.style.opacity = '0.7'; // 讓卡片半透明，表示正在處理中
    }

    apiRequest({
        // [核心修正] 回歸正確的 "更新" 模型，不再改變 LogID。
        action: 'updateLogPhotosWithUploads',
        payload: {
            logId: logIdToUpdate, // 明確指定要更新的 LogID
            existingLinksCsv: keepLinks.join(','), // 要保留的舊連結
            photos: newUploads, // [v603.0] 使用新的 key 'photos' 並傳遞物件陣列
            fileIdsToDelete: deleteIds, // [v588.0 新增] 將待刪除的 ID 列表加入 payload
            projectId: state.projectId,
            projectName: state.overview.siteName || state.overview['案場名稱'] || '',
            userId: state.currentUserId,
            userName: state.currentUserName
        }
    })
    .then(result => {
        if (result.success) {
            showGlobalNotification(result.message || '照片已成功更新！', 3000, 'success');
            // [v362.0] 使用後端回傳的最終資料，替換掉整張卡片，確保連結正確。
            // 由於我們沒有建立臨時卡片，而是直接修改原卡片，這裡的 "replace" 實際上是 "update"。
            const finalCard = _buildLogCard(result.data, false);
            if (cardToUpdate) {
                cardToUpdate.parentNode.replaceChild(finalCard, cardToUpdate);
            }
        } else {
            showGlobalNotification(`照片更新失敗: ${result.error || '未知錯誤'}`, 8000, 'error');
        }
    })
    .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'));
}

/** 發布日誌 */
export function handlePublish(logId) {
    const btn = document.getElementById('btn-' + logId);
    if (btn) { btn.disabled = true; btn.textContent = '發布中...'; }
    
    // [V2.1 升級] 改為呼叫 postAsyncTask，確保能取得最終結果並顯示通知
    // [架構重構 v5.0] 統一呼叫 postTask
    apiRequest({ // [v317.0 API化] 改為使用統一請求函式
        action: 'publish',
        payload: { logId: logId, newStatus: '已發布', userId: state.currentUserId, userName: state.currentUserName }
    })
        .then(result => {
            if (result.success) {
                showGlobalNotification('草稿已成功發布！', 5000, 'success');
                const card = document.getElementById('log-' + logId);
                if (card) { card.style.transition = 'opacity .5s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 500); }
            } else {
                showGlobalNotification(`發布失敗: ${result.error || '未知錯誤'}`, 8000, 'error');
                if (btn) { btn.disabled = false; btn.textContent = '審核與發布'; }
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'));
}

/**
 * [新增] 處理刪除日誌
 * @param {string} logId - 要刪除的日誌 ID
 */
export function handleDeleteLog(logId) {
    const card = document.getElementById('log-' + logId);
    if (card) {
        card.style.transition = 'opacity 0.5s, transform 0.5s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.remove(), 500); // 動畫結束後從 DOM 移除
    }
    
    // 【⭐️ 核心修改：實作樂觀更新 (Optimistic Update) ⭐️】
    // 1. 立即更新前端快取，不等待後端回應。
    const CACHE_KEY = `project_data_${state.projectId}_${state.currentUserId}`;
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) {
        const cacheData = JSON.parse(cachedItem);
        const initialCount = cacheData.data.dailyLogs.length;
        cacheData.data.dailyLogs = cacheData.data.dailyLogs.filter(log => log.LogID !== logId);
        const finalCount = cacheData.data.dailyLogs.length;
        
        if (initialCount > finalCount) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            logToPage(`[Cache] 已從快取中樂觀移除 LogID ${logId}。`);
        }
    }

    // 2. 在背景執行真正的刪除操作
    // [架構重構 v5.0] 統一呼叫 postTask
    apiRequest({ // [v317.0 API化] 改為使用統一請求函式
        action: 'deleteLog',
        payload: { id: logId, userId: state.currentUserId, userName: state.currentUserName }
    })
        .then(result => {
            if (result.success) {
                // 3a. 後端成功，顯示成功訊息
                showGlobalNotification(result.message || `日誌 ${logId} 已成功刪除。`, 5000, 'success');
                logToPage(`✅ 後端成功刪除日誌 ${logId}。`);
            } else {
                // 3b. 後端失敗，顯示錯誤訊息並提示使用者刷新
                console.error(`❌ 後端刪除日誌 ${logId} 失敗:`, result.error || '未知錯誤');
                showGlobalNotification(`刪除失敗: ${result.error || '未知錯誤'}，請刷新頁面。`, 8000, 'error');
                logToPage(`❌ 後端刪除日誌 ${logId} 失敗。`, 'error');
                // (未來可在此處實作更複雜的回滾邏輯，例如將卡片加回畫面)
            }
        })
        .catch(error => logToPage(`❌ 刪除 LogID ${logId} 時發生錯誤: ${error.message}`, 'error'));
}
/**
 * [新增] 觸發隱藏的檔案上傳輸入框
 */
export function triggerPhotoUpload() {
    const fileInput = document.getElementById('modal-photo-file-input'); // [核心修正] 使用 modal 專用的 ID
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * [新增] 輔助函式，專門處理在 Modal 中產生照片預覽縮圖。
 * @param {FileList} files - 從 input[type=file] 選擇的檔案列表。
 */
function handlePhotoPreviews(files) {
    const grid = document.getElementById('modal-photo-grid-container');
    if (!grid) return;

    // 如果有「目前沒有照片」的提示，就移除它
    const placeholder = grid.querySelector('p.muted');
    if (placeholder) placeholder.remove();

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
            const fullDataUrl = event.target.result;
            const item = document.createElement('div');
            item.className = 'modal-photo-item new-upload';
            // 將完整的 Data URL (包含 data:image/... 前綴) 存入 data-full-url，用於即時預覽和後續儲存。
            item.dataset.fullUrl = fullDataUrl;
            item.innerHTML = `
                <img src="${fullDataUrl}" loading="lazy">
                <button class="delete-photo-btn" title="移除此照片">&times;</button>
            `;
            item.querySelector('.delete-photo-btn').onclick = () => item.remove();
            grid.appendChild(item);
        };
        reader.readAsDataURL(file);
    }
}

/**
 * [重構] 依工種篩選日誌 (從 scheduleActions.js 移入)
 * @param {string} workType - 要篩選的工種名稱
 */
export function filterLogsByWorkType(workType) {
    logToPage(`🔍 正在依工種「${workType || '全部'}」篩選日誌...`);

    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;

    const logCards = logsContainer.querySelectorAll('.card:not(.post-creator)');
    let visibleCount = 0;

    logCards.forEach(card => {
        const logId = card.id.replace('log-', '');
        const logData = state.currentLogsData.find(log => log.LogID === logId);
        const shouldShow = !workType || (logData && logData.Title && logData.Title.includes(workType));

        card.style.display = shouldShow ? 'block' : 'none';
        if (shouldShow) visibleCount++;
    });

    logToPage(`篩選完畢，共顯示 ${visibleCount} 筆相關日誌。`);

    let noResultMsg = logsContainer.querySelector('.no-logs-message');
    if (visibleCount === 0 && workType) {
        if (!noResultMsg) {
            noResultMsg = document.createElement('p');
            noResultMsg.className = 'no-logs-message muted text-center p-4';
            logsContainer.appendChild(noResultMsg);
        }
        noResultMsg.textContent = `找不到與「${workType}」相關的日誌。`;
        noResultMsg.style.display = 'block';
    } else if (noResultMsg) {
        noResultMsg.style.display = 'none';
    }
}

/**
 * [v346.0 合併] 處理建立新日誌 (從 handlers.js 移入)
 */
export function handleCreateNewPost() {
  const textarea = document.getElementById('post-creator-textarea');
  const submitBtn = document.getElementById('submit-post-btn');
  const titleSelect = document.getElementById('post-title-select');
  const photoPreviewContainer = document.getElementById('new-log-photo-preview');
  const content = textarea.value.trim();
  
  // [v605.0 核心修正] 將 Base64 字串轉換為後端 _manageProjectFiles_ 函式預期的物件格式。
  const photos = photoPreviewContainer ? Array.from(photoPreviewContainer.querySelectorAll('.photo-preview-item')).map(item => {
    const fullDataUrl = item.dataset.base64; // 預覽項目的 dataset.base64 儲存的是完整的 Data URL
    if (!fullDataUrl) return null;
    const match = fullDataUrl.match(/^data:(image\/.+);base64,(.+)$/);
    if (!match) return null;
    return {
        data: match[2], // 純 Base64 資料
        type: match[1], // MIME 類型
        name: item.dataset.name || `upload_${Date.now()}.jpg` // 從 dataset 讀取原始檔名
    };
  }).filter(Boolean) : [];

  if (!content && photos.length === 0) {
    alert('請輸入一些內容或附加照片！');
    textarea.focus();
    return;
  }

  if (!submitBtn) { console.error('無法找到發佈按鈕 (submit-post-btn)'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = '發佈中...';

  const projectId = state.projectId;
  const title = titleSelect ? titleSelect.value : '';

  const requestPayload = {
    userId: state.currentUserId || 'ConsoleUser',
    userName: state.currentUserName,
    projectId: projectId,
    projectName: state.overview.siteName || state.overview['案場名稱'] || '',
    title: title,
    content: content,
    photos: photos
  };

  const displayTitle = title
    ? `${new Date().toLocaleDateString('sv')} ${title} 進度回報 (處理中...)`
    : `${new Date().toLocaleDateString('sv')} 主控台更新 (處理中...)`;
  const optimisticLog = {
    LogID: `temp-${Date.now()}`,
    Title: displayTitle,
    Content: content,
    UserName: state.currentUserName || '管理員',
    Timestamp: new Date().toISOString(),
    // [v350.0 核心修正] 直接傳遞 Base64 陣列，而不是用逗號連接的字串。
    // 這可以避免 buildPhotoGrid 函式因 Base64 內容中的逗號而錯誤地分割單張圖片。
    PhotoLinks: photos.map(p => `data:${p.type};base64,${p.data}`) // 樂觀更新時，需要完整的 Data URL
  };

  const newCard = _buildLogCard(optimisticLog, false);
  newCard.style.opacity = '0.7';

  const logsContainer = document.getElementById('logs-container');
  const postCreator = logsContainer.querySelector('.post-creator');
  if (logsContainer && postCreator) {
    logsContainer.insertBefore(newCard, postCreator.nextSibling);
  }

  apiRequest({ action: 'createLog', payload: requestPayload })
    .then(result => {
      if (result.success) {
        window.replaceOptimisticCard(optimisticLog.LogID, result.data);
        showGlobalNotification(result.message || '日誌已成功建立！', 3000, 'success');
      } else {
        showGlobalNotification(`建立日誌失敗: ${result.error || '未知錯誤'}`, 8000, 'error');
        newCard.style.border = '2px solid red';
      }
    })
    .catch(error => {
      showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error');
      newCard.style.border = '2px solid red';
    });

  submitBtn.disabled = false;
  submitBtn.textContent = '發佈';
  textarea.value = '';
  if (photoPreviewContainer) photoPreviewContainer.innerHTML = '';
  if (titleSelect) titleSelect.selectedIndex = 0;
}
