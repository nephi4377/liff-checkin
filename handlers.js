/*
* =============================================================================
* 檔案名稱: handlers.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 集中管理所有的使用者互動事件處理。
* =============================================================================
*/

import { state } from './state.js';
import { logToPage } from './utils.js';
import { _buildLogCard } from './ui.js';
import { saveText, savePhotos, publishLog } from './api.js';

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

    const projectId = new URLSearchParams(window.location.search).get('id');
    const title = titleSelect ? titleSelect.value : '';

    const payload = {
        action: 'createNewLog',
        projectId: projectId,
        content: content,
        userName: state.currentUserName,
        title: title,
        photos: photosBase64Array
    };

    const optimisticPost = {
        LogID: `temp-${Date.now()}`,
        ProjectName: document.getElementById('project-title').textContent.replace('主控台: ', ''),
        Title: title
            ? `${new Date().toLocaleDateString('sv')} ${title} 進度回報 (主控台新增)`
            : `${new Date().toLocaleDateString('sv')} 主控台更新`,
        UserName: state.currentUserName,
        Timestamp: new Date().toISOString(),
        Content: content,
        PhotoLinks: photosBase64Array
    };
    const newCard = _buildLogCard(optimisticPost, false);
    const logsContainer = document.getElementById('logs-container');
    const postCreator = logsContainer.querySelector('.post-creator');
    postCreator.insertAdjacentElement('afterend', newCard);
    
    // [核心修正] 不再直接呼叫 lazyLoadImages，而是透過 window 物件，打破循環依賴
    if (window.lazyLoadImages) { window.lazyLoadImages(); }

    fetch(`${API_BASE_URL}?page=project`, {
        method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
    }).finally(() => {
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = '發佈';
            textarea.value = '';
            if (photoPreviewContainer) photoPreviewContainer.innerHTML = '';
            if (titleSelect) titleSelect.selectedIndex = 0;
        }, 1000);
    });
}

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
export function handleCancelEdit(logId, originalButtons) {
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
    
    saveText(logId, newText, originalButtons)
        .then(resp => editTextCallback(resp, logId, originalButtons))
        .catch(err => {
            alert('儲存失敗：' + err.message);
            handleCancelEdit(logId, originalButtons);
        });
}

