import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import type { TodoBoard } from '../api/board'
import { TODO_DEV_BYPASS } from '../api/config'
import {
  todoAdd,
  todoDelete,
  todoReorder,
  todoUpdate,
  todoUpdateOffice,
  type TodoListData,
  TodoApiError,
} from '../api/todoGasClient'
import {
  clearStoredState,
  createSeedState,
  loadState,
  saveState,
} from '../data'
import { listDataToAppState, pullCloud } from '../sync/cloud'
import type {
  AppState,
  OfficeTask,
  SyncStatus,
  Task,
  TaskCategory,
  Urgency,
} from '../types'
import { reindexPriorityOrdersForAssignee } from '../urgency'

export type UseTasksOptions = {
  board: TodoBoard | null
  getLiffIdToken: () => Promise<string>
}

function patchState(prev: AppState, patch: Partial<AppState>): AppState {
  return {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  }
}

export function useTasks({ board, getLiffIdToken }: UseTasksOptions) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const stateRef = useRef(state)
  const hydratedRef = useRef(false)
  const applyFromCloudRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

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

  const applyServerData = useCallback((data: TodoListData | null) => {
    if (!data) return
    applyFromCloudRef.current = true
    setState(listDataToAppState(data))
  }, [])

  const runWrite = useCallback(
    async (
      fn: (auth: { liff_id_token: string }) => Promise<TodoListData | null>,
    ) => {
      if (!board) return
      setSyncStatusSafe('syncing')
      try {
        let token = ''
        if (!TODO_DEV_BYPASS) {
          token = await getLiffIdToken()
          if (!token) throw new TodoApiError('缺少 liff_id_token')
        }
        const data = await fn({ liff_id_token: token })
        applyServerData(data)
        setSyncStatusSafe('ok')
      } catch {
        setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
      }
    },
    [applyServerData, board, getLiffIdToken, setSyncStatusSafe],
  )

  const refreshFromServer = useCallback(async () => {
    if (!board) return
    setSyncStatusSafe('syncing')
    try {
      const remote = await pullCloud(board)
      if (remote) {
        applyFromCloudRef.current = true
        setState(remote)
      }
      setSyncStatusSafe('ok')
    } catch {
      setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
    }
  }, [board, setSyncStatusSafe])

  useEffect(() => {
    if (!board) {
      hydratedRef.current = true
      return
    }

    let cancelled = false
    const boot = async () => {
      setSyncStatusSafe('syncing')
      try {
        const remote = await pullCloud(board)
        if (cancelled) return
        if (remote) {
          applyFromCloudRef.current = true
          setState(remote)
        }
        hydratedRef.current = true
        setSyncStatusSafe('ok')
      } catch {
        if (!cancelled) {
          hydratedRef.current = true
          setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
        }
      }
    }
    void boot()

    const onVisibility = () => {
      if (!document.hidden) void refreshFromServer()
    }
    const onOnline = () => void refreshFromServer()

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [board, refreshFromServer, setSyncStatusSafe])

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
        urgency ?? (category === 'priority' ? 'urgent' : 'normal')
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

      const siblings = stateRef.current.tasks.filter(
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

      setState((prev) =>
        patchState(prev, {
          tasks: [...prev.tasks, task],
          deletedIds: prev.deletedIds.filter((id) => id !== task.id),
        }),
      )
      void runWrite((auth) => todoAdd(board!, task, auth))
    },
    [board, runWrite],
  )

  const toggleComplete = useCallback(
    (taskId: string) => {
      let updated: Task | undefined
      setState((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          const completed = !t.completed
          updated = {
            ...t,
            completed,
            completedAt: completed ? Date.now() : undefined,
          }
          return updated
        })
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

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
      void runWrite((auth) =>
        todoReorder(
          board!,
          { assigneeId, category, orderedIds },
          auth,
        ),
      )
    },
    [board, runWrite],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      setState((prev) =>
        patchState(prev, {
          tasks: prev.tasks.filter((t) => t.id !== taskId),
          deletedIds: [...new Set([...prev.deletedIds, taskId])],
        }),
      )
      void runWrite((auth) => todoDelete(board!, taskId, auth))
    },
    [board, runWrite],
  )

  const updateTitle = useCallback(
    (taskId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      let updated: Task | undefined
      setState((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, title: trimmed }
          return updated
        })
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const updateDetail = useCallback(
    (taskId: string, detail: string) => {
      const trimmed = detail.trim()
      let updated: Task | undefined
      setState((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, detail: trimmed || undefined }
          return updated
        })
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const updateAssigner = useCallback(
    (taskId: string, assigner: string) => {
      const trimmed = assigner.trim()
      let updated: Task | undefined
      setState((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, assigner: trimmed || undefined }
          return updated
        })
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const updateDueDate = useCallback(
    (taskId: string, dueDate: string) => {
      const next =
        typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
          ? dueDate.trim()
          : undefined
      let updated: Task | undefined
      setState((prev) => {
        const tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, dueDate: next }
          return updated
        })
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const updateUrgency = useCallback(
    (taskId: string, urgency: Urgency) => {
      let updated: Task | undefined
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
          updated = { ...t, urgency: next }
          return updated
        })
        if (target.category === 'priority') {
          tasks = reindexPriorityOrdersForAssignee(tasks, target.assigneeId)
          updated = tasks.find((t) => t.id === taskId)
        }
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const moveCategory = useCallback(
    (taskId: string, category: TaskCategory) => {
      let updated: Task | undefined
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
        let tasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, category, order: maxOrder + 1, urgency, dueDate }
          return updated
        })
        if (category === 'priority') {
          tasks = reindexPriorityOrdersForAssignee(tasks, task.assigneeId)
          updated = tasks.find((t) => t.id === taskId)
        }
        return patchState(prev, { tasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdate(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const addOfficeTask = useCallback(
    (title: string, assigneeId: string) => {
      const trimmed = title.trim()
      if (!trimmed || !assigneeId) return
      const open = (stateRef.current.officeTasks ?? []).filter(
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
      setState((prev) =>
        patchState(prev, {
          officeTasks: [...(prev.officeTasks ?? []), task],
          deletedIds: prev.deletedIds.filter((id) => id !== task.id),
        }),
      )
      void runWrite((auth) => todoUpdateOffice(board!, task, auth))
    },
    [board, runWrite],
  )

  const toggleOfficeComplete = useCallback(
    (taskId: string) => {
      let updated: OfficeTask | undefined
      setState((prev) => {
        const officeTasks = (prev.officeTasks ?? []).map((t) => {
          if (t.id !== taskId) return t
          const completed = !t.completed
          updated = {
            ...t,
            completed,
            completedAt: completed ? Date.now() : undefined,
          }
          return updated
        })
        return patchState(prev, { officeTasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdateOffice(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const updateOfficeTitle = useCallback(
    (taskId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      let updated: OfficeTask | undefined
      setState((prev) => {
        const officeTasks = (prev.officeTasks ?? []).map((t) => {
          if (t.id !== taskId) return t
          updated = { ...t, title: trimmed }
          return updated
        })
        return patchState(prev, { officeTasks })
      })
      if (updated) {
        void runWrite((auth) => todoUpdateOffice(board!, updated!, auth))
      }
    },
    [board, runWrite],
  )

  const resetDemo = useCallback(() => {
    clearStoredState()
    const next = createSeedState()
    setState(next)
    if (board) void refreshFromServer()
  }, [board, refreshFromServer])

  return {
    workers: state.workers,
    tasks: state.tasks,
    officeTasks: state.officeTasks ?? [],
    syncStatus,
    addTask,
    toggleComplete,
    reorder,
    moveCategory,
    deleteTask,
    updateTitle,
    updateDetail,
    updateAssigner,
    updateDueDate,
    updateUrgency,
    addOfficeTask,
    toggleOfficeComplete,
    updateOfficeTitle,
    resetDemo,
  }
}
