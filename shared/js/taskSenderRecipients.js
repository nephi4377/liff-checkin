/**
 * 任務交辦收件人解析（全體發送展開成 UID，巡檢 #56）。
 */

export function resolveHubStaffRecipientIds(employees, { sendToAll, selectedIds } = {}) {
    const isStaff = (emp) => {
        if (!emp) return false;
        const st = String(emp.status || emp['身份'] || '員工').trim();
        if (st === '離職' || st === '廠商') return false;
        return Number(emp.permission || emp['權限'] || 0) >= 2;
    };
    if (sendToAll) {
        const ids = (employees || [])
            .filter(isStaff)
            .map((emp) => String(emp.userId || emp['userId'] || '').trim())
            .filter(Boolean);
        return {
            ok: ids.length > 0,
            recipients: ids,
            error: ids.length ? '' : '員工名單還沒載入或沒有可發送的員工，無法發送給所有人。請重新整理後再試。'
        };
    }
    const selected = (selectedIds || []).map((id) => String(id || '').trim()).filter(Boolean);
    return {
        ok: selected.length > 0,
        recipients: selected,
        error: selected.length ? '' : '錯誤：請至少選擇一位收件人。'
    };
}
