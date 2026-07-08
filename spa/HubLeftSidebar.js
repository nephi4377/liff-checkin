import { AI_SIGNAL_META, parseAiFindingsJson, isAiReviewedByUser, getAiExpandableDetails } from '../modules/projects/js/siteReportAiUi.js';
import { request as apiRequest } from '../modules/projects/js/projectApi.js';

const { computed, ref, toRefs, watch } = Vue;

function getContentPreview(content, maxLen = 72) {
    if (content == null) return '';
    let s = String(content).replace(/^\[更新 .*?\]\n/, '');
    s = s.replace(/【施工內容】/g, '').replace(/【問題回報】/g, ' ').trim();
    if (s.length > maxLen) return s.slice(0, maxLen) + '…';
    return s;
}

function getPhotoCount(report) {
    if (!report?.PhotoLinks) return 0;
    return String(report.PhotoLinks).split(',').filter(Boolean).length;
}

function isTodayTimestamp(ts) {
    if (!ts) return false;
    const d = new Date(ts);
    const n = new Date();
    return d.getFullYear() === n.getFullYear()
        && d.getMonth() === n.getMonth()
        && d.getDate() === n.getDate();
}

function formatReportTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isTodayTimestamp(ts)) {
        return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeProjectId(value) {
    return String(value || '').replace(/^#/, '').trim();
}

function aiPriority(report, userId) {
    const sig = String(report.AI_Signal || '').toLowerCase();
    const reviewed = isAiReviewedByUser(report.AI_HumanReviewed, userId);
    if ((sig === 'yellow' || sig === 'red') && !reviewed) return 0;
    if (sig === 'yellow' || sig === 'red') return 1;
    if (sig === 'green' && !reviewed) return 2;
    return 3;
}

function findProjectBySiteName(allProjects, siteName) {
    const name = String(siteName || '').trim();
    if (!name || !allProjects) return null;
    return allProjects.find(p => {
        const n = String(p.name || p['案場名稱'] || p.siteName || '').trim();
        return n === name;
    }) || null;
}

export default {
    name: 'HubLeftSidebar',
    props: [
        'allProjects',
        'currentUser',
        'todayReports',
        'todayReportsLoading',
        'todayPresence',
        'paymentTodos',
        'paymentTodosLoading'
    ],
    emits: ['reports-updated'],
    setup(props, { emit }) {
        const { todayReportsLoading, paymentTodosLoading } = toRefs(props);
        const reportUrl = '#/report';
        const dailyReportUrl = '#/daily-report';
        const accountingHubUrl = '#/accounting';
        const vendorPaymentUrl = '#/accounting/vendor-payment-finance';

        const localReports = ref([]);
        const expandedLogIds = ref({});
        const markingLogId = ref('');
        const rerunningLogId = ref('');

        watch(() => props.todayReports, (list) => {
            localReports.value = Array.isArray(list) ? [...list] : [];
        }, { immediate: true, deep: true });

        const activeProjects = computed(() => {
            if (!props.allProjects || !props.currentUser) return [];
            const permission = props.currentUser.permission || 1;
            const userId = props.currentUser.userId;
            const userGroup = props.currentUser.group;
            let filtered = [];
            if (permission >= 4) {
                filtered = props.allProjects;
            } else if (permission === 3) {
                filtered = props.allProjects.filter(p => p['專案分區'] === userGroup);
            } else {
                filtered = props.allProjects.filter(p =>
                    (p['專案負責人'] || '').split(',').map(id => id.trim()).includes(userId)
                );
            }
            return filtered
                .map(p => ({ id: String(p.id || p['案號'] || ''), name: p.name || p['案場名稱'] || p.siteName || '未命名' }))
                .filter(p => p.id)
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'));
        });

        const currentUserId = computed(() => String(props.currentUser?.userId || '').trim());

        /** 未標記已讀的回報（僅對目前登入者） */
        const unreadReports = computed(() =>
            localReports.value.filter(r => !isAiReviewedByUser(r.AI_HumanReviewed, currentUserId.value))
        );

        const reportedTodayProjectIds = computed(() => {
            const set = new Set();
            localReports.value.forEach(r => {
                if (!isTodayTimestamp(r.Timestamp)) return;
                const pid = normalizeProjectId(r.ProjectName);
                if (pid) set.add(pid);
            });
            return set;
        });

        /** 今日有人在案場打卡（紫燈）的案號 */
        const checkedInProjectIdsToday = computed(() => {
            const set = new Set();
            const presence = props.todayPresence || {};
            Object.values(presence).forEach(p => {
                if (!p?.hasCheckIn || p.light !== 'purple') return;
                const siteName = String(p.closestSiteName || '').trim();
                if (!siteName) return;
                const proj = findProjectBySiteName(props.allProjects, siteName);
                if (proj) {
                    const id = normalizeProjectId(proj.id || proj['案號']);
                    if (id) set.add(id);
                }
            });
            return set;
        });

        const missingProjects = computed(() => {
            const ids = [...checkedInProjectIdsToday.value].filter(id => !reportedTodayProjectIds.value.has(id));
            return ids.map(id => {
                const p = activeProjects.value.find(x => x.id === id)
                    || { id, name: id };
                return p;
            }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'));
        });

        const sortedReports = computed(() => {
            const uid = currentUserId.value;
            return [...unreadReports.value].sort((a, b) => {
                const diff = aiPriority(a, uid) - aiPriority(b, uid);
                if (diff !== 0) return diff;
                return new Date(b.Timestamp) - new Date(a.Timestamp);
            });
        });

        const perm = computed(() => Number(props.currentUser?.permission || 0));
        const pendingReview = computed(() => (props.paymentTodos?.pendingReview || []));
        const pendingPayment = computed(() => (props.paymentTodos?.pendingPayment || []));
        const hasPaymentSection = computed(() => perm.value >= 4);
        const showPendingReview = computed(() => perm.value >= 5);

        const formatAmount = (n) => {
            const v = parseInt(n, 10);
            if (isNaN(v)) return '—';
            return v.toLocaleString('zh-Hant');
        };

        const getAiMeta = (report) => {
            const signal = String(report.AI_Signal || '').toLowerCase();
            if (!signal && !report.AI_Summary) return null;
            return AI_SIGNAL_META[signal] || AI_SIGNAL_META.skipped;
        };

        const getAiDetails = (report) => getAiExpandableDetails(parseAiFindingsJson(report));

        const hasAiBlock = (report) => !!(report.AI_Signal || report.AI_Summary);
        const isExpanded = (logId) => !!expandedLogIds.value[logId];

        const toggleExpanded = (logId) => {
            expandedLogIds.value = {
                ...expandedLogIds.value,
                [logId]: !expandedLogIds.value[logId]
            };
        };

        const syncReports = (next) => {
            localReports.value = next;
            emit('reports-updated', next);
        };

        const openProject = (projectId) => {
            window.location.hash = `#/project-console?id=${projectId}`;
        };

        const openReportProject = (report) => {
            const pid = normalizeProjectId(report.ProjectName);
            if (pid) openProject(pid);
        };

        const markAiFeedback = async (report, verdict) => {
            const logId = report.LogID;
            if (!logId || markingLogId.value) return;
            const userId = props.currentUser?.userId || '';
            const userName = props.currentUser?.userName || props.currentUser?.displayName || '';
            markingLogId.value = logId;
            try {
                const result = await apiRequest({
                    action: 'markSiteReportAiReviewed',
                    payload: { logId, userId, userName, verdict }
                });
                if (!result?.success) {
                    throw new Error(result?.message || '標記失敗');
                }
                const reviewedValue = result.data?.AI_HumanReviewed ?? '';
                const next = localReports.value.map(r =>
                    r.LogID === logId ? { ...r, AI_HumanReviewed: reviewedValue } : r
                );
                syncReports(next);
            } catch (err) {
                alert('標記失敗：' + (err.message || '請稍後再試'));
            } finally {
                markingLogId.value = '';
            }
        };

        const rerunAiAnalysis = async (report) => {
            const logId = report.LogID;
            if (!logId || rerunningLogId.value) return;
            const userId = props.currentUser?.userId || '';
            const userName = props.currentUser?.userName || props.currentUser?.displayName || '';
            rerunningLogId.value = logId;
            try {
                const result = await apiRequest({
                    action: 'rerunSiteReportAiAnalysis',
                    payload: { logId, userId, userName }
                });
                if (!result?.success) {
                    throw new Error(result?.message || 'AI 分析失敗');
                }
                const patch = result.data || {};
                const next = localReports.value.map(r =>
                    r.LogID === logId ? { ...r, ...patch, AI_HumanReviewed: '' } : r
                );
                syncReports(next);
            } catch (err) {
                alert('AI 分析失敗：' + (err.message || '請稍後再試'));
            } finally {
                rerunningLogId.value = '';
            }
        };

        return {
            reportUrl,
            dailyReportUrl,
            accountingHubUrl,
            vendorPaymentUrl,
            sortedReports,
            missingProjects,
            todayReportsLoading,
            paymentTodosLoading,
            pendingReview,
            pendingPayment,
            hasPaymentSection,
            showPendingReview,
            formatAmount,
            getContentPreview,
            getPhotoCount,
            formatReportTime,
            normalizeProjectId,
            getAiMeta,
            getAiDetails,
            hasAiBlock,
            isExpanded,
            toggleExpanded,
            openProject,
            openReportProject,
            markAiFeedback,
            rerunAiAnalysis,
            markingLogId,
            rerunningLogId
        };
    },
    template: `
        <aside class="hidden lg:flex flex-col flex-shrink-0 border-r border-gray-200 bg-gray-50/80
            w-96 xl:w-[26rem] 2xl:w-[28rem] min-w-[22rem] max-w-[32vw]">
            <!-- 近三日施工回報（2/3 高） -->
            <section class="flex flex-col min-h-0 flex-[2] border-b border-gray-200">
                <div class="flex-shrink-0 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-base font-bold text-gray-700">近三日施工回報</h2>
                        <div class="flex items-center gap-2 text-xs">
                            <a :href="dailyReportUrl" class="text-blue-600 hover:underline font-medium">總覽 →</a>
                            <a :href="reportUrl" class="text-blue-600 hover:underline font-medium">去回報 →</a>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">
                        未讀 {{ sortedReports.length }} 筆
                        <span v-if="missingProjects.length > 0"> · 今日案場未回報 {{ missingProjects.length }} 案</span>
                        <span v-if="todayReportsLoading" class="text-blue-500 animate-pulse"> · 更新中</span>
                    </p>
                </div>
                <div class="flex-grow overflow-y-auto px-2 py-2 space-y-2 text-sm min-h-0">
                    <template v-if="sortedReports.length > 0">
                        <article v-for="report in sortedReports" :key="report.LogID"
                            class="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm">
                            <button type="button" @click="openReportProject(report)"
                                class="w-full text-left">
                                <div class="flex items-start justify-between gap-1">
                                    <div class="min-w-0">
                                        <span class="font-bold text-gray-800">#{{ normalizeProjectId(report.ProjectName) || '?' }}</span>
                                        <span class="text-gray-500 ml-1">{{ report.UserName || '未知' }}</span>
                                    </div>
                                    <span class="text-xs text-gray-400 flex-shrink-0 font-mono">{{ formatReportTime(report.Timestamp) }}</span>
                                </div>
                                <p v-if="report.Title" class="text-xs text-blue-700 mt-0.5 truncate">{{ report.Title }}</p>
                                <p class="text-sm text-gray-700 mt-1 leading-snug whitespace-pre-wrap">{{ getContentPreview(report.Content) || '（無文字）' }}</p>
                                <p v-if="getPhotoCount(report) > 0" class="text-xs text-gray-400 mt-0.5">📷 {{ getPhotoCount(report) }} 張</p>
                            </button>

                            <div v-if="hasAiBlock(report)" class="mt-2 p-2 rounded-md border text-sm"
                                :class="[getAiMeta(report).border, getAiMeta(report).bg]">
                                <div class="flex items-center gap-1 font-bold" :class="getAiMeta(report).text">
                                    <span>{{ getAiMeta(report).emoji }}</span>
                                    <span>AI · {{ getAiMeta(report).label }}</span>
                                </div>
                                <p v-if="report.AI_Summary" class="mt-1 leading-snug whitespace-pre-line" :class="getAiMeta(report).text">{{ report.AI_Summary }}</p>

                                <button v-if="getAiDetails(report)"
                                    type="button" @click="toggleExpanded(report.LogID)"
                                    class="text-xs font-semibold underline mt-1" :class="getAiMeta(report).text">
                                    {{ isExpanded(report.LogID) ? '收合細項' : '展開細項' }}
                                </button>
                                <div v-if="isExpanded(report.LogID) && getAiDetails(report)" class="mt-1 pl-2 border-l-2 space-y-1" :class="getAiMeta(report).border">
                                    <p v-if="getAiDetails(report).siteEntryStatus" class="text-xs text-gray-700">
                                        <span class="font-semibold">工種進場現況：</span>{{ getAiDetails(report).siteEntryStatus }}
                                    </p>
                                    <div v-if="getAiDetails(report).workRecords.length">
                                        <p class="text-xs font-semibold">工況紀錄與建議修正：</p>
                                        <ul class="text-xs text-gray-700 space-y-0.5 mt-0.5">
                                            <li v-for="(wr, wi) in getAiDetails(report).workRecords" :key="wi" class="ml-3 list-disc">
                                                <span v-if="wr.title" class="font-semibold">{{ wr.title }}：</span>{{ wr.detail }}
                                                <span v-if="wr.indices.length" class="text-gray-500"> (#{{ wr.indices.join('、#') }})</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div v-if="getAiDetails(report).handwrittenNotes.length">
                                        <p class="text-xs font-semibold">手寫／標記註記：</p>
                                        <ul class="text-xs text-gray-700 space-y-0.5 mt-0.5">
                                            <li v-for="hn in getAiDetails(report).handwrittenNotes" :key="hn.index" class="ml-3 list-disc">
                                                <span class="font-semibold">#{{ hn.index }}</span> {{ hn.transcription }}
                                                <span v-if="hn.meaning"> — {{ hn.meaning }}</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div v-if="getAiDetails(report).photoObservations.length">
                                        <p class="text-xs font-semibold">重點照片：</p>
                                        <ul class="text-xs text-gray-700 space-y-0.5 mt-0.5">
                                            <li v-for="obs in getAiDetails(report).photoObservations" :key="obs.index" class="ml-3 list-disc">
                                                <span class="font-semibold">#{{ obs.index }}</span> {{ obs.description }}
                                            </li>
                                        </ul>
                                    </div>
                                    <p v-if="getAiDetails(report).limitations.length" class="text-xs text-gray-600">
                                        <span class="font-semibold">限制：</span>{{ getAiDetails(report).limitations.join('；') }}
                                    </p>
                                    <p v-if="getAiDetails(report).qualityFlags.length" class="text-xs text-gray-700">
                                        <span class="font-semibold">品質留意：</span>{{ getAiDetails(report).qualityFlags.join('、') }}
                                    </p>
                                    <p v-if="getAiDetails(report).acceptanceLine" class="text-xs text-gray-600">
                                        <span class="font-semibold">驗收對照：</span>{{ getAiDetails(report).acceptanceLine }}
                                    </p>
                                </div>

                                <div class="flex flex-wrap gap-1.5 mt-2">
                                    <button type="button"
                                        @click="markAiFeedback(report, 'good')"
                                        :disabled="markingLogId === report.LogID"
                                        class="text-xs font-semibold bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                                        {{ markingLogId === report.LogID ? '處理中…' : '好' }}
                                    </button>
                                    <button type="button"
                                        @click="markAiFeedback(report, 'bad')"
                                        :disabled="markingLogId === report.LogID"
                                        class="text-xs font-semibold bg-white border border-gray-300 text-gray-700 px-2.5 py-1 rounded hover:bg-gray-50 disabled:opacity-50">
                                        {{ markingLogId === report.LogID ? '處理中…' : '需改' }}
                                    </button>
                                    <button type="button"
                                        @click="rerunAiAnalysis(report)"
                                        :disabled="rerunningLogId === report.LogID"
                                        class="text-xs font-semibold bg-white border border-gray-300 text-gray-700 px-2.5 py-1 rounded hover:bg-gray-50 disabled:opacity-50">
                                        {{ rerunningLogId === report.LogID ? '分析中…' : '送 AI 分析' }}
                                    </button>
                                </div>
                                <p class="text-[11px] text-gray-400 mt-1.5">僅供內部參考，非正式驗收簽核</p>
                            </div>
                            <div v-else class="mt-2 space-y-1.5">
                                <p class="text-xs text-gray-400 italic">AI 分析處理中或尚無結果</p>
                                <button type="button"
                                    @click="rerunAiAnalysis(report)"
                                    :disabled="rerunningLogId === report.LogID"
                                    class="text-xs font-semibold bg-white border border-gray-300 text-gray-700 px-2.5 py-1 rounded hover:bg-gray-50 disabled:opacity-50">
                                    {{ rerunningLogId === report.LogID ? '分析中…' : '送 AI 分析' }}
                                </button>
                            </div>
                        </article>
                    </template>
                    <p v-else-if="!todayReportsLoading" class="text-gray-500 text-center py-6 text-sm">近三日無未讀回報</p>
                    <p v-else class="text-gray-500 text-center py-6 text-sm">載入回報中…</p>

                    <details v-if="missingProjects.length > 0" class="mt-2 px-1">
                        <summary class="text-xs font-semibold text-red-600 cursor-pointer select-none">
                            今日案場已打卡、尚未回報（{{ missingProjects.length }}）
                        </summary>
                        <ul class="mt-1 space-y-0.5">
                            <li v-for="p in missingProjects" :key="'miss-' + p.id">
                                <button type="button" @click="openProject(p.id)"
                                    class="w-full text-left px-1.5 py-1 rounded hover:bg-white flex items-center gap-1">
                                    <span class="text-red-500 flex-shrink-0">○</span>
                                    <span class="truncate text-gray-800">{{ p.name }}</span>
                                    <span class="text-xs text-gray-400 ml-auto flex-shrink-0">{{ p.id }}</span>
                                </button>
                            </li>
                        </ul>
                    </details>
                </div>
            </section>

            <!-- 款項待辦（1/3 高） -->
            <section v-if="hasPaymentSection" class="flex flex-col min-h-0 flex-[1]">
                <div class="flex-shrink-0 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-base font-bold text-gray-700">款項待辦</h2>
                        <a :href="accountingHubUrl" class="text-xs text-blue-600 hover:underline font-medium">會計 →</a>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">
                        <span v-if="paymentTodosLoading" class="text-blue-500 animate-pulse">更新中…</span>
                        <span v-else>
                            待審 {{ pendingReview.length }} · 待匯 {{ pendingPayment.length }}
                        </span>
                    </p>
                </div>
                <div class="flex-grow overflow-y-auto px-2 py-2 space-y-2 text-sm min-h-0">
                    <div v-if="showPendingReview && pendingReview.length > 0">
                        <div class="text-xs font-semibold text-amber-700 px-1 mb-1">待審核</div>
                        <ul class="space-y-1">
                            <li v-for="item in pendingReview.slice(0, 5)" :key="'rv-' + item.payment_request_id"
                                class="px-1.5 py-1 rounded bg-white border border-amber-100">
                                <div class="font-medium text-gray-800 truncate">{{ item.vendor_name || '廠商' }}</div>
                                <div class="text-xs text-gray-500 truncate">
                                    {{ formatAmount(item.amount) }} 元
                                    <span v-if="item.project_no"> · 案 {{ item.project_no }}</span>
                                </div>
                            </li>
                        </ul>
                        <a v-if="pendingReview.length > 5" href="#/accounting/vendor-payment-approve"
                            class="block text-xs text-blue-600 hover:underline px-1 mt-1">還有 {{ pendingReview.length - 5 }} 筆…</a>
                    </div>
                    <div v-if="pendingPayment.length > 0">
                        <div class="text-xs font-semibold text-teal-700 px-1 mb-1">待匯款</div>
                        <ul class="space-y-1">
                            <li v-for="item in pendingPayment.slice(0, 5)" :key="'pay-' + item.payment_request_id"
                                class="px-1.5 py-1 rounded bg-white border border-teal-100">
                                <div class="font-medium text-gray-800 truncate">{{ item.vendor_name || '廠商' }}</div>
                                <div class="text-xs text-gray-500 truncate">
                                    {{ formatAmount(item.amount) }} 元
                                    <span v-if="item.project_no"> · 案 {{ item.project_no }}</span>
                                </div>
                            </li>
                        </ul>
                        <a v-if="pendingPayment.length > 5" :href="vendorPaymentUrl"
                            class="block text-xs text-blue-600 hover:underline px-1 mt-1">還有 {{ pendingPayment.length - 5 }} 筆…</a>
                    </div>
                    <p v-if="!paymentTodosLoading && pendingReview.length === 0 && pendingPayment.length === 0"
                        class="text-gray-500 text-center py-4 text-sm">目前沒有待辦款項</p>
                </div>
            </section>
        </aside>
    `
};
