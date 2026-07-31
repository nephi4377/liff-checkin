/**
 * CheckinSystem/Logic_Checkin.js — 上班打卡成功訊息內「預計下班：HH:mm」
 * 在組裝 message 處呼叫（僅上班卡或當日首卡需顯示時）。
 */

function _formatExpectedOffTimeForCheckin_(checkInTimeStr, shiftStart, shiftEnd, flexibleMinutes) {
  return _computeExpectedOffTimeStr_(checkInTimeStr, shiftStart, shiftEnd, flexibleMinutes);
}

// 範例：成功訊息組裝（依專案實際變數名調整）
function _appendExpectedOffToCheckinMessage_(message, checkInTimeStr, employeeRow) {
  const shiftStart = employeeRow.shiftStartTime || employeeRow.shiftStart || '08:30';
  const shiftEnd = employeeRow.shiftEndTime || employeeRow.shiftEnd || '17:30';
  const flex = Number(employeeRow.flexibleMinutes) || 0;
  const expectedOff = _formatExpectedOffTimeForCheckin_(checkInTimeStr, shiftStart, shiftEnd, flex);
  if (expectedOff) {
    message += '\n預計下班：' + expectedOff;
  }
  return message;
}
