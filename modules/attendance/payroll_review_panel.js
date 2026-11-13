/**
 * 個人頁 — 薪資出勤核對申請（Phase B1）
 */

import {
    mergeOvertimeDailyRows,
    overtimeDailyRowsToObject,
    sumOvertimeDailyRows,
    sumOvertimeDailyMinutes,
    payrollOvertimeMinutesToHours,
    reportOvertimeMinutesFromSnapshot,
    validatePayrollOvertimeDailyHours,
    validatePayrollOvertimeSubmit,
    overtimeDailyMismatchMessage
} from './payroll_overtime_daily.js';

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

/** 與 shared/js/tax_withhold.js、後端 Logic_TaxWithhold 同步（115） */
function payrollTaxRoundHalfUpDiv_(num, den) {
    if (den <= 0) return 0;
    return Math.floor((num * 2 + den) / (den * 2));
}
function payrollTaxFloorToTens_(n) {
    const v = Math.floor(Number(n) || 0);
    return v <= 0 ? 0 : Math.floor(v / 10) * 10;
}
function payrollNormalizeTaxMode_(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/\s/g, '');
    if (!s) return 'fixed5';
    if (s === 'table' || s.indexOf('扣繳稅額表') >= 0) return 'table';
    return 'fixed5';
}
function calcPayrollTaxBundleClient_(settings, monthlyGross, bonusAmount) {
    const mode = payrollNormalizeTaxMode_(settings && (settings.taxWithholdMode || settings.扣繳方式));
    const dependents = Math.max(0, Math.min(11, parseInt(settings && (settings.taxDependentCount ?? settings.扣繳扶養人數), 10) || 0));
    const gross = Math.floor(Math.max(0, Number(monthlyGross) || 0));
    const bonus = Math.floor(Math.max(0, Number(bonusAmount) || 0));
    const insured = Math.floor(Math.max(0, Number(settings && (settings.insuredSalaryLevel || settings.投保級距)) || 0));
    const ytd = Math.floor(Math.max(0, Number(settings && (settings.ytdBonusPaid || settings.本年已發獎金累計)) || 0));
    let fixedRaw = 0;
    if (mode === 'table') {
        const taxable = Math.floor(Math.max(0, gross * 12 - (101000 * (1 + dependents) + 272000 + 227000)));
        if (taxable > 0) {
            const brackets = [
                [0, 610000, 5, 0], [610001, 1380000, 12, 42700], [1380001, 2770000, 20, 153100],
                [2770001, 5190000, 30, 430100], [5190001, null, 40, 949100]
            ];
            let rateNum = 5;
            let prog = 0;
            for (let i = 0; i < brackets.length; i++) {
                const b = brackets[i];
                if (taxable >= b[0] && (b[1] == null || taxable <= b[1])) {
                    rateNum = b[2];
                    prog = b[3];
                    break;
                }
            }
            const annual = Math.max(0, payrollTaxRoundHalfUpDiv_(taxable * rateNum - prog * 100, 100));
            fixedRaw = payrollTaxFloorToTens_(annual / 12);
        }
    } else {
        fixedRaw = payrollTaxRoundHalfUpDiv_(gross * 5, 100);
    }
    const fixedTax = fixedRaw <= 2000 ? 0 : fixedRaw;
    const bonusTax = bonus >= 90501 ? payrollTaxRoundHalfUpDiv_(bonus * 5, 100) : 0;
    let nhi = 0;
    if (insured > 0 && bonus > 0) {
        const threshold = insured * 4;
        const chargeable = Math.floor(Math.max(0, ytd + bonus - Math.max(ytd, threshold)));
        nhi = chargeable > 0 ? payrollTaxRoundHalfUpDiv_(chargeable * 211, 10000) : 0;
    }
    return { fixedSalaryTax: fixedTax, bonusTax, nhiSupplementary: nhi, total: fixedTax + bonusTax + nhi, mode, dependents };
}

const PAYROLL_MONTHLY_DAYS = 30;
const PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL = '天然災害停班';

function isNaturalDisasterLeaveDeductionLabel(label) {
    const s = String(label || '');
    return s === PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL || s === '颱風假' || s.indexOf('天然災害') >= 0;
}
const PAYROLL_DAILY_HOURS = 8;

