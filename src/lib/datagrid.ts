/* Pure, immutable table operations for the Data Workbench — edit cells, add/
 * delete rows & columns, rename, sort, filter, derive. Every op returns a new
 * Table so undo/redo is just history. No React, no side effects — unit-tested. */

import { num, type Table } from '@/lib/parse'

export type SortDir = 'asc' | 'desc'
export type FilterRule = { col: string; op: '>' | '>=' | '<' | '<=' | '=' | '!=' | 'contains' | 'empty' | 'not-empty'; value: string }

/* ---------------------------------------------------------------- cells --- */
export function editCell(t: Table, rowIndex: number, col: string, value: string): Table {
  if (rowIndex < 0 || rowIndex >= t.rows.length) return t
  const rows = t.rows.map((r, i) => (i === rowIndex ? { ...r, [col]: value } : r))
  return { columns: t.columns, rows }
}

/* ----------------------------------------------------------------- rows --- */
export function addRow(t: Table, at?: number): Table {
  const blank: Record<string, string> = {}
  t.columns.forEach((c) => (blank[c] = ''))
  const idx = at == null ? t.rows.length : Math.max(0, Math.min(at, t.rows.length))
  const rows = [...t.rows.slice(0, idx), blank, ...t.rows.slice(idx)]
  return { columns: t.columns, rows }
}
export function deleteRow(t: Table, rowIndex: number): Table {
  if (rowIndex < 0 || rowIndex >= t.rows.length) return t
  return { columns: t.columns, rows: t.rows.filter((_, i) => i !== rowIndex) }
}
export function deleteRows(t: Table, indices: Set<number>): Table {
  return { columns: t.columns, rows: t.rows.filter((_, i) => !indices.has(i)) }
}
export function duplicateRow(t: Table, rowIndex: number): Table {
  if (rowIndex < 0 || rowIndex >= t.rows.length) return t
  const copy = { ...t.rows[rowIndex] }
  return { columns: t.columns, rows: [...t.rows.slice(0, rowIndex + 1), copy, ...t.rows.slice(rowIndex + 1)] }
}

/* -------------------------------------------------------------- columns --- */
function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base
  let i = 2
  while (existing.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}
export function addColumn(t: Table, name = 'new_column'): Table {
  const col = uniqueName(name.trim() || 'new_column', t.columns)
  return { columns: [...t.columns, col], rows: t.rows.map((r) => ({ ...r, [col]: '' })) }
}
export function renameColumn(t: Table, from: string, to: string): Table {
  const target = to.trim()
  if (!target || from === target || !t.columns.includes(from)) return t
  const finalName = uniqueName(target, t.columns.filter((c) => c !== from))
  const columns = t.columns.map((c) => (c === from ? finalName : c))
  const rows = t.rows.map((r) => {
    const { [from]: v, ...rest } = r
    return { ...rest, [finalName]: v ?? '' }
  })
  return { columns, rows }
}
export function deleteColumn(t: Table, col: string): Table {
  if (!t.columns.includes(col)) return t
  const columns = t.columns.filter((c) => c !== col)
  const rows = t.rows.map((r) => {
    const { [col]: _drop, ...rest } = r
    return rest
  })
  return { columns, rows }
}

/* ---------------------------------------------------------- derive column --
 * A simple, safe formula: combine two numeric columns with +, -, *, / into a
 * new column. (No eval — explicit ops only, so it's safe and predictable.) */
export type DeriveOp = '+' | '-' | '*' | '/'
export function deriveColumn(t: Table, name: string, a: string, op: DeriveOp, b: string): Table {
  const col = uniqueName(name.trim() || `${a}_${op}_${b}`, t.columns)
  const rows = t.rows.map((r) => {
    const x = num(r[a] ?? '')
    const y = num(r[b] ?? '')
    let v = NaN
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      v = op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : y !== 0 ? x / y : NaN
    }
    return { ...r, [col]: Number.isNaN(v) ? '' : String(Math.round(v * 1000) / 1000) }
  })
  return { columns: [...t.columns, col], rows }
}

/* ------------------------------------------------------- sort & filter ----
 * These are VIEW operations: they return the row indices (into the original
 * table) in display order, so editing still maps back to the real rows. */
export function sortIndices(t: Table, col: string, dir: SortDir, numeric: boolean): number[] {
  const idx = t.rows.map((_, i) => i)
  idx.sort((ia, ib) => {
    const va = t.rows[ia][col] ?? ''
    const vb = t.rows[ib][col] ?? ''
    let cmp: number
    if (numeric) {
      const na = num(va)
      const nb = num(vb)
      const aNan = Number.isNaN(na) || va === ''
      const bNan = Number.isNaN(nb) || vb === ''
      cmp = aNan && bNan ? 0 : aNan ? 1 : bNan ? -1 : na - nb // blanks sort last
    } else {
      cmp = va.localeCompare(vb)
    }
    return dir === 'asc' ? cmp : -cmp
  })
  return idx
}

export function matchesRule(row: Record<string, string>, rule: FilterRule): boolean {
  const cell = (row[rule.col] ?? '').trim()
  if (rule.op === 'empty') return cell === ''
  if (rule.op === 'not-empty') return cell !== ''
  if (['>', '>=', '<', '<='].includes(rule.op)) {
    const v = num(cell)
    const t = num(rule.value)
    if (Number.isNaN(v) || cell === '' || Number.isNaN(t)) return false
    return rule.op === '>' ? v > t : rule.op === '>=' ? v >= t : rule.op === '<' ? v < t : v <= t
  }
  const s = cell.toLowerCase()
  const target = rule.value.trim().toLowerCase()
  return rule.op === '=' ? s === target : rule.op === '!=' ? s !== target : s.includes(target)
}

/** Display row indices after applying a search string + filter rules. */
export function viewIndices(t: Table, search: string, rules: FilterRule[]): number[] {
  const q = search.trim().toLowerCase()
  const out: number[] = []
  for (let i = 0; i < t.rows.length; i++) {
    const r = t.rows[i]
    if (q && !t.columns.some((c) => (r[c] ?? '').toLowerCase().includes(q))) continue
    if (rules.length && !rules.every((rule) => matchesRule(r, rule))) continue
    out.push(i)
  }
  return out
}

/** Serialize back to CSV for export. */
export function toCsv(t: Table): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return [t.columns.join(','), ...t.rows.map((r) => t.columns.map((c) => esc(r[c] ?? '')).join(','))].join('\n')
}
