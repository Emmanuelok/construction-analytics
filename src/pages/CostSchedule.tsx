import { useMemo, useState } from 'react'
import {
  CalendarClock,
  Sparkles,
  Wallet,
  Gauge,
  AlertTriangle,
  Timer,
  TrendingUp,
  RotateCcw,
  Plus,
  Trash2,
  Banknote,
} from 'lucide-react'
import { Card, CardHeader, Badge, StatTile, PageHeader } from '@/components/ui'
import { BarSeries, ScatterViz } from '@/components/charts'
import { PROJECTS } from '@/data/platform'
import { computeEvm, portfolioEvm, evmNarrative, formatMoney, type Evm } from '@/lib/evm'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ScrollableTable } from '@/components/ScrollableTable'
import type { KPI } from '@/lib/scenarios'
import { ExportMenu } from '@/components/ExportMenu'
import { CollabBar } from '@/components/CollabBar'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'

/* An editable row in the controls workbench — the fields that drive EVM. */
type Row = { id: string; name: string; bac: number; progress: number; costVar: number; slip: number }

const seed = (): Row[] =>
  PROJECTS.map((p) => ({ id: p.id, name: p.name, bac: p.value, progress: p.progress, costVar: p.costVariance, slip: p.scheduleVariance }))

const HEALTH: Record<Evm['health'], { label: string; variant: 'success' | 'warn' | 'danger' }> = {
  'on-track': { label: 'On track', variant: 'success' },
  watch: { label: 'Watch', variant: 'warn' },
  'at-risk': { label: 'At risk', variant: 'danger' },
}

