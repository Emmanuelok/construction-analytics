import { useEffect, useState } from 'react'
import { Bot, Loader2, Wrench, ArrowRight, AlertTriangle, KeyRound, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardHeader, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { AGENT_TOOLS } from '@/lib/agent-tools-meta'

type Step = { tool: string; input: unknown; ok: boolean }
type ToolInfo = { name: string; description: string }
const DEFAULT_TOOLS: ToolInfo[] = AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description }))

const EXAMPLES = [
  'Size a 40-storey L-shaped tower for 120,000 m² and give me the façade area and embodied carbon.',
  'Does a 9,000 m² / 14-storey scheme fit FAR 4, 60 m height limit, 6 m setback on a 60×45 m site?',
  'Compare the embodied carbon of a tapered vs a straight 100,000 m² tower.',
]

/* The agentic analyst: sends a question to /api/agent, where Claude runs the
 * studio's real tools (massing, zoning, IFC, suppliers, carbon) and answers with
 * computed numbers. Shows the answer + the tool steps it took. Degrades to a
 * capability preview when ANTHROPIC_API_KEY isn't configured. */
export function AgentConsole() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [tools, setTools] = useState<ToolInfo[]>(DEFAULT_TOOLS)
  const [federated, setFederated] = useState<string[]>([])
  useEffect(() => {
    let live = true
    fetch('/api/agent').then((r) => (r.ok ? r.json() : null)).then((d) => { if (!live) return; setEnabled(Boolean(d?.enabled)); if (d?.tools?.length) setTools(d.tools); setFederated(d?.federated ?? []) }).catch(() => { if (live) setEnabled(false) })
    return () => { live = false }
  }, [])

  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [error, setError] = useState<string | null>(null)

  async function run(question: string) {
    if (!question.trim() || busy) return
    setBusy(true); setError(null); setAnswer(null); setSteps([])
    try {
      const r = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: question }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `Agent failed (${r.status})`)
      setAnswer(d.answer); setSteps(d.steps ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Agent request failed') } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader
        icon={Bot}
        accent="violet"
        title="AEC Agent — runs the studio's tools"
        subtitle="Ask in plain English; the agent calls the platform's real engines (massing, zoning, IFC, suppliers, carbon) and answers with computed numbers."
        action={enabled === null ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : enabled ? <Badge variant="success" dot>Agent online</Badge> : <Badge variant="neutral" dot>Preview</Badge>}
      />
      <div className="space-y-4 border-t border-edge/50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(q) }}
            disabled={!enabled || busy}
            placeholder={enabled ? 'Ask the agent to size, check or quantify something…' : 'Agent preview — add ANTHROPIC_API_KEY to enable'}
            aria-label="Ask the AEC agent"
            className="flex-1 rounded-lg border border-edge/60 bg-elevated/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-60"
          />
          <button onClick={() => run(q)} disabled={!enabled || busy || !q.trim()} className="btn-primary disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Run
          </button>
        </div>

        {enabled && !answer && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => { setQ(ex); run(ex) }} className="rounded-lg border border-edge/60 px-2.5 py-1 text-left text-xs text-slate-400 hover:bg-elevated/50 hover:text-slate-200">{ex}</button>
            ))}
          </div>
        )}

        {federated.length > 0 && <p className="text-[11px] text-slate-500">Federating external MCP: <span className="text-slate-300">{federated.join(', ')}</span></p>}

        {error && <p className="flex items-center gap-2 text-sm text-rose-300"><AlertTriangle className="h-4 w-4" /> {error}</p>}

        {(busy || steps.length > 0) && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tool steps</div>
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {s.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                <Wrench className="h-3 w-3 text-slate-500" />
                <span className="data-mono text-slate-300">{s.tool}</span>
                <span className="truncate text-slate-500">{JSON.stringify(s.input).slice(0, 80)}</span>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> thinking &amp; running tools…</div>}
          </div>
        )}

        {answer && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-200">{answer}</p>
          </div>
        )}

        {enabled === false && (
          <div className="space-y-2 rounded-lg bg-elevated/40 p-3">
            <p className="flex items-center gap-2 text-xs text-slate-400"><KeyRound className="h-3.5 w-3.5 shrink-0" /> Set <code className="rounded bg-base/60 px-1 text-slate-200">ANTHROPIC_API_KEY</code> on the server to turn the agent on. It can call these tools:</p>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((t) => <span key={t.name} title={t.description} className={cn('rounded-md px-2 py-0.5 text-[11px] ring-1 ring-inset ring-edge/60 text-slate-300')}>{t.name}</span>)}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
