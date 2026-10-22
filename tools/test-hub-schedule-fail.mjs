/**
 * Hub schedule fetch: failure must not wipe schedule or pretend everyone is working.
 * Run: node --test tools/test-hub-schedule-fail.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isValidSchedulePayload, mergeHubScheduleFetch } from '../spa/hubSchedule.js';

test('isValidSchedulePayload rejects empty or malformed API bodies', () => {
  assert.equal(isValidSchedulePayload(null), false);
  assert.equal(isValidSchedulePayload({ success: false }), false);
  assert.equal(isValidSchedulePayload({ schedule: [] }), false);
  assert.equal(isValidSchedulePayload({ schedule: { u1: { '2026-10-22': '休' } } }), true);
});

test('mergeHubScheduleFetch keeps previous schedule on failure and does not save cache', () => {
  const prev = {
    schedule: { u1: { '2026-10-22': '休' } },
    holidays: ['2026-10-01']
  };
  const out = mergeHubScheduleFetch(prev, { ok: false, message: '班表載入失敗，請再試' });
  assert.match(out.error, /班表/);
  assert.equal(out.saveCache, false);
  assert.deepEqual(out.schedule.schedule, prev.schedule);
  assert.deepEqual(out.schedule.holidays, prev.holidays);
});

test('mergeHubScheduleFetch overwrites on success', () => {
  const prev = { schedule: { u1: { '2026-10-22': '休' } }, holidays: [] };
  const fresh = { schedule: { u2: { '2026-10-23': '班' } }, holidays: ['2026-10-10'] };
  const out = mergeHubScheduleFetch(prev, { ok: true, ...fresh });
  assert.equal(out.error, '');
  assert.equal(out.saveCache, true);
  assert.deepEqual(out.schedule.schedule, fresh.schedule);
});

test('spa/app.js wires scheduleError into Dashboard and sidebar', () => {
  const app = readFileSync(new URL('../spa/app.js', import.meta.url), 'utf8');
  assert.match(app, /scheduleError/);
  assert.match(app, /mergeHubScheduleFetch/);
  assert.match(app, /refreshScheduleInBackground/);
  assert.match(app, /:scheduleError="scheduleError"/);
  assert.match(app, /@retry-schedule="refreshScheduleInBackground"/);
  assert.doesNotMatch(app, /出席區塊將退回基本顯示/);
});
