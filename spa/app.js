import Dashboard from './Dashboard.js?v=26.05.07.3';
import ProjectBoard from './ProjectBoard.js';
import StaffTodaySidebar from './StaffTodaySidebar.js?v=26.06.21.6';
import HubLeftSidebar from './HubLeftSidebar.js?v=26.06.21.5';
import IframeView from './IframeView.js'; // [v411.0 SPA化] 引入 Iframe 元件
import { CONFIG } from '../shared/js/config.js'; // [v602.0 重構] 引入統一設定檔
import { saveCache, loadCache, loadHubPresenceCache, saveHubPresenceCache, loadDailyCache, saveDailyCache, purgeStaleDailyCaches, hubSidebarDailyCacheKey, hubPresenceTodayStr } from '../shared/js/utils.js';
import { request as apiRequest } from '../modules/projects/js/projectApi.js'; // [重構] 改為引入統一的 projectApi 模組
import { initializeTaskSender } from '../shared/js/taskSender.js'; // [v509.0 修正] 更新共用模組路徑

const { createApp, ref, onMounted, onUnmounted, computed, watch, nextTick } = Vue;

const HUB_PRESENCE_POLL_MS = 30 * 60 * 1000;

const App = {
    components: { Dashboard, ProjectBoard, StaffTodaySidebar, HubLeftSidebar, IframeView }, // [v411.0 SPA化] 註冊 Iframe 元件
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
        // 當月班表（供「今日出勤」卡片使用）。結構同 09_排班系統資料格式規格書 的 get_latest_schedule 回傳。
        const monthSchedule = ref({ schedule: {}, holidays: [] });
        // 班表是否正在向後端更新中（用於「快取優先 + 更新中 + 最新資訊」的狀態顯示）
        const scheduleLoading = ref(false);
        // 待審核假勤原始清單（包含 startTime/endTime），用於今日出勤的「待審核」標記
        const pendingRequestsRaw = ref([]);
        const todayPresence = ref({});
        const presenceLoading = ref(false);
        const todayReports = ref([]);
        const todayReportsLoading = ref(false);
        const paymentTodos = ref({ pendingReview: [], pendingPayment: [] });
        const paymentTodosLoading = ref(false);
        const currentView = ref({ name: 'dashboard' });
        const lightbox = ref({
            visible: false,
            images: [],
            currentIndex: 0
        });

        /** 主控台底部公開落地頁（LandingPage.html）；禮券 InviteSheet 另覓入口 */
        const landingPagePublicUrl = 'https://info.tanxin.space/modules/info/LandingPage.html';
        const landingPageUrlCopied = ref(false);
        let landingCopyTimer = null;
        const copyLandingPageUrl = () => {
            const url = landingPagePublicUrl;
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                window.prompt('請長按或全選複製以下網址：', url);
                return;
            }
            navigator.clipboard.writeText(url).then(() => {
                landingPageUrlCopied.value = true;
                if (landingCopyTimer) clearTimeout(landingCopyTimer);
                landingCopyTimer = setTimeout(() => { landingPageUrlCopied.value = false; }, 2500);
            }).catch(() => {
                window.prompt('複製失敗，請手動複製：', url);
            });
        };

        // --- [v429.0 效能優化] 快取優先策略 ---
        const EMPLOYEES_CACHE_KEY = 'spa_hub_employees';
        const PROJECTS_CACHE_KEY = 'spa_hub_projects';
        // 班表依「年-月」分鍵快取，TTL 7 天（仍會背景重抓最新；久未開啟時本機資料較舊，屬可接受取捨）
        const scheduleCacheKey = () => {
            const d = new Date();
            return `spa_hub_schedule_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        // 1. 應用程式啟動時，立即嘗試從快取載入資料
        const cachedEmployees = loadCache(EMPLOYEES_CACHE_KEY);
        const cachedProjects = loadCache(PROJECTS_CACHE_KEY);
        const cachedSchedule = loadCache(scheduleCacheKey());
        const cachedPresence = loadHubPresenceCache();

        if (cachedEmployees) {
            allEmployees.value = cachedEmployees;
            window.spaAllEmployees = cachedEmployees;
        }
        if (cachedProjects) {
            allProjects.value = cachedProjects;
            window.spaAllProjects = cachedProjects;
        }
        if (cachedSchedule && cachedSchedule.schedule) {
            monthSchedule.value = cachedSchedule;
        }
        if (cachedPresence && typeof cachedPresence === 'object') {
            todayPresence.value = cachedPresence;
        }
        purgeStaleDailyCaches('spa_hub_today_reports_');
        purgeStaleDailyCaches('spa_hub_payment_todos_');
        const cachedTodayReports = loadDailyCache(hubSidebarDailyCacheKey('spa_hub_today_reports'));
        if (Array.isArray(cachedTodayReports)) {
            todayReports.value = cachedTodayReports;
        }
        const cachedPaymentTodos = loadDailyCache(hubSidebarDailyCacheKey('spa_hub_payment_todos'));
        if (cachedPaymentTodos && typeof cachedPaymentTodos === 'object') {
            paymentTodos.value = cachedPaymentTodos;
        }
        // --- 快取策略結束 ---

        // --- 計算屬性 (Computed) ---
        const welcomeMessage = computed(() => userProfile.value ? `歡迎，${userProfile.value.displayName}！` : '歡迎！');
        // 權限 5 不在 attendance_active 名單時，改由 API 回傳的 operator 辨識身分
        const operatorProfile = ref(null);
        const currentUser = computed(() => {
            const uid = userProfile.value?.userId;
            if (!uid) return null;
            const fromList = allEmployees.value.find(emp => emp.userId === uid);
            if (fromList) return fromList;
            const op = operatorProfile.value;
            if (op && String(op.userId) === String(uid)) return op;
            return null;
        });
        const hasAdminRights = computed(() => Number(currentUser.value?.permission || 0) >= 4);

        // [v411.0 SPA化] 簡易路由系統
        const routes = {
            '#': { name: 'dashboard' },
            '#/dashboard': { name: 'dashboard' },
            '#/project-board': { name: 'project-board' },
            // [v413.0 SPA化] 擴充路由表，將更多獨立頁面以 iframe 方式整合進來
            '#/new-site': { name: 'iframe', src: 'modules/projects/NewSiteForm.html', title: '新增／修改案場資料' }, // [v515.0 修正] 改為絕對路徑；標題與表單「可選既有案場更新」一致
            '#/faq': { name: 'iframe', src: 'modules/info/FAQ.html', title: '客戶常見問答' }, // [v518.0 修正]
            '#/daily-report': { name: 'iframe', src: 'modules/projects/daily_report.html', title: '團隊工作總覽' }, // [v515.0 修正] 改為絕對路徑
            '#/onboarding-flow': { name: 'iframe', src: 'modules/info/onboardingflow.html', title: '客戶接洽流程' }, // [v518.0 修正]
            '#/attendance-report': { name: 'iframe', src: 'modules/attendance/attendance_report.html', title: '出勤儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/my-personal': { name: 'iframe', src: 'modules/attendance/attendance_report.html', title: '我的出勤與假勤', params: '&mode=personal' },
            '#/staff-status-board': { name: 'iframe', src: 'modules/attendance/staff_status_board.html', title: '全員出勤燈號看板' },
            '#/approval-dashboard': { name: 'iframe', src: 'modules/attendance/approval_dashboard.html', title: '假勤審核儀表板' }, // [v515.0 修正] 改為絕對路徑
            '#/leave-request': { name: 'iframe', src: 'modules/attendance/leave_request.html', title: '線上假勤申請' }, // [v515.0 修正] 改為絕對路徑
            '#/shift-schedule': { name: 'iframe', src: 'modules/attendance/shift_schedule.html', title: '員工排班系統' }, // [v515.0 修正] 改為絕對路徑
            // [v424.0 架構優化] 將專案工作區與施工回報改為內嵌 iframe
            '#/project-console': { name: 'iframe', src: 'modules/projects/managementconsole.html', title: '專案工作區' }, // [v543.0 修正] 改為正確的模組路徑
            '#/report': { name: 'iframe', src: 'modules/projects/reportV3.html', title: '施工回報' }, // [v605.3] 修正相容性後重新啟用 V3 版本
            // 【您的要求】新增互動式室內設計規劃工具與平面圖校正工具的路由
            '#/layout-planner': { name: 'iframe', src: 'modules/InteriorDesigned/LP_LayoutPlanner.html', title: '互動式室內設計規劃工具' },
            '#/floorplan-straightener': { name: 'iframe', src: 'modules/InteriorDesigned/floorplan-straightener.html', title: '平面圖校正工具' },
            // 【您的要求】新增報價單工具整合路由
            '#/budget-web': { name: 'iframe', src: 'tools/BudgetWeb_Standalone.html', title: '報價單解析器' },
            '#/budget-audit': { name: 'iframe', src: 'tools/BudgetAuditor_Standalone_V2.html', title: '案場驗收表' },
            '#/accounting-ingest': { name: 'iframe', src: 'modules/accounting/accounting_ingest.html', title: '收支登錄' },
            '#/accounting': { name: 'iframe', src: 'modules/accounting/index.html', title: '添心會計' },
            '#/accounting/vendor-payment-approve': { name: 'iframe', src: 'modules/accounting/ledger_review.html', title: '請款審核' },
            '#/accounting/vendor-payment-finance': { name: 'iframe', src: 'modules/accounting/vendor_payment_finance.html', title: '廠商待匯款' },
        };
        // [v513.0 新增] 補上員工資料編輯頁面的路由
        routes['#/employee-editor'] = { name: 'iframe', src: 'modules/attendance/employee_editor.html', title: '員工資料編輯' }; // [v515.0 修正] 改為絕對路徑

        const handleRouteChange = () => {
            const hash = window.location.hash || '#';
            // [v425.0 架構優化] 處理帶有查詢參數的 hash 路由
            const [path, queryString] = hash.split('?');
            const route = routes[path] || routes['#'];
            const hashParams = queryString ? `&${queryString}` : '';
            const routeParams = route.params || '';

            currentView.value = {
                ...route,
                params: hashParams + routeParams
            };
            if (path === '#/attendance-report' && Number(currentUser.value?.permission || 0) > 0
                && Number(currentUser.value?.permission || 0) < 4) {
                window.location.replace('#/my-personal');
                return;
            }
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

        /** 今日打卡燈號（輕量 API，供快取＋背景更新） */
        const fetchTodayPresence = async () => {
            if (!userProfile.value) return { success: false };
            const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
            url.searchParams.append('page', 'attendance_api');
            url.searchParams.append('action', 'get_hub_today_presence');
            url.searchParams.append('userId', userProfile.value.userId);
            const response = await fetch(url);
            return response.json();
        };

        const refreshTodayPresenceInBackground = () => {
            presenceLoading.value = true;
            return fetchTodayPresence().then((result) => {
                if (result && result.success && result.todayPresence) {
                    if (JSON.stringify(todayPresence.value) !== JSON.stringify(result.todayPresence)) {
                        todayPresence.value = result.todayPresence;
                    }
                    saveHubPresenceCache(result.todayPresence);
                }
            }).catch((e) => {
                console.warn('[Hub] 背景更新燈號失敗（維持快取）:', e);
            }).finally(() => {
                presenceLoading.value = false;
            });
        };

        let presencePollTimer = null;

        const stopPresencePolling = () => {
            if (presencePollTimer) {
                clearInterval(presencePollTimer);
                presencePollTimer = null;
            }
        };

        const startPresencePolling = () => {
            stopPresencePolling();
            presencePollTimer = setInterval(() => {
                refreshTodayPresenceInBackground();
            }, HUB_PRESENCE_POLL_MS);
        };

        const syncPresenceRefreshForView = (viewName) => {
            if (viewName === 'dashboard' && hasAdminRights.value) {
                refreshTodayPresenceInBackground();
                startPresencePolling();
            } else {
                stopPresencePolling();
                if (hasAdminRights.value) {
                    refreshTodayPresenceInBackground();
                }
            }
        };

        const hubRecentReportsStartStr = () => {
            const d = new Date();
            d.setDate(d.getDate() - 2);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const fetchTodayReports = async () => {
            if (!userProfile.value) return { success: false };
            const startStr = hubRecentReportsStartStr();
            const endStr = hubPresenceTodayStr();
            const url = new URL(CONFIG.GAS_WEB_APP_URL);
            url.searchParams.append('page', 'get_daily_reports');
            url.searchParams.append('startDate', startStr);
            url.searchParams.append('endDate', endStr);
            url.searchParams.append('userName', userProfile.value.displayName);
            const response = await fetch(url);
            return response.json();
        };

        const refreshTodayReportsInBackground = () => {
            todayReportsLoading.value = true;
            return fetchTodayReports().then((result) => {
                if (result && result.success && Array.isArray(result.data)) {
                    if (JSON.stringify(todayReports.value) !== JSON.stringify(result.data)) {
                        todayReports.value = result.data;
                    }
                    saveDailyCache(hubSidebarDailyCacheKey('spa_hub_today_reports'), result.data);
                }
            }).catch((e) => {
                console.warn('[Hub] 背景更新今日回報失敗（維持快取）:', e);
            }).finally(() => {
                todayReportsLoading.value = false;
            });
        };

        const accountingPost = async (body) => {
            const res = await fetch(CONFIG.ACCOUNTING_GAS_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(body)
            });
            return res.json();
        };

        const fetchPaymentTodos = async () => {
            const perm = Number(currentUser.value?.permission || 0);
            if (perm < 4) return { pendingReview: [], pendingPayment: [] };
            let idToken = '';
            try {
                if (typeof liff !== 'undefined' && liff.getIDToken) {
                    idToken = liff.getIDToken() || '';
                }
            } catch (e) { /* 本地測試略過 */ }
            if (!idToken) return null;
            const auth = { liff_id_token: idToken };
            const todos = { pendingReview: [], pendingPayment: [] };
            if (perm >= 5) {
                const rv = await accountingPost({ action: 'vendor_payment_list', auth, status: 'pending_review' });
                if (rv && rv.success) todos.pendingReview = rv.items || [];
            }
            if (perm >= 4) {
                const pay = await accountingPost({ action: 'vendor_payment_list', auth, status: 'pending_payment' });
                if (pay && pay.success) todos.pendingPayment = pay.items || [];
            }
            return todos;
        };

        const refreshPaymentTodosInBackground = () => {
            if (Number(currentUser.value?.permission || 0) < 4) return Promise.resolve();
            paymentTodosLoading.value = true;
            return fetchPaymentTodos().then((todos) => {
                if (todos && typeof todos === 'object') {
                    if (JSON.stringify(paymentTodos.value) !== JSON.stringify(todos)) {
                        paymentTodos.value = todos;
                    }
                    saveDailyCache(hubSidebarDailyCacheKey('spa_hub_payment_todos'), todos);
                }
            }).catch((e) => {
                console.warn('[Hub] 背景更新款項待辦失敗（維持快取）:', e);
            }).finally(() => {
                paymentTodosLoading.value = false;
            });
        };

        const onTodayReportsUpdated = (list) => {
            todayReports.value = list;
            saveDailyCache(hubSidebarDailyCacheKey('spa_hub_today_reports'), list);
        };

        /** 合併兩次 get_latest_schedule 回傳（供主控台「今天／明天」橫跨兩個曆月時） */
        const mergeSchedulePayloads = (a, b) => {
            const holidays = [...new Set([...(a.holidays || []), ...(b.holidays || [])])];
            const schedule = { ...(a.schedule || {}) };
            const bSch = b.schedule || {};
            for (const uid of Object.keys(bSch)) {
                if (!schedule[uid]) {
                    schedule[uid] = { ...bSch[uid] };
                } else {
                    schedule[uid] = { ...schedule[uid], ...bSch[uid] };
                }
            }
            return { schedule, holidays };
        };

        // 抓當月排班資料（供主控台人員出席使用）；若「明天／後天」跨月，多抓並合併。
        const fetchLatestScheduleForThisMonth = async () => {
            if (!userProfile.value) return { success: false };
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const dayAfter = new Date(now);
            dayAfter.setDate(dayAfter.getDate() + 2);
            const ty = dayAfter.getFullYear();
            const tm = dayAfter.getMonth() + 1;

            const fetchOne = async (year, month) => {
                const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
                url.searchParams.append('page', 'attendance_api');
                url.searchParams.append('action', 'get_latest_schedule');
                url.searchParams.append('year', String(year));
                url.searchParams.append('month', String(month));
                url.searchParams.append('userId', userProfile.value.userId);
                url.searchParams.append('userName', userProfile.value.displayName);
                const response = await fetch(url);
                return response.json();
            };

            try {
                const first = await fetchOne(y, m);
                if (!first || !first.schedule) {
                    return first || { success: false };
                }
                let merged = {
                    success: first.success,
                    schedule: first.schedule || {},
                    holidays: first.holidays || []
                };
                if (ty !== y || tm !== m) {
                    const second = await fetchOne(ty, tm);
                    if (second && second.schedule) {
                        merged = {
                            success: merged.success && second.success !== false,
                            ...mergeSchedulePayloads(
                                { schedule: merged.schedule, holidays: merged.holidays },
                                { schedule: second.schedule, holidays: second.holidays || [] }
                            )
                        };
                    }
                }
                return merged;
            } catch (e) {
                console.warn('[Hub] 取得班表失敗（出席區塊將退回基本顯示）:', e);
                return { success: false };
            }
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
                const apiPayload = { ...payload, action: 'process_notification_action' };
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
                        saveCache(EMPLOYEES_CACHE_KEY, attendanceResult.employees, 3);
                        window.spaAllEmployees = attendanceResult.employees;
                    }
                    if (attendanceResult.operator) {
                        operatorProfile.value = attendanceResult.operator;
                    }
                    pendingApprovals.value = attendanceResult.pendingRequests?.length || 0;
                    // 將待審核假單原始資料留給「今日出勤」卡片使用（含 startTime/endTime）
                    pendingRequestsRaw.value = attendanceResult.pendingRequests || [];
                }

                // 今日燈號：SWR（先顯示快取，背景抓最新；主控台另每 30 分更新）
                syncPresenceRefreshForView(currentView.value.name);

                // 主控台側欄：今日回報、款項待辦（SWR + 每日快取）
                refreshTodayReportsInBackground();
                refreshPaymentTodosInBackground();

                // 背景抓當月班表（SWR 策略：先顯示快取，背景更新後無縫替換，TTL 7 天）。
                // 有無快取都會打 API；失敗時卡片維持快取內容。
                scheduleLoading.value = true;
                fetchLatestScheduleForThisMonth().then(scheduleResult => {
                    if (scheduleResult && scheduleResult.schedule) {
                        const latest = {
                            schedule: scheduleResult.schedule || {},
                            holidays: scheduleResult.holidays || []
                        };
                        // 有變動才更新，避免觸發不必要的 re-render
                        if (JSON.stringify(monthSchedule.value) !== JSON.stringify(latest)) {
                            monthSchedule.value = latest;
                        }
                        saveCache(scheduleCacheKey(), latest, 7); // 快取 7 天
                    }
                }).finally(() => {
                    scheduleLoading.value = false;
                });

                if (projectsResult.success && projectsResult.data) {
                    const newProjects = projectsResult.data.projects || [];
                    if (JSON.stringify(allProjects.value) !== JSON.stringify(newProjects)) {
                        allProjects.value = newProjects;
                        saveCache(PROJECTS_CACHE_KEY, newProjects, 3);
                    }
                    window.spaAllProjects = newProjects;
                    notifications.value = projectsResult.data.notifications || [];
                }
            } catch (error) {
                console.error('Initialization Error:', error);
                // [v605.0 專家級防禦] 解決 invalid authorization code 導致的初始化死循環
                // 當 code 已被使用或過期時，liff.init 會噴出此錯誤。
                // 解決方案：偵測 URL 是否包含 code 且發生錯誤，若是則清空 URL 重新嘗試。
                if (error.message && error.message.includes('invalid authorization code')) {
                    const url = new URL(window.location.href);
                    if (url.searchParams.has('code')) {
                        console.warn('⚠️ 偵測到無效的授權代碼，正在清理 URL 並重試...');
                        url.searchParams.delete('code');
                        url.searchParams.delete('state'); // 同步清理 state
                        window.location.replace(url.toString());
                        return;
                    }
                }
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
            if (type === 'spa_hub_invalidate_projects') {
                try { localStorage.removeItem(PROJECTS_CACHE_KEY); } catch (e) { /* ignore */ }
                fetchHubProjectsData().then((projectsResult) => {
                    if (projectsResult && projectsResult.success && projectsResult.data) {
                        const newProjects = projectsResult.data.projects || [];
                        allProjects.value = newProjects;
                        saveCache(PROJECTS_CACHE_KEY, newProjects, 3);
                        window.spaAllProjects = newProjects;
                        if (projectsResult.data.notifications) {
                            notifications.value = projectsResult.data.notifications;
                        }
                    }
                }).catch((err) => {
                    console.warn('[Hub] 案場快取重抓失敗:', err);
                });
                return;
            }
            if (type === 'openLightbox' && payload) {
                console.log('[Lightbox] Received message from iframe:', payload);
                openLightbox(payload.images, payload.index);
            }
        };
        // 將監聽器放在 setup 函式的頂層，確保它只被註冊一次。
        window.addEventListener('message', handleIframeMessage);

        watch([hasAdminRights, currentView], ([isAdmin, view]) => {
            syncPresenceRefreshForView(view?.name || 'dashboard');
        });

        onUnmounted(() => {
            stopPresencePolling();
        });

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
            pendingRequestsRaw,
            todayPresence,
            presenceLoading,
            todayReports,
            todayReportsLoading,
            onTodayReportsUpdated,
            paymentTodos,
            paymentTodosLoading,
            monthSchedule,
            scheduleLoading,
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
            landingPagePublicUrl,
            landingPageUrlCopied,
            copyLandingPageUrl,
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
            <header class="flex-shrink-0 border-b border-gray-200 py-0.5">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center container mx-auto px-4 sm:px-6 lg:px-8 gap-1">
                     <!-- [v421.0 UX優化] 移除標題與歡迎詞，讓版面更簡潔 -->
                     <div class="flex items-center">
                         <!-- [v423.0 UX優化] 移除 v-if，讓導覽列在 iframe 頁面也顯示 -->
                         <!-- [v612.0 UX優化] 縮小上下 padding，字級維持 text-base，讓主內容有更多版面 -->
                         <nav class="-mb-px flex gap-6" aria-label="Tabs">
                             <a href="#/dashboard" :class="['py-1.5 px-1 text-base font-bold', currentView.name === 'dashboard' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300']">主控台</a>
                             <a href="#/project-board" :class="['py-1.5 px-1 text-base font-bold', currentView.name === 'project-board' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:border-gray-300']">專案看板</a>
                         </nav>
                     </div>
                </div>
            </header>

            <!-- [v419.0 UX優化] 主要內容區的寬度限制與 header 分離；桌面版管理員右側顯示今日燈號 -->
            <div class="flex flex-grow overflow-hidden min-h-0">
                <HubLeftSidebar v-if="hasAdminRights && currentView.name === 'dashboard'"
                    :allProjects="allProjects"
                    :currentUser="currentUser"
                    :todayReports="todayReports"
                    :todayReportsLoading="todayReportsLoading"
                    :todayPresence="todayPresence"
                    :paymentTodos="paymentTodos"
                    :paymentTodosLoading="paymentTodosLoading"
                    @reports-updated="onTodayReportsUpdated" />
                <main :class="['flex-grow overflow-y-auto min-w-0', { 'container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8': currentView.name !== 'iframe' }]">
                    <div v-if="currentView.name === 'dashboard'" class="py-6">
                        <Dashboard :userProfile="userProfile" :notifications="notifications" :pendingApprovals="pendingApprovals" :allEmployees="allEmployees" :monthSchedule="monthSchedule" :scheduleLoading="scheduleLoading" :presenceLoading="presenceLoading" :pendingRequestsRaw="pendingRequestsRaw" :todayPresence="todayPresence" :hasAdminRights="hasAdminRights" :currentUser="currentUser" @notification-action="handleNotificationAction" @clear-notifications="clearAllNotifications" />
                        <div v-if="hasAdminRights" id="task-sender-container" class="mt-4"></div>
                        <div class="mt-4 bg-emerald-50/90 px-4 py-3 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                            <p class="text-sm text-gray-800 m-0 max-w-full">
                                <span class="font-semibold text-emerald-900">公開落地頁</span>
                                <span class="text-gray-600">（官網介紹／案例，貼給客戶）</span>
                            </p>
                            <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                                <a :href="landingPagePublicUrl" target="_blank" rel="noopener noreferrer"
                                    class="inline-flex items-center text-sm font-semibold bg-white text-emerald-800 border border-emerald-300 py-1.5 px-3 rounded-md hover:bg-emerald-50">開啟網站</a>
                                <button type="button" @click="copyLandingPageUrl"
                                    class="inline-flex items-center text-sm font-semibold bg-emerald-600 text-white py-1.5 px-3 rounded-md hover:bg-emerald-700">
                                    {{ landingPageUrlCopied ? '已複製' : '複製網址' }}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="currentView.name === 'project-board'" class="py-6">
                         <ProjectBoard :projects="allProjects" :userProfile="userProfile" :currentUser="currentUser" />
                    </div>
                    <div v-else-if="currentView.name === 'iframe' && userProfile" class="h-full min-h-[70vh]">
                        <IframeView :src="currentView.src + 
                            (currentView.src.includes('?') ? '&' : '?') + 
                            'uid=' + encodeURIComponent(userProfile.userId) + 
                            '&name=' + encodeURIComponent(userProfile.displayName) +
                            '&permission=' + encodeURIComponent(currentUser?.permission || 1) +
                            '&shiftStart=' + encodeURIComponent(currentUser?.shiftStart || '08:30') +
                            '&shiftEnd=' + encodeURIComponent(currentUser?.shiftEnd || '17:30') +
                            (currentView.params || '')" />
                    </div>
                </main>
                <StaffTodaySidebar v-if="hasAdminRights && currentView.name === 'dashboard'"
                    :allEmployees="allEmployees"
                    :monthSchedule="monthSchedule"
                    :todayPresence="todayPresence"
                    :presenceLoading="presenceLoading"
                    :scheduleLoading="scheduleLoading"
                    :pendingRequestsRaw="pendingRequestsRaw" />
            </div>
        </div>
    `
};

createApp(App).mount('#app');
