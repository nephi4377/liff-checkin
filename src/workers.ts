import { CANONICAL_ORIGIN } from './role'
import type { Worker } from './types'

/** 內建工務（不可刪） */
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

/** 產生新工務 id：英文名用 slug，中文名用短碼（網址綁 id，改名不影響） */
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

/** 合併內建＋雲端／本地自訂工務（含 archived） */
export function mergeWorkers(raw: unknown): Worker[] {
  const byId = new Map<string, Worker>()
  for (const w of BASE_WORKERS) byId.set(w.id, { ...w })

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const id = String((item as Worker).id ?? '').trim().slice(0, 40)
      const name = normalizeWorkerName(String((item as Worker).name ?? ''))
      if (!id.startsWith('ops-') || !name) continue
      const archived = Boolean((item as Worker).archived)
      if (BASE_IDS.has(id)) {
        byId.set(id, {
          id,
          name: name || BASE_WORKERS.find((b) => b.id === id)!.name,
        })
        continue
      }
      byId.set(id, {
        id,
        name,
        archived: archived ? true : undefined,
      })
    }
  }

  const extras = [...byId.values()]
    .filter((w) => !BASE_IDS.has(w.id))
    .sort((a, b) => {
      const ae = a.archived ? 1 : 0
      const be = b.archived ? 1 : 0
      if (ae !== be) return ae - be
      return a.name.localeCompare(b.name, 'zh-Hant')
    })
  return [
    ...BASE_WORKERS.map((w) => {
      const cur = byId.get(w.id)!
      return { id: w.id, name: cur.name || w.name }
    }),
    ...extras,
  ]
}

/** 可指派／可選的工務（未軟刪） */
export function activeWorkers(workers: Worker[]): Worker[] {
  return workers.filter((w) => !w.archived)
}

export function workerIdsOf(workers: Worker[]): Set<string> {
  return new Set(workers.map((w) => w.id))
}

/**
 * 遠端較新時仍保留本地多出的工務（避免整包 LWW 把剛新增、尚未 push 的工務蓋掉）。
 * 同 id 以 remote 為準（含改名／軟刪）。
 */
export function mergeWorkersKeepingLocalExtras(
  local: unknown,
  remote: unknown,
): Worker[] {
  const remoteList = mergeWorkers(remote)
  const remoteIds = new Set(remoteList.map((w) => w.id))
  const localOnly = mergeWorkers(local).filter((w) => !remoteIds.has(w.id))
  return mergeWorkers([...remoteList, ...localOnly])
}

export function workerDisplayName(
  workers: Worker[],
  id: string,
  fallback = '未知',
): string {
  const w = workers.find((x) => x.id === id)
  if (!w) return fallback
  return w.archived ? `${w.name}（已刪）` : w.name
}

/** 正式站專屬網址（分享給工務用；綁 id） */
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
