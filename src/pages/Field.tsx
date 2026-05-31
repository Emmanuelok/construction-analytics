import { useMemo, useState } from 'react'
import {
  HardHat,
  Users,
  Gauge,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  HeartPulse,
} from 'lucide-react'
import { PageHeader, Card, CardHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { BarSeries, ScatterViz } from '@/components/charts'
import {
  computeSite,
  portfolio as computePortfolio,
  fieldNarrative,
  type SiteInput,
  type SiteStatus,
} from '@/lib/field-metrics'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ScrollableTable } from '@/components/ScrollableTable'
import { ExportMenu } from '@/components/ExportMenu'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'
import type { KPI } from '@/lib/scenarios'

const ACCENT_NAME = 'amber' as const

/* Editable per-site field record — the inputs that drive every metric. */
const seed = (): SiteInput[] => [
  { id: 'PRJ-1042', name: 'Meridian Tower', workersPlanned: 340, workersActual: 312, outputPlanned: 400, outputActual: 364, hoursWorked: 420_000, recordables: 4, nearMisses: 60 },
  { id: 'PRJ-0512', name: 'Lumen Airport T4', workersPlanned: 520, workersActual: 488, outputPlanned: 600, outputActual: 540, hoursWorked: 680_000, recordables: 9, nearMisses: 88 },
  { id: 'PRJ-1135', name: 'Northgate Hospital', workersPlanned: 240, workersActual: 226, outputPlanned: 300, outputActual: 261, hoursWorked: 360_000, recordables: 7, nearMisses: 41 },
  { id: 'PRJ-1290', name: 'Riverside Transit Hub', workersPlanned: 300, workersActual: 318, outputPlanned: 380, outputActual: 372, hoursWorked: 540_000, recordables: 11, nearMisses: 52 },
  { id: 'PRJ-1201', name: 'Solano Logistics Park', workersPlanned: 180, workersActual: 174, outputPlanned: 220, outputActual: 208, hoursWorked: 240_000, recordables: 2, nearMisses: 28 },
  { id: 'PRJ-0987', name: 'Harbour Point Mixed-Use', workersPlanned: 210, workersActual: 198, outputPlanned: 260, outputActual: 246, hoursWorked: 300_000, recordables: 3, nearMisses: 33 },
]

const STATUS: Record<SiteStatus, { label: string; variant: 'success' | 'warn' | 'danger' }> = {
  'on-track': { label: 'On track', variant: 'success' },
  watch: { label: 'Watch', variant: 'warn' },
  'at-risk': { label: 'At risk', variant: 'danger' },
}

const prodTone = (v: number) => (v >= 95 ? 'good' : v >= 85 ? 'warn' : 'bad')
const trirTone = (v: number) => (v <= 2.5 ? 'good' : v <= 4 ? 'warn' : 'bad')
const safetyAccent = (v: number) => (v >= 70 ? 'emerald' : v >= 55 ? 'amber' : 'rose')

