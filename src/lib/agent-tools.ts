/* Unified tool execution — runTool() dispatches a studio tool by name to the same
 * engines the web app uses. Shared by the MCP server (mcp/server.ts) and the
 * in-app AI agent (api/agent.ts). Tool metadata (schemas) is in agent-tools-meta.ts
 * (dependency-free); this module adds the engine wiring. */

import { buildMassing, massingSchedule } from './massing'
import { buildZoning, rectSite, type Pt } from './zoning'
import { parseIfc } from './ifc'
import { scoreSuppliers } from './supplier-score'
import { computeCarbon } from './carbon'
import { buildBuilding } from './building'
import { toIfc } from './building-ifc'
import { toObj } from './building-export'
import { explodeBuilding } from './building-explorer'

export { AGENT_TOOLS, type AgentTool } from './agent-tools-meta'

type Args = Record<string, unknown>
const n = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const fname = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'building'

/** Execute a studio tool by name. Pure (engines only); throws on unknown tool. */
export async function runTool(name: string, args: Args): Promise<unknown> {
  switch (name) {
    case 'massing_schedule': {
      const m = buildMassing({ gfa: Number(args.gfa) || 0, progress: 100, storeys: n(args.storeys), shape: args.shape as never, aspect: n(args.aspect), taper: n(args.taper), podium: n(args.podium), towerSetback: n(args.towerSetback), twist: n(args.twist) })
      return massingSchedule(m, { storeyHeight: n(args.storeyHeight) })
    }
    case 'analyze_zoning': {
      const boundary: Pt[] = Array.isArray(args.boundary) && args.boundary.length >= 3 ? (args.boundary as Pt[]) : rectSite(n(args.width) ?? 60, n(args.depth) ?? 45)
      return buildZoning({ boundary, far: Number(args.far), heightLimit: Number(args.heightLimit), setback: Number(args.setback), maxCoverage: Number(args.maxCoverage), storeyHeight: n(args.storeyHeight) ?? 3.6, proposedGFA: Number(args.proposedGFA), proposedStoreys: Number(args.proposedStoreys), podium: n(args.podium), towerSetback: n(args.towerSetback), skyBase: n(args.skyBase), skyStep: n(args.skyStep) })
    }
    case 'parse_ifc': {
      const p = parseIfc(String(args.ifc ?? ''), args.fileName ? String(args.fileName) : undefined)
      return { schema: p.schema, project: p.project, site: p.site, building: p.building, totalInstances: p.totalInstances, elementCount: p.elementCount, distinctTypes: p.distinctTypes, storeys: p.storeys, entityCounts: p.entityCounts.slice(0, 25), disciplines: p.disciplines, quantities: p.quantities }
    }
    case 'export_building': {
      const model = buildBuilding(
        buildMassing({ gfa: Number(args.gfa) || 0, progress: 100, storeys: n(args.storeys), shape: args.shape as never, aspect: n(args.aspect) }),
        { coreRatio: 0.16, wwr: n(args.wwr), bayWidth: n(args.bayWidth), mullions: args.mullions === undefined ? undefined : Boolean(args.mullions) },
      )
      const name = args.name ? String(args.name) : 'Building'
      const sh = n(args.storeyHeight) ?? 3.6
      const format = String(args.format ?? 'ifc').toLowerCase()
      const counts = model.counts
      if (format === 'obj') { const content = toObj(model, name); return { format: 'obj', filename: `${fname(name)}.obj`, mimeType: 'model/obj', bytes: content.length, counts, content } }
      if (format === 'json') { const ex = explodeBuilding(model, { storeyHeight: sh }); return { format: 'json', filename: `${fname(name)}-model.json`, summary: ex.summary, levels: ex.levels, schedules: ex.schedules.map((s) => ({ group: s.group, rows: s.rows, totals: s.totals })) } }
      const content = toIfc(model, { name, storeyHeight: sh })
      return { format: 'ifc', filename: `${fname(name)}.ifc`, mimeType: 'application/x-step', bytes: content.length, counts, content }
    }
    case 'score_suppliers':
      return scoreSuppliers((args.suppliers as never) ?? [])
    case 'compute_carbon':
      return computeCarbon((args.materials as never) ?? [], { gfa: Number(args.gfa), benchmark: Number(args.benchmark) })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
