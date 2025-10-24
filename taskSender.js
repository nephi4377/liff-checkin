/*
* =============================================================================
* 檔案名稱: taskSender.js
* 專案名稱: 共用任務交辦中心模組
* 版本: v5.0 (穩定還原版)
* 說明: 封裝了任務交辦中心的完整 UI 與邏輯，包含收件人選擇、全體發送、關聯案號、要求動作與時限等功能。
* =============================================================================
*/

/**
 * 初始化任務交辦中心
 * @param {HTMLElement} container - 要將任務交辦中心插入的容器元素
 * @param {object} config - 包含 state、api、onSuccess 回呼的設定物件。
 * @param {object} [options={style: 'hub'}] - UI 選項，'hub' 為預設完整版, 'console' 為專案主控台簡化版。
 */
export function initializeTaskSender(container, config, options = {}) {
    if (!container) return;

    const styleType = options.style || 'hub'; // 預設為 'hub' 樣式

    // 根據 styleType 決定 HTML 結構
    const getHtmlStructure = () => {
        if (styleType === 'console') {
            // 專案主控台的簡化版 UI
            return `
                <!-- 任務交辦中心 (Console 樣式) -->
                <div id="task-sender-wrapper" class="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                    <form id="task-sender-form" class="space-y-3">
                        <!-- 交辦內容輸入框 -->
                        <div>
                            <label for="task-sender-content" class="block text-xxs font-medium text-gray-700 mb-1">交辦內容<span class="text-red-500">*</span></label>
                            <textarea id="task-sender-content" rows="3" class="block w-full rounded-md border-gray-300 shadow-sm" required></textarea>
                        </div>
                        <!-- 收件人選擇區 -->
                        <div>
                             <!-- 收件人選擇按鈕 -->
                            <button type="button" id="task-sender-recipient-toggle-btn" class="text-left p-1.5 border rounded-md bg-gray-50 hover:bg-gray-100 flex items-center gap-2 w-full justify-between">
                                <span id="task-sender-recipient-summary" class="text-xxs text-gray-600">選擇收件人</span>
                                <svg id="task-sender-recipient-arrow" class="w-5 h-5 text-gray-500 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </button>
                            <!-- 可收合的收件人列表容器 -->
                            <div id="task-sender-recipient-collapsible" class="collapsible-content mt-1">
                                <div id="task-sender-recipient-list" class="border rounded-md max-h-48 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1"></div>
                            </div>
                        </div>
                        <!-- 隱藏的案號輸入框，會自動代入 -->
                        <input type="hidden" id="task-sender-related-project-id">
                        <div class="flex justify-between items-end gap-4 w-full">
                            <div class="flex-grow">
                                <!-- 要求動作選擇區 -->
                                <label class="block text-xxs font-medium text-gray-700">要求動作</label>
                                <div id="task-sender-action-type-group" class="mt-2 flex flex-wrap items-center gap-2">
                                    <button type="button" data-value="None" class="action-btn active">無</button>
                                    <button type="button" data-value="ReplyText" class="action-btn">文字回覆</button>
                                    <button type="button" data-value="ConfirmCompletion" class="action-btn">完成回報</button>
                                </div>
                                <!-- 時限選擇器 (預設隱藏) -->
                                <div id="task-sender-deadline-wrapper" class="mt-2 flex items-center gap-2 hidden">
                                    <span class="text-xxs text-gray-500">時限:</span>
                                    <input type="date" id="task-sender-deadline-date" class="text-xxs p-1 border rounded-md">
                                    <select id="task-sender-deadline-time" class="text-xxs p-1 border rounded-md bg-white"></select>
                                </div>
                            </div>
                            <!-- 右側：發送按鈕 -->
                            <button type="submit" id="task-sender-submit-btn" class="w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-md text-xs">發送任務</button>
                        </div>
                        <!-- 狀態訊息顯示區 -->
                        <div id="task-sender-status" class="text-xxs text-center min-h-[18px]"></div>
                    </form>
                </div>
            `;
        }
        // 預設為 Hub 的完整版 UI
        return `
            <!-- 任務交辦中心 (Hub 樣式) -->
            <div id="task-sender-wrapper" class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h2 class="text-xl font-bold text-gray-700 mb-4">任務交辦中心</h2>
                <form id="task-sender-form" class="space-y-4">
                <!-- ... (Hub 的完整表單結構) ... -->
                </form>
            </div>
        `;
    };

    // 1. 渲染 HTML 結構
    container.innerHTML = (styleType === 'console') ? `
        <div id="task-sender-wrapper" class="bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <!-- 任務發送表單 -->
            <form id="task-sender-form" class="space-y-3">
                <div>
                    <label for="task-sender-content" class="block text-xxs font-medium text-gray-700 mb-1">交辦內容<span class="text-red-500">*</span></label>
                    <textarea id="task-sender-content" rows="3" class="block w-full rounded-md border-gray-300 shadow-sm" required></textarea>
                </div>
                <div>
                    <button type="button" id="task-sender-recipient-toggle-btn" class="text-left p-1.5 border rounded-md bg-gray-50 hover:bg-gray-100 flex items-center gap-2 w-full justify-between">
                        <!-- 收件人摘要，會顯示 "選擇收件人" 或 "已選擇：XXX" -->
                        <span id="task-sender-recipient-summary" class="text-xxs text-gray-600">選擇收件人</span>
                         <!-- 收合/展開的箭頭圖示 -->
                        <svg id="task-sender-recipient-arrow" class="w-5 h-5 text-gray-500 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                    <!-- 可收合的收件人列表容器 -->
                    <div id="task-sender-recipient-collapsible" class="collapsible-content mt-1">
                         <!-- 收件人列表 (多欄位網格) -->
                        <div id="task-sender-recipient-list" class="border rounded-md max-h-48 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1"></div>
                    </div>
                </div>
                  <!-- 隱藏的案號輸入框，會自動代入 -->
                <input type="hidden" id="task-sender-related-project-id">
                <!-- [v5.0] 還原為 hub.html 的原始佈局與 radio button 樣式 -->
                <!-- 底部動作區塊 -->
                <div class="flex justify-between items-end gap-4 w-full">
                    <div class="flex-grow">
                        <label class="block text-xxs font-medium text-gray-700">要求動作</label>
                        <!-- 動作按鈕群組 -->
                        <div id="task-sender-action-type-group" class="mt-2 flex flex-wrap items-center gap-2">
                            <button type="button" data-value="None" class="action-btn active">無</button>
                            <button type="button" data-value="ReplyText" class="action-btn">文字回覆</button>
                            <button type="button" data-value="ConfirmCompletion" class="action-btn">完成回報</button>
                        </div>
                         <!-- 時限選擇器 (預設隱藏) -->
                        <div id="task-sender-deadline-wrapper" class="mt-2 flex items-center gap-2 hidden">
                            <span class="text-xxs text-gray-500">時限:</span>
                            <input type="date" id="task-sender-deadline-date" class="text-xxs p-1 border rounded-md">
                            <select id="task-sender-deadline-time" class="text-xxs p-1 border rounded-md bg-white"></select>
                        </div>
                    </div>
                    <!-- 右側：發送按鈕 -->
                    <button type="submit" id="task-sender-submit-btn" class="w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-md text-xs">發送任務</button>
                </div>
                <!-- 狀態訊息顯示區 -->
                <div id="task-sender-status" class="text-xxs text-center min-h-[18px]"></div>
            </form>
        </div>
        <!-- [v3.0] 溝通紀錄列表的容器，由外部 ui.js 負責渲染 -->
        <div id="communication-history-list"></div>
    ` : `
        <!-- Hub 的完整版 UI -->
        <div id="task-sender-wrapper" class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <!-- 標題 -->
            <h2 class="text-xl font-bold text-gray-700 mb-4">任務交辦中心</h2>
            <!-- 任務發送表單 -->
            <form id="task-sender-form" class="space-y-4">
                <!-- 收件人選擇區 -->
                <div>
                    <!-- 收件人選擇按鈕 -->
                    <button type="button" id="task-sender-recipient-toggle-btn" class="w-full text-left p-2 border rounded-md bg-gray-50 hover:bg-gray-100 flex justify-between items-center">
                        <span id="task-sender-recipient-summary" class="text-sm text-gray-600">選擇收件人</span>
                        <svg id="task-sender-recipient-arrow" class="w-5 h-5 text-gray-500 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    </button>
                    <!-- 可收合的收件人列表容器 -->
                    <div id="task-sender-recipient-collapsible" class="collapsible-content mt-2">
                        <div id="task-sender-recipient-list" class="border rounded-md max-h-48 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 gap-x-2 gap-y-1"></div>
                    </div>
                    <!-- Hub 樣式才有「全體發送」選項 -->
                    <div id="task-sender-send-to-all-wrapper" class="mt-2">
                        <label class="flex items-center">
                            <input type="checkbox" id="task-sender-send-to-all-checkbox" class="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500">
                            <span class="ml-2 text-sm text-red-600 font-semibold">發送給所有員工</span>
                        </label>
                    </div>
                </div>
                <!-- 交辦內容輸入框 -->
                <div>
                    <label for="task-sender-content" class="block text-sm font-medium text-gray-700">交辦內容<span class="text-red-500">*</span></label>
                    <textarea id="task-sender-content" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required></textarea>
                </div>
                <!-- 相關案號輸入框 -->
                <div>
                    <label for="task-sender-related-project-id" class="block text-sm font-medium text-gray-700">相關案號 (選填)</label>
                    <input type="text" id="task-sender-related-project-id" inputmode="numeric" pattern="[0-9]*" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" placeholder="例如: 715">
                </div>
                <!-- 底部動作區塊 -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <!-- 左側：要求動作 (Radio 單選按鈕) -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700">要求動作</label>
                        <div id="task-sender-action-type-group" class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                            <label><input type="radio" name="taskSenderActionType" value="None" checked> 無</label>
                            <label><input type="radio" name="taskSenderActionType" value="ReplyText"> 文字回覆</label>
                            <!-- 完成回報選項 (包含時限選擇器) -->
                            <div class="flex items-center gap-2">
                                <label><input type="radio" name="taskSenderActionType" value="ConfirmCompletion"> 完成回報</label>
                                <span class="text-sm text-gray-500">(時限:</span>
                                <input type="date" id="task-sender-deadline-date" class="text-sm p-1 border rounded-md" disabled>
                                <input type="time" id="task-sender-deadline-time" class="text-sm p-1 border rounded-md" disabled>
                                <span class="text-sm text-gray-500">)</span>
                            </div>
                        </div>
                    </div>
                    <!-- 右側：發送按鈕 -->
                    <button type="submit" id="task-sender-submit-btn" class="w-full sm:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-md">發送任務</button>
                </div>
                <!-- 狀態訊息顯示區 -->
                <div id="task-sender-status" class="text-sm text-center min-h-[20px]"></div>
            </form>
        </div>
        <div id="communication-history-list"></div>
    `;

    // 2. 綁定事件
    const form = document.getElementById('task-sender-form');
    form.addEventListener('submit', (e) => handleSend(e, config, config.api.postTask));

    const recipientToggleBtn = document.getElementById('task-sender-recipient-toggle-btn');
    recipientToggleBtn.addEventListener('click', toggleRecipientList);

    const recipientList = document.getElementById('task-sender-recipient-list');
    recipientList.addEventListener('change', updateRecipientSummary);

    // Hub 樣式才有「全體發送」選項
    if (styleType === 'hub') {
        const sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');
        sendToAllCheckbox.addEventListener('change', (e) => {
            document.querySelectorAll('#task-sender-recipient-list input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = e.target.checked;
                if (e.target.checked) checkbox.checked = false;
            });
            updateRecipientSummary();
        });
    }

    const actionTypeGroup = document.getElementById('task-sender-action-type-group');
    if (styleType === 'console') {
        actionTypeGroup.addEventListener('click', handleActionTypeChange_Button);
    } else {
        actionTypeGroup.addEventListener('change', handleActionTypeChange_Radio);
    }

    // 3. 填充初始資料
    populateRecipients(config.state);
    
    // 如果是從 managementconsole.html 呼叫，自動填入案號
    if (config.state.projectId && config.state.projectId !== '0') {
        const projectIdInput = document.getElementById('task-sender-related-project-id');
        if (projectIdInput) {
            projectIdInput.value = config.state.projectId;
        }
    } else if (styleType === 'console') {
        // 如果是 console 樣式但沒有 projectId，也確保 input 存在且為空
        const projectIdInput = document.getElementById('task-sender-related-project-id');
        if (projectIdInput) {
            projectIdInput.value = '';
        }
    }

    // 如果是 console 樣式，才需要處理按鈕和時間下拉選單
    if (styleType === 'console') {
        const style = document.createElement('style');
        style.textContent = `
            /* ==========================================================================
               任務交辦中心 (Console 樣式) 的專屬 CSS
               ========================================================================== */

            /* --- 收件人列表 --- */
            /* 控制收件人列表的收合/展開動畫 */
            #task-sender-recipient-collapsible { 
                max-height: 0; /* 預設為收合狀態 (高度為 0) */
                overflow: hidden; /* 隱藏超出的內容 */
                transition: max-height 0.3s ease-in-out; /* 當高度改變時，產生 0.3 秒的平滑動畫 */
            }

            /* --- 自訂義更小的字體 --- */
            .text-xxs {
                font-size: 11px;
            }

            /* --- 要求動作按鈕 --- */
            /* 「要求動作」按鈕的預設樣式 (未選中時) */
            #task-sender-action-type-group .action-btn { padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.75rem; transition: all 0.2s; }
            
            /* 「要求動作」按鈕被選中時的樣式 */
            #task-sender-action-type-group .action-btn.active { background-color: #3b82f6; color: white; border-color: #3b82f6; }
    `;
        container.appendChild(style);
        populateTimeSelect();
    }
}

