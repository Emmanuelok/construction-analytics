/* Client side of the LLM-backed copilot. Talks to /api/copilot, which is only
 * active when the server has an ANTHROPIC_API_KEY. A cached probe tells the UI
 * whether to offer the AI path; when unavailable, callers fall back to the
 * always-on deterministic engine in src/lib/intelligence.ts. */

export type CopilotStatus = { enabled: boolean; model: string | null }

export type WorkspacePlan = {
  summary: string
  next_step: string
  hypotheses: string[]
  dataset_suggestions?: { name: string; reason: string }[]
  tasks: string[]
  risks?: string[]
}

export type AnalystAnswer = {
  answer: string
  sql: string
  domains: string[]
  followups?: string[]
}

let statusPromise: Promise<CopilotStatus> | null = null

/** Probe whether the server copilot is configured. Cached for the session. */
export function copilotStatus(): Promise<CopilotStatus> {
  if (!statusPromise) {
    statusPromise = fetch('/api/copilot', { method: 'GET' })
      .then(async (res) => {
        const ct = res.headers.get('content-type') ?? ''
        if (!res.ok || !ct.includes('application/json')) return { enabled: false, model: null }
        const data = (await res.json().catch(() => ({}))) as Partial<CopilotStatus>
        return { enabled: Boolean(data.enabled), model: data.model ?? null }
      })
      .catch(() => ({ enabled: false, model: null }))
  }
  return statusPromise
}

export type FlowPlan = {
  nodes: { id: string; kind: string; title?: string; datasetId?: string }[]
  edges: { from: string; to: string }[]
  rationale?: string
}

async function invoke<T>(mode: 'workspace' | 'ask' | 'flow', prompt: string, context?: string): Promise<{ ok: true; data: T; model?: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, prompt, context }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; model?: string; error?: string }
    if (!res.ok || !data.ok || !data.data) return { ok: false, error: data.error ?? `Copilot failed (${res.status})` }
    return { ok: true, data: data.data, model: data.model }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export function workspaceCopilot(prompt: string, context: string) {
  return invoke<WorkspacePlan>('workspace', prompt, context)
}

export function askCopilot(question: string, context: string) {
  return invoke<AnalystAnswer>('ask', question, context)
}

export function flowCopilot(prompt: string, context: string) {
  return invoke<FlowPlan>('flow', prompt, context)
}
