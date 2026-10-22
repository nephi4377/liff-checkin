import { todoList, type TodoListData } from '../api/todoGasClient'
import type { TodoBoard } from '../api/board'
import { ensureDispatchState } from '../data'
import type { AppState } from '../types'

function listDataToAppState(data: TodoListData): AppState {
  return ensureDispatchState({
    workers: data.workers,
    tasks: data.tasks,
    officeTasks: data.officeTasks ?? [],
    deletedIds: data.deletedIds ?? [],
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  })
}

/** 從 project-console 讀取單一 board 清單 */
export async function pullCloud(board: TodoBoard): Promise<AppState | null> {
  const data = await todoList(board)
  return listDataToAppState(data)
}

export { listDataToAppState }
