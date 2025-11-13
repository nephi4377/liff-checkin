/*
 * =============================================================================
 * 檔案名稱: gantt_schedule_logic.js
 * 專案名稱: 專案日誌管理主控台 (甘特圖獨立頁面)
 * 版本: v1.0
 * 說明: 專門處理甘特圖的 UI 渲染與事件處理。
 * =============================================================================
 */

import { logToPage } from '../../shared/js/utils.js';
import { state } from './state.js';
import * as api from './api.js';
import { showGlobalNotification } from '../../shared/js/utils.js';

/**
 * 渲染整個甘特圖排程頁面。
 * @param {object} overview - 專案總覽資訊。
 * @param {Array<object>} schedule - 專案排程資料。
 */
export function renderGanttSchedulePage(overview, schedule) {
  const ganttWrapper = document.getElementById('gantt-chart-wrapper');
  if (!ganttWrapper) return;

  ganttWrapper.innerHTML = ''; // 清空舊內容

  if (!schedule || schedule.length === 0 || !overview || !overview['專案起始日'] || !overview['預計完工日']) {
    ganttWrapper.innerHTML = `
            <div class="text-center p-8 bg-gray-50 rounded-lg">
                <h3 class="text-lg font-semibold text-gray-700">此專案尚無排程</h3>
                <p class="text-gray-500 mt-2">您可以點擊右上角的「套用範本」按鈕來快速建立排程。</p>
            </div>
        `;
    return;
  }

  // 1. 資料重組：按工種分組
  const tasksByTrade = schedule.reduce((acc, task, index) => {
    const trade = task['工種'] || '未分類';
    if (!acc[trade]) {
      acc[trade] = [];
    }
    acc[trade].push({ ...task, originalIndex: index });
    return acc;
  }, {});

  // 2. 建立時間軸表頭
  const projectStartDate = new Date(overview['專案起始日'] + 'T00:00:00');
  const projectEndDate = new Date(overview['預計完工日'] + 'T00:00:00');
  const totalDays = Math.ceil((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24)) + 1;
  const DAY_WIDTH = 50; // 加大每日格子寬度
  const timelineTotalWidth = totalDays * DAY_WIDTH;

  let monthsHtml = '<div class="gantt-header-months">';
  let daysHtml = '<div class="gantt-header-days">';
  let todayMarkerLeft = -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentMonth = -1;
  let monthDayCount = 0;
  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(projectStartDate);
    currentDate.setDate(projectStartDate.getDate() + i);
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    if (month !== currentMonth) {
      if (currentMonth !== -1) {
        monthsHtml += `<div class="gantt-month" style="width: ${monthDayCount * DAY_WIDTH}px;">${currentDate.getFullYear()} / ${currentMonth + 1}</div>`;
      }
      currentMonth = month;
      monthDayCount = 0;
    }
    monthDayCount++;

    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    daysHtml += `<div class="gantt-day ${isWeekend ? 'weekend' : ''}" style="width: ${DAY_WIDTH}px;">${day}</div>`;

    if (currentDate.getTime() === today.getTime()) {
      todayMarkerLeft = i * DAY_WIDTH;
    }
  }
  // 補上最後一個月的 header
  if (monthDayCount > 0) {
    monthsHtml += `<div class="gantt-month" style="width: ${monthDayCount * DAY_WIDTH}px;">${projectEndDate.getFullYear()} / ${projectEndDate.getMonth() + 1}</div>`;
  }
  monthsHtml += '</div>';
  daysHtml += '</div>';

  // 3. 建立左側欄和右側時間軸主體
  let sidebarHtml = '';
  let timelineBodyHtml = '';

  for (const trade in tasksByTrade) {
    const tasks = tasksByTrade[trade];
    const validTasks = tasks.filter(t => t['預計開始日'] && t['預計完成日']);
    const earliestStart = new Date(Math.min(...validTasks.map(t => new Date(t['預計開始日'] + 'T00:00:00'))));
    const latestEnd = new Date(Math.max(...validTasks.map(t => new Date(t['預計完成日'] + 'T00:00:00'))));
    const tradeDuration = validTasks.length > 0 ? (latestEnd - earliestStart) / (1000 * 60 * 60 * 24) + 1 : 0;

    sidebarHtml += `
      <div class="gantt-row-label">
        <div class="font-bold">${trade}</div>
        <div class="text-xs text-gray-500">${earliestStart.toLocaleDateString('sv')} ~ ${latestEnd.toLocaleDateString('sv')} (${tradeDuration}天)</div>
      </div>`;

    let rowContent = `<div class="gantt-row-bars" style="width: ${timelineTotalWidth}px;">`;
    tasks.forEach(task => {
      const taskStart = new Date(task['預計開始日'] + 'T00:00:00');
      const taskEnd = new Date(task['預計完成日'] + 'T00:00:00');
      if (isNaN(taskStart) || isNaN(taskEnd)) return;

      const startOffsetDays = (taskStart - projectStartDate) / (1000 * 60 * 60 * 24);
      const durationDays = (taskEnd - taskStart) / (1000 * 60 * 60 * 24) + 1;

      const left = startOffsetDays * DAY_WIDTH;
      const width = durationDays * DAY_WIDTH - 2; // -2 for a small gap

      let barColorClass = 'bg-blue-500';
      if (task['狀態'] === '已完成') barColorClass = 'bg-green-500';
      else if (task['狀態'] === '施工中') barColorClass = 'bg-yellow-500';

      const title = `${task['任務項目']}\n時程: ${task['預計開始日']} ~ ${task['預計完成日']}\n狀態: ${task['狀態']}`;

      rowContent += `<div class="gantt-bar ${barColorClass}" style="left: ${left}px; width: ${width}px;" title="${title}" data-task-index="${task.originalIndex}">
          <span class="truncate">${task['任務項目']}</span>
      </div>`;
    });
    rowContent += '</div>';
    timelineBodyHtml += rowContent;
  }

  // 4. 組合最終 HTML
  ganttWrapper.innerHTML = `
        <div class="tabular-gantt-container">
            <div class="gantt-sidebar">
                <div class="gantt-header-corner">工程項目</div>
                ${sidebarHtml}
            </div>
            <div class="gantt-main-area">
                <div class="gantt-timeline-header">${monthsHtml}${daysHtml}</div>
                <div class="gantt-timeline-body" style="width: ${timelineTotalWidth}px;">
                    ${timelineBodyHtml}
                    ${todayMarkerLeft !== -1 ? `<div class="gantt-today-marker" style="left: ${todayMarkerLeft + (DAY_WIDTH / 2)}px;"></div>` : ''}
                </div>
            </div>
        </div>
    `;

  // 5. 滾動到今天
  const mainArea = ganttWrapper.querySelector('.gantt-main-area');
  if (mainArea && todayMarkerLeft !== -1) {
    const viewportWidth = mainArea.clientWidth;
    mainArea.scrollLeft = todayMarkerLeft - (viewportWidth / 2) + (DAY_WIDTH / 2);
  }

  // 6. 綁定拖曳事件
  attachDragEvents(ganttWrapper, projectStartDate, DAY_WIDTH);
}

