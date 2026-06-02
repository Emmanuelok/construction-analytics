import { apsConfigured, apsToken, json, APS_HOST } from './_aps'

/* POST /api/aps-translate { urn }   → start a Model Derivative job → SVF2 (2d+3d).
 * GET  /api/aps-translate?urn=…      → return the translation manifest (poll this
 *                                      until status is 'success' or 'failed'). */
export default async function handler(req: Request): Promise<Response> {
  if (!apsConfigured()) return json({ error: 'Autodesk APS is not configured on the server.' }, 501)
  try {
    const token = await apsToken('data:read data:write')
    const auth = { authorization: `Bearer ${token}` }

    if (req.method === 'GET') {
      const urn = new URL(req.url).searchParams.get('urn')
      if (!urn) return json({ error: 'Missing urn' }, 400)
      const res = await fetch(`${APS_HOST}/modelderivative/v2/designdata/${urn}/manifest`, { headers: auth })
      if (res.status === 404) return json({ status: 'none' })
      if (!res.ok) return json({ error: `Manifest request failed (${res.status})` }, 502)
      return json(await res.json())
    }

    if (req.method === 'POST') {
      const { urn } = (await req.json()) as { urn?: string }
      if (!urn) return json({ error: 'Missing urn' }, 400)
      const res = await fetch(`${APS_HOST}/modelderivative/v2/designdata/job`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json', 'x-ads-force': 'true' },
        body: JSON.stringify({ input: { urn }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] } }),
      })
      if (!res.ok) return json({ error: `Starting translation failed (${res.status})` }, 502)
      return json(await res.json())
    }
    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'APS translate failed' }, 502)
  }
}
