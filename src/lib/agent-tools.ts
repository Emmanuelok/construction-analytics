/* Unified tool execution — runTool() dispatches a studio tool by name to the same
 * engines the web app uses. Shared by the MCP server (mcp/server.ts) and the
 * in-app AI agent (api/agent.ts). Tool metadata (schemas) is in agent-tools-meta.ts
 * (dependency-free); this module adds the engine wiring. */

import { buildMassing, massingSchedule } from './massing'
import { buildZoning, rectSite, type Pt } from './zoning'
import { parseIfc } from './ifc'
import { scoreSuppliers } from './supplier-score'
import { computeCarbon } from './carbon'

export { AGENT_TOOLS, type AgentTool } from './agent-tools-meta'

type Args = Record<string, unknown>
const n = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

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
    case 'score_suppliers':
      return scoreSuppliers((args.suppliers as never) ?? [])
    case 'compute_carbon':
      return computeCarbon((args.materials as never) ?? [], { gfa: Number(args.gfa), benchmark: Number(args.benchmark) })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
