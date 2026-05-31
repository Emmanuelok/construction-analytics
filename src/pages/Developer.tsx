import { useMemo, useState } from 'react'
import { Code2, KeyRound, Copy, Check, Play, RefreshCw, Terminal, BookOpen, Database } from 'lucide-react'
import { PageHeader, Card, CardHeader, Badge, StatTile } from '@/components/ui'
import { CATALOG } from '@/data/catalog'
import { cn } from '@/lib/cn'
import { useAuth } from '@/store/auth'
import {
  toPublic,
  parseListQuery,
  listDatasets,
  findDataset,
  generateApiKey,
  type CatalogLike,
  type PublicDataset,
} from '@/lib/apikit'

const KEY_STORE = 'aec-api-key'
const PUBLIC: PublicDataset[] = CATALOG.map((d) => toPublic(d as unknown as CatalogLike))
const CATEGORIES = [...new Set(PUBLIC.map((d) => d.category))].sort()

function loadKey(uid: string): string {
  const k = `${KEY_STORE}::${uid}`
  try {
    const existing = localStorage.getItem(k)
    if (existing) return existing
    const fresh = generateApiKey()
    localStorage.setItem(k, fresh)
    return fresh
  } catch {
    return generateApiKey()
  }
}

export default function Developer() {
  const { user } = useAuth()
  const uid = user?.id ?? 'demo'
  const [apiKey, setApiKey] = useState(() => loadKey(uid))

  // Live request builder — runs against the same apikit the server uses.
  const [path, setPath] = useState('/api/datasets')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('rating')
  const [pageSize, setPageSize] = useState('5')
  const [byId, setById] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (byId) { p.set('id', byId); return p }
    if (search) p.set('search', search)
    if (category) p.set('category', category)
    if (sort) p.set('sort', sort)
    if (pageSize) p.set('pageSize', pageSize)
    return p
  }, [byId, search, category, sort, pageSize])

  const url = `${path}${query.toString() ? `?${query}` : ''}`
  const fullUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${url}`

  const response = useMemo(() => {
    if (byId) {
      const d = findDataset(PUBLIC, byId)
      return d ? { ok: true, ...d } : { ok: false, error: `No dataset with id "${byId}"`, code: 'not_found' }
    }
    const r = listDatasets(PUBLIC, parseListQuery(query))
    return { ok: true, data: r.data, meta: r.meta }
  }, [byId, query])

  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(tag); setTimeout(() => setCopied(null), 1500)
  }
  const regen = () => {
    const fresh = generateApiKey()
    try { localStorage.setItem(`${KEY_STORE}::${uid}`, fresh) } catch { /* ignore */ }
    setApiKey(fresh)
  }

  const curl = `curl "${fullUrl}" \\\n  -H "Authorization: Bearer ${apiKey}"`
  const js = `const res = await fetch("${fullUrl}", {\n  headers: { Authorization: "Bearer ${apiKey}" },\n});\nconst { data, meta } = await res.json();`

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Code2}
        accent="violet"
        eyebrow="Platform"
        title="Developer & API"
        description="A read-only public API over the dataset catalog. Generate a key, build a request, and get JSON — list, filter, sort and paginate datasets, or fetch one by id. The same engine that powers /api/datasets runs live in the playground below."
        actions={<Badge variant="violet" dot>v1 · REST + JSON</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Datasets exposed" value={String(PUBLIC.length)} icon={Database} accent="violet" sub="Public catalog" />
        <StatTile label="Endpoints" value="2" icon={Terminal} accent="cyan" sub="list · get-by-id" />
        <StatTile label="Auth" value="Bearer key" icon={KeyRound} accent="emerald" sub="or x-api-key header" />
        <StatTile label="Format" value="JSON" icon={Code2} accent="amber" sub="CORS-enabled" />
      </div>

      {/* API key */}
      <Card>
        <CardHeader icon={KeyRound} accent="violet" title="Your API key" subtitle="Sent as a Bearer token. Kept in this browser; regenerate any time." />
        <div className="flex flex-wrap items-center gap-3 border-t border-edge/50 p-5">
          <code className="flex-1 truncate rounded-lg border border-edge/60 bg-elevated/50 px-3 py-2 font-mono text-sm text-violet-200">{apiKey}</code>
          <button onClick={() => copy(apiKey, 'key')} className="btn-ghost">{copied === 'key' ? <><Check className="h-4 w-4 text-emerald-300" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}</button>
          <button onClick={regen} className="btn-ghost"><RefreshCw className="h-4 w-4" /> Regenerate</button>
        </div>
      </Card>

      {/* playground */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Play} accent="violet" title="Request builder" subtitle="Compose a call to /api/datasets" />
          <div className="space-y-4 border-t border-edge/50 p-5">
            <Field label="Fetch by id (overrides filters)">
              <select value={byId} onChange={(e) => setById(e.target.value)} className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none">
                <option value="">— list mode —</option>
                {PUBLIC.map((d) => (<option key={d.id} value={d.id}>{d.id}</option>))}
              </select>
            </Field>
            <div className={cn('space-y-4', byId && 'pointer-events-none opacity-40')}>
              <Field label="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. carbon, drone, cost" className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="category">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none">
                    <option value="">any</option>
                    {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </Field>
                <Field label="sort">
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-100 focus:outline-none">
                    {['rating', 'downloads', 'records', 'price', 'updated', 'name'].map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </Field>
              </div>
              <Field label="pageSize"><input type="number" min={1} max={100} value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="w-28 rounded-lg border border-edge/60 bg-elevated/50 px-3 py-1.5 text-sm text-slate-100 data-mono focus:outline-none" /></Field>
            </div>
            <div className="rounded-lg border border-edge/60 bg-base/60 p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Request URL</div>
              <code className="block break-all font-mono text-xs text-cyan-200">GET {url}</code>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Terminal} accent="cyan" title="Live response" subtitle="200 OK · application/json" action={<button onClick={() => copy(JSON.stringify(response, null, 2), 'res')} className="btn-ghost h-8 px-2 py-0 text-xs">{copied === 'res' ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} JSON</button>} />
          <pre className="max-h-[420px] overflow-auto border-t border-edge/50 p-4 text-[11.5px] leading-relaxed text-slate-300"><code className="font-mono">{JSON.stringify(response, null, 2)}</code></pre>
        </Card>
      </div>

      {/* code snippets */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Snippet title="curl" code={curl} onCopy={() => copy(curl, 'curl')} copied={copied === 'curl'} />
        <Snippet title="JavaScript (fetch)" code={js} onCopy={() => copy(js, 'js')} copied={copied === 'js'} />
      </div>

      {/* reference */}
      <Card>
        <CardHeader icon={BookOpen} accent="violet" title="Endpoint reference" subtitle="v1 · stable" />
        <div className="space-y-4 border-t border-edge/50 p-5 text-sm">
          <Endpoint method="GET" path="/api/datasets" desc="List datasets. Query params:" params={[
            ['search', 'free-text over name, description, tags, provider'],
            ['category', 'exact category match'],
            ['modality', 'Tabular · Imagery · BIM Model · Document · …'],
            ['license', 'Open · Research · Commercial · Enterprise'],
            ['sort', 'rating · downloads · records · price · updated · name'],
            ['order', 'asc · desc (default desc)'],
            ['page / pageSize', 'pagination (pageSize ≤ 100, default 20)'],
          ]} />
          <Endpoint method="GET" path="/api/datasets?id=<id>" desc="Fetch a single dataset by id. Returns 404 if unknown." params={[]} />
          <p className="text-xs text-slate-500">Responses are <code className="text-slate-300">{`{ ok, data, meta }`}</code> for lists and <code className="text-slate-300">{`{ ok, ...dataset }`}</code> for a single record. File <em>bytes</em> are never exposed — only sample-file metadata. Auth is required only when the server sets <code className="text-slate-300">API_KEYS</code>.</p>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>{children}</label>
}

function Snippet({ title, code, onCopy, copied }: { title: string; code: string; onCopy: () => void; copied: boolean }) {
  return (
    <Card>
      <CardHeader icon={Code2} accent="cyan" title={title} action={<button onClick={onCopy} className="btn-ghost h-8 px-2 py-0 text-xs">{copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />} Copy</button>} />
      <pre className="overflow-x-auto border-t border-edge/50 p-4 text-[12px] leading-relaxed text-cyan-200/90"><code className="font-mono">{code}</code></pre>
    </Card>
  )
}

function Endpoint({ method, path, desc, params }: { method: string; path: string; desc: string; params: [string, string][] }) {
  return (
    <div className="rounded-xl border border-edge/60 bg-elevated/30 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 ring-1 ring-inset ring-emerald-500/30">{method}</span>
        <code className="font-mono text-sm text-slate-100">{path}</code>
      </div>
      <p className="mt-2 text-slate-400">{desc}</p>
      {params.length > 0 && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[160px_1fr]">
          {params.map(([k, v]) => (<div key={k} className="contents"><dt className="font-mono text-xs text-violet-300">{k}</dt><dd className="text-xs text-slate-400">{v}</dd></div>))}
        </dl>
      )}
    </div>
  )
}
