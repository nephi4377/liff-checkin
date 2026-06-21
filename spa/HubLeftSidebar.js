const { computed, toRefs } = Vue;

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
    setup(props) {
        const { todayReportsLoading, paymentTodosLoading } = toRefs(props);
        const reportUrl = '#/report';
        const accountingHubUrl = '#/accounting';
        const vendorPaymentUrl = '#/accounting/vendor-payment-finance';

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
            (props.todayReports || []).forEach(r => {
                const pid = String(r.ProjectName || '').trim();
                if (pid) set.add(pid);
            });
            return set;
        });

        const siteReportStatus = computed(() => {
            const reported = [];
            const missing = [];
            activeProjects.value.forEach(p => {
                if (reportedProjectIds.value.has(p.id)) {
                    reported.push(p);
                } else {
                    missing.push(p);
                }
            });
            return { reported, missing };
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

        const openProject = (projectId) => {
            window.location.hash = `#/project-console?id=${projectId}`;
        };

        return {
            reportUrl,
            accountingHubUrl,
            vendorPaymentUrl,
            siteReportStatus,
            todayReportsLoading,
            paymentTodosLoading,
            pendingReview,
            pendingPayment,
            hasPaymentSection,
            showPendingReview,
            formatAmount,
            openProject,
            activeProjects
        };
    },
    template: `
        <aside class="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50/80">
            <!-- 今日施工案場 -->
            <section class="flex flex-col min-h-0 flex-1 border-b border-gray-200">
                <div class="flex-shrink-0 px-3 py-2.5 bg-white border-b border-gray-100">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-sm font-bold text-gray-700">今日施工回報</h2>
                        <a :href="reportUrl" class="text-[10px] text-blue-600 hover:underline font-medium">去回報 →</a>
                    </div>
                    <p class="text-[10px] text-gray-500 mt-0.5">
                        進行中案場 · {{ activeProjects.length }} 件
                        <span v-if="todayReportsLoading" class="text-blue-500 animate-pulse"> · 更新中</span>
                    </p>
                </div>
                <div class="flex-grow overflow-y-auto px-2 py-2 space-y-2 text-xs">
                    <template v-if="activeProjects.length > 0">
                        <div v-if="siteReportStatus.reported.length > 0">
                            <div class="text-[10px] font-semibold text-green-700 px-1 mb-1">已回報（{{ siteReportStatus.reported.length }}）</div>
                            <ul class="space-y-0.5">
                                <li v-for="p in siteReportStatus.reported" :key="'ok-' + p.id">
                                    <button type="button" @click="openProject(p.id)"
                                        class="w-full text-left px-1.5 py-0.5 rounded hover:bg-white flex items-center gap-1">
                                        <span class="text-green-600 flex-shrink-0">✓</span>
                                        <span class="truncate text-gray-800">{{ p.name }}</span>
                                        <span class="text-[9px] text-gray-400 ml-auto flex-shrink-0">{{ p.id }}</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div v-if="siteReportStatus.missing.length > 0">
                            <div class="text-[10px] font-semibold text-red-600 px-1 mb-1 mt-2">尚未回報（{{ siteReportStatus.missing.length }}）</div>
                            <ul class="space-y-0.5">
                                <li v-for="p in siteReportStatus.missing" :key="'miss-' + p.id">
                                    <button type="button" @click="openProject(p.id)"
                                        class="w-full text-left px-1.5 py-0.5 rounded hover:bg-white flex items-center gap-1">
                                        <span class="text-red-500 flex-shrink-0">○</span>
                                        <span class="truncate text-gray-800">{{ p.name }}</span>
                                        <span class="text-[9px] text-gray-400 ml-auto flex-shrink-0">{{ p.id }}</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </template>
                    <p v-else class="text-gray-500 text-center py-6 text-[11px]">載入案場中…</p>
                </div>
            </section>

            <!-- 款項待辦 -->
            <section v-if="hasPaymentSection" class="flex flex-col max-h-[45%] min-h-[8rem]">
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
