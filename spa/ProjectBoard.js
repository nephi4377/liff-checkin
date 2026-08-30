const { computed } = Vue;

export default {
    name: 'ProjectBoard',
    props: ['projects', 'userProfile', 'currentUser', 'projectsLoading', 'projectsError'],
    emits: ['retry'],
    setup(props, { emit }) {
        const openProjectConsole = (projectId) => {
            if (!props.userProfile?.userId) {
                alert('無法取得您的使用者資訊，請重新載入頁面。');
                return;
            }
            // [v424.0 架構優化] 改為觸發內部路由導航
            window.location.hash = `#/project-console?id=${projectId}`;
        };

        const projectsToShow = computed(() => {
            if (!props.projects || !props.currentUser) return [];
            const permission = props.currentUser.permission || 1;
            // [v595.0 核心修正] 根據您的回報，權限判斷應使用 userId，而非 userName。
            const userId = props.currentUser.userId;
            const userGroup = props.currentUser.group;

            let filtered = [];
            if (permission >= 4) {
                filtered = props.projects;
            } else if (permission === 3) {
                // 工務權限：比對專案分區與使用者組別
                filtered = props.projects.filter(p => p['專案分區'] === userGroup);
            } else {
                // 設計師/助理權限：比對專案負責人欄位是否包含使用者的 User ID
                // 專案負責人欄位可能包含多個以逗號分隔的 ID
                filtered = props.projects.filter(p => (p['專案負責人'] || '').split(',').map(id => id.trim()).includes(userId));
            }
            return filtered.sort((a, b) => (new Date(b.logSummary?.[0]?.Timestamp) || 0) - (new Date(a.logSummary?.[0]?.Timestamp) || 0));
        });

        const hasVisibleProjects = computed(() => Array.isArray(projectsToShow.value) && projectsToShow.value.length > 0);
        const retryProjects = () => emit('retry');

        return { projectsToShow, hasVisibleProjects, openProjectConsole, retryProjects };
    },
    template: `
        <div>
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 class="text-lg font-bold text-gray-800">專案看板</h2>
                <span v-if="projectsLoading" class="text-sm text-blue-500 animate-pulse">更新中…</span>
            </div>
            <p v-if="projectsError && hasVisibleProjects" class="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {{ projectsError }}
                <button type="button" @click="retryProjects" :disabled="projectsLoading"
                    class="ml-2 font-semibold text-blue-600 hover:underline disabled:opacity-50">再試一次</button>
            </p>
            <div v-if="projectsError && !hasVisibleProjects" class="text-center text-amber-900 py-12 px-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p class="font-medium">{{ projectsError }}</p>
                <button type="button" @click="retryProjects" :disabled="projectsLoading"
                    class="mt-3 inline-flex items-center text-sm font-semibold bg-white text-blue-700 border border-blue-300 py-2 px-4 rounded-lg hover:bg-blue-50 disabled:opacity-50">再試一次</button>
            </div>
            <div v-else-if="projectsLoading && !hasVisibleProjects" class="text-center text-gray-500 py-12">
                <p>載入專案中…</p>
            </div>
            <div v-else-if="!currentUser" class="text-center text-gray-600 py-12 px-4">
                <p>還不能確認你的身分，所以無法列出你負責的案子。</p>
                <button type="button" @click="retryProjects" :disabled="projectsLoading"
                    class="mt-3 inline-flex items-center text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50">再試一次</button>
            </div>
            <div v-else-if="!hasVisibleProjects" class="text-center text-gray-500 py-12">
                <p>目前沒有你負責的專案。</p>
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div v-for="p in projectsToShow" :key="p.id" class="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col gap-4">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <h3 class="font-bold text-lg text-gray-800 min-w-0 flex-1">{{ p.name }}</h3>
                        <button type="button" @click="openProjectConsole(p.id)"
                            class="shrink-0 inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-4 rounded-lg shadow-md active:opacity-90 transition"
                            aria-label="開啟此專案的主控台工作區">開啟工作區</button>
                    </div>
                    <div><h4 class="font-semibold text-gray-600 text-sm mb-2">工程進度</h4><ul class="text-sm space-y-1 text-gray-700"><li v-for="task in p.scheduleSummary" :key="task['任務項目']"><span class="text-gray-500">{{ new Date(task['預計開始日']).toLocaleDateString('sv').substring(5) }}</span> <span :class="['font-medium', task['狀態'] === '已完成' ? 'text-gray-500' : 'text-red-600']">{{ task['狀態'] === '已完成' ? '[已完成]' : '[未完成]' }}</span> {{ task['任務項目'] }}</li></ul></div>
                    <div><h4 class="font-semibold text-gray-600 text-sm mb-2">近期回報</h4><ul class="text-sm space-y-1 text-gray-700"><li v-for="log in p.logSummary" :key="log.LogID"><span class="text-gray-500">{{ new Date(log.Timestamp).toLocaleDateString('sv').substring(5) }}</span> <span class="font-medium text-blue-700">{{ (log.Title || '').match(/(\\d{4}-\\d{2}-\\d{2})\\s(.+?)\\s/)?.[2] || '日誌' }}</span> by {{ log.UserName }}</li></ul></div>
                </div>
            </div>
        </div>
    `
};
