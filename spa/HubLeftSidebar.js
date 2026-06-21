import { AI_SIGNAL_META, parseAiFindingsJson } from '../modules/projects/js/siteReportAiUi.js';
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

function formatReportTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function normalizeProjectId(value) {
    return String(value || '').replace(/^#/, '').trim();
}

function aiPriority(report) {
    const sig = String(report.AI_Signal || '').toLowerCase();
    const reviewed = String(report.AI_HumanReviewed || '').trim();
    if ((sig === 'yellow' || sig === 'red') && !reviewed) return 0;
    if (sig === 'yellow' || sig === 'red') return 1;
    if (sig === 'green' && !reviewed) return 2;
    return 3;
}

export default {
    name: 'HubLeftSidebar',
    props: [
        'allProjects',
        'currentUser',
        'todayReports',
        'todayReportsLoading',
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

        const reportedProjectIds = computed(() => {
            const set = new Set();
            localReports.value.forEach(r => {
                const pid = normalizeProjectId(r.ProjectName);
                if (pid) set.add(pid);
            });
            return set;
        });

        const missingProjects = computed(() =>
            activeProjects.value.filter(p => !reportedProjectIds.value.has(p.id))
        );

        const sortedReports = computed(() =>
            [...localReports.value].sort((a, b) => {
                const diff = aiPriority(a) - aiPriority(b);
                if (diff !== 0) return diff;
                return new Date(b.Timestamp) - new Date(a.Timestamp);
            })
        );

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

        const getAiDetails = (report) => {
            const findings = parseAiFindingsJson(report);
            if (!findings) return null;
            const validated = findings.validated || {};
            return {
                limitations: (findings.raw && findings.raw.limitations) || [],
                qualityFlags: (validated.accepted_quality_flags || []).map(f => f.issue),
                acceptanceLine: validated.acceptance_line || ''
            };
        };

        const hasAiBlock = (report) => !!(report.AI_Signal || report.AI_Summary);
        const isExpanded = (logId) => !!expandedLogIds.value[logId];

        const toggleExpanded = (logId) => {
            expandedLogIds.value = {
                ...expandedLogIds.value,
                [logId]: !expandedLogIds.value[logId]
            };
        };

        const openProject = (projectId) => {
            window.location.hash = `#/project-console?id=${projectId}`;
        };

        const openReportProject = (report) => {
            const pid = normalizeProjectId(report.ProjectName);
            if (pid) openProject(pid);
        };

        const markAiReviewed = async (report) => {
            const logId = report.LogID;
            if (!logId || markingLogId.value) return;
            const userId = props.currentUser?.userId || '';
            const userName = props.currentUser?.userName || props.currentUser?.displayName || '';
            markingLogId.value = logId;
            try {
                const result = await apiRequest({
                    action: 'markSiteReportAiReviewed',
                    payload: { logId, userId, userName }
                });
                if (!result?.success) {
                    throw new Error(result?.message || '標記失敗');
                }
                const reviewed = result.data?.AI_HumanReviewed
                    || `${userName} @ ${new Date().toLocaleString('zh-TW')}`;
                const next = localReports.value.map(r =>
                    r.LogID === logId ? { ...r, AI_HumanReviewed: reviewed } : r
                );
                localReports.value = next;
                emit('reports-updated', next);
            } catch (err) {
                alert('標記失敗：' + (err.message || '請稍後再試'));
            } finally {
                markingLogId.value = '';
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
            markAiReviewed,
            markingLogId,
            activeProjects
        };
    },
    template: `
        <aside class="hidden lg:flex flex-col w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 bg-gray-50/80">
            <!-- 今日施工回報（內容 + AI） -->
            <section class="flex flex-col min-h-0 flex-1 border-b border-gray-200">
                <div class="flex-shrink-0 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-sm font-bold text-gray-700">今日施工回報</h2>
                        <div class="flex items-center gap-2 text-[10px]">
                            <a :href="dailyReportUrl" class="text-blue-600 hover:underline font-medium">總覽 →</a>
                            <a :href="reportUrl" class="text-blue-600 hover:underline font-medium">去回報 →</a>
                        </div>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-0.5">
                        今日 {{ sortedReports.length }} 筆
                        <span v-if="missingProjects.length > 0"> · 未回報 {{ missingProjects.length }} 案</span>
                        <span v-if="todayReportsLoading" class="text-blue-500 animate-pulse"> · 更新中</span>
                    </p>
                </div>
                <div class="flex-grow overflow-y-auto px-2 py-2 space-y-2 text-xs">
                    <template v-if="sortedReports.length > 0">
                        <article v-for="report in sortedReports" :key="report.LogID"
                            class="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                            <button type="button" @click="openReportProject(report)"
                                class="w-full text-left">
                                <div class="flex items-start justify-between gap-1">
                                    <div class="min-w-0">
                                        <span class="font-bold text-gray-800">#{{ normalizeProjectId(report.ProjectName) || '?' }}</span>
                                        <span class="text-gray-500 ml-1">{{ report.UserName || '未知' }}</span>
                                    </div>
                                    <span class="text-[10px] text-gray-400 flex-shrink-0 font-mono">{{ formatReportTime(report.Timestamp) }}</span>
                                </div>
                                <p v-if="report.Title" class="text-[10px] text-blue-700 mt-0.5 truncate">{{ report.Title }}</p>
                                <p class="text-[11px] text-gray-700 mt-1 leading-snug whitespace-pre-wrap">{{ getContentPreview(report.Content) || '（無文字）' }}</p>
                                <p v-if="getPhotoCount(report) > 0" class="text-[10px] text-gray-400 mt-0.5">📷 {{ getPhotoCount(report) }} 張</p>
                            </button>

                            <div v-if="hasAiBlock(report)" class="mt-2 p-2 rounded-md border text-[11px]"
                                :class="[getAiMeta(report).border, getAiMeta(report).bg]">
                                <div class="flex items-center gap-1 font-bold" :class="getAiMeta(report).text">
                                    <span>{{ getAiMeta(report).emoji }}</span>
                                    <span>AI · {{ getAiMeta(report).label }}</span>
                                </div>
                                <p v-if="report.AI_Summary" class="mt-1 leading-snug" :class="getAiMeta(report).text">{{ report.AI_Summary }}</p>

                                <button v-if="(report.AI_Signal === 'yellow' || report.AI_Signal === 'red') && getAiDetails(report)"
                                    type="button" @click="toggleExpanded(report.LogID)"
                                    class="text-[10px] font-semibold underline mt-1" :class="getAiMeta(report).text">
                                    {{ isExpanded(report.LogID) ? '收合細項' : '展開細項' }}
                                </button>
                                <div v-if="isExpanded(report.LogID) && getAiDetails(report)" class="mt-1 pl-2 border-l-2 space-y-1" :class="getAiMeta(report).border">
                                    <p v-if="getAiDetails(report).limitations.length" class="text-[10px] text-gray-600">
                                        <span class="font-semibold">限制：</span>{{ getAiDetails(report).limitations.join('；') }}
                                    </p>
                                    <p v-if="getAiDetails(report).qualityFlags.length" class="text-[10px] text-gray-700">
                                        <span class="font-semibold">品質留意：</span>{{ getAiDetails(report).qualityFlags.join('、') }}
                                    </p>
                                    <p v-if="getAiDetails(report).acceptanceLine" class="text-[10px] text-gray-600">
                                        <span class="font-semibold">驗收對照：</span>{{ getAiDetails(report).acceptanceLine }}
                                    </p>
                                </div>

                                <p v-if="report.AI_HumanReviewed" class="text-[10px] text-emerald-700 mt-1 font-medium">
                                    ✓ 已人工覆核：{{ report.AI_HumanReviewed }}
                                </p>
                                <button v-else-if="report.AI_Summary" type="button"
                                    @click="markAiReviewed(report)"
                                    :disabled="markingLogId === report.LogID"
                                    class="mt-1.5 text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-50">
                                    {{ markingLogId === report.LogID ? '處理中…' : '標記已人工看過' }}
                                </button>
                                <p class="text-[9px] text-gray-400 mt-1">僅供內部參考，非正式驗收簽核</p>
                            </div>
                            <p v-else class="text-[10px] text-gray-400 mt-1.5 italic">AI 分析處理中或尚無結果</p>
                        </article>
                    </template>
                    <p v-else-if="!todayReportsLoading" class="text-gray-500 text-center py-6 text-[11px]">今日尚無施工回報</p>
                    <p v-else class="text-gray-500 text-center py-6 text-[11px]">載入回報中…</p>

                    <details v-if="missingProjects.length > 0" class="mt-2 px-1">
                        <summary class="text-[10px] font-semibold text-red-600 cursor-pointer select-none">
                            尚未回報（{{ missingProjects.length }}）
                        </summary>
                        <ul class="mt-1 space-y-0.5">
                            <li v-for="p in missingProjects" :key="'miss-' + p.id">
                                <button type="button" @click="openProject(p.id)"
                                    class="w-full text-left px-1.5 py-0.5 rounded hover:bg-white flex items-center gap-1">
                                    <span class="text-red-500 flex-shrink-0">○</span>
                                    <span class="truncate text-gray-800">{{ p.name }}</span>
                                    <span class="text-[9px] text-gray-400 ml-auto flex-shrink-0">{{ p.id }}</span>
                                </button>
                            </li>
                        </ul>
                    </details>
                </div>
            </section>

            <!-- 款項待辦 -->
            <section v-if="hasPaymentSection" class="flex flex-col max-h-[40%] min-h-[7rem]">
                <div class="flex-shrink-0 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-sm font-bold text-gray-700">款項待辦</h2>
                        <a :href="accountingHubUrl" class="text-[10px] text-blue-600 hover:underline font-medium">會計 →</a>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-0.5">
                        <span v-if="paymentTodosLoading" class="text-blue-500 animate-pulse">更新中…</span>
                        <span v-else>
                            待審 {{ pendingReview.length }} · 待匯 {{ pendingPayment.length }}
                        </span>
                    </p>
                </div>
                <div class="flex-grow overflow-y-auto px-2 py-2 space-y-2 text-xs">
                    <div v-if="showPendingReview && pendingReview.length > 0">
                        <div class="text-[10px] font-semibold text-amber-700 px-1 mb-1">待審核</div>
                        <ul class="space-y-1">
                            <li v-for="item in pendingReview.slice(0, 5)" :key="'rv-' + item.payment_request_id"
                                class="px-1.5 py-1 rounded bg-white border border-amber-100">
                                <div class="font-medium text-gray-800 truncate">{{ item.vendor_name || '廠商' }}</div>
                                <div class="text-[10px] text-gray-500 truncate">
                                    {{ formatAmount(item.amount) }} 元
                                    <span v-if="item.project_no"> · 案 {{ item.project_no }}</span>
                                </div>
                            </li>
                        </ul>
                        <a v-if="pendingReview.length > 5" href="#/accounting/vendor-payment-approve"
                            class="block text-[10px] text-blue-600 hover:underline px-1 mt-1">還有 {{ pendingReview.length - 5 }} 筆…</a>
                    </div>
                    <div v-if="pendingPayment.length > 0">
                        <div class="text-[10px] font-semibold text-teal-700 px-1 mb-1">待匯款</div>
                        <ul class="space-y-1">
                            <li v-for="item in pendingPayment.slice(0, 5)" :key="'pay-' + item.payment_request_id"
                                class="px-1.5 py-1 rounded bg-white border border-teal-100">
                                <div class="font-medium text-gray-800 truncate">{{ item.vendor_name || '廠商' }}</div>
                                <div class="text-[10px] text-gray-500 truncate">
                                    {{ formatAmount(item.amount) }} 元
                                    <span v-if="item.project_no"> · 案 {{ item.project_no }}</span>
                                </div>
                            </li>
                        </ul>
                        <a v-if="pendingPayment.length > 5" :href="vendorPaymentUrl"
                            class="block text-[10px] text-blue-600 hover:underline px-1 mt-1">還有 {{ pendingPayment.length - 5 }} 筆…</a>
                    </div>
                    <p v-if="!paymentTodosLoading && pendingReview.length === 0 && pendingPayment.length === 0"
                        class="text-gray-500 text-center py-4 text-[11px]">目前沒有待辦款項</p>
                </div>
            </section>
        </aside>
    `
};
