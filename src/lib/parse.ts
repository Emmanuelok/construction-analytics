/** Lightweight in-browser parsing + profiling for tabular data (CSV/TSV/JSON). */

export type Table = { columns: string[]; rows: Record<string, string>[] }
export type ColType = 'number' | 'date' | 'boolean' | 'string'

export type ColumnProfile = {
  name: string
  type: ColType
  count: number
  missing: number
  unique: number
  min?: number
  max?: number
  mean?: number
  median?: number
  top?: { value: string; count: number }[]
  sample: string[]
}

/** Parse CSV/TSV text into a table, handling quoted fields and embedded delimiters. */
export function parseDelimited(text: string, delimiter?: string): Table {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!clean) return { columns: [], rows: [] }
  const delim = delimiter ?? (clean.split('\n')[0].includes('\t') ? '\t' : ',')

  const records: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  records.push(row)

  const header = (records.shift() ?? []).map((h, i) => h.trim() || `col_${i + 1}`)
  const rows = records
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      header.forEach((h, i) => (obj[h] = (r[i] ?? '').trim()))
      return obj
    })
  return { columns: header, rows }
}

/** Parse a JSON array-of-objects (or {data:[...]}/{features:[...]}) into a table. */
export function parseJsonTable(text: string): Table {
  const data = JSON.parse(text)
  let arr: any[] = []
  if (Array.isArray(data)) arr = data
  else if (Array.isArray(data?.data)) arr = data.data
  else if (Array.isArray(data?.features)) arr = data.features.map((f: any) => ({ ...f.properties }))
  else if (data && typeof data === 'object') arr = [data]
  const columns = Array.from(new Set(arr.flatMap((o) => Object.keys(o ?? {}))))
  const rows = arr.map((o) => {
    const obj: Record<string, string> = {}
    columns.forEach((c) => {
      const v = o?.[c]
      obj[c] = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    })
    return obj
  })
  return { columns, rows }
}

export function parseAny(text: string, format?: string): Table {
  const f = (format ?? '').toUpperCase()
  if (f === 'JSON' || f === 'GEOJSON' || text.trim().startsWith('[') || text.trim().startsWith('{')) {
    try {
      return parseJsonTable(text)
    } catch {
      /* fall through to delimited */
    }
  }
  return parseDelimited(text)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?/
function detectType(values: string[]): ColType {
  const nonEmpty = values.filter((v) => v !== '')
  if (!nonEmpty.length) return 'string'
  if (nonEmpty.every((v) => v === 'true' || v === 'false')) return 'boolean'
  if (nonEmpty.every((v) => !isNaN(Number(v.replace(/[,%$]/g, ''))))) return 'number'
  if (nonEmpty.every((v) => DATE_RE.test(v))) return 'date'
  return 'string'
}

export function num(v: string): number {
  return Number(String(v).replace(/[,%$\s]/g, ''))
}

/* ------------------------------------------------------- format conversion */
function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Serialize a table to CSV / TSV / JSON / Markdown for alternate-format export. */
export function tableToFormat(table: Table, format: 'CSV' | 'TSV' | 'JSON' | 'MD'): string {
  const { columns, rows } = table
  if (format === 'JSON') return JSON.stringify(rows, null, 2)
  if (format === 'MD') {
    const head = `| ${columns.join(' | ')} |`
    const sep = `| ${columns.map(() => '---').join(' | ')} |`
    const body = rows.map((r) => `| ${columns.map((c) => (r[c] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n')
    return [head, sep, body].join('\n')
  }
  const delim = format === 'TSV' ? '\t' : ','
  const esc = format === 'TSV' ? (v: string) => v.replace(/\t/g, ' ') : csvEscape
  return [columns.join(delim), ...rows.map((r) => columns.map((c) => esc(r[c] ?? '')).join(delim))].join('\n')
}

/** Which alternate formats a source format can be converted to (excluding itself). */
export function alternateFormats(format: string): ('CSV' | 'TSV' | 'JSON' | 'MD')[] {
  const f = format.toUpperCase()
  const all: ('CSV' | 'TSV' | 'JSON' | 'MD')[] = ['CSV', 'JSON', 'TSV', 'MD']
  if (['CSV', 'TSV', 'JSON', 'GEOJSON', 'XLSX'].includes(f)) return all.filter((x) => x !== f)
  return []
}

export function profile(table: Table): ColumnProfile[] {
  return table.columns.map((name) => {
    const values = table.rows.map((r) => r[name] ?? '')
    const nonEmpty = values.filter((v) => v !== '')
    const type = detectType(values)
    const base: ColumnProfile = {
      name,
      type,
      count: values.length,
      missing: values.length - nonEmpty.length,
      unique: new Set(nonEmpty).size,
      sample: nonEmpty.slice(0, 3),
    }
    if (type === 'number') {
      const nums = nonEmpty.map(num).filter((n) => !isNaN(n)).sort((a, b) => a - b)
      if (nums.length) {
        base.min = nums[0]
        base.max = nums[nums.length - 1]
        base.mean = nums.reduce((s, n) => s + n, 0) / nums.length
        base.median = nums[Math.floor(nums.length / 2)]
      }
    } else {
      const counts = new Map<string, number>()
      nonEmpty.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1))
      base.top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
    }
    return base
  })
}
