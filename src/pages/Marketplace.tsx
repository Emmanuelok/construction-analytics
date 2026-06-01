import { useMemo, useState } from 'react'
import {
  Store,
  Upload,
  Database,
  FileStack,
  Gauge,
  Building2,
  HardDrive,
  Star,
  Download,
  ShieldCheck,
  Lock,
  GitBranch,
  Search,
  Crown,
  Sparkles,
  X,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  StatTile,
  Badge,
  RingProgress,
  KeyValue,
  SectionHeading,
  IconBadge,
} from '@/components/ui'
import { DATASETS, type Dataset, type LicenseTier, type Modality } from '@/data/platform'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber, formatBytes } from '@/lib/format'

const ACCENT_NAME = 'emerald' as const
const GB = 1024 ** 3

/* ------------------------------------------------------------- headline KPIs */
const totalRecords = DATASETS.reduce((s, d) => s + d.records, 0)
const avgQuality = DATASETS.reduce((s, d) => s + d.quality, 0) / DATASETS.length
const totalBytes = DATASETS.reduce((s, d) => s + d.sizeGB, 0) * GB

/* ------------------------------------------------------------- filter config */
const CATEGORIES = ['All', ...Array.from(new Set(DATASETS.map((d) => d.category)))]
const LICENSES: (LicenseTier | 'All')[] = ['All', 'Open', 'Research', 'Commercial', 'Enterprise']
const MODALITIES: (Modality | 'All')[] = [
  'All',
  ...Array.from(new Set(DATASETS.map((d) => d.modality))),
]

/* ------------------------------------------------------------- license style */
const LICENSE_VARIANT: Record<LicenseTier, 'success' | 'cyan' | 'brand' | 'violet'> = {
  Open: 'success',
  Research: 'cyan',
  Commercial: 'brand',
  Enterprise: 'violet',
}

function priceLabel(price: number | null): string {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return formatCurrency(price, { compact: false })
}

/* ----------------------------------------------------- per-category schemas */
type SchemaCol = { name: string; type: string }
const SCHEMA_BY_CATEGORY: Record<string, SchemaCol[]> = {
  'Document Intelligence': [
    { name: 'drawing_id', type: 'string' },
    { name: 'discipline', type: 'enum' },
    { name: 'sheet_class', type: 'category' },
    { name: 'bbox_annotations', type: 'json[]' },
    { name: 'revision', type: 'string' },
    { name: 'captured_at', type: 'timestamp' },
  ],
  'Cost & Estimating': [
    { name: 'item_code', type: 'string' },
    { name: 'description', type: 'text' },
    { name: 'unit', type: 'enum' },
    { name: 'unit_rate', type: 'decimal' },
    { name: 'region', type: 'category' },
    { name: 'index_year', type: 'int' },
  ],
  'BIM & Models': [
    { name: 'guid', type: 'string' },
    { name: 'ifc_class', type: 'enum' },
    { name: 'omniclass', type: 'string' },
    { name: 'material', type: 'category' },
    { name: 'quantity', type: 'decimal' },
    { name: 'lod', type: 'int' },
  ],
  'Schedule & Controls': [
    { name: 'activity_id', type: 'string' },
    { name: 'wbs', type: 'string' },
    { name: 'planned_dur', type: 'int' },
    { name: 'actual_dur', type: 'int' },
    { name: 'float_days', type: 'int' },
    { name: 'delay_cause', type: 'category' },
  ],
  'Reality Capture': [
    { name: 'capture_id', type: 'string' },
    { name: 'geo_point', type: 'geojson' },
    { name: 'segmentation', type: 'mask' },
    { name: 'element_class', type: 'enum' },
    { name: 'progress_pct', type: 'decimal' },
    { name: 'captured_at', type: 'timestamp' },
  ],
  Sustainability: [
    { name: 'epd_id', type: 'string' },
    { name: 'material', type: 'category' },
    { name: 'gwp_a1a3', type: 'decimal' },
    { name: 'unit', type: 'enum' },
    { name: 'region', type: 'category' },
    { name: 'valid_until', type: 'date' },
  ],
  'AI Training': [
    { name: 'pair_id', type: 'string' },
    { name: 'rfi_text', type: 'text' },
    { name: 'response_text', type: 'text' },
    { name: 'discipline', type: 'enum' },
    { name: 'resolution_days', type: 'int' },
    { name: 'tokens', type: 'int' },
  ],
  Procurement: [
    { name: 'supplier_id', type: 'string' },
    { name: 'package', type: 'category' },
    { name: 'on_time_rate', type: 'decimal' },
    { name: 'lead_time_days', type: 'int' },
    { name: 'price_index', type: 'decimal' },
    { name: 'risk_tier', type: 'enum' },
  ],
  Operations: [
    { name: 'asset_id', type: 'string' },
    { name: 'sensor_type', type: 'enum' },
    { name: 'reading', type: 'decimal' },
    { name: 'unit', type: 'category' },
    { name: 'ts', type: 'timestamp' },
    { name: 'fault_flag', type: 'bool' },
  ],
  Quality: [
    { name: 'ncr_id', type: 'string' },
    { name: 'element', type: 'category' },
    { name: 'defect_class', type: 'enum' },
    { name: 'severity', type: 'int' },
    { name: 'image_ref', type: 'string' },
    { name: 'status', type: 'enum' },
  ],
  Geospatial: [
    { name: 'parcel_id', type: 'string' },
    { name: 'geometry', type: 'geojson' },
    { name: 'zoning_code', type: 'category' },
    { name: 'area_m2', type: 'decimal' },
    { name: 'jurisdiction', type: 'string' },
    { name: 'updated_at', type: 'date' },
  ],
}
const DEFAULT_SCHEMA: SchemaCol[] = [
  { name: 'record_id', type: 'string' },
  { name: 'project_ref', type: 'string' },
  { name: 'category', type: 'category' },
  { name: 'value', type: 'decimal' },
  { name: 'created_at', type: 'timestamp' },
  { name: 'source', type: 'string' },
]

