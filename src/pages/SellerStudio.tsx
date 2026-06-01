import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  FileText,
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  BadgeDollarSign,
  KeyRound,
  Lock,
  Sparkles,
  Tag,
  Plus,
  Trash2,
  Eye,
  Store,
  Layers,
  Gauge,
  Files,
  RotateCcw,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  PageHeader,
  StatTile,
  Badge,
  RingProgress,
  SectionHeading,
  KeyValue,
  FeatureRow,
  IconBadge,
} from '@/components/ui'
import { useStudio } from '@/store/studio'
import {
  CATEGORIES,
  MODALITIES,
  type CatalogDataset,
  type DatasetFile,
  type FileFormat,
  type License,
  type Modality,
} from '@/data/catalog'
import { parseAny, profile, type Table } from '@/lib/parse'
import { readFileAsText } from '@/lib/download'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

/* ============================================================ constants === */
const ACCENT_KEY = 'lime'
const MAX_CONTENT = 40_000
const TODAY = new Date().toISOString().slice(0, 10)

type UploadedFile = {
  name: string
  format: FileFormat
  sizeLabel: string
  bytes: number
  rows: number
  columns: string[]
  table: Table | null
  text: string
}

type LicenseInfo = { id: License; terms: string; variant: 'success' | 'cyan' | 'violet' | 'warn' }
const LICENSE_INFO: LicenseInfo[] = [
  { id: 'Open', terms: 'Free to use, share & adapt with attribution — maximum reach.', variant: 'success' },
  { id: 'Research', terms: 'Free for non-commercial academic & R&D use only.', variant: 'cyan' },
  { id: 'Commercial', terms: 'Paid per-seat license for use in commercial products.', variant: 'violet' },
  { id: 'Enterprise', terms: 'Negotiated terms, clean-room access & bespoke SLAs.', variant: 'warn' },
]

const REGIONS = ['Global', 'North America', 'Europe', 'Middle East', 'APAC', 'LATAM']

const SELLER_VALUE = [
  { icon: KeyRound, title: 'Keep full ownership', body: 'You retain rights — license, do not surrender, your data.', accent: 'lime' as const },
  { icon: ShieldCheck, title: 'Privacy-preserving clean rooms', body: 'Buyers compute on data without ever exporting raw records.', accent: 'teal' as const },
  { icon: Tag, title: 'Set your license & price', body: 'Open, Research, Commercial or Enterprise — your terms.', accent: 'emerald' as const },
  { icon: BadgeDollarSign, title: 'Get paid per license', body: 'Earn on every download with transparent provenance.', accent: 'amber' as const },
]

const EXT_FORMAT: Record<string, FileFormat> = {
  csv: 'CSV',
  tsv: 'CSV',
  txt: 'CSV',
  json: 'JSON',
  geojson: 'GeoJSON',
  ifc: 'IFC',
  xlsx: 'XLSX',
  pdf: 'PDF',
  png: 'PNG',
  zip: 'ZIP',
}

const FORMAT_MODALITY: Record<FileFormat, Modality> = {
  CSV: 'Tabular',
  XLSX: 'Tabular',
  JSON: 'Document',
  GeoJSON: 'Geospatial',
  IFC: 'BIM Model',
  PDF: 'Document',
  PNG: 'Imagery',
  ZIP: 'Tabular',
}

const TABULAR_FORMATS: FileFormat[] = ['CSV', 'JSON', 'GeoJSON', 'XLSX']

/* ============================================================ helpers === */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'dataset'
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function extOf(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
  return base
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/* ============================================================ STEPPER === */
const STEPS = [
  { n: 1, label: 'Upload', icon: UploadCloud },
  { n: 2, label: 'Describe', icon: Sparkles },
  { n: 3, label: 'License & price', icon: BadgeDollarSign },
  { n: 4, label: 'Review', icon: CheckCircle2 },
]

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = step > s.n
        const active = step === s.n
        return (
          <div key={s.n} className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors',
                active
                  ? 'border-lime-500/40 bg-lime-500/10'
                  : done
                    ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                    : 'border-edge/70 bg-elevated/40',
              )}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ring-1',
                  active
                    ? 'bg-lime-500/15 text-lime-300 ring-lime-500/30'
                    : done
                      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                      : 'bg-elevated text-slate-500 ring-edge/60',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </span>
              <div className="hidden sm:block">
                <div className="text-xs uppercase tracking-wide text-slate-500">Step {s.n}</div>
                <div className={cn('text-sm font-medium', active ? 'text-slate-100' : 'text-slate-400')}>{s.label}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && <span className="hidden h-px w-6 bg-edge/70 sm:block" />}
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================ inputs === */
const inputCls =
  'w-full rounded-lg border border-edge/70 bg-elevated/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-lime-500/50 focus:outline-none focus:ring-1 focus:ring-lime-500/30'
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500'

