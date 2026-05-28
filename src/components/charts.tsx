import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { ACCENT, type Accent } from '@/lib/nav'

const GRID = '#16203a'
const AXIS = '#64748b'

export type Series = { key: string; name?: string; accent?: Accent }

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: GRID },
}

function ChartTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-edge/80 bg-surface/95 px-3 py-2 shadow-xl backdrop-blur-md">
      {label != null && label !== '' && <p className="mb-1.5 text-xs font-semibold text-slate-200">{label}</p>}
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
            <span className="text-slate-400">{p.name}</span>
            <span className="ml-auto pl-4 font-semibold text-slate-100 data-mono">
              {valueFormatter
                ? valueFormatter(p.value)
                : typeof p.value === 'number'
                  ? p.value.toLocaleString()
                  : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Area --- */
export function AreaTrend({
  data,
  xKey,
  series,
  height = 260,
  valueFormatter,
  referenceY,
}: {
  data: any[]
  xKey: string
  series: Series[]
  height?: number
  valueFormatter?: (v: number) => string
  referenceY?: { y: number; label?: string }
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => {
            const a = ACCENT[s.accent ?? 'blue']
            return (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.hex} stopOpacity={0.4} />
                <stop offset="100%" stopColor={a.hex} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={48} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: '#334155' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} iconType="circle" />}
        {referenceY && (
          <ReferenceLine
            y={referenceY.y}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            label={{ value: referenceY.label, fill: '#fb7185', fontSize: 11, position: 'insideTopRight' }}
          />
        )}
        {series.map((s) => {
          const a = ACCENT[s.accent ?? 'blue']
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={a.hex}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )
        })}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------ Line --- */
export function LineTrend({
  data,
  xKey,
  series,
  height = 260,
  valueFormatter,
  dashedKeys = [],
}: {
  data: any[]
  xKey: string
  series: Series[]
  height?: number
  valueFormatter?: (v: number) => string
  dashedKeys?: string[]
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={48} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: '#334155' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s) => {
          const a = ACCENT[s.accent ?? 'blue']
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={a.hex}
              strokeWidth={2}
              strokeDasharray={dashedKeys.includes(s.key) ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ------------------------------------------------------------------- Bar --- */
export function BarSeries({
  data,
  xKey,
  series,
  height = 260,
  layout = 'horizontal',
  stacked = false,
  valueFormatter,
}: {
  data: any[]
  xKey: string
  series: Series[]
  height?: number
  layout?: 'horizontal' | 'vertical'
  stacked?: boolean
  valueFormatter?: (v: number) => string
}) {
  const vertical = layout === 'vertical'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 8, right: 8, left: vertical ? 8 : -12, bottom: 0 }}
        barCategoryGap={vertical ? '24%' : '28%'}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey={xKey} {...axisProps} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} width={48} />
          </>
        )}
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s) => {
          const a = ACCENT[s.accent ?? 'blue']
          return (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              fill={a.hex}
              radius={vertical ? [0, 5, 5, 0] : [5, 5, 0, 0]}
              stackId={stacked ? 'a' : undefined}
              maxBarSize={vertical ? 22 : 48}
            />
          )
        })}
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ----------------------------------------------------------------- Donut --- */
export function Donut({
  data,
  height = 240,
  innerRadius = 58,
  outerRadius = 86,
  valueFormatter,
}: {
  data: { name: string; value: number; accent?: Accent; color?: string }[]
  height?: number
  innerRadius?: number
  outerRadius?: number
  valueFormatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? ACCENT[d.accent ?? 'blue'].hex} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/* ----------------------------------------------------------------- Radar --- */
export function RadarViz({
  data,
  series,
  height = 280,
}: {
  data: any[]
  series: Series[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={GRID} />
        <PolarAngleAxis dataKey="metric" tick={{ fill: AXIS, fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 10 }} stroke={GRID} angle={90} />
        <Tooltip content={<ChartTooltip />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s) => {
          const a = ACCENT[s.accent ?? 'blue']
          return (
            <Radar
              key={s.key}
              dataKey={s.key}
              name={s.name ?? s.key}
              stroke={a.hex}
              fill={a.hex}
              fillOpacity={0.18}
              strokeWidth={2}
            />
          )
        })}
      </RadarChart>
    </ResponsiveContainer>
  )
}

/* --------------------------------------------------------------- Scatter --- */
export function ScatterViz({
  data,
  xKey,
  yKey,
  zKey,
  xName,
  yName,
  height = 280,
  accent = 'cyan',
}: {
  data: any[]
  xKey: string
  yKey: string
  zKey?: string
  xName?: string
  yName?: string
  height?: number
  accent?: Accent
}) {
  const a = ACCENT[accent]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis type="number" dataKey={xKey} name={xName ?? xKey} {...axisProps} />
        <YAxis type="number" dataKey={yKey} name={yName ?? yKey} {...axisProps} width={48} />
        {zKey && <ZAxis type="number" dataKey={zKey} range={[60, 420]} />}
        <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#334155' }} />
        <Scatter data={data} fill={a.hex} fillOpacity={0.7} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
