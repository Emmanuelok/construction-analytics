import type { Accent } from '@/lib/nav'
import { num, profile, type ColumnProfile, type Table } from '@/lib/parse'
import { mean, pearson } from '@/lib/insights'

/* ============================================================================
 * Cross-dataset intelligence — finds relationships that span TWO datasets,
 * which no single-table analysis can see. It detects a shared dimension (a
 * categorical column whose values overlap across both datasets — e.g. region or
 * sector), aggregates a numeric measure from each dataset by that key, aligns on
 * the shared key values, and correlates the aligned group means. The result is a
 * bridged finding like "across region, cost_per_m2 and gwp move together
 * (r = 0.81)". Pure, deterministic, dependency-free — unit-tested.
 * ========================================================================== */

export type CrossDataset = { id: string; name: string; table: Table; cols: ColumnProfile[] }

export type JoinKey = {
  a: string // column name in dataset A
  b: string // column name in dataset B
  overlap: number // # of shared distinct values
  jaccard: number // |A∩B| / |A∪B| over distinct values
}

export type CrossFinding = {
  id: string
  title: string
  detail: string
  stat: string // e.g. "r = 0.81"
  score: number // 0..1 importance
  accent: Accent
  datasetA: string
  datasetB: string
  via: string // shared dimension label
  xLabel: string
  yLabel: string
  points: { key: string; x: number; y: number }[] // aligned group means, for a scatter
}

const corrWord = (r: number) => {
  const a = Math.abs(r)
  if (a >= 0.8) return 'very strong'
  if (a >= 0.6) return 'strong'
  if (a >= 0.4) return 'moderate'
  return 'weak'
}
function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Distinct non-empty values of a categorical column (lowercased, trimmed). */
function distinctValues(table: Table, col: string): Set<string> {
  const s = new Set<string>()
  for (const r of table.rows) {
    const v = (r[col] ?? '').trim().toLowerCase()
    if (v) s.add(v)
  }
  return s
}

/** Categorical columns worth joining on: >1 value, not mostly-unique (an id). */
function joinableCats(d: CrossDataset): string[] {
  return d.cols
    .filter((c) => (c.type === 'string' || c.type === 'boolean') && c.unique > 1 && c.unique <= Math.max(24, d.table.rows.length * 0.6))
    .map((c) => c.name)
}

/** Find shared dimensions between two datasets by value overlap (prefers strong overlap). */
export function findJoinKeys(a: CrossDataset, b: CrossDataset, opts: { minOverlap?: number; minJaccard?: number } = {}): JoinKey[] {
  const minOverlap = opts.minOverlap ?? 3
  const minJaccard = opts.minJaccard ?? 0.25
  const keys: JoinKey[] = []
  const aCats = joinableCats(a)
  const bCats = joinableCats(b)
  for (const ca of aCats) {
    const av = distinctValues(a.table, ca)
    for (const cb of bCats) {
      const bv = distinctValues(b.table, cb)
      let inter = 0
      for (const v of av) if (bv.has(v)) inter++
      if (inter < minOverlap) continue
      const union = av.size + bv.size - inter
      const jaccard = union > 0 ? inter / union : 0
      if (jaccard < minJaccard) continue
      keys.push({ a: ca, b: cb, overlap: inter, jaccard })
    }
  }
  // Prefer same-named keys, then strongest overlap.
  return keys.sort((x, y) => Number(y.a === y.b) - Number(x.a === x.b) || y.jaccard - x.jaccard)
}

/** Mean of a numeric column grouped by a categorical key (lowercased key). */
function groupMeans(table: Table, keyCol: string, measureCol: string): Map<string, number> {
  const buckets = new Map<string, number[]>()
  for (const r of table.rows) {
    const k = (r[keyCol] ?? '').trim().toLowerCase()
    const v = num(r[measureCol] ?? '')
    if (!k || Number.isNaN(v) || r[measureCol] === '') continue
    const arr = buckets.get(k) ?? []
    arr.push(v)
    buckets.set(k, arr)
  }
  const out = new Map<string, number>()
  for (const [k, arr] of buckets) out.set(k, mean(arr))
  return out
}