/**
 * 輔助函式：將後端 schedule 資料轉換為 Frappe Gantt 需要的格式。
 * @param {Array<object>} scheduleData - 來自後端的排程資料 (state.currentScheduleData)。
 * @returns {Array<object>} Frappe Gantt 格式的任務陣列。
 */
function attachDragEvents(container, projectStartDate, dayWidth) {
  let draggedBar = null;
  let startX = 0;
  let originalLeft = 0;
  let cloneBar = null; // 用於拖曳時的視覺回饋

  container.addEventListener('mousedown', (e) => {
    const bar = e.target.closest('.gantt-bar');
    if (!bar) return;

    draggedBar = bar;
    startX = e.clientX;
    originalLeft = draggedBar.offsetLeft;

    // 複製一個假的 bar 用於拖曳，避免影響原始 bar 的佈局
    cloneBar = draggedBar.cloneNode(true);
    cloneBar.style.position = 'absolute';
    cloneBar.style.opacity = '0.7';
    cloneBar.style.pointerEvents = 'none'; // 避免干擾 mouseup 事件
    cloneBar.style.zIndex = '20';
    draggedBar.parentElement.appendChild(cloneBar);

    draggedBar.style.opacity = '0.3'; // 讓原始 bar 變淡

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp, { once: true }); // 確保只觸發一次
  });

  function onMouseMove(e) {
    if (!cloneBar) return;
    e.preventDefault();

    const dx = e.clientX - startX;
    cloneBar.style.left = `${originalLeft + dx}px`;
  }

  function onMouseUp(e) {
    if (!draggedBar || !cloneBar) return;

    const dx = e.clientX - startX;
    const dayOffset = Math.round(dx / dayWidth);

    const taskIndex = parseInt(draggedBar.dataset.taskIndex, 10);
    const task = state.currentScheduleData[taskIndex];

    if (task && dayOffset !== 0) {
      const oldStartDate = new Date(task['預計開始日'] + 'T00:00:00');
      const oldEndDate = new Date(task['預計完成日'] + 'T00:00:00');
      const duration = (oldEndDate - oldStartDate);

      const newStartDate = new Date(oldStartDate);
      newStartDate.setDate(newStartDate.getDate() + dayOffset);

      const newEndDate = new Date(newStartDate.getTime() + duration);

      // 更新 state
      task['預計開始日'] = newStartDate.toLocaleDateString('sv');
      task['預計完成日'] = newEndDate.toLocaleDateString('sv');

      logToPage(`任務 "${task['任務項目']}" 已移動至 ${task['預計開始日']}`);
      enableSaveButton();
    }

    // 清理
    cloneBar.remove();
    cloneBar = null;
    draggedBar.style.opacity = '1';
    draggedBar = null;
    document.removeEventListener('mousemove', onMouseMove);

    // 只有在日期有變動時才重新渲染
    if (dayOffset !== 0) {
      renderGanttSchedulePage(state.overview, state.currentScheduleData);
    }
  }
}

