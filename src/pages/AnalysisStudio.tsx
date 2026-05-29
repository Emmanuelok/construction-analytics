import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Microscope,
  Database,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  Columns3,
  Hash,
  Gauge,
  Sparkles,
  BarChart3,
  Download,
  BookmarkCheck,
  Bookmark,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  GitCompare,
  TrendingUp,
  Layers,
  AlertTriangle,
  PieChart,
  ShieldAlert,
  Copy,
  Check,
  Pin,
  FolderKanban,
  Plus,
  X,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { BarSeries, LineTrend, AreaTrend, Donut, ScatterViz } from '@/components/charts'
import { useStudio } from '@/store/studio'
import { type CatalogDataset, type DatasetFile } from '@/data/catalog'
import { parseAny, profile, num, type Table, type ColumnProfile } from '@/lib/parse'
import { analyze, type Finding, type FindingKind } from '@/lib/insights'
import { useWorkspaces } from '@/store/workspaces'
import { downloadText, readFileAsText } from '@/lib/download'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

/* ---------------------------------------------------------------- helpers --- */
const ANALYZABLE_FORMATS = new Set(['CSV', 'JSON', 'GEOJSON', 'TSV'])

type ChartType = 'bar' | 'line' | 'area' | 'donut' | 'scatter'
type Agg = 'sum' | 'avg' | 'count'

type SourceKind = 'catalog' | 'upload'
type Source = { kind: SourceKind; label: string; sub?: string }

/** A dataset is analyzable if it has a CSV/JSON/GeoJSON/TSV file with generate() or content. */
function analyzableFile(d: CatalogDataset): DatasetFile | undefined {
  return d.files.find(
    (f) => ANALYZABLE_FORMATS.has(f.format.toUpperCase()) && (f.generate || f.content != null),
  )
}

const BADGE_FOR_TYPE: Record<ColumnProfile['type'], 'brand' | 'cyan' | 'violet' | 'neutral'> = {
  number: 'brand',
  date: 'cyan',
  boolean: 'violet',
  string: 'neutral',
}

const DONUT_PALETTE = ['violet', 'cyan', 'blue', 'emerald', 'amber', 'rose', 'teal', 'fuchsia'] as const

const FINDING_ICON: Record<FindingKind, typeof GitCompare> = {
  correlation: GitCompare,
  trend: TrendingUp,
  segment: Layers,
  outlier: AlertTriangle,
  concentration: PieChart,
  quality: ShieldAlert,
  overview: Sparkles,
}
const FINDING_LABEL: Record<FindingKind, string> = {
  correlation: 'Correlation',
  trend: 'Trend',
  segment: 'Segment gap',
  outlier: 'Outlier',
  concentration: 'Concentration',
  quality: 'Data quality',
  overview: 'Overview',
}

const fmt = (n: number | undefined) =>
  n == null || Number.isNaN(n) ? '—' : formatNumber(n, { compact: Math.abs(n) >= 10000, digits: Number.isInteger(n) ? 0 : 2 })

function truncate(v: string, max = 28) {
  return v.length > max ? v.slice(0, max - 1) + '…' : v
}

/** Escape + join a chart-data array into CSV text. */
function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}

const SELECT_CLS =
  'w-full rounded-lg border border-edge/70 bg-elevated/60 px-3 py-2 text-sm text-slate-200 focus:border-brand-500/50 focus:outline-none disabled:opacity-50'

/** Labeled control wrapper used across the chart builder. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

/** A <select> of column names, optionally filtered to a profile subset. */
function ColumnSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { name: string }[]
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={SELECT_CLS}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

