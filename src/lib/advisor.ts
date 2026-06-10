/* Cross-phase AI advisor — pure, unit-tested. Runs every analytical engine over the
 * current building (egress + code, structure, energy/daylight, fire, 4D programme,
 * plan efficiency), turns the results into prioritized findings, and — where a fix is
 * machine-applicable — attaches a concrete action (set WWR, add an egress stair,
 * strengthen a column, deepen a beam, switch footprint…) the UI applies in one click.
 * Findings are re-ranked for the signed-in person's role, so an architect, a
 * structural engineer and a cost manager each see *their* problems first. Pure rules
 * over deterministic engines — fast, explainable, no LLM, no DOM. */

import type { BuildingModel } from './building'
import { egressAnalysis } from './egress'
import { structuralCheck } from './structure'
import { energyAnalysis } from './energy'
import { buildingFire } from './fire'
import { schedule4d } from './schedule4d'
import { explodeBuilding } from './building-explorer'
import { stairCheck } from './building-stairs'
import { CODE_PRESETS, type CodeKey } from './building-code'

export type AdvisorPhase = 'Plan' | 'Design' | 'Structure' | 'Life safety' | 'Sustainability' | 'Construction'
export type Severity = 'critical' | 'warning' | 'info' | 'good'

export type AdvisorAction =
  | { kind: 'set-wwr'; value: number }
  | { kind: 'set-shape'; value: string }
  | { kind: 'add-stair' }
  | { kind: 'strengthen-column'; id: string; factor: number }
  | { kind: 'deepen-beam'; id: string; factor: number }
  | { kind: 'set-code'; value: CodeKey }

export type Finding = {
  id: string
  phase: AdvisorPhase
  severity: Severity
  title: string
  detail: string
  metric?: string
  action?: AdvisorAction & { label: string }
}

export type PhaseStatus = { phase: AdvisorPhase; status: Severity; headline: string }
export type AdvisorReport = {
  findings: Finding[]
  score: number // 0–100 composite health of the design
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  phases: PhaseStatus[]
  counts: { critical: number; warning: number; good: number }
}

export type AdvisorInput = { model: BuildingModel; storeyHeight?: number; code?: CodeKey; wwr?: number }

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 }
// which phases each role cares about most — drives the personalized ordering
const ROLE_PHASES: Record<string, AdvisorPhase[]> = {
  Architect: ['Design', 'Plan', 'Sustainability', 'Life safety'],
  'Structural Engineer': ['Structure', 'Life safety', 'Design'],
  'MEP Engineer': ['Sustainability', 'Design', 'Life safety'],
  Contractor: ['Construction', 'Structure', 'Life safety'],
  Developer: ['Plan', 'Construction', 'Sustainability'],
  'Cost Manager': ['Construction', 'Plan', 'Structure'],
  'Sustainability Lead': ['Sustainability', 'Design', 'Plan'],
  'Facilities / Owner': ['Life safety', 'Sustainability', 'Construction'],
}

const PHASES: AdvisorPhase[] = ['Plan', 'Design', 'Structure', 'Life safety', 'Sustainability', 'Construction']

