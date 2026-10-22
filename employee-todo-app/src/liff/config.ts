/** LIFF ID from LINE Developers Console → LIFF tab */
export const LIFF_ID =
  (import.meta.env.VITE_LIFF_ID as string | undefined)?.trim() || ''

export const APP_ORIGIN = 'https://info.tanxin.space/employee-todo/'

export function hasLiffConfig(): boolean {
  return LIFF_ID.length > 0
}

/** Open this in LINE / browser to start LIFF login */
export function liffEntryUrl(): string {
  if (!LIFF_ID) return APP_ORIGIN
  return `https://liff.line.me/${LIFF_ID}`
}
