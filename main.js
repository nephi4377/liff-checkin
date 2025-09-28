/*
* =============================================================================
* 檔案名稱: main.js
* 專案名稱: 專案日誌管理主控台
* 版本: v13.0 (穩定版)
* 修改時間: 2025-09-27 10:54 (Asia/Taipei)
*
* 核心功能:
* 1.  **資料處理與API串接**:
* - 透過 JSONP 從 Google Apps Script 後端獲取專案總覽、排程、日誌與範本資料。
* - 處理後端回傳的資料，並將其存入前端狀態變數。
* - 負責將前端的修改（如文字編輯、照片管理、排程變更）傳送回後端儲存。
*
* 2.  **UI渲染與互動**:
* - **排程管理**: 顯示多色進度條、可編輯的任務卡片列表、並可從範本新增任務。
* - **日誌顯示**: 將日誌資料渲染成卡片列表，包含照片牆。
* - **互動功能**: 提供文字即時編輯、照片管理模組 (Modal)、圖片燈箱 (Lightbox) 等功能。
*
* 3.  **效能優化**:
* - **骨架屏 (Skeleton Screen)**: 在等待API資料時，顯示頁面輪廓以改善使用者體驗。
* - **圖片懶加載 (Lazy Loading)**: 日誌中的圖片會等到滾動至可視範圍才載入。
* - **日誌分頁 (Pagination)**: 日誌列表採用前端分頁，滾動到底部時自動載入下一批，避免一次性渲染大量DOM。
* =============================================================================
*/

/*
* 版本: v12.0 (Refactored)
* 修改時間: 2025-09-26 17:50 (Asia/Taipei)
* 說明: 從 HTML 中分離出的獨立 JavaScript 檔案。
*/
/* ===== 全域狀態 ===== */
let currentEditingLogId = null;
let currentLogsData = [];
let currentScheduleData = [];
let templateTasks = []; // 儲存從範本中解析出的可選任務列表
const DEBUG_THUMBS = true;

/* ===== 工具：除錯輸出 ===== */
function thumbLog(msg){
  if(!DEBUG_THUMBS) return;
  console.log('[THUMB]', msg);
  const el = document.getElementById('debug-log');
  if(!el) return;
  const t = new Date().toLocaleTimeString('zh-TW');
  el.textContent += '[' + t + '][THUMB] ' + msg + '\n';
  el.scrollTop = el.scrollHeight;
}
function logToPage(message){
  const el = document.getElementById('debug-log');
  if(!el) return;
  const t = new Date().toLocaleTimeString('zh-TW');
  el.textContent += '[' + t + '] ' + message + '\n';
  el.scrollTop = el.scrollHeight;
}

/* ===== JSONP 呼叫器 ===== */
function loadJsonp(url){
  return new Promise((resolve, reject) => {
    const cb = 'jsonp_' + Math.random().toString(36).slice(2);
    const timer = setTimeout(() => { cleanup(); reject(new Error('請求後端資料超時 (15秒)。')); }, 15000);
    function cleanup(){ clearTimeout(timer); delete window[cb]; if(script.parentNode) script.parentNode.removeChild(script); }
    window[cb] = (data) => { cleanup(); resolve(data); };
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    script.onerror = () => { cleanup(); reject(new Error('載入後端資料失敗。')); };
    document.body.appendChild(script);
  });
}

/*
* 版本: v12.4
* 修改時間: 2025-09-27 10:24 (Asia/Taipei)
* 說明: 新增用於顯示骨架屏的函式。
*/
// --- 這是新函式，請將其加入 main.js ---
function displaySkeletonLoader() {
  const scheduleContainer = document.getElementById('schedule-container');
  const logsContainer = document.getElementById('logs-container');

  // 產生單張骨架卡片的 HTML
  const skeletonCardHTML = `
    <div class="skeleton-card">
      <div class="skeleton title"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line-short"></div>
    </div>
  `;

  // 清空並填入骨架屏
  if (scheduleContainer) {
    // [核心修正] 骨架屏只應在對應區塊產生，不應改變其容器的可見性。
    // 由於排程頁非預設顯示，此處不應主動顯示它。
    scheduleContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML}</div>`;
  }
  if (logsContainer) {
    logsContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML.repeat(3)}</div>`;
    // [核心修正] 確保在骨架屏階段，只有日誌區塊是可見的。
    logsContainer.style.display = 'block';
  }
}


function displayError(err){
  const msg = (err && err.message) ? err.message : '發生未知錯誤。';
  logToPage('PAGE ERROR: ' + msg);
  const status = document.getElementById('status-message');
  if(status){
    status.innerHTML =
      '<div style="border:1px solid red;background:#ffebee;color:#c62828;padding:1rem;white-space:pre-wrap;">' +
      '<strong>載入失敗！</strong>\n\n' +
      '<strong>錯誤訊息：</strong>\n' + msg + '\n\n' +
      '<strong>建議：</strong>請檢查 Apps Script 後端日誌與路由設定（project）。' +
      '</div>';
  }
}

/* ===== Drive 影像工具 ===== */
function driveFileId(u){
  if(!u) return '';
  u = String(u).trim();
  let m;
  m = u.match(/[?&](?:id|fileId)=([a-zA-Z0-9_-]+)/); if(m) return m[1];
  m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);      if(m) return m[1];
  m = u.match(/\/open\?id=([a-zA-Z0-9_-]+)/);      if(m) return m[1];
  return '';
}
/*
* 版本: v12.5
* 修改時間: 2025-09-27 10:31 (Asia/Taipei)
* 說明: 實作圖片懶加載。將圖片的真實 src 存放在 data-src 中，並加上 'lazy' class。
*/
function renderSmartImg(fileId){
  const wrap = document.createElement('div'); wrap.className = 'photo-item';
  const img = document.createElement('img');
  // [修改] 加上 lazy class，並將真實 src 存入 data-src
  img.className = 'photo-thumb lazy';
  const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w300';
  const largeUrl     = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';
  img.dataset.full = largeUrl;
  img.dataset.src = thumbnailUrl; // [修改]
  img.onerror = () => { const ph = document.createElement('div'); ph.className='photo-placeholder'; ph.textContent='縮圖載入失敗'; wrap.replaceChildren(ph); };
  wrap.appendChild(img); return wrap;
}

function renderDirectImg(src){
  const wrap = document.createElement('div'); wrap.className = 'photo-item';
  const img  = document.createElement('img');
  // [修改] 加上 lazy class，並將真實 src 存入 data-src
  img.className  = 'photo-thumb lazy';
  const lazySrc = src + (src.includes('?') ? '&' : '?') + '_=' + Date.now();
  img.dataset.src = lazySrc; // [修改]
  img.dataset.full = src;
  img.onload  = () => thumbLog('IMG OK ' + img.src);
  img.onerror = () => {
    const ph = document.createElement('div'); ph.className='photo-placeholder';
    ph.textContent = '無法載入縮圖（點此開啟原圖）'; ph.style.cursor='pointer';
    ph.onclick = () => window.open(src, '_blank', 'noopener,noreferrer');
    wrap.replaceChildren(ph); thumbLog('IMG ERROR ' + img.src);
  };
  img.addEventListener('click', () => { window.__openLightbox__ ? __openLightbox__(img.dataset.full) : window.open(img.dataset.full, '_blank'); });
  wrap.appendChild(img); return wrap;
}