/**
 * 輔助函式：當甘特圖互動時，更新 state.currentScheduleData。
 * @param {string} taskId - 任務的唯一 ID (e.g., "task_0")。
 * @param {object} changes - 包含變更的物件 { start: Date, end: Date, progress: number }。
 */
function updateTaskData(taskId, changes) {
    // 此函式在新的表格化甘特圖中暫時不需要，因為我們移除了拖曳互動
}

/** 啟用儲存按鈕 */
export function enableSaveButton() {
    const btn = document.getElementById('save-schedule-btn');
    if (btn) btn.classList.remove('hidden');
}

/** 處理儲存排程 */
export function handleSaveSchedule() {
    const btn = document.getElementById('save-schedule-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '儲存中...';
    }

    // 【⭐️ 樂觀更新 1/3：立即更新 UI ⭐️】
    // 由於 Frappe Gantt 的 UI 已經是最新狀態，我們只需要隱藏儲存按鈕，讓使用者感覺操作已完成。
    if (btn) {
        btn.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = '儲存排程變更';
    }
    showGlobalNotification('排程變更已儲存！', 3000, 'success');

    // 【⭐️ 樂觀更新 2/3：立即更新快取 ⭐️】
    // 直接使用 state.currentScheduleData，因為它已經被甘特圖的互動即時更新了。
    // 我們需要將它與 overview 等其他資料一起存入快取。
    saveCache(state.cacheKey, {
        overview: state.overview,
        schedule: state.currentScheduleData,
        userName: state.currentUserName,
        templateTasks: state.templateTasks
    });
    logToPage(`[Cache] 已樂觀更新排程資料至快取 (${state.cacheKey})。`);

    // 【⭐️ 樂觀更新 3/3：在背景發送請求 ⭐️】
    const payload = { 
        action: 'updateSchedule', 
        projectId: state.projectId, 
        scheduleData: state.currentScheduleData, // 直接使用 state 中的最新資料
        userId: state.currentUserId,
        userName: state.currentUserName
    };

    logToPage('💾 正在儲存排程變更...');

    api.postTask(payload)
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                // 後端成功，前端什麼都不用做，因為畫面和快取都已經是新的了。
                logToPage(`✅ 後端成功同步排程資料。`);
            } else {
                // 後端失敗，顯示錯誤訊息並提示使用者刷新。
                showGlobalNotification(`後端同步失敗: ${finalJobState.result?.message || '未知錯誤'}，請刷新頁面。`, 8000, 'error');
                // 在更複雜的應用中，可以在此處觸發回滾 UI 的邏輯。
            }
        })
        .catch(error => showGlobalNotification(`請求失敗: ${error.message}`, 8000, 'error'));
}

