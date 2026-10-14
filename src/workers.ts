import { CANONICAL_ORIGIN } from './role'
import type { Worker } from './types'

/**
 * 預設工務（名單空白時才寫入）。恩德／阿勇與其他人一樣可改名、軟刪，
 * 不是硬編碼「內建不可動」。
 */
export const DEFAULT_WORKERS: readonly Worker[] = [
  { id: 'ops-ende', name: '恩德' },
  { id: 'ops-ayong', name: '阿勇' },
]

/** @deprecated 用 DEFAULT_WORKERS；保留給舊引用 */
export const BASE_WORKERS = DEFAULT_WORKERS

/** 舊工務 id → 新 id（僅相容轉址／指派） */
export const WORKER_ID_ALIASES: Record<string, string> = {
  'ops-w-mv7pnmxdvhx4': 'ops-w-yifang',
}

/** 短 role 別名（?role=ende／ayong）仍對應同一 id */
const SHORT_ROLE_IDS = new Set(['ops-ende', 'ops-ayong'])

export function canonicalWorkerId(id: string): string {
  return WORKER_ID_ALIASES[id] ?? id
}

/** @deprecated 已無「內建不可刪」；一律回 false，保留給舊呼叫 */
export function isBaseWorkerId(_id: string): boolean {
  return false
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
    // 保留 ende／ayong id 給既有網址相容，勿讓新工務搶走
    if (!SHORT_ROLE_IDS.has(id)) return id
  }
  return `ops-w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** 合併雲端／本地工務（含 archived）；名單全空時才補預設恩德／阿勇 */
export function mergeWorkers(raw: unknown): Worker[] {
  const byId = new Map<string, Worker>()

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const rawId = String((item as Worker).id ?? '').trim().slice(0, 40)
      const id = canonicalWorkerId(rawId)
      const name = normalizeWorkerName(String((item as Worker).name ?? ''))
      if (!id.startsWith('ops-') || !name) continue
      const archived = Boolean((item as Worker).archived)
      byId.set(id, {
        id,
        name,
        archived: archived ? true : undefined,
      })
    }
  }

  if (byId.size === 0) {
    for (const w of DEFAULT_WORKERS) byId.set(w.id, { ...w })
  }

  return [...byId.values()].sort((a, b) => {
    const ae = a.archived ? 1 : 0
    const be = b.archived ? 1 : 0
    if (ae !== be) return ae - be
    // 恩德／阿勇仍排前面，方便派工，但不代表不可刪
    const rank = (id: string) =>
      id === 'ops-ende' ? 0 : id === 'ops-ayong' ? 1 : 2
    const rd = rank(a.id) - rank(b.id)
    if (rd !== 0) return rd
    return a.name.localeCompare(b.name, 'zh-Hant')
  })
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

/** 正式站專屬網址（分享給工務用；綁 id；ende／ayong 短 role 相容） */
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
