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
    scheduleContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML}</div>`;
    scheduleContainer.style.display = 'block';
  }
  if (logsContainer) {
    logsContainer.innerHTML = `<div class="skeleton-wrapper">${skeletonCardHTML.repeat(3)}</div>`;
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
  container.style.display = 'block';

  // 1. 建立主要結構元件
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.style.marginBottom = '1rem';
  buttonGroup.innerHTML = '<button id="save-schedule-btn" style="display:none; background-color: #dc2626;">儲存排程變更</button>';

  const details = document.createElement('details');
  details.className = 'schedule-accordion';
  // [核心修改] 根據傳入的參數決定是否展開
  // 如果是第一次載入，keepOpen 為 false，預設折疊
  // 如果是儲存後刷新，keepOpen 為 true，維持展開
  if (keepOpen) {
      details.open = true;
  }

  const summary = document.createElement('summary');
  const firstUnfinishedTask = schedule.find(t => t['狀態'] !== '已完成');
  const currentPhase = firstUnfinishedTask ? firstUnfinishedTask['階段'] : '專案已完工';
  summary.innerHTML = `<div class="progress-label"><strong>目前階段: ${currentPhase}</strong></div>`;
  
  // [核心修復] 恢復並提供完整的多色進度條渲染邏輯
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
  summary.appendChild(timeline);

  const listWrapper = document.createElement('div');
  listWrapper.className = 'schedule-list-wrapper';
  
  const listContainer = document.createElement('div');
  listContainer.id = 'schedule-list-container';
  listContainer.className = 'schedule-list';
  listWrapper.appendChild(listContainer);
  
  // [核心修正] 滾動目標恢復為「未完成的第一項」，確保穩定性
  let focusTaskIndex = schedule.findIndex(t => t['狀態'] !== '已完成');
  // 如果全部都完成了，或找不到，則聚焦在最後一項
  if (focusTaskIndex === -1 && schedule.length > 0) {
      focusTaskIndex = schedule.length - 1;
  } else if (focusTaskIndex === -1) {
      focusTaskIndex = 0; // 處理 schedule 為空的情況
  }

  schedule.forEach((task, index) => {
      listContainer.appendChild(renderTaskCard(task, index));
  });
  
  // [核心修改] 將「新增任務」的介面建立在此處
  const addTaskDiv = document.createElement('div');
  addTaskDiv.id = 'add-task-controls';
  addTaskDiv.style.marginTop = '1rem';
  addTaskDiv.innerHTML = `
      <div style="display: flex; gap: 1rem; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 1rem;">
          <select id="task-template-select" style="flex-grow: 1; padding: .5rem; border-radius: .375rem; border: 1px solid #d1d5db;"></select>
          <button id="add-task-btn" class="add-task-btn">＋ 新增</button>
      </div>
  `;
  listWrapper.appendChild(addTaskDiv); // 將其放入滾動容器的底部

  // 將所有元件依序加入頁面
  
  details.appendChild(summary);
  details.appendChild(listWrapper);
  container.appendChild(buttonGroup);
  container.appendChild(details);

  // 綁定儲存按鈕
  document.getElementById('save-schedule-btn').onclick = handleSaveSchedule;
  document.getElementById('add-task-btn').onclick = handleAddTask; // 綁定新增按鈕事件
  
  // [核心修復] 為摺疊面板新增「點擊監聽」，在正確的時機觸發滾動
  const detailsElement = container.querySelector('.schedule-accordion');
  if (detailsElement) {
      detailsElement.addEventListener('toggle', (event) => {
          // 只在「展開」時執行
          if (detailsElement.open) {
              // 重新計算目標索引，確保它是最新的
              let focusTaskIndex = currentScheduleData.findIndex(t => t['狀態'] !== '已完成');
              if (focusTaskIndex === -1 && currentScheduleData.length > 0) {
                  focusTaskIndex = currentScheduleData.length - 1;
              }

              const focusCard = document.getElementById(`task-card-${focusTaskIndex}`);
              if (focusCard) {
                  // 使用一個短延遲，確保展開動畫流暢
                  setTimeout(() => {
                      focusCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      logToPage(`✅ 已自動滾動至任務 #${focusTaskIndex + 1}`);
                  }, 100);
              }
          }
      });
  }
}

