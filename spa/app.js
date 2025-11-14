import Dashboard from './Dashboard.js';
import ProjectBoard from './ProjectBoard.js';
import IframeView from './IframeView.js'; // [v411.0 SPA化] 引入 Iframe 元件
import { saveCache, loadCache, showGlobalNotification } from '../shared/js/utils.js'; // [v509.0 修正] 更新共用模組路徑
import { initializeTaskSender } from '../shared/js/taskSender.js'; // [v509.0 修正] 更新共用模組路徑

const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const App = {
    components: { Dashboard, ProjectBoard, IframeView }, // [v411.0 SPA化] 註冊 Iframe 元件
    setup() {
        // --- 環境設定 ---
        const LIFF_ID = '2007974938-2nPKg3J0';
        const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';
        const ATTENDANCE_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz5-DUPNNciVdvE5wrOogNgxYt8EpDZppAe9f2cUh8pW9y3i29fB6n0RA5r-A5KuAiz/exec';

        // --- 狀態管理 (State) ---
        const isLoading = ref(true);
        const userProfile = ref(null);
        const allEmployees = ref([]);
        const allProjects = ref([]);
        const notifications = ref([]);
        const pendingApprovals = ref(0);
        const currentView = ref({ name: 'dashboard' });

        // --- [v429.0 效能優化] 快取優先策略 ---
        const EMPLOYEES_CACHE_KEY = 'spa_hub_employees';
        const PROJECTS_CACHE_KEY = 'spa_hub_projects';

        // 1. 應用程式啟動時，立即嘗試從快取載入資料
        const cachedEmployees = loadCache(EMPLOYEES_CACHE_KEY);
        const cachedProjects = loadCache(PROJECTS_CACHE_KEY);

        if (cachedEmployees) {
            allEmployees.value = cachedEmployees;
        }
        if (cachedProjects) {
            allProjects.value = cachedProjects;
        }
        // --- 快取策略結束 ---

        // --- 計算屬性 (Computed) ---
        const welcomeMessage = computed(() => userProfile.value ? `歡迎，${userProfile.value.displayName}！` : '歡迎！');
        const currentUser = computed(() => allEmployees.value.find(emp => emp.userId === userProfile.value?.userId));
        const hasAdminRights = computed(() => (currentUser.value?.permission || 1) >= 2);

        // [v411.0 SPA化] 簡易路由系統
        const routes = {
            '#': { name: 'dashboard' },
            '#/dashboard': { name: 'dashboard' },
            '#/project-board': { name: 'project-board' },
            // [v413.0 SPA化] 擴充路由表，將更多獨立頁面以 iframe 方式整合進來
            '#/new-site': { name: 'iframe', src: '/modules/projects/NewSiteForm.html', title: '新增案場資料' }, // [v515.0 修正] 改為絕對路徑
            '#/faq': { name: 'iframe', src: '/modules/info/FAQ.html', title: '客戶常見問答' }, // [v518.0 修正]
            '#/daily-report': { name: 'iframe', src: '/modules/projects/daily_report.html', title: '施工回報總覽' }, // [v515.0 修正] 改為絕對路徑
            '#/onboarding-flow': { name: 'iframe', src: '/modules/info/onboardingflow.html', title: '客戶接洽流程' }, // [v518.0 修正]
            '#/attendance-report': { name: 'iframe', src: '/modules/attendance/attendance_report.html', title: '出勤儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/approval-dashboard': { name: 'iframe', src: '/modules/attendance/approval_dashboard.html', title: '假勤審核儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/leave-request': { name: 'iframe', src: '/modules/attendance/leave_request.html', title: '線上假勤申請' }, // [v515.0 修正] 改為絕對路徑
            '#/shift-schedule': { name: 'iframe', src: '/modules/attendance/shift_schedule.html', title: '員工排班系統' }, // [v515.0 修正] 改為絕對路徑
            // [v424.0 架構優化] 將專案工作區與施工回報改為內嵌 iframe
            '#/project-console': { name: 'iframe', src: '/modules/projects/managementconsole.html', title: '專案工作區' }, // [v543.0 修正] 改為正確的模組路徑
            '#/report': { name: 'iframe', src: '/modules/projects/report.html', title: '施工回報' }, // [v543.0 修正] 改為正確的模組路徑
        };
        // [v513.0 新增] 補上員工資料編輯頁面的路由
        routes['#/employee-editor'] = { name: 'iframe', src: '/modules/attendance/employee_editor.html', title: '員工資料編輯' }; // [v515.0 修正] 改為絕對路徑

        const handleRouteChange = () => {
            const hash = window.location.hash || '#';
            // [v425.0 架構優化] 處理帶有查詢參數的 hash 路由
            const [path, queryString] = hash.split('?');
            const route = routes[path] || routes['#'];
            
            currentView.value = { 
                ...route,
                params: queryString ? `&${queryString}` : '' // 將 hash 中的參數轉給 iframe
            };
            console.log(`[Router] Navigated to: ${hash}`, route);
        };

        // --- 方法 (Methods) ---
        const fetchAttendanceData = async () => {
            if (!userProfile.value) return { success: false };
            const url = new URL(ATTENDANCE_GAS_WEB_APP_URL);
            url.searchParams.append('page', 'attendance_api');
            url.searchParams.append('action', 'get_hub_core_data');
            url.searchParams.append('userId', userProfile.value.userId);
            url.searchParams.append('userName', userProfile.value.displayName);
            const response = await fetch(url);
            return response.json();
        };

        const fetchHubProjectsData = async () => {
            if (!userProfile.value) return { success: false };
            const user = currentUser.value || { userId: userProfile.value.userId, userName: userProfile.value.displayName, permission: 1, group: '未分類' };
            const url = new URL(GAS_WEB_APP_URL);
            url.searchParams.append('page', 'get_hub_projects_data');
            url.searchParams.append('userId', userProfile.value.userId);
            url.searchParams.append('userProfile', JSON.stringify(user));
            const response = await fetch(url);
            return response.json();
        };

        const processNotificationAction = async (payload) => {
            try {
                const apiPayload = { action: 'process_notification_action', ...payload };
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify(apiPayload),
                    headers: { 'Content-Type': 'text/plain' }
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);
                return result;
            } catch (error) {
                console.error('[API] 處理通知動作失敗:', error);
                alert(`操作失敗: ${error.message}`);
            }
        };

        const handleNotificationAction = ({ action, notificationId, content }) => {
            const notification = notifications.value.find(n => n.NotificationID === notificationId);
            if (!notification) return;

            const isTaskType = notification.ActionType === 'ReplyText' || notification.ActionType === 'ConfirmCompletion';
            let subAction = '';

            if (action === 'delete') {
                subAction = isTaskType ? 'archive' : 'mark_read';
            } else if (action === 'reply') {
                subAction = 'reply';
            } else if (action === 'complete') {
                subAction = 'complete';
            }

            if (subAction) {
                // 樂觀更新：立即從畫面上移除
                notifications.value = notifications.value.filter(n => n.NotificationID !== notificationId);
                processNotificationAction({ subAction, notificationId, content, userName: userProfile.value.displayName });
            }
        };

        const clearAllNotifications = () => {
            const idsToMarkRead = notifications.value
                .filter(n => n.ActionType === 'None')
                .map(n => n.NotificationID);
            
            if (idsToMarkRead.length > 0) {
                // 樂觀更新
                notifications.value = notifications.value.filter(n => n.ActionType !== 'None');
                processNotificationAction({ subAction: 'mark_read', notificationIds: idsToMarkRead.join(',') });
            }
        };

        // --- 生命週期鉤子 (Lifecycle Hooks) ---
        onMounted(async () => {
            const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

            // 2. [v429.0 效能優化] 如果已有快取，則立即結束載入動畫，讓使用者看到畫面
            if (cachedEmployees && cachedProjects) {
                isLoading.value = false;
                console.log('⚡️ 從快取載入資料，立即渲染畫面。');
            }

            try {
                if (isLocalTest) {
                    userProfile.value = { userId: 'Ud58333430513b7527106fa71d2e30151', displayName: '俊豪 (本地測試)' };
                } else {
                    await liff.init({ liffId: LIFF_ID });
                    if (!liff.isLoggedIn()) {
                        liff.login();
                        return;
                    }
                    userProfile.value = await liff.getProfile();
                }

                const [attendanceResult, projectsResult] = await Promise.all([fetchAttendanceData(), fetchHubProjectsData()]);

                // 3. [v429.0 效能優化] 智慧更新員工資料
                if (attendanceResult.success && attendanceResult.employees) {
                    // 只有在後端資料與當前畫面資料不同時，才更新畫面與快取
                    if (JSON.stringify(allEmployees.value) !== JSON.stringify(attendanceResult.employees)) {
                        console.log('🔄 員工資料已在背景更新。');
                        allEmployees.value = attendanceResult.employees;
                        saveCache(EMPLOYEES_CACHE_KEY, attendanceResult.employees);
                    }
                    // 無論如何都更新待審核數量
                    pendingApprovals.value = attendanceResult.pendingRequests?.length || 0;
                }

                // 4. [v429.0 效能優化] 智慧更新專案與通知資料
                if (projectsResult.success && projectsResult.data) {
                    const newProjects = projectsResult.data.projects || [];
                    // 只有在後端資料與當前畫面資料不同時，才更新畫面與快取
                    if (JSON.stringify(allProjects.value) !== JSON.stringify(newProjects)) {
                        console.log('🔄 專案資料已在背景更新。');
                        allProjects.value = newProjects;
                        saveCache(PROJECTS_CACHE_KEY, newProjects);
                        // 如果不是首次載入 (即畫面已由快取渲染)，才跳出通知提醒使用者
                        if (!isLoading.value) { 
                            showGlobalNotification('專案資料已自動更新。', 3000, 'info');
                        }
                    }
                    // 通知永遠使用最新的
                    notifications.value = projectsResult.data.notifications || [];
                }

            } catch (error) {
                console.error('Initialization Error:', error);
                showGlobalNotification(`資料載入失敗: ${error.message}`, 5000, 'error');
            } finally {
                // 5. 無論成功或失敗，最終都確保載入動畫被隱藏
                isLoading.value = false;
            }
        });

        // 監聽權限變化，並在 DOM 更新後初始化任務交辦中心
        watch(hasAdminRights, (newValue) => {
            if (newValue) {
                nextTick(() => {
                    const taskSenderContainer = document.getElementById('task-sender-container');
                    if (taskSenderContainer) {
                        const state = { allEmployees: allEmployees.value, currentUserId: userProfile.value.userId, currentUserName: userProfile.value.displayName };
                        const postTaskFunction = (payload) => fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain' } }).then(res => res.json());
                        const config = { state, api: { sendRequest: postTaskFunction }, onSuccess: fetchHubProjectsData };
                        initializeTaskSender(taskSenderContainer, config, { style: 'hub' });
                    }
                });
            }
        });

        // [v411.0 SPA化] 監聽 URL hash 的變化
        window.addEventListener('hashchange', handleRouteChange);
        handleRouteChange(); // 初始載入時執行一次

        return {
            isLoading,
            welcomeMessage,
            userProfile,
            allEmployees,
            allProjects,
            notifications,
            pendingApprovals,
            hasAdminRights,
            handleNotificationAction,
            clearAllNotifications,
            currentUser,
            currentView, // [v411.0 SPA化] 將路由狀態傳給模板
        };
    }, // [v418.1 修正] 補上遺失的逗號，解決 setup() 與 template 之間的語法錯誤
    template: `
        <div v-if="isLoading" class="fixed inset-0 bg-white flex flex-col items-center justify-center z-50"><div class="spinner w-12 h-12 border-4 border-gray-200 rounded-full"></div><p class="mt-4 text-gray-600">正在驗證您的身分並載入資料...</p></div>
        
        <div v-else id="app-wrapper" class="flex flex-col h-screen">
            <!-- [v419.0 UX優化] 將 header 統一為全寬佈局，解決切換頁面時的跳動問題 -->
            <!-- [v420.0 RWD優化] 增加手機版 header 的響應式設計 -->
            <header class="flex-shrink-0 border-b border-gray-200 py-2">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center container mx-auto px-4 sm:px-6 lg:px-8 gap-2">
                     <!-- [v421.0 UX優化] 移除標題與歡迎詞，讓版面更簡潔 -->
                     <div class="flex items-center">
                         <!-- [v423.0 UX優化] 移除 v-if，讓導覽列在 iframe 頁面也顯示 -->
                         <nav class="-mb-px flex gap-6" aria-label="Tabs">
                             <a href="#/dashboard" :class="['py-3 px-1 text-base font-bold', currentView.name === 'dashboard' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300']">主控台</a>
                             <a href="#/project-board" :class="['py-3 px-1 text-base font-bold', currentView.name === 'project-board' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300']">專案看板</a>
                         </nav>
                     </div>
                </div>
            </header>

            <!-- [v419.0 UX優化] 主要內容區的寬度限制與 header 分離 -->
            <main class="flex-grow overflow-y-auto">
                <!-- [v428.0 UX優化] 將 Dashboard 和 ProjectBoard 都放入限寬容器中，提升閱讀體驗 -->
                <div v-if="currentView.name === 'dashboard'" class="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-6">
                    <Dashboard :userProfile="userProfile" :notifications="notifications" :pendingApprovals="pendingApprovals" :allEmployees="allEmployees" :hasAdminRights="hasAdminRights" :currentUser="currentUser" @notification-action="handleNotificationAction" @clear-notifications="clearAllNotifications" />
                    <!-- 任務交辦中心容器 -->
                    <div v-if="hasAdminRights" id="task-sender-container" class="mt-4"></div>
                </div>
                <div v-else-if="currentView.name === 'project-board'" class="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-6">
                     <ProjectBoard :projects="allProjects" :userProfile="userProfile" :currentUser="currentUser" />
                </div>
                <div v-else-if="currentView.name === 'iframe'" class="h-full">
                    <!-- [v424.0 架構優化] 根據路由動態組合 iframe 的 src -->
                    <IframeView :src="currentView.src + 
                        (currentView.src.includes('?') ? '&' : '?') + 
                        'uid=' + userProfile.userId + 
                        '&name=' + userProfile.displayName +
                        (currentView.params || '')" />
                </div>
            </main>
        </div>
    `
};

createApp(App).mount('#app');
