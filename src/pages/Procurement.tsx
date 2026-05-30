import { useMemo, useState } from 'react'
import {
  Truck,
  Plus,
  Trophy,
  Timer,
  ShieldAlert,
  Gauge,
  Sparkles,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react'
import { Card, CardHeader, Badge, StatTile, ProgressBar, PageHeader } from '@/components/ui'
import { BarSeries, ScatterViz } from '@/components/charts'
import { SUPPLIERS } from '@/data/platform'
import {
  scoreSuppliers,
  cohortStats,
  normalizeWeights,
  DEFAULT_WEIGHTS,
  type SupplierInput,
  type Weights,
  type RiskTier,
} from '@/lib/supplier-score'
import { cn } from '@/lib/cn'

const ACCENT_L = 'lime' as const

/* An editable supplier row — the four criteria are the analytical inputs. */
type Row = SupplierInput & { category: string; region: string }

const seed = (): Row[] =>
  SUPPLIERS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    region: s.region,
    onTime: s.onTime,
    quality: s.quality,
    leadTime: s.leadTime,
    priceIndex: s.priceIndex,
  }))

const RISK: Record<RiskTier, { variant: 'success' | 'warn' | 'danger' }> = {
  Low: { variant: 'success' },
  Medium: { variant: 'warn' },
  High: { variant: 'danger' },
}

function scoreAccent(score: number) {
  return score >= 85 ? 'lime' : score >= 70 ? 'amber' : 'rose'
}

/* Weighting presets — one click reframes the whole leaderboard around a priority. */
const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: 'balanced', label: 'Balanced', weights: DEFAULT_WEIGHTS },
  { id: 'cost', label: 'Cost-first', weights: { onTime: 0.15, quality: 0.15, leadTime: 0.2, price: 0.5 } },
  { id: 'reliability', label: 'Reliability-first', weights: { onTime: 0.4, quality: 0.4, leadTime: 0.1, price: 0.1 } },
  { id: 'speed', label: 'Speed-first', weights: { onTime: 0.2, quality: 0.15, leadTime: 0.5, price: 0.15 } },
]

const sameWeights = (a: Weights, b: Weights) =>
  a.onTime === b.onTime && a.quality === b.quality && a.leadTime === b.leadTime && a.price === b.price

