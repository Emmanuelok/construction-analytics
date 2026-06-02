/* Autodesk Platform Services (APS / Forge) helpers — the client-safe, pure core
 * for translating + viewing native CAD/BIM (.rvt, .dwg, .nwd, …). The secret-bearing
 * calls live in /api/aps-*; this module holds the deterministic bits (URN base64url
 * encoding, manifest status, bucket/object keys, the Viewer SDK URLs) so they can be
 * unit-tested. Nothing here needs network or secrets. */

const b64encode = (s: string): string => (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'utf8').toString('base64'))
const b64decode = (s: string): string => (typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('utf8'))

/** Encode an APS objectId (urn:adsk.objects:…) as the base64url URN the Model
 *  Derivative + Viewer APIs expect (URL-safe, no padding). */
export function encodeUrn(objectId: string): string {
  return b64encode(objectId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a base64url URN back to its objectId. */
export function decodeUrn(urn: string): string {
  return b64decode(urn.replace(/-/g, '+').replace(/_/g, '/'))
}

/** Accept a raw objectId or an already-encoded URN (optionally `urn:`-prefixed) and
 *  return the bare base64url URN used by the APIs. */
export function normalizeUrn(input: string): string {
  const s = input.trim()
  if (s.startsWith('urn:adsk.')) return encodeUrn(s)
  return s.replace(/^urn:/, '')
}

export type TranslationStatus = 'none' | 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout'

/** Interpret a Model Derivative manifest into a status + percent for the UI. */
export function translationProgress(manifest: { status?: string; progress?: string } | null | undefined): { status: TranslationStatus; percent: number } {
  if (!manifest || !manifest.status) return { status: 'none', percent: 0 }
  const status = manifest.status as TranslationStatus
  if (status === 'success') return { status, percent: 100 }
  const m = /(\d+)\s*%/.exec(manifest.progress ?? '')
  const percent = m ? Math.max(0, Math.min(100, Number(m[1]))) : status === 'inprogress' ? 5 : 0
  return { status, percent }
}

/** A deterministic, APS-legal bucket key (lowercase, namespaced to the client). */
export function bucketKeyFor(clientId: string): string {
  const id = clientId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  return `aecstudio${id || 'default'}`
}

/** A safe, unique object key for an uploaded file. */
export function objectKeyFor(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return `${Date.now()}-${base}`
}

// Formats the Model Derivative service can translate to SVF (for the Viewer).
export const TRANSLATABLE = ['rvt', 'rfa', 'rte', 'dwg', 'dwf', 'dwfx', 'nwd', 'nwc', 'ifc', 'dgn', '3dm', 'sat', 'step', 'stp', 'iges', 'igs', 'fbx', 'obj', 'gltf', 'glb', 'stl', 'skp', 'iam', 'ipt', 'catpart', 'prt', 'sldprt', 'sldasm']

export function isTranslatable(filename: string): boolean {
  return TRANSLATABLE.includes(filename.split('.').pop()?.toLowerCase() ?? '')
}

// The Autodesk Viewer SDK (loaded from APS's CDN at runtime — no npm dependency).
export const APS_VIEWER_VERSION = '7.*'
export const apsViewerScript = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${APS_VIEWER_VERSION}/viewer3D.min.js`
export const apsViewerCss = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${APS_VIEWER_VERSION}/style.min.css`
