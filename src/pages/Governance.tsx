import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  FileLock2,
  Database,
  Gauge,
  EyeOff,
  KeyRound,
  ScrollText,
  FileSignature,
  Radar as RadarIcon,
  Grid3x3,
  Lock,
  Workflow,
  ArrowRight,
  Sparkles,
  Coins,
  GitBranch,
  Cpu,
  UserCheck,
  Server,
  Filter,
  Layers,
  Boxes,
} from 'lucide-react'
import {
  PageHeader,
  Card,
  CardHeader,
  StatTile,
  Badge,
  SectionHeading,
  FeatureRow,
  IconBadge,
  Tabs,
} from '@/components/ui'
import { RadarViz } from '@/components/charts'
import { DATASETS } from '@/data/platform'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const ACCENT_NAME = 'teal' as const

/* ----------------------------------------------------------- derived metrics */
const avgQuality = DATASETS.reduce((s, d) => s + d.quality, 0) / DATASETS.length
const anonymizedPct = (DATASETS.filter((d) => d.anonymized).length / DATASETS.length) * 100

/* ------------------------------------------------- data-quality dimensions */
type QualityRow = { metric: string; score: number; target: number }
const QUALITY_DIMENSIONS: QualityRow[] = [
  { metric: 'Completeness', score: 94, target: 98 },
  { metric: 'Accuracy', score: 91, target: 96 },
  { metric: 'Consistency', score: 88, target: 95 },
  { metric: 'Timeliness', score: 83, target: 90 },
  { metric: 'Validity', score: 92, target: 97 },
  { metric: 'Uniqueness', score: 96, target: 99 },
]

/* ----------------------------------------------------- permission matrix */
type Access = 'Full' | 'Masked' | 'None'
const ROLES = ['Owner', 'Contractor', 'Designer', 'Supplier', 'AI Licensee', 'Public'] as const
const DOMAINS = ['BIM', 'Cost', 'Contracts', 'Field', 'Personal Data'] as const
type Role = (typeof ROLES)[number]
type Domain = (typeof DOMAINS)[number]

const MATRIX: Record<Role, Record<Domain, Access>> = {
  Owner: { BIM: 'Full', Cost: 'Full', Contracts: 'Full', Field: 'Full', 'Personal Data': 'Masked' },
  Contractor: { BIM: 'Full', Cost: 'Masked', Contracts: 'Masked', Field: 'Full', 'Personal Data': 'Masked' },
  Designer: { BIM: 'Full', Cost: 'Masked', Contracts: 'None', Field: 'Masked', 'Personal Data': 'None' },
  Supplier: { BIM: 'Masked', Cost: 'None', Contracts: 'None', Field: 'Masked', 'Personal Data': 'None' },
  'AI Licensee': { BIM: 'Masked', Cost: 'Masked', Contracts: 'None', Field: 'Masked', 'Personal Data': 'None' },
  Public: { BIM: 'None', Cost: 'None', Contracts: 'None', Field: 'None', 'Personal Data': 'None' },
}

const ACCESS_META: Record<Access, { cls: string; label: string }> = {
  Full: { cls: 'bg-emerald-500/12 text-emerald-300 ring-emerald-500/25', label: 'Full' },
  Masked: { cls: 'bg-amber-500/12 text-amber-300 ring-amber-500/25', label: 'Masked' },
  None: { cls: 'bg-slate-500/10 text-slate-500 ring-slate-400/15', label: 'None' },
}

/* --------------------------------------------------------------- lineage */
const LINEAGE: { icon: typeof Database; label: string; accent: Accent }[] = [
  { icon: Server, label: 'Source', accent: 'sky' },
  { icon: Filter, label: 'Ingest', accent: 'blue' },
  { icon: Workflow, label: 'Transform', accent: 'violet' },
  { icon: Gauge, label: 'Quality-score', accent: 'cyan' },
  { icon: EyeOff, label: 'Anonymize', accent: 'teal' },
  { icon: Layers, label: 'Dataset', accent: 'emerald' },
  { icon: UserCheck, label: 'Consumer', accent: 'amber' },
]

