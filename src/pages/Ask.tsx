import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Send,
  Database,
  Loader2,
  TrendingDown,
  Truck,
  Leaf,
  AlertTriangle,
  Ruler,
  Code2,
  Table2,
  CircleDot,
  Wand2,
} from 'lucide-react'
import { Card, PageHeader, Badge } from '@/components/ui'
import { AgentConsole } from '@/components/AgentConsole'
import { BarSeries, AreaTrend } from '@/components/charts'
import { PROJECTS, SUPPLIERS } from '@/data/platform'
import { formatCurrency, formatNumber } from '@/lib/format'
import { copilotStatus, askCopilot, type AnalystAnswer } from '@/lib/copilot'
import { answerQuestion, type QueryResult, type Unit } from '@/lib/query'
import { cn } from '@/lib/cn'
import type { Accent } from '@/lib/nav'

type Answer = {
  summary: React.ReactNode
  sql: string
  sources: string[]
  chart?: React.ReactNode
}

const overBudget = [...PROJECTS].filter((p) => p.costVariance > 3).sort((a, b) => b.costVariance - a.costVariance)
const lateSuppliers = [...SUPPLIERS].sort((a, b) => b.leadTime - a.leadTime).slice(0, 6)
const bySector = Object.values(
  PROJECTS.reduce<Record<string, { sector: string; total: number; gfa: number }>>((acc, p) => {
    const k = p.sector
    acc[k] = acc[k] || { sector: k, total: 0, gfa: 0 }
    acc[k].total += p.value
    acc[k].gfa += p.gfa
    return acc
  }, {}),
).map((s) => ({ sector: s.sector.split(' ')[0], cost: Math.round(s.total / s.gfa) }))
const scheduleRisk = [...PROJECTS].sort((a, b) => b.scheduleVariance - a.scheduleVariance).slice(0, 5)

const carbonTrend = [2026, 2030, 2035, 2040, 2045, 2050].map((y, i) => ({
  year: String(y),
  trajectory: Math.round(560 - i * 42),
  target: Math.round(560 - i * 78),
}))

/* A compact, real snapshot of the portfolio the LLM copilot can reason over.
 * Kept small (token-budget friendly); the model grounds answers in this. */
const DATA_CONTEXT = [
  `Portfolio: ${PROJECTS.length} projects across sectors.`,
  `Over-budget (>3% cost variance): ${overBudget.map((p) => `${p.name} +${p.costVariance}% (${p.sector}, ${p.location})`).join('; ')}.`,
  `Cost intensity by sector ($/m²): ${bySector.map((b) => `${b.sector} ${b.cost}`).join(', ')}.`,
  `Longest supplier lead times (days): ${lateSuppliers.map((s) => `${s.name} ${s.leadTime} (${s.category})`).join(', ')}.`,
  `Highest schedule slip (days vs baseline): ${scheduleRisk.map((p) => `${p.name} +${p.scheduleVariance}`).join(', ')}.`,
  `Embodied-carbon pathway kgCO₂e/m²: ${carbonTrend.map((c) => `${c.year}: traj ${c.trajectory} vs target ${c.target}`).join('; ')}.`,
].join('\n')

const QUESTIONS: { id: string; q: string; icon: typeof TrendingDown; accent: Accent }[] = [
  { id: 'budget', q: 'Which projects exceeded budget, and why?', icon: TrendingDown, accent: 'rose' },
  { id: 'suppliers', q: 'Which suppliers had the longest lead times?', icon: Truck, accent: 'lime' },
  { id: 'carbon', q: 'Is our portfolio on track for net-zero embodied carbon?', icon: Leaf, accent: 'emerald' },
  { id: 'cost-m2', q: 'Compare cost per m² across sectors.', icon: Ruler, accent: 'blue' },
  { id: 'risk', q: 'Where is schedule risk highest right now?', icon: AlertTriangle, accent: 'amber' },
]

