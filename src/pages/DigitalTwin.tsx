import { useMemo, useState } from 'react'
import {
  Building2,
  Cpu,
  Activity,
  Thermometer,
  Zap,
  Wrench,
  Gauge,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, RingProgress, KeyValue, ProgressBar } from '@/components/ui'
import { ScatterViz, BarSeries } from '@/components/charts'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { useScenarios } from '@/store/scenarios'
import { ScenarioBar } from '@/components/ScenarioBar'
import { ExportMenu } from '@/components/ExportMenu'
import { kpiToItem, type ReportSpec, type ReportTable } from '@/lib/report'
import type { KPI } from '@/lib/scenarios'
import {
  computeAsset,
  summarize,
  maintenanceNarrative,
  comfortStatus,
  comfortIndex,
  type AssetInput,
  type AssetStatus,
  type Comfort,
} from '@/lib/twin'

/* ---- editable floor telemetry (drives the twin viewer + comfort index) ---- */
type Floor = { level: string; temp: number; occ: number; energy: number }
const seedFloors = (): Floor[] => [
  { level: 'Roof / Plant', temp: 24.1, occ: 2, energy: 88 },
  { level: 'L12 — Mechanical', temp: 26.8, occ: 4, energy: 142 },
  { level: 'L11 — Office', temp: 22.4, occ: 68, energy: 96 },
  { level: 'L10 — Office', temp: 22.9, occ: 74, energy: 101 },
  { level: 'L09 — Office', temp: 23.6, occ: 51, energy: 88 },
  { level: 'L08 — Labs', temp: 21.2, occ: 33, energy: 168 },
  { level: 'L07 — Office', temp: 22.7, occ: 60, energy: 92 },
  { level: 'Lobby / Retail', temp: 23.1, occ: 120, energy: 134 },
]

/* ---- editable asset fleet ---- */
const seedAssets = (): AssetInput[] => [
  { id: 'ahu', name: 'AHU-03', type: 'Air handling unit', location: 'L12', unit: 'mm/s', reading: 4.2, setpoint: 3.0, tolerance: 1.0, runtimeHours: 7200, serviceInterval: 8000, criticality: 3 },
  { id: 'chl', name: 'CHILLER-01', type: 'Centrifugal chiller', location: 'Plant', unit: 'mm/s', reading: 2.1, setpoint: 2.0, tolerance: 0.8, runtimeHours: 3000, serviceInterval: 12000, criticality: 5 },
  { id: 'lift', name: 'LIFT-02', type: 'Traction elevator', location: 'Core', unit: 'mm/s', reading: 1.0, setpoint: 0.6, tolerance: 0.3, runtimeHours: 9000, serviceInterval: 10000, criticality: 4 },
  { id: 'pmp', name: 'PUMP-07', type: 'Chilled-water pump', location: 'L12', unit: 'mm/s', reading: 7.2, setpoint: 3.0, tolerance: 1.0, runtimeHours: 11000, serviceInterval: 9000, criticality: 4 },
  { id: 'cool', name: 'COOL-TWR', type: 'Cooling tower', location: 'Roof', unit: 'mm/s', reading: 3.0, setpoint: 2.6, tolerance: 0.6, runtimeHours: 6000, serviceInterval: 8000, criticality: 3 },
  { id: 'bms', name: 'BMS-GW', type: 'BMS gateway', location: 'L01', unit: 'ms', reading: 100, setpoint: 100, tolerance: 20, runtimeHours: 1000, serviceInterval: 20000, criticality: 2 },
]

const STATUS_META: Record<AssetStatus, { label: string; variant: 'success' | 'cyan' | 'warn' | 'danger' }> = {
  healthy: { label: 'Healthy', variant: 'success' },
  monitor: { label: 'Monitor', variant: 'cyan' },
  'service-due': { label: 'Service due', variant: 'warn' },
  'at-risk': { label: 'At risk', variant: 'danger' },
}
const healthAccent = (h: number) => (h > 80 ? 'emerald' : h > 60 ? 'cyan' : h > 45 ? 'amber' : 'rose')

const W = 3.0, D = 3.0, ZS = 26, FH = 0.86
const proj = (x: number, y: number, z: number): [number, number] => [210 + (x - y) * 30, 300 + (x + y) * 15 - z * ZS]
const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ')