export default function Procurement() {
  const [rows, setRows] = useState<Row[]>(seed)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [edited, setEdited] = useState(false)

  const set = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setEdited(true)
  }
  const addRow = () => {
    setRows((rs) => [
      ...rs,
      { id: `SUP-${Math.floor(10 + Math.random() * 89)}`, name: 'New supplier', category: 'Uncategorized', region: 'NA', onTime: 85, quality: 85, leadTime: 60, priceIndex: 100 },
    ])
    setEdited(true)
  }
  const removeRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id))
    setEdited(true)
  }
  const reset = () => {
    setRows(seed())
    setWeights(DEFAULT_WEIGHTS)
    setEdited(false)
  }
  const setWeight = (key: keyof Weights, v: number) => {
    setWeights((w) => ({ ...w, [key]: v }))
    setEdited(true)
  }

  // Live scoring under the current weights, plus a balanced baseline so we can
  // show how each supplier moves as priorities change — the core "what-if".
  const scored = useMemo(() => scoreSuppliers(rows, weights), [rows, weights])
  const baseline = useMemo(() => scoreSuppliers(rows, DEFAULT_WEIGHTS), [rows])
  const baselineRank = useMemo(() => new Map(baseline.map((s) => [s.id, s.rank])), [baseline])
  const ordered = useMemo(() => [...scored].sort((a, b) => a.rank - b.rank), [scored])
  const stats = useMemo(() => cohortStats(scored), [scored])
  const normW = normalizeWeights(weights)

  const activePreset = PRESETS.find((p) => sameWeights(normalizeWeights(p.weights), normW))?.id

  // value frontier: cheaper (left) + higher score (top) = better value
  const frontier = scored.map((s) => ({ x: s.priceIndex, y: s.score, name: s.name }))
  // top suppliers by composite score, for the bar
  const topBar = ordered.slice(0, 8).map((s) => ({ name: s.name.length > 18 ? s.name.slice(0, 17) + '…' : s.name, score: s.score }))

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Truck}
        eyebrow="Intelligence"
        title="Procurement Intelligence"
        accent={ACCENT_L}
        description="A live supplier-scoring workbench. Edit any supplier's on-time, quality, lead time or price — then move the criteria weights to match your priority. Composite score, rank and delivery risk recompute instantly. Real weighted multi-criteria scoring, not a static leaderboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant="brand" dot>
              {rows.length} suppliers
            </Badge>
          </>
        }
      />

      {/* cohort KPIs — recompute as you edit data or weights */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Top supplier" value={stats.best?.name ?? '—'} icon={Trophy} accent="lime" sub={stats.best ? `Score ${stats.best.score} · rank 1` : 'No suppliers'} />
        <StatTile label="Avg composite score" value={stats.avgScore.toFixed(1)} icon={Gauge} accent="emerald" sub={`Across ${rows.length} suppliers`} />
        <StatTile label="Avg lead time" value={`${stats.avgLead}d`} icon={Timer} accent="amber" sub="Order-to-delivery" />
        <StatTile label="High-risk suppliers" value={String(stats.highRisk)} icon={ShieldAlert} accent="rose" sub="Composite score < 70" />
      </div>

      {/* weighting controls — the scenario knobs */}
      <Card>
        <CardHeader
          icon={SlidersHorizontal}
          accent={ACCENT_L}
          title="Scoring criteria — your priorities"
          subtitle="Drag a weight or pick a preset; the leaderboard re-ranks live. Weights are normalized to 100%."
          action={
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setWeights(p.weights); setEdited(true) }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                    activePreset === p.id
                      ? 'bg-lime-500/15 text-lime-300 ring-lime-500/40'
                      : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        />
        <div className="grid gap-5 border-t border-edge/50 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <WeightSlider label="On-time delivery" hint="higher is better" value={weights.onTime} pct={normW.onTime} onChange={(v) => setWeight('onTime', v)} />
          <WeightSlider label="Quality" hint="higher is better" value={weights.quality} pct={normW.quality} onChange={(v) => setWeight('quality', v)} />
          <WeightSlider label="Lead time" hint="lower is better" value={weights.leadTime} pct={normW.leadTime} onChange={(v) => setWeight('leadTime', v)} />
          <WeightSlider label="Price index" hint="lower is better" value={weights.price} pct={normW.price} onChange={(v) => setWeight('price', v)} />
        </div>
      </Card>

      {/* editable, live-ranked leaderboard */}
      <Card>
        <CardHeader
          icon={Trophy}
          accent={ACCENT_L}
          title="Supplier leaderboard — editable"
          subtitle="Click any metric to edit; score, rank and risk recompute. ▲▼ shows movement vs the balanced baseline."
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add supplier
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Supplier</th>
                <th className="px-3 py-2.5 font-medium">Region</th>
                <th className="px-3 py-2.5 text-right font-medium">On-time</th>
                <th className="px-3 py-2.5 text-right font-medium">Quality</th>
                <th className="px-3 py-2.5 text-right font-medium">Lead (d)</th>
                <th className="px-3 py-2.5 text-right font-medium">Price idx</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 text-center font-medium">Risk</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {ordered.map((s) => {
                const base = baselineRank.get(s.id) ?? s.rank
                const move = base - s.rank // + = moved up vs balanced
                return (
                  <tr key={s.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 text-sm font-semibold text-slate-200 data-mono">{s.rank}</span>
                        {move > 0 && <span className="inline-flex items-center text-[10px] text-emerald-400"><ArrowUp className="h-3 w-3" />{move}</span>}
                        {move < 0 && <span className="inline-flex items-center text-[10px] text-rose-400"><ArrowDown className="h-3 w-3" />{-move}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input value={s.name} onChange={(e) => set(s.id, { name: e.target.value })} className="w-40 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-lime-500/40" />
                      <input value={s.category} onChange={(e) => set(s.id, { category: e.target.value })} className="block w-40 truncate rounded bg-transparent text-[11px] text-slate-500 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-lime-500/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={s.region} onChange={(e) => set(s.id, { region: e.target.value })} className="w-16 rounded bg-transparent text-slate-300 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-lime-500/30" />
                    </td>
                    <NumCell value={s.onTime} onChange={(v) => set(s.id, { onTime: clampPct(v) })} fmt={(v) => `${v}%`} tone={s.onTime >= 90 ? 'good' : s.onTime >= 75 ? 'warn' : 'bad'} />
                    <NumCell value={s.quality} onChange={(v) => set(s.id, { quality: clampPct(v) })} fmt={(v) => `${v}%`} />
                    <NumCell value={s.leadTime} onChange={(v) => set(s.id, { leadTime: Math.max(0, v) })} fmt={(v) => `${v}`} />
                    <NumCell value={s.priceIndex} onChange={(v) => set(s.id, { priceIndex: Math.max(0, v) })} fmt={(v) => `${v}`} tone={s.priceIndex > 100 ? 'bad' : 'good'} />
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={s.score} accent={scoreAccent(s.score)} height="sm" className="w-20" />
                        <span className="w-9 text-sm font-semibold text-slate-100 data-mono">{s.score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={RISK[s.risk].variant} dot>{s.risk}</Badge>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeRow(s.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by live scoring */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Gauge} accent={ACCENT_L} title="Best-value frontier" subtitle="Price index vs composite score — top-left (cheap + strong) is best value" />
          <div className="border-t border-edge/50 p-5">
            <ScatterViz data={frontier} xKey="x" yKey="y" xName="Price index" yName="Score" height={300} accent="lime" />
            <p className="mt-2 text-xs text-slate-500">Lower price with a higher score wins; outliers to the lower-right are expensive underperformers.</p>
          </div>
        </Card>
        <Card>
          <CardHeader icon={Trophy} accent={ACCENT_L} title="Composite score ranking" subtitle="Top suppliers under the current weighting" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={topBar}
              xKey="name"
              layout="vertical"
              height={300}
              series={[{ key: 'score', name: 'Composite score', accent: 'lime' }]}
              valueFormatter={(v) => `${v}`}
            />
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-lime-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_L} title="Procurement read-out" subtitle="Computed from your current data and weighting" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          {stats.best ? (
            <p className="text-[15px] leading-relaxed text-slate-300">
              Under a weighting of{' '}
              <span className="font-semibold text-slate-100">{Math.round(normW.onTime * 100)}% on-time</span>,{' '}
              <span className="font-semibold text-slate-100">{Math.round(normW.quality * 100)}% quality</span>,{' '}
              <span className="font-semibold text-slate-100">{Math.round(normW.leadTime * 100)}% lead time</span> and{' '}
              <span className="font-semibold text-slate-100">{Math.round(normW.price * 100)}% price</span>,{' '}
              <span className="font-semibold text-lime-300">{stats.best.name}</span> leads with a composite score of{' '}
              <span className="font-semibold text-slate-100">{stats.best.score}</span>
              {stats.highRisk > 0 ? (
                <> — while <span className="text-rose-300">{stats.highRisk} supplier{stats.highRisk > 1 ? 's' : ''}</span> fall below the 70-point risk threshold.</>
              ) : (
                <> — and every supplier clears the 70-point risk threshold.</>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Add a supplier to begin scoring.</p>
          )}
          {stats.highRisk > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ordered.filter((s) => s.risk === 'High').map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <ShieldAlert className="h-3 w-3" /> {s.name} · {s.score}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/* A weight slider 0–100% (stored 0–1), showing the normalized share. */
function WeightSlider({ label, hint, value, pct, onChange }: { label: string; hint: string; value: number; pct: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-sm font-semibold text-lime-300 data-mono">{Math.round(pct * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-lime-500"
      />
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  )
}

/* An inline-editable numeric cell — shows a formatted value, edits the raw number. */
function NumCell({ value, onChange, fmt, tone }: { value: number; onChange: (v: number) => void; fmt: (v: number) => string; tone?: 'good' | 'warn' | 'bad' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-300'
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-lime-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
          {fmt(value)}
        </button>
      )}
    </td>
  )
}
