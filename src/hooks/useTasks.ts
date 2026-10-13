import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import {
  clearStoredState,
  createSeedState,
  ensureDispatchState,
  loadState,
  saveState,
} from '../data'
import { normalizeAssignerName } from '../assigners'
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
} from '../types'
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
    (next?: AppState) => {
      if (demoMode) return
      const payload = next ?? stateRef.current
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
      pushTimerRef.current = window.setTimeout(async () => {
        if (pushingRef.current) return
        pushingRef.current = true
        setSyncStatusSafe('syncing')
        try {
          await pushCloud(stateRef.current.updatedAt >= payload.updatedAt
            ? stateRef.current
            : payload)
          setSyncStatusSafe('ok')
        } catch {
          setSyncStatusSafe('error')
        } finally {
          pushingRef.current = false
        }
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

    const applyRemoteIfNewer = (remote: AppState) => {
      const local = stateRef.current
      if (remote.updatedAt > local.updatedAt) {
        applyFromCloudRef.current = true
        setState(remote)
        return
      }
      if (remote.updatedAt < local.updatedAt) {
        pushSoon(local)
      }
    }

    const boot = async () => {
      setSyncStatusSafe('syncing')
      try {
        const remote = await pullCloud()
        if (cancelled) return
        if (!remote || !remote.updatedAt) {
          await pushCloud(stateRef.current)
        } else if (!sameRevision(remote, stateRef.current)) {
          applyFromCloudRef.current = true
          setState(remote)
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
    ) => {
      const trimmed = title.trim()
      if (!trimmed || !assigneeId) return
      if (category === 'deadline' && !dueDate?.trim()) return
      const detailTrim = detail?.trim() || undefined
      const assignerTrim = assigner?.trim() || undefined
      const resolvedUrgency: Urgency =
        urgency ??
        (category === 'priority' ? 'urgent' : 'normal')
      const safeUrgency: Urgency =
        category === 'todo' && resolvedUrgency === 'urgent'
          ? 'normal'
          : category === 'deadline'
            ? 'normal'
            : resolvedUrgency
      const due =
        category === 'deadline' && dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
          ? dueDate
          : undefined

      setState((prev) => {
        const siblings = prev.tasks.filter(
          (t) => t.assigneeId === assigneeId && t.category === category,
        )
        const maxOrder = siblings.reduce((m, t) => Math.max(m, t.order), -1)
        const task: Task = {
          id: uuid(),
          title: trimmed,
          detail: detailTrim,
          assigner: assignerTrim,
          assigneeId,
          category,
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

  const updateAssigner = useCallback((taskId: string, assigner: string) => {
    const trimmed = normalizeAssignerName(assigner)
    setState((prev) => {
      const assigners = trimmed
        ? [...new Set([...(prev.assigners ?? []), trimmed])]
        : prev.assigners ?? []
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
    if (!trimmed) return null
    setState((prev) => {
      if ((prev.assigners ?? []).includes(trimmed)) {
        return patchState(prev, { assigners: prev.assigners ?? [] })
      }
      return patchState(prev, {
        assigners: [...(prev.assigners ?? []), trimmed],
      })
    })
    return trimmed
  }, [])

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
          ? 'normal'
          : task.urgency === 'low'
            ? 'low'
            : 'normal'
      const dueDate =
        category === 'deadline'
          ? task.dueDate ?? new Date().toISOString().slice(0, 10)
          : task.dueDate
      let tasks = prev.tasks.map((t) =>
        t.id === taskId
          ? { ...t, category, order: maxOrder + 1, urgency, dueDate }
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
    deleteTask,
    updateTitle,
    updateDetail,
    updateAssigner,
    addAssigner,
    updateDueDate,
    updateUrgency,
    addOfficeTask,
    toggleOfficeComplete,
    updateOfficeTitle,
    resetDemo,
  }
}
