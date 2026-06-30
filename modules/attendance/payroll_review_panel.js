/**
 * 個人頁 — 薪資出勤核對申請（Phase B1）
 */

function escPayrollHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatInsuranceHtml(ins, isDaily) {
    if (isDaily) {
        return `<p class="text-gray-500 text-xs">勞健保：日薪員工自行處理（不扣款）</p>`;
    }
    if (!ins || ins.type === 'none' || !(ins.total > 0)) {
        return `<p class="text-gray-500 text-xs">勞健保：不加保／個人自行處理</p>`;
    }
    const dep = Number(ins.healthDependentCount) || 0;
    const depNote = dep > 0 ? `，健保含眷屬 ${dep} 人` : '';
    return `<p><strong>勞健保自付：</strong>−${(ins.total || 0).toLocaleString()} 元（勞保 ${(ins.labor || 0).toLocaleString()}＋健保 ${(ins.health || 0).toLocaleString()}${depNote}）</p>`;
}

export function initPayrollReviewPanel(ctx) {
    const {
        apiBaseUrl, userId, userName, showGlobalNotification, fetchApi
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
        return escPayrollHtml(s);
    }

    async function fetchContext(periodLabel) {
        if (!userId) {
            els.error.textContent = '缺少使用者 ID，請從主控台重新進入此頁面';
            els.error.classList.remove('hidden');
            return;
        }
        els.loading.classList.remove('hidden');
        els.formWrap.classList.add('hidden');
        els.error.classList.add('hidden');
        try {
            const params = {
                page: 'attendance_api',
                action: 'payroll_review',
                mode: 'context',
                operatorId: userId
            };
            if (periodLabel) params.periodLabel = periodLabel;
            const json = fetchApi
                ? await fetchApi(params)
                : await (async () => {
                    const url = new URL(apiBaseUrl);
                    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`伺服器回應 ${res.status}`);
                    return res.json();
                })();
            if (!json.success) throw new Error(json.message || '載入失敗');
            contextData = json.data;
            renderContext();
        } catch (err) {
            const msg = err.message === 'Failed to fetch'
                ? '無法連線後端（請確認網路，或稍後再按「重新載入」）'
                : err.message;
            els.error.textContent = msg;
            els.error.classList.remove('hidden');
        } finally {
            els.loading.classList.add('hidden');
        }
    }

    function renderContext() {
        if (!contextData) return;
        const { settings, period, periods, snapshot, existingReview, disclaimer } = contextData;
        els.periodSelect.innerHTML = periods.map((p) => {
            const tag = p.displayLabel || p.periodLabel;
            const range = `${p.periodStart}～${p.periodEnd}`;
            const payNote = p.payDate ? ` · 發薪 ${p.payDate.slice(5).replace('-', '/')}` : '';
            return `<option value="${esc(p.periodLabel)}" ${p.periodLabel === period.periodLabel ? 'selected' : ''}>${esc(tag)} · ${esc(range)}${esc(payNote)}</option>`;
        }).join('');
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
                ${(st.lateMinutesHeldSinglePunch || st.earlyMinutesHeldSinglePunch) ? `<p class="text-xs text-amber-700">僅單次打卡日 ${st.lateMinutesHeldSinglePunch || 0}／${st.earlyMinutesHeldSinglePunch || 0} 分暫不計入薪資試算，請先於出勤頁申訴調整</p>` : ''}
                <p><strong>缺勤／異常：</strong>${fmtDay(st.absent)}／${st.anomalyDays ?? 0} 天</p>
            `;
        }
        els.statsBox.innerHTML = statsHtml;

        const preview = calcPreview(settings, period.payType, snapshot, {
            remoteAllowanceAmount: Number(els.remoteAmount.value) || 0,
            overtimeHours: Number(els.overtimeHours.value) || 0
        }, contextData.insurancePreview);
        els.calcBox.innerHTML = renderBreakdownHtml(preview, disclaimer, settings, period.payType);

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

    function payrollLateEarlyFromStats(st) {
        const late = st.lateMinutesPayroll != null ? st.lateMinutesPayroll : (st.lateMinutes || 0);
        const early = st.earlyMinutesPayroll != null ? st.earlyMinutesPayroll : (st.earlyMinutes || 0);
        return {
            late, early,
            heldLate: st.lateMinutesHeldSinglePunch || 0,
            heldEarly: st.earlyMinutesHeldSinglePunch || 0
        };
    }

    const PAYROLL_MONTHLY_DAYS = 30;
    const PAYROLL_DAILY_HOURS = 8;

    function payrollHourlyWage(baseSalary, payType) {
        const base = Number(baseSalary) || 0;
        if (base <= 0) return 0;
        if (payType === 'daily') return base / PAYROLL_DAILY_HOURS;
        return base / PAYROLL_MONTHLY_DAYS / PAYROLL_DAILY_HOURS;
    }

    function calcAbsentBaseDeduction(baseSalary, absentDays) {
        const absent = Number(absentDays) || 0;
        const base = Number(baseSalary) || 0;
        if (absent <= 0 || base <= 0) return 0;
        return Math.round(base / PAYROLL_MONTHLY_DAYS * absent);
    }

    function calcProratedFullAttendance(maxBonus, absentDays) {
        const max = Number(maxBonus) || 0;
        const absent = Number(absentDays) || 0;
        if (max <= 0) return 0;
        if (absent <= 0) return max;
        return Math.max(0, max - Math.round(max / PAYROLL_MONTHLY_DAYS * absent));
    }

    function calcLateEarlyDeduction(hourlyWage, lateMinutes, earlyMinutes) {
        const mins = (Number(lateMinutes) || 0) + (Number(earlyMinutes) || 0);
        if (mins <= 0) return 0;
        return Math.round((Number(hourlyWage) || 0) * mins / 60);
    }

    function calcOvertimePayLaborLaw(hourlyWage, hours) {
        let h = Number(hours) || 0;
        const wage = Number(hourlyWage) || 0;
        if (h <= 0 || wage <= 0) return 0;
        let pay = 0;
        const t1 = Math.min(2, h);
        pay += wage * (4 / 3) * t1;
        h -= t1;
        if (h > 0) {
            const t2 = Math.min(2, h);
            pay += wage * (5 / 3) * t2;
            h -= t2;
        }
        if (h > 0) pay += wage * (5 / 3) * h;
        return Math.round(pay);
    }

    function buildPayrollBreakdown(settings, payType, snapshot, input, insurancePreview) {
        const base = Number(settings.baseSalary) || 0;
        const remote = Number(input.remoteAllowanceAmount) || 0;
        const transport = Number(settings.transportationAllowance) || 0;
        const otherAllowance = Number(settings.otherAllowance) || 0;
        const ins = insurancePreview || { total: 0, labor: 0, health: 0, type: 'none' };
        const insDeduction = payType === 'daily' ? 0 : (ins.total || 0);
        const st = snapshot.stats || {};
        const additions = [];
        const deductions = [];

        let earnedBase = base;
        let fullAttendanceBonus = 0;
        let absentBaseDeduction = 0;
        let attendanceTimeDeduction = 0;
        const maxFullAttendance = Number(settings.fullAttendanceBonusMax) || 2000;
        if (payType === 'daily') {
            earnedBase = base * (Number(snapshot.daysWorked) || 0);
            additions.push({ label: '本薪（日薪 × 出勤天數）', amount: earnedBase });
        } else {
            const absent = Number(st.absent) || 0;
            absentBaseDeduction = calcAbsentBaseDeduction(base, absent);
            earnedBase = base - absentBaseDeduction;
            fullAttendanceBonus = calcProratedFullAttendance(maxFullAttendance, absent);
            const baseNote = absent > 0
                ? `缺勤 ${fmtDay(absent)} 日，扣 ${absentBaseDeduction.toLocaleString()} 元（底薪÷30）`
                : '';
            additions.push({ label: '本薪', amount: earnedBase, note: baseNote });
            if (fullAttendanceBonus > 0) {
                const faNote = absent > 0 && fullAttendanceBonus < maxFullAttendance
                    ? `上限 ${maxFullAttendance.toLocaleString()}，缺勤 ${fmtDay(absent)} 日按比例扣`
                    : '';
                additions.push({ label: '全勤獎金', amount: fullAttendanceBonus, note: faNote });
            } else if (maxFullAttendance > 0 && absent > 0) {
                deductions.push({
                    label: '全勤獎金',
                    amount: 0,
                    note: `缺勤 ${fmtDay(absent)} 日，全勤未發（上限 ${maxFullAttendance.toLocaleString()} 元）`
                });
            }
        }
        if (transport > 0) additions.push({ label: '交通津貼', amount: transport });
        if (otherAllowance > 0) {
            additions.push({
                label: '其他津貼',
                amount: otherAllowance,
                note: settings.otherAllowanceNote || ''
            });
        }
        const overtimeHours = Number(input.overtimeHours) || 0;
        let overtimePay = 0;
        if (overtimeHours > 0 && base > 0) {
            overtimePay = calcOvertimePayLaborLaw(payrollHourlyWage(base, payType), overtimeHours);
            additions.push({
                label: `加班費（${overtimeHours} 小時）`,
                amount: overtimePay,
                note: '勞基法第24條：前2h×4/3、次2h×5/3'
            });
        }
        if (remote > 0) additions.push({ label: '遠程津貼', amount: remote });

        if (payType === 'daily') {
            deductions.push({ label: '勞健保', amount: 0, note: '日薪員工自行處理（不扣款）' });
        } else if (insDeduction > 0) {
            const dep = Number(ins.healthDependentCount) || 0;
            const depNote = dep > 0 ? `，含眷屬 ${dep} 人` : '';
            deductions.push({
                label: '勞健保自付',
                amount: insDeduction,
                note: `勞保 ${(ins.labor || 0).toLocaleString()}＋健保 ${(ins.health || 0).toLocaleString()}${depNote}`
            });
        } else if (ins.type === 'none') {
            deductions.push({ label: '勞健保', amount: 0, note: '不加保／個人自行處理' });
        }
        const lateMin = st.lateMinutes || 0;
        const earlyMin = st.earlyMinutes || 0;
        const payLe = payrollLateEarlyFromStats(st);
        if (payType !== 'daily') {
            attendanceTimeDeduction = calcLateEarlyDeduction(payrollHourlyWage(base, payType), payLe.late, payLe.early);
        }
        if (lateMin > 0 || earlyMin > 0 || payLe.heldLate > 0 || payLe.heldEarly > 0) {
            let note = `試算計入：遲到 ${payLe.late} 分、早退 ${payLe.early} 分（已扣除彈性30分）；時薪×分鐘÷60`;
            if (payLe.heldLate > 0 || payLe.heldEarly > 0) {
                note += `。僅單次打卡日 ${payLe.heldLate}／${payLe.heldEarly} 分暫不扣，請申訴調整`;
            }
            deductions.push({
                label: '遲到早退扣款',
                amount: attendanceTimeDeduction,
                note
            });
        }
        deductions.push({ label: '其他扣款', amount: 0, note: '主管審核時填入（員工送審時為 0）' });

        const addTotal = additions.reduce((s, x) => s + (x.amount || 0), 0);
        const dedTotal = deductions.reduce((s, x) => s + (x.amount || 0), 0);
        const estimatedNet = Math.round(addTotal - dedTotal);
        return {
            additions, deductions, addTotal, dedTotal, estimatedNet,
            baseSalary: earnedBase, fullAttendanceBonus, transportationAllowance: transport,
            otherAllowance, overtimePay, insurance: ins
        };
    }

    function renderBreakdownHtml(breakdown, disclaimer, settings, payType) {
        const addRows = breakdown.additions.map((row) => {
            const note = row.note ? `<span class="text-gray-500">（${esc(row.note)}）</span>` : '';
            return `<li class="flex justify-between gap-2"><span>${esc(row.label)}${note}</span><span class="font-medium text-green-700">+${row.amount.toLocaleString()}</span></li>`;
        }).join('');
        const dedRows = breakdown.deductions.map((row) => {
            const note = row.note ? `<span class="block text-gray-500 text-xs mt-0.5">${esc(row.note)}</span>` : '';
            const amtCls = row.amount > 0 ? 'text-red-600 font-medium' : 'text-gray-400';
            const amtText = row.amount > 0 ? `−${row.amount.toLocaleString()}` : '—';
            return `<li class="py-1 border-b border-red-50 last:border-0"><div class="flex justify-between gap-2"><span>${esc(row.label)}</span><span class="${amtCls}">${amtText}</span></div>${note}</li>`;
        }).join('');
        return `
            <p class="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">${esc(disclaimer)}</p>
            <p class="text-xs text-gray-500 mb-2">薪資類型：${payType === 'daily' ? '日薪' : '月薪'}（${esc(settings.payRule)}）· 底薪 ${settings.baseSalary.toLocaleString()} 元${payType === 'daily' ? '／日' : ''}</p>
            <div class="grid sm:grid-cols-2 gap-3">
                <div class="bg-white rounded-lg p-2 border border-green-100">
                    <p class="text-xs font-bold text-green-800 mb-1">加項</p>
                    <ul class="text-sm space-y-1">${addRows || '<li class="text-gray-400">—</li>'}</ul>
                    <p class="text-xs text-right text-green-800 mt-2 font-semibold">小計 +${breakdown.addTotal.toLocaleString()}</p>
                </div>
                <div class="bg-white rounded-lg p-2 border border-red-100">
                    <p class="text-xs font-bold text-red-800 mb-1">減項</p>
                    <ul class="text-sm">${dedRows || '<li class="text-gray-400">—</li>'}</ul>
                    <p class="text-xs text-right text-red-800 mt-2 font-semibold">小計 −${breakdown.dedTotal.toLocaleString()}</p>
                </div>
            </div>
            <p class="text-lg font-bold text-indigo-700 mt-3 text-right">預估實發：${breakdown.estimatedNet.toLocaleString()} 元</p>
        `;
    }

    function calcPreview(settings, payType, snapshot, input, insurancePreview) {
        return buildPayrollBreakdown(settings, payType, snapshot, input, insurancePreview);
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
    els.refreshBtn.addEventListener('click', () => {
        payrollLoaded = false;
        fetchContext(els.periodSelect.value);
    });
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
        return escPayrollHtml(s);
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
        const ins = snap.insurance || {};
        const insLine = formatInsuranceHtml(ins, isDaily);
        const dedHint = Number(row.deduction) > 0
            ? `<p><strong>其他扣款：</strong>−${Number(row.deduction).toLocaleString()} 元</p>`
            : `<p class="text-gray-500 text-xs">其他扣款：待審核填入</p>`;
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
                <p class="text-xs font-semibold text-red-800 mt-2">減項</p>
                ${insLine}
                ${dedHint}
                <p><strong>補充：</strong>${esc(row.supplementNote || '—')}</p>
                <p class="font-bold text-indigo-700">員工端預估實發：${Number(row.estimatedNet).toLocaleString()} 元</p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
                <label class="text-xs">全勤獎金<input type="number" id="pr-full-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="${row.fullAttendanceBonus}"></label>
                <label class="text-xs">獎金<input type="number" id="pr-bonus-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="0"></label>
                <label class="text-xs col-span-2">獎金事由<input type="text" id="pr-bonus-reason-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" placeholder="主管填入"></label>
                <label class="text-xs">扣款（其他）<input type="number" id="pr-ded-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="${row.deduction || 0}" placeholder="考勤罰款等"></label>
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