const numericNames = (d: CrossDataset) => d.cols.filter((c) => c.type === 'number').map((c) => c.name)

/** Correlate two datasets across every shared dimension × measure pair. */
export function analyzeCross(datasets: CrossDataset[], opts: { minR?: number; max?: number } = {}): CrossFinding[] {
  const minR = opts.minR ?? 0.5
  const findings: CrossFinding[] = []
  if (datasets.length < 2) return findings

  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const A = datasets[i]
      const B = datasets[j]
      const keys = findJoinKeys(A, B).slice(0, 2) // strongest 1–2 shared dimensions
      if (!keys.length) continue
      const numA = numericNames(A).slice(0, 6)
      const numB = numericNames(B).slice(0, 6)

      for (const key of keys) {
        for (const mA of numA) {
          const gA = groupMeans(A.table, key.a, mA)
          if (gA.size < 3) continue
          for (const mB of numB) {
            const gB = groupMeans(B.table, key.b, mB)
            if (gB.size < 3) continue
            // align on shared key values
            const shared = [...gA.keys()].filter((k) => gB.has(k)).sort()
            if (shared.length < 3) continue
            const xs = shared.map((k) => gA.get(k)!)
            const ys = shared.map((k) => gB.get(k)!)
            const r = pearson(xs, ys)
            if (Math.abs(r) < minR) continue
            const keyLabel = key.a === key.b ? key.a : `${key.a}↔${key.b}`
            findings.push({
              id: `x-${A.id}-${mA}-${B.id}-${mB}`,
              title: `${A.name}'s ${mA} ${r > 0 ? 'tracks' : 'inversely tracks'} ${B.name}'s ${mB}`,
              detail: `Joined on ${keyLabel} across ${shared.length} shared values, the per-group average of ${mA} (${A.name}) has a ${corrWord(r)} ${r > 0 ? 'positive' : 'negative'} correlation with ${mB} (${B.name}) — r = ${r.toFixed(2)}. ${Math.abs(r) >= 0.7 ? 'A genuine cross-dataset link worth acting on.' : 'A cross-dataset signal worth investigating.'}`,
              stat: `r = ${r.toFixed(2)}`,
              score: 0.5 + Math.abs(r) * 0.4 + Math.min(0.1, shared.length / 100),
              accent: r > 0 ? 'fuchsia' : 'amber',
              datasetA: A.name,
              datasetB: B.name,
              via: keyLabel,
              xLabel: `${mA} (${A.name.split('—')[0].trim()})`,
              yLabel: `${mB} (${B.name.split('—')[0].trim()})`,
              points: shared.map((k) => ({ key: k, x: gA.get(k)!, y: gB.get(k)! })),
            })
          }
        }
      }
    }
  }

  // De-dupe near-identical column pairings, keep the strongest, rank.
  const seen = new Set<string>()
  const ranked = findings.sort((a, b) => b.score - a.score).filter((f) => {
    const sig = `${f.datasetA}|${f.datasetB}|${f.via}`
    if (seen.has(sig)) return false // one finding per dataset-pair+dimension
    seen.add(sig)
    return true
  })
  return ranked.slice(0, opts.max ?? 6)
}

/** Convenience: parse + profile a set of {id,name,text} into CrossDatasets. */
export function toCrossDatasets(inputs: { id: string; name: string; text: string; format?: string }[], parse: (t: string, f?: string) => Table): CrossDataset[] {
  const out: CrossDataset[] = []
  for (const inp of inputs) {
    try {
      const table = parse(inp.text, inp.format)
      if (table.rows.length) out.push({ id: inp.id, name: inp.name, table, cols: profile(table) })
    } catch {
      /* skip unparseable */
    }
  }
  return out
}

/** Headline summary across all bridged findings. */
export function crossHeadline(findings: CrossFinding[]): string | null {
  if (!findings.length) return null
  const f = findings[0]
  return `${f.datasetA} and ${f.datasetB} are linked via ${f.via} (${f.stat})`
}

export { compact as compactCross }
