/**
 * 主控台智慧通知：按回覆／完成／清除時先從畫面拿掉；
 * 後端沒記下就要還原，不能讓人以為已經辦完。
 */

export function snapshotNotifications(list) {
    return Array.isArray(list) ? list.slice() : [];
}

export function removeNotificationById(list, notificationId) {
    const snapshot = snapshotNotifications(list);
    return {
        snapshot,
        next: snapshot.filter((n) => n && n.NotificationID !== notificationId)
    };
}

export function removeInfoNotifications(list) {
    const snapshot = snapshotNotifications(list);
    return {
        snapshot,
        next: snapshot.filter((n) => n && n.ActionType !== 'None')
    };
}

/** 後端沒成功 → 用動作前的清單還原 */
export function notificationsAfterAction(ok, snapshot, current) {
    if (ok === true) return Array.isArray(current) ? current : [];
    return snapshotNotifications(snapshot);
}
