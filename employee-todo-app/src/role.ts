/** Permanent GitHub Pages (org tanxin02). Roles via ?role= (works with base ./) */
export const ROLE_URLS = {
  hub: 'https://tanxin02.github.io/employee-todo/',
  dispatch: 'https://tanxin02.github.io/employee-todo/?role=paigong',
  ende: 'https://tanxin02.github.io/employee-todo/?role=ende',
  ayong: 'https://tanxin02.github.io/employee-todo/?role=ayong',
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
