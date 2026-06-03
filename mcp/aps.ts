/* APS-backed helpers for the MCP server. Reuses the same server-side token logic
 * as the web app's /api/aps-* functions, so the MCP host can browse + extract data
 * from native models (Revit/Navisworks/AutoCAD) translated via Autodesk Platform
 * Services. Needs APS_CLIENT_ID + APS_CLIENT_SECRET in the MCP server's env. */

import { apsConfigured, apsToken, bucketKey, APS_HOST } from '../api/_aps.ts'
import { encodeUrn, normalizeUrn, translationProgress } from '../src/lib/aps.ts'

export { apsConfigured }

async function apsGet<T>(path: string, scope: string): Promise<T> {
  const token = await apsToken(scope)
  const r = await fetch(`${APS_HOST}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`APS GET ${path} failed (${r.status})`)
  return (await r.json()) as T
}

/** List the models uploaded to the studio's APS bucket. */
export async function listModels(): Promise<unknown> {
  const bucket = bucketKey()
  const data = await apsGet<{ items?: { objectKey: string; objectId: string; size: number }[] }>(`/oss/v2/buckets/${bucket}/objects?limit=100`, 'data:read bucket:read')
  return (data.items ?? []).map((o) => ({ objectKey: o.objectKey, urn: encodeUrn(o.objectId), sizeMB: Math.round((o.size / 1e6) * 10) / 10 }))
}

/** Translation status for a model URN (or raw objectId). */
export async function status(urnInput: string): Promise<unknown> {
  const urn = normalizeUrn(urnInput)
  const m = await apsGet<{ status?: string; progress?: string }>(`/modelderivative/v2/designdata/${urn}/manifest`, 'data:read').catch(() => null)
  return { urn, ...translationProgress(m) }
}

/** Start (or force) translation of a model to SVF2 for viewing + data extraction. */
export async function translate(urnInput: string): Promise<unknown> {
  const urn = normalizeUrn(urnInput)
  const token = await apsToken('data:read data:write')
  const r = await fetch(`${APS_HOST}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-ads-force': 'true' },
    body: JSON.stringify({ input: { urn }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] } }),
  })
  if (!r.ok) throw new Error(`Translate failed (${r.status})`)
  return r.json()
}

/** Extract element properties from a translated model (Model Derivative metadata
 *  → properties). Returns the viewable list + the first ~50 objects' properties. */
export async function properties(urnInput: string, guid?: string): Promise<unknown> {
  const urn = normalizeUrn(urnInput)
  const meta = await apsGet<{ data?: { metadata?: { name: string; guid: string; role: string }[] } }>(`/modelderivative/v2/designdata/${urn}/metadata`, 'data:read')
  const views = meta.data?.metadata ?? []
  const useGuid = guid || views[0]?.guid
  if (!useGuid) return { views, note: 'No viewable metadata yet — translate the model first.' }
  const props = await apsGet<{ data?: { collection?: unknown[] } }>(`/modelderivative/v2/designdata/${urn}/metadata/${useGuid}/properties`, 'data:read')
  const collection = props.data?.collection ?? []
  return {
    views: views.map((v) => ({ name: v.name, guid: v.guid, role: v.role })),
    guid: useGuid,
    objectCount: collection.length,
    objects: collection.slice(0, 50),
    note: collection.length > 50 ? `Showing 50 of ${collection.length} objects.` : undefined,
  }
}
