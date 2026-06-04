/* AEC Studio — MCP server. Exposes the studio's analytical engines as Model
 * Context Protocol tools, so any MCP host (Claude Desktop, Claude Code, Cursor,
 * other LLM apps) can drive the platform's brains: generate + quantify a building
 * massing, run a zoning capacity/compliance check, parse an IFC model, score
 * suppliers, and compute embodied carbon. Pure engines reused verbatim from the
 * web app — one source of truth. Run: npm run mcp  (stdio transport). */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { runTool } from '../src/lib/agent-tools.ts'
import * as aps from './aps.ts'

const server = new McpServer({ name: 'aec-studio', version: '0.1.0' })

type Content = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (data: unknown): Content => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] })
const fail = (e: unknown): Content => ({ content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true })

server.registerTool('massing_schedule', {
  title: 'Building massing schedule & quantities',
  description: 'Generate a parametric building massing from gross floor area, storeys and form, then return the floor schedule plus quantities & performance: modeled GFA, footprint, height, gross volume, façade & glazing area, slab concrete, embodied carbon (+intensity), ROM cost, occupancy, parking, form factor and slenderness.',
  inputSchema: {
    gfa: z.number().describe('Gross floor area target, m²'),
    storeys: z.number().int().optional().describe('Explicit storey count (else derived from GFA)'),
    shape: z.enum(['rect', 'l', 'u', 'court', 'cross', 'cylinder', 'octagon']).optional().describe('Footprint shape (default rectangle; "court" = atrium)'),
    aspect: z.number().optional().describe('Plan aspect ratio 0.3–3'),
    taper: z.number().optional().describe('0–0.6, upper floors shrink'),
    podium: z.number().optional().describe('0–1 fraction of storeys forming a full-plate podium'),
    towerSetback: z.number().optional().describe('0–0.6, tower steps in above the podium'),
    twist: z.number().optional().describe('degrees of rotation per floor'),
    storeyHeight: z.number().optional().describe('metres (default 3.6)'),
  },
}, async (a) => {
  try { return ok(await runTool('massing_schedule', a)) } catch (e) { return fail(e) }
})

server.registerTool('analyze_zoning', {
  title: 'Site & zoning capacity + compliance',
  description: 'Run a site & zoning analysis. Give the site as width×depth (m) or a polygon, plus zoning rules and a proposed scheme; returns site/buildable area, max GFA from FAR, the legal massing envelope (with sky-exposure plane), and FAR/height/coverage/setback/sky-plane compliance + utilisation.',
  inputSchema: {
    width: z.number().optional().describe('Rectangular site width, m'),
    depth: z.number().optional().describe('Rectangular site depth, m'),
    boundary: z.array(z.object({ x: z.number(), z: z.number() })).optional().describe('Site polygon in metres; overrides width/depth'),
    far: z.number().describe('Floor area ratio'),
    heightLimit: z.number().describe('metres'),
    setback: z.number().describe('uniform setback, m'),
    maxCoverage: z.number().describe('max site coverage, %'),
    storeyHeight: z.number().optional().describe('metres (default 3.6)'),
    proposedGFA: z.number(),
    proposedStoreys: z.number().int(),
    podium: z.number().optional(),
    towerSetback: z.number().optional(),
    skyBase: z.number().optional().describe('sky-exposure plane base height, m (0 = off)'),
    skyStep: z.number().optional().describe('0–0.6 envelope step-in above skyBase'),
  },
}, async (a) => {
  try { return ok(await runTool('analyze_zoning', a)) } catch (e) { return fail(e) }
})

server.registerTool('parse_ifc', {
  title: 'Parse an IFC model',
  description: 'Parse an IFC (STEP/SPF text) model and return a structured summary: schema, project, instance + element counts, distinct types, storeys, top entity counts, disciplines and the quantity takeoff (from IfcElementQuantity).',
  inputSchema: { ifc: z.string().describe('Full IFC file contents (text)'), fileName: z.string().optional() },
}, async (a) => {
  try { return ok(await runTool('parse_ifc', a)) } catch (e) { return fail(e) }
})

