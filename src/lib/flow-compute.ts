/* The compute layer for Flow Studio: turns each node into a real result by
 * running the studio's tested engines (parse → profile → insights → crosslink),
 * and an agentic prompt→flow builder. The flow engine (src/lib/flow.ts) handles
 * ordering/propagation; this maps node kinds to actual data work. */

import { parseAny, profile, type ColumnProfile, type Table } from '@/lib/parse'
import { filterTable, groupTable, joinTables, type Agg, type FilterOp } from '@/lib/flow-transforms'
import { analyze, type Finding } from '@/lib/insights'
import { analyzeCross, type CrossDataset, type CrossFinding } from '@/lib/crossdataset'
import { CATALOG, getDataset, type CatalogDataset } from '@/data/catalog'
import { topoOrder, uid, wouldCycle, type FlowGraph, type FlowNode, type NodeKind } from '@/lib/flow'

/* What flows down an edge: a tagged payload so a node can react to its input. */
export type Payload =
  | { type: 'dataset'; id: string; name: string; table: Table; cols: ColumnProfile[] }
  | { type: 'datasets'; items: { id: string; name: string; table: Table; cols: ColumnProfile[] }[] }
  // profile passes the dataset THROUGH (id/name/table/cols) so analysis nodes
  // downstream of a profile still receive the data — it annotates, not consumes.
  | { type: 'profile'; id: string; name: string; table: Table; cols: ColumnProfile[]; rows: number }
  | { type: 'insights'; name: string; findings: Finding[] }
  | { type: 'cross'; findings: CrossFinding[]; count: number }
  | { type: 'chart'; name: string; series: { label: string; value: number }[]; xLabel: string }

/** Resolve a dataset id to parsed table + profile (samples are generated). */
export function loadDataset(id: string): { table: Table; cols: ColumnProfile[]; name: string } | null {
  const d: CatalogDataset | undefined = getDataset(id)
  if (!d) return null
  const file = d.files.find((f) => f.generate || f.content != null)
  const text = file?.generate?.() ?? file?.content
  if (!text) return null
  const table = parseAny(text, file?.format)
  return { table, cols: profile(table), name: d.name }
}

/** Datasets that can flow through the studio (have real content). */
export function analyzableCatalog(): CatalogDataset[] {
  return CATALOG.filter((d) => d.files.some((f) => f.generate || f.content != null))
}

/** Raw text of a dataset's first analyzable file (generated sample or content). */
export function analyzableFileText(id: string): string | null {
  const d = getDataset(id)
  const file = d?.files.find((f) => f.generate || f.content != null)
  return file?.generate?.() ?? file?.content ?? null
}

/** Flatten upstream payloads into the dataset list a node can operate on. */
function gatherDatasets(inputs: (Payload | undefined)[]): { id: string; name: string; table: Table; cols: ColumnProfile[] }[] {
  const out: { id: string; name: string; table: Table; cols: ColumnProfile[] }[] = []
  for (const p of inputs) {
    if (!p) continue
    if (p.type === 'dataset' || p.type === 'profile') out.push({ id: p.id, name: p.name, table: p.table, cols: p.cols })
    else if (p.type === 'datasets') out.push(...p.items)
  }
  return out
}

