const { computed } = Vue;
import {
    resolvePresenceDotClass,
    buildPresenceMapUrl,
    buildPresenceLocationLabel,
    computeLateMinutes
} from '../shared/js/utils.js';

const pad2 = (n) => String(n).padStart(2, '0');
const formatDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatDayLabel = (d) => {
    const wd = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
};

const KNOWN_LEAVE_TYPES_SORTED = ['婚假', '喪假', '病假', '事假', '特休', '補休', '公假', '休假', '加班', '休'];

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
    return s.split(/\s+/)[0] || s;
};

function parseScheduleEntry(rawValue) {
    if (!rawValue) return { label: '', timeRange: '' };
    const str = String(rawValue).trim();
    const m = str.match(/^(.+?)\[(.+?)\]$/);
    if (m) {
        return { label: leaveTypeOnlyFromText(m[1].trim()), timeRange: m[2].trim() };
    }
    return { label: leaveTypeOnlyFromText(str), timeRange: '' };
}

function getEntriesForUserOnDate(schedule, uid, dateStr) {
    const sch = schedule?.[uid];
    if (!sch) return [];
    const entries = [];
    Object.keys(sch).forEach(k => {
        if (k === '_userName') return;
        if (k.split(':')[0] === dateStr) entries.push(parseScheduleEntry(sch[k]));
    });
    return entries;
}

function deriveStatusShiftSchedule(entries) {
    if (!entries || entries.length === 0) {
        return { kind: 'work', label: '上班', colorClass: 'bg-green-100 text-green-800 border-green-200' };
    }
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
}

function isStandardRestDay(dateStr, holidays) {
    const holidaySet = holidays instanceof Set ? holidays : new Set(holidays || []);
    const parts = dateStr.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return holidaySet.has(dateStr) || d.getDay() === 0 || d.getDay() === 6;
}