function buildPhotoGrid(htmlLinksCsv){
  const container = document.createElement('div'); container.className = 'photo-grid';
  if(!htmlLinksCsv) return container;
  String(htmlLinksCsv).split(',').forEach(link => {
    const u = (link || '').trim(); if(!u) return;
    if(u.charAt(0) === '/'){ const ph = document.createElement('div'); ph.className='photo-placeholder'; ph.textContent='Dropbox 內部路徑（僅佔位）'; container.appendChild(ph); return; }
    const id = driveFileId(u); if(id) container.appendChild(renderSmartImg(id)); else container.appendChild(renderDirectImg(u));
  });
  return container;
}

/* ===== 日誌卡片 ===== */
function _buildLogCard(log, isDraftMode){
  const card = document.createElement('div'); card.className = 'card'; card.id = 'log-' + log.LogID;

  const timestamp = log.Timestamp ? new Date(log.Timestamp).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}) : '-';
  const updatedMatch = (log.Content || '').match(/^\[更新 (.*?)\]\n/);
  const displayContent = (log.Content || '無內容').replace(/^\[更新 .*?\]\n/, '');
  const lastModifiedDisplay = updatedMatch ? updatedMatch[1] : '無';

  const h3 = document.createElement('h3'); h3.textContent = log.Title || '無標題';
  const info1 = document.createElement('small'); info1.className='muted';
  info1.textContent = '案場: ' + (log.ProjectName || '未知') + '｜回報人: ' + (log.UserName || '未知');
  const info2 = document.createElement('small'); info2.className='muted'; info2.style.display='block'; info2.style.marginTop='.25rem';
  info2.textContent = '建立: ' + timestamp + '｜最後更新: ' + lastModifiedDisplay;
  const hr = document.createElement('hr'); hr.className='my-3';

  const contentDiv = document.createElement('div'); contentDiv.id = 'content-' + log.LogID;
  contentDiv.style.whiteSpace = 'pre-wrap'; contentDiv.textContent = displayContent;

  const photoContainer = document.createElement('div');
  const buttonContainer = document.createElement('div'); buttonContainer.className='button-group'; buttonContainer.style.marginTop='1rem';

  card.appendChild(h3); card.appendChild(info1); card.appendChild(info2); card.appendChild(hr);
  card.appendChild(contentDiv); card.appendChild(photoContainer); card.appendChild(buttonContainer);

  if(log.PhotoLinks){ photoContainer.appendChild(buildPhotoGrid(log.PhotoLinks)); logToPage('...['+log.LogID+'] 照片牆已建立'); }

  const btnManagePhotos = document.createElement('button'); btnManagePhotos.textContent='管理相片'; btnManagePhotos.style.background='#f59e0b';
  btnManagePhotos.onclick = () => openPhotoModal(log.LogID, log.PhotoLinks); buttonContainer.appendChild(btnManagePhotos);

  const btnEditText = document.createElement('button'); btnEditText.textContent='編輯文字';
  btnEditText.onclick = () => handleEditText(log.LogID); buttonContainer.appendChild(btnEditText);

  if(isDraftMode){ const btnPublish = document.createElement('button'); btnPublish.id='btn-'+log.LogID; btnPublish.textContent='審核與發布'; btnPublish.style.background='#16a34a'; btnPublish.onclick = () => handlePublish(log.LogID); buttonContainer.appendChild(btnPublish); }

  return card;
}

function displayLogs(logs, isDraftMode){
  logToPage('➡️ displayLogs: 渲染中...');
  const container = document.getElementById('logs-container');
  document.getElementById('status-message')?.remove();
  container.innerHTML = '';
  if(!Array.isArray(logs) || logs.length === 0){
    container.innerHTML = '<div class="card"><p class="muted" style="text-align:center;">沒有可顯示的日誌。</p></div>'; return;
  }
  currentLogsData = logs;
  logs.forEach((log, i) => { container.appendChild(_buildLogCard(log, isDraftMode)); logToPage('   ['+(i+1)+'/'+logs.length+'] LogID: '+log.LogID); });
  logToPage('✅ 日誌渲染完畢');
}

function displayLogsFiltered(logs, isFiltered=false){
  const container = document.getElementById('logs-container');
  const isDraftMode = (new URLSearchParams(window.location.search).get('id') === '0');

  if(!isFiltered){ container.innerHTML=''; } else { Array.from(container.getElementsByClassName('card')).forEach(c => c.remove()); }
  if(!Array.isArray(logs) || logs.length===0){
    container.insertAdjacentHTML('beforeend','<div class="card"><p class="muted" style="text-align:center;">沒有符合條件的日誌。</p></div>'); return;
  }
  logs.forEach(log => container.appendChild(_buildLogCard(log, isDraftMode)));
}

/* ===== 進度總覽（時間軸＋工種點選） ===== */
/* ===== 核心渲染與互動函式 ===== */
function displaySchedule(overview, schedule, keepOpen = false){ // [核心修改] 新增參數，預設為 false
  const container = document.getElementById('schedule-container');
  if (!container) return;
  container.innerHTML = '';
  if (!overview || !schedule || schedule.length === 0 || !overview['專案起始日']) {
      container.style.display = 'none';
      return;
  }

  // [核心修改 1] 建立獨立的進度條容器
  const progressWrapper = document.createElement('div');
  // [核心需求 1] 加上 sticky 樣式，讓進度條鎖定在頂部
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
  const endDate   = new Date(overview['預計完工日']);
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
      segment.style.left = `${( (phaseStartDate - startDate) / totalDuration) * 100}%`;
      segment.style.backgroundColor = PHASE_COLORS[phase] || PHASE_COLORS['預設'];
      segment.title = `${phase}: ${Math.round(phaseDuration / (1000*60*60*24)) + 1}天`;
      timeline.appendChild(segment);
  });
  const todayMarkerPosition = Math.max(0, Math.min(100, ((new Date() - startDate) / totalDuration) * 100));
  timeline.innerHTML += `<div class="today-marker" style="left:${todayMarkerPosition}%;"></div>`;
  progressWrapper.appendChild(timeline);

  const listWrapper = document.createElement('div');
  listWrapper.className = 'schedule-list-wrapper card p-6'; // 直接使用 card 樣式
  
  const listContainer = document.createElement('div');
  listContainer.id = 'schedule-list-container';
  listContainer.className = 'schedule-list';
  listWrapper.appendChild(listContainer);

  schedule.forEach((task, index) => {
      listContainer.appendChild(renderTaskCard(task, index));
  });
  
  const addTaskDiv = document.createElement('div');
  // [核心修正] 將儲存按鈕整合到新增任務的控制區塊中
  addTaskDiv.className = 'add-task-controls mt-4 pt-4 border-t flex justify-end items-center gap-4';
  addTaskDiv.innerHTML = `
    <button id="save-schedule-btn" class="btn btn-danger hidden">儲存排程變更</button>
    <button id="add-task-btn" class="btn btn-primary w-full md:w-auto">＋ 新增任務</button>
  `;
  listWrapper.appendChild(addTaskDiv);

  // 將所有元件依序加入頁面
  container.appendChild(progressWrapper); // [核心修改 1] 將獨立的進度條放在最前面
  container.appendChild(listWrapper); // 直接加入任務列表，不再有摺疊面板

  // 綁定事件
  document.getElementById('save-schedule-btn').onclick = handleSaveSchedule;
  document.getElementById('add-task-btn').onclick = handleAddTask;
}

