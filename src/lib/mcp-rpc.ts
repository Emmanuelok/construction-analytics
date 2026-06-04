/* Studio MCP-over-HTTP — a pure, stateless JSON-RPC 2.0 handler implementing the core
 * Model Context Protocol methods (initialize / tools/list / tools/call / ping) over the
 * SAME tool layer (AGENT_TOOLS + runTool) the stdio MCP server and the in-app agent use.
 * api/mcp-server.ts is a thin HTTP wrapper around this, so a remote MCP host (or any
 * JSON-RPC client) can pull the studio's tools — including export_building — without
 * anything running locally. Pure (engines only); unit-tested. */

import { AGENT_TOOLS, runTool } from './agent-tools'

export const MCP_PROTOCOL = '2024-11-05'
export const SERVER_INFO = { name: 'aec-studio', version: '0.1.0' }

export type RpcRequest = { jsonrpc?: string; id?: string | number | null; method: string; params?: Record<string, unknown> }
export type RpcResponse = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

/** Handle one JSON-RPC request → a response, or null for a notification (no reply). */
export async function handleMcpRpc(req: RpcRequest): Promise<RpcResponse | null> {
  const id = req?.id ?? null
  const reply = (result: unknown): RpcResponse => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (!req || typeof req.method !== 'string') return fail(-32600, 'Invalid Request')
  // notifications (no id, or the MCP lifecycle notifications) get no response
  if (req.id === undefined || req.method.startsWith('notifications/')) return null

  switch (req.method) {
    case 'initialize':
      return reply({
        protocolVersion: MCP_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'AEC Data & Intelligence Studio tools: parametric massing, zoning, IFC parsing, building export (IFC/OBJ/JSON), supplier scoring and embodied carbon.',
      })
    case 'tools/list':
      return reply({ tools: AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) })
    case 'tools/call': {
      const name = String(req.params?.name ?? '')
      const args = (req.params?.arguments as Record<string, unknown>) ?? {}
      if (!AGENT_TOOLS.some((t) => t.name === name)) return reply({ content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true })
      try {
        const out = await runTool(name, args)
        return reply({ content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] })
      } catch (e) {
        return reply({ content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true })
      }
    }
    case 'ping':
      return reply({})
    default:
      return fail(-32601, `Method not found: ${req.method}`)
  }
}
