/*
* =============================================================================
* 檔案名稱: logActions.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 專門處理「施工日誌」卡片上的所有互動事件，如編輯、照片管理等。
* =============================================================================
*/

import { state } from './state.js';
import { logToPage, driveFileId } from './utils.js';
import { showGlobalNotification } from './utils.js'; // [核心修正] 引入全域通知函式
import { buildPhotoGrid } from './ui.js';
import * as api from './api.js';

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
    api.postTask({ action: 'updateLogText', id: logId, content: newText })
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification(finalJobState.result.message || '文字已成功更新！', 5000, 'success');
            } else {
                showGlobalNotification(`文字更新失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
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
            const img = document.createElement('img'); const id = driveFileId(link);
            img.src = id ? (`https://drive.google.com/thumbnail?id=${id}&sz=w300`) : link; img.loading = 'lazy';
            const del = document.createElement('button'); del.className = 'delete-photo-btn'; del.innerHTML = '&times;'; del.title = '標記刪除';
            del.onclick = () => { item.style.opacity = '.3'; item.classList.add('deleted'); };
            item.appendChild(img); item.appendChild(del); grid.appendChild(item);
        });
    } else {
        grid.innerHTML = '<p class="muted">目前沒有照片可供管理。</p>';
    }
    modal.style.display = 'flex';
}

/** 關閉照片管理視窗 */
export function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
    state.currentEditingLogId = null;
}

/** 處理儲存照片 */
export function handleSavePhotos() {
    const btn = document.getElementById('save-photos-button');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    const grid = document.getElementById('modal-photo-grid-container');
    const keepLinks = Array.from(grid.querySelectorAll('.modal-photo-item:not(.deleted)'))
        .map(item => item.dataset.link);

    // 【⭐️ 核心修正：收集新上傳的 Base64 照片資料 ⭐️】
    const newUploads = Array.from(grid.querySelectorAll('.modal-photo-item.new-upload:not(.deleted)'))
        .map(item => item.dataset.base64);

    // 【⭐️ 核心修正 1/3：執行樂觀更新，立即更新 UI 並關閉視窗 ⭐️】
    // 1. 組合出樂觀更新後，卡片上應該顯示的所有圖片連結 (舊的 + 新的 Base64 預覽)
    const optimisticLinks = [...keepLinks, ...newUploads];

    // 2. 立即重新渲染卡片上的照片牆
    const cardPhotoContainer = document.querySelector(`#log-${state.currentEditingLogId} .photo-grid`);
    if (cardPhotoContainer) {
        // 使用 buildPhotoGrid 函式產生新的照片牆內容，並替換掉舊的
        const newPhotoGrid = buildPhotoGrid(optimisticLinks.join(','));
        cardPhotoContainer.innerHTML = newPhotoGrid.innerHTML;
        // 觸發懶加載，確保新加入的圖片能被看見
        if (window.lazyLoadImages) window.lazyLoadImages();
    }

    // 3. 立即關閉彈出視窗，讓使用者可以繼續操作
    closePhotoModal();

    // 【⭐️ 核心修正 2/3：準備 payload 並在背景執行後端同步 ⭐️】
    const payload = {
        action: 'updateLogPhotosWithUploads',
        logId: state.currentEditingLogId,
        existingLinksCsv: keepLinks.join(','),
        newPhotosBase64Array: newUploads,
        deleteLinksCsv: ''
    };

    // [架構重構 v5.0] 統一呼叫 postTask，它會自動處理 newPhotosBase64Array 的上傳
    api.postTask(payload)
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification(finalJobState.result.message || '照片已成功更新！', 5000, 'success');
            } else {
                showGlobalNotification(`照片更新失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'));
    // 【⭐️ 核心修正 3/3：移除 finally 區塊，因為 UI 更新已在前面完成 ⭐️】
}

/** 發布日誌 */
export function handlePublish(logId) {
    const btn = document.getElementById('btn-' + logId);
    if (btn) { btn.disabled = true; btn.textContent = '發布中...'; }
    
    // [V2.1 升級] 改為呼叫 postAsyncTask，確保能取得最終結果並顯示通知
    // [架構重構 v5.0] 統一呼叫 postTask
    api.postTask({ action: 'publish', logId: logId, newStatus: '已發布' })
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification('草稿已成功發布！', 5000, 'success');
                const card = document.getElementById('log-' + logId);
                if (card) { card.style.transition = 'opacity .5s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 500); }
            } else {
                showGlobalNotification(`發布失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
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
    api.postTask({ action: 'deleteLog', id: logId })
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                // 3a. 後端成功，顯示成功訊息
                showGlobalNotification(finalJobState.result.message || `日誌 ${logId} 已成功刪除。`, 5000, 'success');
                logToPage(`✅ 後端成功刪除日誌 ${logId}。`);
            } else {
                // 3b. 後端失敗，顯示錯誤訊息並提示使用者刷新
                console.error(`❌ 後端刪除日誌 ${logId} 失敗:`, finalJobState.result?.message || '未知錯誤');
                showGlobalNotification(`刪除失敗: ${finalJobState.result?.message || '未知錯誤'}，請刷新頁面。`, 8000, 'error');
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
    const fileInput = document.getElementById('photo-file-input');
    if (fileInput) {
        fileInput.click();
    }
}
/**
 * 初始化日誌動作相關的全域事件監聽器。
 */
export function initializeLogActions() {
    // 【⭐️ 核心重構：移除此處的事件綁定，統一由 main.js 的事件代理處理 ⭐️】
    // document.getElementById('modal-cancel-btn')?.addEventListener('click', closePhotoModal);
    // document.getElementById('save-photos-button')?.addEventListener('click', handleSavePhotos);

    // 【⭐️ 核心修正：將檔案選擇的邏輯移至此處，並由 triggerPhotoUpload 觸發 ⭐️】
    const fileInput = document.getElementById('photo-file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            const grid = document.getElementById('modal-photo-grid-container');
            if (!files || !grid) return;

            const placeholder = grid.querySelector('p.muted');
            if (placeholder) placeholder.remove();

            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const item = document.createElement('div');
                    item.className = 'modal-photo-item new-upload';
                    item.dataset.base64 = event.target.result;
                    item.innerHTML = `
                        <img src="${event.target.result}" loading="lazy">
                        <button class="delete-photo-btn" title="移除此照片">&times;</button>
                    `;
                    item.querySelector('.delete-photo-btn').onclick = () => item.remove();
                    grid.appendChild(item);
                };
                reader.readAsDataURL(file);
            }
            e.target.value = '';
        });
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
