import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { uid, type FlowEdge, type FlowGraph, type FlowNode } from '@/lib/flow'
import { useAuth } from '@/store/auth'

/* Persists a single working Flow graph per account (the studio canvas). Kept
 * deliberately simple — one active flow — so the canvas is a true scratchpad. */

type FlowsValue = {
  graph: FlowGraph
  setGraph: (g: FlowGraph) => void
  addNode: (n: Omit<FlowNode, 'id'>) => string
  updateNode: (id: string, patch: Partial<FlowNode>) => void
  removeNode: (id: string) => void
  addEdge: (from: string, to: string) => void
  removeEdge: (id: string) => void
  clear: () => void
}

const Ctx = createContext<FlowsValue | null>(null)
const KEY = 'aec-flow'
const empty: FlowGraph = { nodes: [], edges: [] }

function load(key: string): FlowGraph {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as FlowGraph) : empty
  } catch {
    return empty
  }
}

export function FlowsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const key = user ? `${KEY}::${user.id}` : KEY
  const [graph, setGraphState] = useState<FlowGraph>(() => load(KEY))

  useEffect(() => {
    setGraphState(load(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(graph))
    } catch {
      /* ignore */
    }
  }, [graph, key])

  const value = useMemo<FlowsValue>(
    () => ({
      graph,
      setGraph: (g) => setGraphState(g),
      addNode: (n) => {
        const id = uid('n')
        setGraphState((g) => ({ ...g, nodes: [...g.nodes, { ...n, id }] }))
        return id
      },
      updateNode: (id, patch) => setGraphState((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
      removeNode: (id) =>
        setGraphState((g) => ({
          nodes: g.nodes.filter((n) => n.id !== id),
          edges: g.edges.filter((e) => e.from !== id && e.to !== id),
        })),
      addEdge: (from, to) =>
        setGraphState((g) => {
          if (from === to || g.edges.some((e) => e.from === from && e.to === to)) return g
          const e: FlowEdge = { id: uid('e'), from, to }
          return { ...g, edges: [...g.edges, e] }
        }),
      removeEdge: (id) => setGraphState((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== id) })),
      clear: () => setGraphState(empty),
    }),
    [graph, key],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFlows(): FlowsValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFlows must be used within FlowsProvider')
  return ctx
}
