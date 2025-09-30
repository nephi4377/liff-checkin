/*
* =============================================================================
* 檔案名稱: ui.js
* 專案名稱: 專案日誌管理主控台
* 版本: v1.0
* 說明: 專門負責將資料渲染成 HTML 畫面。
* =============================================================================
*/

import { state } from './state.js';
import { thumbLog, driveFileId } from './utils.js';

/** 顯示骨架屏 */
export function displaySkeletonLoader() {
    const scheduleContainer = document.getElementById('schedule-container');
    const logsContainer = document.getElementById('logs-container');

    const skeletonCardHTML = `
      <div class="skeleton-card">
        <div class="skeleton title"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line-short"></div>
      </div>
    `;

    if (scheduleContainer) {
        scheduleContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML}</div>`;
    }
    if (logsContainer) {
        logsContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML.repeat(3)}</div>`;
        logsContainer.style.display = 'block';
    }
}

/** 顯示錯誤訊息 */
export function displayError(err) {
    const msg = (err && err.message) ? err.message : '發生未知錯誤。';
    console.error('PAGE ERROR: ' + msg); // Log to console instead
    const statusContainer = document.getElementById('main-content');
    if (statusContainer) {
        statusContainer.innerHTML =
            `<div id="status-message" style="border:1px solid red;background:#ffebee;color:#c62828;padding:1rem;white-space:pre-wrap;margin:1rem;">
            <strong>載入失敗！</strong>\n\n
            <strong>錯誤訊息：</strong>\n${msg}\n\n
            <strong>建議：</strong>請檢查 Apps Script 後端日誌與路由設定（project）。
            </div>`;
    }
}

