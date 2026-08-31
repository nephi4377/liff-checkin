import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    removeNotificationById,
    removeInfoNotifications,
    notificationsAfterAction
} from './hubNotificationActions.js';

const n1 = { NotificationID: 'a', ActionType: 'ConfirmCompletion', Title: '待完成' };
const n2 = { NotificationID: 'b', ActionType: 'None', Title: '資訊' };
const n3 = { NotificationID: 'c', ActionType: 'ReplyText', Title: '待回覆' };

describe('hubNotificationActions', () => {
    it('完成一則後畫面先拿掉該則', () => {
        const { snapshot, next } = removeNotificationById([n1, n2, n3], 'a');
        assert.equal(snapshot.length, 3);
        assert.deepEqual(next.map((n) => n.NotificationID), ['b', 'c']);
    });

    it('後端失敗要把原清單還原', () => {
        const { snapshot, next } = removeNotificationById([n1, n2], 'a');
        const restored = notificationsAfterAction(false, snapshot, next);
        assert.deepEqual(restored, [n1, n2]);
    });

    it('後端成功維持拿掉後的清單', () => {
        const { snapshot, next } = removeNotificationById([n1, n2], 'a');
        const kept = notificationsAfterAction(true, snapshot, next);
        assert.deepEqual(kept.map((n) => n.NotificationID), ['b']);
    });

    it('清除資訊型通知失敗也要還原', () => {
        const { snapshot, next } = removeInfoNotifications([n1, n2, n3]);
        assert.deepEqual(next.map((n) => n.NotificationID), ['a', 'c']);
        const restored = notificationsAfterAction(false, snapshot, next);
        assert.deepEqual(restored, [n1, n2, n3]);
    });
});
