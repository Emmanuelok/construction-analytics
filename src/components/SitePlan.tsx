import { useMemo } from 'react'
import type { Pt } from '@/lib/zoning'

/* A clickable top-down site plan: the parcel boundary (with numbered vertices and
 * per-edge length labels), the setback / buildable line, and the proposed footprint.
 * Click a vertex (V1…) or an edge (E1…) to inspect its coordinates / length & bearing;
 * the selection syncs with the survey tables. North is up (x = East, z = North).
 * View-only geometry — vertex editing stays in the polygon editor; the survey tables
 * give the keyboard-accessible path to the same elements. */
export function SitePlan({ boundary, buildable, footprint, selected, onSelect, height = 360 }: {
  boundary: Pt[]
  buildable?: Pt[]
  footprint?: Pt[]
  selected: string | null
  onSelect: (id: string) => void
  height?: number
}) {
  const { w, h, pad, toX, toY, ext } = useMemo(() => {
    const xs = boundary.map((p) => p.x), zs = boundary.map((p) => p.z)
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
    const w = Math.max(0.001, maxX - minX), h = Math.max(0.001, maxZ - minZ)
    const ext = Math.max(w, h), pad = ext * 0.14
    return { w, h, pad, ext, toX: (x: number) => x - minX, toY: (z: number) => maxZ - z }
  }, [boundary])

  const ring = (pts: Pt[]) => pts.map((p) => `${toX(p.x)},${toY(p.z)}`).join(' ')
  const labelFont = ext * 0.045

  return (
    <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`} style={{ height }} className="w-full rounded-xl bg-[#0a0f1c] ring-1 ring-edge/60" role="img" aria-label={`Site survey plan: ${boundary.length} boundary vertices, clickable`}>
      {/* proposed footprint */}
      {footprint && footprint.length >= 3 && <polygon points={ring(footprint)} fill="#22c55e33" stroke="#22c55e" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      {/* setback / buildable line */}
      {buildable && buildable.length >= 3 && <polygon points={ring(buildable)} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
      {/* boundary fill */}
      <polygon points={ring(boundary)} fill="#11203a55" stroke="none" />
      {/* edges (clickable) with length labels */}
      <g>
        {boundary.map((a, i) => {
          const b = boundary[(i + 1) % boundary.length]
          const id = `e-${i}`, on = selected === id
          const mx = (toX(a.x) + toX(b.x)) / 2, my = (toY(a.z) + toY(b.z)) / 2
          const len = Math.hypot(b.x - a.x, b.z - a.z)
          return (
            <g key={id} className="cursor-pointer" onClick={() => onSelect(id)}>
              <line x1={toX(a.x)} y1={toY(a.z)} x2={toX(b.x)} y2={toY(b.z)} stroke="transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />
              <line x1={toX(a.x)} y1={toY(a.z)} x2={toX(b.x)} y2={toY(b.z)} stroke={on ? '#fbbf24' : '#e2e8f0'} strokeWidth={on ? 4 : 2} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              <text x={mx} y={my} dy={-ext * 0.012} fontSize={labelFont} fill={on ? '#fbbf24' : '#94a3b8'} textAnchor="middle">{len.toFixed(1)} m</text>
            </g>
          )
        })}
      </g>
      {/* vertices (clickable) */}
      <g>
        {boundary.map((p, i) => {
          const id = `v-${i}`, on = selected === id
          return (
            <g key={id} className="cursor-pointer" onClick={() => onSelect(id)}>
              <circle cx={toX(p.x)} cy={toY(p.z)} r={on ? ext * 0.022 : ext * 0.014} fill={on ? '#fbbf24' : '#38bdf8'} stroke="#0a0f1c" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              <text x={toX(p.x)} y={toY(p.z)} dy={-ext * 0.028} fontSize={labelFont} fill={on ? '#fbbf24' : '#cbd5e1'} textAnchor="middle">V{i + 1}</text>
            </g>
          )
        })}
      </g>
      {/* north arrow */}
      <g transform={`translate(${w + pad * 0.4}, ${-pad * 0.2})`} aria-hidden>
        <line x1={0} y1={ext * 0.08} x2={0} y2={0} stroke="#64748b" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <polygon points={`0,${-ext * 0.014} ${ext * 0.013},${ext * 0.012} ${-ext * 0.013},${ext * 0.012}`} fill="#94a3b8" />
        <text x={0} y={ext * 0.125} fontSize={ext * 0.05} fill="#94a3b8" textAnchor="middle">N</text>
      </g>
    </svg>
  )
}