// 將渲染單張卡片的邏輯抽成獨立函式
function renderTaskCard(task, index) {
  // [重構] 使用 utility classes 來定義卡片樣式
  const card = document.createElement('div');
  // [修復] 加上 bg-white 和 shadow class 來恢復卡片視覺感
  card.className = 'task-card bg-white p-4 rounded-lg shadow grid grid-cols-1 md:grid-cols-5 gap-4 relative';
  card.id = `task-card-${index}`;
  card.dataset.taskIndex = index;

  // [重構] 使用 utility classes 和模板字串來建構內部 HTML
  card.innerHTML = `
    <!-- 區塊 1: 階段/工種 -->
    <div class="flex flex-col gap-1">
      <label class="form-label">階段 / 工種</label>
      <div class="phase-tag">${task['階段'] || '未分類'}</div>
      <!-- [核心需求] 將工種輸入框與 datalist 綁定 -->
      <input type="text" data-field="工種" value="${task['工種'] || ''}" class="form-input" list="trade-datalist" autocomplete="off">
    </div>
    <!-- 區塊 2: 任務項目 (在桌面版跨越兩欄) -->
    <div class="md:col-span-2 flex flex-col gap-1">
      <label class="form-label">任務項目 / 說明</label>
      <input type="text" class="form-input font-semibold" data-field="任務項目" value="${task['任務項目'] || ''}" placeholder="請輸入任務項目">
      <textarea data-field="任務說明" class="form-textarea" placeholder="任務的詳細說明...">${task['任務說明'] || ''}</textarea>
    </div>
    <!-- 區塊 3: 工班/狀態 -->
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
    <!-- 區塊 4: 日期/備註/操作 -->
    <div class="flex flex-col gap-1">
      <label class="form-label">預計時程 / 備註</label>
      <input type="text" class="date-range-picker form-input" placeholder="點擊選擇日期範圍">
      <!-- [核心修正] 新增兩個隱藏的 input，專門用來給 handleSaveSchedule 讀取日期 -->
      <!-- [核心修正] 在渲染時就對日期格式進行標準化，只取 YYYY-MM-DD 部分 -->
      <input type="hidden" data-field="預計開始日" value="${(task['預計開始日'] || '').split('T')[0]}">
      <input type="hidden" data-field="預計完成日" value="${(task['預計完成日'] || '').split('T')[0]}">
      <textarea data-field="備註" class="form-textarea" placeholder="備註...">${task['備註'] || ''}</textarea>
    </div>
    <button class="delete-task-btn" title="刪除此任務">&times;</button>
  `;
  
  // [新增] 初始化 flatpickr 日期範圍選擇器
  const datePicker = card.querySelector('.date-range-picker');
  const fpInstance = flatpickr(datePicker, {
    mode: "range",
    dateFormat: "Y-m-d", // 實際儲存的格式 (保持不變)
    altInput: true,      // [新增] 產生一個用於顯示的額外輸入框
    altFormat: "m-d",    // [新增] 設定顯示格式為「月-日」
    defaultDate: [task['預計開始日'], task['預計完成日']].filter(Boolean), // 如果有日期就設定預設值
    locale: "zh_tw", // 使用繁體中文語系
    // [核心修正] onClose 取代 onChange，確保在使用者確認日期後才觸發
    onClose: function(selectedDates, dateStr, instance) {
      const startDateInput = card.querySelector('input[data-field="預計開始日"]');
      const endDateInput = card.querySelector('input[data-field="預計完成日"]');
      let newStartDate = null;

      if (selectedDates.length === 2) {
        const startDate = new Date(selectedDates[0]).toLocaleDateString('sv');
        const endDate = new Date(selectedDates[1]).toLocaleDateString('sv');
        if (startDateInput) startDateInput.value = startDate;
        if (endDateInput) endDateInput.value = endDate;
        newStartDate = selectedDates[0];
      } else if (selectedDates.length === 1) { // 如果只選一天
        const singleDate = new Date(selectedDates[0]).toLocaleDateString('sv');
        if (startDateInput) startDateInput.value = singleDate;
        if (endDateInput) endDateInput.value = singleDate;
        newStartDate = selectedDates[0];
      }

      // [核心需求] 當日期被修改後，呼叫新函式來智慧更新階段
      if (newStartDate) updateTaskPhaseByDate(card, newStartDate);

      enableSaveButton(); // 啟用儲存按鈕
    }
  });

  const statusSelect = card.querySelector('select[data-field="狀態"]');
  statusSelect.value = task['狀態'] || '未完成';
  const statusCell = card.querySelector('.status-cell');
  const setStatusColor = () => { // [修正] 使用 classList 避免覆蓋其他 class
    statusCell.classList.remove('status-未完成', 'status-施工中', 'status-已完成');
    statusCell.classList.add(`status-${statusSelect.value}`);
  };
  setStatusColor();

  // [核心需求] 為工種輸入框加上特殊的 onchange 事件
  const tradeInput = card.querySelector('input[data-field="工種"]');
  if (tradeInput) {
    tradeInput.onchange = (e) => {
      const selectedTrade = e.target.value;
      const teamInput = card.querySelector('input[data-field="負責人/工班"]');
      
      // [核心需求 2] 根據選擇的工種，從現有排程中智慧判斷並填入工班
      const tradeContacts = new Map();
      currentScheduleData.forEach(task => {
        if (task && task['工種'] === selectedTrade && task['負責人/工班']) {
          const person = task['負責人/工班'];
          tradeContacts.set(person, (tradeContacts.get(person) || 0) + 1);
        }
      });

      if (teamInput && tradeContacts.size > 0) {
        // 找到最常出現的工班
        const mostFrequentTeam = [...tradeContacts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        teamInput.value = mostFrequentTeam;
        logToPage(`已根據工種 "${selectedTrade}" 自動帶入最常用的工班: ${mostFrequentTeam}`);
      }

      // [舊邏輯] 繼續根據範本自動填入任務項目和說明
      const matchedTemplate = templateTasks.find(t => t['工種'] === selectedTrade || t['工種'] + '工程' === selectedTrade);

      if (matchedTemplate) {
        const taskItemInput = card.querySelector('input[data-field="任務項目"]');
        const taskDescTextarea = card.querySelector('textarea[data-field="任務說明"]');

        if (taskItemInput) taskItemInput.value = matchedTemplate['任務項目'] || '';
        if (taskDescTextarea) taskDescTextarea.value = matchedTemplate['任務說明'] || '';
        logToPage(`已根據工種 "${selectedTrade}" 自動帶入範本資料。`);
      }
      enableSaveButton();
    };
  }
  card.querySelectorAll('input:not([data-field="工種"]), select, textarea').forEach(el => el.oninput = enableSaveButton);
  statusSelect.onchange = () => { enableSaveButton(); setStatusColor(); };

  card.querySelector('.delete-task-btn').onclick = () => {
    if (confirm(`確定要刪除任務「${task['任務項目'] || '新任務'}」嗎？`)) {
      // [核心修正] 不直接移除 DOM，而是將其隱藏並在資料層標記為 null
      // 這樣在儲存時才能正確地從 scheduleData 中排除它
      card.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
      card.style.opacity = '0';
      card.style.maxHeight = '0px';
      setTimeout(() => card.style.display = 'none', 300);
      currentScheduleData[index] = null; // 標記為待刪除
      enableSaveButton();
    }
  };
  return card;
}

// [新函式] 根據任務日期，智慧更新其所屬的階段
function updateTaskPhaseByDate(taskCardElement, targetDate) {
  if (!taskCardElement || !targetDate) return;

  let determinedPhase = '未分類'; // 預設階段

  // 遍歷所有任務（排除自己），尋找日期區間
  const allTasks = Array.from(document.querySelectorAll('.task-card'));
  for (const card of allTasks) {
    // 跳過當前正在編輯的卡片
    if (card === taskCardElement) continue;

    const startDateStr = card.querySelector('input[data-field="預計開始日"]')?.value;
    const endDateStr = card.querySelector('input[data-field="預計完成日"]')?.value;

    if (startDateStr && endDateStr) {
      const taskStart = new Date(startDateStr);
      const taskEnd = new Date(endDateStr);
      // 將時間設為 0，避免時區問題
      taskStart.setHours(0, 0, 0, 0);
      taskEnd.setHours(0, 0, 0, 0);
      const checkDate = new Date(targetDate);
      checkDate.setHours(0, 0, 0, 0);

      if (checkDate >= taskStart && checkDate <= taskEnd) {
        const phaseTag = card.querySelector('.phase-tag');
        if (phaseTag) {
          determinedPhase = phaseTag.textContent;
          break; // 找到第一個符合的就跳出
        }
      }
    }
  }

  // 更新當前卡片上的階段標籤
  const currentPhaseTag = taskCardElement.querySelector('.phase-tag');
  if (currentPhaseTag) {
    currentPhaseTag.textContent = determinedPhase;
    logToPage(`任務 "${taskCardElement.querySelector('input[data-field="任務項目"]').value}" 的階段已自動更新為: ${determinedPhase}`);
  }
}

// [核心修改] 新增智慧新增任務的處理函式
function handleAddTask() {
  const select = document.getElementById('task-template-select');
  const templateTask = (select && select.value !== "") ? templateTasks[select.value] : {};

  // 組合最終的新任務資料
  const finalNewTaskData = {
    ...templateTask,
    '案號': new URLSearchParams(location.search).get('id'),
    '階段': '未分類', // [核心修正] 新增時，階段一律為「未分類」
    '預計開始日': new Date().toLocaleDateString('sv'), // 日期預設為今天
    '預計完成日': new Date().toLocaleDateString('sv'),
    '狀態': '未完成',
  };
  
  addNewTaskCard(finalNewTaskData);
}

function addNewTaskCard(taskData) {
  // 在資料層面新增任務
  currentScheduleData.push(taskData);
  
  // 在 UI 層面直接新增卡片，避免整個列表重新渲染
  const listContainer = document.getElementById('schedule-list-container');
  const newCardIndex = currentScheduleData.length - 1;
  const newCard = renderTaskCard(taskData, newCardIndex);
  listContainer.appendChild(newCard);

  enableSaveButton();

  setTimeout(() => {
    newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 0);
}
// [新增] 啟用儲存按鈕的函式
function enableSaveButton() {
  const btn = document.getElementById('save-schedule-btn');
  if (btn) {
      btn.classList.remove('hidden');
  }
}

function handleSaveSchedule() {
  const btn = document.getElementById('save-schedule-btn');
    // [核心修改 2] 立即隱藏按鈕，讓使用者可以繼續操作
  btn.classList.add('hidden');
  btn.disabled = true;
  logToPage('💾 變更已送出，背景儲存中...');

  const projectId = new URLSearchParams(window.location.search).get('id');
  
  // [核心修正] 完全信任 DOM，從畫面上重新建立一份最準確的資料
   const scheduleData = Array.from(document.querySelectorAll('.task-card')).map(card => {
      if (card.style.display === 'none') return null;
      const task = {};
      // 讀取卡片上所有帶有 data-field 屬性的輸入元件
      card.querySelectorAll('[data-field]').forEach(input => {
          const fieldName = input.dataset.field;
          task[fieldName] = input.value;
      });
      // 補回畫面上沒有，但後端需要的固定欄位
      task['案號'] = projectId;
      // [修正] 從 DOM 中讀取不可編輯的「階段」資訊
      const phaseTag = card.querySelector('.phase-tag');
      if (phaseTag) {
        task['階段'] = phaseTag.textContent;
      }
      return task;
  }).filter(Boolean); // 過濾掉所有為 null 的任務 (即被刪除的任務)

  // 根據「預計開始日」對所有任務進行排序
  scheduleData.sort((a, b) => {
      const dateA = new Date(a['預計開始日']);
      const dateB = new Date(b['預計開始日']);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateA - dateB;
  });

  const payload = { action: 'updateSchedule', projectId, scheduleData };

  // [還原] 恢復為 fetch no-cors 模式，解決 URL 過長問題
  fetch(`${API_BASE_URL}?page=project`, {
      method: 'POST', body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
  })
    .catch(error => {
        // 此處的 catch 只會在網路層級錯誤時觸發
        console.error('儲存排程時發生網路錯誤:', error);
        alert('儲存失敗！請檢查您的網路連線。排程將還原至上次儲存的狀態。');
        refreshScheduleData(); // 重新載入，還原使用者介面
    })
    .finally(() => {
        btn.textContent = '儲存排程變更'; btn.disabled = false;
        btn.classList.add('hidden');
    });
}
// [新增] 局部刷新函式
function refreshScheduleData() {
  const id = new URLSearchParams(location.search).get('id');
  const fetchUrl = API_BASE_URL + '?page=project&id=' + encodeURIComponent(id);
  logToPage('➡️ 正在請求最新排程資料...');

  // [核心新增] 在刷新前，先記錄當前的摺疊狀態
  const scheduleDetails = document.querySelector('.schedule-accordion');
  const wasOpen = scheduleDetails ? scheduleDetails.open : false;

  const saveBtn = document.getElementById('save-schedule-btn');
  if (saveBtn) {
      saveBtn.textContent = '儲存排程變更';
      saveBtn.disabled = false;
      saveBtn.classList.add('hidden');
  }

  loadJsonp(fetchUrl)
      .then(data => {
          if (data && !data.error) {
              currentScheduleData = data.schedule || []; // 更新全域資料
              // [核心修改] 將「維持展開」的狀態傳遞給渲染函式
              displaySchedule(data.overview, currentScheduleData, wasOpen);
              displayProjectInfo(data.overview, currentScheduleData);
              logToPage('✅ 排程面板已刷新完畢。');
          } else {
              throw new Error(data.error || '後端回傳資料格式錯誤');
          }
      })
      .catch(err => {
          logToPage(`❌ 局部刷新失敗: ${err.message}`);
          alert('刷新資料失敗，建議手動重新整理頁面。');
      });
}

/* ===== 文字編輯（局部更新） ===== */
function handleEditText(logId){
  logToPage('✏️ 編輯模式：LogID ' + logId);
  const contentDiv = document.getElementById('content-' + logId);
  const btnBox = contentDiv.closest('.card').querySelector('.button-group');
  const original = Array.from(btnBox.childNodes);

  contentDiv.dataset.originalContent = contentDiv.innerText;
  contentDiv.contentEditable = true; contentDiv.focus();
  contentDiv.style.cssText += 'border:1px solid #3b82f6;padding:.5rem;border-radius:.25rem;background:#f9fafb';

  const bCancel = document.createElement('button'); bCancel.textContent='取消'; bCancel.style.background='#6b7280'; bCancel.onclick=()=>handleCancelEdit(logId, original);
  const bSave   = document.createElement('button'); bSave.textContent='儲存文字'; bSave.style.background='#16a34a'; bSave.onclick=()=>handleSaveText(logId, original);
  btnBox.innerHTML=''; btnBox.appendChild(bCancel); btnBox.appendChild(bSave);
}
function handleCancelEdit(logId, original){
  const contentDiv = document.getElementById('content-' + logId);
  const btnBox = contentDiv.closest('.card').querySelector('.button-group');
  contentDiv.contentEditable=false; contentDiv.style.border='none'; contentDiv.style.padding='0'; contentDiv.style.background='transparent';
  contentDiv.innerText = contentDiv.dataset.originalContent; btnBox.innerHTML=''; original.forEach(b=>btnBox.appendChild(b));
}
function handleSaveText(logId, original){
  logToPage('💾 儲存文字：LogID ' + logId);
  const contentDiv = document.getElementById('content-' + logId);
  const newText = contentDiv.innerText.trim();
  const btnBox = contentDiv.closest('.card').querySelector('.button-group'); const firstBtn = btnBox.querySelector('button');
  if(firstBtn){ firstBtn.textContent='儲存中...'; firstBtn.disabled=true; }
  const params = new URLSearchParams({ page:'updateLogText', id:logId, content:newText });
  loadJsonp(API_BASE_URL + '?' + params.toString())
    .then(resp => editTextCallback(resp, logId, original))
    .catch(err => { alert('儲存失敗：' + err.message); handleCancelEdit(logId, original); });
}
function editTextCallback(resp, logId, original){
  if(resp && resp.success){
    const params = new URLSearchParams({ page:'getSingleLog', id:logId });
    loadJsonp(API_BASE_URL + '?' + params.toString()).then(newLog => {
      if(newLog){
        const idx = currentLogsData.findIndex(l => l.LogID === logId); if(idx!==-1) currentLogsData[idx] = newLog;
        const isDraft = (new URLSearchParams(window.location.search).get('id') === '0');
        const newCard = _buildLogCard(newLog, isDraft);
        const oldCard = document.getElementById('log-' + logId); if(oldCard) oldCard.replaceWith(newCard);
        logToPage('✅ 局部更新完成：' + logId);
      }else{
        alert('後端未回傳單筆資料，將重新整理'); location.reload();
      }
    });
  }else{
    alert('儲存失敗：' + (resp ? (resp.message||'未知錯誤') : '未知錯誤'));
    handleCancelEdit(logId, original);
  }
}

/* ===== 照片管理（GAS / JSONP 雙模式） ===== */
function openPhotoModal(logId, photoLinksCsv){
  currentEditingLogId = logId;
  const modal = document.getElementById('photo-modal');
  const grid = document.getElementById('modal-photo-grid-container');
  grid.innerHTML='';
  const links = photoLinksCsv ? photoLinksCsv.split(',').map(v=>v.trim()).filter(Boolean) : [];
  if(links.length){
    links.forEach(link => {
      const item = document.createElement('div'); item.className='modal-photo-item'; item.dataset.link=link;
      const img = document.createElement('img'); const id = driveFileId(link);
      img.src = id ? ('https://drive.google.com/thumbnail?id='+id+'&sz=w300') : link; img.loading='lazy';
      const del = document.createElement('button'); del.className='delete-photo-btn'; del.innerHTML='&times;'; del.title='標記刪除';
      del.onclick = () => { item.style.opacity='.3'; item.classList.add('deleted'); };
      item.appendChild(img); item.appendChild(del); grid.appendChild(item);
    });
  }else{
    grid.innerHTML = '<p class="muted">目前沒有照片可供管理。</p>';
  }
  modal.style.display='flex';
}
function closePhotoModal(){ document.getElementById('photo-modal').style.display='none'; currentEditingLogId=null; }

// [核心修正] 將關閉按鈕的事件監聽從 HTML 移至此處
document.addEventListener('DOMContentLoaded', () => {
    const photoModal = document.getElementById('photo-modal');
    photoModal.querySelector('button[onclick="closePhotoModal()"]')?.addEventListener('click', closePhotoModal);
});

document.getElementById('add-photos-button').onclick = () => document.getElementById('photo-file-input').click();
document.getElementById('photo-file-input').onchange = (e) => {
  const files = e.target.files; const grid = document.getElementById('modal-photo-grid-container');
  if(files.length){ grid.querySelector('p.muted')?.remove(); for(const f of files){ if(!f.type.startsWith('image/')) continue;
    const reader = new FileReader(); reader.onload = (ev) => {
      const item = document.createElement('div'); item.className='modal-photo-item new-photo'; item.dataset.base64 = ev.target.result;
      const img = document.createElement('img'); img.src = ev.target.result;
      const del = document.createElement('button'); del.className='delete-photo-btn'; del.innerHTML='&times;'; del.title='移除這張新照片'; del.onclick = () => item.remove();
      item.appendChild(img); item.appendChild(del); grid.appendChild(item);
    }; reader.readAsDataURL(f);
  }}
  e.target.value='';
};

document.getElementById('save-photos-button').onclick = function(){
  const btn = this; btn.textContent='儲存中...'; btn.disabled=true;
  const grid = document.getElementById('modal-photo-grid-container');
  const remain = []; grid.querySelectorAll('.modal-photo-item:not(.new-photo)').forEach(it => { if(!it.classList.contains('deleted')) remain.push(it.dataset.link); });
  const keepCsv = remain.join(',');
  const uploads = []; grid.querySelectorAll('.modal-photo-item.new-photo').forEach(it => uploads.push(it.dataset.base64));

  if(window.google && google.script && google.script.run){
    google.script.run.withSuccessHandler(handlePhotoSaveSuccess).withFailureHandler(err => { alert('上傳失敗：' + err.message); btn.textContent='儲存變更'; btn.disabled=false; }).updateLogPhotosWithUploads(currentEditingLogId, keepCsv, uploads);
  }else{
    const payload = encodeURIComponent(JSON.stringify({ id: currentEditingLogId, keep: keepCsv, uploads }));
    loadJsonp(API_BASE_URL + '?page=updatePhotosCompat&payload=' + payload)
      .then(handlePhotoSaveSuccess)
      .catch(err => { alert('上傳失敗：' + err.message); btn.textContent='儲存變更'; btn.disabled=false; });
  }
};
function handlePhotoSaveSuccess(resp){
  if(resp && resp.success){
    closePhotoModal();
    const card = document.getElementById('log-' + currentEditingLogId);
    if(card){
      const oldGrid = card.querySelector('.photo-grid'); if(oldGrid) oldGrid.remove();
      if(resp.finalLinks){
        const newGrid = buildPhotoGrid(resp.finalLinks);
        const actions = card.querySelector('.button-group'); if(actions) actions.parentNode.insertBefore(newGrid, actions);
      }
    }
  }else{
    alert('儲存失敗：' + (resp ? (resp.message||'未知錯誤') : '未知錯誤'));
  }
  const btn = document.getElementById('save-photos-button'); btn.textContent='儲存變更'; btn.disabled=false;
}

/* ===== 發布 ===== */
function handlePublish(logId){
  const btn = document.getElementById('btn-' + logId);
  if(btn){ btn.disabled=true; btn.textContent='發布中...'; }

  const payload = {
    action: 'publish',
    logId: logId,
    newStatus: '已發布'
  };

  // 使用 fetch 傳送 POST 請求
  fetch(`${API_BASE_URL}?page=project`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    mode: 'no-cors'
  })
  .then(response => {
    // 因為是 no-cors，我們無法直接讀取 response，但可以假設請求已送達
    // 為了讓前端能正確反應，我們手動模擬一個成功的回應物件
    publishCallback({ success: true, message: '發布請求已送出', logId: logId });
  })
  .catch(error => {
    console.error('發布時發生錯誤:', error);
    alert('發布請求失敗，請檢查網路連線。');
    if(btn){ btn.disabled=false; btn.textContent='審核與發布'; }
  });
}

function publishCallback(resp){
  const logId = resp && resp.logId;
  const b = logId ? document.getElementById('btn-'+logId) : null;
  if(resp && resp.success){
    const card = document.getElementById('log-' + logId);
    if(card){ card.style.transition='opacity .5s'; card.style.opacity='0'; setTimeout(()=>card.remove(), 500); }
  }else{
    alert('發布失敗：' + (resp ? (resp.message||'未知原因') : '未知原因'));
    if(b){ b.disabled=false; b.textContent='審核與發布'; }
  }
}

/* ===== Lightbox（含滑動/鍵盤） ===== */
(function(){
  const lb = document.getElementById('lightbox'); if(!lb) return;
  const img = lb.querySelector('.lb-img'); const closeBtn = lb.querySelector('.lb-close');
  let gallery = []; let current = -1; let sx=0, ex=0;
  function show(i){ if(!gallery.length) return; if(i<0) i=gallery.length-1; if(i>=gallery.length) i=0; current=i; img.src=''; img.src=gallery[current]; }
  function openFromThumb(el){
    const grid = el.closest('.photo-grid'); gallery = Array.from(grid.querySelectorAll('img.photo-thumb')).map(e => e.dataset.full || e.src).filter(Boolean);
    current = Math.max(0, gallery.indexOf(el.dataset.full || el.src)); show(current); lb.classList.add('open'); lb.setAttribute('aria-hidden','false');
  }
  function close(){ lb.classList.remove('open'); lb.setAttribute('aria-hidden','true'); img.src=''; gallery=[]; current=-1; }
  window.addEventListener('click', (e)=>{ const t=e.target; if(t && t.matches('img.photo-thumb')){ e.preventDefault(); openFromThumb(t); } });
  lb.addEventListener('click', (e)=>{ if(e.target===lb) close(); });
  closeBtn?.addEventListener('click', close);
  window.addEventListener('keydown', (e)=>{ if(!lb.classList.contains('open')) return; if(e.key==='Escape') close(); if(e.key==='ArrowLeft') show(current-1); if(e.key==='ArrowRight') show(current+1); });
  lb.addEventListener('touchstart', e=>{ sx=e.changedTouches[0].screenX; }, {passive:true});
  lb.addEventListener('touchend',   e=>{ ex=e.changedTouches[0].screenX; const th=50; if(ex < sx - th) show(current+1); if(ex > sx + th) show(current-1); }, {passive:true});
  window.__openLightbox__ = (srcOrList) => { gallery = Array.isArray(srcOrList) ? srcOrList : [String(srcOrList)]; current=0; show(0); lb.classList.add('open'); lb.setAttribute('aria-hidden','false'); };
})();

/*
* 版本: v13.0 (穩定版)
* 修改時間: 2025-09-27 10:59 (Asia/Taipei)
* 說明: 為 handleDataResponse 函式加上專業的 DocBlock 註解。
*/

/**
 * @description 處理從後端 API (Google Apps Script) 成功獲取資料後的核心回呼函式 (Callback)。
 * 此函式是整個應用程式的入口點，負責解析後端資料，並依序觸發所有 UI 的渲染與更新。
 *
 * @param {object} data - 從後端 JSONP 傳回的資料物件，其結構應包含：
 * @param {object} [data.overview] - 專案總覽資訊，如案場名稱、起訖日期。
 * @param {Array<object>} [data.schedule] - 專案排程的任務列表。
 * @param {Array<object>} [data.dailyLogs] - 專案的每日日誌列表。
 * @param {Array<object>} [data.templates] - 可用於新增任務的範本列表。
 *
 * @returns {void} 此函式無回傳值。其主要作用是產生副作用 (Side Effect)，即更新頁面上的 DOM 元素。
 *
 * @functionality
 * 1.  將後端資料存入前端的全域變數 (currentLogsData, currentScheduleData, templateTasks)。
 * 2.  檢查專案排程是否為空，若是，則顯示「套用範本」按鈕。
 * 3.  對排程資料進行排序 (依狀態 > 依日期)。
 * 4.  呼叫 `displaySchedule()` 渲染排程區塊。
 * 5.  將任務範本資料填充至「新增任務」下拉選單。
 * 6.  初始化日誌分頁，並呼叫 `renderLogPage()` 僅渲染第一頁的日誌。
 * 7.  若日誌總數多於一頁，則呼叫 `setupScrollListener()` 啟動無限滾動功能。
 * 8.  更新頁面主標題。
 */
function handleDataResponse(data){
  // [核心升級] 建立專案牆的發文區塊
  const wallPostCreatorHTML = `
    <div class="card post-creator">
      <textarea id="post-creator-textarea" class="form-textarea" placeholder="今天有什麼新進度嗎？"></textarea>
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

  const logsContainer = document.getElementById('logs-container');
  // 檢查是否已存在發文區，避免重複加入
  if (logsContainer && !logsContainer.querySelector('.post-creator')) {
    logsContainer.insertAdjacentHTML('afterbegin', wallPostCreatorHTML);
    
    // 為新加入的按鈕綁定事件 (此處可預留未來功能)
    document.getElementById('add-photo-to-post-btn').onclick = () => {
      alert('附加檔案功能開發中！');
    };
    document.getElementById('submit-post-btn').onclick = () => {
      const content = document.getElementById('post-creator-textarea').value;
      alert(`準備發佈內容：\n${content}`);
    };
  }

  logToPage('✅ 後端回應成功');
  // 清除任何可能存在的舊錯誤訊息
  document.getElementById('status-message')?.remove();
  if(data && data.error){ displayError({message:data.error}); return; }

  // 將從後端接收到的資料，分別存入前端的全域變數中，方便後續使用
  currentLogsData = data.dailyLogs || [];
  currentScheduleData = data.schedule || [];
  templateTasks = data.templates || [];

  // 業務邏輯：如果這是一個沒有任何排程的既有專案，則顯示「套用範本」的按鈕
  if (currentScheduleData.length === 0 && (new URLSearchParams(location.search).get('id') !== '0')) {
    const actionsContainer = document.getElementById('actions-container');
    if (actionsContainer) {
        actionsContainer.style.display = 'flex';
        document.getElementById('btn-import-new').onclick = () => showStartDatePicker('新屋案');
        document.getElementById('btn-import-old').onclick = () => showStartDatePicker('老屋案');
    }
  }
  
  // 業務邏輯：對排程資料進行排序，規則為：1. 依狀態 (已完成 > 施工中 > 未完成) 2. 依預計開始日期
  currentScheduleData.sort((a, b) => {
      const statusOrder = { '已完成': 1, '施工中': 2, '未完成': 3 };
      const statusA = statusOrder[a['狀態']] || 99;
      const statusB = statusOrder[b['狀態']] || 99;
      if (statusA !== statusB) {
          return statusA - statusB;
      }
      const dateA = new Date(a['預計開始日']);
      const dateB = new Date(b['預計開始日']);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateA - dateB;
  });
    
  // 渲染UI：呼叫 displaySchedule 函式，將排序好的排程資料渲染成畫面
  displaySchedule(data.overview, currentScheduleData, false);

  // [核心修正] 呼叫函式以建立「工種」欄位的 datalist 下拉建議選單
  createOrUpdateTradeDatalist(templateTasks);

  // [修復] 重新加入日誌渲染的邏輯
  // 效能優化：初始化分頁計數器，並呼叫 renderLogPage 函式僅渲染第一頁的日誌
  currentPage = 1;
  renderLogPage();
  
  // 效能優化：如果日誌總數超過一頁的數量，則啟動滾動監聽，用於實現無限滾動加載
  if (currentLogsData.length > LOGS_PER_PAGE) {
      setupScrollListener();
  }

  // 渲染UI：使用後端提供的案場名稱，更新頁面的主標題
  const titleEl = document.getElementById('project-title');
  if(data.overview && (data.overview.siteName || data.overview['案場名稱'])){
      titleEl.textContent = '主控台: ' + (data.overview.siteName || data.overview['案場名稱']);
  }

  // [新增] 呼叫新函式來渲染右側的專案資訊面板
  displayProjectInfo(data.overview, currentScheduleData);
}

/**
 * @description 渲染右側的專案資訊面板
 * @param {object} overview - 包含專案總覽資訊的物件
 */
function displayProjectInfo(overview, schedule) {
  const panel = document.getElementById('project-info-panel');
  if (!panel) return;

  if (!overview) {
    panel.innerHTML = '<p class="muted">無專案資訊</p>';
    return;
  }

  // 輔助函式，避免因資料不存在而顯示 undefined
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

  // [修改] 動態從排程資料中產生工班資訊
  const tradeContacts = new Map();
  if (schedule && schedule.length > 0) {
    schedule.forEach(task => {
      const trade = task['工種'];
      const person = task['負責人/工班'];
      if (trade && person) {
        if (!tradeContacts.has(trade)) {
          tradeContacts.set(trade, new Set());
        }
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

  logToPage('✅ 右側專案資訊面板已渲染');
}

/**
 * @description 根據範本任務，建立或更新工種的 datalist
 * @param {Array<object>} templates - 任務範本列表
 */
function createOrUpdateTradeDatalist(templates) {
  // [核心需求] 定義固定的核心工種列表
  const coreTrades = ['木作工程', '系統工程', '水電工程', '泥作工程', '石材工程', '玻璃工程', '窗簾工程', '保護工程', '清潔工程'];
  let datalist = document.getElementById('trade-datalist');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'trade-datalist';
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = ''; // 清空舊選項
  coreTrades.forEach(trade => {
    datalist.innerHTML += `<option value="${trade}"></option>`;
  });
}

// [新函式] 顯示日期選擇器
function showStartDatePicker(templateType) {
  const actionsContainer = document.getElementById('actions-container');
  const originalButtons = actionsContainer.innerHTML; // 保存原始按鈕，以便取消時恢復
  
  actionsContainer.innerHTML = `
    <label for="start-date-picker" style="align-self: center; margin-right: 5px; font-weight: 600;">請選擇開工日:</label>
    <input type="date" id="start-date-picker" value="${new Date().toISOString().split('T')[0]}" style="padding: 0.4rem; border-radius: 0.25rem; border: 1px solid #ccc;"/>
    <button id="confirm-import-btn" style="background-color: #2563eb;">確認送出</button>
    <button id="cancel-import-btn" style="background-color: #6b7280;">取消</button>
  `;

  document.getElementById('confirm-import-btn').onclick = () => {
    const startDate = document.getElementById('start-date-picker').value;
    if (!startDate) {
      alert('請務必選擇一個開工日期！');
      return;
    }
    handleImportTemplate(templateType, startDate);
  };

  document.getElementById('cancel-import-btn').onclick = () => {
    actionsContainer.innerHTML = originalButtons;
    // 需要重新綁定事件
    document.getElementById('btn-import-new').onclick = () => showStartDatePicker('新屋案');
    document.getElementById('btn-import-old').onclick = () => showStartDatePicker('老屋案');
  };
}

// [新功能] 處理 "套用範本" 按鈕點擊事件
function handleImportTemplate(templateType, startDate) {
  const projectId = new URLSearchParams(window.location.search).get('id');
  const actionsContainer = document.getElementById('actions-container');
  
  actionsContainer.innerHTML = '<p style="align-self: center; color: var(--primary); font-weight: 600;">自動排程計算中，請稍候...</p>';

  const payload = {
    action: 'createFromTemplate', // [新增] 指定後端動作
    projectId: projectId,
    templateType: templateType,
    startDate: startDate
  };

  // [還原] 恢復為 fetch no-cors 模式
  fetch(`${API_BASE_URL}?page=project`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    mode: 'no-cors'
  })
    .then(() => {
      alert(`已成功送出「${templateType}」範本套用請求，頁面即將重新整理以載入最新資料。`);
      setTimeout(() => window.location.reload(), 500);
    })
    .catch(error => {
      console.error('匯入範本時發生錯誤:', error);
      alert('與後端通訊時發生錯誤，但請求可能已送出。頁面將在5秒後嘗試重新整理。');
      setTimeout(() => window.location.reload(), 5000);
    });
}

// --- 這是新函式，請將其加入 main.js ---
let lazyImageObserver;

function lazyLoadImages() {
  const lazyImages = document.querySelectorAll('img.lazy');

  if ("IntersectionObserver" in window) {
    // 如果已有觀察者，先中斷舊的
    if (lazyImageObserver) {
      lazyImageObserver.disconnect();
    }

    lazyImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const lazyImage = entry.target;
          lazyImage.src = lazyImage.dataset.src;
          lazyImage.classList.remove("lazy");
          observer.unobserve(lazyImage);
        }
      });
    });

    lazyImages.forEach((lazyImage) => {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    // Fallback for older browsers
    lazyImages.forEach((lazyImage) => {
        lazyImage.src = lazyImage.dataset.src;
        lazyImage.classList.remove("lazy");
    });
  }
}

// --- 新增全域變數 ---
let currentPage = 1;
// [新增] 建立一個簡單的函式來判斷是否為行動裝置
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// [修改] 根據裝置類型，動態設定每頁載入的日誌筆數
const LOGS_PER_PAGE = isMobile() ? 3 : 8; 
let isLoadingNextPage = false; // 避免重複觸發載入
let scrollObserver; // 滾動觀察者

// --- 新增的核心函式 ---
function renderLogPage() {
  if (isLoadingNextPage) return;
  isLoadingNextPage = true;

  const logsContainer = document.getElementById('logs-container');
  const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
  const endIndex = startIndex + LOGS_PER_PAGE;
  const logsToShow = currentLogsData.slice(startIndex, endIndex);

  // 如果是第一頁，先清空容器 (移除骨架屏)
  if (currentPage === 1) {
    logsContainer.innerHTML = '';
  }

  // 移除舊的加載提示
  const oldLoader = document.getElementById('log-loader');
  if (oldLoader) {
    oldLoader.remove();
  }

  // 渲染日誌
  if (logsToShow.length > 0) {
    const isDraftMode = (new URLSearchParams(window.location.search).get('id') === '0');
    logsToShow.forEach(log => {
      logsContainer.appendChild(_buildLogCard(log, isDraftMode));
    });
    // 渲染完後，立即對新加入的圖片啟動懶加載
    lazyLoadImages();
  }
  
  // 如果還有更多日誌，則在末尾加上載提示，用於觸發下一次加載
  if (endIndex < currentLogsData.length) {
    const loaderElement = document.createElement('div');
    loaderElement.id = 'log-loader';
    loaderElement.innerHTML = '<div class="spinner" style="width:2rem;height:2rem;margin:1rem auto;"></div>';
    logsContainer.appendChild(loaderElement);
    // 觀察這個新的加載提示
    if (scrollObserver) {
        scrollObserver.observe(loaderElement);
    }
  }

  isLoadingNextPage = false;
}

function setupScrollListener() {
    scrollObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
            currentPage++;
            logToPage(`滾動到底部，載入第 ${currentPage} 頁...`);
            renderLogPage();
        }
    }, { threshold: 0.1 });

    const initialLoader = document.getElementById('log-loader');
    if (initialLoader) {
        scrollObserver.observe(initialLoader);
    }
}

/* ===== 入口 ===== */
window.addEventListener('load', async () => {
  // [核心修正] 將 UI 初始化邏輯移到此處，並以「施工日誌」為預設
  // 確保在任何資料載入前，頁面處於正確的初始顯示狀態
  document.getElementById('schedule-container').style.display = 'none';
  document.getElementById('logs-container').style.display = 'block';
  const fab = document.getElementById('fab-add-task-btn');
  if (fab) fab.style.display = 'none'; // 手機版懸浮按鈕預設隱藏

  document.getElementById('version-display').textContent = '版本：' + (typeof FRONTEND_VERSION!=='undefined'?FRONTEND_VERSION:'未知');
  logToPage('頁面載入完成，開始讀取 URL 參數...');

  const url = new URLSearchParams(location.search);
  const id = url.get('id');
  logToPage('URL id=' + (id || '(未帶入)'));
  if(!id){ displayError({message:'未指定 id。請在網址加上 ?id=0（草稿）或 ?id=案號。'}); return; }

  const CACHE_KEY = `project_data_${id}`;
  const CACHE_DURATION_MS = 45 * 60 * 1000; // 45 分鐘
  let hasRenderedFromCache = false;

  // 1. 嘗試從快取載入並立即渲染
  try {
    const cachedItem = localStorage.getItem(CACHE_KEY);
    if (cachedItem) {
      const { timestamp, data } = JSON.parse(cachedItem);
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        logToPage('⚡️ 從快取載入資料...');
        handleDataResponse(data);
        hasRenderedFromCache = true;
      } else {
        logToPage('🗑️ 快取已過期，清除中...');
        localStorage.removeItem(CACHE_KEY);
      }
    }
  } catch (e) {
    logToPage(`❌ 讀取快取失敗: ${e.message}`, 'error');
    localStorage.removeItem(CACHE_KEY);
  }

  // 如果沒有從快取渲染，則顯示骨架屏
  if (!hasRenderedFromCache) {
    displaySkeletonLoader();
  }

  // 2. 無論如何，都去後端請求最新資料
  const fetchUrl = API_BASE_URL + '?page=project&id=' + encodeURIComponent(id);
  logToPage('🔄 背景同步資料中... API: ' + fetchUrl);
  
  try {
    const freshData = await loadJsonp(fetchUrl);
    logToPage('✅ 背景同步成功');
    // 將新資料存入快取
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: freshData }));
    // 重新渲染畫面以顯示最新資料
    handleDataResponse(freshData);
  } catch (err) {
    logToPage(`❌ 背景同步失敗: ${err.message}`, 'error');
    // 只有在連快取都沒有的情況下才顯示錯誤
    if (!hasRenderedFromCache) {
      displayError(err);
    }
  }
});

/* ===== 新增：三欄式佈局互動 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const navButtons = document.querySelectorAll('.nav-button');
  const mobileNavToggle = document.getElementById('mobile-nav-toggle');
  const leftSidebar = document.querySelector('.left-sidebar');
  const scheduleContainer = document.getElementById('schedule-container');
  const logsContainer = document.getElementById('logs-container');
  const wallContainer = document.getElementById('wall-container'); // [新增] 取得專案牆容器
  const mainContent = document.getElementById('main-content');

  // 漢堡選單開關
  if (mobileNavToggle && leftSidebar) {
    mobileNavToggle.addEventListener('click', () => {
      leftSidebar.classList.toggle('open');
    });
  }

  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      // 移除所有按鈕的 active class
      navButtons.forEach(btn => btn.classList.remove('active'));
      // 為當前點擊的按鈕加上 active class
      button.classList.add('active');

      const view = button.dataset.view;

      // 根據 data-view 屬性顯示或隱藏對應的區塊
      scheduleContainer.style.display = (view === 'schedule') ? 'block' : 'none';
      logsContainer.style.display = (view === 'logs') ? 'block' : 'none';

      // [新增] 根據當前視圖，顯示或隱藏手機版的懸浮新增按鈕
      const fab = document.getElementById('fab-add-task-btn');
      if (fab) fab.style.display = (view === 'schedule') ? 'flex' : 'none';

      // [新增] 當切換到工程排程時，觸發滾動
      if (view === 'schedule') {
        setTimeout(() => {
          // [修改] 尋找第一個「未完成」或「施工中」的任務索引
          const focusTaskIndex = currentScheduleData.findIndex(task => task['狀態'] !== '已完成');

          const focusCard = document.getElementById(`task-card-${focusTaskIndex}`);
          if (focusCard) {
              focusCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              logToPage(`✅ 已自動滾動至任務 #${focusTaskIndex + 1}`);
          }
        }, 50); // 使用短延遲確保區塊顯示後再滾動
      }
      // [核心修正] 當切換回日誌視圖時，將主內容區的捲動條歸零
      // 解決從排程切換回來時，日誌頁面不在頂部的問題
      if (view === 'logs' && mainContent) {
        mainContent.scrollTop = 0;
      }

      // 在手機版上，點擊後自動關閉選單
      if (leftSidebar && leftSidebar.classList.contains('open')) {
        leftSidebar.classList.remove('open');
      }
    });
  });
});
