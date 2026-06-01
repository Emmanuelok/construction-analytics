import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  FolderKanban,
  Plus,
  Target,
  ArrowRight,
  Sparkles,
  Database,
  FlaskConical,
  Gauge,
  X,
  Wand2,
} from 'lucide-react'
import { Card, PageHeader, StatTile, Badge, ProgressBar } from '@/components/ui'
import { useWorkspaces, workspaceProgress, STAGES, TEMPLATES, type Stage } from '@/store/workspaces'
import { SECTORS } from '@/lib/intelligence'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'

const STAGE_VARIANT: Record<Stage, 'neutral' | 'cyan' | 'violet' | 'warn' | 'success'> = {
  frame: 'neutral',
  assemble: 'cyan',
  analyze: 'violet',
  decide: 'warn',
  produce: 'success',
}

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useWorkspaces()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [metric, setMetric] = useState('')
  const [sectors, setSectors] = useState<string[]>([])

  if (!open) return null
  const toggle = (s: string) => setSectors((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))

  function submit() {
    const id = create({ title: title.trim() || 'Untitled workspace', problem: problem.trim(), metric: metric.trim(), sectors })
    onClose()
    navigate(`/workspaces/${id}`)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-8 w-full max-w-lg overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-white">
              <FolderKanban className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-100">New workspace</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cut embodied carbon on Tower A" className="w-full rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">What's the problem?</label>
            <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} placeholder="Describe the problem in plain language — the copilot will suggest data, hypotheses & next steps." className="w-full resize-none rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Target metric (optional)</label>
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="e.g. −30% embodied carbon" className="w-full rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Sectors</label>
            <div className="flex flex-wrap gap-1.5">
              {SECTORS.map((s) => (
                <button key={s} onClick={() => toggle(s)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', sectors.includes(s) ? 'border-violet-500/50 bg-violet-500/15 text-violet-100' : 'border-edge/70 bg-elevated/40 text-slate-400 hover:text-slate-200')}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-edge/60 px-5 py-4">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary"><Sparkles className="h-4 w-4" /> Create & open</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Workspaces() {
  const { workspaces, createFromTemplate } = useWorkspaces()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)

  const stats = useMemo(() => {
    const avg = workspaces.length ? Math.round(workspaces.reduce((s, w) => s + workspaceProgress(w), 0) / workspaces.length) : 0
    const datasets = new Set(workspaces.flatMap((w) => w.datasetIds)).size
    const hyps = workspaces.reduce((s, w) => s + w.hypotheses.length, 0)
    return { avg, datasets, hyps }
  }, [workspaces])

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FolderKanban}
        accent="violet"
        eyebrow="Studio"
        title="Workspaces"
        description="Problem-driven project spaces — frame a problem, assemble the right data, analyze it, decide, and ship. Your copilot suggests datasets, hypotheses and next steps at every stage."
        actions={
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New workspace
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Active workspaces" value={String(workspaces.length)} icon={FolderKanban} accent="violet" />
        <StatTile label="Avg progress" value={`${stats.avg}%`} icon={Gauge} accent="cyan" />
        <StatTile label="Datasets in play" value={String(stats.datasets)} icon={Database} accent="emerald" />
        <StatTile label="Hypotheses tracked" value={String(stats.hyps)} icon={FlaskConical} accent="amber" />
      </div>

      {/* Templates */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand-300" />
          <h2 className="text-[15px] font-semibold text-slate-100">Start from a template</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TEMPLATES.map((t) => {
            const a = ACCENT[t.accent]
            return (
              <button key={t.id} onClick={() => navigate(`/workspaces/${createFromTemplate(t)}`)} className="text-left">
                <Card className="group flex h-full flex-col p-5" hover>
                  <span className={cn('grid h-9 w-9 place-items-center rounded-xl ring-1', a.bg, a.ring)}>
                    <Target className={cn('h-[18px] w-[18px]', a.text)} />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-slate-100 group-hover:text-white">{t.title}</h3>
                  <p className="mt-1 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-400">{t.problem}</p>
                  <div className={cn('mt-3 inline-flex items-center gap-1 text-xs font-medium', a.text)}>
                    Use template <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      </div>

      {/* Your workspaces */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-violet-300" />
          <h2 className="text-[15px] font-semibold text-slate-100">Your workspaces</h2>
        </div>
        {workspaces.length === 0 ? (
          <Card className="grid place-items-center p-14 text-center text-slate-400">
            <FolderKanban className="h-8 w-8 text-slate-600" />
            <p className="mt-3">No workspaces yet — start from a template above or create your own.</p>
            <button onClick={() => setModal(true)} className="btn-primary mt-4"><Plus className="h-4 w-4" /> New workspace</button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((w) => {
              const a = ACCENT[w.accent]
              const progress = workspaceProgress(w)
              return (
                <Link key={w.id} to={`/workspaces/${w.id}`}>
                  <Card className="group flex h-full flex-col p-5" hover>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={STAGE_VARIANT[w.stage]} dot>{STAGES.find((s) => s.id === w.stage)?.label}</Badge>
                      <span className="data-mono text-xs text-slate-500">{progress}%</span>
                    </div>
                    <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold text-slate-100 group-hover:text-white">{w.title}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-400">{w.problem || 'No problem statement yet.'}</p>
                    {w.metric && (
                      <div className={cn('mt-2 inline-flex items-center gap-1.5 text-xs', a.text)}>
                        <Target className="h-3.5 w-3.5" /> {w.metric}
                      </div>
                    )}
                    <div className="mt-3"><ProgressBar value={progress} accent={w.accent} /></div>
                    <div className="mt-3 flex items-center gap-3 border-t border-edge/50 pt-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Database className="h-3.5 w-3.5" /> {w.datasetIds.length}</span>
                      <span className="inline-flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> {w.hypotheses.length}</span>
                      <span className="ml-auto inline-flex items-center gap-1 text-slate-400 group-hover:text-slate-200">Open <ArrowRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <CreateModal open={modal} onClose={() => setModal(false)} />
    </div>
  )
}
