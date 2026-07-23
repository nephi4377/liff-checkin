/**
 * 個人 — 假勤年度統計（曆年 1/1～12/31）
 * API：leave_year_stats / mode=mine|refresh
 */

function esc(s) {
    if (s == null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDays(v, digits = 1) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(digits);
}

function hasQuota(row) {
    const q = Number(row.annualLeaveQuota);
    return Number.isFinite(q);
}

function fmtRemaining(row) {
    if (!hasQuota(row)) return null;
    const r = row.annualLeaveRemaining;
    if (r == null || r === '') return '—';
    return fmtDays(r);
}

const YEAR_END_LABELS = {
    carry_over: '保留至次年 12/31',
    salary: '折現（次年 1 月發薪）',
    carryover: '保留至次年 12/31',
    cashout: '折現（次年 1 月發薪）',
    pending: '尚未處理'
};

function fmtMoney(n) {
    if (n == null || n === '') return null;
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return `${v.toLocaleString('zh-TW')} 元`;
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

/**
 * @param {{ fetchApi: Function, operatorId: string, onGoLeaveTab?: Function }} opts
 */
export function initLeaveYearStatsPanel(opts) {
    const { fetchApi, operatorId, onGoLeaveTab } = opts;

    const yearSelect = document.getElementById('lysp-year');
    const refreshBtn = document.getElementById('lysp-refresh-btn');
    const goLeaveBtn = document.getElementById('lysp-go-leave-btn');
    const loadingEl = document.getElementById('lysp-loading');
    const errorEl = document.getElementById('lysp-error');
    const emptyEl = document.getElementById('lysp-empty');
    const contentEl = document.getElementById('lysp-content');
    const metaEl = document.getElementById('lysp-meta');
    const cardsEl = document.getElementById('lysp-summary-cards');
    const annualEl = document.getElementById('lysp-annual-block');
    const detailsEl = document.getElementById('lysp-annual-details');
    const monthlyEl = document.getElementById('lysp-monthly');
    const dispositionEl = document.getElementById('lysp-disposition');

    let currentRow = null;
    let availableYears = [];
    let loadedOnce = false;
    let loading = false;

    function setState(state) {
        if (loadingEl) loadingEl.classList.toggle('hidden', state !== 'loading');
        if (errorEl) errorEl.classList.toggle('hidden', state !== 'error');
        if (emptyEl) emptyEl.classList.toggle('hidden', state !== 'empty');
        if (contentEl) contentEl.classList.toggle('hidden', state !== 'content');
    }

    function fillYearSelect(years, selectedYear) {
        if (!yearSelect) return;
        const list = Array.isArray(years) && years.length ? years.slice() : [selectedYear || new Date().getFullYear()];
        yearSelect.innerHTML = '';
        list.forEach((y) => {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = `${y} 年`;
            if (y === selectedYear) opt.selected = true;
            yearSelect.appendChild(opt);
        });
        if (!list.length) {
            const nowY = new Date().getFullYear();
            const opt = document.createElement('option');
            opt.value = String(nowY);
            opt.textContent = `${nowY} 年`;
            yearSelect.appendChild(opt);
        }
    }

    function formatUpdatedAt(iso) {
        if (!iso) return '尚無更新紀錄';
        try {
            const d = new Date(iso);
            const str = d.toLocaleString('zh-TW', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
            const ageH = (Date.now() - d.getTime()) / 3600000;
            const stale = ageH > 24 ? '（建議重新整理）' : '';
            return `統計更新至 ${str}${stale}`;
        } catch (e) {
            return `統計更新至 ${iso}`;
        }
    }

    function renderSummaryCards(row) {
        if (!cardsEl) return;
        const items = [
            { label: '特休已用', value: fmtDays(row.annualLeaveDays), cls: 'text-blue-700' },
            { label: '病假', value: fmtDays(row.sickLeaveDays), cls: 'text-rose-700' },
            { label: '事假', value: fmtDays(row.personalLeaveDays), cls: 'text-gray-800' },
            { label: '補休', value: fmtDays(row.compensatoryDays), cls: 'text-teal-700' },
            { label: '加班', value: fmtDays(row.overtimeDays), cls: 'text-indigo-700' },
            { label: '出勤天', value: fmtDays(row.checkInDays, 0), cls: 'text-emerald-700' },
            { label: '缺勤', value: fmtDays(row.absentDays), cls: 'text-red-700' },
            { label: '遲到', value: `${fmtDays(row.lateMinutes, 0)} 分`, cls: 'text-amber-700' },
            { label: '早退', value: `${fmtDays(row.earlyMinutes, 0)} 分`, cls: 'text-amber-700' }
        ];
        cardsEl.innerHTML = items.map((it) => `
            <div class="summary-card bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <p class="text-xs text-gray-500 mb-1">${esc(it.label)}</p>
                <p class="text-xl font-bold tabular-nums ${it.cls}">${esc(it.value)}</p>
            </div>`).join('');
    }

    function renderAnnualBlock(row) {
        if (!annualEl) return;
        const used = fmtDays(row.annualLeaveDays);
        if (!hasQuota(row)) {
            annualEl.innerHTML = `
                <div class="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p class="text-sm text-blue-900"><span class="font-semibold">今年已休特休 ${esc(used)} 天</span></p>
                    <p class="text-xs text-blue-700 mt-1">尚無特休給額資料（可能未到職日未填或人事未設定覆寫），僅顯示已用天數。</p>
                </div>`;
            return;
        }
        const quota = fmtDays(row.annualLeaveQuota);
        const rem = fmtRemaining(row);
        const remCls = Number(row.annualLeaveRemaining) <= 1 ? 'text-red-600' : 'text-emerald-700';
        annualEl.innerHTML = `
            <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><p class="text-xs text-gray-500">年度給額</p><p class="text-lg font-bold tabular-nums">${esc(quota)} 天</p></div>
                <div><p class="text-xs text-gray-500">已用</p><p class="text-lg font-bold tabular-nums text-blue-700">${esc(used)} 天</p></div>
                <div><p class="text-xs text-gray-500">剩餘</p><p class="text-lg font-bold tabular-nums ${remCls}">${esc(rem)} 天</p></div>
            </div>
            <p class="text-xs text-gray-500 mt-2">特休建議於 3 個工作天前申請（內規 V7.0）；本頁僅供查詢統計。</p>`;
    }

    function renderAnnualDetails(row) {
        if (!detailsEl) return;
        const list = Array.isArray(row.annualLeaveDetails) ? row.annualLeaveDetails : [];
        if (!list.length) {
            detailsEl.innerHTML = `
                <p class="text-sm text-gray-500 py-3">今年尚無已核准特休紀錄。</p>
                <button type="button" id="lysp-details-go-leave" class="text-sm text-blue-700 hover:underline">前往假勤紀錄 →</button>`;
            document.getElementById('lysp-details-go-leave')?.addEventListener('click', () => onGoLeaveTab?.());
            return;
        }
        const rows = list.map((item) => {
            const range = item.endDate && item.endDate !== item.date
                ? `${esc(item.date)} ～ ${esc(item.endDate)}`
                : esc(item.date);
            const src = item.source === 'leave_request' ? '假單' : '班表';
            return `<tr class="border-t border-gray-100">
                <td class="px-3 py-2 text-sm whitespace-nowrap">${range}</td>
                <td class="px-3 py-2 text-sm text-center tabular-nums">${esc(fmtDays(item.days))}</td>
                <td class="px-3 py-2 text-xs"><span class="inline-block px-2 py-0.5 rounded-full bg-green-100 text-green-800">${esc(item.status || '已核准')}</span></td>
                <td class="px-3 py-2 text-xs text-gray-500">${esc(src)}</td>
                <td class="px-3 py-2 text-xs text-gray-600 max-w-[12rem] truncate" title="${esc(item.reason || '')}">${esc(item.reason || '—')}</td>
            </tr>`;
        }).join('');
        detailsEl.innerHTML = `
            <div class="overflow-x-auto border border-gray-100 rounded-xl">
                <table class="min-w-full text-left">
                    <thead class="bg-gray-50 text-xs text-gray-600">
                        <tr>
                            <th class="px-3 py-2 font-semibold">日期</th>
                            <th class="px-3 py-2 font-semibold text-center">天數</th>
                            <th class="px-3 py-2 font-semibold">狀態</th>
                            <th class="px-3 py-2 font-semibold">來源</th>
                            <th class="px-3 py-2 font-semibold">事由</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <p class="text-xs text-gray-500 mt-2">每筆特休對應已核准假單或班表紀錄；完整申請歷程請見「假勤紀錄」分頁。</p>`;
    }

    function renderMonthly(row) {
        if (!monthlyEl) return;
        const monthly = row.monthly && typeof row.monthly === 'object' ? row.monthly : {};
        const keys = Object.keys(monthly).sort();
        if (!keys.length) {
            monthlyEl.innerHTML = '<p class="text-sm text-gray-500">尚無各月小計資料。</p>';
            return;
        }
        monthlyEl.innerHTML = keys.map((key, idx) => {
            const m = monthly[key] || {};
            const monthNum = parseInt(key.split('-')[1], 10);
            const label = MONTH_NAMES[monthNum - 1] || key;
            const hasData = ['annualLeave', 'sickLeave', 'personalLeave', 'compensatoryLeave', 'overtimeDays', 'checkInDays']
                .some((f) => Number(m[f]) > 0) || Number(m.lateMinutes) > 0 || Number(m.earlyMinutes) > 0;
            if (!hasData) return '';
            return `
                <details class="border border-gray-100 rounded-lg bg-white" ${idx === keys.length - 1 ? 'open' : ''}>
                    <summary class="px-4 py-3 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">${esc(label)}</summary>
                    <div class="px-4 pb-3 text-sm grid grid-cols-2 sm:grid-cols-3 gap-2 text-gray-700">
                        <span>特休 ${esc(fmtDays(m.annualLeave))}</span>
                        <span>病假 ${esc(fmtDays(m.sickLeave))}</span>
                        <span>事假 ${esc(fmtDays(m.personalLeave))}</span>
                        <span>補休 ${esc(fmtDays(m.compensatoryLeave))}</span>
                        <span>加班 ${esc(fmtDays(m.overtimeDays))}</span>
                        <span>出勤 ${esc(fmtDays(m.checkInDays, 0))} 天</span>
                        <span>缺勤 ${esc(fmtDays(m.absentDays))}</span>
                        <span>遲到 ${esc(fmtDays(m.lateMinutes, 0))} 分</span>
                        <span>早退 ${esc(fmtDays(m.earlyMinutes, 0))} 分</span>
                    </div>
                </details>`;
        }).filter(Boolean).join('') || '<p class="text-sm text-gray-500">各月皆無假勤或出勤紀錄。</p>';
    }

    function renderDisposition(row) {
        if (!dispositionEl) return;
        const disp = row.disposition || row.yearEndDisposition || '';
        const unused = row.unusedAnnualLeaveDays;
        const preview = fmtMoney(row.cashoutAmountPreview ?? row.cashoutAmount);
        const dailyWage = fmtMoney(row.dailyWage);
        const unusedLine = unused != null && Number(unused) > 0
            ? `<p class="text-sm text-gray-700 mt-2">目前未休特休：<span class="font-semibold tabular-nums">${esc(fmtDays(unused))} 天</span></p>`
            : '';
        const previewLine = preview && unused != null && Number(unused) > 0
            ? `<p class="text-xs text-gray-600 mt-1">折現試算（依薪資系統日薪公式）：約 <span class="font-semibold tabular-nums">${esc(preview)}</span>${dailyWage ? `（日薪 ${esc(dailyWage)}）` : ''}。實際金額以人事登錄與發薪為準。</p>`
            : '';
        const carryLine = row.carryoverDays != null && Number(row.carryoverDays) > 0
            ? `<p class="text-xs text-gray-600 mt-1">保留天數：${esc(fmtDays(row.carryoverDays))} 天</p>`
            : '';

        if (!disp) {
            dispositionEl.innerHTML = `
                <p class="text-sm text-gray-600">年底未休特休處置：<span class="font-medium">尚未登錄</span></p>
                ${unusedLine}
                ${previewLine}
                <p class="text-xs text-gray-500 mt-1">依內規 V7.0：若未於 12/15 前申請保留，未休天數將於次年 1 月折現發放。人事將於年底登錄處置結果。</p>`;
            return;
        }
        const label = YEAR_END_LABELS[disp] || disp;
        const days = row.yearEndDispositionDays != null
            ? `（${fmtDays(row.yearEndDispositionDays)} 天）`
            : (unused != null ? `（${fmtDays(unused)} 天）` : '');
        const cashLine = (disp === 'cashout' || disp === 'salary') && preview
            ? `<p class="text-sm text-gray-700 mt-1">折現金額試算：約 <span class="font-semibold tabular-nums">${esc(preview)}</span></p>`
            : '';
        const note = row.yearEndDispositionNote ? `<p class="text-xs text-gray-500 mt-1">${esc(row.yearEndDispositionNote)}</p>` : '';
        dispositionEl.innerHTML = `
            <p class="text-sm text-gray-700">年底處置：<span class="font-semibold text-gray-900">${esc(label)}${esc(days)}</span></p>
            ${cashLine}
            ${carryLine}
            ${note}
            <p class="text-xs text-gray-500 mt-2">試算僅供參考；正式發放以人事與薪資結算為準。</p>`;
    }

    function renderAll(row, lastUpdatedAt) {
        currentRow = row;
        setState('content');
        if (metaEl) metaEl.textContent = formatUpdatedAt(lastUpdatedAt);
        renderSummaryCards(row);
        renderAnnualBlock(row);
        renderAnnualDetails(row);
        renderMonthly(row);
        renderDisposition(row);
    }

    async function load(mode = 'mine') {
        if (loading) return;
        loading = true;
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = mode === 'refresh' ? '重新計算中…' : '載入中…';
        }
        setState('loading');
        if (errorEl) errorEl.innerHTML = '';

        const year = parseInt(yearSelect?.value || String(new Date().getFullYear()), 10);
        try {
            const res = await fetchApi({
                page: 'attendance_api',
                action: 'leave_year_stats',
                mode: mode,
                year,
                operatorId
            });
            if (!res || res.success === false) {
                throw new Error(res?.message || '無法取得年度統計');
            }
            const data = res.data || {};
            availableYears = Array.isArray(data.availableYears) ? data.availableYears : availableYears;
            if (availableYears.length) {
                fillYearSelect(availableYears, data.year || year);
            }
            const row = data.row;
            if (!row) {
                setState('empty');
                if (emptyEl) {
                    emptyEl.innerHTML = '<p class="font-medium text-gray-700">這一年還沒有統計資料</p><p class="text-sm text-gray-500 mt-1">請按「重新整理」產生統計，或確認該年度是否有已核准假勤。</p>';
                }
                loadedOnce = true;
                return;
            }
            renderAll(row, data.lastUpdatedAt);
            loadedOnce = true;
        } catch (err) {
            setState('error');
            const msg = err?.message || '載入失敗';
            if (errorEl) {
                errorEl.innerHTML = `
                    <p class="font-medium">載入失敗</p>
                    <p class="mt-1 text-sm">${esc(msg)}</p>
                    <p class="mt-2 text-sm text-gray-600">請檢查網路後再試；若後端尚未部署新版 API，請聯絡管理者。</p>`;
            }
        } finally {
            loading = false;
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '重新整理統計';
            }
        }
    }

    const nowY = new Date().getFullYear();
    fillYearSelect([nowY], nowY);
    setState('empty');
    if (emptyEl) {
        emptyEl.innerHTML = '<p class="font-medium text-gray-700">請選擇年度後載入</p><p class="text-sm text-gray-500 mt-1">統計範圍為曆年 1/1～12/31；僅顯示已有快取紀錄的年度。</p>';
    }

    refreshBtn?.addEventListener('click', () => load('refresh'));
    yearSelect?.addEventListener('change', () => { if (loadedOnce) load('mine'); });
    goLeaveBtn?.addEventListener('click', () => onGoLeaveTab?.());

    return {
        loadIfNeeded() {
            if (!loadedOnce && !loading) load('mine');
        },
        reload: () => load('refresh'),
        goToLeaveTab: () => onGoLeaveTab?.()
    };
}
