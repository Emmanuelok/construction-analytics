/* Families & types — the element catalog, like a CAD family tree. Pure data +
 * lookups, unit-tested. Every critical building category carries multiple real
 * alternatives (types) with engineering properties: section/material for structure
 * (drives the gravity check), U-values for the envelope (drives the energy model),
 * build-up rates for costing, fire ratings, and a render colour/shape for the 3D
 * viewer. Selecting a type re-derives everything downstream. Indicative catalog
 * figures — tunable assumptions, not certification. */

export type FamilyType = {
  id: string
  label: string
  material: string
  cost: number // $/unit noted in `unit`
  unit: string
  props: Record<string, number | string>
  color?: string // viewer override
  shape?: 'box' | 'cylinder' // structural section render
  opacity?: number // façade/glazing render
}
export type FamilyCategory = { key: string; label: string; unit: string; types: FamilyType[] }

export const FAMILIES: FamilyCategory[] = [
  {
    key: 'column', label: 'Columns', unit: 'ea', types: [
      { id: 'rc-square', label: 'RC square 400', material: 'C32/40 concrete', cost: 410, unit: 'm', props: { fcMPa: 32, sizeFactor: 1, fire: 'R120' }, color: '#64748b', shape: 'box' },
      { id: 'rc-round', label: 'RC circular Ø450', material: 'C40/50 concrete', cost: 455, unit: 'm', props: { fcMPa: 40, sizeFactor: 1.06, fire: 'R120' }, color: '#6b7689', shape: 'cylinder' },
      { id: 'steel-uc', label: 'Steel UC 305×305', material: 'S355 steel', cost: 520, unit: 'm', props: { fcMPa: 88, sizeFactor: 0.76, fire: 'R60 (intumescent)' }, color: '#7d8aa3', shape: 'box' },
      { id: 'cft', label: 'Concrete-filled tube Ø400', material: 'S355 + C40 infill', cost: 610, unit: 'm', props: { fcMPa: 64, sizeFactor: 0.9, fire: 'R90' }, color: '#5c6e8e', shape: 'cylinder' },
      { id: 'precast-col', label: 'Precast column 400', material: 'C50/60 precast', cost: 470, unit: 'm', props: { fcMPa: 50, sizeFactor: 0.95, fire: 'R120' }, color: '#8e98a8', shape: 'box' },
      { id: 'glulam-col', label: 'Glulam column 360', material: 'GL28h timber', cost: 560, unit: 'm', props: { fcMPa: 24, sizeFactor: 1.15, fire: 'R60 (char)' }, color: '#9b7c52', shape: 'box' },
    ],
  },
  {
    key: 'beam', label: 'Beams', unit: 'ea', types: [
      { id: 'rc-band', label: 'RC band beam', material: 'C32/40 concrete', cost: 360, unit: 'm', props: { fcMPa: 32, depthFactor: 1, fire: 'R120' }, color: '#566173' },
      { id: 'steel-ub', label: 'Steel UB 457×191', material: 'S355 steel', cost: 470, unit: 'm', props: { fcMPa: 75, depthFactor: 0.85, fire: 'R60 (board)' }, color: '#76839c' },
      { id: 'pt-band', label: 'Post-tensioned band', material: 'C40/50 + PT', cost: 520, unit: 'm', props: { fcMPa: 52, depthFactor: 0.78, fire: 'R120' }, color: '#4e5a6e' },
      { id: 'glulam', label: 'Glulam GL28', material: 'Engineered timber', cost: 540, unit: 'm', props: { fcMPa: 22, depthFactor: 1.25, fire: 'R60 (char)' }, color: '#8a6f4a' },
    ],
  },
  {
    key: 'facade', label: 'Façade system', unit: 'm²', types: [
      { id: 'curtain', label: 'Unitised curtain wall', material: 'Alu + DGU', cost: 980, unit: 'm²', props: { uWall: 0.3, fire: 'EI60 spandrel' }, color: '#9aa7b8' },
      { id: 'brick', label: 'Brick cavity wall', material: 'Brick + block + PIR', cost: 620, unit: 'm²', props: { uWall: 0.22, fire: 'EI120' }, color: '#9c7860' },
      { id: 'precast', label: 'Precast sandwich panel', material: 'RC + PIR core', cost: 700, unit: 'm²', props: { uWall: 0.24, fire: 'EI120' }, color: '#aab3bf' },
      { id: 'rainscreen', label: 'Metal rain-screen', material: 'Alu cassette + SFS', cost: 760, unit: 'm²', props: { uWall: 0.26, fire: 'EI60 (A2 cladding)' }, color: '#7e8b9d' },
      { id: 'gfrc', label: 'GFRC panel', material: 'Glass-fibre concrete', cost: 840, unit: 'm²', props: { uWall: 0.25, fire: 'A1' }, color: '#b6b0a4' },
      { id: 'timber-clad', label: 'Timber rain-screen', material: 'Thermo-pine + SFS', cost: 690, unit: 'm²', props: { uWall: 0.24, fire: 'B (treated)' }, color: '#8a6b48' },
    ],
  },
  {
    key: 'glazing', label: 'Glazing', unit: 'm²', types: [
      { id: 'dgu', label: 'Double glazed (DGU low-E)', material: '6/16Ar/6 low-E', cost: 540, unit: 'm²', props: { uWindow: 1.4, gValue: 0.4, lightTrans: 0.7 }, color: '#7dd3fc', opacity: 0.32 },
      { id: 'tgu', label: 'Triple glazed (TGU)', material: '6/12/6/12/6', cost: 760, unit: 'm²', props: { uWindow: 0.9, gValue: 0.35, lightTrans: 0.62 }, color: '#93dffc', opacity: 0.42 },
      { id: 'solar', label: 'Solar-control DGU', material: 'Selective coating', cost: 640, unit: 'm²', props: { uWindow: 1.3, gValue: 0.26, lightTrans: 0.55 }, color: '#67b8d8', opacity: 0.4 },
      { id: 'fritted', label: 'Fritted DGU (40% dot)', material: 'Ceramic frit', cost: 700, unit: 'm²', props: { uWindow: 1.4, gValue: 0.3, lightTrans: 0.5 }, color: '#a8c8d8', opacity: 0.5 },
      { id: 'electrochromic', label: 'Electrochromic (dynamic)', material: 'EC-coated DGU', cost: 1450, unit: 'm²', props: { uWindow: 1.3, gValue: 0.12, lightTrans: 0.45 }, color: '#4f7ba6', opacity: 0.55 },
    ],
  },
  {
    key: 'door', label: 'Entrance doors', unit: 'ea', types: [
      { id: 'glazed-double', label: 'Glazed double swing', material: 'Alu framed', cost: 4200, unit: 'ea', props: { width: 1.8, fire: '—' }, color: '#1f2a3a' },
      { id: 'revolving', label: 'Revolving door', material: 'Alu + glass', cost: 28000, unit: 'ea', props: { width: 2.4, fire: '—' }, color: '#23304a' },
      { id: 'auto-slide', label: 'Automatic sliding', material: 'Alu + sensor', cost: 9800, unit: 'ea', props: { width: 2.0, fire: '—' }, color: '#1c2e44' },
    ],
  },
  {
    key: 'interiorDoor', label: 'Interior doors', unit: 'ea', types: [
      { id: 'timber-solid', label: 'Solid-core timber', material: 'Veneered timber', cost: 680, unit: 'ea', props: { fire: 'FD30', acoustic: 'Rw30' }, color: '#8a6f4a' },
      { id: 'timber-fd60', label: 'Fire door FD60', material: 'Timber + intumescent', cost: 1150, unit: 'ea', props: { fire: 'FD60', acoustic: 'Rw32' }, color: '#7a5f3e' },
      { id: 'glazed-office', label: 'Glazed office door', material: 'Framed glass', cost: 1320, unit: 'ea', props: { fire: '—', acoustic: 'Rw28' }, color: '#6f8ba6' },
      { id: 'steel-fire', label: 'Steel fire door', material: 'Galv. steel FD120', cost: 1680, unit: 'ea', props: { fire: 'FD120', acoustic: 'Rw35' }, color: '#5a6472' },
    ],
  },
  {
    key: 'partition', label: 'Partitions', unit: 'm²', types: [
      { id: 'stud', label: 'Gypsum stud 100', material: '2×12.5 gyp + stud', cost: 96, unit: 'm²', props: { fire: 'EI60', acoustic: 'Rw45' }, color: '#8e99ac' },
      { id: 'glazed', label: 'Glazed partition', material: 'Single glazed + film', cost: 290, unit: 'm²', props: { fire: '—', acoustic: 'Rw35' }, color: '#8fc6e8', opacity: 0.45 },
      { id: 'block', label: 'Blockwork 140', material: 'Dense block, painted', cost: 130, unit: 'm²', props: { fire: 'EI120', acoustic: 'Rw48' }, color: '#9aa0ab' },
      { id: 'acoustic', label: 'Acoustic stud 146', material: 'Double board + iso', cost: 150, unit: 'm²', props: { fire: 'EI60', acoustic: 'Rw55' }, color: '#84909f' },
      { id: 'demountable', label: 'Demountable system', material: 'Modular panels', cost: 240, unit: 'm²', props: { fire: '—', acoustic: 'Rw40' }, color: '#97a3b4' },
    ],
  },
  {
    key: 'floorFinish', label: 'Floor finishes', unit: 'm²', types: [
      { id: 'carpet', label: 'Carpet tile', material: 'Nylon loop 500×500', cost: 58, unit: 'm²', props: { slip: 'R9' }, color: '#cab27e' },
      { id: 'raised', label: 'Raised access + carpet', material: '600 grid + tile', cost: 145, unit: 'm²', props: { void: 150, slip: 'R9' }, color: '#bfa977' },
      { id: 'timber', label: 'Engineered timber', material: 'Oak 14 mm', cost: 165, unit: 'm²', props: { slip: 'R10' }, color: '#b08850' },
      { id: 'porcelain', label: 'Porcelain tile', material: '600×600 rectified', cost: 130, unit: 'm²', props: { slip: 'R10' }, color: '#cfd2c9' },
      { id: 'polished', label: 'Polished concrete', material: 'Power-floated + seal', cost: 85, unit: 'm²', props: { slip: 'R10' }, color: '#b9bdc4' },
      { id: 'terrazzo', label: 'Terrazzo', material: 'Poured + ground', cost: 240, unit: 'm²', props: { slip: 'R10' }, color: '#c8c2b4' },
      { id: 'resin', label: 'Epoxy resin', material: 'Self-levelling 4 mm', cost: 110, unit: 'm²', props: { slip: 'R11', chem: 'resistant' }, color: '#9aa8a0' },
    ],
  },
  {
    key: 'ceiling', label: 'Ceilings', unit: 'm²', types: [
      { id: 'mineral', label: 'Mineral fibre grid', material: '600×600 lay-in', cost: 62, unit: 'm²', props: { nrc: 0.7, fire: 'Class A' }, color: '#cfd6e2' },
      { id: 'gypsum', label: 'Gypsum flat (MF)', material: 'Jointed + painted', cost: 92, unit: 'm²', props: { nrc: 0.1, fire: 'Class A' }, color: '#dde1ea' },
      { id: 'metal-pan', label: 'Metal pan grid', material: 'Perforated steel', cost: 128, unit: 'm²', props: { nrc: 0.65, fire: 'A1' }, color: '#c2cad6' },
      { id: 'exposed', label: 'Exposed soffit', material: 'Painted slab + rafts', cost: 38, unit: 'm²', props: { nrc: 0.45, fire: '—' }, color: '#aab2bf' },
      { id: 'baffle', label: 'Timber baffle', material: 'Slatted oak veneer', cost: 165, unit: 'm²', props: { nrc: 0.8, fire: 'B-s1' }, color: '#a07a4e' },
    ],
  },
  {
    key: 'roof', label: 'Roof build-up', unit: 'm²', types: [
      { id: 'membrane', label: 'Warm roof membrane', material: 'PVC + PIR 150', cost: 210, unit: 'm²', props: { uRoof: 0.18 }, color: '#b8c2d0' },
      { id: 'green', label: 'Extensive green roof', material: 'Sedum + drainage', cost: 340, unit: 'm²', props: { uRoof: 0.16 }, color: '#7a9a6a' },
      { id: 'pv', label: 'PV-ready ballasted', material: 'Membrane + frames', cost: 410, unit: 'm²', props: { uRoof: 0.18, pvKwp: 0.12 }, color: '#5c6b85' },
      { id: 'terrace', label: 'Paved terrace', material: 'Pavers on pedestals', cost: 380, unit: 'm²', props: { uRoof: 0.18, access: 'amenity' }, color: '#9b9486' },
    ],
  },
  {
    key: 'foundation', label: 'Foundations', unit: 'ea', types: [
      { id: 'pads', label: 'Pad footings', material: 'C32/40', cost: 540, unit: 'm³', props: { bearing: 'good soil 200 kPa' }, color: '#3f4a5c' },
      { id: 'piles', label: 'CFA piles + caps', material: 'C32/40 Ø600', cost: 820, unit: 'm³', props: { bearing: 'soft soil / deep' }, color: '#44506b' },
      { id: 'raft', label: 'Raft slab', material: 'C32/40 600 thk', cost: 610, unit: 'm³', props: { bearing: 'uniform medium' }, color: '#48526a' },
      { id: 'piled-raft', label: 'Piled raft', material: 'Raft + settlement piles', cost: 760, unit: 'm³', props: { bearing: 'tall building / mixed' }, color: '#41507a' },
    ],
  },
  {
    key: 'stair', label: 'Stairs', unit: 'flight', types: [
      { id: 'rc', label: 'In-situ RC flight', material: 'C32/40', cost: 5200, unit: 'flight', props: { fire: 'R120' }, color: '#8a93a6' },
      { id: 'steel-pan', label: 'Steel pan + infill', material: 'S275 + concrete', cost: 6400, unit: 'flight', props: { fire: 'R60' }, color: '#9aa6bb' },
      { id: 'precast', label: 'Precast flight', material: 'C40/50', cost: 4700, unit: 'flight', props: { fire: 'R120' }, color: '#97a0b2' },
      { id: 'feature-steel', label: 'Feature steel + timber', material: 'Plate stringer + oak', cost: 11800, unit: 'flight', props: { fire: 'R30 (sprinklered)' }, color: '#7c6648' },
    ],
  },
  {
    key: 'slab', label: 'Floor slabs', unit: 'm²', types: [
      { id: 'rc-flat', label: 'RC flat slab 250', material: 'C32/40 in-situ', cost: 185, unit: 'm²', props: { span: '8 m', fire: 'R120' }, color: '#b8c2d0' },
      { id: 'pt-flat', label: 'PT flat slab 225', material: 'C40/50 + tendons', cost: 215, unit: 'm²', props: { span: '10 m', fire: 'R120' }, color: '#adb9c9' },
      { id: 'composite', label: 'Composite metal deck', material: 'Deck + 130 topping', cost: 168, unit: 'm²', props: { span: '3.6 m (sec.)', fire: 'R90 (board)' }, color: '#9aa5b6' },
      { id: 'clt', label: 'CLT panel 200', material: '5-ply spruce', cost: 245, unit: 'm²', props: { span: '7 m', fire: 'R60 (char)' }, color: '#a98a5e' },
    ],
  },
  {
    key: 'core', label: 'Core walls', unit: 'm²', types: [
      { id: 'rc-shear', label: 'RC shear walls 300', material: 'C40/50 jump-form', cost: 260, unit: 'm²', props: { system: 'shear wall', fire: 'R120' }, color: '#475569' },
      { id: 'steel-braced', label: 'Steel braced frame', material: 'S355 X-bracing + board', cost: 310, unit: 'm²', props: { system: 'braced', fire: 'R90 (board)' }, color: '#5d6c84' },
      { id: 'clt-core', label: 'CLT core 240', material: '7-ply + gypsum lining', cost: 295, unit: 'm²', props: { system: 'timber shear', fire: 'R90' }, color: '#8d7048' },
    ],
  },
  {
    key: 'mullion', label: 'Mullion profiles', unit: 'lm', types: [
      { id: 'alu-box', label: 'Alu box 60×150', material: 'PPC aluminium', cost: 96, unit: 'lm', props: { depth: 150 }, color: '#2b3647' },
      { id: 'steel-fin', label: 'Steel fin 60×220', material: 'PPC steel', cost: 145, unit: 'lm', props: { depth: 220 }, color: '#3a4350' },
      { id: 'timber-fin', label: 'Glulam fin 80×200', material: 'GL24 + UV oil', cost: 170, unit: 'lm', props: { depth: 200 }, color: '#8a6b44' },
    ],
  },
  {
    key: 'balustrade', label: 'Parapets & balustrades', unit: 'lm', types: [
      { id: 'upstand', label: 'Solid parapet upstand', material: 'RC + coping', cost: 210, unit: 'lm', props: { height: 1100 }, color: '#9aa7b8' },
      { id: 'glass', label: 'Frameless glass', material: '21.5 SGP laminated', cost: 540, unit: 'lm', props: { height: 1100 }, color: '#9cd2ef' },
      { id: 'steel-rail', label: 'Steel rail + mesh', material: 'PPC steel + mesh', cost: 290, unit: 'lm', props: { height: 1100 }, color: '#717e92' },
    ],
  },
]

