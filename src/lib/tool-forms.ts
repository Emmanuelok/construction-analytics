/* Schema-driven tool forms — turns a tool's JSON Schema into form fields and
 * coerces/validates the entered values back into typed args. Pure + tested; powers
 * the Connections hub's "Run / Pull" UI for studio, Autodesk and federated-MCP
 * tools alike. */

export type Field = {
  name: string
  type: 'number' | 'integer' | 'string' | 'enum' | 'boolean' | 'json'
  enum?: string[]
  required: boolean
  description?: string
}

type JsonSchema = { properties?: Record<string, { type?: string; enum?: string[]; description?: string }>; required?: string[] }

/** Derive ordered form fields from a JSON-Schema object (required first). */
export function fieldsFromSchema(schema: unknown): Field[] {
  const s = (schema ?? {}) as JsonSchema
  const props = s.properties ?? {}
  const required = new Set(s.required ?? [])
  const fields = Object.entries(props).map(([name, p]): Field => {
    let type: Field['type'] = 'string'
    if (p.enum) type = 'enum'
    else if (p.type === 'number') type = 'number'
    else if (p.type === 'integer') type = 'integer'
    else if (p.type === 'boolean') type = 'boolean'
    else if (p.type === 'array' || p.type === 'object') type = 'json'
    return { name, type, enum: p.enum, required: required.has(name), description: p.description }
  })
  return fields.sort((a, b) => Number(b.required) - Number(a.required))
}

/** Coerce raw string inputs into typed args, validating required + JSON fields. */
export function coerceArgs(fields: Field[], raw: Record<string, string>): { args: Record<string, unknown>; errors: string[] } {
  const args: Record<string, unknown> = {}
  const errors: string[] = []
  for (const f of fields) {
    const v = raw[f.name]
    if (v === undefined || v === '') {
      if (f.required) errors.push(`${f.name} is required`)
      continue
    }
    if (f.type === 'number' || f.type === 'integer') {
      const num = Number(v)
      if (Number.isNaN(num)) { errors.push(`${f.name} must be a number`); continue }
      args[f.name] = f.type === 'integer' ? Math.round(num) : num
    } else if (f.type === 'boolean') {
      args[f.name] = v === 'true' || v === '1' || v === 'yes'
    } else if (f.type === 'json') {
      try { args[f.name] = JSON.parse(v) } catch { errors.push(`${f.name} must be valid JSON`) }
    } else {
      args[f.name] = v
    }
  }
  return { args, errors }
}
