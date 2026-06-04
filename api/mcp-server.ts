import { handleMcpRpc, MCP_PROTOCOL, SERVER_INFO, type RpcRequest } from '../src/lib/mcp-rpc'
import { AGENT_TOOLS } from '../src/lib/agent-tools-meta'

/* The studio's own MCP server over HTTP (stateless JSON-RPC 2.0 — the MCP Streamable
 * HTTP transport's JSON path). Point any remote MCP host at POST /api/mcp-server to
 * pull the studio's tools (massing, zoning, IFC, export_building, …). GET returns a
 * capability descriptor. No keys required; runs the same pure engines as the app. */
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, authorization',
}
const json = (data: unknown, status = 200): Response => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } })

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method === 'GET') {
    return json({
      name: SERVER_INFO.name, version: SERVER_INFO.version, protocolVersion: MCP_PROTOCOL,
      transport: 'streamable-http (stateless JSON-RPC)', endpoint: '/api/mcp-server',
      methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
      tools: AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description })),
      usage: 'POST a JSON-RPC 2.0 request, e.g. {"jsonrpc":"2.0","id":1,"method":"tools/list"}.',
    })
  }
  if (req.method !== 'POST') return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Method not allowed' } }, 405)

  let body: unknown
  try { body = await req.json() } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) }

  if (Array.isArray(body)) { // JSON-RPC batch
    const out = (await Promise.all(body.map((r) => handleMcpRpc(r as RpcRequest)))).filter(Boolean)
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS })
  }
  const res = await handleMcpRpc(body as RpcRequest)
  return res ? json(res) : new Response(null, { status: 202, headers: CORS }) // notification → no body
}
