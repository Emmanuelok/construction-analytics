import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, Layers, Eye, MousePointerClick, Table2, Download, Loader2, Boxes, FileWarning, Building2 } from 'lucide-react'
import { Card, CardHeader, StatTile, Badge, Tabs } from '@/components/ui'
import { ScrollableTable } from '@/components/ScrollableTable'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { downloadText, slug } from '@/lib/download'
import { DISCIPLINE_LABEL, DISCIPLINE_COLOR, type Discipline, type SelectedElement } from '@/lib/ifc-model'
import { locateWasm } from '@/lib/ifc-wasm-url'
import { SAMPLE_IFC_GEO } from '@/lib/ifc-sample-geo'
import { explodeIfc, type IfcExplosion, type IfcSchedule } from '@/lib/ifc-explorer'
import type { IfcGeometryResult } from '@/lib/ifc-geometry'

const IfcModelViewer = lazy(() => import('@/components/IfcModelViewer').then((m) => ({ default: m.IfcModelViewer })))

const fmtCell = (v: number | string) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : v)
const csvCell = (v: number | string) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function csvFor(s: IfcSchedule): string {
  const head = s.columns.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)).join(',')
  const rows = s.rows.map((r) => s.columns.map((c) => csvCell(r[c.key])).join(','))
  const totals = s.columns.map((c, i) => (c.total ? String(s.totals[c.key] ?? '') : i === 0 ? 'TOTAL' : '')).join(',')
  return [head, ...rows, totals].join('\n')
}
const DISCIPLINES: Discipline[] = ['struct', 'arch', 'mep', 'other']

/* The Building Explorer's "IFC model" source: tessellate an uploaded/sample IFC
 * with web-ifc, then review the *real* model floor-by-floor and element-by-element
 * — isolate a storey, click any product to inspect its measured quantities, and
 * read schedules grouped by IFC category. Selection syncs across the 3D model,
 * the level navigator, the inspector and the schedules. */
