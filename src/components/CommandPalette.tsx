import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft, Sparkles, X, ArrowUp, ArrowDown } from 'lucide-react'
import { useStudio } from '@/store/studio'
import { useProfile } from '@/store/profile'
import { interpret, type Command } from '@/lib/intelligence'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

const GROUP_ORDER: Command['group'][] = ['Recommended', 'Datasets', 'Navigate', 'Answers', 'Actions']

export function CommandPalette() {
  const navigate = useNavigate()
  const { allDatasets, library, listings, addToCart, license, owns } = useStudio()
  const { profile, signals, recordSearch } = useProfile()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const ownedIds = useMemo(() => new Set([...library.map((l) => l.datasetId), ...listings.map((l) => l.id)]), [library, listings])

  const commands = useMemo(
    () => interpret(query, { datasets: allDatasets, profile, signals, ownedIds }),
    [query, allDatasets, profile, signals, ownedIds],
  )
  const ordered = useMemo(() => {
    const out: Command[] = []
    for (const g of GROUP_ORDER) out.push(...commands.filter((c) => c.group === g))
    return out
  }, [commands])

  useEffect(() => setActive(0), [query])

  // Open via ⌘K / Ctrl-K, or the global 'aec:command' event (optionally seeded).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onCmd = (e: Event) => {
      const q = (e as CustomEvent).detail?.q as string | undefined
      setQuery(q ?? '')
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('aec:command', onCmd as EventListener)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('aec:command', onCmd as EventListener)
    }
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    else setQuery('')
  }, [open])

  function execute(cmd: Command) {
    if (query.trim()) recordSearch(query.trim())
    if (cmd.action === 'addToCart' && cmd.datasetId) addToCart(cmd.datasetId)
    else if (cmd.action === 'license' && cmd.datasetId) license(cmd.datasetId)
    else if (cmd.action === 'analyze' && cmd.datasetId) navigate(`/analyze?dataset=${cmd.datasetId}`)
    else if (cmd.answerId) navigate('/ask')
    else if (cmd.to === '/?profile=1') window.dispatchEvent(new CustomEvent('aec:onboarding'))
    else if (cmd.to) navigate(cmd.to)
    else if (cmd.datasetId) navigate(`/data/${cmd.datasetId}`)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, ordered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && ordered[active]) {
      e.preventDefault()
      execute(ordered[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!open) return null

  let idx = -1
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
        {/* input */}
        <div className="flex items-center gap-3 border-b border-edge/60 px-4 py-3.5">
          <Search className="h-5 w-5 shrink-0 text-brand-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search datasets, run analytics, jump anywhere — try “recommend for me”"
            className="flex-1 bg-transparent text-[15px] text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-elevated hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* results */}
        <div className="max-h-[55vh] overflow-y-auto py-2">
          {ordered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No matches — try a dataset name, a sector, or “free”.</div>
          ) : (
            GROUP_ORDER.filter((g) => commands.some((c) => c.group === g)).map((g) => (
              <div key={g} className="px-2 py-1">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {g === 'Recommended' && <Sparkles className="h-3 w-3 text-brand-300" />}
                  {g}
                </div>
                {commands
                  .filter((c) => c.group === g)
                  .map((c) => {
                    idx++
                    const i = idx
                    const a = ACCENT[c.accent]
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => execute(c)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          active === i ? 'bg-elevated' : 'hover:bg-elevated/50',
                        )}
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', a.dot)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-100">{c.title}</div>
                          {c.subtitle && <div className="truncate text-xs text-slate-500">{c.subtitle}</div>}
                        </div>
                        {active === i && <CornerDownLeft className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    )
                  })}
              </div>
            ))
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-edge/60 px-4 py-2.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> open</span>
            <span>esc to close</span>
          </div>
          <span className="inline-flex items-center gap-1 text-brand-300/80"><Sparkles className="h-3 w-3" /> tuned to your profile</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
