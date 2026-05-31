import { useMemo, useState } from 'react'
import {
  ScanEye,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  ShieldCheck,
  CircleDollarSign,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  BadgeCheck,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { BarSeries } from '@/components/charts'
import {
  scoreZone,
  summarize,
  verifyNarrative,
  formatMoney,
  type ZoneInput,
  type ZoneStatus,
} from '@/lib/verify'
import { cn } from '@/lib/cn'
import { formatNumber, formatCurrency } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import type { KPI } from '@/lib/scenarios'

const ACCENT_NAME = 'cyan' as const

/* Per-zone work packages — planned vs contractor-claimed vs CV-verified. */
const seed = (): ZoneInput[] => [
  { id: 'z1', zone: 'L20–24 Structure', unit: 'm³', plannedQty: 2400, claimedQty: 2280, verifiedQty: 2150, rate: 165, confidence: 0.94 },
  { id: 'z2', zone: 'Façade Bays 1–8', unit: 'm²', plannedQty: 9500, claimedQty: 8800, verifiedQty: 7600, rate: 920, confidence: 0.88 },
  { id: 'z3', zone: 'MEP Risers 1–6', unit: 'lm', plannedQty: 18000, claimedQty: 15500, verifiedQty: 12800, rate: 70, confidence: 0.79 },
  { id: 'z4', zone: 'Core Walls L10–18', unit: 'm³', plannedQty: 1600, claimedQty: 1600, verifiedQty: 1560, rate: 165, confidence: 0.95 },
  { id: 'z5', zone: 'Podium Slab', unit: 'm²', plannedQty: 4200, claimedQty: 4000, verifiedQty: 3950, rate: 78, confidence: 0.92 },
  { id: 'z6', zone: 'Roof Plant Deck', unit: 'm²', plannedQty: 1200, claimedQty: 1100, verifiedQty: 700, rate: 110, confidence: 0.70 },
]

const STATUS_META: Record<ZoneStatus, { label: string; variant: 'success' | 'warn' | 'danger' }> = {
  verified: { label: 'Verified', variant: 'success' },
  review: { label: 'Review', variant: 'warn' },
  'over-claimed': { label: 'Over-claimed', variant: 'danger' },
}

const short = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s)

