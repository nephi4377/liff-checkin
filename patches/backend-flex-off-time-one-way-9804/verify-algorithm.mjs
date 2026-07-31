#!/usr/bin/env node
/**
 * 單向彈性下班驗證（與 shared/js/utils.js 及 backend snippet 同公式）
 * 執行：node patches/backend-flex-off-time-one-way-9804/verify-algorithm.mjs
 */

function parseTimeToMinutes(timeVal) {
  if (timeVal == null || timeVal === '') return null;
  const m = String(timeVal).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatMinutesToTime(totalMins) {
  if (totalMins == null || Number.isNaN(totalMins)) return null;
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMins)));
  const h = Math.floor(t / 60);
  const min = t % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function computeExpectedOffTime(checkInTime, shiftStart, shiftEnd, flexibleMinutes = 0) {
  const ci = parseTimeToMinutes(checkInTime);
  const ss = parseTimeToMinutes(shiftStart);
  const se = parseTimeToMinutes(shiftEnd);
  if (ci == null || ss == null || se == null) return null;
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  const lateWithinFlex = Math.max(0, Math.min(flex, ci - ss));
  return formatMinutesToTime(se + lateWithinFlex);
}

function computeEarlyMinutes(checkOutTime, checkInTime, shiftStart, shiftEnd, flexibleMinutes = 0) {
  const co = parseTimeToMinutes(checkOutTime);
  const expectedOff = computeExpectedOffTime(checkInTime, shiftStart, shiftEnd, flexibleMinutes);
  const eo = parseTimeToMinutes(expectedOff);
  if (co == null || eo == null) return 0;
  return Math.max(0, eo - co);
}

function computeLateMinutes(checkInTime, shiftStart, flexibleMinutes = 0) {
  const ci = parseTimeToMinutes(checkInTime);
  const ss = parseTimeToMinutes(shiftStart);
  if (ci == null || ss == null) return 0;
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  return Math.max(0, ci - ss - flex);
}

/** 模擬 backend _computeReportLateEarly_（snippet 版） */
function computeReportLateEarly(checkInTime, checkOutTime, shiftStart, shiftEnd, flexibleMinutes) {
  const checkInMins = parseTimeToMinutes(checkInTime);
  const checkOutMins = checkOutTime ? parseTimeToMinutes(checkOutTime) : null;
  const shiftStartMins = parseTimeToMinutes(shiftStart);
  const shiftEndMins = parseTimeToMinutes(shiftEnd);
  const flex = Math.max(0, Number(flexibleMinutes) || 0);
  let lateMinutes = 0;
  let earlyMinutes = 0;
  if (checkInMins != null && shiftStartMins != null) {
    lateMinutes = Math.max(0, checkInMins - shiftStartMins - flex);
  }
  if (checkInMins != null && checkOutMins != null && shiftStartMins != null && shiftEndMins != null) {
    const lateWithinFlex = Math.max(0, Math.min(flex, checkInMins - shiftStartMins));
    const expectedOffMins = shiftEndMins + lateWithinFlex;
    earlyMinutes = Math.max(0, expectedOffMins - checkOutMins);
  }
  return { lateMinutes, earlyMinutes };
}

const shiftStart = '08:30';
const shiftEnd = '17:30';
const flex = 30;

const cases = [
  {
    name: '07:53 → 預計下班 17:30',
    checkIn: '07:53',
    checkOut: null,
    expect: { expectedOff: '17:30', lateMinutes: 0, earlyMinutes: 0 },
  },
  {
    name: '09:00 → 預計下班 18:00',
    checkIn: '09:00',
    checkOut: null,
    expect: { expectedOff: '18:00', lateMinutes: 0, earlyMinutes: 0 },
  },
  {
    name: '07:53 上班、17:10 下班 → 早退 20',
    checkIn: '07:53',
    checkOut: '17:10',
    expect: { expectedOff: '17:30', lateMinutes: 0, earlyMinutes: 20 },
  },
];

let failed = 0;
for (const c of cases) {
  const expectedOff = computeExpectedOffTime(c.checkIn, shiftStart, shiftEnd, flex);
  const report = computeReportLateEarly(c.checkIn, c.checkOut, shiftStart, shiftEnd, flex);
  const early = c.checkOut
    ? computeEarlyMinutes(c.checkOut, c.checkIn, shiftStart, shiftEnd, flex)
    : 0;
  const late = computeLateMinutes(c.checkIn, shiftStart, flex);

  const ok =
    expectedOff === c.expect.expectedOff &&
    report.lateMinutes === c.expect.lateMinutes &&
    (c.checkOut ? report.earlyMinutes === c.expect.earlyMinutes : true) &&
    (c.checkOut ? early === c.expect.earlyMinutes : true) &&
    late === c.expect.lateMinutes;

  console.log(ok ? '✓' : '✗', c.name, {
    expectedOff,
    lateMinutes: report.lateMinutes,
    earlyMinutes: c.checkOut ? report.earlyMinutes : '-',
  });
  if (!ok) {
    failed++;
    console.log('  expected:', c.expect);
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) FAILED`);
  process.exit(1);
}
console.log('\nAll cases passed (frontend utils ≡ backend snippet).');
