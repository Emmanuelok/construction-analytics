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

await client.close()
const okAll = tools.length === 5 && m.grossFloorArea > 0 && m.floors.length === 10 && z.maxGFA === 10800 && typeof z.compliance.overall === 'boolean'
console.log(okAll ? '\nMCP SERVER OK ✓ (5 tools, end-to-end tool calls succeed)' : '\nNEEDS REVIEW')
process.exit(okAll ? 0 : 1)
