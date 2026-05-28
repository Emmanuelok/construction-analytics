import type { Accent } from '@/lib/nav'

/* A dependency-free parser for IFC files in the STEP Physical File (SPF /
 * ISO-10303-21) text encoding — the format real .ifc files use. It tokenizes
 * the DATA section into instances and extracts entity counts, project metadata,
 * discipline breakdown, IfcElementQuantity takeoff, and property single values.
 * No geometry (that needs a WASM kernel like web-ifc) — this is the structured,
 * queryable layer the BIM module surfaces. */

export type IfcDiscipline = { label: string; value: number; accent: Accent }
export type IfcQuantity = { name: string; kind: string; unit: string; total: number; count: number }
export type ParsedIfc = {
  fileName: string
  schema: string
  fileDescription?: string
  authoringTool?: string
  timestamp?: string
  totalInstances: number
  distinctTypes: number
  elementCount: number
  entityCounts: { type: string; count: number }[]
  disciplines: IfcDiscipline[]
  project?: string
  site?: string
  building?: string
  storeys: string[]
  quantities: IfcQuantity[]
  properties: { name: string; value: string }[]
}

/* ---------------------------------------------------------------- tokenizer */
/** Split a string on a delimiter char, ignoring delimiters inside 'quoted'
 *  strings (IFC escapes an apostrophe by doubling it: ''). */
function splitOutsideStrings(s: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      cur += c
      if (c === "'") {
        if (s[i + 1] === "'") cur += s[++i]
        else inStr = false
      }
      continue
    }
    if (c === "'") {
      inStr = true
      cur += c
      continue
    }
    if (c === delim) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

/** Split a parameter list on top-level commas (respecting quotes + nesting). */
function splitArgs(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let depth = 0
  let inStr = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      cur += c
      if (c === "'") {
        if (s[i + 1] === "'") cur += s[++i]
        else inStr = false
      }
      continue
    }
    if (c === "'") { inStr = true; cur += c; continue }
    if (c === '(') { depth++; cur += c; continue }
    if (c === ')') { depth--; cur += c; continue }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
}

function unquote(arg: string | undefined): string | undefined {
  const m = arg?.match(/^'([\s\S]*)'$/)
  return m ? m[1].replace(/''/g, "'") : undefined
}
function toNum(arg: string | undefined): number | undefined {
  if (arg == null) return undefined
  const n = Number(arg)
  return Number.isFinite(n) ? n : undefined
}

/** Unwrap a typed value like IFCLABEL('120min') or IFCBOOLEAN(.T.). */
function unwrapValue(arg: string | undefined): string | undefined {
  if (!arg || arg === '$' || arg === '*') return undefined
  const direct = unquote(arg)
  if (direct !== undefined) return direct
  const m = arg.match(/^[A-Za-z0-9_]+\(([\s\S]*)\)$/)
  if (m) {
    const inner = m[1].trim()
    const s = unquote(inner)
    if (s !== undefined) return s
    if (inner === '.T.') return 'Yes'
    if (inner === '.F.') return 'No'
    return inner.replace(/^\.|\.$/g, '')
  }
  return arg
}

/* ------------------------------------------------------------ classification */
const DISCIPLINE_OF: Record<string, 'arch' | 'struct' | 'mep' | 'other'> = {
  IFCWALL: 'arch', IFCWALLSTANDARDCASE: 'arch', IFCDOOR: 'arch', IFCWINDOW: 'arch',
  IFCCURTAINWALL: 'arch', IFCCOVERING: 'arch', IFCRAILING: 'arch', IFCSTAIR: 'arch',
  IFCSTAIRFLIGHT: 'arch', IFCROOF: 'arch', IFCRAMP: 'arch', IFCFURNISHINGELEMENT: 'arch', IFCSPACE: 'arch',
  IFCBEAM: 'struct', IFCCOLUMN: 'struct', IFCSLAB: 'struct', IFCFOOTING: 'struct', IFCPILE: 'struct',
  IFCMEMBER: 'struct', IFCPLATE: 'struct', IFCREINFORCINGBAR: 'struct', IFCREINFORCINGMESH: 'struct',
  IFCDUCTSEGMENT: 'mep', IFCDUCTFITTING: 'mep', IFCPIPESEGMENT: 'mep', IFCPIPEFITTING: 'mep',
  IFCFLOWSEGMENT: 'mep', IFCFLOWFITTING: 'mep', IFCFLOWTERMINAL: 'mep', IFCAIRTERMINAL: 'mep',
  IFCCABLECARRIERSEGMENT: 'mep', IFCCABLESEGMENT: 'mep', IFCVALVE: 'mep', IFCPUMP: 'mep', IFCFAN: 'mep',
  IFCBOILER: 'mep', IFCCHILLER: 'mep', IFCLIGHTFIXTURE: 'mep', IFCSANITARYTERMINAL: 'mep',
  IFCSPACEHEATER: 'mep', IFCSENSOR: 'mep',
  IFCBUILDINGELEMENTPROXY: 'other', IFCDISCRETEACCESSORY: 'other', IFCSYSTEMFURNITUREELEMENT: 'other',
}
const QTY_UNIT: Record<string, { kind: string; unit: string }> = {
  IFCQUANTITYLENGTH: { kind: 'Length', unit: 'm' },
  IFCQUANTITYAREA: { kind: 'Area', unit: 'm²' },
  IFCQUANTITYVOLUME: { kind: 'Volume', unit: 'm³' },
  IFCQUANTITYWEIGHT: { kind: 'Weight', unit: 'kg' },
  IFCQUANTITYCOUNT: { kind: 'Count', unit: '#' },
}

