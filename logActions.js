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
import { showGlobalNotification } from './main.js'; // [核心修正] 引入全域通知函式
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
    const contentDiv = document.getElementById('content-' + logId);
    const newText = contentDiv.innerText.trim();
    const btnBox = contentDiv.closest('.card').querySelector('.button-group');
    const firstBtn = btnBox.querySelector('button');
    if (firstBtn) { firstBtn.textContent = '儲存中...'; firstBtn.disabled = true; }
    
    // [V2.1 升級] 改為呼叫 postAsyncTask，確保能取得最終結果並顯示通知
    api.postAsyncTask({ action: 'updateLogText', id: logId, content: newText })
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification(finalJobState.result.message || '文字已成功更新！', 5000, 'success');
            } else {
                showGlobalNotification(`文字更新失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
                // 失敗時還原內容
                contentDiv.innerText = contentDiv.dataset.originalContent;
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'))
        .finally(() => {
            // 無論成功或失敗，都還原 UI
            contentDiv.contentEditable = false;
            contentDiv.style.cssText = 'white-space: pre-wrap; margin-top: 0.75rem;';
            btnBox.innerHTML = '';
            originalButtons.forEach(b => btnBox.appendChild(b));
        });
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
function closePhotoModal() {
    document.getElementById('photo-modal').style.display = 'none';
    state.currentEditingLogId = null;
}

/** 處理儲存照片 */
function handleSavePhotos() {
    const btn = document.getElementById('save-photos-button');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    const grid = document.getElementById('modal-photo-grid-container');
    const keepLinks = Array.from(grid.querySelectorAll('.modal-photo-item:not(.deleted)'))
        .map(item => item.dataset.link);

    // [V2.1 升級] 改為呼叫 postAsyncTask，確保能取得最終結果並顯示通知
    // 注意：此處的 newPhotosBase64Array 和 deleteLinksCsv 暫時為空，因為 UI 尚未實作
    const payload = {
        action: 'updateLogPhotosWithUploads',
        logId: state.currentEditingLogId,
        existingLinksCsv: keepLinks.join(','),
        newPhotosBase64Array: [],
        deleteLinksCsv: ''
    };

    api.postAsyncTask(payload)
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification(finalJobState.result.message || '照片已成功更新！', 5000, 'success');
                // 成功後，更新卡片上的照片牆
                const cardPhotoContainer = document.querySelector(`#log-${state.currentEditingLogId} .photo-grid`);
                if (cardPhotoContainer) {
                    cardPhotoContainer.innerHTML = buildPhotoGrid(finalJobState.result.finalLinks).innerHTML;
                }
            } else {
                showGlobalNotification(`照片更新失敗: ${finalJobState.result?.message || '未知錯誤'}`, 8000, 'error');
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'))
        .finally(() => {
            closePhotoModal();
            btn.disabled = false;
            btn.textContent = '儲存變更';
        });
}

/** 發布日誌 */
export function handlePublish(logId) {
    const btn = document.getElementById('btn-' + logId);
    if (btn) { btn.disabled = true; btn.textContent = '發布中...'; }
    
    // [V2.1 升級] 改為呼叫 postAsyncTask，確保能取得最終結果並顯示通知
    api.postAsyncTask({ action: 'publish', logId: logId, newStatus: '已發布' })
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
    api.postAsyncTask({ action: 'deleteLog', id: logId })
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
 * 初始化日誌動作相關的全域事件監聽器。
 */
export function initializeLogActions() {
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closePhotoModal);
    document.getElementById('save-photos-button')?.addEventListener('click', handleSavePhotos);
    // 其他未來可能需要的全域事件可以加在此處
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
