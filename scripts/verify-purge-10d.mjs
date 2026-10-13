/**
 * Verify purgeStaleCompleted: keep incomplete + recent done; drop 10d+ done.
 * Run: node --experimental-strip-types is not needed — inline logic mirror.
 */
import assert from 'node:assert/strict'

const COMPLETED_KEEP_DAYS = 10
const COMPLETED_TTL_MS = COMPLETED_KEEP_DAYS * 24 * 60 * 60 * 1000

function isStaleCompleted(completed, completedAt, createdAt, cutoff) {
  if (!completed) return false
  const at =
    typeof completedAt === 'number' && completedAt > 0 ? completedAt : createdAt
  return at < cutoff
}

function purge(tasks, now) {
  const cutoff = now - COMPLETED_TTL_MS
  return tasks.filter(
    (t) => !isStaleCompleted(t.completed, t.completedAt, t.createdAt, cutoff),
  )
}

const now = Date.UTC(2026, 9, 13, 12, 0, 0)
const day = 24 * 60 * 60 * 1000

const input = [
  { id: 'open', completed: false, createdAt: now - 20 * day },
  {
    id: 'done-recent',
    completed: true,
    completedAt: now - 3 * day,
    createdAt: now - 5 * day,
  },
  {
    id: 'done-edge',
    completed: true,
    completedAt: now - 10 * day + 1000,
    createdAt: now - 12 * day,
  },
  {
    id: 'done-stale',
    completed: true,
    completedAt: now - 10 * day - 1000,
    createdAt: now - 15 * day,
  },
  {
    id: 'done-fallback-created',
    completed: true,
    createdAt: now - 11 * day,
  },
]

const kept = purge(input, now).map((t) => t.id)
assert.deepEqual(kept, ['open', 'done-recent', 'done-edge'])
assert.ok(!kept.includes('done-stale'))
assert.ok(!kept.includes('done-fallback-created'))
assert.ok(kept.includes('open'), 'must not delete incomplete')

console.log(
  JSON.stringify({
    ok: true,
    keepDays: COMPLETED_KEEP_DAYS,
    kept,
    purged: input.map((t) => t.id).filter((id) => !kept.includes(id)),
  }),
)
