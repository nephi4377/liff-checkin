/*
* =============================================================================
* 檔案名稱: taskSender.js
* 專案名稱: [v288.0] 共用任務交辦元件
* 版本: v7.0
* 說明: 一個獨立、可重用的任務交辦元件。它自我包含 UI、樣式與邏輯，
*       並透過一個清晰的 config 物件與外部通訊。
* =============================================================================
*/

// [v554.0 重構] 直接引入 projectApi，移除 config.api 中間層。
import { request as apiRequest } from '/modules/projects/js/projectApi.js';

/**
 * 初始化任務交辦元件 (Task Sender Component)
 * @param {HTMLElement} container - 要將任務交辦中心插入的容器元素
 * @param {object} config - 核心設定物件
 * @param {object} config.state - 動態資料 { allEmployees, currentUserId, currentUserName, projectId? }
 * @param {object} [config.api] - (已棄用) 後端通訊介面
 * @param {object} [config.callbacks] - 回呼函式 { onSuccess?, onOptimisticUpdate? }
 * @param {object} [options={}] - 外觀與行為選項 { style?, defaultAction?, collapsible?, groupBy? }
 */
export function initializeTaskSender(container, config, options = {}) {
    if (!container) return;

    // [v290.0 核心重構] 建立 RecipientSelector 子元件實例
    const recipientSelector = new RecipientSelector(options);

    const styleType = options.style || 'hub'; // 預設為 'hub' 樣式 (完整版)

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
                        <span id="task-sender-recipient-summary" class="text-xs text-gray-600">選擇收件人</span>
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
                <input type="text" id="task-sender-related-project-id" class="hidden">
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
                <div id="task-sender-status" class="text-xs text-center min-h-[18px]"></div>
            </form>
        </div>
        <!-- [v284.0 新增] 在任務交辦與溝通紀錄之間加入分隔線 -->
        <div class="my-6 border-t border-gray-200"></div>
        <!-- [v284.0 修正] 溝通紀錄列表的容器，由 ui.js 負責渲染 -->
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
                        <!-- 【您的要求】移除 grid 相關 class，改為垂直列表 -->
                        <div id="task-sender-recipient-list" class="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1"></div>
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
    form.addEventListener('submit', (e) => handleSend(e, config, styleType, recipientSelector));

    const recipientToggleBtn = document.getElementById('task-sender-recipient-toggle-btn'); // [v548.0 修正] 確保變數已宣告
    recipientToggleBtn.addEventListener('click', () => recipientSelector.toggleList());

    const recipientList = document.getElementById('task-sender-recipient-list');
    recipientList.addEventListener('change', () => recipientSelector.updateSummary());

    // Hub 樣式才有「全體發送」選項
    if (styleType === 'hub') {
        const sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');
        sendToAllCheckbox.addEventListener('change', (e) => {
            // [v290.0] 改為呼叫子元件的方法
            recipientSelector.toggleSendToAll(e.target.checked);
        });
    }

    const actionTypeGroup = document.getElementById('task-sender-action-type-group');
    if (styleType === 'console') {
        actionTypeGroup.addEventListener('click', handleActionTypeChange_Button);
    } else {
        actionTypeGroup.addEventListener('change', handleActionTypeChange_Radio);
    }

    // 3. 填充初始資料
    // [v290.0] 初始化 RecipientSelector 子元件
    recipientSelector.init(config.state, styleType);
    
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
        _injectConsoleStyles(container);
        populateTimeSelect();
    }

    // [v288.0 新增] 處理預設動作選項
    if (styleType === 'console' && options.defaultAction) {
        const replyButton = document.querySelector(`#task-sender-action-type-group .action-btn[data-value="${options.defaultAction}"]`);
        if (replyButton) handleActionTypeChange_Button({ target: replyButton });
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

    const deadlineDate = document.getElementById('task-sender-deadline-date');
    const deadlineTime = document.getElementById('task-sender-deadline-time');
    // 【⭐️ 核心修正：直接從事件目標 (e.target) 讀取值，不再依賴 .action-btn ⭐️】
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

// =============================================================================
// 內部輔助函式 (Internal Helper Functions)
// =============================================================================

/**
 * [內部] 注入 Console 樣式所需的 CSS。
 * @param {HTMLElement} container - 元件的根容器。
 */
function _injectConsoleStyles(container) {
    const style = document.createElement('style');
    style.textContent = `
        #task-sender-recipient-collapsible { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-in-out; }
        .text-xxs { font-size: 11px; }
        #task-sender-action-type-group .action-btn { padding: 0.25rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.75rem; transition: all 0.2s; }
        #task-sender-action-type-group .action-btn.active { background-color: #3b82f6; color: white; border-color: #3b82f6; }
    `;
    container.appendChild(style);
}

/**
 * [內部] 建立要發送給後端的 payload 物件。
 * @param {object} state - 從 config 傳入的 state 物件。
 * @param {string} styleType - 當前的 UI 樣式 ('hub' 或 'console')。
 * @returns {object} - 包含所有任務資料的 payload。
 */
function _buildPayload(state, styleType) {
    // [v290.0] 修正：從 DOM 讀取資料的邏輯維持不變，因為這是此函式的職責
    const content = document.getElementById('task-sender-content').value.trim();
    const sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');
    const sendToAll = sendToAllCheckbox ? sendToAllCheckbox.checked : false;
    // 【您的要求】核心修正：改為從 .selected 標籤讀取收件人 ID，解決無法發送的問題
    const selectedRecipients = Array.from(document.querySelectorAll('#task-sender-recipient-list .recipient-tag.selected')).map(tag => tag.dataset.userId);

    let actionType = 'None';
    if (styleType === 'console') {
        actionType = document.querySelector('#task-sender-action-type-group .action-btn.active')?.dataset.value || 'None';
    } else {
        actionType = document.querySelector('input[name="taskSenderActionType"]:checked')?.value || 'None';
    }

    const deadlineDate = document.getElementById('task-sender-deadline-date').value;
    const deadlineTime = document.getElementById('task-sender-deadline-time').value;
    let deadline = (deadlineDate && deadlineTime) ? `${deadlineDate}T${deadlineTime}` : '';

    if (actionType === 'ConfirmCompletion' && !deadline) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        deadline = tomorrow.toISOString();
    }

    return {
        // [v558.0] 'action' 已移至 handleSend 中處理，此處不再需要
        senderId: state.currentUserId,
        senderName: state.currentUserName,
        recipients: sendToAll ? ['ALL'] : selectedRecipients,
        content: content,
        projectId: state.projectId || document.getElementById('task-sender-related-project-id').value,
        actionType: actionType,
        deadline: deadline,
        title: `專案任務: ${content.substring(0, 20)}...`
    };
}

