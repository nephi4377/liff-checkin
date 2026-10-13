import type { Task, Urgency } from './types'

export const URGENCY_OPTIONS: { id: Urgency; label: string }[] = [
  { id: 'urgent', label: '緊急' },
  { id: 'normal', label: '普通' },
  { id: 'low', label: '不急' },
]

export function normalizeUrgency(value: unknown): Urgency {
  if (value === 'urgent' || value === 'normal' || value === 'low') return value
  return 'normal'
}

export function urgencyLabel(urgency: Urgency): string {
  return URGENCY_OPTIONS.find((o) => o.id === urgency)?.label ?? '普通'
}

/** 優先區：緊急 → 普通 → 不急，同級再依 order */
export const URGENCY_RANK: Record<Urgency, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
}

export function comparePriorityTasks(
  a: Pick<Task, 'urgency' | 'order'>,
  b: Pick<Task, 'urgency' | 'order'>,
): number {
  const byUrgency = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
  if (byUrgency !== 0) return byUrgency
  return a.order - b.order
}

export function sortPriorityTasks<T extends Pick<Task, 'urgency' | 'order'>>(
  tasks: T[],
): T[] {
  return [...tasks].sort(comparePriorityTasks)
}

export function reindexPriorityOrdersForAssignee(
  tasks: Task[],
  assigneeId: string,
): Task[] {
  const sorted = sortPriorityTasks(
    tasks.filter(
      (t) =>
        t.assigneeId === assigneeId &&
        t.category === 'priority' &&
        !t.completed,
    ),
  )
  const orderMap = new Map(sorted.map((t, i) => [t.id, i]))
  return tasks.map((t) => {
    const next = orderMap.get(t.id)
    return next === undefined ? t : { ...t, order: next }
  })
}
