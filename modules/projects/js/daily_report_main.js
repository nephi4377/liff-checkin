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
let userProfile = null;
let allFetchedEmployees = [];
let allFetchedReports = [];

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
                renderReportsByEmployee(allFetchedEmployees, allFetchedReports);
            });
        });
    }

    export function main() {
        startDatePicker = document.getElementById('start-date-picker');
        endDatePicker = document.getElementById('end-date-picker');
        queryBtn = document.getElementById('query-btn');
        reportsContainer = document.getElementById('reports-container');
        placeholder = document.getElementById('placeholder');
        groupFilterContainer = document.getElementById('group-filter-container');

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

            const [employees, reportsResult] = await Promise.all([
                fetchEmployees(),
                fetch(url).then(res => res.json())
            ]);

            if (!reportsResult.success) {
                throw new Error(reportsResult.message || '後端回傳一個未知的錯誤');
            }

            allFetchedEmployees = employees;
            allFetchedReports = reportsResult.data;

            renderGroupFilters(employees);
            renderReportsByEmployee(employees, reportsResult.data);

        } catch (error) {
            console.error('載入回報失敗:', error);
            showError(`載入資料失敗：${error.message}`);
        }
    }

    function renderReportsByEmployee(employees, allReports) {
        const selectedGroups = new Set(
            Array.from(groupFilterContainer.querySelectorAll('input[name="group-filter"]:checked'))
                 .map(cb => cb.value)
        );
        const filteredEmployees = employees.filter(emp => selectedGroups.has(emp.group || '未分類'));

        reportsContainer.innerHTML = '';

        if (filteredEmployees.length === 0) {
            showEmpty();
            placeholder.innerHTML = '<p>請至少選擇一個組別以顯示資料。</p>';
            return;
        }

        const reportsByUserId = allReports.reduce((acc, report) => {
            const userId = report.UserID;
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(report);
            return acc;
        }, {});

        filteredEmployees.sort((a, b) => (a.group || '未分類').localeCompare(b.group || '未分類', 'zh-Hant'));

        let lastGroup = null;
        filteredEmployees.forEach(employee => {
            const reports = reportsByUserId[employee.userId] || [];

            if (reports.length === 0) {
                return;
            }

            const card = document.createElement('div');
            card.className = 'bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500';

            let reportsHtml = reports.map(report => {
                const reportTime = new Date(report.Timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                let contentHtml = '';
                let photosHtml = '';
                if (report.PhotoLinks) {
                    const photoUrls = report.PhotoLinks.split(',');
                    // [v581.0 修正] 改為使用自訂的 lazy-loading，設定 data-src 並加上 class="lazy"
                    const imageElements = photoUrls.map((url, index) => `
                        <img data-src="https://drive.google.com/thumbnail?id=${window.extractDriveFileId(url)}&sz=w128" 
                             alt="現場照片" 
                             class="object-cover rounded-md hover:opacity-80 transition-opacity cursor-pointer lazy" 
                             style="width: var(--thumbnail-width, 100%); height: auto;"
                             onclick="openParentLightbox('${report.LogID}', ${index})">`).join('');
                    photosHtml = `<div class="grid gap-2 mt-2" style="grid-template-columns: repeat(auto-fill, minmax(var(--thumbnail-width, 6rem), 1fr));" id="image-group-${report.LogID}" data-photos='${JSON.stringify(photoUrls)}'>
                        ${imageElements}
                    </div>`;
                }

                if (report.Content !== null && typeof report.Content !== 'undefined') {
                    const contentParts = String(report.Content).split('【問題回報】');
                    const workDesc = contentParts[0].replace('【施工內容】', '').trim();
                    const problemDesc = contentParts[1] ? contentParts[1].trim() : '';
                    if (workDesc) {
                        contentHtml += `<p class="text-gray-800 whitespace-pre-wrap pl-2">${workDesc}</p>`;
                    }
                    if (problemDesc) {
                        contentHtml += `<div class="mt-2"><h5 class="font-semibold text-red-600">問題回報：</h5><p class="text-red-800 whitespace-pre-wrap pl-2">${problemDesc}</p></div>`;
                    }
                }

                return `
                    <div class="mt-4 pt-4 border-t border-gray-200">
                        <div class="flex justify-between items-center text-sm flex-wrap gap-2">
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-gray-800">${(report.Title || '無標題').replace(/^(\\d{4})-(\\d{2})-(\\d{2})/, '$1/$2/$3')}</h3>
                                <span class="text-xs font-medium bg-gray-100 text-gray-800 py-0.5 px-2 rounded-full">#${String(report.ProjectName || 'N/A').replace(/^#/, '')}</span>
                            </div>
                            <span class="text-gray-500">${reportTime}</span>
                        </div>
                        <div class="text-sm mt-2">${contentHtml || '<p class="text-gray-500">無文字內容回報。</p>'}</div>
                        ${photosHtml}
                    </div>
                `;
            }).join('');

            card.innerHTML = `
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-bold text-gray-800">${employee.userName}</h2>
                    <span class="text-sm font-medium bg-blue-100 text-blue-800 py-1 px-3 rounded-full">
                        ${reports.length} 則回報
                    </span>
                </div>
                <div class="mt-2">
                    ${reportsHtml}
                </div>
            `;
            reportsContainer.appendChild(card);

            const currentGroup = employee.group || '未分類';
            if (currentGroup !== lastGroup) {
                const groupHeader = document.createElement('h2');
                groupHeader.className = 'text-lg font-bold text-gray-600 mt-8 mb-2 pb-1 border-b-2 border-gray-300';
                groupHeader.textContent = currentGroup;
                reportsContainer.insertBefore(groupHeader, card);
                lastGroup = currentGroup;
            }
        });

        if (reportsContainer.children.length === 0) {
            showEmpty();
        } else {
            // [v581.0 修正] 在所有報告卡片都渲染到 DOM 後，呼叫自訂的圖片延遲載入函式
            lazyLoadImages();
        }
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
window.openParentLightbox = function(logId, startIndex) {
    const imageGroup = document.getElementById(`image-group-${logId}`);
    if (!imageGroup) return;
    const originalUrls = JSON.parse(imageGroup.dataset.photos);

    const largeImageUrls = originalUrls.map(url =>
        `https://drive.google.com/thumbnail?id=${window.extractDriveFileId(url)}&sz=w1920`
    );

    window.parent.postMessage({
        type: 'openLightbox',
        payload: { images: largeImageUrls, index: startIndex }
    }, '*');
}