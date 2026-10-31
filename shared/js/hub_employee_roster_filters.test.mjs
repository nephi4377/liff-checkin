/**
 * Hub 員工快取篩選：測試必須在「舊行為」上失敗、在新行為上通過。
 * Run: node --test shared/js/hub_employee_roster_filters.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECENT_RESIGNED_DAYS,
  filterAttendanceActiveWithRecentResigned,
  filterDirectorHrEmployees,
  filterDailyReportEmployees,
  shouldUseFilteredHubRoster,
  parseResignationDate
} from './hub_employee_roster_filters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NOW = Date.parse('2026-10-30T12:00:00+08:00');
const dayMs = 24 * 60 * 60 * 1000;

function daysAgo(n) {
  return new Date(NOW - n * dayMs).toISOString().slice(0, 10);
}

/** 舊出勤篩選（#245 初版）：只擋廠商／權限≥5，未套 60 天離職窗 */
function legacyFilterAttendanceRoster(list) {
  return (list || []).filter((emp) => {
    if (!emp) return false;
    const status = String(emp.status || '員工').trim();
    if (status === '廠商') return false;
    const perm = parseInt(emp.permission, 10) || 1;
    if (perm >= 5) return false;
    return true;
  });
}

/** 舊工作總覽篩選：嚴格 === 數字，且未排除離職 */
function legacyFilterDailyReportEmployees(list) {
  return (Array.isArray(list) ? list : []).filter(
    (emp) => emp && (emp.permission === 2 || emp.permission === 3)
  );
}

/** 舊人事筆記快取篩選：只排除離職，未排除廠商 */
function legacyFilterDirectorHr(list) {
  return (list || []).filter((emp) => emp && emp.status !== '離職');
}

describe('parseResignationDate', () => {
  it('接受 yyyy/M/d', () => {
    const d = parseResignationDate('2026/9/1');
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8);
    assert.equal(d.getDate(), 1);
  });
});

describe('#245 attendance_active_with_recent_resigned', () => {
  const roster = [
    { userId: 'A', userName: '在職', status: '員工', permission: 2 },
    { userId: 'B', userName: '近離', status: '離職', permission: 2, resignationDate: daysAgo(30) },
    { userId: 'C', userName: '久離', status: '離職', permission: 2, resignationDate: daysAgo(90) },
    { userId: 'D', userName: '廠商', status: '廠商', permission: 2 },
    { userId: 'E', userName: '總監', status: '員工', permission: 5 },
    { userId: 'F', userName: '無日', status: '離職', permission: 2, resignationDate: '' }
  ];

  it('舊行為會把超過 60 天離職者留在名單（回歸錨點）', () => {
    const legacy = legacyFilterAttendanceRoster(roster).map((e) => e.userId);
    assert.ok(legacy.includes('C'), '舊篩選錯誤地保留久離職');
  });

  it('新行為：在職 + 60 天內離職；排除久離／無離職日／廠商／權限≥5', () => {
    const ids = filterAttendanceActiveWithRecentResigned(roster, NOW).map((e) => e.userId);
    assert.deepEqual(ids.sort(), ['A', 'B']);
    assert.equal(RECENT_RESIGNED_DAYS, 60);
  });

  it('篩完若只剩不該顯示者 → 空陣列，呼叫端應打後端', () => {
    const onlyStale = [
      { userId: 'C', status: '離職', permission: 2, resignationDate: daysAgo(90) },
      { userId: 'D', status: '廠商', permission: 2 }
    ];
    const filtered = filterAttendanceActiveWithRecentResigned(onlyStale, NOW);
    assert.equal(filtered.length, 0);
    assert.equal(shouldUseFilteredHubRoster(filtered), false);
  });
});

