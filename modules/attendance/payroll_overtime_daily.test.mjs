import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizePayrollDailyOvertime,
    sumOvertimeDailyHours,
    validatePayrollOvertimeDailyHours,
    overtimeDailyRowsToObject,
    mergeOvertimeDailyRows,
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

describe('validatePayrollOvertimeDailyHours', () => {
    it('passes when overtime is zero', () => {
        const v = validatePayrollOvertimeDailyHours({ overtimeHours: 0, overtimeDays: 1, overtimeDailyHours: {} });
        assert.equal(v.ok, true);
    });

    it('requires daily total to match hours and days×8', () => {
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
        assert.match(bad.message, /8/);
    });

    it('allows zero overtimeDays when only hours match', () => {
        const v = validatePayrollOvertimeDailyHours({
            overtimeHours: 4,
            overtimeDays: 0,
            overtimeDailyHours: { '2026-05-01': 4 }
        });
        assert.equal(v.ok, true);
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
    it('sums object values', () => {
        assert.equal(sumOvertimeDailyHours({ a: 1.5, b: 2.5 }), 4);
    });
});
