import type { AppState, OfficeTask, Task, TaskCategory } from '../types'
import type { TodoBoard } from './board'
import {
  PROJECT_CONSOLE_EXEC_URL,
  TODO_DEV_BYPASS,
  TODO_DEV_USER_ID,
} from './config'

export type GasEnvelope<T> = {
  success: boolean
  message?: string
  data?: T
}

export class TodoApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'TodoApiError'
    this.status = status
  }
}

export type TodoListData = Pick<
  AppState,
  'workers' | 'tasks' | 'officeTasks' | 'deletedIds' | 'updatedAt'
> & { assigners?: string[] }

export type TodoWriteAuth = {
  liff_id_token: string
}

function withDevBypass(body: Record<string, unknown>): Record<string, unknown> {
  if (!TODO_DEV_BYPASS) return body
  const out: Record<string, unknown> = { ...body, dev_bypass: true }
  if (TODO_DEV_USER_ID) {
    out.dev_user_id = TODO_DEV_USER_ID
  }
  return out
}

/** 可注入 fetch（單元測試） */
export async function postProjectConsole<T>(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const res = await fetchImpl(PROJECT_CONSOLE_EXEC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(withDevBypass(body)),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new TodoApiError(`HTTP ${res.status}`, res.status)
  }
  const text = await res.text()
  let parsed: GasEnvelope<T>
  try {
    parsed = JSON.parse(text) as GasEnvelope<T>
  } catch {
    throw new TodoApiError('回應不是 JSON', res.status)
  }
  if (!parsed.success) {
    throw new TodoApiError(parsed.message || 'API 失敗', res.status)
  }
  return parsed.data as T
}

export async function todoList(
  board: TodoBoard,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    { action: 'todo_list', board },
    fetchImpl,
  )
}

export async function todoAdd(
  board: TodoBoard,
  task: Task,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData | null> {
  const data = await postProjectConsole<TodoListData | null>(
    { action: 'todo_add', board, task, liff_id_token: auth.liff_id_token },
    fetchImpl,
  )
  return data ?? null
}

export async function todoUpdate(
  board: TodoBoard,
  task: Task,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData | null> {
  const data = await postProjectConsole<TodoListData | null>(
    { action: 'todo_update', board, task, liff_id_token: auth.liff_id_token },
    fetchImpl,
  )
  return data ?? null
}

export async function todoUpdateOffice(
  board: TodoBoard,
  officeTask: OfficeTask,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData | null> {
  const data = await postProjectConsole<TodoListData | null>(
    {
      action: 'todo_update',
      board,
      officeTask,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
  return data ?? null
}

export async function todoDelete(
  board: TodoBoard,
  taskId: string,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData | null> {
  const data = await postProjectConsole<TodoListData | null>(
    {
      action: 'todo_delete',
      board,
      id: taskId,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
  return data ?? null
}

export async function todoReorder(
  board: TodoBoard,
  payload: {
    assigneeId: string
    category: TaskCategory
    orderedIds: string[]
  },
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData | null> {
  const data = await postProjectConsole<TodoListData | null>(
    {
      action: 'todo_reorder',
      board,
      assigneeId: payload.assigneeId,
      category: payload.category,
      orderedIds: payload.orderedIds,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
  return data ?? null
}
