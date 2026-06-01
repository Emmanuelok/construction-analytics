'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloud,
  FileSpreadsheet,
  Table2,
  Hash,
  CheckCircle2,
  GitCompare,
  TrendingUp,
  Layers,
  AlertTriangle,
  PieChart,
  ShieldAlert,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react'
import { parseAny, profile, analyze, num, type Table, type ColumnProfile, type Finding, type FindingKind } from '@/lib/analytics'
import { sampleCsv } from '@/lib/sample'
import { buildLine, smoothLineD, areaD, linreg } from '@/lib/chart'

const ease = [0.16, 1, 0.3, 1] as const

const KIND_ICON: Record<FindingKind, typeof GitCompare> = {
  correlation: GitCompare, trend: TrendingUp, segment: Layers, outlier: AlertTriangle, concentration: PieChart, quality: ShieldAlert,
}
const KIND_LABEL: Record<FindingKind, string> = {
  correlation: 'Correlation', trend: 'Trend', segment: 'Segment gap', outlier: 'Outlier', concentration: 'Concentration', quality: 'Data quality',
}
const ACCENT_TEXT: Record<string, string> = {
  emerald: 'text-emerald-400', rose: 'text-rose-400', sky: 'text-sky-400', amber: 'text-amber-400',
  violet: 'text-violet-400', teal: 'text-teal-400', blue: 'text-brand-400', cyan: 'text-cyan-400', fuchsia: 'text-fuchsia-400', lime: 'text-emerald-400',
}

type Result = { table: Table; cols: ColumnProfile[]; findings: Finding[]; name: string }

