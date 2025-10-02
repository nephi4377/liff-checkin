/*
* =============================================================================
* 檔案名稱: scheduleActions.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.1 (重構版)
* 說明: 專門處理「工程排程」功能的模組，包含 UI 渲染與事件處理。
* =============================================================================
*/

import { logToPage } from './utils.js';
import { state } from './state.js';
import { createOrUpdateTradeDatalist } from './ui.js';
import { loadJsonp } from './api.js'; // [重構] 導入 loadJsonp

/**
 * [重構] 渲染整個排程頁面 (取代 ui.js 中的 displaySchedule)
 * @param {object} overview - 專案總覽資訊
 * @param {Array<object>} schedule - 專案排程資料
 */
export function renderSchedulePage(overview, schedule) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = '';
    if (!overview || !schedule || !overview['專案起始日']) {
        container.style.display = 'none';
        return;
    }

    // [核心修正] 恢復進度條與控制按鈕的渲染邏輯
    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'card p-6 mb-4';
    progressWrapper.style.cssText = 'position: sticky; top: 0; z-index: 20;';

    const firstUnfinishedTask = schedule.find(t => t['狀態'] !== '已完成');
    const currentPhase = firstUnfinishedTask ? firstUnfinishedTask['階段'] : '專案已完工';
    progressWrapper.innerHTML = `<div class="progress-label"><strong>目前階段: ${currentPhase}</strong></div>`;

    const timeline = document.createElement('div');
    timeline.className = 'progress-timeline';
    const PHASE_COLORS = {
        '前置作業': '#3b82f6', '泥作工程': '#6b7280', '木作工程': '#964B00',
        '後期裝修階段': '#f59e0b', '室內精裝階段': '#16a34a', '驗收': '#8b5cf6', '預設': '#d1d5db'
    };
    const startDate = new Date(overview['專案起始日']);
    const endDate = new Date(overview['預計完工日']);
    const totalDuration = Math.max(1, endDate - startDate);
    const phases = [...new Set(schedule.map(t => t['階段']))];
    phases.forEach(phase => {
        const tasksInPhase = schedule.filter(t => t['階段'] === phase && t['預計開始日'] && t['預計完成日']);
        if (tasksInPhase.length === 0) return;
        const phaseStartDate = new Date(Math.min(...tasksInPhase.map(t => new Date(t['預計開始日']))));
        const phaseEndDate = new Date(Math.max(...tasksInPhase.map(t => new Date(t['預計完成日']))));
        if (isNaN(phaseStartDate) || isNaN(phaseEndDate)) return;
        const phaseDuration = Math.max(0, phaseEndDate - phaseStartDate);

        const segment = document.createElement('div');
        segment.className = 'progress-segment';
        segment.style.width = `${(phaseDuration / totalDuration) * 100}%`;
        segment.style.left = `${((phaseStartDate - startDate) / totalDuration) * 100}%`;
        segment.style.backgroundColor = PHASE_COLORS[phase] || PHASE_COLORS['預設'];
        segment.title = `${phase}: ${Math.round(phaseDuration / (1000 * 60 * 60 * 24)) + 1}天`;
        timeline.appendChild(segment);
    });
    const todayMarkerPosition = Math.max(0, Math.min(100, ((new Date() - startDate) / totalDuration) * 100));
    timeline.innerHTML += `<div class="today-marker" style="left:${todayMarkerPosition}%;"></div>`;
    progressWrapper.appendChild(timeline);

    const listContainer = document.createElement('div');
    listContainer.id = 'schedule-list-container';
    listContainer.className = 'schedule-list';

    const listWrapper = document.createElement('div');
    listWrapper.className = 'schedule-list-wrapper card p-6';
    listWrapper.appendChild(listContainer);

    schedule.forEach((task, index) => {
        listContainer.appendChild(renderTaskCard(task, index));
    });

    const addTaskDiv = document.createElement('div');
    addTaskDiv.className = 'add-task-controls mt-4 pt-4 border-t flex justify-end items-center gap-4';
    addTaskDiv.innerHTML = `
      <button id="save-schedule-btn" class="btn btn-danger hidden" data-action="handleSaveSchedule">儲存排程變更</button>
      <button id="add-task-btn" class="btn btn-primary w-full md:w-auto" data-action="handleAddTask">＋ 新增任務</button>
    `;
    listWrapper.appendChild(addTaskDiv);

    container.appendChild(progressWrapper);
    container.appendChild(listWrapper);
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

/**
 * [核心實作] 處理新增任務
 * - 在排程列表底部新增一個空白的任務卡片。
 * - 自動啟用儲存按鈕。
 * - 將新卡片滾動到可視範圍。
 */
