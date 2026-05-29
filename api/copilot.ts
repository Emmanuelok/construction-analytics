import Anthropic from '@anthropic-ai/sdk'

/* POST /api/copilot — the LLM-backed reasoning layer for the studio. Two modes:
 *   - 'workspace': reasons over a problem + attached datasets + profile/stage and
 *                  returns a plan (narrative, next step, hypotheses, data picks).
 *   - 'ask':       answers an analytics question over a compact data context and
 *                  returns a narrative answer, an illustrative SQL plan & sources.
 * GET /api/copilot — a probe: { enabled, model } so the client lights up the AI
 * path only when ANTHROPIC_API_KEY is configured. With no key the app falls back
 * to the always-on deterministic engine. Structured output via forced tool use;
 * the stable system prompt is prompt-cached. */

// Default to the most capable model; override with COPILOT_MODEL. The model ID
// is passed through to the API as a string, so newer models work without an SDK
// bump. Structured output uses forced tool use (reliable on this SDK and the
// right fit for rendering fixed UI shapes).
const MODEL = process.env.COPILOT_MODEL || 'claude-opus-4-8'

const SYSTEM = `You are the Copilot for the AEC Data & Intelligence Studio — a unified data marketplace, lakehouse and analytics platform for the built environment (architecture, engineering, construction & operations).

You help each user move from a problem to a result: framing problems, assembling the right datasets, forming and testing hypotheses, and interpreting analytics. The platform's data spans cost & estimating, schedule & controls, BIM/IFC models, sustainability/embodied-carbon (EPD), procurement & suppliers, quality/defects, reality capture, building operations telemetry, geospatial, and AI-training corpora (RFI pairs, defect imagery, classified IFC).

Principles:
- Be concrete, quantitative and domain-aware. Use real AEC terminology (cost/m², critical path, embodied carbon A1–A3, COBie, clash detection, lead time).
- Ground advice in the datasets and context the user provides; never invent specific dataset names that weren't given.
- Be concise and actionable. Prefer specific next steps over generalities.
- When you produce SQL it is illustrative of the query plan, not executed.
Always respond by calling the provided tool with well-formed fields.`

const WORKSPACE_TOOL = {
  name: 'workspace_plan',
  description: 'Return a structured plan for advancing a problem-solving workspace.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'A 1–2 sentence read on where this workspace stands.' },
      next_step: { type: 'string', description: 'The single most valuable next action right now.' },
      hypotheses: { type: 'array', items: { type: 'string' }, description: '2–4 testable hypotheses tailored to the problem.' },
      dataset_suggestions: {
        type: 'array',
        items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] },
        description: 'Datasets from the provided list that are most relevant, each with a one-line reason. Only use names from the provided context.',
      },
      tasks: { type: 'array', items: { type: 'string' }, description: '2–4 concrete tasks for the current stage.' },
      risks: { type: 'array', items: { type: 'string' }, description: '1–3 risks or caveats to watch.' },
    },
    required: ['summary', 'next_step', 'hypotheses', 'tasks'],
  },
}

const ASK_TOOL = {
  name: 'analyst_answer',
  description: 'Answer an AEC analytics question with a narrative, an illustrative SQL plan and the data domains used.',
  input_schema: {
    type: 'object' as const,
    properties: {
      answer: { type: 'string', description: 'A clear, quantitative narrative answer (2–4 short paragraphs).' },
      sql: { type: 'string', description: 'An illustrative SQL query that would produce the answer.' },
      domains: { type: 'array', items: { type: 'string' }, description: 'The data domains/datasets the answer draws on.' },
      followups: { type: 'array', items: { type: 'string' }, description: '2–3 sharp follow-up questions.' },
    },
    required: ['answer', 'sql', 'domains'],
  },
}

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY

  if (req.method === 'GET') return json({ enabled: Boolean(key), model: key ? MODEL : null })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!key) return json({ error: 'Copilot is not configured on the server.' }, 501)

  let body: { mode?: string; prompt?: string; context?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const mode = body.mode === 'ask' ? 'ask' : 'workspace'
  const prompt = (body.prompt ?? '').slice(0, 6000)
  const context = (body.context ?? '').slice(0, 12000)
  if (!prompt) return json({ error: 'Missing prompt' }, 400)

  const tool = mode === 'ask' ? ASK_TOOL : WORKSPACE_TOOL
  const client = new Anthropic({ apiKey: key })

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      // Cache the stable system persona so repeated calls within the window are cheap/fast.
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [
        {
          role: 'user',
          content: `${context ? `Context:\n${context}\n\n` : ''}${mode === 'ask' ? 'Question' : 'Request'}:\n${prompt}`,
        },
      ],
    })
    const block = msg.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!block) return json({ error: 'No structured response' }, 502)
    return json({ ok: true, mode, data: block.input, model: MODEL })
  } catch (e) {
    const status = (e as { status?: number }).status
    const message = e instanceof Error ? e.message : 'Copilot request failed'
    return json({ error: message }, status && status >= 400 && status < 600 ? status : 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
