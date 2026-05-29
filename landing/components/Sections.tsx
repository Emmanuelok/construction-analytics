'use client'

import {
  Store,
  Microscope,
  FolderKanban,
  Boxes,
  Users,
  Sparkles,
  GitCompare,
  ShieldCheck,
  Database,
  Leaf,
  TrendingDown,
  ArrowRight,
  Lightbulb,
  Lock,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from './motion'

/* ------------------------------------------------------------------ stats -- */
const STATS: { value: string; label: string }[] = [
  { value: '$1.6T', label: 'lost to waste in construction yearly' },
  { value: '95.5%', label: 'of project data goes uncaptured' },
  { value: '4.7B', label: 'records queryable across the lakehouse' },
  { value: '24', label: 'AEC data domains, one schema' },
]

/* ----------------------------------------------------- marketplace ticker -- */
const TICKER: { name: string; cat: string; rows: string; price: string; up: boolean }[] = [
  { name: 'Global Cost Benchmarks', cat: 'Cost', rows: '92K', price: '$4,800', up: true },
  { name: 'EPD & Embodied-Carbon Factors', cat: 'Sustainability', rows: '410K', price: '$2,900', up: false },
  { name: 'Schedule Outcomes', cat: 'Controls', rows: '38K', price: '$6,200', up: true },
  { name: 'Supplier Performance Index', cat: 'Procurement', rows: '64K', price: '$3,800', up: true },
  { name: 'IFC Object Library', cat: 'BIM', rows: '2.1M', price: 'Free', up: true },
  { name: 'RFI → Response Pairs', cat: 'AI Training', rows: '1.28M', price: '$5,400', up: false },
  { name: 'Defect & NCR Annotations', cat: 'Quality', rows: '760K', price: '$4,100', up: true },
  { name: 'Building Operations Telemetry', cat: 'Operations', rows: '920M', price: '$4,400', up: true },
]

export function Ticker() {
  const row = [...TICKER, ...TICKER] // duplicate for seamless marquee
  return (
    <section aria-label="Live marketplace" className="overflow-hidden border-b border-edge/50 bg-base/60 py-3">
      <div className="relative flex">
        <div className="flex shrink-0 animate-[ticker_38s_linear_infinite] gap-3 pr-3">
          {row.map((t, i) => (
            <div key={i} className="flex shrink-0 items-center gap-2.5 rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-xs">
              <Store className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-medium text-slate-200">{t.name}</span>
              <span className="text-slate-500">{t.cat}</span>
              <span className="font-mono text-slate-500">{t.rows} rows</span>
              <span className={`font-mono font-semibold ${t.price === 'Free' ? 'text-emerald-400' : 'text-slate-200'}`}>{t.price}</span>
              <span className={t.up ? 'text-emerald-400' : 'text-rose-400'}>{t.up ? '▲' : '▼'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Stats() {
  return (
    <section className="border-y border-edge/50 bg-panel/40">
      <Stagger className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 py-10 sm:grid-cols-4">
        {STATS.map((s) => (
          <StaggerItem key={s.label} className="px-4 text-center">
            <div className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{s.value}</div>
            <div className="mt-1 text-xs leading-snug text-slate-500">{s.label}</div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ---------------------------------------------------------------- problem -- */
export function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">The problem</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          The world&apos;s biggest industry runs on data it never keeps.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
          Every project generates cost, schedule, BIM, sustainability and field data — then scatters it across PDFs,
          spreadsheets and dead drives. The next project starts from zero. We turn that exhaust into a living, governed,
          queryable asset.
        </p>
      </Reveal>
    </section>
  )
}

/* ---------------------------------------------------------------- pillars -- */
type Pillar = { icon: LucideIcon; title: string; body: string; tint: string }
const PILLARS: Pillar[] = [
  { icon: Store, title: 'Data Center', body: 'A neutral marketplace to browse, preview, license and download standardized AEC datasets — with multi-format export and usage guidance.', tint: 'text-emerald-400' },
  { icon: Microscope, title: 'Analysis Studio', body: 'Bring any dataset, profile it, and a real statistical engine computes ranked findings — correlations, trends, segment gaps, outliers.', tint: 'text-violet-400' },
  { icon: FolderKanban, title: 'Workspaces', body: 'Frame a problem, assemble data, test hypotheses and ship — with an AI copilot suggesting datasets, hypotheses and next steps.', tint: 'text-brand-400' },
  { icon: Boxes, title: 'BIM Intelligence', body: 'Parse real IFC models in the browser — entity counts, discipline breakdown and quantity takeoff from IfcElementQuantity.', tint: 'text-sky-400' },
  { icon: Users, title: 'Teams', body: 'Invite members, share workspaces, and follow a live activity feed as the team validates findings and makes decisions.', tint: 'text-cyan-400' },
  { icon: Sparkles, title: 'Ask AEC', body: 'Natural-language analytics over the lakehouse — answers, the query plan behind them, and a visualization, Claude-powered.', tint: 'text-fuchsia-400' },
]

export function Pillars() {
  return (
    <section id="pillars" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">The studio</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything is a module.</h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
          One coherent product spanning the marketplace, analytics, BIM and collaboration — not a pile of disconnected tools.
        </p>
      </Reveal>
      <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p) => (
          <StaggerItem key={p.title}>
            <div className="card group h-full p-6 transition-colors hover:border-brand-500/40">
              <span className={`grid h-11 w-11 place-items-center rounded-xl bg-elevated/60 ring-1 ring-edge/70 ${p.tint}`}>
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* --------------------------------------------------- intelligence feature -- */
export function Intelligence() {
  const findings = [
    { icon: GitCompare, label: 'Correlation', stat: 'r = 0.82', text: 'cost_total rises with gfa_m2', tint: 'text-emerald-400' },
    { icon: TrendingDown, label: 'Trend', stat: 'R² = 0.74', text: 'embodied carbon declining over time', tint: 'text-sky-400' },
    { icon: Layers, label: 'Segment gap', stat: '1.8σ', text: 'Healthcare leads on cost/m²', tint: 'text-violet-400' },
  ]
  return (
    <section className="border-y border-edge/50 bg-panel/40">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">Real intelligence</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            It reads your data and tells you what&apos;s true.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-400">
            A dependency-free statistical engine computes genuine findings on any dataset — Pearson correlations,
            regression trends, standardized segment gaps and outliers — ranked by significance, each with its supporting
            statistic. Then pin any finding as an evidence-backed hypothesis in a workspace.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Findings, not templated prose — every number is computed and unit-tested',
              'One click turns a finding into a tracked, provenance-backed decision',
              'Personalized: the studio learns your role, sectors and goals',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" /> {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Sparkles className="h-4 w-4 text-violet-400" /> Insight report
            </div>
            <div className="space-y-2.5">
              {findings.map((f) => (
                <div key={f.label} className="rounded-xl border border-edge/60 bg-elevated/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${f.tint}`}>
                      <f.icon className="h-3 w-3" /> {f.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{f.stat}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- lifecycle -- */
const STEPS = [
  { n: '01', title: 'Frame', body: 'State the problem and the metric that defines done.' },
  { n: '02', title: 'Assemble', body: 'The copilot recommends the right datasets for your problem.' },
  { n: '03', title: 'Analyze', body: 'Compute findings, chart anything, profile data quality.' },
  { n: '04', title: 'Decide', body: 'Validate or reject hypotheses with evidence attached.' },
  { n: '05', title: 'Produce', body: 'Ship the output and log the decision for the team.' },
]

export function Lifecycle() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">The journey</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          From brainstorming a problem to full-scale production.
        </h2>
      </Reveal>
      <Stagger className="mt-12 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((s) => (
          <StaggerItem key={s.n}>
            <div className="card h-full p-5">
              <div className="font-mono text-sm text-brand-400">{s.n}</div>
              <h3 className="mt-2 text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

/* ------------------------------------------------------------------- trust */
export function Trust() {
  const items = [
    { icon: ShieldCheck, title: 'Governed by design', body: 'Row-level permissions, dataset licensing and full lineage from source through scoring.' },
    { icon: Database, title: 'Lakehouse-native', body: 'Ingest, standardize, score and store — 24 AEC domains under one queryable schema.' },
    { icon: Lock, title: 'Yours, securely', body: 'Real accounts, cloud sync and license-gated downloads. Confidential data stays in a clean room.' },
    { icon: Leaf, title: 'Built for outcomes', body: 'Benchmark cost, cut embodied carbon, de-risk schedules — measurable results, not dashboards.' },
  ]
  return (
    <section className="border-t border-edge/50 bg-panel/40">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Trust is the product.</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <StaggerItem key={i.title}>
              <div className="card h-full p-5">
                <i.icon className="h-5 w-5 text-teal-400" />
                <h3 className="mt-3 text-base font-semibold text-white">{i.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{i.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- CTA --- */
export function CTA({ appUrl }: { appUrl: string }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <Reveal>
        <div className="card relative overflow-hidden p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-transparent" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Turn the industry&apos;s data exhaust into <span className="text-gradient">intelligence</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
              Browse data, run real analysis, frame a problem and ship a decision — with your team, in one studio.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={appUrl}
                className="group inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(59,130,246,0.6)] transition-all hover:bg-brand-400"
              >
                Enter the studio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
