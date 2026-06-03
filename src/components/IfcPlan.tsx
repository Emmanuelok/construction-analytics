import { useMemo } from 'react'
import type { PlanSegment } from '@/lib/ifc-explorer'

/* A 2D floor plan sliced from the real IFC geometry — the cut segments of a
 * horizontal section through the model at one level. North is up (x = East, z =
 * North). Click a cut wall/column to select its IFC product; the selection syncs
 * with the 3D model, inspector and schedules. View-only; strokes are non-scaling. */
export function IfcPlan({ segments, selected, onSelect, height = 340 }: {
  segments: PlanSegment[]
  selected: number | null
  onSelect: (expressID: number) => void
  height?: number
}) {
  const view = useMemo(() => {
    if (!segments.length) return null
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const s of segments) {
      minX = Math.min(minX, s.ax, s.bx); maxX = Math.max(maxX, s.ax, s.bx)
      minZ = Math.min(minZ, s.az, s.bz); maxZ = Math.max(maxZ, s.az, s.bz)
    }
    const w = Math.max(1e-3, maxX - minX), h = Math.max(1e-3, maxZ - minZ), ext = Math.max(w, h)
    return { w, h, ext, pad: ext * 0.1, toX: (x: number) => x - minX, toY: (z: number) => maxZ - z }
  }, [segments])

  if (!view) return <div style={{ height }} className="grid w-full place-items-center rounded-xl bg-[#0a0f1c] text-sm text-slate-500 ring-1 ring-edge/60">No section cut at this level.</div>

  const { w, h, ext, pad, toX, toY } = view
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} style={{ height }} className="w-full rounded-xl bg-[#0a0f1c] ring-1 ring-edge/60" role="img" aria-label={`IFC floor plan section: ${segments.length} cut segments`}>
      {segments.map((s, i) => {
        const on = s.expressID === selected
        return <line key={i} x1={toX(s.ax)} y1={toY(s.az)} x2={toX(s.bx)} y2={toY(s.bz)} stroke={on ? '#fbbf24' : '#9fb2cc'} strokeWidth={on ? 3 : 1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="cursor-pointer" onClick={() => onSelect(s.expressID)} />
      })}
      <g transform={`translate(${w + pad * 0.35}, ${-pad * 0.1})`} aria-hidden>
        <line x1={0} y1={ext * 0.08} x2={0} y2={0} stroke="#64748b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${-ext * 0.014} ${ext * 0.013},${ext * 0.012} ${-ext * 0.013},${ext * 0.012}`} fill="#94a3b8" />
        <text x={0} y={ext * 0.125} fontSize={ext * 0.05} fill="#94a3b8" textAnchor="middle">N</text>
      </g>
    </svg>
  )
}
