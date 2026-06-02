import { apsConfigured, apsToken, json } from './_aps'

/* GET  /api/aps-token — probe: { enabled } so the client shows the connector only
 *                       when APS is configured.
 * POST /api/aps-token — mint a browser-safe Viewer token (viewables:read only). */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return json({ enabled: apsConfigured() })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!apsConfigured()) return json({ error: 'Autodesk APS is not configured on the server.' }, 501)
  try {
    const access_token = await apsToken('viewables:read')
    return json({ access_token, expires_in: 3600 })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'APS token request failed' }, 502)
  }
}
