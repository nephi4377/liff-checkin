import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLeaveYearStatsListFetch } from './leave_year_stats_list_fetch.js';

const FALLBACK = '無法取得假勤年度統計';

describe('classifyLeaveYearStatsListFetch', () => {
    it('success:false 是失敗，不是空表', () => {
        const out = classifyLeaveYearStatsListFetch({ success: false, message: '逾時' }, FALLBACK);
        assert.equal(out.kind, 'error');
        assert.equal(out.message, '逾時');
        assert.deepEqual(out.rows, []);
    });

    it('沒有回傳也是失敗', () => {
        const out = classifyLeaveYearStatsListFetch(null, FALLBACK);
        assert.equal(out.kind, 'error');
        assert.equal(out.message, FALLBACK);
    });

    it('success 但沒有 rows 陣列是失敗', () => {
        const out = classifyLeaveYearStatsListFetch({ success: true, data: {} }, FALLBACK);
        assert.equal(out.kind, 'error');
        assert.deepEqual(out.rows, []);
    });

    it('成功且有資料', () => {
        const out = classifyLeaveYearStatsListFetch({
            success: true,
            data: { year: 2026, lastUpdatedAt: 't', rows: [{ employeeName: 'A' }] }
        }, FALLBACK);
        assert.equal(out.kind, 'ok');
        assert.equal(out.rows.length, 1);
        assert.equal(out.year, 2026);
    });

    it('成功且空陣列才是真的還沒有統計', () => {
        const out = classifyLeaveYearStatsListFetch({
            success: true,
            data: { year: 2026, rows: [] }
        }, FALLBACK);
        assert.equal(out.kind, 'empty');
        assert.equal(out.message, '');
    });
});
