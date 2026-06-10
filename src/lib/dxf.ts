/* DXF drawing parser — pure, unit-tested. Reads the ENTITIES stream of an ASCII DXF
 * (the interchange format every CAD tool — AutoCAD, Revit (export DWG/DXF), Civil 3D,
 * BricsCAD — writes) into typed entities: LINE, LWPOLYLINE/POLYLINE, CIRCLE, ARC,
 * TEXT/MTEXT and INSERT (block references), each tagged with its layer. Computes the
 * drawing extents, per-layer counts + drawn length, and a takeoff CSV — so an uploaded
 * drawing becomes reviewable data, not a picture. Group-code line pairs are parsed
 * tolerantly (unknown codes skipped), so partial/odd exports still load. No DOM. */

export type DxfPt = { x: number; y: number }
export type DxfEntity =
  | { id: string; type: 'LINE'; layer: string; a: DxfPt; b: DxfPt }
  | { id: string; type: 'POLYLINE'; layer: string; pts: DxfPt[]; closed: boolean }
  | { id: string; type: 'CIRCLE'; layer: string; c: DxfPt; r: number }
  | { id: string; type: 'ARC'; layer: string; c: DxfPt; r: number; start: number; end: number }
  | { id: string; type: 'TEXT'; layer: string; p: DxfPt; h: number; text: string }
  | { id: string; type: 'INSERT'; layer: string; name: string; p: DxfPt }

export type DxfLayer = { name: string; count: number; length: number }
export type DxfDrawing = {
  entities: DxfEntity[]
  layers: DxfLayer[]
  counts: Record<string, number>
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
  totalLength: number
  units: string
}

const UNITS: Record<number, string> = { 0: 'unitless', 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' }

/** Drawn length of one entity (lines/polylines/arcs/circles). */
export function entityLength(e: DxfEntity): number {
  if (e.type === 'LINE') return Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y)
  if (e.type === 'POLYLINE') {
    let L = 0
    for (let i = 0; i < e.pts.length - 1; i++) L += Math.hypot(e.pts[i + 1].x - e.pts[i].x, e.pts[i + 1].y - e.pts[i].y)
    if (e.closed && e.pts.length > 2) L += Math.hypot(e.pts[0].x - e.pts[e.pts.length - 1].x, e.pts[0].y - e.pts[e.pts.length - 1].y)
    return L
  }
  if (e.type === 'CIRCLE') return 2 * Math.PI * e.r
  if (e.type === 'ARC') { let sweep = (e.end - e.start + 360) % 360; if (sweep === 0) sweep = 360; return (sweep / 180) * Math.PI * e.r }
  return 0
}

function extend(bb: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number) {
  bb.minX = Math.min(bb.minX, x); bb.maxX = Math.max(bb.maxX, x)
  bb.minY = Math.min(bb.minY, y); bb.maxY = Math.max(bb.maxY, y)
}

