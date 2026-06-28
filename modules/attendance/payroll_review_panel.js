/**
 * 個人頁 — 薪資出勤核對申請（Phase B1）
 */
export function initPayrollReviewPanel(ctx) {
    const {
        apiBaseUrl, userId, userName, showGlobalNotification
    } = ctx;

    const els = {
        periodSelect: document.getElementById('payroll-period-select'),
        hint: document.getElementById('payroll-period-hint'),
        loading: document.getElementById('payroll-loading'),
        formWrap: document.getElementById('payroll-form-wrap'),
        error: document.getElementById('payroll-error'),
        statsBox: document.getElementById('payroll-stats-box'),
        monthlyRest: document.getElementById('payroll-monthly-rest'),
        dailyDays: document.getElementById('payroll-daily-days'),
        calcBox: document.getElementById('payroll-calc-box'),
        overtimeHours: document.getElementById('payroll-overtime-hours'),
        overtimeNote: document.getElementById('payroll-overtime-note'),
        remoteAmount: document.getElementById('payroll-remote-amount'),
        remoteNote: document.getElementById('payroll-remote-note'),
        supplement: document.getElementById('payroll-supplement'),
        statusBox: document.getElementById('payroll-status-box'),
        submitBtn: document.getElementById('payroll-submit-btn'),
        refreshBtn: document.getElementById('payroll-refresh-btn')
    };

    if (!els.periodSelect) return;

    let contextData = null;
    let payrollLoaded = false;

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function fetchContext(periodLabel) {
        els.loading.classList.remove('hidden');
        els.formWrap.classList.add('hidden');
        els.error.classList.add('hidden');
        try {
            const url = new URL(apiBaseUrl);
            url.searchParams.append('page', 'attendance_api');
            url.searchParams.append('action', 'payroll_review');
            url.searchParams.append('mode', 'context');
            url.searchParams.append('operatorId', userId);
            if (periodLabel) url.searchParams.append('periodLabel', periodLabel);
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) throw new Error(json.message || '載入失敗');
            contextData = json.data;
            renderContext();
        } catch (err) {
            els.error.textContent = err.message;
            els.error.classList.remove('hidden');
        } finally {
            els.loading.classList.add('hidden');
        }
    }

    function renderContext() {
        if (!contextData) return;
        const { settings, period, periods, snapshot, existingReview, disclaimer } = contextData;
        els.periodSelect.innerHTML = periods.map((p) =>
            `<option value="${esc(p.periodLabel)}" ${p.periodLabel === period.periodLabel ? 'selected' : ''}>${esc(p.periodLabel)}（${esc(p.periodStart)}～${esc(p.periodEnd)}）</option>`
        ).join('');
        els.hint.textContent = period.submitHint || '';

        const st = snapshot.stats || {};
        const isDaily = period.payType === 'daily';
        els.monthlyRest.classList.toggle('hidden', isDaily);
        els.dailyDays.classList.toggle('hidden', !isDaily);

        let statsHtml = '';
        if (isDaily) {
            statsHtml = `<p><strong>本期出勤：</strong>${snapshot.daysWorked || 0} 天</p>`;
            document.getElementById('payroll-days-worked-val').textContent = snapshot.daysWorked || 0;
        } else {
            statsHtml = `
                <p><strong>標準工作日：</strong>${st.workDays ?? '—'} 天</p>
                <p><strong>實際出勤：</strong>${st.checkInDays ?? st.attended ?? '—'} 天</p>
                <p><strong>應休（系統）：</strong>${snapshot.rest?.scheduledRestDays ?? '—'} 天</p>
                <p><strong>實休（系統）：</strong>${fmtDay(snapshot.rest?.actualRestDays)} 天</p>
                <p><strong>特休／病假／事假：</strong>${fmtDay(st.annualLeave)}／${fmtDay(st.sickLeave)}／${fmtDay(st.personalLeave)}</p>
                <p><strong>遲到／早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                <p><strong>缺勤／異常：</strong>${fmtDay(st.absent)}／${st.anomalyDays ?? 0} 天</p>
            `;
        }
        els.statsBox.innerHTML = statsHtml;

        const preview = calcPreview(settings, period.payType, snapshot, {
            remoteAllowanceAmount: Number(els.remoteAmount.value) || 0,
            overtimeHours: Number(els.overtimeHours.value) || 0
        });
        els.calcBox.innerHTML = `
            <p class="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-2">${esc(disclaimer)}</p>
            <p><strong>薪資類型：</strong>${isDaily ? '日薪' : '月薪'}（${esc(settings.payRule)}）</p>
            <p><strong>底薪${isDaily ? '（日）' : ''}：</strong>${settings.baseSalary.toLocaleString()} 元</p>
            <p><strong>預估本薪：</strong>${preview.baseSalary.toLocaleString()} 元</p>
            <p id="payroll-full-att-row" class="${isDaily ? 'hidden' : ''}"><strong>預估全勤：</strong>${preview.fullAttendanceBonus.toLocaleString()} 元</p>
            <p><strong>預估加班費：</strong>${preview.overtimePay.toLocaleString()} 元</p>
            <p id="payroll-remote-row"><strong>遠程津貼：</strong>${(Number(els.remoteAmount.value) || 0).toLocaleString()} 元</p>
            <p class="text-lg font-bold text-indigo-700 mt-2"><strong>預估實發：</strong>${preview.estimatedNet.toLocaleString()} 元</p>
        `;

        if (existingReview) {
            els.statusBox.innerHTML = `<p class="text-amber-800 bg-amber-50 rounded p-2">此期別已有「${esc(existingReview.status)}」申請（${esc(existingReview.submitTime?.slice(0, 10) || '')}）</p>`;
            els.submitBtn.disabled = true;
        } else {
            els.statusBox.innerHTML = '';
            els.submitBtn.disabled = false;
        }
        els.formWrap.classList.remove('hidden');
    }

    function fmtDay(v) {
        if (v == null || v === '') return '—';
        const n = Number(v);
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
    }

    function calcPreview(settings, payType, snapshot, input) {
        const base = Number(settings.baseSalary) || 0;
        const remote = Number(input.remoteAllowanceAmount) || 0;
        const st = snapshot.stats || {};
        let earnedBase = base;
        let fullAttendanceBonus = 0;
        if (payType === 'daily') {
            earnedBase = base * (Number(snapshot.daysWorked) || 0);
        } else if ((st.anomalyDays || 0) === 0 && (st.absent || 0) === 0) {
            fullAttendanceBonus = Number(settings.fullAttendanceBonusMax) || 2000;
        }
        const overtimeHours = Number(input.overtimeHours) || 0;
        let overtimePay = 0;
        if (overtimeHours > 0 && base > 0) {
            const hourly = payType === 'daily' ? base / 8 : base / 30 / 8;
            overtimePay = Math.round(hourly * 1.34 * overtimeHours);
        }
        const estimatedNet = Math.round(earnedBase + fullAttendanceBonus + remote + overtimePay);
        return { baseSalary: earnedBase, fullAttendanceBonus, overtimePay, estimatedNet };
    }

    async function submitReview() {
        if (!contextData?.period) return;
        const remoteAmt = Number(els.remoteAmount.value) || 0;
        const remoteNote = els.remoteNote.value.trim();
        if (remoteAmt > 0 && !remoteNote) {
            alert('填寫遠程津貼時，請一併填寫說明');
            return;
        }
        els.submitBtn.disabled = true;
        els.submitBtn.textContent = '送出中…';
        try {
            const payload = {
                action: 'payroll_review', op: 'submit',
                operatorId: userId, userName,
                periodLabel: contextData.period.periodLabel,
                overtimeHours: Number(els.overtimeHours.value) || 0,
                overtimeNote: els.overtimeNote.value.trim(),
                remoteAllowanceAmount: Number(els.remoteAmount.value) || 0,
                remoteAllowanceNote: els.remoteNote.value.trim(),
                supplementNote: els.supplement.value.trim()
            };
            const res = await fetch(apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || '送出失敗');
            showGlobalNotification(json.message || '已送出', 5000, 'success');
            await fetchContext(contextData.period.periodLabel);
        } catch (err) {
            alert(`送出失敗：${err.message}`);
            els.submitBtn.disabled = false;
        } finally {
            els.submitBtn.textContent = '送出薪資核對申請';
        }
    }

    els.periodSelect.addEventListener('change', () => fetchContext(els.periodSelect.value));
    els.refreshBtn.addEventListener('click', () => fetchContext(els.periodSelect.value));
    els.submitBtn.addEventListener('click', submitReview);
    ['input', 'change'].forEach((ev) => {
        els.overtimeHours.addEventListener(ev, () => { if (contextData) renderContext(); });
        els.remoteAmount.addEventListener(ev, () => { if (contextData) renderContext(); });
    });

    return {
        loadIfNeeded() {
            if (payrollLoaded) return;
            payrollLoaded = true;
            fetchContext();
        }
    };
}

