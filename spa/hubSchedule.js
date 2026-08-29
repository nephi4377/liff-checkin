/**
 * 主控台「人員出席／今日燈號」用的當月班表：
 * 成功才覆寫畫面與快取。失敗不可把空班表當成「大家都上班／沒人休假」。
 */
export function isValidSchedulePayload(data) {
    return !!(
        data
        && typeof data === 'object'
        && data.schedule
        && typeof data.schedule === 'object'
        && !Array.isArray(data.schedule)
    );
}

export function mergeHubScheduleFetch(previous, result) {
    const prev = previous && typeof previous === 'object'
        ? previous
        : { schedule: {}, holidays: [] };
    const prevSchedule = prev.schedule && typeof prev.schedule === 'object' ? prev.schedule : {};
    const prevHolidays = Array.isArray(prev.holidays) ? prev.holidays : [];
    const keep = { schedule: prevSchedule, holidays: prevHolidays };
    const prevHas = Object.keys(prevSchedule).length > 0;

    if (!result || result.ok !== true) {
        return {
            schedule: keep,
            error: (result && result.message) || '班表載入失敗，請再試',
            saveCache: false,
            hasPrevious: prevHas
        };
    }

    return {
        schedule: {
            schedule: result.schedule && typeof result.schedule === 'object' ? result.schedule : {},
            holidays: Array.isArray(result.holidays) ? result.holidays : []
        },
        error: '',
        saveCache: true,
        hasPrevious: prevHas
    };
}
