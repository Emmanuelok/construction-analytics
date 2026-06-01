import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, ArrowRight, AlertTriangle, CheckCircle2, Download, Eraser, Wand2 } from 'lucide-react'
import { Card, CardHeader, Badge, ProgressBar } from '@/components/ui'
import { cn } from '@/lib/cn'
import { parseDelimited, type Table } from '@/lib/parse'
import { SCHEMAS, autoMap, validateImport, recordsToCsv, type Mapping } from '@/lib/ingest'
import { downloadText } from '@/lib/download'

const SAMPLES: Record<string, string> = {
  'project-master': `Project Name,Sector,Location,Contract Value,GFA (m2),% Complete,Phase
Meridian Tower,Commercial,Dubai,820000000,142000,64,Construction
Aurora Data Center,Data Center,Phoenix,1200000000,64000,22,Procurement
Helix Campus,Education,Boston,670000000,89000,14,Design
Greenfield Civic,Public,Melbourne,180000000,38000,100,Operations`,
  'cost-plan': `Line Item,Quantity,Unit,Unit Rate,Total
In-situ concrete,18000,m3,165,2970000
Reinforcement,2600,t,1280,3328000
Curtain wall,9500,m2,920,8740000`,
  schedule: `Activity,Start,Finish,Duration,% Complete
Substructure,2026-01-05,2026-04-20,105,100
Superstructure,2026-04-21,2026-11-30,223,62
Facade,2026-09-01,2027-03-15,195,18`,
  supplier: `Supplier,Category,On-time %,Quality %,Lead time,Price index
NordSteel,Structural Steel,96,95,42,103
Apex MEP,MEP,89,92,68,98
Orient Glass,Glazing,61,80,96,88`,
}

const qualityClass = (q: number) => (q >= 80 ? 'text-emerald-300' : q >= 60 ? 'text-amber-300' : 'text-rose-300')

/* The inbound half of the lakehouse: paste any table, map its columns onto a
 * canonical AEC schema, validate every row, then send the standardized data to
 * Analysis Studio or download it. Runs entirely in the browser. */
