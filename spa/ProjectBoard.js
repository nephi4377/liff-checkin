const { computed } = Vue;

export default {
    name: 'ProjectBoard',
    props: ['projects', 'userProfile', 'currentUser'],
    setup(props) {
        const PROJECT_CONSOLE_LIFF_ID = '2007974938-7yKM9EqL';

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

        return { projectsToShow, openProjectConsole };
    },
    template: `
        <div>
            <div v-if="!projectsToShow || projectsToShow.length === 0" class="text-center text-gray-500 py-12"><p>正在載入專案資料或沒有符合您權限的專案。</p></div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div v-for="p in projectsToShow" :key="p.id" class="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col gap-4">
                    <div class="flex justify-between items-center"><h3 class="font-bold text-lg text-gray-800">{{ p.name }}</h3><div><button @click="openProjectConsole(p.id)" class="bg-blue-100 text-blue-700 text-xs font-bold py-1 px-3 rounded-full hover:bg-blue-200">開啟工作區</button></div></div>
                    <div><h4 class="font-semibold text-gray-600 text-sm mb-2">工程進度</h4><ul class="text-sm space-y-1 text-gray-700"><li v-for="task in p.scheduleSummary" :key="task['任務項目']"><span class="text-gray-500">{{ new Date(task['預計開始日']).toLocaleDateString('sv').substring(5) }}</span> <span :class="['font-medium', task['狀態'] === '已完成' ? 'text-gray-500' : 'text-red-600']">{{ task['狀態'] === '已完成' ? '[已完成]' : '[未完成]' }}</span> {{ task['任務項目'] }}</li></ul></div>
                    <div><h4 class="font-semibold text-gray-600 text-sm mb-2">近期回報</h4><ul class="text-sm space-y-1 text-gray-700"><li v-for="log in p.logSummary" :key="log.LogID"><span class="text-gray-500">{{ new Date(log.Timestamp).toLocaleDateString('sv').substring(5) }}</span> <span class="font-medium text-blue-700">{{ (log.Title || '').match(/(\\d{4}-\\d{2}-\\d{2})\\s(.+?)\\s/)?.[2] || '日誌' }}</span> by {{ log.UserName }}</li></ul></div>
                </div>
            </div>
        </div>
    `
};