export type TypeSelections = Record<string, string>
export const DEFAULT_TYPES: TypeSelections = Object.fromEntries(FAMILIES.map((f) => [f.key, f.types[0].id]))

export const familyCategory = (key: string): FamilyCategory | null => FAMILIES.find((f) => f.key === key) ?? null
/** Look up a type; falls back to the category's first (default) type. */
export function familyType(key: string, id?: string): FamilyType {
  const cat = familyCategory(key)
  if (!cat) return { id: 'none', label: '—', material: '—', cost: 0, unit: 'ea', props: {} }
  return cat.types.find((t) => t.id === id) ?? cat.types[0]
}
export const familyCount = (): number => FAMILIES.reduce((s, f) => s + f.types.length, 0)

/** Engineering hooks derived from a selection set (feeds energy + structure). */
export function engineeringFor(sel: TypeSelections): { uWall: number; uWindow: number; uRoof: number; fcColumn: number; fcBeam: number; colSizeFactor: number } {
  const fac = familyType('facade', sel.facade), gla = familyType('glazing', sel.glazing), roof = familyType('roof', sel.roof)
  const col = familyType('column', sel.column), beam = familyType('beam', sel.beam)
  return {
    uWall: Number(fac.props.uWall ?? 0.3), uWindow: Number(gla.props.uWindow ?? 1.8), uRoof: Number(roof.props.uRoof ?? 0.2),
    fcColumn: Number(col.props.fcMPa ?? 32), fcBeam: Number(beam.props.fcMPa ?? 32), colSizeFactor: Number(col.props.sizeFactor ?? 1),
  }
}

/** The family/type schedule (every category, every type, active flagged) — CSV. */
export function familiesCsv(sel: TypeSelections): string {
  const head = 'Category,Type,Material,Rate,Unit,Active,Properties'
  const rows = FAMILIES.flatMap((f) => f.types.map((t) => {
    const props = Object.entries(t.props).map(([k, v]) => `${k}=${v}`).join('; ')
    return `${f.label},${t.label},${t.material},${t.cost},${t.unit},${(sel[f.key] ?? f.types[0].id) === t.id ? 'YES' : ''},"${props}"`
  }))
  return [head, ...rows].join('\n')
}
