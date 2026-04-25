import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { matchSlash, type PromptTemplate } from './templates'

interface Props {
  value: string
  onChange: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder?: string
  className?: string
}

export interface SlashCommandInputHandle {
  focus: () => void
}

export const SlashCommandInput = forwardRef<SlashCommandInputHandle, Props>(
  function SlashCommandInput(
    { value, onChange, onCommit, onCancel, placeholder, className },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [openMenu, setOpenMenu] = useState(false)
    const [cursor, setCursor] = useState(0)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus()
    }))

    // show slash dropdown only when value starts with / and has no spaces
    const slashQuery =
      value.startsWith('/') && !value.includes(' ') ? value : ''
    const suggestions: PromptTemplate[] = slashQuery ? matchSlash(slashQuery) : []

    useEffect(() => {
      setOpenMenu(suggestions.length > 0 && !!slashQuery)
      setCursor(0)
    }, [slashQuery, suggestions.length])

    function applyTemplate(t: PromptTemplate): void {
      onChange(t.prompt)
      setOpenMenu(false)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        // move cursor to end
        const len = t.prompt.length
        inputRef.current?.setSelectionRange(len, len)
      })
    }

    return (
      <div className="relative flex-1">
        <input
          ref={inputRef}
          className={
            className ??
            'w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500'
          }
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (openMenu) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, suggestions.length - 1))
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
                return
              }
              if (e.key === 'Tab' || (e.key === 'Enter' && suggestions[cursor])) {
                e.preventDefault()
                applyTemplate(suggestions[cursor])
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setOpenMenu(false)
                return
              }
            } else {
              if (e.key === 'Enter') {
                e.preventDefault()
                onCommit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }
          }}
          onBlur={() => {
            // slight delay to avoid interrupting menu click chain
            setTimeout(() => {
              if (!document.activeElement?.closest('[data-slash-menu]')) {
                setOpenMenu(false)
                onCommit()
              }
            }, 100)
          }}
        />

        {openMenu && (
          <div
            data-slash-menu
            className="absolute left-0 right-0 top-full mt-1 z-30 rounded-md bg-neutral-900 border border-neutral-700 shadow-2xl max-h-[240px] overflow-auto"
          >
            <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
              Prompt templates · ↑↓ navigate · ⏎/Tab select
            </div>
            {suggestions.map((t, i) => (
              <button
                key={t.slash}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTemplate(t)}
                onMouseEnter={() => setCursor(i)}
                className={`w-full text-left px-2 py-1.5 flex items-start gap-2 text-[11px] transition-colors ${
                  i === cursor
                    ? 'bg-blue-600/20'
                    : 'hover:bg-neutral-800/70'
                }`}
              >
                <span className="font-mono text-cyan-300 shrink-0 w-16">
                  {t.slash}
                </span>
                <span className="flex-1">
                  <span className="text-neutral-200">{t.label}</span>
                  <span className="block text-[10px] text-neutral-500 truncate">
                    {t.prompt}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