export function initPayrollReviewApproval(ctx) {
    const { apiBaseUrl, userProfile, showGlobalNotification, permission } = ctx;
    if (Number(permission) < 5) return null;

    const container = document.getElementById('payroll-reviews-container');
    if (!container) return null;

    function esc(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    async function fetchPending() {
        try {
            const url = new URL(apiBaseUrl);
            url.searchParams.append('page', 'attendance_api');
            url.searchParams.append('action', 'payroll_review');
            url.searchParams.append('mode', 'pending');
            url.searchParams.append('operatorId', userProfile.userId);
            const res = await fetch(url);
            const json = await res.json();
            container.innerHTML = '';
            document.getElementById('no-payroll-message')?.classList.add('hidden');
            if (json.success && json.data.length) {
                json.data.forEach((row) => container.appendChild(createCard(row)));
            } else if (json.success) {
                document.getElementById('no-payroll-message')?.classList.remove('hidden');
            } else {
                container.innerHTML = `<p class="text-red-500 text-center py-8">${esc(json.message)}</p>`;
            }
        } catch (err) {
            container.innerHTML = `<p class="text-red-500 text-center py-8">${esc(err.message)}</p>`;
        }
    }

    function createCard(row) {
        const card = document.createElement('div');
        card.id = `payroll-${row.reviewId}`;
        card.className = 'request-card bg-white p-5 rounded-lg shadow-md border-l-4 border-indigo-400';
        const isDaily = row.payType === 'daily';
        let snap = {};
        try { snap = JSON.parse(row.statsSnapshot); } catch (e) { /* ignore */ }
        const st = snap.stats || {};
        card.innerHTML = `
            <div class="flex justify-between gap-2">
                <div>
                    <h3 class="text-lg font-bold">${esc(row.employeeName)} · ${esc(row.periodLabel)}</h3>
                    <p class="text-sm text-gray-500">${isDaily ? '日薪' : '月薪'} · ${esc(row.periodStart)}～${esc(row.periodEnd)} · 發薪 ${esc(row.payDate)}</p>
                </div>
                <span class="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">${esc(row.status)}</span>
            </div>
            <div class="mt-3 text-sm space-y-1">
                ${isDaily
                    ? `<p><strong>出勤：</strong>${row.daysWorked} 天</p>`
                    : `<p><strong>出勤／應休／實休：</strong>${st.checkInDays ?? '—'}／${row.scheduledRestDays}／${row.actualRestDays}</p>
                       <p><strong>遲早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分 · 異常 ${st.anomalyDays ?? 0} 天</p>`}
                <p><strong>預估本薪／全勤：</strong>${Number(row.baseSalary).toLocaleString()}／${Number(row.fullAttendanceBonus).toLocaleString()} 元</p>
                <p><strong>遠程津貼：</strong>${Number(row.remoteAllowanceAmount).toLocaleString()} 元 ${row.remoteAllowanceNote ? `（${esc(row.remoteAllowanceNote)}）` : ''}</p>
                <p><strong>加班：</strong>${row.overtimeHours} 小時 ${row.overtimeNote ? `— ${esc(row.overtimeNote)}` : ''}</p>
                <p><strong>補充：</strong>${esc(row.supplementNote || '—')}</p>
                <p class="font-bold text-indigo-700">員工端預估實發：${Number(row.estimatedNet).toLocaleString()} 元</p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
                <label class="text-xs">全勤獎金<input type="number" id="pr-full-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="${row.fullAttendanceBonus}"></label>
                <label class="text-xs">獎金<input type="number" id="pr-bonus-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="0"></label>
                <label class="text-xs col-span-2">獎金事由<input type="text" id="pr-bonus-reason-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" placeholder="主管填入"></label>
                <label class="text-xs">扣款<input type="number" id="pr-ded-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="${row.deduction || 0}"></label>
                <label class="text-xs col-span-2">審核備註<input type="text" id="pr-note-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" placeholder="駁回時必填"></label>
            </div>
            <div class="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" data-pr-decision="reject" data-pr-id="${row.reviewId}" class="px-3 py-2 text-sm font-bold text-white bg-red-500 rounded-md">駁回</button>
                <button type="button" data-pr-decision="return" data-pr-id="${row.reviewId}" class="px-3 py-2 text-sm font-bold text-white bg-gray-500 rounded-md">退回</button>
                <button type="button" data-pr-decision="approve" data-pr-id="${row.reviewId}" class="px-3 py-2 text-sm font-bold text-white bg-green-600 rounded-md">通過</button>
            </div>
        `;
        return card;
    }

    async function resolve(decision, reviewId) {
        const note = document.getElementById(`pr-note-${reviewId}`)?.value.trim() || '';
        if (decision === 'reject' && !note) {
            alert('駁回時請填寫審核備註');
            return;
        }
        const payload = {
            action: 'payroll_review', op: 'resolve',
            operatorId: userProfile.userId, userName: userProfile.displayName,
            reviewId, decision,
            reviewNote: note,
            bonusAmount: Number(document.getElementById(`pr-bonus-${reviewId}`)?.value) || 0,
            bonusReason: document.getElementById(`pr-bonus-reason-${reviewId}`)?.value.trim() || '',
            fullAttendanceBonus: Number(document.getElementById(`pr-full-${reviewId}`)?.value) || 0,
            deduction: Number(document.getElementById(`pr-ded-${reviewId}`)?.value) || 0
        };
        const res = await fetch(apiBaseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || '審核失敗');
        showGlobalNotification(json.message || '已更新', 4000, 'success');
        document.getElementById(`payroll-${reviewId}`)?.remove();
        if (!container.children.length) {
            document.getElementById('no-payroll-message')?.classList.remove('hidden');
        }
    }

    container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-pr-decision]');
        if (!btn) return;
        btn.disabled = true;
        try {
            await resolve(btn.dataset.prDecision, btn.dataset.prId);
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
        }
    });

    return { fetchPending };
}
