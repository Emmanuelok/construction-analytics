/* 4D construction sequencing — pure, unit-tested. Phases the building floor-by-floor
 * across three trade crews (structure → envelope → fit-out) that each move up one
 * storey at a time, with the upper trades trailing the structure. Produces, per floor,
 * the start/end day-offset of each phase plus calendar dates, and the overall duration
 * and completion date — feeding a Gantt and the model's 4D progress view. Assumptions
 * (days/floor, lags) are tunable. No DOM, no engines beyond the model counts. */

import type { BuildingModel } from './building'

export type Phase = { start: number; end: number } // working-day offsets from project start
export type FloorSchedule = { level: number; name: string; structure: Phase; envelope: Phase; fitout: Phase; start: number; end: number; startDate: string; endDate: string }
export type Schedule4dOpts = { start?: string; structureDaysPerFloor?: number; envelopeDaysPerFloor?: number; fitoutDaysPerFloor?: number }
export type Schedule4dResult = { floors: FloorSchedule[]; totalDays: number; weeks: number; startDate: string; finishDate: string; phases: { name: string; color: string }[] }

const iso = (d: Date) => d.toISOString().slice(0, 10)
/** Add working days (Mon–Fri) to a date → a calendar date. */
function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start)
  let left = Math.round(days)
  while (left > 0) { d.setDate(d.getDate() + 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) left-- }
  return d
}

/** Build the floor-by-floor construction sequence. */
export function schedule4d(m: BuildingModel, opts: Schedule4dOpts = {}): Schedule4dResult {
  const storeys = Math.max(1, m.counts.storeys)
  const sD = Math.max(1, opts.structureDaysPerFloor ?? 12)
  const eD = Math.max(1, opts.envelopeDaysPerFloor ?? 8)
  const fD = Math.max(1, opts.fitoutDaysPerFloor ?? 10)
  const start = opts.start ? new Date(opts.start) : new Date()
  const levelName = (i: number) => (i === 0 ? 'Ground' : `Level ${i}`)

  const floors: FloorSchedule[] = []
  for (let L = 0; L < storeys; L++) {
    const prev = floors[L - 1]
    // each crew moves up sequentially; an upper trade can't pass the one below it on the same floor
    const structure: Phase = { start: prev ? prev.structure.end : 0, end: 0 }
    structure.end = structure.start + sD
    const envelope: Phase = { start: Math.max(structure.end, prev ? prev.envelope.end : 0), end: 0 }
    envelope.end = envelope.start + eD
    const fitout: Phase = { start: Math.max(envelope.end, prev ? prev.fitout.end : 0), end: 0 }
    fitout.end = fitout.start + fD
    floors.push({
      level: L, name: levelName(L), structure, envelope, fitout,
      start: structure.start, end: fitout.end,
      startDate: iso(addWorkingDays(start, structure.start)), endDate: iso(addWorkingDays(start, fitout.end)),
    })
  }
  const totalDays = floors.reduce((mx, f) => Math.max(mx, f.end), 0)
  return {
    floors, totalDays, weeks: Math.ceil(totalDays / 5),
    startDate: iso(start), finishDate: iso(addWorkingDays(start, totalDays)),
    phases: [{ name: 'Structure', color: '#64748b' }, { name: 'Envelope', color: '#38bdf8' }, { name: 'Fit-out', color: '#34d399' }],
  }
}