server.registerTool('export_building', {
  title: 'Export a generated building (IFC / OBJ / JSON)',
  description: 'Generate a parametric building from gross floor area, storeys and form, then export it as a real model file: native IFC4 (typed BIM products — columns, beams, walls, partitions, windows, doors, slabs, a stepped stair and IfcSpace rooms), a grouped Wavefront OBJ mesh, or a structured JSON model (schedules + quantities). Returns the file content + element counts so it can be pulled programmatically.',
  inputSchema: {
    gfa: z.number().describe('Gross floor area target, m²'),
    storeys: z.number().int().optional().describe('Explicit storey count (else derived from GFA)'),
    shape: z.enum(['rect', 'l', 'u', 'court', 'cross', 'cylinder', 'octagon']).optional().describe('Footprint shape (default rectangle)'),
    aspect: z.number().optional().describe('Plan aspect ratio 0.3–3'),
    storeyHeight: z.number().optional().describe('metres (default 3.6)'),
    wwr: z.number().optional().describe('Window-to-wall ratio 0.15–0.85'),
    bayWidth: z.number().optional().describe('Window bay width, m'),
    mullions: z.boolean().optional().describe('Façade mullions (default on)'),
    format: z.enum(['ifc', 'obj', 'json']).optional().describe('Output format (default ifc)'),
    name: z.string().optional().describe('Model / project name'),
  },
}, async (a) => {
  try { return ok(await runTool('export_building', a)) } catch (e) { return fail(e) }
})

server.registerTool('score_suppliers', {
  title: 'Score & rank suppliers',
  description: 'Score a cohort of suppliers on on-time delivery, quality, lead time and price into a 0–100 composite with letter grades, ranked best-first.',
  inputSchema: {
    suppliers: z.array(z.object({
      id: z.string(), name: z.string(), category: z.string().optional(), region: z.string().optional(),
      onTime: z.number().describe('% on-time (higher better)'), quality: z.number().describe('% quality acceptance'),
      leadTime: z.number().describe('days (lower better)'), priceIndex: z.number().describe('100 = market; lower cheaper'),
    })).describe('The supplier cohort'),
  },
}, async (a) => {
  try { return ok(await runTool('score_suppliers', a)) } catch (e) { return fail(e) }
})

server.registerTool('compute_carbon', {
  title: 'Embodied carbon vs baseline',
  description: 'Compute embodied carbon for a set of material lines against a conventional baseline and a GFA benchmark; returns total kgCO₂e, saving vs baseline, intensity (kgCO₂e/m²) and a rating.',
  inputSchema: {
    gfa: z.number().describe('Gross floor area, m²'),
    benchmark: z.number().describe('Benchmark intensity, kgCO₂e/m²'),
    materials: z.array(z.object({
      id: z.string(), name: z.string(), quantity: z.number(), unit: z.string(),
      factor: z.number().describe('kgCO₂e per unit — specified product'),
      baselineFactor: z.number().describe('kgCO₂e per unit — conventional baseline'),
    })).describe('Material take-off lines'),
  },
}, async (a) => {
  try { return ok(await runTool('compute_carbon', a)) } catch (e) { return fail(e) }
})

// ── Autodesk APS tools (native Revit/Navisworks/AutoCAD via APS) ────────────────
// These need APS_CLIENT_ID + APS_CLIENT_SECRET in the MCP server's environment;
// without them each tool returns a clear "not configured" message.
const NOT_CONFIGURED = 'Autodesk APS is not configured. Set APS_CLIENT_ID and APS_CLIENT_SECRET in this MCP server\'s environment to enable native CAD/BIM tools.'

