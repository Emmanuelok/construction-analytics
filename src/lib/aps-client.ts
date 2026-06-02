/* Browser side of the APS connector: probe availability, drive the
 * upload → translate → poll flow (the big file PUTs straight to APS S3, so it
 * never touches our function), and fetch a Viewer token. The secrets stay in
 * /api/aps-*; this only calls those endpoints. */

import { translationProgress } from './aps'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new Error(j.error || `${url} failed (${r.status})`)
  return j
}

/** Is the server configured for APS? (probes /api/aps-token) */
export async function apsEnabled(): Promise<boolean> {
  try {
    const r = await fetch('/api/aps-token')
    if (!r.ok) return false
    return Boolean(((await r.json()) as { enabled?: boolean }).enabled)
  } catch {
    return false
  }
}

export type ApsStep = { phase: string; percent: number }

/** Upload a native model to APS and translate it to SVF2 for the Viewer. Resolves
 *  with the URN once the translation succeeds. Reports progress via onStep. */
export async function uploadAndTranslate(file: File, onStep: (s: ApsStep) => void): Promise<string> {
  onStep({ phase: 'Requesting upload…', percent: 4 })
  const sign = await postJson<{ uploadUrl: string; objectKey: string; uploadKey: string }>('/api/aps-upload', { filename: file.name })

  onStep({ phase: 'Uploading model…', percent: 15 })
  const put = await fetch(sign.uploadUrl, { method: 'PUT', body: file })
  if (!put.ok) throw new Error(`Upload to APS failed (${put.status})`)

  onStep({ phase: 'Finalizing upload…', percent: 45 })
  const done = await postJson<{ urn: string }>('/api/aps-upload', { complete: true, objectKey: sign.objectKey, uploadKey: sign.uploadKey })

  onStep({ phase: 'Starting translation…', percent: 52 })
  await postJson('/api/aps-translate', { urn: done.urn })

  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const manifest = await fetch(`/api/aps-translate?urn=${encodeURIComponent(done.urn)}`).then((r) => r.json()).catch(() => null)
    const p = translationProgress(manifest)
    onStep({ phase: `Translating… ${p.percent}%`, percent: Math.min(99, 52 + p.percent * 0.47) })
    if (p.status === 'success') { onStep({ phase: 'Ready', percent: 100 }); return done.urn }
    if (p.status === 'failed' || p.status === 'timeout') throw new Error('APS translation failed for this file')
  }
  throw new Error('Translation timed out — try again or check the model in APS')
}

/** A short-lived Viewer token (viewables:read) for the Autodesk Viewer SDK. */
export async function viewerToken(): Promise<{ access_token: string; expires_in: number }> {
  return postJson('/api/aps-token', {})
}
