import type { AppState, Task, TaskCategory } from '../types'
import type { TodoBoard } from './board'
import {
  PROJECT_CONSOLE_EXEC_URL,
  TODO_DEV_BYPASS,
  TODO_DEV_USER_ID,
} from './config'

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

type GasResponse = {
  success: boolean
  message?: string
}

function withDevBypass(body: Record<string, unknown>): Record<string, unknown> {
  if (!TODO_DEV_BYPASS) return body
  const out: Record<string, unknown> = { ...body, dev_bypass: true }
  if (TODO_DEV_USER_ID) {
    out.dev_user_id = TODO_DEV_USER_ID
  }
  return out
}

function gasPayloadFromSuccess<T extends Record<string, unknown>>(
  parsed: GasResponse & T,
): T {
  const { success: _s, message: _m, ...rest } = parsed
  return rest as unknown as T
}

/** 可注入 fetch（單元測試）；成功時回傳 JSON 頂層欄位（不含 success／message）。 */
export async function postProjectConsole<T extends Record<string, unknown>>(
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
  let parsed: GasResponse & T
  try {
    parsed = JSON.parse(text) as GasResponse & T
  } catch {
    throw new TodoApiError('回應不是 JSON', res.status)
  }
  if (!parsed.success) {
    throw new TodoApiError(parsed.message || 'API 失敗', res.status)
  }
  return gasPayloadFromSuccess(parsed)
}

export async function todoList(
  board: TodoBoard,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    {
      action: 'todo_list',
      board,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
}

export async function todoAdd(
  board: TodoBoard,
  task: Task,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    { action: 'todo_add', board, task, liff_id_token: auth.liff_id_token },
    fetchImpl,
  )
}

export async function todoUpdate(
  board: TodoBoard,
  task: Task,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    { action: 'todo_update', board, task, liff_id_token: auth.liff_id_token },
    fetchImpl,
  )
}

export async function todoDelete(
  board: TodoBoard,
  taskId: string,
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    {
      action: 'todo_delete',
      board,
      id: taskId,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
}

export type TodoReorderOrder = { id: string; order: number }

export async function todoReorder(
  board: TodoBoard,
  payload: {
    assigneeId: string
    category: TaskCategory
    orders: TodoReorderOrder[]
  },
  auth: TodoWriteAuth,
  fetchImpl?: typeof fetch,
): Promise<TodoListData> {
  return postProjectConsole<TodoListData>(
    {
      action: 'todo_reorder',
      board,
      assigneeId: payload.assigneeId,
      category: payload.category,
      orders: payload.orders,
      liff_id_token: auth.liff_id_token,
    },
    fetchImpl,
  )
}