export default function CostSchedule() {
  const [rows, setRows] = useState<Row[]>(seed)
  const [edited, setEdited] = useState(false)
  const { scenarios, save, remove } = useScenarios('cost-schedule')

  const set = (id: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setEdited(true)
  }
  const addRow = () => {
    setRows((rs) => [...rs, { id: `PRJ-${Math.floor(1000 + Math.random() * 9000)}`, name: 'New project', bac: 100_000_000, progress: 0, costVar: 0, slip: 0 }])
    setEdited(true)
  }
  const removeRow = (id: string) => { setRows((rs) => rs.filter((r) => r.id !== id)); setEdited(true) }
  const reset = () => { setRows(seed()); setEdited(false) }

  // EVM per project + portfolio — recomputed live from the editable rows.
  const evms = useMemo(
    () => rows.map((r) => ({ row: r, evm: computeEvm({ bac: r.bac, progressPct: r.progress, costVariancePct: r.costVar, scheduleSlipDays: r.slip, plannedDurationDays: 1000 }) })),
    [rows],
  )
  const portfolio = useMemo(
    () => portfolioEvm(rows.map((r) => ({ bac: r.bac, progressPct: r.progress, costVariancePct: r.costVar, scheduleSlipDays: r.slip, plannedDurationDays: 1000 }))),
    [rows],
  )

  const atRisk = evms.filter((e) => e.evm.health === 'at-risk')
  const worst = [...evms].sort((a, b) => a.evm.vac - b.evm.vac)[0]

  const summary: KPI[] = [
    { label: 'Portfolio CPI', value: portfolio.cpi },
    { label: 'Portfolio SPI', value: portfolio.spi },
    { label: 'Forecast EAC', value: portfolio.eac, unit: '$' },
    { label: 'VAC', value: portfolio.vac, unit: '$' },
    { label: 'At-risk projects', value: atRisk.length },
  ]
  const reportTable: ReportTable = {
    title: 'Project controls',
    columns: ['Project', 'Budget', '% Complete', 'Cost var %', 'Slip (d)', 'CPI', 'SPI', 'EAC', 'Health'],
    rows: evms.map(({ row, evm }) => [row.name, formatMoney(row.bac), `${row.progress}%`, `${row.costVar}%`, row.slip, evm.cpi.toFixed(2), evm.spi.toFixed(2), formatMoney(evm.eac), HEALTH[evm.health].label]),
  }
  const reportSpec: ReportSpec = {
    title: 'Cost & Schedule',
    subtitle: `Earned-value brief · ${rows.length} projects`,
    module: 'cost-schedule',
    kpis: summary.map(kpiToItem),
    narrative: `Across ${rows.length} projects the portfolio CPI is ${portfolio.cpi.toFixed(2)} and SPI ${portfolio.spi.toFixed(2)}, forecasting ${formatMoney(portfolio.eac)} at completion against a ${formatMoney(portfolio.bac)} budget — ${portfolio.vac < 0 ? `a ${formatMoney(Math.abs(portfolio.vac))} overrun` : `a ${formatMoney(portfolio.vac)} saving`}. ${atRisk.length} project${atRisk.length === 1 ? '' : 's'} at risk.`,
    table: reportTable,
  }

  const cpiSpiData = evms.map((e) => ({ x: e.evm.spi, y: e.evm.cpi, name: e.row.name }))
  const eacData = [...evms]
    .sort((a, b) => b.evm.eac - a.evm.eac)
    .slice(0, 8)
    .map((e) => ({ name: e.row.name.length > 16 ? e.row.name.slice(0, 15) + '…' : e.row.name, BAC: Math.round(e.row.bac / 1e6), EAC: Math.round(e.evm.eac / 1e6) }))

  return (
    <div className="space-y-8">
      <PageHeader
        icon={CalendarClock}
        accent="rose"
        eyebrow="Intelligence"
        title="Cost & Schedule"
        description="A live Earned Value workbench. Edit any project's budget, progress, cost variance or schedule slip — CPI, SPI, EAC and the portfolio forecast recompute instantly. Real project-controls math, not a static dashboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={HEALTH[portfolio.health].variant} dot>
              Portfolio {HEALTH[portfolio.health].label}
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <ScenarioBar
            accent="rose"
            scenarios={scenarios}
            onSave={(name) => save(name, { rows }, summary)}
            onLoad={(s) => { const d = s.data as { rows?: Row[] }; if (d.rows) { setRows(d.rows); setEdited(true) } }}
            onRemove={remove}
          />
        </div>
        <ExportMenu accent="rose" spec={reportSpec} csv={reportTable} />
      </div>

      <CollabBar subject="cost-schedule" accent="rose" />

      {/* portfolio EVM KPIs — recompute as you edit */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Budget (BAC)" value={formatMoney(portfolio.bac)} icon={Wallet} accent="blue" sub={`${rows.length} projects`} />
        <StatTile label="Forecast (EAC)" value={formatMoney(portfolio.eac)} icon={Banknote} accent={portfolio.vac < 0 ? 'rose' : 'emerald'} sub={`VAC ${formatMoney(portfolio.vac)}`} />
        <StatTile label="Cost index (CPI)" value={portfolio.cpi.toFixed(2)} icon={Gauge} accent={portfolio.cpi >= 1 ? 'emerald' : 'rose'} sub={portfolio.cpi >= 1 ? 'under budget' : 'over budget'} />
        <StatTile label="Schedule index (SPI)" value={portfolio.spi.toFixed(2)} icon={Timer} accent={portfolio.spi >= 1 ? 'emerald' : 'amber'} sub={portfolio.spi >= 1 ? 'ahead' : 'behind'} />
        <StatTile label="At-risk projects" value={String(atRisk.length)} icon={AlertTriangle} accent="rose" sub="CPI or SPI < 0.9" />
      </div>

      {/* editable EVM table */}
      <Card>
        <CardHeader
          icon={CalendarClock}
          accent="rose"
          title="Project controls — editable"
          subtitle="Click any budget, % complete, cost variance % or slip to edit; metrics update live"
          action={
            <button onClick={addRow} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add project
            </button>
          }
        />
        <ScrollableTable label="Project controls" className="border-t border-edge/50">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 text-right font-medium">Budget (BAC)</th>
                <th className="px-3 py-2.5 text-right font-medium">% Complete</th>
                <th className="px-3 py-2.5 text-right font-medium">Cost var %</th>
                <th className="px-3 py-2.5 text-right font-medium">Slip (d)</th>
                <th className="px-3 py-2.5 text-right font-medium">CPI</th>
                <th className="px-3 py-2.5 text-right font-medium">SPI</th>
                <th className="px-3 py-2.5 text-right font-medium">EAC</th>
                <th className="px-3 py-2.5 text-right font-medium">VAC</th>
                <th className="px-3 py-2.5 text-center font-medium">Health</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {evms.map(({ row, evm }) => {
                const h = HEALTH[evm.health]
                return (
                  <tr key={row.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <input value={row.name} onChange={(e) => set(row.id, { name: e.target.value })} className="w-40 truncate rounded bg-transparent font-medium text-slate-200 focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-rose-500/40" />
                      <div className="text-[10px] text-slate-600">{row.id}</div>
                    </td>
                    <NumCell value={row.bac} onChange={(v) => set(row.id, { bac: v })} fmt={(v) => formatMoney(v)} step={1e6} />
                    <NumCell value={row.progress} onChange={(v) => set(row.id, { progress: Math.max(0, Math.min(100, v)) })} fmt={(v) => `${v}%`} />
                    <NumCell value={row.costVar} onChange={(v) => set(row.id, { costVar: v })} fmt={(v) => `${v > 0 ? '+' : ''}${v}%`} />
                    <NumCell value={row.slip} onChange={(v) => set(row.id, { slip: v })} fmt={(v) => `${v}`} />
                    <td className={cn('px-3 py-2 text-right data-mono', evm.cpi >= 1 ? 'text-emerald-300' : 'text-rose-300')}>{evm.cpi.toFixed(2)}</td>
                    <td className={cn('px-3 py-2 text-right data-mono', evm.spi >= 1 ? 'text-emerald-300' : 'text-amber-300')}>{evm.spi.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right data-mono text-slate-300">{formatMoney(evm.eac)}</td>
                    <td className={cn('px-3 py-2 text-right data-mono', evm.vac < 0 ? 'text-rose-300' : 'text-emerald-300')}>{formatMoney(evm.vac)}</td>
                    <td className="px-3 py-2 text-center"><Badge variant={h.variant} dot>{h.label}</Badge></td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => removeRow(row.id)} aria-label={`Remove ${row.name}`} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* charts driven by the live EVM */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Gauge} accent="rose" title="CPI vs SPI" subtitle="Each project — top-right quadrant is healthy (both ≥ 1)" />
          <div className="border-t border-edge/50 p-5">
            <ScatterViz data={cpiSpiData} xKey="x" yKey="y" xName="SPI" yName="CPI" height={300} accent="rose" />
            <p className="mt-2 text-xs text-slate-500">Points below or left of (1, 1) are over budget or behind schedule.</p>
          </div>
        </Card>
        <Card>
          <CardHeader icon={TrendingUp} accent="rose" title="Budget vs forecast at completion" subtitle="BAC vs EAC ($M) — the gap is the forecast overrun" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries
              data={eacData}
              xKey="name"
              layout="vertical"
              height={300}
              series={[{ key: 'BAC', name: 'Budget', accent: 'blue' }, { key: 'EAC', name: 'Forecast', accent: 'rose' }]}
              valueFormatter={(v) => `$${formatNumber(v)}M`}
            />
          </div>
        </Card>
      </div>

      {/* live insight */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-rose-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent="rose" title="Controls read-out" subtitle="Computed from your current numbers" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">
            Across {rows.length} projects, the portfolio CPI is{' '}
            <span className={cn('font-semibold', portfolio.cpi >= 1 ? 'text-emerald-300' : 'text-rose-300')}>{portfolio.cpi.toFixed(2)}</span> and SPI{' '}
            <span className={cn('font-semibold', portfolio.spi >= 1 ? 'text-emerald-300' : 'text-amber-300')}>{portfolio.spi.toFixed(2)}</span>, forecasting{' '}
            <span className="font-semibold text-slate-100">{formatMoney(portfolio.eac)}</span> at completion against a{' '}
            <span className="font-semibold text-slate-100">{formatMoney(portfolio.bac)}</span> budget
            {portfolio.vac < 0 ? <> — a <span className="text-rose-300">{formatMoney(Math.abs(portfolio.vac))} overrun</span>.</> : portfolio.vac > 0 ? <> — a <span className="text-emerald-300">{formatMoney(portfolio.vac)} saving</span>.</> : '.'}
          </p>
          {worst && worst.evm.vac < 0 && (
            <p className="text-sm leading-relaxed text-slate-400">{evmNarrative(worst.row.name, worst.evm)}</p>
          )}
          {atRisk.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {atRisk.map((e) => (
                <span key={e.row.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {e.row.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

/* An inline-editable numeric cell that shows a formatted value, edits the raw number. */
function NumCell({ value, onChange, fmt, step = 1 }: { value: number; onChange: (v: number) => void; fmt: (v: number) => string; step?: number }) {
  const [editing, setEditing] = useState(false)
  return (
    <td className="px-3 py-2 text-right">
      {editing ? (
        <input
          autoFocus
          type="number"
          step={step}
          defaultValue={value}
          onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
          className="w-24 rounded border border-rose-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="data-mono text-slate-300 hover:text-white hover:underline" title="Click to edit">
          {fmt(value)}
        </button>
      )}
    </td>
  )
}
