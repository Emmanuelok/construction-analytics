/* Public API toolkit — pure, unit-tested. The query/shape/auth logic behind the
 * read-only public dataset API, written framework-free so it runs identically in
 * the serverless handler and in tests. Shapes a safe public DTO (no file bytes /
 * storage paths), parses list query params (search/category/modality/license/
 * sort/pagination), validates API keys, and builds JSON envelopes. */

export type PublicDataset = {
  id: string
  name: string
  provider: string
  category: string
  modality: string
  license: string
  price: number | null
  quality: number
  rating: number
  downloads: number
  records: number
  sizeGB: number
  anonymized: boolean
  updated: string
  tags: string[]
  description: string
  sampleFiles: { name: string; format: string; rows?: number; free: boolean }[]
}

/* The minimal input shape we accept from the catalog (a structural subset of
 * CatalogDataset) so this module never imports UI/React types. */
export type CatalogLike = {
  id: string; name: string; provider: string; category: string; modality: string
  license: string; price: number | null; quality: number; rating: number; downloads: number
  records: number; sizeGB: number; anonymized: boolean; updated: string; tags: string[]; description: string
  files: { name: string; format: string; rows?: number; free: boolean }[]
}

/** Project a catalog row to the public DTO — drops file bytes, generators and storage paths. */
export function toPublic(d: CatalogLike): PublicDataset {
  return {
    id: d.id, name: d.name, provider: d.provider, category: d.category, modality: d.modality,
    license: d.license, price: d.price, quality: d.quality, rating: d.rating, downloads: d.downloads,
    records: d.records, sizeGB: d.sizeGB, anonymized: d.anonymized, updated: d.updated, tags: d.tags ?? [],
    description: d.description,
    sampleFiles: (d.files ?? []).map((f) => ({ name: f.name, format: f.format, rows: f.rows, free: f.free })),
  }
}

export type ListQuery = {
  search?: string
  category?: string
  modality?: string
  license?: string
  sort: 'rating' | 'downloads' | 'records' | 'price' | 'updated' | 'name'
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

const SORTS = new Set(['rating', 'downloads', 'records', 'price', 'updated', 'name'])
const clampInt = (v: unknown, def: number, lo: number, hi: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def
}

/** Parse URLSearchParams (or a plain record) into a normalized, safe ListQuery. */
export function parseListQuery(params: URLSearchParams | Record<string, string>): ListQuery {
  const get = (k: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k]
    return v == null || v === '' ? undefined : v
  }
  const sortRaw = (get('sort') ?? 'rating').toLowerCase()
  const sort = (SORTS.has(sortRaw) ? sortRaw : 'rating') as ListQuery['sort']
  const order = (get('order') ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  return {
    search: get('search')?.trim().toLowerCase(),
    category: get('category')?.trim().toLowerCase(),
    modality: get('modality')?.trim().toLowerCase(),
    license: get('license')?.trim().toLowerCase(),
    sort,
    order,
    page: clampInt(get('page'), 1, 1, 100000),
    pageSize: clampInt(get('pageSize') ?? get('limit'), 20, 1, 100),
  }
}

export type ListResult = { data: PublicDataset[]; meta: { total: number; page: number; pageSize: number; pages: number; sort: string; order: string } }

/** Filter, sort and paginate the public datasets per a parsed query. */
export function listDatasets(all: PublicDataset[], q: ListQuery): ListResult {
  let rows = all
  if (q.search) {
    const s = q.search
    rows = rows.filter((d) => d.name.toLowerCase().includes(s) || d.description.toLowerCase().includes(s) || d.tags.some((t) => t.toLowerCase().includes(s)) || d.provider.toLowerCase().includes(s))
  }
  if (q.category) rows = rows.filter((d) => d.category.toLowerCase() === q.category)
  if (q.modality) rows = rows.filter((d) => d.modality.toLowerCase() === q.modality)
  if (q.license) rows = rows.filter((d) => d.license.toLowerCase() === q.license)

  const dir = q.order === 'asc' ? 1 : -1
  const val = (d: PublicDataset): number | string => {
    switch (q.sort) {
      case 'name': return d.name.toLowerCase()
      case 'updated': return d.updated
      case 'price': return d.price ?? -1
      default: return d[q.sort]
    }
  }
  rows = [...rows].sort((a, b) => {
    const va = val(a), vb = val(b)
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return a.id.localeCompare(b.id)
  })

  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / q.pageSize))
  const page = Math.min(q.page, pages)
  const start = (page - 1) * q.pageSize
  return {
    data: rows.slice(start, start + q.pageSize),
    meta: { total, page, pageSize: q.pageSize, pages, sort: q.sort, order: q.order },
  }
}

export function findDataset(all: PublicDataset[], id: string): PublicDataset | undefined {
  return all.find((d) => d.id === id)
}

/* ---- API keys ---- */

/** A demo/dev key shown in the developer console. Format: aec_<32 hex>. */
export function generateApiKey(rand: () => number = Math.random): string {
  let hex = ''
  for (let i = 0; i < 32; i++) hex += Math.floor(rand() * 16).toString(16)
  return `aec_${hex}`
}

/** Validate a key's shape (the gate the public API enforces when keys are required). */
export function isValidKeyFormat(key: string | null | undefined): boolean {
  return typeof key === 'string' && /^aec_[0-9a-f]{32}$/.test(key)
}

/** Pull a bearer/x-api-key from a header map. */
export function extractApiKey(headers: { get(name: string): string | null } | Record<string, string | undefined>): string | null {
  const get = (n: string): string | null => {
    if (typeof (headers as { get?: unknown }).get === 'function') return (headers as { get(x: string): string | null }).get(n)
    const rec = headers as Record<string, string | undefined>
    return rec[n] ?? rec[n.toLowerCase()] ?? null
  }
  const authz = get('authorization') ?? ''
  if (/^bearer\s+/i.test(authz)) return authz.replace(/^bearer\s+/i, '').trim()
  return get('x-api-key')
}

/* ---- response envelopes ---- */

export function ok(data: unknown, extra: Record<string, unknown> = {}): { status: number; body: unknown } {
  return { status: 200, body: { ok: true, ...extra, ...(Array.isArray(data) ? { data } : (data as object)) } }
}
export function err(status: number, message: string, code?: string): { status: number; body: unknown } {
  return { status, body: { ok: false, error: message, ...(code ? { code } : {}) } }
}
