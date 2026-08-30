import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { isCheckinBusinessFailure, isUnregisteredCheckin } = createRequire(import.meta.url)('./checkinResult.js');

describe('isCheckinBusinessFailure', () => {
    it('真正打卡成功不是失敗', () => {
        assert.equal(isCheckinBusinessFailure({
            status: 'success',
            message: '王小明，您好！\n您的打卡請求已於 08:30 送出，系統將在背景處理。\n⏰ 預計下班：17:10'
        }), false);
    });

    it('status=success 但文案寫打卡失敗，仍是失敗', () => {
        const res = {
            status: 'success',
            message: '打卡失敗。\n\n您的 LINE 帳號尚未被註冊至本系統，請聯繫您的主管或行政部門進行設定。'
        };
        assert.equal(isCheckinBusinessFailure(res), true);
        assert.equal(isUnregisteredCheckin(res), true);
    });

    it('status=error 是失敗', () => {
        assert.equal(isCheckinBusinessFailure({ status: 'error', message: '伺服器暫時無法處理' }), true);
        assert.equal(isUnregisteredCheckin({ status: 'error', errorCode: 'UNREGISTERED', message: '打卡失敗' }), true);
    });

    it('忙碌不是業務失敗', () => {
        assert.equal(isCheckinBusinessFailure({ status: 'busy' }), false);
    });

    it('沒有回傳當成失敗', () => {
        assert.equal(isCheckinBusinessFailure(null), true);
    });
});
