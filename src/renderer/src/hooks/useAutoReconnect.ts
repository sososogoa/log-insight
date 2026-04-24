import { useEffect } from 'react'
import { useServersStore } from '@renderer/store/servers'
import { useSourcesStore } from '@renderer/store/sources'

const BATCH = 2
const BATCH_DELAY_MS = 200

// Replays persisted (serverId, spec) pairs through subscribe() on boot.
// Servers that no longer exist are pruned. Batched to avoid a burst of
// concurrent SSH handshakes.
export function useAutoReconnect(): void {
  const serversLoaded = useServersStore((s) => s.loaded)

  useEffect(() => {
    if (!serversLoaded) return
    const store = useSourcesStore.getState()
    if (store.restoreDone) return
    const servers = useServersStore.getState().servers
    const specs = store.restoreSpecs

    if (specs.length === 0) {
      store.markRestoreDone()
      return
    }

    const serverById = new Map(servers.map((s) => [s.id, s]))
    const alive = specs.filter((r) => serverById.has(r.serverId))
    for (const r of specs) {
      if (!serverById.has(r.serverId)) store.pruneRestoreFor(r.serverId)
    }

    if (alive.length === 0) {
      store.markRestoreDone()
      return
    }

    let cancelled = false
    ;(async () => {
      for (let i = 0; i < alive.length; i += BATCH) {
        if (cancelled) return
        const batch = alive.slice(i, i + BATCH)
        await Promise.all(
          batch.map((r) => {
            const server = serverById.get(r.serverId)
            if (!server) return Promise.resolve()
            return useSourcesStore.getState().subscribe(server, r.spec)
          })
        )
        if (i + BATCH < alive.length) {
          await new Promise((res) => setTimeout(res, BATCH_DELAY_MS))
        }
      }
      if (!cancelled) useSourcesStore.getState().markRestoreDone()
    })()

    return () => {
      cancelled = true
    }
  }, [serversLoaded])
}
