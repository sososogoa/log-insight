import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { TerminalSession } from '@shared/types'

interface Props {
  session: TerminalSession
  visible: boolean
}

export function TerminalView({ session, visible }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      fontFamily: 'JetBrains Mono, SF Mono, ui-monospace, monospace',
      fontSize: 13,
      theme: { background: '#000000', foreground: '#e5e5e5', cursor: '#60a5fa' },
      convertEol: true,
      cursorBlink: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const offData = window.api.terminal.onData(({ terminalId, chunk }) => {
      if (terminalId === session.id) term.write(chunk)
    })
    const offExit = window.api.terminal.onExit(({ terminalId }) => {
      if (terminalId === session.id) term.write('\r\n[terminated]\r\n')
    })
    const disposeOnData = term.onData((data) => {
      void window.api.terminal.write(session.id, data)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        void window.api.terminal.resize(session.id, term.cols, term.rows)
      } catch {
        /* noop */
      }
    })
    ro.observe(containerRef.current)

    return () => {
      offData()
      offExit()
      disposeOnData.dispose()
      ro.disconnect()
      term.dispose()
    }
  }, [session.id])

  useEffect(() => {
    if (visible) {
      fitRef.current?.fit()
    }
  }, [visible])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${visible ? 'block' : 'hidden'}`}
    />
  )
}