/** 渲染 Google Drive 圖片 */
function renderSmartImg(fileId) {
    const wrap = document.createElement('div'); wrap.className = 'photo-item';
    const img = document.createElement('img');
    img.className = 'photo-thumb lazy';
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w300`;
    const largeUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    img.dataset.full = largeUrl;
    img.dataset.src = thumbnailUrl;
    img.onerror = () => { const ph = document.createElement('div'); ph.className = 'photo-placeholder'; ph.textContent = '縮圖載入失敗'; wrap.replaceChildren(ph); };
    wrap.appendChild(img); return wrap;
}

/** 渲染一般圖片 */
function renderDirectImg(src) {
    const wrap = document.createElement('div'); wrap.className = 'photo-item';
    const img = document.createElement('img');
    img.className = 'photo-thumb lazy';

    if (src.startsWith('data:image/')) {
        img.dataset.src = src;
        img.dataset.full = src;
    } else {
        const lazySrc = src + (src.includes('?') ? '&' : '?') + '_=' + Date.now();
        img.dataset.src = lazySrc;
        img.dataset.full = src;
    }

    img.onload = () => thumbLog('IMG OK ' + img.src);
    img.onerror = () => {
        const ph = document.createElement('div'); ph.className = 'photo-placeholder';
        ph.textContent = '無法載入縮圖（點此開啟原圖）'; ph.style.cursor = 'pointer';
        ph.onclick = () => window.open(src, '_blank', 'noopener,noreferrer');
        wrap.replaceChildren(ph); thumbLog('IMG ERROR ' + img.src);
    };
    img.addEventListener('click', () => { window.__openLightbox__ ? __openLightbox__(img.dataset.full) : window.open(img.dataset.full, '_blank'); });
    wrap.appendChild(img); return wrap;
}

/** 建立照片牆 */
export function buildPhotoGrid(htmlLinksCsv) {
    const container = document.createElement('div');
    container.className = 'photo-grid';
    if (!htmlLinksCsv) return container;

    const links = Array.isArray(htmlLinksCsv) ? htmlLinksCsv : String(htmlLinksCsv).split(',');

    links.forEach(link => {
        const u = (link || '').trim(); if (!u) return;
        if (u.startsWith('data:image/')) {
            container.appendChild(renderDirectImg(u));
        } else if (u.charAt(0) === '/') {
            const ph = document.createElement('div'); ph.className = 'photo-placeholder'; ph.textContent = 'Dropbox 內部路徑（僅佔位）'; container.appendChild(ph);
        } else {
            const id = driveFileId(u);
            if (id) container.appendChild(renderSmartImg(id));
            else container.appendChild(renderDirectImg(u));
        }
    });
    return container;
}

/** 建立單張日誌卡片 */
export function _buildLogCard(log, isDraftMode) {
    const card = document.createElement('div'); card.className = 'card'; card.id = 'log-' + log.LogID;

    const timestamp = log.Timestamp ? new Date(log.Timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '-';
    const displayContent = (log.Content || '無內容').replace(/^\[更新 .*?\]\n/, '');

    const headerDiv = document.createElement('div');
    headerDiv.className = 'log-card-header';
    headerDiv.innerHTML = `
      <h3>${log.Title || '無標題'} <span class="muted">by ${log.UserName || '未知'}</span></h3>
      <small class="muted">${timestamp}</small>
    `;

    const contentDiv = document.createElement('div'); contentDiv.id = 'content-' + log.LogID;
    contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.textContent = displayContent;
    contentDiv.style.marginTop = '0.75rem';

    const photoContainer = document.createElement('div');
    const buttonContainer = document.createElement('div'); buttonContainer.className = 'button-group'; buttonContainer.style.marginTop = '1rem';

    card.appendChild(headerDiv);
    card.appendChild(contentDiv);
    card.appendChild(photoContainer);
    card.appendChild(buttonContainer);

    if (log.PhotoLinks) { photoContainer.appendChild(buildPhotoGrid(log.PhotoLinks)); }

    const btnManagePhotos = document.createElement('button'); btnManagePhotos.textContent = '管理相片'; btnManagePhotos.style.background = '#f59e0b';
    btnManagePhotos.dataset.action = 'openPhotoModal'; btnManagePhotos.dataset.logId = log.LogID; btnManagePhotos.dataset.photoLinks = log.PhotoLinks; buttonContainer.appendChild(btnManagePhotos);

    const btnEditText = document.createElement('button'); btnEditText.textContent = '編輯文字';
    btnEditText.dataset.action = 'handleEditText'; btnEditText.dataset.logId = log.LogID; buttonContainer.appendChild(btnEditText);

    if (isDraftMode) {
        const btnPublish = document.createElement('button');
        btnPublish.id = 'btn-' + log.LogID;
        btnPublish.textContent = '審核與發布';
        btnPublish.style.background = '#16a34a';
        btnPublish.dataset.action = 'handlePublish'; btnPublish.dataset.logId = log.LogID;
        buttonContainer.appendChild(btnPublish);
    }

    return card;
}

/**
 * 建立或更新日誌發文區塊
 */
export function renderPostCreator() {
    const wallPostCreatorHTML = `
    <div class="card post-creator">
      <textarea id="post-creator-textarea" class="form-textarea" placeholder="今天有什麼新進度嗎？"></textarea>
      <!-- [核心新增] 新增標題下拉選單 -->
      <div class="mt-1">
        <label for="post-title-select" class="form-label">標題 (可選)</label>
        <select id="post-title-select" class="form-select"></select>
      </div>
      <!-- [核心修正] 新增照片預覽容器和隱藏的檔案輸入框 -->
      <div id="new-log-photo-preview" class="photo-preview-container"></div>
      <input type="file" id="new-log-photos-input" multiple accept="image/*" style="display: none;">
      
      <div class="post-creator-actions">
        <div class="action-buttons">
          <button class="action-btn" id="add-photo-to-post-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M15.621 4.379a3 3 0 0 0-4.242 0l-7 7a3 3 0 0 0 4.241 4.243h.001l.497-.5a.75.75 0 0 1 1.064 1.057l-.498.501-.002.002a4.5 4.5 0 0 1-6.364-6.364l7-7a4.5 4.5 0 0 1 6.368 6.36l-3.455 3.553A2.625 2.625 0 1 1 9.52 9.52l3.45-3.451a.75.75 0 1 1 1.061 1.06l-3.45 3.452a1.125 1.125 0 0 1-1.591 0z" clip-rule="evenodd" /></svg>
            <span>附加檔案</span>
          </button>
        </div>
        <button id="submit-post-btn" class="btn btn-primary">發佈</button>
      </div>
    </div>
  `;
    return wallPostCreatorHTML;
}

/** 渲染日誌分頁 */
export function renderLogPage() {
    if (state.isLoadingNextPage) return;
    state.isLoadingNextPage = true;

    const logsContainer = document.getElementById('logs-container');
    const startIndex = (state.currentPage - 1) * state.LOGS_PER_PAGE;
    const endIndex = startIndex + state.LOGS_PER_PAGE;
    const logsToShow = state.currentLogsData.slice(startIndex, endIndex);

    if (state.currentPage === 1) {
        Array.from(logsContainer.children).forEach(child => {
            if (!child.classList.contains('post-creator')) {
                child.remove();
            }
        });
    }

    document.getElementById('log-loader')?.remove();

    if (logsToShow.length > 0) {
        const isDraftMode = (new URLSearchParams(window.location.search).get('id') === '0');
        logsToShow.forEach(log => { logsContainer.appendChild(_buildLogCard(log, isDraftMode)); });
        // [核心修正] 移除此處的呼叫，將其職責交還給 main.js
        // lazyLoadImages();
    }

    if (endIndex < state.currentLogsData.length) {
        const loaderElement = document.createElement('div');
        loaderElement.id = 'log-loader';
        loaderElement.innerHTML = '<div class="spinner" style="width:2rem;height:2rem;margin:1rem auto;"></div>';
        logsContainer.appendChild(loaderElement);
        if (state.scrollObserver) state.scrollObserver.observe(loaderElement);
    }
    state.isLoadingNextPage = false;
}

/** 渲染排程區塊 */
export function displaySchedule(overview, schedule) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    container.innerHTML = '';
    if (!overview || !schedule || !overview['專案起始日']) {
        container.style.display = 'none';
        return;
    }

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

    const listWrapper = document.createElement('div');
    listWrapper.className = 'schedule-list-wrapper card p-6';

    const listContainer = document.createElement('div');
    listContainer.id = 'schedule-list-container';
    listContainer.className = 'schedule-list';
    listWrapper.appendChild(listContainer);

    schedule.forEach((task, index) => {
        listContainer.appendChild(renderTaskCard(task, index));
    });

    const addTaskDiv = document.createElement('div');
    addTaskDiv.className = 'add-task-controls mt-4 pt-4 border-t flex justify-end items-center gap-4';
    addTaskDiv.innerHTML = `
      <button id="save-schedule-btn" class="btn btn-danger hidden">儲存排程變更</button>
      <button id="add-task-btn" class="btn btn-primary w-full md:w-auto">＋ 新增任務</button>
    `;
    listWrapper.appendChild(addTaskDiv);

    container.appendChild(progressWrapper);
    container.appendChild(listWrapper);

    document.getElementById('save-schedule-btn').dataset.action = 'handleSaveSchedule';
    document.getElementById('add-task-btn').dataset.action = 'handleAddTask';
}

/** 渲染單張任務卡片 */
export function renderTaskCard(task, index) {
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
            let newStartDate = null;
            if (selectedDates.length >= 1) {
                const startDate = new Date(selectedDates[0]).toLocaleDateString('sv');
                const endDate = new Date(selectedDates[selectedDates.length - 1]).toLocaleDateString('sv');
                if (startDateInput) startDateInput.value = startDate;
                if (endDateInput) endDateInput.value = endDate;
                newStartDate = selectedDates[0];
            }
            if (newStartDate) updateTaskPhaseByDate(card, newStartDate);
            // enableSaveButton(); // This will be handled by the event listener in main.js
        }
    });

    const statusSelect = card.querySelector('select[data-field="狀態"]');
    statusSelect.value = task['狀態'] || '未完成';
    const statusCell = card.querySelector('.status-cell');
    const setStatusColor = () => {
        statusCell.classList.remove('status-未完成', 'status-施工中', 'status-已完成');
        statusCell.classList.add(`status-${statusSelect.value}`);
    };
    setStatusColor();

    const tradeInput = card.querySelector('input[data-field="工種"]');
    tradeInput.dataset.action = 'filterLogsByWorkType';
    tradeInput.onchange = (e) => {
        const selectedTrade = e.target.value;
        const teamInput = card.querySelector('input[data-field="負責人/工班"]');
        const tradeContacts = new Map();
        state.currentScheduleData.forEach(t => {
            if (t && t['工種'] === selectedTrade && t['負責人/工班']) {
                const person = t['負責人/工班'];
                tradeContacts.set(person, (tradeContacts.get(person) || 0) + 1);
            }
        });

        if (teamInput && tradeContacts.size > 0) {
            const mostFrequentTeam = [...tradeContacts.entries()].sort((a, b) => b[1] - a[1])[0][0];
            teamInput.value = mostFrequentTeam;
        }

        const matchedTemplate = state.templateTasks.find(t => t['工種'] === selectedTrade || t['工種'] + '工程' === selectedTrade);
        if (matchedTemplate) {
            card.querySelector('input[data-field="任務項目"]').value = matchedTemplate['任務項目'] || '';
            card.querySelector('textarea[data-field="任務說明"]').value = matchedTemplate['任務說明'] || '';
        }
        // enableSaveButton();
    };

    card.querySelectorAll('input:not([data-field="工種"]), select, textarea').forEach(el => el.dataset.action = 'enableSaveButton');
    statusSelect.onchange = () => { setStatusColor(); };
    statusSelect.dataset.action = 'enableSaveButton';

    const deleteBtn = card.querySelector('.delete-task-btn');
    deleteBtn.dataset.action = 'deleteTask';
    deleteBtn.dataset.taskIndex = index;
    deleteBtn.dataset.taskName = task['任務項目'] || '新任務';

    return card;
}

/** 渲染右側專案資訊面板 */
export function displayProjectInfo(overview, schedule) {
    const panel = document.getElementById('project-info-panel');
    if (!panel) return;
    if (!overview) { panel.innerHTML = '<p class="muted">無專案資訊</p>'; return; }

    const get = (key) => overview[key] || '未提供';
    panel.innerHTML = `
      <div class="project-info-section">
        <h4 class="info-header">專案基本資料</h4>
        <ul class="info-list">
          <li><strong>案場名稱:</strong> ${get('案場名稱')}</li>
          <li><strong>案場地址:</strong> <a href="https://www.google.com/maps?q=${encodeURIComponent(get('案場地址'))}" target="_blank" rel="noopener noreferrer">${get('案場地址')}</a></li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">團隊成員</h4>
        <ul class="info-list">
          <li><strong>設計師:</strong> ${get('設計師')}</li>
          <li><strong>助理:</strong> ${get('助理')}</li>
          <li><strong>工務:</strong> ${get('工務')}</li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">現場資訊</h4>
        <ul class="info-list">
          <li><strong>入門方式:</strong> ${get('入門方式')}</li>
          <li><strong>停車方式:</strong> ${get('停車方式')}</li>
          <li><strong>施工進場時間:</strong> ${get('施工進場時間')}</li>
          <li><strong>保證金事宜:</strong> ${get('保證金事宜')}</li>
        </ul>
      </div>
      <hr class="info-divider">
      <div class="project-info-section">
        <h4 class="info-header">備註</h4>
        <ul class="info-list">
          <li><strong>管理中心電話:</strong> <a href="tel:${get('備註-管理中心電話')}">${get('備註-管理中心電話')}</a></li>
          <li><strong>施工時間:</strong> ${get('備註-施工時間')}</li>
          <li style="white-space: pre-wrap;"><strong>特別注意事項:</strong><br>${get('備註-特別注意事項')}</li>
        </ul>
      </div>
    `;

    const tradeContacts = new Map();
    if (schedule && schedule.length > 0) {
        schedule.forEach(task => {
            const trade = task['工種'];
            const person = task['負責人/工班'];
            if (trade && person) {
                if (!tradeContacts.has(trade)) tradeContacts.set(trade, new Set());
                tradeContacts.get(trade).add(person);
            }
        });
    }

    if (tradeContacts.size > 0) {
        let tradeHtml = '<hr class="info-divider"><div class="project-info-section"><h4 class="info-header">工班資訊</h4><ul class="info-list">';
        tradeContacts.forEach((persons, trade) => {
            tradeHtml += `<li><strong>${trade}:</strong> ${Array.from(persons).join(', ')}</li>`;
        });
        tradeHtml += '</ul></div>';
        panel.innerHTML += tradeHtml;
    }
}

/** 建立或更新工種的 datalist */
export function createOrUpdateTradeDatalist() {
    const coreTrades = ['木作工程', '系統工程', '水電工程', '泥作工程', '石材工程', '玻璃工程', '窗簾工程', '保護工程', '清潔工程'];
    let datalist = document.getElementById('trade-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'trade-datalist';
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = '';
    coreTrades.forEach(trade => {
        datalist.innerHTML += `<option value="${trade}"></option>`;
    });
}