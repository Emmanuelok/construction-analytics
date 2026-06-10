import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Boxes, UploadCloud, Eye, EyeOff, Camera, Sun, Layers, Loader2, Download, Pencil, Trash2, RotateCcw, Undo2, Box as BoxIcon } from 'lucide-react'
import { Card, CardHeader, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { downloadText, slug } from '@/lib/download'
import { buildMassing, SHAPE_KINDS, type ShapeKind } from '@/lib/massing'
import { buildBuilding, type BuildingModel } from '@/lib/building'
import { explodeBuilding, findElementGeom, type BuildingElement } from '@/lib/building-explorer'
import { applyEdits, emptyEdits, nudge, rescale, removeElement, editCount, type BuildingEdits } from '@/lib/building-edits'
import { toObj } from '@/lib/building-export'
import { toIfc } from '@/lib/building-ifc'
import { ifcToModel, type IfcLabels } from '@/lib/ifc-to-model'
import { locateWasm } from '@/lib/ifc-wasm-url'
import { sunPosition, momentOf } from '@/lib/sun'
import { PLATE_SCALE } from '@/lib/massing'
import type { ViewerStyle } from '@/components/ComponentBuildingViewer'

const ComponentBuildingViewer = lazy(() => import('@/components/ComponentBuildingViewer').then((m) => ({ default: m.ComponentBuildingViewer })))

const STYLES: { id: ViewerStyle; label: string }[] = [
  { id: 'wire', label: 'Wireframe' },
  { id: 'mono', label: 'Hidden line' },
  { id: 'shaded', label: 'Shaded' },
  { id: 'realistic', label: 'Realistic' },
  { id: 'xray', label: 'X-ray' },
]

// the model browser — every layer of the building, like Revit's category tree
const CATS: { key: string; label: string; count: (m: BuildingModel) => number }[] = [
  { key: 'foundations', label: 'Substructure (footings + ground beams)', count: (m) => m.counts.foundations + m.counts.groundBeams },
  { key: 'slabs', label: 'Floor slabs', count: (m) => m.counts.slabs },
  { key: 'columns', label: 'Columns', count: (m) => m.counts.columns },
  { key: 'beams', label: 'Beams', count: (m) => m.counts.beams },
  { key: 'core', label: 'Core', count: (m) => (m.core ? 1 : 0) },
  { key: 'stairs', label: 'Stairs', count: (m) => m.counts.stairs },
  { key: 'walls', label: 'Façade walls', count: (m) => m.counts.walls },
  { key: 'mullions', label: 'Mullions', count: (m) => m.counts.mullions },
  { key: 'windows', label: 'Windows', count: (m) => m.counts.windows },
  { key: 'doors', label: 'Entrance doors', count: (m) => m.counts.doors },
  { key: 'partitions', label: 'Partitions', count: (m) => m.counts.partitions },
  { key: 'interiorDoors', label: 'Interior doors', count: (m) => m.counts.interiorDoors },
  { key: 'finishes', label: 'Floor finishes', count: (m) => m.counts.finishes },
  { key: 'ceilings', label: 'Ceilings', count: (m) => m.counts.ceilings },
  { key: 'parapets', label: 'Parapets', count: (m) => m.counts.parapets },
  { key: 'roof', label: 'Roof', count: (m) => (m.roof ? 1 : 0) },
]

/* Model Studio — a full BIM modelling window: develop a building from scratch
 * (parametric template) or revise a Revit model brought in via IFC, with every
 * layer from substructure to finishes in the browser tree, Revit-style visual
 * styles, a sun study, a section box and PNG render snapshots. */
export default function ModelStudio() {
  // template parameters (develop from scratch)
  const [gfa, setGfa] = useState(60_000)
  const [storeys, setStoreys] = useState(12)
  const [shape, setShape] = useState<ShapeKind>('rect')
  const [wwr, setWwr] = useState(0.55)
  const [aspect, setAspect] = useState(1.4)
  // a Revit/IFC model being revised
  const [imported, setImported] = useState<{ model: BuildingModel; name: string; labels: IfcLabels } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [edits, setEdits] = useState<BuildingEdits>(emptyEdits())
  const [past, setPast] = useState<BuildingEdits[]>([])
  const [cats, setCats] = useState<Record<string, boolean>>({})
  const [style, setStyle] = useState<ViewerStyle>('realistic')
  const [section, setSection] = useState(100) // % of building height; 100 = off
  const [sunOn, setSunOn] = useState(false)
  const [month, setMonth] = useState(6)
  const [hour, setHour] = useState(14)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const baseModel = useMemo(() => imported?.model ?? buildBuilding(buildMassing({ gfa, progress: 100, storeys, shape, aspect }), { coreRatio: 0.16, wwr }), [imported, gfa, storeys, shape, aspect, wwr])
  const model = useMemo(() => applyEdits(baseModel, edits), [baseModel, edits])
  const ex = useMemo(() => explodeBuilding(model, { storeyHeight: 3.6 }), [model])
  const sun = useMemo(() => { if (!sunOn) return undefined; const p = sunPosition(momentOf(month, hour), 40.71, -74.0); return { azimuth: p.azimuth, altitude: p.altitude } }, [sunOn, month, hour])
  const clipY = section >= 100 ? null : (section / 100) * model.totalHeight
  const selected: BuildingElement | null = selectedId ? ex.byId[selectedId] ?? null : null
  const nEdits = editCount(edits)
  const stepXZ = 1 * PLATE_SCALE, stepY = 0.5 / 3.6

  const commit = (next: BuildingEdits) => { setPast((p) => [...p.slice(-60), edits]); setEdits(next) }
  const undo = () => setPast((p) => { if (!p.length) return p; setEdits(p[p.length - 1]); return p.slice(0, -1) })
  const name = imported?.name ?? 'Studio model'

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setImportBusy(true)
    try {
      const { extractGeometry } = await import('@/lib/ifc-geometry')
      const res = await extractGeometry(new TextEncoder().encode(await f.text()), { locateFile: locateWasm })
      if (res.meshes.length) { const { model: m2, labels } = ifcToModel(res); setImported({ model: m2, name: f.name, labels }); setEdits(emptyEdits()); setPast([]); setSelectedId(null) }
    } catch { /* unreadable IFC — stay on the template */ }
    setImportBusy(false); e.target.value = ''
  }
  const snapshot = () => {
    const el = document.querySelector('[aria-label^="3D building model"]') as (HTMLElement & { __snapshot?: () => string }) | null
    const url = el?.__snapshot?.()
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = `${slug(name)}-render.png`; document.body.appendChild(a); a.click(); a.remove()
  }
  const exportGltf = async () => { const { exportGlb } = await import('@/lib/building-gltf'); await exportGlb(model, `${slug(name)}.glb`) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 ring-1 ring-inset ring-violet-500/30"><Boxes className="h-5 w-5 text-violet-300" /></span>
          <div>
            <h1 className="text-lg font-semibold text-white">Model Studio</h1>
            <p className="text-xs text-slate-400">Develop a full BIM model from scratch, or revise a Revit model via its IFC export — every layer from substructure to finishes. Revit's native .rvt is proprietary; IFC is the interchange.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {imported && <Badge variant="warn" dot>Revising · {imported.name}</Badge>}
          {imported && <button onClick={() => { setImported(null); setEdits(emptyEdits()); setPast([]); setSelectedId(null) }} className="rounded-lg border border-edge/70 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">New from template</button>}
          <button onClick={() => fileRef.current?.click()} disabled={importBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm font-medium text-violet-100 ring-1 ring-inset ring-violet-500/40 hover:bg-violet-500/30 disabled:opacity-60">{importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Open IFC / Revit export</button>
          <input ref={fileRef} type="file" accept=".ifc,text/plain" className="hidden" onChange={onFile} />
          <div className="flex items-center overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60" title="Export the model (edits included)">
            <Download className="ml-2 h-3.5 w-3.5 text-slate-500" />
            <button onClick={() => downloadText(`${slug(name)}.ifc`, toIfc(model, { name }), 'IFC')} className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">IFC</button>
            <button onClick={() => downloadText(`${slug(name)}.obj`, toObj(model, name), 'OBJ')} className="border-l border-edge/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">OBJ</button>
            <button onClick={exportGltf} className="border-l border-edge/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-elevated/60">glTF</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_300px]">
        {/* model browser — every layer, like Revit's project browser */}
        <Card className="overflow-hidden">
          <CardHeader icon={Layers} accent="violet" title="Model browser" subtitle={`${formatNumber(ex.summary.elements)} elements`} />
          <ul className="max-h-[640px] divide-y divide-edge/40 overflow-y-auto border-t border-edge/50">
            {CATS.map((c) => {
              const n = c.count(model)
              const hiddenCat = !!cats[c.key]
              return (
                <li key={c.key} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className={cn('truncate text-xs', hiddenCat ? 'text-slate-600' : 'text-slate-300')}>{c.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="data-mono text-[11px] text-slate-500">{formatNumber(n)}</span>
                    <button onClick={() => setCats((h) => ({ ...h, [c.key]: !h[c.key] }))} aria-pressed={!hiddenCat} aria-label={`Toggle ${c.label}`} className={cn('rounded p-1 transition-colors', hiddenCat ? 'text-slate-600 hover:text-slate-400' : 'text-violet-300 hover:text-violet-200')}>
                      {hiddenCat ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* viewport + render tools */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-edge/50 px-4 py-2.5">
            <div className="flex overflow-hidden rounded-lg ring-1 ring-inset ring-edge/60">
              {STYLES.map((st) => (
                <button key={st.id} onClick={() => setStyle(st.id)} aria-pressed={style === st.id} className={cn('px-2.5 py-1 text-xs font-medium transition-colors', style === st.id ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400 hover:bg-elevated/50 hover:text-slate-200')}>{st.label}</button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400" title="Horizontal section box — cut the model at a height">
              Section
              <input type="range" min={5} max={100} step={1} value={section} onChange={(e) => setSection(Number(e.target.value))} className="w-28 accent-violet-500" aria-label="Section height" />
              <span className="data-mono w-10 text-slate-300">{section >= 100 ? 'off' : `${section}%`}</span>
            </label>
            <button onClick={() => setSunOn((v) => !v)} aria-pressed={sunOn} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', sunOn ? 'bg-amber-500/20 text-amber-100 ring-amber-500/40' : 'text-slate-300 ring-edge/60 hover:bg-elevated/50')}><Sun className="h-3.5 w-3.5" /> Sun study</button>
            {sunOn && <>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Month <input type="range" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-20 accent-amber-500" aria-label="Sun month" /><span className="data-mono w-6 text-slate-300">{month}</span></label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">Hour <input type="range" min={5} max={21} step={0.5} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-20 accent-amber-500" aria-label="Sun hour" /><span className="data-mono w-8 text-slate-300">{hour}:00</span></label>
            </>}
            <button onClick={snapshot} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/25"><Camera className="h-3.5 w-3.5" /> Render PNG</button>
          </div>
          <Suspense fallback={<div style={{ height: 640 }} className="grid place-items-center text-sm text-slate-500">Loading viewport…</div>}>
            <ComponentBuildingViewer model={model} cats={cats} style={style} clipY={clipY} sun={sun} selected={selectedId} onSelect={setSelectedId} height={640} />
          </Suspense>
        </Card>

        {/* properties + template */}
        <div className="space-y-4">
          <Card>
            <CardHeader icon={Pencil} accent="amber" title="Properties" subtitle={selected ? `${selected.mark} · ${selected.levelName}` : 'Click an element in the viewport.'} />
            {selected && selectedId && (
              <div className="space-y-2 border-t border-edge/50 p-4">
                <div className="flex items-center justify-between"><span className="text-xs text-slate-400">Category</span><Badge variant="neutral">{selected.category}</Badge></div>
                {imported?.labels[selectedId] && <p className="text-[11px] text-amber-200/90">IFC source — {imported.labels[selectedId].name || 'unnamed'} · <span className="data-mono">{imported.labels[selectedId].ifcType}</span></p>}
                <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                  {selected.cols.filter((c) => c.key !== 'mark' && c.key !== 'level').slice(0, 6).map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-3 px-2.5 py-1.5">
                      <dt className="text-[11px] text-slate-400">{c.label}</dt>
                      <dd className="data-mono text-xs text-slate-200">{typeof selected.data[c.key] === 'number' ? (selected.data[c.key] as number).toLocaleString(undefined, { maximumFractionDigits: 2 }) : selected.data[c.key]}{c.unit ? ` ${c.unit}` : ''}</dd>
                    </div>
                  ))}
                </dl>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <ToolBtn label="◀" onClick={() => commit(nudge(edits, selectedId, { x: -stepXZ, y: 0, z: 0 }))} />
                  <ToolBtn label="▲" onClick={() => commit(nudge(edits, selectedId, { x: 0, y: 0, z: stepXZ }))} />
                  <ToolBtn label="▶" onClick={() => commit(nudge(edits, selectedId, { x: stepXZ, y: 0, z: 0 }))} />
                  <ToolBtn label="Up" onClick={() => commit(nudge(edits, selectedId, { x: 0, y: stepY, z: 0 }))} />
                  <ToolBtn label="▼" onClick={() => commit(nudge(edits, selectedId, { x: 0, y: 0, z: -stepXZ }))} />
                  <ToolBtn label="Down" onClick={() => commit(nudge(edits, selectedId, { x: 0, y: -stepY, z: 0 }))} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ToolBtn label="Bigger" onClick={() => commit(rescale(edits, selectedId, 1.15))} />
                  <ToolBtn label="Smaller" onClick={() => commit(rescale(edits, selectedId, 1 / 1.15))} />
                  <button onClick={() => { commit(removeElement(edits, selectedId)); setSelectedId(null) }} className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-200 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/25"><Trash2 className="h-3 w-3" /> Delete</button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-edge/50 px-4 py-2.5">
              <button onClick={undo} disabled={!past.length} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', past.length ? 'text-slate-300 hover:bg-elevated/60' : 'cursor-default text-slate-600')}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
              <button onClick={() => { setEdits(emptyEdits()); setPast([]); setSelectedId(null) }} disabled={!nEdits} className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', nEdits ? 'text-slate-300 hover:bg-elevated/60' : 'cursor-default text-slate-600')}><RotateCcw className="h-3.5 w-3.5" /> Reset{nEdits ? ` (${nEdits})` : ''}</button>
            </div>
          </Card>

          {!imported && (
            <Card>
              <CardHeader icon={BoxIcon} accent="blue" title="Template" subtitle="The from-scratch model — every parameter regenerates the full anatomy live." />
              <div className="space-y-3 border-t border-edge/50 p-4">
                <Slider label="GFA" unit="m²" value={gfa} min={5000} max={200000} step={5000} onChange={setGfa} />
                <Slider label="Storeys" value={storeys} min={2} max={40} step={1} onChange={setStoreys} />
                <Slider label="Window-to-wall" value={wwr} min={0.2} max={0.85} step={0.05} onChange={setWwr} fmt={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Plan aspect" value={aspect} min={0.5} max={2.5} step={0.1} onChange={setAspect} fmt={(v) => v.toFixed(1)} />
                <div className="flex flex-wrap gap-1.5">
                  {SHAPE_KINDS.filter((s) => s.id !== 'custom').map((s) => (
                    <button key={s.id} onClick={() => setShape(s.id)} aria-pressed={shape === s.id} className={cn('rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors', shape === s.id ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50')}>{s.label}</button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-md bg-base/70 px-2 py-1 text-xs font-medium text-slate-200 ring-1 ring-inset ring-edge/60 hover:bg-elevated/70">{label}</button>
}
function Slider({ label, unit, value, min, max, step, onChange, fmt }: { label: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] text-slate-400"><span>{label}</span><span className="data-mono text-slate-300">{fmt ? fmt(value) : formatNumber(value)}{unit ? ` ${unit}` : ''}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-500" aria-label={label} />
    </label>
  )
}
