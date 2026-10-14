import {
  BASE_ASSIGNERS,
  isRemovedAssigner,
  normalizeAssignerName,
} from './assigners'
import type {
  AppState,
  OfficeTask,
  Task,
  TaskCategory,
  Urgency,
  Worker,
} from './types'
import { normalizeUrgency } from './urgency'
import { BASE_WORKERS, mergeWorkers, workerIdsOf } from './workers'

/** @deprecated 請用 BASE_WORKERS／mergeWorkers；保留匯出給舊引用 */
export const WORKERS: Worker[] = BASE_WORKERS.map((w) => ({ ...w }))

/** Legacy ids remapped onto 阿勇 */
const LEGACY_TO_AYONG = new Set(['ops-renkai'])

type TaskSpec = {
  id: string
  title: string
  caseNo?: string
  assigneeId: string
  category: TaskCategory
  urgency: Urgency
  order: number
  completed?: boolean
}

/** 從舊合併標題拆案號：【751】補土 → { caseNo: '751', title: '補土' } */
export function splitCaseFromTitle(rawTitle: string): {
  caseNo?: string
  title: string
} {
  const text = String(rawTitle ?? '').trim()
  const m = text.match(/^【\s*([^】]+?)\s*】\s*(.*)$/)
  if (!m) return { title: text || '未命名' }
  const caseNo = m[1].trim()
  const rest = (m[2] ?? '').trim()
  return {
    caseNo: caseNo || undefined,
    title: rest || text,
  }
}

export function normalizeCaseNo(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const n = raw.replace(/^【|】$/g, '').trim().slice(0, 24)
  return n || undefined
}

/** Stable IDs so redeploy / migrate 不會重複塞同一筆 */
const DISPATCH_TASKS: TaskSpec[] = [
  {
    id: 'task-ende-751-putu',
    caseNo: '751',
    title: '補土',
    assigneeId: 'ops-ende',
    category: 'priority',
    urgency: 'urgent',
    order: 0,
  },
  {
    id: 'task-ende-786-pp',
    caseNo: '786',
    title: '帶 PP 板',
    assigneeId: 'ops-ende',
    category: 'priority',
    urgency: 'normal',
    order: 1,
  },
  {
    id: 'task-ende-photo-trim',
    title: '拍照：今天拿回來的收邊條放置位置',
    assigneeId: 'ops-ende',
    category: 'todo',
    urgency: 'normal',
    order: 0,
  },
  {
    id: 'task-ende-hao-790',
    title: '請豪哥確認：790 要拿幾支過去',
    assigneeId: 'ops-ende',
    category: 'todo',
    urgency: 'urgent',
    order: 1,
  },
  {
    id: 'task-ende-reorder-qty',
    title: '依確認結果補叫不夠的數量',
    assigneeId: 'ops-ende',
    category: 'todo',
    urgency: 'low',
    order: 2,
  },
  {
    id: 'task-ayong-trim-knife',
    title: '取修邊刀一支（樓下白色抽屜櫃內有）',
    assigneeId: 'ops-ayong',
    category: 'todo',
    urgency: 'normal',
    order: 0,
  },
]

/** Old seed id → new id (仁凱修邊刀 → 阿勇) */
const LEGACY_TASK_IDS: Record<string, string> = {
  'task-renkai-trim-knife': 'task-ayong-trim-knife',
}

function specToTask(spec: TaskSpec, createdAt: number): Task {
  const split = spec.caseNo
    ? { caseNo: normalizeCaseNo(spec.caseNo), title: spec.title }
    : splitCaseFromTitle(spec.title)
  return {
    id: spec.id,
    caseNo: split.caseNo,
    title: split.title,
    assigneeId: spec.assigneeId,
    category: spec.category,
    urgency: spec.urgency,
    completed: Boolean(spec.completed),
    order: spec.order,
    createdAt,
  }
}

const seedTasks = (): Task[] => {
  const now = Date.now()
  return DISPATCH_TASKS.map((s, i) => specToTask(s, now - i * 1000))
}

