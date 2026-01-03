const { ref, computed } = Vue;

export default {
    name: 'Dashboard',
    props: ['userProfile', 'notifications', 'pendingApprovals', 'allEmployees', 'hasAdminRights', 'currentUser'],
    emits: ['notification-action', 'clear-notifications'],
    setup(props, { emit }) {
        const projectIdInput = ref('');
        const PROJECT_CONSOLE_LIFF_ID = '2007974938-7yKM9EqL';

        const openProjectConsole = () => {
            const projectId = projectIdInput.value.trim();
            if (!projectId || !/^\d+$/.test(projectId)) {
                alert('請輸入純數字的案號！');
                return;
            }
            if (!props.userProfile?.userId) {
                alert('無法取得您的使用者資訊，請重新載入頁面。');
                return;
            }
            // [v424.0 架構優化] 改為觸發內部路由導航
            window.location.hash = `#/project-console?id=${projectId}`;
        };

        // [v426.0 SPA化] 統一所有內部連結為 hash 路由
        const addSiteUrl = computed(() => `#/new-site`);
        const approvalDashboardUrl = computed(() => `#/approval-dashboard`);
        const leaveRequestUrl = computed(() => `#/leave-request`);
        const shiftScheduleUrl = computed(() => `#/shift-schedule`);
        const attendanceReportUrl = computed(() => `#/attendance-report`);
        const employeeEditorUrl = computed(() => `#/employee-editor`);
        const reportUrl = computed(() => `#/report`);
        // 【您的要求】新增兩個設計工具的 SPA 路由
        const layoutPlannerUrl = computed(() => `#/layout-planner`);
        const floorplanStraightenerUrl = computed(() => `#/floorplan-straightener`);

        const formatTimeAgo = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " 年前";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " 個月前";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " 天前";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " 小時前";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " 分鐘前";
            return "剛剛";
        };

        const handleReply = (notificationId) => {
            const content = prompt('請輸入回覆內容：');
            if (content) {
                emit('notification-action', { action: 'reply', notificationId, content });
            }
        };

        return {
            projectIdInput,
            openProjectConsole,
            addSiteUrl,
            approvalDashboardUrl,
            leaveRequestUrl,
            shiftScheduleUrl,
            attendanceReportUrl,
            employeeEditorUrl,
            reportUrl, // 將施工回報的 URL 也傳給模板
            layoutPlannerUrl,
            floorplanStraightenerUrl,
            formatTimeAgo,
            handleReply,
            emit,
        };
    },
    template: `
        <div>
            <!-- 智慧通知中心 -->
            <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-gray-700">智慧通知中心</h2>
                    <button @click="emit('clear-notifications')" class="text-sm text-blue-600 hover:underline">清除資訊型通知</button>
                </div>
                <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                    <p v-if="!notifications || notifications.length === 0" class="text-center text-gray-500 py-8">目前沒有任何通知。</p>
                    <div v-for="item in notifications" :key="item.NotificationID" :class="['relative p-4 rounded-md flex flex-col gap-2 border-l-4', { 'card-overdue': item.ActionDeadline && new Date() > new Date(item.ActionDeadline) }]">
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-semibold text-gray-800">{{ item.Title }}</h4>
                                    <span class="text-xs text-gray-400">{{ formatTimeAgo(item.Timestamp) }}</span>
                                </div>
                                <p class="text-sm text-gray-700 mt-1">{{ item.Content }}</p>
                            </div>
                            <button @click="emit('notification-action', { action: 'delete', notificationId: item.NotificationID })" title="清除此通知" class="text-gray-400 hover:text-red-500 p-1 rounded-full flex-shrink-0 -mt-1 -mr-1">&times;</button>
                        </div>
                        <div v-if="item.ActionType === 'ReplyText'" class="mt-2 flex gap-2">
                            <button @click="handleReply(item.NotificationID)" class="bg-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-md hover:bg-blue-600">回覆</button>
                        </div>
                        <div v-else-if="item.ActionType === 'ConfirmCompletion'" class="mt-2 flex justify-between items-center">
                            <span class="text-xs text-gray-500">{{ item.ActionDeadline ? '時限: ' + new Date(item.ActionDeadline).toLocaleString('sv').slice(0, 16) : '' }}</span>
                            <button @click="emit('notification-action', { action: 'complete', notificationId: item.NotificationID })" class="bg-green-500 text-white text-sm font-semibold px-3 py-1 rounded-md hover:bg-green-600">標示為完成</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 功能卡片列表 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div class="col-span-1 md:col-span-2 bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <h2 class="text-xl font-bold mb-4 text-blue-700">開啟專案工作區</h2>
                    <form @submit.prevent="openProjectConsole" class="flex flex-col sm:flex-row gap-2 items-center">
                        <input v-model="projectIdInput" type="text" inputmode="numeric" pattern="[0-9]*" class="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="請輸入案號 (例如: 715)">
                        <button type="submit" class="w-full sm:w-auto bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">開啟</button>
                    </form>
                </div>

                <a :href="addSiteUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-blue-700">新增案場資料</h2><p class="text-gray-600">建立一個新的專案，並填寫基本資訊。</p></a>
                <a href="#/onboarding-flow" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-green-700">客戶接洽流程</h2><p class="text-gray-600">查看標準化的互動式客戶溝通劇本。</p></a>
                <a href="#/faq" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-green-700">新客戶常見問答 (FAQ)</h2><p class="text-gray-600">快速查詢與回覆客戶的常見問題。</p></a>
               <!-- [v453.0] 根據使用者要求，將「施工回報總覽」權限提升至 5，並調整顏色 -->
                <!-- 【您的要求】新增設計工具卡片 -->
                <a :href="layoutPlannerUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-cyan-700">互動式室內設計規劃工具</h2><p class="text-gray-600">提供給客戶使用的線上平面佈局工具。</p></a>
                <a :href="floorplanStraightenerUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-cyan-700">平面圖校正工具</h2><p class="text-gray-600">上傳並校正客戶提供的歪斜平面圖。</p></a>

                <a v-if="currentUser && currentUser.permission >= 5" href="#/daily-report" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-red-700">團隊工作總覽 (檢視)</h2><p class="text-gray-600">在主控台內集中檢視團隊的所有回報。</p></a>

                <!-- [v453.0] 根據使用者要求，將「出勤儀表板」顏色改為紅色 -->
                <a v-if="hasAdminRights" :href="attendanceReportUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-red-700">出勤儀表板</h2><p class="text-gray-600">查詢所有員工的出勤、遲到、早退與缺勤紀錄。</p></a>

                <!-- 【您的要求】新增「員工打卡」按鈕 -->
                <a href="https://liff.line.me/2007974938-jVxn6y37?source=hub" target="_blank" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block">
                    <h2 class="text-xl font-bold mb-2 text-purple-700">員工打卡</h2>
                    <p class="text-gray-600">開啟 LIFF 頁面進行每日出勤打卡。</p>
                </a>

                <a v-if="hasAdminRights" :href="approvalDashboardUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold mb-2 text-red-700">假勤審核儀表板</h2>
                        <span v-if="pendingApprovals > 0" class="h-6 w-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">{{ pendingApprovals }}</span>
                    </div>
                    <p class="text-gray-600">集中審核所有員工的請假與加班申請。</p>
                </a>

                <a v-if="hasAdminRights" :href="employeeEditorUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-purple-700">員工資料編輯</h2><p class="text-gray-600">管理員工的基本資料、權限與班表設定。</p></a>

                <!-- 【您的要求】新增「施工回報」按鈕，並使用 SPA 路由 -->
                <a :href="reportUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-purple-700">施工回報</h2><p class="text-gray-600">在主控台內上傳每日施工進度與照片。</p></a>

                <a :href="leaveRequestUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-purple-700">線上假勤申請</h2><p class="text-gray-600">申請特休、病假、事假或回報加班。</p></a>
                <a :href="shiftScheduleUrl" class="card bg-white p-6 rounded-lg shadow-md border border-gray-200 block"><h2 class="text-xl font-bold mb-2 text-purple-700">員工排班系統</h2><p class="text-gray-600">設定排班制員工的休假日期。</p></a>
            </div>
        </div>
    `
};