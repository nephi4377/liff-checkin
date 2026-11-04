/**
 * 任務交辦「全體發送」：展開成員工 UID，不可送字面 ALL（巡檢 #56 / OLD-PR-CHERRYPICK-LIFF-7）。
 * Run: node --test tools/test-task-sender-resolve-recipients.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHubStaffRecipientIds } from '../shared/js/taskSenderRecipients.js';

const MOCK_STAFF = [
  { userId: 'U0000000000000000000000000e2e01', userName: 'E2E-A', permission: 3, status: '員工' },
  { userId: 'U0000000000000000000000000e2e02', userName: 'E2E-B', permission: 2, status: '員工' },
  { userId: 'U0000000000000000000000000e2e03', userName: 'E2E-C', permission: 1, status: '員工' },
  { userId: 'U0000000000000000000000000e2e04', userName: 'E2E-D', permission: 3, status: '離職' },
  { userId: 'U0000000000000000000000000e2e05', userName: 'E2E-V', permission: 4, status: '廠商' },
];

test('sendToAll expands to staff UIDs and never includes literal ALL', () => {
  const out = resolveHubStaffRecipientIds(MOCK_STAFF, { sendToAll: true, selectedIds: [] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.recipients, [
    'U0000000000000000000000000e2e01',
    'U0000000000000000000000000e2e02',
  ]);
  assert.equal(out.recipients.includes('ALL'), false);
});

test('sendToAll with empty staff list fails with human message', () => {
  const out = resolveHubStaffRecipientIds([], { sendToAll: true, selectedIds: [] });
  assert.equal(out.ok, false);
  assert.equal(out.recipients.length, 0);
  assert.match(out.error, /名單|員工/);
});

test('single assignee path unchanged when not sendToAll', () => {
  const one = 'U0000000000000000000000000e2e99';
  const out = resolveHubStaffRecipientIds(MOCK_STAFF, { sendToAll: false, selectedIds: [one] });
  assert.equal(out.ok, true);
  assert.deepEqual(out.recipients, [one]);
});

test('no selection when not sendToAll fails without sending', () => {
  const out = resolveHubStaffRecipientIds(MOCK_STAFF, { sendToAll: false, selectedIds: [] });
  assert.equal(out.ok, false);
  assert.match(out.error, /至少選擇一位/);
});