/** 儲存文字後的回呼 */
export function editTextCallback(resp, logId, originalButtons) {
    // 這段邏輯現在由 handleSaveText 處理
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

/** 儲存照片後的回呼 */
export function handlePhotoSaveSuccess(resp) {
    if (resp && resp.success) {
        closePhotoModal();
        // 這裡可以進一步優化，例如直接更新 state 中的資料，而不是重新整理
        window.location.reload();
    } else {
        alert('儲存失敗：' + (resp ? (resp.message || '未知錯誤') : '未知錯誤'));
    }
    const btn = document.getElementById('save-photos-button');
    if (btn) {
        btn.textContent = '儲存變更';
        btn.disabled = false;
    }
}

/** 發布日誌 */
export function handlePublish(logId) {
    const btn = document.getElementById('btn-' + logId);
    if (btn) { btn.disabled = true; btn.textContent = '發布中...'; }
    publishLog(logId, btn)
        .then(() => {
            publishCallback({ success: true, message: '發布請求已送出', logId: logId });
        })
        .catch(error => {
            console.error('發布時發生錯誤:', error);
            alert('發布請求失敗，請檢查網路連線。');
            if (btn) { btn.disabled = false; btn.textContent = '審核與發布'; }
        });
}

/** 發布後的回呼 */
export function publishCallback(resp) {
    const logId = resp && resp.logId;
    const b = logId ? document.getElementById('btn-' + logId) : null;
    if (resp && resp.success) {
        const card = document.getElementById('log-' + logId);
        if (card) { card.style.transition = 'opacity .5s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 500); }
    } else {
        alert('發布失敗：' + (resp ? (resp.message || '未知原因') : '未知原因'));
        if (b) { b.disabled = false; b.textContent = '審核與發布'; }
    }
}

/** 依工種篩選日誌 */
export function filterLogsByWorkType(workType) {
    // ... (此處省略 filterLogsByWorkType 的完整程式碼)
}

/** 根據任務日期，智慧更新其所屬的階段 */
export function updateTaskPhaseByDate(taskCardElement, targetDate) {
    if (!taskCardElement || !targetDate) return;

    let determinedPhase = '未分類'; // 預設階段

    const allTasks = Array.from(document.querySelectorAll('.task-card'));
    for (const card of allTasks) {
        if (card === taskCardElement) continue;

        const startDateStr = card.querySelector('input[data-field="預計開始日"]')?.value;
        const endDateStr = card.querySelector('input[data-field="預計完成日"]')?.value;

        if (startDateStr && endDateStr) {
            const taskStart = new Date(startDateStr);
            taskStart.setHours(0, 0, 0, 0);
            const taskEnd = new Date(endDateStr);
            taskEnd.setHours(0, 0, 0, 0);
            const checkDate = new Date(targetDate);
            checkDate.setHours(0, 0, 0, 0);

            if (checkDate >= taskStart && checkDate <= taskEnd) {
                const phaseTag = card.querySelector('.phase-tag');
                if (phaseTag) {
                    determinedPhase = phaseTag.textContent;
                    break;
                }
            }
        }
    }
    const currentPhaseTag = taskCardElement.querySelector('.phase-tag');
    if (currentPhaseTag) {
        currentPhaseTag.textContent = determinedPhase;
    }
}

/** 處理新增任務 */
export function handleAddTask() {
    const finalNewTaskData = {
        '案號': new URLSearchParams(window.location.search).get('id'),
        '階段': '未分類',
        '預計開始日': new Date().toLocaleDateString('sv'),
        '預計完成日': new Date().toLocaleDateString('sv'),
        '狀態': '未完成',
    };
    // This logic is now in main.js
}

/** 啟用儲存按鈕 */
export function enableSaveButton() {
    const btn = document.getElementById('save-schedule-btn');
    if (btn) btn.classList.remove('hidden');
}

/** 處理儲存排程 */
export function handleSaveSchedule() {
    const btn = document.getElementById('save-schedule-btn');
    btn.classList.add('hidden');
    btn.disabled = true;
    logToPage('💾 變更已送出，背景儲存中...');

    const projectId = new URLSearchParams(window.location.search).get('id');
    const scheduleData = Array.from(document.querySelectorAll('.task-card')).map(card => {
        if (card.style.display === 'none') return null;
        const task = {};
        card.querySelectorAll('[data-field]').forEach(input => {
            task[input.dataset.field] = input.value;
        });
        task['案號'] = projectId;
        const phaseTag = card.querySelector('.phase-tag');
        if (phaseTag) task['階段'] = phaseTag.textContent;
        return task;
    }).filter(Boolean);

    scheduleData.sort((a, b) => {
        const dateA = new Date(a['預計開始日']);
        const dateB = new Date(b['預計開始日']);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateA - dateB;
    });

    const payload = { action: 'updateSchedule', projectId, scheduleData };

    return fetch(`${API_BASE_URL}?page=project`, {
        method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
    })
    .catch(error => {
        console.error('儲存排程時發生網路錯誤:', error);
        alert('儲存失敗！請檢查您的網路連線。');
    })
    .finally(() => {
        btn.textContent = '儲存排程變更';
        btn.disabled = false;
        btn.classList.add('hidden');
    });
}

/** 顯示日期選擇器 */
export function showStartDatePicker(templateType) {
    // ... (此處省略 showStartDatePicker 的完整程式碼)
}

/** 處理匯入範本 */
export function handleImportTemplate(templateType, startDate) {
    // ... (此處省略 handleImportTemplate 的完整程式碼)
}