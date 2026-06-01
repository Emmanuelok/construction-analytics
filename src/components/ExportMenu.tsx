import type { LucideIcon } from 'lucide-react'
import { Download, FileText, Printer, Table2 } from 'lucide-react'
import { ACCENT, type Accent } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { buildReportHtml, tableToCsv, type ReportSpec, type ReportTable } from '@/lib/report'
import { downloadText, openPrintable } from '@/lib/download'

/* A compact export control: a print-ready board brief (Save as PDF), a
 * downloadable self-contained HTML brief, and CSV of the key table. The page
 * supplies a ReportSpec built from its live KPIs / read-out / table. */
export function ExportMenu({ spec, csv, accent = 'blue' }: { spec: ReportSpec; csv?: ReportTable; accent?: Accent }) {
  const a = ACCENT[accent]
  const slug = `${spec.module}-${new Date().toISOString().slice(0, 10)}`
  const html = () => buildReportHtml(spec)
  const table = csv ?? spec.table

  const onPdf = () => { if (!openPrintable(html())) downloadText(`${slug}.html`, html(), 'HTML') }
  const onHtml = () => downloadText(`${slug}.html`, html(), 'HTML')
  const onCsv = () => { if (table) downloadText(`${slug}.csv`, tableToCsv(table), 'CSV') }

  return (
    <div className="flex items-center gap-1.5 rounded-2xl border border-edge/60 bg-surface/40 p-2">
      <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-inset', a.bg, a.text, a.ring)}>
        <Download className="h-3.5 w-3.5" /> Export
      </span>
      <ExportBtn onClick={onPdf} icon={Printer} title="Open a print-ready brief — Save as PDF">PDF</ExportBtn>
      <ExportBtn onClick={onHtml} icon={FileText} title="Download a self-contained HTML brief">HTML</ExportBtn>
      {table && <ExportBtn onClick={onCsv} icon={Table2} title="Export the table as CSV">CSV</ExportBtn>}
    </div>
  )
}

function ExportBtn({ onClick, icon: Icon, title, children }: { onClick: () => void; icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex items-center gap-1 rounded-lg border border-edge/70 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-elevated/60 hover:text-white">
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}
