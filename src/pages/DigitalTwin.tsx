import { useState } from 'react'
import {
  Building2,
  Cpu,
  Activity,
  Thermometer,
  Users,
  Zap,
  Wrench,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Workflow,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, PageHeader, StatTile, Badge, RingProgress, KeyValue, FeatureRow } from '@/components/ui'
import { AreaTrend } from '@/components/charts'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

const FLOORS = [
  { level: 'Roof / Plant', temp: 24.1, occ: 2, energy: 88, status: 'ok' },
  { level: 'L12 — Mechanical', temp: 26.8, occ: 4, energy: 142, status: 'warn' },
  { level: 'L11 — Office', temp: 22.4, occ: 68, energy: 96, status: 'ok' },
  { level: 'L10 — Office', temp: 22.9, occ: 74, energy: 101, status: 'ok' },
  { level: 'L09 — Office', temp: 23.6, occ: 51, energy: 88, status: 'ok' },
  { level: 'L08 — Labs', temp: 21.2, occ: 33, energy: 168, status: 'warn' },
  { level: 'L07 — Office', temp: 22.7, occ: 60, energy: 92, status: 'ok' },
  { level: 'Lobby / Retail', temp: 23.1, occ: 120, energy: 134, status: 'ok' },
]

const N = FLOORS.length
const W = 3.0
const D = 3.0
const ZS = 26
const FH = 0.86

function proj(x: number, y: number, z: number): [number, number] {
  return [210 + (x - y) * 30, 300 + (x + y) * 15 - z * ZS]
}
const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ')

