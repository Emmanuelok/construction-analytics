import { createClient } from '@supabase/supabase-js'

/* POST /api/download — returns a short-lived signed URL for a stored dataset
 * file, but only after verifying the requester may access it: the file is a
 * free sample, OR they own the dataset, OR they hold an active license. The
 * Storage SELECT policy is owner-only, so this service-role endpoint is the
 * only way other users obtain files — i.e. downloads require a license. */
const BUCKET = 'datasets'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supaUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return json({ error: 'Storage is not configured on the server.' }, 501)

  let body: { datasetId?: string; storagePath?: string; fileName?: string; userId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { datasetId, storagePath, fileName, userId } = body
  if (!datasetId || !storagePath) return json({ error: 'Missing datasetId or storagePath' }, 400)

  const supabase = createClient(supaUrl, supaKey)

  let allowed = false
  const { data: fileRow } = await supabase
    .from('dataset_files')
    .select('free')
    .eq('dataset_id', datasetId)
    .eq('storage_path', storagePath)
    .maybeSingle()
  if (fileRow?.free) allowed = true

  if (!allowed && userId) {
    const { data: ds } = await supabase.from('datasets').select('owner').eq('id', datasetId).maybeSingle()
    if (ds?.owner === userId) allowed = true
    if (!allowed) {
      const { data: lic } = await supabase
        .from('licenses')
        .select('id')
        .eq('user_id', userId)
        .eq('dataset_id', datasetId)
        .eq('status', 'active')
        .maybeSingle()
      if (lic) allowed = true
    }
  }

  if (!allowed) return json({ error: 'You need a license to download this file.' }, 403)

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60, { download: fileName ?? true })
  if (error || !data) return json({ error: error?.message ?? 'Could not create download link' }, 500)
  return json({ url: data.signedUrl })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
