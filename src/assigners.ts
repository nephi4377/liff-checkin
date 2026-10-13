import { loadProfile } from './profile'

/** 已自「誰派的」名單移除；下拉與同步 assigners 都不再出現 */
export const REMOVED_ASSIGNERS = new Set(['羊'])

/** 公司常用「誰派的」選項（下拉）；歷史自由文字會另外併入 */
export const BASE_ASSIGNERS: readonly string[] = []

/** select 內「新增」佔位值 */
export const ASSIGNER_ADD_VALUE = '__add_assigner__'

export function isRemovedAssigner(name: string | undefined | null): boolean {
  const n = (name ?? '').trim()
  return Boolean(n) && REMOVED_ASSIGNERS.has(n)
}

/** 組下拉選項：常用名單＋同步名單＋登入名＋任務上的人名（不含已移除名） */
export function buildAssignerOptions(
  extras: Array<string | undefined | null> = [],
): string[] {
  const set = new Set<string>()
  for (const name of BASE_ASSIGNERS) {
    if (name.trim() && !isRemovedAssigner(name)) set.add(name.trim())
  }
  try {
    const profile = loadProfile()
    const n = profile?.displayName?.trim()
    if (n && !isRemovedAssigner(n)) set.add(n)
  } catch {
    // SSR / 無 localStorage
  }
  for (const raw of extras) {
    const n = raw?.trim()
    if (n && !isRemovedAssigner(n)) set.add(n)
  }
  return [...set]
}

export function normalizeAssignerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 24)
}
