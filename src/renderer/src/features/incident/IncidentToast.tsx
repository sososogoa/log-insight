import { useState } from 'react'
import { useIncidentStore } from '@renderer/store/incident'
import { useTerminalStore } from '@renderer/store/terminal'
import { useSourcesStore } from '@renderer/store/sources'
import { useCanvasesStore } from '@renderer/store/canvases'

const ANALYZE_INSTRUCTION =
  'The following are error logs that spiked abnormally in the last 60 seconds. Analyze the cause and suggest urgent mitigation steps:'

export function IncidentToast(): JSX.Element | null {
  const active = useIncidentStore((s) => s.active)
  const dismiss = useIncidentStore((s) => s.dismiss)
  const silence = useIncidentStore((s) => s.silenceFor)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!active) return null

  const srcName = (() => {
    if (!active.topSourceId) return null
    const src = useSourcesStore
      .getState()
      .sources.find((s) => s.sourceId === active.topSourceId)
    return src ? `${src.serverName}:${src.path.split('/').pop()}` : null
  })()

  function focusIncidentCanvas(): void {
    if (!active?.topSourceId) return
    useCanvasesStore
      .getState()
      .openOrFocus(active.topSourceId, srcName ?? 'incident')
  }

  async function analyze(): Promise<void> {
    if (!active) return
    const termId = useTerminalStore.getState().activeId
    if (!termId) {
      focusIncidentCanvas()
      return
    }
    setSending(true)
    const payload = active.sampleErrors.map((l) => l.text).join('\n')
    await window.api.aiBridge.send({
      terminalId: termId,
      instruction: ANALYZE_INSTRUCTION,
      payload
    })
    useTerminalStore.getState().requestExpand()
    setSending(false)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      useIncidentStore.getState().clearActive()
    }, 1200)
    focusIncidentCanvas()
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[380px] rounded-lg border border-red-500/50 bg-neutral-950/95 backdrop-blur shadow-2xl overflow-hidden animate-in">
      <div className="px-3 py-2 bg-red-950/40 border-b border-red-500/30 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-sm font-semibold text-red-200 flex-1">
          Incident Detected · Error spike
        </span>
        <button
          onClick={() => silence(5 * 60_000)}
          title="Mute for 5 minutes"
          className="text-[10px] text-neutral-500 hover:text-neutral-300 px-1"
        >
          🔕 5m
        </button>
        <button
          onClick={dismiss}
          title="Close"
          className="text-neutral-400 hover:text-neutral-100 text-sm leading-none px-1"
        >
          ×
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-1.5 text-[12px] text-neutral-300">
        <div>
          <span className="text-red-300 font-semibold tabular-nums">
            {active.errorCount} errors
          </span>{' '}
          in last 60s · baseline{' '}
          <span className="text-neutral-500 tabular-nums">
            {active.baselinePerMin.toFixed(1)}/min
          </span>
        </div>
        {srcName && (
          <button
            onClick={focusIncidentCanvas}
            className="text-[11px] text-cyan-300 hover:text-cyan-200 underline decoration-dotted"
          >
            → Open {srcName} canvas
          </button>
        )}
        {active.sampleErrors.length > 0 && (
          <div className="text-[11px] text-neutral-400 font-mono bg-neutral-900 rounded px-2 py-1.5 max-h-20 overflow-hidden">
            {active.sampleErrors.slice(0, 2).map((l) => (
              <div key={l.id} className="truncate text-red-300">
                {l.text}
              </div>
            ))}
            {active.sampleErrors.length > 2 && (
              <div className="text-neutral-500">
                … +{active.sampleErrors.length - 2}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-2.5 flex items-center gap-2">
        <button
          onClick={analyze}
          disabled={sending}
          className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
            sent
              ? 'bg-green-700/70 text-green-100'
              : 'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50'
          }`}
        >
          {sending
            ? 'Requesting analysis…'
            : sent
              ? '✓ Sent to AI'
              : '🤖 Ask AI to Analyze'}
        </button>
        <button
          onClick={dismiss}
          className="px-2 py-1.5 rounded text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
