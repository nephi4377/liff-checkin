import type {
  AppState,
  OfficeTask,
  Task,
  TaskCategory,
  Urgency,
  Worker,
} from './types'
import { normalizeUrgency } from './urgency'

/** 現場工務僅限恩德、阿勇 */
export const WORKERS: Worker[] = [
  { id: 'ops-ende', name: '恩德' },
  { id: 'ops-ayong', name: '阿勇' },
]

const WORKER_IDS = new Set(WORKERS.map((w) => w.id))

/** Legacy ids remapped onto 阿勇 */
const LEGACY_TO_AYONG = new Set(['ops-renkai'])

type TaskSpec = {
  id: string
  title: string
  assigneeId: string
  category: TaskCategory
  urgency: Urgency
  order: number
  completed?: boolean
}

/** Stable IDs so redeploy / migrate 不會重複塞同一筆 */
const DISPATCH_TASKS: TaskSpec[] = [
  {
    id: 'task-ende-751-putu',
    title: '【751】補土',
    assigneeId: 'ops-ende',
    category: 'priority',
    urgency: 'urgent',
    order: 0,
  },
  {
    id: 'task-ende-786-pp',
    title: '【786】帶 PP 板',
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
  return {
    id: spec.id,
    title: spec.title,
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

function normalizeDeletedIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(String).filter(Boolean))]
}

function normalizeCategory(value: unknown): Task['category'] {
  if (value === 'priority' || value === 'todo' || value === 'deadline') return value
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
  const assigner =
    typeof t.assigner === 'string' ? t.assigner.trim() : ''
  const category = normalizeCategory(t.category)
  let dueDate: string | undefined
  if (typeof t.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate.trim())) {
    dueDate = t.dueDate.trim()
  }
  return {
    ...t,
    category,
    urgency: normalizeUrgency(t.urgency),
    detail: detail || undefined,
    assigner: assigner || undefined,
    dueDate,
    completed,
    completedAt,
  }
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

function normalizeOfficeTask(t: OfficeTask & { assigneeId?: string }): OfficeTask {
  const completed = Boolean(t.completed)
  let assigneeId = t.assigneeId
  if (!assigneeId || !WORKER_IDS.has(assigneeId)) {
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

/** Remove completed tasks older than 10 days; tombstone so seed won't revive them */
export function purgeStaleCompleted(
  state: AppState,
  now = Date.now(),
): AppState {
  const cutoff = now - COMPLETED_TTL_MS
  const purged: string[] = []
  const tasks = state.tasks.filter((t) => {
    if (isStaleCompleted(t.completed, t.completedAt, t.createdAt, cutoff)) {
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
        ...purged.map((id) => LEGACY_TASK_IDS[id] ?? id),
      ]),
    ],
    updatedAt: now,
  }
}

/** Keep only 恩德／阿勇；respect tombstones；仁凱任務改掛阿勇 */
export function ensureDispatchState(state: AppState): AppState {
  const deletedIds = normalizeDeletedIds(state.deletedIds)
  const deleted = new Set(deletedIds)
  // Legacy remap: deleting either id tombstones both
  for (const [from, to] of Object.entries(LEGACY_TASK_IDS)) {
    if (deleted.has(from)) deleted.add(to)
    if (deleted.has(to)) deleted.add(from)
  }

  const tasksById = new Map<string, Task>()

  for (const t of state.tasks ?? []) {
    const nextId = LEGACY_TASK_IDS[t.id] ?? t.id
    if (deleted.has(t.id) || deleted.has(nextId)) continue

    let assigneeId = t.assigneeId
    if (LEGACY_TO_AYONG.has(assigneeId) || t.id === 'task-renkai-trim-knife') {
      assigneeId = 'ops-ayong'
    }
    if (!WORKER_IDS.has(assigneeId)) continue

    const existing = tasksById.get(nextId)
    if (existing) {
      const merged = normalizeTaskFields({
        ...existing,
        completed: existing.completed || t.completed,
        title: existing.title || t.title,
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
    const normalized = normalizeOfficeTask({
      ...(raw as OfficeTask),
      id: nextId,
    })
    if (!WORKER_IDS.has(normalized.assigneeId)) continue
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

  const normalized: AppState = {
    workers: WORKERS.map((w) => ({ ...w })),
    tasks: Array.from(tasksById.values()),
    officeTasks: Array.from(officeById.values()).sort(
      (a, b) => a.order - b.order,
    ),
    deletedIds: [...tombstones],
    updatedAt: typeof state.updatedAt === 'number' ? state.updatedAt : now,
  }
  return purgeStaleCompleted(normalized, now)
}

export function createSeedState(): AppState {
  return ensureDispatchState({
    workers: WORKERS,
    tasks: seedTasks(),
    officeTasks: [],
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

/** Serialize for cloud (workers always canonical) */
export function toSyncPayload(state: AppState): AppState {
  const normalized = ensureDispatchState(state)
  return {
    workers: WORKERS.map((w) => ({ ...w })),
    tasks: normalized.tasks,
    officeTasks: normalized.officeTasks,
    deletedIds: normalized.deletedIds,
    updatedAt: normalized.updatedAt,
  }
}