/**
 * 處理新增任務。
 * - 在甘特圖中新增一個空白任務。
 * - 自動啟用儲存按鈕。
 */
export function handleAddTask() {
    // 建立一個新的空白任務物件
    const newTaskData = {
        '案號': state.projectId,
        '階段': '未分類',
        '工種': '新工種',
        '任務項目': '新任務',
        '任務說明': '',
        '負責人/工班': '',
        '狀態': '未完成',
        '預計開始日': new Date().toLocaleDateString('sv'),
        '預計完成日': new Date(new Date().setDate(new Date().getDate() + 7)).toLocaleDateString('sv'), // 預設一週工期
        '備註': '',
    };

    // 將新任務加入到 state.currentScheduleData
    state.currentScheduleData.push(newTaskData);
    logToPage('＋ 已新增一筆空白任務到資料中。');

    // 重新渲染甘特圖以顯示新任務
    // 這裡需要重新初始化整個甘特圖，因為 Frappe Gantt 沒有直接的 addTask API
    renderGanttSchedulePage(state.overview, state.currentScheduleData);

    // 啟用儲存按鈕
    enableSaveButton();
    showGlobalNotification('＋ 已新增一筆空白任務，請在甘特圖上編輯後儲存。', 5000, 'info');
}

/**
 * 顯示日期選擇器以匯入範本。
 * @param {string} templateType - 範本類型 ('新屋案' 或 '老屋案')。
 * @param {HTMLElement} anchorElement - 觸發此函式的按鈕元素。
 */
export function showStartDatePicker(templateType, anchorElement) {
    const anchor = anchorElement || document.querySelector('header');

    const fp = flatpickr(anchor, {
        defaultDate: 'today',
        dateFormat: 'Y-m-d',
        onClose: function(selectedDates) {
            if (selectedDates.length > 0) {
                const startDate = selectedDates[0].toISOString().split('T')[0];
                if (confirm(`您確定要為此專案套用「${templateType}」範本，並將開工日設為 ${startDate} 嗎？\n\n此操作將會新增多筆排程項目。`)) {
                    handleImportTemplate(templateType, startDate);
                } else {
                    logToPage('使用者取消了範本匯入操作。');
                }
            }
            fp.destroy();
        }
    });
    fp.open();
}

/**
 * 處理匯入範本的邏輯。
 * @param {string} templateType - 範本類型。
 * @param {string} startDate - 開工日期。
 */
export function handleImportTemplate(templateType, startDate) {
    if (state.currentScheduleData && state.currentScheduleData.length > 0) {
        showGlobalNotification('操作已取消：此專案似乎已有排程資料。', 5000, 'error');
        logToPage('❌ 偵測到重複的範本匯入操作，已自動中止。');
        return;
    }
    logToPage(`正在為專案匯入「${templateType}」範本，開工日設為 ${startDate}...`);
    const projectId = state.projectId;
    const payload = { 
        action: 'createFromTemplate', 
        projectId, 
        templateType, 
        startDate,
        userId: state.currentUserId,
        userName: state.currentUserName
    };
    
    showGlobalNotification('正在從範本建立排程...', 5000, 'info');

    api.postTask(payload)
        .then(finalJobState => {
            if (finalJobState.result && finalJobState.result.success) {
                showGlobalNotification('排程已成功建立！正在刷新畫面...', 3000, 'success');
                window.location.reload(); // 重新載入頁面以顯示新排程
            } else {
                showGlobalNotification(`建立失敗：${finalJobState.result.message || '未知錯誤'}`, 8000, 'error');
            }
        })
        .catch(error => showGlobalNotification(`請求失敗：${error.message}`, 8000, 'error'));
}