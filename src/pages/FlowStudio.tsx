import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Workflow,
  Database,
  Columns3,
  Sparkles,
  GitCompare,
  BarChart3,
  StickyNote,
  Play,
  Trash2,
  Plus,
  X,
  Link2,
  AlertTriangle,
  Wand2,
  Filter,
  Group,
  Combine,
  TrendingUp,
  Layers,
  ShieldAlert,
  PieChart,
  Pin,
} from 'lucide-react'
import { PageHeader, Badge } from '@/components/ui'
import { BarSeries } from '@/components/charts'
import { useFlows } from '@/store/flows'
import { useWorkspaces } from '@/store/workspaces'
import { runFlow, validate, wouldCycle, type FlowNode, type NodeKind } from '@/lib/flow'
import { analyzableCatalog, buildFlowFromPrompt, computeNode, type Payload } from '@/lib/flow-compute'
import type { FindingKind } from '@/lib/insights'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const NODE_W = 240

const NODE_META: Record<NodeKind, { label: string; icon: typeof Database; accent: Accent; blurb: string }> = {
  dataset: { label: 'Dataset', icon: Database, accent: 'emerald', blurb: 'A source dataset' },
  filter: { label: 'Filter', icon: Filter, accent: 'amber', blurb: 'Keep rows matching a rule' },
  group: { label: 'Group', icon: Group, accent: 'sky', blurb: 'Aggregate by a dimension' },
  join: { label: 'Join', icon: Combine, accent: 'teal', blurb: 'Merge two tables on a key' },
  profile: { label: 'Profile', icon: Columns3, accent: 'blue', blurb: 'Types, quality, cardinality' },
  insights: { label: 'Insights', icon: Sparkles, accent: 'violet', blurb: 'Ranked statistical findings' },
  crosslink: { label: 'Cross-link', icon: GitCompare, accent: 'fuchsia', blurb: 'Relate ≥2 datasets' },
  chart: { label: 'Chart', icon: BarChart3, accent: 'cyan', blurb: 'Aggregate & visualize' },
  note: { label: 'Note', icon: StickyNote, accent: 'amber', blurb: 'A label or comment' },
}
const PALETTE: NodeKind[] = ['dataset', 'filter', 'group', 'join', 'profile', 'insights', 'crosslink', 'chart', 'note']

const FIND_ICON: Record<FindingKind, typeof GitCompare> = {
  correlation: GitCompare, trend: TrendingUp, segment: Layers, outlier: AlertTriangle, concentration: PieChart, quality: ShieldAlert, overview: Sparkles,
}

type Connecting = { from: string; x: number; y: number } | null

