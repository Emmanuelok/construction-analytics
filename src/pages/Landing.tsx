import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Sparkles,
  Database,
  Boxes,
  Workflow,
  ShieldCheck,
  Table2,
  Leaf,
  Gauge,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react'
import { Logo, Wordmark } from '@/components/layout/Logo'
import { CORE_MODULES, PLATFORM_KPIS } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const STATS = [
  { label: 'Records unified', value: formatNumber(PLATFORM_KPIS.records, { compact: true }) },
  { label: 'Under management', value: `${PLATFORM_KPIS.dataVolumePB} PB` },
  { label: 'Curated datasets', value: formatNumber(PLATFORM_KPIS.datasets) },
  { label: 'Projects analyzed', value: formatNumber(PLATFORM_KPIS.projects, { compact: true }) },
  { label: 'Avg data quality', value: `${PLATFORM_KPIS.avgQuality}%` },
]

const DIFFERENTIATORS = [
  { icon: Table2, title: 'Operable, not informational', body: 'Edit any dataset, tune any model and watch the analytics recompute live — 13 workbenches, each on a tested engine.', accent: 'cyan' as const },
  { icon: Boxes, title: 'One project, every lens', body: 'Pick a project once; earned value, carbon, health, safety and clash all read from one coherent dataset.', accent: 'blue' as const },
  { icon: UploadCloud, title: 'Ingest → standardize → analyze', body: 'Map any spreadsheet to a canonical schema, validate it, and send it straight into analysis — in the browser.', accent: 'emerald' as const },
  { icon: ShieldCheck, title: 'Governed & exportable', body: 'Quality-scored, permissioned data; save & compare scenarios; export board-ready PDF briefs from any workbench.', accent: 'teal' as const },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-base text-slate-200">
      {/* top nav */}
      <header className="sticky top-0 z-20 border-b border-edge/60 bg-base/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark />
          <nav className="flex items-center gap-2">
            <Link to="/data" className="hidden rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:block">Data Center</Link>
            <Link to="/ask" className="hidden rounded-xl px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:block">Ask AEC</Link>
            <Link to="/" className="btn-primary">Enter the Studio <ArrowRight className="h-4 w-4" /></Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -left-40 top-20 h-[24rem] w-[24rem] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-edge/70 bg-surface/60 px-3.5 py-1.5 text-xs font-medium text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" /> The unified data & intelligence studio for the built environment
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
              The operating system for <span className="text-gradient-brand">AEC data</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
              A lakehouse, a data marketplace and thirteen analytics engines in one studio — turning the construction
              industry's fragmented data exhaust into decisions you can defend, from brainstorming a problem to full-scale production.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/" className="btn-primary !px-5 !py-3 text-base">Enter the Studio <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/project" className="btn-ghost !px-5 !py-3 text-base">Open a project cockpit</Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">No sign-up to explore — every workbench runs on live, editable demo data.</p>
          </div>

          {/* stats band */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge/60 bg-edge/40 sm:grid-cols-5">
            {STATS.map((s) => (
              <div key={s.label} className="bg-panel/80 p-5 text-center">
                <div className="data-mono text-2xl font-bold text-slate-50">{s.value}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* differentiators */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="section-label mb-2">Why it's different</div>
        <h2 className="max-w-2xl text-2xl font-bold text-slate-100 sm:text-3xl">Most AEC tools show you information. This one lets you <span className="text-gradient-brand">work the data</span>.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {DIFFERENTIATORS.map((d) => {
            const a = ACCENT[d.accent]
            return (
              <div key={d.title} className="rounded-2xl border border-edge/60 bg-surface/40 p-6">
                <span className={cn('grid h-10 w-10 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                  <d.icon className={cn('h-5 w-5', a.text)} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-100">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* modules */}
      <section className="mx-auto max-w-6xl px-5 py-8">
        <div className="section-label mb-2">From data to decision</div>
        <h2 className="text-2xl font-bold text-slate-100 sm:text-3xl">Fourteen engines, one source of truth</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Every module is a working tool — click any one to jump straight in.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_MODULES.map((m) => {
            const a = ACCENT[m.accent]
            return (
              <Link key={m.path} to={m.path} className="group flex items-start gap-3 rounded-xl border border-edge/60 bg-surface/40 p-4 transition-colors hover:border-edge hover:bg-elevated/40">
                <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', a.bg)}>
                  <Database className={cn('h-4 w-4', a.text)} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-slate-100">{m.name} <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-slate-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" /></div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{m.what}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* closing CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-edge/60 bg-gradient-to-br from-brand-500/10 via-surface/40 to-violet-500/10 p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-5 w-fit"><Logo className="h-12 w-12" /></div>
            <h2 className="text-3xl font-bold text-slate-50 sm:text-4xl">Stop staring at dashboards. Start working the data.</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-400">Open the studio and edit a budget, score a supplier, model embodied carbon, or import your own spreadsheet — and watch the numbers move.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/" className="btn-primary !px-6 !py-3 text-base">Enter the Studio <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/cost-schedule" className="btn-ghost !px-6 !py-3 text-base">See a live workbench</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              {['Lakehouse & marketplace', 'Tested analytics engines', 'Save · compare · export', 'Runs in your browser'].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {f}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-edge/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Wordmark />
          <p className="text-xs text-slate-500">AEC Data & Intelligence Studio — a unified lakehouse, marketplace & analytics platform for the built environment.</p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-slate-400 hover:text-white">Studio</Link>
            <Link to="/data" className="text-slate-400 hover:text-white">Data</Link>
            <Link to="/pain-points" className="text-slate-400 hover:text-white">Why we exist</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
