import { useMemo, useState } from 'react'
import {
  FileText,
  ScanText,
  Sparkles,
  AlertTriangle,
  FileStack,
  MessageSquareWarning,
  Clock,
  BookOpenCheck,
  Layers,
  ListChecks,
  ShieldAlert,
  Tag,
  Eraser,
  FileSearch,
  GitCompare,
} from 'lucide-react'
import { PageHeader, StatTile, Card, CardHeader, Badge, FeatureRow } from '@/components/ui'
import { BarSeries, AreaTrend } from '@/components/charts'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { parseDocument, KIND_LABEL, type EntityKind, type Severity, type Modal } from '@/lib/docparse'

const ACC: Accent = 'amber'

const DOC_TYPES: { type: string; count: number; accent: Accent }[] = [
  { type: 'Drawings', count: 486_000, accent: 'amber' },
  { type: 'Specifications', count: 312_000, accent: 'blue' },
  { type: 'Contracts', count: 64_000, accent: 'violet' },
  { type: 'Submittals', count: 198_000, accent: 'cyan' },
  { type: 'RFIs', count: 142_000, accent: 'rose' },
  { type: 'Reports', count: 98_000, accent: 'emerald' },
]

const RFI_TREND = [
  { month: 'Jul', rfis: 142 }, { month: 'Aug', rfis: 168 }, { month: 'Sep', rfis: 210 },
  { month: 'Oct', rfis: 254 }, { month: 'Nov', rfis: 232 }, { month: 'Dec', rfis: 198 },
  { month: 'Jan', rfis: 276 }, { month: 'Feb', rfis: 312 }, { month: 'Mar', rfis: 288 },
  { month: 'Apr', rfis: 264 }, { month: 'May', rfis: 241 },
]

const SAMPLES: Record<string, string> = {
  Specification:
    'SECTION 03 30 00 — CAST-IN-PLACE CONCRETE. Concrete for structural elements shall conform to ASTM C39 and EN 206 with a minimum 28-day characteristic compressive strength of C40/50. The maximum water-cement ratio shall not exceed 0.45. Cement content shall be no less than 360 kg/m³. Surface tolerance shall be ±3 mm measured over a 3 m straightedge. Curing shall be maintained for a minimum of 7 days. All work shall be inspected in accordance with Section 01 45 00.',
  Contract:
    'The Contractor shall achieve Practical Completion by 2026-09-30. The Contractor shall pay liquidated damages of USD 45,000 per calendar day of delay beyond the completion milestone. Any failure to remedy a material breach within 14 days may result in termination of this agreement. The Contractor must indemnify the Employer against all claims, losses and penalties arising from non-compliance. Disputes shall be referred to adjudication.',
  RFI:
    'RFI-1244 — Fire rating at grid C4. Request for information: please confirm whether the 2-hour fire-resistance rating per ASTM E119 applies to the W12 partition shown on A-501. The specification Section 07 81 00 requires SFRM thickness verification. A response is required by 12/06/2026 to avoid delay to the L24 deck pour.',
}

const KIND_ACCENT: Record<EntityKind, Accent> = {
  money: 'emerald', date: 'sky', duration: 'amber', standard: 'blue',
  section: 'violet', reference: 'rose', measurement: 'cyan', party: 'fuchsia',
}
const SEV_VARIANT: Record<Severity, 'danger' | 'warn' | 'neutral'> = { High: 'danger', Medium: 'warn', Low: 'neutral' }
const MODAL_VARIANT: Record<Modal, 'brand' | 'danger' | 'warn' | 'neutral'> = { shall: 'brand', must: 'danger', required: 'warn', will: 'neutral' }
const TYPE_VARIANT: Record<string, 'brand' | 'violet' | 'cyan' | 'success' | 'warn' | 'neutral'> = {
  Specification: 'brand', Contract: 'violet', RFI: 'cyan', Submittal: 'success', Report: 'warn', 'Drawing Note': 'neutral', Unknown: 'neutral',
}

