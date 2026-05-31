import { useState } from 'react'
import {
  Database,
  Plus,
  Workflow,
  ShieldCheck,
  Layers,
  Boxes,
  FileText,
  CalendarClock,
  HardHat,
  ScanEye,
  Leaf,
  Building2,
  Cpu,
  CheckCircle2,
  RefreshCw,
  CircleSlash,
  Gauge,
  Network,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, ProgressBar, FeatureRow } from '@/components/ui'
import { AreaTrend, RadarViz } from '@/components/charts'
import { INGESTION_SERIES, DOMAIN_AREAS } from '@/data/platform'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { ImportWorkbench } from '@/components/ImportWorkbench'

const CONNECTORS = [
  { name: 'Autodesk Revit / ACC', kind: 'BIM', status: 'live', icon: Boxes },
  { name: 'IFC 2x3 / 4.3', kind: 'BIM', status: 'live', icon: Boxes },
  { name: 'Navisworks', kind: 'BIM', status: 'live', icon: Boxes },
  { name: 'Primavera P6 / MSP', kind: 'Schedule', status: 'live', icon: CalendarClock },
  { name: 'Procore', kind: 'Field', status: 'live', icon: HardHat },
  { name: 'SAP / Oracle ERP', kind: 'Finance', status: 'live', icon: Database },
  { name: 'Bluebeam / PDF specs', kind: 'Documents', status: 'live', icon: FileText },
  { name: 'Drone / OpenSpace', kind: 'Reality', status: 'live', icon: ScanEye },
  { name: 'LiDAR point clouds', kind: 'Reality', status: 'syncing', icon: ScanEye },
  { name: 'BMS / IoT telemetry', kind: 'Operations', status: 'live', icon: Cpu },
  { name: 'Esri ArcGIS', kind: 'Geospatial', status: 'live', icon: Network },
  { name: 'EC3 / One Click LCA', kind: 'ESG', status: 'planned', icon: Leaf },
]

const MEDALLION = [
  { tier: 'Bronze', label: 'Raw landing zone', desc: 'Native files & exports captured verbatim with full fidelity — Revit, IFC, PDFs, point clouds, IoT streams.', records: '4.7B', accent: 'amber' as const, icon: Layers },
  { tier: 'Silver', label: 'Standardized & cleaned', desc: 'ETL/ELT, schema mapping, unit normalization and classification crosswalks applied across 24 domains.', records: '3.9B', accent: 'sky' as const, icon: Workflow },
  { tier: 'Gold', label: 'Governed & analytics-ready', desc: 'Quality-scored, anonymized, lineage-tracked datasets ready for analytics, AI training and licensing.', records: '2.4B', accent: 'emerald' as const, icon: ShieldCheck },
]

const QUALITY_RADAR = [
  { metric: 'Completeness', score: 95, target: 98 },
  { metric: 'Accuracy', score: 93, target: 97 },
  { metric: 'Consistency', score: 91, target: 96 },
  { metric: 'Timeliness', score: 96, target: 95 },
  { metric: 'Validity', score: 94, target: 97 },
  { metric: 'Uniqueness', score: 97, target: 98 },
]

const STATUS_MAP = {
  live: { label: 'Live', variant: 'success' as const, icon: CheckCircle2 },
  syncing: { label: 'Syncing', variant: 'cyan' as const, icon: RefreshCw },
  planned: { label: 'Planned', variant: 'neutral' as const, icon: CircleSlash },
}

