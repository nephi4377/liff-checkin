/**
 * WMS 核心邏輯與 Vue 應用程式
 * v0.2 更新: 新增並行任務渲染、拖曳調整、編輯/新增 Modal、熱點圖
 */

const { createApp, ref, computed, onMounted, reactive, watch } = Vue;

// --- 1. 常數與假資料 (Constants & Mock Data) ---
const TASK_TYPES = {
    survey: { name: '場勘', color: 'bg-amber-100 border-amber-400' },
    layout: { name: '放樣', color: 'bg-blue-100 border-blue-400' },
    demolition: { name: '拆除', color: 'bg-red-100 border-red-400' },
    plumbing: { name: '水電', color: 'bg-cyan-100 border-cyan-400' },
    carpentry: { name: '木作', color: 'bg-orange-100 border-orange-400' },
    painting: { name: '油漆', color: 'bg-indigo-100 border-indigo-400' },
    system: { name: '系統櫃', color: 'bg-purple-100 border-purple-400' },
    acceptance: { name: '驗收', color: 'bg-green-100 border-green-400' },
};

const MOCK_EMPLOYEES = [
    { id: 'E001', name: '王大明', group: '木作組', title: '組長' },
    { id: 'E002', name: '李小華', group: '木作組', title: '師傅' },
    { id: 'E003', name: '張志豪', group: '水電組', title: '組長' },
    { id: 'E004', name: '陳美玲', group: '水電組', title: '師傅' },
    { id: 'E005', name: '林建宏', group: '油漆組', title: '師傅' },
    { id: 'E006', name: '趙子龍', group: '工務組', title: '工務助理' }
];

const MOCK_SITES = [
    { id: 'S001', name: '帝寶 A 棟', address: '台北市仁愛路...' },
    { id: 'S002', name: '信義之星', address: '台北市信義區...' },
    { id: 'S003', name: '板橋新站', address: '新北市板橋區...' },
];

