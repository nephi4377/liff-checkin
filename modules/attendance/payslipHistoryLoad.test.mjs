import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPayslipHistoryFetch } from './payroll_review_panel.js';

describe('classifyPayslipHistoryFetch', () => {
    it('success:false 是失敗，不是尚無發放紀錄', () => {
        const out = classifyPayslipHistoryFetch({ success: false, message: '逾時' });
        assert.equal(out.kind, 'error');
        assert.equal(out.message, '逾時');
        assert.notEqual(out.message, '尚無發放紀錄');
    });

    it('沒有回傳也是失敗', () => {
        const out = classifyPayslipHistoryFetch(null);
        assert.equal(out.kind, 'error');
        assert.equal(out.message, '發放紀錄讀不到，請再試');
    });

    it('success 但 data 不是陣列是失敗', () => {
        const out = classifyPayslipHistoryFetch({ success: true, data: null });
        assert.equal(out.kind, 'error');
    });

    it('成功且空陣列才是真的沒發放紀錄', () => {
        const out = classifyPayslipHistoryFetch({ success: true, data: [] });
        assert.equal(out.kind, 'empty');
    });

    it('成功且有資料', () => {
        const out = classifyPayslipHistoryFetch({ success: true, data: [{ payslipId: 'PS1' }] });
        assert.equal(out.kind, 'ok');
        assert.equal(out.items.length, 1);
    });
});
