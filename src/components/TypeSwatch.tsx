import type { FamilyType } from '@/lib/families'

/* A render preview per family type — an archetypal SVG motif drawn in the type's
 * actual colour/opacity/section: column sections (square/round/H/tube), beam
 * elevations, façade systems (brick coursing, panel joints, cassette seams,
 * curtain grids), glazing tints, door leaves + swings, partition builds, floor
 * finish patterns (planks, tiles, terrazzo, stipple), ceiling systems, roof
 * build-ups, foundations, stairs, slabs, cores, mullion profiles, balustrades.
 * Click one to select the type — the 3D model re-renders with it. */

const BG = '#0b1322'
export function TypeSwatch({ family, type, size = 46 }: { family: string; type: FamilyType; size?: number }) {
  const c = type.color ?? '#8a93a6'
  const op = type.opacity ?? 1
  const id = type.id
  const W = size, H = Math.round(size * 0.7)

  const motif = () => {
    switch (family) {
      case 'column': {
        if (type.shape === 'cylinder') return <>
          <circle cx={22} cy={16} r={10} fill={c} />
          {id === 'cft' && <circle cx={22} cy={16} r={6} fill={BG} opacity={0.45} />}
        </>
        if (id === 'steel-uc') return <g fill={c}><rect x={12} y={6} width={20} height={4} /><rect x={12} y={22} width={20} height={4} /><rect x={20} y={10} width={4} height={12} /></g>
        return <rect x={12} y={6} width={20} height={20} fill={c} rx={id === 'glulam-col' ? 2 : 0} />
      }
      case 'beam': {
        const d = Number(type.props.depthFactor ?? 1)
        if (id === 'steel-ub') return <g fill={c}><rect x={6} y={8} width={32} height={3} /><rect x={6} y={21} width={32} height={3} /><rect x={20} y={11} width={4} height={10} /></g>
        return <g><rect x={6} y={16 - 6 * d} width={32} height={12 * d} fill={c} />{id === 'pt-band' && <path d="M7 16 Q 22 24 37 16" stroke={BG} strokeWidth={1.4} fill="none" opacity={0.6} />}</g>
      }
      case 'facade': {
        const base = <rect x={4} y={4} width={36} height={24} fill={c} />
        if (id === 'brick') return <g>{base}{[8, 12, 16, 20, 24].map((y) => <line key={y} x1={4} y1={y} x2={40} y2={y} stroke={BG} strokeWidth={0.8} opacity={0.5} />)}{[12, 22, 32].map((x, i) => <line key={x} x1={x + (i % 2 ? 4 : 0)} y1={4} x2={x + (i % 2 ? 4 : 0)} y2={28} stroke={BG} strokeWidth={0.7} opacity={0.3} />)}</g>
        if (id === 'curtain') return <g><rect x={4} y={4} width={36} height={24} fill="#7dd3fc" opacity={0.35} />{[16, 28].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={28} stroke={c} strokeWidth={1.6} />)}<line x1={4} y1={16} x2={40} y2={16} stroke={c} strokeWidth={1.6} /><rect x={4} y={4} width={36} height={24} fill="none" stroke={c} strokeWidth={2} /></g>
        if (id === 'precast' || id === 'gfrc') return <g>{base}<line x1={22} y1={4} x2={22} y2={28} stroke={BG} strokeWidth={1.4} opacity={0.6} /><line x1={4} y1={16} x2={40} y2={16} stroke={BG} strokeWidth={1.4} opacity={0.6} /></g>
        return <g>{base}{[10, 16, 22, 28, 34].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={28} stroke={BG} strokeWidth={1} opacity={0.45} />)}</g> // rain-screens
      }
      case 'glazing': return <g><rect x={4} y={4} width={36} height={24} fill={c} opacity={Math.min(op + 0.25, 0.9)} /><path d="M8 28 L 20 4 L 26 4 L 14 28 Z" fill="#ffffff" opacity={0.22} />{id === 'fritted' && [8, 14, 20, 26, 32].flatMap((x) => [9, 15, 21].map((y) => <circle key={`${x}-${y}`} cx={x + ((y / 3) % 2)} cy={y} r={1} fill="#dfeaf2" opacity={0.8} />))}<rect x={4} y={4} width={36} height={24} fill="none" stroke="#3c4a5e" strokeWidth={1.5} /></g>
      case 'door': {
        if (id === 'revolving') return <g><circle cx={22} cy={16} r={11} fill="none" stroke={c} strokeWidth={1.6} /><line x1={22} y1={5} x2={22} y2={27} stroke={c} strokeWidth={1.6} /><line x1={11} y1={16} x2={33} y2={16} stroke={c} strokeWidth={1.6} /></g>
        if (id === 'auto-slide') return <g><rect x={6} y={6} width={15} height={20} fill={c} opacity={0.85} /><rect x={23} y={6} width={15} height={20} fill={c} opacity={0.55} /><path d="M14 16 h6 m-2 -2 l2 2 l-2 2 M30 16 h-6 m2 -2 l-2 2 l2 2" stroke="#dfe7f2" strokeWidth={1} fill="none" /></g>
        return <g><rect x={8} y={5} width={13} height={22} fill={c} /><rect x={23} y={5} width={13} height={22} fill={c} opacity={0.75} /><circle cx={19} cy={16} r={1.2} fill="#dfe7f2" /></g>
      }
      case 'interiorDoor': return <g><rect x={10} y={5} width={14} height={22} fill={c} rx={1} /><path d={`M24 27 A 14 14 0 0 0 10 13`} fill="none" stroke={c} strokeWidth={1} strokeDasharray="2 2" opacity={0.7} /><circle cx={21} cy={16} r={1.1} fill="#e8eef6" />{id === 'timber-fd60' && <rect x={10} y={5} width={14} height={22} fill="none" stroke="#e05d5d" strokeWidth={1.2} rx={1} />}{id === 'steel-fire' && <g fill="#dfe7f2">{[9, 16, 23].map((y) => <circle key={y} cx={12} cy={y} r={0.8} />)}</g>}</g>
      case 'partition': {
        if (id === 'glazed') return <g><rect x={4} y={6} width={36} height={20} fill={c} opacity={0.4} />{[14, 24, 34].map((x) => <line key={x} x1={x} y1={6} x2={x} y2={26} stroke="#5d7a94" strokeWidth={1.2} />)}</g>
        if (id === 'block') return <g><rect x={4} y={6} width={36} height={20} fill={c} />{[11, 16, 21].map((y) => <line key={y} x1={4} y1={y} x2={40} y2={y} stroke={BG} strokeWidth={0.8} opacity={0.5} />)}</g>
        if (id === 'demountable') return <g><rect x={4} y={6} width={36} height={20} fill={c} />{[13, 22, 31].map((x) => <line key={x} x1={x} y1={6} x2={x} y2={26} stroke={BG} strokeWidth={1.3} opacity={0.6} />)}</g>
        return <g><rect x={4} y={6} width={36} height={20} fill={c} />{id === 'acoustic' && <rect x={4} y={14} width={36} height={3.5} fill={BG} opacity={0.35} />}</g>
      }
      case 'floorFinish': {
        const base = <rect x={4} y={4} width={36} height={24} fill={c} />
        if (id === 'timber') return <g>{base}{[10, 16, 22].map((y) => <line key={y} x1={4} y1={y} x2={40} y2={y} stroke={BG} strokeWidth={0.9} opacity={0.5} />)}<line x1={18} y1={4} x2={18} y2={10} stroke={BG} strokeWidth={0.9} opacity={0.5} /><line x1={30} y1={10} x2={30} y2={16} stroke={BG} strokeWidth={0.9} opacity={0.5} /></g>
        if (id === 'porcelain' || id === 'raised') return <g>{base}<line x1={22} y1={4} x2={22} y2={28} stroke={BG} strokeWidth={1} opacity={0.55} /><line x1={4} y1={16} x2={40} y2={16} stroke={BG} strokeWidth={1} opacity={0.55} /></g>
        if (id === 'terrazzo') return <g>{base}{[[9, 9, '#8d8474'], [16, 20, '#a39884'], [25, 11, '#7d7668'], [33, 22, '#b0a691'], [29, 7, '#6e685c'], [12, 24, '#988e7c']].map(([x, y, f], i) => <circle key={i} cx={Number(x)} cy={Number(y)} r={1.6} fill={String(f)} />)}</g>
        if (id === 'carpet') return <g>{base}{[7, 13, 19, 25, 31, 37].flatMap((x) => [8, 14, 20, 26].map((y) => <rect key={`${x}-${y}`} x={x} y={y + ((x / 6) % 2)} width={1.4} height={1.4} fill={BG} opacity={0.3} />))}</g>
        return <g>{base}<path d="M8 26 L 22 6 L 28 6 L 14 26 Z" fill="#ffffff" opacity={0.14} /></g> // polished / resin sheen
      }
      case 'ceiling': {
        if (id === 'mineral' || id === 'metal-pan') return <g><rect x={4} y={4} width={36} height={24} fill={c} />{[13, 22, 31].map((x) => <line key={x} x1={x} y1={4} x2={x} y2={28} stroke={BG} strokeWidth={0.9} opacity={0.5} />)}{[12, 20].map((y) => <line key={y} x1={4} y1={y} x2={40} y2={y} stroke={BG} strokeWidth={0.9} opacity={0.5} />)}{id === 'metal-pan' && [8, 17, 26, 35].map((x) => <circle key={x} cx={x} cy={24} r={0.7} fill={BG} opacity={0.6} />)}</g>
        if (id === 'baffle') return <g>{[6, 12, 18, 24, 30, 36].map((x) => <rect key={x} x={x} y={6} width={3} height={20} fill={c} />)}</g>
        if (id === 'exposed') return <g><rect x={4} y={4} width={36} height={8} fill={c} /><circle cx={14} cy={20} r={4} fill="none" stroke={c} strokeWidth={1.6} /><rect x={24} y={17} width={12} height={6} fill="none" stroke={c} strokeWidth={1.4} /></g>
        return <rect x={4} y={4} width={36} height={24} fill={c} />
      }
      case 'roof': return <g><rect x={4} y={20} width={36} height={6} fill="#8c97a8" /><rect x={4} y={14} width={36} height={6} fill={id === 'green' ? '#55703f' : c} />{id === 'green' && [8, 14, 20, 26, 32, 38].map((x) => <path key={x} d={`M${x} 14 q1 -3 2 0`} stroke="#7a9a6a" strokeWidth={1} fill="none" />)}{id === 'pv' && [7, 19, 31].map((x) => <rect key={x} x={x} y={8} width={9} height={5} fill="#27374f" stroke="#5c87b8" strokeWidth={0.7} />)}{id === 'terrace' && [10, 18, 26, 34].map((x) => <line key={x} x1={x} y1={14} x2={x} y2={20} stroke={BG} strokeWidth={1} opacity={0.6} />)}</g>
      case 'foundation': {
        if (id === 'piles') return <g><rect x={6} y={6} width={32} height={5} fill={c} />{[10, 21, 32].map((x) => <rect key={x} x={x} y={11} width={4} height={15} fill={c} opacity={0.85} />)}</g>
        if (id === 'piled-raft') return <g><rect x={5} y={7} width={34} height={7} fill={c} />{[12, 21, 30].map((x) => <rect key={x} x={x} y={14} width={3.5} height={12} fill={c} opacity={0.8} />)}</g>
        if (id === 'raft') return <rect x={5} y={12} width={34} height={9} fill={c} />
        return <g><rect x={18} y={6} width={8} height={10} fill={c} /><rect x={10} y={16} width={24} height={8} fill={c} /></g>
      }
      case 'stair': return <g fill={c}>{[0, 1, 2, 3].map((i) => <rect key={i} x={7 + i * 8} y={24 - i * 6} width={8} height={4} />)}{id === 'feature-steel' && <line x1={7} y1={27} x2={39} y2={5} stroke="#46506b" strokeWidth={1.6} />}</g>
      case 'slab': return <g><rect x={4} y={12} width={36} height={8} fill={c} />{id === 'composite' && <path d="M4 20 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" stroke={c} strokeWidth={1.6} fill="none" />}{id === 'pt-flat' && <path d="M5 18 Q 22 12 39 18" stroke={BG} strokeWidth={1.2} fill="none" opacity={0.7} strokeDasharray="3 2" />}{id === 'clt' && [15, 17.5].map((y) => <line key={y} x1={4} y1={y} x2={40} y2={y} stroke={BG} strokeWidth={0.8} opacity={0.5} />)}</g>
      case 'core': {
        if (id === 'steel-braced') return <g><rect x={10} y={5} width={24} height={22} fill="none" stroke={c} strokeWidth={2} /><path d="M10 5 L34 27 M34 5 L10 27" stroke={c} strokeWidth={1.6} /></g>
        return <g><rect x={10} y={5} width={24} height={22} fill={c} /><rect x={17} y={12} width={10} height={8} fill={BG} opacity={0.5} /></g>
      }
      case 'mullion': return <g>{[10, 22, 34].map((x) => <rect key={x} x={x - 1.5} y={4} width={id === 'timber-fin' ? 4 : 3} height={24} fill={c} rx={id === 'timber-fin' ? 1.5 : 0} />)}{id === 'steel-fin' && [10, 22, 34].map((x) => <rect key={x} x={x - 0.7} y={4} width={1.4} height={24} fill="#1d2532" />)}</g>
      case 'balustrade': {
        if (id === 'glass') return <g><rect x={5} y={10} width={34} height={16} fill={c} opacity={0.4} /><rect x={5} y={8} width={34} height={2.4} fill="#aebccd" /></g>
        if (id === 'steel-rail') return <g><rect x={5} y={8} width={34} height={2.4} fill={c} />{[9, 15, 21, 27, 33].map((x) => <line key={x} x1={x} y1={10} x2={x} y2={26} stroke={c} strokeWidth={1.2} />)}</g>
        return <g><rect x={5} y={10} width={34} height={16} fill={c} /><rect x={4} y={8} width={36} height={2.6} fill="#b9c3d1" /></g>
      }
      default: return <rect x={8} y={8} width={28} height={16} fill={c} opacity={op} />
    }
  }

  return (
    <svg width={W} height={H} viewBox="0 0 44 32" aria-hidden className="rounded bg-[#0b1322]">
      {motif()}
    </svg>
  )
}
