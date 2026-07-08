/**
 * 個人頁 — 薪資出勤核對申請（Phase B1）
 */

function escPayrollHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatInsuranceHtml(ins, isDaily) {
    if (isDaily) {
        return `<p class="text-gray-500 text-xs">勞健保／勞退：日薪員工自行處理（不扣款）</p>`;
    }
    if (!ins || ins.type === 'none' || !(ins.total > 0)) {
        return `<p class="text-gray-500 text-xs">勞健保／勞退：不加保／個人自行處理</p>`;
    }
    const dep = Number(ins.healthDependentCount) || 0;
    const depNote = dep > 0 ? `，健保含眷屬 ${dep} 人` : '';
    const pension = Number(ins.pension) || 0;
    const pensionNote = pension > 0 ? `＋勞退 ${pension.toLocaleString()}` : '';
    return `<p><strong>勞健保／勞退自付：</strong>−${(ins.total || 0).toLocaleString()} 元（勞保 ${(ins.labor || 0).toLocaleString()}＋健保 ${(ins.health || 0).toLocaleString()}${pensionNote}${depNote}）</p>`;
}

const PAYROLL_MONTHLY_DAYS = 30;
const PAYROLL_DAILY_HOURS = 8;

function fmtPayrollDay(v) {
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

function calcPersonalLeaveDeduction(baseSalary, personalLeaveDays, payType) {
    const days = Number(personalLeaveDays) || 0;
    const base = Number(baseSalary) || 0;
    if (days <= 0 || base <= 0) return 0;
    if (payType === 'daily') return Math.round(base * days);
    return Math.round(base / PAYROLL_MONTHLY_DAYS * days);
}

function calcSickLeaveDeduction(baseSalary, sickLeaveDays, payType) {
    const days = Number(sickLeaveDays) || 0;
    const base = Number(baseSalary) || 0;
    if (days <= 0 || base <= 0) return 0;
    if (payType === 'daily') return 0;
    return Math.round(base / PAYROLL_MONTHLY_DAYS * days * 0.5);
}

function calcPayrollPayableDays(workPunchDays, stats) {
    const st = stats || {};
    const annual = Number(st.annualLeave) || 0;
    const comp = Number(st.compensatoryLeave) || 0;
    const sick = Number(st.sickLeave) || 0;
    return (Number(workPunchDays) || 0) + annual + comp + sick * 0.5;
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
    const ins = insurancePreview || { total: 0, labor: 0, health: 0, pension: 0, type: 'none' };
    const insDeduction = payType === 'daily' ? 0 : (ins.total || 0);
    const st = snapshot.stats || {};
    const additions = [];
    const deductions = [];

    let earnedBase = base;
    let fullAttendanceBonus = 0;
    const maxFullAttendance = Number(settings.fullAttendanceBonusMax) || 0;
    let personalLeaveDeduction = 0;
    let sickLeaveDeduction = 0;
    if (payType === 'daily') {
        const days = Number(snapshot.daysWorked) || 0;
        const personalLeave = Number(st.personalLeave) || 0;
        const workPunchDays = snapshot.workPunchDays != null ? snapshot.workPunchDays : days;
        earnedBase = base * days;
        personalLeaveDeduction = calcPersonalLeaveDeduction(base, personalLeave, payType);
        const annual = Number(st.annualLeave) || 0;
        const comp = Number(st.compensatoryLeave) || 0;
        const sick = Number(st.sickLeave) || 0;
        const dayParts = [`打卡 ${fmtPayrollDay(workPunchDays)} 天`];
        if (annual > 0) dayParts.push(`特休 ${fmtPayrollDay(annual)} 天`);
        if (comp > 0) dayParts.push(`補休 ${fmtPayrollDay(comp)} 天`);
        if (sick > 0) dayParts.push(`病假 ${fmtPayrollDay(sick)} 天（半薪）`);
        const dayNote = personalLeave > 0
            ? `${dayParts.join('＋')}；事假 ${fmtPayrollDay(personalLeave)} 日另扣`
            : `${dayParts.join('＋')} × ${base.toLocaleString()} 元／日`;
        additions.push({
            label: '本薪（日薪 × 計薪天數）',
            amount: earnedBase,
            note: dayNote
        });
    } else {
        const absent = Number(st.absent) || 0;
        const personalLeave = Number(st.personalLeave) || 0;
        const sickLeave = Number(st.sickLeave) || 0;
        const absentBaseDeduction = calcAbsentBaseDeduction(base, absent);
        personalLeaveDeduction = calcPersonalLeaveDeduction(base, personalLeave, payType);
        sickLeaveDeduction = calcSickLeaveDeduction(base, sickLeave, payType);
        earnedBase = base - absentBaseDeduction - personalLeaveDeduction - sickLeaveDeduction;
        fullAttendanceBonus = calcProratedFullAttendance(maxFullAttendance, absent);
        const baseNotes = [];
        if (absent > 0) baseNotes.push(`缺勤 ${fmtPayrollDay(absent)} 日，扣 ${absentBaseDeduction.toLocaleString()} 元`);
        if (personalLeave > 0) baseNotes.push(`事假 ${fmtPayrollDay(personalLeave)} 日，扣 ${personalLeaveDeduction.toLocaleString()} 元`);
        if (sickLeave > 0) baseNotes.push(`病假 ${fmtPayrollDay(sickLeave)} 日半薪，扣 ${sickLeaveDeduction.toLocaleString()} 元`);
        const baseNote = baseNotes.length ? `${baseNotes.join('；')}（底薪÷30）` : '';
        additions.push({ label: '本薪', amount: earnedBase, note: baseNote });
        if (fullAttendanceBonus > 0) {
            const faNote = absent > 0 && fullAttendanceBonus < maxFullAttendance
                ? `上限 ${maxFullAttendance.toLocaleString()}，缺勤 ${fmtPayrollDay(absent)} 日按比例扣`
                : '';
            additions.push({ label: '出勤獎金', amount: fullAttendanceBonus, note: faNote });
        } else if (maxFullAttendance > 0 && absent > 0) {
            deductions.push({
                label: '出勤獎金',
                amount: 0,
                note: `缺勤 ${fmtPayrollDay(absent)} 日，出勤獎金未發（上限 ${maxFullAttendance.toLocaleString()} 元）`
            });
        }
    }
    if (transport > 0) additions.push({ label: '交通津貼', amount: transport });
    if (otherAllowance > 0) {
        additions.push({ label: '其他津貼', amount: otherAllowance, note: settings.otherAllowanceNote || '' });
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
        deductions.push({ label: '勞健保／勞退', amount: 0, note: '日薪員工自行處理（不扣款）' });
    } else if (insDeduction > 0) {
        const dep = Number(ins.healthDependentCount) || 0;
        const depNote = dep > 0 ? `，含眷屬 ${dep} 人` : '';
        const pension = Number(ins.pension) || 0;
        const pensionNote = pension > 0 ? `＋勞退 ${pension.toLocaleString()}` : '';
        deductions.push({
            label: '勞健保／勞退自付',
            amount: insDeduction,
            note: `勞保 ${(ins.labor || 0).toLocaleString()}＋健保 ${(ins.health || 0).toLocaleString()}${pensionNote}${depNote}`
        });
    } else if (ins.type === 'none') {
        deductions.push({ label: '勞健保／勞退', amount: 0, note: '不加保／個人自行處理' });
    }
    const payLe = payrollLateEarlyFromStats(st);
    const hourly = payrollHourlyWage(base, payType);
    const attendanceTimeDeduction = calcLateEarlyDeduction(hourly, payLe.late, payLe.early);
    const lateMin = st.lateMinutes || 0;
    const earlyMin = st.earlyMinutes || 0;
    if (lateMin > 0 || earlyMin > 0 || payLe.heldLate > 0 || payLe.heldEarly > 0) {
        let note = `試算計入：遲到 ${payLe.late} 分、早退 ${payLe.early} 分（已扣除彈性30分）；時薪 ${Math.round(hourly).toLocaleString()} 元${payType === 'daily' ? '（日薪÷8）' : ''} × 分鐘÷60`;
        if (payLe.heldLate > 0 || payLe.heldEarly > 0) {
            note += `。僅單次打卡日 ${payLe.heldLate}／${payLe.heldEarly} 分暫不扣，請申訴調整`;
        }
        deductions.push({ label: '遲到早退扣款', amount: attendanceTimeDeduction, note });
    }
    if (personalLeaveDeduction > 0 && payType === 'daily') {
        const personalLeave = Number(st.personalLeave) || 0;
        deductions.push({
            label: '事假扣款',
            amount: personalLeaveDeduction,
            note: `事假 ${fmtPayrollDay(personalLeave)} 日（日薪×天數）`
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

function renderBreakdownHtml(breakdown, disclaimer, settings, payType, esc) {
    const escFn = esc || escPayrollHtml;
    const addRows = breakdown.additions.map((row) => {
        const note = row.note ? `<span class="text-gray-500">（${escFn(row.note)}）</span>` : '';
        return `<li class="flex justify-between gap-2"><span>${escFn(row.label)}${note}</span><span class="font-medium text-green-700">+${row.amount.toLocaleString()}</span></li>`;
    }).join('');
    const dedRows = breakdown.deductions.map((row) => {
        const note = row.note ? `<span class="block text-gray-500 text-xs mt-0.5">${escFn(row.note)}</span>` : '';
        const amtCls = row.amount > 0 ? 'text-red-600 font-medium' : 'text-gray-400';
        const amtText = row.amount > 0 ? `−${row.amount.toLocaleString()}` : '—';
        return `<li class="py-1 border-b border-red-50 last:border-0"><div class="flex justify-between gap-2"><span>${escFn(row.label)}</span><span class="${amtCls}">${amtText}</span></div>${note}</li>`;
    }).join('');
    return `
        <p class="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">${escFn(disclaimer)}</p>
        <p class="text-xs text-gray-500 mb-2">薪資類型：${payType === 'daily' ? '日薪' : '月薪'}（${escFn(settings.payRule)}）· 底薪 ${settings.baseSalary.toLocaleString()} 元${payType === 'daily' ? '／日（本薪＝日薪×計薪天數；含特休／補休全薪、病假半薪；遲早退依日薪÷8換算時薪扣款）' : ''}</p>
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

function renderAnomalyDaysHtml(dayAnomalies, esc) {
    const escFn = esc || escPayrollHtml;
    if (!dayAnomalies || !dayAnomalies.length) return '';
    const rows = dayAnomalies.map((d) => {
        const statusNote = d.status ? ` <span class="text-gray-500">（${escFn(d.status)}）</span>` : '';
        return `<li><span class="font-medium">${escFn(d.date)}</span> · ${escFn(d.summary)}${statusNote}</li>`;
    }).join('');
    return `<div class="text-amber-800 bg-amber-50 rounded p-2 text-sm mt-2">
        <p class="font-semibold">本期出勤異常（含未申訴）</p>
        <ul class="list-disc ml-4 mt-1 space-y-0.5">${rows}</ul>
        <p class="text-xs text-amber-700 mt-1">員工未申訴者，主管審核時仍可參考；請至出勤報表或申訴審核處理</p>
    </div>`;
}

function renderMarginBonusDraftsHtml(drafts, esc) {
    const escFn = esc || escPayrollHtml;
    if (!drafts || !drafts.length) return '';
    const rows = drafts.map((d) => {
        const note = d.note ? `（${escFn(d.note)}）` : '';
        return `<li>案號 ${escFn(d.project_no)}：${Number(d.amount || 0).toLocaleString()} 元${note}</li>`;
    }).join('');
    const total = drafts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    return `<div class="text-amber-800 bg-amber-50 rounded p-2 text-sm mt-2">
        <p class="font-semibold">待併入案件獎金草稿（合計 ${total.toLocaleString()} 元）</p>
        <ul class="list-disc ml-4 mt-1">${rows}</ul>
        <p class="text-xs text-amber-700 mt-1">主管審核薪資時會併入獎金欄</p>
    </div>`;
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
    let submitGateTimer = null;

    function clearSubmitGateTimer() {
        if (submitGateTimer) {
            clearInterval(submitGateTimer);
            submitGateTimer = null;
        }
    }

    function applySubmitGateUi() {
        const gate = contextData?.submitGate;
        const readOnly = !!contextData?.readOnly;
        if (!els.submitBtn) return;
        if (readOnly) {
            els.submitBtn.classList.add('hidden');
            return;
        }
        els.submitBtn.classList.remove('hidden');
        if (contextData?.existingReview) return;
        if (gate && gate.canSubmit === false) {
            els.submitBtn.disabled = true;
            els.submitBtn.title = gate.submitGateMessage || '';
        } else if (!contextData?.existingReview) {
            els.submitBtn.disabled = false;
            els.submitBtn.title = '';
        }
    }

    function scheduleSubmitGateRecheck() {
        clearSubmitGateTimer();
        const gate = contextData?.submitGate;
        if (!gate || gate.canSubmit || !gate.submitGateAt || contextData?.readOnly) return;
        submitGateTimer = setInterval(() => {
            const at = gate.submitGateAt;
            if (!at) return;
            const now = new Date();
            const gateDate = new Date(at.length === 16 ? at + ':00' : at);
            if (now >= gateDate) {
                if (contextData?.submitGate) contextData.submitGate.canSubmit = true;
                applySubmitGateUi();
                const hint = document.getElementById('payroll-gate-hint');
                if (hint) hint.classList.add('hidden');
                clearSubmitGateTimer();
            }
        }, 60000);
    }

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
        const { settings, period, periods, snapshot, existingReview, disclaimer, submitGate, marginBonusDrafts } = contextData;
        els.periodSelect.innerHTML = periods.map((p) => {
            const tag = p.displayLabel || p.periodLabel;
            return `<option value="${esc(p.periodLabel)}" ${p.periodLabel === period.periodLabel ? 'selected' : ''}>${esc(tag)}</option>`;
        }).join('');
        els.hint.textContent = period.submitHint || '';

        const st = snapshot.stats || {};
        const isDaily = period.payType === 'daily';
        els.monthlyRest.classList.toggle('hidden', isDaily);
        els.dailyDays.classList.toggle('hidden', !isDaily);

        let statsHtml = '';
        if (isDaily) {
            const reportDays = snapshot.checkInDaysReport ?? st.checkInDays ?? '—';
            const punchDays = snapshot.workPunchDays != null ? snapshot.workPunchDays : snapshot.daysWorked;
            statsHtml = `
                <p><strong>本期計薪天數：</strong>${snapshot.daysWorked || 0} 天</p>
                <p class="text-xs text-gray-500">打卡 ${fmtPayrollDay(punchDays)} 天；特休 ${fmtPayrollDay(st.annualLeave)}／補休 ${fmtPayrollDay(st.compensatoryLeave)}／病假 ${fmtPayrollDay(st.sickLeave)}（半薪計入）</p>
                ${reportDays !== punchDays ? `<p class="text-xs text-gray-500">報表「實際出勤」：${reportDays} 天</p>` : ''}
                <p><strong>遲到／早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                ${(st.lateMinutesHeldSinglePunch || st.earlyMinutesHeldSinglePunch) ? `<p class="text-xs text-amber-700">僅單次打卡日 ${st.lateMinutesHeldSinglePunch || 0}／${st.earlyMinutesHeldSinglePunch || 0} 分暫不計入薪資試算，請先於出勤頁申訴調整</p>` : ''}
                <p class="text-xs text-gray-500">日薪＝日薪×計薪天數（含特休／補休全薪、病假半薪）；事假另扣；遲早退＝（日薪÷8）×分鐘÷60</p>
                ${renderAnomalyDaysHtml(snapshot.dayAnomalies, esc)}
            `;
            document.getElementById('payroll-days-worked-val').textContent = snapshot.daysWorked || 0;
        } else {
            statsHtml = `
                <p><strong>標準工作日：</strong>${st.workDays ?? '—'} 天</p>
                <p><strong>實際出勤：</strong>${st.checkInDays ?? st.attended ?? '—'} 天</p>
                <p><strong>應休（系統）：</strong>${snapshot.rest?.scheduledRestDays ?? '—'} 天</p>
                <p><strong>實休（系統）：</strong>${fmtPayrollDay(snapshot.rest?.actualRestDays)} 天</p>
                <p><strong>特休／病假／事假／補休：</strong>${fmtPayrollDay(st.annualLeave)}／${fmtPayrollDay(st.sickLeave)}／${fmtPayrollDay(st.personalLeave)}／${fmtPayrollDay(st.compensatoryLeave)}</p>
                <p><strong>遲到／早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                ${(st.lateMinutesHeldSinglePunch || st.earlyMinutesHeldSinglePunch) ? `<p class="text-xs text-amber-700">僅單次打卡日 ${st.lateMinutesHeldSinglePunch || 0}／${st.earlyMinutesHeldSinglePunch || 0} 分暫不計入薪資試算，請先於出勤頁申訴調整</p>` : ''}
                <p><strong>缺勤／異常：</strong>${fmtPayrollDay(st.absent)}／${st.anomalyDays ?? 0} 天</p>
                ${renderAnomalyDaysHtml(snapshot.dayAnomalies, esc)}
            `;
        }
        els.statsBox.innerHTML = statsHtml;

        const preview = buildPayrollBreakdown(settings, period.payType, snapshot, {
            remoteAllowanceAmount: Number(els.remoteAmount.value) || 0,
            overtimeHours: Number(els.overtimeHours.value) || 0
        }, contextData.insurancePreview);
        els.calcBox.innerHTML = renderBreakdownHtml(preview, disclaimer, settings, period.payType, esc);

        if (existingReview) {
            const st = String(existingReview.status || '');
            const hint = (st === '已送會計' || st === '待審')
                ? '（主管請至會計 → 薪資審核）'
                : (st === '已審' ? '（財務請至會計 → 薪資待匯款）' : '');
            els.statusBox.innerHTML = `<p class="text-amber-800 bg-amber-50 rounded p-2">此期別已有「${esc(st)}」申請（${esc(existingReview.submitTime?.slice(0, 10) || '')}）${esc(hint)}</p>`;
            els.submitBtn.disabled = true;
        } else {
            let statusHtml = renderMarginBonusDraftsHtml(marginBonusDrafts, esc);
            if (submitGate && submitGate.canSubmit === false) {
                statusHtml += `<p id="payroll-gate-hint" class="text-amber-800 bg-amber-50 rounded p-2 mt-2 text-sm">${esc(submitGate.submitGateMessage || '尚未到可送出時間')}</p>`;
            }
            els.statusBox.innerHTML = statusHtml;
        }
        applySubmitGateUi();
        scheduleSubmitGateRecheck();
        els.formWrap.classList.remove('hidden');
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
            showGlobalNotification(json.message || '已送至會計待審，主管請至「添心會計 → 薪資審核」處理', 6000, 'success');
            await fetchContext(contextData.period.periodLabel);
        } catch (err) {
            alert(`送出失敗：${err.message}`);
            els.submitBtn.disabled = false;
        } finally {
            els.submitBtn.textContent = '送出薪資申請至會計';
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

    const historyCtx = { apiBaseUrl, userId, fetchApi };
    function loadPayslipHistoryLocal() {
        return loadPayslipHistoryForPanel(historyCtx);
    }

    return {
        loadIfNeeded() {
            if (payrollLoaded) return;
            payrollLoaded = true;
            fetchContext();
            loadPayslipHistoryLocal();
        },
        refreshHistory: loadPayslipHistoryLocal
    };
}

function renderPayslipDetailHtml(detail, esc) {
    const snap = detail.snapshot || {};
    const earnings = snap.earnings || [];
    const deductions = snap.deductions || [];
    const earnRows = earnings.filter((e) => (e.amount || 0) > 0).map((e) => {
        const note = e.note ? `<span class="text-gray-500 text-xs">（${esc(e.note)}）</span>` : '';
        return `<li class="flex justify-between gap-2"><span>${esc(e.label)}${note}</span><span class="text-green-700">+${Number(e.amount).toLocaleString()}</span></li>`;
    }).join('') || '<li class="text-gray-400">—</li>';
    const dedRows = deductions.filter((d) => (d.amount || 0) > 0).map((d) => {
        const note = d.note ? `<span class="block text-gray-500 text-xs">${esc(d.note)}</span>` : '';
        return `<li class="py-1"><div class="flex justify-between gap-2"><span>${esc(d.label)}</span><span class="text-red-600">−${Number(d.amount).toLocaleString()}</span></div>${note}</li>`;
    }).join('') || '<li class="text-gray-400">—</li>';
    return `
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-sm space-y-3">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <p class="font-bold text-gray-800">${esc(detail.periodLabel)} 薪資明細</p>
                    <p class="text-xs text-gray-500">${esc(detail.periodStart)}～${esc(detail.periodEnd)} · 發薪 ${esc(detail.payDate)}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">已發放</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
                <div><p class="text-xs font-bold text-green-800 mb-1">加項</p><ul class="space-y-1">${earnRows}</ul></div>
                <div><p class="text-xs font-bold text-red-800 mb-1">扣項</p><ul>${dedRows}</ul></div>
            </div>
            <p class="text-right text-lg font-bold text-indigo-700">實發 ${Number(detail.finalAmount || 0).toLocaleString()} 元</p>
            ${detail.bonusNote ? `<p class="text-xs text-gray-500">獎金備註：${esc(detail.bonusNote)}</p>` : ''}
        </div>
    `;
}

async function loadPayslipHistoryForPanel(ctx) {
    const { apiBaseUrl, userId, fetchApi } = ctx;
    const listEl = document.getElementById('payroll-history-list');
    const loadingEl = document.getElementById('payroll-history-loading');
    const detailEl = document.getElementById('payroll-payslip-detail');
    const emptyEl = document.getElementById('payroll-history-empty');
    if (!listEl || !userId) return;

    function esc(s) { return escPayrollHtml(s); }

    loadingEl?.classList.remove('hidden');
    listEl.innerHTML = '';
    detailEl?.classList.add('hidden');
    try {
        const params = {
            page: 'attendance_api',
            action: 'payroll_review',
            mode: 'history',
            operatorId: userId,
            months: 12
        };
        const json = fetchApi
            ? await fetchApi(params)
            : await (async () => {
                const url = new URL(apiBaseUrl);
                Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
                const res = await fetch(url);
                return res.json();
            })();
        if (!json.success) throw new Error(json.message || '載入失敗');
        const items = json.data || [];
        emptyEl?.classList.toggle('hidden', items.length > 0);
        listEl.innerHTML = items.map((row) => `
            <button type="button" class="w-full text-left px-3 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-between items-center gap-2 payroll-history-item" data-payslip-id="${esc(row.payslipId)}">
                <span><strong>${esc(row.periodLabel)}</strong><span class="text-xs text-gray-500 block">${esc(row.periodStart)}～${esc(row.periodEnd)} · 發薪 ${esc(row.payDate || '')}</span></span>
                <span class="font-bold text-indigo-700">${Number(row.finalAmount || 0).toLocaleString()} 元</span>
            </button>
        `).join('');
        listEl.querySelectorAll('.payroll-history-item').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const payslipId = btn.dataset.payslipId;
                if (!detailEl) return;
                detailEl.classList.remove('hidden');
                detailEl.innerHTML = '<p class="text-gray-500 text-sm py-2">載入明細…</p>';
                const dParams = {
                    page: 'attendance_api',
                    action: 'payroll_review',
                    mode: 'payslip',
                    operatorId: userId,
                    payslipId
                };
                const dJson = fetchApi
                    ? await fetchApi(dParams)
                    : await (async () => {
                        const url = new URL(apiBaseUrl);
                        Object.entries(dParams).forEach(([k, v]) => url.searchParams.append(k, v));
                        const res = await fetch(url);
                        return res.json();
                    })();
                if (!dJson.success || !dJson.data) {
                    detailEl.innerHTML = `<p class="text-red-600 text-sm">${esc(dJson.message || '無法載入明細')}</p>`;
                    return;
                }
                detailEl.innerHTML = renderPayslipDetailHtml(dJson.data, esc);
            });
        });
    } catch (err) {
        if (emptyEl) {
            emptyEl.textContent = err.message || '載入發放紀錄失敗';
            emptyEl.classList.remove('hidden');
        }
    } finally {
        loadingEl?.classList.add('hidden');
    }
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
        container.innerHTML = '<p class="text-center text-gray-600 py-12 leading-relaxed">薪資審核已移至會計系統「<strong>薪資審核</strong>」。<br>請從主控台進入「添心會計」操作。</p>';
        document.getElementById('no-payroll-message')?.classList.add('hidden');
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
                <p><strong>預估本薪／出勤獎金：</strong>${Number(row.baseSalary).toLocaleString()}／${Number(row.fullAttendanceBonus).toLocaleString()} 元</p>
                <p><strong>遠程津貼：</strong>${Number(row.remoteAllowanceAmount).toLocaleString()} 元 ${row.remoteAllowanceNote ? `（${esc(row.remoteAllowanceNote)}）` : ''}</p>
                <p><strong>加班：</strong>${row.overtimeHours} 小時 ${row.overtimeNote ? `— ${esc(row.overtimeNote)}` : ''}</p>
                <p class="text-xs font-semibold text-red-800 mt-2">減項</p>
                ${insLine}
                ${dedHint}
                <p><strong>補充：</strong>${esc(row.supplementNote || '—')}</p>
                <p class="font-bold text-indigo-700">員工端預估實發：${Number(row.estimatedNet).toLocaleString()} 元</p>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
                <label class="text-xs">出勤獎金<input type="number" id="pr-full-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="${row.fullAttendanceBonus}"></label>
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

/** 權限 ≥5：出勤儀表板預覽他人薪資試算（唯讀） */
export function initPayrollAdminPreview(ctx) {
    const { apiBaseUrl, operatorId, operatorPermission, showGlobalNotification, fetchApi } = ctx;
    if (Number(operatorPermission) < 5) return null;

    const wrap = document.getElementById('payroll-admin-preview');
    const empSelect = document.getElementById('employee-select');
    const periodSelect = document.getElementById('payroll-admin-period');
    const loadingEl = document.getElementById('payroll-admin-loading');
    const errorEl = document.getElementById('payroll-admin-error');
    const calcBox = document.getElementById('payroll-admin-calc');
    const statsBox = document.getElementById('payroll-admin-stats');
    const titleEl = document.getElementById('payroll-admin-title');
    if (!wrap || !empSelect || !periodSelect) return null;

    wrap.classList.remove('hidden');
    let adminContext = null;

    function esc(s) { return escPayrollHtml(s); }

    async function loadPreview() {
        const targetUserId = empSelect.value;
        if (!targetUserId) {
            calcBox.innerHTML = '<p class="text-gray-500 text-sm">請先選擇單一員工</p>';
            statsBox.innerHTML = '';
            return;
        }
        loadingEl?.classList.remove('hidden');
        errorEl?.classList.add('hidden');
        try {
            const params = {
                page: 'attendance_api',
                action: 'payroll_review',
                mode: 'admin_preview',
                operatorId,
                targetUserId
            };
            if (periodSelect.value) params.periodLabel = periodSelect.value;
            const json = fetchApi
                ? await fetchApi(params)
                : await (async () => {
                    const url = new URL(apiBaseUrl);
                    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
                    const res = await fetch(url);
                    return res.json();
                })();
            if (!json.success) throw new Error(json.message || '載入失敗');
            adminContext = json.data;
            const empName = adminContext.previewEmployee?.userName || empSelect.selectedOptions[0]?.textContent || '';
            if (titleEl) titleEl.textContent = `${empName} — 薪資試算預覽（唯讀）`;
            periodSelect.innerHTML = (adminContext.periods || []).map((p) => {
                const tag = p.displayLabel || p.periodLabel;
                return `<option value="${esc(p.periodLabel)}" ${p.periodLabel === adminContext.period.periodLabel ? 'selected' : ''}>${esc(tag)}</option>`;
            }).join('');
            const st = adminContext.snapshot?.stats || {};
            const isDaily = adminContext.period.payType === 'daily';
            const snap = adminContext.snapshot || {};
            const anomalyBlock = renderAnomalyDaysHtml(snap.dayAnomalies, esc);
            statsBox.innerHTML = isDaily
                ? `<p><strong>本期出勤（計薪）：</strong>${snap.daysWorked || 0} 天</p>
                   <p><strong>遲到／早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                   <p class="text-xs text-gray-500">本薪＝日薪×出勤天數；排休日加班有打卡亦計入</p>
                   ${anomalyBlock}`
                : `<p><strong>實際出勤：</strong>${st.checkInDays ?? '—'} 天 · 遲早退 ${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                   ${anomalyBlock}`;
            const preview = buildPayrollBreakdown(
                adminContext.settings,
                adminContext.period.payType,
                adminContext.snapshot,
                { remoteAllowanceAmount: 0, overtimeHours: 0 },
                adminContext.insurancePreview
            );
            let html = renderBreakdownHtml(preview, adminContext.disclaimer, adminContext.settings, adminContext.period.payType, esc);
            html += renderMarginBonusDraftsHtml(adminContext.marginBonusDrafts, esc);
            calcBox.innerHTML = html;
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || '載入失敗';
                errorEl.classList.remove('hidden');
            }
        } finally {
            loadingEl?.classList.add('hidden');
        }
    }

    periodSelect.addEventListener('change', loadPreview);
    empSelect.addEventListener('change', loadPreview);
    return { refresh: loadPreview };
}
