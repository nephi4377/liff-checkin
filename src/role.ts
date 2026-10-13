/** 正式站：info.tanxin.space（勿再連 tanxin02 舊 Pages） */
export const CANONICAL_ORIGIN = 'https://info.tanxin.space/employee-todo/'

/**
 * 入口連結用相對路徑，留在目前 host（避免 info 總覽點進去又跳回 tanxin02）。
 * LIFF／對外分享用 CANONICAL_ORIGIN。
 */
export const ROLE_URLS = {
  hub: './',
  dispatch: './?role=paigong',
  ende: './?role=ende',
  ayong: './?role=ayong',
} as const

export type AppPersona = 'hub' | 'assistant' | 'ops-ende' | 'ops-ayong'

/** Resolve role from hostname / path / ?role= (dev) */
export function resolvePersona(): AppPersona {
  if (typeof window === 'undefined') return 'hub'
  const host = window.location.hostname.toLowerCase()
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  const role = new URLSearchParams(window.location.search).get('role')

  if (
    host.startsWith('yang-paigong.') ||
    path.endsWith('/paigong') ||
    role === 'paigong' ||
    role === 'dispatch'
  ) {
    return 'assistant'
  }
  if (host.startsWith('yang-ende.') || path.endsWith('/ende') || role === 'ende') {
    return 'ops-ende'
  }
  if (host.startsWith('yang-ayong.') || path.endsWith('/ayong') || role === 'ayong') {
    return 'ops-ayong'
  }
  return 'hub'
}

export function isDedicatedRoleSite(persona: AppPersona): boolean {
  return persona !== 'hub'
}
