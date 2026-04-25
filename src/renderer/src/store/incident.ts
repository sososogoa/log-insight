import { create } from 'zustand'
import type { Incident } from '@renderer/features/incident/detector'

interface IncidentState {
  /** Most recent incident that has been detected but not yet dismissed. */
  active: Incident | null
  /** Set of dismissed ids — prevents re-triggering within the same minute bucket. */
  dismissedBuckets: Set<string>
  /** Detection results before this timestamp are ignored (temporary mute). */
  silentUntil: number

  report: (incident: Incident) => void
  clearActive: () => void
  dismiss: () => void
  silenceFor: (ms: number) => void
}

function bucketKey(startTs: number): string {
  // 1-minute bucket
  return String(Math.floor(startTs / 60_000))
}

export const useIncidentStore = create<IncidentState>((set, get) => ({
  active: null,
  dismissedBuckets: new Set(),
  silentUntil: 0,

  report: (incident) => {
    const s = get()
    if (Date.now() < s.silentUntil) return
    const bucket = bucketKey(incident.startTs)
    if (s.dismissedBuckets.has(bucket)) return
    // if the same incident is already active, just update with new data
    if (s.active && bucketKey(s.active.startTs) === bucket) {
      set({ active: { ...incident, id: s.active.id } })
      return
    }
    set({ active: incident })
  },

  clearActive: () => set({ active: null }),

  dismiss: () => {
    const s = get()
    if (!s.active) return
    const next = new Set(s.dismissedBuckets)
    next.add(bucketKey(s.active.startTs))
    set({ active: null, dismissedBuckets: next })
  },

  silenceFor: (ms) => set({ silentUntil: Date.now() + ms, active: null })
}))
