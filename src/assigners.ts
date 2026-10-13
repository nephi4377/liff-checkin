import { DEFAULT_DISPLAY_NAME, loadProfile } from './profile'

/** 公司常用「誰派的」選項（下拉）；歷史自由文字會另外併入 */
export const BASE_ASSIGNERS = [DEFAULT_DISPLAY_NAME] as const

/** 組下拉選項：常用名單＋目前登入派工名＋既有任務上的人名 */
export function buildAssignerOptions(
  extras: Array<string | undefined | null> = [],
): string[] {
  const set = new Set<string>()
  for (const name of BASE_ASSIGNERS) {
    if (name.trim()) set.add(name.trim())
  }
  try {
    const profile = loadProfile()
    const n = profile?.displayName?.trim()
    if (n) set.add(n)
  } catch {
    // SSR / 無 localStorage
  }
  for (const raw of extras) {
    const n = raw?.trim()
    if (n) set.add(n)
  }
  return [...set]
}
