/**
 * 薪資送審：每日加班時數（對齊後端 overtimeDailyHours / snapshot.payrollDailyOvertime）
 */

export const PAYROLL_OVERTIME_HOURS_PER_DAY = 8;

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
    if (Array.isArray(daily)) return sumOvertimeDailyRows(daily);
    if (daily && typeof daily === 'object') {
        return Object.values(daily).reduce((s, v) => s + (Number(v) || 0), 0);
    }
    return 0;
}

/**
 * @param {{ overtimeHours: number, overtimeDays?: number, overtimeDailyHours?: object|array, hoursPerDay?: number }} input
 */
export function validatePayrollOvertimeDailyHours(input) {
    const overtimeHours = Number(input.overtimeHours) || 0;
    if (overtimeHours <= 0) {
        return { ok: true, dailyTotal: 0, expectedFromDays: 0, expectedFromHours: 0 };
    }
    const hpd = Number(input.hoursPerDay) || PAYROLL_OVERTIME_HOURS_PER_DAY;
    const overtimeDays = Number(input.overtimeDays) || 0;
    const expectedFromDays = Math.round(overtimeDays * hpd * 100) / 100;
    const expectedFromHours = overtimeHours;
    const dailyTotal = Math.round(sumOvertimeDailyHours(input.overtimeDailyHours) * 100) / 100;
    const tol = 0.001;
    const matchHours = Math.abs(dailyTotal - expectedFromHours) <= tol;
    const matchDays = overtimeDays <= 0 || Math.abs(dailyTotal - expectedFromDays) <= tol;
    if (matchHours && matchDays) {
        return { ok: true, dailyTotal, expectedFromDays, expectedFromHours, message: '' };
    }
    const parts = [];
    if (!matchHours) {
        parts.push(`每日加班合計 ${dailyTotal} 小時，須等於上方「加班（小時）」${expectedFromHours} 小時`);
    }
    if (!matchDays) {
        parts.push(`每日加班合計須等於報表加班 ${fmtPayrollOvertimeDays(overtimeDays)} 天 × ${hpd} 小時＝${expectedFromDays} 小時`);
    }
    return {
        ok: false,
        dailyTotal,
        expectedFromDays,
        expectedFromHours,
        message: parts.join('；')
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
