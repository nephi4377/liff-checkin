/**
 * 薪資送審：每日加班時數（對齊後端 overtimeDailyHours / snapshot.payrollDailyOvertime）
 */

export const PAYROLL_OVERTIME_HOURS_PER_DAY = 8;

export function hoursToPayrollOvertimeMinutes(hours) {
    return Math.round((Number(hours) || 0) * 60);
}

export function payrollOvertimeMinutesToHours(minutes) {
    return (Number(minutes) || 0) / 60;
}

/** 報表加班總分鐘（優先 snapshot.reportOvertimeMinutes，否則 overtimeDays×8h） */
export function reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays, hoursPerDay) {
    if (snapshot && snapshot.reportOvertimeMinutes != null && snapshot.reportOvertimeMinutes !== '') {
        return Math.round(Number(snapshot.reportOvertimeMinutes));
    }
    const hpd = Number(hoursPerDay) || PAYROLL_OVERTIME_HOURS_PER_DAY;
    return hoursToPayrollOvertimeMinutes((Number(overtimeDays) || 0) * hpd);
}

export function enteredOvertimeDiffersFromReport(overtimeHours, snapshot, overtimeDays, hoursPerDay) {
    const enteredMin = hoursToPayrollOvertimeMinutes(overtimeHours);
    const reportMin = reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays, hoursPerDay);
    return enteredMin !== reportMin;
}