function IsoTwin({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  return (
    <svg viewBox="0 0 420 360" className="h-full w-full">
      {/* ground glow */}
      <ellipse cx="210" cy="312" rx="150" ry="40" fill="url(#twinGlow)" />
      <defs>
        <radialGradient id="twinGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {FLOORS.map((f, idx) => {
        // bottom floor is last in array (Lobby) → render lowest z
        const order = N - 1 - idx
        const zb = order * 1.0
        const zt = zb + FH
        const isSel = idx === selected
        const a = f.status === 'warn' ? ACCENT.amber : ACCENT.cyan
        const topFill = isSel ? a.hex : '#1c2742'
        const rightFill = isSel ? a.hex : '#141d33'
        const leftFill = isSel ? a.hex : '#0e1626'
        const op = isSel ? 0.9 : 1
        const top: [number, number][] = [proj(0, 0, zt), proj(W, 0, zt), proj(W, D, zt), proj(0, D, zt)]
        const right: [number, number][] = [proj(W, 0, zt), proj(W, D, zt), proj(W, D, zb), proj(W, 0, zb)]
        const left: [number, number][] = [proj(0, D, zt), proj(W, D, zt), proj(W, D, zb), proj(0, D, zb)]
        // a sensor dot on the right wall of a few floors
        const hasSensor = [1, 3, 5, 7].includes(idx)
        const [sx, sy] = proj(W, D / 2, zb + FH / 2)
        return (
          <g key={f.level} onClick={() => onSelect(idx)} className="cursor-pointer" opacity={op}>
            <polygon points={poly(left)} fill={leftFill} stroke="#0a0f1c" strokeWidth={1} fillOpacity={isSel ? 0.55 : 1} />
            <polygon points={poly(right)} fill={rightFill} stroke="#0a0f1c" strokeWidth={1} fillOpacity={isSel ? 0.7 : 1} />
            <polygon points={poly(top)} fill={topFill} stroke="#243150" strokeWidth={1} fillOpacity={isSel ? 0.9 : 1} />
            {hasSensor && (
              <>
                <circle cx={sx} cy={sy} r={3.2} fill={f.status === 'warn' ? '#fbbf24' : '#22d3ee'} />
                <circle cx={sx} cy={sy} r={3.2} fill="none" stroke={f.status === 'warn' ? '#fbbf24' : '#22d3ee'} strokeWidth={1.4} className="origin-center animate-pulsering" />
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const ENERGY_SERIES = ['00', '04', '08', '12', '16', '20', '24'].map((h, i) => ({
  hour: `${h}:00`,
  energy: Math.round(70 + Math.sin(i) * 30 + i * 6),
  occupancy: Math.round(20 + Math.max(0, Math.sin((i - 1) * 0.7)) * 320),
}))

const ASSETS = [
  { name: 'AHU-03', type: 'Air handling unit', loc: 'L12', health: 62, status: 'Service due', variant: 'warn' as const },
  { name: 'CHILLER-01', type: 'Centrifugal chiller', loc: 'Plant', health: 88, status: 'Healthy', variant: 'success' as const },
  { name: 'LIFT-02', type: 'Traction elevator', loc: 'Core', health: 74, status: 'Monitor', variant: 'cyan' as const },
  { name: 'PUMP-07', type: 'Chilled-water pump', loc: 'L12', health: 41, status: 'At risk', variant: 'danger' as const },
  { name: 'BMS-GW', type: 'BMS gateway', loc: 'L01', health: 96, status: 'Healthy', variant: 'success' as const },
]

export default function DigitalTwin() {
  const [selected, setSelected] = useState(5)
  const f = FLOORS[selected]

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Building2}
        accent="violet"
        eyebrow="Intelligence Engines"
        title="Digital Twin & Asset Intelligence"
        description="A continuous data thread from design and construction through handover into operations — connecting BIM, COBie, BMS and IoT into a living, queryable twin."
        actions={
          <>
            <Badge variant="success" dot>
              Live telemetry
            </Badge>
            <button className="btn-primary">
              <Plus className="h-4 w-4" /> Connect a building
            </button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Connected assets" value="2,480" delta="3.1%" deltaPositive icon={Cpu} accent="violet" />
        <StatTile label="Live sensors" value="14.2k" delta="220" deltaPositive icon={Activity} accent="cyan" />
        <StatTile label="Energy use" value="118 kWh/m²" delta="4.2%" deltaPositive={false} icon={Zap} accent="amber" sub="vs target — improving" />
        <StatTile label="Comfort index" value="94%" delta="1.1%" deltaPositive icon={Thermometer} accent="emerald" />
        <StatTile label="Uptime" value="99.2%" icon={Gauge} accent="sky" sub="building systems" />
      </div>

      {/* Twin viewer + vitals */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Building2} accent="violet" title="Live building twin" subtitle="Meridian Tower — select a floor" />
          <div className="grid gap-2 border-t border-edge/50 sm:grid-cols-[1.4fr_1fr]">
            <div className="relative min-h-[320px]">
              <IsoTwin selected={selected} onSelect={setSelected} />
              <div className="absolute left-4 top-4 rounded-lg border border-edge/60 bg-base/70 px-3 py-2 backdrop-blur">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Now monitoring</div>
                <div className="text-sm font-semibold text-slate-100">{f.level}</div>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-1 p-5">
              <KeyValue label="Temperature" value={`${f.temp} °C`} mono />
              <KeyValue label="Occupancy" value={`${f.occ} people`} mono />
              <KeyValue label="Energy load" value={`${f.energy} kW`} mono />
              <KeyValue label="Air quality" value="Good · 612 ppm" />
              <div className="mt-3">
                <Badge variant={f.status === 'warn' ? 'warn' : 'success'} dot>
                  {f.status === 'warn' ? 'Setpoint drift detected' : 'Within comfort band'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-edge/50 p-3">
            {FLOORS.map((fl, i) => (
              <button
                key={fl.level}
                onClick={() => setSelected(i)}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  i === selected ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {fl.level.split(' ')[0]}
              </button>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Zap} accent="amber" title="Energy & occupancy" subtitle="Last 24 hours" />
          <div className="px-3 pb-4">
            <AreaTrend
              data={ENERGY_SERIES}
              xKey="hour"
              height={250}
              series={[
                { key: 'energy', name: 'Energy (kW)', accent: 'amber' },
                { key: 'occupancy', name: 'Occupancy', accent: 'violet' },
              ]}
            />
          </div>
          <div className="border-t border-edge/50 px-5 py-3 text-xs text-slate-500">
            Fault detection flagged <span className="text-amber-300">AHU-03 short-cycling</span> at 14:20 — work order
            auto-raised.
          </div>
        </Card>
      </div>

      {/* Predictive maintenance + handover */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={Wrench} accent="cyan" title="Predictive maintenance" subtitle="Asset health & service forecasting" />
          <div className="overflow-x-auto border-t border-edge/50">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-edge/50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Health</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ASSETS.map((asset) => {
                  const acc = asset.health > 80 ? 'emerald' : asset.health > 60 ? 'cyan' : asset.health > 45 ? 'amber' : 'rose'
                  return (
                    <tr key={asset.name} className="border-b border-edge/30 hover:bg-elevated/40">
                      <td className="px-5 py-3.5 data-mono font-medium text-slate-200">{asset.name}</td>
                      <td className="px-5 py-3.5 text-slate-400">{asset.type}</td>
                      <td className="px-5 py-3.5 text-slate-400">{asset.loc}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <RingProgress value={asset.health} size={34} stroke={4} accent={acc as never} label={<span className="text-[9px] text-slate-300">{asset.health}</span>} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={asset.variant} dot>
                          {asset.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative">
            <Badge variant="violet" dot>
              Solves the COBie "data drop"
            </Badge>
            <h3 className="mt-3 text-lg font-bold text-slate-100">No more handover data loss</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Up to 30% of lifecycle data is normally lost at handover. The twin maintains a continuous, validated asset
              thread from design to operations — so FM teams inherit live data, not dead spreadsheets.
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 100% asset register completeness
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Warranties & O&M manuals linked
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Validated against owner requirements
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Capabilities */}
      <div>
        <div className="section-label mb-4">Twin capabilities</div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureRow icon={Wrench} title="Predictive maintenance" accent="cyan">
            Forecast failures from telemetry and trigger work orders before breakdown.
          </FeatureRow>
          <FeatureRow icon={AlertTriangle} title="Fault detection" accent="amber">
            Continuous commissioning flags drift, short-cycling and energy waste.
          </FeatureRow>
          <FeatureRow icon={Zap} title="Energy optimization" accent="emerald">
            Optimize setpoints against occupancy, weather and tariffs.
          </FeatureRow>
          <FeatureRow icon={Workflow} title="Design feedback loop" accent="violet">
            Feed real performance back to design to improve the next project.
          </FeatureRow>
        </div>
      </div>

      <Card className="flex items-center gap-3 p-4 text-sm text-slate-400">
        <ShieldCheck className="h-5 w-5 shrink-0 text-teal-400" />
        Operational data flows back into the lakehouse, closing the loop between how buildings are designed, built and
        actually perform.
      </Card>
    </div>
  )
}