export function Analyzer() {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = useCallback((text: string, name: string) => {
    setBusy(true)
    setError('')
    // let the spinner paint, then compute (real work, synchronous)
    setTimeout(() => {
      try {
        const table = parseAny(text, name.split('.').pop())
        if (!table.columns.length || !table.rows.length) {
          setError('No tabular rows detected — try a CSV, TSV or JSON file.')
          setBusy(false)
          return
        }
        const cols = profile(table)
        const findings = analyze(table, cols, { max: 8 })
        setResult({ table, cols, findings, name })
      } catch {
        setError('Could not parse that file.')
      }
      setBusy(false)
    }, 280)
  }, [])

  const onFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => run(String(reader.result ?? ''), file.name)
      reader.onerror = () => setError('Could not read that file.')
      reader.readAsText(file)
    },
    [run],
  )

  return (
    <section id="analyze" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">Run it now</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Drop in a dataset. Get real findings in seconds.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
          This isn&apos;t a screenshot — it&apos;s the actual statistical engine, running in your browser. Your file never
          leaves the page. Use your own CSV/JSON, or try the sample.
        </p>
      </div>

      {/* dropzone */}
      <div className="mx-auto mt-10 max-w-3xl">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors ${
            dragging ? 'border-brand-500/60 bg-brand-500/5' : 'border-edge/70 bg-elevated/20 hover:border-brand-500/40'
          }`}
        >
          <UploadCloud className="h-7 w-7 text-brand-400" />
          <div className="mt-3 text-sm font-medium text-slate-200">Drag &amp; drop a CSV, TSV or JSON — or click to browse</div>
          <p className="mt-1 text-xs text-slate-500">Parsed and analyzed locally. Nothing is uploaded.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.json,.geojson,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => run(sampleCsv(), 'aec_projects_sample.csv')}
            className="inline-flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500/40"
          >
            <Sparkles className="h-4 w-4 text-violet-400" /> Try sample data
          </button>
          {result && (
            <button onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}
      </div>

      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-brand-400" /> Parsing &amp; computing findings…
          </motion.div>
        )}
        {result && !busy && <Report key="report" result={result} />}
      </AnimatePresence>
    </section>
  )
}

function fmt(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function Report({ result }: { result: Result }) {
  const { table, cols, findings, name } = result
  const numericCols = cols.filter((c) => c.type === 'number')
  const completeness = cols.length
    ? Math.round((1 - cols.reduce((s, c) => s + (c.count ? c.missing / c.count : 0), 0) / cols.length) * 100)
    : 0

  // pick the top correlation finding to plot a real scatter + regression
  const topCorr = findings.find((f) => f.kind === 'correlation')
  const scatter = useMemo(() => {
    if (!topCorr) return null
    const [cx, cy] = topCorr.columns
    const pts: { x: number; y: number }[] = []
    for (const r of table.rows) {
      const x = num(r[cx] ?? '')
      const y = num(r[cy] ?? '')
      if (!Number.isNaN(x) && !Number.isNaN(y) && r[cx] !== '' && r[cy] !== '') pts.push({ x, y })
      if (pts.length >= 300) break
    }
    if (pts.length < 3) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const W = 520, H = 200
    const px = (x: number) => 10 + ((x - minX) / (maxX - minX || 1)) * (W - 20)
    const py = (y: number) => 10 + (1 - (y - minY) / (maxY - minY || 1)) * (H - 20)
    const { slope, intercept } = linreg(xs, ys)
    return { pts: pts.map((p) => ({ x: px(p.x), y: py(p.y) })), from: { x: px(minX), y: py(slope * minX + intercept) }, to: { x: px(maxX), y: py(slope * maxX + intercept) }, cx, cy, W, H }
  }, [topCorr, table])

  // a numeric column's series → sparkline area
  const spark = useMemo(() => {
    const col = numericCols[0]
    if (!col) return null
    const vals = table.rows.map((r) => num(r[col.name] ?? '')).filter((v) => !Number.isNaN(v)).slice(0, 120)
    if (vals.length < 3) return null
    const pts = buildLine(vals, 520, 120, 6)
    return { line: smoothLineD(pts), area: areaD(pts, 120), name: col.name }
  }, [numericCols, table])

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mt-10 space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge/60 bg-edge/40 sm:grid-cols-4">
        {[
          { icon: Table2, label: 'Rows', value: fmt(table.rows.length) },
          { icon: Hash, label: 'Columns', value: `${cols.length}`, sub: `${numericCols.length} numeric` },
          { icon: CheckCircle2, label: 'Completeness', value: `${completeness}%` },
          { icon: Sparkles, label: 'Findings', value: `${findings.length}` },
        ].map((k) => (
          <div key={k.label} className="bg-surface/70 p-4">
            <k.icon className="h-4 w-4 text-brand-400" />
            <div className="mt-2 font-mono text-xl font-semibold text-white">{k.value}</div>
            <div className="text-[11px] text-slate-500">{k.label}{'sub' in k && k.sub ? ` · ${k.sub}` : ''}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* findings */}
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
            <Sparkles className="h-4 w-4 text-violet-400" /> Insight report
            <span className="text-xs text-slate-500">· {name}</span>
          </div>
          {findings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge/60 bg-elevated/20 p-4 text-sm text-slate-500">
              No statistically notable patterns surfaced — the data may be too small or uniform.
            </p>
          ) : (
            <div className="space-y-2.5">
              {findings.map((f, i) => {
                const Icon = KIND_ICON[f.kind]
                const tint = ACCENT_TEXT[f.accent] ?? 'text-slate-300'
                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="rounded-xl border border-edge/60 bg-elevated/30 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tint}`}>
                        <Icon className="h-3 w-3" /> {KIND_LABEL[f.kind]}
                      </span>
                      {f.stat && <span className="font-mono text-xs text-slate-400">{f.stat}</span>}
                    </div>
                    <h4 className="mt-1.5 text-sm font-semibold text-white">{f.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.detail}</p>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* charts + profiler */}
        <div className="space-y-5">
          {scatter && (
            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5"><GitCompare className="h-3 w-3 text-violet-400" /> {scatter.cx} × {scatter.cy}</span>
                <span className="font-mono text-slate-300">{topCorr?.stat}</span>
              </div>
              <svg viewBox={`0 0 ${scatter.W} ${scatter.H}`} className="h-[180px] w-full">
                {scatter.pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-violet-400/70" />
                ))}
                <motion.line
                  x1={scatter.from.x} y1={scatter.from.y} x2={scatter.to.x} y2={scatter.to.y}
                  stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 3"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease, delay: 0.3 }}
                />
              </svg>
            </div>
          )}
          {spark && (
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
                <TrendingUp className="h-3 w-3 text-brand-400" /> {spark.name}
              </div>
              <svg viewBox="0 0 520 120" className="h-[110px] w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={spark.area} fill="url(#aGrad)" />
                <motion.path d={spark.line} fill="none" stroke="#5b97fb" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease }} />
              </svg>
            </div>
          )}
          {/* compact profiler */}
          <div className="card overflow-hidden">
            <div className="border-b border-edge/50 px-4 py-2.5 text-xs font-medium text-slate-300">Column profile</div>
            <div className="max-h-56 overflow-y-auto">
              {cols.slice(0, 10).map((c) => {
                const missPct = c.count ? Math.round((c.missing / c.count) * 100) : 0
                return (
                  <div key={c.name} className="flex items-center gap-3 border-b border-edge/30 px-4 py-2 text-xs last:border-0">
                    <span className="w-32 truncate font-medium text-slate-200">{c.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.type === 'number' ? 'bg-brand-500/15 text-brand-300' : c.type === 'date' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-elevated text-slate-400'}`}>{c.type}</span>
                    <span className="ml-auto font-mono text-slate-500">{c.type === 'number' ? `μ ${fmt(c.mean)}` : `${fmt(c.unique)} uniq`}</span>
                    {missPct > 0 && <span className="font-mono text-amber-400/80">{missPct}% ∅</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Computed in your browser by the same statistical engine the studio uses — correlations, trends, segment gaps,
        outliers, concentration &amp; quality. <FileSpreadsheet className="inline h-3 w-3" /> {name}
      </p>
    </motion.div>
  )
}
