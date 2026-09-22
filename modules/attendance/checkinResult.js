/**
 * 打卡回覆：成功／忙碌／業務失敗要分開。
 * 後端曾把「尚未註冊」等失敗文案包成 status=success；畫面不可當成打卡完成。
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.CheckinResult = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function isCheckinBusinessFailure(res) {
        if (!res) return true;
        if (res.status === 'busy') return false;
        if (res.status === 'error') return true;
        var msg = String(res.message || '');
        return msg.indexOf('失敗') !== -1 || msg.indexOf('尚未被註冊') !== -1;
    }

    function isUnregisteredCheckin(res) {
        if (!res) return false;
        if (res.errorCode === 'UNREGISTERED') return true;
        var msg = String(res.message || '');
        return msg.indexOf('尚未被註冊') !== -1;
    }

    return {
        isCheckinBusinessFailure: isCheckinBusinessFailure,
        isUnregisteredCheckin: isUnregisteredCheckin
    };
});
