/* Drives the studio's HTTP MCP endpoint (api/mcp-server.ts) the way a remote MCP host
 * would: GET the descriptor, then POST JSON-RPC (initialize / tools/list / tools/call /
 * batch / notification) and check the responses + CORS. Run: npx tsx scripts/verify-mcp-http.mts */
import handler from '../api/mcp-server.ts'

let failures = 0
const ok = (n: string, c: boolean, extra?: unknown) => { if (c) console.log(`✓ ${n}`); else { failures++; console.error(`✗ ${n}`, extra ?? '') } }
const URL = 'http://localhost/api/mcp-server'
const post = (body: unknown) => handler(new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))

// GET → capability descriptor
const get = await handler(new Request(URL))
const desc = (await get.json()) as { tools: { name: string }[]; methods: string[]; protocolVersion: string }
ok('GET returns a descriptor listing the tools + methods', get.status === 200 && desc.tools.some((t) => t.name === 'export_building') && desc.methods.includes('tools/call'))

// OPTIONS → CORS preflight
const opt = await handler(new Request(URL, { method: 'OPTIONS' }))
ok('OPTIONS preflight returns 204 + permissive CORS', opt.status === 204 && opt.headers.get('access-control-allow-origin') === '*')

// initialize
const init = (await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })).json()) as { result: { protocolVersion: string; serverInfo: { name: string } } }
ok('initialize negotiates the protocol + serverInfo', init.result.protocolVersion === desc.protocolVersion && init.result.serverInfo.name === 'aec-studio')

// tools/list
const list = (await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json()) as { result: { tools: { name: string }[] } }
ok('tools/list returns all 6 studio tools', list.result.tools.length === 6 && list.result.tools.some((t) => t.name === 'export_building'))

// tools/call export_building → a real IFC
const callRes = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'export_building', arguments: { gfa: 40000, storeys: 6, format: 'ifc' } } })
const call = (await callRes.json()) as { result: { isError?: boolean; content: { text: string }[] } }
const ifc = JSON.parse(call.result.content[0].text) as { content: string }
ok('tools/call export_building pulls a real IFC4 model', callRes.headers.get('access-control-allow-origin') === '*' && !call.result.isError && /^ISO-10303-21;/.test(ifc.content) && /IFCSTAIR\(/.test(ifc.content))

// JSON-RPC batch
const batch = (await (await post([{ jsonrpc: '2.0', id: 10, method: 'ping' }, { jsonrpc: '2.0', id: 11, method: 'tools/list' }])).json()) as unknown[]
ok('a JSON-RPC batch returns one response per request', Array.isArray(batch) && batch.length === 2)

// notification → 202, no body
const note = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
ok('a notification gets 202 with no JSON-RPC body', note.status === 202)

console.log(failures ? `\n${failures} check(s) failed` : '\nall HTTP MCP endpoint checks passed')
process.exit(failures ? 1 : 0)
