/* GET /api/datasets — the public, read-only dataset API.
 *   GET /api/datasets                 → list (search/category/modality/license/
 *                                        sort/order/page/pageSize)
 *   GET /api/datasets?id=<id>         → a single dataset
 * Returns the public DTO only (no file bytes, generators or storage paths).
 *
 * Auth: open by default for the demo. Set API_KEYS (comma-separated aec_… keys)
 * to require a key via `Authorization: Bearer <key>` or `x-api-key`. Keys are
 * only ever shape/allow-list checked here — never logged. CORS-enabled so the
 * API is callable from anywhere. */

import {
  parseListQuery,
  listDatasets,
  findDataset,
  extractApiKey,
  isValidKeyFormat,
  ok,
  err,
  type PublicDataset,
} from '../src/lib/apikit'
import DATASETS from './_datasets.json'

const ALL = DATASETS as unknown as PublicDataset[]

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, x-api-key, content-type',
}

function send(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60', ...CORS } })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET') { const e = err(405, 'Method not allowed', 'method_not_allowed'); return send(e.status, e.body) }

  // Optional API-key gate — active only when API_KEYS is configured on the server.
  const configured = (process.env.API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  if (configured.length) {
    const key = extractApiKey(req.headers)
    if (!isValidKeyFormat(key) || !configured.includes(key!)) {
      const e = err(401, 'A valid API key is required. Pass it as `Authorization: Bearer <key>` or `x-api-key`.', 'unauthorized')
      return send(e.status, e.body)
    }
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (id) {
    const d = findDataset(ALL, id)
    if (!d) { const e = err(404, `No dataset with id "${id}"`, 'not_found'); return send(e.status, e.body) }
    const r = ok(d)
    return send(r.status, r.body)
  }

  const q = parseListQuery(url.searchParams)
  const result = listDatasets(ALL, q)
  const r = ok({ data: result.data, meta: result.meta })
  return send(r.status, r.body)
}
