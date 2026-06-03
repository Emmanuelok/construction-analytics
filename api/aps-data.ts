import { apsConfigured, apsToken, bucketKey, json, APS_HOST } from './_aps'
import { encodeUrn, normalizeUrn } from '../src/lib/aps'

/* GET  /api/aps-data — probe { enabled }.
 * POST /api/aps-data { action: 'list_models' }            → uploaded models + URNs.
 *                    { action: 'properties', urn, guid? } → element properties from
 *                      a translated model (Model Derivative metadata → properties). */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return json({ enabled: apsConfigured() })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!apsConfigured()) return json({ error: 'Autodesk APS is not configured on the server.' }, 501)

  let body: { action?: string; urn?: string; guid?: string }
  try { body = (await req.json()) as typeof body } catch { return json({ error: 'Invalid JSON body' }, 400) }

  try {
    if (body.action === 'list_models') {
      const token = await apsToken('data:read bucket:read')
      const r = await fetch(`${APS_HOST}/oss/v2/buckets/${bucketKey()}/objects?limit=100`, { headers: { authorization: `Bearer ${token}` } })
      if (!r.ok) return json({ error: `Listing models failed (${r.status})` }, 502)
      const d = (await r.json()) as { items?: { objectKey: string; objectId: string; size: number }[] }
      return json({ ok: true, result: (d.items ?? []).map((o) => ({ objectKey: o.objectKey, urn: encodeUrn(o.objectId), sizeMB: Math.round((o.size / 1e6) * 10) / 10 })) })
    }
    if (body.action === 'properties') {
      const urn = normalizeUrn(String(body.urn ?? ''))
      if (!urn) return json({ error: 'Missing urn' }, 400)
      const token = await apsToken('data:read')
      const meta = (await fetch(`${APS_HOST}/modelderivative/v2/designdata/${urn}/metadata`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json())) as { data?: { metadata?: { name: string; guid: string }[] } }
      const views = meta.data?.metadata ?? []
      const guid = body.guid || views[0]?.guid
      if (!guid) return json({ ok: true, result: { views, note: 'No viewable metadata yet — translate the model first.' } })
      const props = (await fetch(`${APS_HOST}/modelderivative/v2/designdata/${urn}/metadata/${guid}/properties`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json())) as { data?: { collection?: unknown[] } }
      const collection = props.data?.collection ?? []
      return json({ ok: true, result: { views: views.map((v) => ({ name: v.name, guid: v.guid })), objectCount: collection.length, objects: collection.slice(0, 50) } })
    }
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'APS data request failed' }, 502)
  }
}