server.registerTool('autodesk_list_models', {
  title: 'List Autodesk (APS) models',
  description: 'List native models uploaded to the studio\'s Autodesk Platform Services bucket (Revit/Navisworks/AutoCAD/…), with their URNs for the other autodesk_* tools.',
  inputSchema: {},
}, async () => {
  if (!aps.apsConfigured()) return fail(NOT_CONFIGURED)
  try { return ok(await aps.listModels()) } catch (e) { return fail(e) }
})

server.registerTool('autodesk_status', {
  title: 'Autodesk model translation status',
  description: 'Report the Model Derivative translation status (and % progress) for a model URN or raw objectId.',
  inputSchema: { urn: z.string().describe('Model URN (base64url) or raw urn:adsk.objects:… id') },
}, async (a) => {
  if (!aps.apsConfigured()) return fail(NOT_CONFIGURED)
  try { return ok(await aps.status(a.urn)) } catch (e) { return fail(e) }
})

server.registerTool('autodesk_translate', {
  title: 'Translate an Autodesk model',
  description: 'Start (or force) translation of an uploaded native model to SVF2 so it can be viewed and its data extracted.',
  inputSchema: { urn: z.string().describe('Model URN or raw objectId') },
}, async (a) => {
  if (!aps.apsConfigured()) return fail(NOT_CONFIGURED)
  try { return ok(await aps.translate(a.urn)) } catch (e) { return fail(e) }
})

server.registerTool('autodesk_properties', {
  title: 'Extract Autodesk model properties',
  description: 'Extract element properties from a translated native model (e.g. Revit) via the Model Derivative metadata → properties API. Returns the viewables and the first objects with their full property sets — for pulling quantities, types, parameters, etc.',
  inputSchema: { urn: z.string().describe('Model URN or raw objectId'), guid: z.string().optional().describe('A specific viewable GUID (else the first is used)') },
}, async (a) => {
  if (!aps.apsConfigured()) return fail(NOT_CONFIGURED)
  try { return ok(await aps.properties(a.urn, a.guid)) } catch (e) { return fail(e) }
})

server.registerTool('autodesk_publish_model', {
  title: 'Publish a generated building to Autodesk',
  description: 'Generate a parametric building (from GFA/storeys/form) as IFC or OBJ, upload it to the studio\'s Autodesk APS bucket, and (by default) start translation to SVF2 — so the generated model can be viewed and queried in APS. Returns the model URN.',
  inputSchema: {
    gfa: z.number().describe('Gross floor area target, m²'),
    storeys: z.number().int().optional(),
    shape: z.enum(['rect', 'l', 'u', 'court', 'cross', 'cylinder', 'octagon']).optional(),
    aspect: z.number().optional(), storeyHeight: z.number().optional(), wwr: z.number().optional(), bayWidth: z.number().optional(),
    format: z.enum(['ifc', 'obj']).optional().describe('Upload format (default ifc)'),
    name: z.string().optional().describe('Model name'),
    translate: z.boolean().optional().describe('Start translation after upload (default true)'),
  },
}, async (a) => {
  if (!aps.apsConfigured()) return fail(NOT_CONFIGURED)
  try {
    const exp = (await runTool('export_building', { ...a, format: a.format ?? 'ifc' })) as { filename: string; content: string; format: string; bytes: number; counts: unknown }
    const up = await aps.uploadModel(exp.filename, exp.content)
    const translation = a.translate === false ? 'skipped' : await aps.translate(up.urn).then(() => 'started').catch((e) => `translate failed: ${e instanceof Error ? e.message : e}`)
    return ok({ ...up, format: exp.format, counts: exp.counts, translation })
  } catch (e) { return fail(e) }
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error(`AEC Studio MCP server ready (stdio) — engines: massing_schedule, analyze_zoning, parse_ifc, export_building, score_suppliers, compute_carbon · Autodesk: list/status/translate/properties/publish${aps.apsConfigured() ? '' : ' (APS keys not set)'}`)
