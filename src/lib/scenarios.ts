/* Saved-scenario model — pure, unit-tested. A scenario is a named snapshot of a
 * workbench's editable state plus the numeric KPIs it produced, so users can
 * save their work, reload it later, and compare two scenarios side by side
 * (baseline vs optimized). Persistence (localStorage / Supabase) lives in the
 * store hook; this module is just the data model + operations + diff. */

export type KPI = { label: string; value: number; unit?: string }

export type Scenario = {
  id: string
  module: string // which workbench (e.g. 'cost-schedule')
  name: string
  createdAt: string // ISO
  data: unknown // page-specific editable snapshot, restored verbatim
  summary: KPI[] // numeric KPIs captured at save time, for compare
}

const round = (n: number, d = 2) => { const m = 10 ** d; return Math.round(n * m) / m }

export function makeScenario(module: string, name: string, data: unknown, summary: KPI[]): Scenario {
  return {
    id: `scn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    module,
    name: name.trim() || 'Untitled scenario',
    createdAt: new Date().toISOString(),
    data,
    summary,
  }
}

/** Insert or replace by id (newest first when inserting). */
export function upsert(list: Scenario[], s: Scenario): Scenario[] {
  const i = list.findIndex((x) => x.id === s.id)
  if (i === -1) return [s, ...list]
  const next = [...list]
  next[i] = s
  return next
}

export function removeById(list: Scenario[], id: string): Scenario[] {
  return list.filter((x) => x.id !== id)
}

export function renameScenario(list: Scenario[], id: string, name: string): Scenario[] {
  return list.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x))
}

/** Scenarios for one module, newest first. */
export function forModule(list: Scenario[], module: string): Scenario[] {
  return list.filter((x) => x.module === module).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type KPIDiff = { label: string; a: number; b: number; delta: number; pctDelta: number; unit?: string }

/** Diff two scenarios' KPIs by label (delta = b − a). */
export function diff(a: Scenario, b: Scenario): KPIDiff[] {
  const bMap = new Map(b.summary.map((k) => [k.label, k]))
  return a.summary
    .filter((k) => bMap.has(k.label))
    .map((ka) => {
      const kb = bMap.get(ka.label)!
      const delta = round(kb.value - ka.value)
      const pctDelta = ka.value !== 0 ? round((delta / Math.abs(ka.value)) * 100, 1) : 0
      return { label: ka.label, a: ka.value, b: kb.value, delta, pctDelta, unit: ka.unit }
    })
}

function isScenario(x: unknown): x is Scenario {
  const s = x as Scenario
  return !!s && typeof s.id === 'string' && typeof s.module === 'string' && typeof s.name === 'string' && Array.isArray(s.summary)
}

/** Parse persisted JSON defensively — never throws, drops malformed entries. */
export function parseScenarios(raw: string | null): Scenario[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter(isScenario) : []
  } catch {
    return []
  }
}
