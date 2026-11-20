/**
 * 排班頁月份切換：固定到 1 號、空快取不當成功（假資料）
 * 執行：node --test tools/test-shift-schedule-month-nav.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** 與 shift_schedule.html handleMonthChange 對齊的純函式 */
function nextMonthAnchor(date, direction) {
  const y = date.getFullYear();
  const m = date.getMonth() + direction;
  return new Date(y, m, 1);
}

function cacheKeyForDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function hasUsefulScheduleCache(entry) {
  return !!(entry && entry.schedule && Object.keys(entry.schedule).length > 0);
}

describe('排班頁前月切換（假資料）', () => {
  it('從 11/10 往前一個月 → 10/1（不會卡在溢位日）', () => {
    const got = nextMonthAnchor(new Date(2026, 10, 10), -1);
    assert.equal(got.getFullYear(), 2026);
    assert.equal(got.getMonth(), 9);
    assert.equal(got.getDate(), 1);
    assert.equal(cacheKeyForDate(got), '2026-10');
  });

  it('從 3/31 往前一個月 → 2/1（避免 setMonth 溢回 3 月）', () => {
    const got = nextMonthAnchor(new Date(2026, 2, 31), -1);
    assert.equal(got.getMonth(), 1);
    assert.equal(got.getDate(), 1);
    assert.equal(cacheKeyForDate(got), '2026-02');
  });

  it('空 schedule 快取視為不可用，應重抓', () => {
    assert.equal(hasUsefulScheduleCache({ schedule: {}, holidays: new Set() }), false);
    assert.equal(
      hasUsefulScheduleCache({ schedule: { 'U-FAKE': { '2026-10-05': '休假' } }, holidays: new Set() }),
      true
    );
  });
});
