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

/** hub｜派工｜任一工務 id（ops-ende／ops-ayong／ops-w-…） */
export type AppPersona = 'hub' | 'assistant' | string

/** Resolve role from hostname / path / ?role= */
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
  // 自訂工務：?role=ops-… 或 ?role=ops-w-…
  if (role && role.startsWith('ops-') && role.length <= 40) {
    return role
  }
  return 'hub'
}

export function isWorkerPersona(persona: AppPersona): boolean {
  return typeof persona === 'string' && persona.startsWith('ops-')
}

export function isDedicatedRoleSite(persona: AppPersona): boolean {
  return persona !== 'hub'
}
