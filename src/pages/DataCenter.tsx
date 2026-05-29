import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Store,
  Search,
  Star,
  ShoppingCart,
  Check,
  Microscope,
  UploadCloud,
  Database,
  Layers,
  BadgeCheck,
  ArrowRight,
  Gauge,
  Download,
  Sparkles,
} from 'lucide-react'
import { Card, PageHeader, StatTile, Badge, RingProgress } from '@/components/ui'
import { useStudio } from '@/store/studio'
import { useProfile } from '@/store/profile'
import { recommend } from '@/lib/intelligence'
import { CATEGORIES, MODALITIES, LICENSES, type CatalogDataset, type License } from '@/data/catalog'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

const LICENSE_VARIANT: Record<License, 'success' | 'cyan' | 'brand' | 'violet'> = {
  Open: 'success',
  Research: 'cyan',
  Commercial: 'brand',
  Enterprise: 'violet',
}

function priceLabel(price: number | null) {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return formatCurrency(price, { compact: false })
}

function DatasetCard({ d, isOwn }: { d: CatalogDataset; isOwn?: boolean }) {
  const { addToCart, inCart, owns, license } = useStudio()
  const a = ACCENT[d.accent]
  const owned = owns(d.id)
  const free = d.price === 0
  return (
    <Card className="group flex flex-col p-5" hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={LICENSE_VARIANT[d.license]}>{d.license}</Badge>
            {d.anonymized && <Badge variant="neutral">Anonymized</Badge>}
            {isOwn && <Badge variant="success" dot>Yours</Badge>}
          </div>
          <Link to={`/data/${d.id}`} className="mt-2 block">
            <h3 className="truncate text-[15px] font-semibold text-slate-100 group-hover:text-white">{d.name}</h3>
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">{d.provider}</p>
        </div>
        <RingProgress value={d.quality} size={46} stroke={5} accent={d.accent} label={<span className="text-[10px] font-semibold text-slate-200">{d.quality}</span>} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-400">{d.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {d.tags.slice(0, 4).map((t) => (
          <span key={t} className="rounded-md bg-elevated/60 px-2 py-0.5 text-[11px] text-slate-400">
            #{t}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-edge/50 pt-3 text-center">
        <div>
          <div className="data-mono text-sm font-semibold text-slate-200">{formatNumber(d.records, { compact: true })}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600">records</div>
        </div>
        <div>
          <div className="data-mono text-sm font-semibold text-slate-200">{d.modality}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600">type</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-200">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {d.rating || '—'}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-600">{formatNumber(d.downloads, { compact: true })} dl</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={cn('text-base font-bold', free ? 'text-emerald-300' : a.text)}>{priceLabel(d.price)}</span>
        <div className="flex items-center gap-1.5">
          <Link to={`/analyze?dataset=${d.id}`} className="btn-ghost !px-2.5 !py-1.5 !text-xs" title="Analyze in Studio">
            <Microscope className="h-3.5 w-3.5" />
          </Link>
          <Link to={`/data/${d.id}`} className="btn-ghost !px-2.5 !py-1.5 !text-xs">
            View <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {owned ? (
            <span className="btn !px-2.5 !py-1.5 !text-xs text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Owned
            </span>
          ) : free ? (
            <button onClick={() => license(d.id)} className="btn-primary !px-2.5 !py-1.5 !text-xs">
              <Download className="h-3.5 w-3.5" /> Get
            </button>
          ) : inCart(d.id) ? (
            <Link to="/library" className="btn-primary !bg-emerald-500 hover:!bg-emerald-400 !px-2.5 !py-1.5 !text-xs">
              <Check className="h-3.5 w-3.5" /> In cart
            </Link>
          ) : (
            <button onClick={() => addToCart(d.id)} className="btn-primary !px-2.5 !py-1.5 !text-xs">
              <ShoppingCart className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

type Sort = 'popular' | 'quality' | 'newest' | 'price-low'

export default function DataCenter() {
  const { allDatasets, listings, library, cart } = useStudio()
  const { profile, signals } = useProfile()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [modality, setModality] = useState('All')
  const [lic, setLic] = useState('All')
  const [sort, setSort] = useState<Sort>('popular')

  const listingIds = useMemo(() => new Set(listings.map((l) => l.id)), [listings])
  const ownedIds = useMemo(() => new Set([...library.map((l) => l.datasetId), ...listings.map((l) => l.id)]), [library, listings])
  const recs = useMemo(
    () => (profile.onboarded ? recommend(allDatasets, profile, signals, { excludeIds: ownedIds, limit: 3 }) : []),
    [allDatasets, profile, signals, ownedIds],
  )

  const filtered = useMemo(() => {
    let r = allDatasets.filter((d) => {
      const text = `${d.name} ${d.provider} ${d.tags.join(' ')} ${d.category}`.toLowerCase()
      if (q && !text.includes(q.toLowerCase())) return false
      if (cat !== 'All' && d.category !== cat) return false
      if (modality !== 'All' && d.modality !== modality) return false
      if (lic !== 'All' && d.license !== lic) return false
      return true
    })
    r = [...r].sort((a, b) => {
      if (sort === 'quality') return b.quality - a.quality
      if (sort === 'newest') return b.updated.localeCompare(a.updated)
      if (sort === 'price-low') return (a.price ?? Infinity) - (b.price ?? Infinity)
      return b.downloads - a.downloads
    })
    return r
  }, [allDatasets, q, cat, modality, lic, sort])

  const totalRecords = useMemo(() => allDatasets.reduce((s, d) => s + d.records, 0), [allDatasets])
  const freeCount = allDatasets.filter((d) => d.price === 0).length
  const avgQuality = Math.round(allDatasets.reduce((s, d) => s + d.quality, 0) / allDatasets.length)

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Store}
        accent="emerald"
        eyebrow="Studio"
        title="Data Center"
        description="The neutral repository for the built environment — browse, preview and download standardized AEC datasets across the entire lifecycle, or license premium data for analysis and AI training."
        actions={
          <>
            <Link to="/library" className="btn-ghost">
              <ShoppingCart className="h-4 w-4" /> Cart{cart.length > 0 && <span className="ml-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">{cart.length}</span>}
            </Link>
            <Link to="/sell" className="btn-primary">
              <UploadCloud className="h-4 w-4" /> Sell your data
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Datasets available" value={formatNumber(1842)} icon={Database} accent="emerald" sub={`${allDatasets.length} shown · ${listings.length} yours`} />
        <StatTile label="Total records" value={formatNumber(totalRecords, { compact: true })} icon={Layers} accent="sky" />
        <StatTile label="Avg quality score" value={`${avgQuality}%`} icon={Gauge} accent="cyan" />
        <StatTile label="Open / free datasets" value={String(freeCount)} icon={BadgeCheck} accent="teal" sub="download with no license" />
      </div>

      {/* Recommended for you */}
      {recs.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-300" />
            <h2 className="text-[15px] font-semibold text-slate-100">Recommended for you</h2>
            <Badge variant="brand">personalized</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recs.map((r) => (
              <DatasetCard key={r.dataset.id} d={r.dataset} isOwn={listingIds.has(r.dataset.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3 py-2 focus-within:border-emerald-500/50">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search datasets, providers, tags…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={modality} onChange={(e) => setModality(e.target.value)} className="rounded-lg border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-200 focus:outline-none">
              <option value="All">All types</option>
              {MODALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={lic} onChange={(e) => setLic(e.target.value)} className="rounded-lg border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-200 focus:outline-none">
              <option value="All">All licenses</option>
              {LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-lg border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-200 focus:outline-none">
              <option value="popular">Most popular</option>
              <option value="quality">Highest quality</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low → high</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                c === cat ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-edge/70 bg-elevated/40 text-slate-400 hover:text-slate-200',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{filtered.length}</span> dataset{filtered.length !== 1 && 's'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="grid place-items-center p-16 text-center text-slate-400">
          <Search className="h-7 w-7 text-slate-600" />
          <p className="mt-3">No datasets match your filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <DatasetCard key={d.id} d={d} isOwn={listingIds.has(d.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