// 將渲染單張卡片的邏輯抽成獨立函式
function renderTaskCard(task, index) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.id = `task-card-${index}`;
  card.dataset.taskIndex = index;

  // [核心修復] 建立卡片時，所有可編輯欄位都產生為輸入元件
  card.innerHTML = `
      <div><label>工種</label><input type="text" data-field="工種" value="${task['工種'] || ''}"></div>
      <div class="task-main">
          <label>任務項目</label><input type="text" class="task-title" data-field="任務項目" value="${task['任務項目'] || ''}">
          <label style="margin-top:5px;">任務說明</label><textarea data-field="任務說明" style="font-size: .8rem; min-height: 40px;">${task['任務說明'] || ''}</textarea>
      </div>
      <div><label>工班</label><input type="text" data-field="負責人/工班" value="${task['負責人/工班'] || ''}"></div>
      <div class="task-dates">
          <label>預計開始日 / 完成日</label>
          <input type="date" data-field="預計開始日" value="${task['預計開始日'] ? new Date(task['預計開始日']).toLocaleDateString('sv') : ''}">
          <input type="date" data-field="預計完成日" value="${task['預計完成日'] ? new Date(task['預計完成日']).toLocaleDateString('sv') : ''}">
      </div>
      <div>
          <label>狀態</label>
          <div class="status-cell">
              <select data-field="狀態">
                  <option value="未完成">未完成</option><option value="施工中">施工中</option><option value="已完成">已完成</option>
              </select>
          </div>
      </div>
      <div class="task-remarks"><label>備註</label><textarea data-field="備註">${task['備註'] || ''}</textarea></div>
      <button class="delete-task-btn" title="刪除此任務">&times;</button>
  `;
  
  const statusSelect = card.querySelector('select[data-field="狀態"]');
  statusSelect.value = task['狀態'] || '未完成';
  const statusCell = card.querySelector('.status-cell');
  const setStatusColor = () => statusCell.className = `status-cell status-${statusSelect.value}`;
  setStatusColor();

  card.querySelectorAll('input, select, textarea').forEach(el => el.oninput = enableSaveButton);
  statusSelect.onchange = () => { enableSaveButton(); setStatusColor(); };

  card.querySelector('.delete-task-btn').onclick = () => {
      if (confirm(`確定要刪除任務「${task['任務項目'] || '新任務'}」嗎？`)) {
          card.remove();
          enableSaveButton();
      }
  };
  return card;
}

