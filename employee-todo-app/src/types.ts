export type TaskCategory = 'priority' | 'todo' | 'deadline'

/** 緊急等級 — 超簡單三檔 */
export type Urgency = 'urgent' | 'normal' | 'low'

/** App session view: assistant is the linked owner; field is temporary mode */
export type SessionView = 'assistant' | 'field'

/** Top-level: 派工｜工務（internal key `office` = 工務 tab） */
export type WorkMode = 'dispatch' | 'office'

export interface Worker {
  id: string
  name: string
}

export interface Task {
  id: string
  title: string
  /** 詳細說明（可選） */
  detail?: string
  /** 誰派的／指派人（可選自由文字） */
  assigner?: string
  assigneeId: string
  category: TaskCategory
  urgency: Urgency
  /** 限期完成：截止日期 YYYY-MM-DD */
  dueDate?: string
  completed: boolean
  /** Set when checked done; used for 10-day auto-purge */
  completedAt?: number
  order: number
  createdAt: number
}

/** 工務 — 分派恩德／阿勇；只能勾完成（無緊急／不可改字） */
export interface OfficeTask {
  id: string
  title: string
  assigneeId: string
  completed: boolean
  completedAt?: number
  order: number
  createdAt: number
}

/** Linked local identity — 羊 as 行政助理 */
export interface AssistantProfile {
  displayName: string
  role: 'assistant'
  fieldPin: string
  linkedAt: number
  /** LINE user id when linked via LIFF */
  lineUserId?: string
  lineDisplayName?: string
}

export interface AppState {
  workers: Worker[]
  /** 派工：恩德／阿勇現場任務 */
  tasks: Task[]
  /** 工務清單（恩德／阿勇） */
  officeTasks: OfficeTask[]
  /** IDs user deleted — seed/migrate must never recreate these */
  deletedIds: string[]
  /** Wall-clock revision for cloud last-write-wins */
  updatedAt: number
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'
