import { parseMcpServers, connectRemote, type Remote } from '../src/lib/mcp-federation'

/* GET  /api/mcp — list configured external MCP servers + their tools (best-effort
 *                 connect), so the Connections hub can render a Pull button per tool.
 * POST /api/mcp { server, tool, args } — call a tool on one server, return its
 *                 result. Secrets/URLs stay server-side via MCP_SERVERS. */
export default async function handler(req: Request): Promise<Response> {
  const configs = parseMcpServers(process.env.MCP_SERVERS)

  if (req.method === 'GET') {
    const servers = []
    for (const cfg of configs) {
      try {
        const r = await connectRemote(cfg)
        servers.push({ name: cfg.name, connected: true, tools: r.tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) })
        await r.client.close()
      } catch (e) {
        servers.push({ name: cfg.name, connected: false, error: e instanceof Error ? e.message : String(e), tools: [] })
      }
    }
    return json({ configured: configs.length > 0, servers })
  }

  if (req.method === 'POST') {
    let body: { server?: string; tool?: string; args?: Record<string, unknown> }
    try { body = (await req.json()) as typeof body } catch { return json({ error: 'Invalid JSON body' }, 400) }
    const cfg = configs.find((c) => c.name === body.server)
    if (!cfg) return json({ error: `Unknown MCP server: ${body.server}` }, 404)
    if (!body.tool) return json({ error: 'Missing tool' }, 400)
    let remote: Remote | undefined
    try {
      remote = await connectRemote(cfg)
      const res = await remote.client.callTool({ name: body.tool, arguments: body.args ?? {} })
      const content = ((res.content as { type: string; text?: string }[] | undefined) ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : JSON.stringify(c))).join('\n')
      return json({ ok: true, result: content })
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Tool call failed' }, 502)
    } finally {
      try { await remote?.client.close() } catch { /* ignore */ }
    }
  }
  return json({ error: 'Method not allowed' }, 405)
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
