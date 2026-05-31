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

/* ---- portable export / import / share ---------------------------------------
 * Scenarios can leave a browser two ways: a downloadable JSON bundle (one or
 * many), and a compact url-safe share token for a single scenario. Imports are
 * defensive — malformed entries are dropped, ids are regenerated to avoid
 * collisions, and a target module can be enforced so a Cost scenario never
 * lands in the Carbon workbench. */

const BUNDLE_KIND = 'aec.scenario.bundle.v1'
export type ScenarioBundle = { kind: typeof BUNDLE_KIND; exportedAt: string; scenarios: Scenario[] }

/** Serialize one or more scenarios to a pretty JSON bundle for download. */
export function exportBundle(scenarios: Scenario[]): string {
  const bundle: ScenarioBundle = { kind: BUNDLE_KIND, exportedAt: new Date().toISOString(), scenarios }
  return JSON.stringify(bundle, null, 2)
}

/** Parse a bundle (or a bare scenario / array) back into scenarios. Never throws. */
export function importBundle(raw: string): Scenario[] {
  let v: unknown
  try { v = JSON.parse(raw) } catch { return [] }
  const candidates: unknown[] =
    Array.isArray(v) ? v
    : v && typeof v === 'object' && Array.isArray((v as ScenarioBundle).scenarios) ? (v as ScenarioBundle).scenarios
    : v && typeof v === 'object' ? [v]
    : []
  return candidates.filter(isScenario)
}

const b64encode = (s: string): string => {
  const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')
  return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const b64decode = (s: string): string => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary')
  try { return decodeURIComponent(escape(raw)) } catch { return raw }
}

/** Encode a single scenario to a compact, url-safe share token. */
export function encodeScenarioToken(s: Scenario): string {
  return b64encode(JSON.stringify(s))
}

/** Decode a share token back to a scenario, or null if invalid. */
export function decodeScenarioToken(token: string): Scenario | null {
  try {
    const v: unknown = JSON.parse(b64decode(token))
    return isScenario(v) ? (v as Scenario) : null
  } catch {
    return null
  }
}

/** Prepare an imported scenario for adoption: fresh id, optional module override. */
export function adoptScenario(s: Scenario, opts: { module?: string } = {}): Scenario {
  return {
    ...s,
    id: `scn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    module: opts.module ?? s.module,
    createdAt: new Date().toISOString(),
  }
}
