import {
  BrainCircuit,
  Plus,
  Tags,
  Shuffle,
  GitBranch,
  FlaskConical,
  Lock,
  Boxes,
  FileText,
  Image as ImageIcon,
  Database,
  Cpu,
  Sparkles,
  CheckCircle2,
  Workflow,
  ScanEye,
  Network,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, ProgressBar, FeatureRow, RingProgress } from '@/components/ui'
import { AreaTrend, Donut } from '@/components/charts'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const PIPELINE = [
  { icon: Database, label: 'Curate', accent: 'sky' as const },
  { icon: Tags, label: 'Label', accent: 'amber' as const },
  { icon: Lock, label: 'Anonymize', accent: 'teal' as const },
  { icon: GitBranch, label: 'Version', accent: 'blue' as const },
  { icon: FlaskConical, label: 'Evaluate', accent: 'violet' as const },
  { icon: Sparkles, label: 'License', accent: 'emerald' as const },
]

const AI_DATASETS = [
  { name: 'Classified BIM objects', task: 'Object classification', modality: 'BIM Model', icon: Boxes, examples: 2_100_000, quality: 96, version: 'v4.2', license: 'Commercial', accent: 'blue' as const },
  { name: 'Labeled drawings corpus', task: 'Detection / OCR', modality: 'Imagery', icon: ImageIcon, examples: 482_000, quality: 95, version: 'v3.0', license: 'Commercial', accent: 'amber' as const },
  { name: 'RFI → response pairs', task: 'LLM fine-tuning', modality: 'Document', icon: FileText, examples: 1_280_000, quality: 93, version: 'v2.5', license: 'Commercial', accent: 'fuchsia' as const },
  { name: 'Schedule outcomes', task: 'Forecasting', modality: 'Tabular', icon: Workflow, examples: 38_000, quality: 97, version: 'v5.1', license: 'Enterprise', accent: 'rose' as const },
  { name: 'Defect & NCR images', task: 'Segmentation', modality: 'Imagery', icon: ScanEye, examples: 760_000, quality: 94, version: 'v2.1', license: 'Commercial', accent: 'cyan' as const },
]

const MODEL_REGISTRY = [
  { name: 'clash-predict-xl', task: 'Clash prediction', base: 'GNN', metric: 'F1', value: 0.91, version: 'v1.4', status: 'Production' },
  { name: 'cost-forecast-aec', task: 'Cost forecasting', base: 'Gradient boosting', metric: 'MAPE', value: 6.8, version: 'v2.0', status: 'Production' },
  { name: 'spec-extract-llm', task: 'Spec extraction', base: 'Fine-tuned LLM', metric: 'Exact-match', value: 0.88, version: 'v0.9', status: 'Staging' },
  { name: 'progress-vision', task: 'Progress verification', base: 'ViT', metric: 'mIoU', value: 0.84, version: 'v1.1', status: 'Production' },
  { name: 'delay-risk-net', task: 'Delay prediction', base: 'Temporal CNN', metric: 'AUC', value: 0.89, version: 'v1.0', status: 'Evaluation' },
]

const MODALITY = [
  { name: 'Imagery', value: 38, accent: 'cyan' as const },
  { name: 'Tabular', value: 24, accent: 'rose' as const },
  { name: 'Documents', value: 18, accent: 'amber' as const },
  { name: 'BIM Models', value: 12, accent: 'blue' as const },
  { name: 'Time-series', value: 5, accent: 'sky' as const },
  { name: 'Point clouds', value: 3, accent: 'violet' as const },
]

const TRAINING_SERIES = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => ({
  month: m,
  examples: Math.round(120 + i * 58 + (i % 2) * 24),
  evaluations: Math.round(40 + i * 22),
}))

const STATUS_VARIANT: Record<string, 'success' | 'cyan' | 'warn'> = {
  Production: 'success',
  Staging: 'cyan',
  Evaluation: 'warn',
}

