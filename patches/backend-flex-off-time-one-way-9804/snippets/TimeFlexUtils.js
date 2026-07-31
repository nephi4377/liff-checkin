/**
 * 單向彈性下班 — 與 CODING shared/js/utils.js 對齊
 * 建議放在 CheckinSystem/TimeFlexUtils.js（或併入既有 TimeUtils）
 */

/** HH:mm 或 Date → 當日分鐘數；無效回傳 null */
function _parseTimeToMinutesFlex_(timeVal) {
  if (timeVal == null || timeVal === '') return null;
  if (timeVal instanceof Date && !isNaN(timeVal.getTime())) {
    return timeVal.getHours() * 60 + timeVal.getMinutes();
  }
  const m = String(timeVal).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** 分鐘數 → HH:mm */
function _formatMinutesToTimeFlex_(totalMins) {
  if (totalMins == null || isNaN(totalMins)) return null;
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMins)));
  const h = Math.floor(t / 60);
  const min = t % 60;
  return Utilities.formatString('%02d:%02d', h, min);
}

/**
 * 預計下班（單向）：不得早於 shiftEnd；遲到在彈性內等量往後延
 * @returns {string|null} HH:mm
 */
function _computeExpectedOffTimeStr_(checkInTime, shiftStart, shiftEnd, flexibleMinutes) {
  const ci = _parseTimeToMinutesFlex_(checkInTime);
  const ss = _parseTimeToMinutesFlex_(shiftStart);
  const se = _parseTimeToMinutesFlex_(shiftEnd);
  if (ci == null || ss == null || se == null) return null;
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  const lateWithinFlex = Math.max(0, Math.min(flex, ci - ss));
  return _formatMinutesToTimeFlex_(se + lateWithinFlex);
}

/** 早退分鐘（對照預計下班） */
function _computeEarlyMinutesFlex_(checkOutTime, checkInTime, shiftStart, shiftEnd, flexibleMinutes) {
  const co = _parseTimeToMinutesFlex_(checkOutTime);
  const expectedOff = _computeExpectedOffTimeStr_(checkInTime, shiftStart, shiftEnd, flexibleMinutes);
  const eo = _parseTimeToMinutesFlex_(expectedOff);
  if (co == null || eo == null) return 0;
  return Math.max(0, eo - co);
}

/** 遲到分鐘（超過彈性才計；不變） */
function _computeLateMinutesFlex_(checkInTime, shiftStart, flexibleMinutes) {
  const ci = _parseTimeToMinutesFlex_(checkInTime);
  const ss = _parseTimeToMinutesFlex_(shiftStart);
  if (ci == null || ss == null) return 0;
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  return Math.max(0, ci - ss - flex);
}
