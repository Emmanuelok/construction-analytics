/* Report builder — pure, unit-tested. Turns a workbench's KPIs, read-out and
 * key table into a self-contained, print-ready HTML brief (no dependencies, no
 * server) that the browser can Save-as-PDF, plus CSV export of the underlying
 * table. Every dynamic value is HTML-escaped. The reporting core behind the
 * Export control on each workbench. */

import type { KPI } from '@/lib/scenarios'

export type KPIItem = { label: string; value: string; sub?: string }
export type ReportTable = { title?: string; columns: string[]; rows: (string | number)[][] }
export type ReportSpec = {
  title: string
  subtitle?: string
  module: string
  kpis?: KPIItem[]
  narrative?: string
  table?: ReportTable
  generatedAt?: string // ISO; defaults to now
}

const round = (n: number, d = 1) => { const m = 10 ** d; return Math.round(n * m) / m }

function money(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `$${round(n / 1e9, 2)}B`
  if (a >= 1e6) return `$${round(n / 1e6, 1)}M`
  if (a >= 1e3) return `$${round(n / 1e3, 0)}K`
  return `$${Math.round(n)}`
}

/** Format a numeric KPI into a display item for a report. */
export function kpiToItem(k: KPI): KPIItem {
  let value: string
  if (k.unit === '$') value = money(k.value)
  else if (k.unit === '%') value = `${round(k.value, 1)}%`
  else if (k.unit === 'd') value = `${Math.round(k.value)} d`
  else value = Math.abs(k.value) >= 1000 ? Math.round(k.value).toLocaleString() : String(round(k.value, 2))
  return { label: k.label, value }
}

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build a CSV string from a table (RFC-4180-ish quoting). */
export function tableToCsv(table: ReportTable): string {
  const cell = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [table.columns.map(cell).join(','), ...table.rows.map((r) => r.map(cell).join(','))]
  return lines.join('\r\n')
}

/** Build a complete, self-contained, print-ready HTML document. */
export function buildReportHtml(spec: ReportSpec): string {
  const when = spec.generatedAt ?? new Date().toISOString()
  const date = new Date(when)
  const dateStr = Number.isNaN(date.getTime()) ? esc(when) : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })

  const kpis = (spec.kpis ?? [])
    .map((k) => `<div class="kpi"><div class="kpi-label">${esc(k.label)}</div><div class="kpi-value">${esc(k.value)}</div>${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ''}</div>`)
    .join('')

  const table = spec.table
    ? `<table><thead><tr>${spec.table.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${spec.table.rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(spec.title)} — Brief</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.55 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 40px 32px; }
  header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .eyebrow { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; font-weight: 600; }
  h1 { font-size: 24px; margin: 4px 0 0; letter-spacing: -.01em; }
  .subtitle { color: #475569; margin-top: 4px; }
  .meta { text-align: right; font-size: 12px; color: #64748b; white-space: nowrap; }
  .brand { font-weight: 700; color: #0f172a; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 0 0 24px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
  .kpi-label { font-size: 11px; color: #64748b; }
  .kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .narrative { background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0; padding: 12px 16px; color: #1e293b; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
  td { font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  @media print { .wrap { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body><div class="wrap">
  <header>
    <div><div class="eyebrow">AEC Data &amp; Intelligence Studio</div><h1>${esc(spec.title)}</h1>${spec.subtitle ? `<div class="subtitle">${esc(spec.subtitle)}</div>` : ''}</div>
    <div class="meta"><div class="brand">Board brief</div><div>${dateStr}</div></div>
  </header>
  ${kpis ? `<section class="kpis">${kpis}</section>` : ''}
  ${spec.narrative ? `<p class="narrative">${esc(spec.narrative)}</p>` : ''}
  ${spec.table?.title ? `<h2 style="font-size:14px;margin:0 0 8px">${esc(spec.table.title)}</h2>` : ''}
  ${table}
  <footer>Generated by the AEC Data &amp; Intelligence Studio · figures computed from the live workbench · ${esc(spec.module)}</footer>
</div></body></html>`
}