/** Parse an ASCII DXF into typed entities + per-layer takeoff. */
export function parseDxf(text: string): DxfDrawing {
  const lines = text.split(/\r\n|\r|\n/)
  const ENT = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'VERTEX', 'SEQEND', 'CIRCLE', 'ARC', 'TEXT', 'MTEXT', 'INSERT'])
  const entities: DxfEntity[] = []
  let n = 0
  let units = 'unitless'
  let i = 0
  let openPoly: { layer: string; pts: DxfPt[]; closed: boolean } | null = null // old-style POLYLINE/VERTEX

  // pull the next (code, value) pair
  const pairs: { code: number; value: string }[] = []
  while (i < lines.length - 1) {
    const code = Number(lines[i].trim())
    const value = lines[i + 1]
    i += 2
    if (!Number.isFinite(code)) continue
    pairs.push({ code, value: value ?? '' })
  }

  for (let p = 0; p < pairs.length; p++) {
    const { code, value } = pairs[p]
    if (code === 9 && value.trim() === '$INSUNITS') {
      const next = pairs[p + 1]
      if (next && next.code === 70) units = UNITS[Number(next.value)] ?? 'unitless'
      continue
    }
    if (code !== 0) continue
    const kind = value.trim().toUpperCase()
    if (!ENT.has(kind)) continue

    // collect this entity's codes (until the next 0)
    const xs: number[] = [], ys: number[] = []
    const v: Record<number, string> = {}
    let texts = ''
    for (let q = p + 1; q < pairs.length && pairs[q].code !== 0; q++) {
      const c = pairs[q].code, val = pairs[q].value
      if (c === 10) xs.push(Number(val))
      else if (c === 20) ys.push(Number(val))
      else if (c === 1 || c === 3) texts += val
      else v[c] = val
    }
    const layer = (v[8] ?? '0').trim() || '0'
    const id = `e${n}`
    const num = (c: number, d = 0) => { const x = Number(v[c]); return Number.isFinite(x) ? x : d }

    if (kind === 'LINE' && xs.length >= 1) {
      entities.push({ id, type: 'LINE', layer, a: { x: xs[0], y: ys[0] ?? 0 }, b: { x: num(11), y: num(21) } }); n++
    } else if (kind === 'LWPOLYLINE' && xs.length >= 2) {
      entities.push({ id, type: 'POLYLINE', layer, pts: xs.map((x, k) => ({ x, y: ys[k] ?? 0 })), closed: (num(70) & 1) === 1 }); n++
    } else if (kind === 'POLYLINE') {
      openPoly = { layer, pts: [], closed: (num(70) & 1) === 1 }
    } else if (kind === 'VERTEX' && openPoly && xs.length) {
      openPoly.pts.push({ x: xs[0], y: ys[0] ?? 0 })
    } else if (kind === 'SEQEND') {
      if (openPoly && openPoly.pts.length >= 2) { entities.push({ id, type: 'POLYLINE', layer: openPoly.layer, pts: openPoly.pts, closed: openPoly.closed }); n++ }
      openPoly = null
    } else if (kind === 'CIRCLE' && xs.length) {
      entities.push({ id, type: 'CIRCLE', layer, c: { x: xs[0], y: ys[0] ?? 0 }, r: num(40) }); n++
    } else if (kind === 'ARC' && xs.length) {
      entities.push({ id, type: 'ARC', layer, c: { x: xs[0], y: ys[0] ?? 0 }, r: num(40), start: num(50), end: num(51) }); n++
    } else if ((kind === 'TEXT' || kind === 'MTEXT') && xs.length) {
      entities.push({ id, type: 'TEXT', layer, p: { x: xs[0], y: ys[0] ?? 0 }, h: num(40, 2.5), text: texts.replace(/\\P/g, ' ').replace(/[{}]/g, '') }); n++
    } else if (kind === 'INSERT' && xs.length) {
      entities.push({ id, type: 'INSERT', layer, name: (v[2] ?? 'BLOCK').trim(), p: { x: xs[0], y: ys[0] ?? 0 } }); n++
    }
  }

  return summarize(entities, units)
}

/** Recompute layers/counts/bbox/length for an entity list (after a revision). */
export function summarize(entities: DxfEntity[], units = 'unitless'): DxfDrawing {
  const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const layerMap = new Map<string, { count: number; length: number }>()
  const counts: Record<string, number> = {}
  let totalLength = 0
  for (const e of entities) {
    counts[e.type] = (counts[e.type] ?? 0) + 1
    const L = entityLength(e)
    totalLength += L
    const cur = layerMap.get(e.layer) ?? { count: 0, length: 0 }
    layerMap.set(e.layer, { count: cur.count + 1, length: cur.length + L })
    if (e.type === 'LINE') { extend(bb, e.a.x, e.a.y); extend(bb, e.b.x, e.b.y) }
    else if (e.type === 'POLYLINE') for (const q of e.pts) extend(bb, q.x, q.y)
    else if (e.type === 'CIRCLE' || e.type === 'ARC') { extend(bb, e.c.x - e.r, e.c.y - e.r); extend(bb, e.c.x + e.r, e.c.y + e.r) }
    else if (e.type === 'TEXT') extend(bb, e.p.x, e.p.y)
    else if (e.type === 'INSERT') extend(bb, e.p.x, e.p.y)
  }
  if (!entities.length) { bb.minX = 0; bb.minY = 0; bb.maxX = 1; bb.maxY = 1 }
  const layers = [...layerMap.entries()].map(([name, v]) => ({ name, count: v.count, length: Math.round(v.length * 100) / 100 })).sort((a, b) => b.count - a.count)
  return { entities, layers, counts, bbox: bb, totalLength: Math.round(totalLength * 100) / 100, units }
}

