/* Preliminary structural check — pure, unit-tested. From the model's column grid and
 * edge beams it estimates gravity demand and compares it to a simple RC capacity:
 * per column an axial load from its tributary floor area × the loads × the floors above,
 * vs 0.4·f'c·Ag; per beam a UDL from its tributary strip → mid-span moment wL²/8 vs the
 * singly-reinforced limit 0.138·f'c·b·d². Reports utilisation + a pass/flag per element.
 * Design-stage sizing only (not a designed/reinforced structure). Scene units → metres
 * via the plan scale + storey height. No DOM, no Three.js. */

import type { BuildingModel } from './building'
import { SCENE_LEN_TO_M } from './massing'
import { polygonArea } from './zoning'

const LEN = SCENE_LEN_TO_M
const AREA = LEN * LEN
const r2 = (n: number) => Math.round(n * 100) / 100
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(b.x - a.x, b.z - a.z)

export type StructOpts = { storeyHeight?: number; deadLoad?: number; liveLoad?: number; fc?: number } // kPa, kPa, MPa
export type ColumnLoad = { id: string; level: number; section: number; tributary: number; floorsAbove: number; axial: number; capacity: number; utilization: number; ok: boolean }
export type BeamLoad = { id: string; level: number; span: number; depth: number; width: number; udl: number; moment: number; capacity: number; utilization: number; ok: boolean }
export type StructResult = {
  loads: { dead: number; live: number; total: number; fc: number }
  columns: ColumnLoad[]
  beams: BeamLoad[]
  summary: { maxColUtil: number; maxBeamUtil: number; colOver: number; beamOver: number; totalGravity: number; ok: boolean; worst: string }
}

/** Estimate gravity demand vs RC capacity for every column + edge beam. */
export function structuralCheck(m: BuildingModel, opts: StructOpts = {}): StructResult {
  const sh = Math.max(0.1, opts.storeyHeight ?? 3.6)
  const dead = opts.deadLoad ?? 5.5 // kPa (slab + finishes + services)
  const live = opts.liveLoad ?? 3.0 // kPa (office)
  const total = dead + live
  const fcMPa = opts.fc ?? 32
  const fc = fcMPa * 1000 // kPa
  const storeys = m.counts.storeys

  // floor areas + per-level column/beam tallies (for tributary shares)
  const floorArea: Record<number, number> = {}
  for (const s of m.slabs) floorArea[s.level ?? 0] = polygonArea(s.polygon) * AREA
  const colCount: Record<number, number> = {}
  for (const c of m.columns) colCount[c.level ?? 0] = (colCount[c.level ?? 0] ?? 0) + 1
  const beamSpan: Record<number, number> = {}
  for (const b of m.beams) beamSpan[b.level ?? 0] = (beamSpan[b.level ?? 0] ?? 0) + dist(b.a, b.b) * LEN

  const columns: ColumnLoad[] = m.columns.map((c) => {
    const level = c.level ?? 0
    const tributary = (floorArea[level] ?? 0) / Math.max(1, colCount[level] ?? 1)
    const floorsAbove = Math.max(1, storeys - level) // this storey + everything above
    const axial = tributary * total * floorsAbove // kN
    const ag = c.w * LEN * (c.d * LEN) // m²
    const capacity = 0.4 * fc * ag // kN
    const utilization = capacity > 0 ? axial / capacity : 0
    return { id: c.id ?? '', level, section: r2(c.w * LEN), tributary: r2(tributary), floorsAbove, axial: Math.round(axial), capacity: Math.round(capacity), utilization: r2(utilization), ok: utilization <= 1 + 1e-6 }
  })

  const beams: BeamLoad[] = m.beams.map((b) => {
    const level = b.level ?? 0
    const span = dist(b.a, b.b) * LEN
    const tribWidth = (floorArea[level] ?? 0) / Math.max(1, beamSpan[level] ?? 1) // strip carried per metre of beam
    const udl = tribWidth * total // kN/m
    const moment = (udl * span * span) / 8 // kNm
    const depth = b.depth * sh, width = 0.3 // m (beam web ~300 mm)
    const capacity = 0.138 * fc * width * depth * depth // kNm (RC limit moment)
    const utilization = capacity > 0 ? moment / capacity : 0
    return { id: b.id ?? '', level, span: r2(span), depth: r2(depth), width, udl: r2(udl), moment: Math.round(moment), capacity: Math.round(capacity), utilization: r2(utilization), ok: utilization <= 1 + 1e-6 }
  })

  const maxCol = columns.reduce((a, c) => (c.utilization > a.utilization ? c : a), columns[0] ?? ({ utilization: 0, id: '' } as ColumnLoad))
  const maxBeam = beams.reduce((a, b) => (b.utilization > a.utilization ? b : a), beams[0] ?? ({ utilization: 0, id: '' } as BeamLoad))
  const colOver = columns.filter((c) => !c.ok).length, beamOver = beams.filter((b) => !b.ok).length
  const totalGravity = Object.entries(floorArea).reduce((s, [lv, a]) => s + a * total * Math.max(1, storeys - Number(lv)), 0)
  return {
    loads: { dead, live, total, fc: fcMPa },
    columns, beams,
    summary: {
      maxColUtil: maxCol?.utilization ?? 0, maxBeamUtil: maxBeam?.utilization ?? 0, colOver, beamOver,
      totalGravity: Math.round(totalGravity),
      ok: colOver === 0 && beamOver === 0,
      worst: colOver || beamOver ? (maxCol.utilization >= maxBeam.utilization ? `Column ${maxCol.id} @ ${Math.round(maxCol.utilization * 100)}%` : `Beam ${maxBeam.id} @ ${Math.round(maxBeam.utilization * 100)}%`) : '—',
    },
  }
}