function IsoTwin({ floors, statuses, selected, onSelect }: { floors: Floor[]; statuses: Comfort[]; selected: number; onSelect: (i: number) => void }) {
  const n = floors.length
  return (
    <svg viewBox="0 0 420 360" className="h-full w-full">
      <ellipse cx="210" cy="312" rx="150" ry="40" fill="url(#twinGlow)" />
      <defs>
        <radialGradient id="twinGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {floors.map((f, idx) => {
        const order = n - 1 - idx
        const zb = order * 1.0
        const zt = zb + FH
        const isSel = idx === selected
        const warn = statuses[idx] === 'warn'
        const a = warn ? ACCENT.amber : ACCENT.cyan
        const topFill = isSel ? a.hex : warn ? '#2a2417' : '#1c2742'
        const rightFill = isSel ? a.hex : warn ? '#211c12' : '#141d33'
        const leftFill = isSel ? a.hex : warn ? '#191509' : '#0e1626'
        const top: [number, number][] = [proj(0, 0, zt), proj(W, 0, zt), proj(W, D, zt), proj(0, D, zt)]
        const right: [number, number][] = [proj(W, 0, zt), proj(W, D, zt), proj(W, D, zb), proj(W, 0, zb)]
        const left: [number, number][] = [proj(0, D, zt), proj(W, D, zt), proj(W, D, zb), proj(0, D, zb)]
        const [sx, sy] = proj(W, D / 2, zb + FH / 2)
        return (
          <g key={f.level} onClick={() => onSelect(idx)} className="cursor-pointer" opacity={isSel ? 0.92 : 1}>
            <polygon points={poly(left)} fill={leftFill} stroke="#0a0f1c" strokeWidth={1} fillOpacity={isSel ? 0.55 : 1} />
            <polygon points={poly(right)} fill={rightFill} stroke="#0a0f1c" strokeWidth={1} fillOpacity={isSel ? 0.7 : 1} />
            <polygon points={poly(top)} fill={topFill} stroke="#243150" strokeWidth={1} fillOpacity={isSel ? 0.9 : 1} />
            {warn && (
              <>
                <circle cx={sx} cy={sy} r={3.2} fill="#fbbf24" />
                <circle cx={sx} cy={sy} r={3.2} fill="none" stroke="#fbbf24" strokeWidth={1.4} className="origin-center animate-pulsering" />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function DigitalTwin() {
  const [floors, setFloors] = useState<Floor[]>(seedFloors)
  const [assets, setAssets] = useState<AssetInput[]>(seedAssets)
  const [comfortSetpoint, setComfortSetpoint] = useState(22.5)
  const [comfortBand, setComfortBand] = useState(2)
  const [selected, setSelected] = useState(1)
  const [edited, setEdited] = useState(false)

  const touch = () => setEdited(true)
  const setFloor = (i: number, patch: Partial<Floor>) => { setFloors((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f))); touch() }
  const setAsset = (id: string, patch: Partial<AssetInput>) => { setAssets((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a))); touch() }
  const service = (id: string) => setAsset(id, { runtimeHours: 0 })
  const addAsset = () => { setAssets((as) => [...as, { id: `as-${Math.floor(1000 + Math.random() * 9000)}`, name: 'NEW-ASSET', type: 'Equipment', location: 'L00', unit: 'mm/s', reading: 3, setpoint: 3, tolerance: 1, runtimeHours: 1000, serviceInterval: 8000, criticality: 3 }]); touch() }
  const removeAsset = (id: string) => { setAssets((as) => as.filter((a) => a.id !== id)); touch() }
  const reset = () => { setFloors(seedFloors()); setAssets(seedAssets()); setComfortSetpoint(22.5); setComfortBand(2); setEdited(false) }

  const floorStatuses = useMemo(() => floors.map((f) => comfortStatus(f.temp, comfortSetpoint, comfortBand)), [floors, comfortSetpoint, comfortBand])
  const comfort = useMemo(() => comfortIndex(floors.map((f) => f.temp), comfortSetpoint, comfortBand), [floors, comfortSetpoint, comfortBand])
  const scored = useMemo(() => assets.map(computeAsset), [assets])
  const s = useMemo(() => summarize(assets), [assets])
  const { scenarios, save, remove } = useScenarios('digital-twin')
  const summary: KPI[] = [
    { label: 'Avg asset health', value: s.avgHealth },
    { label: 'Active alarms', value: s.alarms },
    { label: 'Overdue services', value: s.overdue },
    { label: 'Comfort index', value: comfort, unit: '%' },
  ]
  const f = floors[Math.min(selected, floors.length - 1)]
  const fStatus = floorStatuses[Math.min(selected, floors.length - 1)]

  const priorityData = [...scored].sort((a, b) => b.priority - a.priority).map((a) => ({ name: a.name, priority: a.priority }))
  const scatter = scored.map((a) => ({ x: a.health, y: a.criticality, name: a.name }))
  const alarms = scored.filter((a) => a.alarm)

  const reportTable: ReportTable = {
    title: 'Asset maintenance',
    columns: ['Asset', 'Type', 'Reading', 'Setpoint', 'Health', 'Priority', 'Status'],
    rows: scored.map((a) => [a.name, a.type, `${a.reading}${a.unit}`, `${a.setpoint}${a.unit}`, a.health, a.priority, a.status]),
  }
  const reportSpec: ReportSpec = {
    title: 'Digital Twin & Asset Intelligence',
    subtitle: `Operations brief · ${s.alarms} alarm${s.alarms === 1 ? '' : 's'}`,
    module: 'digital-twin',
    kpis: summary.map(kpiToItem),
    narrative: maintenanceNarrative(s),
    table: reportTable,
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Building2}
        accent="violet"
        eyebrow="Intelligence"
        title="Digital Twin & Asset Intelligence"
        description="A live operational twin. Edit zone telemetry and the comfort band to see drift across the building, or tune each asset's sensor reading, setpoint, runtime and criticality — deviation alarms, the asset-health index and predictive-maintenance priority recompute instantly. Real condition-based maintenance math, not a static dashboard."
        actions={
          <>
            {edited && (
              <button onClick={reset} className="btn-ghost">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            )}
            <Badge variant={s.alarms > 0 ? 'warn' : 'success'} dot>
              {s.alarms} live alarm{s.alarms === 1 ? '' : 's'}
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
      <ScenarioBar
        accent="violet"
        scenarios={scenarios}
        onSave={(name) => save(name, { floors, assets, comfortSetpoint, comfortBand }, summary)}
        onLoad={(sc) => {
          const d = sc.data as { floors?: typeof floors; assets?: typeof assets; comfortSetpoint?: number; comfortBand?: number }
          if (d.floors) setFloors(d.floors)
          if (d.assets) setAssets(d.assets)
          if (typeof d.comfortSetpoint === 'number') setComfortSetpoint(d.comfortSetpoint)
          if (typeof d.comfortBand === 'number') setComfortBand(d.comfortBand)
          setEdited(true)
        }}
        onRemove={remove}
      />
        </div>
        <ExportMenu accent="violet" spec={reportSpec} csv={reportTable} />
      </div>

      {/* KPIs — recompute as you tune telemetry */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Avg asset health" value={`${s.avgHealth}`} icon={Gauge} accent={healthAccent(s.avgHealth)} sub={`${s.count} connected assets`} />
        <StatTile label="Active alarms" value={`${s.alarms}`} icon={AlertTriangle} accent={s.alarms > 0 ? 'rose' : 'emerald'} sub="Sensors out of band" />
        <StatTile label="Overdue services" value={`${s.overdue}`} icon={Wrench} accent={s.overdue > 0 ? 'amber' : 'emerald'} sub="Runtime past interval" />
        <StatTile label="Critical at-risk" value={`${s.criticalAtRisk}`} icon={Cpu} accent="rose" sub="High-criticality failures" />
        <StatTile label="Comfort index" value={`${comfort}%`} icon={Thermometer} accent={comfort >= 90 ? 'emerald' : comfort >= 75 ? 'amber' : 'rose'} sub="Zones within comfort band" />
      </div>

      {/* Twin viewer + editable vitals */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Building2} accent="violet" title="Live building twin" subtitle="Select a floor; amber = comfort drift" />
          <div className="grid gap-2 border-t border-edge/50 sm:grid-cols-[1.4fr_1fr]">
            <div className="relative min-h-[320px]">
              <IsoTwin floors={floors} statuses={floorStatuses} selected={selected} onSelect={setSelected} />
              <div className="absolute left-4 top-4 rounded-lg border border-edge/60 bg-base/70 px-3 py-2 backdrop-blur">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Now monitoring</div>
                <div className="text-sm font-semibold text-slate-100">{f.level}</div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1 p-5">
              <div className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-slate-400">Temperature</span>
                <span className="inline-flex items-center gap-1">
                  <FloorTempEdit value={f.temp} onChange={(v) => setFloor(selected, { temp: v })} />
                  <span className="text-sm text-slate-400">°C</span>
                </span>
              </div>
              <KeyValue label="Occupancy" value={`${f.occ} people`} mono />
              <KeyValue label="Energy load" value={`${f.energy} kW`} mono />
              <KeyValue label="Comfort setpoint" value={`${comfortSetpoint} ±${comfortBand} °C`} mono />
              <div className="mt-3">
                <Badge variant={fStatus === 'warn' ? 'warn' : 'success'} dot>
                  {fStatus === 'warn' ? `Setpoint drift · ${Math.round(Math.abs(f.temp - comfortSetpoint) * 10) / 10}°C off` : 'Within comfort band'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-edge/50 p-3">
            {floors.map((fl, i) => (
              <button
                key={fl.level}
                onClick={() => setSelected(i)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  i === selected ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30' : floorStatuses[i] === 'warn' ? 'text-amber-300/80 hover:text-amber-200' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {fl.level.split(' ')[0]}
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Thermometer} accent="amber" title="Comfort policy" subtitle="Set the target band; the twin and comfort index recompute" />
          <div className="space-y-5 border-t border-edge/50 p-5">
            <Param label="Comfort setpoint" unit="°C" value={comfortSetpoint} step={0.5} onChange={(v) => { setComfortSetpoint(v); touch() }} />
            <Param label="Comfort band" unit="± °C" value={comfortBand} step={0.5} onChange={(v) => { setComfortBand(Math.max(0, v)); touch() }} />
            <div className="rounded-lg border border-edge/50 bg-elevated/30 p-3 text-xs leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-200">{floorStatuses.filter((x) => x === 'warn').length}</span> of {floors.length} zones are drifting outside the {comfortSetpoint} ±{comfortBand}°C band. Edit a floor's temperature on the left, or widen the band, to see comfort recompute.
            </div>
          </div>
        </Card>
      </div>

      {/* editable asset / predictive-maintenance table */}
      <Card>
        <CardHeader
          icon={Wrench}
          accent="cyan"
          title="Predictive maintenance — editable"
          subtitle="Edit sensor reading, setpoint, tolerance, runtime or criticality; click Service to reset runtime. Health, alarms and priority recompute live."
          action={
            <button onClick={addAsset} className="btn-ghost h-9 px-3 py-0 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add asset
            </button>
          }
        />
        <div className="overflow-x-auto border-t border-edge/50">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-3 py-2.5 text-right font-medium">Reading</th>
                <th className="px-3 py-2.5 text-right font-medium">Setpoint</th>
                <th className="px-3 py-2.5 text-right font-medium">±Tol</th>
                <th className="px-3 py-2.5 text-right font-medium">Runtime</th>
                <th className="px-3 py-2.5 text-right font-medium">Interval</th>
                <th className="px-2 py-2.5 text-center font-medium">Crit</th>
                <th className="px-3 py-2.5 text-center font-medium">Health</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 text-center font-medium">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {scored.map((a) => {
                const st = STATUS_META[a.status]
                return (
                  <tr key={a.id} className="hover:bg-elevated/30">
                    <td className="px-4 py-2">
                      <input value={a.name} onChange={(e) => setAsset(a.id, { name: e.target.value })} className="w-32 truncate rounded bg-transparent font-medium text-slate-200 data-mono focus:bg-elevated focus:px-1 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                      <div className="text-[10px] text-slate-600">{a.type} · {a.location}</div>
                    </td>
                    <td className={cn('px-3 py-2 text-right', a.alarm ? 'text-rose-300' : 'text-slate-300')}>
                      <span className="inline-flex items-center gap-1">
                        {a.alarm && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                        <NumberEdit value={a.reading} onChange={(v) => setAsset(a.id, { reading: v })} suffix={a.unit} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right"><NumberEdit value={a.setpoint} onChange={(v) => setAsset(a.id, { setpoint: v })} /></td>
                    <td className="px-3 py-2 text-right"><NumberEdit value={a.tolerance} onChange={(v) => setAsset(a.id, { tolerance: Math.max(0, v) })} /></td>
                    <td className="px-3 py-2 text-right"><NumberEdit value={a.runtimeHours} onChange={(v) => setAsset(a.id, { runtimeHours: Math.max(0, v) })} tone={a.wear > 1 ? 'bad' : undefined} fmt={(v) => formatNumber(v, { compact: true })} /></td>
                    <td className="px-3 py-2 text-right"><NumberEdit value={a.serviceInterval} onChange={(v) => setAsset(a.id, { serviceInterval: Math.max(0, v) })} fmt={(v) => formatNumber(v, { compact: true })} /></td>
                    <td className="px-2 py-2 text-center"><NumberEdit value={a.criticality} onChange={(v) => setAsset(a.id, { criticality: Math.max(1, Math.min(5, Math.round(v))) })} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center">
                        <RingProgress value={a.health} size={36} stroke={4} accent={healthAccent(a.health) as never} label={<span className="text-[9px] font-semibold text-slate-200">{a.health}</span>} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={a.priority} accent={a.priority >= 50 ? 'rose' : a.priority >= 25 ? 'amber' : 'emerald'} height="sm" className="w-14" />
                        <span className="w-7 text-sm font-semibold text-slate-100 data-mono">{a.priority}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><Badge variant={st.variant} dot>{st.label}</Badge></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        {a.wear > 0 && (
                          <button onClick={() => service(a.id)} title="Service (reset runtime)" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-cyan-300 ring-1 ring-inset ring-cyan-500/30 hover:bg-cyan-500/15">
                            <Wrench className="h-3 w-3" /> Service
                          </button>
                        )}
                        <button onClick={() => removeAsset(a.id)} className="text-slate-600 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* charts driven by the live fleet */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Wrench} accent="cyan" title="Maintenance priority" subtitle="Criticality-weighted — service the top of the list first" />
          <div className="border-t border-edge/50 p-5">
            <BarSeries data={priorityData} xKey="name" layout="vertical" height={300} series={[{ key: 'priority', name: 'Priority', accent: 'rose' }]} valueFormatter={(v) => `${v}`} />
          </div>
        </Card>
        <Card>
          <CardHeader icon={Activity} accent="violet" title="Health vs criticality" subtitle="Lower-left (unhealthy + critical) is urgent" />
          <div className="border-t border-edge/50 p-5">
            <ScatterViz data={scatter} xKey="x" yKey="y" xName="Health" yName="Criticality" height={300} accent="violet" />
            <p className="mt-2 text-xs text-slate-500">Assets with low health and high criticality are where failure hurts most — prioritize them regardless of runtime.</p>
          </div>
        </Card>
      </div>

      {/* live read-out */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-violet-500/20 opacity-20 blur-3xl" />
        <CardHeader icon={Sparkles} accent="violet" title="Operations read-out" subtitle="Computed from your current telemetry" />
        <div className="space-y-2.5 border-t border-edge/50 p-5">
          <p className="text-[15px] leading-relaxed text-slate-300">{maintenanceNarrative(s)}</p>
          {alarms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {alarms.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> {a.name} · {a.reading}{a.unit} vs {a.setpoint}±{a.tolerance}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> Operational telemetry feeds back to the lakehouse, closing the loop between how buildings are designed, built and actually perform.
          </div>
        </div>
      </Card>
    </div>
  )
}

/* A labelled, controlled numeric parameter input. */
function Param({ label, unit, value, onChange, step = 1 }: { label: string; unit: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }}
        className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-1.5 text-sm text-slate-100 data-mono focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
      />
    </label>
  )
}

/* Inline temperature editor for the vitals panel. */
function FloorTempEdit({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  return editing ? (
    <input
      autoFocus
      type="number"
      step={0.1}
      defaultValue={value}
      onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
      className="w-16 rounded border border-violet-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
    />
  ) : (
    <button onClick={() => setEditing(true)} className="data-mono text-sm font-medium text-slate-100 hover:text-white hover:underline" title="Click to edit">{value}</button>
  )
}

/* Inline-editable number (shared by the asset table). */
function NumberEdit({ value, onChange, fmt, suffix, tone }: { value: number; onChange: (v: number) => void; fmt?: (v: number) => string; suffix?: string; tone?: 'bad' }) {
  const [editing, setEditing] = useState(false)
  return editing ? (
    <input
      autoFocus
      type="number"
      step="any"
      defaultValue={value}
      onBlur={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n); setEditing(false) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }}
      className="w-20 rounded border border-violet-500/50 bg-elevated px-1 py-0.5 text-right text-sm text-slate-100 focus:outline-none"
    />
  ) : (
    <button onClick={() => setEditing(true)} className={cn('data-mono hover:text-white hover:underline', tone === 'bad' ? 'text-rose-300' : '')} title="Click to edit">
      {fmt ? fmt(value) : formatNumber(value)}{suffix ? <span className="text-[10px] text-slate-500">{suffix}</span> : null}
    </button>
  )
}