export const STORAGE_KEY = 'employee-todo-v3'
const LEGACY_KEYS = ['employee-todo-v1', 'employee-todo-v2']

/** 已完成超過此天數自動刪除（tombstone + sync） */
export const COMPLETED_KEEP_DAYS = 10
export const COMPLETED_TTL_MS = COMPLETED_KEEP_DAYS * 24 * 60 * 60 * 1000

/** 已刪（軟刪）超過此天數永久清除（tombstone + sync） */
export const TRASHED_KEEP_DAYS = 3
export const TRASHED_TTL_MS = TRASHED_KEEP_DAYS * 24 * 60 * 60 * 1000

function normalizeDeletedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(String).filter(Boolean))]
}

/** 從 category／type／section／isReminder 等別名還原分區 */
export function normalizeCategory(
  valueOrTask: unknown,
  maybeTask?: Record<string, unknown>,
): Task['category'] {
  const task =
    valueOrTask &&
    typeof valueOrTask === 'object' &&
    !Array.isArray(valueOrTask) &&
    maybeTask === undefined
      ? (valueOrTask as Record<string, unknown>)
      : { category: valueOrTask, ...(maybeTask ?? {}) }

  const tokens = [task.category, task.type, task.section]
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim().toLowerCase())

  // 提醒優先：避免舊版把 category 改成 todo 後丢掉分區
  if (
    tokens.includes('reminder') ||
    tokens.includes('提醒') ||
    task.isReminder === true
  ) {
    return 'reminder'
  }
  // 舊「限期件」分區併入優先（保留 dueDate）
  if (
    tokens.includes('deadline') ||
    tokens.includes('priority') ||
    tokens.includes('優先')
  ) {
    return 'priority'
  }
  if (
    tokens.includes('todo') ||
    tokens.includes('待處理') ||
    tokens.includes('pending')
  ) {
    return 'todo'
  }
  return 'todo'
}

function normalizeTaskFields(t: Task): Task {
  const completed = Boolean(t.completed)
  let completedAt = t.completedAt
  if (completed) {
    completedAt =
      typeof completedAt === 'number' && completedAt > 0
        ? completedAt
        : t.createdAt || Date.now()
  } else {
    completedAt = undefined
  }
  const detail =
    typeof t.detail === 'string' ? t.detail.trim() : ''
  const workerNote =
    typeof t.workerNote === 'string' ? t.workerNote.trim() : ''
  const assigner =
    typeof t.assigner === 'string' ? t.assigner.trim() : ''
  const category = normalizeCategory(t as unknown as Record<string, unknown>)
  let dueDate: string | undefined
  if (typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate.trim())) {
    dueDate = t.dueDate.trim()
  }
  const trashedAt =
    typeof t.trashedAt === 'number' && t.trashedAt > 0 ? t.trashedAt : undefined
  const pinned = Boolean(t.pinned) && category === 'priority' && !trashedAt

  let caseNo = normalizeCaseNo(t.caseNo)
  let title = typeof t.title === 'string' ? t.title.trim() : ''
  if (!caseNo && title) {
    const split = splitCaseFromTitle(title)
    caseNo = split.caseNo
    title = split.title
  }
  if (!title) title = '未命名'

  return {
    ...t,
    caseNo,
    title,
    category,
    isReminder: category === 'reminder' ? true : undefined,
    urgency: normalizeUrgency(t.urgency),
    detail: detail || undefined,
    workerNote: workerNote || undefined,
    assigner: assigner || undefined,
    dueDate,
    completed,
    completedAt,
    trashedAt,
    pinned: pinned || undefined,
  }
}

/** 進行中／已完成清單用（排除垃圾桶） */
export function isActiveTask(t: Task): boolean {
  return !(typeof t.trashedAt === 'number' && t.trashedAt > 0)
}

export function isTrashedTask(t: Task): boolean {
  return typeof t.trashedAt === 'number' && t.trashedAt > 0
}

function isStaleCompleted(
  completed: boolean,
  completedAt: number | undefined,
  createdAt: number,
  cutoff: number,
): boolean {
  if (!completed) return false
  const at =
    typeof completedAt === 'number' && completedAt > 0 ? completedAt : createdAt
  return at < cutoff
}

