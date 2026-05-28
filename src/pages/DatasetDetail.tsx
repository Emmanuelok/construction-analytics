import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Lock,
  Star,
  ShoppingCart,
  Check,
  Microscope,
  ShieldCheck,
  Fingerprint,
  GitBranch,
  FileText,
  Database,
  Calendar,
  HardDrive,
  Server,
} from 'lucide-react'
import { Card, CardHeader, Badge, RingProgress, KeyValue, IconBadge } from '@/components/ui'
import { useStudio } from '@/store/studio'
import type { CatalogDataset, DatasetFile, License } from '@/data/catalog'
import { parseAny, profile } from '@/lib/parse'
import { downloadText } from '@/lib/download'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatCurrency, formatNumber } from '@/lib/format'

const LICENSE_VARIANT: Record<License, 'success' | 'cyan' | 'brand' | 'violet'> = {
  Open: 'success',
  Research: 'cyan',
  Commercial: 'brand',
  Enterprise: 'violet',
}
const LICENSE_TERMS: Record<License, { usage: string; redistribution: string; attribution: string }> = {
  Open: { usage: 'Any use, incl. commercial', redistribution: 'Allowed', attribution: 'Required' },
  Research: { usage: 'Non-commercial research', redistribution: 'Within institution', attribution: 'Required' },
  Commercial: { usage: 'Internal commercial use', redistribution: 'Not allowed', attribution: 'Optional' },
  Enterprise: { usage: 'Org-wide + AI training', redistribution: 'Negotiated', attribution: 'Optional' },
}

const TABULAR = ['CSV', 'JSON', 'GeoJSON', 'TSV', 'XML']

function priceLabel(price: number | null) {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return formatCurrency(price, { compact: false })
}