export default function Lakehouse() {
  const [domainQuery, setDomainQuery] = useState('')
  const domains = DOMAIN_AREAS.filter((d) => d.name.toLowerCase().includes(domainQuery.toLowerCase()))

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Database}
        accent="sky"
        eyebrow="Data Platform"
        title="Data Lakehouse"
        description="Ingest, standardize, govern and serve structured, semi-structured and unstructured AEC data at scale — one open, queryable source of truth no authoring tool can be."
        actions={
          <>
            <Badge variant="cyan" dot>
              18.4 PB under management
            </Badge>
            <button className="btn-primary">
              <Plus className="h-4 w-4" /> Connect a source
            </button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Data volume" value="18.4 PB" delta="6.2%" deltaPositive icon={Layers} accent="violet" sub="vs last month" />
        <StatTile label="Records unified" value="4.7B" delta="9.1%" deltaPositive icon={Database} accent="sky" />
        <StatTile label="Sources connected" value="640" delta="14" deltaPositive icon={Network} accent="cyan" sub="across 12 connector types" />
        <StatTile label="Avg quality score" value="93.6%" delta="1.4%" deltaPositive icon={Gauge} accent="emerald" />
        <StatTile label="Ingested / day" value="62 TB" delta="3.0%" deltaPositive icon={Workflow} accent="blue" />
      </div>

      {/* Operable ingestion: map any table → canonical schema → validate → send on */}
      <ImportWorkbench />

      {/* Ingestion trend */}
      <Card>
        <CardHeader
          icon={Workflow}
          accent="sky"
          title="Ingestion throughput"
          subtitle="Monthly volume by data class (TB)"
          action={
            <div className="hidden items-center gap-3 text-xs sm:flex">
              {[
                { l: 'Structured', a: 'sky' as const },
                { l: 'Unstructured', a: 'blue' as const },
                { l: 'Models', a: 'violet' as const },
              ].map((s) => (
                <span key={s.l} className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className={cn('h-2 w-2 rounded-full', ACCENT[s.a].dot)} />
                  {s.l}
                </span>
              ))}
            </div>
          }
        />
        <div className="px-3 pb-4">
          <AreaTrend
            data={INGESTION_SERIES}
            xKey="month"
            height={280}
            valueFormatter={(v) => `${v} TB`}
            series={[
              { key: 'structured', name: 'Structured', accent: 'sky' },
              { key: 'unstructured', name: 'Unstructured', accent: 'blue' },
              { key: 'models', name: 'Models', accent: 'violet' },
            ]}
          />
        </div>
      </Card>

      {/* Medallion architecture */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="section-label">Medallion architecture</div>
            <h2 className="mt-1.5 text-lg font-semibold text-slate-100">Raw → standardized → governed</h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {MEDALLION.map((m, i) => {
            const a = ACCENT[m.accent]
            return (
              <Card key={m.tier} className="relative overflow-hidden p-5" hover>
                <div className={cn('absolute right-0 top-0 h-20 w-20 rounded-full opacity-20 blur-2xl', a.dot)} />
                <div className="flex items-center justify-between">
                  <span className={cn('grid h-10 w-10 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                    <m.icon className={cn('h-5 w-5', a.text)} />
                  </span>
                  <span className="data-mono text-xs text-slate-600">0{i + 1}</span>
                </div>
                <h3 className={cn('mt-4 text-sm font-bold uppercase tracking-wide', a.text)}>{m.tier}</h3>
                <p className="text-sm font-medium text-slate-200">{m.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{m.desc}</p>
                <div className="mt-4 flex items-center justify-between border-t border-edge/50 pt-3 text-xs">
                  <span className="text-slate-500">Records</span>
                  <span className="data-mono font-semibold text-slate-200">{m.records}</span>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Connectors + quality */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Network} accent="cyan" title="Source connectors" subtitle="Bidirectional sync into the common schema" />
          <div className="grid gap-px overflow-hidden border-t border-edge/50 bg-edge/40 sm:grid-cols-2">
            {CONNECTORS.map((c) => {
              const s = STATUS_MAP[c.status as keyof typeof STATUS_MAP]
              return (
                <div key={c.name} className="flex items-center gap-3 bg-panel/80 px-5 py-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-elevated text-slate-400">
                    <c.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-200">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.kind}</div>
                  </div>
                  <Badge variant={s.variant} dot>
                    {s.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader icon={Gauge} accent="emerald" title="Data quality" subtitle="Six-dimension scoring" />
          <div className="px-3 pb-2">
            <RadarViz
              data={QUALITY_RADAR}
              height={260}
              series={[
                { key: 'score', name: 'Current', accent: 'emerald' },
                { key: 'target', name: 'Target', accent: 'teal' },
              ]}
            />
          </div>
          <div className="border-t border-edge/50 px-5 py-3 text-center text-xs text-slate-500">
            Every record carries a composite quality score that gates promotion to Gold and marketplace listing.
          </div>
        </Card>
      </div>

      {/* Domain coverage */}
      <Card>
        <CardHeader
          icon={Layers}
          accent="blue"
          title="24 AEC data domains"
          subtitle="Mapped to a unified ontology with cross-standard classification"
          action={
            <input
              value={domainQuery}
              onChange={(e) => setDomainQuery(e.target.value)}
              placeholder="Filter domains…"
              className="w-44 rounded-lg border border-edge/70 bg-elevated/60 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-brand-500/50 focus:outline-none"
            />
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Domain</th>
                <th className="px-5 py-3 font-medium">Example data categories</th>
                <th className="px-5 py-3 font-medium">AI capability</th>
                <th className="px-5 py-3 font-medium">Quality</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d, i) => {
                const a = ACCENT[d.accent]
                const q = 84 + ((i * 7) % 14)
                return (
                  <tr key={d.name} className="border-b border-edge/30 transition-colors hover:bg-elevated/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', a.dot)} />
                        <span className="font-medium text-slate-200">{d.name}</span>
                      </div>
                    </td>
                    <td className="max-w-[280px] px-5 py-3.5 text-slate-400">{d.categories}</td>
                    <td className="max-w-[240px] px-5 py-3.5 text-slate-400">{d.capabilities}</td>
                    <td className="w-40 px-5 py-3.5">
                      <ProgressBar value={q} accent={d.accent} showValue height="sm" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ETL capabilities */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureRow icon={Workflow} title="ETL / ELT pipelines" accent="sky">
          Declarative, versioned transforms with replay and backfill.
        </FeatureRow>
        <FeatureRow icon={Layers} title="Schema mapping" accent="blue">
          OmniClass · Uniclass · MasterFormat · CoClass crosswalks.
        </FeatureRow>
        <FeatureRow icon={ShieldCheck} title="Quality scoring" accent="emerald">
          Six-dimension scoring gates promotion and listing.
        </FeatureRow>
        <FeatureRow icon={Building2} title="Open table format" accent="violet">
          Time-travel, ACID and open access via SQL & API.
        </FeatureRow>
      </div>
    </div>
  )
}
