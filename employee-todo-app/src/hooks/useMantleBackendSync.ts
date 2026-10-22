import { useCallback, useEffect, useRef } from 'react'
import { ensureDispatchState } from '../data'
import { pullMantleCloud, pushMantleCloud } from '../sync/mantleCloud'
import { SYNC_POLL_MS, SYNC_PUSH_DEBOUNCE_MS } from '../sync/config'
import type { AppState, SyncStatus } from '../types'

function sameRevision(a: AppState, b: AppState): boolean {
  return a.updatedAt === b.updatedAt
}

type Options = {
  enabled: boolean
  localUpdatedAt: number
  stateRef: React.MutableRefObject<AppState>
  setState: React.Dispatch<React.SetStateAction<AppState>>
  setSyncStatusSafe: (next: SyncStatus) => void
  hydratedRef: React.MutableRefObject<boolean>
  applyFromCloudRef: React.MutableRefObject<boolean>
}

/** MantleDB 後備：boot、輪詢、debounced push（`enabled` 為 true 時啟用）。 */
export function useMantleBackendSync({
  enabled,
  localUpdatedAt,
  stateRef,
  setState,
  setSyncStatusSafe,
  hydratedRef,
  applyFromCloudRef,
}: Options) {
  const pushingRef = useRef(false)
  const pollingRef = useRef(false)
  const lastPurgeCheckRef = useRef(0)
  const pushTimerRef = useRef<number | null>(null)

  const pushSoon = useCallback(
    (next?: AppState) => {
      if (!enabled) return
      const payload = next ?? stateRef.current
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
      pushTimerRef.current = window.setTimeout(async () => {
        if (pushingRef.current) return
        pushingRef.current = true
        setSyncStatusSafe('syncing')
        try {
          await pushMantleCloud(
            stateRef.current.updatedAt >= payload.updatedAt
              ? stateRef.current
              : payload,
          )
          setSyncStatusSafe('ok')
        } catch {
          setSyncStatusSafe('error')
        } finally {
          pushingRef.current = false
        }
      }, SYNC_PUSH_DEBOUNCE_MS)
    },
    [enabled, setSyncStatusSafe, stateRef],
  )

  useEffect(() => {
    if (!enabled) return
    if (!hydratedRef.current) return
    if (applyFromCloudRef.current) {
      applyFromCloudRef.current = false
      return
    }
    pushSoon()
  }, [
    enabled,
    localUpdatedAt,
    pushSoon,
    hydratedRef,
    applyFromCloudRef,
  ])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const applyRemoteIfNewer = (remote: AppState) => {
      const local = stateRef.current
      if (remote.updatedAt > local.updatedAt) {
        applyFromCloudRef.current = true
        setState(remote)
        return
      }
      if (remote.updatedAt < local.updatedAt) {
        pushSoon(local)
      }
    }

    const boot = async () => {
      setSyncStatusSafe('syncing')
      try {
        const remote = await pullMantleCloud()
        if (cancelled) return
        if (!remote || !remote.updatedAt) {
          await pushMantleCloud(stateRef.current)
        } else if (!sameRevision(remote, stateRef.current)) {
          applyFromCloudRef.current = true
          setState(remote)
        }
        if (!cancelled) {
          hydratedRef.current = true
          setSyncStatusSafe('ok')
        }
      } catch {
        if (!cancelled) {
          hydratedRef.current = true
          setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
        }
      }
    }

    void boot()

    const poll = window.setInterval(async () => {
      if (cancelled || document.hidden || pushingRef.current || pollingRef.current)
        return
      if (document.body.dataset.dndActive === '1') return

      pollingRef.current = true
      try {
        const now = Date.now()
        if (now - lastPurgeCheckRef.current > 60 * 60 * 1000) {
          lastPurgeCheckRef.current = now
          const locallyPurged = ensureDispatchState(stateRef.current)
          if (locallyPurged.updatedAt > stateRef.current.updatedAt) {
            setState(locallyPurged)
          }
        }

        const remote = await pullMantleCloud({ light: true })
        if (cancelled || !remote) return
        applyRemoteIfNewer(remote)
        setSyncStatusSafe('ok')
      } catch {
        setSyncStatusSafe(navigator.onLine ? 'error' : 'offline')
      } finally {
        pollingRef.current = false
      }
    }, SYNC_POLL_MS)

    const onOnline = () => {
      setSyncStatusSafe('syncing')
      void pullMantleCloud()
        .then((remote) => {
          if (remote) applyRemoteIfNewer(remote)
          else return pushMantleCloud(stateRef.current)
          if (stateRef.current.updatedAt > (remote?.updatedAt ?? 0)) {
            return pushMantleCloud(stateRef.current)
          }
        })
        .then(() => setSyncStatusSafe('ok'))
        .catch(() => setSyncStatusSafe('error'))
    }

    const onVisibility = () => {
      if (!document.hidden) {
        void pullMantleCloud().then((r) => r && applyRemoteIfNewer(r))
      }
    }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      if (pushTimerRef.current) window.clearTimeout(pushTimerRef.current)
    }
  }, [
    enabled,
    pushSoon,
    setState,
    setSyncStatusSafe,
    stateRef,
    hydratedRef,
    applyFromCloudRef,
  ])
}
