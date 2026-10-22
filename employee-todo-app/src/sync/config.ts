/**
 * 雲端同步後端：預設 GAS project-console；`mantle` 為 MantleDB room 後備（緊急／本機除錯）。
 */
export type TodoSyncBackend = 'gas' | 'mantle'

/** 程式內開關（勿用 env 切正式行為）；合併前應保持 `gas`。 */
export const TODO_SYNC_BACKEND: TodoSyncBackend = 'gas'

/**
 * Shared cloud room (MantleDB) — 僅 `TODO_SYNC_BACKEND === 'mantle'` 時使用。
 */
export const SYNC_BASE = 'https://mantledb.sh/v2'
export const SYNC_NAMESPACE = 'yang-employee-todo-1791806583'
export const SYNC_KEY =
  '24ce4c38fe39557b581e91695e066e94a2ee3be8d649e82136a6e4782c11af36'
export const SYNC_PATH = 'room'
/** Mantle 後備：輪詢間隔 */
export const SYNC_POLL_MS = 12_000
/** Mantle 後備：寫入 debounce */
export const SYNC_PUSH_DEBOUNCE_MS = 900

export const mantleSyncUrl = () =>
  `${SYNC_BASE}/${SYNC_NAMESPACE}/${SYNC_PATH}`

export function isMantleBackend(): boolean {
  return TODO_SYNC_BACKEND === 'mantle'
}

export function isGasBackend(): boolean {
  return TODO_SYNC_BACKEND === 'gas'
}