/* ------------------------------------------------------------------- parser */
export function parseIfc(text: string, fileName = 'model.ifc'): ParsedIfc {
  const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i)?.[1] ?? 'unknown'

  let authoringTool: string | undefined
  let timestamp: string | undefined
  let fileDescription: string | undefined
  const fn = text.match(/FILE_NAME\s*\(([\s\S]*?)\)\s*;/i)
  if (fn) {
    const a = splitArgs(fn[1])
    timestamp = unquote(a[1])
    authoringTool = unquote(a[5]) || unquote(a[4])
  }
  const fd = text.match(/FILE_DESCRIPTION\s*\(\s*\(([\s\S]*?)\)/i)
  if (fd) fileDescription = unquote(splitArgs(fd[1])[0])

  const dataStart = text.indexOf('DATA;')
  const dataEnd = text.indexOf('ENDSEC;', dataStart >= 0 ? dataStart : 0)
  const data = dataStart >= 0 ? text.slice(dataStart + 5, dataEnd >= 0 ? dataEnd : undefined) : text
  const instances = splitOutsideStrings(data, ';')

  const counts = new Map<string, number>()
  const quantities = new Map<string, IfcQuantity>()
  const properties: { name: string; value: string }[] = []
  const storeys: string[] = []
  let project: string | undefined
  let site: string | undefined
  let building: string | undefined
  let total = 0

  const nameAt = (args: string, idx: number) => unquote(splitArgs(args)[idx])

  for (const raw of instances) {
    const inst = raw.trim()
    const m = inst.match(/^#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(([\s\S]*)\)$/)
    if (!m) continue
    total++
    const type = m[2].toUpperCase()
    const args = m[3]
    counts.set(type, (counts.get(type) ?? 0) + 1)

    if (type === 'IFCPROJECT') project = nameAt(args, 2)
    else if (type === 'IFCSITE') site = nameAt(args, 2)
    else if (type === 'IFCBUILDING') building = nameAt(args, 2)
    else if (type === 'IFCBUILDINGSTOREY') {
      const n = nameAt(args, 2)
      if (n) storeys.push(n)
    } else if (type === 'IFCPROPERTYSINGLEVALUE') {
      const a = splitArgs(args)
      const name = unquote(a[0])
      const val = unwrapValue(a[2])
      if (name && val !== undefined) properties.push({ name, value: val })
    } else if (QTY_UNIT[type]) {
      const a = splitArgs(args)
      const { kind, unit } = QTY_UNIT[type]
      const name = unquote(a[0]) ?? kind
      const value = toNum(a[3]) ?? 0
      const key = `${kind}:${name}`
      const cur = quantities.get(key) ?? { name, kind, unit, total: 0, count: 0 }
      cur.total += value
      cur.count += 1
      quantities.set(key, cur)
    }
  }

  let arch = 0
  let struct = 0
  let mep = 0
  let other = 0
  let elementCount = 0
  for (const [type, c] of counts) {
    const disc = DISCIPLINE_OF[type]
    if (!disc) continue
    elementCount += c
    if (disc === 'arch') arch += c
    else if (disc === 'struct') struct += c
    else if (disc === 'mep') mep += c
    else other += c
  }
  const allDisciplines: IfcDiscipline[] = [
    { label: 'Architectural', value: arch, accent: 'blue' },
    { label: 'Structural', value: struct, accent: 'sky' },
    { label: 'MEP', value: mep, accent: 'cyan' },
    { label: 'Other', value: other, accent: 'violet' },
  ]
  const disciplines = allDisciplines.filter((d) => d.value > 0)

  const entityCounts = Array.from(counts, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

  return {
    fileName,
    schema,
    fileDescription,
    authoringTool,
    timestamp,
    totalInstances: total,
    distinctTypes: counts.size,
    elementCount,
    entityCounts,
    disciplines,
    project,
    site,
    building,
    storeys,
    quantities: Array.from(quantities.values()).sort((a, b) => b.total - a.total),
    properties,
  }
}