function generateInitialTasks() {
    const tasks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    MOCK_EMPLOYEES.forEach(emp => {
        // 產生 3-5 個任務，包含重疊
        const numTasks = Math.floor(Math.random() * 3) + 3;
        for (let i = 0; i < numTasks; i++) {
            const durationHours = Math.floor(Math.random() * 4) + 1; // 1-4 小時
            const startHour = 9 + Math.floor(Math.random() * 8); // 9:00 - 16:00
            const startMinutes = Math.random() > 0.5 ? 30 : 0;

            if (startHour + durationHours > 18) continue;

            const site = MOCK_SITES[Math.floor(Math.random() * MOCK_SITES.length)];
            const typeKey = Object.keys(TASK_TYPES)[Math.floor(Math.random() * Object.keys(TASK_TYPES).length)];

            const start = new Date(today);
            start.setHours(startHour, startMinutes, 0, 0);
            const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

            tasks.push({
                id: `T${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                employeeId: emp.id,
                siteId: site.id,
                siteName: site.name,
                title: `${site.name} - ${TASK_TYPES[typeKey].name}`,
                type: typeKey,
                start: start,
                end: end,
                duration: durationHours,
                priority: Math.floor(Math.random() * 3) + 3, // 3-5
            });
        }
    });
    return tasks;
}

// --- 2. 核心排程演算法 (Core Scheduling Algorithms) ---
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;

/**
 * 智慧推移演算法 (Smart Shifting Algorithm)
 * 1. 當任務重疊時，自動將後續任務推移。
 * 2. 工作時間為 09:00 - 18:00。
 * 3. 若推移後超過 18:00，則移至隔天 09:00。
 */
function smartShiftTasks(allTasks, employeeId, updatedTask) {
    // 1. 取得該員工的所有任務，並按時間排序
    const empTasksWithNew = allTasks.filter(t => t.employeeId === employeeId && t.id !== updatedTask.id);

    // 2. 插入新任務
    empTasksWithNew.push(updatedTask);
    // 重新排序
    const empTasks = empTasksWithNew.sort((a, b) => new Date(a.start) - new Date(b.start));

    // 3. 迭代檢查並推移
    for (let i = 0; i < empTasks.length - 1; i++) {
        const current = empTasks[i];
        const next = empTasks[i + 1];
        
        // 檢查是否重疊 (Current End > Next Start)
        if (new Date(current.end) > new Date(next.start)) {
            console.log(`[衝突偵測] 任務 ${current.title} 與 ${next.title} 重疊，正在推移...`);

            // 計算需要的推移量 (毫秒)
            const shiftAmount = new Date(current.end) - new Date(next.start);

            // 推移下一個任務
            next.start = new Date(new Date(next.start).getTime() + shiftAmount);
            next.end = new Date(new Date(next.end).getTime() + shiftAmount);

            // 檢查是否超過當日下班時間 (18:00)
            if (new Date(next.end).getHours() >= WORK_END_HOUR && new Date(next.end).getMinutes() > 0) {
                console.log(`[跨日處理] 任務 ${next.title} 超過 18:00，移至隔日 09:00`);
                
                const durationMs = new Date(next.end) - new Date(next.start);
                // 移至隔天
                const nextDay = new Date(next.start);
                nextDay.setDate(nextDay.getDate() + 1);
                nextDay.setHours(WORK_START_HOUR, 0, 0, 0);

                // 重算結束時間 (保持工時長度)
                next.start = nextDay;
                next.end = new Date(nextDay.getTime() + durationMs);
            }
        }
    }

    // 4. 更新回主列表
    const otherTasks = allTasks.filter(t => t.employeeId !== employeeId);
    return [...otherTasks, ...empTasks];
}

/**
 * 計算並行任務的佈局
 * @param {Array} tasks - 已排序的員工任務列表
 * @returns {Array} 帶有 parallelIndex 和 maxParallel 的任務列表
 */
function calculateParallelLayout(tasks) {
    if (!tasks || tasks.length === 0) return [];

    tasks.forEach(task => {
        task.parallelIndex = 0;
        task.maxParallel = 1;
    });

    for (let i = 0; i < tasks.length; i++) {
        const currentTask = tasks[i];
        const overlappingTasks = [currentTask];

        for (let j = i + 1; j < tasks.length; j++) {
            const nextTask = tasks[j];
            if (nextTask.start < currentTask.end) {
                overlappingTasks.push(nextTask);
            }
        }

        if (overlappingTasks.length > 1) {
            overlappingTasks.sort((a, b) => a.start - b.start);
            overlappingTasks.forEach((task, index) => {
                task.parallelIndex = Math.max(task.parallelIndex, index);
                task.maxParallel = Math.max(task.maxParallel, overlappingTasks.length);
            });
        }
    }
    return tasks;
}

// --- 3. Vue 應用程式 ---
createApp({
    setup() {
        const tasks = ref(generateInitialTasks());
        const today = new Date();

        const currentView = ref('gantt'); // 'gantt' | 'heatmap'
        const filterGroup = ref('all');
        const mockSites = ref(MOCK_SITES);
        const taskTypes = ref(TASK_TYPES);

        const taskModal = reactive({
            show: false,
            isNew: false,
            data: {}
        });

        // UI 設定
        const dayWidth = 240; // 每天的像素寬度
        const baseRowHeight = 60; // 員工列基礎高度
        const workHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // 顯示的工作小時

        // 產生未來 7 天的時間軸
        const timelineDays = computed(() => {
            const days = [];
            const localToday = new Date();
            for (let i = 0; i < 7; i++) {
                const d = new Date(localToday);
                d.setDate(localToday.getDate() + i);
                days.push({
                    date: d,
                    dateStr: d.toISOString().split('T')[0],
                    displayDate: `${d.getMonth() + 1}/${d.getDate()}`
                });
            }
            return days;
        });

        const totalTimelineWidth = computed(() => timelineDays.value.length * dayWidth);

        // --- Computed Properties ---
        const uniqueGroups = computed(() => [...new Set(MOCK_EMPLOYEES.map(e => e.group))]);

        const groupedEmployees = computed(() => {
            const filtered = filterGroup.value === 'all' 
                ? MOCK_EMPLOYEES
                : MOCK_EMPLOYEES.filter(e => e.group === filterGroup.value);
            return filtered.reduce((acc, emp) => {
                (acc[emp.group] = acc[emp.group] || []).push(emp);
                return acc;
            }, {});
        });

        // 預先計算帶有並行佈局信息的任務
        const tasksByEmployee = computed(() => {
            const result = {};
            MOCK_EMPLOYEES.forEach(emp => {
                const empTasks = tasks.value
                    .filter(t => t.employeeId === emp.id)
                    .sort((a, b) => new Date(a.start) - new Date(b.start));
                result[emp.id] = calculateParallelLayout(empTasks);
            });
            return result;
        });

        // --- Methods ---

        const getEmployeeTasks = (empId) => {
            return tasksByEmployee.value[empId] || [];
        };

        const getEmployeeTaskCount = (empId) => {
            const todayStr = new Date().toISOString().split('T')[0];
            return tasks.value.filter(t => t.employeeId === empId && new Date(t.start).toISOString().startsWith(todayStr)).length;
        };

        const getRowHeight = (empId) => {
            const empTasks = tasksByEmployee.value[empId] || [];
            if (!empTasks || empTasks.length === 0) return baseRowHeight;
            const maxParallel = empTasks.reduce((max, task) => Math.max(max, task.maxParallel), 1);
            return (baseRowHeight * maxParallel) || baseRowHeight;
        };

        const getTaskStyle = (task) => {
            const startDate = new Date(task.start);
            const today = new Date();
            today.setHours(0,0,0,0);

            const diffTime = startDate - today;
            const diffHours = diffTime / (1000 * 60 * 60);

            const dayIndex = Math.floor(diffHours / 24);
            const hourInDay = startDate.getHours() + (startDate.getMinutes()/60);

            const workHourStart = 9;
            const workHourDuration = 9;

            let leftInDay = 0;
            if (hourInDay >= workHourStart) {
                leftInDay = ((hourInDay - workHourStart) / workHourDuration) * dayWidth;
            }

            const left = (dayIndex * dayWidth) + leftInDay;
            const taskDurationHours = (new Date(task.end) - new Date(task.start)) / (1000 * 60 * 60);
            const width = (taskDurationHours / workHourDuration) * dayWidth;

            // 並行任務的垂直佈局
            const totalRowHeight = getRowHeight(task.employeeId);
            const maxParallel = task.maxParallel || 1;
            const parallelIndex = task.parallelIndex || 0;
            const laneHeight = (totalRowHeight - 4) / maxParallel;
            const top = 2 + (parallelIndex * laneHeight);
            const height = laneHeight > 4 ? laneHeight - 4 : laneHeight;

            return {
                left: `${left}px`,
                width: `${width}px`,
                top: `${top}px`,
                height: `${height}px`,
            };
        };

        const getTaskColorClass = (type) => {
            return TASK_TYPES[type]?.color || 'bg-slate-200 border-slate-400';
        };

        const formatTime = (date) => {
            return new Date(date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        };

        const getWorkloadForDay = (empId, date) => {
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            return (tasks.value
                .filter(t => t.employeeId === empId && new Date(t.start) >= dayStart && new Date(t.start) < dayEnd)
                .reduce((total, task) => total + ((new Date(task.end) - new Date(t.start)) / (1000 * 60 * 60)), 0)
            ).toFixed(1);
        };

        const getHeatmapColor = (empId, date) => {
            const hours = getWorkloadForDay(empId, date);
            if (hours > 8) return 'rgba(239, 68, 68, 0.8)'; // red
            if (hours > 6) return 'rgba(249, 115, 22, 0.8)'; // orange
            if (hours > 4) return 'rgba(234, 179, 8, 0.7)'; // yellow
            if (hours > 0) return 'rgba(34, 197, 94, 0.6)'; // green
            return 'rgba(241, 245, 249, 1)'; // slate
        };

        // --- 互動功能 (Modal, Dragging) ---

        const toLocalISOString = (date) => {
            const tzoffset = (new Date()).getTimezoneOffset() * 60000;
            const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, -1);
            return localISOTime.substring(0, 16);
        };

        const openTaskModal = (task, options = {}) => {
            if (task) { // 編輯
                taskModal.isNew = false;
                taskModal.data = {
                    ...task,
                    start: toLocalISOString(new Date(task.start)),
                    end: toLocalISOString(new Date(task.end)),
                };
            } else { // 新增
                taskModal.isNew = true;
                const start = options.startTime || new Date();
                const end = new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000); // 預設2小時
                taskModal.data = {
                    id: `T${Date.now()}`,
                    title: options.isUrgent ? '緊急場勘 (插單)' : '新任務',
                    employeeId: options.employeeId || (MOCK_EMPLOYEES.length > 0 ? MOCK_EMPLOYEES[0].id : ''),
                    siteId: mockSites.value[0].id,
                    type: 'survey',
                    priority: options.isUrgent ? 1 : 5,
                    start: toLocalISOString(start),
                    end: toLocalISOString(end),
                };
            }
            taskModal.show = true;
        };

        const saveTask = () => {
            const data = taskModal.data;
            const newTask = {
                ...data,
                start: new Date(data.start),
                end: new Date(data.end),
                siteName: mockSites.value.find(s => s.id === data.siteId)?.name || '未知案場',
                duration: (new Date(data.end) - new Date(data.start)) / (1000 * 60 * 60)
            };

            if (taskModal.isNew) {
                tasks.value.push(newTask);
            } else {
                const index = tasks.value.findIndex(t => t.id === newTask.id);
                if (index !== -1) {
                    tasks.value.splice(index, 1, newTask);
                }
            }

            // 如果是緊急插單，觸發智慧推移
            if (newTask.priority <= 2) {
                alert(`偵測到緊急任務，將為 ${(MOCK_EMPLOYEES.find(e=>e.id === newTask.employeeId) || {}).name} 自動推移後續排程。`);
                tasks.value = smartShiftTasks(tasks.value, newTask.employeeId, newTask);
            }

            taskModal.show = false;
        };

        const handleGridClick = (empId, event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - rect.left;
            
            const dayIndex = Math.floor(x / dayWidth);
            const hourInDay = (x % dayWidth) / dayWidth * 9 + 9;

            const clickedDate = new Date(timelineDays.value[dayIndex].date);
            clickedDate.setHours(Math.floor(hourInDay), (hourInDay % 1) * 60, 0, 0);

            openTaskModal(null, { employeeId: empId, startTime: clickedDate });
        };

        // 同部捲動 (Header 跟著 Body 捲動)
        const timelineHeader = ref(null);
        const ganttContainer = ref(null);
        const resourceList = ref(null);

        const syncScroll = (e) => {
            if (timelineHeader.value) {
                timelineHeader.value.scrollLeft = e.target.scrollLeft;
            }
            if (resourceList.value) {
                resourceList.value.scrollTop = e.target.scrollTop;
            }
        };

        // --- 拖曳功能 ---
        const draggingTask = ref(null);
        const dragStartX = ref(0);
        const originalTaskStart = ref(null);

        const startDrag = (task, event) => {
            draggingTask.value = task;
            dragStartX.value = event.clientX;
            originalTaskStart.value = new Date(task.start);
            document.body.style.cursor = 'grabbing';
            window.addEventListener('mousemove', onDrag);
            window.addEventListener('mouseup', endDrag);
        };

        const onDrag = (event) => {
            if (!draggingTask.value) return;
            const dx = event.clientX - dragStartX.value;
            const hoursDragged = (dx / dayWidth) * 9;
            
            const newStart = new Date(originalTaskStart.value.getTime() + hoursDragged * 60 * 60 * 1000);
            const duration = draggingTask.value.duration * 60 * 60 * 1000;
            
            const taskToUpdate = tasks.value.find(t => t.id === draggingTask.value.id);
            if (taskToUpdate) {
                taskToUpdate.start = newStart;
                taskToUpdate.end = new Date(newStart.getTime() + duration);
            }
        };

        const endDrag = () => {
            if (draggingTask.value) {
                tasks.value = smartShiftTasks(tasks.value, draggingTask.value.employeeId, draggingTask.value);
            }
            draggingTask.value = null;
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', endDrag);
        };

        return {
            employees: MOCK_EMPLOYEES,
            filterGroup,
            uniqueGroups,
            groupedEmployees,
            tasksByEmployee,
            timelineDays,
            workHours,
            dayWidth,
            baseRowHeight,
            totalTimelineWidth,
            mockSites,
            taskTypes,
            taskModal,
            draggingTask,
            
            // Refs
            timelineHeader,
            ganttContainer,
            resourceList,

            // Methods
            getEmployeeTasks,
            getEmployeeTaskCount,
            getRowHeight,
            getTaskStyle,
            getTaskColorClass,
            formatTime,
            openTaskModal,
            saveTask,
            handleGridClick,
            syncScroll,
            startDrag,
            getWorkloadForDay,
            getHeatmapColor,
        };
    }
}).mount('#app');
