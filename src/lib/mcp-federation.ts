/* Remote-MCP federation for the in-app agent. Lets /api/agent connect to external
 * MCP servers (over Streamable HTTP), list their tools, and merge them — namespaced
 * — into its own tool loop, so the studio's AI can also drive other apps' tools
 * (e.g. a hosted Autodesk MCP, a database server). Pure helpers (config parse,
 * name-spacing, merge/route) are unit-tested; the HTTP connect is exercised in the
 * federation smoke via an in-memory transport. Server-only — never bundled into the
 * web client. */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'

export type RemoteConfig = { name: string; url: string; headers?: Record<string, string> }

const safeName = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32)

/** Parse the MCP_SERVERS env: a JSON array of { name, url, headers? }, a single
 *  JSON object, or comma-separated `name=url` pairs. Returns [] when unset/invalid. */
export function parseMcpServers(env: string | undefined): RemoteConfig[] {
  if (!env || !env.trim()) return []
  try {
    const v = JSON.parse(env) as unknown
    const arr = Array.isArray(v) ? v : [v]
    return arr
      .filter((s): s is { name: string; url: string; headers?: Record<string, string> } => !!s && typeof s === 'object' && 'name' in s && 'url' in s)
      .map((s) => ({ name: safeName(String(s.name)), url: String(s.url), headers: s.headers }))
      .filter((s) => s.name && /^https?:\/\//.test(s.url))
  } catch {
    return env.split(',').map((p) => p.trim()).filter(Boolean).flatMap((p) => {
      const i = p.indexOf('=')
      if (i < 0) return []
      const name = safeName(p.slice(0, i)); const url = p.slice(i + 1).trim()
      return name && /^https?:\/\//.test(url) ? [{ name, url }] : []
    })
  }
}

export const SEP = '__'
export const qualify = (server: string, tool: string): string => `${server}${SEP}${tool}`
export function split(qualified: string): { server: string; tool: string } | null {
  const i = qualified.indexOf(SEP)
  return i < 0 ? null : { server: qualified.slice(0, i), tool: qualified.slice(i + SEP.length) }
}

type RemoteTool = { name: string; description?: string; inputSchema?: unknown }
export type Remote = { name: string; client: Client; tools: RemoteTool[] }
export type FederatedTool = { name: string; description: string; input_schema: unknown }

/** Connect a Client to a transport and list its tools (transport injected so the
 *  smoke can use an in-memory pair; production passes a Streamable HTTP transport). */
export async function connectClient(name: string, transport: Transport): Promise<Remote> {
  const client = new Client({ name: 'aec-studio-agent', version: '0.1.0' })
  await client.connect(transport)
  const { tools } = await client.listTools()
  return { name, client, tools: tools as RemoteTool[] }
}

/** Connect to a remote MCP server over Streamable HTTP. */
export function connectRemote(cfg: RemoteConfig): Promise<Remote> {
  const transport = new StreamableHTTPClientTransport(new URL(cfg.url), cfg.headers ? { requestInit: { headers: cfg.headers } } : undefined)
  return connectClient(cfg.name, transport)
}

/** Namespaced Anthropic tool defs + a routing map from a set of remotes. */
export function buildFederatedTools(remotes: Remote[]): { tools: FederatedTool[]; routing: Map<string, { remote: Remote; tool: string }> } {
  const tools: FederatedTool[] = []
  const routing = new Map<string, { remote: Remote; tool: string }>()
  for (const r of remotes) {
    for (const t of r.tools) {
      const qn = qualify(r.name, t.name)
      tools.push({ name: qn, description: `[${r.name}] ${t.description ?? t.name}`, input_schema: t.inputSchema ?? { type: 'object', properties: {} } })
      routing.set(qn, { remote: r, tool: t.name })
    }
  }
  return { tools, routing }
}

/** Dispatch a federated tool call → the owning remote, returning text content. */
export async function callFederated(routing: Map<string, { remote: Remote; tool: string }>, qualified: string, args: Record<string, unknown>): Promise<string> {
  const route = routing.get(qualified)
  if (!route) throw new Error(`No federated tool named ${qualified}`)
  const res = await route.remote.client.callTool({ name: route.tool, arguments: args })
  const content = (res.content as { type: string; text?: string }[] | undefined) ?? []
  return content.map((c) => (c.type === 'text' ? c.text ?? '' : JSON.stringify(c))).join('\n')
}

export async function closeRemotes(remotes: Remote[]): Promise<void> {
  await Promise.allSettled(remotes.map((r) => r.client.close()))
}