export function ImportWorkbench() {
  const navigate = useNavigate()
  const [schemaId, setSchemaId] = useState(SCHEMAS[0].id)
  const [csv, setCsv] = useState(SAMPLES[SCHEMAS[0].id])
  const [mapping, setMapping] = useState<Mapping>({})
  const schema = SCHEMAS.find((s) => s.id === schemaId) ?? SCHEMAS[0]
  const table: Table = useMemo(() => (csv.trim() ? parseDelimited(csv) : { columns: [], rows: [] }), [csv])
  const colKey = table.columns.join('|')

  // Auto-map whenever the source columns or target schema change.
  useEffect(() => { setMapping(autoMap(table.columns, schema)) }, [colKey, schemaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => validateImport(table.rows, schema, mapping), [table.rows, schema, mapping])
  const hasData = table.columns.length > 0 && table.rows.length > 0

  const pickSchema = (id: string) => { setSchemaId(id); setCsv(SAMPLES[id] ?? '') }
  const sendToAnalysis = () => {
    sessionStorage.setItem('aec-workbench-handoff', JSON.stringify({ name: `${schema.name} (ingested)`, csv: recordsToCsv(result.records, schema) }))
    navigate('/analyze')
  }
  const downloadStd = () => downloadText(`${schema.id}-standardized.csv`, recordsToCsv(result.records, schema), 'CSV')

  const previewRows = result.records.slice(0, 5)

  return (
    <Card>
      <CardHeader
        icon={UploadCloud}
        accent="sky"
        title="Import & standardize — operable"
        subtitle="Paste any spreadsheet, map its columns to a canonical schema, validate, then send the clean data onward"
      />
      <div className="space-y-5 border-t border-edge/50 p-5">
        {/* schema picker */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">Target schema</span>
          {SCHEMAS.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSchema(s.id)}
              title={s.description}
              className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', s.id === schemaId ? 'bg-sky-500/15 text-sky-200 ring-sky-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* source */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Source data (CSV / TSV)</span>
              <button onClick={() => setCsv('')} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"><Eraser className="h-3 w-3" /> clear</button>
            </div>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              spellCheck={false}
              placeholder="Paste rows with a header line…"
              className="h-44 w-full resize-y rounded-xl border border-edge/70 bg-elevated/40 p-3 font-mono text-[12px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">{hasData ? `${table.rows.length} rows · ${table.columns.length} columns detected` : 'Awaiting data — pick a schema to load a sample.'}</p>
          </div>

          {/* mapping */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300"><Wand2 className="h-3.5 w-3.5 text-sky-400" /> Column mapping <span className="text-slate-500">(auto-matched; adjust as needed)</span></div>
            <div className="overflow-hidden rounded-xl border border-edge/60">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-edge/40">
                  {schema.fields.map((f) => (
                    <tr key={f.key}>
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-slate-200">{f.label}</span>
                        {f.required && <span className="ml-1 text-rose-400">*</span>}
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-600">{f.type}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={mapping[f.key] ?? ''}
                          onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || null }))}
                          className={cn('w-full rounded-md border bg-elevated/60 px-2 py-1 text-xs text-slate-200 focus:outline-none', !mapping[f.key] && f.required ? 'border-rose-500/50' : 'border-edge/60')}
                        >
                          <option value="">— unmapped —</option>
                          {table.columns.map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {hasData && (
          <>
            {/* report */}
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <div className="flex items-center gap-4 rounded-xl border border-edge/60 bg-elevated/30 p-4">
                <div className="text-center">
                  <div className={cn('data-mono text-3xl font-bold', qualityClass(result.report.qualityScore))}>{result.report.qualityScore}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">quality</div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> {result.report.validRows} valid rows</div>
                  <div className={cn('flex items-center gap-1.5', result.report.invalidRows > 0 ? 'text-rose-300' : 'text-slate-500')}><AlertTriangle className="h-3.5 w-3.5" /> {result.report.invalidRows} invalid</div>
                </div>
              </div>
              <div className="rounded-xl border border-edge/60 bg-elevated/30 p-3">
                {result.report.unmappedRequired.length > 0 && (
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"><AlertTriangle className="h-3 w-3" /> Map required: {result.report.unmappedRequired.join(', ')}</div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {result.report.fields.map((f) => (
                    <div key={f.key} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', f.errors > 0 ? 'bg-rose-400' : f.mapped ? 'bg-emerald-400' : 'bg-slate-600')} />
                      <span className="truncate text-slate-400">{f.label}</span>
                      <span className="ml-auto data-mono text-slate-500">{f.mapped ? `${f.fillRate}%` : '—'}{f.errors > 0 ? ` · ${f.errors}✗` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {result.report.sampleErrors.length > 0 && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-rose-300/80">Issues</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.report.sampleErrors.slice(0, 6).map((e, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200">row {e.row} · {e.field}: “{e.value || '∅'}” — {e.issue}</span>
                  ))}
                </div>
              </div>
            )}

            {/* preview */}
            <div className="overflow-x-auto rounded-xl border border-edge/60">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-edge/50 bg-elevated/40 text-[10px] uppercase tracking-wide text-slate-500">
                    {schema.fields.map((f) => (<th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/40">
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      {schema.fields.map((f) => (<td key={f.key} className="px-3 py-1.5 text-slate-300 data-mono">{String(r[f.key] ?? '')}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button onClick={sendToAnalysis} disabled={result.report.validRows === 0} className="btn-primary disabled:opacity-40">
                <ArrowRight className="h-4 w-4" /> Send {result.report.validRows} rows to Analysis Studio
              </button>
              <button onClick={downloadStd} disabled={result.report.validRows === 0} className="btn-ghost disabled:opacity-40">
                <Download className="h-4 w-4" /> Download standardized CSV
              </button>
              <span className="text-[11px] text-slate-500">Standardized to the <span className="text-slate-300">{schema.name}</span> schema</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