function populateRecipients(state) {
    const recipientList = document.getElementById('task-sender-recipient-list');
    if (!recipientList || !state.allEmployees || state.allEmployees.length === 0) return;
    recipientList.innerHTML = '';
    
    // 【您的要求】只顯示權限 >= 2 且屬於台南店或高雄店的在職員工
    state.allEmployees
        .filter(emp => {
            const hasPermission = emp.permission >= 2;
            const isInTargetGroup = emp.group === '台南店' || emp.group === '高雄店';
            return hasPermission && isInTargetGroup;
        })
        .sort((a, b) => {
            // 優先按「組別」排序
            const groupCompare = (a.group || '').localeCompare(b.group || '', 'zh-Hant');
            if (groupCompare !== 0) {
                return groupCompare;
            }
            // 如果組別相同，再按「姓名」排序
            return a.userName.localeCompare(b.userName, 'zh-Hant');
        })
        .forEach(emp => {
            const id = `task-sender-recipient-${emp.userId}`;
            recipientList.insertAdjacentHTML('beforeend', `                <label for="${id}" class="flex items-center p-1.5 rounded hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" id="${id}" name="taskSenderRecipients" value="${emp.userId}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <span class="ml-2 text-xs text-gray-800" data-name="${emp.userName}">${emp.userName}</span>
                </label>
            `);
        });
}

