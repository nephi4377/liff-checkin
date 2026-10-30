/**
 * HubRefCache 員工名單：各頁須自行套用與後端相同的篩選。
 * 寫入端可能是 attendance_active、all（含離職／廠商）等不同範圍。
 */

/** 與後端 active_with_recent_resigned 相同：離職後仍列入的天數 */
export const RECENT_RESIGNED_DAYS = 60;

/**
 * 解析離職日（對齊 EmployeeLogic._parseResignationToDate_ 可在瀏覽器跑的子集）
 * @param {*} v
 * @returns {Date|null}
 */
export function parseResignationDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const s = v.trim();
    const iso = new Date(s);
    if (!Number.isNaN(iso.getTime())) return iso;
    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
      const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

/**
 * 出勤名單基底：排除廠商、權限 ≥5（對齊 _isAttendanceRosterEmployee_）
 * @param {object} emp
 * @returns {boolean}
 */
export function isAttendanceRosterEmployee(emp) {
  if (!emp) return false;
  const status = String(emp.status || '員工').trim();
  if (status === '廠商') return false;
  const perm = parseInt(emp.permission, 10) || 1;
  if (perm >= 5) return false;
  return true;
}

/**
 * 對齊後端 get_employees filter=attendance_active_with_recent_resigned
 * @param {Array<object>} list
 * @param {number} [nowMs]
 * @returns {Array<object>}
 */
export function filterAttendanceActiveWithRecentResigned(list, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  return (Array.isArray(list) ? list : []).filter((emp) => {
    if (!isAttendanceRosterEmployee(emp)) return false;
    const status = String(emp.status || '員工').trim();
    if (status !== '離職') return true;
    const d = parseResignationDate(emp.resignationDate);
    if (!d) return false;
    return (now - d.getTime()) / dayMs <= RECENT_RESIGNED_DAYS;
  });
}

/**
 * 對齊後端 get_employees filter=attendance_active（總監人事筆記選人）
 * 排除離職、廠商、權限 ≥5
 * @param {Array<object>} list
 * @returns {Array<object>}
 */
export function filterDirectorHrEmployees(list) {
  return (Array.isArray(list) ? list : []).filter((emp) => {
    if (!isAttendanceRosterEmployee(emp)) return false;
    const status = String(emp.status || '員工').trim();
    if (status === '離職') return false;
    return true;
  });
}

/**
 * 團隊工作總覽：權限 2／3（字串數字皆可），且排除離職
 * @param {Array<object>} list
 * @returns {Array<object>}
 */
export function filterDailyReportEmployees(list) {
  return (Array.isArray(list) ? list : []).filter((emp) => {
    if (!emp) return false;
    const status = String(emp.status || '員工').trim();
    if (status === '離職') return false;
    const perm = parseInt(emp.permission, 10);
    return perm === 2 || perm === 3;
  });
}

/**
 * 篩完若空陣列 → 呼叫端應改打後端（勿把空結果當快取命中）
 * @param {Array<object>} filtered
 * @returns {boolean}
 */
export function shouldUseFilteredHubRoster(filtered) {
  return Array.isArray(filtered) && filtered.length > 0;
}
