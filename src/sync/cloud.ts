import type { AppState } from '../types'
import {
  ensureDispatchState,
  isSeedOnlyTaskState,
  toSyncPayload,
} from '../data'
import {
  SYNC_KEY,
  SYNC_NAMESPACE_LEGACY,
  syncUrl,
} from './config'
import { mergeCloudTaskExtras, reconcileCloudState } from './merge'
import { mergeWorkersKeepingLocalExtras } from '../workers'

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const v = value as AppState
  return Array.isArray(v.tasks) && Array.isArray(v.workers)
}

type PullOpts = {
  /** Skip write-back purge on routine polls (boot still full) */
  light?: boolean
}

/** 裸 GET，不做 ensure／write-back（給 push 前對照用） */
export async function pullRaw(
  ns?: string,
): Promise<AppState | null> {
  const res = await fetch(syncUrl(ns), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`pull ${res.status}`)
  const data: unknown = await res.json()
  if (!isAppState(data)) return null
  return {
    workers: data.workers,
    tasks: data.tasks,
    officeTasks: Array.isArray(data.officeTasks) ? data.officeTasks : [],
    assigners: Array.isArray((data as AppState).assigners)
      ? (data as AppState).assigners
      : [],
    deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
  }
}

async function postRoom(ns: string, payload: AppState): Promise<void> {
  const res = await fetch(syncUrl(ns), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': SYNC_KEY,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`push ${ns} ${res.status}`)
}

/**
 * 舊房只貢獻「v2 沒有的 task id」；同 id 一律以 v2 為準（避免舊 PWA 改壞真實派工）。
 */
function absorbLegacyExtras(primary: AppState, legacy: AppState): AppState {
  const primaryIds = new Set((primary.tasks ?? []).map((t) => t.id))
  const deleted = new Set([
    ...(primary.deletedIds ?? []),
    ...(legacy.deletedIds ?? []),
  ])
  const extras = (legacy.tasks ?? []).filter(
    (t) => t?.id && !primaryIds.has(t.id) && !deleted.has(t.id),
  )
  if (!extras.length) {
    return {
      ...primary,
      workers: mergeWorkersKeepingLocalExtras(primary.workers, legacy.workers),
      assigners: [
        ...new Set([...(primary.assigners ?? []), ...(legacy.assigners ?? [])]),
      ],
    }
  }
  return {
    ...primary,
    tasks: [...(primary.tasks ?? []), ...extras],
    workers: mergeWorkersKeepingLocalExtras(primary.workers, legacy.workers),
    assigners: [
      ...new Set([...(primary.assigners ?? []), ...(legacy.assigners ?? [])]),
    ],
    updatedAt: Math.max(primary.updatedAt + 1, Date.now()),
  }
}

/**
 * 把 v2 權威狀態鏡像到舊房，讓仍讀舊 namespace 的 PWA 與派工／工務同一組任務。
 * 失敗不擋主房（舊房只是保險）。
 */
async function mirrorToLegacy(payload: AppState): Promise<void> {
  try {
    await postRoom(SYNC_NAMESPACE_LEGACY, payload)
  } catch {
    // ignore
  }
}

export async function pullCloud(opts: PullOpts = {}): Promise<AppState | null> {
  const data = await pullRaw()
  if (!data) return null
  let incomingUpdatedAt = data.updatedAt
  let merged = data

  // 開機／完整 pull：撈舊房只合併新 id（修雙腦）
  if (!opts.light) {
    try {
      const legacy = await pullRaw(SYNC_NAMESPACE_LEGACY)
      if (legacy) {
        const before = merged.tasks?.length ?? 0
        merged = absorbLegacyExtras(merged, legacy)
        if ((merged.tasks?.length ?? 0) > before) {
          incomingUpdatedAt = data.updatedAt // 強制下面 write-back
        }
      }
    } catch {
      // 舊房失敗不擋主房
    }
  }

  const normalized = ensureDispatchState(merged)
  if (!opts.light && normalized.updatedAt > incomingUpdatedAt) {
    await pushCloud(normalized)
  } else if (!opts.light) {
    // 即使沒多 id，也把 v2 鏡回舊房，收斂雙房標題分裂
    await mirrorToLegacy(toSyncPayload(normalized))
  }
  return normalized
}

/**
 * 強制協議：禁止裸 LWW。
 * 每次 POST 前必先 GET；種子狀態不得覆蓋雲端任務；會丟掉遠端活任務則 merge。
 * 成功後鏡像舊房，斷開派工／工務各讀各房。
 */
export async function pushCloud(state: AppState): Promise<AppState> {
  let next = ensureDispatchState(state)

  try {
    const remote = await pullRaw()
    if (remote) {
      if (isSeedOnlyTaskState(next)) {
        // 種子永遠輸：雲端任務／tombstone 全保留，只聯集本地工務
        next = ensureDispatchState({
          ...remote,
          workers: mergeWorkersKeepingLocalExtras(next.workers, remote.workers),
          updatedAt: Math.max(remote.updatedAt + 1, Date.now()),
        })
      } else {
        // 一律和解：補遠端多出的 id；同 id 本機較新時保留本機（剛編輯）
        next = ensureDispatchState(
          reconcileCloudState(next, remote, {
            remoteWinsSameId: remote.updatedAt > next.updatedAt,
          }),
        )
        next = ensureDispatchState(mergeCloudTaskExtras(next, remote))
      }
    } else if (isSeedOnlyTaskState(next)) {
      next = { ...next, updatedAt: Math.max(next.updatedAt, 1) }
    }
  } catch {
    if (isSeedOnlyTaskState(next)) {
      next = { ...next, updatedAt: 0 }
    }
  }

  const payload = toSyncPayload(next)
  const res = await fetch(syncUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': SYNC_KEY,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`push ${res.status}`)
  await mirrorToLegacy(payload)
  return ensureDispatchState(payload)
}

/** 測試／診斷用：模擬舊客戶端裸 LWW POST（新協議不會走這條） */
export async function pushCloudRawUnsafeForTests(state: AppState): Promise<void> {
  const payload = toSyncPayload(state)
  const res = await fetch(syncUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mantle-Key': SYNC_KEY,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`push raw ${res.status}`)
}
