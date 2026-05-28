import { useMemo, useState } from 'react'
import {
  FileText,
  FileInput,
  Search,
  ScanText,
  FileSearch,
  GitCompare,
  Sparkles,
  AlertTriangle,
  FileStack,
  MessageSquareWarning,
  Clock,
  FileCheck2,
  BookOpenCheck,
  Layers,
} from 'lucide-react'
import {
  PageHeader,
  StatTile,
  Card,
  CardHeader,
  Badge,
  KeyValue,
  FeatureRow,
} from '@/components/ui'
import { BarSeries, AreaTrend } from '@/components/charts'
import { type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const ACC: Accent = 'amber'

/* --------------------------------------------------------- doc type counts */
const DOC_TYPES: { type: string; count: number; accent: Accent }[] = [
  { type: 'Drawings', count: 486_000, accent: 'amber' },
  { type: 'Specifications', count: 312_000, accent: 'blue' },
  { type: 'Contracts', count: 64_000, accent: 'violet' },
  { type: 'Submittals', count: 198_000, accent: 'cyan' },
  { type: 'RFIs', count: 142_000, accent: 'rose' },
  { type: 'Reports', count: 98_000, accent: 'emerald' },
]

/* ------------------------------------------------------------ search demo */
const QUERY_CHIPS = ['Find fire-rating specs', 'Show all concrete mix designs', 'Contracts with LD clauses']
type Result = { name: string; snippet: string; relevance: number; type: string; variant: 'brand' | 'violet' | 'cyan' | 'success' }
const SEARCH_RESULTS: Result[] = [
  {
    name: 'Spec 078100 — Applied Fireproofing.pdf',
    snippet: '…structural members shall achieve a 2-hour fire-resistance rating per ASTM E119, with SFRM thickness verified by…',
    relevance: 98,
    type: 'Specification',
    variant: 'brand',
  },
  {
    name: 'Spec 033000 — Cast-in-Place Concrete.pdf',
    snippet: '…Mix C40/50 with minimum cement content 360 kg/m³, w/c ratio ≤ 0.45, and 28-day characteristic strength of…',
    relevance: 94,
    type: 'Specification',
    variant: 'brand',
  },
  {
    name: 'Main Contract — Schedule of Damages.docx',
    snippet: '…liquidated damages of USD 45,000 per calendar day of delay beyond the Section 4 completion milestone…',
    relevance: 91,
    type: 'Contract',
    variant: 'violet',
  },
  {
    name: 'A-501 Wall Type Schedule.dwg',
    snippet: '…Type W12: 2 layers 16mm fire-rated board each side, UL U419 assembly, STC 54 / 2-hr rated partition…',
    relevance: 87,
    type: 'Drawing',
    variant: 'cyan',
  },
]

/* ------------------------------------------------------- conflict finder */
type Severity = 'High' | 'Medium' | 'Low'
const SEV_VARIANT: Record<Severity, 'danger' | 'warn' | 'neutral'> = {
  High: 'danger',
  Medium: 'warn',
  Low: 'neutral',
}
const CONFLICTS: { ref: string; docA: string; docB: string; description: string; severity: Severity }[] = [
  { ref: '§ 033000 / A-201', docA: 'Concrete Spec', docB: 'Foundation Plan', description: 'Spec calls C40/50; drawing schedule notes C32/40 for pile caps.', severity: 'High' },
  { ref: '§ 078100 / A-501', docA: 'Fireproofing Spec', docB: 'Wall Schedule', description: '2-hr rating specified; W08 partition detail shows 1-hr assembly.', severity: 'High' },
  { ref: '§ 092900 / I-110', docA: 'Gypsum Board Spec', docB: 'Interior Elevation', description: 'Moisture-resistant board required in wet areas; elevation shows standard board.', severity: 'Medium' },
  { ref: '§ 230923 / M-304', docA: 'BMS Spec', docB: 'Mechanical Schedule', description: 'Specified VAV count (124) exceeds scheduled units (118).', severity: 'Medium' },
  { ref: '§ 087100 / A-640', docA: 'Door Hardware Spec', docB: 'Door Schedule', description: 'Exit device grade BHMA A156.3 Grade 1; schedule lists Grade 2 on egress doors.', severity: 'Low' },
]

/* ------------------------------------------------- extraction sample */
const EXTRACTED_ENTITIES: { label: string; value: string }[] = [
  { label: 'Section number', value: '03 30 00' },
  { label: 'Material', value: 'Cast-in-place concrete' },
  { label: 'Strength class', value: 'C40/50' },
  { label: 'Standard reference', value: 'ASTM C39 / EN 206' },
  { label: 'Tolerance', value: '± 3 mm / 3 m' },
  { label: 'Cement content', value: '≥ 360 kg/m³' },
]
const SAMPLE_CLAUSE =
  'Cast-in-place concrete for structural elements shall conform to ASTM C39 with a minimum 28-day characteristic compressive strength of C40/50. Maximum water-cement ratio shall not exceed 0.45. Surface tolerance shall be ±3 mm measured over a 3 m straightedge.'

/* ------------------------------------------------------------ RFI analytics */
const RFI_TREND = [
  { month: 'Jul', rfis: 142 },
  { month: 'Aug', rfis: 168 },
  { month: 'Sep', rfis: 210 },
  { month: 'Oct', rfis: 254 },
  { month: 'Nov', rfis: 232 },
  { month: 'Dec', rfis: 198 },
  { month: 'Jan', rfis: 276 },
  { month: 'Feb', rfis: 312 },
  { month: 'Mar', rfis: 288 },
  { month: 'Apr', rfis: 264 },
  { month: 'May', rfis: 241 },
]

const AI_CAPABILITIES: { icon: typeof Sparkles; title: string; body: string; accent: Accent }[] = [
  { icon: ScanText, title: 'Document intelligence', body: 'OCR, layout parsing and entity extraction turn scanned drawings and PDFs into structured data.', accent: 'amber' },
  { icon: FileSearch, title: 'Specification search', body: 'Semantic search across every spec section, standard reference and clause in natural language.', accent: 'blue' },
  { icon: GitCompare, title: 'Drawing comparison', body: 'Detect revisions and silent changes between drawing versions and flag downstream impacts.', accent: 'cyan' },
  { icon: BookOpenCheck, title: 'Automated summarization', body: 'Condense contracts, reports and submittal logs into decision-ready briefs with citations.', accent: 'violet' },
]

export default function Documents() {
  const [query, setQuery] = useState('')

  const docTotal = useMemo(() => DOC_TYPES.reduce((s, d) => s + d.count, 0), [])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FileText}
        accent={ACC}
        eyebrow="Intelligence Engines"
        title="Document Intelligence"
        description="Make unstructured drawings, specs, contracts, RFIs, submittals and reports machine-readable — then cross-check them against one another to surface conflicts before they reach the field."
        actions={
          <button className="btn-ghost">
            <FileInput className="h-4 w-4" /> Ingest documents
          </button>
        }
      />

      {/* ----------------------------------------------------------- KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Documents processed" value="1.2M" delta="8.4%" deltaPositive icon={FileStack} accent="amber" sub="Across all projects" />
        <StatTile label="Pages OCR'd" value="48.6M" delta="6.1%" deltaPositive icon={ScanText} accent="blue" sub="Including scans" />
        <StatTile label="Extraction accuracy" value="96.8%" delta="1.2%" deltaPositive icon={FileCheck2} accent="emerald" sub="Validated entities" />
        <StatTile label="RFIs analyzed" value={formatNumber(142_000)} delta="4.7%" deltaPositive icon={MessageSquareWarning} accent="rose" sub="With response pairs" />
        <StatTile label="Specs indexed" value={formatNumber(312_000)} delta="3.3%" deltaPositive icon={BookOpenCheck} accent="violet" sub="Clause-level" />
      </div>

      {/* ------------------------------------------------ doc type + semantic search */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Document type breakdown" subtitle={`${formatNumber(docTotal)} documents indexed`} icon={FileStack} accent={ACC} />
          <div className="border-t border-edge/60 p-5">
            <BarSeries
              data={DOC_TYPES}
              xKey="type"
              series={[{ key: 'count', name: 'Documents', accent: 'amber' }]}
              layout="vertical"
              height={260}
              valueFormatter={(v) => formatNumber(v, { compact: true })}
            />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Semantic search" subtitle="Ask in plain language across every document type" icon={Search} accent={ACC} />
          <div className="border-t border-edge/60 p-5">
            <div className="flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 focus-within:border-amber-500/50">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Find all fire-rating specifications…"
                className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-xs text-slate-500 hover:text-slate-300">
                  Clear
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUERY_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => setQuery(c)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    query === c
                      ? 'border-amber-500/50 bg-amber-500/12 text-amber-200'
                      : 'border-edge/70 bg-surface/60 text-slate-400 hover:border-amber-500/40 hover:text-slate-200',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {SEARCH_RESULTS.map((r) => (
                <div key={r.name} className="rounded-xl border border-edge/60 bg-elevated/30 p-3.5 transition-colors hover:border-amber-500/30">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-200">{r.name}</span>
                    <span className="data-mono shrink-0 text-xs text-amber-300">{r.relevance}% match</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{r.snippet}</p>
                  <div className="mt-2">
                    <Badge variant={r.variant}>{r.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------- conflict finder */}
      <Card>
        <CardHeader
          title="Spec-vs-drawing conflict finder"
          subtitle="Automatically detected disagreements between documents"
          icon={AlertTriangle}
          accent="rose"
          action={<Badge variant="danger" dot>{CONFLICTS.length} open</Badge>}
        />
        <div className="overflow-x-auto border-t border-edge/60">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Clause / ref</th>
                <th className="px-5 py-3 font-medium">Document A</th>
                <th className="px-5 py-3 font-medium">Document B</th>
                <th className="px-5 py-3 font-medium">Conflict</th>
                <th className="px-5 py-3 text-right font-medium">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {CONFLICTS.map((c) => (
                <tr key={c.ref} className="transition-colors hover:bg-elevated/40">
                  <td className="px-5 py-3 data-mono text-slate-300">{c.ref}</td>
                  <td className="px-5 py-3 text-slate-400">{c.docA}</td>
                  <td className="px-5 py-3 text-slate-400">{c.docB}</td>
                  <td className="px-5 py-3 text-slate-300">{c.description}</td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant={SEV_VARIANT[c.severity]} dot>
                      {c.severity}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ------------------------------------------------- extraction sample */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Extraction sample" subtitle="Raw spec clause → structured entities" icon={ScanText} accent={ACC} />
          <div className="border-t border-edge/60 p-5">
            <div className="rounded-xl border border-edge/60 bg-elevated/30 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                <FileText className="h-3.5 w-3.5" /> Source clause — Spec 03 30 00
              </div>
              <p className="text-sm italic leading-relaxed text-slate-300">“{SAMPLE_CLAUSE}”</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Extracted entities
            </div>
            <div className="mt-3 divide-y divide-edge/50">
              {EXTRACTED_ENTITIES.map((e) => (
                <KeyValue key={e.label} label={e.label} value={e.value} mono />
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="RFI analytics" subtitle="Request-for-information volume & responsiveness" icon={MessageSquareWarning} accent="rose" />
          <div className="border-t border-edge/60 p-5">
            <AreaTrend
              data={RFI_TREND}
              xKey="month"
              series={[{ key: 'rfis', name: 'RFIs raised', accent: 'rose' }]}
              height={180}
              valueFormatter={(v) => formatNumber(v)}
            />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3 text-center">
                <Clock className="mx-auto h-4 w-4 text-amber-400" />
                <div className="mt-2 data-mono text-lg font-semibold text-slate-100">6.4d</div>
                <div className="text-[11px] text-slate-500">Avg. response</div>
              </div>
              <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3 text-center">
                <AlertTriangle className="mx-auto h-4 w-4 text-rose-400" />
                <div className="mt-2 data-mono text-lg font-semibold text-slate-100">18%</div>
                <div className="text-[11px] text-slate-500">Overdue</div>
              </div>
              <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3 text-center">
                <Layers className="mx-auto h-4 w-4 text-blue-400" />
                <div className="mt-2 text-sm font-semibold text-slate-100">MEP</div>
                <div className="text-[11px] text-slate-500">Top category</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------ AI capabilities */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <h3 className="text-[15px] font-semibold text-slate-100">AI capabilities</h3>
          <Badge variant="warn">NLP-powered</Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {AI_CAPABILITIES.map((c) => (
            <FeatureRow key={c.title} icon={c.icon} title={c.title} accent={c.accent}>
              {c.body}
            </FeatureRow>
          ))}
        </div>
      </Card>
    </div>
  )
}
