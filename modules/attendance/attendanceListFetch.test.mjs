import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttendanceListFetch } from './attendanceListFetch.js';

const FALLBACK = '假勤待審載入失敗，請再試';

describe('classifyAttendanceListFetch', () => {
    it('success:false 是失敗，不是空清單', () => {
        const out = classifyAttendanceListFetch({ success: false, message: '逾時' }, FALLBACK);
        assert.equal(out.kind, 'error');
        assert.equal(out.message, '逾時');
        assert.deepEqual(out.items, []);
    });

    it('沒有回傳也是失敗', () => {
        const out = classifyAttendanceListFetch(null, FALLBACK);
        assert.equal(out.kind, 'error');
        assert.equal(out.message, FALLBACK);
    });

    it('success 但 data 不是陣列是失敗', () => {
        const out = classifyAttendanceListFetch({ success: true, data: null }, FALLBACK);
        assert.equal(out.kind, 'error');
    });

    it('成功且有資料', () => {
        const out = classifyAttendanceListFetch({ success: true, data: [{ id: 1 }] }, FALLBACK);
        assert.equal(out.kind, 'ok');
        assert.equal(out.items.length, 1);
    });

    it('成功且空陣列才是真的沒待審', () => {
        const out = classifyAttendanceListFetch({ success: true, data: [] }, FALLBACK);
        assert.equal(out.kind, 'empty');
        assert.equal(out.message, '');
    });
});