function normalizeOfficeTask(
  t: OfficeTask & { assigneeId?: string },
  knownWorkers: Set<string>,
): OfficeTask {
  const completed = Boolean(t.completed)
  let assigneeId = t.assigneeId
  if (!assigneeId || !knownWorkers.has(assigneeId)) {
    // Legacy unassigned → 恩德
    assigneeId = 'ops-ende'
  }
  return {
    id: String(t.id),
    title: String(t.title || '').trim() || '未命名',
    assigneeId,
    completed,
    completedAt: completed
      ? typeof t.completedAt === 'number' && t.completedAt > 0
        ? t.completedAt
        : t.createdAt || Date.now()
      : undefined,
    order: typeof t.order === 'number' ? t.order : 0,
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
  }
}

/** Seed 工務 examples per 恩德／阿勇 (tombstone-aware) */
const OFFICE_SEED: Omit<OfficeTask, 'createdAt' | 'completed' | 'completedAt'>[] =
  [
    {
      id: 'office-ende-quote',
      title: '跟進報價單回覆',
      assigneeId: 'ops-ende',
      order: 0,
    },
    {
      id: 'office-ende-invoice',
      title: '核對本月發票',
      assigneeId: 'ops-ende',
      order: 1,
    },
    {
      id: 'office-ayong-receipt',
      title: '整理收據交給羊',
      assigneeId: 'ops-ayong',
      order: 0,
    },
  ]

/** Old seed ids → drop via tombstone if needed; remap unassigned seeds */
const LEGACY_OFFICE_IDS: Record<string, string> = {
  'office-quote-follow': 'office-ende-quote',
  'office-invoice-check': 'office-ende-invoice',
}

function isStaleTrashed(trashedAt: number | undefined, now: number): boolean {
  if (typeof trashedAt !== 'number' || trashedAt <= 0) return false
  return trashedAt < now - TRASHED_TTL_MS
}

/** Remove completed (>10d) and soft-deleted (>3d); tombstone so seed won't revive */
export function purgeStaleCompleted(
  state: AppState,
  now = Date.now(),
): AppState {
  const cutoff = now - COMPLETED_TTL_MS
  const purged: string[] = []
  const tasks = state.tasks.filter((t) => {
    if (isStaleTrashed(t.trashedAt, now)) {
      purged.push(t.id)
      return false
    }
    if (
      !t.trashedAt &&
      isStaleCompleted(t.completed, t.completedAt, t.createdAt, cutoff)
    ) {
      purged.push(t.id)
      return false
    }
    return true
  })
  const officeTasks = (state.officeTasks ?? []).filter((t) => {
    if (isStaleCompleted(t.completed, t.completedAt, t.createdAt, cutoff)) {
      purged.push(t.id)
      return false
    }
    return true
  })
  if (!purged.length) return state
  return {
    ...state,
    tasks,
    officeTasks,
    deletedIds: [
      ...new Set([
        ...normalizeDeletedIds(state.deletedIds),
        ...purged.map(
          (id) => LEGACY_TASK_IDS[id] ?? LEGACY_OFFICE_IDS[id] ?? id,
        ),
      ]),
    ],
    updatedAt: now,
  }
}

