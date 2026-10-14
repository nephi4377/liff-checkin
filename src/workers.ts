import { CANONICAL_ORIGIN } from './role'
import type { Worker } from './types'

/** 內建工務（不可刪、名稱固定） */
export const BASE_WORKERS: readonly Worker[] = [
  { id: 'ops-ende', name: '恩德' },
  { id: 'ops-ayong', name: '阿勇' },
]

const BASE_IDS = new Set(BASE_WORKERS.map((w) => w.id))

export function isBaseWorkerId(id: string): boolean {
  return BASE_IDS.has(id)
}

export function normalizeWorkerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 24)
}

/** 產生新工務 id：英文名用 slug，中文名用短碼 */
export function makeWorkerId(name: string): string {
  const n = normalizeWorkerName(name)
  const ascii = n
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (ascii.length >= 2) {
    const id = `ops-${ascii}`.slice(0, 40)
    if (!BASE_IDS.has(id)) return id
  }
  return `ops-w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 合併內建＋雲端／本地自訂工務 */
export function mergeWorkers(raw: unknown): Worker[] {
  const byId = new Map<string, Worker>()
  for (const w of BASE_WORKERS) byId.set(w.id, { ...w })

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const id = String((item as Worker).id ?? '').trim().slice(0, 40)
      const name = normalizeWorkerName(String((item as Worker).name ?? ''))
      if (!id.startsWith('ops-') || !name) continue
      if (BASE_IDS.has(id)) {
        byId.set(id, { ...BASE_WORKERS.find((b) => b.id === id)! })
        continue
      }
      byId.set(id, { id, name })
    }
  }

  const extras = [...byId.values()]
    .filter((w) => !BASE_IDS.has(w.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  return [...BASE_WORKERS.map((w) => ({ ...w })), ...extras]
}

export function workerIdsOf(workers: Worker[]): Set<string> {
  return new Set(workers.map((w) => w.id))
}

/** 正式站專屬網址（分享給工務用） */
export function workerShareUrl(workerId: string): string {
  const base = CANONICAL_ORIGIN.endsWith('/')
    ? CANONICAL_ORIGIN
    : `${CANONICAL_ORIGIN}/`
  if (workerId === 'ops-ende') return `${base}?role=ende`
  if (workerId === 'ops-ayong') return `${base}?role=ayong`
  return `${base}?role=${encodeURIComponent(workerId)}`
}

/** 相對路徑（同站內切換） */
export function workerLocalHref(workerId: string): string {
  if (workerId === 'ops-ende') return './?role=ende'
  if (workerId === 'ops-ayong') return './?role=ayong'
  return `./?role=${encodeURIComponent(workerId)}`
}