/** Entity schedule CSV (the drawing as data). */
export function dxfCsv(d: DxfDrawing): string {
  const head = 'Id,Type,Layer,Length,Text / block'
  const rows = d.entities.map((e) => {
    const L = Math.round(entityLength(e) * 100) / 100
    const extra = e.type === 'TEXT' ? e.text : e.type === 'INSERT' ? e.name : ''
    return `${e.id},${e.type},${e.layer},${L},"${extra.replace(/"/g, '""')}"`
  })
  const lay = ['', 'LAYER,Entities,Drawn length', ...d.layers.map((l) => `${l.name},${l.count},${l.length}`)]
  return [head, ...rows, `TOTAL,${d.entities.length},,${d.totalLength},`, ...lay].join('\n')
}

/* A small but real sample plan (walls, grid, doors as arcs, column circles, labels)
 * so the drawing workbench demonstrates itself without a file. Units: metres. */
const L = (layer: string, x1: number, y1: number, x2: number, y2: number) => `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`
const Cc = (layer: string, x: number, y: number, r: number) => `0\nCIRCLE\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${r}\n`
const A = (layer: string, x: number, y: number, r: number, s: number, e: number) => `0\nARC\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${r}\n50\n${s}\n51\n${e}\n`
const T = (layer: string, x: number, y: number, h: number, t: string) => `0\nTEXT\n8\n${layer}\n10\n${x}\n20\n${y}\n40\n${h}\n1\n${t}\n`
export const SAMPLE_DXF =
  '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n' +
  // outer walls (closed polyline) + internal walls
  '0\nLWPOLYLINE\n8\nA-WALL\n90\n4\n70\n1\n10\n0\n20\n0\n10\n24\n20\n0\n10\n24\n20\n14\n10\n0\n20\n14\n' +
  L('A-WALL', 9, 0, 9, 5.4) + L('A-WALL', 9, 6.6, 9, 14) + L('A-WALL', 16, 0, 16, 8.6) + L('A-WALL', 16, 9.8, 16, 14) + L('A-WALL', 9, 8, 16, 8) +
  // doors (leaf + swing arc)
  L('A-DOOR', 9, 5.4, 10.1, 5.4) + A('A-DOOR', 9, 5.4, 1.2, 270, 0) +
  L('A-DOOR', 16, 8.6, 17.1, 8.6) + A('A-DOOR', 16, 8.6, 1.2, 270, 0) +
  // column grid
  Cc('S-COL', 0, 0, 0.25) + Cc('S-COL', 8, 0, 0.25) + Cc('S-COL', 16, 0, 0.25) + Cc('S-COL', 24, 0, 0.25) +
  Cc('S-COL', 0, 7, 0.25) + Cc('S-COL', 8, 7, 0.25) + Cc('S-COL', 16, 7, 0.25) + Cc('S-COL', 24, 7, 0.25) +
  Cc('S-COL', 0, 14, 0.25) + Cc('S-COL', 8, 14, 0.25) + Cc('S-COL', 16, 14, 0.25) + Cc('S-COL', 24, 14, 0.25) +
  // gridlines + labels
  L('G-GRID', 0, -1.5, 0, 15.5) + L('G-GRID', 8, -1.5, 8, 15.5) + L('G-GRID', 16, -1.5, 16, 15.5) + L('G-GRID', 24, -1.5, 24, 15.5) +
  T('A-ANNO', 3.4, 7, 0.5, 'OFFICE 01') + T('A-ANNO', 11.6, 3.2, 0.5, 'MEETING') + T('A-ANNO', 11.6, 10.8, 0.5, 'OFFICE 02') + T('A-ANNO', 19.2, 7, 0.5, 'OPEN PLAN') +
  '0\nINSERT\n8\nP-SANR\n2\nWC-SUITE\n10\n21.5\n20\n12.5\n' +
  '0\nENDSEC\n0\nEOF\n'