/** 合併工務名單；尊重 tombstones；仁凱任務改掛阿勇；自訂工務可同步 */
export function ensureDispatchState(state: AppState): AppState {
  const deletedIds = normalizeDeletedIds(state.deletedIds)
  const deleted = new Set(deletedIds)
  // Legacy remap: deleting either id tombstones both
  for (const [from, to] of Object.entries(LEGACY_TASK_IDS)) {
    if (deleted.has(from)) deleted.add(to)
    if (deleted.has(to)) deleted.add(from)
  }

  // 自任務／工務清單推回遺失的自訂工務（僅 id，名稱後補）
  const inferred: Worker[] = []
  for (const t of state.tasks ?? []) {
    const id = String(t.assigneeId ?? '')
    if (id.startsWith('ops-') && !inferred.some((w) => w.id === id)) {
      inferred.push({ id, name: id.replace(/^ops-w-/, '').replace(/^ops-/, '') || id })
    }
  }
  for (const t of state.officeTasks ?? []) {
    const id = String(t.assigneeId ?? '')
    if (id.startsWith('ops-') && !inferred.some((w) => w.id === id)) {
      inferred.push({ id, name: id.replace(/^ops-w-/, '').replace(/^ops-/, '') || id })
    }
  }

  // state.workers 後寫入，保留正式姓名覆蓋推論的粗名
  const workersFromState = mergeWorkers(state.workers ?? [])
  const workers = mergeWorkers([...inferred, ...(state.workers ?? [])])
  const knownWorkers = workerIdsOf(workers)

  const tasksById = new Map<string, Task>()

  for (const t of state.tasks ?? []) {
    const nextId = LEGACY_TASK_IDS[t.id] ?? t.id
    if (deleted.has(t.id) || deleted.has(nextId)) continue

    let assigneeId = t.assigneeId
    if (LEGACY_TO_AYONG.has(assigneeId) || t.id === 'task-renkai-trim-knife') {
      assigneeId = 'ops-ayong'
    }
    if (!knownWorkers.has(assigneeId)) continue

    const existing = tasksById.get(nextId)
    if (existing) {
      const merged = normalizeTaskFields({
        ...existing,
        completed: existing.completed || t.completed,
        title: existing.title || t.title,
        detail: existing.detail || t.detail,
        workerNote: existing.workerNote || t.workerNote,
        urgency: normalizeUrgency(existing.urgency ?? t.urgency),
        completedAt: existing.completedAt ?? t.completedAt,
      })
      tasksById.set(nextId, merged)
      continue
    }
    tasksById.set(
      nextId,
      normalizeTaskFields({
        ...t,
        id: nextId,
        assigneeId,
      }),
    )
  }

  const now = Date.now()
  for (const spec of DISPATCH_TASKS) {
    if (deleted.has(spec.id)) continue
    const existing = tasksById.get(spec.id)
    if (!existing) {
      tasksById.set(spec.id, specToTask(spec, now))
      continue
    }
    tasksById.set(
      spec.id,
      normalizeTaskFields({
        ...existing,
        assigneeId: spec.assigneeId,
      }),
    )
  }

  const tombstones = new Set<string>()
  for (const id of deleted) {
    tombstones.add(LEGACY_TASK_IDS[id] ?? id)
  }

  const deletedOffice = new Set(tombstones)
  for (const [from, to] of Object.entries(LEGACY_OFFICE_IDS)) {
    if (deletedOffice.has(from)) deletedOffice.add(to)
    if (deletedOffice.has(to)) deletedOffice.add(from)
  }
  const officeById = new Map<string, OfficeTask>()
  for (const raw of state.officeTasks ?? []) {
    if (!raw?.id) continue
    const nextId = LEGACY_OFFICE_IDS[raw.id] ?? raw.id
    if (deletedOffice.has(raw.id) || deletedOffice.has(nextId)) continue
    const normalized = normalizeOfficeTask(
      {
        ...(raw as OfficeTask),
        id: nextId,
      },
      knownWorkers,
    )
    if (!knownWorkers.has(normalized.assigneeId)) continue
    const existing = officeById.get(nextId)
    if (existing) {
      officeById.set(nextId, {
        ...existing,
        completed: existing.completed || normalized.completed,
        title: existing.title || normalized.title,
        completedAt: existing.completedAt ?? normalized.completedAt,
      })
      continue
    }
    officeById.set(nextId, normalized)
  }
  for (const spec of OFFICE_SEED) {
    if (deletedOffice.has(spec.id)) continue
    if (!officeById.has(spec.id)) {
      officeById.set(spec.id, {
        ...spec,
        completed: false,
        createdAt: now,
      })
    } else {
      const existing = officeById.get(spec.id)!
      officeById.set(spec.id, {
        ...existing,
        assigneeId: spec.assigneeId,
      })
    }
  }
  for (const id of deletedOffice) {
    tombstones.add(LEGACY_OFFICE_IDS[id] ?? id)
  }

  const assignerSet = new Set<string>()
  for (const name of BASE_ASSIGNERS) {
    if (!isRemovedAssigner(name)) assignerSet.add(name)
  }
  for (const raw of state.assigners ?? []) {
    const n = normalizeAssignerName(String(raw ?? ''))
    if (n && !isRemovedAssigner(n)) assignerSet.add(n)
  }
  for (const t of tasksById.values()) {
    const n = normalizeAssignerName(t.assigner ?? '')
    // 任務上的「羊」可留歷史，但不進下拉／同步名單
    if (n && !isRemovedAssigner(n)) assignerSet.add(n)
  }

  const nextAssigners = [...assignerSet]
  const hadRemovedAssigner = (state.assigners ?? []).some((a) =>
    isRemovedAssigner(String(a)),
  )
  const baseUpdatedAt =
    typeof state.updatedAt === 'number' ? state.updatedAt : now

  // 提醒分區修復／補寫 isReminder 時抬 revision，boot／pull 會寫回 MantleDB
  const beforeMeta = new Map(
    (state.tasks ?? []).map((t) => [
      String(t.id),
      {
        category: t.category,
        isReminder: Boolean(t.isReminder),
      },
    ]),
  )
  let reminderMetaRepaired = false
  for (const t of tasksById.values()) {
    const prev = beforeMeta.get(t.id)
    if (!prev) continue
    if (
      prev.category !== t.category ||
      prev.isReminder !== Boolean(t.isReminder)
    ) {
      reminderMetaRepaired = true
      break
    }
  }

  const workersChanged =
    workers.length !== workersFromState.length ||
    workers.some((w) => {
      const prev = workersFromState.find((p) => p.id === w.id)
      return (
        !prev ||
        prev.name !== w.name ||
        Boolean(prev.archived) !== Boolean(w.archived)
      )
    })

  const normalized: AppState = {
    workers,
    tasks: Array.from(tasksById.values()),
    officeTasks: Array.from(officeById.values()).sort(
      (a, b) => a.order - b.order,
    ),
    assigners: nextAssigners,
    deletedIds: [...tombstones],
    // 清掉同步名單裡的已移除名／修復提醒分區／補齊工務名單時抬 revision
    updatedAt:
      hadRemovedAssigner || reminderMetaRepaired || workersChanged
        ? Math.max(baseUpdatedAt + 1, now)
        : baseUpdatedAt,
  }
  return purgeStaleCompleted(normalized, now)
}

