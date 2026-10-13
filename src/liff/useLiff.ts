import { useCallback, useEffect, useState } from 'react'
import { LIFF_ID, hasLiffConfig, liffEntryUrl } from './config'

export type LiffStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'outside'
  | 'no-config'
  | 'error'

export interface LiffUser {
  userId?: string
  displayName?: string
  pictureUrl?: string
  inClient: boolean
  loggedIn: boolean
}

type LiffApi = typeof import('@line/liff').default

let liffSingleton: LiffApi | null = null

async function getLiff(): Promise<LiffApi> {
  if (!liffSingleton) {
    liffSingleton = (await import('@line/liff')).default
  }
  return liffSingleton
}

export function useLiff() {
  const [status, setStatus] = useState<LiffStatus>('idle')
  const [user, setUser] = useState<LiffUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshProfile = useCallback(async (liff: LiffApi) => {
    const inClient = liff.isInClient()
    const loggedIn = liff.isLoggedIn()
    let displayName: string | undefined
    let userId: string | undefined
    let pictureUrl: string | undefined
    if (loggedIn) {
      try {
        const profile = await liff.getProfile()
        displayName = profile.displayName
        userId = profile.userId
        pictureUrl = profile.pictureUrl
      } catch {
        // profile optional
      }
    }
    setUser({ userId, displayName, pictureUrl, inClient, loggedIn })
    setStatus(inClient ? 'ready' : 'outside')
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!hasLiffConfig()) {
        setStatus('no-config')
        setUser({ inClient: false, loggedIn: false })
        return
      }

      setStatus('loading')
      try {
        const liff = await getLiff()
        await liff.init({ liffId: LIFF_ID })
        if (cancelled) return

        if (!liff.isLoggedIn() && liff.isInClient()) {
          // Inside LINE app — auto login
          liff.login({ redirectUri: window.location.href })
          return
        }

        await refreshProfile(liff)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setStatus('error')
        setUser({ inClient: false, loggedIn: false })
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [refreshProfile])

  const loginWithLine = useCallback(async () => {
    if (!hasLiffConfig()) {
      // No LIFF ID yet — open docs / stay; try LIFF URL won't work
      window.alert(
        '尚未設定 LIFF ID。請羊在 LINE Developers 建立 LIFF 後把 ID 交給我們部署。',
      )
      return
    }
    try {
      const liff = await getLiff()
      try {
        await liff.init({ liffId: LIFF_ID })
      } catch {
        // already initialized
      }
      if (liff.isLoggedIn()) {
        await refreshProfile(liff)
        return
      }
      // External browser: LIFF login redirects back to this page
      liff.login({
        redirectUri: window.location.href.split('?')[0] || window.location.href,
      })
    } catch {
      // Fallback: open official LIFF entry (works well on mobile)
      window.location.href = liffEntryUrl()
    }
  }, [refreshProfile])

  const logoutLine = useCallback(async () => {
    try {
      if (hasLiffConfig()) {
        const liff = await getLiff()
        if (liff.isLoggedIn()) liff.logout()
      }
    } catch {
      // ignore
    }
    setUser({ inClient: false, loggedIn: false })
    setStatus(hasLiffConfig() ? 'outside' : 'no-config')
  }, [])

  return {
    status,
    user,
    error,
    liffConfigured: hasLiffConfig(),
    liffEntryUrl: liffEntryUrl(),
    loginWithLine,
    logoutLine,
  }
}
