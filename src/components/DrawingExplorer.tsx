import { useMemo, useRef, useState } from 'react'
import { FileUp, Layers, Ruler, Type, Trash2, Download, Eye, EyeOff, PencilRuler, X } from 'lucide-react'
import { Card, CardHeader, StatTile } from '@/components/ui'
import { parseDxf, summarize, dxfCsv, entityLength, SAMPLE_DXF, type DxfDrawing, type DxfEntity } from '@/lib/dxf'
import { downloadText, slug } from '@/lib/download'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'

const LAYER_COLORS = ['#7dd3fc', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#94a3b8', '#22d3ee', '#facc15', '#4ade80']

/* The 2D drawing workbench: upload any ASCII DXF (AutoCAD, Revit-exported DWG→DXF,
 * Civil 3D…), see it layer by layer, click any entity to inspect it, delete entities
 * or whole layers (revise), and export the entity schedule + per-layer takeoff as
 * CSV. Everything is parsed client-side by the pure dxf engine. */
export function DrawingExplorer() {
  const [drawing, setDrawing] = useState<DxfDrawing | null>(null)
  const [name, setName] = useState('')
  const [hiddenLayers, setHiddenLayers] = useState<Record<string, boolean>>({})
  const [selId, setSelId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (text: string, fname: string) => { setDrawing(parseDxf(text)); setName(fname); setHiddenLayers({}); setSelId(null) }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { try { load(await f.text(), f.name) } catch { /* unreadable file */ } }
    e.target.value = ''
  }
  const removeEntity = (id: string) => {
    if (!drawing) return
    setDrawing(summarize(drawing.entities.filter((x) => x.id !== id), drawing.units))
    setSelId(null)
  }
  const removeLayer = (layer: string) => {
    if (!drawing) return
    setDrawing(summarize(drawing.entities.filter((x) => x.layer !== layer), drawing.units))
    setSelId(null)
  }

  const colorOf = useMemo(() => {
    const map = new Map<string, string>()
    drawing?.layers.forEach((l, i) => map.set(l.name, LAYER_COLORS[i % LAYER_COLORS.length]))
    return (layer: string) => map.get(layer) ?? '#94a3b8'
  }, [drawing])
  const selected = drawing?.entities.find((e) => e.id === selId) ?? null
  const visible = useMemo(() => drawing?.entities.filter((e) => !hiddenLayers[e.layer]) ?? [], [drawing, hiddenLayers])
  const texts = drawing ? drawing.counts.TEXT ?? 0 : 0

  if (!drawing) {
    return (
      <Card>
        <CardHeader icon={PencilRuler} accent="cyan" title="Drawing workbench — DXF" subtitle="Upload any 2D CAD drawing as ASCII DXF: floor plans, grids, details. Every line, polyline, arc, circle, text and block reference becomes reviewable data — counts and drawn length per layer, an entity schedule, deletions, CSV export. From Revit: export DWG/DXF (or export IFC and use the IFC model tab for the full 3D component tree)." />
        <div className="flex flex-col items-center gap-3 border-t border-edge/50 p-10">
          <FileUp className="h-8 w-8 text-slate-600" aria-hidden />
          <p className="max-w-md text-center text-sm text-slate-400">Drop in a <span className="text-slate-200">.dxf</span> export — parsed entirely in your browser, nothing uploaded anywhere.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-500/40 hover:bg-cyan-500/25"><FileUp className="h-4 w-4" /> Upload DXF</button>
            <button onClick={() => load(SAMPLE_DXF, 'sample-plan.dxf')} className="rounded-lg border border-edge/70 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-elevated/60 hover:text-white">Load the sample plan</button>
          </div>
          <input ref={fileRef} type="file" accept=".dxf,application/dxf" className="hidden" onChange={onFile} aria-label="Upload DXF drawing" />
        </div>
      </Card>
    )
  }

  const bb = drawing.bbox
  const pad = Math.max((bb.maxX - bb.minX), (bb.maxY - bb.minY)) * 0.05 + 1
  const vb = `${bb.minX - pad} ${-(bb.maxY + pad)} ${bb.maxX - bb.minX + 2 * pad} ${bb.maxY - bb.minY + 2 * pad}`
  const sw = Math.max((bb.maxX - bb.minX), (bb.maxY - bb.minY)) / 420 // hairline that survives scaling

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Entities" value={formatNumber(drawing.entities.length)} accent="cyan" />
        <StatTile label="Layers" value={String(drawing.layers.length)} accent="violet" />
        <StatTile label="Drawn length" value={`${formatNumber(Math.round(drawing.totalLength))} ${drawing.units}`} accent="emerald" />
        <StatTile label="Annotations" value={`${texts} texts`} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={PencilRuler} accent="cyan" title={`Drawing — ${name}`} subtitle="Click any entity to inspect it. Layer colours are assigned per layer; toggle them on the right."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileUp className="h-3.5 w-3.5" /> Replace</button>
                <button onClick={() => downloadText(`${slug(name)}-entities.csv`, dxfCsv(drawing), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
                <button onClick={() => { setDrawing(null); setName('') }} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><X className="h-3.5 w-3.5" /> Close</button>
                <input ref={fileRef} type="file" accept=".dxf,application/dxf" className="hidden" onChange={onFile} aria-label="Replace DXF drawing" />
              </div>
            }
          />
          <div className="border-t border-edge/50 bg-[#0a0f1c] p-2">
            <svg viewBox={vb} className="h-[440px] w-full" role="img" aria-label={`DXF drawing: ${drawing.entities.length} entities on ${drawing.layers.length} layers`}>
              {visible.map((e) => {
                const col = e.id === selId ? '#fbbf24' : colorOf(e.layer)
                const w = e.id === selId ? sw * 2.2 : sw
                const click = { onClick: () => setSelId(e.id), className: 'cursor-pointer', style: { pointerEvents: 'stroke' as const } }
                if (e.type === 'LINE') return <line key={e.id} x1={e.a.x} y1={-e.a.y} x2={e.b.x} y2={-e.b.y} stroke={col} strokeWidth={w} {...click} />
                if (e.type === 'POLYLINE') { const pts = e.pts.map((p) => `${p.x},${-p.y}`).join(' '); return e.closed ? <polygon key={e.id} points={pts} fill="none" stroke={col} strokeWidth={w} {...click} /> : <polyline key={e.id} points={pts} fill="none" stroke={col} strokeWidth={w} {...click} /> }
                if (e.type === 'CIRCLE') return <circle key={e.id} cx={e.c.x} cy={-e.c.y} r={e.r} fill="none" stroke={col} strokeWidth={w} {...click} />
                if (e.type === 'ARC') {
                  const a0 = (e.start * Math.PI) / 180, a1 = (e.end * Math.PI) / 180
                  const x0 = e.c.x + e.r * Math.cos(a0), y0 = e.c.y + e.r * Math.sin(a0)
                  const x1 = e.c.x + e.r * Math.cos(a1), y1 = e.c.y + e.r * Math.sin(a1)
                  const sweep = (e.end - e.start + 360) % 360
                  return <path key={e.id} d={`M ${x0} ${-y0} A ${e.r} ${e.r} 0 ${sweep > 180 ? 1 : 0} 0 ${x1} ${-y1}`} fill="none" stroke={col} strokeWidth={w} {...click} />
                }
                if (e.type === 'TEXT') return <text key={e.id} x={e.p.x} y={-e.p.y} fontSize={e.h} fill={col} {...click} style={{ pointerEvents: 'all' }}>{e.text}</text>
                return <g key={e.id} {...click} style={{ pointerEvents: 'all' }}><circle cx={e.p.x} cy={-e.p.y} r={sw * 6} fill="none" stroke={col} strokeWidth={w} /><text x={e.p.x + sw * 8} y={-e.p.y} fontSize={sw * 14} fill={col}>{e.name}</text></g>
              })}
            </svg>
          </div>
          {selected && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge/50 px-4 py-2.5 text-xs">
              <span className="font-medium text-amber-300">{selected.type}</span>
              <span className="text-slate-400">layer <span className="data-mono text-slate-200">{selected.layer}</span></span>
              <span className="text-slate-400">length <span className="data-mono text-slate-200">{(Math.round(entityLength(selected) * 100) / 100).toLocaleString()} {drawing.units}</span></span>
              {selected.type === 'TEXT' && <span className="text-slate-400">text <span className="text-slate-200">“{selected.text}”</span></span>}
              {selected.type === 'INSERT' && <span className="text-slate-400">block <span className="data-mono text-slate-200">{selected.name}</span></span>}
              <button onClick={() => removeEntity(selected.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-rose-500/15 px-2.5 py-1 font-medium text-rose-200 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /> Delete entity</button>
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader icon={Layers} accent="violet" title="Layers & takeoff" subtitle="Counts + drawn length per layer. Hide a layer to review, or delete it from the drawing (revise)." />
          <ul className="divide-y divide-edge/40 border-t border-edge/50">
            {drawing.layers.map((l) => {
              const off = !!hiddenLayers[l.name]
              return (
                <li key={l.name} className="flex items-center gap-2 px-3 py-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(l.name) }} aria-hidden />
                  <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', off ? 'text-slate-600' : 'text-slate-200')}>{l.name}</span>
                  <span className="data-mono shrink-0 text-[11px] text-slate-500">{l.count} ent · {formatNumber(Math.round(l.length))} {drawing.units}</span>
                  <button onClick={() => setHiddenLayers((h) => ({ ...h, [l.name]: !h[l.name] }))} aria-pressed={!off} aria-label={`Toggle layer ${l.name}`} className={cn('rounded p-1', off ? 'text-slate-600 hover:text-slate-400' : 'text-violet-300 hover:text-violet-200')}>
                    {off ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => removeLayer(l.name)} aria-label={`Delete layer ${l.name}`} className="rounded p-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              )
            })}
          </ul>
          <div className="mt-auto space-y-2 border-t border-edge/50 p-4 text-[11px] text-slate-500">
            <p className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5 shrink-0" /> Entity types: {Object.entries(drawing.counts).map(([t, n]) => `${t} ${n}`).join(' · ')}</p>
            <p className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5 shrink-0" /> Units from $INSUNITS: <span className="data-mono text-slate-300">{drawing.units}</span>. Deletions re-run the takeoff instantly; export the CSV for the full entity schedule.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