export function createSeedState(): AppState {
  return ensureDispatchState({
    workers: BASE_WORKERS.map((w) => ({ ...w })),
    tasks: seedTasks(),
    officeTasks: [],
    assigners: [...BASE_ASSIGNERS],
    deletedIds: [],
    updatedAt: Date.now(),
  })
}

export function loadState(): AppState {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem('employee-todo-v2')
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>
      if (parsed.workers?.length && Array.isArray(parsed.tasks)) {
        return ensureDispatchState({
          workers: parsed.workers,
          tasks: parsed.tasks,
          officeTasks: Array.isArray(parsed.officeTasks)
            ? parsed.officeTasks
            : [],
          assigners: Array.isArray(parsed.assigners) ? parsed.assigners : [],
          deletedIds: normalizeDeletedIds(parsed.deletedIds),
          updatedAt:
            typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        })
      }
    }
  } catch {
    // fall through to seed
  }
  return createSeedState()
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearStoredState(): void {
  localStorage.removeItem(STORAGE_KEY)
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
}

/** Serialize for cloud（含自訂工務名單） */
export function toSyncPayload(state: AppState): AppState {
  const normalized = ensureDispatchState(state)
  return {
    workers: normalized.workers,
    tasks: normalized.tasks,
    officeTasks: normalized.officeTasks,
    assigners: normalized.assigners,
    deletedIds: normalized.deletedIds,
    updatedAt: normalized.updatedAt,
  }
}
