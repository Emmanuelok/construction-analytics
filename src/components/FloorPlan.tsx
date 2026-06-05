import { useMemo, useRef, useState } from 'react'
import type { LevelPlan } from '@/lib/building-explorer'
import type { FloorFire } from '@/lib/fire'
import { compass } from '@/lib/geo'

/* A top-down 2D floor plan of a single level — slab outline (+ any void), columns,
 * windows and doors, drawn from the same element ids as the 3D viewer and schedules.
 * Click an element to inspect it. Scroll to zoom, drag the background to pan. In edit
 * mode, drag a column / window / door to move it, or (with Add active) click to drop a
 * new column. North is up (scene x = East, z = North). */
export function FloorPlan({ plan, selected, onSelect, editable = false, addMode = false, onMoveElement, onAddAt, egressPath, compartments, height = 320 }: {
  plan: LevelPlan
  selected: string | null
  onSelect: (id: string) => void
  editable?: boolean
  addMode?: boolean
  onMoveElement?: (id: string, dx: number, dz: number) => void
  onAddAt?: (x: number, z: number) => void
  egressPath?: { points: { x: number; z: number }[] } | null
  compartments?: FloorFire | null
  height?: number
}) {
  const { b, w, h, pad, toX, toY, ext } = useMemo(() => {
    const b = plan.bounds
    const w = Math.max(0.001, b.maxX - b.minX), h = Math.max(0.001, b.maxZ - b.minZ)
    const ext = Math.max(w, h), pad = ext * 0.12
    return { b, w, h, pad, ext, toX: (x: number) => x - b.minX, toY: (z: number) => b.maxZ - z }
  }, [plan])

  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const viewRef = useRef({ minX: b.minX, maxZ: b.maxZ }); viewRef.current = { minX: b.minX, maxZ: b.maxZ }
  const [view, setView] = useState({ k: 1, ox: 0, oy: 0 })
  const dragRef = useRef<{ id: string; lx: number; lz: number; moved: boolean } | null>(null)
  const panRef = useRef<{ px: number; py: number } | null>(null)

  // element-local (world) point under a client coordinate, accounting for pan/zoom
  const worldAt = (cx: number, cy: number) => {
    const g = gRef.current; if (!g) return { x: 0, z: 0 }
    const u = new DOMPoint(cx, cy).matrixTransform(g.getScreenCTM()!.inverse())
    return { x: u.x + viewRef.current.minX, z: viewRef.current.maxZ - u.y }
  }
  const onElDrag = (e: PointerEvent) => { const d = dragRef.current; if (!d || !onMoveElement) return; const p = worldAt(e.clientX, e.clientY); const dx = p.x - d.lx, dz = p.z - d.lz; if (Math.abs(dx) + Math.abs(dz) > 1e-4) { d.moved = true; onMoveElement(d.id, dx, dz); d.lx = p.x; d.lz = p.z } }
  const endElDrag = () => { dragRef.current = null; window.removeEventListener('pointermove', onElDrag); window.removeEventListener('pointerup', endElDrag) }
  const startElDrag = (e: React.PointerEvent, id: string) => {
    if (!editable || !onMoveElement || addMode) return
    e.stopPropagation()
    const p = worldAt(e.clientX, e.clientY)
    dragRef.current = { id, lx: p.x, lz: p.z, moved: false }
    window.addEventListener('pointermove', onElDrag); window.addEventListener('pointerup', endElDrag)
  }

  // background pan (drag empty space) + wheel zoom toward the cursor
  const svgUnitsPerPx = () => { const r = svgRef.current?.getBoundingClientRect(); return r ? (w + 2 * pad) / r.width : 1 }
  const onPan = (e: PointerEvent) => { const p = panRef.current; if (!p) return; const s = svgUnitsPerPx(); setView((v) => ({ ...v, ox: v.ox + (e.clientX - p.px) * s, oy: v.oy + (e.clientY - p.py) * s })); p.px = e.clientX; p.py = e.clientY }
  const endPan = () => { panRef.current = null; window.removeEventListener('pointermove', onPan); window.removeEventListener('pointerup', endPan) }
  const onBgDown = (e: React.PointerEvent) => { if (addMode) return; panRef.current = { px: e.clientX, py: e.clientY }; window.addEventListener('pointermove', onPan); window.addEventListener('pointerup', endPan) }
  const onWheel = (e: React.WheelEvent) => {
    const svg = svgRef.current; if (!svg) return
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse()) // viewBox coords
    const f = e.deltaY > 0 ? 1 / 1.15 : 1.15
    setView((v) => { const k = Math.max(0.5, Math.min(12, v.k * f)); const r = k / v.k; return { k, ox: pt.x - (pt.x - v.ox) * r, oy: pt.y - (pt.y - v.oy) * r } })
  }

  const outline = plan.outline.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ')
  const hole = plan.hole && plan.hole.length >= 3 ? plan.hole.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ') : null
  const colR = Math.max(0.14, ext * 0.014)
  const lineGroup = (id: string, a: { x: number; z: number }, bb: { x: number; z: number }, color: string, wid: number) => {
    const on = selected === id
    return (
      <g key={id} className={editable ? 'cursor-grab' : 'cursor-pointer'} onPointerDown={(e) => startElDrag(e, id)} onClick={() => { if (!dragRef.current?.moved) onSelect(id) }}>
        <line x1={toX(a.x)} y1={toY(a.z)} x2={toX(bb.x)} y2={toY(bb.z)} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />
        <line x1={toX(a.x)} y1={toY(a.z)} x2={toX(bb.x)} y2={toY(bb.z)} stroke={on ? '#fbbf24' : color} strokeWidth={on ? wid + 2 : wid} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </g>
    )
  }

  return (
    <svg ref={svgRef} viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} style={{ height }}
      className={`w-full rounded-xl bg-[#0a0f1c] ring-1 ring-edge/60 ${addMode ? 'cursor-crosshair' : 'cursor-grab'}`}
      role="img" aria-label={`Floor plan, ${plan.isRoof ? 'roof' : `level ${plan.level}`}: ${plan.rooms.length} rooms, ${plan.partitions.length} partitions, ${plan.interiorDoors.length} interior doors, ${plan.columns.length} columns, ${plan.panels.length} windows, ${plan.doors.length} doors, ${plan.stairs.length} stairs`}
      onWheel={onWheel} onPointerDown={onBgDown}>
      <g ref={gRef} transform={`translate(${view.ox} ${view.oy}) scale(${view.k})`}>
        {/* slab fill + outline */}
        {hole
          ? <path d={`M ${outline.replace(/ /g, ' L ')} Z M ${hole.replace(/ /g, ' L ')} Z`} fillRule="evenodd" fill="#11203a" stroke="none" />
          : <polygon points={outline} fill="#11203a" stroke="none" />}
        <polygon points={outline} fill="none" stroke={selected === `floor-${plan.level}` || (plan.isRoof && selected === 'roof') ? '#fbbf24' : '#3b5a82'} strokeWidth={selected?.startsWith('floor') || selected === 'roof' ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" className="cursor-pointer" onClick={() => !addMode && onSelect(plan.isRoof ? 'roof' : `floor-${plan.level}`)} />
        {hole && <polygon points={hole} fill="none" stroke="#3b5a82" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        {/* interior rooms / spaces */}
        <g>
          {plan.rooms.map((r) => {
            const on = selected === r.id
            const cx = r.polygon.reduce((s, p) => s + p.x, 0) / r.polygon.length, cz = r.polygon.reduce((s, p) => s + p.z, 0) / r.polygon.length
            return (
              <g key={r.id} className="cursor-pointer" onClick={() => !addMode && onSelect(r.id)}>
                <polygon points={r.polygon.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ')} fill={on ? '#fbbf2422' : '#16243c80'} stroke={on ? '#fbbf24' : '#2c4a6e'} strokeWidth={on ? 1.6 : 0.8} vectorEffect="non-scaling-stroke" />
                <text x={toX(cx)} y={toY(cz)} fontSize={ext * 0.026} fill={on ? '#fbbf24' : '#7c93b2'} textAnchor="middle" className="pointer-events-none select-none">{r.area} m²</text>
              </g>
            )
          })}
        </g>
        {/* interior partitions (draggable, like walls) */}
        <g>{plan.partitions.map((p) => lineGroup(p.id, p.a, p.b, '#6b7a93', 1.5))}</g>
        {/* interior doors — opening leaf + swing arc */}
        <g>{plan.interiorDoors.map((d) => {
          const vx = d.b.x - d.a.x, vz = d.b.z - d.a.z, L = Math.hypot(vx, vz) || 1
          const tip = { x: d.a.x + (vz / L) * L, z: d.a.z + (-vx / L) * L }
          const on = selected === d.id, col = on ? '#fbbf24' : '#d6a85f'
          return (
            <g key={d.id} className={editable ? 'cursor-grab' : 'cursor-pointer'} onPointerDown={(e) => startElDrag(e, d.id)} onClick={() => { if (!dragRef.current?.moved) onSelect(d.id) }}>
              <line x1={toX(d.a.x)} y1={toY(d.a.z)} x2={toX(d.b.x)} y2={toY(d.b.z)} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />
              <line x1={toX(d.a.x)} y1={toY(d.a.z)} x2={toX(tip.x)} y2={toY(tip.z)} stroke={col} strokeWidth={on ? 2 : 1.3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <path d={`M ${toX(tip.x)} ${toY(tip.z)} A ${L} ${L} 0 0 1 ${toX(d.b.x)} ${toY(d.b.z)}`} fill="none" stroke={col} strokeWidth={0.8} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            </g>
          )
        })}</g>
        {/* stairs in the core */}
        <g>{plan.stairs.map((s) => {
          const on = selected === s.id
          const x = toX(s.x), y = toY(s.z), hw = s.w / 2, hd = s.d / 2
          const steps = 7
          const lines = Array.from({ length: steps }, (_, i) => {
            const t = (i + 0.5) / steps
            return s.dir === 'z'
              ? <line key={i} x1={x - hw} y1={y - hd + s.d * t} x2={x + hw} y2={y - hd + s.d * t} stroke={on ? '#fbbf24' : '#9fb0c8'} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
              : <line key={i} x1={x - hw + s.w * t} y1={y - hd} x2={x - hw + s.w * t} y2={y + hd} stroke={on ? '#fbbf24' : '#9fb0c8'} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          })
          return (
            <g key={s.id} className="cursor-pointer" onClick={() => { if (!addMode) onSelect(s.id) }}>
              <rect x={x - hw} y={y - hd} width={s.w} height={s.d} fill={on ? '#fbbf2422' : '#1f2c44aa'} stroke={on ? '#fbbf24' : '#6b7a93'} strokeWidth={on ? 1.6 : 1} vectorEffect="non-scaling-stroke" />
              {lines}
            </g>
          )
        })}</g>
        {/* fire compartments: rated boundary walls + area labels */}
        {compartments && compartments.compartments.length > 0 && (
          <g aria-hidden className="pointer-events-none">
            {compartments.compartments.map((c) => <text key={c.id} x={toX(c.center.x)} y={toY(c.center.z)} fontSize={ext * 0.032} fill="#fca5a5" fontWeight={600} textAnchor="middle" className="select-none">{c.area} m²</text>)}
            {compartments.walls.map((w, i) => <line key={i} x1={toX(w.a.x)} y1={toY(w.a.z)} x2={toX(w.b.x)} y2={toY(w.b.z)} stroke="#ef4444" strokeWidth={3.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />)}
          </g>
        )}
        {/* routed egress path for the selected room (room → doorways → core → nearest stair) */}
        {egressPath && egressPath.points.length >= 2 && (
          <g aria-hidden className="pointer-events-none">
            <polyline points={egressPath.points.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ')} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {(() => { const e = egressPath.points[egressPath.points.length - 1]; return <circle cx={toX(e.x)} cy={toY(e.z)} r={colR * 1.6} fill="none" stroke="#fbbf24" strokeWidth={1.5} vectorEffect="non-scaling-stroke" /> })()}
          </g>
        )}
        {/* windows + doors (draggable) */}
        <g>{plan.panels.map((p) => lineGroup(p.id, p.a, p.b, '#38bdf8', 2.5))}</g>
        <g>{plan.doors.map((p) => lineGroup(p.id, p.a, p.b, '#34d399', 4))}</g>
        {/* columns (draggable) */}
        <g>{plan.columns.map((c) => { const on = selected === c.id; return <circle key={c.id} cx={toX(c.x)} cy={toY(c.z)} r={on ? colR * 1.7 : colR} fill={on ? '#fbbf24' : '#94a3b8'} stroke="#0a0f1c" strokeWidth={0.6} vectorEffect="non-scaling-stroke" className={editable ? 'cursor-grab' : 'cursor-pointer'} onPointerDown={(e) => startElDrag(e, c.id)} onClick={() => { if (!dragRef.current?.moved) onSelect(c.id) }} /> })}</g>
        {/* core footprint */}
        {plan.core && <rect x={toX(plan.core.x) - plan.core.w / 2} y={toY(plan.core.z) - plan.core.d / 2} width={plan.core.w} height={plan.core.d} fill={selected === 'core' ? '#fbbf2433' : '#33415566'} stroke={selected === 'core' ? '#fbbf24' : '#64748b'} strokeWidth={selected === 'core' ? 2.5 : 1.2} vectorEffect="non-scaling-stroke" className="cursor-pointer" onClick={() => !addMode && onSelect('core')} />}
        {/* add capture layer (on top while Add column / Add door is active, so a click anywhere places the element) */}
        {addMode && onAddAt && (
          <rect x={-pad * 4} y={-pad * 4} width={(w + 2 * pad) * 4} height={(h + 2 * pad) * 4} fill="transparent" className="cursor-crosshair" onClick={(e) => { const p = worldAt(e.clientX, e.clientY); onAddAt(p.x, p.z) }} />
        )}
        {/* north arrow */}
        <g transform={`translate(${w + pad * 0.35}, ${pad * 0.2})`} aria-hidden>
          <line x1={0} y1={ext * 0.07} x2={0} y2={0} stroke="#64748b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <polygon points={`0,${-ext * 0.012} ${ext * 0.012},${ext * 0.01} ${-ext * 0.012},${ext * 0.01}`} fill="#94a3b8" />
          <text x={0} y={ext * 0.11} fontSize={ext * 0.05} fill="#94a3b8" textAnchor="middle">N</text>
        </g>
      </g>
    </svg>
  )
}

/** Bearing → arrow glyph (for façade orientation tags). */
export const facingArrow = (deg: number) => ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round((deg % 360) / 45) % 8] + ' ' + compass(deg)
