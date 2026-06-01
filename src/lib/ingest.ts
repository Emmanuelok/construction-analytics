/* Ingestion / ETL mapping — pure, unit-tested. The inbound half of the platform:
 * take a raw uploaded table (any column names), map its columns onto a canonical
 * AEC schema, then validate & coerce every row — producing standardized records,
 * a per-field fill/error breakdown, a row validity count and a data-quality
 * score. Auto-mapping fuzzy-matches source headers to schema fields. */

import type { Table } from '@/lib/parse'

export type FieldType = 'string' | 'number' | 'date' | 'enum'
export type SchemaField = { key: string; label: string; type: FieldType; required?: boolean; enumValues?: string[] }
export type TargetSchema = { id: string; name: string; description: string; fields: SchemaField[] }

export const SCHEMAS: TargetSchema[] = [
  {
    id: 'project-master', name: 'Project Master', description: 'Core project records & portfolio metadata',
    fields: [
      { key: 'name', label: 'Project name', type: 'string', required: true },
      { key: 'sector', label: 'Sector', type: 'string' },
      { key: 'location', label: 'Location', type: 'string' },
      { key: 'value', label: 'Contract value', type: 'number' },
      { key: 'gfa', label: 'GFA (m²)', type: 'number' },
      { key: 'progress', label: '% complete', type: 'number' },
      { key: 'phase', label: 'Phase', type: 'enum', enumValues: ['Design', 'Procurement', 'Construction', 'Handover', 'Operations'] },
    ],
  },
  {
    id: 'cost-plan', name: 'Cost Plan', description: 'Estimate / BOQ line items',
    fields: [
      { key: 'item', label: 'Line item', type: 'string', required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', required: true },
      { key: 'unit', label: 'Unit', type: 'string' },
      { key: 'rate', label: 'Unit rate', type: 'number' },
      { key: 'total', label: 'Total', type: 'number' },
    ],
  },
  {
    id: 'schedule', name: 'Schedule Activities', description: 'Programme activities & milestones',
    fields: [
      { key: 'activity', label: 'Activity', type: 'string', required: true },
      { key: 'start', label: 'Start date', type: 'date' },
      { key: 'finish', label: 'Finish date', type: 'date' },
      { key: 'durationDays', label: 'Duration (days)', type: 'number' },
      { key: 'pctComplete', label: '% complete', type: 'number' },
    ],
  },
  {
    id: 'supplier', name: 'Supplier Performance', description: 'Vendor scorecard inputs',
    fields: [
      { key: 'supplier', label: 'Supplier', type: 'string', required: true },
      { key: 'category', label: 'Category', type: 'string' },
      { key: 'onTime', label: 'On-time %', type: 'number' },
      { key: 'quality', label: 'Quality %', type: 'number' },
      { key: 'leadTime', label: 'Lead time (days)', type: 'number' },
      { key: 'priceIndex', label: 'Price index', type: 'number' },
    ],
  },
]

export type Mapping = Record<string, string | null> // schema field key -> source column header

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Auto-map source columns to schema fields by fuzzy header match (no field used twice). */
export function autoMap(sourceColumns: string[], schema: TargetSchema): Mapping {
  const used = new Set<string>()
  const map: Mapping = {}
  const cols = sourceColumns.map((c) => ({ raw: c, norm: normalize(c) }))
  for (const f of schema.fields) {
    const targets = [normalize(f.key), normalize(f.label)]
    let best: { raw: string; score: number } | null = null
    for (const c of cols) {
      if (used.has(c.raw)) continue
      let score = 0
      if (targets.includes(c.norm)) score = 100
      else if (targets.some((t) => c.norm.includes(t) || t.includes(c.norm))) score = 60
      else if (targets.some((t) => t.length >= 4 && (c.norm.startsWith(t.slice(0, 4)) || t.startsWith(c.norm.slice(0, 4))))) score = 30
      if (score > 0 && (!best || score > best.score)) best = { raw: c.raw, score }
    }
    map[f.key] = best ? best.raw : null
    if (best) used.add(best.raw)
  }
  return map
}

export type Coerced = { ok: boolean; value: string | number; issue?: string }

export function coerceField(field: SchemaField, raw: string): Coerced {
  const v = (raw ?? '').trim()
  if (v === '') return { ok: !field.required, value: '', issue: field.required ? 'missing required value' : undefined }
  switch (field.type) {
    case 'number': {
      const n = Number(v.replace(/[$,%\s]/g, ''))
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value: v, issue: 'not a number' }
    }
    case 'date': {
      const t = Date.parse(v)
      return Number.isNaN(t) ? { ok: false, value: v, issue: 'not a date' } : { ok: true, value: new Date(t).toISOString().slice(0, 10) }
    }
    case 'enum': {
      const hit = (field.enumValues ?? []).find((e) => e.toLowerCase() === v.toLowerCase())
      return hit ? { ok: true, value: hit } : { ok: false, value: v, issue: `not one of ${(field.enumValues ?? []).join('/')}` }
    }
    default:
      return { ok: true, value: v }
  }
}

