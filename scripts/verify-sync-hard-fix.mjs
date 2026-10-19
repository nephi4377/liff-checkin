/**
 * 可重現驗證：本機只有種子但 updatedAt 較新 → 安全 push 後雲端真實任務仍在。
 * 並證明舊房間裸 LWW 蓋不到 v2 房間。
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// 用編譯後邏輯太重；此腳本直接打 Mantle API，並嵌入與 cloud.ts 相同的關鍵規則
const SYNC_BASE = 'https://mantledb.sh/v2'
const OLD_NS = 'yang-employee-todo-1791806583'
const NEW_NS = 'yang-employee-todo-v2-1792379200'
const SYNC_KEY =
  '24ce4c38fe39557b581e91695e066e94a2ee3be8d649e82136a6e4782c11af36'
const SEED_IDS = new Set([
  'task-ende-751-putu',
  'task-ende-786-pp',
  'task-ende-photo-trim',
  'task-ende-hao-790',
  'task-ende-reorder-qty',
  'task-ayong-trim-knife',
])

async function getRoom(ns) {
  const res = await fetch(`${SYNC_BASE}/${ns}/room`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET ${ns} ${res.status}`)
  return res.json()
}

async function postRoom(ns, body) {
  const res = await fetch(`${SYNC_BASE}/${ns}/room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': SYNC_KEY,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${ns} ${res.status}`)
  return res.json()
}

function isSeedOnly(state) {
  const deleted = new Set(state.deletedIds || [])
  const live = (state.tasks || []).filter((t) => t?.id && !deleted.has(t.id))
  if (!live.length) return true
  return live.every((t) => SEED_IDS.has(t.id))
}

function mergeCloudTaskExtras(local, remote) {
  const deleted = new Set(local.deletedIds || [])
  for (const id of remote.deletedIds || []) deleted.add(id)
  const tasksById = new Map()
  for (const t of local.tasks || []) {
    if (t?.id && !deleted.has(t.id)) tasksById.set(t.id, t)
  }
  for (const t of remote.tasks || []) {
    if (!t?.id || deleted.has(t.id) || tasksById.has(t.id)) continue
    tasksById.set(t.id, t)
  }
  return {
    ...local,
    tasks: [...tasksById.values()],
    deletedIds: [...deleted],
    workers: remote.workers?.length ? remote.workers : local.workers,
    officeTasks: remote.officeTasks ?? local.officeTasks,
    updatedAt: Math.max(local.updatedAt + 1, remote.updatedAt + 1, Date.now()),
  }
}

/** 新協議 pushCloud 精簡版 */
async function safePush(ns, local) {
  const remote = await getRoom(ns)
  let next = local
  if (remote) {
    if (isSeedOnly(local)) {
      next = {
        ...remote,
        workers: remote.workers,
        updatedAt: Math.max(remote.updatedAt + 1, Date.now()),
      }
    } else {
      next = mergeCloudTaskExtras(local, remote)
    }
  }
  await postRoom(ns, next)
  return next
}

function seedAttackPayload(updatedAt) {
  const now = Date.now()
  return {
    workers: [
      { id: 'ops-ende', name: '恩德' },
      { id: 'ops-ayong', name: '阿勇' },
    ],
    tasks: [...SEED_IDS].map((id, i) => ({
      id,
      title: `種子假資料-${i}`,
      assigneeId: id.includes('ayong') ? 'ops-ayong' : 'ops-ende',
      category: 'todo',
      urgency: 'normal',
      completed: false,
      order: i,
      createdAt: now - i * 1000,
    })),
    officeTasks: [],
    assigners: [],
    deletedIds: [],
    updatedAt,
  }
}

function assertHasReal(room, label) {
  const ids = new Set((room.tasks || []).map((t) => t.id))
  const ok =
    ids.has('1320a985-09b2-42ad-8835-45555f580eab') &&
    ids.has('0c083ed9-c0f2-45b8-8ee9-5d5abeef1491')
  if (!ok) {
    throw new Error(
      `${label} missing real tasks: ${JSON.stringify((room.tasks || []).map((t) => t.caseNo + ':' + t.title))}`,
    )
  }
}

const before = await getRoom(NEW_NS)
console.log('before v2', {
  n: before?.tasks?.length,
  cases: before?.tasks?.map((t) => t.caseNo + ':' + t.title),
})
assertHasReal(before, 'before')

// 1) 舊客戶端裸 LWW 打舊房：不應影響 v2
const attack = seedAttackPayload(Date.now() + 10_000_000)
await postRoom(OLD_NS, attack)
const afterOldAttack = await getRoom(NEW_NS)
assertHasReal(afterOldAttack, 'after old-room raw LWW')
console.log('PASS: old-room raw LWW did not touch v2')

// 2) 新協議：種子 + 超新 updatedAt → safePush → 真實任務仍在
await safePush(NEW_NS, attack)
const afterSafe = await getRoom(NEW_NS)
assertHasReal(afterSafe, 'after safe seed push')
const stillSeedTitles = (afterSafe.tasks || []).some((t) =>
  String(t.title || '').includes('種子假資料'),
)
if (stillSeedTitles && (afterSafe.tasks || []).length <= 6) {
  // 若只剩種子表示失敗
  throw new Error('safe push replaced cloud with seeds')
}
console.log('PASS: safe seed push kept real tasks', {
  n: afterSafe.tasks.length,
  cases: afterSafe.tasks.map((t) => t.caseNo + ':' + t.title),
})

// 3) 還原 v2 為遷移前狀態（去掉驗證時可能併入的種子）
await postRoom(NEW_NS, {
  ...before,
  updatedAt: Date.now(),
})
const restored = await getRoom(NEW_NS)
assertHasReal(restored, 'restored')
console.log('PASS: restored v2 to pre-test snapshot', {
  n: restored.tasks.length,
  cases: restored.tasks.map((t) => t.caseNo + ':' + t.title),
})

console.log('ALL VERIFY OK')
