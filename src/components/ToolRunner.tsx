import { useMemo, useState } from 'react'
import { ArrowRight, Loader2, AlertTriangle, Braces, Table2 } from 'lucide-react'
import { fieldsFromSchema, coerceArgs, type Field } from '@/lib/tool-forms'
import { downloadText } from '@/lib/download'
import { tableToCsv } from '@/lib/report'
import { cn } from '@/lib/cn'

/* Generic, schema-driven tool form: renders inputs from a tool's JSON Schema, runs
 * it via the injected `run` (studio engine, APS, or a federated MCP server), and
 * shows + exports the result. One UI for every connected platform. */
export function ToolRunner({
  tool,
  run,
  actionLabel = 'Run',
}: {
  tool: { name: string; description?: string; inputSchema: unknown }
  run: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
  actionLabel?: string
}) {
  const fields = useMemo(() => fieldsFromSchema(tool.inputSchema), [tool.inputSchema])
  const [vals, setVals] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (name: string, v: string) => setVals((s) => ({ ...s, [name]: v }))

  async function go() {
    const { args, errors } = coerceArgs(fields, vals)
    if (errors.length) { setError(errors.join(' · ')); return }
    setError(null); setBusy(true); setResult(null)
    try { setResult(await run(tool.name, args)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Tool call failed') }
    finally { setBusy(false) }
  }

  const resultText = result == null ? '' : typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  const asRows = Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' ? (result as Record<string, unknown>[]) : null
  const exportJson = () => downloadText(`${tool.name}.json`, typeof result === 'string' ? result : JSON.stringify(result, null, 2), 'JSON')
  const exportCsv = () => {
    if (!asRows) return
    const cols = Array.from(new Set(asRows.flatMap((r) => Object.keys(r))))
    downloadText(`${tool.name}.csv`, tableToCsv({ columns: cols, rows: asRows.map((r) => cols.map((c) => { const v = r[c]; return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : (v as string | number) })) }), 'CSV')
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-400">{tool.description}</p>
      {fields.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.name} className="block text-xs">
              <span className="mb-1 block text-slate-400">{f.name}{f.required && <span className="text-rose-400"> *</span>}{f.description ? <span className="text-slate-600"> — {f.description}</span> : null}</span>
              {renderInput(f, vals[f.name] ?? '', (v) => set(f.name, v))}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={go} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {actionLabel}
        </button>
        {result != null && <>
          <button onClick={exportJson} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Braces className="h-3.5 w-3.5" /> JSON</button>
          {asRows && <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Table2 className="h-3.5 w-3.5" /> CSV</button>}
        </>}
      </div>
      {error && <p className="flex items-center gap-2 text-xs text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {error}</p>}
      {result != null && (
        <pre className={cn('max-h-80 overflow-auto rounded-lg border border-edge/60 bg-base/60 p-3 text-[11px] leading-relaxed text-slate-300')}>{resultText}</pre>
      )}
    </div>
  )
}

function renderInput(f: Field, value: string, onChange: (v: string) => void) {
  const cls = 'w-full rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30'
  if (f.type === 'enum') return <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}><option value="">{f.required ? '— select —' : '(default)'}</option>{f.enum!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  if (f.type === 'boolean') return <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}><option value="">(default)</option><option value="true">true</option><option value="false">false</option></select>
  if (f.type === 'json' || f.name === 'ifc') return <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={f.name === 'ifc' ? 4 : 2} placeholder={f.type === 'json' ? '[ … ] or { … }' : ''} className={cn(cls, 'font-mono text-xs')} />
  return <input type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} className={cn(cls, 'data-mono')} />
}
