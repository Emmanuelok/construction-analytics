import { useMemo, useState } from 'react'
import {
  Flame,
  Quote,
  ArrowUpRight,
  ChevronDown,
  Users,
  Ban,
  Lightbulb,
  Target,
  Layers,
} from 'lucide-react'
import { Card, PageHeader, Badge, IconBadge } from '@/components/ui'
import { MACRO_STATS, OWNER_QUOTE, PAIN_POINTS, type PainPoint } from '@/data/painPoints'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

function PainCard({ p, defaultOpen }: { p: PainPoint; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const a = ACCENT[p.accent]
  return (
    <Card className={cn('overflow-hidden transition-all', open && 'shadow-glow')}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-4 p-5 text-left">
        {p.rank ? (
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1', a.bg, a.ring, a.text)}>
            #{p.rank}
          </span>
        ) : (
          <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', a.dot)} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{p.category}</Badge>
            {p.rank && (
              <Badge variant="danger" dot>
                Top 5 unsolved
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-100">{p.title}</h3>
          {p.headlineStat && <p className={cn('mt-1 text-sm font-medium', a.text)}>{p.headlineStat}</p>}
        </div>
        <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      <div className={cn('grid transition-all duration-300', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="space-y-5 border-t border-edge/50 px-5 pb-6 pt-5 sm:pl-[76px]">
            <p className="text-sm leading-relaxed text-slate-300">{p.problem}</p>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Users className="h-3.5 w-3.5" /> Who's complaining
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.who.map((w) => (
                    <span key={w} className="rounded-md bg-elevated/60 px-2 py-1 text-xs text-slate-300">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Ban className="h-3.5 w-3.5" /> Why it stays unsolved
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{p.whyUnsolved}</p>
              </div>
            </div>

            <div className={cn('rounded-xl border p-4', a.ring, a.bg)}>
              <div className={cn('mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide', a.text)}>
                <Lightbulb className="h-3.5 w-3.5" /> How the studio solves it
              </div>
              <p className="text-sm leading-relaxed text-slate-200">{p.ourSolution}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.modules.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 rounded-md border border-edge/60 bg-base/40 px-2 py-1 text-[11px] text-slate-300">
                    <Layers className="h-3 w-3 text-slate-500" />
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {p.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                >
                  {s.label} <ArrowUpRight className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function PainPoints() {
  const categories = useMemo(() => ['All', ...Array.from(new Set(PAIN_POINTS.map((p) => p.category)))], [])
  const [cat, setCat] = useState('All')

  const sorted = useMemo(
    () => [...PAIN_POINTS].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    [],
  )
  const filtered = cat === 'All' ? sorted : sorted.filter((p) => p.category === cat)
  const top5 = sorted.filter((p) => p.rank)

  return (
    <div className="space-y-9">
      <PageHeader
        icon={Flame}
        accent="rose"
        eyebrow="Research"
        title="Unsolved Pain Points"
        description="An evidence-based dossier of the critical AEC data, analytics and AI problems that no major platform has solved — and that stakeholders verifiably complain about. This is why the studio exists."
        actions={<Badge variant="danger" dot>15 gaps · fully sourced</Badge>}
      />

      {/* Owner quote */}
      <Card className="relative overflow-hidden p-7 sm:p-9">
        <div className="pointer-events-none absolute -left-6 -top-6 opacity-10">
          <Quote className="h-40 w-40 text-rose-400" />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xl font-medium leading-relaxed text-slate-100 sm:text-2xl">
            “{OWNER_QUOTE.text}”
          </p>
          <a
            href={OWNER_QUOTE.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"
          >
            — {OWNER_QUOTE.attribution} <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Card>

      {/* Macro stats */}
      <div>
        <div className="section-label mb-4">The scale of the problem</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  {s.source} <ArrowUpRight className="h-3 w-3" />
                </a>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Top 5 quick list */}
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-rose-400" />
          <h2 className="text-lg font-bold text-slate-100">The 5 most painful, most unsolved, highest-opportunity gaps</h2>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          The binding constraint in AEC isn’t algorithms — it’s the absence of <span className="text-slate-200">pooled,
          standardized, trusted, licensable data</span>. These five cluster around that one structural truth.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {top5.map((p) => {
            const a = ACCENT[p.accent]
            return (
              <div key={p.id} className="rounded-xl border border-edge/60 bg-elevated/40 p-4">
                <span className={cn('text-xs font-bold', a.text)}>#{p.rank}</span>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-200">{p.title}</p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Filter + full list */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                c === cat ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-edge/70 bg-elevated/40 text-slate-400 hover:text-slate-200',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((p) => (
            <PainCard key={p.id} p={p} defaultOpen={p.rank === 1} />
          ))}
        </div>
      </div>

      {/* Thesis */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-rose-500/10 via-surface/60 to-brand-500/10 p-7 text-center">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-2xl">
          <IconBadge icon={Lightbulb} accent="rose" size="lg" className="mx-auto" />
          <h2 className="mt-5 text-2xl font-bold text-slate-50">The opportunity is the neutral data layer itself</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Incumbents are structurally disincentivized from neutrality — each builds a proprietary lake to feed its own
            AI. Whoever pools, standardizes, governs and licenses AEC data across firms unlocks every downstream use
            case: benchmarking, forecasting, document intelligence, handover and AI training. That neutral ground is
            exactly what this studio is built to own.
          </p>
        </div>
      </Card>
    </div>
  )
}
