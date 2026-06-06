/*
* =============================================================================
* 檔案名稱: daily_report_main.js
* 專案名稱: 每日回報總覽
* 版本: v1.0 (模組化重構版)
* 說明: 負責處理每日回報總覽頁面的所有邏輯，包含資料獲取、渲染與互動。
* =============================================================================
*/ // [v602.0 重構] 引入統一設定檔
import { CONFIG } from '/shared/js/config.js';

// [v579.0 重構] 引入共用模組
import { extractDriveFileId } from '/shared/js/utils.js';
// [v581.0 修正] 根據使用者要求，改為使用自訂的 lazyLoadImages 函式來處理圖片延遲載入
import { lazyLoadImages } from './ui.js';

window.extractDriveFileId = extractDriveFileId;

let startDatePicker, endDatePicker, queryBtn, reportsContainer, placeholder, groupFilterContainer;
let searchInput;

/** 日報狀態 CSS 封裝（特休淡化、缺交警示） */
const REPORT_STYLES = {
    fullDayLeaveFade: 'opacity-60', // 特休人員整卡淡化 60% 透明度
    missingReportRow: 'mt-2 p-2.5 bg-red-50/40 rounded-lg border border-red-100 flex items-center justify-between text-xs transition-all hover:bg-red-50',
    leaveNoClockRow: 'mt-2 p-2 bg-gray-50/60 rounded-lg border border-gray-200/40 flex items-center gap-3 text-xs',
};
let currentViewMode = 'employee'; // [第三階段] 視角模式：'employee' 或 'project'
let searchTerm = ''; // [人員檢索] 搜尋關鍵字
let userProfile = null;
let allFetchedEmployees = [];
let allFetchedReports = [];

/**
 * 根據圖片網址，自動轉換為支援直連或縮圖免登入的網址（完美相容 Google Drive 與 Dropbox）
 * @param {string} url - 原始圖片網址
 * @param {number|string} size - 圖片尺寸 (用於 Google Drive, 如 300 或 1920)
 * @returns {string} - 轉換後的網址
 */
