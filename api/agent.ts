import Anthropic from '@anthropic-ai/sdk'
import { AGENT_TOOLS, runTool } from '../src/lib/agent-tools'

/* POST /api/agent — an agentic analyst. Claude is given the studio's tools
 * (massing, zoning, IFC, suppliers, carbon — the same ones the MCP server exposes)
 * and runs them in a loop to answer with real, computed numbers. Returns the final
 * answer plus the tool steps it took. GET /api/agent — probe { enabled, tools }.
 * With no ANTHROPIC_API_KEY the app keeps using its deterministic engines/UI. */

const MODEL = process.env.COPILOT_MODEL || 'claude-opus-4-8'

const SYSTEM = `You are the analyst-agent for the AEC Data & Intelligence Studio — a platform for the built environment.

You have tools that run the studio's real engines: generate + quantify a building massing, run a site/zoning capacity & compliance check, parse an IFC model, score suppliers, and compute embodied carbon. PREFER calling these tools and answering from their actual results rather than estimating.

How to work:
- Decompose the request, call the right tool(s) with sensible parameters, then synthesise a concise, quantitative answer using the returned numbers (cite the key figures with units).
- Chain tools when useful (e.g. size a massing, then check it against zoning).
- If a parameter is missing, choose a reasonable default and say what you assumed.
- Be specific and AEC-literate (GFA, FAR, façade area, embodied carbon kgCO₂e/m², setback, sky-exposure plane). Keep the final answer tight.`

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY
  if (req.method === 'GET') return json({ enabled: Boolean(key), tools: AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description })) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!key) return json({ error: 'The agent is not configured on the server (no ANTHROPIC_API_KEY).' }, 501)

  let body: { prompt?: string }
  try { body = (await req.json()) as typeof body } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const prompt = (body.prompt ?? '').slice(0, 6000)
  if (!prompt) return json({ error: 'Missing prompt' }, 400)

  const client = new Anthropic({ apiKey: key })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as any }))
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  const steps: { tool: string; input: unknown; ok: boolean }[] = []

  try {
    for (let i = 0; i < 6; i++) {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools,
        messages,
      })
      messages.push({ role: 'assistant', content: msg.content })
      const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (toolUses.length === 0) {
        const answer = msg.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('\n').trim()
        return json({ ok: true, answer, steps, model: MODEL })
      }
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        let out: unknown
        let good = true
        try { out = await runTool(tu.name, tu.input as Record<string, unknown>) } catch (e) { out = { error: e instanceof Error ? e.message : String(e) }; good = false }
        steps.push({ tool: tu.name, input: tu.input, ok: good })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 8000), is_error: !good })
      }
      messages.push({ role: 'user', content: results })
    }
    return json({ ok: true, answer: 'Reached the tool-step limit before finishing — try a more specific question.', steps, model: MODEL })
  } catch (e) {
    const status = (e as { status?: number }).status
    return json({ error: e instanceof Error ? e.message : 'Agent request failed' }, status && status >= 400 && status < 600 ? status : 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
