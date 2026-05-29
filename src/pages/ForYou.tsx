import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  Command as CommandIcon,
  Wand2,
  ArrowRight,
  ShoppingCart,
  Check,
  Download,
  Microscope,
  Star,
  Compass,
  Clock,
  Lightbulb,
  Gauge,
  Layers,
  Heart,
} from 'lucide-react'
import { Card, PageHeader, StatTile, Badge, RingProgress } from '@/components/ui'
import { useStudio } from '@/store/studio'
import { useProfile } from '@/store/profile'
import { useAuth } from '@/store/auth'
import { ACCENT, NAV } from '@/lib/nav'
import { recommend, insightsFor, greeting, type Recommendation } from '@/lib/intelligence'
import type { CatalogDataset } from '@/data/catalog'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

const openPalette = (q?: string) => window.dispatchEvent(new CustomEvent('aec:command', { detail: { q } }))
const openOnboarding = () => window.dispatchEvent(new CustomEvent('aec:onboarding'))

function priceLabel(price: number | null) {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return formatCurrency(price, { compact: false })
}

const ROLE_SHORTCUTS: Record<string, string[]> = {
  Architect: ['/bim', '/sustainability', '/data', '/analyze'],
  'Structural Engineer': ['/bim', '/cost-schedule', '/data', '/analyze'],
  'MEP Engineer': ['/bim', '/digital-twin', '/field', '/data'],
  Contractor: ['/field', '/cost-schedule', '/procurement', '/data'],
  Developer: ['/insights', '/cost-schedule', '/sustainability', '/data'],
  'Cost Manager': ['/cost-schedule', '/procurement', '/analyze', '/data'],
  'Sustainability Lead': ['/sustainability', '/bim', '/ai-studio', '/data'],
  'Data Scientist': ['/ai-studio', '/analyze', '/reality-capture', '/data'],
  Researcher: ['/ai-studio', '/analyze', '/pain-points', '/data'],
  'Facilities / Owner': ['/digital-twin', '/documents', '/insights', '/data'],
}

