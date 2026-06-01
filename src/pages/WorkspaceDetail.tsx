import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  FolderKanban,
  Target,
  Pencil,
  Check,
  X,
  Plus,
  Database,
  FlaskConical,
  ListChecks,
  Sparkles,
  Microscope,
  Trash2,
  CircleDot,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  MessageSquarePlus,
  Wand2,
  Loader2,
  AlertTriangle,
  Users,
  LineChart,
  Workflow,
} from 'lucide-react'
import { Card, CardHeader, Badge, ProgressBar, IconBadge } from '@/components/ui'
import { useWorkspaces, workspaceProgress, STAGES, type Stage, type HypothesisStatus } from '@/store/workspaces'
import { useStudio } from '@/store/studio'
import { useProfile } from '@/store/profile'
import { useTeams } from '@/store/teams'
import { recommendForProblem, suggestHypotheses, suggestTasks } from '@/lib/intelligence'
import { analyzeCross, toCrossDatasets, type CrossFinding } from '@/lib/crossdataset'
import { parseAny } from '@/lib/parse'
import { copilotStatus, workspaceCopilot, type WorkspacePlan } from '@/lib/copilot'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

function priceLabel(price: number | null) {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return `$${price.toLocaleString()}`
}

function AddRow({ placeholder, onAdd, icon: Icon = Plus }: { placeholder: string; onAdd: (v: string) => void; icon?: typeof Plus }) {
  const [v, setV] = useState('')
  const submit = () => {
    if (v.trim()) {
      onAdd(v.trim())
      setV('')
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-3 py-2 focus-within:border-violet-500/50">
      <Icon className="h-4 w-4 text-slate-500" />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
      />
      <button onClick={submit} className="rounded-lg bg-elevated px-2 py-1 text-xs text-slate-300 hover:text-white">Add</button>
    </div>
  )
}

const HYP_STATUS: Record<HypothesisStatus, { variant: 'neutral' | 'success' | 'danger'; icon: typeof CircleDot; label: string }> = {
  open: { variant: 'neutral', icon: CircleDot, label: 'Open' },
  validated: { variant: 'success', icon: CheckCircle2, label: 'Validated' },
  rejected: { variant: 'danger', icon: XCircle, label: 'Rejected' },
}

export default function WorkspaceDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const ws = useWorkspaces()
  const { getAny, allDatasets } = useStudio()
  const { profile } = useProfile()
  const { teamsForWorkspace, logWorkspaceActivity } = useTeams()
  const w = ws.get(id)
  const sharedTeams = teamsForWorkspace(id)

  // Workspace mutations that also surface on shared teams' activity feeds.
  function validateHypothesis(hid: string, text: string, status: 'validated' | 'rejected' | 'open') {
    ws.updateHypothesis(id, hid, { status })
    if (status !== 'open') logWorkspaceActivity(id, status === 'validated' ? 'hypothesis_validated' : 'hypothesis_rejected', `${status} “${text.slice(0, 48)}${text.length > 48 ? '…' : ''}”`)
  }
  function attachDataset(datasetId: string) {
    ws.addDataset(id, datasetId)
    const d = getAny(datasetId)
    if (d) logWorkspaceActivity(id, 'dataset_added', `added “${d.name}” to ${w?.title ?? 'a workspace'}`)
  }
  function logNote(text: string) {
    ws.addNote(id, text)
    logWorkspaceActivity(id, 'note_added', `logged a decision in ${w?.title ?? 'a workspace'}`)
  }
  function changeStage(stage: Stage) {
    ws.setStage(id, stage)
    logWorkspaceActivity(id, 'stage_changed', `moved ${w?.title ?? 'a workspace'} to ${STAGES.find((s) => s.id === stage)?.label}`)
  }

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [problem, setProblem] = useState('')
  const [metric, setMetric] = useState('')

  // LLM copilot — gated by a server key; deterministic suggestions are always shown.
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiPlan, setAiPlan] = useState<WorkspacePlan | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  useEffect(() => {
    copilotStatus().then((s) => setAiEnabled(s.enabled))
  }, [])

  async function runAi() {
    if (!w) return
    setAiBusy(true)
    setAiError(null)
    const attached = w.datasetIds.map((dId) => getAny(dId)).filter(Boolean)
    const available = allDatasets.slice(0, 24).map((d) => `- ${d!.name} [${d.category}/${d.modality}]`).join('\n')
    const context = [
      `Problem: ${w.problem || w.title}`,
      w.metric ? `Target metric: ${w.metric}` : '',
      w.sectors.length ? `Sectors: ${w.sectors.join(', ')}` : '',
      `Current stage: ${STAGES.find((s) => s.id === w.stage)?.label}`,
      profile.role ? `User role: ${profile.role}` : '',
      attached.length ? `Attached datasets:\n${attached.map((d) => `- ${d!.name}`).join('\n')}` : 'No datasets attached yet.',
      `Available datasets to choose from:\n${available}`,
      w.hypotheses.length ? `Existing hypotheses:\n${w.hypotheses.map((h) => `- (${h.status}) ${h.text}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const res = await workspaceCopilot('Advance this workspace: give a plan, the best next step, tailored hypotheses, dataset picks and stage tasks.', context)
    setAiBusy(false)
    if (res.ok) setAiPlan(res.data)
    else setAiError(res.error)
  }

  /** Map a copilot-suggested dataset name back to a real catalog id, if any. */
  function datasetIdByName(name: string): string | undefined {
    const lc = name.toLowerCase()
    return allDatasets.find((d) => d.name.toLowerCase() === lc || d.name.toLowerCase().includes(lc) || lc.includes(d.name.toLowerCase()))?.id
  }

  const recs = useMemo(
    () => (w ? recommendForProblem(w.problem || w.title, w.sectors, allDatasets, 8).filter((r) => !w.datasetIds.includes(r.dataset.id)).slice(0, 4) : []),
    [w, allDatasets],
  )
  const hypIdeas = useMemo(() => {
    if (!w) return []
    const have = new Set(w.hypotheses.map((h) => h.text))
    return suggestHypotheses(w.problem || w.title).filter((t) => !have.has(t))
  }, [w])
  const taskIdeas = useMemo(() => {
    if (!w) return []
    const have = new Set(w.tasks.map((t) => t.text))
    return suggestTasks(w.stage).filter((t) => !have.has(t))
  }, [w])

  if (!w) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-slate-400">Workspace not found.</p>
          <Link to="/workspaces" className="btn-primary mt-4 inline-flex"><ArrowLeft className="h-4 w-4" /> Back to Workspaces</Link>
        </div>
      </div>
    )
  }

  const a = ACCENT[w.accent]
  const progress = workspaceProgress(w)
  const stageIdx = STAGES.findIndex((s) => s.id === w.stage)
  const assembled = w.datasetIds.map((dId) => getAny(dId)).filter(Boolean)

  // Cross-dataset intelligence: bridge the attached datasets via shared
  // dimensions and surface relationships that span them. Runs on real file
  // content (generated samples / uploaded content), recomputed when the set
  // of attached datasets changes.
  const crossFindings = useMemo<CrossFinding[]>(() => {
    const inputs = assembled
      .map((d) => {
        const file = d!.files.find((f) => f.generate || f.content != null)
        const text = file?.generate?.() ?? file?.content
        return text ? { id: d!.id, name: d!.name, text, format: file?.format } : null
      })
      .filter(Boolean) as { id: string; name: string; text: string; format?: string }[]
    if (inputs.length < 2) return []
    return analyzeCross(toCrossDatasets(inputs, parseAny), { max: 5 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.datasetIds.join(',')])

  function startEdit() {
    setTitle(w!.title)
    setProblem(w!.problem)
    setMetric(w!.metric)
    setEditing(true)
  }
  function saveEdit() {
    ws.update(w!.id, { title: title.trim() || w!.title, problem: problem.trim(), metric: metric.trim() })
    setEditing(false)
  }

  const nextStep = (() => {
    if (!w.datasetIds.length) return 'Assemble 2–3 datasets that speak to your problem.'
    if (!w.hypotheses.length) return 'Write down the hypotheses you want to test.'
    if (!w.hypotheses.some((h) => h.status !== 'open')) return 'Test your hypotheses, then mark each validated or rejected.'
    if (w.tasks.some((t) => !t.done)) return 'Close out the open tasks for this stage.'
    if (w.stage !== 'produce') return "You're ready to advance to the next stage."
    return 'Ship the output and log it in the decision log.'
  })()

  return (
    <div className="space-y-7">
      <Link to="/workspaces" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Workspaces
      </Link>

      {/* Brief */}
      <div className="border-b border-edge/60 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <IconBadge icon={FolderKanban} accent={w.accent} size="lg" />
            <div className="min-w-0">
              {editing ? (
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-edge/70 bg-elevated/50 px-3 py-1.5 text-xl font-bold text-slate-50 focus:border-violet-500/50 focus:outline-none" />
              ) : (
                <h1 className="text-2xl font-bold tracking-tight text-slate-50">{w.title}</h1>
              )}
              {!editing && w.metric && (
                <div className={cn('mt-1.5 inline-flex items-center gap-1.5 text-sm', a.text)}><Target className="h-4 w-4" /> {w.metric}</div>
              )}
              {w.sectors.length > 0 && !editing && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {w.sectors.map((s) => <Badge key={s} variant="neutral">{s}</Badge>)}
                </div>
              )}
              {sharedTeams.length > 0 && !editing && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs text-slate-500">Shared with</span>
                  {sharedTeams.map((t) => (
                    <Link key={t.id} to={`/teams/${t.id}`}>
                      <Badge variant="cyan">{t.name}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn-ghost"><X className="h-4 w-4" /> Cancel</button>
                <button onClick={saveEdit} className="btn-primary"><Check className="h-4 w-4" /> Save</button>
              </>
            ) : (
              <button onClick={startEdit} className="btn-ghost"><Pencil className="h-4 w-4" /> Edit brief</button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} placeholder="Describe the problem…" className="w-full resize-none rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-200 focus:border-violet-500/50 focus:outline-none" />
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Target metric" className="w-full rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-200 focus:border-violet-500/50 focus:outline-none" />
          </div>
        ) : (
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-slate-300">{w.problem || 'No problem statement yet — click “Edit brief” to add one.'}</p>
        )}

        {/* Stage stepper */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Pipeline</span>
            <span className="data-mono">{progress}% complete</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STAGES.map((s, i) => {
              const done = i < stageIdx
              const cur = i === stageIdx
              return (
                <button key={s.id} onClick={() => changeStage(s.id as Stage)} className="group text-left">
                  <div className={cn('h-1.5 rounded-full transition-colors', done ? a.dot : cur ? a.dot : 'bg-edge')} />
                  <div className={cn('mt-1.5 flex items-center gap-1 text-xs font-medium', cur ? a.text : done ? 'text-slate-300' : 'text-slate-600 group-hover:text-slate-400')}>
                    {done ? <Check className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />} {s.label}
                  </div>
                  <div className="mt-0.5 hidden text-[11px] text-slate-600 sm:block">{s.blurb}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Data */}
          <Card>
            <CardHeader icon={Database} accent="emerald" title="Assembled data" subtitle={`${assembled.length} dataset${assembled.length !== 1 ? 's' : ''} attached to this problem`} />
            <div className="divide-y divide-edge/40 border-t border-edge/50">
              {assembled.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">No datasets yet. Add from the copilot's suggestions on the right.</p>}
              {assembled.map((d) => {
                const da = ACCENT[d!.accent]
                return (
                  <div key={d!.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold', da.bg, da.text)}>{d!.modality.slice(0, 3)}</span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/data/${d!.id}`} className="truncate text-sm font-medium text-slate-200 hover:text-white">{d!.name}</Link>
                      <div className="text-xs text-slate-500">{d!.category} · {priceLabel(d!.price)}</div>
                    </div>
                    <Link to={`/analyze?dataset=${d!.id}`} className="btn-ghost !px-2 !py-1.5 !text-xs" title="Analyze"><Microscope className="h-3.5 w-3.5" /></Link>
                    <button onClick={() => ws.removeDataset(w.id, d!.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-rose-300"><X className="h-4 w-4" /></button>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Cross-dataset intelligence */}
          {assembled.length >= 2 && (
            <Card>
              <CardHeader
                icon={Workflow}
                accent="fuchsia"
                title="Cross-dataset intelligence"
                subtitle="Relationships that span your attached datasets, bridged on a shared dimension"
              />
              <div className="border-t border-edge/50 p-5">
                {crossFindings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-edge/60 bg-elevated/20 p-4 text-sm text-slate-500">
                    No cross-dataset links found yet — attach datasets that share a dimension (e.g. region, sector) and
                    have numeric measures to correlate across them.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {crossFindings.map((f) => (
                      <div key={f.id} className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-300">
                            <Workflow className="h-3.5 w-3.5" /> via {f.via}
                          </div>
                          <span className="data-mono text-xs text-slate-300">{f.stat}</span>
                        </div>
                        <h4 className="mt-2 text-sm font-semibold text-slate-100">{f.title}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.detail}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-[11px] text-slate-500">
                            {f.datasetA} <span className="text-slate-600">×</span> {f.datasetB} · {f.points.length} shared values
                          </span>
                          <button
                            onClick={() =>
                              ws.addHypothesis(w.id, `${f.title}.`, {
                                kind: 'cross-dataset',
                                stat: f.stat,
                                detail: f.detail,
                                source: `${f.datasetA} × ${f.datasetB}`,
                                columns: [f.xLabel, f.yLabel],
                                at: new Date().toISOString(),
                              })
                            }
                            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-fuchsia-500/15 px-2 py-1 text-[11px] font-medium text-fuchsia-300 hover:bg-fuchsia-500/25"
                          >
                            <FlaskConical className="h-3.5 w-3.5" /> Pin as hypothesis
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Hypotheses */}
          <Card>
            <CardHeader icon={FlaskConical} accent="amber" title="Hypotheses & decisions" subtitle="State what you believe, then validate or reject it with evidence" />
            <div className="space-y-2 border-t border-edge/50 p-5">
              {w.hypotheses.map((h) => {
                const st = HYP_STATUS[h.status]
                return (
                  <div key={h.id} className="rounded-xl border border-edge/60 bg-elevated/30 p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant={st.variant} dot>{st.label}</Badge>
                      <p className="flex-1 text-sm text-slate-200">{h.text}</p>
                      <button onClick={() => ws.removeHypothesis(w.id, h.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {h.evidence && (
                      <div className="mt-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-2.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-200">
                          <LineChart className="h-3 w-3" /> Evidence
                          {h.evidence.stat && <span className="data-mono ml-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-200">{h.evidence.stat}</span>}
                        </div>
                        {h.evidence.detail && <p className="mt-1 text-xs leading-relaxed text-slate-400">{h.evidence.detail}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                          {h.evidence.source && <span>from <span className="text-slate-400">{h.evidence.source}</span></span>}
                          {h.evidence.columns && h.evidence.columns.length > 0 && (
                            <span className="data-mono">· {h.evidence.columns.join(' × ')}</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-1.5">
                      <button onClick={() => validateHypothesis(h.id, h.text, 'validated')} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs', h.status === 'validated' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:bg-elevated hover:text-emerald-300')}><CheckCircle2 className="h-3.5 w-3.5" /> Validate</button>
                      <button onClick={() => validateHypothesis(h.id, h.text, 'rejected')} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs', h.status === 'rejected' ? 'bg-rose-500/15 text-rose-300' : 'text-slate-400 hover:bg-elevated hover:text-rose-300')}><XCircle className="h-3.5 w-3.5" /> Reject</button>
                      {h.status !== 'open' && (
                        <button onClick={() => ws.updateHypothesis(w.id, h.id, { status: 'open' })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-elevated hover:text-slate-200"><RotateCcw className="h-3.5 w-3.5" /> Reopen</button>
                      )}
                    </div>
                  </div>
                )
              })}
              <AddRow placeholder="Add a hypothesis to test…" onAdd={(v) => ws.addHypothesis(w.id, v)} icon={FlaskConical} />
            </div>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader icon={ListChecks} accent="cyan" title="Tasks" subtitle={`${w.tasks.filter((t) => t.done).length}/${w.tasks.length} done`} />
            <div className="space-y-1.5 border-t border-edge/50 p-5">
              {w.tasks.map((t) => (
                <div key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-elevated/40">
                  <button onClick={() => ws.toggleTask(w.id, t.id)} className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border', t.done ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300' : 'border-edge text-transparent hover:border-slate-500')}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <span className={cn('flex-1 text-sm', t.done ? 'text-slate-500 line-through' : 'text-slate-200')}>{t.text}</span>
                  <button onClick={() => ws.removeTask(w.id, t.id)} className="text-slate-600 opacity-0 hover:text-rose-300 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="pt-1"><AddRow placeholder="Add a task…" onAdd={(v) => ws.addTask(w.id, v)} icon={ListChecks} /></div>
            </div>
          </Card>
        </div>

        {/* Copilot column */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="relative border-b border-edge/60 px-5 py-4">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/15 to-transparent" />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-white"><Sparkles className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">Copilot</h3>
                    <p className="text-[11px] text-slate-400">{aiEnabled ? 'AI reasoning over your workspace' : 'Adapts to your problem & stage'}</p>
                  </div>
                </div>
                {aiEnabled && (
                  <button onClick={runAi} disabled={aiBusy} className="btn-primary !px-2.5 !py-1.5 !text-xs">
                    {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {aiPlan ? 'Refresh' : 'Ask AI'}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-4 p-5">
              {aiError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {aiError}
                </div>
              )}

              {aiPlan && (
                <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-200">
                    <Wand2 className="h-3.5 w-3.5" /> AI plan
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{aiPlan.summary}</p>
                  <div className="rounded-lg bg-elevated/40 p-2.5 text-sm text-slate-200">
                    <span className="text-[11px] font-medium text-violet-300">Next step · </span>{aiPlan.next_step}
                  </div>
                  {aiPlan.dataset_suggestions && aiPlan.dataset_suggestions.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-slate-400">Suggested datasets</div>
                      <div className="space-y-1.5">
                        {aiPlan.dataset_suggestions.map((s) => {
                          const did = datasetIdByName(s.name)
                          const already = did ? w.datasetIds.includes(did) : false
                          return (
                            <div key={s.name} className="flex items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-slate-200">{s.name}</div>
                                <div className="truncate text-[11px] text-slate-500">{s.reason}</div>
                              </div>
                              {did && !already && (
                                <button onClick={() => attachDataset(did)} className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/25"><Plus className="h-3.5 w-3.5" /></button>
                              )}
                              {already && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {aiPlan.hypotheses.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-slate-400">Hypotheses</div>
                      <div className="space-y-1.5">
                        {aiPlan.hypotheses.map((t) => (
                          <button key={t} onClick={() => ws.addHypothesis(w.id, t)} className="flex w-full items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5 text-left hover:border-amber-500/40">
                            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                            <span className="text-xs leading-relaxed text-slate-300">{t}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiPlan.tasks.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-slate-400">Tasks</div>
                      <div className="space-y-1.5">
                        {aiPlan.tasks.map((t) => (
                          <button key={t} onClick={() => ws.addTask(w.id, t)} className="flex w-full items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5 text-left hover:border-cyan-500/40">
                            <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                            <span className="text-xs leading-relaxed text-slate-300">{t}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiPlan.risks && aiPlan.risks.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-medium text-slate-400">Risks to watch</div>
                      <ul className="space-y-1">
                        {aiPlan.risks.map((r) => (
                          <li key={r} className="flex items-start gap-1.5 text-xs text-slate-400"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" /> {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!aiPlan && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>{aiEnabled ? 'Heuristic suggestions below — or “Ask AI” for tailored reasoning.' : 'Heuristic suggestions (set ANTHROPIC_API_KEY for AI reasoning).'}</span>
                </div>
              )}

              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 text-sm text-slate-200">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-violet-300"><Sparkles className="h-3.5 w-3.5" /> Suggested next step</div>
                {nextStep}
              </div>

              {recs.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-400">Recommended datasets</div>
                  <div className="space-y-1.5">
                    {recs.map((r) => (
                      <div key={r.dataset.id} className="flex items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-200">{r.dataset.name}</div>
                          <div className="truncate text-[11px] text-slate-500">{r.reasons[0]}</div>
                        </div>
                        <button onClick={() => attachDataset(r.dataset.id)} className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/25"><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hypIdeas.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-400">Hypotheses to consider</div>
                  <div className="space-y-1.5">
                    {hypIdeas.map((t) => (
                      <button key={t} onClick={() => ws.addHypothesis(w.id, t)} className="flex w-full items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5 text-left hover:border-amber-500/40">
                        <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                        <span className="text-xs leading-relaxed text-slate-300">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {taskIdeas.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-400">Tasks for the “{STAGES[stageIdx]?.label}” stage</div>
                  <div className="space-y-1.5">
                    {taskIdeas.map((t) => (
                      <button key={t} onClick={() => ws.addTask(w.id, t)} className="flex w-full items-start gap-2 rounded-lg border border-edge/60 bg-elevated/30 p-2.5 text-left hover:border-cyan-500/40">
                        <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span className="text-xs leading-relaxed text-slate-300">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Decision log */}
          <Card>
            <CardHeader icon={MessageSquarePlus} accent="violet" title="Decision log" subtitle="Capture decisions & findings" />
            <div className="space-y-3 border-t border-edge/50 p-5">
              <AddRow placeholder="Log a decision or finding…" onAdd={logNote} icon={MessageSquarePlus} />
              <div className="space-y-2">
                {w.notes.length === 0 && <p className="text-sm text-slate-500">Nothing logged yet.</p>}
                {w.notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-edge/50 bg-elevated/30 p-3">
                    <p className="text-sm text-slate-200">{n.text}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(n.at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <button
            onClick={() => {
              if (confirm('Delete this workspace? This cannot be undone.')) {
                ws.remove(w.id)
                navigate('/workspaces')
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" /> Delete workspace
          </button>
        </div>
      </div>
    </div>
  )
}
