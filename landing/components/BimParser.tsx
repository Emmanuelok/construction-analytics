'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Boxes, UploadCloud, Ruler, Layers3, FileCheck2, Loader2, Building2 } from 'lucide-react'
import { parseIfc, SAMPLE_IFC, type ParsedIfc } from '@/lib/ifc'

const ease = [0.16, 1, 0.3, 1] as const

const DISC_BAR: Record<string, string> = {
  Architectural: 'bg-brand-400', Structural: 'bg-sky-400', MEP: 'bg-cyan-400', Other: 'bg-violet-400',
}
const KIND_RATE: Record<string, number> = { Volume: 165, Weight: 1.28, Area: 85, Length: 70, Count: 0 }

function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function BimParser() {
  const [parsed, setParsed] = useState<ParsedIfc | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // parse the bundled sample on first mount so the section is alive on arrival
  useEffect(() => {
    setParsed(parseIfc(SAMPLE_IFC, 'MeridianTower-Sample.ifc'))
  }, [])

  function run(text: string, name: string) {
    setBusy(true)
    setError('')
    setTimeout(() => {
      try {
        const r = parseIfc(text, name)
        if (r.totalInstances === 0) {
          setError('No IFC instances found — is this a STEP/IFC (.ifc) file?')
        } else {
          setParsed(r)
        }
      } catch {
        setError('Could not parse that file.')
      }
      setBusy(false)
    }, 240)
  }

  function onFile(f: File) {
    const reader = new FileReader()
    reader.onload = () => run(String(reader.result ?? ''), f.name)
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(f)
  }

  const indicativeTotal = parsed
    ? parsed.quantities.reduce((s, q) => s + q.total * (KIND_RATE[q.kind] ?? 0), 0)
    : 0
  const maxEntity = parsed?.entityCounts[0]?.count ?? 1

  return (
    <section id="bim" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">BIM Intelligence</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Parse a real IFC model in your browser.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
          A dependency-free STEP/IFC parser — entity counts, discipline breakdown and a quantity takeoff from
          <span className="text-slate-200"> IfcElementQuantity</span>. The sample below is parsed live; drop your own
          <span className="font-mono"> .ifc</span> to analyze it (locally — nothing is uploaded).
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => run(SAMPLE_IFC, 'MeridianTower-Sample.ifc')}
            className="inline-flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-brand-500/40"
          >
            <Boxes className="h-4 w-4 text-blue-400" /> Re-parse sample
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-400"
          >
            <UploadCloud className="h-4 w-4" /> Upload .ifc
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ifc,.step,.stp,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
          />
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </div>

      {busy && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-brand-400" /> Tokenizing IFC…
        </div>
      )}

      {parsed && !busy && (
        <motion.div
          key={parsed.fileName + parsed.totalInstances}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mt-10 space-y-5"
        >
          {/* header / metadata */}
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
                <FileCheck2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{parsed.fileName}</div>
                <div className="font-mono text-[11px] text-slate-500">
                  {parsed.schema}
                  {parsed.authoringTool ? ` · ${parsed.authoringTool}` : ''}
                  {parsed.timestamp ? ` · ${parsed.timestamp}` : ''}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {parsed.project && <Meta icon={Building2} label="Project" value={parsed.project} />}
              {parsed.building && <Meta label="Building" value={parsed.building} />}
              <Meta label="Storeys" value={String(parsed.storeys.length)} />
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge/60 bg-edge/40 sm:grid-cols-4">
            {[
              { label: 'Instances', value: compact(parsed.totalInstances) },
              { label: 'Physical elements', value: compact(parsed.elementCount) },
              { label: 'Distinct types', value: String(parsed.distinctTypes) },
              { label: 'Indicative value', value: '$' + compact(indicativeTotal) },
            ].map((k) => (
              <div key={k.label} className="bg-surface/70 p-4">
                <div className="font-mono text-xl font-semibold text-white">{k.value}</div>
                <div className="text-[11px] text-slate-500">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* disciplines + entities */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                <Layers3 className="h-4 w-4 text-blue-400" /> Discipline breakdown
              </div>
              <div className="space-y-2.5">
                {parsed.disciplines.map((d, i) => (
                  <div key={d.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-slate-300">{d.label}</span>
                      <span className="font-mono text-slate-400">{d.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
                      <motion.div
                        className={`h-full rounded-full ${DISC_BAR[d.label] ?? 'bg-slate-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.value / parsed.elementCount) * 100}%` }}
                        transition={{ duration: 0.8, ease, delay: 0.1 + i * 0.08 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-edge/50 pt-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Top entities</div>
                <div className="space-y-1.5">
                  {parsed.entityCounts.slice(0, 6).map((e) => (
                    <div key={e.type} className="flex items-center gap-2 text-xs">
                      <span className="w-44 truncate font-mono text-slate-400">{e.type}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
                        <div className="h-full rounded-full bg-blue-400/70" style={{ width: `${(e.count / maxEntity) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-mono text-slate-400">{e.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* quantity takeoff */}
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                <Ruler className="h-4 w-4 text-emerald-400" /> Quantity takeoff
                <span className="text-xs text-slate-500">· from IfcElementQuantity</span>
              </div>
              {parsed.quantities.length === 0 ? (
                <p className="text-sm text-slate-500">No explicit quantities in this model.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-edge/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-elevated/40 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Quantity</th>
                        <th className="px-3 py-2 font-medium">Kind</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">n</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge/40">
                      {parsed.quantities.map((q) => (
                        <tr key={`${q.kind}-${q.name}`} className="hover:bg-elevated/30">
                          <td className="px-3 py-2 font-medium text-slate-200">{q.name}</td>
                          <td className="px-3 py-2 text-slate-400">{q.kind}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-300">{q.total.toFixed(1)} {q.unit}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-500">{q.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {parsed.properties.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Property values</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {parsed.properties.slice(0, 6).map((p, i) => (
                      <div key={`${p.name}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-400">{p.name}</span>
                        <span className="font-mono text-slate-300">{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  )
}

function Meta({ icon: Icon, label, value }: { icon?: typeof Building2; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1">
      {Icon && <Icon className="h-3 w-3 text-slate-500" />}
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </span>
  )
}
