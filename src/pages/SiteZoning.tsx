import { lazy, Suspense, useMemo, useState } from 'react'
import { Map as MapIcon, Maximize2, Building2, Layers, CheckCircle2, XCircle, RotateCcw, Upload, AlertTriangle, Download, FileJson } from 'lucide-react'
import { PageHeader, StatTile, Card, CardHeader, Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { PolygonEditor } from '@/components/PolygonEditor'
import { ScrollableTable } from '@/components/ScrollableTable'
import { downloadText } from '@/lib/download'
import { tableToCsv, type ReportTable } from '@/lib/report'
import {
  buildZoning, rectSite, parseGeoBoundary, scalePolygon, polygonArea, polygonCentroid,
  type Pt, type Zoning,
} from '@/lib/zoning'

const SiteZoningViewer = lazy(() => import('@/components/SiteZoningViewer').then((m) => ({ default: m.SiteZoningViewer })))

const ACC = 'teal' as const

/* Preset site boundaries (metres, centred on origin). */
const PRESETS: { id: string; label: string; pts: Pt[] }[] = [
  { id: 'rect', label: 'Rectangular lot', pts: rectSite(60, 45) },
  { id: 'corner', label: 'Corner lot', pts: [{ x: -35, z: -25 }, { x: 35, z: -25 }, { x: 35, z: 10 }, { x: 5, z: 10 }, { x: 5, z: 25 }, { x: -35, z: 25 }] },
  { id: 'wedge', label: 'Wedge / through-lot', pts: [{ x: -40, z: -20 }, { x: 40, z: -28 }, { x: 30, z: 26 }, { x: -30, z: 22 }] },
]

const DEFAULTS = { far: 4, heightLimit: 60, setback: 6, maxCoverage: 55, storeyHeight: 3.6, proposedGFA: 9000, proposedStoreys: 14, podium: 0.3, towerSetback: 0.35, skyBase: 24, skyStep: 0.3 }

export default function SiteZoning() {
  const [boundary, setBoundary] = useState<Pt[]>(PRESETS[0].pts)
  const [far, setFar] = useState(DEFAULTS.far)
  const [heightLimit, setHeightLimit] = useState(DEFAULTS.heightLimit)
  const [setback, setSetback] = useState(DEFAULTS.setback)
  const [maxCoverage, setMaxCoverage] = useState(DEFAULTS.maxCoverage)
  const [storeyHeight, setStoreyHeight] = useState(DEFAULTS.storeyHeight)
  const [proposedGFA, setProposedGFA] = useState(DEFAULTS.proposedGFA)
  const [proposedStoreys, setProposedStoreys] = useState(DEFAULTS.proposedStoreys)
  const [podium, setPodium] = useState(DEFAULTS.podium)
  const [towerSetback, setTowerSetback] = useState(DEFAULTS.towerSetback)
  const [skyBase, setSkyBase] = useState(DEFAULTS.skyBase)
  const [skyStep, setSkyStep] = useState(DEFAULTS.skyStep)
  const [geoText, setGeoText] = useState('')
  const [geoError, setGeoError] = useState<string | null>(null)
  // bumping this remounts the boundary editor so it refits its view after a
  // preset / import / reset; plain drags keep the same key (no jump).
  const [boundaryKey, setBoundaryKey] = useState(0)
  const applyBoundary = (pts: Pt[]) => { setBoundary(pts); setBoundaryKey((k) => k + 1) }

  const z: Zoning = useMemo(
    () => buildZoning({ boundary, far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep }),
    [boundary, far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep],
  )

  const reset = () => {
    applyBoundary(PRESETS[0].pts); setFar(DEFAULTS.far); setHeightLimit(DEFAULTS.heightLimit); setSetback(DEFAULTS.setback)
    setMaxCoverage(DEFAULTS.maxCoverage); setStoreyHeight(DEFAULTS.storeyHeight); setProposedGFA(DEFAULTS.proposedGFA)
    setProposedStoreys(DEFAULTS.proposedStoreys); setPodium(DEFAULTS.podium); setTowerSetback(DEFAULTS.towerSetback)
    setSkyBase(DEFAULTS.skyBase); setSkyStep(DEFAULTS.skyStep); setGeoText(''); setGeoError(null)
  }
  const importGeo = () => {
    const pts = parseGeoBoundary(geoText)
    if (!pts) { setGeoError('Could not find a polygon ring. Paste a GeoJSON Polygon/Feature or a [[x,y],…] ring.'); return }
    setGeoError(null); applyBoundary(pts)
  }

  // structured data extracted from the zoning model — tier schedule + exports
  const tierRows = (): (string | number)[][] => [
    ...z.tiers.map((t, i) => [z.tiers.length > 1 ? (i === 0 ? 'Proposed podium' : 'Proposed tower') : 'Proposed mass', Math.round(t.footprint), Math.round(t.base), Math.round(t.top)]),
    ...z.envelopeTiers.map((t, i) => [z.envelopeTiers.length > 1 ? (i === 0 ? 'Envelope base' : 'Envelope upper') : 'Envelope', Math.round(t.footprint), Math.round(t.base), Math.round(t.top)]),
  ]
  const zoningCsv = (): string => {
    const summary: ReportTable = {
      title: 'Site & Zoning summary',
      columns: ['Metric', 'Value', 'Unit', 'Status / note'],
      rows: [
        ['Site area', Math.round(z.siteArea), 'm2', ''],
        ['Site perimeter', Math.round(z.sitePerimeter), 'm', ''],
        ['Buildable area', Math.round(z.buildableArea), 'm2', `${setback} m setback`],
        ['Max GFA', Math.round(z.maxGFA), 'm2', `FAR ${far}`],
        ['Proposed GFA', Math.round(proposedGFA), 'm2', z.compliance.far ? 'OK' : 'OVER'],
        ['Capacity used', Math.round(z.utilisation), '%', ''],
        ['Proposed height', Math.round(z.proposed.height), 'm', `${z.compliance.height ? 'OK' : 'OVER'} (limit ${z.maxHeight})`],
        ['Site coverage', Math.round(z.proposed.coverage), '%', `${z.compliance.coverage ? 'OK' : 'OVER'} (max ${maxCoverage})`],
        ['Footprint', Math.round(z.proposed.footprint), 'm2', z.compliance.setback ? 'OK' : 'OVER'],
        ['Sky-exposure plane', skyBase > 0 ? skyBase : 'off', skyBase > 0 ? 'm' : '', skyBase > 0 ? (z.compliance.skyPlane ? 'OK' : 'OVER') : ''],
        ['Compliance', z.compliance.overall ? 'COMPLIANT' : 'NON-COMPLIANT', '', ''],
      ],
    }
    const tiers: ReportTable = { title: 'Tiers', columns: ['Tier', 'Footprint (m2)', 'From (m)', 'To (m)'], rows: tierRows() }
    return `${tableToCsv(summary)}\n\n${tableToCsv(tiers)}`
  }
  const zoningJson = (): string => JSON.stringify({
    inputs: { far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep },
    boundary, zoning: z,
  }, null, 2)

  return (
    <div className="space-y-8">
      <PageHeader
        icon={MapIcon}
        accent={ACC}
        eyebrow="Intelligence"
        title="Site & Zoning"
        description="Draw or import a site boundary, set the zoning rules — FAR, height limit, setback and coverage — and the buildable area, the legal massing envelope and a live compliance check recompute instantly. A 3D envelope and a top-down plan show whether your proposed scheme fits the entitlement. Real planning math, not a static diagram."
        actions={<button onClick={reset} className="btn-ghost"><RotateCcw className="h-4 w-4" /> Reset</button>}
      />

      {/* compliance + capacity KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Site area" value={`${formatNumber(Math.round(z.siteArea))} m²`} icon={Maximize2} accent="teal" sub={`${formatNumber(Math.round(z.sitePerimeter))} m perimeter`} />
        <StatTile label="Max GFA (FAR)" value={`${formatNumber(Math.round(z.maxGFA))} m²`} icon={Layers} accent="sky" sub={`FAR ${far} · buildable ${formatNumber(Math.round(z.buildableArea))} m²`} />
        <StatTile label="Proposed GFA" value={`${formatNumber(Math.round(proposedGFA))} m²`} icon={Building2} accent="blue" sub={`${proposedStoreys} storeys · ${Math.round(z.proposed.height)} m`} />
        <StatTile label="Capacity used" value={`${Math.round(z.utilisation)}%`} icon={Layers} accent={z.utilisation > 100 ? 'rose' : z.utilisation > 90 ? 'amber' : 'emerald'} sub="Proposed ÷ max GFA" />
        <StatTile label="Zoning" value={z.compliance.overall ? 'Compliant' : 'Non-compliant'} icon={z.compliance.overall ? CheckCircle2 : XCircle} accent={z.compliance.overall ? 'emerald' : 'rose'} sub={z.compliance.overall ? 'Within all limits' : 'Exceeds a limit'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 3D envelope */}
        <Card className="lg:col-span-3">
          <CardHeader icon={MapIcon} accent={ACC} title="Massing envelope" subtitle="White = boundary · amber dashed = setback · blue = legal envelope (stepped at the sky plane) · solid = proposed podium + tower (green fits, red busts)" />
          <div className="border-t border-edge/50">
            <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <SiteZoningViewer boundary={boundary} buildable={z.buildable} maxHeight={z.maxHeight} tiers={z.tiers} envelopeTiers={z.envelopeTiers} proposedHeight={z.proposed.height} compliant={z.compliance.overall} height={460} />
            </Suspense>
            <p className="border-t border-edge/50 px-4 py-2 text-[11px] text-slate-500">Drag or arrow-keys to orbit · scroll to zoom. The proposed mass is sized to its footprint (GFA ÷ storeys) and nested in the setback line.</p>
          </div>
        </Card>

        {/* controls */}
        <Card className="lg:col-span-2">
          <CardHeader icon={Building2} accent="blue" title="Zoning & scheme — editable" subtitle="Tune the rules and the proposal; everything recomputes live" />
          <div className="space-y-4 border-t border-edge/50 p-5">
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Site boundary — draw your own</div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const active = boundary === p.pts
                  return (
                    <button key={p.id} onClick={() => applyBoundary(p.pts)} aria-pressed={active} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', active ? 'bg-teal-500/15 text-teal-200 ring-teal-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <PolygonEditor key={boundaryKey} value={boundary} onChange={setBoundary} accent="#2dd4bf" height={220} />
            </div>
            <Range label="FAR (floor area ratio)" value={far} min={0.5} max={15} step={0.1} onChange={setFar} fmt={(v) => v.toFixed(1)} />
            <Range label="Height limit" unit="m" value={heightLimit} min={10} max={300} step={1} onChange={setHeightLimit} />
            <Range label="Setback" unit="m" value={setback} min={0} max={20} step={0.5} onChange={setSetback} fmt={(v) => v.toFixed(1)} />
            <Range label="Max site coverage" unit="%" value={maxCoverage} min={10} max={100} step={1} onChange={setMaxCoverage} />
            <div className="grid grid-cols-2 gap-3 border-t border-edge/40 pt-4">
              <Num label="Proposed GFA" unit="m²" value={proposedGFA} step={1000} onChange={(v) => setProposedGFA(Math.max(0, v))} />
              <Num label="Storeys" value={proposedStoreys} step={1} onChange={(v) => setProposedStoreys(Math.max(1, Math.round(v)))} />
              <Num label="Storey height" unit="m" value={storeyHeight} step={0.1} onChange={(v) => setStoreyHeight(Math.max(2, v))} />
            </div>
            <Range label="Podium" value={podium} min={0} max={0.8} step={0.05} onChange={setPodium} fmt={(v) => (v === 0 ? 'none' : `${Math.round(v * 100)}% of storeys`)} />
            <Range label="Tower setback" value={towerSetback} min={0} max={0.6} step={0.02} onChange={setTowerSetback} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Range label="Sky-exposure base" unit="m" value={skyBase} min={0} max={120} step={2} onChange={setSkyBase} fmt={(v) => (v === 0 ? 'off' : `${v} m`)} />
            <Range label="Sky-plane step-in" value={skyStep} min={0} max={0.6} step={0.02} onChange={setSkyStep} fmt={(v) => `${Math.round(v * 100)}%`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* plan diagram */}
        <Card className="lg:col-span-3">
          <CardHeader icon={Maximize2} accent="amber" title="Site plan" subtitle="Top-down — boundary, setback and the proposed footprint" />
          <div className="border-t border-edge/50 p-5">
            <PlanDiagram z={z} boundary={boundary} />
          </div>
        </Card>

        {/* compliance breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader icon={z.compliance.overall ? CheckCircle2 : AlertTriangle} accent={z.compliance.overall ? 'emerald' : 'rose'} title="Compliance" subtitle="Each zoning test against the proposal" />
          <div className="space-y-2.5 border-t border-edge/50 p-5">
            <CheckRow ok={z.compliance.far} label="FAR / GFA" detail={`${formatNumber(Math.round(proposedGFA))} ≤ ${formatNumber(Math.round(z.maxGFA))} m²`} />
            <CheckRow ok={z.compliance.height} label="Height" detail={`${Math.round(z.proposed.height)} ≤ ${Math.round(z.maxHeight)} m`} />
            <CheckRow ok={z.compliance.coverage} label="Site coverage" detail={`${z.proposed.coverage.toFixed(0)}% ≤ ${maxCoverage}%`} />
            <CheckRow ok={z.compliance.setback} label="Footprint within setback" detail={`${formatNumber(Math.round(z.proposed.footprint))} ≤ ${formatNumber(Math.round(z.buildableArea))} m²`} />
            {skyBase > 0 && z.envelopeTiers.length > 1 && (
              <CheckRow ok={z.compliance.skyPlane} label={`Sky-exposure plane (${skyBase} m)`} detail={`${formatNumber(Math.round(z.tiers.reduce((m, t) => (t.top > skyBase ? Math.max(m, t.footprint) : m), 0)))} ≤ ${formatNumber(Math.round(z.envelopeTiers[1].footprint))} m² above`} />
            )}
            <p className="pt-1 text-[13px] leading-relaxed text-slate-300">{narrative(z, proposedGFA)}</p>
          </div>
        </Card>
      </div>

      {/* tier schedule + data export */}
      <Card>
        <CardHeader
          icon={Layers}
          accent="sky"
          title="Scheme & envelope tiers"
          subtitle="Footprints and height bands from the model — proposed massing vs the legal envelope. Export the full analysis as CSV or JSON."
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => downloadText('site-zoning-analysis.csv', zoningCsv(), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
              <button onClick={() => downloadText('site-zoning-analysis.json', zoningJson(), 'JSON')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-3.5 w-3.5" /> JSON</button>
            </div>
          }
        />
        <ScrollableTable label="Scheme and envelope tiers" className="border-t border-edge/50">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-3 py-2.5 text-right font-medium">Footprint (m²)</th>
                <th className="px-3 py-2.5 text-right font-medium">From (m)</th>
                <th className="px-3 py-2.5 text-right font-medium">To (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {tierRows().map((r, i) => (
                <tr key={i} className={cn('hover:bg-elevated/30', String(r[0]).startsWith('Envelope') && 'text-slate-400')}>
                  <td className="px-4 py-2 font-medium text-slate-200">{r[0]}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-300">{formatNumber(r[1] as number)}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(r[2] as number)}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(r[3] as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* GIS import */}
      <Card>
        <CardHeader icon={Upload} accent="cyan" title="Import site boundary (GIS)" subtitle="Paste a GeoJSON Polygon/Feature, or a bare [[x,y],…] ring — lon/lat is projected to metres" />
        <div className="space-y-3 border-t border-edge/50 p-5">
          <textarea
            value={geoText}
            onChange={(e) => setGeoText(e.target.value)}
            rows={4}
            placeholder='{"type":"Polygon","coordinates":[[[ -0.0006,-0.0004],[0.0006,-0.0004],[0.0006,0.0004],[-0.0006,0.0004],[-0.0006,-0.0004]]]}'
            aria-label="GeoJSON site boundary"
            className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
          {geoError && <p className="flex items-center gap-1.5 text-xs text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {geoError}</p>}
          <button onClick={importGeo} disabled={!geoText.trim()} className="btn-primary disabled:opacity-50"><Upload className="h-4 w-4" /> Import boundary</button>
        </div>
      </Card>
    </div>
  )
}

function narrative(z: Zoning, proposedGFA: number): string {
  if (z.compliance.overall) {
    const head = Math.round(z.maxGFA - proposedGFA)
    return `The scheme is within the envelope, using ${Math.round(z.utilisation)}% of the allowable GFA${head > 0 ? ` — about ${formatNumber(head)} m² of unused entitlement remains` : ''}.`
  }
  const fails: string[] = []
  if (!z.compliance.far) fails.push(`GFA exceeds the FAR cap by ${formatNumber(Math.round(proposedGFA - z.maxGFA))} m²`)
  if (!z.compliance.height) fails.push(`height is ${Math.round(z.proposed.height - z.maxHeight)} m over the limit`)
  if (!z.compliance.coverage) fails.push('footprint exceeds the coverage cap')
  if (!z.compliance.setback) fails.push('footprint spills past the setback line')
  if (!z.compliance.skyPlane) fails.push('the upper storeys breach the sky-exposure plane')
  return `Non-compliant: ${fails.join('; ')}. Reduce GFA, add storeys to shrink the plate, set the podium to the sky-plane height, or relax the rule that binds.`
}

/* Top-down SVG plan: site boundary, setback polygon, proposed footprint. */
function PlanDiagram({ z, boundary }: { z: Zoning; boundary: Pt[] }) {
  const W = 640, H = 360, pad = 28
  const xs = boundary.map((p) => p.x), zs = boundary.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ)
  const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ)
  const ox = (W - spanX * s) / 2, oz = (H - spanZ * s) / 2
  const map = (p: Pt) => `${(ox + (p.x - minX) * s).toFixed(1)},${(oz + (p.z - minZ) * s).toFixed(1)}`
  const path = (pts: Pt[]) => pts.map(map).join(' ')

  const base = z.buildable.length >= 3 ? z.buildable : boundary
  const baseArea = polygonArea(base)
  const k = baseArea > 0 ? Math.sqrt(Math.min(1, z.proposed.footprint / baseArea)) : 0
  const footprint = k > 0 ? scalePolygon(base, k, polygonCentroid(base)) : []

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Site plan: ${Math.round(z.siteArea)} m² site, proposed footprint ${Math.round(z.proposed.footprint)} m²`}>
      <rect x={0} y={0} width={W} height={H} fill="#0a0f1c" rx={10} />
      <polygon points={path(boundary)} fill="#1e293b" fillOpacity={0.35} stroke="#e2e8f0" strokeWidth={1.5} />
      {z.buildable.length >= 3 && <polygon points={path(z.buildable)} fill="none" stroke="#fbbf24" strokeWidth={1.3} strokeDasharray="6 4" />}
      {footprint.length >= 3 && <polygon points={path(footprint)} fill={z.compliance.overall ? '#22c55e' : '#ef4444'} fillOpacity={0.5} stroke={z.compliance.overall ? '#22c55e' : '#ef4444'} strokeWidth={1.5} />}
      <g fontSize={11} fill="#94a3b8">
        <text x={12} y={H - 28}>■ <tspan fill="#e2e8f0">Site</tspan></text>
        <text x={12} y={H - 14}>▦ <tspan fill="#fbbf24">Setback</tspan> · <tspan fill={z.compliance.overall ? '#22c55e' : '#ef4444'}>Proposed footprint</tspan></text>
      </g>
    </svg>
  )
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
        <span className="text-slate-200">{label}</span>
      </span>
      <span className={cn('data-mono text-xs', ok ? 'text-slate-400' : 'text-rose-300')}>{detail}</span>
    </div>
  )
}

function Range({ label, unit, value, min, max, step, onChange, fmt }: { label: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="data-mono text-slate-200">{fmt ? fmt(value) : value}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-teal-500" aria-label={label} />
    </label>
  )
}

function Num({ label, unit, value, step, onChange }: { label: string; unit?: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" step={step} value={value} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }} className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
    </label>
  )
}