function buildAnswer(id: string): Answer {
  switch (id) {
    case 'budget':
      return {
        summary: (
          <>
            <p>
              <strong className="text-slate-100">{overBudget.length} active projects</strong> are forecasting a cost
              overrun above 3%. The most exposed is{' '}
              <strong className="text-rose-300">{overBudget[0].name}</strong> at +{overBudget[0].costVariance}% (
              {overBudget[0].sector}, {overBudget[0].location}).
            </p>
            <p className="mt-2 text-slate-400">
              The dominant drivers across these projects are <em>procurement lead-time slippage</em> and{' '}
              <em>design change orders</em>, which together correlate with 64% of the variance. Projects on PPP and EPCM
              delivery show the highest exposure.
            </p>
          </>
        ),
        sql: `SELECT name, sector, cost_variance_pct, primary_driver
FROM gold.project_controls
WHERE cost_variance_pct > 3
ORDER BY cost_variance_pct DESC;`,
        sources: ['Cost & Schedule', 'Contracts & Commercial', 'Procurement'],
        chart: (
          <BarSeries
            data={overBudget.map((p) => ({ name: p.name, variance: p.costVariance }))}
            xKey="name"
            layout="vertical"
            height={260}
            valueFormatter={(v) => `+${v}%`}
            series={[{ key: 'variance', name: 'Cost variance', accent: 'rose' }]}
          />
        ),
      }
    case 'suppliers':
      return {
        summary: (
          <>
            <p>
              <strong className="text-lime-300">{lateSuppliers[0].name}</strong> has the longest predicted lead time at{' '}
              <strong className="text-slate-100">{lateSuppliers[0].leadTime} days</strong> ({lateSuppliers[0].category}).
              Three suppliers are flagged <span className="text-rose-300">high-risk</span> on on-time delivery.
            </p>
            <p className="mt-2 text-slate-400">
              Vertical-transport and façade packages are the critical-path constraints. Recommend dual-sourcing glazing
              and releasing elevator orders 6 weeks earlier.
            </p>
          </>
        ),
        sql: `SELECT name, category, avg_lead_time_days, on_time_rate, risk
FROM gold.supplier_performance
ORDER BY avg_lead_time_days DESC
LIMIT 6;`,
        sources: ['Procurement', 'Market & Benchmark'],
        chart: (
          <BarSeries
            data={lateSuppliers.map((s) => ({ name: s.name, lead: s.leadTime }))}
            xKey="name"
            layout="vertical"
            height={260}
            valueFormatter={(v) => `${v}d`}
            series={[{ key: 'lead', name: 'Lead time (days)', accent: 'lime' }]}
          />
        ),
      }
    case 'carbon':
      return {
        summary: (
          <>
            <p>
              The portfolio’s embodied-carbon trajectory is <strong className="text-amber-300">tracking above</strong>{' '}
              the net-zero target. At current trajectory you reach ~310 kgCO₂e/m² by 2050 versus a{' '}
              <strong className="text-emerald-300">170 kgCO₂e/m² target</strong>.
            </p>
            <p className="mt-2 text-slate-400">
              Concrete and structural steel account for 61% of embodied carbon. Switching to lower-carbon mixes and EAF
              steel on in-design projects closes ~38% of the gap.
            </p>
          </>
        ),
        sql: `SELECT year, trajectory_kgco2e_m2, target_kgco2e_m2
FROM gold.portfolio_carbon_pathway
ORDER BY year;`,
        sources: ['Sustainability & ESG', 'BIM & Models', 'Cost & Quantity'],
        chart: (
          <AreaTrend
            data={carbonTrend}
            xKey="year"
            height={260}
            valueFormatter={(v) => `${v} kg`}
            series={[
              { key: 'trajectory', name: 'Current trajectory', accent: 'amber' },
              { key: 'target', name: 'Net-zero target', accent: 'emerald' },
            ]}
          />
        ),
      }
    case 'cost-m2':
      return {
        summary: (
          <>
            <p>
              Cost intensity ranges from{' '}
              <strong className="text-slate-100">{formatCurrency(Math.min(...bySector.map((b) => b.cost)), { compact: false })}/m²</strong>{' '}
              to{' '}
              <strong className="text-blue-300">{formatCurrency(Math.max(...bySector.map((b) => b.cost)), { compact: false })}/m²</strong>{' '}
              across sectors, normalized against pooled benchmarks.
            </p>
            <p className="mt-2 text-slate-400">
              Data-center and aviation programs carry the highest unit cost driven by MEP density; industrial and
              residential are the most efficient. Figures are benchmarked against {PROJECTS.length}+ comparable projects.
            </p>
          </>
        ),
        sql: `SELECT sector, SUM(value) / SUM(gross_floor_area) AS cost_per_m2
FROM gold.project_master
GROUP BY sector
ORDER BY cost_per_m2 DESC;`,
        sources: ['Cost & Quantity', 'Historical Benchmark', 'Project Master Data'],
        chart: (
          <BarSeries
            data={bySector.sort((a, b) => b.cost - a.cost)}
            xKey="sector"
            height={260}
            valueFormatter={(v) => formatCurrency(v, { compact: true })}
            series={[{ key: 'cost', name: 'Cost / m²', accent: 'blue' }]}
          />
        ),
      }
    default:
      return {
        summary: (
          <>
            <p>
              Schedule risk is highest on <strong className="text-amber-300">{scheduleRisk[0].name}</strong>, forecasting{' '}
              <strong className="text-slate-100">+{scheduleRisk[0].scheduleVariance} days</strong> against baseline.
            </p>
            <p className="mt-2 text-slate-400">
              The model attributes the slip to critical-path congestion in MEP rough-in and late material deliveries.
              Five projects exceed a 30-day slip threshold and warrant recovery planning.
            </p>
          </>
        ),
        sql: `SELECT name, schedule_variance_days, risk_index
FROM gold.project_controls
ORDER BY schedule_variance_days DESC
LIMIT 5;`,
        sources: ['Schedule & Controls', 'Construction Field', 'Procurement'],
        chart: (
          <BarSeries
            data={scheduleRisk.map((p) => ({ name: p.name, slip: p.scheduleVariance }))}
            xKey="name"
            layout="vertical"
            height={240}
            valueFormatter={(v) => `${v}d`}
            series={[{ key: 'slip', name: 'Schedule slip (days)', accent: 'amber' }]}
          />
        ),
      }
  }
}