export default function DatasetDetail() {
  const { id = '' } = useParams()
  const { getAny, owns, inCart, addToCart, license, recordDownload } = useStudio()
  const d: CatalogDataset | undefined = getAny(id)

  const preview = useMemo(() => {
    if (!d) return null
    const file = d.files.find((f) => (f.generate || f.content) && TABULAR.includes(f.format))
    const raw = d.files.find((f) => f.generate || f.content)
    if (file) {
      const text = file.generate?.() ?? file.content ?? ''
      try {
        const table = parseAny(text, file.format)
        return { kind: 'table' as const, table, cols: profile(table).slice(0, 8), fileName: file.name }
      } catch {
        /* fall through */
      }
    }
    if (raw) {
      const text = raw.generate?.() ?? raw.content ?? ''
      return { kind: 'text' as const, text: text.slice(0, 1400), fileName: raw.name }
    }
    return null
  }, [d])

  if (!d) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-slate-400">Dataset not found.</p>
          <Link to="/data" className="btn-primary mt-4 inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to Data Center
          </Link>
        </div>
      </div>
    )
  }

  const a = ACCENT[d.accent]
  const owned = owns(d.id)
  const free = d.price === 0

  function handleDownload(f: DatasetFile) {
    const text = f.generate?.() ?? f.content
    if (!text) return
    downloadText(f.name, text, f.format)
    recordDownload(d!.id, f.name)
  }

  return (
    <div className="space-y-7">
      <Link to="/data" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Data Center
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-edge/60 pb-7">
        <div className="flex items-start gap-4">
          <IconBadge icon={Database} accent={d.accent} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={LICENSE_VARIANT[d.license]}>{d.license}</Badge>
              <Badge variant="neutral">{d.modality}</Badge>
              <Badge variant="neutral">{d.category}</Badge>
              {d.anonymized && <Badge variant="cyan">Anonymized</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50">{d.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              by <span className="text-slate-300">{d.provider}</span> · updated {d.updated}
            </p>
            <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {d.rating || '—'}</span>
              <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {formatNumber(d.downloads)} downloads</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-6 lg:col-span-2">
          <p className="text-[15px] leading-relaxed text-slate-300">{d.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {d.tags.map((t) => (
              <span key={t} className="rounded-md bg-elevated/60 px-2 py-1 text-xs text-slate-400">#{t}</span>
            ))}
          </div>

          {/* Files */}
          <Card>
            <CardHeader icon={FileText} accent={d.accent} title="Files" subtitle={`${d.files.length} file${d.files.length !== 1 ? 's' : ''} in this dataset`} />
            <div className="divide-y divide-edge/40 border-t border-edge/50">
              {d.files.map((f) => {
                const canDownload = (f.free || owned) && (f.generate || f.content)
                const lockedPaid = !f.free && !owned
                return (
                  <div key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold', a.bg, a.text)}>
                      {f.format}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{f.name}</div>
                      <div className="text-xs text-slate-500">
                        {f.size}
                        {f.rows ? ` · ${formatNumber(f.rows)} rows` : ''}
                        {f.free ? ' · free sample' : ' · licensed'}
                      </div>
                    </div>
                    {canDownload ? (
                      <button onClick={() => handleDownload(f)} className="btn-primary !px-3 !py-1.5 !text-xs">
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    ) : lockedPaid ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Lock className="h-3.5 w-3.5" /> License to access
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Server className="h-3.5 w-3.5" /> Delivered via secure transfer
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Preview */}
          {preview && (
            <Card>
              <CardHeader icon={Microscope} accent="violet" title="Data preview" subtitle={preview.fileName}
                action={<Link to={`/analyze?dataset=${d.id}`} className="btn-ghost !px-3 !py-1.5 !text-xs"><Microscope className="h-3.5 w-3.5" /> Analyze</Link>}
              />
              {preview.kind === 'table' ? (
                <div className="overflow-x-auto border-t border-edge/50">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-edge/50 text-slate-500">
                        {preview.table.columns.map((c) => (
                          <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="data-mono">
                      {preview.table.rows.slice(0, 8).map((row, i) => (
                        <tr key={i} className="border-b border-edge/30 hover:bg-elevated/40">
                          {preview.table.columns.map((c) => (
                            <td key={c} className="max-w-[180px] truncate px-3 py-2 text-slate-300">{row[c]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <pre className="overflow-x-auto border-t border-edge/50 px-5 py-4 text-[12px] leading-relaxed text-slate-300">
                  <code className="font-mono">{preview.text}</code>
                </pre>
              )}
              <div className="border-t border-edge/50 px-5 py-2.5 text-xs text-slate-500">
                Showing a sample. Download the free sample file above, or open it in the Analysis Studio.
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-end justify-between">
              <span className={cn('text-3xl font-bold', free ? 'text-emerald-300' : a.text)}>{priceLabel(d.price)}</span>
              <RingProgress value={d.quality} size={56} accent={d.accent} label={<span className="text-xs font-bold text-slate-200">{d.quality}</span>} />
            </div>
            <div className="mt-4 space-y-2">
              {owned ? (
                <div className="btn w-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                  <Check className="h-4 w-4" /> Licensed — downloads unlocked
                </div>
              ) : free ? (
                <button onClick={() => license(d.id)} className="btn-primary w-full">
                  <Download className="h-4 w-4" /> Get for free
                </button>
              ) : (
                <>
                  {inCart(d.id) ? (
                    <Link to="/library" className="btn-primary w-full !bg-emerald-500 hover:!bg-emerald-400">
                      <Check className="h-4 w-4" /> In cart — go to checkout
                    </Link>
                  ) : (
                    <button onClick={() => addToCart(d.id)} className="btn-primary w-full">
                      <ShoppingCart className="h-4 w-4" /> Add to cart
                    </button>
                  )}
                  <button onClick={() => license(d.id)} className="btn-ghost w-full">
                    License now
                  </button>
                </>
              )}
              <Link to={`/analyze?dataset=${d.id}`} className="btn-ghost w-full">
                <Microscope className="h-4 w-4" /> Analyze in Studio
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-200">Dataset facts</h3>
            <div className="mt-2 divide-y divide-edge/40">
              <KeyValue label="Records" value={formatNumber(d.records)} mono />
              <KeyValue label="Size" value={d.sizeGB >= 1000 ? `${(d.sizeGB / 1000).toFixed(1)} TB` : `${d.sizeGB} GB`} mono />
              <KeyValue label="Modality" value={d.modality} />
              <KeyValue label="Updated" value={d.updated} mono />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-200">License terms</h3>
            <div className="mt-2 divide-y divide-edge/40">
              <KeyValue label="Tier" value={d.license} />
              <KeyValue label="Usage" value={LICENSE_TERMS[d.license].usage} />
              <KeyValue label="Redistribution" value={LICENSE_TERMS[d.license].redistribution} />
              <KeyValue label="Attribution" value={LICENSE_TERMS[d.license].attribution} />
            </div>
          </Card>

          <Card className="space-y-3 p-5 text-sm text-slate-400">
            <div className="flex items-center gap-2 font-semibold text-slate-200"><ShieldCheck className="h-4 w-4 text-teal-400" /> Trust & provenance</div>
            <div className="flex items-start gap-2"><Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" /> Contributor-verified, {d.anonymized ? 'anonymized' : 'source-attributed'} data with a quality score of {d.quality}%.</div>
            <div className="flex items-start gap-2"><GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" /> Full lineage from source through ETL, scoring and licensing is retained for audit.</div>
            <div className="flex items-start gap-2"><HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" /> Confidential premium data is aggregated in a clean room before it leaves the owner’s boundary.</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