export default function AiStudio() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={BrainCircuit}
        accent="fuchsia"
        eyebrow="Data Platform"
        title="AI Training Studio"
        description="Curate, label, anonymize, version, evaluate and license AEC datasets for model training. The industry is data-rich but AI-poor — this is where its data exhaust becomes a training corpus."
        actions={
          <>
            <Badge variant="violet" dot>
              312 models trained on platform
            </Badge>
            <button className="btn-primary">
              <Plus className="h-4 w-4" /> New dataset
            </button>
          </>
        }
      />

      {/* Why this matters */}
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="section-label" style={{ color: ACCENT.fuchsia.hex }}>
              The AI training-data gap
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-100">
              AEC generates petabytes — yet construction vision datasets rarely exceed 100k images.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Elsewhere, AI is trained on millions of labeled examples. In the built environment, data is trapped in
              PDFs, emails and proprietary tools, and no neutral marketplace exists to pool it. This studio standardizes,
              labels and licenses that data — with provenance — so AEC finally gets the training corpus it lacks.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { v: '6.2M', l: 'Labeled examples ready' },
              { v: '47', l: 'Task-ready datasets' },
              { v: '93.6%', l: 'Avg label quality' },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-edge/60 bg-elevated/40 p-3 text-center">
                <div className="text-xl font-bold text-fuchsia-300">{s.v}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Curated datasets" value="47" delta="6" deltaPositive icon={Database} accent="fuchsia" />
        <StatTile label="Labeled examples" value="6.2M" delta="12%" deltaPositive icon={Tags} accent="amber" />
        <StatTile label="Models trained" value="312" delta="18" deltaPositive icon={Cpu} accent="violet" sub="across licensees" />
        <StatTile label="Avg label quality" value="93.6%" delta="0.8%" deltaPositive icon={CheckCircle2} accent="emerald" />
        <StatTile label="Anonymization" value="100%" icon={Lock} accent="teal" sub="of licensed data" />
      </div>

      {/* Pipeline */}
      <Card className="p-6">
        <div className="section-label mb-5">Dataset lifecycle</div>
        <div className="flex flex-wrap items-center gap-2">
          {PIPELINE.map((p, i) => {
            const a = ACCENT[p.accent]
            return (
              <div key={p.label} className="flex items-center gap-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-edge/60 bg-elevated/40 px-3.5 py-2.5">
                  <span className={cn('grid h-8 w-8 place-items-center rounded-lg ring-1', a.bg, a.ring)}>
                    <p.icon className={cn('h-4 w-4', a.text)} />
                  </span>
                  <span className="text-sm font-medium text-slate-200">{p.label}</span>
                </div>
                {i < PIPELINE.length - 1 && <span className="text-slate-700">→</span>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Datasets + modality */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Database} accent="fuchsia" title="Training-ready datasets" subtitle="Curated, labeled & versioned for AI tasks" />
          <div className="overflow-x-auto border-t border-edge/50">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-edge/50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Dataset</th>
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Examples</th>
                  <th className="px-5 py-3 font-medium">Quality</th>
                  <th className="px-5 py-3 font-medium">Version</th>
                </tr>
              </thead>
              <tbody>
                {AI_DATASETS.map((d) => {
                  const a = ACCENT[d.accent]
                  return (
                    <tr key={d.name} className="border-b border-edge/30 hover:bg-elevated/40">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={cn('grid h-7 w-7 place-items-center rounded-lg', a.bg)}>
                            <d.icon className={cn('h-3.5 w-3.5', a.text)} />
                          </span>
                          <div>
                            <div className="font-medium text-slate-200">{d.name}</div>
                            <div className="text-xs text-slate-500">{d.modality}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{d.task}</td>
                      <td className="px-5 py-3.5 data-mono text-slate-300">{formatNumber(d.examples, { compact: true })}</td>
                      <td className="w-28 px-5 py-3.5">
                        <ProgressBar value={d.quality} accent={d.accent} showValue height="sm" />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="data-mono text-xs text-slate-400">{d.version}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Shuffle} accent="cyan" title="Data by modality" subtitle="Multimodal coverage" />
          <div className="px-3">
            <Donut data={MODALITY} height={220} valueFormatter={(v) => `${v}%`} />
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {MODALITY.map((m) => (
              <div key={m.name} className="flex items-center gap-2 text-xs">
                <span className={cn('h-2 w-2 rounded-full', ACCENT[m.accent].dot)} />
                <span className="text-slate-400">{m.name}</span>
                <span className="ml-auto data-mono text-slate-300">{m.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Training volume + model registry */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader icon={Workflow} accent="violet" title="Training volume" subtitle="Examples served / month (k)" />
          <div className="px-3 pb-4">
            <AreaTrend
              data={TRAINING_SERIES}
              xKey="month"
              height={232}
              valueFormatter={(v) => `${v}k`}
              series={[
                { key: 'examples', name: 'Examples', accent: 'fuchsia' },
                { key: 'evaluations', name: 'Evaluations', accent: 'violet' },
              ]}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Cpu} accent="violet" title="Model registry" subtitle="Models trained & evaluated on platform data" />
          <div className="overflow-x-auto border-t border-edge/50">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-edge/50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium">Task</th>
                  <th className="px-5 py-3 font-medium">Base</th>
                  <th className="px-5 py-3 font-medium">Metric</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_REGISTRY.map((m) => (
                  <tr key={m.name} className="border-b border-edge/30 hover:bg-elevated/40">
                    <td className="px-5 py-3.5">
                      <span className="data-mono text-sm text-slate-200">{m.name}</span>
                      <span className="ml-2 text-xs text-slate-600">{m.version}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">{m.task}</td>
                    <td className="px-5 py-3.5 text-slate-400">{m.base}</td>
                    <td className="px-5 py-3.5">
                      <span className="data-mono text-slate-200">
                        {m.metric} {m.value}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={STATUS_VARIANT[m.status]} dot>
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Capabilities */}
      <div>
        <div className="section-label mb-4">Studio capabilities</div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureRow icon={Tags} title="Auto-labeling" accent="amber">
            Model-assisted labeling with human-in-the-loop review and inter-annotator agreement scoring.
          </FeatureRow>
          <FeatureRow icon={Lock} title="Anonymization" accent="teal">
            PII/commercial redaction, k-anonymity and differential privacy before any data leaves a clean room.
          </FeatureRow>
          <FeatureRow icon={Network} title="Retrieval / RAG" accent="cyan">
            Vector-indexed corpora for retrieval-augmented generation grounded in real project knowledge.
          </FeatureRow>
          <FeatureRow icon={FlaskConical} title="Synthetic data" accent="violet">
            Generate balanced, privacy-safe synthetic examples to fill rare-class and edge-case gaps.
          </FeatureRow>
        </div>
      </div>

      {/* License health */}
      <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-5">
          <RingProgress value={100} accent="emerald" size={84} label={<span className="text-sm font-bold text-emerald-300">100%</span>} />
          <div>
            <h3 className="font-semibold text-slate-100">Every dataset is provenance-tracked & licensed</h3>
            <p className="mt-1 max-w-md text-sm text-slate-400">
              Clear, auditable provenance reduces IP and liability exposure for AI companies — turning trust from a
              blocker into a differentiator.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="success" dot>
            Licensed
          </Badge>
          <Badge variant="cyan" dot>
            Versioned
          </Badge>
          <Badge variant="violet" dot>
            Auditable
          </Badge>
        </div>
      </Card>
    </div>
  )
}