function toggleRecipientList() {
    const collapsible = document.getElementById('task-sender-recipient-collapsible');
    const arrow = document.getElementById('task-sender-recipient-arrow');
    const isCollapsed = !collapsible.style.maxHeight || collapsible.style.maxHeight === '0px';
    collapsible.style.maxHeight = isCollapsed ? collapsible.scrollHeight + "px" : null;
    arrow.classList.toggle('rotate-180', isCollapsed);
}

function updateRecipientSummary() {
    const summaryEl = document.getElementById('task-sender-recipient-summary');
    const sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');
    if (sendToAllCheckbox && sendToAllCheckbox.checked) {
        summaryEl.textContent = '已選擇：所有員工';
        return;
    }
    const selectedCheckboxes = Array.from(document.querySelectorAll('#task-sender-recipient-list input[type="checkbox"]:checked'));
    if (selectedCheckboxes.length === 0) {
        summaryEl.textContent = '選擇收件人';
    } else if (selectedCheckboxes.length <= 2) {
        summaryEl.textContent = '已選擇：' + selectedCheckboxes.map(cb => cb.nextElementSibling.dataset.name).join('、');
    } else {
        summaryEl.textContent = `已選擇：${selectedCheckboxes.length} 位員工`;
    }
}

function populateTimeSelect() {
    const timeSelect = document.getElementById('task-sender-deadline-time');
    if (!timeSelect) return;
    timeSelect.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0');
        timeSelect.innerHTML += `<option value="${hour}:00">${hour}:00</option>`;
        timeSelect.innerHTML += `<option value="${hour}:30">${hour}:30</option>`;
    }
}