/* --------------------------------------------------------- license tiers */
type LicenseRow = {
  tier: string
  rights: string
  redistribution: 'Yes' | 'No' | 'Limited'
  attribution: 'Required' | 'Optional'
  price: string
  accent: Accent
}
const LICENSE_TIERS: LicenseRow[] = [
  { tier: 'Open', rights: 'View, download, internal use', redistribution: 'Yes', attribution: 'Required', price: 'Free', accent: 'sky' },
  { tier: 'Research', rights: 'Non-commercial analysis & publication', redistribution: 'Limited', attribution: 'Required', price: 'Free / credits', accent: 'cyan' },
  { tier: 'Commercial', rights: 'Commercial analytics & products', redistribution: 'No', attribution: 'Optional', price: 'Per-seat / usage', accent: 'emerald' },
  { tier: 'Enterprise', rights: 'Org-wide use, AI training, clean rooms', redistribution: 'No', attribution: 'Optional', price: 'Negotiated', accent: 'violet' },
]

/* ------------------------------------------------------------ audit feed */
type AuditEvent = {
  actor: string
  action: string
  dataset: string
  time: string
  result: 'Allowed' | 'Masked' | 'Denied'
}
const AUDIT: AuditEvent[] = [
  { actor: 'Apex Engineering', action: 'License download', dataset: 'Labeled Structural Drawings Corpus', time: '2m ago', result: 'Allowed' },
  { actor: 'AI Licensee · NeuralBuild', action: 'Clean-room query', dataset: 'Global Cost Benchmarks — Commercial', time: '14m ago', result: 'Masked' },
  { actor: 'Supplier · Vertex Curtain Wall', action: 'Access request', dataset: 'Schedule Outcomes — 38k Projects', time: '38m ago', result: 'Denied' },
  { actor: 'Owner · Meridian Holdings', action: 'Policy update', dataset: 'Building Operations Telemetry', time: '1h ago', result: 'Allowed' },
  { actor: 'Designer · Helix Studio', action: 'PII re-identification attempt', dataset: 'RFI → Response Pairs (NLP)', time: '2h ago', result: 'Denied' },
  { actor: 'Contractor · BuildCorp', action: 'Lineage export', dataset: 'Defect & NCR Image Set', time: '3h ago', result: 'Allowed' },
]

const RESULT_VARIANT: Record<AuditEvent['result'], 'success' | 'warn' | 'danger'> = {
  Allowed: 'success',
  Masked: 'warn',
  Denied: 'danger',
}

/* ------------------------------------------------------- clean-room cards */
const CLEAN_ROOM: { icon: typeof Lock; title: string; body: string; accent: Accent }[] = [
  { icon: Lock, title: 'Privacy-preserving aggregation', body: 'Contributors never expose raw records. Queries run inside clean rooms returning only differentially-private, aggregated results.', accent: 'teal' },
  { icon: Coins, title: 'Contributor monetization', body: 'Every dataset carries usage-based royalties, so firms get paid each time their governed data trains a model or answers a query.', accent: 'emerald' },
  { icon: FileSignature, title: 'Clear ownership & licensing', body: 'Machine-readable licenses bind ownership, consent and permitted use to the data itself — settling the confidentiality deadlock.', accent: 'cyan' },
]

/* ------------------------------------------------------------- AI features */
const AI_FEATURES: { icon: typeof Gauge; title: string; body: string; accent: Accent }[] = [
  { icon: Gauge, title: 'Data quality scoring', body: 'Continuously scores completeness, accuracy, consistency and validity, gating low-trust records before they reach consumers.', accent: 'cyan' },
  { icon: EyeOff, title: 'Privacy protection', body: 'Detects PII and commercially-sensitive fields, then applies masking, k-anonymity and differential privacy automatically.', accent: 'teal' },
  { icon: KeyRound, title: 'Permission management', body: 'Attribute-based access control resolves every request against role, domain, license and consent in real time.', accent: 'emerald' },
  { icon: ScrollText, title: 'License enforcement & audit', body: 'Immutable, tamper-evident logs prove who accessed what, under which license — assurance-ready for any auditor.', accent: 'sky' },
]

const MATRIX_TABS = [
  { id: 'matrix', label: 'Access matrix', icon: Grid3x3 },
  { id: 'lineage', label: 'Data lineage', icon: GitBranch },
]

