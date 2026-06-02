import { apsConfigured, apsToken, bucketKey, json, APS_HOST } from './_aps'
import { encodeUrn, objectKeyFor } from '../src/lib/aps'

/* POST /api/aps-upload
 *   { filename }                          → ensure bucket, return a signed S3 upload
 *                                           URL the browser PUTs the file to directly
 *                                           (keeps big .rvt files off the function).
 *   { complete, objectKey, uploadKey }    → finalize the upload, return the URN. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!apsConfigured()) return json({ error: 'Autodesk APS is not configured on the server.' }, 501)

  let body: { filename?: string; complete?: boolean; objectKey?: string; uploadKey?: string }
  try { body = (await req.json()) as typeof body } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const bucket = bucketKey()
  try {
    const token = await apsToken('data:read data:write bucket:create bucket:read')
    const auth = { authorization: `Bearer ${token}` }

    if (body.complete) {
      const res = await fetch(`${APS_HOST}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(body.objectKey || '')}/signeds3upload`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ uploadKey: body.uploadKey }),
      })
      if (!res.ok) return json({ error: `Finalizing the upload failed (${res.status})` }, 502)
      const obj = (await res.json()) as { objectId: string }
      return json({ urn: encodeUrn(obj.objectId), objectId: obj.objectId })
    }

    // ensure the bucket exists (ignore "already owned")
    await fetch(`${APS_HOST}/oss/v2/buckets`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ bucketKey: bucket, policyKey: 'transient' }),
    }).catch(() => {})

    const objectKey = objectKeyFor(String(body.filename || 'model'))
    const sres = await fetch(`${APS_HOST}/oss/v2/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload?minutesExpiration=30`, { headers: auth })
    if (!sres.ok) return json({ error: `Requesting an upload URL failed (${sres.status})` }, 502)
    const s = (await sres.json()) as { uploadKey: string; urls: string[] }
    return json({ bucketKey: bucket, objectKey, uploadKey: s.uploadKey, uploadUrl: s.urls[0] })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'APS upload failed' }, 502)
  }
}