// [核心修改] 新增智慧新增任務的處理函式
function handleAddTask() {
  const select = document.getElementById('task-template-select');
  const selectedIndex = select.value;
  if (selectedIndex === "") return;

  const templateTask = templateTasks[selectedIndex];
  
  const newTaskData = {
      ...templateTask, // 帶入範本中的 階段, 工種, 任務項目, 任務說明 etc.
      '案號': new URLSearchParams(location.search).get('id'),
      '預計開始日': '',
      '預計完成日': '',
      '狀態': '未完成',
      '負責人/工班': '',
      '備註': ''
  };
  
  currentScheduleData.push(newTaskData);
  // 重新渲染整個列表以加入新卡片
  const overviewData = { '專案起始日': document.querySelector('input[data-field="預計開始日"]')?.value || new Date() };
  displaySchedule(overviewData, currentScheduleData, true);
  enableSaveButton();

  // [核心修復] 使用更可靠的方式，確保在畫面渲染完成後才執行滾動
  const focusCardId = `task-card-${focusTaskIndex}`;
  // 使用一個極短的 setTimeout (0毫秒)，可以將滾動指令推遲到瀏覽器完成所有渲染任務之後執行
  setTimeout(() => {
      const focusCard = document.getElementById(focusCardId);
      if (focusCard) {
          focusCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          logToPage(`✅ 已自動滾動至任務 #${focusTaskIndex + 1}`);
      }
  }, 0);
}
// [新增] 輔助函式，用於建立卡片中的每一個欄位，解決「工班」bug
function createTaskCardField(header, task) {
  const div = document.createElement('div');
  const label = document.createElement('label');
  label.textContent = header;
  div.appendChild(label);

  const value = task[header] || '';

  switch(header) {
      case '工種':
          const workTypeEl = document.createElement('div');
          workTypeEl.className = 'clickable-work-type';
          workTypeEl.textContent = value;
          workTypeEl.onclick = () => filterLogsByWorkType(value);
          div.appendChild(workTypeEl);
          break;
      case '任務項目':
      case '任務說明':
          // 這兩個合併顯示，所以在外面處理
          break;
      case '工班':
          const teamInput = document.createElement('input');
          teamInput.type = 'text';
          teamInput.value = value;
          teamInput.dataset.field = header; // 綁定欄位名
          teamInput.oninput = enableSaveButton;
          div.appendChild(teamInput);
          break;
      case '預計開始日':
      case '預計完成日':
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.value = value ? new Date(value).toLocaleDateString('sv') : '';
          dateInput.dataset.field = header;
          dateInput.onchange = enableSaveButton;
          div.appendChild(dateInput);
          div.className = 'task-dates'; // 合併日期樣式
          break;
      case '狀態':
          const statusSelect = document.createElement('select');
          statusSelect.className = 'status-badge-input';
          statusSelect.dataset.field = header;
          ['未完成', '施工中', '已完成'].forEach(opt => {
              statusSelect.innerHTML += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`;
          });
          const setStatusColor = (el) => { el.className = 'status-badge-input'; el.classList.add(`status-${el.value}`); };
          statusSelect.onchange = () => { enableSaveButton(); setStatusColor(statusSelect); };
          div.appendChild(statusSelect);
          setStatusColor(statusSelect);
          break;
      case '備註':
          const remarksTextarea = document.createElement('textarea');
          remarksTextarea.value = value;
          remarksTextarea.dataset.field = header;
          remarksTextarea.oninput = enableSaveButton;
          div.appendChild(remarksTextarea);
          div.className = 'task-remarks';
          break;
      default:
          // 處理合併顯示的欄位
          if (header === '任務項目') {
              div.className = 'task-main';
              div.innerHTML = `<label>任務項目</label><div class="task-title">${task['任務項目']}</div><div class="task-description">${task['任務說明'] || ''}</div>`;
          } else {
              return document.createDocumentFragment(); // 回傳空片段，不顯示
          }
  }
  return div;
}
// [新增] 啟用儲存按鈕的函式
function enableSaveButton() {
  const btn = document.getElementById('save-schedule-btn');
  if (btn) {
      btn.style.display = 'block';
  }
}

// [新增] 處理儲存排程的函式

function handleSaveSchedule() {
  const btn = document.getElementById('save-schedule-btn');
  btn.textContent = '儲存中...'; btn.disabled = true;

  const projectId = new URLSearchParams(window.location.search).get('id');
  
  // [核心修正] 完全信任 DOM，從畫面上重新建立一份最準確的資料
  let scheduleData = Array.from(document.querySelectorAll('.task-card')).map(card => {
      const task = {};
      // 讀取卡片上所有帶有 data-field 屬性的輸入元件
      card.querySelectorAll('[data-field]').forEach(input => {
          const fieldName = input.dataset.field;
          task[fieldName] = input.value;
      });
      // 補回畫面上沒有，但後端需要的固定欄位
      task['案號'] = projectId;
      const originalTask = currentScheduleData.find(t => t['任務項目'] === task['任務項目']) || {};
      task['階段'] = originalTask['階段']; // 階段是從範本帶入，不允許編輯
      return task;
  });

  // 根據「預計開始日」對所有任務進行排序
  scheduleData.sort((a, b) => {
      const dateA = new Date(a['預計開始日']);
      const dateB = new Date(b['預計開始日']);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateA - dateB;
  });

  const payload = { action: 'updateSchedule', projectId, scheduleData };

  fetch(`${API_BASE_URL}?page=project`, {
      method: 'POST', body: JSON.stringify(payload),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, mode: 'no-cors'
  })
  .then(() => {
      logToPage('✅ 排程儲存成功，正在局部刷新...');
      alert('排程已成功儲存！');
      refreshScheduleData();
  })
  .catch(error => {
      console.error('儲存排程時發生錯誤:', error);
      alert('儲存失敗，請檢查網路連線或後端日誌。');
      btn.textContent = '儲存排程變更'; btn.disabled = false;
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
      saveBtn.style.display = 'none';
  }

  loadJsonp(fetchUrl)
      .then(data => {
          if (data && !data.error) {
              currentScheduleData = data.schedule || [];
              // [核心修改] 將「維持展開」的狀態傳遞給渲染函式
              displaySchedule(data.overview, currentScheduleData, wasOpen);
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
function filterLogsByWorkType(workType){
  logToPage('篩選：工種 "' + workType + '"');
  document.getElementById('filter-reset-button')?.remove();
  const filtered = currentLogsData.filter(log => (log.Tags && log.Tags.includes(workType)) || (log.Title && log.Title.includes(workType)));
  displayLogsFiltered(filtered, true);
  const container = document.getElementById('logs-container');
  const resetBtn = document.createElement('button'); resetBtn.id='filter-reset-button';
  resetBtn.textContent = '清除 "'+workType+'" 篩選，顯示所有日誌'; resetBtn.style.cssText='margin:0 0 1rem 0;width:100%;background-color:var(--yellow);';
  resetBtn.onclick = () => { container.innerHTML=''; const isDraftMode = (new URLSearchParams(window.location.search).get('id')==='0'); displayLogs(currentLogsData, isDraftMode); resetBtn.remove(); };
  container.prepend(resetBtn);
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
  
  // 渲染UI：如果後端有提供任務範本，則將其填充至「新增任務」的下拉選單中
  const addTaskControls = document.getElementById('add-task-controls');
  if (addTaskControls && templateTasks.length > 0) {
      const select = document.getElementById('task-template-select');
      select.innerHTML = '<option value="">-- 請選擇要新增的任務範本 --</option>';
      templateTasks.forEach((task, index) => {
          const optionText = `${task['工種']} - ${task['任務項目']}`;
          select.innerHTML += `<option value="${index}">${optionText}</option>`;
      });
  } else if (addTaskControls) {
    addTaskControls.style.display = 'none';
  }
  
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
}

// [新函式] 顯示日期選擇器
function showStartDatePicker(templateType) {
  const actionsContainer = document.getElementById('actions-container');
  const originalButtons = actionsContainer.innerHTML; // 保存原始按鈕
  
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

  fetch(`${API_BASE_URL}?page=project`, { // [修改] 指向新路由
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

/*
* 版本: v12.5
* 修改時間: 2025-09-27 10:31 (Asia/Taipei)
* 說明: 新增圖片懶加載的核心邏輯與啟動函式。
*/
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

/*
* 版本: v12.6
* 修改時間: 2025-09-27 10:43 (Asia/Taipei)
* 說明: 實作純前端分頁載入。
*/
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

/*
* 版本: v12.4
* 修改時間: 2025-09-27 10:24 (Asia/Taipei)
* 說明: 在請求 API 資料前，先呼叫 displaySkeletonLoader 函式。
*/
/* ===== 入口 ===== */
window.addEventListener('load', () => {
  document.getElementById('version-display').textContent = '版本：' + (typeof FRONTEND_VERSION!=='undefined'?FRONTEND_VERSION:'未知');
  logToPage('頁面載入完成，開始讀取 URL 參數...');

  // [修改] 在請求資料前，先顯示骨架屏
  displaySkeletonLoader();

  const url = new URLSearchParams(location.search);
  const id = url.get('id');
  logToPage('URL id=' + (id || '(未帶入)'));
  if(!id){ displayError({message:'未指定 id。請在網址加上 ?id=0（草稿）或 ?id=案號。'}); return; }

  const fetchUrl = API_BASE_URL + '?page=project&id=' + encodeURIComponent(id);
  logToPage('呼叫 API：' + fetchUrl);
  loadJsonp(fetchUrl).then(handleDataResponse).catch(displayError);
});