export default function Governance() {
  const [view, setView] = useState<string>('matrix')

  const deniedEvents = useMemo(() => AUDIT.filter((a) => a.result === 'Denied').length, [])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Data Platform"
        title="Governance & Trust"
        description="Permissions, anonymization, ownership, lineage, licensing and audit — the trust layer that finally makes confidential AEC data shareable. Clean rooms, machine-readable licenses and contributor royalties dissolve the data-sharing deadlock."
        accent={ACCENT_NAME}
        actions={
          <>
            <Badge variant="success" dot>
              SOC 2 · GDPR
            </Badge>
            <button className="btn-ghost">
              <FileLock2 className="h-4 w-4" /> Access policy
            </button>
          </>
        }
      />

      {/* ===================================================== KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatTile
          label="Datasets governed"
          value={formatNumber(1842)}
          delta="124"
          deltaPositive
          icon={Database}
          accent="teal"
          sub="Under active policy"
        />
        <StatTile
          label="Avg. quality score"
          value={`${avgQuality.toFixed(1)}%`}
          delta="0.8 pts"
          deltaPositive
          icon={Gauge}
          accent="cyan"
          sub="Across all domains"
        />
        <StatTile
          label="Anonymization"
          value={`${Math.round(anonymizedPct)}%`}
          delta="6 pts"
          deltaPositive
          icon={EyeOff}
          accent="emerald"
          sub="Coverage of records"
        />
        <StatTile
          label="Access policies"
          value="318"
          delta="22"
          deltaPositive
          icon={KeyRound}
          accent="sky"
          sub="Attribute-based rules"
        />
        <StatTile
          label="Audit events"
          value={`${formatNumber(48200, { compact: true })}`}
          delta="9.4%"
          deltaPositive
          icon={ScrollText}
          accent="violet"
          sub="Trailing 30 days"
        />
        <StatTile
          label="License agreements"
          value="1,206"
          delta="58"
          deltaPositive
          icon={FileSignature}
          accent="amber"
          sub="Active contracts"
        />
      </section>

      {/* ===================================================== Quality + matrix/lineage */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Data quality dimensions"
            subtitle="Trust scored on six dimensions vs target"
            icon={RadarIcon}
            accent="cyan"
          />
          <div className="px-3 pb-5">
            <RadarViz
              data={QUALITY_DIMENSIONS}
              series={[
                { key: 'score', name: 'Score', accent: 'teal' },
                { key: 'target', name: 'Target', accent: 'cyan' },
              ]}
              height={300}
            />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title={view === 'matrix' ? 'Permission & access matrix' : 'Data lineage'}
            subtitle={
              view === 'matrix'
                ? 'Role × data domain — Full, Masked or None'
                : 'From raw source to governed consumer, every hop recorded'
            }
            icon={view === 'matrix' ? Grid3x3 : GitBranch}
            accent="teal"
            action={<Tabs tabs={MATRIX_TABS} active={view} onChange={setView} />}
          />
          {view === 'matrix' ? (
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-2 font-medium">Role</th>
                    {DOMAINS.map((d) => (
                      <th key={d} className="px-2 py-2 text-center font-medium">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => (
                    <tr key={role}>
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-200">{role}</td>
                      {DOMAINS.map((d) => {
                        const access = MATRIX[role][d]
                        const meta = ACCESS_META[access]
                        return (
                          <td key={d} className="px-1 py-1">
                            <div
                              className={cn(
                                'rounded-lg px-2 py-1.5 text-center text-xs font-medium ring-1 ring-inset',
                                meta.cls,
                              )}
                            >
                              {meta.label}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                {(['Full', 'Masked', 'None'] as Access[]).map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5">
                    <span className={cn('h-2.5 w-2.5 rounded-sm ring-1 ring-inset', ACCESS_META[a].cls)} />
                    {ACCESS_META[a].label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-5 pb-6 pt-2">
              <div className="flex flex-wrap items-center gap-y-4">
                {LINEAGE.map((step, i) => (
                  <div key={step.label} className="flex items-center">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <IconBadge icon={step.icon} accent={step.accent} />
                      <span className="text-xs font-medium text-slate-300">{step.label}</span>
                    </div>
                    {i < LINEAGE.length - 1 && (
                      <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-slate-600" />
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-lg border border-edge/60 bg-elevated/40 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
                Every transformation is captured as immutable lineage — buyers see exactly how a dataset was
                derived, scored and anonymized, while contributors retain provenance over their source data.
              </p>
            </div>
          )}
        </Card>
      </section>

      {/* ===================================================== Clean room callout */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="The #2 unsolved pain point"
          title="Why firms can finally share confidential data"
          description="Confidentiality and unclear ownership freeze the industry's most valuable data. Clean rooms, machine-readable licensing and contributor monetization remove every reason to keep it locked away."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {CLEAN_ROOM.map((c) => (
            <Card key={c.title} className="p-6" hover>
              <IconBadge icon={c.icon} accent={c.accent} size="lg" />
              <h3 className="mt-4 font-semibold text-slate-100">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===================================================== License tiers */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="Licensing"
          title="License tiers"
          description="Clear, machine-readable usage rights attached to every dataset — from fully open to negotiated enterprise terms."
        />
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-edge/60 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Tier</th>
                  <th className="px-3 py-3 font-medium">Usage rights</th>
                  <th className="px-3 py-3 font-medium">Redistribution</th>
                  <th className="px-3 py-3 font-medium">Attribution</th>
                  <th className="px-5 py-3 text-right font-medium">Price model</th>
                </tr>
              </thead>
              <tbody>
                {LICENSE_TIERS.map((t) => (
                  <tr
                    key={t.tier}
                    className="border-b border-edge/40 transition-colors last:border-0 hover:bg-elevated/40"
                  >
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2 font-medium text-slate-100">
                        <span className={cn('h-2 w-2 rounded-full', ACCENT[t.accent].dot)} />
                        {t.tier}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-300">{t.rights}</td>
                    <td className="px-3 py-3.5">
                      <Badge
                        variant={t.redistribution === 'Yes' ? 'success' : t.redistribution === 'Limited' ? 'warn' : 'neutral'}
                      >
                        {t.redistribution}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 text-slate-300">{t.attribution}</td>
                    <td className="px-5 py-3.5 text-right text-slate-200 data-mono">{t.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ===================================================== Audit feed */}
      <section className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Audit log"
            subtitle="Tamper-evident access events across the platform"
            icon={ScrollText}
            accent="teal"
            action={<Badge variant="danger">{deniedEvents} denied</Badge>}
          />
          <div className="divide-y divide-edge/40">
            {AUDIT.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1', ACCENT.teal.bg, ACCENT.teal.ring)}>
                  <Cpu className={cn('h-4 w-4', ACCENT.teal.text)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-200">{e.action}</div>
                  <div className="truncate text-xs text-slate-500">
                    {e.actor} · {e.dataset}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-500 data-mono">{e.time}</span>
                <Badge variant={RESULT_VARIANT[e.result]}>{e.result}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Trust posture"
            subtitle="Live compliance & control coverage"
            icon={Boxes}
            accent="emerald"
          />
          <div className="space-y-3 px-5 pb-5">
            {[
              { label: 'SOC 2 Type II controls', value: 'Passing', variant: 'success' as const },
              { label: 'GDPR / CCPA readiness', value: 'Compliant', variant: 'success' as const },
              { label: 'Encryption (at rest & transit)', value: 'AES-256', variant: 'cyan' as const },
              { label: 'PII auto-redaction', value: 'Enabled', variant: 'success' as const },
              { label: 'Open re-identification risks', value: '0', variant: 'success' as const },
              { label: 'Policy violations (30d)', value: '3 blocked', variant: 'warn' as const },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 rounded-lg border border-edge/50 bg-elevated/30 px-3.5 py-2.5"
              >
                <span className="text-sm text-slate-300">{row.label}</span>
                <Badge variant={row.variant}>{row.value}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ===================================================== AI capabilities */}
      <section className="space-y-4">
        <SectionHeading
          eyebrow="AI capabilities"
          title="What the engine automates"
          description="Governance is enforced by models, not paperwork — every record is scored, protected, permissioned and logged the moment it enters the platform."
        />
        <Card className="p-6">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {AI_FEATURES.map((f) => (
              <FeatureRow key={f.title} icon={f.icon} title={f.title} accent={f.accent}>
                {f.body}
              </FeatureRow>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-edge/50 pt-5 text-xs text-slate-500">
            <Sparkles className={cn('h-3.5 w-3.5', ACCENT.teal.text)} />
            Controls are auditable end-to-end and map to SOC 2, ISO 27001, GDPR and CSRD evidence requirements.
          </div>
        </Card>
      </section>
    </div>
  )
}