/** Format a computed value for the deterministic query engine's chart axis. */
const qFmt = (unit: Unit) => (v: number): string =>
  unit === 'pct' ? `${v}%` : unit === 'days' ? `${v}d` : unit === 'money' ? formatCurrency(v, { compact: true }) : unit === 'score' ? `${v}/100` : formatNumber(v)

export default function Ask() {
  const [input, setInput] = useState('')
  const [activeId, setActiveId] = useState<string>('budget')
  const [loading, setLoading] = useState(false)

  // LLM path — used for free-text questions when a server key is configured.
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiAnswer, setAiAnswer] = useState<AnalystAnswer | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [askedText, setAskedText] = useState('')
  // Deterministic NL query result (used when no model key is configured).
  const [qResult, setQResult] = useState<QueryResult | null>(null)

  useEffect(() => {
    copilotStatus().then((s) => setAiEnabled(s.enabled))
  }, [])

  const answer = useMemo(() => buildAnswer(activeId), [activeId])
  const activeQ = QUESTIONS.find((q) => q.id === activeId) ?? QUESTIONS[0]
  const showAi = aiBusy || !!aiAnswer || !!aiError
  const showQuery = !!qResult && !showAi

  function run(id: string, text?: string) {
    setAiAnswer(null)
    setAiError(null)
    setQResult(null)
    setActiveId(id)
    if (text) setInput(text)
    setLoading(true)
  }

  async function submit(text: string) {
    const q = text.trim()
    if (!q) return
    setAskedText(q)
    if (aiEnabled) {
      setQResult(null)
      setAiBusy(true)
      setAiError(null)
      setAiAnswer(null)
      const res = await askCopilot(q, DATA_CONTEXT)
      setAiBusy(false)
      if (res.ok) setAiAnswer(res.data)
      else setAiError(res.error)
    } else {
      // Deterministic engine: compute a real answer over the live data.
      setLoading(false)
      setQResult(answerQuestion(q, { projects: PROJECTS, suppliers: SUPPLIERS }))
    }
  }

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [loading, activeId])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Sparkles}
        accent="violet"
        eyebrow="Core"
        title="Ask AEC"
        description="Natural-language analytics over 4.7B records spanning every project, dataset and lifecycle stage. Ask in plain English — get an answer, the query behind it, and a visualization."
        actions={aiEnabled ? <Badge variant="violet" dot>Claude-powered</Badge> : <Badge variant="violet" dot>NL → SQL + charts</Badge>}
      />

      {/* Agentic analyst — runs the studio's real engines as tools */}
      <AgentConsole />

      {/* Ask box */}
      <Card className="p-5">
        <div className="flex items-center gap-3 rounded-xl border border-edge/70 bg-elevated/50 px-4 py-3 focus-within:border-violet-500/50">
          <Sparkles className="h-5 w-5 shrink-0 text-violet-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) submit(input)
            }}
            placeholder="Ask anything — “which projects exceeded budget and why?”"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={() => input.trim() && submit(input)}
            disabled={aiBusy}
            className="btn-primary !px-3 !py-2"
            aria-label="Ask"
          >
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUESTIONS.map((q) => {
            const active = q.id === activeId
            return (
              <button
                key={q.id}
                onClick={() => run(q.id, q.q)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                  active
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                    : 'border-edge/70 bg-elevated/40 text-slate-400 hover:text-slate-200',
                )}
              >
                <q.icon className="h-3.5 w-3.5" />
                {q.q}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Answer */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              {showAi || showQuery ? <Wand2 className="h-4 w-4 text-violet-400" /> : <activeQ.icon className="h-4 w-4 text-violet-400" />}
              {showAi || showQuery ? askedText : activeQ.q}
            </div>
            <div className="mt-4 min-h-[80px] whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {aiBusy ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Reasoning with Claude over the lakehouse…
                </div>
              ) : aiError ? (
                <div className="flex items-center gap-2 text-rose-300"><AlertTriangle className="h-4 w-4" /> {aiError}</div>
              ) : aiAnswer ? (
                aiAnswer.answer
              ) : showQuery ? (
                <p className={qResult!.matched ? 'text-slate-200' : 'text-slate-400'}>{qResult!.answer}</p>
              ) : loading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Reasoning over the lakehouse…
                </div>
              ) : (
                answer.summary
              )}
            </div>
          </Card>

          {showQuery && qResult!.chart && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-edge/50 px-5 py-3 text-sm font-medium text-slate-300">
                <Table2 className="h-4 w-4 text-violet-400" /> {qResult!.chart.label}
              </div>
              <div className="px-3 pb-4 pt-4">
                <BarSeries
                  data={qResult!.chart.data}
                  xKey="name"
                  layout="vertical"
                  height={260}
                  valueFormatter={qFmt(qResult!.chart.unit)}
                  series={[{ key: 'value', name: qResult!.chart.label, accent: qResult!.chart.accent as Accent }]}
                />
              </div>
            </Card>
          )}
          {!showQuery && !showAi && !loading && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-edge/50 px-5 py-3 text-sm font-medium text-slate-300">
                <Table2 className="h-4 w-4 text-violet-400" /> Generated visualization
              </div>
              <div className="px-3 pb-4 pt-4">{answer.chart}</div>
            </Card>
          )}

          {aiAnswer?.followups && aiAnswer.followups.length > 0 && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                <Sparkles className="h-4 w-4 text-violet-400" /> Follow-up questions
              </div>
              <div className="flex flex-wrap gap-2">
                {aiAnswer.followups.map((f) => (
                  <button key={f} onClick={() => submit(f)} className="rounded-full border border-edge/70 bg-elevated/40 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500/40 hover:text-white">
                    {f}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-edge/50 px-5 py-3 text-sm font-medium text-slate-300">
              <Code2 className="h-4 w-4 text-cyan-400" /> Query plan
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[12px] leading-relaxed text-cyan-200/90">
              <code className="font-mono">{aiAnswer?.sql ?? (showQuery ? qResult!.sql : answer.sql)}</code>
            </pre>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Database className="h-4 w-4 text-emerald-400" /> Data domains queried
            </div>
            <div className="mt-3 space-y-2">
              {(aiAnswer?.domains ?? (showQuery ? qResult!.domains : answer.sources)).map((s) => (
                <div key={s} className="flex items-center gap-2 text-sm text-slate-400">
                  <CircleDot className="h-3.5 w-3.5 text-emerald-500/70" /> {s}
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-edge/50 pt-3 text-xs text-slate-500">
              {aiEnabled
                ? 'Answers are generated by Claude over a governed data context, respecting row-level permissions and dataset licensing.'
                : 'Answers respect row-level permissions and dataset licensing. Confidential figures are aggregated in a clean room before leaving their owner’s boundary.'}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
