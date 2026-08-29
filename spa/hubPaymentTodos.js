/**
 * 主控台「款項待辦」：成功才覆寫畫面與日快取。
 * 失敗不可把空陣列當成「目前沒有待辦」。
 */
export function mergeHubPaymentTodosFetch(previous, result) {
    const prev = previous || { pendingReview: [], pendingPayment: [] };
    const prevReview = Array.isArray(prev.pendingReview) ? prev.pendingReview : [];
    const prevPay = Array.isArray(prev.pendingPayment) ? prev.pendingPayment : [];
    const keep = { pendingReview: prevReview, pendingPayment: prevPay };

    if (!result || result.skipped) {
        return { todos: keep, error: '', saveCache: false };
    }
    if (result.ok) {
        return {
            todos: {
                pendingReview: Array.isArray(result.pendingReview) ? result.pendingReview : [],
                pendingPayment: Array.isArray(result.pendingPayment) ? result.pendingPayment : []
            },
            error: '',
            saveCache: true
        };
    }

    const hasPrev = prevReview.length > 0 || prevPay.length > 0;
    const partialReview = Array.isArray(result.pendingReview) ? result.pendingReview : [];
    const partialPay = Array.isArray(result.pendingPayment) ? result.pendingPayment : [];
    return {
        todos: hasPrev
            ? keep
            : { pendingReview: partialReview, pendingPayment: partialPay },
        error: result.message || '款項待辦載入失敗，請再試',
        saveCache: false
    };
}