/** Compute one node's output from its upstream payloads. Pure given inputs. */
export function computeNode(node: FlowNode, inputs: (Payload | undefined)[]): Payload | undefined {
  switch (node.kind) {
    case 'dataset': {
      const id = (node.config?.datasetId as string) || ''
      const loaded = loadDataset(id)
      if (!loaded) return undefined
      return { type: 'dataset', id, name: loaded.name, table: loaded.table, cols: loaded.cols }
    }
    case 'filter': {
      const ds = gatherDatasets(inputs)[0]
      if (!ds) return undefined
      const col = (node.config?.col as string) || ds.cols[0]?.name || ''
      const op = ((node.config?.op as FilterOp) || '>')
      const value = String(node.config?.value ?? '')
      const table = filterTable(ds.table, col, op, value)
      return { type: 'dataset', id: ds.id, name: `${ds.name} · filtered`, table, cols: profile(table) }
    }
    case 'group': {
      const ds = gatherDatasets(inputs)[0]
      if (!ds) return undefined
      const by = (node.config?.by as string) || ds.cols.find((c) => c.type === 'string')?.name || ds.cols[0]?.name || ''
      const measure = (node.config?.measure as string) || ds.cols.find((c) => c.type === 'number')?.name || ''
      const agg = ((node.config?.agg as Agg) || 'avg')
      const table = groupTable(ds.table, by, measure, agg)
      return { type: 'dataset', id: ds.id, name: `${ds.name} · ${agg} by ${by}`, table, cols: profile(table) }
    }
    case 'join': {
      const items = gatherDatasets(inputs)
      if (items.length < 2) return undefined
      const [a, b] = items
      const keyA = (node.config?.keyA as string) || a.cols.find((c) => c.type === 'string')?.name || a.cols[0]?.name || ''
      const keyB = (node.config?.keyB as string) || b.cols.find((c) => c.type === 'string')?.name || b.cols[0]?.name || ''
      const table = joinTables(a.table, b.table, keyA, keyB)
      return { type: 'dataset', id: a.id, name: `${a.name.split('·')[0].trim()} ⋈ ${b.name.split('·')[0].trim()}`, table, cols: profile(table) }
    }
    case 'profile': {
      const ds = gatherDatasets(inputs)[0]
      if (!ds) return undefined
      return { type: 'profile', id: ds.id, name: ds.name, table: ds.table, cols: ds.cols, rows: ds.table.rows.length }
    }
    case 'insights': {
      const ds = gatherDatasets(inputs)[0]
      if (!ds) return undefined
      return { type: 'insights', name: ds.name, findings: analyze(ds.table, ds.cols, { max: 6 }) }
    }
    case 'crosslink': {
      const items = gatherDatasets(inputs)
      if (items.length < 2) return { type: 'cross', findings: [], count: 0 }
      const cds: CrossDataset[] = items.map((d) => ({ id: d.id, name: d.name, table: d.table, cols: d.cols }))
      const findings = analyzeCross(cds, { max: 6 })
      return { type: 'cross', findings, count: findings.length }
    }
    case 'chart': {
      const ds = gatherDatasets(inputs)[0]
      if (!ds) return undefined
      // Prefer a low-cardinality categorical; fall back to ANY non-numeric column
      // (handles an already-aggregated table from a Group node, whose key may have
      // more than 24 distinct values). Then aggregate the first numeric by it.
      const cat =
        ds.cols.find((c) => c.type !== 'number' && c.unique > 1 && c.unique <= 24) ??
        ds.cols.find((c) => c.type !== 'number' && c.unique > 1) ??
        ds.cols.find((c) => c.type !== 'number')
      const numC = ds.cols.find((c) => c.type === 'number')
      if (!cat || !numC) return { type: 'chart', name: ds.name, series: [], xLabel: '' }
      const buckets = new Map<string, number[]>()
      for (const r of ds.table.rows) {
        const k = (r[cat.name] ?? '').trim() || '(blank)'
        const v = Number(String(r[numC.name] ?? '').replace(/[,%$\s]/g, ''))
        if (!Number.isNaN(v)) {
          const arr = buckets.get(k) ?? []
          arr.push(v)
          buckets.set(k, arr)
        }
      }
      const series = [...buckets.entries()]
        .map(([label, arr]) => ({ label, value: Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100) / 100 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
      return { type: 'chart', name: `${numC.name} by ${cat.name}`, series, xLabel: cat.name }
    }
    default:
      return undefined
  }
}

/* ------------------------------------------------- agentic prompt → flow ---- */
const KIND_KEYWORDS: { kind: NodeKind; words: string[] }[] = [
  { kind: 'filter', words: ['filter', 'where', 'only', 'exclude', 'subset', 'above', 'below', 'greater', 'less than'] },
  { kind: 'group', words: ['group', 'aggregate', 'average by', 'sum by', 'per ', 'by sector', 'by region', 'rollup', 'summari'] },
  { kind: 'profile', words: ['profile', 'quality', 'schema', 'columns', 'completeness', 'shape'] },
  { kind: 'crosslink', words: ['cross', 'link', 'relate', 'across datasets', 'between datasets', 'correlat'] },
  { kind: 'insights', words: ['insight', 'finding', 'analyze', 'analyse', 'trend', 'outlier', 'segment'] },
  { kind: 'chart', words: ['chart', 'plot', 'visuali', 'graph', 'bar', 'breakdown'] },
]

/** Pick catalog datasets a prompt mentions (by name/category/tags), else defaults. */
function datasetsFromPrompt(prompt: string, max = 3): CatalogDataset[] {
  const p = prompt.toLowerCase()
  const pool = analyzableCatalog()
  const scored = pool
    .map((d) => {
      const hay = `${d.name} ${d.category} ${d.tags.join(' ')}`.toLowerCase()
      let s = 0
      for (const w of p.split(/[^a-z0-9]+/).filter((x) => x.length > 3)) if (hay.includes(w)) s++
      return { d, s }
    })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
  const picked = scored.slice(0, max).map((r) => r.d)
  return picked.length ? picked : pool.slice(0, 2)
}

/** Build a runnable flow graph from a natural-language prompt — the "diagram a
 *  data flow" agentic step. Deterministic fallback; an LLM can replace the
 *  planner later, but this already produces a real, correct DAG. */
export function buildFlowFromPrompt(prompt: string): FlowGraph {
  const p = prompt.toLowerCase()
  const wantsCross = KIND_KEYWORDS.find((k) => k.kind === 'crosslink')!.words.some((w) => p.includes(w))
  const steps = new Set<NodeKind>()
  for (const { kind, words } of KIND_KEYWORDS) if (words.some((w) => p.includes(w))) steps.add(kind)
  if (steps.size === 0) {
    steps.add('insights')
    steps.add('chart')
  }

  const datasets = datasetsFromPrompt(prompt, wantsCross ? 3 : 1)
  const nodes: FlowGraph['nodes'] = []
  const edges: FlowGraph['edges'] = []
  let y = 80

  const dsNodes = datasets.map((d, i) => {
    const n = { id: uid('n'), kind: 'dataset' as const, title: d.name.split('—')[0].trim(), config: { datasetId: d.id }, x: 60, y: 80 + i * 170 }
    nodes.push(n)
    return n
  })

  let col = 360
  const place = (kind: NodeKind, title: string) => {
    const n = { id: uid('n'), kind, title, x: col, y: 120 }
    nodes.push(n)
    col += 300
    return n
  }

  if (wantsCross && dsNodes.length >= 2) {
    const x = place('crosslink', 'Cross-link')
    dsNodes.forEach((d) => edges.push({ id: uid('e'), from: d.id, to: x.id }))
    if (steps.has('insights') || steps.size > 1) {
      const ins = place('insights', 'Insights')
      // insights on the first dataset (single-table) alongside the cross-link
      edges.push({ id: uid('e'), from: dsNodes[0].id, to: ins.id })
    }
    return { nodes, edges }
  }

  // single-source pipeline: dataset -> [filter] -> [group] -> [profile] -> [insights] -> [chart]
  const src = dsNodes[0]
  let prev = src.id
  const LABELS: Partial<Record<NodeKind, string>> = { filter: 'Filter', group: 'Group', profile: 'Profile', insights: 'Insights', chart: 'Chart' }
  const ordered: NodeKind[] = (['filter', 'group', 'profile', 'insights', 'chart'] as NodeKind[]).filter((k) => steps.has(k))
  const chain = ordered.length ? ordered : (['insights'] as NodeKind[])
  for (const kind of chain) {
    const n = place(kind, LABELS[kind] ?? kind)
    edges.push({ id: uid('e'), from: prev, to: n.id })
    // transforms (filter/group) advance the chain; insights/profile/chart are
    // leaf-ish readers — keep chaining through transforms, branch the rest off
    // whatever the latest data-bearing node is.
    if (kind === 'filter' || kind === 'group') prev = n.id
  }
  void y
  return { nodes, edges }
}

/* ------------------------------------------- LLM flow plan → laid-out graph */
const VALID_KINDS = new Set<NodeKind>(['dataset', 'filter', 'group', 'join', 'profile', 'insights', 'crosslink', 'chart', 'note'])
const NODE_TITLE: Record<NodeKind, string> = {
  dataset: 'Dataset', filter: 'Filter', group: 'Group', join: 'Join',
  profile: 'Profile', insights: 'Insights', crosslink: 'Cross-link', chart: 'Chart', note: 'Note',
}

/** Convert an LLM-authored plan (ids + kinds + edges) into a runnable, laid-out
 *  FlowGraph: validates kinds, resolves dataset ids (fuzzy-matched to the
 *  catalog), drops edges that would create cycles, and assigns x/y by depth so
 *  the diagram reads left→right. Defensive — bad model output can't break it. */
export function flowPlanToGraph(plan: {
  nodes: { id: string; kind: string; title?: string; datasetId?: string }[]
  edges: { from: string; to: string }[]
}): FlowGraph {
  const pool = analyzableCatalog()
  const resolveDataset = (hint?: string): string => {
    if (!hint) return pool[0]?.id ?? ''
    const h = hint.toLowerCase()
    return (pool.find((d) => d.id === hint) ?? pool.find((d) => d.name.toLowerCase().includes(h) || h.includes(d.id)))?.id ?? pool[0]?.id ?? ''
  }

  const idMap = new Map<string, string>()
  const nodes: FlowNode[] = []
  for (const pn of plan.nodes ?? []) {
    const kind = pn.kind as NodeKind
    if (!VALID_KINDS.has(kind)) continue
    const id = uid('n')
    idMap.set(pn.id, id)
    nodes.push({
      id,
      kind,
      title: pn.title || NODE_TITLE[kind],
      config: kind === 'dataset' ? { datasetId: resolveDataset(pn.datasetId || pn.title) } : undefined,
      x: 0,
      y: 0,
    })
  }
  if (!nodes.length) return buildFlowFromPrompt('')

  const edges: FlowGraph['edges'] = []
  let g: FlowGraph = { nodes, edges }
  for (const pe of plan.edges ?? []) {
    const from = idMap.get(pe.from)
    const to = idMap.get(pe.to)
    if (!from || !to || from === to) continue
    if (edges.some((e) => e.from === from && e.to === to)) continue
    if (wouldCycle(g, from, to)) continue
    edges.push({ id: uid('e'), from, to })
    g = { nodes, edges }
  }

  const order = topoOrder(g).order
  const depth = new Map<string, number>()
  for (const id of order) {
    const ins = edges.filter((e) => e.to === id).map((e) => e.from)
    depth.set(id, ins.length ? Math.max(...ins.map((s) => (depth.get(s) ?? 0) + 1)) : 0)
  }
  const rowAt = new Map<number, number>()
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0
    const row = rowAt.get(d) ?? 0
    rowAt.set(d, row + 1)
    n.x = 60 + d * 300
    n.y = 70 + row * 190
  }
  return g
}
