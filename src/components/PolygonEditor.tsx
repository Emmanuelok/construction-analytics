import { useRef, useState } from 'react'
import { type Pt } from '@/lib/zoning'

/* Interactive 2D polygon editor (SVG). Drag a vertex to reshape, click a dot on
 * an edge to insert a point, double-click a vertex to remove it. Controlled:
 * emits the new polygon via onChange. The view window is fixed on mount (from the
 * initial polygon) so dragging never makes the canvas jump — remount via `key`
 * after an external change (preset/import) to refit. Coordinate-space agnostic:
 * works for a normalised massing footprint or a metric site boundary alike. */
export function PolygonEditor({
  value,
  onChange,
  accent = '#38bdf8',
  height = 260,
}: {
  value: Pt[]
  onChange: (pts: Pt[]) => void
  accent?: string
  height?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<number | null>(null)

  // Fixed view window, computed once from the initial polygon (with padding).
  const winRef = useRef<{ minX: number; minZ: number; span: number } | null>(null)
  if (!winRef.current) {
    const xs = value.map((p) => p.x), zs = value.map((p) => p.z)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxZ - minZ, 1) * 1.6
    winRef.current = { minX: cx - span / 2, minZ: cz - span / 2, span }
  }
  const win = winRef.current
  const VB = 300, PAD = 22
  const sc = (VB - 2 * PAD) / win.span
  const toPx = (p: Pt) => ({ x: PAD + (p.x - win.minX) * sc, y: PAD + (p.z - win.minZ) * sc })
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const fromEvent = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * VB
    const vy = ((e.clientY - r.top) / r.height) * VB
    return {
      x: clamp(win.minX + (vx - PAD) / sc, win.minX, win.minX + win.span),
      z: clamp(win.minZ + (vy - PAD) / sc, win.minZ, win.minZ + win.span),
    }
  }

  const onVertexDown = (i: number, e: React.PointerEvent) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag(i)
  }
  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return
    const p = fromEvent(e)
    onChange(value.map((q, i) => (i === drag ? p : q)))
  }
  const insertAt = (i: number) => {
    const a = value[i], b = value[(i + 1) % value.length]
    onChange([...value.slice(0, i + 1), { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, ...value.slice(i + 1)])
  }
  const removeAt = (i: number) => { if (value.length > 3) onChange(value.filter((_, j) => j !== i)) }

  const poly = value.map((p) => { const q = toPx(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}` }).join(' ')
  const mid = (VB / 2)

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        style={{ height }}
        className="w-full touch-none select-none rounded-lg bg-base/60 ring-1 ring-edge/60"
        role="application"
        aria-label="Polygon shape editor: drag points to reshape, click an edge dot to add a point, double-click a point to remove"
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <line x1={mid} y1={8} x2={mid} y2={VB - 8} stroke="#1e293b" strokeWidth={0.6} />
        <line x1={8} y1={mid} x2={VB - 8} y2={mid} stroke="#1e293b" strokeWidth={0.6} />
        <polygon points={poly} fill={`${accent}26`} stroke={accent} strokeWidth={1.6} strokeLinejoin="round" />
        {value.map((p, i) => {
          const a = toPx(p), b = toPx(value[(i + 1) % value.length])
          return <circle key={`m${i}`} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={4} fill="#0a0f1c" stroke={accent} strokeWidth={1.2} className="cursor-copy" onPointerDown={(e) => { e.stopPropagation(); insertAt(i) }}><title>Add a point</title></circle>
        })}
        {value.map((p, i) => {
          const q = toPx(p)
          return <circle key={`v${i}`} cx={q.x} cy={q.y} r={6.5} fill={accent} stroke="#e2e8f0" strokeWidth={1.5} className="cursor-grab" onPointerDown={(e) => onVertexDown(i, e)} onDoubleClick={() => removeAt(i)}><title>Drag to move · double-click to remove</title></circle>
        })}
      </svg>
      <p className="mt-1.5 text-[11px] text-slate-500">Drag points to reshape · click an edge dot to add · double-click a point to remove · {value.length} points</p>
    </div>
  )
}
