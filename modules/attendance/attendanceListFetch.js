/**
 * 假勤審核／假單列表：成功、空白、失敗要分開。
 * 失敗不可當成「目前沒有待審／沒有假單」。
 */
export function classifyAttendanceListFetch(result, fallbackMessage) {
    const fallback = fallbackMessage || '載入失敗，請再試';
    if (!result || result.success !== true) {
        return {
            kind: 'error',
            message: (result && result.message) || fallback,
            items: []
        };
    }
    if (!Array.isArray(result.data)) {
        return { kind: 'error', message: fallback, items: [] };
    }
    return {
        kind: result.data.length > 0 ? 'ok' : 'empty',
        message: '',
        items: result.data
    };
}
