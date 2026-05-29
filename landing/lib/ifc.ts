import type { Accent } from '@/lib/analytics'

/* Dependency-free IFC (STEP Physical File / ISO-10303-21) parser, ported verbatim
 * from the studio app (src/lib/ifc.ts), whose output is verified. Tokenizes the
 * DATA section and extracts entity counts, project metadata, discipline
 * breakdown, IfcElementQuantity takeoff and property single values — real parsing
 * of a real .ifc, fully in the browser. Plus a bundled IFC4 sample. */

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

/* ----------------------------------------------------- bundled IFC4 sample -- */
function buildSample(): string {
  const body: string[] = []
  let id = 100
  const add = (entity: string) => {
    body.push(`#${id}=${entity};`)
    return id++
  }

  add(`IFCPROJECT('1Meridian00000000000001',$,'Meridian Tower',$,$,$,$,$,$)`)
  add(`IFCSITE('1Site0000000000000000001',$,'Riverside Plot',$,$,$,$,$,.ELEMENT.,(51,30,26),(0,7,40),12.5,$,$)`)
  add(`IFCBUILDING('1Bldg0000000000000000001',$,'Tower A',$,$,$,$,$,.ELEMENT.,$,$,$)`)
  for (const s of ['Level 00 — Lobby', 'Level 01', 'Level 02', 'Level 03 — Roof'])
    add(`IFCBUILDINGSTOREY('1Storey${id}0000000000',$,'${s}',$,$,$,$,$,.ELEMENT.,0.)`)

  const emit = (type: string, n: number, name: (i: number) => string) => {
    for (let i = 0; i < n; i++) add(`${type}('g${id}',$,'${name(i)}',$,$,$,$,$,'t${i}')`)
  }
  emit('IFCWALLSTANDARDCASE', 8, (i) => `Wall ${i + 1} — RC 300mm`)
  emit('IFCSLAB', 4, (i) => `Slab L0${i}`)
  emit('IFCCOLUMN', 12, (i) => `Column ${String.fromCharCode(65 + (i % 6))}-${i + 1}`)
  emit('IFCBEAM', 8, (i) => `Beam B${i + 1}`)
  emit('IFCDOOR', 5, (i) => `Door D${i + 1}`)
  emit('IFCWINDOW', 10, (i) => `Window W${i + 1}`)
  emit('IFCDUCTSEGMENT', 3, (i) => `Supply duct ${i + 1}`)
  emit('IFCPIPESEGMENT', 4, (i) => `Chilled-water pipe ${i + 1}`)
  emit('IFCAIRTERMINAL', 2, (i) => `VAV box ${i + 1}`)
  emit('IFCREINFORCINGBAR', 6, (i) => `Rebar cage ${i + 1}`)

  const qty = (type: string, name: string, value: number) => add(`${type}('${name}',$,$,${value},$)`)
  for (let i = 0; i < 12; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 3.2) // columns
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 120.5) // slabs
  for (let i = 0; i < 8; i++) qty('IFCQUANTITYVOLUME', 'NetVolume', 1.8) // beams
  for (let i = 0; i < 8; i++) qty('IFCQUANTITYAREA', 'GrossSideArea', 42.0) // walls
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYAREA', 'GrossArea', 310.0) // floors
  for (let i = 0; i < 6; i++) qty('IFCQUANTITYWEIGHT', 'Weight', 1850) // rebar
  for (let i = 0; i < 3; i++) qty('IFCQUANTITYLENGTH', 'Length', 24.5) // duct
  for (let i = 0; i < 4; i++) qty('IFCQUANTITYLENGTH', 'Length', 18.2) // pipe

  const psv = (name: string, wrapped: string) => add(`IFCPROPERTYSINGLEVALUE('${name}',$,${wrapped},$)`)
  psv('FireRating', `IFCLABEL('120min')`)
  psv('LoadBearing', `IFCBOOLEAN(.T.)`)
  psv('IsExternal', `IFCBOOLEAN(.T.)`)
  psv('ThermalTransmittance', `IFCREAL(0.18)`)
  psv('AcousticRating', `IFCLABEL('Rw 52dB')`)
  psv('Combustible', `IFCBOOLEAN(.F.)`)

  const header = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');
FILE_NAME('MeridianTower-Sample.ifc','2026-05-20T09:14:00',('AEC Studio'),('AEC Data & Intelligence Studio'),'IFC4 reference','Studio Sample Generator','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;`
  return `${header}\n${body.join('\n')}\nENDSEC;\nEND-ISO-10303-21;\n`
}

export const SAMPLE_IFC: string = buildSample()
