'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Star, Download, Database, Store, ChevronDown, ShieldCheck, Layers } from 'lucide-react'
import { DATASETS, CATEGORIES, LICENSES, filterDatasets, priceLabel, compactNum, type SortKey, type Dataset } from '@/lib/catalog'

const ease = [0.16, 1, 0.3, 1] as const

const LICENSE_TINT: Record<string, string> = {
  Open: 'bg-emerald-500/15 text-emerald-300',
  Research: 'bg-cyan-500/15 text-cyan-300',
  Commercial: 'bg-brand-500/15 text-brand-300',
  Enterprise: 'bg-violet-500/15 text-violet-300',
}

const selectCls =
  'rounded-lg border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-200 focus:border-brand-500/50 focus:outline-none'

export function DataCenter({ appUrl }: { appUrl: string }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [license, setLicense] = useState('All')
  const [sort, setSort] = useState<SortKey>('popular')
  const [expanded, setExpanded] = useState<string | null>(null)

  const results = useMemo(() => filterDatasets(DATASETS, { q, category, license, sort }), [q, category, license, sort])
  const totalRecords = useMemo(() => DATASETS.reduce((s, d) => s + d.records, 0), [])

  return (
    <section id="data" className="scroll-mt-20 border-y border-edge/50 bg-panel/40">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-400">Data Center</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Browse the marketplace.</h2>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-400">
              Search, filter and preview standardized AEC datasets — {DATASETS.length} shown, {compactNum(totalRecords)}+
              records. This catalog is live: type, filter, sort, expand.
            </p>
          </div>
          <a href={appUrl} className="inline-flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-brand-500/40">
            <Store className="h-4 w-4 text-emerald-400" /> Open full Data Center
          </a>
        </div>

        {/* controls */}
        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3 py-2 focus-within:border-brand-500/50">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search datasets, providers, tags…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={license} onChange={(e) => setLicense(e.target.value)} className={selectCls} aria-label="License">
              <option value="All">All licenses</option>
              {LICENSES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls} aria-label="Sort">
              <option value="popular">Most popular</option>
              <option value="quality">Highest quality</option>
              <option value="records">Most records</option>
              <option value="price-low">Price: low → high</option>
            </select>
          </div>
        </div>

        {/* category chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['All', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                c === category ? 'border-brand-500/40 bg-brand-500/10 text-brand-200' : 'border-edge/70 bg-elevated/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* result count */}
        <div className="mt-5 text-sm text-slate-400">
          <span className="font-semibold text-slate-200">{results.length}</span> dataset{results.length !== 1 ? 's' : ''}
          {q && <> matching “<span className="text-slate-200">{q}</span>”</>}
        </div>

        {/* results */}
        {results.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-edge/60 bg-elevated/20 p-12 text-center text-slate-500">
            <Search className="mx-auto h-6 w-6 text-slate-600" />
            <p className="mt-3 text-sm">No datasets match those filters. Try clearing the search or category.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((d) => (
              <DatasetCard key={d.id} d={d} expanded={expanded === d.id} onToggle={() => setExpanded(expanded === d.id ? null : d.id)} appUrl={appUrl} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function DatasetCard({ d, expanded, onToggle, appUrl }: { d: Dataset; expanded: boolean; onToggle: () => void; appUrl: string }) {
  const free = d.price === 0
  return (
    <motion.div layout className="card flex flex-col p-5 transition-colors hover:border-brand-500/40">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${LICENSE_TINT[d.license]}`}>
          <ShieldCheck className="h-3 w-3" /> {d.license}
        </span>
        <span className={`font-mono text-sm font-semibold ${free ? 'text-emerald-400' : 'text-slate-200'}`}>{priceLabel(d.price)}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-white">{d.name}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{d.provider}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-y border-edge/50 py-3 text-center">
        <Metric label="records" value={compactNum(d.records)} />
        <Metric label="type" value={d.modality.split(' ')[0]} />
        <Metric label="rating" value={`★ ${d.rating}`} />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-sm leading-relaxed text-slate-400">{d.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span key={t} className="rounded-md bg-elevated/60 px-2 py-0.5 text-[11px] text-slate-400">#{t}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {d.category}</span>
              <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> {compactNum(d.downloads)} downloads</span>
              <span className="inline-flex items-center gap-1"><Database className="h-3 w-3" /> q{d.quality}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button onClick={onToggle} className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Less' : 'Preview'}
        </button>
        <a href={appUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-400">
          {free ? <Download className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />} {free ? 'Get free' : 'License'}
        </a>
      </div>
    </motion.div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold text-slate-200">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
    </div>
  )
}
