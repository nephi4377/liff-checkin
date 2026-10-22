import { todoList, type TodoListData, type TodoWriteAuth } from '../api/todoGasClient'
import type { TodoBoard } from '../api/board'
import { ensureDispatchState } from '../data'
import type { AppState } from '../types'
import { isMantleBackend } from './config'
import { pullMantleCloud, pushMantleCloud } from './mantleCloud'

export function listDataToAppState(data: TodoListData): AppState {
  return ensureDispatchState({
    workers: data.workers,
    tasks: data.tasks,
    officeTasks: data.officeTasks ?? [],
    deletedIds: data.deletedIds ?? [],
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  })
}

/** GAS：依 board 讀清單（含 liff_id_token）。 */
export async function pullGasCloud(
  board: TodoBoard,
  auth: TodoWriteAuth,
): Promise<AppState | null> {
  const data = await todoList(board, auth)
  return listDataToAppState(data)
}

/** 依 `TODO_SYNC_BACKEND` 拉遠端；Mantle 時忽略 board。 */
export async function pullCloud(
  board: TodoBoard | null,
  auth: TodoWriteAuth,
): Promise<AppState | null> {
  if (isMantleBackend()) {
    return pullMantleCloud()
  }
  if (!board) return null
  return pullGasCloud(board, auth)
}

export { pushMantleCloud as pushCloud }