export default function RealityCapture() {
  const [rows, setRows] = useState<ZoneInput[]>(seed)
  const [tolerancePct, setTolerancePct] = useState(3)
  const [minConfidence, setMinConfidence] = useState(0.8)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const set = (id: string, patch: Partial<ZoneInput>) => { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); touch() }
  const verify = (id: string, claimed: number) => set(id, { verifiedQty: claimed, confidence: 0.95 })
  const addRow = () => { setRows((rs) => [...rs, { id: `z-${Math.floor(1000 + Math.random() * 9000)}`, zone: 'New zone', unit: 'm²', plannedQty: 1000, claimedQty: 800, verifiedQty: 600, rate: 100, confidence: 0.85 }]); touch() }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); touch() }
  const reset = () => { setRows(seed()); setTolerancePct(3); setMinConfidence(0.8); setEdited(false) }

  const thresholds = { tolerancePct, minConfidence }
  const zones = useMemo(() => rows.map((z) => scoreZone(z, thresholds)), [rows, tolerancePct, minConfidence])
  const s = useMemo(() => summarize(rows, thresholds), [rows, tolerancePct, minConfidence])
  const { scenarios, save, remove } = useScenarios('reality-capture')
  const summary: KPI[] = [
    { label: 'Verified completion', value: s.verifiedPct, unit: '%' },
    { label: 'Claimed completion', value: s.claimedPct, unit: '%' },
    { label: 'Value at risk', value: s.valueAtRisk, unit: '$' },
    { label: 'Verification score', value: s.avgVerification },
  ]

  const compareData = zones.map((z) => ({ name: short(z.zone), Claimed: z.claimedPct, Verified: z.verifiedPct }))
  const gapData = zones.map((z) => ({ name: short(z.zone), gap: Math.round(z.claimGapValue) }))
  const flagged = zones.filter((z) => z.status !== 'verified')

  return (
    <div className="space-y-8">
      <PageHeader
        icon={ScanEye}
        eyebrow="Intelligence"
        title="Reality Capture & Verification"
        accent={ACCENT_NAME}
        description="A live progress-verification workbench. Edit planned, claimed and CV-verified quantities per zone — plus capture confidence — and watch verified completion, the claim gap, the value at risk and a confidence-weighted verification score recompute. The gap between claimed and verified is where payment risk hides."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={s.valueAtRisk > 0 ? 'warn' : 'success'} dot>
              {formatMoney(s.valueAtRisk)} at risk
            </Badge>
          </>
        }
      />

      <ScenarioBar
        accent="cyan"
        scenarios={scenarios}
        onSave={(name) => save(name, { rows, tolerancePct, minConfidence }, summary)}
        onLoad={(sc) => {
          const d = sc.data as { rows?: typeof rows; tolerancePct?: number; minConfidence?: number }
          if (d.rows) setRows(d.rows)
          if (typeof d.tolerancePct === 'number') setTolerancePct(d.tolerancePct)
          if (typeof d.minConfidence === 'number') setMinConfidence(d.minConfidence)
          setEdited(true)
        }}
        onRemove={remove}
      />

      {/* KPIs — recompute as capture verifies work */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Verified completion" value={`${s.verifiedPct}%`} icon={CheckCircle2} accent={s.verifiedPct >= 90 ? 'emerald' : 'cyan'} sub="CV-verified, value-weighted" />
        <StatTile label="Claimed completion" value={`${s.claimedPct}%`} icon={TrendingUp} accent="amber" sub={`${Math.round((s.claimedPct - s.verifiedPct) * 10) / 10}pt claim gap`} />
        <StatTile label="Value at risk" value={formatMoney(s.valueAtRisk)} icon={CircleDollarSign} accent={s.valueAtRisk > 0 ? 'rose' : 'emerald'} sub="Claimed but unverified" />
        <StatTile label="Verification score" value={s.avgVerification.toFixed(1)} icon={Gauge} accent={s.avgVerification >= 80 ? 'emerald' : 'amber'} sub="Confidence-weighted, 0–100" />
        <StatTile label="Flagged zones" value={`${s.overClaimed + s.review}`} icon={AlertTriangle} accent="rose" sub={`${s.overClaimed} over-claimed · ${s.review} review`} />
      </div>

      {/* verification thresholds */}
      <Card>
        <CardHeader icon={SlidersHorizontal} accent={ACCENT_NAME} title="Verification policy" subtitle="Set how far claimed work may run ahead of verified, and the capture confidence you require to trust a zone" />
        <div className="grid max-w-2xl grid-cols-1 gap-5 border-t border-edge/50 p-5 sm:grid-cols-2">
          <Param label="Claim tolerance" unit="% of planned" value={tolerancePct} step={0.5} onChange={(v) => { setTolerancePct(Math.max(0, v)); touch() }} />
          <Param label="Min capture confidence" unit="0–1" value={minConfidence} step={0.05} onChange={(v) => { setMinConfidence(Math.max(0, Math.min(1, v))); touch() }} />
        </div>
      </Card>

      {/* editable zone table */}
      <Card>
        <CardHeader
          icon={BadgeCheck}
          accent={ACCENT_NAME}
          title="Progress verification — editable"
          subtitle="Click any quantity, rate or confidence to edit, or Verify a zone as capture confirms it. Completion, claim gap and score recompute live."
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add zone
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Zone</th>
                <th className="px-3 py-2.5 text-right font-medium">Planned</th>
                <th className="px-3 py-2.5 text-right font-medium">Claimed</th>
                <th className="px-3 py-2.5 text-right font-medium">Verified</th>
                <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                <th className="px-3 py-2.5 text-right font-medium">Conf.</th>
                <th className="px-3 py-2.5 text-right font-medium">Claim gap</th>
                <th className="px-3 py-2.5 font-medium">Verification</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {zones.map((z) => {
                const st = STATUS_META[z.status]
                return (
                  <tr key={z.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <input value={z.zone} onChange={(e) => set(z.id, { zone: e.target.value })} className="w-40 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/40" />
                      <input value={z.unit} onChange={(e) => set(z.id, { unit: e.target.value })} className="block w-16 rounded bg-transparent text-[11px] text-slate-500 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/30" />
                    </td>
                    <NumCell value={z.plannedQty} onChange={(v) => set(z.id, { plannedQty: Math.max(0, v) })} />
                    <NumCell value={z.claimedQty} onChange={(v) => set(z.id, { claimedQty: Math.max(0, v) })} tone="warn" />
                    <NumCell value={z.verifiedQty} onChange={(v) => set(z.id, { verifiedQty: Math.max(0, v) })} tone="good" />
                    <NumCell value={z.rate} onChange={(v) => set(z.id, { rate: Math.max(0, v) })} fmt={(v) => `$${formatNumber(v)}`} />
                    <ConfCell value={z.confidence} onChange={(v) => set(z.id, { confidence: v })} />
                    <td className={cn('px-3 py-2 text-right data-mono', z.claimGapValue > 0 ? 'text-rose-300' : 'text-emerald-300')}>
                      {z.claimGapValue !== 0 ? formatMoney(z.claimGapValue) : '—'}
                      <span className="ml-1 text-[10px] text-slate-500">{z.claimGapPct > 0 ? `+${z.claimGapPct}%` : `${z.claimGapPct}%`}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={z.verificationScore} accent={z.verificationScore >= 80 ? 'emerald' : z.verificationScore >= 60 ? 'amber' : 'rose'} height="sm" className="w-16" />
                        <span className="w-8 text-sm font-semibold text-slate-100 data-mono">{z.verificationScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {z.claimGapQty > 0 && (
                          <button onClick={() => verify(z.id, z.claimedQty)} title="Mark verified up to claim" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/15">
                            <CheckCircle2 className="h-3 w-3" /> Verify
                          </button>
                        )}
                        <button onClick={() => removeRow(z.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by the live model */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={TrendingUp} accent={ACCENT_NAME} title="Claimed vs verified completion" subtitle="Per zone (%) — the gap is unverified claim" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={compareData}
              xKey="name"
              layout="vertical"
              height={300}
              series={[{ key: 'Claimed', name: 'Claimed', accent: 'amber' }, { key: 'Verified', name: 'CV-verified', accent: 'cyan' }]}
              valueFormatter={(v) => `${v}%`}
            />
          </div>
        </Card>
        <Card>
          <CardHeader icon={CircleDollarSign} accent="rose" title="Value at risk by zone" subtitle="Claimed-but-unverified value — where payment risk concentrates" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={gapData}
              xKey="name"
              layout="vertical"
              height={300}
              series={[{ key: 'gap', name: 'Claim gap value', accent: 'rose' }]}
              valueFormatter={(v) => formatCurrency(v)}
            />
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-cyan-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Verification read-out" subtitle="Computed from your current capture" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{verifyNarrative(s)}</p>
          {flagged.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {flagged.map((z) => (
                <span key={z.id} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]', z.status === 'over-claimed' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300')}>
                  {z.status === 'over-claimed' ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />} {z.zone} · {STATUS_META[z.status].label}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* A labelled, controlled numeric parameter input. */
function Param({ label, unit, value, onChange, step = 1 }: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }}
        className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
      />
    </label>
  )
}

/* Inline-editable numeric cell. */
function NumCell({ value, onChange, fmt, tone }: { value: number; onChange: (v: number) => void; fmt?: (v: number) => string; tone?: 'good' | 'warn' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-slate-300'
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 rounded border border-cyan-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
          {fmt ? fmt(value) : formatNumber(value)}
        </button>
      )}
    </td>
  )
}

/* Confidence cell — displays a %, edits the underlying 0–1 value. */
function ConfCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const tone = value >= 0.85 ? 'text-emerald-300' : value >= 0.75 ? 'text-amber-300' : 'text-rose-300'
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          step={1}
          defaultValue={Math.round(value * 100)}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(Math.max(0, Math.min(1, n / 100))); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-16 rounded border border-cyan-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', tone)} title="Click to edit (capture confidence %)">
          {Math.round(value * 100)}%
        </button>
      )}
    </td>
  )
}