/* =========================================================== component === */
export default function AnalysisStudio() {
  const { allDatasets } = useStudio()
  const [params] = useSearchParams()

  const analyzable = useMemo(
    () => allDatasets.filter((d) => analyzableFile(d)),
    [allDatasets],
  )

  const [table, setTable] = useState<Table>({ columns: [], rows: [] })
  const [source, setSource] = useState<Source | null>(null)
  const [catalogId, setCatalogId] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  /* ---- load a catalog dataset by id into the working table ---- */
  function loadCatalog(id: string) {
    const d = analyzable.find((x) => x.id === id)
    const file = d && analyzableFile(d)
    if (!d || !file) return
    try {
      const text = file.generate?.() ?? file.content ?? ''
      const parsed = parseAny(text, file.format)
      setTable(parsed)
      setCatalogId(id)
      setSource({ kind: 'catalog', label: d.name, sub: `${d.provider} · ${file.name}` })
      setError('')
      setSaved(false)
    } catch {
      setError('Could not parse that dataset.')
    }
  }

  /* ---- load an uploaded file ---- */
  async function loadUpload(file: File) {
    try {
      const text = await readFileAsText(file)
      const parsed = parseAny(text)
      if (!parsed.columns.length) {
        setError('No columns detected — try a CSV, TSV or JSON file.')
        return
      }
      setTable(parsed)
      setCatalogId('')
      setSource({ kind: 'upload', label: file.name, sub: 'Uploaded from your device' })
      setError('')
      setSaved(false)
    } catch {
      setError('Could not read that file.')
    }
  }

  /* ---- on mount: preload from ?dataset=ID, else first analyzable ---- */
  useEffect(() => {
    const wanted = params.get('dataset')
    const target = (wanted && analyzable.find((d) => d.id === wanted)) || analyzable[0]
    if (target) loadCatalog(target.id)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- profile + derived column groups ---- */
  const cols = useMemo(() => profile(table), [table])
  const numericCols = useMemo(() => cols.filter((c) => c.type === 'number'), [cols])
  const categoricalCols = useMemo(
    () => cols.filter((c) => c.type === 'string' || c.type === 'boolean'),
    [cols],
  )
  const hasData = table.rows.length > 0 && cols.length > 0
  const hasNumeric = numericCols.length > 0

  /* ---- KPIs ---- */
  const avgMissingPct = cols.length
    ? cols.reduce((s, c) => s + (c.count ? c.missing / c.count : 0), 0) / cols.length
    : 0
  const completeness = Math.round((1 - avgMissingPct) * 100)
  const quality = useMemo(() => {
    if (!hasData) return 0
    const richness = Math.min(1, numericCols.length / Math.max(1, cols.length) + 0.35)
    const volume = Math.min(1, table.rows.length / 50)
    return Math.round((completeness / 100) * 0.6 * 100 + richness * 22 + volume * 18)
  }, [hasData, numericCols.length, cols.length, completeness, table.rows.length])

  /* ---- chart builder state ---- */
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [dimKey, setDimKey] = useState('')
  const [measureKey, setMeasureKey] = useState('')
  const [agg, setAgg] = useState<Agg>('sum')
  const [scatterX, setScatterX] = useState('')
  const [scatterY, setScatterY] = useState('')

  /* auto-pick sensible defaults whenever the table changes */
  useEffect(() => {
    if (!hasData) return
    const firstCat = categoricalCols[0]?.name ?? ''
    const firstNum = numericCols[0]?.name ?? ''
    if (firstCat && firstNum) {
      setChartType('bar')
      setDimKey(firstCat)
      setMeasureKey(firstNum)
      setAgg('sum')
    } else if (numericCols.length >= 2) {
      setChartType('scatter')
      setDimKey('')
      setMeasureKey('')
    } else if (firstNum) {
      // numeric only, no second numeric → count by that column as a category
      setChartType('bar')
      setDimKey(firstNum)
      setMeasureKey(firstNum)
      setAgg('count')
    } else if (firstCat) {
      setChartType('bar')
      setDimKey(firstCat)
      setMeasureKey('')
      setAgg('count')
    }
    setScatterX(numericCols[0]?.name ?? '')
    setScatterY(numericCols[1]?.name ?? numericCols[0]?.name ?? '')
  }, [table]) // eslint-disable-line react-hooks/exhaustive-deps

  /* if there are no numeric columns, force count aggregation */
  const effectiveAgg: Agg = hasNumeric && measureKey ? agg : 'count'

  /* ---- aggregated category data (bar / line / area / donut) ---- */
  const aggData = useMemo<{ name: string; value: number }[]>(() => {
    if (!hasData || !dimKey) return []
    const groups = new Map<string, { sum: number; n: number }>()
    for (const row of table.rows) {
      const key = (row[dimKey] ?? '').trim() || '(blank)'
      const bucket = groups.get(key) ?? { sum: 0, n: 0 }
      bucket.n += 1
      if (measureKey) {
        const v = num(row[measureKey] ?? '')
        if (!Number.isNaN(v)) bucket.sum += v
      }
      groups.set(key, bucket)
    }
    const arr = [...groups.entries()].map(([name, b]) => {
      const value =
        effectiveAgg === 'count' ? b.n : effectiveAgg === 'avg' ? (b.n ? b.sum / b.n : 0) : b.sum
      return { name, value: Number.isFinite(value) ? Math.round(value * 100) / 100 : 0 }
    })
    return arr.sort((a, b) => b.value - a.value).slice(0, 12)
  }, [hasData, dimKey, measureKey, effectiveAgg, table])

  /* ---- scatter points ---- */
  const scatterData = useMemo<{ x: number; y: number }[]>(() => {
    if (!hasData || !scatterX || !scatterY) return []
    const pts: { x: number; y: number }[] = []
    for (const row of table.rows) {
      const x = num(row[scatterX] ?? '')
      const y = num(row[scatterY] ?? '')
      if (!Number.isNaN(x) && !Number.isNaN(y)) pts.push({ x, y })
      if (pts.length >= 200) break
    }
    return pts
  }, [hasData, scatterX, scatterY, table])

  const aggLabel = effectiveAgg === 'avg' ? 'average' : effectiveAgg === 'count' ? 'count' : 'total'
  const measureLabel = effectiveAgg === 'count' ? 'records' : measureKey || 'value'
  const chartReady = chartType === 'scatter' ? scatterData.length > 0 : aggData.length > 0

  /* ---- AI narrative (computed from the parsed data) ---- */
  const insight = useMemo(() => {
    if (!hasData) return null
    const top = aggData[0]
    const numCol = numericCols[0]
    const catCol = categoricalCols[0]
    const missingPct = Math.round(avgMissingPct * 100)
    const parts: string[] = []
    parts.push(
      `Across ${formatNumber(table.rows.length)} rows and ${cols.length} columns, this dataset spans ${numericCols.length} numeric, ${categoricalCols.length} categorical and ${cols.filter((c) => c.type === 'date').length} date fields.`,
    )
    if (numCol && numCol.min != null && numCol.max != null) {
      parts.push(
        `"${numCol.name}" ranges ${fmt(numCol.min)}–${fmt(numCol.max)} (avg ${fmt(numCol.mean)}, median ${fmt(numCol.median)}).`,
      )
    }
    if (top && catCol && chartType !== 'scatter') {
      parts.push(
        `The leading ${dimKey || catCol.name} by ${aggLabel} ${measureLabel} is "${truncate(top.name, 40)}" at ${fmt(top.value)}.`,
      )
    } else if (chartType === 'scatter' && scatterData.length) {
      parts.push(`The scatter compares ${scatterX} against ${scatterY} across ${scatterData.length} points.`)
    }
    parts.push(
      missingPct > 0
        ? `${missingPct}% of cells are missing — review completeness before modeling.`
        : `The dataset is fully populated with no missing cells.`,
    )
    return parts.join(' ')
  }, [
    hasData,
    aggData,
    numericCols,
    categoricalCols,
    cols,
    avgMissingPct,
    table.rows.length,
    chartType,
    dimKey,
    aggLabel,
    measureLabel,
    scatterData.length,
    scatterX,
    scatterY,
  ])

  /* ---- statistical insight report (real math over the parsed table) ---- */
  const findings = useMemo<Finding[]>(() => (hasData ? analyze(table, cols, { max: 8 }) : []), [hasData, table, cols])
  const [copied, setCopied] = useState(false)

  /* ---- pin a finding as an evidence-backed hypothesis in a workspace ---- */
  const { workspaces, addHypothesis, create } = useWorkspaces()
  const [pinFor, setPinFor] = useState<Finding | null>(null)
  const [pinnedTo, setPinnedTo] = useState<string | null>(null)

  function hypothesisText(f: Finding): string {
    // Turn a finding title into a testable statement.
    switch (f.kind) {
      case 'correlation':
        return `${f.title} — and the relationship is causal enough to act on.`
      case 'trend':
        return `${f.title}, and the trend will continue.`
      case 'segment':
        return `${f.title} for a structural reason we can address.`
      case 'outlier':
        return `The outliers in ${f.columns[0] ?? 'this column'} are genuine signal, not data errors.`
      default:
        return f.title
    }
  }

  function pin(f: Finding, workspaceId: string) {
    addHypothesis(workspaceId, hypothesisText(f), {
      kind: f.kind,
      stat: f.stat,
      detail: f.detail,
      source: source?.label,
      columns: f.columns,
      at: new Date().toISOString(),
    })
    setPinFor(null)
    setPinnedTo(workspaceId)
    setTimeout(() => setPinnedTo(null), 2400)
  }

  function pinToNew(f: Finding) {
    const id = create({
      title: source ? `Investigate: ${source.label}` : 'New investigation',
      problem: `Explore the finding: ${f.title}.`,
      accent: 'violet',
    })
    pin(f, id)
  }

  function copyReport() {
    const lines = [
      `Insight report — ${source?.label ?? 'dataset'}`,
      `${formatNumber(table.rows.length)} rows × ${cols.length} columns`,
      '',
      ...findings.map((f, i) => `${i + 1}. [${FINDING_LABEL[f.kind]}] ${f.title}${f.stat ? ` (${f.stat})` : ''}\n   ${f.detail}`),
    ]
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800) },
      () => {},
    )
  }

  /* clicking a finding focuses the chart builder on its columns */
  function focusFinding(f: Finding) {
    const [c1, c2] = f.columns
    const isNum = (n: string) => numericCols.some((c) => c.name === n)
    if (f.kind === 'correlation' && c1 && c2 && isNum(c1) && isNum(c2)) {
      setChartType('scatter')
      setScatterX(c1)
      setScatterY(c2)
    } else if (f.kind === 'segment' && c1 && c2) {
      setChartType('bar')
      setDimKey(isNum(c1) ? c2 : c1)
      setMeasureKey(isNum(c1) ? c1 : c2)
      setAgg('avg')
    } else if (f.kind === 'trend' && c1) {
      setChartType('line')
      setDimKey(c2 || c1)
      setMeasureKey(isNum(c1) ? c1 : c2)
      setAgg('avg')
    } else if ((f.kind === 'outlier' || f.kind === 'quality') && c1 && isNum(c1)) {
      setChartType('bar')
      setDimKey(c1)
      setMeasureKey(c1)
      setAgg('count')
    } else if (f.kind === 'concentration' && c1) {
      setChartType('donut')
      setDimKey(c1)
      setMeasureKey('')
      setAgg('count')
    }
    document.getElementById('chart-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ---- suggested-question chips that reconfigure the builder ---- */
  type Suggestion = { label: string; apply: () => void }
  const suggestions = useMemo<Suggestion[]>(() => {
    const list: Suggestion[] = []
    const cat = categoricalCols[0]?.name
    const cat2 = categoricalCols[1]?.name ?? cat
    const numA = numericCols[0]?.name
    const numB = numericCols[1]?.name
    if (cat && numA)
      list.push({
        label: `Total ${numA} by ${cat}`,
        apply: () => {
          setChartType('bar')
          setDimKey(cat)
          setMeasureKey(numA)
          setAgg('sum')
        },
      })
    if (cat2 && numA)
      list.push({
        label: `Average ${numA} by ${cat2}`,
        apply: () => {
          setChartType('line')
          setDimKey(cat2)
          setMeasureKey(numA)
          setAgg('avg')
        },
      })
    if (cat)
      list.push({
        label: `Share of records by ${cat}`,
        apply: () => {
          setChartType('donut')
          setDimKey(cat)
          setMeasureKey('')
          setAgg('count')
        },
      })
    if (numA && numB)
      list.push({
        label: `${numA} vs ${numB}`,
        apply: () => {
          setChartType('scatter')
          setScatterX(numA)
          setScatterY(numB)
        },
      })
    return list.slice(0, 3)
  }, [categoricalCols, numericCols])

  /* ---- export current chart data ---- */
  function exportCsv() {
    if (chartType === 'scatter') {
      if (!scatterData.length) return
      downloadText(
        'analysis.csv',
        toCsv([scatterX, scatterY], scatterData.map((p) => [p.x, p.y])),
        'CSV',
      )
    } else {
      if (!aggData.length) return
      const measureHeader = `${effectiveAgg}_${measureKey || 'count'}`
      downloadText('analysis.csv', toCsv([dimKey, measureHeader], aggData.map((d) => [d.name, d.value])), 'CSV')
    }
  }

  const a = ACCENT.violet
  const previewRows = table.rows.slice(0, 12)
  /* bar / line / area share one prop signature — pick the component by type */
  const CategoryChart = chartType === 'line' ? LineTrend : chartType === 'area' ? AreaTrend : BarSeries

  /* ===================================================== render === */
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Microscope}
        accent="violet"
        eyebrow="Studio"
        title="Analysis Studio"
        description="Bring a dataset, profile its shape and quality, build charts in seconds, surface AI insights, then export the result. A real workspace over the lakehouse — no pipelines, no spreadsheets."
        actions={
          source ? (
            <Badge variant={source.kind === 'upload' ? 'cyan' : 'violet'} dot>
              {source.kind === 'upload' ? 'Uploaded source' : 'Data Center source'}
            </Badge>
          ) : undefined
        }
      />

      {/* ============================================ Data source picker */}
      <Card>
        <CardHeader
          icon={Database}
          accent="violet"
          title="Data source"
          subtitle="Pick a governed dataset or bring your own — we parse it in your browser."
          action={
            source ? (
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium text-slate-200">{truncate(source.label, 34)}</div>
                <div className="text-xs text-slate-500">{source.sub}</div>
              </div>
            ) : undefined
          }
        />
        <div className="grid gap-4 border-t border-edge/50 p-5 lg:grid-cols-2">
          {/* (a) From Data Center */}
          <div className="rounded-xl border border-edge/60 bg-elevated/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Database className={cn('h-4 w-4', a.text)} /> Select from Data Center
            </div>
            <p className="mt-1 text-xs text-slate-500">{analyzable.length} analyzable datasets available.</p>
            <select
              value={catalogId}
              onChange={(e) => loadCatalog(e.target.value)}
              className={cn(SELECT_CLS, 'mt-3')}
            >
              <option value="" disabled>
                Choose a dataset…
              </option>
              {analyzable.map((d) => {
                const f = analyzableFile(d)
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({f?.format})
                  </option>
                )
              })}
            </select>
            <Link to="/data" className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
              Browse the full Data Center <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* (b) Upload your own */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) loadUpload(f)
            }}
            onClick={() => fileInput.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-4 text-center transition-colors',
              dragging ? 'border-brand-500/60 bg-brand-500/5' : 'border-edge/70 bg-elevated/20 hover:border-brand-500/40',
            )}
          >
            <UploadCloud className={cn('h-6 w-6', a.text)} />
            <div className="mt-2 text-sm font-medium text-slate-200">Upload your own</div>
            <p className="mt-0.5 text-xs text-slate-500">
              Drag &amp; drop or click — CSV, TSV, JSON or GeoJSON
            </p>
            {source?.kind === 'upload' && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {truncate(source.label, 24)} · {table.rows.length} rows × {table.columns.length} cols
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.tsv,.json,.geojson,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadUpload(f)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        {error && (
          <div className="border-t border-edge/50 px-5 py-3 text-sm text-rose-300">{error}</div>
        )}
      </Card>

      {!hasData ? (
        <Card className="p-10 text-center">
          <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            No analyzable rows detected. Choose a dataset above or upload a CSV/JSON file to begin.
          </p>
        </Card>
      ) : (
        <>
          {/* ============================================ KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Rows" value={formatNumber(table.rows.length)} icon={Table2} accent="violet" />
            <StatTile label="Columns" value={cols.length} icon={Columns3} accent="blue" />
            <StatTile label="Numeric columns" value={numericCols.length} icon={Hash} accent="cyan" sub={`${categoricalCols.length} categorical`} />
            <StatTile label="Completeness" value={`${completeness}%`} icon={CheckCircle2} accent="emerald" sub="non-missing cells" />
            <StatTile label="Quality score" value={`${quality}`} icon={Gauge} accent="teal" sub="estimated" />
          </div>

          {/* ============================================ Data preview */}
          <Card>
            <CardHeader
              icon={Table2}
              accent="violet"
              title="Data preview"
              subtitle={`First ${previewRows.length} of ${formatNumber(table.rows.length)} rows`}
              action={<Badge variant="neutral">{cols.length} columns</Badge>}
            />
            <div className="overflow-x-auto border-t border-edge/50">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0">
                  <tr className="border-b border-edge/50 bg-panel/95 text-xs uppercase tracking-wide text-slate-500 backdrop-blur">
                    {table.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={cn('border-b border-edge/30 transition-colors hover:bg-elevated/40', i % 2 === 1 && 'bg-elevated/20')}
                    >
                      {table.columns.map((c) => (
                        <td key={c} className="data-mono whitespace-nowrap px-4 py-2.5 text-slate-300" title={row[c]}>
                          {row[c] === '' ? <span className="text-slate-600">—</span> : truncate(row[c] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ============================================ Column profiler */}
          <Card>
            <CardHeader
              icon={Columns3}
              accent="blue"
              title="Column profiler"
              subtitle="Inferred type, completeness, cardinality and numeric range per column"
            />
            <div className="overflow-x-auto border-t border-edge/50">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-edge/50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Column</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Missing</th>
                    <th className="px-5 py-3 font-medium">Unique</th>
                    <th className="px-5 py-3 font-medium">Min</th>
                    <th className="px-5 py-3 font-medium">Mean</th>
                    <th className="px-5 py-3 font-medium">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {cols.map((c) => {
                    const missPct = c.count ? Math.round((c.missing / c.count) * 100) : 0
                    return (
                      <tr key={c.name} className="border-b border-edge/30 transition-colors hover:bg-elevated/40">
                        <td className="px-5 py-3 font-medium text-slate-200">{c.name}</td>
                        <td className="px-5 py-3">
                          <Badge variant={BADGE_FOR_TYPE[c.type]}>{c.type}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="data-mono w-10 text-slate-300">{c.missing}</span>
                            <div className="w-16">
                              <ProgressBar value={100 - missPct} accent={missPct > 25 ? 'rose' : 'emerald'} height="sm" />
                            </div>
                          </div>
                        </td>
                        <td className="data-mono px-5 py-3 text-slate-300">{formatNumber(c.unique)}</td>
                        <td className="data-mono px-5 py-3 text-slate-400">{c.type === 'number' ? fmt(c.min) : '—'}</td>
                        <td className="data-mono px-5 py-3 text-slate-400">{c.type === 'number' ? fmt(c.mean) : '—'}</td>
                        <td className="data-mono px-5 py-3 text-slate-400">{c.type === 'number' ? fmt(c.max) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ============================================ Insight report */}
          <Card className="relative overflow-hidden">
            <div className={cn('pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-20 blur-3xl', a.dot)} />
            <CardHeader
              icon={Sparkles}
              accent="violet"
              title="Insight report"
              subtitle={findings.length ? `${findings.length} findings computed from the data — ranked by significance` : 'Statistical scan of the dataset'}
              action={
                findings.length ? (
                  <button onClick={copyReport} className="btn-ghost h-9 px-3 py-0 text-xs">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy report'}
                  </button>
                ) : undefined
              }
            />
            <div className="border-t border-edge/50 p-5">
              <p className="mb-4 text-[15px] leading-relaxed text-slate-300">{insight}</p>
              {findings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edge/60 bg-elevated/20 p-5 text-center text-sm text-slate-500">
                  No statistically notable patterns surfaced — the dataset may be too small, too uniform, or lack numeric columns to correlate.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {findings.map((f, i) => {
                    const fa = ACCENT[f.accent]
                    const Icon = FINDING_ICON[f.kind]
                    return (
                      <div
                        key={f.id}
                        className="group flex flex-col rounded-xl border border-edge/60 bg-elevated/30 p-4 transition-colors hover:border-brand-500/40 hover:bg-elevated/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1', fa.bg, fa.text, fa.ring)}>
                            <Icon className="h-3 w-3" /> {FINDING_LABEL[f.kind]}
                          </span>
                          {f.stat && <span className="data-mono text-xs text-slate-400">{f.stat}</span>}
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-bold text-slate-500">{i + 1}</span>
                          <h4 className="text-sm font-semibold text-slate-100 group-hover:text-white">{f.title}</h4>
                        </div>
                        <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-400">{f.detail}</p>
                        <div className="mt-3 flex items-center gap-2 border-t border-edge/40 pt-2.5">
                          <button onClick={() => focusFinding(f)} className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200">
                            <BarChart3 className="h-3.5 w-3.5" /> Visualize
                          </button>
                          <button onClick={() => setPinFor(f)} className={cn('ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium', fa.bg, fa.text, 'hover:brightness-125')}>
                            <Pin className="h-3.5 w-3.5" /> Pin to workspace
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="mt-5 border-t border-edge/50 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Lightbulb className="h-3.5 w-3.5" /> Quick views
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => { s.apply(); document.getElementById('chart-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-edge/70 bg-elevated/50 px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-brand-500/50 hover:text-white"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ============================================ Chart builder */}
          <Card id="chart-builder">
            <CardHeader
              icon={BarChart3}
              accent="violet"
              title="Chart builder"
              subtitle="Group, aggregate and visualize any combination of columns"
              action={
                <button onClick={exportCsv} disabled={!chartReady} className="btn-ghost h-9 px-3 py-0 text-xs">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              }
            />
            <div className="border-t border-edge/50 p-5">
              {/* controls */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Chart type">
                  <select value={chartType} onChange={(e) => setChartType(e.target.value as ChartType)} className={SELECT_CLS}>
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="area">Area</option>
                    <option value="donut">Donut</option>
                    <option value="scatter" disabled={numericCols.length < 2}>
                      Scatter{numericCols.length < 2 ? ' (needs 2 numeric)' : ''}
                    </option>
                  </select>
                </Field>

                {chartType === 'scatter' ? (
                  <>
                    <Field label="X axis">
                      <ColumnSelect value={scatterX} onChange={setScatterX} options={numericCols} />
                    </Field>
                    <Field label="Y axis">
                      <ColumnSelect value={scatterY} onChange={setScatterY} options={numericCols} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Dimension (X)">
                      <ColumnSelect value={dimKey} onChange={setDimKey} options={cols} />
                    </Field>
                    <Field label="Measure (Y)">
                      <ColumnSelect
                        value={measureKey}
                        onChange={setMeasureKey}
                        options={numericCols}
                        disabled={!hasNumeric}
                        placeholder={hasNumeric ? undefined : 'No numeric column'}
                      />
                    </Field>
                    <Field label="Aggregation">
                      <select value={effectiveAgg} onChange={(e) => setAgg(e.target.value as Agg)} className={SELECT_CLS}>
                        <option value="sum" disabled={!hasNumeric || !measureKey}>Sum</option>
                        <option value="avg" disabled={!hasNumeric || !measureKey}>Average</option>
                        <option value="count">Count</option>
                      </select>
                    </Field>
                  </>
                )}
              </div>

              {/* chart */}
              <div className="mt-5">
                {!chartReady ? (
                  <div className="grid h-[300px] place-items-center text-sm text-slate-500">
                    Not enough data to plot this combination.
                  </div>
                ) : chartType === 'scatter' ? (
                  <ScatterViz data={scatterData} xKey="x" yKey="y" xName={scatterX} yName={scatterY} height={320} accent="violet" />
                ) : chartType === 'donut' ? (
                  <div className="grid items-center gap-4 sm:grid-cols-2">
                    <Donut
                      data={aggData.slice(0, 8).map((d, i) => ({
                        name: d.name,
                        value: d.value,
                        accent: DONUT_PALETTE[i % DONUT_PALETTE.length],
                      }))}
                      height={300}
                      valueFormatter={(v) => formatNumber(v, { compact: true })}
                    />
                    <div className="space-y-1.5">
                      {aggData.slice(0, 8).map((d, i) => {
                        const acc = ACCENT[DONUT_PALETTE[i % DONUT_PALETTE.length]]
                        return (
                          <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 text-slate-300">
                              <span className={cn('h-2 w-2 shrink-0 rounded-full', acc.dot)} />
                              <span className="truncate">{d.name}</span>
                            </span>
                            <span className="data-mono shrink-0 text-slate-400">{fmt(d.value)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <CategoryChart
                    data={aggData}
                    xKey="name"
                    height={320}
                    series={[{ key: 'value', name: `${aggLabel} ${measureLabel}`, accent: 'violet' }]}
                    valueFormatter={(v) => formatNumber(v, { compact: true })}
                  />
                )}
              </div>
            </div>
          </Card>


          {/* ============================================ Export row */}
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                <Download className={cn('h-5 w-5', a.text)} />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-200">Export this analysis</p>
                <p className="text-xs text-slate-500">
                  Download the {chartType === 'scatter' ? 'plotted points' : 'aggregated series'} as CSV, or pin it to your workspace.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {saved && (
                <Badge variant="success" dot>
                  Saved to workspace
                </Badge>
              )}
              <button onClick={() => setSaved((v) => !v)} className="btn-ghost">
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                {saved ? 'Saved' : 'Save to workspace'}
              </button>
              <button onClick={exportCsv} disabled={!chartReady} className="btn-primary">
                <Download className="h-4 w-4" /> Download CSV
              </button>
            </div>
          </Card>
        </>
      )}

      {/* ---- pin-to-workspace picker ---- */}
      {pinFor &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPinFor(null)} />
            <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-white">
                    <Pin className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-semibold text-slate-100">Pin as a hypothesis</h2>
                </div>
                <button onClick={() => setPinFor(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 px-5 py-5">
                <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3">
                  <p className="text-sm font-medium text-slate-100">{hypothesisText(pinFor)}</p>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Evidence: <span className="data-mono text-slate-400">{pinFor.stat ?? FINDING_LABEL[pinFor.kind]}</span>
                    {source ? ` · ${truncate(source.label, 28)}` : ''}
                  </p>
                </div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Choose a workspace</div>
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {workspaces.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => pin(pinFor, w.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-edge/60 bg-elevated/30 px-3 py-2 text-left hover:border-violet-500/40"
                    >
                      <FolderKanban className="h-4 w-4 shrink-0 text-violet-300" />
                      <span className="flex-1 truncate text-sm text-slate-200">{w.title}</span>
                      <span className="text-[11px] text-slate-500">{w.stage}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => pinToNew(pinFor)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-edge/70 px-3 py-2 text-left text-sm text-slate-300 hover:border-brand-500/40 hover:text-white"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-brand-300" /> Create a new workspace from this finding
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ---- pinned toast ---- */}
      {pinnedTo &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <Link
              to={`/workspaces/${pinnedTo}`}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-surface px-4 py-2.5 text-sm text-slate-200 shadow-2xl hover:border-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Pinned as a hypothesis ·
              <span className="font-medium text-emerald-300">Open workspace</span>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-300" />
            </Link>
          </div>,
          document.body,
        )}
    </div>
  )
}
