/* Tool metadata only — JSON-Schema definitions for the studio's agent/MCP tools.
 * Dependency-free (no engine imports) so the client can show the tool list without
 * bundling the engines. runTool() + the engine wiring live in agent-tools.ts. */

export type AgentTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown> // JSON Schema (object)
}

const num = (d?: string) => ({ type: 'number', ...(d ? { description: d } : {}) })

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'massing_schedule',
    description: 'Generate a parametric building massing from GFA/storeys/form and return its floor schedule + quantities & performance (modeled GFA, footprint, height, gross volume, façade & glazing, slab concrete, embodied carbon + intensity, ROM cost, occupancy, parking, form factor, slenderness).',
    inputSchema: {
      type: 'object',
      properties: {
        gfa: num('Gross floor area target, m²'),
        storeys: { type: 'integer', description: 'Explicit storey count (else derived from GFA)' },
        shape: { type: 'string', enum: ['rect', 'l', 'u', 'court', 'cross', 'cylinder', 'octagon'], description: 'Footprint shape (court = atrium)' },
        aspect: num('Plan aspect ratio 0.3–3'), taper: num('0–0.6'), podium: num('0–1 podium fraction'), towerSetback: num('0–0.6'), twist: num('° per floor'), storeyHeight: num('m (default 3.6)'),
      },
      required: ['gfa'],
    },
  },
  {
    name: 'analyze_zoning',
    description: 'Run a site & zoning capacity + compliance check. Site as width×depth (m) or a polygon, plus zoning rules and a proposed scheme; returns buildable area, max GFA, the legal envelope (incl. sky-exposure plane) and FAR/height/coverage/setback/sky-plane compliance + utilisation.',
    inputSchema: {
      type: 'object',
      properties: {
        width: num('Rectangular site width, m'), depth: num('Rectangular site depth, m'),
        boundary: { type: 'array', items: { type: 'object', properties: { x: num(), z: num() }, required: ['x', 'z'] }, description: 'Site polygon (m); overrides width/depth' },
        far: num('Floor area ratio'), heightLimit: num('m'), setback: num('uniform setback, m'), maxCoverage: num('max coverage, %'),
        storeyHeight: num('m (default 3.6)'), proposedGFA: num(), proposedStoreys: { type: 'integer' },
        podium: num(), towerSetback: num(), skyBase: num('sky-exposure base height, m'), skyStep: num('0–0.6'),
      },
      required: ['far', 'heightLimit', 'setback', 'maxCoverage', 'proposedGFA', 'proposedStoreys'],
    },
  },
  {
    name: 'parse_ifc',
    description: 'Parse an IFC (STEP/SPF text) model → schema, project, instance + element counts, distinct types, storeys, disciplines and the quantity takeoff.',
    inputSchema: { type: 'object', properties: { ifc: { type: 'string', description: 'Full IFC file contents' }, fileName: { type: 'string' } }, required: ['ifc'] },
  },
  {
    name: 'score_suppliers',
    description: 'Score & rank a supplier cohort on on-time delivery, quality, lead time and price into a 0–100 composite with grades.',
    inputSchema: {
      type: 'object',
      properties: {
        suppliers: { type: 'array', description: 'Supplier cohort', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, onTime: num('% on-time'), quality: num('% quality'), leadTime: num('days'), priceIndex: num('100 = market') }, required: ['id', 'name', 'onTime', 'quality', 'leadTime', 'priceIndex'] } },
      },
      required: ['suppliers'],
    },
  },
  {
    name: 'compute_carbon',
    description: 'Compute embodied carbon for material lines vs a baseline + GFA benchmark → total kgCO₂e, saving, intensity (kgCO₂e/m²) and rating.',
    inputSchema: {
      type: 'object',
      properties: {
        gfa: num('Gross floor area, m²'), benchmark: num('Benchmark kgCO₂e/m²'),
        materials: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, quantity: num(), unit: { type: 'string' }, factor: num('kgCO₂e/unit'), baselineFactor: num('baseline kgCO₂e/unit') }, required: ['id', 'name', 'quantity', 'unit', 'factor', 'baselineFactor'] } },
      },
      required: ['gfa', 'benchmark', 'materials'],
    },
  },
]
