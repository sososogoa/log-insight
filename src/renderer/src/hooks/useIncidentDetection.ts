import { useEffect } from 'react'
import { useLogsStore } from '@renderer/store/logs'
import { useIncidentStore } from '@renderer/store/incident'
import { detectIncident } from '@renderer/features/incident/detector'

const DETECT_INTERVAL_MS = 5000

export function useIncidentDetection(): void {
  useEffect(() => {
    function tick(): void {
      const lines = useLogsStore.getState().lines
      if (lines.length < 10) return
      const { incident } = detectIncident(lines, Date.now())
      if (incident) useIncidentStore.getState().report(incident)
      else {
        const active = useIncidentStore.getState().active
        if (active && Date.now() - active.startTs > 180_000) {
          useIncidentStore.getState().clearActive()
        }
      }
    }
    tick()
    const t = setInterval(tick, DETECT_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])
}