export default function Field() {
  const [rows, setRows] = useState<SiteInput[]>(seed)
  const [edited, setEdited] = useState(false)

  const set = (id: string, patch: Partial<SiteInput>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setEdited(true)
  }
  const addRow = () => {
    setRows((rs) => [...rs, { id: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`, name: 'New site', workersPlanned: 100, workersActual: 95, outputPlanned: 120, outputActual: 110, hoursWorked: 120_000, recordables: 1, nearMisses: 10 }])
    setEdited(true)
  }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); setEdited(true) }
  const reset = () => { setRows(seed()); setEdited(false) }

  const sites = useMemo(() => rows.map(computeSite), [rows])
  const p = useMemo(() => computePortfolio(rows), [rows])
  const { scenarios, save, remove, importRaw } = useScenarios('field')
  const summary: KPI[] = [
    { label: 'Productivity index', value: p.productivity, unit: '%' },
    { label: 'Portfolio TRIR', value: p.trir },
    { label: 'Safety score', value: p.safetyScore },
    { label: 'At-risk sites', value: p.atRisk },
  ]

  // charts driven by the live metrics
  const outputData = sites.map((s) => ({ name: s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name, Planned: s.outputPlanned, Actual: s.outputActual }))
  const frontier = sites.map((s) => ({ x: s.productivity, y: s.safetyScore, name: s.name }))
  const worst = [...sites].filter((s) => s.status === 'at-risk').sort((a, b) => a.safetyScore - b.safetyScore)

  const reportTable: ReportTable = {
    title: 'Site execution',
    columns: ['Site', 'Staffing', 'Productivity', 'TRIR', 'Safety', 'Status'],
    rows: sites.map((s) => [s.name, `${s.staffing}%`, `${s.productivity}%`, s.trir.toFixed(2), s.safetyScore, STATUS[s.status].label]),
  }
  const reportSpec: ReportSpec = {
    title: 'Construction Analytics',
    subtitle: `Field execution brief · ${p.sites} sites`,
    module: 'field',
    kpis: summary.map(kpiToItem),
    narrative: fieldNarrative(p),
    table: reportTable,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={HardHat}
        eyebrow="Intelligence"
        title="Construction Analytics"
        accent={ACCENT_NAME}
        description="A live field-execution workbench. Edit any site's manpower, installed output, hours worked or incident counts — staffing, productivity factor, the OSHA-standard TRIR and safety score recompute instantly. Real on-site math, not a static dashboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={STATUS[p.atRisk > 0 ? 'at-risk' : p.productivity >= 92 ? 'on-track' : 'watch'].variant} dot>
              {p.sites} active sites
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            onImport={importRaw}
            module="field"
            accent="amber"
            scenarios={scenarios}
            onSave={(name) => save(name, { rows }, summary)}
            onLoad={(s) => { const d = s.data as { rows?: typeof rows }; if (d.rows) { setRows(d.rows); setEdited(true) } }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="amber" spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject="field" accent="amber" />

      {/* portfolio KPIs — recompute as you edit */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Workers on site" value={formatNumber(p.workersActual)} icon={Users} accent="amber" sub={`${p.staffing}% of ${formatNumber(p.workersPlanned)} planned`} />
        <StatTile label="Productivity index" value={`${p.productivity}%`} icon={Gauge} accent={p.productivity >= 95 ? 'emerald' : p.productivity >= 85 ? 'amber' : 'rose'} sub="Installed output vs plan" />
        <StatTile label="Portfolio TRIR" value={p.trir.toFixed(2)} icon={HeartPulse} accent={p.trir <= 2.5 ? 'emerald' : p.trir <= 4 ? 'amber' : 'rose'} sub="Recordables × 200k ÷ hours" />
        <StatTile label="Safety score" value={String(p.safetyScore)} icon={ShieldCheck} accent={safetyAccent(p.safetyScore)} sub="0–100 from blended TRIR" />
        <StatTile label="At-risk sites" value={String(p.atRisk)} icon={AlertTriangle} accent="rose" sub="Low productivity or safety" />
      </div>

      {/* editable per-site table */}
      <Card>
        <CardHeader
          icon={Activity}
          accent={ACCENT_NAME}
          title="Site execution — editable"
          subtitle="Click any planned/actual, hours or incident figure to edit; staffing, productivity, TRIR and safety recompute live"
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add site
            </button>
          }
        />
        <ScrollableTable label="Site execution" className="border-t border-edge/50">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Site</th>
                <th className="px-3 py-2.5 text-right font-medium">Workers (act/plan)</th>
                <th className="px-3 py-2.5 text-right font-medium">Output (act/plan)</th>
                <th className="px-3 py-2.5 text-right font-medium">Man-hours</th>
                <th className="px-3 py-2.5 text-right font-medium">Rec.</th>
                <th className="px-3 py-2.5 text-right font-medium">Near-miss</th>
                <th className="px-3 py-2.5 text-right font-medium">Staffing</th>
                <th className="px-3 py-2.5 font-medium">Productivity</th>
                <th className="px-3 py-2.5 text-right font-medium">TRIR</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {sites.map((s) => {
                const st = STATUS[s.status]
                return (
                  <tr key={s.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <input value={s.name} onChange={(e) => set(s.id, { name: e.target.value })} className="w-44 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-amber-500/40" />
                      <div className="text-[10px] text-slate-600">{s.id}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1 data-mono">
                        <InlineNum value={s.workersActual} onChange={(v) => set(s.id, { workersActual: Math.max(0, v) })} tone={s.workersActual >= s.workersPlanned ? 'good' : 'warn'} />
                        <span className="text-slate-600">/</span>
                        <InlineNum value={s.workersPlanned} onChange={(v) => set(s.id, { workersPlanned: Math.max(0, v) })} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1 data-mono">
                        <InlineNum value={s.outputActual} onChange={(v) => set(s.id, { outputActual: Math.max(0, v) })} tone={s.outputActual >= s.outputPlanned ? 'good' : 'warn'} />
                        <span className="text-slate-600">/</span>
                        <InlineNum value={s.outputPlanned} onChange={(v) => set(s.id, { outputPlanned: Math.max(0, v) })} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <InlineNum value={s.hoursWorked} onChange={(v) => set(s.id, { hoursWorked: Math.max(0, v) })} fmt={(v) => formatNumber(v, { compact: true })} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <InlineNum value={s.recordables} onChange={(v) => set(s.id, { recordables: Math.max(0, v) })} tone={s.recordables > 5 ? 'bad' : undefined} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <InlineNum value={s.nearMisses} onChange={(v) => set(s.id, { nearMisses: Math.max(0, v) })} />
                    </td>
                    <td className={cn('px-3 py-2 text-right data-mono', s.staffing >= 95 ? 'text-emerald-300' : s.staffing >= 85 ? 'text-amber-300' : 'text-rose-300')}>{s.staffing}%</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProgressBar value={s.productivity} accent={s.productivity >= 95 ? 'emerald' : s.productivity >= 85 ? 'amber' : 'rose'} height="sm" className="w-16" />
                        <span className="w-10 text-sm font-semibold text-slate-100 data-mono">{s.productivity}%</span>
                      </div>
                    </td>
                    <td className={cn('px-3 py-2 text-right data-mono', s.trir <= 2.5 ? 'text-emerald-300' : s.trir <= 4 ? 'text-amber-300' : 'text-rose-300')}>{s.trir.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeRow(s.id)} aria-label={`Remove ${s.name}`} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* charts driven by the live metrics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={ShieldCheck} accent={ACCENT_NAME} title="Productivity vs safety" subtitle="Each site — top-right (productive + safe) is healthy" />
          <div className="border-t border-edge/50 p-5">
            <ScatterViz data={frontier} xKey="x" yKey="y" xName="Productivity %" yName="Safety score" height={300} accent="amber" />
            <p className="mt-2 text-xs text-slate-500">Sites in the lower-left are both behind plan and carrying elevated incident rates — prioritize them.</p>
          </div>
        </Card>
        <Card>
          <CardHeader icon={TrendingUp} accent={ACCENT_NAME} title="Output — planned vs actual" subtitle="Installed quantities per site" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={outputData}
              xKey="name"
              layout="vertical"
              height={300}
              series={[{ key: 'Planned', name: 'Planned', accent: 'sky' }, { key: 'Actual', name: 'Actual', accent: 'amber' }]}
              valueFormatter={(v) => formatNumber(v)}
            />
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent={ACCENT_NAME} title="Field read-out" subtitle="Computed from your current site data" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{fieldNarrative(p)}</p>
          {worst.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {worst.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {s.name} · {s.productivity}% · TRIR {s.trir.toFixed(2)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* A compact inline-editable number — shows formatted value, edits the raw number. */
function InlineNum({ value, onChange, fmt, tone }: { value: number; onChange: (v: number) => void; fmt?: (v: number) => string; tone?: 'good' | 'warn' | 'bad' }) {
  const [editing, setEditing] = useState(false)
  const toneClass = tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-300'
  return editing ? (
    <input
      autoFocus
      type="number"
      defaultValue={value}
      onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
      className="w-20 rounded border border-amber-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
    />
  ) : (
    <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', toneClass)} title="Click to edit">
      {fmt ? fmt(value) : formatNumber(value)}
    </button>
  )
}
