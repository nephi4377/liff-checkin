import Dashboard from './Dashboard.js';
import ProjectBoard from './ProjectBoard.js';
import IframeView from './IframeView.js'; // [v411.0 SPA化] 引入 Iframe 元件
import { CONFIG } from '../shared/js/config.js'; // [v602.0 重構] 引入統一設定檔
import { saveCache, loadCache } from '../shared/js/utils.js';
import { request as apiRequest } from '../modules/projects/js/projectApi.js'; // [重構] 改為引入統一的 projectApi 模組
import { initializeTaskSender } from '../shared/js/taskSender.js'; // [v509.0 修正] 更新共用模組路徑

const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

const App = {
    components: { Dashboard, ProjectBoard, IframeView }, // [v411.0 SPA化] 註冊 Iframe 元件
    setup() {
        // --- 環境設定 ---
        // [v602.0 重構] 所有 URL 和 LIFF ID 改為從 config.js 讀取

        // --- 狀態管理 (State) ---
        const isLoading = ref(true);
        const userProfile = ref(null);
        const allEmployees = ref([]);
        const allProjects = ref([]);
        const notifications = ref([]);
        const pendingApprovals = ref(0);
        const currentView = ref({ name: 'dashboard' });
        const lightbox = ref({
            visible: false,
            images: [],
            currentIndex: 0
        });

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
            '#/new-site': { name: 'iframe', src: 'modules/projects/NewSiteForm.html', title: '新增案場資料' }, // [v515.0 修正] 改為絕對路徑
            '#/faq': { name: 'iframe', src: 'modules/info/FAQ.html', title: '客戶常見問答' }, // [v518.0 修正]
            '#/daily-report': { name: 'iframe', src: 'modules/projects/daily_report.html', title: '團隊工作總覽' }, // [v515.0 修正] 改為絕對路徑
            '#/onboarding-flow': { name: 'iframe', src: 'modules/info/onboardingflow.html', title: '客戶接洽流程' }, // [v518.0 修正]
            '#/attendance-report': { name: 'iframe', src: 'modules/attendance/attendance_report.html', title: '出勤儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/approval-dashboard': { name: 'iframe', src: 'modules/attendance/approval_dashboard.html', title: '假勤審核儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/leave-request': { name: 'iframe', src: 'modules/attendance/leave_request.html', title: '線上假勤申請' }, // [v515.0 修正] 改為絕對路徑
            '#/shift-schedule': { name: 'iframe', src: 'modules/attendance/shift_schedule.html', title: '員工排班系統' }, // [v515.0 修正] 改為絕對路徑
            // [v424.0 架構優化] 將專案工作區與施工回報改為內嵌 iframe
            '#/project-console': { name: 'iframe', src: 'modules/projects/managementconsole.html', title: '專案工作區' }, // [v543.0 修正] 改為正確的模組路徑
            '#/report': { name: 'iframe', src: 'modules/projects/report.html', title: '施工回報' }, // [v543.0 修正] 改為正確的模組路徑
            // 【您的要求】新增互動式室內設計規劃工具與平面圖校正工具的路由
            '#/layout-planner': { name: 'iframe', src: 'modules/InteriorDesigned/LayoutPlanner.html', title: '互動式室內設計規劃工具' },
            '#/floorplan-straightener': { name: 'iframe', src: 'modules/InteriorDesigned/floorplan-straightener.html', title: '平面圖校正工具' },
        };
        // [v513.0 新增] 補上員工資料編輯頁面的路由
        routes['#/employee-editor'] = { name: 'iframe', src: 'modules/attendance/employee_editor.html', title: '員工資料編輯' }; // [v515.0 修正] 改為絕對路徑

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
        const openLightbox = (images, startIndex = 0) => {
            console.log('[Lightbox] openLightbox called with:', { images, startIndex });
            if (!images || images.length === 0) return;

            // [v559.6 終極修正] 使用 nextTick 強制 Vue 在下一個 DOM 更新循環中更新畫面。
            // 這是為了解決在複雜的跨 iframe 通訊中，響應式更新偶爾會失效的邊界情況。
            // 1. 先更新資料
            lightbox.value.images = images;
            lightbox.value.currentIndex = startIndex;
            
            // 2. 在下一個 "tick" 中更新可見性，強制觸發渲染
            nextTick(() => {
                lightbox.value.visible = true;
                document.body.style.overflow = 'hidden'; // 在燈箱可見時才鎖定滾動
            });
        };

        const closeLightbox = () => {
            if (!lightbox.value.visible) return; // 防止重複觸發
            
            // 恢復背景滾動
            document.body.style.overflow = '';
            
            // [v559.6] 為了與 openLightbox 的邏輯對稱，此處也直接修改屬性
            lightbox.value.visible = false;
            
            // 延遲清空資料，讓淡出動畫能順利完成
            setTimeout(() => {
                lightbox.value.images = [];
            }, 300);
        };

        const showNextImage = () => {
            if (lightbox.value.images.length === 0) return;
            lightbox.value.currentIndex = (lightbox.value.currentIndex + 1) % lightbox.value.images.length;
        };

        const showPrevImage = () => {
            if (lightbox.value.images.length === 0) return;
            lightbox.value.currentIndex = (lightbox.value.currentIndex - 1 + lightbox.value.images.length) % lightbox.value.images.length;
        };

        const handleKeydown = (e) => {
            if (!lightbox.value.visible) return;
            if (e.key === 'ArrowRight') showNextImage();
            if (e.key === 'ArrowLeft') showPrevImage();
        };
        const fetchAttendanceData = async () => {
            if (!userProfile.value) return { success: false };
            const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
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
            const url = new URL(CONFIG.GAS_WEB_APP_URL);
            url.searchParams.append('page', 'get_hub_projects_data');
            url.searchParams.append('userId', userProfile.value.userId);
            url.searchParams.append('userProfile', JSON.stringify(user));
            const response = await fetch(url); // 移除手動設定的 header
            return response.json();
        };

        const processNotificationAction = async (payload) => {
            try {
                const apiPayload = { action: 'process_notification_action', ...payload };
                // [v549.0 CORS 修正] 將請求方式改為 FormData，以繞過 CORS 預檢請求。
                const formData = new FormData();
                formData.append('payload', JSON.stringify(apiPayload)); // [v602.0 重構] 改為使用 CONFIG
                const response = await fetch(CONFIG.GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: formData,
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

        // [v559.8 核心重構] 將所有非同步初始化邏輯移出 onMounted，確保 setup 同步返回。
        const initializeApplication = async () => {
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
                    await liff.init({ liffId: CONFIG.HUB_LIFF_ID }); // 使用專屬於主控台的 LIFF ID
                    if (!liff.isLoggedIn()) {
                        liff.login();
                        return;
                    }
                    userProfile.value = await liff.getProfile();
                }

                const [attendanceResult, projectsResult] = await Promise.all([fetchAttendanceData(), fetchHubProjectsData()]);

                if (attendanceResult.success && attendanceResult.employees) {
                    if (JSON.stringify(allEmployees.value) !== JSON.stringify(attendanceResult.employees)) {
                        allEmployees.value = attendanceResult.employees;
                        saveCache(EMPLOYEES_CACHE_KEY, attendanceResult.employees);
                        // 【您的要求】核心新增：將員工列表暴露到全域，供 iframe 子頁面使用
                        window.spaAllEmployees = attendanceResult.employees;
                    }
                    pendingApprovals.value = attendanceResult.pendingRequests?.length || 0;
                }

                if (projectsResult.success && projectsResult.data) {
                    const newProjects = projectsResult.data.projects || [];
                    if (JSON.stringify(allProjects.value) !== JSON.stringify(newProjects)) {
                        allProjects.value = newProjects;
                        saveCache(PROJECTS_CACHE_KEY, newProjects);
                    }
                    notifications.value = projectsResult.data.notifications || [];
                }
            } catch (error) {
                console.error('Initialization Error:', error);
            } finally {
                isLoading.value = false;
            }
        };

        // --- 生命週期鉤子 (Lifecycle Hooks) ---
        onMounted(async () => {
            // [v559.2 核心修正] 立即註冊 iframe 訊息監聽器，確保不會錯過任何來自 iframe 的 postMessage。
            // [v559.8] onMounted 只負責觸發非同步初始化，本身保持同步。
            initializeApplication();
        });

        // [v559.3 核心修正] 將 handleIframeMessage 移入 setup 作用域，確保能存取 openLightbox。
        const handleIframeMessage = (event) => {
            // 為了安全，可以檢查 event.origin
            // if (event.origin !== 'https://your-expected-origin.com') return;
            
            const { type, payload } = event.data;
            if (type === 'openLightbox' && payload) {
                console.log('[Lightbox] Received message from iframe:', payload);
                openLightbox(payload.images, payload.index);
            }
        };
        // 將監聽器放在 setup 函式的頂層，確保它只被註冊一次。
        window.addEventListener('message', handleIframeMessage);

        // 【您的要求】核心修正：監聽權限與當前視圖，確保任務交辦中心能被正確初始化
        watch([hasAdminRights, currentView, allEmployees], ([isAdmin, view, employees]) => {
            // 只有當使用者有權限，且當前視圖是主控台時，才執行
            if (isAdmin && view.name === 'dashboard' && employees.length > 0) {
                // 使用 nextTick 確保 DOM 元素已準備就緒
                nextTick(() => {
                    const taskSenderContainer = document.getElementById('task-sender-container');
                    if (taskSenderContainer) {
                        const state = { allEmployees: allEmployees.value, currentUserId: userProfile.value.userId, currentUserName: userProfile.value.displayName };
                        // [v553.0 架構統一] 為了與 main.js 的行為一致，此處模擬 projectApi.js 的 postTask 流程。
                        // [重構] 將請求函式直接指向 apiRequest，並固定 action 為 'sendNotification'。
                        // taskSender 模組會自動將它的 payload 傳遞給這個函式。
                        const sendRequestFunction = (payload) => apiRequest({ action: 'sendNotification', payload });
                        const config = { state, api: { sendRequest: sendRequestFunction }, callbacks: { onSuccess: fetchHubProjectsData } };
                        // 【您的要求】傳入分組與收合設定
                        initializeTaskSender(taskSenderContainer, config, { style: 'hub', collapsible: true, groupBy: 'group' });
                    }
                });
            }
        }, { immediate: true }); // immediate: true 確保在初次載入時也會執行一次檢查

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
            // 燈箱功能
            lightbox,
            openLightbox,
            closeLightbox,
            showPrevImage, // [v559.10 修正] 導出方法給模板使用
            showNextImage, // [v559.10 修正] 導出方法給模板使用
            handleKeydown, // 解決 Vue warn: Property "handleKeydown" is not defined on instance
        };
    }, // [v418.1 修正] 補上遺失的逗號，解決 setup() 與 template 之間的語法錯誤
    template: `
        <div v-if="isLoading" class="fixed inset-0 bg-white flex flex-col items-center justify-center z-50"><div class="spinner w-12 h-12 border-4 border-gray-200 rounded-full"></div><p class="mt-4 text-gray-600">正在驗證您的身分並載入資料...</p></div>
        
        <div v-else id="app-wrapper" class="flex flex-col h-screen" @keydown.esc="closeLightbox" @keydown.left="handleKeydown" @keydown.right="handleKeydown" tabindex="-1">
            <!-- [v559.10 修正] 將燈箱移至 v-else 內部，並與 header/main 成為兄弟節點 -->
            <transition name="fade">
                <div v-if="lightbox.visible" @click="closeLightbox" class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[999]">
                    <!-- 上一張按鈕 -->
                    <button v-if="lightbox.images.length > 1" @click.stop="showPrevImage" class="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl opacity-50 hover:opacity-100 transition-opacity z-[1001]">&#10094;</button>
                    <!-- 圖片本體 -->
                    <img :src="lightbox.images[lightbox.currentIndex]" @click.stop class="max-w-[80vw] max-h-[90vh] object-contain cursor-default rounded-lg shadow-xl">
                    <!-- 下一張按鈕 -->
                    <button v-if="lightbox.images.length > 1" @click.stop="showNextImage" class="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl opacity-50 hover:opacity-100 transition-opacity z-[1001]">&#10095;</button>
                </div>
            </transition>

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
            <!-- 【您的要求】核心修正：當視圖為 iframe 時，移除 main 元素的寬度限制，讓 iframe 可以全寬顯示 -->
            <main :class="['flex-grow overflow-y-auto', { 'container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8': currentView.name !== 'iframe' }]">
                <!-- [v428.0 UX優化] 將 Dashboard 和 ProjectBoard 都放入限寬容器中，提升閱讀體驗 -->
                <!-- 【您的要求】核心修正：移除內層的寬度限制，統一由 main 元素控制 -->
                <div v-if="currentView.name === 'dashboard'" class="py-6">
                    <Dashboard :userProfile="userProfile" :notifications="notifications" :pendingApprovals="pendingApprovals" :allEmployees="allEmployees" :hasAdminRights="hasAdminRights" :currentUser="currentUser" @notification-action="handleNotificationAction" @clear-notifications="clearAllNotifications" />
                    <!-- 任務交辦中心容器 -->
                    <div v-if="hasAdminRights" id="task-sender-container" class="mt-4"></div>
                </div>
                <div v-else-if="currentView.name === 'project-board'" class="py-6">
                     <ProjectBoard :projects="allProjects" :userProfile="userProfile" :currentUser="currentUser" />
                </div>
                <!-- [v544.0 核心修正] 增加 v-if="userProfile" 判斷，確保在 userProfile 載入完成後才渲染 iframe -->
                <div v-else-if="currentView.name === 'iframe' && userProfile" class="h-full">
                    <!-- [v424.0 架構優化] 根據路由動態組合 iframe 的 src -->
                    <IframeView :src="currentView.src + 
                        (currentView.src.includes('?') ? '&' : '?') + 
                        'uid=' + userProfile.userId + 
                        '&name=' + userProfile.displayName +
                        '&permission=' + (currentUser?.permission || 1) +
                        '&shiftStart=' + (currentUser?.shiftStart || '08:30') +
                        '&shiftEnd=' + (currentUser?.shiftEnd || '17:30') +
                        (currentView.params || '')" />
                </div>
            </main>
        </div>
    `
};

createApp(App).mount('#app');