export default function Documents() {
  const [text, setText] = useState<string>(SAMPLES.Specification)
  const doc = useMemo(() => parseDocument(text), [text])
  const docTotal = useMemo(() => DOC_TYPES.reduce((s, d) => s + d.count, 0), [])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FileText}
        accent={ACC}
        eyebrow="Intelligence"
        title="Document Intelligence"
        description="A live extraction workbench. Paste any spec clause, RFI, contract or submittal — it classifies the document, pulls structured entities (money, dates, durations, standards, sections, references, measurements, parties), extracts shall/must requirements and flags risk clauses, in your browser. Real parsing, not a canned demo."
        actions={
          <div className="flex flex-wrap gap-2">
            {Object.keys(SAMPLES).map((k) => (
              <button key={k} onClick={() => setText(SAMPLES[k])} className="btn-ghost h-9 px-3 py-0 text-xs">
                <FileText className="h-3.5 w-3.5" /> {k}
              </button>
            ))}
          </div>
        }
      />

      {/* parsed KPIs — recompute as you type */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Document type" value={doc.docType} icon={Tag} accent={ACC} sub={doc.confidence ? `${doc.confidence}% confidence` : 'paste text to classify'} />
        <StatTile label="Words" value={formatNumber(doc.wordCount)} icon={FileStack} accent="blue" sub={`${doc.sentenceCount} sentences`} />
        <StatTile label="Entities extracted" value={formatNumber(doc.entities.length)} icon={ScanText} accent="cyan" sub={`${doc.entityCounts.length} types`} />
        <StatTile label="Requirements" value={formatNumber(doc.requirements.length)} icon={ListChecks} accent="violet" sub="shall / must / required" />
        <StatTile label="Risk flags" value={formatNumber(doc.risks.length)} icon={ShieldAlert} accent="rose" sub="Contractual & quality risk" />
      </div>

      {/* the workbench: editable source + classification */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Source document — editable"
            subtitle="Type or paste; everything below re-extracts live"
            icon={ScanText}
            accent={ACC}
            action={
              <button onClick={() => setText('')} className="btn-ghost h-9 px-3 py-0 text-xs"><Eraser className="h-3.5 w-3.5" /> Clear</button>
            }
          />
          <div className="border-t border-edge/60 p-5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a spec clause, RFI, contract or submittal here…"
              spellCheck={false}
              className="h-64 w-full resize-y rounded-xl border border-edge/70 bg-elevated/40 p-4 text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            />
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> {doc.summary}
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Classification" subtitle="Inferred from document signals" icon={FileSearch} accent={ACC} />
          <div className="space-y-4 border-t border-edge/60 p-5">
            <div className="flex items-center justify-between">
              <Badge variant={TYPE_VARIANT[doc.docType]} dot>{doc.docType}</Badge>
              <span className="data-mono text-sm text-slate-400">{doc.confidence}% confidence</span>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">Entities by type</div>
              {doc.entityCounts.length ? (
                <div className="space-y-1.5">
                  {doc.entityCounts.map((c) => (
                    <div key={c.kind} className="flex items-center gap-2.5 text-sm">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCENT[KIND_ACCENT[c.kind]].dot)} />
                      <span className="text-slate-300">{KIND_LABEL[c.kind]}</span>
                      <span className="ml-auto data-mono text-slate-400">{c.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No entities detected yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* extracted entities */}
      <Card>
        <CardHeader title="Extracted entities" subtitle="Structured values pulled from the text" icon={Tag} accent={ACC} />
        <div className="border-t border-edge/60 p-5">
          {doc.entities.length ? (
            <div className="space-y-4">
              {doc.entityCounts.map((c) => (
                <div key={c.kind}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
                    <span className={cn('h-2 w-2 rounded-full', ACCENT[KIND_ACCENT[c.kind]].dot)} /> {KIND_LABEL[c.kind]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.entities.filter((e) => e.kind === c.kind).map((e, i) => (
                      <span key={`${e.value}-${i}`} className={cn('rounded-md px-2 py-1 text-xs ring-1 ring-inset data-mono', ACCENT[KIND_ACCENT[c.kind]].bg, ACCENT[KIND_ACCENT[c.kind]].text, ACCENT[KIND_ACCENT[c.kind]].ring)}>
                        {e.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nothing to extract yet — paste a document above.</p>
          )}
        </div>
      </Card>

      {/* requirements + risk registers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requirements register" subtitle="Normative clauses (shall / must / required)" icon={ListChecks} accent="violet" action={<Badge variant="violet">{doc.requirements.length}</Badge>} />
          <div className="border-t border-edge/60 p-5">
            {doc.requirements.length ? (
              <ul className="space-y-2.5">
                {doc.requirements.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <Badge variant={MODAL_VARIANT[r.modal]}>{r.modal}</Badge>
                    <span className="leading-relaxed text-slate-300">{r.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No normative requirements found.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Risk register" subtitle="Flagged contractual & quality risk" icon={ShieldAlert} accent="rose" action={<Badge variant={doc.risks.some((r) => r.severity === 'High') ? 'danger' : 'warn'}>{doc.risks.length}</Badge>} />
          <div className="border-t border-edge/60 p-5">
            {doc.risks.length ? (
              <ul className="space-y-3">
                {doc.risks.map((r, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEV_VARIANT[r.severity]} dot>{r.severity}</Badge>
                      <span className="text-sm font-medium text-slate-200">{r.term}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{r.sentence}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-300"><ShieldAlert className="h-4 w-4" /> No risk clauses detected.</p>
            )}
          </div>
        </Card>
      </div>

      {/* contextual platform analytics */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Document type breakdown" subtitle={`${formatNumber(docTotal)} documents indexed`} icon={FileStack} accent={ACC} />
          <div className="border-t border-edge/60 p-5">
            <BarSeries data={DOC_TYPES} xKey="type" series={[{ key: 'count', name: 'Documents', accent: 'amber' }]} layout="vertical" height={260} valueFormatter={(v) => formatNumber(v, { compact: true })} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="RFI analytics" subtitle="Request-for-information volume & responsiveness" icon={MessageSquareWarning} accent="rose" />
          <div className="border-t border-edge/60 p-5">
            <AreaTrend data={RFI_TREND} xKey="month" series={[{ key: 'rfis', name: 'RFIs raised', accent: 'rose' }]} height={180} valueFormatter={(v) => formatNumber(v)} />
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

      {/* capabilities */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <h3 className="text-[15px] font-semibold text-slate-100">What the engine does</h3>
          <Badge variant="warn">Runs in your browser</Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <FeatureRow icon={ScanText} title="Entity extraction" accent="amber">Pulls money, dates, durations, standards, spec sections, references, measurements and parties from raw text.</FeatureRow>
          <FeatureRow icon={ListChecks} title="Requirement mining" accent="violet">Isolates every normative shall/must/required clause into a reviewable register.</FeatureRow>
          <FeatureRow icon={ShieldAlert} title="Risk flagging" accent="rose">Surfaces liquidated damages, termination, breach, delay and non-compliance language with severity.</FeatureRow>
          <FeatureRow icon={GitCompare} title="Classification" accent="blue">Infers document type from its signals so the right extraction lens is applied.</FeatureRow>
        </div>
      </Card>
    </div>
  )
}