function parsePayrollYmd(value) {
    if (value == null || value === '') return '';
    if (value instanceof Date && !isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const parts = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (parts) {
        return `${parts[1]}-${String(parts[2]).padStart(2, '0')}-${String(parts[3]).padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    return '';
}

/** 計薪期間內在職日曆天數（含到職日） */
function countEmployedCalendarDaysInPeriod(periodStart, periodEnd, hireDate, resignationDate) {
    const pStart = parsePayrollYmd(periodStart);
    const pEnd = parsePayrollYmd(periodEnd);
    const hire = parsePayrollYmd(hireDate);
    const resign = parsePayrollYmd(resignationDate);
    if (!pStart || !pEnd || pEnd < pStart) {
        return { employedDays: 0, periodDays: 0, coversFullPeriod: false, windowStart: '', windowEnd: '' };
    }
    let periodDays = 0;
    let employedDays = 0;
    let windowStart = '';
    let windowEnd = '';
    const start = new Date(pStart + 'T00:00:00');
    const end = new Date(pEnd + 'T00:00:00');
    for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        periodDays += 1;
        if (hire && dateStr < hire) continue;
        if (resign && dateStr > resign) continue;
        employedDays += 1;
        if (!windowStart) windowStart = dateStr;
        windowEnd = dateStr;
    }
    return {
        employedDays,
        periodDays,
        coversFullPeriod: employedDays > 0 && employedDays >= periodDays,
        windowStart,
        windowEnd
    };
}

/** 月薪本薪：全程在職＝完整底薪；中途＝底薪÷30×在職日 */
function calcProratedMonthlyBaseSalary(baseSalary, periodStart, periodEnd, hireDate, resignationDate) {
    const base = Number(baseSalary) || 0;
    const info = countEmployedCalendarDaysInPeriod(periodStart, periodEnd, hireDate, resignationDate);
    if (base <= 0) return Object.assign({ amount: 0, contractBase: 0 }, info);
    if (info.employedDays <= 0) return Object.assign({ amount: 0, contractBase: base }, info);
    if (info.coversFullPeriod) return Object.assign({ amount: base, contractBase: base }, info);
    return Object.assign({
        amount: Math.round(base / PAYROLL_MONTHLY_DAYS * info.employedDays),
        contractBase: base
    }, info);
}

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

function calcPayrollPayableDays(workPunchDays, stats, attendanceBonusPolicy) {
    const st = stats || {};
    const annual = Number(st.annualLeave) || 0;
    const comp = Number(st.compensatoryLeave) || 0;
    const sick = Number(st.sickLeave) || 0;
    const menstrual = Number(st.menstrualLeave) || 0;
    const policy = normalizeAttendanceBonusPolicy(attendanceBonusPolicy);
    const menstrualPart = policy === 'v2' ? menstrual : menstrual * 0.5;
    return (Number(workPunchDays) || 0) + annual + comp + sick * 0.5 + menstrualPart;
}

function calcProratedFullAttendance(maxBonus, absentDays) {
    const max = Number(maxBonus) || 0;
    const absent = Number(absentDays) || 0;
    if (max <= 0) return 0;
    if (absent <= 0) return max;
    return Math.max(0, max - Math.round(max / PAYROLL_MONTHLY_DAYS * absent));
}

/** 出勤獎金政策：legacy（預設）／v2；以後端 context.attendanceBonusPolicy 為準 */
function normalizeAttendanceBonusPolicy(policy) {
    return String(policy || '').toLowerCase() === 'v2' ? 'v2' : 'legacy';
}

/**
 * 出勤獎金雙軌（SPEC/22）
 * legacy：上限 −（上限÷30×缺勤）
 * v2：缺勤或事假→0；否則上限 −（上限÷30×普通病假）；生理假／颱風不扣
 */
function calcFullAttendanceBonus(policy, maxBonus, stats) {
    const max = Number(maxBonus) || 0;
    if (max <= 0) return 0;
    const st = stats || {};
    const pol = normalizeAttendanceBonusPolicy(policy);
    const specialCancel = Number(st.specialLeaveUnpaidCancelBonus) || 0;
    if (pol === 'v2') {
        const typhoon = Number(st.typhoonLeave) || 0;
        const specialPaid = Number(st.specialLeavePaid) || 0;
        const absent = Math.max(0, (Number(st.absent) || 0) - typhoon - specialPaid);
        const personal = Number(st.personalLeave) || 0;
        if (absent > 0 || personal > 0 || specialCancel > 0) return 0;
        const sick = Number(st.sickLeave) || 0;
        if (sick <= 0) return max;
        return Math.max(0, max - Math.round(max / PAYROLL_MONTHLY_DAYS * sick));
    }
    if (specialCancel > 0) return 0;
    return calcProratedFullAttendance(max, Number(st.absent) || 0);
}

function fullAttendanceBonusNote(policy, maxBonus, amount, stats) {
    const max = Number(maxBonus) || 0;
    const st = stats || {};
    const pol = normalizeAttendanceBonusPolicy(policy);
    if (max <= 0) return '';
    const specialCancel = Number(st.specialLeaveUnpaidCancelBonus) || 0;
    if (specialCancel > 0 && amount <= 0) {
        return `特別假（扣薪·獎金不發）${fmtPayrollDay(specialCancel)} 日，出勤獎金整筆不發（上限 ${max.toLocaleString()} 元）`;
    }
    if (pol === 'v2') {
        const typhoon = Number(st.typhoonLeave) || 0;
        const specialPaid = Number(st.specialLeavePaid) || 0;
        const absent = Math.max(0, (Number(st.absent) || 0) - typhoon - specialPaid);
        const personal = Number(st.personalLeave) || 0;
        const sick = Number(st.sickLeave) || 0;
        if (absent > 0) return `缺勤 ${fmtPayrollDay(absent)} 日，出勤獎金整筆不發（上限 ${max.toLocaleString()} 元）`;
        if (personal > 0) return `事假 ${fmtPayrollDay(personal)} 日，出勤獎金整筆不發（上限 ${max.toLocaleString()} 元）`;
        if (sick > 0 && amount < max) {
            return `上限 ${max.toLocaleString()}，普通病假 ${fmtPayrollDay(sick)} 日按比例扣`;
        }
        return '';
    }
    const absent = Number(st.absent) || 0;
    if (absent > 0 && amount < max && amount > 0) {
        return `上限 ${max.toLocaleString()}，缺勤 ${fmtPayrollDay(absent)} 日按比例扣`;
    }
    if (absent > 0 && amount <= 0) {
        return `缺勤 ${fmtPayrollDay(absent)} 日，出勤獎金未發（上限 ${max.toLocaleString()} 元）`;
    }
    return '';
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

function buildEmployerCostLines(employerCost) {
    const ec = employerCost || {};
    if (!(ec.total > 0) && !(ec.laborEmployer > 0)) return [];
    if (Array.isArray(ec.lines) && ec.lines.length) return ec.lines;
    const injuryPct = (Number(ec.occupationalInjuryRate) || 0) * 100;
    const avgDep = Number(ec.healthAvgDependents);
    const avgDepNote = Number.isFinite(avgDep)
        ? `60%×(1+平均眷口 ${avgDep})`
        : '60%×(1+平均眷口)';
    return [
        { label: '勞保雇主（70%）', amount: ec.laborEmployer || 0, note: '普通事故 11.5%×70%' },
        { label: '就保雇主（70%）', amount: ec.employmentInsurance || 0, note: '就業保險 1%×70%' },
        { label: '職災保險', amount: ec.occupationalInjury || 0, note: `行業費率 ${injuryPct}%（設定值）` },
        { label: '工資墊償基金', amount: ec.wageGuarantee || 0, note: '勞保投保薪資×0.025%' },
        { label: '健保雇主', amount: ec.healthEmployer || 0, note: avgDepNote },
        { label: '勞退提繳 6%', amount: ec.laborPensionEmployer || 0, note: '依勞退月提繳工資分級表' }
    ].filter((r) => (r.amount || 0) > 0);
}

function buildPayrollBreakdown(settings, payType, snapshot, input, insurancePreview, attendanceBonusPolicy, period, employerCostPreview) {
    const base = Number(settings.baseSalary) || 0;
    const remote = Number(input.remoteAllowanceAmount) || 0;
    const transport = Number(settings.transportationAllowance) || 0;
    const otherAllowance = Number(settings.otherAllowance) || 0;
    const ins = insurancePreview || { total: 0, labor: 0, health: 0, pension: 0, type: 'none' };
    const employerCost = employerCostPreview || ins.employerCost || (snapshot && snapshot.employerCost) || null;
    const companyCosts = buildEmployerCostLines(employerCost);
    const companyCostTotal = companyCosts.reduce((s, x) => s + (x.amount || 0), 0);
    const insDeduction = payType === 'daily' ? 0 : (ins.total || 0);
    const st = snapshot.stats || {};
    const policy = normalizeAttendanceBonusPolicy(attendanceBonusPolicy);
    const additions = [];
    const deductions = [];

    let earnedBase = base;
    let fullAttendanceBonus = 0;
    const maxFullAttendance = Number(settings.fullAttendanceBonusMax) || 0;
    let personalLeaveDeduction = 0;
    let sickLeaveDeduction = 0;
    let absentBaseDeduction = 0;
    let employedDaysInPeriod = 0;
    let coversFullPeriod = true;
    if (payType === 'daily') {
        const days = Number(snapshot.daysWorked) || 0;
        const personalLeave = Number(st.personalLeave) || 0;
        const workPunchDays = snapshot.workPunchDays != null ? snapshot.workPunchDays : days;
        earnedBase = base * days;
        personalLeaveDeduction = calcPersonalLeaveDeduction(base, personalLeave, payType);
        const annual = Number(st.annualLeave) || 0;
        const comp = Number(st.compensatoryLeave) || 0;
        const sick = Number(st.sickLeave) || 0;
        const menstrual = Number(st.menstrualLeave) || 0;
        const dayParts = [`打卡 ${fmtPayrollDay(workPunchDays)} 天`];
        if (annual > 0) dayParts.push(`特休 ${fmtPayrollDay(annual)} 天`);
        if (comp > 0) dayParts.push(`補休 ${fmtPayrollDay(comp)} 天`);
        if (sick > 0) dayParts.push(`病假 ${fmtPayrollDay(sick)} 天（半薪）`);
        if (menstrual > 0) dayParts.push(`生理假 ${fmtPayrollDay(menstrual)} 天`);
        const dayNote = personalLeave > 0
            ? `${dayParts.join('＋')}；事假 ${fmtPayrollDay(personalLeave)} 日另列減項`
            : `${dayParts.join('＋')} × ${base.toLocaleString()} 元／日`;
        additions.push({
            label: '本薪（日薪 × 計薪天數）',
            amount: earnedBase,
            note: dayNote
        });
    } else {
        const typhoon = Number(st.typhoonLeave) || 0;
        const specialPaid = Number(st.specialLeavePaid) || 0;
        const specialCancel = Number(st.specialLeaveUnpaidCancelBonus) || 0;
        const specialKeep = Number(st.specialLeaveUnpaidKeepBonus) || 0;
        const specialUnpaid = specialCancel + specialKeep;
        const rawAbsent = Number(st.absent) || 0;
        const absent = policy === 'v2'
            ? Math.max(0, rawAbsent - typhoon - specialPaid)
            : rawAbsent;
        const personalLeave = Number(st.personalLeave) || 0;
        const sickLeave = Number(st.sickLeave) || 0;
        const menstrualLeave = Number(st.menstrualLeave) || 0;
        /** legacy：生理假仍併入病假扣本薪；v2：生理假不扣本薪（半薪） */
        const sickForDeduction = policy === 'v2' ? sickLeave : sickLeave + menstrualLeave;
        absentBaseDeduction = calcAbsentBaseDeduction(base, absent);
        personalLeaveDeduction = calcPersonalLeaveDeduction(base, personalLeave, payType);
        const specialLeaveDeduction = calcPersonalLeaveDeduction(base, specialUnpaid, payType);
        sickLeaveDeduction = calcSickLeaveDeduction(base, sickForDeduction, payType);
        const typhoonLeaveDeduction = calcPersonalLeaveDeduction(base, typhoon, payType);
        const prorate = calcProratedMonthlyBaseSalary(
            base,
            period && period.periodStart,
            period && period.periodEnd,
            settings.hireDate,
            settings.resignationDate
        );
        earnedBase = prorate.amount;
        employedDaysInPeriod = prorate.employedDays;
        coversFullPeriod = !!prorate.coversFullPeriod;
        const bonusStats = {
            absent: rawAbsent,
            personalLeave,
            sickLeave,
            typhoonLeave: typhoon,
            specialLeavePaid: specialPaid,
            specialLeaveUnpaidCancelBonus: specialCancel,
            specialLeaveUnpaidKeepBonus: specialKeep
        };
        fullAttendanceBonus = calcFullAttendanceBonus(policy, maxFullAttendance, bonusStats);
        const baseNote = coversFullPeriod
            ? '完整底薪（假別另列減項）'
            : `底薪 ${base.toLocaleString()} ÷30 × 在職 ${fmtPayrollDay(employedDaysInPeriod)} 日`;
        additions.push({ label: '本薪', amount: earnedBase, note: baseNote });
        const faNote = fullAttendanceBonusNote(policy, maxFullAttendance, fullAttendanceBonus, bonusStats);
        if (fullAttendanceBonus > 0) {
            additions.push({ label: '出勤獎金', amount: fullAttendanceBonus, note: faNote });
        } else if (maxFullAttendance > 0 && faNote) {
            deductions.push({
                label: '出勤獎金',
                amount: 0,
                note: faNote
            });
        }
        // 有事假優先列事假；真正缺勤才列缺勤（勿用笼统「缺勤」蓋過假別）
        if (personalLeave > 0 || personalLeaveDeduction > 0) {
            deductions.push({
                label: '事假扣款',
                amount: personalLeaveDeduction,
                note: `事假 ${fmtPayrollDay(personalLeave)} 日（底薪÷30）`
            });
        }
        if ((absent > 0 || absentBaseDeduction > 0) && !(personalLeave > 0 && absent <= 0)) {
            deductions.push({
                label: '缺勤扣款',
                amount: absentBaseDeduction,
                note: `缺勤 ${fmtPayrollDay(absent)} 日（底薪÷30）`
            });
        }
        if (specialUnpaid > 0 || specialLeaveDeduction > 0) {
            deductions.push({
                label: '特別假扣款',
                amount: specialLeaveDeduction,
                note: `扣薪特別假 ${fmtPayrollDay(specialUnpaid)} 日（底薪÷30）` +
                    (specialCancel > 0 ? `；其中獎金不發 ${fmtPayrollDay(specialCancel)} 日` : '') +
                    (specialKeep > 0 ? `；其中獎金照舊 ${fmtPayrollDay(specialKeep)} 日` : '')
            });
        }
        if (sickForDeduction > 0 || sickLeaveDeduction > 0) {
            deductions.push({
                label: '病假扣款（半薪）',
                amount: sickLeaveDeduction,
                note: policy === 'v2'
                    ? `病假 ${fmtPayrollDay(sickLeave)} 日 × 0.5（底薪÷30）`
                    : `病假 ${fmtPayrollDay(sickForDeduction)} 日 × 0.5（底薪÷30）`
            });
        }
        if (policy === 'v2' && menstrualLeave > 0) {
            deductions.push({
                label: '生理假',
                amount: 0,
                note: `生理假 ${fmtPayrollDay(menstrualLeave)} 日；不扣出勤獎金`
            });
        }
        if (specialPaid > 0) {
            deductions.push({
                label: '特別假（不扣薪）',
                amount: 0,
                note: `特別假 ${fmtPayrollDay(specialPaid)} 日；本薪照給、不扣出勤獎金`
            });
        }
        if (typhoon > 0 || typhoonLeaveDeduction > 0) {
            deductions.push({
                label: PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL,
                amount: typhoonLeaveDeduction,
                note: `${PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL} ${fmtPayrollDay(typhoon)} 日（不支薪；底薪÷30）`
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
    const typhoonDaily = Number(st.typhoonLeave) || 0;
    if (payType === 'daily' && typhoonDaily > 0) {
        const typhoonDailyDed = calcPersonalLeaveDeduction(base, typhoonDaily, payType);
        if (typhoonDailyDed > 0) {
            deductions.push({
                label: PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL,
                amount: typhoonDailyDed,
                note: `${PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL} ${fmtPayrollDay(typhoonDaily)} 日（不支薪；日薪×天數）`
            });
        }
    }

    // 稅基＝加項 − 假勤／遲到等薪資減項（不含勞健保／稅本身）
    const nonTaxDedLabels = {
        '勞健保／勞退': 1,
        '勞健保／勞退自付': 1,
        '所得稅扣繳（固定薪）': 1,
        '所得稅扣繳（非固定獎金）': 1,
        '二代健保補充保費': 1,
        '其他扣款': 1
    };
    const salaryDedSum = deductions
        .filter((d) => !nonTaxDedLabels[d.label])
        .reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const addSumForTax = additions.reduce((s, x) => s + (x.amount || 0), 0);
    const taxGross = Math.max(0, addSumForTax - salaryDedSum);
    const taxBundle = calcPayrollTaxBundleClient_(settings, taxGross, Number(input.bonusAmount) || 0);
    if (taxBundle.fixedSalaryTax > 0) {
        deductions.push({
            label: '所得稅扣繳（固定薪）',
            amount: taxBundle.fixedSalaryTax,
            note: taxBundle.mode === 'table' ? `依扣繳稅額表（配偶及受扶養 ${taxBundle.dependents}）` : '固定 5%'
        });
    }
    if (taxBundle.bonusTax > 0) {
        deductions.push({ label: '所得稅扣繳（非固定獎金）', amount: taxBundle.bonusTax, note: '非固定獎金 5%' });
    }
    if (taxBundle.nhiSupplementary > 0) {
        deductions.push({ label: '二代健保補充保費', amount: taxBundle.nhiSupplementary, note: '獎金超過投保 4 倍部分 × 2.11%' });
    }

    deductions.push({ label: '其他扣款', amount: 0, note: '主管審核時填入（員工送審時為 0）' });

    const addTotal = additions.reduce((s, x) => s + (x.amount || 0), 0);
    const dedTotal = deductions.reduce((s, x) => s + (x.amount || 0), 0);
    const estimatedNet = Math.round(addTotal - dedTotal);
    const autoRemarkParts = deductions
        .filter((d) => d.label !== '其他扣款' && d.label !== '勞健保／勞退' && (d.amount > 0 || isNaturalDisasterLeaveDeductionLabel(d.label) || d.label === '生理假' || d.label === '特別假（不扣薪）' || (d.label === '出勤獎金' && d.amount === 0)))
        .map((d) => {
            if (d.amount > 0) return `${d.label} −${d.amount.toLocaleString()}`;
            return d.note || d.label;
        });
    return {
        additions, deductions, addTotal, dedTotal, estimatedNet,
        companyCosts, companyCostTotal,
        baseSalary: earnedBase, fullAttendanceBonus, transportationAllowance: transport,
        otherAllowance, overtimePay, insurance: ins, employerCost,
        attendanceBonusPolicy: policy,
        employedDaysInPeriod, coversFullPeriod,
        autoRemark: autoRemarkParts.join('；')
    };
}

function renderCompanyCostHtml(companyCosts, companyCostTotal, esc) {
    const escFn = esc || escPayrollHtml;
    const rows = (companyCosts || []).filter((r) => (r.amount || 0) > 0);
    if (!rows.length) return '';
    const lis = rows.map((row) => {
        const note = row.note ? `<span class="text-gray-500">（${escFn(row.note)}）</span>` : '';
        return `<li class="flex justify-between gap-2 py-0.5"><span>${escFn(row.label)}${note}</span><span class="font-medium text-slate-700">${Number(row.amount).toLocaleString()}</span></li>`;
    }).join('');
    return `
        <div class="bg-slate-50 rounded-lg p-2 border border-slate-200 mt-3">
            <p class="text-xs font-bold text-slate-800 mb-1">公司成本（雇主負擔・不影響實發）</p>
            <ul class="text-sm space-y-0.5">${lis}</ul>
            <p class="text-xs text-right text-slate-800 mt-2 font-semibold">小計 ${Number(companyCostTotal || 0).toLocaleString()} 元</p>
        </div>
    `;
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
        ${renderCompanyCostHtml(breakdown.companyCosts, breakdown.companyCostTotal, escFn)}
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
    return buildProjectRewardHtml(drafts, esc);
}

function buildProjectRewardHtml(drafts, esc) {
    const escFn = esc || escPayrollHtml;
    if (!drafts || !drafts.length) return '';
    const rows = drafts.map((d) => {
        const note = d.note ? `（${escFn(d.note)}）` : '';
        const start = d.start_date ? escFn(d.start_date) : '—';
        const close = d.close_date ? escFn(d.close_date) : '—';
        return `<li class="py-1 border-b border-amber-100 last:border-0">
            <div class="flex justify-between gap-2"><span>案號 ${escFn(d.project_no)}</span><span class="font-medium">${Number(d.amount || 0).toLocaleString()} 元</span></div>
            <p class="text-xs text-gray-500">開始施工 ${start} · 結案 ${close}${note}</p>
        </li>`;
    }).join('');
    const total = drafts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    return `<div class="text-amber-900 bg-amber-50 rounded p-2 text-sm mt-2 border border-amber-100">
        <p class="font-semibold">專案報酬（合計 ${total.toLocaleString()} 元）</p>
        <ul class="mt-1">${rows}</ul>
        <p class="text-xs text-amber-800 mt-1">僅供對照，不併入本月薪資實發；另簽收另付。</p>
    </div>`;
}

function readOvertimeDailyRowsFromContainer(rowsEl) {
    if (!rowsEl) return [];
    return [...rowsEl.querySelectorAll('[data-ot-date]')].map((inp) => ({
        date: inp.getAttribute('data-ot-date') || '',
        hours: Number(inp.value) || 0
    })).filter((r) => r.date);
}

function renderOvertimeDailyRowInputs(rowsEl, rows, escFn) {
    if (!rowsEl) return;
    const esc = escFn || escPayrollHtml;
    if (!rows.length) {
        rowsEl.innerHTML = '<p class="text-xs text-gray-500">報表無逐日加班資料；請確認上方加班小時數，或請主管協助代開審。</p>';
        return;
    }
    rowsEl.innerHTML = rows.map((r) => `
        <label class="flex items-center gap-2 text-sm">
            <span class="w-28 shrink-0 text-gray-600">${esc(r.date)}</span>
            <input type="number" min="0" step="0.5" class="payroll-ot-day-input flex-1 rounded-md border-gray-300 sm:text-sm"
                data-ot-date="${esc(r.date)}" value="${Number(r.hours) || 0}" />
            <span class="text-xs text-gray-500 shrink-0">小時</span>
        </label>
    `).join('');
}

function applyOvertimeFeedbackEl(warnEl, blockMsg, warnMsg) {
    if (!warnEl) return;
    warnEl.classList.remove(
        'hidden', 'text-red-700', 'bg-red-50', 'border-red-100',
        'text-amber-900', 'bg-amber-50', 'border-amber-200'
    );
    const text = blockMsg || warnMsg;
    if (!text) {
        warnEl.textContent = '';
        warnEl.classList.add('hidden');
        return;
    }
    warnEl.textContent = text;
    warnEl.classList.remove('hidden');
    if (blockMsg) {
        warnEl.classList.add('text-red-700', 'bg-red-50', 'border-red-100');
    } else {
        warnEl.classList.add('text-amber-900', 'bg-amber-50', 'border-amber-200');
    }
}

function syncOvertimeDailyUi(state) {
    const {
        wrapEl, rowsEl, sumEl, warnEl, rows,
        overtimeHours, overtimeNote, overtimeDays, snapshot, readOnly
    } = state;
    const otH = Number(overtimeHours) || 0;
    if (wrapEl) wrapEl.classList.toggle('hidden', otH <= 0);
    if (otH <= 0) {
        applyOvertimeFeedbackEl(warnEl, '', '');
        return { validation: { ok: true }, dailyObject: {} };
    }
    const currentRows = readOnly ? rows : readOvertimeDailyRowsFromContainer(rowsEl);
    const dailyObject = overtimeDailyRowsToObject(currentRows);
    const dailyMin = sumOvertimeDailyMinutes(dailyObject);
    if (sumEl) {
        sumEl.textContent = `每日合計：${payrollOvertimeMinutesToHours(dailyMin)} 小時（${dailyMin} 分）`;
    }
    const submitCheck = validatePayrollOvertimeSubmit({
        overtimeHours: otH,
        overtimeNote: String(overtimeNote || '').trim(),
        overtimeDays,
        snapshot,
        overtimeDailyHours: dailyObject
    });
    let blockMsg = '';
    let warnMsg = '';
    if (submitCheck.block && submitCheck.message) {
        blockMsg = submitCheck.message;
    } else if (submitCheck.warn && submitCheck.message) {
        warnMsg = submitCheck.message;
    } else if (!submitCheck.ok) {
        blockMsg = submitCheck.message || overtimeDailyMismatchMessage(
            validatePayrollOvertimeDailyHours({
                overtimeHours: otH,
                overtimeDays,
                overtimeDailyHours: dailyObject,
                reportOvertimeMinutes: reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays)
            })
        );
    }
    applyOvertimeFeedbackEl(warnEl, blockMsg, warnMsg);
    const validation = validatePayrollOvertimeDailyHours({
        overtimeHours: otH,
        overtimeDays,
        overtimeDailyHours: dailyObject,
        reportOvertimeMinutes: reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays)
    });
    return { validation, dailyObject, dailyTotal: payrollOvertimeMinutesToHours(dailyMin), submitCheck };
}

function collectOvertimeSubmitFields(els, snapshot) {
    const overtimeHours = Number(els.overtimeHours?.value) || 0;
    const overtimeNote = String(els.overtimeNote?.value || '').trim();
    const overtimeDays = Number(snapshot?.stats?.overtimeDays) || 0;
    const rows = readOvertimeDailyRowsFromContainer(els.overtimeDailyRows);
    const dailyObject = overtimeDailyRowsToObject(rows);
    const result = validatePayrollOvertimeSubmit({
        overtimeHours,
        overtimeNote,
        overtimeDays,
        snapshot,
        overtimeDailyHours: dailyObject
    });
    if (!result.ok) {
        return { ok: false, message: result.message || '加班資料不符，無法送出' };
    }
    return { ok: true, payload: result.payload, warn: result.warn, message: result.message };
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
        refreshBtn: document.getElementById('payroll-refresh-btn'),
        overtimeDailyWrap: document.getElementById('payroll-overtime-daily-wrap'),
        overtimeDailyRows: document.getElementById('payroll-overtime-daily-rows'),
        overtimeDailySum: document.getElementById('payroll-overtime-daily-sum'),
        overtimeDailyWarn: document.getElementById('payroll-overtime-daily-warn')
    };

    if (!els.periodSelect) return;

    let contextData = null;
    let payrollLoaded = false;
    let submitGateTimer = null;
    let employeeOvertimeDailyRows = [];
    let overtimeDailyUiInitialized = false;

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
                ${(Number(st.menstrualLeave) > 0) ? `<p><strong>生理假：</strong>${fmtPayrollDay(st.menstrualLeave)} 天</p>` : ''}
                ${(Number(st.typhoonLeave) > 0) ? `<p><strong>${PAYROLL_NATURAL_DISASTER_DEDUCTION_LABEL}：</strong>${fmtPayrollDay(st.typhoonLeave)} 天（不支薪）</p>` : ''}
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
        }, contextData.insurancePreview, contextData.attendanceBonusPolicy, period, contextData.employerCostPreview);
        els.calcBox.innerHTML = renderBreakdownHtml(preview, disclaimer, settings, period.payType, esc);
        if (els.supplement && !els.supplement.dataset.userEdited) {
            const existingNote = existingReview ? String(existingReview.supplementNote || '').trim() : '';
            if (existingNote) {
                els.supplement.value = existingNote;
            } else if (preview.autoRemark) {
                els.supplement.value = preview.autoRemark;
            }
        }

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
        refreshEmployeeOvertimeDailyUi();
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
        const otFields = collectOvertimeSubmitFields(els, contextData.snapshot);
        if (!otFields.ok) {
            alert(otFields.message);
            refreshEmployeeOvertimeDailyUi();
            return;
        }
        els.submitBtn.disabled = true;
        els.submitBtn.textContent = '送出中…';
        try {
            const payload = {
                action: 'payroll_review', op: 'submit',
                operatorId: userId, userName,
                periodLabel: contextData.period.periodLabel,
                ...otFields.payload,
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

    function refreshEmployeeOvertimeDailyUi() {
        if (!contextData) return;
        const st = contextData.snapshot?.stats || {};
        const otH = Number(els.overtimeHours?.value) || 0;
        const reportMin = reportOvertimeMinutesFromSnapshot(contextData.snapshot, st.overtimeDays);
        if (!els.overtimeHours?.dataset.userEdited && !overtimeDailyUiInitialized) {
            employeeOvertimeDailyRows = mergeOvertimeDailyRows(contextData.snapshot, employeeOvertimeDailyRows);
            if (reportMin > 0 && els.overtimeHours) {
                els.overtimeHours.value = String(payrollOvertimeMinutesToHours(reportMin));
            } else {
                const sum = sumOvertimeDailyRows(employeeOvertimeDailyRows);
                if (sum > 0 && els.overtimeHours) els.overtimeHours.value = String(sum);
            }
        }
        renderOvertimeDailyRowInputs(els.overtimeDailyRows, employeeOvertimeDailyRows, esc);
        syncOvertimeDailyUi({
            wrapEl: els.overtimeDailyWrap,
            rowsEl: els.overtimeDailyRows,
            sumEl: els.overtimeDailySum,
            warnEl: els.overtimeDailyWarn,
            rows: employeeOvertimeDailyRows,
            overtimeHours: otH,
            overtimeNote: els.overtimeNote?.value,
            overtimeDays: st.overtimeDays,
            snapshot: contextData.snapshot,
            readOnly: false
        });
        overtimeDailyUiInitialized = true;
    }

    els.periodSelect.addEventListener('change', () => {
        if (els.supplement) delete els.supplement.dataset.userEdited;
        if (els.overtimeHours) delete els.overtimeHours.dataset.userEdited;
        employeeOvertimeDailyRows = [];
        overtimeDailyUiInitialized = false;
        fetchContext(els.periodSelect.value);
    });
    els.refreshBtn.addEventListener('click', () => {
        payrollLoaded = false;
        if (els.supplement) delete els.supplement.dataset.userEdited;
        if (els.overtimeHours) delete els.overtimeHours.dataset.userEdited;
        employeeOvertimeDailyRows = [];
        overtimeDailyUiInitialized = false;
        fetchContext(els.periodSelect.value);
    });
    els.submitBtn.addEventListener('click', submitReview);
    if (els.supplement) {
        els.supplement.addEventListener('input', () => {
            els.supplement.dataset.userEdited = '1';
        });
    }
    ['input', 'change'].forEach((ev) => {
        els.overtimeHours?.addEventListener(ev, () => {
            if (els.overtimeHours) els.overtimeHours.dataset.userEdited = '1';
            if (contextData) {
                renderContext();
                refreshEmployeeOvertimeDailyUi();
            }
        });
        els.remoteAmount.addEventListener(ev, () => { if (contextData) renderContext(); });
        els.overtimeNote?.addEventListener(ev, () => { if (contextData) refreshEmployeeOvertimeDailyUi(); });
    });
    els.overtimeDailyRows?.addEventListener('input', (e) => {
        if (!e.target.classList?.contains('payroll-ot-day-input')) return;
        employeeOvertimeDailyRows = readOvertimeDailyRowsFromContainer(els.overtimeDailyRows);
        refreshEmployeeOvertimeDailyUi();
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

function formatPayslipDisplayDate(detail) {
    const paid = String(detail.paidAt || (detail.snapshot && detail.snapshot.paidAt) || '').slice(0, 10);
    if (paid) return '入帳 ' + paid;
    const scheduled = String(detail.displayPayDate || detail.payDate || '').slice(0, 10);
    return scheduled ? '發薪 ' + scheduled : '';
}

function renderPayslipDetailHtml(detail, esc) {
    const snap = detail.snapshot || {};
    const earnings = snap.earnings || [];
    const deductions = snap.deductions || [];
    const companyCosts = snap.companyCosts || buildEmployerCostLines(snap.employerCost) || [];
    const companyCostTotal = companyCosts.reduce((s, x) => s + (Number(x.amount) || 0), 0) ||
        Number(snap.employerCost && snap.employerCost.total) || 0;
    const earnRows = earnings.filter((e) => (e.amount || 0) > 0).map((e) => {
        const note = e.note ? `<span class="text-gray-500 text-xs">（${esc(e.note)}）</span>` : '';
        return `<li class="flex justify-between gap-2"><span>${esc(e.label)}${note}</span><span class="text-green-700">+${Number(e.amount).toLocaleString()}</span></li>`;
    }).join('') || '<li class="text-gray-400">—</li>';
    const dedRows = deductions.filter((d) => (d.amount || 0) > 0 || isNaturalDisasterLeaveDeductionLabel(d.label)).map((d) => {
        const note = d.note ? `<span class="block text-gray-500 text-xs">${esc(d.note)}</span>` : '';
        const amtText = (d.amount || 0) > 0 ? `−${Number(d.amount).toLocaleString()}` : '—';
        return `<li class="py-1"><div class="flex justify-between gap-2"><span>${esc(d.label)}</span><span class="text-red-600">${amtText}</span></div>${note}</li>`;
    }).join('') || '<li class="text-gray-400">—</li>';
    return `
        <div class="bg-white border border-gray-200 rounded-lg p-4 text-sm space-y-3">
            <div class="flex justify-between items-start gap-2">
                <div>
                    <p class="font-bold text-gray-800">${esc(detail.periodLabel)} 薪資明細</p>
                    <p class="text-xs text-gray-500">${esc(detail.periodStart)}～${esc(detail.periodEnd)} · ${esc(formatPayslipDisplayDate(detail))}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">已發放</span>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
                <div><p class="text-xs font-bold text-green-800 mb-1">加項</p><ul class="space-y-1">${earnRows}</ul></div>
                <div><p class="text-xs font-bold text-red-800 mb-1">扣項</p><ul>${dedRows}</ul></div>
            </div>
            ${renderCompanyCostHtml(companyCosts, companyCostTotal, esc)}
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
                <span><strong>${esc(row.periodLabel)}</strong><span class="text-xs text-gray-500 block">${esc(row.periodStart)}～${esc(row.periodEnd)} · ${esc(formatPayslipDisplayDate(row))}</span></span>
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
                <label class="text-xs">獎金（元）<input type="number" id="pr-bonus-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" value="0"></label>
                <label class="text-xs col-span-2">獎金類別<select id="pr-bonus-cat-${row.reviewId}" class="w-full rounded border-gray-300 text-sm">
                    <option value="">選擇類別</option>
                    <option value="position">職務加給</option>
                    <option value="license">證照加給</option>
                    <option value="performance">業績</option>
                    <option value="close">結案</option>
                    <option value="quarterly">季獎</option>
                    <option value="video">影片獎金</option>
                    <option value="other">其他獎金</option>
                </select></label>
                <label class="text-xs col-span-2">獎金備註<input type="text" id="pr-bonus-reason-${row.reviewId}" class="w-full rounded border-gray-300 text-sm" placeholder="選填（勿填專案報酬）"></label>
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
        const bonusAmount = Number(document.getElementById(`pr-bonus-${reviewId}`)?.value) || 0;
        const bonusCategory = document.getElementById(`pr-bonus-cat-${reviewId}`)?.value.trim() || '';
        if (decision === 'approve' && bonusAmount > 0 && !bonusCategory) {
            alert('有填獎金金額時請選擇獎金類別');
            return;
        }
        const payload = {
            action: 'payroll_review', op: 'resolve',
            operatorId: userProfile.userId, userName: userProfile.displayName,
            reviewId, decision,
            reviewNote: note,
            bonusAmount,
            bonusCategory,
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
    const okEl = document.getElementById('payroll-admin-ok');
    const calcBox = document.getElementById('payroll-admin-calc');
    const statsBox = document.getElementById('payroll-admin-stats');
    const titleEl = document.getElementById('payroll-admin-title');
    const submitBtn = document.getElementById('payroll-admin-submit-btn');
    const overtimeFieldsWrap = document.getElementById('payroll-admin-overtime-fields');
    const adminOvertimeEls = {
        overtimeHours: document.getElementById('payroll-admin-overtime-hours'),
        overtimeNote: document.getElementById('payroll-admin-overtime-note'),
        overtimeDailyWrap: document.getElementById('payroll-admin-overtime-daily-wrap'),
        overtimeDailyRows: document.getElementById('payroll-admin-overtime-daily-rows'),
        overtimeDailySum: document.getElementById('payroll-admin-overtime-daily-sum'),
        overtimeDailyWarn: document.getElementById('payroll-admin-overtime-daily-warn')
    };
    if (!wrap || !empSelect || !periodSelect) return null;

    wrap.classList.remove('hidden');
    let adminContext = null;
    let adminOvertimeDailyRows = [];
    let adminOvertimeUiInitialized = false;

    function esc(s) { return escPayrollHtml(s); }

    function refreshAdminOvertimeDailyUi() {
        if (!adminContext) return;
        const st = adminContext.snapshot?.stats || {};
        const otH = Number(adminOvertimeEls.overtimeHours?.value) || 0;
        if (!adminOvertimeEls.overtimeHours?.dataset.userEdited && !adminOvertimeUiInitialized) {
            adminOvertimeDailyRows = mergeOvertimeDailyRows(adminContext.snapshot, adminOvertimeDailyRows);
            const reportMin = reportOvertimeMinutesFromSnapshot(adminContext.snapshot, st.overtimeDays);
            if (reportMin > 0 && adminOvertimeEls.overtimeHours) {
                adminOvertimeEls.overtimeHours.value = String(payrollOvertimeMinutesToHours(reportMin));
            } else {
                const sum = sumOvertimeDailyRows(adminOvertimeDailyRows);
                if (sum > 0 && adminOvertimeEls.overtimeHours) adminOvertimeEls.overtimeHours.value = String(sum);
            }
        }
        renderOvertimeDailyRowInputs(adminOvertimeEls.overtimeDailyRows, adminOvertimeDailyRows, esc);
        syncOvertimeDailyUi({
            wrapEl: adminOvertimeEls.overtimeDailyWrap,
            rowsEl: adminOvertimeEls.overtimeDailyRows,
            sumEl: adminOvertimeEls.overtimeDailySum,
            warnEl: adminOvertimeEls.overtimeDailyWarn,
            rows: adminOvertimeDailyRows,
            overtimeHours: otH,
            overtimeNote: adminOvertimeEls.overtimeNote?.value,
            overtimeDays: st.overtimeDays,
            snapshot: adminContext.snapshot,
            readOnly: false
        });
        adminOvertimeUiInitialized = true;
    }

    async function managerSubmit() {
        if (!adminContext?.period || !empSelect.value) return;
        if (adminContext.existingReview) {
            alert('此期別已有申請');
            return;
        }
        const otFields = collectOvertimeSubmitFields(adminOvertimeEls, adminContext.snapshot);
        if (!otFields.ok) {
            alert(otFields.message);
            refreshAdminOvertimeDailyUi();
            return;
        }
        if (!confirm(`確定為「${adminContext.previewEmployee?.userName || ''}」代開審 ${adminContext.period.periodLabel}？`)) return;
        submitBtn.disabled = true;
        okEl?.classList.add('hidden');
        errorEl?.classList.add('hidden');
        try {
            const payload = {
                action: 'payroll_review',
                op: 'manager_submit',
                operatorId,
                targetUserId: empSelect.value,
                periodLabel: adminContext.period.periodLabel,
                ...otFields.payload,
                remoteAllowanceAmount: 0,
                supplementNote: ''
            };
            const res = await fetch(apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.message || '代開審失敗');
            if (okEl) {
                okEl.textContent = json.message || '已代開審';
                okEl.classList.remove('hidden');
            }
            showGlobalNotification?.(json.message || '已代開審並送會計待審', 5000, 'success');
            await loadPreview();
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || '代開審失敗';
                errorEl.classList.remove('hidden');
            }
            submitBtn.disabled = false;
        }
    }

    async function loadPreview() {
        const targetUserId = empSelect.value;
        if (!targetUserId) {
            calcBox.innerHTML = '<p class="text-gray-500 text-sm">請先選擇單一員工</p>';
            statsBox.innerHTML = '';
            overtimeFieldsWrap?.classList.add('hidden');
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
            overtimeFieldsWrap?.classList.remove('hidden');
            const empName = adminContext.previewEmployee?.userName || empSelect.selectedOptions[0]?.textContent || '';
            if (titleEl) titleEl.textContent = `${empName} — 薪資試算（可代開審）`;
            periodSelect.innerHTML = (adminContext.periods || []).map((p) => {
                const tag = p.displayLabel || p.periodLabel;
                return `<option value="${esc(p.periodLabel)}" ${p.periodLabel === adminContext.period.periodLabel ? 'selected' : ''}>${esc(tag)}</option>`;
            }).join('');
            const st = adminContext.snapshot?.stats || {};
            const isDaily = adminContext.period.payType === 'daily';
            const snap = adminContext.snapshot || {};
            const anomalyBlock = renderAnomalyDaysHtml(snap.dayAnomalies, esc);
            const existing = adminContext.existingReview;
            statsBox.innerHTML = isDaily
                ? `<p><strong>本期出勤（計薪）：</strong>${snap.daysWorked || 0} 天</p>
                   <p><strong>遲到／早退：</strong>${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                   <p class="text-xs text-gray-500">本薪＝日薪×計薪天數；假別／缺勤另列減項</p>
                   ${anomalyBlock}`
                : `<p><strong>實際出勤：</strong>${st.checkInDays ?? '—'} 天 · 遲早退 ${st.lateMinutes ?? 0}／${st.earlyMinutes ?? 0} 分</p>
                   <p><strong>缺勤／事假／病假／天然災害停班：</strong>${fmtPayrollDay(st.absent)}／${fmtPayrollDay(st.personalLeave)}／${fmtPayrollDay(st.sickLeave)}／${fmtPayrollDay(st.typhoonLeave)}</p>
                   ${anomalyBlock}`;
            const preview = buildPayrollBreakdown(
                adminContext.settings,
                adminContext.period.payType,
                adminContext.snapshot,
                {
                    remoteAllowanceAmount: 0,
                    overtimeHours: Number(adminOvertimeEls.overtimeHours?.value) || 0
                },
                adminContext.insurancePreview,
                adminContext.attendanceBonusPolicy,
                adminContext.period,
                adminContext.employerCostPreview
            );
            let html = renderBreakdownHtml(preview, adminContext.disclaimer, adminContext.settings, adminContext.period.payType, esc);
            html += renderMarginBonusDraftsHtml(adminContext.marginBonusDrafts, esc);
            if (existing) {
                html += `<p class="text-amber-800 bg-amber-50 rounded p-2 mt-2 text-sm">此期別已有「${esc(existing.status)}」申請，無需再代開審。</p>`;
            }
            calcBox.innerHTML = html;
            if (submitBtn) {
                submitBtn.disabled = !!existing;
                submitBtn.title = existing ? '此期別已有申請' : '';
            }
            refreshAdminOvertimeDailyUi();
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = err.message || '載入失敗';
                errorEl.classList.remove('hidden');
            }
        } finally {
            loadingEl?.classList.add('hidden');
        }
    }

    function resetAdminOvertimeUi() {
        adminOvertimeDailyRows = [];
        adminOvertimeUiInitialized = false;
        if (adminOvertimeEls.overtimeHours) {
            adminOvertimeEls.overtimeHours.value = '0';
            delete adminOvertimeEls.overtimeHours.dataset.userEdited;
        }
        if (adminOvertimeEls.overtimeNote) adminOvertimeEls.overtimeNote.value = '';
    }

    periodSelect.addEventListener('change', () => {
        resetAdminOvertimeUi();
        loadPreview();
    });
    empSelect.addEventListener('change', () => {
        resetAdminOvertimeUi();
        loadPreview();
    });
    ['input', 'change'].forEach((ev) => {
        adminOvertimeEls.overtimeHours?.addEventListener(ev, () => {
            if (adminOvertimeEls.overtimeHours) adminOvertimeEls.overtimeHours.dataset.userEdited = '1';
            if (adminContext) refreshAdminOvertimeDailyUi();
        });
        adminOvertimeEls.overtimeNote?.addEventListener(ev, () => {
            if (adminContext) refreshAdminOvertimeDailyUi();
        });
    });
    adminOvertimeEls.overtimeDailyRows?.addEventListener('input', (e) => {
        if (!e.target.classList?.contains('payroll-ot-day-input')) return;
        adminOvertimeDailyRows = readOvertimeDailyRowsFromContainer(adminOvertimeEls.overtimeDailyRows);
        refreshAdminOvertimeDailyUi();
    });
    submitBtn?.addEventListener('click', managerSubmit);
    return { refresh: loadPreview };
}
