import type { AppState, OfficeTask, Task, Worker } from '../types'
import { mergeWorkersKeepingLocalExtras } from '../workers'

function collectDeleted(...states: AppState[]): Set<string> {
  const deleted = new Set<string>()
  for (const s of states) {
    for (const id of s.deletedIds ?? []) deleted.add(id)
  }
  return deleted
}

export type ReconcileOpts = {
  /**
   * pull 時開：同 id 一律以雲端為準（只補本機多出的新 id）。
   * 斷開「派工本機殘留舊房標題」與「工務已拉到 v2」各顯示各的。
   */
  remoteWinsSameId?: boolean
}

/**
 * 雙向和解：兩邊活任務 id 全留。
 * 預設同 id 跟較新 revision；pull 可改 remoteWinsSameId。
 */
export function reconcileCloudState(
  local: AppState,
  remote: AppState,
  opts: ReconcileOpts = {},
): AppState {
  const deleted = collectDeleted(local, remote)
  const localRev =
    typeof local.updatedAt === 'number' && local.updatedAt > 0
      ? local.updatedAt
      : 0
  const remoteRev =
    typeof remote.updatedAt === 'number' && remote.updatedAt > 0
      ? remote.updatedAt
      : 0
  const remoteWinsSameId =
    opts.remoteWinsSameId === true || remoteRev >= localRev

  const tasksById = new Map<string, Task>()
  if (remoteWinsSameId) {
    for (const t of remote.tasks ?? []) {
      if (t?.id && !deleted.has(t.id)) tasksById.set(t.id, t)
    }
    for (const t of local.tasks ?? []) {
      if (!t?.id || deleted.has(t.id) || tasksById.has(t.id)) continue
      tasksById.set(t.id, t)
    }
  } else {
    for (const t of local.tasks ?? []) {
      if (t?.id && !deleted.has(t.id)) tasksById.set(t.id, t)
    }
    for (const t of remote.tasks ?? []) {
      if (!t?.id || deleted.has(t.id) || tasksById.has(t.id)) continue
      tasksById.set(t.id, t)
    }
  }

  const officeById = new Map<string, OfficeTask>()
  if (remoteWinsSameId) {
    for (const t of remote.officeTasks ?? []) {
      if (t?.id && !deleted.has(t.id)) officeById.set(t.id, t)
    }
    for (const t of local.officeTasks ?? []) {
      if (!t?.id || deleted.has(t.id) || officeById.has(t.id)) continue
      officeById.set(t.id, t)
    }
  } else {
    for (const t of local.officeTasks ?? []) {
      if (t?.id && !deleted.has(t.id)) officeById.set(t.id, t)
    }
    for (const t of remote.officeTasks ?? []) {
      if (!t?.id || deleted.has(t.id) || officeById.has(t.id)) continue
      officeById.set(t.id, t)
    }
  }

  const base = remoteWinsSameId ? remote : local
  const workers = mergeWorkersKeepingLocalExtras(local.workers, remote.workers)
  const assigners = [
    ...new Set([...(local.assigners ?? []), ...(remote.assigners ?? [])]),
  ]
  const liveCount = tasksById.size
  const remoteLive = (remote.tasks ?? []).filter(
    (t) => t?.id && !deleted.has(t.id),
  ).length
  const localLive = (local.tasks ?? []).filter(
    (t) => t?.id && !deleted.has(t.id),
  ).length
  const mustBump = liveCount > remoteLive || liveCount > localLive

  return {
    ...base,
    workers,
    tasks: [...tasksById.values()],
    officeTasks: [...officeById.values()],
    assigners,
    deletedIds: [...deleted],
    updatedAt: mustBump
      ? Math.max(localRev + 1, remoteRev + 1, Date.now())
      : Math.max(localRev, remoteRev),
  }
}

/**
 * 推上雲端前：把遠端仍活著、本地未 tombstone 的任務併回來。
 * 擋住「本地種子／精簡狀態」整包 LWW 清空雲端真實派工。
 * 同 id 保留本地（呼叫端已用較新 revision）；只補遠端多出的 id。
 */
export function mergeCloudTaskExtras(
  local: AppState,
  remote: AppState,
): AppState {
  const deleted = collectDeleted(local, remote)

  const tasksById = new Map<string, Task>()
  for (const t of local.tasks ?? []) {
    if (t?.id && !deleted.has(t.id)) tasksById.set(t.id, t)
  }
  let rescued = 0
  for (const t of remote.tasks ?? []) {
    if (!t?.id || deleted.has(t.id)) continue
    if (!tasksById.has(t.id)) {
      tasksById.set(t.id, t)
      rescued += 1
      continue
    }
  }

  const officeById = new Map<string, OfficeTask>()
  for (const t of local.officeTasks ?? []) {
    if (t?.id && !deleted.has(t.id)) officeById.set(t.id, t)
  }
  for (const t of remote.officeTasks ?? []) {
    if (!t?.id || deleted.has(t.id) || officeById.has(t.id)) continue
    officeById.set(t.id, t)
    rescued += 1
  }

  const workers = mergeWorkersKeepingLocalExtras(local.workers, remote.workers)

  const remoteLiveCount = (remote.tasks ?? []).filter(
    (t) => t?.id && !deleted.has(t.id),
  ).length
  const localLiveCount = tasksById.size
  // 若本地活任務明顯少於遠端，強制抬 revision，避免舊客戶端再以舊 updatedAt 蓋回
  const mustBump = rescued > 0 || localLiveCount < remoteLiveCount

  return {
    ...local,
    workers,
    tasks: [...tasksById.values()],
    officeTasks: [...officeById.values()],
    deletedIds: [...deleted],
    updatedAt: mustBump
      ? Math.max(local.updatedAt + 1, remote.updatedAt + 1, Date.now())
      : local.updatedAt,
  }
}

/** 推送是否會丟掉遠端仍活著、且本地未宣告刪除的任務 */
export function wouldDropRemoteLiveTasks(
  local: AppState,
  remote: AppState,
): string[] {
  const localIds = new Set((local.tasks ?? []).map((t) => t.id))
  const deleted = new Set(local.deletedIds ?? [])
  const dropped: string[] = []
  for (const t of remote.tasks ?? []) {
    if (!t?.id) continue
    if (deleted.has(t.id)) continue
    if (!localIds.has(t.id)) dropped.push(t.id)
  }
  return dropped
}

export function countLiveTasks(state: AppState): number {
  const deleted = new Set(state.deletedIds ?? [])
  return (state.tasks ?? []).filter((t) => t?.id && !deleted.has(t.id)).length
}

export type { Worker }