export default function FlowStudio() {
  const { graph, addNode, updateNode, removeNode, addEdge, removeEdge, clear, setGraph } = useFlows()
  const { workspaces, create, addHypothesis } = useWorkspaces()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<Map<string, Payload | undefined>>(new Map())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const [ran, setRan] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinned, setPinned] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [connecting, setConnecting] = useState<Connecting>(null)
  const [prompt, setPrompt] = useState('')

  const issues = useMemo(() => validate(graph), [graph])
  const datasets = useMemo(() => analyzableCatalog(), [])

  /* ---- run the whole graph through the real engines ---- */
  const run = useCallback(() => {
    const res = runFlow<Payload>(graph, (node, inputs) => computeNode(node, inputs))
    setResults(res.outputs)
    setErrors(res.errors)
    setRan(true)
  }, [graph])

  /* ---- collect every finding the run produced (insights + cross-link) ---- */
  const runFindings = useMemo(() => {
    const out: { text: string; stat?: string; detail?: string; source: string; cols: string[] }[] = []
    for (const p of results.values()) {
      if (p?.type === 'insights') {
        for (const f of p.findings) out.push({ text: f.title, stat: f.stat, detail: f.detail, source: p.name, cols: f.columns })
      } else if (p?.type === 'cross') {
        for (const f of p.findings) out.push({ text: f.title, stat: f.stat, detail: f.detail, source: `${f.datasetA} × ${f.datasetB}`, cols: [f.xLabel, f.yLabel] })
      }
    }
    return out
  }, [results])

  function pinTo(workspaceId: string) {
    for (const f of runFindings) {
      addHypothesis(workspaceId, `${f.text}.`, { kind: 'flow', stat: f.stat, detail: f.detail, source: f.source, columns: f.cols, at: new Date().toISOString() })
    }
    setPinOpen(false)
    setPinned(workspaceId)
    setTimeout(() => setPinned(null), 2600)
  }
  function pinToNew() {
    const id = create({ title: 'Flow Studio findings', problem: 'Findings captured from a data flow.', accent: 'fuchsia' })
    pinTo(id)
  }

  /* ---- add a node near the canvas centre ---- */
  function add(kind: NodeKind) {
    const n = graph.nodes.length
    addNode({
      kind,
      title: NODE_META[kind].label,
      x: 80 + (n % 4) * 270,
      y: 90 + Math.floor(n / 4) * 200,
      config: kind === 'dataset' ? { datasetId: datasets[0]?.id } : undefined,
    })
  }

  /* ---- agentic: build a flow graph from a prompt ---- */
  function generate() {
    const g = buildFlowFromPrompt(prompt || 'profile a dataset, find insights and chart it')
    setGraph(g)
    setResults(new Map())
    setErrors(new Map())
    setRan(false)
    setPrompt('')
    // auto-run after a tick so results show immediately
    setTimeout(() => {
      const res = runFlow<Payload>(g, (node, inputs) => computeNode(node, inputs))
      setResults(res.outputs)
      setErrors(res.errors)
      setRan(true)
    }, 60)
  }

  /* ---- drag handling (pointer events on the canvas) ---- */
  function onPointerMove(e: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    if (drag) {
      updateNode(drag.id, { x: e.clientX - rect.left - drag.dx, y: e.clientY - rect.top - drag.dy })
    } else if (connecting) {
      setConnecting({ ...connecting, x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }
  function onPointerUp() {
    setDrag(null)
    setConnecting(null)
  }

  function startConnect(fromId: string, e: React.PointerEvent) {
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setConnecting({ from: fromId, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  function endConnect(toId: string, e: React.PointerEvent) {
    e.stopPropagation()
    if (connecting && connecting.from !== toId) {
      if (wouldCycle(graph, connecting.from, toId)) {
        // ignore cycle-creating wires
      } else {
        addEdge(connecting.from, toId)
      }
    }
    setConnecting(null)
  }

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes])
  const port = (n: FlowNode, side: 'in' | 'out') => ({ x: n.x + (side === 'in' ? 0 : NODE_W), y: n.y + 52 })

  /* Column names a node's transform config can pick from: the cols of its first
   * upstream node's output (available after a run). Empty before the first run. */
  function upstreamColsFor(nodeId: string): { name: string; type: string }[] {
    const srcId = graph.edges.find((e) => e.to === nodeId)?.from
    if (!srcId) return []
    const out = results.get(srcId)
    if (out && (out.type === 'dataset' || out.type === 'profile')) return out.cols.map((c) => ({ name: c.name, type: c.type }))
    return []
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Workflow}
        accent="fuchsia"
        eyebrow="Studio"
        title="Flow Studio"
        description="An open canvas to play with data. Drop nodes, wire a data flow, and run it — every node computes for real (profile, insights, cross-link, chart). Or describe a flow and let the agent diagram it."
        actions={
          <>
            <button onClick={clear} className="btn-ghost" disabled={!graph.nodes.length}>
              <Trash2 className="h-4 w-4" /> Clear
            </button>
            {runFindings.length > 0 && (
              <button onClick={() => setPinOpen(true)} className="btn-ghost">
                <Pin className="h-4 w-4" /> Pin {runFindings.length} finding{runFindings.length > 1 ? 's' : ''}
              </button>
            )}
            <button onClick={run} className="btn-primary" disabled={!graph.nodes.length}>
              <Play className="h-4 w-4" /> Run flow
            </button>
          </>
        }
      />

      {/* agentic prompt bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-edge/70 bg-elevated/40 p-2 focus-within:border-fuchsia-500/50">
        <Wand2 className="ml-2 h-4 w-4 shrink-0 text-fuchsia-400" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          placeholder="Describe a data flow — e.g. “profile cost benchmarks, find insights and chart them”, or “cross-link cost, carbon & supplier across regions”"
          className="flex-1 bg-transparent px-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />
        <button onClick={generate} className="btn-primary !px-3 !py-2">
          <Sparkles className="h-4 w-4" /> Diagram it
        </button>
      </div>

      {/* palette */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Add node</span>
        {PALETTE.map((k) => {
          const m = NODE_META[k]
          const a = ACCENT[m.accent]
          return (
            <button
              key={k}
              onClick={() => add(k)}
              title={m.blurb}
              className={cn('inline-flex items-center gap-1.5 rounded-lg border border-edge/70 bg-elevated/40 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-fuchsia-500/40', a.text)}
            >
              <m.icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          )
        })}
        {issues.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-amber-300" title={issues.join('\n')}>
            <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} issue{issues.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* canvas */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-edge/70 bg-base/60"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      >
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="max-w-sm">
              <Workflow className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">An empty studio. Add a node from the palette, or describe a flow above and let the agent diagram it.</p>
              <button onClick={() => { setPrompt('profile cost benchmarks, find insights and chart it'); setTimeout(generate, 0) }} className="btn-ghost mt-4">
                <Sparkles className="h-4 w-4 text-fuchsia-400" /> Try an example
              </button>
            </div>
          </div>
        )}

        {/* edges */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {graph.edges.map((e) => {
            const a = nodeById.get(e.from)
            const b = nodeById.get(e.to)
            if (!a || !b) return null
            const p1 = port(a, 'out')
            const p2 = port(b, 'in')
            const mx = (p1.x + p2.x) / 2
            return (
              <g key={e.id}>
                <path d={`M ${p1.x} ${p1.y} C ${mx} ${p1.y}, ${mx} ${p2.y}, ${p2.x} ${p2.y}`} stroke="#5b97fb" strokeWidth="2" fill="none" opacity="0.8" />
                <circle cx={(p1.x + p2.x) / 2} cy={(p1.y + p2.y) / 2} r="8" className="pointer-events-auto cursor-pointer" fill="#0b1220" stroke="#1b2540"
                  onPointerDown={(ev) => { ev.stopPropagation(); removeEdge(e.id) }} />
                <X x={(p1.x + p2.x) / 2 - 4} y={(p1.y + p2.y) / 2 - 4} className="pointer-events-none" width={8} height={8} color="#94a3b8" />
              </g>
            )
          })}
          {connecting && (() => {
            const a = nodeById.get(connecting.from)
            if (!a) return null
            const p1 = port(a, 'out')
            return <path d={`M ${p1.x} ${p1.y} L ${connecting.x} ${connecting.y}`} stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 4" fill="none" />
          })()}
        </svg>

        {/* nodes */}
        {graph.nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            output={results.get(n.id)}
            error={errors.get(n.id)}
            ran={ran}
            datasets={datasets}
            upstreamCols={upstreamColsFor(n.id)}
            onDragStart={(e) => {
              const rect = canvasRef.current?.getBoundingClientRect()
              if (!rect) return
              setDrag({ id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y })
            }}
            onConfig={(patch) => updateNode(n.id, patch)}
            onRemove={() => removeNode(n.id)}
            onStartConnect={(e) => startConnect(n.id, e)}
            onEndConnect={(e) => endConnect(n.id, e)}
          />
        ))}
      </div>

      {/* pin-to-workspace picker */}
      {pinOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPinOpen(false)} />
            <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-brand-500 text-white"><Pin className="h-4 w-4" /></span>
                  <h2 className="text-sm font-semibold text-slate-100">Pin {runFindings.length} finding{runFindings.length > 1 ? 's' : ''} to a workspace</h2>
                </div>
                <button onClick={() => setPinOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto px-5 py-4">
                {workspaces.map((w) => (
                  <button key={w.id} onClick={() => pinTo(w.id)} className="flex w-full items-center gap-2 rounded-lg border border-edge/60 bg-elevated/30 px-3 py-2 text-left hover:border-fuchsia-500/40">
                    <Workflow className="h-4 w-4 shrink-0 text-fuchsia-300" />
                    <span className="flex-1 truncate text-sm text-slate-200">{w.title}</span>
                    <span className="text-[11px] text-slate-500">{w.stage}</span>
                  </button>
                ))}
                <button onClick={pinToNew} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-edge/70 px-3 py-2 text-left text-sm text-slate-300 hover:border-brand-500/40 hover:text-white">
                  <Plus className="h-4 w-4 shrink-0 text-brand-300" /> Create a new workspace from these findings
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* pinned toast */}
      {pinned &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
            <Link to={`/workspaces/${pinned}`} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-surface px-4 py-2.5 text-sm text-slate-200 shadow-2xl hover:border-emerald-400">
              <Pin className="h-4 w-4 text-emerald-400" /> Pinned to workspace · <span className="font-medium text-emerald-300">Open</span>
            </Link>
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ----------------------------------------------------------------- node --- */
function NodeCard({
  node, output, error, ran, datasets, upstreamCols, onDragStart, onConfig, onRemove, onStartConnect, onEndConnect,
}: {
  node: FlowNode
  output: Payload | undefined
  error?: string
  ran: boolean
  datasets: { id: string; name: string }[]
  upstreamCols: { name: string; type: string }[]
  onDragStart: (e: React.PointerEvent) => void
  onConfig: (patch: Partial<FlowNode>) => void
  onRemove: () => void
  onStartConnect: (e: React.PointerEvent) => void
  onEndConnect: (e: React.PointerEvent) => void
}) {
  const m = NODE_META[node.kind]
  const a = ACCENT[m.accent]
  return (
    <div className="absolute" style={{ left: node.x, top: node.y, width: NODE_W }}>
      <div className={cn('rounded-xl border bg-surface/95 shadow-xl backdrop-blur', error ? 'border-rose-500/50' : 'border-edge/70')}>
        {/* header (drag handle) */}
        <div onPointerDown={onDragStart} className="flex cursor-grab items-center gap-2 rounded-t-xl border-b border-edge/60 bg-elevated/50 px-3 py-2 active:cursor-grabbing">
          <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md ring-1', a.bg, a.text, a.ring)}>
            <m.icon className="h-3.5 w-3.5" />
          </span>
          <span className="flex-1 truncate text-xs font-semibold text-slate-100">{node.title}</span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="text-slate-600 hover:text-rose-300">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* body */}
        <div className="px-3 py-2.5">
          {node.kind === 'dataset' ? (
            <select
              value={(node.config?.datasetId as string) ?? ''}
              onChange={(e) => onConfig({ config: { ...node.config, datasetId: e.target.value }, title: datasets.find((d) => d.id === e.target.value)?.name.split('—')[0].trim() ?? 'Dataset' })}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-edge/70 bg-elevated/60 px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : node.kind === 'note' ? (
            <input
              value={(node.config?.text as string) ?? ''}
              onChange={(e) => onConfig({ config: { ...node.config, text: e.target.value } })}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Note…"
              className="w-full bg-transparent text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none"
            />
          ) : node.kind === 'filter' ? (
            <TransformConfig node={node} cols={upstreamCols} onConfig={onConfig} kind="filter" />
          ) : node.kind === 'group' ? (
            <TransformConfig node={node} cols={upstreamCols} onConfig={onConfig} kind="group" />
          ) : node.kind === 'join' ? (
            <TransformConfig node={node} cols={upstreamCols} onConfig={onConfig} kind="join" />
          ) : (
            <p className="text-[11px] text-slate-500">{m.blurb}</p>
          )}

          {/* result */}
          {error ? (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-300"><AlertTriangle className="h-3 w-3" /> {error}</p>
          ) : output ? (
            <NodeResult output={output} />
          ) : ran && node.kind !== 'note' && node.kind !== 'dataset' ? (
            <p className="mt-2 text-[11px] text-slate-600">No input connected.</p>
          ) : null}
        </div>
      </div>

      {/* ports */}
      {node.kind !== 'dataset' && (
        <button
          title="Drop a connection here"
          onPointerUp={onEndConnect}
          className="absolute -left-2.5 top-[44px] grid h-5 w-5 place-items-center rounded-full border border-edge bg-base text-slate-500 hover:border-brand-400 hover:text-brand-300"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
      {node.kind !== 'note' && (
        <button
          title="Drag to connect"
          onPointerDown={onStartConnect}
          className="absolute -right-2.5 top-[44px] grid h-5 w-5 place-items-center rounded-full border border-edge bg-base text-slate-500 hover:border-brand-400 hover:text-brand-300"
        >
          <Link2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

const cfgSel = 'rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none'

function TransformConfig({
  node, cols, onConfig, kind,
}: {
  node: FlowNode
  cols: { name: string; type: string }[]
  onConfig: (patch: Partial<FlowNode>) => void
  kind: 'filter' | 'group' | 'join'
}) {
  const set = (patch: Record<string, unknown>) => onConfig({ config: { ...node.config, ...patch } })
  const stop = (e: React.PointerEvent) => e.stopPropagation()
  if (!cols.length) return <p className="text-[11px] text-slate-600">Connect input, then Run to configure.</p>
  const names = cols.map((c) => c.name)

  if (kind === 'filter') {
    return (
      <div className="flex flex-wrap items-center gap-1" onPointerDown={stop}>
        <select className={cfgSel} value={(node.config?.col as string) ?? names[0]} onChange={(e) => set({ col: e.target.value })}>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select className={cfgSel} value={(node.config?.op as string) ?? '>'} onChange={(e) => set({ op: e.target.value })}>
          {['>', '>=', '<', '<=', '=', '!=', 'contains'].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input
          className="w-16 rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
          value={(node.config?.value as string) ?? ''}
          onChange={(e) => set({ value: e.target.value })}
          placeholder="value"
        />
      </div>
    )
  }
  if (kind === 'group') {
    const cats = cols.filter((c) => c.type !== 'number').map((c) => c.name)
    const nums = cols.filter((c) => c.type === 'number').map((c) => c.name)
    return (
      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500" onPointerDown={stop}>
        <select className={cfgSel} value={(node.config?.agg as string) ?? 'avg'} onChange={(e) => set({ agg: e.target.value })}>
          {['avg', 'sum', 'count', 'min', 'max'].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {(node.config?.agg as string) !== 'count' && (
          <select className={cfgSel} value={(node.config?.measure as string) ?? nums[0] ?? ''} onChange={(e) => set({ measure: e.target.value })}>
            {nums.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        by
        <select className={cfgSel} value={(node.config?.by as string) ?? cats[0] ?? names[0]} onChange={(e) => set({ by: e.target.value })}>
          {(cats.length ? cats : names).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    )
  }
  // join — keys come from each input; we only know the first input's cols here,
  // so expose keyA from upstream and a free-text keyB (defaults to same name).
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500" onPointerDown={stop}>
      on
      <select className={cfgSel} value={(node.config?.keyA as string) ?? names[0]} onChange={(e) => set({ keyA: e.target.value, keyB: (node.config?.keyB as string) ?? e.target.value })}>
        {names.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      =
      <input
        className="w-20 rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none"
        value={(node.config?.keyB as string) ?? (node.config?.keyA as string) ?? names[0]}
        onChange={(e) => set({ keyB: e.target.value })}
        placeholder="key in B"
      />
    </div>
  )
}

function NodeResult({ output }: { output: Payload }) {
  if (output.type === 'dataset' || output.type === 'profile') {
    const numeric = output.cols.filter((c) => c.type === 'number').length
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">rows × cols</span>
          <span className="data-mono text-slate-300">{formatNumber(output.table.rows.length, { compact: true })} × {output.cols.length}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">numeric</span>
          <span className="data-mono text-slate-300">{numeric}</span>
        </div>
        {output.type === 'profile' && (
          <div className="mt-1 flex flex-wrap gap-1">
            {output.cols.slice(0, 5).map((c) => (
              <span key={c.name} className="rounded bg-elevated/60 px-1.5 py-0.5 text-[9px] text-slate-400">{c.name}</span>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (output.type === 'insights') {
    return (
      <div className="mt-2 space-y-1.5">
        {output.findings.length === 0 && <p className="text-[11px] text-slate-600">No notable patterns.</p>}
        {output.findings.slice(0, 3).map((f) => {
          const Icon = FIND_ICON[f.kind]
          const fa = ACCENT[f.accent]
          return (
            <div key={f.id} className="rounded-md border border-edge/50 bg-elevated/30 p-1.5">
              <div className="flex items-center justify-between">
                <span className={cn('inline-flex items-center gap-1 text-[9px] font-medium uppercase', fa.text)}>
                  <Icon className="h-2.5 w-2.5" /> {f.kind}
                </span>
                {f.stat && <span className="data-mono text-[9px] text-slate-400">{f.stat}</span>}
              </div>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-300">{f.title}</p>
            </div>
          )
        })}
        {output.findings.length > 3 && <p className="text-[10px] text-slate-500">+{output.findings.length - 3} more findings</p>}
      </div>
    )
  }
  if (output.type === 'cross') {
    return (
      <div className="mt-2 space-y-1.5">
        {output.count === 0 ? (
          <p className="text-[11px] text-slate-600">No cross-dataset links (need a shared dimension).</p>
        ) : (
          output.findings.slice(0, 3).map((f) => (
            <div key={f.id} className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/[0.06] p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-medium uppercase text-fuchsia-300">via {f.via}</span>
                <span className="data-mono text-[9px] text-slate-400">{f.stat}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-300">{f.title}</p>
            </div>
          ))
        )}
      </div>
    )
  }
  if (output.type === 'chart') {
    if (!output.series.length) return <p className="mt-2 text-[11px] text-slate-600">No chartable columns.</p>
    return (
      <div className="mt-2">
        <div className="mb-1 truncate text-[10px] text-slate-500">{output.name}</div>
        <BarSeries
          data={output.series.map((s) => ({ name: s.label.length > 10 ? s.label.slice(0, 9) + '…' : s.label, value: s.value }))}
          xKey="name"
          height={120}
          series={[{ key: 'value', name: 'value', accent: 'cyan' }]}
          valueFormatter={(v) => formatNumber(v, { compact: true })}
        />
      </div>
    )
  }
  return null
}
