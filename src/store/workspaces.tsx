import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Accent } from '@/lib/nav'
import { useAuth } from '@/store/auth'

/* A Workspace is a problem-driven project space — the "frame a problem → assemble
 * data → analyze → decide → ship" journey, with a copilot. Persisted per account. */

export type Stage = 'frame' | 'assemble' | 'analyze' | 'decide' | 'produce'
export const STAGES: { id: Stage; label: string; blurb: string }[] = [
  { id: 'frame', label: 'Frame', blurb: 'Define the problem & metric' },
  { id: 'assemble', label: 'Assemble', blurb: 'Gather the right data' },
  { id: 'analyze', label: 'Analyze', blurb: 'Profile, chart & test' },
  { id: 'decide', label: 'Decide', blurb: 'Validate hypotheses' },
  { id: 'produce', label: 'Produce', blurb: 'Ship the output' },
]

export type HypothesisStatus = 'open' | 'validated' | 'rejected'
export type Hypothesis = { id: string; text: string; status: HypothesisStatus; note?: string }
export type Task = { id: string; text: string; done: boolean }
export type Note = { id: string; text: string; at: string }

export type Workspace = {
  id: string
  title: string
  problem: string
  metric: string
  sectors: string[]
  stage: Stage
  datasetIds: string[]
  hypotheses: Hypothesis[]
  tasks: Task[]
  notes: Note[]
  accent: Accent
  createdAt: string
  updatedAt: string
}

export type WorkspaceTemplate = {
  id: string
  title: string
  problem: string
  metric: string
  sectors: string[]
  accent: Accent
  hypotheses: string[]
  tasks: string[]
}

export const TEMPLATES: WorkspaceTemplate[] = [
  {
    id: 't-carbon',
    title: 'Cut embodied carbon on healthcare projects',
    problem: 'Reduce A1–A3 embodied carbon by 30% across our healthcare portfolio without increasing cost.',
    metric: '−30% embodied carbon (kgCO₂e/m²)',
    sectors: ['Healthcare'],
    accent: 'emerald',
    hypotheses: ['Structural frame + substructure drive >50% of embodied carbon.', 'Lower-carbon concrete mixes cut A1–A3 by ≥15%.'],
    tasks: ['Define the target metric & baseline', 'Attach EPD & IFC datasets', 'Quantify the dominant carbon driver'],
  },
  {
    id: 't-schedule',
    title: 'De-risk the construction schedule',
    problem: 'Identify where schedule risk is highest across active projects and cut forecast slip below 30 days.',
    metric: '< 30-day forecast slip',
    sectors: ['Commercial'],
    accent: 'amber',
    hypotheses: ['MEP rough-in is the dominant critical-path constraint.', 'Late material deliveries drive most slip beyond 30 days.'],
    tasks: ['Attach schedule + field datasets', 'Test the critical-path hypothesis', 'Record a recovery decision'],
  },
  {
    id: 't-bid',
    title: 'Win the next data-center bid',
    problem: 'Price the bid competitively using benchmarks and de-risk the supply chain on long-lead packages.',
    metric: 'Win probability ↑ / margin protected',
    sectors: ['Data Center'],
    accent: 'lime',
    hypotheses: ['MEP density explains most of the cost-per-m² variance.', 'Dual-sourcing long-lead packages reduces schedule risk.'],
    tasks: ['Attach cost benchmarks + supplier data', 'Benchmark cost/m² vs comparable projects', 'Flag long-lead procurement risk'],
  },
  {
    id: 't-model',
    title: 'Train an AEC domain model',
    problem: 'Assemble a license-clean, multi-modal corpus to fine-tune a construction-domain model.',
    metric: 'Eval accuracy ↑ on held-out set',
    sectors: [],
    accent: 'fuchsia',
    hypotheses: ['A multi-modal corpus lifts domain-model accuracy.', 'Anonymized, license-clean data suffices to fine-tune usefully.'],
    tasks: ['Attach RFI pairs, defect imagery & classified IFC', 'Check licenses & anonymization', 'Define the evaluation set'],
  },
]

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function workspaceProgress(w: Workspace): number {
  let p = 0
  if (w.datasetIds.length) p += 22
  if (w.hypotheses.length) p += 18
  if (w.hypotheses.some((h) => h.status !== 'open')) p += 20
  const doneRatio = w.tasks.length ? w.tasks.filter((t) => t.done).length / w.tasks.length : 0
  p += Math.round(doneRatio * 20)
  p += Math.round((STAGES.findIndex((s) => s.id === w.stage) / (STAGES.length - 1)) * 20)
  return Math.min(100, Math.round(p))
}

