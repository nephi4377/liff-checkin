import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  clearStoredState,
  createSeedState,
  ensureDispatchState,
  loadState,
  normalizeCaseNo,
  saveState,
} from '../data'
import { isRemovedAssigner, normalizeAssignerName } from '../assigners'
import { isDemoHost } from '../demo/fixture'
import { pullCloud, pushCloud } from '../sync/cloud'
import { SYNC_POLL_MS, SYNC_PUSH_DEBOUNCE_MS } from '../sync/config'
import type {
  AppState,
  OfficeTask,
  SyncStatus,
  Task,
  TaskCategory,
  Urgency,
  Worker,
} from '../types'
import {
  makeWorkerId,
  mergeWorkers,
  mergeWorkersKeepingLocalExtras,
  normalizeWorkerName,
} from '../workers'
import { reindexPriorityOrdersForAssignee } from '../urgency'

/** Light local patch — skip full seed/migrate on every keystroke-level update */
function patchState(prev: AppState, patch: Partial<AppState>): AppState {
  return {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  }
}

function sameRevision(a: AppState, b: AppState): boolean {
  return a.updatedAt === b.updatedAt
}

export function useTasks() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const stateRef = useRef(state)
  const pushingRef = useRef(false)
  const pollingRef = useRef(false)
  /** Skip push only for the state change that came from a cloud pull */
  const applyFromCloudRef = useRef(false)
  const hydratedRef = useRef(false)
  const lastPurgeCheckRef = useRef(0)
  const pushTimerRef = useRef<number | null>(null)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Debounced localStorage (avoid jank on rapid toggles/drags)
  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveState(stateRef.current)
    }, 200)
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [state.updatedAt])

  const setSyncStatusSafe = useCallback((next: SyncStatus) => {
    setSyncStatus((prev) => (prev === next ? prev : next))
  }, [])

  const demoMode = typeof window !== 'undefined' && isDemoHost()

  const pushSoon = useCallback(
    (next?: AppState, immediate = false) => {
      if (demoMode) return
      const payload = next ?? stateRef.current
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
      const run = async () => {
        if (pushingRef.current) {
          // 進行中的 push 結束後再推一次，避免手機新增工務被丟掉
          pushTimerRef.current = window.setTimeout(() => {
            void pushSoon(stateRef.current, true)
          }, 400)
          return
        }
        pushingRef.current = true
        setSyncStatusSafe('syncing')
        try {
          await pushCloud(
            stateRef.current.updatedAt >= payload.updatedAt
              ? stateRef.current
              : payload,
          )
          setSyncStatusSafe('ok')
        } catch {
          setSyncStatusSafe('error')
        } finally {
          pushingRef.current = false
        }
      }
      if (immediate) {
        void run()
        return
      }
      pushTimerRef.current = window.setTimeout(() => {
        void run()
      }, SYNC_PUSH_DEBOUNCE_MS)
    },
    [demoMode, setSyncStatusSafe],
  )

  // Local edits → cloud (ignore the render that applied a pull)
  useEffect(() => {
    if (demoMode) return
    if (!hydratedRef.current) return
    if (applyFromCloudRef.current) {
      applyFromCloudRef.current = false
      return
    }
    pushSoon()
  }, [demoMode, state.updatedAt, pushSoon])

  // Initial pull + poll（demo 本機略過雲端）
  useEffect(() => {
    if (demoMode) {
      hydratedRef.current = true
      setSyncStatusSafe('ok')
      return
    }

    let cancelled = false

    /** 工務名單一律與雲端聯集，避免 localStorage 殘留只有恩德／阿勇時蓋掉其他人 */
    const mergeWorkersFromRemote = (local: AppState, remote: AppState) =>
      mergeWorkersKeepingLocalExtras(local.workers, remote.workers)

    const workersMissingFromLocal = (local: AppState, remote: AppState) => {
      const localIds = new Set(mergeWorkers(local.workers).map((w) => w.id))
      return mergeWorkers(remote.workers).some((w) => !localIds.has(w.id))
    }

    const applyRemoteIfNewer = (remote: AppState) => {
      const local = stateRef.current
      if (remote.updatedAt > local.updatedAt) {
        const workers = mergeWorkersFromRemote(local, remote)
        const hasLocalExtras =
          workers.length > mergeWorkers(remote.workers).length
        const merged: AppState = {
          ...remote,
          workers,
          updatedAt: hasLocalExtras
            ? Math.max(remote.updatedAt + 1, Date.now())
            : remote.updatedAt,
        }
        applyFromCloudRef.current = !hasLocalExtras
        setState(merged)
        if (hasLocalExtras) pushSoon(merged, true)
        return
      }
      if (remote.updatedAt < local.updatedAt) {
        const workers = mergeWorkersFromRemote(local, remote)
        if (workersMissingFromLocal(local, remote)) {
          const merged: AppState = {
            ...local,
            workers,
            updatedAt: Math.max(local.updatedAt, Date.now()),
          }
          applyFromCloudRef.current = true
          setState(merged)
          pushSoon(merged, true)
          return
        }
        pushSoon(local, true)
        return
      }
      // 同 revision：仍補齊雲端有、本地沒有的工務
      if (workersMissingFromLocal(local, remote)) {
        const merged: AppState = {
          ...local,
          workers: mergeWorkersFromRemote(local, remote),
          updatedAt: Math.max(local.updatedAt + 1, Date.now()),
        }
        applyFromCloudRef.current = true
        setState(merged)
        pushSoon(merged, true)
      }
    }

    const boot = async () => {
      setSyncStatusSafe('syncing')
      try {
        const remote = await pullCloud()
        if (cancelled) return
        if (!remote || !remote.updatedAt) {
          await pushCloud(stateRef.current)
        } else {
          const local = stateRef.current
          if (remote.updatedAt > local.updatedAt) {
            applyRemoteIfNewer(remote)
          } else if (remote.updatedAt < local.updatedAt) {
            applyRemoteIfNewer(remote)
          } else if (workersMissingFromLocal(local, remote)) {
            applyRemoteIfNewer(remote)
          } else if (!sameRevision(remote, local)) {
            applyRemoteIfNewer(remote)
          }
        }
        if (!cancelled) {
          hydratedRef.current = true
          setSyncStatusSafe('ok')
        }
      } catch {
        if (!cancelled) {
          hydratedRef.current = true
          setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
        }
      }
    }

    void boot()

    const poll = window.setInterval(async () => {
      if (cancelled || document.hidden || pushingRef.current || pollingRef.current)
        return
      // Skip poll while user is dragging / interacting hard
      if (document.body.dataset.dndActive === '1') return

      pollingRef.current = true
      try {
        // Purge check at most once per hour (not every poll)
        const now = Date.now()
        if (now - lastPurgeCheckRef.current > 60 * 60 * 1000) {
          lastPurgeCheckRef.current = now
          const locallyPurged = ensureDispatchState(stateRef.current)
          if (locallyPurged.updatedAt > stateRef.current.updatedAt) {
            setState(locallyPurged)
          }
        }

        const remote = await pullCloud({ light: true })
        if (cancelled || !remote) return
        applyRemoteIfNewer(remote)
        setSyncStatusSafe('ok')
      } catch {
        setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
      } finally {
        pollingRef.current = false
      }
    }, SYNC_POLL_MS)

    const onOnline = () => {
      setSyncStatusSafe('syncing')
      void pullCloud()
        .then((remote) => {
          if (remote) applyRemoteIfNewer(remote)
          else return pushCloud(stateRef.current)
          if (stateRef.current.updatedAt > (remote?.updatedAt ?? 0)) {
            return pushCloud(stateRef.current)
          }
        })
        .then(() => setSyncStatusSafe('ok'))
        .catch(() => setSyncStatusSafe('error'))
    }

    const onVisibility = () => {
      if (!document.hidden) void pullCloud().then((r) => r && applyRemoteIfNewer(r))
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
    }
  }, [demoMode, pushSoon, setSyncStatusSafe])

  const addTask = useCallback(
    (
      title: string,
      assigneeId: string,
      category: TaskCategory,
      detail?: string,
      urgency?: Urgency,
      dueDate?: string,
      assigner?: string,
      caseNo?: string,
    ) => {
      const trimmed = title.trim()
      if (!trimmed || !assigneeId) return
      const detailTrim = detail?.trim() || undefined
      const assignerTrim = assigner?.trim() || undefined
      const caseNoTrim = normalizeCaseNo(caseNo)
      const safeCategory: TaskCategory =
        category === 'todo'
          ? 'todo'
          : category === 'reminder'
            ? 'reminder'
            : 'priority'
      const resolvedUrgency: Urgency =
        urgency ??
        (safeCategory === 'priority' ? 'urgent' : 'normal')
      const safeUrgency: Urgency =
        safeCategory === 'priority'
          ? resolvedUrgency
          : resolvedUrgency === 'low'
            ? 'low'
            : 'normal'
      const due =
        dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
          ? dueDate.trim()
          : undefined

      setState((prev) => {
        const siblings = prev.tasks.filter(
          (t) =>
            t.assigneeId === assigneeId &&
            t.category === safeCategory &&
            !t.trashedAt,
        )
        const maxOrder = siblings.reduce((m, t) => Math.max(m, t.order), -1)
        const task: Task = {
          id: uuid(),
          caseNo: caseNoTrim,
          title: trimmed,
          detail: detailTrim,
          assigner: assignerTrim,
          assigneeId,
          category: safeCategory,
          isReminder: safeCategory === 'reminder' ? true : undefined,
          urgency: safeUrgency,
          dueDate: due,
          completed: false,
          order: maxOrder + 1,
          createdAt: Date.now(),
        }
        return patchState(prev, {
          tasks: [...prev.tasks, task],
          deletedIds: prev.deletedIds.filter((id) => id !== task.id),
        })
      })
    },
    [],
  )

  const toggleComplete = useCallback((taskId: string) => {
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          const completed = !t.completed
          return {
            ...t,
            completed,
            completedAt: completed ? Date.now() : undefined,
          }
        }),
      }),
    )
  }, [])

  const reorder = useCallback(
    (assigneeId: string, category: TaskCategory, orderedIds: string[]) => {
      setState((prev) => {
        const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
        return patchState(prev, {
          tasks: prev.tasks.map((t) => {
            if (t.assigneeId !== assigneeId || t.category !== category) return t
            const next = orderMap.get(t.id)
            return next === undefined ? t : { ...t, order: next }
          }),
        })
      })
    },
    [],
  )

  /** Soft-delete → 派工垃圾桶（可復原）；不寫 deletedIds */
  const trashTask = useCallback((taskId: string) => {
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, trashedAt: t.trashedAt ?? Date.now() }
            : t,
        ),
      }),
    )
  }, [])

  const restoreTask = useCallback((taskId: string) => {
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, trashedAt: undefined } : t,
        ),
      }),
    )
  }, [])

  const togglePin = useCallback((taskId: string) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId)
      if (!target || target.category !== 'priority' || target.trashedAt) {
        return prev
      }
      return patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, pinned: t.pinned ? undefined : true }
            : t,
        ),
      })
    })
  }, [])

  /** 永久刪除（tombstone）；通常給清空垃圾桶用 */
  const deleteTask = useCallback((taskId: string) => {
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.filter((t) => t.id !== taskId),
        deletedIds: [...new Set([...prev.deletedIds, taskId])],
      }),
    )
  }, [])

  const updateTitle = useCallback((taskId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, title: trimmed } : t,
        ),
      }),
    )
  }, [])

  const updateCaseNo = useCallback((taskId: string, caseNo: string) => {
    const next = normalizeCaseNo(caseNo)
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, caseNo: next } : t,
        ),
      }),
    )
  }, [])

  const updateDetail = useCallback((taskId: string, detail: string) => {
    const trimmed = detail.trim()
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, detail: trimmed || undefined }
            : t,
        ),
      }),
    )
  }, [])

  const updateWorkerNote = useCallback((taskId: string, workerNote: string) => {
    const trimmed = workerNote.trim()
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, workerNote: trimmed || undefined }
            : t,
        ),
      }),
    )
  }, [])

  const updateAssigner = useCallback((taskId: string, assigner: string) => {
    const trimmed = normalizeAssignerName(assigner)
    if (isRemovedAssigner(trimmed)) return
    setState((prev) => {
      const assigners = trimmed
        ? [
            ...new Set(
              [...(prev.assigners ?? []), trimmed].filter(
                (n) => !isRemovedAssigner(n),
              ),
            ),
          ]
        : (prev.assigners ?? []).filter((n) => !isRemovedAssigner(n))
      return patchState(prev, {
        assigners,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, assigner: trimmed || undefined }
            : t,
        ),
      })
    })
  }, [])

  const addAssigner = useCallback((name: string): string | null => {
    const trimmed = normalizeAssignerName(name)
    if (!trimmed || isRemovedAssigner(trimmed)) return null
    setState((prev) => {
      const cleaned = (prev.assigners ?? []).filter((n) => !isRemovedAssigner(n))
      if (cleaned.includes(trimmed)) {
        return patchState(prev, { assigners: cleaned })
      }
      return patchState(prev, {
        assigners: [...cleaned, trimmed],
      })
    })
    return trimmed
  }, [])

  /** 新增工務；同名未刪則回傳既有。回傳 Worker 供顯示專屬網址 */
  const addWorker = useCallback(
    (name: string): Worker | null => {
      const trimmed = normalizeWorkerName(name)
      if (!trimmed) return null
      let created: Worker | null = null
      let toPush: AppState | null = null
      setState((prev) => {
        const current = mergeWorkers(prev.workers)
        const existing = current.find((w) => w.name === trimmed && !w.archived)
        if (existing) {
          created = existing
          return prev
        }
        const revive = current.find((w) => w.name === trimmed && w.archived)
        if (revive) {
          created = { ...revive, archived: undefined }
          toPush = patchState(prev, {
            workers: mergeWorkers(
              current.map((w) => (w.id === revive.id ? created! : w)),
            ),
          })
          return toPush
        }
        let id = makeWorkerId(trimmed)
        if (current.some((w) => w.id === id)) {
          id = `ops-w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
        }
        created = { id, name: trimmed }
        toPush = patchState(prev, {
          workers: mergeWorkers([...current, created]),
        })
        return toPush
      })
      if (toPush) pushSoon(toPush, true)
      return created
    },
    [pushSoon],
  )

  /** 改名（id 不變 → 專屬網址不變） */
  const updateWorker = useCallback(
    (id: string, name: string): Worker | null => {
      const trimmed = normalizeWorkerName(name)
      if (!trimmed || !id.startsWith('ops-')) return null
      let next: Worker | null = null
      let toPush: AppState | null = null
      setState((prev) => {
        const current = mergeWorkers(prev.workers)
        const clash = current.find(
          (w) => w.name === trimmed && w.id !== id && !w.archived,
        )
        if (clash) return prev
        const workers = current.map((w) => {
          if (w.id !== id) return w
          next = { ...w, name: trimmed }
          return next
        })
        if (!next) return prev
        toPush = patchState(prev, { workers: mergeWorkers(workers) })
        return toPush
      })
      if (toPush) pushSoon(toPush, true)
      return next
    },
    [pushSoon],
  )

  /** 軟刪工務（恩德／阿勇與其他人相同）。任務仍掛原 id，顯示舊名 */
  const removeWorker = useCallback(
    (id: string): boolean => {
      if (!id.startsWith('ops-')) return false
      let ok = false
      let toPush: AppState | null = null
      setState((prev) => {
        const current = mergeWorkers(prev.workers)
        if (!current.some((w) => w.id === id)) return prev
        ok = true
        toPush = patchState(prev, {
          workers: mergeWorkers(
            current.map((w) =>
              w.id === id ? { ...w, archived: true } : w,
            ),
          ),
        })
        return toPush
      })
      if (toPush) pushSoon(toPush, true)
      return ok
    },
    [pushSoon],
  )

  const updateDueDate = useCallback((taskId: string, dueDate: string) => {
    const next =
      typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
        ? dueDate.trim()
        : undefined
    setState((prev) =>
      patchState(prev, {
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, dueDate: next } : t,
        ),
      }),
    )
  }, [])

  const updateUrgency = useCallback((taskId: string, urgency: Urgency) => {
    setState((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId)
      if (!target) return prev
      let tasks = prev.tasks.map((t) => {
        if (t.id !== taskId) return t
        const next: Urgency =
          t.category === 'todo'
            ? urgency === 'low'
              ? 'low'
              : 'normal'
            : urgency
        if (t.urgency === next) return t
        return { ...t, urgency: next }
      })
      if (target.category === 'priority') {
        tasks = reindexPriorityOrdersForAssignee(tasks, target.assigneeId)
      }
      return patchState(prev, { tasks })
    })
  }, [])

  const moveCategory = useCallback((taskId: string, category: TaskCategory) => {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId)
      if (!task || task.category === category) return prev
      const siblings = prev.tasks.filter(
        (t) =>
          t.assigneeId === task.assigneeId &&
          t.category === category &&
          t.id !== taskId,
      )
      const maxOrder = siblings.reduce((m, t) => Math.max(m, t.order), -1)
      const urgency: Urgency =
        category === 'priority'
          ? task.urgency === 'urgent'
            ? 'urgent'
            : task.urgency === 'low'
              ? 'low'
              : 'normal'
          : task.urgency === 'low'
            ? 'low'
            : 'normal'
      let tasks = prev.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              category,
              isReminder: category === 'reminder' ? true : undefined,
              order: maxOrder + 1,
              urgency,
              pinned: category === 'priority' ? t.pinned : undefined,
            }
          : t,
      )
      if (category === 'priority') {
        tasks = reindexPriorityOrdersForAssignee(tasks, task.assigneeId)
      }
      return patchState(prev, { tasks })
    })
  }, [])

  const addOfficeTask = useCallback((title: string, assigneeId: string) => {
    const trimmed = title.trim()
    if (!trimmed || !assigneeId) return
    setState((prev) => {
      const open = (prev.officeTasks ?? []).filter(
        (t) => t.assigneeId === assigneeId && !t.completed,
      )
      const maxOrder = open.reduce((m, t) => Math.max(m, t.order), -1)
      const task: OfficeTask = {
        id: uuid(),
        title: trimmed,
        assigneeId,
        completed: false,
        order: maxOrder + 1,
        createdAt: Date.now(),
      }
      return patchState(prev, {
        officeTasks: [...(prev.officeTasks ?? []), task],
        deletedIds: prev.deletedIds.filter((id) => id !== task.id),
      })
    })
  }, [])

  const toggleOfficeComplete = useCallback((taskId: string) => {
    setState((prev) =>
      patchState(prev, {
        officeTasks: (prev.officeTasks ?? []).map((t) => {
          if (t.id !== taskId) return t
          const completed = !t.completed
          return {
            ...t,
            completed,
            completedAt: completed ? Date.now() : undefined,
          }
        }),
      }),
    )
  }, [])

  const updateOfficeTitle = useCallback((taskId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    setState((prev) =>
      patchState(prev, {
        officeTasks: (prev.officeTasks ?? []).map((t) =>
          t.id === taskId ? { ...t, title: trimmed } : t,
        ),
      }),
    )
  }, [])

  const resetDemo = useCallback(() => {
    clearStoredState()
    const next = createSeedState()
    setState(next)
    if (demoMode) {
      setSyncStatusSafe('ok')
      return
    }
    void pushCloud(next)
      .then(() => setSyncStatusSafe('ok'))
      .catch(() => setSyncStatusSafe('error'))
  }, [demoMode, setSyncStatusSafe])

  return {
    workers: state.workers,
    tasks: state.tasks,
    officeTasks: state.officeTasks ?? [],
    assigners: state.assigners ?? [],
    syncStatus,
    addTask,
    toggleComplete,
    reorder,
    moveCategory,
    trashTask,
    restoreTask,
    togglePin,
    deleteTask,
    updateTitle,
    updateCaseNo,
    updateDetail,
    updateWorkerNote,
    updateAssigner,
    addAssigner,
    addWorker,
    updateWorker,
    removeWorker,
    updateDueDate,
    updateUrgency,
    addOfficeTask,
    toggleOfficeComplete,
    updateOfficeTitle,
    resetDemo,
  }
}