/* ----------------------------------------------------------- license terms */
function licenseTerms(d: Dataset): { label: string; value: string }[] {
  const usage: Record<LicenseTier, string> = {
    Open: 'Unrestricted, any use',
    Research: 'Non-commercial research only',
    Commercial: 'Internal commercial use',
    Enterprise: 'Org-wide + model training',
  }
  const redis: Record<LicenseTier, string> = {
    Open: 'Permitted',
    Research: 'With citation',
    Commercial: 'Prohibited',
    Enterprise: 'Negotiated',
  }
  return [
    { label: 'License tier', value: d.license },
    { label: 'Permitted usage', value: usage[d.license] },
    { label: 'Attribution', value: d.license === 'Open' ? 'Optional' : 'Required' },
    { label: 'Redistribution', value: redis[d.license] },
  ]
}

/* ------------------------------------------------------ providers leaderboard */
type ProviderRow = { name: string; datasets: number; rating: number; downloads: number }
const PROVIDERS: ProviderRow[] = (() => {
  const map = new Map<string, { datasets: number; rating: number; downloads: number }>()
  for (const d of DATASETS) {
    const cur = map.get(d.provider) ?? { datasets: 0, rating: 0, downloads: 0 }
    cur.datasets += 1
    cur.rating += d.rating
    cur.downloads += d.downloads
    map.set(d.provider, cur)
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, datasets: v.datasets, rating: v.rating / v.datasets, downloads: v.downloads }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5)
})()

/* --------------------------------------------------------------- chip button */
function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
        active
          ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
          : 'bg-elevated/50 text-slate-400 ring-edge/70 hover:text-slate-200',
      )}
    >
      {label}
    </button>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-300">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="data-mono font-medium">{rating.toFixed(1)}</span>
    </span>
  )
}

