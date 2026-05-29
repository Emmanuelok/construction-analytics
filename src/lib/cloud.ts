import { DATASET_BUCKET, supabase } from './supabase'
import type { Accent } from '@/lib/nav'
import type { CatalogDataset, FileFormat, License, Modality } from '@/data/catalog'
import type { DownloadLog, LibraryItem } from '@/store/studio'

/* Maps between the app's CatalogDataset/library/download shapes and the
 * Supabase tables defined in supabase/migrations/0001_init.sql. All writes are
 * best-effort: callers fire-and-forget so a backend hiccup never breaks the UI.
 * Seller-uploaded file *bytes* are uploaded to Storage on publish; Postgres
 * rows hold only metadata (name/format/size/free) plus the storage path. */

type DatasetRow = {
  id: string
  name: string
  provider: string | null
  category: string | null
  modality: string | null
  license: string | null
  price: number | null
  quality: number | null
  rating: number | null
  downloads: number | null
  records: number | null
  size_gb: number | null
  anonymized: boolean | null
  description: string | null
  tags: string[] | null
  accent: string | null
  updated_at: string | null
  created_at: string | null
}

type FileRow = {
  dataset_id: string
  name: string
  format: string
  size: string | null
  rows: number | null
  free: boolean | null
  storage_path?: string | null
}

function rowToDataset(row: DatasetRow, files: FileRow[]): CatalogDataset {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider ?? '',
    category: row.category ?? '',
    modality: (row.modality ?? 'Tabular') as Modality,
    license: (row.license ?? 'Commercial') as License,
    price: row.price === null ? null : Number(row.price),
    quality: row.quality ?? 85,
    rating: Number(row.rating ?? 0),
    downloads: row.downloads ?? 0,
    records: Number(row.records ?? 0),
    sizeGB: Number(row.size_gb ?? 0),
    anonymized: Boolean(row.anonymized),
    updated: (row.updated_at ?? row.created_at ?? new Date().toISOString()).slice(0, 10),
    tags: row.tags ?? [],
    accent: (row.accent ?? 'lime') as Accent,
    description: row.description ?? '',
    files: files.map((f) => ({
      id: `${f.name}`,
      name: f.name,
      format: f.format as FileFormat,
      size: f.size ?? '',
      rows: f.rows ?? undefined,
      free: Boolean(f.free),
      storagePath: f.storage_path ?? undefined,
    })),
  }
}

function datasetToRow(d: CatalogDataset, owner: string) {
  return {
    id: d.id,
    owner,
    name: d.name,
    provider: d.provider,
    category: d.category,
    modality: d.modality,
    license: d.license,
    price: d.price,
    quality: d.quality,
    rating: d.rating,
    downloads: d.downloads,
    records: d.records,
    size_gb: d.sizeGB,
    anonymized: d.anonymized,
    description: d.description,
    tags: d.tags,
    accent: d.accent,
    published: true,
    updated_at: new Date().toISOString(),
  }
}

export type CloudSnapshot = { listings: CatalogDataset[]; library: LibraryItem[]; downloads: DownloadLog[] }

/** Load this user's own listings + licensed library + recent downloads. */
export async function loadCloud(userId: string): Promise<CloudSnapshot | null> {
  if (!supabase) return null
  const { data: ds } = await supabase.from('datasets').select('*').eq('owner', userId)
  const ids = (ds ?? []).map((d) => d.id)
  const { data: files } = ids.length
    ? await supabase.from('dataset_files').select('dataset_id,name,format,size,rows,free,storage_path').in('dataset_id', ids)
    : { data: [] as FileRow[] }
  const listings = (ds ?? []).map((d) => rowToDataset(d as DatasetRow, (files ?? []).filter((f) => f.dataset_id === d.id)))

  const { data: lic } = await supabase.from('licenses').select('*').eq('user_id', userId)
  const library: LibraryItem[] = (lic ?? []).map((l) => ({
    datasetId: l.dataset_id,
    tier: l.tier ?? 'Commercial',
    price: Number(l.price ?? 0),
    licensedAt: l.created_at,
  }))

  const { data: dl } = await supabase
    .from('downloads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  const downloads: DownloadLog[] = (dl ?? []).map((x) => ({ datasetId: x.dataset_id ?? '', fileName: x.file_name ?? '', at: x.created_at }))

  return { listings, library, downloads }
}

/** Upsert a published listing (metadata + file metadata, not file bytes). */
export async function pushListing(d: CatalogDataset, userId: string): Promise<void> {
  if (!supabase) return
  const sb = supabase
  const { error } = await sb.from('datasets').upsert(datasetToRow(d, userId))
  if (error) return void console.warn('pushListing:', error.message)
  await sb.from('dataset_files').delete().eq('dataset_id', d.id)
  if (!d.files.length) return

  // Upload seller-provided file bytes to Storage; record the path on each row.
  const rows = await Promise.all(
    d.files.map(async (f) => {
      let storage_path: string | null = f.storagePath ?? null
      if (f.content != null) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_')
        const path = `${userId}/${d.id}/${f.id}-${safe}`
        const { error: upErr } = await sb.storage
          .from(DATASET_BUCKET)
          .upload(path, new Blob([f.content], { type: 'text/plain' }), { upsert: true })
        if (upErr) console.warn('upload:', upErr.message)
        else storage_path = path
      }
      return { dataset_id: d.id, name: f.name, format: f.format, size: f.size, rows: f.rows ?? null, free: f.free, storage_path }
    }),
  )
  await sb.from('dataset_files').insert(rows)
}

/** Ask the license-checked /api/download endpoint for a short-lived signed URL. */
export async function signedDownloadUrl(input: {
  datasetId: string
  storagePath: string
  fileName?: string
  userId?: string
}): Promise<string | null> {
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

export async function removeListingCloud(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('datasets').delete().eq('id', id)
  if (error) console.warn('removeListing:', error.message)
}

export async function pushLicense(item: LibraryItem, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('licenses')
    .upsert({ user_id: userId, dataset_id: item.datasetId, tier: item.tier, price: item.price, status: 'active' }, { onConflict: 'user_id,dataset_id' })
  if (error) console.warn('pushLicense:', error.message)
}

export async function pushDownload(log: DownloadLog, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('downloads').insert({ user_id: userId, dataset_id: log.datasetId, file_name: log.fileName })
  if (error) console.warn('pushDownload:', error.message)
}
