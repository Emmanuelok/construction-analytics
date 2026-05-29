/* ============================================================================
 * Flow engine — a directed graph of data nodes with a topological run that
 * propagates each node's output to its downstream consumers. Pure and generic:
 * the engine knows nothing about analytics — it orders the DAG, gathers each
 * node's inputs from upstream outputs, and calls a `compute` function you
 * provide. This separation keeps the graph logic unit-testable in isolation
 * (the app wires in parse/insights/crossdataset as the compute step).
 * ========================================================================== */

export type NodeKind = 'dataset' | 'filter' | 'group' | 'join' | 'profile' | 'insights' | 'crosslink' | 'chart' | 'note'

export type FlowNode = {
  id: string
  kind: NodeKind
  title: string
  config?: Record<string, unknown>
  x: number
  y: number
}
export type FlowEdge = { id: string; from: string; to: string }
export type FlowGraph = { nodes: FlowNode[]; edges: FlowEdge[] }

/** Direct upstream node ids feeding `nodeId` (in edge-declaration order). */
export function inputsOf(graph: FlowGraph, nodeId: string): string[] {
  return graph.edges.filter((e) => e.to === nodeId).map((e) => e.from)
}

/** Kahn topological sort. Returns ordering and whether a cycle was detected
 *  (cyclic nodes are excluded from `order`). */
export function topoOrder(graph: FlowGraph): { order: string[]; cycle: boolean } {
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) {
    indeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of graph.edges) {
    if (!indeg.has(e.from) || !indeg.has(e.to)) continue // ignore dangling edges
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
    adj.get(e.from)!.push(e.to)
  }
  const queue = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adj.get(id) ?? []) {
      indeg.set(next, (indeg.get(next) ?? 0) - 1)
      if ((indeg.get(next) ?? 0) === 0) queue.push(next)
    }
  }
  return { order, cycle: order.length !== graph.nodes.length }
}

/** Would adding edge from→to create a cycle? (Used to block bad wiring in UI.) */
export function wouldCycle(graph: FlowGraph, from: string, to: string): boolean {
  if (from === to) return true
  // reachable(to -> ... -> from)? then from->to closes a loop
  const adj = new Map<string, string[]>()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges) adj.get(e.from)?.push(e.to)
  const seen = new Set<string>()
  const stack = [to]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === from) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const n of adj.get(cur) ?? []) stack.push(n)
  }
  return false
}

export type RunResult<T> = {
  outputs: Map<string, T | undefined>
  errors: Map<string, string>
  cycle: boolean
  order: string[]
}

/** Run the graph: for each node in topological order, gather upstream outputs
 *  (in edge order) and compute this node's output. A compute throw is captured
 *  per-node and its output left undefined; downstream still runs with what it
 *  has. */
export function runFlow<T>(
  graph: FlowGraph,
  compute: (node: FlowNode, inputs: (T | undefined)[]) => T | undefined,
): RunResult<T> {
  const { order, cycle } = topoOrder(graph)
  const outputs = new Map<string, T | undefined>()
  const errors = new Map<string, string>()
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const id of order) {
    const node = byId.get(id)
    if (!node) continue
    const inputs = inputsOf(graph, id).map((src) => outputs.get(src))
    try {
      outputs.set(id, compute(node, inputs))
    } catch (e) {
      errors.set(id, e instanceof Error ? e.message : 'compute failed')
      outputs.set(id, undefined)
    }
  }
  return { outputs, errors, cycle, order }
}

let seq = 0
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** Validate a graph for common authoring mistakes (surfaced in the UI). */
export function validate(graph: FlowGraph): string[] {
  const issues: string[] = []
  const { cycle } = topoOrder(graph)
  if (cycle) issues.push('The flow has a cycle — data can’t propagate.')
  for (const n of graph.nodes) {
    const ins = inputsOf(graph, n.id).length
    if (n.kind === 'dataset' && ins > 0) issues.push(`“${n.title}” is a source but has an input wired in.`)
    if (n.kind !== 'dataset' && n.kind !== 'note' && ins === 0) issues.push(`“${n.title}” has no input connected.`)
    if (n.kind === 'crosslink' && ins === 1) issues.push(`“${n.title}” needs at least two datasets to link.`)
    if (n.kind === 'join' && ins < 2) issues.push(`“${n.title}” needs two inputs to join.`)
  }
  return issues
}