export default function Marketplace() {
  const [category, setCategory] = useState<string>('All')
  const [license, setLicense] = useState<LicenseTier | 'All'>('All')
  const [modality, setModality] = useState<Modality | 'All'>('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>(DATASETS[0].id)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return DATASETS.filter((d) => {
      if (category !== 'All' && d.category !== category) return false
      if (license !== 'All' && d.license !== license) return false
      if (modality !== 'All' && d.modality !== modality) return false
      if (
        q &&
        !d.name.toLowerCase().includes(q) &&
        !d.provider.toLowerCase().includes(q) &&
        !d.tags.some((t) => t.toLowerCase().includes(q))
      )
        return false
      return true
    })
  }, [category, license, modality, query])

  const selected = useMemo(
    () => DATASETS.find((d) => d.id === selectedId) ?? DATASETS[0],
    [selectedId],
  )
  const activeFilters =
    (category !== 'All' ? 1 : 0) + (license !== 'All' ? 1 : 0) + (modality !== 'All' ? 1 : 0) + (query ? 1 : 0)

  const resetFilters = () => {
    setCategory('All')
    setLicense('All')
    setModality('All')
    setQuery('')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Store}
        eyebrow="Data Platform"
        title="Data Marketplace"
        description="Discover, license and exchange curated AEC datasets — from BIM libraries to cost benchmarks and site imagery — with quality scoring, clear terms and privacy-preserving clean rooms."
        accent={ACCENT_NAME}
        actions={
          <button className="btn-ghost">
            <Upload className="h-4 w-4" /> Publish a dataset
          </button>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Datasets available"
          value={formatNumber(1842)}
          delta="64 this mo."
          deltaPositive
          icon={FileStack}
          accent="emerald"
          sub="Across 24 AEC domains"
        />
        <StatTile
          label="Total records"
          value={formatNumber(totalRecords, { compact: true })}
          delta="8.1%"
          deltaPositive
          icon={Database}
          accent="sky"
          sub="Indexed & queryable"
        />
        <StatTile
          label="Avg. quality score"
          value={`${avgQuality.toFixed(1)}%`}
          delta="0.6 pts"
          deltaPositive
          icon={Gauge}
          accent="teal"
          sub="Completeness · accuracy · lineage"
        />
        <StatTile
          label="Data providers"
          value={formatNumber(640)}
          delta="22 new"
          deltaPositive
          icon={Building2}
          accent="violet"
          sub="Verified contributing orgs"
        />
        <StatTile
          label="Total volume"
          value={formatBytes(totalBytes)}
          delta="1.2 PB"
          deltaPositive
          icon={HardDrive}
          accent="cyan"
          sub="Under management"
        />
      </section>

      {/* ===================================================== Filter bar */}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search datasets, providers, tags…"
              className="w-full rounded-xl border border-edge/70 bg-elevated/50 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              <span className="font-semibold text-slate-300 data-mono">{filtered.length}</span> of {DATASETS.length} datasets
            </span>
            {activeFilters > 0 && (
              <button onClick={resetFilters} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200">
                <X className="h-3 w-3" /> Clear ({activeFilters})
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-slate-500">Category</span>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-slate-500">License</span>
            {LICENSES.map((l) => (
              <Chip key={l} label={l} active={license === l} onClick={() => setLicense(l)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs uppercase tracking-wider text-slate-500">Modality</span>
            {MODALITIES.map((m) => (
              <Chip key={m} label={m} active={modality === m} onClick={() => setModality(m)} />
            ))}
          </div>
        </div>
      </Card>

      {/* ===================================================== Dataset grid */}
      {filtered.length === 0 ? (
        <Card className="grid place-items-center gap-2 p-12 text-center">
          <Search className="h-6 w-6 text-slate-600" />
          <p className="text-sm text-slate-400">No datasets match these filters.</p>
          <button onClick={resetFilters} className="btn-ghost mt-1">
            Reset filters
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const a = ACCENT[d.accent]
            const isSel = d.id === selectedId
            return (
              <Card
                key={d.id}
                hover
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'flex cursor-pointer flex-col p-5',
                  isSel && 'ring-1 ring-emerald-500/40',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{d.modality}</Badge>
                      {d.anonymized && (
                        <Badge variant="success">
                          <ShieldCheck className="h-3 w-3" /> Anonymized
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2.5 truncate font-semibold text-slate-100">{d.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.provider} · {d.category}
                    </p>
                  </div>
                  <RingProgress
                    value={d.quality}
                    accent={d.accent}
                    size={52}
                    stroke={5}
                    label={<span className="text-[11px] font-semibold text-slate-200 data-mono">{d.quality}</span>}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-edge/50 py-3 text-center">
                  <div>
                    <div className="text-sm font-semibold text-slate-100 data-mono">
                      {formatNumber(d.records, { compact: true })}
                    </div>
                    <div className="text-[11px] text-slate-500">records</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100 data-mono">{formatBytes(d.sizeGB * GB)}</div>
                    <div className="text-[11px] text-slate-500">size</div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-sm font-semibold text-slate-100 data-mono">
                      <Download className="h-3 w-3 text-slate-500" />
                      {formatNumber(d.downloads)}
                    </div>
                    <div className="text-[11px] text-slate-500">downloads</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-elevated/60 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-inset ring-edge/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <Badge variant={LICENSE_VARIANT[d.license]}>{d.license}</Badge>
                  <Stars rating={d.rating} />
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className={cn('text-lg font-bold tracking-tight', a.text)}>{priceLabel(d.price)}</div>
                    {d.price !== null && d.price > 0 && <div className="text-[11px] text-slate-500">per seat / yr</div>}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(d.id)
                    }}
                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
                  >
                    License
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(d.id)
                    }}
                    className="flex-1 rounded-xl border border-edge/80 bg-elevated/50 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-white"
                  >
                    Preview
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===================================================== Detail panel */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Dataset preview"
          title={selected.name}
          description={`${selected.provider} · ${selected.category} · updated ${selected.updated}`}
          action={<Badge variant={LICENSE_VARIANT[selected.license]}>{selected.license} license</Badge>}
        />
        <div className="grid gap-5 lg:grid-cols-3">
          {/* schema + sample */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Schema & sample"
              subtitle={`${selected.modality} · ${formatNumber(selected.records, { compact: true })} records`}
              icon={Database}
              accent="emerald"
              action={<Badge variant="neutral">{(SCHEMA_BY_CATEGORY[selected.category] ?? DEFAULT_SCHEMA).length} columns</Badge>}
            />
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-4 font-medium">Column</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(SCHEMA_BY_CATEGORY[selected.category] ?? DEFAULT_SCHEMA).map((col, i) => (
                    <tr key={col.name} className="border-b border-edge/40 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-200 data-mono">{col.name}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-md bg-elevated/60 px-2 py-0.5 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-500/20 data-mono">
                          {col.type}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">
                        {i === 0 ? 'Primary key · indexed' : col.type.includes('json') || col.type === 'mask' ? 'Nested / large field' : 'Nullable'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* license terms */}
          <Card>
            <CardHeader title="License terms" subtitle="Standard agreement" icon={ShieldCheck} accent="violet" />
            <div className="divide-y divide-edge/40 px-5 pb-3">
              {licenseTerms(selected).map((t) => (
                <KeyValue key={t.label} label={t.label} value={t.value} />
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="flex items-end justify-between rounded-xl border border-edge/60 bg-elevated/40 px-4 py-3">
                <div>
                  <div className="text-xs text-slate-500">Price</div>
                  <div className="text-lg font-bold tracking-tight text-emerald-300">{priceLabel(selected.price)}</div>
                </div>
                <button className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-400">
                  License now
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* provenance */}
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <GitBranch className="h-4 w-4 text-teal-400" /> Provenance & lineage
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-400">
              Sourced and validated by <span className="text-slate-200">{selected.provider}</span>, then ingested through
              the lakehouse pipeline — schema-mapped to the canonical AEC ontology, quality-scored at{' '}
              <span className="text-slate-200 data-mono">{selected.quality}/100</span>
              {selected.anonymized ? ', and anonymized to strip project- and party-identifying fields' : ''}. Every row
              carries an immutable lineage hash, contributor consent record and full version history.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="success" dot>
                Verified provider
              </Badge>
              <Badge variant="cyan">Lineage tracked</Badge>
              {selected.anonymized && <Badge variant="violet">PII removed</Badge>}
            </div>
          </Card>

          {/* clean room callout */}
          <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-surface/60 to-teal-500/10 p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <IconBadge icon={Lock} accent="emerald" />
              <h3 className="mt-3 font-semibold text-slate-100">Privacy-preserving clean room</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                License the <span className="text-slate-200">insight</span>, not the raw data. Run models and joins
                against this dataset inside an isolated clean room where outputs are released but the underlying records
                never leave the provider&apos;s boundary — so firms collaborate and benchmark without ever exposing
                confidential project information.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="success">
                  <Sparkles className="h-3 w-3" /> Query-only access
                </Badge>
                <Badge variant="cyan">Differential privacy</Badge>
                <Badge variant="violet">Audit logged</Badge>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ===================================================== Providers */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Ecosystem"
          title="Top data providers"
          description="Ranked by total downloads across the marketplace."
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Provider</th>
                  <th className="px-3 py-3 text-right font-medium">Datasets</th>
                  <th className="px-3 py-3 text-right font-medium">Avg. rating</th>
                  <th className="px-5 py-3 text-right font-medium">Total downloads</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((p, i) => (
                  <tr key={p.name} className="border-b border-edge/40 transition-colors last:border-0 hover:bg-elevated/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold data-mono ring-1',
                            i === 0
                              ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
                              : 'bg-elevated/60 text-slate-400 ring-edge/60',
                          )}
                        >
                          {i === 0 ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className="font-medium text-slate-100">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right text-slate-300 data-mono">{p.datasets}</td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1 text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="data-mono">{p.rating.toFixed(1)}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-200 data-mono">{formatNumber(p.downloads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  )
}
