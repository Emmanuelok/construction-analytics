/* BCF 2.1 export — pure, unit-tested. Turns a geometric clash list into a real
 * BIM Collaboration Format archive (.bcfzip): bcf.version, a project.bcfp, and one
 * topic folder per clash carrying markup.bcf (Topic + Comment) and viewpoint.bcfv
 * (a perspective camera aimed at the clash, with both elements selected by their
 * IFC GlobalId). It opens as a coordination issue list in Revit, Navisworks, Solibri,
 * BIMcollab, usBIM, etc. Includes a tiny store-only ZIP writer (CRC-32 + local
 * headers + central directory) so no dependency is needed. No DOM, no Three.js. */

import type { GeoClash, GeoClashResult } from './ifc-clash'

/* ---------------------------------------------------------------- ZIP (store) */
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
type ZipFile = { name: string; data: Uint8Array }
/** Build a store-only (uncompressed) ZIP from name→bytes. Deterministic. */
export function makeZip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
  const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(nameBytes.length), u16(0), nameBytes, f.data])
    chunks.push(local)
    central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]))
    offset += local.length
  }
  const cd = concat(central)
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)])
  return concat([...chunks, cd, end])
}
function concat(arrs: Uint8Array[]): Uint8Array {
  let len = 0; for (const a of arrs) len += a.length
  const out = new Uint8Array(len); let o = 0
  for (const a of arrs) { out.set(a, o); o += a.length }
  return out
}

/* ---------------------------------------------------------------- BCF markup */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Deterministic GUID-shaped id from a seed (BCF wants a GUID per topic/comment/viewpoint).
function guidFrom(seed: string): string {
  let h = 0x811c9dc5
  const hex: string[] = []
  for (let i = 0; i < 32; i++) { h ^= seed.charCodeAt(i % seed.length) + i * 131; h = Math.imul(h, 0x01000193) >>> 0; hex.push((h & 0xf).toString(16)) }
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`
}

const SEV_PRIORITY: Record<GeoClash['severity'], string> = { Critical: 'Critical', Major: 'High', Minor: 'Normal' }

function viewpointXml(c: GeoClash): string {
  const [x, y, z] = c.center
  // back the camera off along a diagonal so the clash is framed
  const off = Math.max(4, c.depth * 30)
  const cam = `${x + off},${y + off * 0.6},${z + off}`
  const dir = `${-1},${-0.6},${-1}`
  const comps = [c.a.guid, c.b.guid].filter(Boolean).map((g) => `        <Component IfcGuid="${esc(g!)}" />`).join('\n')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<VisualizationInfo Guid="' + guidFrom('vp' + c.a.id + c.b.id) + '">',
    comps ? '  <Components>\n    <Selection>\n' + comps + '\n    </Selection>\n    <Visibility DefaultVisibility="true" />\n  </Components>' : '  <Components><Visibility DefaultVisibility="true" /></Components>',
    '  <PerspectiveCamera>',
    `    <CameraViewPoint><X>${cam.split(',')[0]}</X><Y>${cam.split(',')[1]}</Y><Z>${cam.split(',')[2]}</Z></CameraViewPoint>`,
    `    <CameraDirection><X>${dir.split(',')[0]}</X><Y>${dir.split(',')[1]}</Y><Z>${dir.split(',')[2]}</Z></CameraDirection>`,
    '    <CameraUpVector><X>0</X><Y>1</Y><Z>0</Z></CameraUpVector>',
    '    <FieldOfView>60</FieldOfView>',
    '  </PerspectiveCamera>',
    '</VisualizationInfo>',
  ].join('\n')
}

function markupXml(c: GeoClash, idx: number, date: string, author: string): string {
  const tg = guidFrom('topic' + c.a.id + c.b.id)
  const title = `Clash ${idx}: ${c.a.type.replace(/^IFC/, '')} × ${c.b.type.replace(/^IFC/, '')}`
  const desc = `${c.confirmed === false ? 'Soft clash (bounding boxes graze)' : 'Hard clash — solids interpenetrate'}. Penetration ${c.depth} m, overlap volume ${c.volume} m³ at (${c.center.map((v) => v.toFixed(2)).join(', ')}). Elements #${c.a.id} and #${c.b.id}.`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Markup>',
    `  <Topic Guid="${tg}" TopicType="Clash" TopicStatus="Open">`,
    `    <Title>${esc(title)}</Title>`,
    `    <Priority>${SEV_PRIORITY[c.severity]}</Priority>`,
    '    <CreationDate>' + date + '</CreationDate>',
    `    <CreationAuthor>${esc(author)}</CreationAuthor>`,
    `    <Description>${esc(desc)}</Description>`,
    '  </Topic>',
    `  <Comment Guid="${guidFrom('cm' + c.a.id + c.b.id)}">`,
    '    <Date>' + date + '</Date>',
    `    <Author>${esc(author)}</Author>`,
    `    <Comment>${esc('Auto-detected by AEC Studio geometric clash check (' + c.severity + ').')}</Comment>`,
    `    <Viewpoint Guid="${guidFrom('vp' + c.a.id + c.b.id)}" />`,
    '  </Comment>',
    '  <Viewpoints Guid="' + guidFrom('vp' + c.a.id + c.b.id) + '">',
    '    <Viewpoint>viewpoint.bcfv</Viewpoint>',
    '  </Viewpoints>',
    '</Markup>',
  ].join('\n')
}

export type BcfOptions = { project?: string; author?: string; date?: string; max?: number }

/** Build the BCF 2.1 archive bytes from a clash result. */
export function buildBcf(result: GeoClashResult, opts: BcfOptions = {}): Uint8Array {
  const project = opts.project ?? 'Coordination model'
  const author = opts.author ?? 'AEC Studio'
  const date = opts.date ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const max = opts.max ?? 500
  const files: ZipFile[] = []
  const enc = new TextEncoder()
  files.push({ name: 'bcf.version', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1"><DetailedVersion>2.1</DetailedVersion></Version>\n') })
  files.push({ name: 'project.bcfp', data: enc.encode(`<?xml version="1.0" encoding="UTF-8"?>\n<ProjectExtension><Project ProjectId="${guidFrom('proj' + project)}"><Name>${esc(project)}</Name></Project></ProjectExtension>\n`) })
  result.clashes.slice(0, max).forEach((c, i) => {
    const tg = guidFrom('topic' + c.a.id + c.b.id)
    files.push({ name: `${tg}/markup.bcf`, data: enc.encode(markupXml(c, i + 1, date, author)) })
    files.push({ name: `${tg}/viewpoint.bcfv`, data: enc.encode(viewpointXml(c)) })
  })
  return makeZip(files)
}

/** Count of topics that an export would contain. */
export const bcfTopicCount = (result: GeoClashResult, max = 500) => Math.min(result.clashes.length, max)
