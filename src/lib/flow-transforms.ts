/* Pure tabular transforms for Flow Studio nodes — filter, group-by, and join.
 * Each takes Table(s) and returns a derived Table, so transform nodes chain into
 * profile/insights/chart/cross-link exactly like a source dataset. Dependency-
 * free and unit-tested in isolation. */

import { num, type Table } from '@/lib/parse'

export type FilterOp = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'contains'
export type Agg = 'sum' | 'avg' | 'count' | 'min' | 'max'

/** Keep rows where `col` satisfies `op value`. Numeric ops coerce to number;
 *  '='/'!='/'contains' compare as trimmed, case-insensitive strings. */
export function filterTable(table: Table, col: string, op: FilterOp, value: string): Table {
  if (!table.columns.includes(col)) return { columns: table.columns, rows: [] }
  const numeric = ['>', '>=', '<', '<='].includes(op)
  const target = numeric ? num(value) : value.trim().toLowerCase()
  const rows = table.rows.filter((r) => {
    const cell = r[col] ?? ''
    if (numeric) {
      const v = num(cell)
      if (Number.isNaN(v) || cell === '') return false
      const t = target as number
      return op === '>' ? v > t : op === '>=' ? v >= t : op === '<' ? v < t : v <= t
    }
    const s = cell.trim().toLowerCase()
    const t = target as string
    return op === '=' ? s === t : op === '!=' ? s !== t : s.includes(t)
  })
  return { columns: table.columns, rows }
}

function aggregate(values: number[], agg: Agg): number {
  if (agg === 'count') return values.length
  if (!values.length) return 0
  if (agg === 'sum') return values.reduce((s, x) => s + x, 0)
  if (agg === 'avg') return values.reduce((s, x) => s + x, 0) / values.length
  if (agg === 'min') return Math.min(...values)
  return Math.max(...values)
}

/** Group rows by `by`, aggregating `measure` per group. Output columns:
 *  [by, "<agg>_<measure>"] (or "count" for the count agg). Sorted desc by value. */
export function groupTable(table: Table, by: string, measure: string, agg: Agg): Table {
  if (!table.columns.includes(by)) return { columns: [by], rows: [] }
  const buckets = new Map<string, number[]>()
  for (const r of table.rows) {
    const key = (r[by] ?? '').trim() || '(blank)'
    const arr = buckets.get(key) ?? []
    if (agg !== 'count') {
      const v = num(r[measure] ?? '')
      if (!Number.isNaN(v) && r[measure] !== '') arr.push(v)
    } else {
      arr.push(1)
    }
    buckets.set(key, arr)
  }
  const outCol = agg === 'count' ? 'count' : `${agg}_${measure}`
  const round = (n: number) => Math.round(n * 1000) / 1000
  const rows = [...buckets.entries()]
    .map(([k, arr]) => ({ [by]: k, [outCol]: String(round(aggregate(arr, agg))) }))
    .sort((a, b) => Number(b[outCol]) - Number(a[outCol]))
  return { columns: [by, outCol], rows }
}

/** Left join: attach B's columns to each A row by first matching key value.
 *  Colliding column names from B are suffixed `_b`. Bounded by A's row count. */
export function joinTables(a: Table, b: Table, keyA: string, keyB: string): Table {
  if (!a.columns.includes(keyA) || !b.columns.includes(keyB)) return a
  // index B by key (first match wins)
  const bIndex = new Map<string, Record<string, string>>()
  for (const r of b.rows) {
    const k = (r[keyB] ?? '').trim().toLowerCase()
    if (k && !bIndex.has(k)) bIndex.set(k, r)
  }
  const bCols = b.columns.filter((c) => c !== keyB)
  const collide = new Set(a.columns)
  const outBCols = bCols.map((c) => (collide.has(c) ? `${c}_b` : c))
  const columns = [...a.columns, ...outBCols]
  const rows = a.rows.map((ar) => {
    const out: Record<string, string> = { ...ar }
    const match = bIndex.get((ar[keyA] ?? '').trim().toLowerCase())
    bCols.forEach((c, i) => {
      out[outBCols[i]] = match ? (match[c] ?? '') : ''
    })
    return out
  })
  return { columns, rows }
}

/** Find a sensible default column for a transform config given a table. */
export function firstNumeric(cols: { name: string; type: string }[]): string | undefined {
  return cols.find((c) => c.type === 'number')?.name
}
export function firstCategorical(cols: { name: string; type: string; unique?: number }[]): string | undefined {
  return cols.find((c) => c.type === 'string' && (c.unique ?? 99) > 1 && (c.unique ?? 0) <= 40)?.name
}
