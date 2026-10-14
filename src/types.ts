/**
 * 畫面分區：優先（可含限期）／提醒／待處理。
 * legacy `deadline` 讀入時會併入 priority。
 */
export type TaskCategory = 'priority' | 'reminder' | 'todo'

/** 緊急等級 — 超簡單三檔 */
export type Urgency = 'urgent' | 'normal' | 'low'

/** App session view: assistant is the linked owner; field is temporary mode */
export type SessionView = 'assistant' | 'field'

/** Top-level: 派工｜工務（internal key `office` = 工務 tab） */
export type WorkMode = 'dispatch' | 'office'

export interface Worker {
  id: string
  name: string
  /** 軟刪：名單隱藏，任務仍可依 id 顯示舊名；網址 role 仍綁 id */
  archived?: boolean
}

export interface Task {
  id: string
  /** 案號（獨立欄位，例：751）；舊資料可能從標題 【751】 拆出 */
  caseNo?: string
  /** 標題（不含案號括號前綴） */
  title: string
  /** 派工說明：派工端寫的任務說明（交代做什麼／注意什麼） */
  detail?: string
  /** 工務說明：工務端回報（無材料、待補貨、預計何時前往…） */
  workerNote?: string
  /** 誰派的／指派人（可選自由文字） */
  assigner?: string
  assigneeId: string
  category: TaskCategory
  /**
   * 提醒區備份標記（與 category:'reminder' 雙寫）。
   * 舊版客戶端若不識 reminder、把 category 改成 todo 時，新版可靠此還原。
   */
  isReminder?: boolean
  urgency: Urgency
  /** 限期完成：截止日期 YYYY-MM-DD */
  dueDate?: string
  completed: boolean
  /** Set when checked done; used for 10-day auto-purge */
  completedAt?: number
  /** Soft-delete (派工垃圾桶)；有值＝已刪，可復原；同步 MantleDB */
  trashedAt?: number
  /** 優先區釘選；釘選後排在優先區頂部；同步 MantleDB */
  pinned?: boolean
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
  /** 誰派的 — 可新增、雲端同步共用 */
  assigners: string[]
  /** IDs user deleted — seed/migrate must never recreate these */
  deletedIds: string[]
  /** Wall-clock revision for cloud last-write-wins */
  updatedAt: number
}

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'offline'
