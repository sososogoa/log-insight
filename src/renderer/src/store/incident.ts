import { create } from 'zustand'
import type { Incident } from '@renderer/features/incident/detector'

interface IncidentState {
  /** 감지됐지만 아직 dismiss 되지 않은 가장 최근 인시던트 */
  active: Incident | null
  /** dismiss 된 id 모음 — 같은 minute bucket 은 재트리거 방지 */
  dismissedBuckets: Set<string>
  /** 이 시각 이전까지는 감지 결과를 무시 (일시 음소거) */
  silentUntil: number

  report: (incident: Incident) => void
  clearActive: () => void
  dismiss: () => void
  silenceFor: (ms: number) => void
}

function bucketKey(startTs: number): string {
  // 1분 bucket
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
    // 이미 같은 인시던트가 활성화되어 있으면 새 데이터로 갱신만
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