export type FieldReport = { key: string; label: string; required: boolean; mapped: boolean; fillRate: number; errors: number }
export type SampleError = { row: number; field: string; value: string; issue: string }
export type ImportReport = {
  totalRows: number
  validRows: number
  invalidRows: number
  fields: FieldReport[]
  unmappedRequired: string[]
  qualityScore: number
  sampleErrors: SampleError[]
}
export type ImportResult = { records: Record<string, string | number>[]; report: ImportReport }

const round = (n: number) => Math.round(n)

/** Validate + coerce a source table against a schema under the given mapping. */
export function validateImport(rows: Record<string, string>[], schema: TargetSchema, mapping: Mapping): ImportResult {
  const records: Record<string, string | number>[] = []
  const fieldErrors: Record<string, number> = {}
  const fieldFilled: Record<string, number> = {}
  const sampleErrors: SampleError[] = []
  let validRows = 0

  for (let i = 0; i < rows.length; i++) {
    const src = rows[i]
    const rec: Record<string, string | number> = {}
    let rowOk = true
    for (const f of schema.fields) {
      const col = mapping[f.key]
      const raw = col ? (src[col] ?? '') : ''
      if (raw.trim() !== '') fieldFilled[f.key] = (fieldFilled[f.key] ?? 0) + 1
      const c = coerceField(f, raw)
      rec[f.key] = c.value
      if (!c.ok) {
        rowOk = false
        fieldErrors[f.key] = (fieldErrors[f.key] ?? 0) + 1
        if (sampleErrors.length < 50) sampleErrors.push({ row: i + 1, field: f.label, value: raw, issue: c.issue ?? 'invalid' })
      }
    }
    records.push(rec)
    if (rowOk) validRows++
  }

  const total = rows.length
  const fields: FieldReport[] = schema.fields.map((f) => ({
    key: f.key,
    label: f.label,
    required: !!f.required,
    mapped: !!mapping[f.key],
    fillRate: total > 0 ? round(((fieldFilled[f.key] ?? 0) / total) * 100) : 0,
    errors: fieldErrors[f.key] ?? 0,
  }))
  const requiredFields = schema.fields.filter((f) => f.required)
  const unmappedRequired = requiredFields.filter((f) => !mapping[f.key]).map((f) => f.label)
  const requiredCoverage = requiredFields.length ? (requiredFields.length - unmappedRequired.length) / requiredFields.length : 1
  const mappedFields = fields.filter((f) => f.mapped)
  const fill = mappedFields.length ? mappedFields.reduce((s, f) => s + f.fillRate, 0) / mappedFields.length / 100 : 0
  const validity = total > 0 ? validRows / total : 0
  const qualityScore = round(100 * (0.45 * validity + 0.25 * fill + 0.3 * requiredCoverage))

  return {
    records,
    report: { totalRows: total, validRows, invalidRows: total - validRows, fields, unmappedRequired, qualityScore, sampleErrors },
  }
}

/** Canonical CSV of the standardized records (schema field order). */
export function recordsToCsv(records: Record<string, string | number>[], schema: TargetSchema): string {
  const cols = schema.fields.map((f) => f.key)
  const cell = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [schema.fields.map((f) => f.label).map(cell).join(','), ...records.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')
}

/** Convenience: map source Table headers and validate in one call. */
export function ingest(table: Table, schema: TargetSchema, mapping?: Mapping): ImportResult {
  const m = mapping ?? autoMap(table.columns, schema)
  return validateImport(table.rows, schema, m)
}
