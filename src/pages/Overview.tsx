import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Database,
  Boxes,
  Sparkles,
  ShieldCheck,
  Layers,
  Workflow,
  Gauge,
  CircleDot,
  Building2,
  Cpu,
  FileStack,
  Network,
} from 'lucide-react'
import { Card, IconBadge, Badge } from '@/components/ui'
import { CORE_MODULES, DOMAIN_AREAS, STAKEHOLDERS, PLATFORM_KPIS } from '@/data/platform'
import { MACRO_STATS } from '@/data/painPoints'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { useCountUp } from '@/lib/hooks'
import { formatNumber } from '@/lib/format'

function Counter({ target, suffix, decimals = 0 }: { target: number; suffix?: string; decimals?: number }) {
  const { value, ref } = useCountUp(target)
  return (
    <span ref={ref} className="data-mono">
      {value.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

const PIPELINE = [
  { icon: Database, label: 'Ingest', desc: 'Native + IFC, PDFs, scans, IoT, ERP', accent: 'sky' as const },
  { icon: Workflow, label: 'Standardize', desc: 'ETL/ELT, schema mapping, classification', accent: 'blue' as const },
  { icon: ShieldCheck, label: 'Govern', desc: 'Quality scoring, anonymization, lineage', accent: 'teal' as const },
  { icon: Cpu, label: 'Analyze', desc: 'Forecasting, CV, NL querying, twins', accent: 'violet' as const },
  { icon: Layers, label: 'License', desc: 'Marketplace, clean rooms, AI training', accent: 'emerald' as const },
]

export default function Overview() {
  return (
    <div className="space-y-16">
      {/* ============================================================ Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-edge/60 bg-gradient-to-b from-surface/80 to-panel/40 px-6 py-14 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-radial-brand" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-edge/70 bg-elevated/60 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className="absolute h-2 w-2 animate-pulsering rounded-full bg-brand-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            </span>
            The neutral data layer for the built environment
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-50 sm:text-6xl">
            One studio for <span className="text-gradient-brand">all AEC data</span>,
            <br className="hidden sm:block" /> analytics & AI.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Collect, clean, standardize, store, license and analyze data across the entire AEC lifecycle —
            from BIM models and drawings to cost, procurement, field, reality capture, ESG and operations.
            A unified <span className="text-slate-200">lakehouse</span>,{' '}
            <span className="text-slate-200">marketplace</span> and{' '}
            <span className="text-slate-200">intelligence platform</span> in one.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/ask" className="btn-primary">
              <Sparkles className="h-4 w-4" /> Ask the platform
            </Link>
            <Link to="/marketplace" className="btn-ghost">
              Explore the marketplace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pain-points" className="btn-ghost">
              The problem we solve
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
            {['Owners', 'Contractors', 'Designers', 'Suppliers', 'Insurers', 'Regulators', 'AI companies'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <CircleDot className="h-3 w-3 text-brand-500/70" /> {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================== Platform KPIs */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge/60 bg-edge/40 sm:grid-cols-4">
        {[
          { label: 'Records unified', node: <Counter target={4.7} decimals={1} suffix="B" />, icon: Database, accent: 'sky' as const },
          { label: 'Projects benchmarked', node: <Counter target={PLATFORM_KPIS.projects} suffix="+" />, icon: Building2, accent: 'cyan' as const },
          { label: 'BIM models hosted', node: <Counter target={PLATFORM_KPIS.modelsHosted} suffix="+" />, icon: Boxes, accent: 'blue' as const },
          { label: 'Datasets licensable', node: <Counter target={PLATFORM_KPIS.datasets} suffix="+" />, icon: FileStack, accent: 'emerald' as const },
          { label: 'Data under management', node: <Counter target={18.4} decimals={1} suffix=" PB" />, icon: Layers, accent: 'violet' as const },
          { label: 'Avg. data-quality score', node: <Counter target={93.6} decimals={1} suffix="%" />, icon: Gauge, accent: 'teal' as const },
          { label: 'Contributing organizations', node: <Counter target={PLATFORM_KPIS.organizations} suffix="+" />, icon: Network, accent: 'amber' as const },
          { label: 'AI models trained on data', node: <Counter target={PLATFORM_KPIS.aiModelsTrained} suffix="+" />, icon: Cpu, accent: 'fuchsia' as const },
        ].map((k) => {
          const a = ACCENT[k.accent]
          return (
            <div key={k.label} className="bg-panel/80 p-5">
              <k.icon className={cn('h-4 w-4', a.text)} />
              <div className="mt-3 text-2xl font-bold text-slate-50">{k.node}</div>
              <div className="mt-1 text-xs text-slate-500">{k.label}</div>
            </div>
          )
        })}
      </section>

      {/* ===================================================== The problem */}
      <section>
        <div className="text-center">
          <div className="section-label">Why this platform must exist</div>
          <h2 className="mx-auto mt-3 max-w-3xl text-2xl font-bold text-slate-100 sm:text-3xl">
            The built environment is the world’s least-digitized major industry — and it’s bleeding value.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MACRO_STATS.map((s) => {
            const a = ACCENT[s.accent]
            return (
              <Card key={s.value} className="p-6" hover>
                <div className={cn('text-3xl font-extrabold tracking-tight', a.text)}>{s.value}</div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{s.label}</p>
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                >
                  {s.source} <ArrowRight className="h-3 w-3" />
                </a>
              </Card>
            )
          })}
        </div>
        <div className="mt-5 text-center">
          <Link to="/pain-points" className="btn-ghost">
            See the 15 unsolved pain points we target <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ===================================================== Pipeline */}
      <section>
        <div className="text-center">
          <div className="section-label">How it works</div>
          <h2 className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl">One pipeline, every lifecycle stage</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
            Raw, fragmented AEC data enters once and becomes standardized, governed, analyzable and licensable —
            the durable source of truth no authoring tool can be.
          </p>
        </div>
        <div className="relative mt-10">
          <div className="absolute left-0 right-0 top-[34px] hidden h-px bg-gradient-to-r from-transparent via-edge to-transparent lg:block" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((p, i) => {
              const a = ACCENT[p.accent]
              return (
                <div key={p.label} className="relative">
                  <Card className="h-full p-5 text-center" hover>
                    <div className="mx-auto grid place-items-center">
                      <span className={cn('grid h-16 w-16 place-items-center rounded-2xl ring-1', a.bg, a.ring)}>
                        <p.icon className={cn('h-7 w-7', a.text)} />
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="data-mono text-xs text-slate-600">0{i + 1}</span>
                      <span className="font-semibold text-slate-100">{p.label}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.desc}</p>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===================================================== Modules */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-label">14 intelligence engines</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl">Everything is a module</h2>
          </div>
          <p className="max-w-md text-sm text-slate-400">
            Each engine works standalone or composes with the others over the shared lakehouse — no brittle
            point-to-point integrations.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_MODULES.map((m) => {
            const a = ACCENT[m.accent]
            return (
              <Link key={m.path} to={m.path} className="group">
                <Card className="flex h-full items-start gap-4 p-5" hover>
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                    <Boxes className={cn('h-5 w-5', a.text)} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                      <span className="truncate">{m.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-slate-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{m.what}</p>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ===================================================== Domain coverage */}
      <section>
        <div className="text-center">
          <div className="section-label">End-to-end coverage</div>
          <h2 className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl">24 AEC data domains, one schema</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400">
            From project identity to operations telemetry — mapped into a unified ontology with canonical
            crosswalks across OmniClass, Uniclass, MasterFormat and CoClass.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {DOMAIN_AREAS.map((d) => {
            const a = ACCENT[d.accent]
            return (
              <span
                key={d.name}
                className="group inline-flex items-center gap-2 rounded-full border border-edge/70 bg-surface/60 px-3.5 py-2 text-sm text-slate-300 transition-colors hover:border-brand-500/40 hover:text-white"
                title={d.purpose}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} />
                {d.name}
              </span>
            )
          })}
        </div>
      </section>

      {/* ===================================================== Stakeholders */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-label">Built for everyone in the value chain</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-100 sm:text-3xl">One platform, every stakeholder</h2>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAKEHOLDERS.map((s) => {
            const a = ACCENT[s.accent]
            return (
              <Card key={s.name} className="p-5" hover>
                <div className={cn('h-1.5 w-10 rounded-full', a.dot)} />
                <h3 className="mt-3 font-semibold text-slate-100">{s.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.value}</p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ===================================================== CTA */}
      <section className="relative overflow-hidden rounded-3xl border border-edge/60 bg-gradient-to-br from-brand-500/10 via-surface/60 to-violet-500/10 px-6 py-12 text-center sm:px-12">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="relative mx-auto max-w-2xl">
          <IconBadge icon={Sparkles} accent="violet" size="lg" className="mx-auto" />
          <h2 className="mt-5 text-2xl font-bold text-slate-50 sm:text-3xl">
            Turn the industry’s data exhaust into intelligence.
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Discover datasets, train models, benchmark performance, forecast risk and make better decisions
            across the built environment.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/insights" className="btn-primary">
              <Gauge className="h-4 w-4" /> Open executive dashboard
            </Link>
            <Link to="/lakehouse" className="btn-ghost">
              Tour the lakehouse <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