export function handleAddTask() {
    const listContainer = document.getElementById('schedule-list-container');
    if (!listContainer) return;

    const newTaskIndex = listContainer.children.length;
    const newTaskData = {
        '案號': state.projectId, // [優化] 從全域 state 讀取 projectId
        '階段': '未分類',
        '預計開始日': new Date().toLocaleDateString('sv'),
        '預計完成日': new Date().toLocaleDateString('sv'),
        '狀態': '未完成',
    };

    const newCard = renderTaskCard(newTaskData, newTaskIndex);
    listContainer.appendChild(newCard);

    // 啟用儲存按鈕
    enableSaveButton();

    // 將新卡片滾動到畫面中
    newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    logToPage('＋ 已新增一筆空白任務，請填寫後儲存。');
}

/**
 * [重構] 渲染單張任務卡片 (從 ui.js 移入)
 * @param {object} task - 任務物件
 * @param {number} index - 索引
 * @returns {HTMLDivElement}
 */
function renderTaskCard(task, index) {
    const card = document.createElement('div');
    card.className = 'task-card bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-5 gap-4 relative';
    card.id = `task-card-${index}`;
    card.dataset.taskIndex = index;

    card.innerHTML = `
      <div class="flex flex-col gap-1">
        <label class="form-label">階段 / 工種</label>
        <div class="phase-tag">${task['階段'] || '未分類'}</div>
        <input type="text" data-field="工種" value="${task['工種'] || ''}" class="form-input clickable-work-type" list="trade-datalist" autocomplete="off">
      </div>
      <div class="md:col-span-2 flex flex-col gap-1">
        <label class="form-label">任務項目 / 說明</label>
        <input type="text" class="form-input font-semibold" data-field="任務項目" value="${task['任務項目'] || ''}" placeholder="請輸入任務項目">
        <textarea data-field="任務說明" class="form-textarea" placeholder="任務的詳細說明...">${task['任務說明'] || ''}</textarea>
      </div>
      <div class="flex flex-col gap-1">
          <label class="form-label">工班 / 狀態</label>
          <input type="text" data-field="負責人/工班" value="${task['負責人/工班'] || ''}" class="form-input" placeholder="請輸入工班">
          <div class="status-cell mt-1">
              <select data-field="狀態" class="form-select">
                  <option value="未完成">未完成</option>
                  <option value="施工中">施工中</option>
                  <option value="已完成">已完成</option>
              </select>
          </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="form-label">預計時程 / 備註</label>
        <input type="text" class="date-range-picker form-input" placeholder="點擊選擇日期範圍">
        <input type="hidden" data-field="預計開始日" value="${(task['預計開始日'] || '').split('T')[0]}">
        <input type="hidden" data-field="預計完成日" value="${(task['預計完成日'] || '').split('T')[0]}">
        <textarea data-field="備註" class="form-textarea" placeholder="備註...">${task['備註'] || ''}</textarea>
      </div>
      <button class="delete-task-btn" title="刪除此任務">&times;</button>
    `;

    flatpickr(card.querySelector('.date-range-picker'), {
        mode: "range", dateFormat: "Y-m-d", altInput: true, altFormat: "m-d",
        defaultDate: [task['預計開始日'], task['預計完成日']].filter(Boolean),
        locale: "zh_tw",
        onClose: function (selectedDates) {
            const startDateInput = card.querySelector('input[data-field="預計開始日"]');
            const endDateInput = card.querySelector('input[data-field="預計完成日"]');
            if (selectedDates.length >= 1) {
                startDateInput.value = new Date(selectedDates[0]).toLocaleDateString('sv');
                endDateInput.value = new Date(selectedDates[selectedDates.length - 1]).toLocaleDateString('sv');
                updateTaskPhaseByDate(card, selectedDates[0]);
            }
            enableSaveButton();
        }
    });

    const statusSelect = card.querySelector('select[data-field="狀態"]');
    statusSelect.value = task['狀態'] || '未完成';
    const setStatusColor = () => {
        const statusCell = card.querySelector('.status-cell');
        statusCell.className = `status-cell mt-1 status-${statusSelect.value}`;
    };
    setStatusColor();
    statusSelect.onchange = setStatusColor;

    card.querySelectorAll('input, select, textarea').forEach(el => el.dataset.action = 'enableSaveButton');
    card.querySelector('input[data-field="工種"]').dataset.action = 'filterLogsByWorkType';
    const deleteBtn = card.querySelector('.delete-task-btn');
    deleteBtn.dataset.action = 'deleteTask';
    deleteBtn.dataset.taskIndex = index;
    deleteBtn.dataset.taskName = task['任務項目'] || '新任務';

    return card;
}

/** 啟用儲存按鈕 */
export function enableSaveButton() {
    const btn = document.getElementById('save-schedule-btn');
    if (btn) btn.classList.remove('hidden');
}

