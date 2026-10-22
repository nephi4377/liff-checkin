import type { AppState } from '../types'
import { ensureDispatchState, toSyncPayload } from '../data'
import { SYNC_KEY, mantleSyncUrl } from './config'

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const v = value as AppState
  return Array.isArray(v.tasks) && Array.isArray(v.workers)
}

type PullOpts = {
  /** Skip write-back purge on routine polls (boot still full) */
  light?: boolean
}

export async function pullMantleCloud(
  opts: PullOpts = {},
): Promise<AppState | null> {
  const res = await fetch(mantleSyncUrl(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`pull ${res.status}`)
  const data: unknown = await res.json()
  if (!isAppState(data)) return null
  const incomingUpdatedAt =
    typeof data.updatedAt === 'number' ? data.updatedAt : 0
  const normalized = ensureDispatchState({
    workers: data.workers,
    tasks: data.tasks,
    officeTasks: Array.isArray(data.officeTasks) ? data.officeTasks : [],
    deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
    updatedAt: incomingUpdatedAt,
  })
  if (!opts.light && normalized.updatedAt > incomingUpdatedAt) {
    await pushMantleCloud(normalized)
  }
  return normalized
}

export async function pushMantleCloud(state: AppState): Promise<void> {
  const payload = toSyncPayload(state)
  const res = await fetch(mantleSyncUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': SYNC_KEY,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`push ${res.status}`)
}
