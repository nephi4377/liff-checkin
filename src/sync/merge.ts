import type { AppState, OfficeTask, Task, Worker } from '../types'
import { mergeWorkersKeepingLocalExtras } from '../workers'

/**
 * 推上雲端前：把遠端仍活著、本地未 tombstone 的任務併回來。
 * 擋住「本地種子／精簡狀態」整包 LWW 清空雲端真實派工。
 */
export function mergeCloudTaskExtras(
  local: AppState,
  remote: AppState,
): AppState {
  const deleted = new Set(local.deletedIds ?? [])
  // 遠端 tombstone 併入；但不讓「本地空刪除清單」清掉遠端已刪（由遠端 deleted 為準補）
  for (const id of remote.deletedIds ?? []) deleted.add(id)

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
