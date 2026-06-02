/* Shared Autodesk Platform Services (APS) server helpers. The client id/secret
 * never leave the server: these mint short-lived 2-legged tokens and broker the
 * OSS + Model Derivative calls. Configure APS_CLIENT_ID + APS_CLIENT_SECRET. */

export const APS_HOST = 'https://developer.api.autodesk.com'

export function apsConfigured(): boolean {
  return Boolean(process.env.APS_CLIENT_ID && process.env.APS_CLIENT_SECRET)
}

/** Mint a 2-legged (client-credentials) token for the given scope. */
export async function apsToken(scope: string): Promise<string> {
  const id = process.env.APS_CLIENT_ID as string
  const secret = process.env.APS_CLIENT_SECRET as string
  const res = await fetch(`${APS_HOST}/authentication/v2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  })
  if (!res.ok) throw new Error(`APS authentication failed (${res.status})`)
  return ((await res.json()) as { access_token: string }).access_token
}

/** A deterministic, APS-legal bucket key namespaced to this client. */
export function bucketKey(): string {
  const id = (process.env.APS_CLIENT_ID || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  return `aecstudio${id || 'default'}`
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
