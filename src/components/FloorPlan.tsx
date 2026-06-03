import { useMemo } from 'react'
import type { LevelPlan } from '@/lib/building-explorer'
import { compass } from '@/lib/geo'

/* A top-down 2D floor plan of a single level — slab outline (+ any void), the
 * structural column grid and the curtain-wall panels, drawn from the same element
 * ids as the 3D viewer and schedules. Click a column or panel to inspect it; the
 * selected element is highlighted. North is up (scene x = East, z = North). Strokes
 * are non-scaling so the plan stays crisp at any size. View-only geometry — the
 * schedules below give the keyboard-accessible path to the same elements. */
export function FloorPlan({ plan, selected, onSelect, height = 320 }: {
  plan: LevelPlan
  selected: string | null
  onSelect: (id: string) => void
  height?: number
}) {
  const { b, w, h, pad, toX, toY, ext } = useMemo(() => {
    const b = plan.bounds
    const w = Math.max(0.001, b.maxX - b.minX), h = Math.max(0.001, b.maxZ - b.minZ)
    const ext = Math.max(w, h)
    const pad = ext * 0.12
    const toX = (x: number) => x - b.minX
    const toY = (z: number) => b.maxZ - z // flip so North is up
    return { b, w, h, pad, toX, toY, ext }
  }, [plan])

  const outline = plan.outline.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ')
  const hole = plan.hole && plan.hole.length >= 3 ? plan.hole.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ') : null
  const colR = Math.max(0.14, ext * 0.014)

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`}
      style={{ height }}
      className="w-full rounded-xl bg-[#0a0f1c] ring-1 ring-edge/60"
      role="img"
      aria-label={`Floor plan, ${plan.isRoof ? 'roof' : `level ${plan.level}`}: ${plan.columns.length} columns, ${plan.panels.length} curtain panels`}
    >
      {/* slab fill + outline (with optional courtyard void) */}
      <g>
        {hole
          ? <path d={`M ${outline.replace(/ /g, ' L ')} Z M ${hole.replace(/ /g, ' L ')} Z`} fillRule="evenodd" fill="#11203a" stroke="none" />
          : <polygon points={outline} fill="#11203a" stroke="none" />}
        <polygon points={outline} fill="none" stroke={selected === `floor-${plan.level}` || (plan.isRoof && selected === 'roof') ? '#fbbf24' : '#3b5a82'} strokeWidth={selected?.startsWith('floor') || selected === 'roof' ? 2.5 : 1.5} vectorEffect="non-scaling-stroke"
          className="cursor-pointer" onClick={() => onSelect(plan.isRoof ? 'roof' : `floor-${plan.level}`)} />
        {hole && <polygon points={hole} fill="none" stroke="#3b5a82" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      </g>
      {/* curtain-wall panels */}
      <g>
        {plan.panels.map((p) => {
          const on = selected === p.id
          return (
            <g key={p.id} className="cursor-pointer" onClick={() => onSelect(p.id)}>
              <line x1={toX(p.a.x)} y1={toY(p.a.z)} x2={toX(p.b.x)} y2={toY(p.b.z)} stroke="transparent" strokeWidth={11} vectorEffect="non-scaling-stroke" />
              <line x1={toX(p.a.x)} y1={toY(p.a.z)} x2={toX(p.b.x)} y2={toY(p.b.z)} stroke={on ? '#fbbf24' : '#38bdf8'} strokeWidth={on ? 4.5 : 2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </g>
          )
        })}
      </g>
      {/* structural columns */}
      <g>
        {plan.columns.map((c) => {
          const on = selected === c.id
          return <circle key={c.id} cx={toX(c.x)} cy={toY(c.z)} r={on ? colR * 1.7 : colR} fill={on ? '#fbbf24' : '#94a3b8'} stroke="#0a0f1c" strokeWidth={0.6} vectorEffect="non-scaling-stroke" className="cursor-pointer" onClick={() => onSelect(c.id)} />
        })}
      </g>
      {/* core footprint */}
      {plan.core && (
        <rect
          x={toX(plan.core.x) - (plan.core.w / 2)} y={toY(plan.core.z) - (plan.core.d / 2)} width={plan.core.w} height={plan.core.d}
          fill={selected === 'core' ? '#fbbf2433' : '#33415566'} stroke={selected === 'core' ? '#fbbf24' : '#64748b'} strokeWidth={selected === 'core' ? 2.5 : 1.2} vectorEffect="non-scaling-stroke"
          className="cursor-pointer" onClick={() => onSelect('core')}
        />
      )}
      {/* north arrow */}
      <g transform={`translate(${w + pad * 0.35}, ${pad * 0.2})`} aria-hidden>
        <line x1={0} y1={ext * 0.07} x2={0} y2={0} stroke="#64748b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${-ext * 0.012} ${ext * 0.012},${ext * 0.01} ${-ext * 0.012},${ext * 0.01}`} fill="#94a3b8" />
        <text x={0} y={ext * 0.11} fontSize={ext * 0.05} fill="#94a3b8" textAnchor="middle">N</text>
      </g>
    </svg>
  )
}

/** Bearing → arrow glyph (for façade orientation tags). */
export const facingArrow = (deg: number) => ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round((deg % 360) / 45) % 8] + ' ' + compass(deg)