/** 處理儲存排程 */
export function handleSaveSchedule() {
    // [核心修正] 恢復為原始、穩定的 fetch POST 請求模式
    const btn = document.getElementById('save-schedule-btn');
    btn.disabled = true;
    btn.textContent = '儲存中...'; // [優化] 點擊後立即更新按鈕文字
    logToPage('💾 變更已送出，背景儲存中...');

    const projectId = state.projectId; // [核心修正] 統一從全域 state 讀取 projectId
    const cards = Array.from(document.querySelectorAll('.task-card')); // [核心修正] 先取得所有卡片元素
    const scheduleData = cards.map(card => {
        if (card.style.display === 'none') return null; // 忽略已刪除的卡片
        const task = {};
        card.querySelectorAll('[data-field]').forEach(input => {
            task[input.dataset.field] = input.value;
        });
        // [核心修正] 為每一筆任務資料填上案號
        task['案號'] = projectId;
        const phaseTag = card.querySelector('.phase-tag');
        if (phaseTag) task['階段'] = phaseTag.textContent;
        return task;
    }).filter(Boolean);

    // [核心修正] 在儲存前，重新判斷所有「未分類」任務的階段
    // 1. 先建立一份所有任務的參考副本
    const allTasksForReference = [...scheduleData];

    // 2. 遍歷所有任務，專門處理「未分類」的
    scheduleData.forEach((currentTask, index) => { // [核心修正] 取得索引值
        if (currentTask && currentTask['階段'] === '未分類' && currentTask['預計開始日']) {
            const targetDate = new Date(currentTask['預計開始日']);
            targetDate.setHours(0, 0, 0, 0);

            let determinedPhase = '未分類'; // 預設值

            // 3. 用它的日期去跟「所有其他任務」的日期區間比對
            for (const referenceTask of allTasksForReference) {
                if (referenceTask === currentTask || referenceTask['階段'] === '未分類') continue;

                const refStartDateStr = referenceTask['預計開始日'];
                const refEndDateStr = referenceTask['預計完成日'];

                if (refStartDateStr && refEndDateStr) {
                    const refStart = new Date(refStartDateStr); refStart.setHours(0, 0, 0, 0);
                    const refEnd = new Date(refEndDateStr); refEnd.setHours(0, 0, 0, 0);

                    if (targetDate >= refStart && targetDate <= refEnd) {
                        determinedPhase = referenceTask['階段'];
                        break; // 找到就跳出迴圈
                    }
                }
            }
            currentTask['階段'] = determinedPhase; // 更新該任務的階段

            // [核心新增] 將判斷出的新階段，同步更新回畫面上的卡片
            const cardToUpdate = cards[index];
            const phaseTagToUpdate = cardToUpdate.querySelector('.phase-tag');
            if (phaseTagToUpdate) {
                phaseTagToUpdate.textContent = determinedPhase;
            }
        }
    });

    // [核心修正] 在送出前，對所有任務進行最後的排序與案號填充
    scheduleData.sort((a, b) => {
        const dateA = new Date(a['預計開始日']);
        const dateB = new Date(b['預計開始日']);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateA - dateB;
    });

    // [核心修正] 確保 payload 中包含正確的 projectId
    const payload = { action: 'updateSchedule', projectId: projectId, scheduleData: scheduleData };

    fetch(`${API_BASE_URL}?page=project`, {
        method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
    })
        .catch(error => {
            console.error('儲存排程時發生錯誤:', error);
            alert('儲存失敗！請檢查您的網路連線。');
        })
        .finally(() => {
            btn.textContent = '儲存排程變更';
            btn.disabled = false;
            btn.classList.add('hidden'); // 儲存完成後，按鈕應該被隱藏，直到下一次變更
        });
}

export function showStartDatePicker(templateType) {    
    const pickerContainer = document.createElement('div');
    pickerContainer.style.display = 'none';
    document.body.appendChild(pickerContainer);

    const fp = flatpickr(pickerContainer, {
        defaultDate: 'today',
        dateFormat: 'Y-m-d',
        onClose: function(selectedDates) {
            if (selectedDates.length > 0) {
                const startDate = selectedDates[0].toISOString().split('T')[0];
                handleImportTemplate(templateType, startDate);
            }
            fp.destroy();
            if (pickerContainer.parentNode) {
                pickerContainer.parentNode.removeChild(pickerContainer);
            }
        }
    });
    fp.open();
}

/** 處理匯入範本 */
export function handleImportTemplate(templateType, startDate) {
    logToPage(`正在為專案匯入「${templateType}」範本，開工日設為 ${startDate}...`);
    const projectId = state.projectId; // [優化] 從全域 state 讀取 projectId
    const payload = { action: 'createFromTemplate', projectId, templateType, startDate };

    fetch(`${API_BASE_URL}?page=project`, {
        method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
    })
    .then(() => {
        alert(`範本「${templateType}」已成功匯入！頁面將重新載入以顯示最新排程。`);
        window.location.reload();
    })
    .catch(error => {
        console.error('儲存排程時發生網路錯誤:', error);
        alert('匯入範本失敗！請檢查您的網路連線或後端日誌。');
    });
}