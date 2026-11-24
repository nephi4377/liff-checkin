/**
 * 主管「假勤年度統計」列表：成功、空白、失敗要分開。
 * 失敗不可當成「這一年還沒有假勤統計資料」。
 */
export function classifyLeaveYearStatsListFetch(result, fallbackMessage) {
    const fallback = fallbackMessage || '無法取得假勤年度統計';
    if (!result || result.success !== true) {
        return {
            kind: 'error',
            message: (result && result.message) || fallback,
            rows: [],
            lastUpdatedAt: null,
            year: null
        };
    }
    const data = result.data;
    const list = Array.isArray(data && data.rows)
        ? data.rows
        : (Array.isArray(data) ? data : null);
    if (!list) {
        return {
            kind: 'error',
            message: fallback,
            rows: [],
            lastUpdatedAt: null,
            year: null
        };
    }
    return {
        kind: list.length > 0 ? 'ok' : 'empty',
        message: '',
        rows: list,
        lastUpdatedAt: (data && data.lastUpdatedAt) || null,
        year: (data && data.year) || null
    };
}