/** Run every engine and produce the prioritized, role-aware advisory report. */
export function adviseBuilding(input: AdvisorInput, persona: { role?: string } = {}): AdvisorReport {
  const m = input.model
  const sh = input.storeyHeight ?? 3.6
  const code = input.code ?? 'IBC'
  const wwr = input.wwr ?? 0.55
  const f: Finding[] = []

  // ---- Plan: floor-plate efficiency ----
  const ex = explodeBuilding(m, { storeyHeight: sh, code })
  const eff = ex.summary.gfa > 0 ? ex.summary.netArea / ex.summary.gfa : 0
  if (eff > 0 && eff < 0.6) f.push({ id: 'plan-eff', phase: 'Plan', severity: 'warning', title: 'Low net-to-gross efficiency', detail: `Usable rooms are ${Math.round(eff * 100)}% of gross area — a deep core or chunky grid is eating lettable space.`, metric: `${Math.round(eff * 100)}% net:gross` })
  else if (eff > 0) f.push({ id: 'plan-eff', phase: 'Plan', severity: 'good', title: 'Healthy floor-plate efficiency', detail: `Usable rooms are ${Math.round(eff * 100)}% of gross area.`, metric: `${Math.round(eff * 100)}% net:gross` })

  // ---- Life safety: routed egress under the active code ----
  const eg = egressAnalysis(m, { code })
  const worst = eg.floors.find((x) => !x.ok)
  if (eg.floors.length === 0 || eg.rooms.length === 0) {
    f.push({ id: 'egress-none', phase: 'Life safety', severity: 'info', title: 'No rooms to analyse', detail: 'The model has no interior rooms, so egress cannot be checked.' })
  } else if (eg.summary.ok) {
    f.push({ id: 'egress-ok', phase: 'Life safety', severity: 'good', title: `Egress compliant under ${CODE_PRESETS[code].label}`, detail: `Max travel ${eg.summary.maxTravel} m of ${eg.summary.maxTravelLimit} m allowed; ${eg.summary.occupancy.toLocaleString()} occupants served.`, metric: `${eg.summary.maxTravel}/${eg.summary.maxTravelLimit} m` })
  } else {
    const needStair = eg.floors.some((x) => x.issues.some((i) => /exit|width|no exit/i.test(i)))
    f.push({
      id: 'egress-fail', phase: 'Life safety', severity: 'critical',
      title: `Egress fails on ${worst?.name ?? 'a floor'}`,
      detail: worst ? worst.issues.join('; ') : 'Means of escape below the code minimum.',
      metric: `${eg.summary.roomsOverTravel} rooms flagged`,
      action: needStair ? { kind: 'add-stair', label: 'Add an egress stair' } : undefined,
    })
  }
  // stair geometry under the code
  const badStair = m.stairs.map((s) => ({ s, c: stairCheck(s, sh, CODE_PRESETS[code].stair) })).find((x) => !x.c.ok)
  if (badStair) f.push({ id: 'stair-geom', phase: 'Life safety', severity: 'warning', title: 'Stair geometry off code', detail: `${badStair.s.id}: ${badStair.c.issues.join('; ')}.`, metric: `${Math.round(badStair.c.pitch)}° pitch` })

  // ---- Structure: gravity utilisation ----
  const st = structuralCheck(m, { storeyHeight: sh })
  if (st.columns.length) {
    const worstCol = [...st.columns].sort((a, b) => b.utilization - a.utilization)[0]
    if (st.summary.colOver > 0) {
      const factor = Math.min(1.8, Math.max(1.15, Math.sqrt(worstCol.utilization) * 1.06))
      f.push({ id: 'struct-col', phase: 'Structure', severity: 'critical', title: `${st.summary.colOver} column(s) overstressed`, detail: `Worst: ${worstCol.id} at ${Math.round(worstCol.utilization * 100)}% of axial capacity. Section needs upsizing (or add columns to cut tributary area).`, metric: `${Math.round(st.summary.maxColUtil * 100)}% util`, action: { kind: 'strengthen-column', id: worstCol.id, factor: Math.round(factor * 100) / 100, label: `Upsize ${worstCol.id} ×${factor.toFixed(2)}` } })
    } else if (st.summary.maxColUtil > 0.85) {
      f.push({ id: 'struct-col', phase: 'Structure', severity: 'warning', title: 'Columns near capacity', detail: `Peak axial utilisation ${Math.round(st.summary.maxColUtil * 100)}% (${worstCol.id}). Fine for a scheme, tight for design development.`, metric: `${Math.round(st.summary.maxColUtil * 100)}% util`, action: { kind: 'strengthen-column', id: worstCol.id, factor: 1.2, label: `Upsize ${worstCol.id} ×1.20` } })
    } else {
      f.push({ id: 'struct-col', phase: 'Structure', severity: 'good', title: 'Gravity structure within capacity', detail: `Peak column utilisation ${Math.round(st.summary.maxColUtil * 100)}%; total gravity load ${st.summary.totalGravity.toLocaleString()} kN.`, metric: `${Math.round(st.summary.maxColUtil * 100)}% util` })
    }
    const worstBeam = [...st.beams].sort((a, b) => b.utilization - a.utilization)[0]
    if (worstBeam && st.summary.beamOver > 0) {
      const factor = Math.min(1.8, Math.max(1.15, Math.sqrt(worstBeam.utilization) * 1.06))
      f.push({ id: 'struct-beam', phase: 'Structure', severity: 'critical', title: `${st.summary.beamOver} beam(s) over moment capacity`, detail: `Worst: ${worstBeam.id} at ${Math.round(worstBeam.utilization * 100)}%.`, metric: `${Math.round(st.summary.maxBeamUtil * 100)}% util`, action: { kind: 'deepen-beam', id: worstBeam.id, factor: Math.round(factor * 100) / 100, label: `Deepen ${worstBeam.id} ×${factor.toFixed(2)}` } })
    }
  }

  // ---- Sustainability: energy + daylight ----
  const en = energyAnalysis(m, { storeyHeight: sh })
  if (en.summary.eui > 0) {
    if (en.summary.rating >= 'D') {
      const target = Math.max(0.3, Math.round((wwr - 0.15) * 20) / 20)
      f.push({ id: 'energy-eui', phase: 'Sustainability', severity: 'warning', title: `Energy intensity rated ${en.summary.rating}`, detail: `${en.summary.eui} kWh/m²·yr with ${Math.round(en.summary.wwr * 100)}% glazing. Cutting the window-to-wall ratio trims both heat loss and solar gain.`, metric: `${en.summary.eui} kWh/m²`, action: wwr > 0.35 ? { kind: 'set-wwr', value: target, label: `Set glazing to ${Math.round(target * 100)}%` } : undefined })
    } else {
      f.push({ id: 'energy-eui', phase: 'Sustainability', severity: 'good', title: `Energy intensity rated ${en.summary.rating}`, detail: `${en.summary.eui} kWh/m²·yr — envelope performing well.`, metric: `${en.summary.eui} kWh/m²` })
    }
    const darkShare = en.rooms.length ? en.summary.darkRooms / en.rooms.length : 0
    if (darkShare > 0.35) f.push({ id: 'daylight', phase: 'Design', severity: 'warning', title: `${en.summary.darkRooms} rooms have little daylight`, detail: `${Math.round(darkShare * 100)}% of rooms sit deep in the plan. A courtyard or atrium footprint brings light to the middle.`, metric: `${en.summary.darkRooms} dark rooms`, action: { kind: 'set-shape', value: 'court', label: 'Switch to a courtyard plan' } })
    else f.push({ id: 'daylight', phase: 'Design', severity: 'good', title: 'Daylight reaches most rooms', detail: `${en.summary.daylitRooms} of ${en.rooms.length} rooms meet the daylight proxy.`, metric: `${en.summary.daylitRooms}/${en.rooms.length} daylit` })
  }

  // ---- Fire compartmentation budget ----
  const lim = CODE_PRESETS[code].egress
  const fire = buildingFire(m, { maxArea: lim.maxCompartment, occLoadFactor: lim.occLoadFactor })
  if (fire.compartments > 0) f.push({ id: 'fire', phase: 'Life safety', severity: 'info', title: `${fire.compartments} fire compartments required`, detail: `${Math.round(fire.ratedWall).toLocaleString()} m of fire-rated wall under ${CODE_PRESETS[code].label}; indicative fit-out $${fire.cost.toLocaleString()}.`, metric: `${Math.round(fire.ratedWall).toLocaleString()} m rated wall` })

  // ---- Construction programme ----
  const s4 = schedule4d(m, {})
  f.push({ id: 'programme', phase: 'Construction', severity: 'info', title: `${s4.weeks}-week programme`, detail: `Structure → envelope → fit-out crews top out ${m.counts.storeys} storeys by ${s4.finishDate} (${s4.totalDays} working days).`, metric: `${s4.weeks} wks` })

  // ---- compose: score, grade, phases, personalized order ----
  const counts = { critical: f.filter((x) => x.severity === 'critical').length, warning: f.filter((x) => x.severity === 'warning').length, good: f.filter((x) => x.severity === 'good').length }
  const score = Math.max(0, Math.min(100, 100 - counts.critical * 18 - counts.warning * 7))
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'E'

  const phases: PhaseStatus[] = PHASES.map((phase) => {
    const inPhase = f.filter((x) => x.phase === phase)
    const status: Severity = inPhase.some((x) => x.severity === 'critical') ? 'critical' : inPhase.some((x) => x.severity === 'warning') ? 'warning' : inPhase.some((x) => x.severity === 'good') ? 'good' : 'info'
    const lead = [...inPhase].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])[0]
    return { phase, status, headline: lead ? lead.title : 'No checks for this phase yet' }
  })

  const pref = ROLE_PHASES[persona.role ?? ''] ?? []
  const affinity = (ph: AdvisorPhase) => { const i = pref.indexOf(ph); return i === -1 ? pref.length : i }
  const findings = [...f].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || affinity(a.phase) - affinity(b.phase))

  return { findings, score, grade, phases, counts }
}

/** The single next best action for a person — the most urgent finding their role
 *  cares about that has a one-click fix (else the most urgent overall). */
export function nextBestAction(report: AdvisorReport): Finding | null {
  return report.findings.find((x) => x.action && x.severity !== 'good') ?? report.findings.find((x) => x.severity === 'critical' || x.severity === 'warning') ?? null
}