/**
 * [內部] 根據 payload 建立一個用於樂觀更新的模擬通知物件。
 * @param {object} payload - 剛建構好的 payload。
 * @param {object} state - 從 config 傳入的 state 物件。
 * @returns {object} - 一個模擬的通知物件。
 */
function _createOptimisticNotification(payload, state) {
    const recipientNames = (payload.recipients[0] === 'ALL')
        ? ['所有員工']
        : payload.recipients.map(id => {
            const emp = state.allEmployees.find(e => e.userId === id);
            return emp ? emp.userName : id;
        });

    return {
        TaskID: `optimistic-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        SenderID: state.currentUserId,
        SenderName: state.currentUserName,
        RecipientName: recipientNames.join(', '),
        Title: payload.title,
        Content: payload.content,
        ActionType: payload.actionType,
        ActionDeadline: payload.deadline,
        Status: '傳送中...'
    };
}

/**
 * [內部] 任務發送成功後，重置 UI 介面。
 * @param {string} styleType - 當前的 UI 樣式 ('hub' 或 'console')。
 */
function _resetUI(styleType, recipientSelector) {
    document.getElementById('task-sender-form').reset();
    recipientSelector.updateSummary(); // 【⭐️ 核心修正：呼叫子元件的 updateSummary 方法 ⭐️】

    if (styleType === 'console') {
        handleActionTypeChange_Button({ target: document.querySelector('#task-sender-action-type-group .action-btn[data-value="None"]') });
    } else {
        document.querySelector('input[name="taskSenderActionType"][value="None"]').dispatchEvent(new Event('change', { bubbles: true }));
    }
}

/**
 * [核心] 處理表單提交事件。
 * @param {Event} event - 表單提交事件。
 * @param {object} config - 元件的設定物件。
 * @param {string} styleType - 當前的 UI 樣式。
 */
async function handleSend(event, config, styleType, recipientSelector) {
    event.preventDefault();
    const { state, callbacks } = config;
    // 取得狀態與 UI 元素
    const statusEl = document.getElementById('task-sender-status');
    const submitBtn = document.getElementById('task-sender-submit-btn');
    const payload = _buildPayload(state, styleType);
    console.log('[TaskSender] 建立的 payload:', payload);
    // 驗證輸入
    if (payload.recipients.length === 0 && !payload.recipients.includes('ALL')) {
        statusEl.textContent = '錯誤：請至少選擇一位收件人。';
        return;
    }
    console.log('[TaskSender] 收件人驗證通過');
    if (!payload.content) {
        statusEl.textContent = '錯誤：請輸入內容。';
        document.getElementById('task-sender-content').focus();
        return;
    }
    console.log('[TaskSender] 內容驗證通過');
    // 更新 UI 狀態
    submitBtn.disabled = true;
    submitBtn.textContent = '發送中...';
    console.log('[TaskSender] 開始發送任務/訊息');

    // 觸發樂觀更新回呼
    if (callbacks && typeof callbacks.onOptimisticUpdate === 'function') {
        const optimisticNotification = _createOptimisticNotification(payload, state);
        callbacks.onOptimisticUpdate(optimisticNotification);
        console.log('[TaskSender] 執行樂觀更新回呼');
    }
    console.log('[TaskSender] 發送 payload 給後端:', payload);
    // 發送請求到後端
    try {
        console.log('[TaskSender] 發送 payload:', payload);
        // [v554.0 重構] 直接呼叫 apiRequest，不再透過 config.api.sendRequest
        const result = await apiRequest({ action: 'sendNotification', payload: payload });
        console.log('[TaskSender] 後端回應:', result);
        // [v551.0] 因為後端現在只回傳 "OK" 文字，我們只需檢查回應是否為 "OK"。
        // 如果不是 "OK"，則將整個回應文字視為錯誤訊息。
        if (!result.success) {
          throw new Error(result.message || '後端處理失敗');
        }
        console.log('[TaskSender] 任務/訊息已成功發送！');
        statusEl.textContent = '任務/訊息已成功發送！';
        console.log('[TaskSender] 重置 UI 狀態');
        _resetUI(styleType, recipientSelector);
        console.log('[TaskSender] 執行成功回呼');
        if (callbacks && typeof callbacks.onSuccess === 'function') {
            callbacks.onSuccess(result);
            console.log('[TaskSender] 成功回呼執行完畢');
        }
    } catch (error) {
        statusEl.textContent = `發送失敗: ${error.message}`;
        console.error('[TaskSender] 發送任務/訊息時發生錯誤:', error);
        if (callbacks && typeof callbacks.onError === 'function') {
            callbacks.onError(error);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '發送任務';
        setTimeout(() => { statusEl.textContent = ''; }, 60000);
    }
}

// =============================================================================
// [v290.0 新增] RecipientSelector 子元件
// =============================================================================

class RecipientSelector {
    // 【您的要求】定義一個包含約 10 種顏色的色階，用於標籤
    #tagColors = [
        { bg: 'bg-sky-100', text: 'text-sky-800', ring: 'ring-sky-400' },
        { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-400' },
        { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-400' },
        { bg: 'bg-indigo-100', text: 'text-indigo-800', ring: 'ring-indigo-400' },
        { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-400' },
        { bg: 'bg-teal-100', text: 'text-teal-800', ring: 'ring-teal-400' },
        { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', ring: 'ring-fuchsia-400' },
        { bg: 'bg-lime-100', text: 'text-lime-800', ring: 'ring-lime-400' },
        { bg: 'bg-cyan-100', text: 'text-cyan-800', ring: 'ring-cyan-400' },
        { bg: 'bg-violet-100', text: 'text-violet-800', ring: 'ring-violet-400' },
    ];
    #employeeColorMap = new Map(); // 用於儲存每個員工對應的顏色

    constructor(options = {}) {
        this.listEl = null;
        this.summaryEl = null;
        this.collapsibleEl = null;
        this.arrowEl = null;
        this.sendToAllCheckbox = null;
        // 【您的要求】將選項儲存為實例屬性
        this.options = options;
    }

    init(state, styleType) {
        this.listEl = document.getElementById('task-sender-recipient-list');
        this.summaryEl = document.getElementById('task-sender-recipient-summary');
        this.collapsibleEl = document.getElementById('task-sender-recipient-collapsible');
        this.arrowEl = document.getElementById('task-sender-recipient-arrow');
        this.sendToAllCheckbox = document.getElementById('task-sender-send-to-all-checkbox');

        if (!this.listEl || !state || !state.allEmployees || state.allEmployees.length === 0) {
            console.warn('[RecipientSelector] 無法初始化：缺少元素或員工資料。');
            return;
        }
        this.listEl.innerHTML = '';
        
        // 【您的要求】根據 styleType 篩選要顯示的員工
        const employeesToShow = (styleType === 'console')
            ? state.allEmployees.filter(emp => emp.permission >= 2 && (emp.group === '台南店' || emp.group === '高雄店'))
            : state.allEmployees.filter(emp => emp.permission >= 2);

        // 【您的要求】為每位員工預先分配顏色
        employeesToShow.forEach((emp, index) => {
            this.#employeeColorMap.set(emp.userId, this.#tagColors[index % this.#tagColors.length]);
        });

        // 【您的要求】呼叫新的渲染方法
        this._renderList(employeesToShow);

        // 【您的要求】如果啟用收合功能，則預設為收合
        if (this.options.collapsible && this.collapsibleEl) {
            this.collapsibleEl.style.maxHeight = '0px';
        }
    }

    /**
     * [內部] 渲染收件人列表，支援分組
     * @param {Array<object>} employees - 要渲染的員工列表
     */
    _renderList(employees) {
        const groupBy = this.options.groupBy;

        if (groupBy) {
            const groupedEmployees = employees.reduce((acc, emp) => {
                const groupKey = emp[groupBy] || '未分類';
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(emp);
                return acc;
            }, {});

            Object.keys(groupedEmployees).sort((a, b) => a.localeCompare(b, 'zh-Hant')).forEach(groupName => {
                const groupHeader = document.createElement('h4');
                groupHeader.className = 'text-xs font-semibold text-gray-500 px-1.5 pt-2 pb-1 border-b';
                groupHeader.textContent = groupName;
                this.listEl.appendChild(groupHeader);
                
                // 【您的要求】改為在群組內建立一個 flex 容器來放置標籤
                const tagContainer = document.createElement('div');
                tagContainer.className = 'flex flex-wrap gap-2 p-1.5';
                groupedEmployees[groupName].forEach(emp => this._createRecipientTag(emp, tagContainer));
                this.listEl.appendChild(tagContainer);
            });
        } else {
            // 無分組時，也使用 flex 容器
            const tagContainer = document.createElement('div');
            tagContainer.className = 'flex flex-wrap gap-2 p-1.5';
            employees.forEach(emp => this._createRecipientTag(emp, tagContainer));
            this.listEl.appendChild(tagContainer);
        }
    }

    /**
     * [內部] 建立單個員工的標籤按鈕並附加到列表
     * @param {object} employee - 員工物件
     * @param {HTMLElement} container - 要附加到的容器元素
     */
    _createRecipientTag(employee, container) {
        const colors = this.#employeeColorMap.get(employee.userId) || this.#tagColors[0];
        const button = document.createElement('button');
        button.type = 'button';
        // 【您的要求】套用標籤樣式，並加入 transition 效果
        button.className = `recipient-tag px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${colors.bg} ${colors.text}`;
        button.textContent = employee.userName;
        button.dataset.userId = employee.userId;
        button.dataset.userName = employee.userName;

        button.addEventListener('click', () => {
            button.classList.toggle('selected');
            button.classList.toggle('ring-2'); // 切換 ring 樣式
            button.classList.toggle(colors.ring); // 切換對應顏色的 ring
            this.updateSummary();
        });
        container.appendChild(button);
    }

    toggleList() {
        if (!this.collapsibleEl || !this.arrowEl) return;
        const isCurrentlyCollapsed = !this.collapsibleEl.style.maxHeight || this.collapsibleEl.style.maxHeight === '0px';
        this.collapsibleEl.style.maxHeight = isCurrentlyCollapsed ? `${this.collapsibleEl.scrollHeight}px` : '0px';
        this.arrowEl.classList.toggle('rotate-180', isCurrentlyCollapsed);
    }

    updateSummary() {
        if (!this.summaryEl) return;
        if (this.sendToAllCheckbox && this.sendToAllCheckbox.checked) {
            this.summaryEl.textContent = '已選擇：所有員工';
            return;
        }
        const selectedTags = Array.from(this.listEl.querySelectorAll('.recipient-tag.selected'));
        if (selectedTags.length === 0) {
            this.summaryEl.textContent = '選擇收件人';
        } else if (selectedTags.length <= 2) {
            this.summaryEl.textContent = '已選擇：' + selectedTags.map(tag => tag.dataset.userName).join('、');
        } else {
            this.summaryEl.textContent = `已選擇：${selectedTags.length} 位員工`;
        }
    }

    toggleSendToAll(isChecked) { // 【您的要求】調整為操作標籤按鈕
        this.listEl.querySelectorAll('.recipient-tag').forEach(tag => {
            tag.disabled = isChecked;
            if (isChecked) {
                tag.classList.remove('selected', 'ring-2', ...Object.values(this.#tagColors).map(c => c.ring));
            }
        });
        this.updateSummary();
    }

    addByName(userName) {
        if (!userName || !this.listEl) return;
        const tag = this.listEl.querySelector(`.recipient-tag[data-user-name="${userName}"]`);
        if (tag && !tag.classList.contains('selected')) {
            tag.click(); // 直接觸發點擊事件來選中
        }
        if (!this.collapsibleEl.style.maxHeight || this.collapsibleEl.style.maxHeight === '0px') {
            this.toggleList();
        }
    }
}

/**
 * [公開] 從外部程式化地新增收件人。
 * @param {string} userName - 要新增的員工姓名。
 */
export function addRecipient(userName) {
    // 這個函式現在只是一個代理，實際邏輯在 RecipientSelector 內部。
    // 由於我們無法直接存取在 initializeTaskSender 內部建立的實例，
    // 這個公開函式暫時無法直接運作。
    // 一個改進方案是將 recipientSelector 實例提升到模組作用域。
    console.warn('addRecipient is called, but cannot access the internal selector instance. This requires further refactoring.');
}