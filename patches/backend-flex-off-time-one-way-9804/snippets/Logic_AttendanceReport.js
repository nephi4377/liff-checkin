/**
 * 替換 CheckinSystem/Logic_AttendanceReport.js 內 _computeReportLateEarly_
 * 若專案已有 _parseTimeToMinutes_，可刪除本檔頂端 helper，改呼叫既有函式。
 */

function _computeReportLateEarly_(checkInTime, checkOutTime, shiftStart, shiftEnd, flexibleMinutes) {
  const checkInMins = _parseTimeToMinutesFlex_(checkInTime);
  const checkOutMins = checkOutTime != null && checkOutTime !== '' ? _parseTimeToMinutesFlex_(checkOutTime) : null;
  const shiftStartMins = _parseTimeToMinutesFlex_(shiftStart);
  const shiftEndMins = _parseTimeToMinutesFlex_(shiftEnd);
  const flex = Math.max(0, Number(flexibleMinutes) || 0);

  let lateMinutes = 0;
  let earlyMinutes = 0;

  if (checkInMins != null && shiftStartMins != null) {
    lateMinutes = Math.max(0, checkInMins - shiftStartMins - flex);
  }

  if (checkInMins != null && checkOutMins != null && shiftStartMins != null && shiftEndMins != null) {
    // 單向彈性：僅遲到在 flex 內可延後下班；早到不可提早走
    const lateWithinFlex = Math.max(0, Math.min(flex, checkInMins - shiftStartMins));
    const expectedOffMins = shiftEndMins + lateWithinFlex;
    earlyMinutes = Math.max(0, expectedOffMins - checkOutMins);
  }

  return { lateMinutes: lateMinutes, earlyMinutes: earlyMinutes };
}