function deriveStatusStandard(dateStr, entries, holidays) {
    const holidaySet = holidays instanceof Set ? holidays : new Set(holidays || []);
    const restDay = isStandardRestDay(dateStr, holidaySet);
    if (entries && entries.length > 0) {
        const leaveEntry = entries.find(e => e.label && e.label !== '加班' && e.label !== '休假' && e.label !== '休');
        const offEntry = entries.find(e => e.label === '休假' || e.label === '休');
        const otEntry = entries.find(e => e.label === '加班');
        if (leaveEntry) {
            const text = leaveEntry.timeRange ? `${leaveEntry.label} ${leaveEntry.timeRange}` : leaveEntry.label;
            return { kind: 'leave', label: text, colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
        }
        if (offEntry && !restDay) {
            return { kind: 'off', label: '休假', colorClass: 'bg-red-100 text-red-700 border-red-200' };
        }
        if (otEntry) {
            const otText = otEntry.timeRange ? `加班 ${otEntry.timeRange}` : '加班';
            return { kind: 'overtime', label: otText, colorClass: 'bg-blue-100 text-blue-800 border-blue-200' };
        }
    }
    if (restDay) {
        return { kind: 'off', label: '休假', colorClass: 'bg-red-100 text-red-700 border-red-200' };
    }
    return { kind: 'work', label: '上班', colorClass: 'bg-green-100 text-green-800 border-green-200' };
}

function deriveDayStatus(emp, dateStr, schedule, holidays) {
    const entries = getEntriesForUserOnDate(schedule, emp.userId, dateStr);
    const shiftType = String(emp.shiftType || '排班制').trim();
    if (shiftType === '標準制') {
        return deriveStatusStandard(dateStr, entries, holidays);
    }
    return deriveStatusShiftSchedule(entries);
}

function isPendingRequestForDate(req, dateStr) {
    if (!req) return false;
    const toDateOnly = (iso) => {
        if (!iso) return null;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const s = toDateOnly(req.startTime);
    const e = toDateOnly(req.endTime);
    if (!s && !e) return false;
    const sOk = !s || s <= dateStr;
    const eOk = !e || e >= dateStr;
    return sOk && eOk;
}

function buildRowAnomalyLines(row) {
    const lines = [];
    if (row.pendingType) lines.push(`待審：${row.pendingType}`);
    (row.presence?.reasons || []).forEach(r => {
        if (r) lines.push(String(r));
    });
    const shouldWork = row.status.kind === 'work' || row.status.kind === 'overtime';
    if (shouldWork && row.presence?.hasCheckIn && row.presence.checkInTime) {
        const late = computeLateMinutes(
            row.presence.checkInTime,
            row.shiftStart,
            row.flexibleMinutes
        );
        if (late > 30) lines.push(`晚到 ${late} 分`);
        else if (late > 0) lines.push(`遲到 ${late} 分`);
    }
    return [...new Set(lines.filter(Boolean))];
}

export default {
    name: 'StaffTodaySidebar',
    props: [
        'allEmployees',
        'monthSchedule',
        'todayPresence',
        'presenceLoading',
        'scheduleLoading',
        'pendingRequestsRaw'
    ],
    setup(props) {
        const today = new Date();
        const todayStr = formatDateStr(today);
        const dayLabel = formatDayLabel(today);
        const staffStatusBoardUrl = '#/staff-status-board';

        const isActiveEmployee = (e) => {
            if (!e) return false;
            const st = String(e.status || e['身份'] || '員工').trim();
            return st !== '離職' && st !== '廠商';
        };

        const pendingMapToday = computed(() => {
            const map = {};
            (props.pendingRequestsRaw || []).forEach(req => {
                if (isPendingRequestForDate(req, todayStr) && req.userName) {
                    map[req.userName] = req.recordType || '待審核';
                }
            });
            return map;
        });

        const groupedRows = computed(() => {
            const schedule = props.monthSchedule?.schedule || {};
            const holidays = new Set(props.monthSchedule?.holidays || []);
            const employees = (props.allEmployees || []).filter(isActiveEmployee);
            if (!employees.length) return [];

            const groups = {};
            employees.forEach(emp => {
                const g = emp.group || '未分類';
                if (!groups[g]) groups[g] = [];
                const status = deriveDayStatus(emp, todayStr, schedule, holidays);
                const row = {
                    userId: emp.userId,
                    userName: emp.userName,
                    status,
                    presence: props.todayPresence?.[emp.userId] || null,
                    pendingType: pendingMapToday.value[emp.userName] || '',
                    shiftStart: emp.shiftStart || '08:30',
                    flexibleMinutes: Number(emp.flexibleMinutes || 0)
                };
                row.anomalyLines = buildRowAnomalyLines(row);
                groups[g].push(row);
            });

            return Object.keys(groups).sort().map(g => ({
                group: g,
                members: groups[g].sort((a, b) => String(a.userName).localeCompare(String(b.userName), 'zh-Hant'))
            }));
        });

        const presenceDotClass = (row) => resolvePresenceDotClass({
            dayKey: 'today',
            statusKind: row.status.kind,
            presence: row.presence,
            presenceLoading: props.presenceLoading
        });

        const presenceTitle = (p) => {
            if (!p || p.light === 'none') return '';
            let t = p.label || '';
            if (p.reasons && p.reasons.length) t += '：' + p.reasons.join('；');
            if (p.checkInTime) t += `（${p.checkInTime}）`;
            return t;
        };

        const presenceLocationLabel = (p) => buildPresenceLocationLabel(p);
        const presenceMapUrl = (p) => buildPresenceMapUrl(p);

        const openMap = (url) => {
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
        };

        const isUpdating = computed(() => props.scheduleLoading || props.presenceLoading);

        return {
            dayLabel,
            staffStatusBoardUrl,
            groupedRows,
            presenceDotClass,
            presenceTitle,
            presenceLocationLabel,
            presenceMapUrl,
            openMap,
            isUpdating
        };
    },
    template: `
        <aside class="hidden lg:flex flex-col flex-shrink-0 border-l border-gray-200 bg-gray-50/80
            w-80 xl:w-96 2xl:w-[26rem] min-w-[18rem] max-w-[28vw]">
            <div class="flex-shrink-0 px-3 py-2.5 border-b border-gray-200 bg-white">
                <div class="flex items-center justify-between gap-2">
                    <h2 class="text-base font-bold text-gray-700">今日出勤燈號</h2>
                    <a :href="staffStatusBoardUrl"
                        class="text-xs text-blue-600 hover:underline font-medium whitespace-nowrap"
                        title="查看今／明／後天">三日詳情 →</a>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">{{ dayLabel }}
                    <span v-if="isUpdating" class="text-blue-500 animate-pulse"> · 更新中</span>
                </p>
                <div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-gray-500">
                    <span class="inline-flex items-center gap-0.5"><span class="presence-dot presence-red"></span>未打卡</span>
                    <span class="inline-flex items-center gap-0.5"><span class="presence-dot presence-blue"></span>店面</span>
                    <span class="inline-flex items-center gap-0.5"><span class="presence-dot presence-purple"></span>案場</span>
                    <span class="inline-flex items-center gap-0.5"><span class="presence-dot presence-orange"></span>待確認</span>
                </div>
            </div>
            <div class="flex-grow overflow-y-auto px-2 py-2 space-y-3">
                <template v-if="groupedRows.length > 0">
                    <div v-for="g in groupedRows" :key="g.group">
                        <div class="text-xs text-gray-500 font-semibold px-1 mb-1 sticky top-0 bg-gray-50/95 py-0.5">{{ g.group }}</div>
                        <ul class="space-y-1">
                            <li v-for="row in g.members" :key="row.userId"
                                class="px-1 py-0.5 rounded hover:bg-white/80">
                                <div class="flex items-center gap-1.5">
                                    <span v-if="presenceDotClass(row) !== 'presence-none'"
                                        :class="['presence-dot flex-shrink-0', presenceDotClass(row)]"
                                        :title="presenceTitle(row.presence)"></span>
                                    <span v-else class="w-2 flex-shrink-0"></span>
                                    <span class="text-sm font-medium text-gray-800 truncate min-w-0 flex-shrink">{{ row.userName }}</span>
                                    <span :class="['ml-auto flex-shrink-0 inline-flex px-1.5 py-0.5 rounded-full border text-[11px] leading-tight', row.status.colorClass]">
                                        {{ row.status.label }}
                                    </span>
                                </div>
                                <div v-if="row.presence && row.presence.hasCheckIn && presenceLocationLabel(row.presence)"
                                    class="pl-3.5 mt-0.5">
                                    <button v-if="presenceMapUrl(row.presence)" type="button"
                                        @click="openMap(presenceMapUrl(row.presence))"
                                        class="text-[11px] text-blue-600 hover:underline text-left truncate max-w-full block"
                                        :title="'在 Google Maps 查看：' + presenceLocationLabel(row.presence)">
                                        📍 {{ presenceLocationLabel(row.presence) }}
                                    </button>
                                    <span v-else class="text-[11px] text-gray-400 truncate block">
                                        📍 {{ presenceLocationLabel(row.presence) }}
                                    </span>
                                </div>
                                <ul v-if="row.anomalyLines && row.anomalyLines.length" class="pl-3.5 mt-0.5 space-y-0.5">
                                    <li v-for="(line, idx) in row.anomalyLines" :key="row.userId + '-an-' + idx"
                                        class="text-[11px] text-amber-800 leading-snug">
                                        ⚠ {{ line }}
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </template>
                <p v-else class="text-sm text-gray-500 text-center py-8">載入員工資料中…</p>
            </div>
        </aside>
    `,
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
