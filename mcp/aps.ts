/* APS-backed helpers for the MCP server. Reuses the same server-side token logic
 * as the web app's /api/aps-* functions, so the MCP host can browse + extract data
 * from native models (Revit/Navisworks/AutoCAD) translated via Autodesk Platform
 * Services. Needs APS_CLIENT_ID + APS_CLIENT_SECRET in the MCP server's env. */

import { apsConfigured, apsToken, bucketKey, APS_HOST } from '../api/_aps.ts'
import { encodeUrn, normalizeUrn, objectKeyFor, translationProgress } from '../src/lib/aps.ts'

export { apsConfigured }

async function apsGet<T>(path: string, scope: string): Promise<T> {
  const token = await apsToken(scope)
  const r = await fetch(`${APS_HOST}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`APS GET ${path} failed (${r.status})`)
  return (await r.json()) as T
}

/** Upload a generated model (IFC/OBJ text or bytes) to the studio's APS bucket via
 *  the OSS signed-S3 flow, returning its URN so it can be translated + viewed. */
export async function uploadModel(filename: string, content: string | Uint8Array): Promise<{ urn: string; objectId: string; objectKey: string; bytes: number }> {
  const bucket = bucketKey()
  const token = await apsToken('data:read data:write bucket:create bucket:read')
  const auth = { authorization: `Bearer ${token}` }
  // ensure the bucket exists (ignore "already owned")
  await fetch(`${APS_HOST}/oss/v2/buckets`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ bucketKey: bucket, policyKey: 'transient' }) }).catch(() => {})
  const objectKey = objectKeyFor(filename)
  const sres = await fetch(`${APS_HOST}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload?minutesExpiration=30`, { headers: auth })
  if (!sres.ok) throw new Error(`Requesting an upload URL failed (${sres.status})`)
  const s = (await sres.json()) as { uploadKey: string; urls: string[] }
  const body = typeof content === 'string' ? new TextEncoder().encode(content) : content
  const put = await fetch(s.urls[0], { method: 'PUT', body })
  if (!put.ok) throw new Error(`Uploading to storage failed (${put.status})`)
  const fin = await fetch(`${APS_HOST}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ uploadKey: s.uploadKey }) })
  if (!fin.ok) throw new Error(`Finalizing the upload failed (${fin.status})`)
  const obj = (await fin.json()) as { objectId: string }
  return { urn: encodeUrn(obj.objectId), objectId: obj.objectId, objectKey, bytes: body.byteLength }
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