/* ============================================================ page === */
export default function SellerStudio() {
  const navigate = useNavigate()
  const { listings, publishListing, removeListing } = useStudio()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])

  // Step 2 — describe
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [modality, setModality] = useState<Modality>('Tabular')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [touched, setTouched] = useState(false)

  // Step 3 — license & price
  const [license, setLicense] = useState<License>('Commercial')
  const [price, setPrice] = useState<number>(2500)
  const [onRequest, setOnRequest] = useState(false)
  const [anonymized, setAnonymized] = useState(true)
  const [region, setRegion] = useState<string>('Global')

  // Step 4 — publish
  const [publishedId, setPublishedId] = useState<string | null>(null)

  /* -------------------------------------------------- derived metrics */
  const totalRows = useMemo(() => files.reduce((sum, f) => sum + f.rows, 0), [files])
  const totalBytes = useMemo(() => files.reduce((sum, f) => sum + f.bytes, 0), [files])
  const allColumns = useMemo(() => {
    const set = new Set<string>()
    files.forEach((f) => f.columns.forEach((c) => set.add(c)))
    return Array.from(set)
  }, [files])

  const schema = useMemo(() => {
    const table = files.find((f) => f.table && f.table.columns.length)?.table
    return table ? profile(table) : []
  }, [files])

  const quality = useMemo(() => {
    const tabular = files.filter((f) => f.table && f.table.rows.length)
    if (!tabular.length) return 85
    let missingPctSum = 0
    let cols = 0
    tabular.forEach((f) => {
      profile(f.table as Table).forEach((c) => {
        missingPctSum += c.count ? (c.missing / c.count) * 100 : 0
        cols++
      })
    })
    const avgMissing = cols ? missingPctSum / cols : 0
    return Math.max(60, Math.min(99, Math.round(100 - avgMissing)))
  }, [files])

  const selectedLicense = LICENSE_INFO.find((l) => l.id === license) as LicenseInfo
  const isOpen = license === 'Open'
  const isEnterprise = license === 'Enterprise'
  const effectivePrice: number | null = isOpen ? 0 : isEnterprise && onRequest ? null : price

  /* -------------------------------------------------- file ingestion */
  const ingest = useCallback(async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
    const parsed: UploadedFile[] = []
    for (const file of incoming) {
      const text = await readFileAsText(file)
      const ext = extOf(file.name)
      const format = EXT_FORMAT[ext] ?? 'CSV'
      let table: Table | null = null
      let rows = 0
      let columns: string[] = []
      if (TABULAR_FORMATS.includes(format)) {
        try {
          table = parseAny(text, format)
          rows = table.rows.length
          columns = table.columns
        } catch {
          table = null
        }
      }
      parsed.push({
        name: file.name,
        format,
        sizeLabel: formatBytes(file.size || new Blob([text]).size),
        bytes: file.size || new Blob([text]).size,
        rows,
        columns,
        table,
        text: text.slice(0, MAX_CONTENT),
      })
    }
    setFiles((prev) => {
      const merged = [...prev]
      for (const p of parsed) {
        const idx = merged.findIndex((m) => m.name === p.name)
        if (idx >= 0) merged[idx] = p
        else merged.push(p)
      }
      return merged
    })
  }, [])

  // Auto-fill describe fields the first time files land (if untouched by user).
  const autofill = useCallback((next: UploadedFile[]) => {
    const first = next[0]
    if (!first) return
    setName((cur) => cur || titleFromFileName(first.name))
    setModality(FORMAT_MODALITY[first.format])
    const cols = Array.from(new Set(next.flatMap((f) => f.columns)))
    const rows = next.reduce((s, f) => s + f.rows, 0)
    setDescription(
      (cur) =>
        cur ||
        `${rows ? `${formatNumber(rows)} rows across ${cols.length} fields` : `${next.length} file${next.length > 1 ? 's' : ''}`} of AEC data — ready to license through the Data Center with clear provenance.`,
    )
    setTags((cur) => {
      if (cur.length) return cur
      const suggestions = [...cols.slice(0, 4).map((c) => c.replace(/_/g, '-')), category]
      return Array.from(new Set(suggestions.filter(Boolean))).slice(0, 6)
    })
  }, [category])

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      await ingest(fileList)
    },
    [ingest],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) void handleFiles(e.target.files)
      e.target.value = ''
    },
    [handleFiles],
  )

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const addTag = useCallback(() => {
    const t = tagDraft.trim().replace(/^#/, '')
    if (!t) return
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t]))
    setTagDraft('')
  }, [tagDraft])

  const removeTag = useCallback((t: string) => {
    setTags((prev) => prev.filter((x) => x !== t))
  }, [])

  /* -------------------------------------------------- navigation */
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!files.length) return
      autofill(files)
      setStep(2)
    } else if (step === 2) {
      setTouched(true)
      if (!name.trim()) return
      setStep(3)
    } else if (step === 3) {
      setStep(4)
    }
  }, [step, files, autofill, name])

  const goBack = useCallback(() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1)), [])

  const resetWizard = useCallback(() => {
    setStep(1)
    setFiles([])
    setName('')
    setCategory(CATEGORIES[0])
    setModality('Tabular')
    setDescription('')
    setTags([])
    setTagDraft('')
    setTouched(false)
    setLicense('Commercial')
    setPrice(2500)
    setOnRequest(false)
    setAnonymized(true)
    setRegion('Global')
    setPublishedId(null)
  }, [])

  /* -------------------------------------------------- publish */
  const publish = useCallback(() => {
    const id = `${slugify(name)}-${Date.now().toString(36)}`
    const datasetFiles: DatasetFile[] = files.map((f, i) => ({
      id: `f${i + 1}`,
      name: f.name,
      format: f.format,
      size: f.sizeLabel,
      rows: f.rows || undefined,
      free: true,
      content: f.text,
    }))
    const dataset: CatalogDataset = {
      id,
      name: name.trim(),
      provider: 'You — Independent contributor',
      category,
      modality,
      license,
      price: effectivePrice,
      quality,
      rating: 0,
      downloads: 0,
      records: totalRows,
      sizeGB: Math.max(0.01, Number((totalBytes / 1e9).toFixed(2))),
      anonymized,
      updated: TODAY,
      tags,
      accent: ACCENT_KEY,
      description: description.trim() || `${name.trim()} — published to the Data Center.`,
      files: datasetFiles,
    }
    publishListing(dataset)
    setPublishedId(id)
  }, [name, files, category, modality, license, effectivePrice, quality, totalRows, totalBytes, anonymized, description, tags, publishListing])

  /* -------------------------------------------------- dashboard metrics */
  const dash = useMemo(() => {
    const downloads = listings.reduce((s, l) => s + l.downloads, 0)
    const earnings = listings.reduce((s, l) => s + (l.price ?? 0), 0) * 0.85
    const avgQuality = listings.length ? Math.round(listings.reduce((s, l) => s + l.quality, 0) / listings.length) : 0
    return { count: listings.length, downloads, earnings, avgQuality }
  }, [listings])

  const a = ACCENT[ACCENT_KEY]

  /* ========================================================== render */
  return (
    <div className="space-y-8">
      <PageHeader
        icon={UploadCloud}
        accent={ACCENT_KEY}
        eyebrow="Studio"
        title="Seller Studio"
        description="Monetize your AEC data. Upload files, auto-tag and profile them, set a price & license, and publish to the Data Center — with clear provenance and licensing on every record."
        actions={
          <>
            <Badge variant="success" dot>
              Seller onboarding
            </Badge>
            <Link to="/data" className="btn-ghost">
              <Store className="h-4 w-4" /> View Data Center
            </Link>
          </>
        }
      />

      {/* ---------------------------------------------- seller value strip */}
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SELLER_VALUE.map((v) => (
            <FeatureRow key={v.title} icon={v.icon} title={v.title} accent={v.accent}>
              {v.body}
            </FeatureRow>
          ))}
        </div>
      </Card>

      {/* ---------------------------------------------- wizard */}
      <Card>
        <div className="border-b border-edge/50 p-5">
          <Stepper step={step} />
        </div>

        {/* ===================================================== STEP 1 */}
        {step === 1 && (
          <div className="space-y-5 p-5">
            <SectionHeading
              eyebrow="Step 1"
              title="Upload your data"
              description="Drag & drop files or browse. CSV/TSV, JSON, GeoJSON and IFC are parsed in-browser to detect schema and quality — nothing leaves your device until you publish."
            />
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              className={cn(
                'grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors',
                dragging ? 'border-lime-500/60 bg-lime-500/[0.07]' : 'border-edge/70 bg-elevated/30 hover:border-lime-500/40',
              )}
            >
              <span className={cn('grid h-14 w-14 place-items-center rounded-2xl ring-1', a.bg, a.ring)}>
                <UploadCloud className={cn('h-7 w-7', a.text)} />
              </span>
              <p className="mt-4 text-sm font-medium text-slate-200">
                Drop files here or <span className="text-lime-300">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">CSV · TSV · JSON · GeoJSON · IFC · TXT</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.tsv,.json,.geojson,.ifc,.txt"
                onChange={onInputChange}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-edge/60">
                <div className="flex items-center justify-between bg-elevated/40 px-4 py-2.5 text-xs text-slate-400">
                  <span>
                    {files.length} file{files.length > 1 ? 's' : ''} · {formatNumber(totalRows)} rows · {formatBytes(totalBytes)}
                  </span>
                  <button onClick={() => setFiles([])} className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-300">
                    <Trash2 className="h-3.5 w-3.5" /> Clear all
                  </button>
                </div>
                <ul className="divide-y divide-edge/40">
                  {files.map((f, i) => (
                    <li key={f.name} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-slate-400">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-200">{f.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge variant="neutral">{f.format}</Badge>
                          <span>{f.sizeLabel}</span>
                          {f.rows > 0 && <span>· {formatNumber(f.rows)} rows</span>}
                          {f.columns.length > 0 && <span>· {f.columns.length} cols</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${f.name}`}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-elevated hover:text-rose-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ===================================================== STEP 2 */}
        {step === 2 && (
          <div className="space-y-6 p-5">
            <SectionHeading
              eyebrow="Step 2"
              title="Describe & auto-tag"
              description="We pre-filled details from your files. Refine the name, classification, description and tags."
            />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <div>
                  <label className={labelCls}>Dataset name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mixed-use cost benchmarks" className={inputCls} />
                  {touched && !name.trim() && <p className="mt-1 text-xs text-rose-400">A dataset name is required.</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Modality</label>
                    <select value={modality} onChange={(e) => setModality(e.target.value as Modality)} className={inputCls}>
                      {MODALITIES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="What does this dataset contain and how can buyers use it?"
                    className={cn(inputCls, 'resize-none')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tags</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-full bg-lime-500/10 px-2.5 py-1 text-xs font-medium text-lime-300 ring-1 ring-inset ring-lime-500/25"
                      >
                        {t}
                        <button onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`} className="hover:text-white">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1">
                      <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        placeholder="Add tag…"
                        className="w-28 rounded-full border border-edge/70 bg-elevated/60 px-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:border-lime-500/50 focus:outline-none"
                      />
                      <button onClick={addTag} aria-label="Add tag" className="grid h-6 w-6 place-items-center rounded-full bg-elevated text-slate-400 hover:text-lime-300">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* quality + schema */}
              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-center gap-4">
                    <RingProgress value={quality} accent={ACCENT_KEY} size={76} label={<span className="text-sm font-semibold text-slate-100 data-mono">{quality}%</span>} />
                    <div>
                      <div className="text-sm font-semibold text-slate-100">Data quality</div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {schema.length ? 'Completeness from parsed fields.' : 'Default estimate for non-tabular data.'}
                      </p>
                    </div>
                  </div>
                </Card>
                <Card className="overflow-hidden">
                  <div className="border-b border-edge/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Detected schema {schema.length > 0 && <span className="text-slate-600">· {schema.length} fields</span>}
                  </div>
                  {schema.length > 0 ? (
                    <ul className="max-h-64 divide-y divide-edge/40 overflow-y-auto">
                      {schema.map((c) => (
                        <li key={c.name} className="flex items-center justify-between gap-3 px-4 py-2">
                          <span className="truncate text-sm text-slate-300">{c.name}</span>
                          <Badge variant={c.type === 'number' ? 'cyan' : c.type === 'date' ? 'violet' : c.type === 'boolean' ? 'warn' : 'neutral'}>
                            {c.type}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-slate-500">No tabular schema detected for these files.</p>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== STEP 3 */}
        {step === 3 && (
          <div className="space-y-6 p-5">
            <SectionHeading
              eyebrow="Step 3"
              title="License & price"
              description="Choose how buyers can use your data and what they pay. You can change this anytime after publishing."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LICENSE_INFO.map((l) => {
                const active = l.id === license
                return (
                  <button
                    key={l.id}
                    onClick={() => setLicense(l.id)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-colors',
                      active ? 'border-lime-500/50 bg-lime-500/[0.07]' : 'border-edge/70 bg-elevated/30 hover:border-lime-500/30',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-100">{l.id}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-lime-400" />}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{l.terms}</p>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Price (USD per license)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={isEnterprise && onRequest ? '' : isOpen ? 0 : price}
                      disabled={isOpen || (isEnterprise && onRequest)}
                      onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
                      placeholder={isEnterprise && onRequest ? 'On request' : '0'}
                      className={cn(inputCls, 'disabled:opacity-50')}
                    />
                  </div>
                  {isOpen && <p className="mt-1 text-xs text-slate-500">Open datasets are free for everyone.</p>}
                  {isEnterprise && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={onRequest} onChange={(e) => setOnRequest(e.target.checked)} className="accent-lime-500" />
                      Price on request (negotiated)
                    </label>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Data region</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <Card className="flex items-start gap-3 p-4">
                  <IconBadge icon={Lock} accent="teal" size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-200">Anonymize records</span>
                      <button
                        onClick={() => setAnonymized((v) => !v)}
                        role="switch"
                        aria-checked={anonymized}
                        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', anonymized ? 'bg-lime-500/70' : 'bg-elevated')}
                      >
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', anonymized ? 'left-[22px]' : 'left-0.5')} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Strip project & party identifiers before listing — recommended for shared benchmarks.</p>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <Badge variant={selectedLicense.variant} dot>
                      {license}
                    </Badge>
                    <span className="text-slate-400">·</span>
                    <span className="data-mono">
                      {effectivePrice === null ? 'On request' : effectivePrice === 0 ? 'Free' : formatCurrency(effectivePrice)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{selectedLicense.terms}</p>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== STEP 4 */}
        {step === 4 && (
          <div className="space-y-6 p-5">
            {!publishedId ? (
              <>
                <SectionHeading eyebrow="Step 4" title="Review & publish" description="Confirm the details below, then publish to the Data Center." />
                <div className="grid gap-5 lg:grid-cols-3">
                  <Card className="p-5 lg:col-span-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{name.trim() || 'Untitled dataset'}</h3>
                        <p className="mt-1 text-sm text-slate-400">{description.trim()}</p>
                      </div>
                      <RingProgress value={quality} accent={ACCENT_KEY} size={64} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <Badge key={t} variant="success">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-x-8 gap-y-1 border-t border-edge/50 pt-4 sm:grid-cols-2">
                      <KeyValue label="Provider" value="You — Independent contributor" />
                      <KeyValue label="Category" value={category} />
                      <KeyValue label="Modality" value={modality} />
                      <KeyValue label="License" value={license} />
                      <KeyValue label="Region" value={region} />
                      <KeyValue label="Anonymized" value={anonymized ? 'Yes' : 'No'} />
                      <KeyValue label="Records" value={formatNumber(totalRows)} mono />
                      <KeyValue
                        label="Price"
                        value={effectivePrice === null ? 'On request' : effectivePrice === 0 ? 'Free' : formatCurrency(effectivePrice)}
                        mono
                      />
                    </div>
                  </Card>
                  <Card className="overflow-hidden">
                    <div className="border-b border-edge/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Files · {files.length}
                    </div>
                    <ul className="divide-y divide-edge/40">
                      {files.map((f) => (
                        <li key={f.name} className="flex items-center gap-3 px-4 py-3">
                          <Badge variant="neutral">{f.format}</Badge>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{f.name}</span>
                          <span className="shrink-0 text-xs text-slate-500">{f.sizeLabel}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t border-edge/50 px-4 py-3 text-xs text-slate-500">
                      A downloadable sample of each file ships with your listing.
                    </p>
                  </Card>
                </div>
                <div className="flex justify-end">
                  <button onClick={publish} className="btn-primary">
                    <UploadCloud className="h-4 w-4" /> Publish to Data Center
                  </button>
                </div>
              </>
            ) : (
              <div className="grid place-items-center py-10 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/12 ring-1 ring-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </span>
                <h3 className="mt-5 text-xl font-bold text-slate-50">Published to the Data Center</h3>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                  <span className="text-slate-200">{name.trim()}</span> is now live and discoverable. Its sample files are downloadable by buyers.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button onClick={() => navigate(`/data/${publishedId}`)} className="btn-primary">
                    <Eye className="h-4 w-4" /> View in Data Center
                  </button>
                  <Link to="/data" className="btn-ghost">
                    <Store className="h-4 w-4" /> Browse all datasets
                  </Link>
                  <button onClick={resetWizard} className="btn-ghost">
                    <RotateCcw className="h-4 w-4" /> Publish another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------- footer nav */}
        {!(step === 4 && publishedId) && (
          <div className="flex items-center justify-between border-t border-edge/50 px-5 py-4">
            <button onClick={goBack} disabled={step === 1} className="btn-ghost disabled:opacity-40">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <span className="text-xs text-slate-500">Step {step} of 4</span>
            {step < 4 ? (
              <button onClick={goNext} disabled={step === 1 && files.length === 0} className="btn-primary disabled:opacity-40">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="w-[88px]" />
            )}
          </div>
        )}
      </Card>

      {/* ---------------------------------------------- seller dashboard */}
      <section className="space-y-5">
        <SectionHeading
          eyebrow="Seller dashboard"
          title="Your published datasets"
          description="Track reach and earnings across everything you've listed on the Data Center."
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Your listings" value={formatNumber(dash.count)} icon={Layers} accent="lime" />
          <StatTile label="Total downloads" value={formatNumber(dash.downloads)} icon={Files} accent="cyan" />
          <StatTile label="Est. earnings" value={formatCurrency(dash.earnings)} icon={BadgeDollarSign} accent="emerald" sub="85% net of platform fee" />
          <StatTile label="Avg quality" value={`${dash.avgQuality}%`} icon={Gauge} accent="teal" />
        </div>

        <Card className="overflow-hidden">
          <CardHeader icon={Store} accent="lime" title="Listings" subtitle="Manage what you've published" />
          {listings.length === 0 ? (
            <div className="grid place-items-center border-t border-edge/50 px-6 py-14 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-elevated text-slate-500">
                <UploadCloud className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-medium text-slate-300">No datasets yet</p>
              <p className="mt-1 text-xs text-slate-500">Publish your first dataset above to see it here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-edge/50">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-edge/50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Dataset</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">License</th>
                    <th className="px-5 py-3 font-medium">Price</th>
                    <th className="px-5 py-3 font-medium">Downloads</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="border-b border-edge/30 transition-colors hover:bg-elevated/40">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('h-1.5 w-1.5 rounded-full', ACCENT[l.accent].dot)} />
                          <span className="font-medium text-slate-200">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{l.category}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={(LICENSE_INFO.find((x) => x.id === l.license)?.variant) ?? 'neutral'}>{l.license}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 data-mono">
                        {l.price === null ? 'On request' : l.price === 0 ? 'Free' : formatCurrency(l.price)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300 data-mono">{formatNumber(l.downloads)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/data/${l.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-edge/70 bg-elevated/50 px-2.5 py-1.5 text-xs text-slate-300 hover:border-lime-500/40 hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                          <button
                            onClick={() => removeListing(l.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-edge/70 bg-elevated/50 px-2.5 py-1.5 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
