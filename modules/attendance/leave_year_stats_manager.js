/**
 * 主管 — 員工假勤年度統計（管理模式）
 * API：leave_year_stats / mode=list
 */

function esc(s) {
    if (s == null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDays(v) {
    if (v == null || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function hasQuota(row) {
    const q = Number(row.annualLeaveQuota);
    return Number.isFinite(q) && q > 0;
}

function fmtRemaining(row) {
    if (!hasQuota(row)) return '—';
    const r = row.annualLeaveRemaining;
    if (r == null || r === '') return '—';
    return fmtDays(r);
}

/**
 * @param {{ fetchApi: Function, operatorId: string, permission: number }} opts
 */
export function initLeaveYearStatsManager(opts) {
    const { fetchApi, operatorId, permission } = opts;
    const canView = Number(permission) > 4;

    const yearSelect = document.getElementById('lys-year');
    const searchInput = document.getElementById('lys-search');
    const loadBtn = document.getElementById('lys-load-btn');
    const loadingEl = document.getElementById('lys-loading');
    const errorEl = document.getElementById('lys-error');
    const emptyEl = document.getElementById('lys-empty');
    const tableWrap = document.getElementById('lys-table-wrap');
    const tbody = document.getElementById('lys-tbody');
    const deniedEl = document.getElementById('lys-denied');
    const contentEl = document.getElementById('lys-content');
    const metaEl = document.getElementById('lys-meta');

    let rows = [];
    let sortKey = 'employeeName';
    let sortDir = 'asc';
    let loadedOnce = false;
    let loading = false;

    function fillYears() {
        if (!yearSelect) return;
        const nowY = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let y = nowY; y >= nowY - 4; y--) {
            const opt = document.createElement('option');
            opt.value = String(y);
            opt.textContent = `${y} 年`;
            if (y === nowY) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    function setState(state) {
        if (loadingEl) loadingEl.classList.toggle('hidden', state !== 'loading');
        if (errorEl) errorEl.classList.toggle('hidden', state !== 'error');
        if (emptyEl) emptyEl.classList.toggle('hidden', state !== 'empty');
        if (tableWrap) tableWrap.classList.toggle('hidden', state !== 'table');
    }

    function showDenied() {
        if (deniedEl) deniedEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');
    }

    function showContent() {
        if (deniedEl) deniedEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
    }

    function filteredRows() {
        const q = (searchInput?.value || '').trim().toLowerCase();
        let list = rows.slice();
        if (q) {
            list = list.filter((r) => {
                const name = String(r.employeeName || '').toLowerCase();
                const group = String(r.employeeGroup || '').toLowerCase();
                return name.includes(q) || group.includes(q);
            });
        }
        list.sort((a, b) => {
            let av = a[sortKey];
            let bv = b[sortKey];
            if (sortKey === 'annualLeaveRemaining') {
                av = hasQuota(a) ? Number(a.annualLeaveRemaining) : Infinity;
                bv = hasQuota(b) ? Number(b.annualLeaveRemaining) : Infinity;
            } else if (['annualLeaveDays', 'sickLeaveDays', 'personalLeaveDays', 'annualLeaveQuota'].includes(sortKey)) {
                av = Number(av) || 0;
                bv = Number(bv) || 0;
            } else {
                av = String(av ?? '');
                bv = String(bv ?? '');
                const cmp = av.localeCompare(bv, 'zh-Hant');
                return sortDir === 'asc' ? cmp : -cmp;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return String(a.employeeName || '').localeCompare(String(b.employeeName || ''), 'zh-Hant');
        });
        return list;
    }

    function usedClass(row) {
        const used = Number(row.annualLeaveDays) || 0;
        if (hasQuota(row)) {
            const q = Number(row.annualLeaveQuota);
            if (q > 0 && used / q >= 0.8) return 'text-amber-700 font-semibold';
        }
        if (used >= 10) return 'text-amber-700 font-semibold';
        return 'text-gray-800';
    }

    function remainingClass(row) {
        if (!hasQuota(row)) return 'text-gray-400';
        const rem = Number(row.annualLeaveRemaining);
        if (!Number.isFinite(rem)) return 'text-gray-400';
        if (rem <= 1) return 'text-red-600 font-semibold';
        if (rem <= 3) return 'text-amber-600 font-semibold';
        return 'text-emerald-700';
    }

    function usedDot(row) {
        const used = Number(row.annualLeaveDays) || 0;
        let cls = 'bg-gray-300';
        if (hasQuota(row)) {
            const q = Number(row.annualLeaveQuota);
            if (q > 0 && used / q >= 0.8) cls = 'bg-amber-500';
            else if (used > 0) cls = 'bg-blue-400';
        } else if (used >= 10) {
            cls = 'bg-amber-500';
        } else if (used > 0) {
            cls = 'bg-blue-400';
        }
        return `<span class="inline-block w-2 h-2 rounded-full ${cls} mr-1.5 flex-shrink-0" aria-hidden="true"></span>`;
    }

    function updateSortIndicators() {
        document.querySelectorAll('[data-lys-sort]').forEach((th) => {
            const key = th.getAttribute('data-lys-sort');
            const mark = th.querySelector('.lys-sort-mark');
            if (!mark) return;
            if (key === sortKey) {
                mark.textContent = sortDir === 'asc' ? ' ↑' : ' ↓';
                th.classList.add('text-blue-700');
            } else {
                mark.textContent = '';
                th.classList.remove('text-blue-700');
            }
        });
    }

    function renderTable() {
        const list = filteredRows();
        updateSortIndicators();
        if (!list.length) {
            setState(rows.length ? 'empty' : 'empty');
            if (emptyEl) {
                emptyEl.innerHTML = rows.length
                    ? '<p class="font-medium text-gray-700">找不到符合的姓名</p><p class="text-sm text-gray-500 mt-1">請清空搜尋或換關鍵字再試。</p>'
                    : '<p class="font-medium text-gray-700">這一年還沒有假勤統計資料</p><p class="text-sm text-gray-500 mt-1">可能尚無已核准假單，或後端尚未產生年度彙總。可換一年再查。</p>';
            }
            if (metaEl) metaEl.textContent = '';
            return;
        }
        setState('table');
        if (metaEl) {
            metaEl.textContent = `共 ${list.length} 人${rows.length !== list.length ? `（篩選自 ${rows.length} 人）` : ''}`;
        }
        tbody.innerHTML = list.map((row) => {
            const group = esc(row.employeeGroup || '未分組');
            const name = esc(row.employeeName || row.employeeUserId || '—');
            return `<tr class="border-t border-gray-100 hover:bg-blue-50/40">
                <td class="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">${group}</td>
                <td class="px-3 py-2.5 font-medium text-gray-900 sticky left-0 bg-white z-[1] whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">${name}</td>
                <td class="px-3 py-2.5 text-center tabular-nums ${usedClass(row)}">
                    <span class="inline-flex items-center justify-center">${usedDot(row)}${esc(fmtDays(row.annualLeaveDays))}</span>
                </td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-800">${esc(fmtDays(row.sickLeaveDays))}</td>
                <td class="px-3 py-2.5 text-center tabular-nums text-gray-800">${esc(fmtDays(row.personalLeaveDays))}</td>
                <td class="px-3 py-2.5 text-center tabular-nums ${remainingClass(row)}">${esc(fmtRemaining(row))}</td>
            </tr>`;
        }).join('');
    }

    async function load() {
        if (!canView) {
            showDenied();
            return;
        }
        showContent();
        if (loading) return;
        loading = true;
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.textContent = '載入中…';
        }
        setState('loading');
        if (errorEl) errorEl.innerHTML = '';
        if (metaEl) metaEl.textContent = '';
        const year = parseInt(yearSelect?.value || String(new Date().getFullYear()), 10);
        try {
            const res = await fetchApi({
                page: 'attendance_api',
                action: 'leave_year_stats',
                mode: 'list',
                year,
                operatorId
            });
            if (!res || res.success === false) {
                throw new Error(res?.message || '無法取得假勤年度統計');
            }
            const data = res.data;
            const list = Array.isArray(data?.rows)
                ? data.rows
                : (Array.isArray(data) ? data : []);
            rows = list;
            loadedOnce = true;
            if (!rows.length) {
                setState('empty');
                if (emptyEl) {
                    emptyEl.innerHTML = '<p class="font-medium text-gray-700">這一年還沒有假勤統計資料</p><p class="text-sm text-gray-500 mt-1">可能尚無已核准假單，或後端尚未產生年度彙總。可換一年再查。</p>';
                }
            } else {
                renderTable();
            }
        } catch (err) {
            rows = [];
            setState('error');
            const msg = err?.message || '載入失敗';
            const isUnknownAction = /unknown|未知|不支援|not support|invalid action|找不到/i.test(msg);
            if (errorEl) {
                errorEl.innerHTML = `
                    <p class="font-medium">載入失敗</p>
                    <p class="mt-1 text-sm">${esc(msg)}</p>
                    <p class="mt-2 text-sm text-gray-600">${isUnknownAction
                        ? '後端可能尚未啟用「假勤年度統計」介面。請稍後再試，或請管理者確認後端已上線。'
                        : '請檢查網路後按「重新載入」再試一次。'}</p>`;
            }
        } finally {
            loading = false;
            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = '重新載入';
            }
        }
    }

    function onSortClick(e) {
        const th = e.target.closest('[data-lys-sort]');
        if (!th) return;
        const key = th.getAttribute('data-lys-sort');
        if (!key) return;
        if (sortKey === key) {
            sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
            sortKey = key;
            sortDir = key === 'employeeName' || key === 'employeeGroup' ? 'asc' : 'desc';
        }
        renderTable();
    }

    fillYears();

    if (!canView) {
        showDenied();
    } else {
        showContent();
        setState('empty');
        if (emptyEl) {
            emptyEl.innerHTML = '<p class="font-medium text-gray-700">請選擇年度後載入</p><p class="text-sm text-gray-500 mt-1">預設為今年；按「載入」查看全員假勤統計。</p>';
        }
    }

    loadBtn?.addEventListener('click', () => load());
    yearSelect?.addEventListener('change', () => {
        if (loadedOnce) load();
    });
    searchInput?.addEventListener('input', () => {
        if (rows.length || loadedOnce) renderTable();
    });
    document.getElementById('lys-thead')?.addEventListener('click', onSortClick);

    return {
        canView,
        loadIfNeeded() {
            if (!canView) {
                showDenied();
                return;
            }
            if (!loadedOnce && !loading) load();
        },
        reload: load
    };
}
