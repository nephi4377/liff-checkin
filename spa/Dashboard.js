const { ref, computed } = Vue;

export default {
    name: 'Dashboard',
    props: [
        'userProfile',
        'notifications',
        'pendingApprovals',
        'allEmployees',
        'monthSchedule',       // { schedule: {uid: {日期: 狀態 或 '日期:類別': '狀態[時段]'}}, holidays: [...] }
        'scheduleLoading',     // 班表是否正在向後端更新中（快取優先 + 背景更新）
        'presenceLoading',     // 今日燈號是否正在背景更新中
        'pendingRequestsRaw',  // [{userName, recordType, leaveType, startTime, endTime, status, ...}]
        'todayPresence',       // { [userId]: { light, label, reasons, hasCheckIn, checkInTime, ... } }
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
        const staffStatusBoardUrl = computed(() => `#/staff-status-board`);
        const employeeEditorUrl = computed(() => `#/employee-editor`);
        const reportUrl = computed(() => `#/report`);
        const layoutPlannerUrl = computed(() => `#/layout-planner`);
        const floorplanStraightenerUrl = computed(() => `#/floorplan-straightener`);
        const budgetWebUrl = computed(() => `#/budget-web`);
        const budgetAuditUrl = computed(() => `#/budget-audit`);
        const accountingUrl = computed(() => '#/accounting-ingest');
        const accountingHubUrl = computed(() => '#/accounting');

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
        // 人員出席 — 今天／明天與資料推導（假勤僅顯示假別＋時段，不顯示事由）
        // ======================================================================
        const pad2 = (n) => String(n).padStart(2, '0');
        const formatDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
        const formatDayLabel = (d) => {
            const wd = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d.getDay()];
            return `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
        };
        const today = new Date();
        const todayStr = formatDateStr(today);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = formatDateStr(tomorrow);

        const presenceTitle = (p) => {
            if (!p || p.light === 'none') return '';
            let t = p.label || '';
            if (p.reasons && p.reasons.length) t += '：' + p.reasons.join('；');
            if (p.checkInTime) t += `（${p.checkInTime}）`;
            return t;
        };

        const presenceDotClass = (userId, dayKey) => {
            if (dayKey !== 'today') return '';
            const p = props.todayPresence?.[userId];
            if (!p || !p.light || p.light === 'none') return 'presence-none';
            return `presence-${p.light}`;
        };

        /** 與線上假勤申請一致（長詞先比對，避免「休」誤套「休假」） */
        const KNOWN_LEAVE_TYPES_SORTED = ['婚假', '喪假', '病假', '事假', '特休', '補休', '公假', '休假', '加班', '休'];

        /** 去掉括號內附註（事由），含半形 () 與全形 （） */
        const stripParentheticalReason = (text) => {
            let out = String(text || '').trim();
            let prev;
            do {
                prev = out;
                out = out.replace(/\([^)]*\)/g, '').replace(/（[^）]*）/g, '').trim();
            } while (out !== prev);
            return out;
        };

        const leaveTypeOnlyFromText = (text) => {
            const s = stripParentheticalReason(text);
            if (!s) return '';
            for (const t of KNOWN_LEAVE_TYPES_SORTED) {
                if (s === t || s.startsWith(`${t} `) || s.startsWith(`${t}　`)) return t;
            }
            const first = s.split(/\s+/)[0];
            return first || s;
        };

        // 從 schedule[uid] 中找出指定日期的 entries，並回傳 [{ label, timeRange }]
        // key 格式參考 SPEC/09_排班系統資料格式規格書.md：
        //   - "YYYY-MM-DD": "休假"
        //   - "YYYY-MM-DD:特休": "特休[08:00-12:00]" 或含事由 "特休 事由[08:00-12:00]"
        const parseScheduleEntry = (rawValue) => {
            if (!rawValue) return { label: '', timeRange: '' };
            const str = String(rawValue).trim();
            const m = str.match(/^(.+?)\[(.+?)\]$/);
            if (m) {
                return {
                    label: leaveTypeOnlyFromText(m[1].trim()),
                    timeRange: m[2].trim()
                };
            }
            const simple = leaveTypeOnlyFromText(str);
            return { label: simple, timeRange: '' };
        };

        const getEntriesForUserOnDate = (uid, dateStr) => {
            const sch = props.monthSchedule?.schedule?.[uid];
            if (!sch) return [];
            const entries = [];
            Object.keys(sch).forEach(k => {
                if (k === '_userName') return;
                const [datePart] = k.split(':');
                if (datePart === dateStr) {
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
                const otText = otEntry.timeRange ? `加班 ${otEntry.timeRange}` : '加班';
                return { kind: 'overtime', label: otText, colorClass: 'bg-blue-100 text-blue-800 border-blue-200' };
            }
            return { kind: 'work', label: '上班', colorClass: 'bg-green-100 text-green-800 border-green-200' };
        };

        // 待審核假勤是否涵蓋指定日（跨日假單：startTime ≤ dateStr ≤ endTime）
        const isPendingRequestForDate = (req, dateStr) => {
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
            const sOk = !s || s <= dateStr;
            const eOk = !e || e >= dateStr;
            return sOk && eOk;
        };

        const pendingMapsByDate = computed(() => {
            const maps = {};
            [todayStr, tomorrowStr].forEach(ds => {
                const map = {};
                (props.pendingRequestsRaw || []).forEach(req => {
                    if (isPendingRequestForDate(req, ds) && req.userName) {
                        map[req.userName] = req.recordType || '待審核';
                    }
                });
                maps[ds] = map;
            });
            return maps;
        });

        // 判斷是否為「真員工」且屬於排班對象：permission 2~4，排除離職與廠商
        const isSchedulableEmployee = (e) => {
            if (!e) return false;
            const st = String(e.status || e['身份'] || '員工').trim();
            if (st === '離職' || st === '廠商') return false;
            const p = Number(e.permission || 0);
            return p >= 2 && p <= 4;
        };

        const buildScheduledByGroupForDate = (dateStr, pendingMap) => {
            const list = (props.allEmployees || []).filter(e => e.shiftType === '排班制' && isSchedulableEmployee(e));
            const groups = {};
            list.forEach(emp => {
                const g = emp.group || '未分類';
                if (!groups[g]) groups[g] = [];
                const entries = getEntriesForUserOnDate(emp.userId, dateStr);
                const status = deriveStatus(entries);
                groups[g].push({
                    userId: emp.userId,
                    userName: emp.userName,
                    status,
                    pendingType: pendingMap[emp.userName] || ''
                });
            });
            const orderKind = { leave: 0, off: 1, overtime: 2, work: 3 };
            Object.keys(groups).forEach(g => {
                groups[g].sort((a, b) => {
                    const oa = orderKind[a.status.kind] ?? 9;
                    const ob = orderKind[b.status.kind] ?? 9;
                    if (oa !== ob) return oa - ob;
                    return String(a.userName).localeCompare(String(b.userName), 'zh-Hant');
                });
            });
            return Object.keys(groups).sort().map(g => ({ group: g, members: groups[g] }));
        };

        const buildStandardAnomaliesForDate = (dateStr, pendingMap) => {
            const list = (props.allEmployees || []).filter(e => e.shiftType === '標準制' && isSchedulableEmployee(e));
            const holidays = new Set(props.monthSchedule?.holidays || []);
            const rows = [];
            list.forEach(emp => {
                const entries = getEntriesForUserOnDate(emp.userId, dateStr);
                if (entries.length === 0) return;
                entries.forEach(en => {
                    const label = en.label;
                    if (!label) return;
                    if (label === '休假' || label === '休') {
                        if (holidays.has(dateStr)) return;
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label: '休假',
                            timeRange: '',
                            colorClass: 'bg-red-100 text-red-700 border-red-200',
                            pendingType: pendingMap[emp.userName] || ''
                        });
                    } else if (label === '加班') {
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label: '加班',
                            timeRange: en.timeRange || '',
                            colorClass: 'bg-blue-100 text-blue-800 border-blue-200',
                            pendingType: pendingMap[emp.userName] || ''
                        });
                    } else {
                        rows.push({
                            userName: emp.userName,
                            group: emp.group || '未分類',
                            label,
                            timeRange: en.timeRange || '',
                            colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                            pendingType: pendingMap[emp.userName] || ''
                        });
                    }
                });
            });
            rows.sort((a, b) => {
                const gcmp = String(a.group).localeCompare(String(b.group), 'zh-Hant');
                if (gcmp !== 0) return gcmp;
                return String(a.userName).localeCompare(String(b.userName), 'zh-Hant');
            });
            return rows;
        };

        const attendanceDays = computed(() => {
            const maps = pendingMapsByDate.value;
            return [
                { key: 'today', title: '今天', dateStr: todayStr, dayLabel: formatDayLabel(today) },
                { key: 'tomorrow', title: '明天', dateStr: tomorrowStr, dayLabel: formatDayLabel(tomorrow) }
            ].map(d => {
                const pmap = maps[d.dateStr] || {};
                return {
                    ...d,
                    scheduledByGroup: buildScheduledByGroupForDate(d.dateStr, pmap),
                    standardAnomalies: buildStandardAnomaliesForDate(d.dateStr, pmap)
                };
            });
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
            staffStatusBoardUrl,
            presenceTitle,
            presenceDotClass,
            employeeEditorUrl,
            reportUrl,
            layoutPlannerUrl,
            floorplanStraightenerUrl,
            budgetWebUrl,
            budgetAuditUrl,
            accountingUrl,
            accountingHubUrl,
            formatTimeAgo,
            handleReply,
            emit,
            // 通知摺疊
            notificationsExpanded,
            toggleNotifications,
            notificationTodoCount,
            hasOverdueNotification,
            attendanceDays,
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

            <!-- 人員出席：今天／明天；假勤 chip 僅假別與時段；今天顯示打卡燈號 -->
            <div class="bg-white p-3 sm:p-4 rounded-lg shadow-md border border-gray-200 mb-4">
                <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <h2 class="text-sm font-bold text-gray-700">人員出席狀況（今天／明天）</h2>
                    <div class="flex items-center gap-2 flex-wrap">
                        <a v-if="hasAdminRights" :href="staffStatusBoardUrl"
                            class="text-[10px] text-blue-600 hover:underline font-medium">全員燈號看板（今／明／後天）→</a>
                        <span v-if="!hasAnyScheduleData" class="text-[10px] text-gray-400">載入班表中…</span>
                        <span v-else-if="scheduleLoading || presenceLoading" class="text-[10px] text-blue-500 animate-pulse" title="正在取得最新排班或燈號">更新中…</span>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-2">
                    <span class="inline-flex items-center gap-1"><span class="presence-dot presence-red"></span>未打卡</span>
                    <span class="inline-flex items-center gap-1"><span class="presence-dot presence-blue"></span>店面</span>
                    <span class="inline-flex items-center gap-1"><span class="presence-dot presence-purple"></span>案場</span>
                    <span class="inline-flex items-center gap-1"><span class="presence-dot presence-orange"></span>待確認</span>
                    <span class="text-gray-400">（燈號僅今天）</span>
                </div>

                <div v-for="day in attendanceDays" :key="day.key" class="mb-4 last:mb-0 pb-3 last:pb-0 border-b border-gray-100 last:border-0">
                    <div class="text-xs font-bold text-gray-600 mb-2">{{ day.title }} · {{ day.dayLabel }}</div>
                    <div v-if="day.scheduledByGroup.length > 0" class="space-y-2">
                        <div v-for="g in day.scheduledByGroup" :key="day.key + '-' + g.group">
                            <div class="text-[10px] text-gray-500 font-semibold mb-1">{{ g.group }}</div>
                            <div class="flex flex-wrap gap-1.5">
                                <span v-for="m in g.members" :key="day.key + '-' + m.userId"
                                    :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs', m.status.colorClass]">
                                    <span v-if="day.key === 'today' && presenceDotClass(m.userId, day.key) !== 'presence-none'"
                                        :class="['presence-dot flex-shrink-0', presenceDotClass(m.userId, day.key)]"
                                        :title="presenceTitle(todayPresence && todayPresence[m.userId])"></span>
                                    <span class="font-medium">{{ m.userName }}</span>
                                    <span class="text-[10px] opacity-80">{{ m.status.label }}</span>
                                    <span v-if="m.pendingType" class="text-[9px] bg-white/70 text-yellow-700 border border-yellow-300 rounded px-1" title="此日有待審核假勤">待審</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-xs text-gray-500 py-1">目前沒有排班制員工資料。</div>
                    <div v-if="day.standardAnomalies.length > 0" class="mt-2 pt-2 border-t border-dashed border-gray-100">
                        <div class="text-[10px] text-gray-500 font-semibold mb-1">標準制員工 · 異動</div>
                        <ul class="space-y-0.5">
                            <li v-for="(row, idx) in day.standardAnomalies" :key="day.key + '-std-' + idx" class="flex items-center gap-1.5 text-xs flex-wrap">
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

                <!-- 1b. 收支登錄（HUB 內嵌，共用員工／案場快取） -->
                <a v-if="currentUser && currentUser.permission >= 4" :href="accountingUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-emerald-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">💰</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">收支登錄</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">連續記帳；成功後可同步到進出款項群。</p>
                    </div>
                </a>

                <!-- 1c. 會計功能選單 -->
                <a v-if="currentUser && currentUser.permission >= 4" :href="accountingHubUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-teal-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-xl">📒</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">會計功能</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">廠商、收款帳戶、款項進度等會計頁面入口。</p>
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

                <!-- 11b. 全員出勤燈號看板（管理） -->
                <a v-if="hasAdminRights" :href="staffStatusBoardUrl"
                    class="group bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-red-500 p-4 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                    <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xl">🚦</div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-base font-bold text-gray-800 leading-tight">全員出勤燈號看板</h2>
                        <p class="text-xs text-gray-500 mt-1 leading-snug">今／明／後天排班與今日打卡燈號（權限 4+）。</p>
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
    `,
    // 燈號圓點樣式（僅本元件）
    mounted() {
        if (document.getElementById('hub-presence-dot-style')) return;
        const style = document.createElement('style');
        style.id = 'hub-presence-dot-style';
        style.textContent = `
            .presence-dot { width: 8px; height: 8px; border-radius: 9999px; display: inline-block; box-shadow: 0 0 0 1px rgba(0,0,0,.06); }
            .presence-red { background: #ef4444; }
            .presence-blue { background: #3b82f6; }
            .presence-purple { background: #9333ea; }
            .presence-orange { background: #f97316; }
            .presence-none { display: none; }
        `;
        document.head.appendChild(style);
    }
};
