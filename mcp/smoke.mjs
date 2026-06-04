/* End-to-end smoke test for the AEC Studio MCP server: spawn it over stdio with
 * the MCP client SDK, list its tools, and call a couple. Run: npm run mcp:smoke */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/server.ts'] })
const client = new Client({ name: 'aec-studio-smoke', version: '1.0.0' })
await client.connect(transport)

const { tools } = await client.listTools()
console.log('tools:', tools.map((t) => t.name).join(', '))

const massing = await client.callTool({ name: 'massing_schedule', arguments: { gfa: 100000, storeys: 10, shape: 'rect' } })
const m = JSON.parse(massing.content[0].text)
console.log(`massing_schedule → GFA ${m.grossFloorArea} m², façade ${m.facadeArea} m², carbon ${m.embodiedCarbon} kgCO₂e, floors ${m.floors.length}`)

const zoning = await client.callTool({ name: 'analyze_zoning', arguments: { width: 60, depth: 45, far: 4, heightLimit: 60, setback: 6, maxCoverage: 55, proposedGFA: 9000, proposedStoreys: 14, podium: 0.3, towerSetback: 0.35, skyBase: 24, skyStep: 0.3 } })
const z = JSON.parse(zoning.content[0].text)
console.log(`analyze_zoning → maxGFA ${z.maxGFA} m², utilisation ${Math.round(z.utilisation)}%, compliant ${z.compliance.overall}`)

// export_building → a pullable IFC file (an MCP host can save the generated model)
const exp = await client.callTool({ name: 'export_building', arguments: { gfa: 40000, storeys: 6, shape: 'rect', name: 'Smoke Tower', format: 'ifc' } })
const x = JSON.parse(exp.content[0].text)
const exportOk = x.format === 'ifc' && /^ISO-10303-21;/.test(x.content) && /IFCSTAIR\(/.test(x.content) && x.bytes > 1000
console.log(`export_building → ${x.filename}, ${x.bytes} bytes, IFC4 + stairs ${exportOk ? '✓' : '✗'}`)

// Autodesk tools degrade gracefully without APS keys (this env has none).
const aps = await client.callTool({ name: 'autodesk_status', arguments: { urn: 'dXJuOmFkc2s=' } })
const apsGraceful = aps.isError === true && /not configured/i.test(aps.content[0].text)
const pub = await client.callTool({ name: 'autodesk_publish_model', arguments: { gfa: 40000, storeys: 6 } })
const pubGraceful = pub.isError === true && /not configured/i.test(pub.content[0].text)
console.log(`autodesk_status / autodesk_publish_model (no keys) → ${apsGraceful && pubGraceful ? 'graceful "not configured" ✓' : 'unexpected'}`)

await client.close()
const names = tools.map((t) => t.name)
const hasAps = ['autodesk_list_models', 'autodesk_status', 'autodesk_translate', 'autodesk_properties', 'autodesk_publish_model'].every((n) => names.includes(n))
const okAll = tools.length === 11 && hasAps && names.includes('export_building') && m.grossFloorArea > 0 && m.floors.length === 10 && z.maxGFA === 10800 && typeof z.compliance.overall === 'boolean' && exportOk && apsGraceful && pubGraceful
console.log(okAll ? '\nMCP SERVER OK ✓ (11 tools; engine + export calls succeed; Autodesk tools present + degrade gracefully)' : '\nNEEDS REVIEW')
process.exit(okAll ? 0 : 1)
