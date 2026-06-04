import { useEffect, useState, type ReactNode } from 'react'
import { Cable, Building2, Server, Cpu, KeyRound, Loader2, type LucideIcon } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge } from '@/components/ui'
import { ToolRunner } from '@/components/ToolRunner'
import { AGENT_TOOLS } from '@/lib/agent-tools-meta'
import { runTool } from '@/lib/agent-tools'
import type { Accent } from '@/lib/nav'

type Tool = { name: string; description?: string; inputSchema: unknown }
type RunFn = (tool: string, args: Record<string, unknown>) => Promise<unknown>
type McpServer = { name: string; connected: boolean; error?: string; tools: Tool[] }

const STUDIO_TOOLS: Tool[] = AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
const APS_TOOLS: Tool[] = [
  { name: 'list_models', description: 'List native models uploaded to Autodesk, with their URNs.', inputSchema: { type: 'object', properties: {} } },
  { name: 'properties', description: 'Extract element properties (quantities, types, parameters) from a translated model.', inputSchema: { type: 'object', properties: { urn: { type: 'string', description: 'Model URN' }, guid: { type: 'string', description: 'Viewable GUID (optional)' } }, required: ['urn'] } },
]

async function post(url: string, body: unknown): Promise<unknown> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const d = (await r.json().catch(() => ({}))) as { error?: string; result?: unknown }
  if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`)
  return d.result
}

/* The Connections hub: one place to pull data + run tools across every connected
 * platform — the studio's own engines (always on), Autodesk APS, and federated MCP
 * servers — via a shared schema-driven runner. */
export default function Connections() {
  const [aps, setAps] = useState<boolean | null>(null)
  const [mcp, setMcp] = useState<{ configured: boolean; servers: McpServer[] } | null>(null)
  useEffect(() => {
    let live = true
    fetch('/api/aps-data').then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setAps(Boolean(d?.enabled)) }).catch(() => { if (live) setAps(false) })
    fetch('/api/mcp').then((r) => (r.ok ? r.json() : null)).then((d) => { if (live) setMcp(d && Array.isArray(d.servers) ? d : { configured: false, servers: [] }) }).catch(() => { if (live) setMcp({ configured: false, servers: [] }) })
    return () => { live = false }
  }, [])

  const apsRun: RunFn = (tool, args) => post('/api/aps-data', { action: tool, ...args })
  const mcpRun = (server: string): RunFn => (tool, args) => post('/api/mcp', { server, tool, args })
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Cable}
        accent="cyan"
        eyebrow="Platform"
        title="Connections"
        description="Pull data and run tools across every connected platform from one place — the studio's own engines, Autodesk, and any federated MCP server. Fill the inputs, hit Run / Pull, then view and export the result."
      />

      <PlatformCard icon={Cpu} accent="blue" title="Studio engines" subtitle="Run the platform's analytics directly — massing, zoning, IFC, suppliers, carbon — and export a generated building to IFC / OBJ / JSON. No setup; results download in a click." status={<Badge variant="success" dot>Ready</Badge>} tools={STUDIO_TOOLS} run={(n, a) => runTool(n, a)} runLabel="Run" />

      <Card>
        <CardHeader icon={Server} accent="emerald" title="Studio MCP endpoint" subtitle="Point any remote MCP host (Claude Desktop / Code / Cursor, or your own agent) at this URL to pull the studio's tools over HTTP — including export_building. Stateless JSON-RPC; no keys." action={<Badge variant="success" dot>Live</Badge>} />
        <div className="space-y-2 border-t border-edge/50 p-5">
          <code className="block break-all rounded-lg bg-base/60 px-3 py-2 text-sm text-emerald-200 ring-1 ring-inset ring-edge/60">{origin}/api/mcp-server</code>
          <p className="text-xs text-slate-500">Methods: <code className="text-slate-300">initialize</code> · <code className="text-slate-300">tools/list</code> · <code className="text-slate-300">tools/call</code> · <code className="text-slate-300">ping</code>. {AGENT_TOOLS.length} tools, including <code className="text-slate-300">export_building</code> (IFC / OBJ / JSON).</p>
        </div>
      </Card>

      <PlatformCard
        icon={Building2}
        accent="rose"
        title="Autodesk Platform Services"
        subtitle="Pull native model data — list models, extract element properties from translated Revit/Navisworks/AutoCAD. The MCP server can also publish a generated building (IFC/OBJ) straight to APS for translation."
        status={aps === null ? <Spin /> : aps ? <Badge variant="success" dot>Connected</Badge> : <Badge variant="neutral" dot>Not connected</Badge>}
        tools={APS_TOOLS}
        run={apsRun}
        runLabel="Pull"
        setup={aps === false ? <Setup what="Autodesk" env={['APS_CLIENT_ID', 'APS_CLIENT_SECRET']} note="Then upload models in BIM Intelligence; they'll appear here to query." /> : undefined}
      />

      {mcp === null && <Card><div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Spin /> Checking federated MCP servers…</div></Card>}
      {mcp && !mcp.configured && (
        <Card>
          <CardHeader icon={Server} accent="violet" title="Federated MCP servers" subtitle="Connect external MCP servers to pull their tools & data here." action={<Badge variant="neutral" dot>None configured</Badge>} />
          <div className="border-t border-edge/50 p-5"><Setup what="federated MCP servers" env={['MCP_SERVERS']} note="A JSON array of { name, url } — e.g. a hosted Autodesk MCP, a database server, your own." /></div>
        </Card>
      )}
      {mcp?.servers.map((s) => (
        s.connected
          ? <PlatformCard key={s.name} icon={Server} accent="violet" title={`MCP · ${s.name}`} subtitle={`${s.tools.length} tool${s.tools.length === 1 ? '' : 's'} available`} status={<Badge variant="success" dot>Connected</Badge>} tools={s.tools} run={mcpRun(s.name)} runLabel="Pull" />
          : <Card key={s.name}><CardHeader icon={Server} accent="rose" title={`MCP · ${s.name}`} subtitle={s.error || 'Could not connect'} action={<Badge variant="danger" dot>Error</Badge>} /></Card>
      ))}
    </div>
  )
}

function PlatformCard({ icon, accent, title, subtitle, status, tools, run, runLabel = 'Run', setup }: {
  icon: LucideIcon; accent: Accent; title: string; subtitle: string; status: ReactNode; tools: Tool[]; run: RunFn; runLabel?: string; setup?: ReactNode
}) {
  const [sel, setSel] = useState(tools[0]?.name ?? '')
  const tool = tools.find((t) => t.name === sel) ?? tools[0]
  return (
    <Card>
      <CardHeader icon={icon} accent={accent} title={title} subtitle={subtitle} action={status} />
      <div className="border-t border-edge/50 p-5">
        {setup ?? (
          <div className="space-y-4">
            {tools.length > 1 && (
              <label className="block text-xs">
                <span className="mb-1 block text-slate-400">Tool</span>
                <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full max-w-sm rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 sm:w-auto">
                  {tools.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </label>
            )}
            {tool && <ToolRunner key={tool.name} tool={tool} run={run} actionLabel={runLabel} />}
          </div>
        )}
      </div>
    </Card>
  )
}

const Spin = () => <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
function Setup({ what, env, note }: { what: string; env: string[]; note?: string }) {
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
        <KeyRound className="h-4 w-4 shrink-0" /> Set {env.map((e) => <code key={e} className="rounded bg-elevated/60 px-1 text-slate-200">{e}</code>)} on the server to connect {what}.
      </p>
      {note && <p className="pl-6 text-xs text-slate-500">{note}</p>}
    </div>
  )
}
