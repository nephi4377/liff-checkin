/** Normalize to YYYY-MM-DD or undefined */
export function normalizeDueDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const t = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return t
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 例：2026/10/13（一）— 預設不加「前」 */
export function formatDueDateLabel(dueDate: string): string {
  const [y, m, day] = dueDate.split('-')
  const d = new Date(`${dueDate}T12:00:00`)
  const wd = Number.isNaN(d.getTime())
    ? ''
    : `（${WEEKDAY_ZH[d.getDay()]}）`
  return `${y}/${m}/${day}${wd}`
}

/** Local calendar day YYYY-MM-DD */
export function todayYmd(): string {
  const n = new Date()
  const y = n.getFullYear()
  const m = String(n.getMonth() + 1).padStart(2, '0')
  const d = String(n.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isOverdue(dueDate: string | undefined, completed: boolean): boolean {
  if (!dueDate || completed) return false
  return dueDate < todayYmd()
}

export function compareDeadlineTasks(
  a: { dueDate?: string; order: number },
  b: { dueDate?: string; order: number },
): number {
  const ad = a.dueDate ?? '9999-99-99'
  const bd = b.dueDate ?? '9999-99-99'
  if (ad !== bd) return ad < bd ? -1 : 1
  return a.order - b.order
}