function getPhotoUrl(url, size = 300) {
    if (!url) return '';
    url = url.trim();

    // 1. 處理 Dropbox 連結 (核心優化)
    if (url.includes('dropbox.com')) {
        let directUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        directUrl = directUrl.replace('dl=0', 'raw=1');
        return directUrl;
    }

    // 2. 處理 Google Drive 連結
    if (url.includes('drive.google.com')) {
        const fileId = window.extractDriveFileId(url);
        return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}` : url;
    }

    // 3. 其他連結直接回傳
    return url;
}

function getTwoWorkingDaysAgo(date) {
    let resultDate = new Date(date);
    let workingDaysToSubtract = 2;
    let daysChecked = 0;
    while (workingDaysToSubtract > 0 && daysChecked < 7) {
        resultDate.setDate(resultDate.getDate() - 1);
        const dayOfWeek = resultDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDaysToSubtract--;
        }
        daysChecked++;
    }
    return resultDate;
}

function initializeUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const isLocalTest = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    let uid = urlParams.get('uid');
    let name = urlParams.get('name');

    if (isLocalTest && !uid) {
        console.warn('⚡️ 本地測試模式啟用，使用預設使用者資訊。');
        uid = 'Ud58333430513b7527106fa71d2e30151';
        name = '本地測試員';
    }

    if (!uid || !name) {
        showError('錯誤：缺少使用者認證資訊。<br>請從「整合主控台」進入此頁面。');
        queryBtn.disabled = true;
        return false;
    }
    userProfile = { userId: uid, userName: name };
    console.log('認證成功:', userProfile);
    return true;
}

async function fetchEmployees() {
    try {
        const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
        url.searchParams.append('page', 'attendance_api');
        url.searchParams.append('action', 'get_employees');
        const response = await fetch(url);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '後端未回傳員工資料');
        return result.data.filter(emp => emp.permission === 2 || emp.permission === 3);
    } catch (error) {
        console.error('獲取員工列表失敗:', error);
        showError(`獲取員工列表失敗: ${error.message}`);
        return [];
    }
}

function renderGroupFilters(employees) {
    const groups = [...new Set(employees.map(emp => emp.group || '未分類'))].sort();
    groupFilterContainer.innerHTML = '<span class="text-sm font-medium text-gray-700 mr-2">顯示組別:</span>';

    groups.forEach(groupName => {
        const checkboxHtml = `
                <div class="flex items-center">
                    <input type="checkbox" id="group-${groupName}" name="group-filter" value="${groupName}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked>
                    <label for="group-${groupName}" class="ml-2 text-sm text-gray-700">${groupName}</label>
                </div>
            `;
        groupFilterContainer.innerHTML += checkboxHtml;
    });

    groupFilterContainer.querySelectorAll('input[name="group-filter"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            renderMainReports();
        });
    });
}

// [第三階段] 視角切換初始化邏輯
function initViewToggle() {
    const btnEmp = document.getElementById('view-mode-employee');
    const btnProj = document.getElementById('view-mode-project');

    const updateBtnStyle = () => {
        if (currentViewMode === 'employee') {
            btnEmp.className = 'view-mode-btn bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-all shadow-sm';
            btnProj.className = 'view-mode-btn bg-gray-200 text-gray-600 text-xs font-bold py-1 px-3 rounded-md transition-all';
        } else {
            btnEmp.className = 'view-mode-btn bg-gray-200 text-gray-600 text-xs font-bold py-1 px-3 rounded-md transition-all';
            btnProj.className = 'view-mode-btn bg-blue-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-all shadow-sm';
        }
    };

    btnEmp.addEventListener('click', () => {
        if (currentViewMode === 'employee') return;
        currentViewMode = 'employee';
        updateBtnStyle();
        renderMainReports();
    });

    btnProj.addEventListener('click', () => {
        if (currentViewMode === 'project') return;
        currentViewMode = 'project';
        updateBtnStyle();
        renderMainReports();
    });
    updateBtnStyle(); // Initialize button styles
}

export function main() {
    startDatePicker = document.getElementById('start-date-picker');
    endDatePicker = document.getElementById('end-date-picker');
    queryBtn = document.getElementById('query-btn');
    reportsContainer = document.getElementById('reports-container');
    placeholder = document.getElementById('placeholder');
    groupFilterContainer = document.getElementById('group-filter-container');
    searchInput = document.getElementById('person-search-input');

    const today = new Date();
    startDatePicker.value = getTwoWorkingDaysAgo(today).toLocaleDateString('sv');
    endDatePicker.value = today.toLocaleDateString('sv');

    if (initializeUser()) {
        queryBtn.addEventListener('click', () => fetchAndRenderReports(startDatePicker.value, endDatePicker.value));
        fetchAndRenderReports(startDatePicker.value, endDatePicker.value);

        const sliderContainer = document.getElementById('thumbnail-slider-container');
        sliderContainer.innerHTML = `
                <label for="thumbnail-size-slider" class="text-sm font-medium text-gray-700 whitespace-nowrap">縮圖尺寸:</label>
                <input type="range" id="thumbnail-size-slider" min="50" max="300" value="100" class="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                <span id="thumbnail-size-display" class="text-sm font-semibold text-gray-800 w-12 text-center">100%</span>
            `;
        const sizeSlider = document.getElementById('thumbnail-size-slider');
        const sizeDisplay = document.getElementById('thumbnail-size-display');

        sizeSlider.addEventListener('input', (event) => {
            const percentage = event.target.value;
            sizeDisplay.textContent = `${percentage}%`;
            const newWidth = `calc(6rem * ${percentage / 100})`;
            document.documentElement.style.setProperty('--thumbnail-width', newWidth);
        });

        // [第三階段] 初始化視角切換器事件
        initViewToggle();

        // [人員檢索] 監聽搜尋框輸入
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            renderMainReports();
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../../sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
}

async function fetchAttendanceData(startDateStr, endDateStr) {
    try {
        const url = new URL(CONFIG.ATTENDANCE_GAS_WEB_APP_URL);
        url.searchParams.append('page', 'attendance_api');
        url.searchParams.append('action', 'get_report');
        url.searchParams.append('startDate', startDateStr);
        url.searchParams.append('endDate', endDateStr);
        const response = await fetch(url);
        const result = await response.json();
        return result.records || {};
    } catch (error) {
        console.error('獲取打卡紀錄失敗:', error);
        return {};
    }
}

async function fetchAndRenderReports(startDateStr, endDateStr) {
    showLoading();
    if (!userProfile) {
        showError('使用者資訊尚未初始化，無法查詢。');
        return;
    }

    try {
        const url = new URL(CONFIG.GAS_WEB_APP_URL);
        url.searchParams.append('page', 'get_daily_reports');
        url.searchParams.append('startDate', startDateStr);
        url.searchParams.append('endDate', endDateStr);
        url.searchParams.append('userName', userProfile.userName);

        // [第一階段] 解析年份月份以獲取排班資料
        const startDate = new Date(startDateStr);
        const queryYear = startDate.getFullYear();
        const queryMonth = startDate.getMonth() + 1;

        // [v1.0.7] 同時獲取打卡紀錄與日報，並採用健全的錯誤防禦機制
        const [employees, reportsResult, scheduleData, attendanceData] = await Promise.all([
            fetchEmployees().catch(err => {
                console.error('[降級警告] 獲取員工列表失敗:', err);
                return [];
            }),
            fetch(url).then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            }).catch(err => {
                console.error('[降級警告] 獲取日誌失敗:', err);
                return { success: false, data: [], message: err.message };
            }),
            window.dailyReportApp.getScheduleDataForMonth(queryYear, queryMonth).catch(err => {
                console.error('[降級警告] 獲取排班資料失敗:', err);
                return { schedule: {}, holidays: new Set() };
            }),
            fetchAttendanceData(startDateStr, endDateStr).catch(err => {
                console.error('[降級警告] 獲取考勤數據失敗:', err);
                return {};
            })
        ]);

        if (reportsResult && !reportsResult.success) {
            console.warn('[降級警告] 日報數據載入異常，將進行空白陣列降級:', reportsResult.message);
        }

        allFetchedEmployees = employees || [];
        allFetchedReports = reportsResult?.data || [];
        window.currentScheduleData = scheduleData || { schedule: {}, holidays: new Set() };
        window.currentAttendanceData = attendanceData || {};

        renderGroupFilters(allFetchedEmployees);
        renderMainReports();

    } catch (error) {
        console.error('載入回報失敗:', error);
        showError(`載入資料失敗：${error.message}`);
    }
}

/**
 * 取得指定範圍內的所有日期（由新到舊）
 */
function getDateRange(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const dates = [];
    let curr = new Date(end);
    curr.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    while (curr >= start) {
        dates.push(curr.getFullYear() + '-' + String(curr.getMonth() + 1).padStart(2, '0') + '-' + String(curr.getDate()).padStart(2, '0'));
        curr.setDate(curr.getDate() - 1);
    }
    return dates;
}

function renderMainReports() {
    if (currentViewMode === 'employee') {
        renderReportsByEmployee(allFetchedEmployees, allFetchedReports, window.currentScheduleData);
    } else {
        renderReportsByProject(allFetchedEmployees, allFetchedReports, window.currentScheduleData);
    }
}

function renderReportsByEmployee(employees, allReports, scheduleData) {
    const selectedGroups = new Set(
        Array.from(groupFilterContainer.querySelectorAll('input[name="group-filter"]:checked'))
            .map(cb => cb.value)
    );
    let filteredEmployees = employees.filter(emp => selectedGroups.has(emp.group || '未分類'));

    // [人員檢索] 過濾人名
    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp =>
            emp.userName.toLowerCase().includes(searchTerm)
        );
    }

    reportsContainer.innerHTML = '';

    if (filteredEmployees.length === 0) {
        showEmpty();
        placeholder.innerHTML = '<p>請至少選擇一個組別以顯示資料。</p>';
        return;
    }

    // [聯表效能優化] 預先對所有日報進行雙重雜湊關聯索引： UserID -> dateStr -> [reports]
    const reportsByUserIdAndDate = {};
    allReports.forEach(report => {
        const userId = report.UserID;
        if (!userId) return;
        const dateStr = String(report.Timestamp).split('T')[0];
        
        if (!reportsByUserIdAndDate[userId]) {
            reportsByUserIdAndDate[userId] = {};
        }
        if (!reportsByUserIdAndDate[userId][dateStr]) {
            reportsByUserIdAndDate[userId][dateStr] = [];
        }
        reportsByUserIdAndDate[userId][dateStr].push(report);
    });

    // 建立 UserID 到該員工日報總數的映射
    const reportsCountByUserId = allReports.reduce((acc, r) => {
        const uid = r.UserID;
        if (uid) acc[uid] = (acc[uid] || 0) + 1;
        return acc;
    }, {});

    filteredEmployees.sort((a, b) => (a.group || '未分類').localeCompare(b.group || '未分類', 'zh-Hant'));

    const localToday = new Date();
    const todayStr = localToday.getFullYear() + '-' + String(localToday.getMonth() + 1).padStart(2, '0') + '-' + String(localToday.getDate()).padStart(2, '0');
    const dateRange = getDateRange(startDatePicker.value, endDatePicker.value);

    let lastGroup = null;
    filteredEmployees.forEach(employee => {
        const employeeReportsCount = reportsCountByUserId[employee.userId] || 0;
        const employeeReportsIndexed = reportsByUserIdAndDate[employee.userId] || {};

        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-xl shadow-sm border border-gray-200/80 border-l-4 border-blue-500 transition-opacity duration-300';

        // 生成時間軸 HTML
        let timelineHtml = dateRange.map(dateStr => {
            const dateReports = employeeReportsIndexed[dateStr] || [];
            const dateLabel = dateStr.replace(/-/g, '/');

            if (dateReports.length > 0) {
                // 有報告的情況
                return dateReports.map(report => {
                    const reportTime = new Date(report.Timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                    let contentHtml = '';
                    let photosHtml = '';
                    if (report.PhotoLinks) {
                        const photoUrls = report.PhotoLinks.split(',').filter(Boolean);
                        const totalCount = photoUrls.length;
                        const MAX_VISIBLE = 5;
                        const visiblePhotos = photoUrls.slice(0, MAX_VISIBLE);

                        const imageElements = visiblePhotos.map((url, index) => {
                            const isLast = (index === MAX_VISIBLE - 1 && totalCount > MAX_VISIBLE);
                            const overlayHtml = isLast ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg pointer-events-none"><span>+${totalCount - MAX_VISIBLE + 1}</span></div>` : '';
                            
                            return `
                                <div class="relative aspect-square overflow-hidden rounded-md cursor-pointer group">
                                    <img data-src="${getPhotoUrl(url, 300)}"
                                         alt="現場照片"
                                         class="w-full h-full object-cover group-hover:opacity-80 transition-opacity lazy"
                                         onclick="openParentLightbox('${report.LogID}', ${index})">
                                    ${overlayHtml}
                                </div>`;
                        }).join('');

                        photosHtml = `<div class="grid grid-cols-3 gap-1 mt-2" id="image-group-${report.LogID}" data-photos='${JSON.stringify(photoUrls)}'>
                                ${imageElements}
                            </div>`;
                    }

                    if (report.Content !== null && typeof report.Content !== 'undefined') {
                        const contentParts = String(report.Content).split('【問題回報】');
                        const workDesc = contentParts[0].replace('【施工內容】', '').trim();
                        const problemDesc = contentParts[1] ? contentParts[1].trim() : '';
                        if (workDesc) {
                            contentHtml += `<p class="text-gray-800 whitespace-pre-wrap pl-2 border-l-2 border-blue-200">${workDesc}</p>`;
                        }
                        if (problemDesc) {
                            contentHtml += `<div class="mt-2 pl-2 border-l-2 border-red-200"><h5 class="font-bold text-red-600">⚠️ 問題回報：</h5><p class="text-red-800 whitespace-pre-wrap pl-1">${problemDesc}</p></div>`;
                        }
                    }

                    return `
                            <div class="mt-4 pt-4 border-t border-gray-150">
                                <div class="flex justify-between items-center text-sm flex-wrap gap-2">
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-bold text-gray-800">${dateLabel}</h3>
                                        <span class="text-xs font-semibold bg-blue-50 text-blue-700 py-0.5 px-2 rounded-md">#${String(report.ProjectName || 'N/A').replace(/^#/, '')}</span>
                                    </div>
                                    <span class="text-gray-400 font-mono text-xs">${reportTime}</span>
                                </div>
                                <div class="text-sm mt-2">${contentHtml || '<p class="text-gray-400 italic">無文字內容回報。</p>'}</div>
                                ${photosHtml}
                            </div>
                        `;
                }).join('');
            } else {
                // 無報告的情況，判斷假勤 (設計為超緊湊高質感卡片樣式)
                if (dateStr > todayStr) return ''; // 未來不顯示

                const leaveInfo = window.dailyReportApp.getLeaveStatus(employee.userId, dateStr, scheduleData);
                const userAttendance = window.currentAttendanceData[employee.userId]?.dailyData?.[dateStr];
                const hasClockedIn = !!(userAttendance && userAttendance.checkIn && userAttendance.checkIn !== '---');

                if (leaveInfo && leaveInfo.isFullDay && !hasClockedIn) {
                    return `
                            <div class="${REPORT_STYLES.leaveNoClockRow}">
                                <span class="font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">${dateLabel}</span>
                                <span class="text-gray-400 italic font-medium">[${leaveInfo.type}] (排休未進場)</span>
                            </div>
                        `;
                } else {
                    // 如果有上班打卡但沒交報告，或者是時段假期間應出勤卻沒交報告
                    const statusText = hasClockedIn ? `缺交報告 (已進場打卡 ${userAttendance.checkIn})` : `缺交報告 (今日應出勤)`;
                    const leaveSuffix = (leaveInfo && !leaveInfo.isFullDay) ? ` <span class="text-[10px] font-normal text-amber-600 bg-amber-50 px-1 rounded">${leaveInfo.original}</span>` : '';

                    return `
                            <div class="${REPORT_STYLES.missingReportRow}">
                                <div class="flex items-center gap-2.5">
                                    <span class="font-mono font-bold text-red-400 bg-red-100/50 px-1.5 py-0.5 rounded">${dateLabel}</span>
                                    <span class="text-red-700 font-bold flex items-center gap-1">⚠️ ${statusText}${leaveSuffix}</span>
                                </div>
                                <span class="text-[9px] text-red-400 font-bold tracking-wider uppercase border border-red-200 px-1 rounded bg-red-100/20">Missing</span>
                            </div>
                        `;
                }
            }
        }).join('');

        // 獲取當前日期的請假狀態（用於 Header 顯示）
        const currentLeave = window.dailyReportApp.getLeaveStatus(employee.userId, startDatePicker.value, scheduleData);
        const leaveBadge = currentLeave ? `<span class="ml-2 text-xs font-semibold bg-amber-50 text-amber-700 py-0.5 px-2 rounded-md border border-amber-200/80">${currentLeave.original}</span>` : '';
        const opacityClass = (currentLeave && currentLeave.isFullDay) ? REPORT_STYLES.fullDayLeaveFade : '';

        card.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        <h2 class="text-xl font-extrabold text-gray-800">${employee.userName}</h2>
                        ${leaveBadge}
                    </div>
                    <span class="text-xs font-bold bg-blue-50 text-blue-700 py-1 px-3 rounded-full border border-blue-100">
                        ${employeeReportsCount} 則回報
                    </span>
                </div>
                <div class="mt-2 transition-all ${opacityClass}">
                    ${timelineHtml || '<p class="text-gray-400 text-sm mt-4 italic">此區間無任何記錄。</p>'}
                </div>
            `;
        reportsContainer.appendChild(card);

        const currentGroup = employee.group || '未分類';
        if (currentGroup !== lastGroup) {
            const groupHeader = document.createElement('h2');
            groupHeader.className = 'text-base font-extrabold text-gray-600 mt-8 mb-3 pb-1.5 border-b-2 border-gray-200 flex items-center gap-2';
            groupHeader.innerHTML = `<span>👥 ${currentGroup}</span><span class="text-xs font-semibold bg-gray-100 text-gray-500 py-0.5 px-2 rounded-md">Group</span>`;
            reportsContainer.insertBefore(groupHeader, card);
            lastGroup = currentGroup;
        }
    });

    if (reportsContainer.children.length === 0) {
        showEmpty();
    } else {
        lazyLoadImages();
    }

    // 更新新版 KPI 戰情面板
    updateKPIDashboard(employees, reportsByUserIdAndDate, scheduleData);
}

/**
 * [第二階段] 計算並更新 KPI 看板數據
 */
/**
 * [第二階段] 計算並更新 KPI 看板數據 (優化為高階主管質感)
 */
function updateKPIDashboard(employees, reportsByUserIdAndDate, scheduleData) {
    const kpiDashboard = document.getElementById('kpi-dashboard');
    if (!kpiDashboard) return;

    const displayDateStr = startDatePicker.value; // 當前選擇日期
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    let isQueryingToday = (displayDateStr === todayStr);
    let targetMissingDate = displayDateStr;
    let missingLabelSuffix = "";

    const missingTitleEl = document.getElementById('kpi-missing-title');
    if (isQueryingToday) {
        // 如果查今日，缺交人數跳過目前還沒報的，顯示「昨日」的最終缺交
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        targetMissingDate = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
        missingLabelSuffix = " (昨日)";
        if (missingTitleEl) missingTitleEl.textContent = "昨日缺交統計";
    } else {
        if (missingTitleEl) missingTitleEl.textContent = "當日缺交統計";
    }

    let attendanceNames = [];
    let leaveNames = [];
    let missingNames = [];

    employees.forEach(emp => {
        const leaveInfo = window.dailyReportApp.getLeaveStatus(emp.userId, displayDateStr, scheduleData);
        const userAttendance = window.currentAttendanceData[emp.userId]?.dailyData?.[displayDateStr];
        const hasClockedIn = !!(userAttendance && userAttendance.checkIn && userAttendance.checkIn !== '---');

        // 判定今日出勤/請假
        if (hasClockedIn) {
            attendanceNames.push(emp.userName);
        } else if (leaveInfo && leaveInfo.isFullDay) {
            leaveNames.push(emp.userName);
        }

        // 判定催繳對象 (依據 targetMissingDate)
        const missingLeaveInfo = window.dailyReportApp.getLeaveStatus(emp.userId, targetMissingDate, scheduleData);
        const missingAttendance = window.currentAttendanceData[emp.userId]?.dailyData?.[targetMissingDate];
        const missingHasClockedIn = !!(missingAttendance && missingAttendance.checkIn && missingAttendance.checkIn !== '---');

        // 應出勤條件：有打卡 OR (沒請全天假)
        const shouldHaveWorked = missingHasClockedIn || !(missingLeaveInfo && missingLeaveInfo.isFullDay);
        
        // 取得該員工於目標日期的日報列表
        const reportCount = reportsByUserIdAndDate[emp.userId]?.[targetMissingDate]?.length || 0;

        if (shouldHaveWorked && reportCount === 0) {
            missingNames.push(emp.userName);
        }
    });

    // 應到人數 = 員工人數 - 請假人數 (或直接算當日應出勤人數)
    const totalExpected = employees.filter(emp => {
        const leaveInfo = window.dailyReportApp.getLeaveStatus(emp.userId, displayDateStr, scheduleData);
        const userAttendance = window.currentAttendanceData[emp.userId]?.dailyData?.[displayDateStr];
        const hasClockedIn = !!(userAttendance && userAttendance.checkIn && userAttendance.checkIn !== '---');
        return hasClockedIn || !(leaveInfo && leaveInfo.isFullDay);
    }).length;

    // 計算日報繳交率 (基於 targetMissingDate，因今日尚未過完，基於昨日統計更精確)
    const expectedForMissingDate = employees.filter(emp => {
        const leaveInfo = window.dailyReportApp.getLeaveStatus(emp.userId, targetMissingDate, scheduleData);
        const userAttendance = window.currentAttendanceData[emp.userId]?.dailyData?.[targetMissingDate];
        const hasClockedIn = !!(userAttendance && userAttendance.checkIn && userAttendance.checkIn !== '---');
        return hasClockedIn || !(leaveInfo && leaveInfo.isFullDay);
    }).length;

    const submissionRate = expectedForMissingDate > 0 
        ? Math.round(((expectedForMissingDate - missingNames.length) / expectedForMissingDate) * 100) 
        : 100;

    // 更新 DOM 內容
    document.getElementById('kpi-attendance-count').textContent = attendanceNames.length;
    document.getElementById('kpi-total-expected').textContent = totalExpected;
    document.getElementById('kpi-attendance-names').innerHTML = attendanceNames.length > 0 
        ? `<span class="text-blue-700">${attendanceNames.join(', ')}</span>` 
        : '<span class="text-gray-400 italic">無出勤打卡記錄</span>';

    document.getElementById('kpi-leave-count').textContent = leaveNames.length;
    document.getElementById('kpi-leave-names').innerHTML = leaveNames.length > 0 
        ? `<span class="text-amber-700">${leaveNames.join(', ')}</span>` 
        : '<span class="text-gray-400 italic">無人休假/請假</span>';

    document.getElementById('kpi-submission-rate').textContent = `${submissionRate}%`;
    document.getElementById('kpi-submitted-count').textContent = (expectedForMissingDate - missingNames.length);
    document.getElementById('kpi-missing-names').innerHTML = missingNames.length > 0 
        ? `<span class="text-red-500 font-bold">🚨 缺交 (${missingNames.length}人): ${missingNames.join(', ')}</span>` 
        : '<span class="text-emerald-600 italic">🎉 全員已完成回報</span>';

    kpiDashboard.classList.remove('hidden');
}

/**
 * [第三階段] 以專案為視角進行渲染
 */
function renderReportsByProject(employees, allReports, scheduleData) {
    const selectedGroups = new Set(
        Array.from(groupFilterContainer.querySelectorAll('input[name="group-filter"]:checked'))
            .map(cb => cb.value)
    );
    // 先建立 UserID 到 Employee 的映射，方便查找組別
    const empMap = employees.reduce((acc, emp) => {
        acc[emp.userId] = emp;
        return acc;
    }, {});

    // [效能優化] 預先對所有日報進行關聯索引以計算統計
    const reportsByUserIdAndDate = {};
    allReports.forEach(report => {
        const userId = report.UserID;
        if (!userId) return;
        const dateStr = String(report.Timestamp).split('T')[0];
        if (!reportsByUserIdAndDate[userId]) {
            reportsByUserIdAndDate[userId] = {};
        }
        if (!reportsByUserIdAndDate[userId][dateStr]) {
            reportsByUserIdAndDate[userId][dateStr] = [];
        }
        reportsByUserIdAndDate[userId][dateStr].push(report);
    });

    // 進行日誌分組（按專案名稱）
    const reportsByProject = allReports.reduce((acc, report) => {
        const projName = report.ProjectName || '未指定專案';
        const emp = empMap[report.UserID];

        // 過濾：組別選中 且 (如果有搜尋詞，必須符合人名)
        const isGroupSelected = emp && selectedGroups.has(emp.group || '未分類');
        const isMatchSearch = !searchTerm || (emp && emp.userName.toLowerCase().includes(searchTerm));

        if (isGroupSelected && isMatchSearch) {
            if (!acc[projName]) acc[projName] = [];
            acc[projName].push(report);
        }
        return acc;
    }, {});

    reportsContainer.innerHTML = '';
    const projectNames = Object.keys(reportsByProject).sort();

    if (projectNames.length === 0) {
        showEmpty();
        return;
    }

    projectNames.forEach(projName => {
        const reports = reportsByProject[projName];
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500';

        let reportsHtml = reports.map(report => {
            const reportTime = new Date(report.Timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            const emp = empMap[report.UserID];
            const userName = emp ? emp.userName : (report.userName || '未知人員');

            // 獲取請假狀態
            const reportDateStr = String(report.Timestamp).split('T')[0];
            const leaveInfo = window.dailyReportApp.getLeaveStatus(report.UserID, reportDateStr, scheduleData);
            const leaveBadge = leaveInfo ? `<span class="ml-1 text-[10px] bg-red-150 text-red-700 px-1.5 py-0.5 rounded">${leaveInfo.original}</span>` : '';
            
            // [特休人員日報淡化60%]
            const opacityClass = (leaveInfo && leaveInfo.isFullDay) ? REPORT_STYLES.fullDayLeaveFade : '';

            let contentHtml = '';
            let photosHtml = '';
            if (report.PhotoLinks) {
                const photoUrls = report.PhotoLinks.split(',').filter(Boolean);
                const totalCount = photoUrls.length;
                const MAX_VISIBLE = 5;
                const visiblePhotos = photoUrls.slice(0, MAX_VISIBLE);

                const imageElements = visiblePhotos.map((url, index) => {
                    const isLast = (index === MAX_VISIBLE - 1 && totalCount > MAX_VISIBLE);
                    const overlayHtml = isLast ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xs pointer-events-none"><span>+${totalCount - MAX_VISIBLE + 1}</span></div>` : '';
                    
                    return `
                        <div class="relative aspect-square overflow-hidden rounded-md cursor-pointer group">
                            <img data-src="${getPhotoUrl(url, 300)}" 
                                 alt="現場照片" 
                                 class="w-full h-full object-cover group-hover:opacity-80 transition-opacity lazy" 
                                 onclick="openParentLightbox('${report.LogID}', ${index})">
                            ${overlayHtml}
                        </div>`;
                }).join('');

                photosHtml = `<div class="grid grid-cols-3 gap-1 mt-2" id="image-group-${report.LogID}" data-photos='${JSON.stringify(photoUrls)}'>
                        ${imageElements}
                    </div>`;
            }

            if (report.Content) {
                const contentParts = String(report.Content).split('【問題回報】');
                const workDesc = contentParts[0].replace('【施工內容】', '').trim();
                const problemDesc = contentParts[1] ? contentParts[1].trim() : '';
                if (workDesc) contentHtml += `<p class="text-gray-800 whitespace-pre-wrap pl-2 border-l-2 border-blue-200 text-xs">${workDesc}</p>`;
                if (problemDesc) contentHtml += `<div class="mt-1 pl-2 border-l-2 border-red-200"><h5 class="text-xs font-bold text-red-600">⚠️ 問題：${problemDesc}</h5></div>`;
            }

            return `
                    <div class="mt-4 pt-3 border-t border-gray-100 ${opacityClass} transition-all">
                        <div class="flex justify-between items-center text-xs mb-1.5">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-blue-700">${userName}</span>
                                ${leaveBadge}
                            </div>
                            <span class="text-gray-400 font-mono text-[10px]">${reportTime}</span>
                        </div>
                        <div class="mt-1">${contentHtml}</div>
                        ${photosHtml}
                    </div>
                `;
        }).join('');

        card.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <h2 class="text-lg font-bold text-gray-800">🏗️ ${projName}</h2>
                    <span class="text-xs font-bold bg-orange-50 text-orange-700 py-0.5 px-2 rounded-full border border-orange-100">
                        ${reports.length} 筆回報
                    </span>
                </div>
                <div>${reportsHtml}</div>
            `;
        reportsContainer.appendChild(card);
    });

    lazyLoadImages();
    // 更新新版 KPI 戰情面板
    updateKPIDashboard(employees, reportsByUserIdAndDate, scheduleData);
}

function showLoading() {
    reportsContainer.innerHTML = '';
    placeholder.innerHTML = `
            <div class="spinner w-10 h-10 border-4 border-gray-200 rounded-full mx-auto"></div>
            <p class="mt-4">正在載入回報資料...</p>`;
    placeholder.classList.remove('hidden');
    reportsContainer.appendChild(placeholder);
}

function showError(message) {
    reportsContainer.innerHTML = '';
    placeholder.innerHTML = `<p class="text-red-500 font-semibold">${message}</p>`;
    placeholder.classList.remove('hidden');
    reportsContainer.appendChild(placeholder);
}

function showEmpty() {
    reportsContainer.innerHTML = '';
    placeholder.innerHTML = '<p>此區間內沒有任何工作回報紀錄。</p>';
    placeholder.classList.remove('hidden');
    reportsContainer.appendChild(placeholder);
}

/**
 * [v579.0 重構] 將函式移至全域，解決 ReferenceError
 */
window.openParentLightbox = function (logId, startIndex) {
    const imageGroup = document.getElementById(`image-group-${logId}`);
    if (!imageGroup) return;
    const originalUrls = JSON.parse(imageGroup.dataset.photos);

    const largeImageUrls = originalUrls.map(url => getPhotoUrl(url, 1920));

    window.parent.postMessage({
        type: 'openLightbox',
        payload: { images: largeImageUrls, index: startIndex }
    }, '*');
}