// for Hub (radio buttons)
function handleActionTypeChange_Radio(e) {
    if (e.target.name !== 'taskSenderActionType') return;
    const button = e.target.closest('.action-btn');

    const actionGroup = document.getElementById('task-sender-action-type-group');
    actionGroup.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const deadlineDate = document.getElementById('task-sender-deadline-date');
    const deadlineTime = document.getElementById('task-sender-deadline-time');
    const isConfirmCompletion = e.target.value === 'ConfirmCompletion';

    deadlineDate.disabled = !isConfirmCompletion;
    deadlineTime.disabled = !isConfirmCompletion;

    if (isConfirmCompletion) {
        if (!deadlineDate.value) {
            const now = new Date();
            deadlineDate.value = now.toLocaleDateString('sv');
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
            deadlineTime.value = `${now.getHours().toString().padStart(2, '0')}:00`;
        }
    } else {
        deadlineDate.value = '';
        deadlineTime.value = '';
    }
}

// for Console (buttons)
function handleActionTypeChange_Button(e) {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const actionGroup = document.getElementById('task-sender-action-type-group');
    actionGroup.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    const deadlineDate = document.getElementById('task-sender-deadline-date');
    const deadlineTime = document.getElementById('task-sender-deadline-time');
    const deadlineWrapper = document.getElementById('task-sender-deadline-wrapper');
    const isConfirmCompletion = button.dataset.value === 'ConfirmCompletion';

    deadlineWrapper.classList.toggle('hidden', !isConfirmCompletion);

    if (isConfirmCompletion) {
        const now = new Date();
        deadlineDate.value = now.toLocaleDateString('sv');
        now.setHours(now.getHours() + 1);
        const currentMinutes = now.getMinutes();
        if (currentMinutes < 30) {
            now.setMinutes(30);
        } else {
            now.setHours(now.getHours() + 1);
            now.setMinutes(0);
        }
        deadlineTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    } else {
        deadlineDate.value = '';
        deadlineTime.value = '';
    }
}