export function IfcExplorer() {
  const [source, setSource] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [res, setRes] = useState<IfcGeometryResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  const [level, setLevel] = useState(0)
  const [isolate, setIsolate] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [schedTab, setSchedTab] = useState<string>('')
  const [hidden, setHidden] = useState<Partial<Record<Discipline, boolean>>>({})

  const ex: IfcExplosion | null = useMemo(() => (res && res.meshes.length ? explodeIfc(res) : null), [res])

  useEffect(() => {
    let cancelled = false
    if (source == null) { setStatus('idle'); setRes(null); return }
    setStatus('loading'); setRes(null); setSel(null); setIsolate(false); setLevel(0); setHidden({})
    import('@/lib/ifc-geometry')
      .then(({ extractGeometry }) => extractGeometry(new TextEncoder().encode(source), { locateFile: locateWasm }))
      .then((r) => {
        if (cancelled) return
        if (r.meshes.length) { setRes(r); setStatus('ready') } else { setRes(null); setStatus('empty') }
      })
      .catch(() => { if (!cancelled) { setRes(null); setStatus('error') } })
    return () => { cancelled = true }
  }, [source])

  // pick a sensible default schedule tab + active level once a model loads
  useEffect(() => { if (ex) { setSchedTab((t) => (ex.schedules.some((s) => s.category === t) ? t : ex.schedules[0]?.category ?? '')); setLevel((l) => (ex.levels.some((v) => v.index === l) ? l : ex.levels[0]?.index ?? 0)) } }, [ex])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setFileName(f.name)
    try { setSource(await f.text()) } catch { setStatus('error') }
    e.target.value = ''
  }
  const loadSample = () => { setFileName('MeridianTower-Geometry.ifc'); setSource(SAMPLE_IFC_GEO) }

  const activeLevel = ex?.levels.find((l) => l.index === level)
  const activeStorey = activeLevel?.storeyExpressID ?? null
  const selectedEl = sel != null ? ex?.byExpress[sel] ?? null : null
  const activeSchedule = ex?.schedules.find((s) => s.category === schedTab) ?? ex?.schedules[0]

  const onViewerSelect = (el: SelectedElement | null) => {
    if (!el?.expressID || !ex) { setSel(null); return }
    setSel(el.expressID)
    const e = ex.byExpress[el.expressID]
    if (e) { setSchedTab(e.category); if (e.level >= 0) setLevel(e.level) }
  }
  const selectRow = (id: string) => {
    const e = ex?.elements.find((x) => x.id === id); if (!e) return
    setSel(e.expressID); setSchedTab(e.category); if (e.level >= 0) setLevel(e.level)
  }
  const gotoLevel = (i: number) => { setLevel(i); setIsolate(true) }

  if (status === 'idle' || (status !== 'ready' && !ex)) {
    return (
      <Card>
        <CardHeader icon={UploadCloud} accent="violet" title="Open an IFC / Revit-exported model" subtitle="Upload a .ifc file (Revit, ArchiCAD, Tekla… all export IFC) to review your actual building — real elements, storeys, quantities & schedules. Tessellated in your browser with the web-ifc kernel; nothing leaves your machine." />
        <div className="flex flex-col items-center justify-center gap-4 border-t border-edge/50 p-10 text-center">
          {status === 'loading' ? (
            <><Loader2 className="h-8 w-8 animate-spin text-violet-400" /><p className="text-sm text-slate-300">Tessellating <span className="data-mono">{fileName}</span>…</p><p className="text-[11px] text-slate-500">Large models can take a few seconds.</p></>
          ) : (
            <>
              <Boxes className="h-9 w-9 text-slate-600" />
              {status === 'empty' && <p className="max-w-md text-sm text-amber-300/90">No 3D geometry was found in <span className="data-mono">{fileName}</span> — it may be a coordination/quantities-only IFC. Try a model with geometry.</p>}
              {status === 'error' && <p className="max-w-md text-sm text-rose-300/90">Couldn't read that file. Make sure it's a valid .ifc export.</p>}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-100 ring-1 ring-inset ring-violet-500/40 hover:bg-violet-500/30"><UploadCloud className="h-4 w-4" /> Upload IFC file</button>
                <button onClick={loadSample} className="inline-flex items-center gap-2 rounded-lg border border-edge/70 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-elevated/60"><Building2 className="h-4 w-4" /> Load sample model</button>
                <input ref={fileRef} type="file" accept=".ifc,text/plain" className="hidden" onChange={onFile} />
              </div>
              <p className="text-[11px] text-slate-500">.ifc files only · the parser falls back gracefully if your browser lacks WebGL.</p>
            </>
          )}
        </div>
      </Card>
    )
  }
  if (!ex || !res) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={Boxes} accent="violet" title={fileName || 'IFC model'} subtitle="Your real model, tessellated. Dimensions & volumes are measured from the geometry (model units, typically metres)."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="violet">{formatNumber(res.triangleCount)} triangles</Badge>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><UploadCloud className="h-4 w-4" /> Replace</button>
              <input ref={fileRef} type="file" accept=".ifc,text/plain" className="hidden" onChange={onFile} />
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Elements" value={formatNumber(ex.summary.elements)} accent="violet" />
          <StatTile label="Storeys" value={String(ex.summary.storeys)} accent="blue" />
          <StatTile label="Categories" value={String(ex.summary.categories)} accent="cyan" />
          <StatTile label="Solid volume" value={`${formatNumber(ex.summary.volume)} m³`} accent="emerald" />
          <StatTile label="Triangles" value={formatNumber(ex.summary.triangles)} accent="amber" />
        </div>
      </Card>

      {/* 3D model + storeys */}
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={Eye} accent="violet" title="3D model" subtitle="Click any element to inspect it. Use the storeys panel to isolate a floor."
            action={
              <div className="flex flex-wrap items-center gap-2">
                {isolate && <Badge variant="cyan">Isolated · {activeLevel?.name}</Badge>}
                <button onClick={() => setIsolate(false)} disabled={!isolate} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', isolate ? 'text-slate-300 ring-edge/60 hover:bg-elevated/50' : 'cursor-default text-slate-600 ring-edge/40')}>Whole building</button>
                <div className="flex flex-wrap gap-1.5">
                  {DISCIPLINES.map((d) => (
                    <button key={d} onClick={() => setHidden((h) => ({ ...h, [d]: !h[d] }))} aria-pressed={!hidden[d]} className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors', hidden[d] ? 'text-slate-500 ring-edge/60' : 'text-slate-200 ring-edge/50')}>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: DISCIPLINE_COLOR[d], opacity: hidden[d] ? 0.3 : 1 }} /> {DISCIPLINE_LABEL[d]}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
          <div className="border-t border-edge/50">
            <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <IfcModelViewer input={{ entityCounts: [], storeys: Math.max(1, ex.summary.storeys) }} meshes={res.meshes} hidden={hidden} isolateStorey={isolate ? activeStorey : null} selectedExpressID={sel} onSelect={onViewerSelect} height={460} />
            </Suspense>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={Layers} accent="cyan" title="Storeys" subtitle="From the IFC spatial structure. Click to isolate a floor." />
          <div className="max-h-[460px] overflow-y-auto border-t border-edge/50">
            {ex.levels.length ? (
              <ul className="divide-y divide-edge/40">
                {[...ex.levels].reverse().map((l) => {
                  const on = l.index === level
                  return (
                    <li key={l.index}>
                      <button onClick={() => gotoLevel(l.index)} aria-pressed={on} className={cn('flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors', on ? 'bg-violet-500/10' : 'hover:bg-elevated/40')}>
                        <div className="min-w-0">
                          <div className={cn('truncate text-sm font-medium', on ? 'text-violet-100' : 'text-slate-200')}>{l.name}</div>
                          <div className="data-mono text-[11px] text-slate-500">{l.unassigned ? 'no storey' : `elev ${l.elevation}`} · {l.elements} elements</div>
                        </div>
                        <div className="shrink-0 data-mono text-[11px] text-slate-500">{formatNumber(l.volume)} m³</div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : <p className="p-4 text-sm text-slate-500">This model has no building storeys in its spatial structure.</p>}
          </div>
        </Card>
      </div>

      {/* inspector + schedules */}
      <Card className="flex flex-col">
        <CardHeader icon={MousePointerClick} accent="violet" title="Element inspector" subtitle="Measured properties of the selected IFC product." />
        <div className="border-t border-edge/50 p-5">
          {selectedEl ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{selectedEl.mark}</div>
                  <div className="data-mono text-[11px] text-slate-500">{selectedEl.ifcType} · {selectedEl.levelName}</div>
                </div>
                <Badge variant="violet" className="ml-auto">{selectedEl.category}</Badge>
              </div>
              <dl className="grid gap-x-6 sm:grid-cols-2">
                {selectedEl.cols.filter((c) => c.key !== 'mark' && c.key !== 'level' && c.key !== 'type').map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4 border-b border-edge/40 px-1 py-2">
                    <dt className="text-xs text-slate-400">{c.label}</dt>
                    <dd className="data-mono text-sm font-medium text-slate-200">{fmtCell(selectedEl.data[c.key])}{c.unit ? ` ${c.unit}` : ''}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={() => setSel(null)} className="mt-3 text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline">Clear selection</button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-center text-sm text-slate-400"><MousePointerClick className="h-5 w-5 text-slate-600" /> Click an element in the 3D model or a schedule row to inspect it.</div>
          )}
        </div>
      </Card>

      {activeSchedule && (
        <Card>
          <CardHeader
            icon={Table2} accent="cyan" title="Schedules by IFC category" subtitle="Every product, scheduled with quantities measured from the geometry. Click a row to locate it; export any schedule."
            action={<button onClick={() => downloadText(`${slug(fileName || 'ifc')}-${slug(activeSchedule.group)}.csv`, csvFor(activeSchedule), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
          />
          <div className="border-t border-edge/50 p-4">
            <Tabs tabs={ex.schedules.map((s) => ({ id: s.category, label: `${s.group} (${s.rows.length})` }))} active={schedTab} onChange={setSchedTab} className="mb-3" />
            <ScrollableTable label={`${activeSchedule.group} schedule`}>
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">
                    {activeSchedule.columns.map((c) => <th key={c.key} className={cn('px-3 py-2 font-medium', c.numeric && 'text-right')}>{c.label}{c.unit ? ` (${c.unit})` : ''}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activeSchedule.rows.map((r) => {
                    const on = r.id === (sel != null ? `ifc-${sel}` : null)
                    return (
                      <tr key={r.id} onClick={() => selectRow(r.id)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', on ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                        {activeSchedule.columns.map((c) => <td key={c.key} className={cn('px-3 py-1.5', c.numeric ? 'data-mono text-right text-slate-300' : 'text-slate-200', c.key === 'mark' && 'font-medium')}>{fmtCell(r[c.key])}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-edge/60 text-sm font-semibold text-slate-200">
                    {activeSchedule.columns.map((c, i) => <td key={c.key} className={cn('px-3 py-2', c.numeric && 'data-mono text-right')}>{c.total ? fmtCell(activeSchedule.totals[c.key]) : i === 0 ? 'Total' : ''}</td>)}
                  </tr>
                </tfoot>
              </table>
            </ScrollableTable>
          </div>
        </Card>
      )}
    </div>
  )
}
