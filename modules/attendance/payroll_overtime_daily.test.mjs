import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePayrollDailyOvertime,
    sumOvertimeDailyHours,
    sumOvertimeDailyMinutes,
    hoursToPayrollOvertimeMinutes,
    reportOvertimeMinutesFromSnapshot,
    validatePayrollOvertimeDailyHours,
    validatePayrollOvertimeSubmit,
    overtimeDailyRowsToObject,
    mergeOvertimeDailyRows,
    enteredOvertimeDiffersFromReport,
    PAYROLL_OVERTIME_HOURS_PER_DAY
} from './payroll_overtime_daily.js';

describe('normalizePayrollDailyOvertime', () => {
    it('parses object map', () => {
        const rows = normalizePayrollDailyOvertime({ '2026-05-02': 2, '2026-05-01': 1 });
        assert.deepEqual(rows, [
            { date: '2026-05-01', hours: 1 },
            { date: '2026-05-02', hours: 2 }
        ]);
    });

    it('parses array of rows', () => {
        const rows = normalizePayrollDailyOvertime([
            { date: '2026-05-03', hours: 4 },
            { ymd: '2026-05-04', overtimeHours: 2 }
        ]);
        assert.equal(rows.length, 2);
        assert.equal(rows[1].hours, 2);
    });
});

describe('minutes rounding', () => {
    it('converts hours with round(h*60)', () => {
        assert.equal(hoursToPayrollOvertimeMinutes(8), 480);
        assert.equal(hoursToPayrollOvertimeMinutes(8.5), 510);
        assert.equal(sumOvertimeDailyMinutes({ '2026-05-01': 4.25, '2026-05-02': 4.25 }), 510);
    });

    it('report minutes prefers snapshot.reportOvertimeMinutes', () => {
        assert.equal(reportOvertimeMinutesFromSnapshot({ reportOvertimeMinutes: 510 }, 1), 510);
        assert.equal(reportOvertimeMinutesFromSnapshot({}, 1), 480);
    });
});

describe('validatePayrollOvertimeDailyHours', () => {
    it('passes when overtime is zero', () => {
        const v = validatePayrollOvertimeDailyHours({ overtimeHours: 0, overtimeDays: 1, overtimeDailyHours: {} });
        assert.equal(v.ok, true);
    });

    it('requires daily total minutes to match hours and report', () => {
        const daily = { '2026-05-01': 8 };
        const ok = validatePayrollOvertimeDailyHours({
            overtimeHours: 8,
            overtimeDays: 1,
            overtimeDailyHours: daily,
            hoursPerDay: PAYROLL_OVERTIME_HOURS_PER_DAY
        });
        assert.equal(ok.ok, true);

        const bad = validatePayrollOvertimeDailyHours({
            overtimeHours: 8,
            overtimeDays: 1,
            overtimeDailyHours: { '2026-05-01': 4 },
            hoursPerDay: PAYROLL_OVERTIME_HOURS_PER_DAY
        });
        assert.equal(bad.ok, false);
        assert.match(bad.message, /480/);
    });
});

describe('validatePayrollOvertimeSubmit', () => {
    const snap = { reportOvertimeMinutes: 480, payrollDailyOvertime: { '2026-05-01': 8 } };

    it('blocks manual override when daily total still matches report not entered hours', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 10,
            overtimeNote: '專案趕工',
            overtimeDays: 1,
            snapshot: snap,
            overtimeDailyHours: { '2026-05-01': 8 }
        });
        assert.equal(v.ok, false);
        assert.equal(v.block, true);
        assert.match(v.message, /600/);
    });

    it('allows manual 10h with reason when daily breakdown sums to 10h (report 8h)', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 10,
            overtimeNote: '專案趕工',
            overtimeDays: 1,
            snapshot: snap,
            overtimeDailyHours: { '2026-05-01': 10 }
        });
        assert.equal(v.ok, true);
        assert.equal(v.warn, true);
        assert.equal(v.block, false);
        assert.deepEqual(v.payload.overtimeDailyHours, { '2026-05-01': 10 });
    });

    it('blocks manual override without note', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 10,
            overtimeNote: '',
            overtimeDays: 1,
            snapshot: snap,
            overtimeDailyHours: { '2026-05-01': 8 }
        });
        assert.equal(v.ok, false);
        assert.equal(v.block, true);
    });

    it('blocks daily mismatch when hours match report', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 8,
            overtimeNote: '',
            overtimeDays: 1,
            snapshot: snap,
            overtimeDailyHours: { '2026-05-01': 4 }
        });
        assert.equal(v.ok, false);
        assert.match(v.message, /480/);
    });

    it('does not require note when hours match report', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 8,
            overtimeNote: '',
            overtimeDays: 1,
            snapshot: snap,
            overtimeDailyHours: { '2026-05-01': 8 }
        });
        assert.equal(v.ok, true);
        assert.equal(v.warn, false);
    });

    it('omits overtimeDailyHours when report is 0 and no daily data', () => {
        const v = validatePayrollOvertimeSubmit({
            overtimeHours: 8,
            overtimeNote: '補登',
            overtimeDays: 0,
            snapshot: { reportOvertimeMinutes: 0 },
            overtimeDailyHours: {}
        });
        assert.equal(v.ok, true);
        assert.equal(v.payload.overtimeDailyHours, undefined);
    });
});

describe('enteredOvertimeDiffersFromReport', () => {
    it('detects minute-level difference', () => {
        const snap = { reportOvertimeMinutes: 480 };
        assert.equal(enteredOvertimeDiffersFromReport(8, snap, 1), false);
        assert.equal(enteredOvertimeDiffersFromReport(10, snap, 1), true);
    });
});

describe('overtimeDailyRowsToObject', () => {
    it('drops zero-hour days', () => {
        const obj = overtimeDailyRowsToObject([
            { date: '2026-05-01', hours: 2 },
            { date: '2026-05-02', hours: 0 }
        ]);
        assert.deepEqual(obj, { '2026-05-01': 2 });
    });
});

describe('mergeOvertimeDailyRows', () => {
    it('keeps user edits for known dates', () => {
        const snap = { payrollDailyOvertime: { '2026-05-01': 8 } };
        const merged = mergeOvertimeDailyRows(snap, [{ date: '2026-05-01', hours: 6 }]);
        assert.deepEqual(merged, [{ date: '2026-05-01', hours: 6 }]);
    });
});

describe('sumOvertimeDailyHours', () => {
    it('sums via minutes', () => {
        assert.equal(sumOvertimeDailyHours({ a: 1.5, b: 2.5 }), 4);
        assert.equal(sumOvertimeDailyMinutes({ a: 1.5, b: 2.5 }), 240);
    });
});