async function handleSend(event, config, apiFunction) {
    event.preventDefault();
    const { state } = config;
    const statusEl = document.getElementById('task-sender-status');
    const submitBtn = document.getElementById('task-sender-submit-btn');
    const contentTextarea = document.getElementById('task-sender-content');
    const sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');
    const sendToAll = sendToAllCheckbox ? sendToAllCheckbox.checked : false;

    const selectedRecipients = Array.from(document.querySelectorAll('#task-sender-recipient-list input[type="checkbox"]:checked')).map(cb => cb.value);
    // 只有在「全體發送」也沒勾選的情況下，才判斷收件人為空
    if (!sendToAll && selectedRecipients.length === 0) {
        statusEl.textContent = '錯誤：請至少選擇一位收件人。';
        return;
    }

    const content = contentTextarea.value.trim();
    if (!content) {
        statusEl.textContent = '錯誤：請輸入內容。';
        contentTextarea.focus();
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '發送中...';

    let actionType = 'None';
    // 根據 UI 類型決定如何讀取 actionType
    const activeButton = document.querySelector('#task-sender-action-type-group .action-btn.active');
    if (activeButton) { // Console style
        actionType = activeButton.dataset.value;
    } else { // Hub style
        const radioChecked = document.querySelector('input[name="taskSenderActionType"]:checked');
        if (radioChecked) actionType = radioChecked.value;
    }

    const deadlineDate = document.getElementById('task-sender-deadline-date').value;
    const deadlineTime = document.getElementById('task-sender-deadline-time').value;
    let deadline = (deadlineDate && deadlineTime) ? `${deadlineDate}T${deadlineTime}` : '';

    if (actionType === 'ConfirmCompletion' && !deadline) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deadline = tomorrow.toISOString();
    }

    const payload = {
        action: 'sendNotification',
        senderId: state.currentUserId,
        senderName: state.currentUserName,
        recipients: sendToAll ? ['ALL'] : selectedRecipients, // 維持 Hub 的邏輯
        content: content,
        projectId: document.getElementById('task-sender-related-project-id').value,
        actionType: actionType,
        deadline: deadline,
        title: `專案任務: ${content.substring(0, 20)}...`
    };

    try {
        const response = await apiFunction(payload);
        const result = response.result || response; // 兼容兩種回傳格式
        if (!result.success) throw new Error(result.message || '後端處理失敗');
        statusEl.textContent = '任務/訊息已成功發送！';
        document.getElementById('task-sender-form').reset();
        updateRecipientSummary();
        // 根據 UI 類型重置狀態
        if (activeButton) {
            handleActionTypeChange_Button({ target: document.querySelector('.action-btn[data-value="None"]') });
        } else {
            handleActionTypeChange_Radio({ target: document.querySelector('input[name="taskSenderActionType"][value="None"]') });
        }
        
        // 如果提供了刷新回呼函式，則執行它
        if (typeof config.onSuccess === 'function') {
            config.onSuccess();
        }

    } catch (error) {
        statusEl.textContent = `發送失敗: ${error.message}`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '發送任務';
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

/**
 * [新增] 從外部程式化地新增收件人。
 * @param {string} userName - 要新增的員工姓名。
 */
export function addRecipient(userName) {
    if (!userName) return;

    const recipientList = document.getElementById('task-sender-recipient-list');
    if (!recipientList) return;

    // 根據 data-name 屬性找到對應的 span，再往前找到 checkbox
    const checkbox = recipientList.querySelector(`span[data-name="${userName}"]`)?.previousElementSibling;

    if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        
        // 手動觸發 change 事件，以確保 updateRecipientSummary() 會被呼叫
        const event = new Event('change', { bubbles: true });
        recipientList.dispatchEvent(event);
    }

    // 如果收件人列表是收合的，就將其展開
    const collapsible = document.getElementById('task-sender-recipient-collapsible');
    if (!collapsible.style.maxHeight || collapsible.style.maxHeight === '0px') {
        toggleRecipientList();
    }
}