type WorkspacesValue = {
  workspaces: Workspace[]
  get: (id: string) => Workspace | undefined
  create: (input: { title: string; problem: string; metric?: string; sectors?: string[]; accent?: Accent }) => string
  createFromTemplate: (t: WorkspaceTemplate) => string
  update: (id: string, patch: Partial<Workspace>) => void
  remove: (id: string) => void
  addDataset: (id: string, datasetId: string) => void
  removeDataset: (id: string, datasetId: string) => void
  addHypothesis: (id: string, text: string) => void
  updateHypothesis: (id: string, hid: string, patch: Partial<Hypothesis>) => void
  removeHypothesis: (id: string, hid: string) => void
  addTask: (id: string, text: string) => void
  toggleTask: (id: string, tid: string) => void
  removeTask: (id: string, tid: string) => void
  addNote: (id: string, text: string) => void
  setStage: (id: string, stage: Stage) => void
}

const Ctx = createContext<WorkspacesValue | null>(null)
const KEY = 'aec-workspaces'

function load(key: string): Workspace[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Workspace[]) : []
  } catch {
    return []
  }
}

export function WorkspacesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = user ? `${KEY}::${user.id}` : KEY
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => load(KEY))

  useEffect(() => {
    setWorkspaces(load(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(workspaces))
    } catch {
      /* ignore */
    }
  }, [workspaces, key])

  const value = useMemo<WorkspacesValue>(() => {
    const mutate = (id: string, fn: (w: Workspace) => Workspace) =>
      setWorkspaces((list) => list.map((w) => (w.id === id ? { ...fn(w), updatedAt: new Date().toISOString() } : w)))

    const newWorkspace = (base: Partial<Workspace>): Workspace => {
      const now = new Date().toISOString()
      return {
        id: uid('w'),
        title: base.title ?? 'Untitled workspace',
        problem: base.problem ?? '',
        metric: base.metric ?? '',
        sectors: base.sectors ?? [],
        stage: 'frame',
        datasetIds: base.datasetIds ?? [],
        hypotheses: base.hypotheses ?? [],
        tasks: base.tasks ?? [],
        notes: [],
        accent: base.accent ?? 'violet',
        createdAt: now,
        updatedAt: now,
      }
    }

    return {
      workspaces,
      get: (id) => workspaces.find((w) => w.id === id),
      create: (input) => {
        const w = newWorkspace({ ...input })
        setWorkspaces((list) => [w, ...list])
        return w.id
      },
      createFromTemplate: (t) => {
        const w = newWorkspace({
          title: t.title,
          problem: t.problem,
          metric: t.metric,
          sectors: t.sectors,
          accent: t.accent,
          hypotheses: t.hypotheses.map((text) => ({ id: uid('h'), text, status: 'open' as const })),
          tasks: t.tasks.map((text) => ({ id: uid('t'), text, done: false })),
        })
        setWorkspaces((list) => [w, ...list])
        return w.id
      },
      update: (id, patch) => mutate(id, (w) => ({ ...w, ...patch })),
      remove: (id) => setWorkspaces((list) => list.filter((w) => w.id !== id)),
      addDataset: (id, datasetId) => mutate(id, (w) => (w.datasetIds.includes(datasetId) ? w : { ...w, datasetIds: [...w.datasetIds, datasetId] })),
      removeDataset: (id, datasetId) => mutate(id, (w) => ({ ...w, datasetIds: w.datasetIds.filter((d) => d !== datasetId) })),
      addHypothesis: (id, text) => mutate(id, (w) => ({ ...w, hypotheses: [...w.hypotheses, { id: uid('h'), text, status: 'open' }] })),
      updateHypothesis: (id, hid, patch) => mutate(id, (w) => ({ ...w, hypotheses: w.hypotheses.map((h) => (h.id === hid ? { ...h, ...patch } : h)) })),
      removeHypothesis: (id, hid) => mutate(id, (w) => ({ ...w, hypotheses: w.hypotheses.filter((h) => h.id !== hid) })),
      addTask: (id, text) => mutate(id, (w) => ({ ...w, tasks: [...w.tasks, { id: uid('t'), text, done: false }] })),
      toggleTask: (id, tid) => mutate(id, (w) => ({ ...w, tasks: w.tasks.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) })),
      removeTask: (id, tid) => mutate(id, (w) => ({ ...w, tasks: w.tasks.filter((t) => t.id !== tid) })),
      addNote: (id, text) => mutate(id, (w) => ({ ...w, notes: [{ id: uid('n'), text, at: new Date().toISOString() }, ...w.notes] })),
      setStage: (id, stage) => mutate(id, (w) => ({ ...w, stage })),
    }
  }, [workspaces, key])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWorkspaces(): WorkspacesValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspaces must be used within WorkspacesProvider')
  return ctx
}
