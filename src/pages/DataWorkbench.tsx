import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Table2,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Database,
  UploadCloud,
  X,
  SigmaSquare,
  Pencil,
  Rows3,
  Columns3,
} from 'lucide-react'
import { useStudio } from '@/store/studio'
import { parseAny, profile, num, type Table } from '@/lib/parse'
import { readFileAsText, downloadText } from '@/lib/download'
import {
  editCell, addRow, deleteRows, duplicateRow, addColumn, renameColumn, deleteColumn,
  deriveColumn, sortIndices, viewIndices, toCsv, type SortDir, type FilterRule, type DeriveOp,
} from '@/lib/datagrid'
import { analyzableFileText } from '@/lib/flow-compute'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

const OPS: FilterRule['op'][] = ['>', '>=', '<', '<=', '=', '!=', 'contains', 'empty', 'not-empty']

export default function DataWorkbench() {
  const { allDatasets } = useStudio()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const sources = useMemo(
    () => allDatasets.filter((d) => d.files.some((f) => f.generate || f.content != null)),
    [allDatasets],
  )

  // history stack for undo/redo
  const [past, setPast] = useState<Table[]>([])
  const [table, setTable] = useState<Table>({ columns: [], rows: [] })
  const [future, setFuture] = useState<Table[]>([])
  const [sourceName, setSourceName] = useState('')
  const [dirty, setDirty] = useState(false)

  const [search, setSearch] = useState('')
  const [rules, setRules] = useState<FilterRule[]>([])
  const [sort, setSort] = useState<{ col: string; dir: SortDir } | null>(null)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<{ row: number; col: string } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [showDerive, setShowDerive] = useState(false)

  /** Apply a mutation, pushing the previous state to undo history. */
  function mutate(fn: (t: Table) => Table) {
    setPast((p) => [...p.slice(-49), table])
    setFuture([])
    setTable((t) => fn(t))
    setDirty(true)
  }
  function undo() {
    setPast((p) => {
      if (!p.length) return p
      setFuture((f) => [table, ...f])
      setTable(p[p.length - 1])
      return p.slice(0, -1)
    })
  }
  function redo() {
    setFuture((f) => {
      if (!f.length) return f
      setPast((p) => [...p, table])
      setTable(f[0])
      return f.slice(1)
    })
  }

  function load(t: Table, name: string) {
    setTable(t)
    setPast([])
    setFuture([])
    setSourceName(name)
    setDirty(false)
    setSel(new Set())
    setSort(null)
    setRules([])
    setSearch('')
  }
  function loadCatalog(id: string) {
    const d = sources.find((x) => x.id === id)
    const text = d && analyzableFileText(d.id)
    if (!d || !text) return
    load(parseAny(text), d.name)
  }
  async function loadUpload(file: File) {
    try {
      const t = parseAny(await readFileAsText(file))
      if (t.columns.length) load(t, file.name)
    } catch {
      /* ignore */
    }
  }

  // preload from ?dataset= or the first source
  useEffect(() => {
    const wanted = params.get('dataset')
    const target = (wanted && sources.find((d) => d.id === wanted)) || sources[0]
    if (target) loadCatalog(target.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cols = useMemo(() => profile(table), [table])
  const numericByName = useMemo(() => new Set(cols.filter((c) => c.type === 'number').map((c) => c.name)), [cols])
  const numericCols = useMemo(() => cols.filter((c) => c.type === 'number').map((c) => c.name), [cols])

  // visible row order: filter → sort
  const view = useMemo(() => {
    let idx = viewIndices(table, search, rules)
    if (sort) {
      const order = sortIndices(table, sort.col, sort.dir, numericByName.has(sort.col))
      const allow = new Set(idx)
      idx = order.filter((i) => allow.has(i))
    }
    return idx
  }, [table, search, rules, sort, numericByName])

  function toggleSort(col: string) {
    setSort((s) => (s?.col === col ? (s.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }))
  }

  function exportCsv() {
    downloadText(`${(sourceName || 'data').replace(/\.[^.]+$/, '')}_edited.csv`, toCsv(table), 'CSV')
  }

  // analyze the edited table in Analysis Studio (stash to sessionStorage)
  function analyzeEdited() {
    try {
      sessionStorage.setItem('aec-workbench-handoff', JSON.stringify({ name: sourceName, csv: toCsv(table) }))
    } catch {
      /* ignore */
    }
    navigate('/analyze?from=workbench')
  }

  const hasData = table.columns.length > 0
  const missing = useMemo(
    () => table.rows.reduce((s, r) => s + table.columns.filter((c) => (r[c] ?? '') === '').length, 0),
    [table],
  )

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="z-10 shrink-0 border-b border-edge/60 bg-base/80 px-4 py-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30">
            <Table2 className="h-4 w-4" />
          </span>
          <span className="mr-1 text-sm font-semibold text-slate-100">Data Workbench</span>

          <select
            value={sources.find((d) => d.name === sourceName)?.id ?? ''}
            onChange={(e) => loadCatalog(e.target.value)}
            className="rounded-lg border border-edge/70 bg-elevated/50 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="">Load dataset…</option>
            {sources.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !px-2.5 !py-1.5 !text-xs">
            <UploadCloud className="h-3.5 w-3.5" /> Upload
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.json,.geojson,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadUpload(f); e.target.value = '' }} />

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={undo} disabled={!past.length} className="btn-ghost !px-2 !py-1.5 !text-xs" title="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
            <button onClick={redo} disabled={!future.length} className="btn-ghost !px-2 !py-1.5 !text-xs" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
            <button onClick={exportCsv} disabled={!hasData} className="btn-ghost !px-2.5 !py-1.5 !text-xs"><Download className="h-3.5 w-3.5" /> Export</button>
            <button onClick={analyzeEdited} disabled={!hasData} className="btn-primary !px-3 !py-1.5 !text-xs"><Sparkles className="h-3.5 w-3.5" /> Analyze</button>
          </div>
        </div>

        {/* edit row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-edge/70 bg-elevated/40 px-2 py-1 focus-within:border-cyan-500/50">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all cells…" className="w-40 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none" />
          </div>
          <button onClick={() => mutate((t) => addRow(t))} disabled={!hasData} className="btn-ghost !px-2 !py-1 !text-[11px]"><Rows3 className="h-3 w-3" /> Row</button>
          <button onClick={() => mutate((t) => addColumn(t))} disabled={!hasData} className="btn-ghost !px-2 !py-1 !text-[11px]"><Columns3 className="h-3 w-3" /> Column</button>
          <button onClick={() => setShowDerive((v) => !v)} disabled={numericCols.length < 1} className="btn-ghost !px-2 !py-1 !text-[11px]"><SigmaSquare className="h-3 w-3" /> Derive</button>
          {sel.size > 0 && (
            <button onClick={() => { mutate((t) => deleteRows(t, sel)); setSel(new Set()) }} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10">
              <Trash2 className="h-3 w-3" /> Delete {sel.size} row{sel.size > 1 ? 's' : ''}
            </button>
          )}
          <FilterControl cols={cols.map((c) => c.name)} rules={rules} setRules={setRules} />
          <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
            <span><span className="data-mono text-slate-300">{formatNumber(view.length)}</span>/{formatNumber(table.rows.length)} rows</span>
            <span><span className="data-mono text-slate-300">{table.columns.length}</span> cols</span>
            <span><span className="data-mono text-slate-300">{numericCols.length}</span> numeric</span>
            <span className={missing ? 'text-amber-400/80' : ''}>{missing} empty</span>
            {dirty && <span className="text-cyan-300">● edited</span>}
          </span>
        </div>

        {showDerive && <DeriveControl numericCols={numericCols} onDerive={(name, a, op, b) => { mutate((t) => deriveColumn(t, name, a, op, b)); setShowDerive(false) }} onClose={() => setShowDerive(false)} />}
      </div>

      {/* grid */}
      <div className="min-h-0 flex-1 overflow-auto bg-base/50">
        {!hasData ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Database className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">Load a dataset or upload a file to start editing.</p>
            </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-panel/95 backdrop-blur">
                <th className="w-10 border-b border-r border-edge/60 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={sel.size > 0 && sel.size === view.length}
                    onChange={(e) => setSel(e.target.checked ? new Set(view) : new Set())}
                    className="accent-cyan-500"
                  />
                </th>
                {table.columns.map((c) => (
                  <th key={c} className="border-b border-r border-edge/60 px-2 py-1.5 font-medium">
                    {renaming === c ? (
                      <input
                        autoFocus
                        defaultValue={c}
                        onBlur={(e) => { mutate((t) => renameColumn(t, c, e.target.value)); setRenaming(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null) }}
                        className="w-28 rounded border border-cyan-500/50 bg-elevated px-1 py-0.5 text-xs text-slate-100 focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleSort(c)} className="flex items-center gap-1 text-slate-200 hover:text-white">
                          {c}
                          {sort?.col === c ? (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-cyan-400" /> : <ArrowDown className="h-3 w-3 text-cyan-400" />) : <ArrowUpDown className="h-3 w-3 text-slate-600" />}
                        </button>
                        {numericByName.has(c) && <span className="rounded bg-brand-500/15 px-1 text-[9px] text-brand-300">#</span>}
                        <span className="ml-auto flex items-center">
                          <button onClick={() => setRenaming(c)} className="text-slate-600 hover:text-slate-300" title="Rename"><Pencil className="h-2.5 w-2.5" /></button>
                          <button onClick={() => mutate((t) => deleteColumn(t, c))} className="ml-0.5 text-slate-600 hover:text-rose-300" title="Delete column"><X className="h-3 w-3" /></button>
                        </span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.map((rowIdx) => (
                <tr key={rowIdx} className={cn('group', sel.has(rowIdx) ? 'bg-cyan-500/10' : 'hover:bg-elevated/30')}>
                  <td className="border-b border-r border-edge/40 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={sel.has(rowIdx)}
                      onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(rowIdx) : n.delete(rowIdx); return n })}
                      className="accent-cyan-500"
                    />
                  </td>
                  {table.columns.map((c) => {
                    const isEditing = editing?.row === rowIdx && editing.col === c
                    const val = table.rows[rowIdx][c] ?? ''
                    return (
                      <td
                        key={c}
                        onClick={() => setEditing({ row: rowIdx, col: c })}
                        className={cn('cursor-text border-b border-r border-edge/40 px-2 py-1', numericByName.has(c) ? 'data-mono text-right text-slate-300' : 'text-slate-300')}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={val}
                            onBlur={(e) => { if (e.target.value !== val) mutate((t) => editCell(t, rowIdx, c, e.target.value)); setEditing(null) }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            className="w-full rounded border border-cyan-500/50 bg-elevated px-1 py-0.5 text-xs text-slate-100 focus:outline-none"
                          />
                        ) : val === '' ? (
                          <span className="text-slate-600">—</span>
                        ) : (
                          val
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- filter popover */
function FilterControl({ cols, rules, setRules }: { cols: string[]; rules: FilterRule[]; setRules: (r: FilterRule[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn('btn-ghost !px-2 !py-1 !text-[11px]', rules.length && 'border-cyan-500/50 text-cyan-300')}>
        <Filter className="h-3 w-3" /> Filter{rules.length ? ` (${rules.length})` : ''}
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-72 rounded-xl border border-edge/70 bg-surface p-3 shadow-2xl">
          {rules.map((r, i) => (
            <div key={i} className="mb-2 flex items-center gap-1">
              <select value={r.col} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, col: e.target.value } : x)))} className="flex-1 rounded border border-edge/70 bg-elevated/60 px-1 py-1 text-[11px] text-slate-200">
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={r.op} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, op: e.target.value as FilterRule['op'] } : x)))} className="rounded border border-edge/70 bg-elevated/60 px-1 py-1 text-[11px] text-slate-200">
                {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {!['empty', 'not-empty'].includes(r.op) && (
                <input value={r.value} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="value" className="w-14 rounded border border-edge/70 bg-elevated/60 px-1 py-1 text-[11px] text-slate-200" />
              )}
              <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-slate-600 hover:text-rose-300"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button onClick={() => setRules([...rules, { col: cols[0], op: '>', value: '' }])} className="text-[11px] text-cyan-300 hover:underline">+ Add rule</button>
            {rules.length > 0 && <button onClick={() => setRules([])} className="text-[11px] text-slate-500 hover:text-slate-300">Clear all</button>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- derive popover */
function DeriveControl({ numericCols, onDerive, onClose }: { numericCols: string[]; onDerive: (name: string, a: string, op: DeriveOp, b: string) => void; onClose: () => void }) {
  const [a, setA] = useState(numericCols[0] ?? '')
  const [op, setOp] = useState<DeriveOp>('+')
  const [b, setB] = useState(numericCols[1] ?? numericCols[0] ?? '')
  const [name, setName] = useState('')
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-edge/60 bg-elevated/30 px-2 py-1.5 text-[11px] text-slate-400">
      <span className="text-slate-500">New column</span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="w-24 rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-slate-200" />
      =
      <select value={a} onChange={(e) => setA(e.target.value)} className="rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-slate-200">{numericCols.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <select value={op} onChange={(e) => setOp(e.target.value as DeriveOp)} className="rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-slate-200">{['+', '-', '*', '/'].map((o) => <option key={o} value={o}>{o}</option>)}</select>
      <select value={b} onChange={(e) => setB(e.target.value)} className="rounded border border-edge/70 bg-elevated/60 px-1.5 py-1 text-slate-200">{numericCols.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <button onClick={() => onDerive(name, a, op, b)} className="btn-primary !px-2.5 !py-1 !text-[11px]"><Plus className="h-3 w-3" /> Add</button>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-3 w-3" /></button>
    </div>
  )
}
