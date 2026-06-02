/* Verifies remote-MCP federation end-to-end against a real MCP server over an
 * in-memory transport (no network): connect → list tools → namespaced call.
 * The HTTP path (connectRemote) shares connectClient, so this proves the merge +
 * routing logic the agent uses. Run: npm run mcp:federation */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { z } from 'zod'
import { connectClient, buildFederatedTools, callFederated, closeRemotes } from '../src/lib/mcp-federation.ts'

// A tiny "remote" MCP server with one tool.
const server = new McpServer({ name: 'remote-demo', version: '1.0.0' })
server.registerTool('echo', { description: 'Echo a message back', inputSchema: { msg: z.string() } }, async (a) => ({ content: [{ type: 'text', text: `echo: ${a.msg}` }] }))

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
await server.connect(serverTransport)

const remote = await connectClient('demo', clientTransport)
const fed = buildFederatedTools([remote])
console.log('federated tools:', fed.tools.map((t) => t.name).join(', '))

const out = await callFederated(fed.routing, 'demo__echo', { msg: 'hi from the agent' })
console.log('federated call → ', out)

await closeRemotes([remote])
const ok = fed.tools.length === 1 && fed.tools[0].name === 'demo__echo' && fed.routing.has('demo__echo') && out === 'echo: hi from the agent'
console.log(ok ? '\nMCP FEDERATION OK ✓ (connect → list → namespaced remote call round-trip)' : '\nNEEDS REVIEW')
process.exit(ok ? 0 : 1)