/** @returns {Array<{ date: string, hours: number }>} */
export function normalizePayrollDailyOvertime(source) {
    if (!source) return [];
    if (Array.isArray(source)) {
        return source
            .map((row) => {
                if (row && typeof row === 'object') {
                    const date = String(row.date || row.ymd || row.day || '').trim();
                    const hours = Number(row.hours != null ? row.hours : row.overtimeHours);
                    if (!date || !(hours > 0)) return null;
                    return { date, hours };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    if (typeof source === 'object') {
        return Object.keys(source)
            .sort()
            .map((date) => {
                const hours = Number(source[date]);
                if (!(hours > 0)) return null;
                return { date: String(date).trim(), hours };
            })
            .filter(Boolean);
    }
    return [];
}

/** @param {Array<{ date: string, hours: number }>} rows */
export function sumOvertimeDailyRows(rows) {
    return (rows || []).reduce((s, r) => s + (Number(r.hours) || 0), 0);
}

/** @param {Record<string, number>|Array<{date:string,hours:number}>} daily */
export function sumOvertimeDailyMinutes(daily) {
    if (Array.isArray(daily)) {
        return daily.reduce((s, row) => s + hoursToPayrollOvertimeMinutes(row.hours), 0);
    }
    if (daily && typeof daily === 'object') {
        return Object.values(daily).reduce((s, v) => s + hoursToPayrollOvertimeMinutes(v), 0);
    }
    return 0;
}

/** @param {Array<{ date: string, hours: number }>} rows */
export function overtimeDailyRowsToObject(rows) {
    /** @type {Record<string, number>} */
    const out = {};
    (rows || []).forEach((r) => {
        const d = String(r.date || '').trim();
        const h = Number(r.hours);
        if (!d || !(h >= 0)) return;
        if (h === 0) return;
        out[d] = Math.round(h * 100) / 100;
    });
    return out;
}

/** @param {Record<string, number>|Array<{date:string,hours:number}>} daily */
export function sumOvertimeDailyHours(daily) {
    return payrollOvertimeMinutesToHours(sumOvertimeDailyMinutes(daily));
}

/**
 * 逐日合計須與上方小時一致；可選是否須同時等於報表（手動校正時只比對上方小時）。
 * @param {{ overtimeHours: number, overtimeDays?: number, overtimeDailyHours?: object|array, reportOvertimeMinutes?: number, hoursPerDay?: number, requireReportMatch?: boolean }} input
 */
export function validatePayrollOvertimeDailyHours(input) {
    const enteredMin = hoursToPayrollOvertimeMinutes(input.overtimeHours);
    if (enteredMin <= 0) {
        return { ok: true, dailyTotalMinutes: 0, reportMinutes: 0, enteredMinutes: 0, message: '' };
    }
    const hpd = Number(input.hoursPerDay) || PAYROLL_OVERTIME_HOURS_PER_DAY;
    const overtimeDays = Number(input.overtimeDays) || 0;
    const requireReportMatch = input.requireReportMatch !== false;
    const reportMin = input.reportOvertimeMinutes != null
        ? Math.round(Number(input.reportOvertimeMinutes))
        : hoursToPayrollOvertimeMinutes(overtimeDays * hpd);
    const dailyMin = sumOvertimeDailyMinutes(input.overtimeDailyHours);
    const matchEntered = dailyMin === enteredMin;
    const matchReport = !requireReportMatch || dailyMin === reportMin;
    if (matchEntered && matchReport) {
        return {
            ok: true,
            dailyTotalMinutes: dailyMin,
            reportMinutes: reportMin,
            enteredMinutes: enteredMin,
            message: ''
        };
    }
    const parts = [];
    if (!matchEntered) {
        parts.push(`每日加班合計 ${payrollOvertimeMinutesToHours(dailyMin)} 小時（${dailyMin} 分），須等於上方「加班（小時）」${payrollOvertimeMinutesToHours(enteredMin)} 小時（${enteredMin} 分）`);
    }
    if (requireReportMatch && !matchReport) {
        parts.push(`每日加班合計須等於報表加班 ${fmtPayrollOvertimeDays(overtimeDays)} 天 × ${hpd} 小時＝${payrollOvertimeMinutesToHours(reportMin)} 小時（${reportMin} 分）`);
    }
    return {
        ok: false,
        dailyTotalMinutes: dailyMin,
        reportMinutes: reportMin,
        enteredMinutes: enteredMin,
        message: parts.join('；')
    };
}

export function isEmptyPayrollDailyOvertime(snapshot, dailyObject) {
    const snapRows = normalizePayrollDailyOvertime(snapshot && snapshot.payrollDailyOvertime);
    const userDays = Object.keys(dailyObject || {}).filter((k) => Number(dailyObject[k]) > 0);
    return snapRows.length === 0 && userDays.length === 0;
}

/** 報表 0 分且無任何逐日資料 → 不送 overtimeDailyHours，後端併成單一平日 */
export function shouldOmitOvertimeDailyHours(snapshot, overtimeDays, hoursPerDay, dailyObject) {
    const reportMin = reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays, hoursPerDay);
    return reportMin === 0 && isEmptyPayrollDailyOvertime(snapshot, dailyObject);
}

export function buildOvertimeSubmitPayload(overtimeHours, overtimeNote, dailyObject, snapshot, overtimeDays, hoursPerDay) {
    const payload = {
        overtimeHours,
        overtimeNote: overtimeNote || ''
    };
    if (!shouldOmitOvertimeDailyHours(snapshot, overtimeDays, hoursPerDay, dailyObject)) {
        payload.overtimeDailyHours = dailyObject;
    }
    return payload;
}

/**
 * 送審前整體判定（手動校正：須填原因，且逐日合計仍須等於上方小時）。
 */
export function validatePayrollOvertimeSubmit(input) {
    const overtimeHours = Number(input.overtimeHours) || 0;
    const overtimeNote = String(input.overtimeNote || '').trim();
    const overtimeDays = Number(input.overtimeDays) || 0;
    const snapshot = input.snapshot || null;
    const enteredMin = hoursToPayrollOvertimeMinutes(overtimeHours);

    if (enteredMin <= 0) {
        return {
            ok: true,
            block: false,
            warn: false,
            message: '',
            payload: { overtimeHours: 0, overtimeNote: '' }
        };
    }

    const reportMin = reportOvertimeMinutesFromSnapshot(snapshot, overtimeDays, input.hoursPerDay);
    const manualOverride = enteredMin !== reportMin;
    const dailyObject = input.overtimeDailyHours != null
        ? input.overtimeDailyHours
        : {};

    if (manualOverride && !overtimeNote) {
        return {
            ok: false,
            block: true,
            warn: false,
            message: '與報表加班時數不同時，請填寫加班原因',
            payload: null
        };
    }

    if (manualOverride && overtimeNote) {
        if (shouldOmitOvertimeDailyHours(snapshot, overtimeDays, input.hoursPerDay, dailyObject)) {
            const enteredHours = payrollOvertimeMinutesToHours(enteredMin);
            return {
                ok: true,
                block: false,
                warn: true,
                message: `加班 ${enteredHours} 小時；報表無逐日資料，後端將併成單一平日`,
                payload: buildOvertimeSubmitPayload(
                    overtimeHours, overtimeNote, dailyObject, snapshot, overtimeDays, input.hoursPerDay
                )
            };
        }
        const manualDaily = validatePayrollOvertimeDailyHours({
            overtimeHours,
            overtimeDays,
            overtimeDailyHours: dailyObject,
            reportOvertimeMinutes: reportMin,
            hoursPerDay: input.hoursPerDay,
            requireReportMatch: false
        });
        if (!manualDaily.ok) {
            return {
                ok: false,
                block: true,
                warn: false,
                message: manualDaily.message,
                payload: null
            };
        }
        const reportHours = payrollOvertimeMinutesToHours(reportMin);
        const enteredHours = payrollOvertimeMinutesToHours(enteredMin);
        return {
            ok: true,
            block: false,
            warn: true,
            message: `加班 ${enteredHours} 小時與報表 ${reportHours} 小時不同；已填原因，請確認逐日合計已調整`,
            payload: buildOvertimeSubmitPayload(
                overtimeHours, overtimeNote, dailyObject, snapshot, overtimeDays, input.hoursPerDay
            )
        };
    }

    const dailyValidation = validatePayrollOvertimeDailyHours({
        overtimeHours,
        overtimeDays,
        overtimeDailyHours: dailyObject,
        reportOvertimeMinutes: reportMin,
        hoursPerDay: input.hoursPerDay,
        requireReportMatch: true
    });
    if (!dailyValidation.ok) {
        return {
            ok: false,
            block: true,
            warn: false,
            message: dailyValidation.message,
            payload: null
        };
    }

    return {
        ok: true,
        block: false,
        warn: false,
        message: '',
        payload: buildOvertimeSubmitPayload(
            overtimeHours, overtimeNote, dailyObject, snapshot, overtimeDays, input.hoursPerDay
        )
    };
}

function fmtPayrollOvertimeDays(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** 從 snapshot 建立可編輯列（保留使用者已改過的日期時數） */
export function mergeOvertimeDailyRows(snapshot, previousRows) {
    const fromSnap = normalizePayrollDailyOvertime(snapshot && snapshot.payrollDailyOvertime);
    if (!previousRows || !previousRows.length) return fromSnap;
    const prevMap = new Map(previousRows.map((r) => [r.date, r.hours]));
    const dates = new Set([...fromSnap.map((r) => r.date), ...prevMap.keys()]);
    return [...dates].sort().map((date) => ({
        date,
        hours: prevMap.has(date)
            ? Number(prevMap.get(date)) || 0
            : (fromSnap.find((r) => r.date === date)?.hours || 0)
    }));
}

export function overtimeDailyMismatchMessage(validation) {
    if (!validation || validation.ok) return '';
    return validation.message || '每日加班時數合計不符';
}
