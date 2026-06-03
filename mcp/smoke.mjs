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

// Autodesk tools degrade gracefully without APS keys (this env has none).
const aps = await client.callTool({ name: 'autodesk_status', arguments: { urn: 'dXJuOmFkc2s=' } })
const apsGraceful = aps.isError === true && /not configured/i.test(aps.content[0].text)
console.log(`autodesk_status (no keys) → ${apsGraceful ? 'graceful "not configured" ✓' : aps.content[0].text}`)

await client.close()
const names = tools.map((t) => t.name)
const hasAps = ['autodesk_list_models', 'autodesk_status', 'autodesk_translate', 'autodesk_properties'].every((n) => names.includes(n))
const okAll = tools.length === 9 && hasAps && m.grossFloorArea > 0 && m.floors.length === 10 && z.maxGFA === 10800 && typeof z.compliance.overall === 'boolean' && apsGraceful
console.log(okAll ? '\nMCP SERVER OK ✓ (9 tools; engine calls succeed; Autodesk tools present + degrade gracefully)' : '\nNEEDS REVIEW')
process.exit(okAll ? 0 : 1)
