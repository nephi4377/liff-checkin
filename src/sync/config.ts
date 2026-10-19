/**
 * Shared cloud room (MantleDB) — no per-user login.
 * v2：正式房間。舊房僅開機只讀合併「v2 沒有的新 id」，永不讓舊房覆寫 v2 同 id。
 */
export const SYNC_BASE = 'https://mantledb.sh/v2'
export const SYNC_NAMESPACE =
  import.meta.env.VITE_SYNC_NAMESPACE || 'yang-employee-todo-v2-1792379200'
/** 大修前舊房（舊 PWA 仍可能寫這裡） */
export const SYNC_NAMESPACE_LEGACY = 'yang-employee-todo-1791806583'
export const SYNC_KEY =
  import.meta.env.VITE_SYNC_KEY ||
  '24ce4c38fe39557b581e91695e066e94a2ee3be8d649e82136a6e4782c11af36'
export const SYNC_PATH = 'room'
/** Poll less often to avoid mobile jank */
export const SYNC_POLL_MS = 12_000
/** Debounce cloud writes after local edits */
export const SYNC_PUSH_DEBOUNCE_MS = 900

export const syncUrl = (ns: string = SYNC_NAMESPACE) =>
  `${SYNC_BASE}/${ns}/${SYNC_PATH}`