describe('#246 daily report employees', () => {
  const roster = [
    { userId: 'S2', userName: '字串2', status: '員工', permission: '2' },
    { userId: 'N3', userName: '數字3', status: '員工', permission: 3 },
    { userId: 'R', userName: '離職仍權限2', status: '離職', permission: 2 },
    { userId: 'P1', userName: '權限1', status: '員工', permission: 1 },
    { userId: 'P4', userName: '權限4', status: '員工', permission: '4' }
  ];

  it('舊行為漏掉字串權限 "2"／"3"，且會把離職者當缺交對象', () => {
    const legacy = legacyFilterDailyReportEmployees(roster).map((e) => e.userId);
    assert.ok(!legacy.includes('S2'), '舊嚴格 === 漏掉字串 "2"');
    assert.ok(legacy.includes('R'), '舊行為未排除離職');
  });

  it('新行為：正規化權限字串，並排除離職', () => {
    const ids = filterDailyReportEmployees(roster).map((e) => e.userId);
    assert.deepEqual(ids.sort(), ['N3', 'S2']);
  });

  it('篩完空 → 不可當快取命中', () => {
    const onlyResigned = [{ userId: 'R', status: '離職', permission: 2 }];
    const filtered = filterDailyReportEmployees(onlyResigned);
    assert.equal(shouldUseFilteredHubRoster(filtered), false);
  });

  it('工作總覽原始碼須用共用篩選且先判斷 shouldUseFilteredHubRoster', () => {
    const src = readFileSync(
      join(__dirname, '../../modules/projects/js/daily_report_main.js'),
      'utf8'
    );
    assert.match(src, /filterDailyReportEmployees/);
    assert.match(src, /shouldUseFilteredHubRoster/);
    assert.equal(
      /permission\s*===\s*2\s*\|\|\s*emp\.permission\s*===\s*3/.test(src),
      false,
      '不可再使用嚴格 === 2／3（會漏字串權限）'
    );
  });
});

describe('#247 director HR employees', () => {
  const roster = [
    { userId: 'A', userName: '員工', status: '員工', permission: 2 },
    { userId: 'V', userName: '廠商甲', status: '廠商', permission: 2 },
    { userId: 'R', userName: '離職', status: '離職', permission: 2 },
    { userId: 'X', userName: '總監', status: '員工', permission: 5 }
  ];

  it('舊行為會把廠商留在選人清單', () => {
    const legacy = legacyFilterDirectorHr(roster).map((e) => e.userId);
    assert.ok(legacy.includes('V'), '舊篩選未排除廠商');
  });

  it('新行為排除廠商／離職／權限≥5', () => {
    const ids = filterDirectorHrEmployees(roster).map((e) => e.userId);
    assert.deepEqual(ids, ['A']);
  });

  it('篩完空 → 後端 fallback', () => {
    const onlyVendors = [{ userId: 'V', status: '廠商', permission: 2 }];
    assert.equal(shouldUseFilteredHubRoster(filterDirectorHrEmployees(onlyVendors)), false);
  });

  it('本頁原始碼不得寫回共用 HubRefCache.employees（防 demo 污染）', () => {
    const src = readFileSync(
      join(__dirname, '../../modules/attendance/director_hr_notes.html'),
      'utf8'
    );
    assert.equal(
      /Hub\.set\s*\(\s*['"]employees['"]/.test(src),
      false,
      'director_hr_notes 不可 Hub.set(\"employees\")'
    );
    assert.match(src, /filterDirectorHrEmployees/);
    assert.match(src, /shouldUseFilteredHubRoster/);
  });
});

describe('#249 attendance_report 不信任 HubRefCache', () => {
  const src = readFileSync(
    join(__dirname, '../../modules/attendance/attendance_report.html'),
    'utf8'
  );

  it('不得以 Hub 名單略過 get_employees', () => {
    assert.doesNotMatch(src, /略過 get_employees/);
    assert.doesNotMatch(src, /function readHubRefEmployees/);
    assert.doesNotMatch(src, /filterAttendanceActiveWithRecentResigned\s*\(/);
  });

  it('loadAndRenderEmployees 必打後端 get_employees', () => {
    assert.match(src, /action:\s*'get_employees'/);
    assert.match(src, /attendance_active_with_recent_resigned/);
    assert.match(src, /一律向後端確認|向後端請求員工列表/);
  });
});
