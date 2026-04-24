const { ref, computed, watch } = Vue;

export default {
    name: 'Dashboard',
    props: [
        'userProfile',
        'notifications',
        'pendingApprovals',
        'allEmployees',
        'monthSchedule',       // { schedule: {uid: {日期: 狀態 或 '日期:類別': '狀態[時段]'}}, holidays: [...] }
        'scheduleLoading',     // 班表是否正在向後端更新中（快取優先 + 背景更新）
        'pendingRequestsRaw',  // [{userName, recordType, leaveType, startTime, endTime, status, ...}]
        'hasAdminRights',
        'currentUser'
    ],
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
        const layoutPlannerUrl = computed(() => `#/layout-planner`);
        const floorplanStraightenerUrl = computed(() => `#/floorplan-straightener`);
        const budgetWebUrl = computed(() => `#/budget-web`);
        const budgetAuditUrl = computed(() => `#/budget-audit`);

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

        // ======================================================================
        // [新增] 智慧通知中心 — 摺疊狀態（記憶到 localStorage）
        // ======================================================================
        const NOTIF_EXPAND_KEY = 'hub_notifications_expanded';
        const notificationsExpanded = ref(localStorage.getItem(NOTIF_EXPAND_KEY) === '1');
        const toggleNotifications = () => {
            notificationsExpanded.value = !notificationsExpanded.value;
            localStorage.setItem(NOTIF_EXPAND_KEY, notificationsExpanded.value ? '1' : '0');
        };

        // 待處理通知數（需要回覆或標示完成者）
        const notificationTodoCount = computed(() => {
            if (!Array.isArray(props.notifications)) return 0;
            return props.notifications.filter(n => n.ActionType === 'ReplyText' || n.ActionType === 'ConfirmCompletion').length;
        });
        // 是否有超過時限的待處理通知（用來讓徽章脈動）
        const hasOverdueNotification = computed(() => {
            if (!Array.isArray(props.notifications)) return false;
            const now = new Date();
            return props.notifications.some(n => n.ActionDeadline && new Date(n.ActionDeadline) < now);
        });

        // ======================================================================
        // [新增] 今日出勤 — 日期與資料推導
        // ======================================================================
        const pad2 = (n) => String(n).padStart(2, '0');
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
        const weekdayLabel = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][today.getDay()];
        const todayLabel = `${today.getMonth() + 1}/${today.getDate()}（${weekdayLabel}）`;

        // 從 schedule[uid] 中找出屬於今日的 entries，並回傳 [{raw, label, timeRange}]
        // key 格式參考 SPEC/09_SHIFT_SCHEDULE_DATA_SPEC.md：
        //   - "YYYY-MM-DD": "休假"
        //   - "YYYY-MM-DD:特休": "特休[08:00-12:00]"
        //   - "YYYY-MM-DD": "加班"
        const parseScheduleEntry = (rawValue) => {
            // rawValue 可能是 "休假" / "加班" / "特休[08:00-12:00]" / "特休"
            if (!rawValue) return { label: '', timeRange: '' };
            const str = String(rawValue).trim();
            const m = str.match(/^(.+?)\[(.+?)\]$/);
            if (m) return { label: m[1].trim(), timeRange: m[2].trim() };
            return { label: str, timeRange: '' };
        };

        const getTodayEntriesForUser = (uid) => {
            const sch = props.monthSchedule?.schedule?.[uid];
            if (!sch) return [];
            const entries = [];
            Object.keys(sch).forEach(k => {
                if (k === '_userName') return;
                // k 可能為 "2026-04-24" 或 "2026-04-24:特休"
                const [datePart] = k.split(':');
                if (datePart === todayStr) {
                    entries.push(parseScheduleEntry(sch[k]));
                }
            });
            return entries;
        };

        // 由 entries 推導該員工今日的主狀態（給 chip 上色）
        // 回傳 { kind: 'work'|'off'|'leave'|'overtime', label, colorClass }
        const deriveStatus = (entries) => {
            if (!entries || entries.length === 0) {
                return { kind: 'work', label: '上班', colorClass: 'bg-green-100 text-green-800 border-green-200' };
            }
            // 加班優先，但若同時有休/請假，仍以請假類為主
            const leaveEntry = entries.find(e => e.label && e.label !== '加班' && e.label !== '休假' && e.label !== '休');
            const offEntry = entries.find(e => e.label === '休假' || e.label === '休');
            const otEntry = entries.find(e => e.label === '加班');

            if (leaveEntry) {
                const text = leaveEntry.timeRange ? `${leaveEntry.label} ${leaveEntry.timeRange}` : leaveEntry.label;
                return { kind: 'leave', label: text, colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
            }
            if (offEntry) {
                return { kind: 'off', label: '休假', colorClass: 'bg-red-100 text-red-700 border-red-200' };
            }
            if (otEntry) {
                return { kind: 'overtime', label: '加班', colorClass: 'bg-blue-100 text-blue-800 border-blue-200' };
            }
            return { kind: 'work', label: '上班', colorClass: 'bg-green-100 text-green-800 border-green-200' };
        };

        // 判斷待審核假勤是否影響今日（跨日假單：startTime ≤ 今日 ≤ endTime）
        const isPendingRequestForToday = (req) => {
            if (!req) return false;
            const toDateOnly = (iso) => {
                if (!iso) return null;
                const d = new Date(iso);
                if (isNaN(d.getTime())) return null;
                return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            };
            const s = toDateOnly(req.startTime);
            const e = toDateOnly(req.endTime);
            if (!s && !e) return false;
            const sOk = !s || s <= todayStr;
            const eOk = !e || e >= todayStr;
            return sOk && eOk;
        };

        // 建立「姓名 → 是否有今日待審核申請」的索引
        const pendingByUserName = computed(() => {
            const map = {};
            (props.pendingRequestsRaw || []).forEach(req => {
                if (isPendingRequestForToday(req) && req.userName) {
                    map[req.userName] = req.recordType || '待審核';
                }
            });
            return map;
        });

        // 判斷是否為「真員工」且屬於排班對象：permission 2~4
        // 依 SPEC/09_SHIFT_SCHEDULE_DATA_SPEC.md：2-4 為參與排班對象，5 為系統管理者/隱藏。
        const isSchedulableEmployee = (e) => {
            if (!e || e.status === '離職') return false;
            const p = Number(e.permission || 0);
            return p >= 2 && p <= 4;
        };

        // 排班制員工列表（依組別分組）
        const scheduledByGroup = computed(() => {
            const list = (props.allEmployees || []).filter(e => e.shiftType === '排班制' && isSchedulableEmployee(e));
            const groups = {};
            list.forEach(emp => {
                const g = emp.group || '未分類';
                if (!groups[g]) groups[g] = [];
                const entries = getTodayEntriesForUser(emp.userId);
                const status = deriveStatus(entries);
                groups[g].push({
                    userId: emp.userId,
                    userName: emp.userName,
                    status,
                    pendingType: pendingByUserName.value[emp.userName] || ''
                });
            });
            // 組內排序：異常（非上班）優先，姓名次之
            const orderKind = { leave: 0, off: 1, overtime: 2, work: 3 };
            Object.keys(groups).forEach(g => {
                groups[g].sort((a, b) => {
                    const oa = orderKind[a.status.kind] ?? 9;
                    const ob = orderKind[b.status.kind] ?? 9;
                    if (oa !== ob) return oa - ob;
                    return String(a.userName).localeCompare(String(b.userName), 'zh-Hant');
                });
            });
            // 依組別名排序輸出
            return Object.keys(groups).sort().map(g => ({ group: g, members: groups[g] }));
        });

        // 標準制「今日異動」：只列出今日 entries 中含「請假類」或「加班」的人
        // （純「休假」且落在 holidays 內視為例行休，不列出）
        const standardAnomalies = computed(() => {
            const list = (props.allEmployees || []).filter(e => e.shiftType === '標準制' && isSchedulableEmployee(e));
            const holidays = new Set(props.monthSchedule?.holidays || []);
            const rows = [];
            list.forEach(emp => {
                const entries = getTodayEntriesForUser(emp.userId);
                if (entries.length === 0) return; // 無紀錄 → 常態在班，不列
                entries.forEach(en => {
                    const label = en.label;
                    if (!label) return;
                    if (label === '休假' || label === '休') {
                        // 落在例行休（週日或國定）則忽略；否則視為額外休（補休等）
                        if (holidays.has(todayStr)) return;
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label: '休假',
                            timeRange: '',
                            colorClass: 'bg-red-100 text-red-700 border-red-200',
                            pendingType: pendingByUserName.value[emp.userName] || ''
                        });
                    } else if (label === '加班') {
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label: '加班',
                            timeRange: en.timeRange || '',
                            colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
                            pendingType: pendingByUserName.value[emp.userName] || ''
                        });
                    } else {
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label,
                            timeRange: en.timeRange || '',
                            colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                            pendingType: pendingByUserName.value[emp.userName] || ''
                        });
                    }
                });
            });
            // 依組別、姓名排序
            rows.sort((a, b) => {
                const g = String(a.group).localeCompare(String(b.group), 'zh-Hant');
                if (g !== 0) return g;
                return String(a.userName).localeCompare(String(b.userName), 'zh-Hant');
            });
            return rows;
        });

        // 是否完全沒有可顯示的排班資料（例如載入中或 API 失敗）
        const hasAnyScheduleData = computed(() => {
            const s = props.monthSchedule?.schedule;
            return !!s && Object.keys(s).length > 0;
        });

        return {
            projectIdInput,
            openProjectConsole,
            addSiteUrl,
            approvalDashboardUrl,
            leaveRequestUrl,
            shiftScheduleUrl,
            attendanceReportUrl,
            employeeEditorUrl,
            reportUrl,
            layoutPlannerUrl,
            floorplanStraightenerUrl,
            budgetWebUrl,
            budgetAuditUrl,
            formatTimeAgo,
            handleReply,
            emit,
            // 通知摺疊
            notificationsExpanded,
            toggleNotifications,
            notificationTodoCount,
            hasOverdueNotification,
            // 今日出勤
            todayLabel,
            scheduledByGroup,
            standardAnomalies,
            hasAnyScheduleData,
        };
    },
    template: `
        <div>
            <!-- 開啟專案工作區（精簡為一列，減少佔版） -->
            <div class="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200 mb-4">
                <form @submit.prevent="openProjectConsole" class="flex items-center gap-2">
                    <label class="text-sm font-semibold text-blue-700 flex-shrink-0">開啟專案工作區</label>
                    <input v-model="projectIdInput" type="text" inputmode="numeric" pattern="[0-9]*"
                        class="flex-grow min-w-0 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                        placeholder="輸入案號（例：715）">
                    <button type="submit" class="flex-shrink-0 bg-blue-600 text-white text-sm font-bold py-1.5 px-4 rounded-md hover:bg-blue-700">開啟</button>
                </form>
            </div>

            <!-- 今日出勤 -->
            <div class="bg-white p-3 sm:p-4 rounded-lg shadow-md border border-gray-200 mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h2 class="text-sm font-bold text-gray-700">今日出勤 · {{ todayLabel }}</h2>
                    <span v-if="!hasAnyScheduleData" class="text-[10px] text-gray-400">載入班表中…</span>
                    <span v-else-if="scheduleLoading" class="text-[10px] text-blue-500 animate-pulse" title="正在取得最新排班">更新中…</span>
                </div>

                <!-- 排班制：依組別分組 -->
                <div v-if="scheduledByGroup.length > 0" class="space-y-2">
                    <div v-for="g in scheduledByGroup" :key="g.group">
                        <div class="text-[10px] text-gray-500 font-semibold mb-1">{{ g.group }}</div>
                        <div class="flex flex-wrap gap-1.5">
                            <span v-for="m in g.members" :key="m.userId"
                                :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs', m.status.colorClass]">
                                <span class="font-medium">{{ m.userName }}</span>
                                <span class="text-[10px] opacity-80">{{ m.status.label }}</span>
                                <span v-if="m.pendingType" class="text-[9px] bg-white/70 text-yellow-700 border border-yellow-300 rounded px-1" title="此人今日有待審核申請">待審</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div v-else class="text-xs text-gray-500 py-2">目前沒有排班制員工資料。</div>

                <!-- 標準制：只列今日異動（請假/加班等） -->
                <div v-if="standardAnomalies.length > 0" class="mt-3 pt-2 border-t border-gray-100">
                    <div class="text-[10px] text-gray-500 font-semibold mb-1">標準制員工今日異動</div>
                    <ul class="space-y-0.5">
                        <li v-for="(row, idx) in standardAnomalies" :key="idx" class="flex items-center gap-1.5 text-xs">
                            <span class="text-gray-700 font-medium">{{ row.userName }}</span>
                            <span class="text-[10px] text-gray-400">（{{ row.group }}）</span>
                            <span :class="['inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px]', row.colorClass]">
                                {{ row.label }}<template v-if="row.timeRange"> {{ row.timeRange }}</template>
                            </span>
                            <span v-if="row.pendingType" class="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-300 rounded px-1">待審</span>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- 智慧通知中心（預設摺疊；有事才亮燈） -->
            <div class="bg-white rounded-lg shadow-md border border-gray-200 mb-6">
                <div class="flex justify-between items-center px-5 py-3 cursor-pointer select-none" @click="toggleNotifications">
                    <div class="flex items-center gap-2">
                        <h2 class="text-base font-bold text-gray-700">智慧通知中心</h2>
                        <span v-if="notifications && notifications.length > 0"
                            class="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-gray-200 text-gray-700">
                            {{ notifications.length }}
                        </span>
                        <span v-if="notificationTodoCount > 0"
                            :class="['inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full bg-red-500 text-white', hasOverdueNotification ? 'animate-pulse' : '']"
                            title="待處理通知">
                            待辦 {{ notificationTodoCount }}
                        </span>
                    </div>
                    <div class="flex items-center gap-3">
                        <button v-if="notificationsExpanded && notifications && notifications.length > 0"
                            @click.stop="emit('clear-notifications')"
                            class="text-xs text-blue-600 hover:underline">清除資訊型通知</button>
                        <span class="text-gray-400 text-sm">{{ notificationsExpanded ? '▲ 收合' : '▼ 展開' }}</span>
                    </div>
                </div>
                <div v-show="notificationsExpanded" class="px-5 pb-4">
                    <div class="space-y-3 max-h-96 overflow-y-auto pr-2">
                        <p v-if="!notifications || notifications.length === 0" class="text-center text-gray-500 py-6 text-sm">目前沒有任何通知。</p>
                        <div v-for="item in notifications" :key="item.NotificationID"
                            :class="['relative p-4 rounded-md flex flex-col gap-2 border-l-4', { 'card-overdue': item.ActionDeadline && new Date() > new Date(item.ActionDeadline) }]">
                            <div class="flex justify-between items-start">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-semibold text-gray-800">{{ item.Title }}</h4>
                                        <span class="text-xs text-gray-400">{{ formatTimeAgo(item.Timestamp) }}</span>
                                    </div>
                                    <p class="text-sm text-gray-700 mt-1">{{ item.Content }}</p>
                                </div>
                                <button @click="emit('notification-action', { action: 'delete', notificationId: item.NotificationID })"
                                    title="清除此通知"
                                    class="text-gray-400 hover:text-red-500 p-1 rounded-full flex-shrink-0 -mt-1 -mr-1">&times;</button>
                            </div>
                            <div v-if="item.ActionType === 'ReplyText'" class="mt-2 flex gap-2">
                                <button @click="handleReply(item.NotificationID)"
                                    class="bg-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-md hover:bg-blue-600">回覆</button>
                            </div>
                            <div v-else-if="item.ActionType === 'ConfirmCompletion'" class="mt-2 flex justify-between items-center">
                                <span class="text-xs text-gray-500">{{ item.ActionDeadline ? '時限: ' + new Date(item.ActionDeadline).toLocaleString('sv').slice(0, 16) : '' }}</span>
                                <button @click="emit('notification-action', { action: 'complete', notificationId: item.NotificationID })"
                                    class="bg-green-500 text-white text-sm font-semibold px-3 py-1 rounded-md hover:bg-green-600">標示為完成</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 功能卡片列表（依使用頻率排序：施工日常 → 案場 → 設計 → 假勤 → 管理 → 查詢） -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <!-- 1. 員工報到/打卡（外部 LIFF，每天都要用） -->
                <a href="https://liff.line.me/2007974938-jVxn6y37?source=hub" target="_blank"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl">🕒</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">員工報到/打卡</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">開啟外部頁面進行報到註冊。</p>
                    </div>
                </a>

                <!-- 2. 施工回報 -->
                <a :href="reportUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl">📝</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">施工回報</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">在此上傳每日施工進度與照片。</p>
                    </div>
                </a>

                <!-- 3. 案場驗收表 -->
                <a :href="budgetAuditUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">✅</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">案場驗收表</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">進行案場工項確認與進度回報。</p>
                    </div>
                </a>

                <!-- 4. 報價單解析器 -->
                <a :href="budgetWebUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">🧾</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">報價單解析器</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">上傳 Excel 並自動解析工項分區。</p>
                    </div>
                </a>

                <!-- 5. 新增／修改案場資料 -->
                <a :href="addSiteUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">🏗️</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">新增／修改案場資料</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">可建立新案場，或從下拉選單選既有案場後更新基本資訊。</p>
                    </div>
                </a>

                <!-- 6. 互動式設計規劃工具 -->
                <a :href="layoutPlannerUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-cyan-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl">🎨</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">互動式設計規劃工具</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">提供給客戶使用的線上佈局工具。</p>
                    </div>
                </a>

                <!-- 7. 平面圖校正工具 -->
                <a :href="floorplanStraightenerUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-cyan-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl">📐</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">平面圖校正工具</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">校正客戶提供的歪斜平面圖。</p>
                    </div>
                </a>

                <!-- 8. 線上假勤申請 -->
                <a :href="leaveRequestUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-amber-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xl">📅</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">線上假勤申請</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">申請特休、病假、事假或回報加班。</p>
                    </div>
                </a>

                <!-- 9. 員工排班系統 -->
                <a :href="shiftScheduleUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-amber-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xl">🗓️</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">員工排班系統</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">設定排班制員工的休假日期。</p>
                    </div>
                </a>

                <!-- 10. 假勤審核儀表板（管理） -->
                <a v-if="hasAdminRights" :href="approvalDashboardUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xl">🛡️</div>
                    <div class="min-w-0 flex-1">
                        <div class="flex justify-between items-start gap-2">
                            <h2 class="text-base font-bold text-gray-800 leading-tight">假勤審核儀表板</h2>
                            <span v-if="pendingApprovals > 0" class="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse">{{ pendingApprovals }}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">集中審核請假與加班申請。</p>
                    </div>
                </a>

                <!-- 11. 出勤儀表板（管理） -->
                <a v-if="hasAdminRights" :href="attendanceReportUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xl">📊</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">出勤儀表板</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">查詢遲到、早退與缺勤紀錄。</p>
                    </div>
                </a>

                <!-- 12. 員工資料編輯（管理） -->
                <a v-if="hasAdminRights" :href="employeeEditorUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xl">👥</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">員工資料編輯</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">管理基本資料、權限與班表。</p>
                    </div>
                </a>

                <!-- 13. 團隊工作總覽（高權限） -->
                <a v-if="currentUser && currentUser.permission >= 5" href="#/daily-report"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xl">📋</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">團隊工作總覽</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">集中檢視團隊的所有回報。</p>
                    </div>
                </a>

                <!-- 14. 客戶接洽流程 -->
                <a href="#/onboarding-flow"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">🤝</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">客戶接洽流程</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">查看標準化溝通劇本。</p>
                    </div>
                </a>

                <!-- 15. 客戶常見問答 FAQ -->
                <a href="#/faq"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">❓</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">客戶常見問答 (FAQ)</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">快速查詢與回覆常見問題。</p>
                    </div>
                </a>
            </div>
        </div>
    `
};