function RecCard({ rec }: { rec: Recommendation }) {
  const { addToCart, inCart, owns, license } = useStudio()
  const d = rec.dataset
  const a = ACCENT[d.accent]
  const owned = owns(d.id)
  const free = d.price === 0
  return (
    <Card className="group flex flex-col p-5" hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge variant="neutral">{d.category}</Badge>
          <Link to={`/data/${d.id}`} className="mt-2 block">
            <h3 className="truncate text-[15px] font-semibold text-slate-100 group-hover:text-white">{d.name}</h3>
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">{d.provider}</p>
        </div>
        <RingProgress value={Math.round(rec.score * 100)} size={48} stroke={5} accent={d.accent} label={<span className="text-[10px] font-semibold text-slate-200">{Math.round(rec.score * 100)}</span>} />
      </div>

      <div className="mt-3 space-y-1.5">
        {rec.reasons.map((r) => (
          <div key={r} className={cn('flex items-center gap-1.5 text-xs', a.text)}>
            <Sparkles className="h-3 w-3 shrink-0" />
            <span className="text-slate-300">{r}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-edge/50 pt-3">
        <span className={cn('text-base font-bold', free ? 'text-emerald-300' : a.text)}>{priceLabel(d.price)}</span>
        <div className="flex items-center gap-1.5">
          <Link to={`/analyze?dataset=${d.id}`} className="btn-ghost !px-2.5 !py-1.5 !text-xs" title="Analyze">
            <Microscope className="h-3.5 w-3.5" />
          </Link>
          {owned ? (
            <span className="btn !px-2.5 !py-1.5 !text-xs text-emerald-300"><Check className="h-3.5 w-3.5" /> Owned</span>
          ) : free ? (
            <button onClick={() => license(d.id)} className="btn-primary !px-2.5 !py-1.5 !text-xs"><Download className="h-3.5 w-3.5" /> Get</button>
          ) : inCart(d.id) ? (
            <Link to="/library" className="btn-primary !bg-emerald-500 hover:!bg-emerald-400 !px-2.5 !py-1.5 !text-xs"><Check className="h-3.5 w-3.5" /> In cart</Link>
          ) : (
            <button onClick={() => addToCart(d.id)} className="btn-primary !px-2.5 !py-1.5 !text-xs"><ShoppingCart className="h-3.5 w-3.5" /> Add</button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function ForYou() {
  const { user } = useAuth()
  const { profile, signals } = useProfile()
  const { allDatasets, library, listings, downloads, getAny } = useStudio()

  const ownedIds = useMemo(() => new Set([...library.map((l) => l.datasetId), ...listings.map((l) => l.id)]), [library, listings])
  const recs = useMemo(() => recommend(allDatasets, profile, signals, { excludeIds: ownedIds, limit: 6 }), [allDatasets, profile, signals, ownedIds])
  const insights = useMemo(() => insightsFor(allDatasets, profile, signals, ownedIds), [allDatasets, profile, signals, ownedIds])
  const recentViewed = useMemo(
    () => signals.lastViewed.map((id) => getAny(id)).filter(Boolean).slice(0, 4) as CatalogDataset[],
    [signals.lastViewed, getAny],
  )

  const displayName = profile.name || user?.name || (user?.email ? user.email.split('@')[0] : '') || 'there'
  const interestsLearned = Object.keys(signals.tagAffinity).length

  const focusLine = useMemo(() => {
    const bits: string[] = []
    if (profile.role) bits.push(profile.role)
    if (profile.sectors.length) bits.push(profile.sectors.slice(0, 2).join(' & '))
    return bits.join(' · ')
  }, [profile])

  const shortcuts = useMemo(() => {
    const paths = ROLE_SHORTCUTS[profile.role] ?? ['/data', '/analyze', '/bim', '/insights']
    return paths.map((p) => NAV.find((n) => n.path === p)).filter(Boolean) as typeof NAV
  }, [profile.role])

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- hero */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm text-brand-300">
            <Sparkles className="h-4 w-4" /> Your personalized studio
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            {greeting()}, {displayName}.
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-300">
            {profile.onboarded ? (
              <>
                Tuned for {focusLine ? <span className="text-slate-100">{focusLine}</span> : 'your work'}.{' '}
                {recs.length > 0 && (
                  <>
                    <span className="text-slate-100">{recs.length} datasets</span> match your goals right now, and search now
                    understands what you mean.
                  </>
                )}
              </>
            ) : (
              <>This studio adapts to each person. Tell us who you are and your home, recommendations and search reshape around you.</>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button onClick={() => openPalette()} className="flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/60 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:border-brand-500/40 hover:text-white">
              <CommandIcon className="h-4 w-4 text-brand-300" />
              Ask or do anything…
              <kbd className="ml-2 rounded border border-edge bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
            </button>
            {!profile.onboarded ? (
              <button onClick={openOnboarding} className="btn-primary">
                <Wand2 className="h-4 w-4" /> Personalize my studio
              </button>
            ) : (
              <button onClick={openOnboarding} className="btn-ghost">
                <Wand2 className="h-4 w-4" /> Edit interests
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {['recommend for me', 'free datasets for my work', 'compare cost per m²', 'highest schedule risk'].map((q) => (
              <button key={q} onClick={() => openPalette(q)} className="rounded-full border border-edge/70 bg-elevated/40 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-violet-500/40 hover:text-slate-200">
                {q}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Matched for you" value={String(recs.length)} icon={Heart} accent="rose" sub="ranked by your profile" />
        <StatTile label="In your library" value={String(library.length)} icon={Layers} accent="emerald" sub={`${listings.length} you publish`} />
        <StatTile label="Files downloaded" value={String(downloads.length)} icon={Download} accent="cyan" />
        <StatTile label="Interests learned" value={String(interestsLearned)} icon={Gauge} accent="violet" sub="from your activity" />
      </div>

      {/* ------------------------------------------------------------- insights */}
      {insights.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {insights.map((ins) => {
            const a = ACCENT[ins.accent]
            return (
              <Card key={ins.id} className="flex flex-col p-5" hover>
                <span className={cn('grid h-9 w-9 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                  <Lightbulb className={cn('h-[18px] w-[18px]', a.text)} />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-100">{ins.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-400">{ins.body}</p>
                {ins.to && (
                  <Link to={ins.to} className={cn('mt-3 inline-flex items-center gap-1 text-sm font-medium', a.text)}>
                    {ins.cta ?? 'Open'} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------- recommended for you */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-300" />
            <h2 className="text-[15px] font-semibold text-slate-100">Recommended for you</h2>
            <Badge variant="brand">personalized</Badge>
          </div>
          <Link to="/data" className="text-sm text-slate-400 hover:text-slate-200">
            Browse all <ArrowRight className="inline h-3.5 w-3.5" />
          </Link>
        </div>
        {recs.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recs.map((r) => (
              <RecCard key={r.dataset.id} rec={r} />
            ))}
          </div>
        ) : (
          <Card className="grid place-items-center p-12 text-center text-slate-400">
            <Compass className="h-7 w-7 text-slate-600" />
            <p className="mt-3">Tell us about your work to unlock tailored picks.</p>
            <button onClick={openOnboarding} className="btn-primary mt-4"><Wand2 className="h-4 w-4" /> Personalize</button>
          </Card>
        )}
      </div>

      {/* --------------------------------------------- continue where you left off */}
      {recentViewed.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-300" />
            <h2 className="text-[15px] font-semibold text-slate-100">Continue where you left off</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {recentViewed.map((d) => {
              const a = ACCENT[d.accent]
              return (
                <Link key={d.id} to={`/data/${d.id}`}>
                  <Card className="flex h-full items-start gap-3 p-4" hover>
                    <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold', a.bg, a.text)}>{d.modality.slice(0, 3)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-200">{d.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {d.rating || '—'} · {formatNumber(d.records, { compact: true })} recs
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------- tailored shortcuts */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Compass className="h-4 w-4 text-violet-300" />
          <h2 className="text-[15px] font-semibold text-slate-100">Jump back in</h2>
          {profile.role && <span className="text-sm text-slate-500">· shaped for a {profile.role}</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {shortcuts.map((n) => {
            const a = ACCENT[n.accent]
            return (
              <Link key={n.path} to={n.path}>
                <Card className="group flex h-full items-start gap-3 p-5" hover>
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                    <n.icon className={cn('h-5 w-5', a.text)} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{n.label}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{n.blurb}</div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
