import { useRef, useState } from 'react'
import { Bookmark, Save, Trash2, X, GitCompareArrows, Check, Plus, Download, Upload, Share2 } from 'lucide-react'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import { diff, exportBundle, encodeScenarioToken, type Scenario } from '@/lib/scenarios'
import { downloadText } from '@/lib/download'

function fmtKpi(unit: string | undefined, v: number): string {
  if (unit === '$') return formatCurrency(v)
  if (unit === '%') return `${Math.round(v * 10) / 10}%`
  if (unit === 'd') return `${Math.round(v)}d`
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100)
}

/* A slim, reusable bar for saving / reloading / comparing a workbench's
 * scenarios. The page owns its state; this only names snapshots and surfaces
 * the saved list + a two-up KPI diff. */
export function ScenarioBar({
  scenarios,
  onSave,
  onLoad,
  onRemove,
  onImport,
  module,
  accent = 'blue',
}: {
  scenarios: Scenario[]
  onSave: (name: string) => void
  onLoad: (s: Scenario) => void
  onRemove: (id: string) => void
  /** Adopt a raw bundle/token payload into this workbench. Enables Import + Share. */
  onImport?: (raw: string) => number
  /** Module slug, used to build share-link URLs. */
  module?: string
  accent?: Accent
}) {
  const a = ACCENT[accent]
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [compare, setCompare] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importText, setImportText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const commit = () => { onSave(name); setName(''); setNaming(false) }
  const toggleCompare = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-2)))

  const a0 = scenarios.find((s) => s.id === compare[0])
  const b0 = scenarios.find((s) => s.id === compare[1])
  const rows = a0 && b0 ? diff(a0, b0) : []

  const note = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 1800) }
  const exportAll = () => {
    if (!scenarios.length) return
    downloadText(`${module ?? 'scenarios'}-scenarios.json`, exportBundle(scenarios), 'JSON')
    note(`Exported ${scenarios.length}`)
  }
  const runImport = (raw: string) => {
    const n = onImport ? onImport(raw) : 0
    note(n > 0 ? `Imported ${n}` : 'Nothing valid to import')
    if (n > 0) { setImporting(false); setImportText('') }
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) runImport(await f.text()); e.target.value = ''
  }
  const shareScenario = async (s: Scenario) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const url = `${window.location.origin}${base}/share/scenario/${encodeScenarioToken(s)}`
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard blocked */ }
    note('Share link copied')
  }

  return (
    <div className="rounded-2xl border border-edge/60 bg-surface/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset', a.bg, a.text, a.ring)}>
          <Bookmark className="h-3.5 w-3.5" /> Scenarios
        </span>

        {naming ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setNaming(false); setName('') } }}
              placeholder="Scenario name…"
              className="w-44 rounded-lg border border-edge/70 bg-elevated/60 px-2.5 py-1 text-xs text-slate-100 focus:border-blue-500/50 focus:outline-none"
            />
            <button onClick={commit} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-medium text-blue-200 ring-1 ring-inset ring-blue-500/30 hover:bg-blue-500/25"><Check className="h-3.5 w-3.5" /> Save</button>
            <button onClick={() => { setNaming(false); setName('') }} aria-label="Cancel" className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setNaming(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white">
            <Save className="h-3.5 w-3.5" /> Save current
          </button>
        )}

        {scenarios.length > 0 && (
          <button onClick={exportAll} title="Download all scenarios as JSON" aria-label="Export scenarios" className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
        {onImport && (
          <>
            <button onClick={() => setImporting((v) => !v)} aria-expanded={importing} title="Import scenarios from JSON or a share link" className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white">
              <Upload className="h-3.5 w-3.5" /> Import
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
          </>
        )}
        {flash && <span className="text-[11px] font-medium text-emerald-300">{flash}</span>}

        {scenarios.length > 0 && <span className="text-[11px] text-slate-600">·</span>}

        <div className="flex flex-wrap items-center gap-1.5">
          {scenarios.map((s) => {
            const sel = compare.includes(s.id)
            return (
              <span key={s.id} className={cn('group inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs transition-colors', sel ? 'border-blue-500/50 bg-blue-500/10 text-blue-100' : 'border-edge/60 bg-elevated/40 text-slate-300')}>
                <button onClick={() => toggleCompare(s.id)} title="Select to compare" aria-label={`Compare ${s.name}`} aria-pressed={sel} className={cn('grid h-4 w-4 place-items-center rounded border', sel ? 'border-blue-400 bg-blue-500/40 text-white' : 'border-edge/70 text-transparent hover:border-slate-500')}>
                  <Check className="h-2.5 w-2.5" />
                </button>
                <button onClick={() => onLoad(s)} title="Load this scenario" className="max-w-[140px] truncate font-medium hover:underline">{s.name}</button>
                {onImport && (
                  <button onClick={() => shareScenario(s)} title="Copy a share link" aria-label={`Share ${s.name}`} className="text-slate-600 opacity-0 transition-opacity hover:text-blue-300 group-hover:opacity-100"><Share2 className="h-3 w-3" /></button>
                )}
                <button onClick={() => onRemove(s.id)} title="Delete" aria-label={`Delete ${s.name}`} className="text-slate-600 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              </span>
            )
          })}
          {scenarios.length === 0 && !naming && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Plus className="h-3 w-3" /> save your current setup to reload or compare it later</span>
          )}
        </div>

        {compare.length === 2 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-300"><GitCompareArrows className="h-3.5 w-3.5" /> comparing 2</span>
        )}
      </div>

      {importing && onImport && (
        <div className="mt-3 rounded-xl border border-edge/60 bg-elevated/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">Import scenarios</span>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"><Upload className="h-3 w-3" /> from file…</button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={3}
            placeholder="Paste an exported scenarios JSON bundle, or a single scenario…"
            aria-label="Scenario JSON to import"
            className="w-full resize-y rounded-lg border border-edge/70 bg-base/60 px-2.5 py-2 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => runImport(importText)} disabled={!importText.trim()} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-200 ring-1 ring-inset ring-blue-500/30 hover:bg-blue-500/25 disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Import</button>
            <button onClick={() => { setImporting(false); setImportText('') }} className="text-[11px] text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {rows.length > 0 && a0 && b0 && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-edge/50">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="border-b border-edge/50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">KPI</th>
                <th className="px-3 py-2 text-right font-medium">{truncate(a0.name)}</th>
                <th className="px-3 py-2 text-right font-medium">{truncate(b0.name)}</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-3 py-1.5 text-slate-300">{r.label}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400 data-mono">{fmtKpi(r.unit, r.a)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-200 data-mono">{fmtKpi(r.unit, r.b)}</td>
                  <td className={cn('px-3 py-1.5 text-right data-mono', r.delta > 0 ? 'text-emerald-300' : r.delta < 0 ? 'text-rose-300' : 'text-slate-500')}>
                    {r.delta > 0 ? '+' : ''}{fmtKpi(r.unit, r.delta)}{r.pctDelta ? <span className="ml-1 text-[10px] text-slate-500">({r.pctDelta > 0 ? '+' : ''}{r.pctDelta}%)</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const truncate = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
