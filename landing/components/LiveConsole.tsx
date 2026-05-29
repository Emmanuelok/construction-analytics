'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, useInView, animate } from 'framer-motion'
import { Database, GitCompare, Activity, Table2, Circle } from 'lucide-react'
import { buildLine, smoothLineD, areaD, linreg, type Pt } from '@/lib/chart'
import { DATASETS } from '@/lib/datasets'

const ease = [0.16, 1, 0.3, 1] as const

/* A counting number that animates to its target whenever it changes. */
function Counter({ value, decimals = 0, prefix = '', suffix = '' }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
      return
    }
    const controls = animate(0, value, {
      duration: 1,
      ease,
      onUpdate: (v) => {
        el.textContent = `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
      },
    })
    return () => controls.stop()
  }, [value, decimals, prefix, suffix, reduce])
  return <span ref={ref} />
}

const CHART_W = 520
const CHART_H = 150
const SCATTER_W = 230
const SCATTER_H = 150

export function LiveConsole() {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { once: true, margin: '-60px' })
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const d = DATASETS[active]

  // Auto-advance through datasets to feel "live"; pauses once the user clicks.
  useEffect(() => {
    if (!auto || !inView) return
    const t = setInterval(() => setActive((i) => (i + 1) % DATASETS.length), 3800)
    return () => clearInterval(t)
  }, [auto, inView])

  const linePts = useMemo<Pt[]>(() => buildLine(d.series, CHART_W, CHART_H, 8), [d])
  const lineD = useMemo(() => smoothLineD(linePts), [linePts])
  const fillD = useMemo(() => areaD(linePts, CHART_H), [linePts])

  // Scatter + real regression line over the dataset's planted relationship.
  const { sx, sy, regFrom, regTo, r } = useMemo(() => {
    const xs = d.scatter.map((p) => p.x)
    const ys = d.scatter.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const px = (x: number) => 8 + ((x - minX) / (maxX - minX || 1)) * (SCATTER_W - 16)
    const py = (y: number) => 8 + (1 - (y - minY) / (maxY - minY || 1)) * (SCATTER_H - 16)
    const { slope, intercept, r } = linreg(xs, ys)
    return {
      sx: px,
      sy: py,
      regFrom: { x: px(minX), y: py(slope * minX + intercept) },
      regTo: { x: px(maxX), y: py(slope * maxX + intercept) },
      r,
    }
  }, [d])

  const trend = d.series[d.series.length - 1] - d.series[0]
  const trendPct = Math.round((trend / d.series[0]) * 100)

  return (
    <div ref={wrapRef} className="card overflow-hidden p-2 shadow-2xl" style={{ perspective: 1200 }}>
      <div className="rounded-xl border border-edge/60 bg-base/80">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-edge/50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 font-mono text-[11px] text-slate-500">studio · analysis · live</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={reduce ? {} : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            streaming
          </span>
        </div>

        {/* dataset tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-edge/50 px-3 py-2">
          {DATASETS.map((ds, i) => (
            <button
              key={ds.id}
              onClick={() => { setActive(i); setAuto(false) }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                i === active ? 'bg-elevated text-white ring-1 ring-edge' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Database className="h-3 w-3" /> {ds.name.split('—')[0].split('&')[0].trim()}
            </button>
          ))}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-px bg-edge/40">
          {[
            { label: 'Records', value: d.rows, suffix: '', decimals: 0 },
            { label: 'Latest', value: d.series[d.series.length - 1], suffix: ` ${d.unit}`, decimals: 0 },
            { label: 'Trend', value: trendPct, prefix: trendPct > 0 ? '+' : '', suffix: '%', decimals: 0 },
          ].map((k) => (
            <div key={k.label} className="bg-base/80 px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{k.label}</div>
              <div className={`font-mono text-sm font-semibold ${k.label === 'Trend' ? (trendPct > 0 ? 'text-emerald-400' : 'text-amber-400') : 'text-slate-100'}`}>
                <Counter value={k.value} decimals={k.decimals} prefix={k.prefix} suffix={k.suffix} />
              </div>
            </div>
          ))}
        </div>

        {/* charts */}
        <div className="grid gap-3 p-3 lg:grid-cols-[1.7fr_1fr]">
          {/* area/line trend */}
          <div className="rounded-lg border border-edge/60 bg-elevated/30 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Activity className="h-3 w-3 text-brand-400" /> {d.yLabel} over time
            </div>
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-[150px] w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`grad-${d.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((g) => (
                <line key={g} x1="0" y1={CHART_H * g} x2={CHART_W} y2={CHART_H * g} stroke="#1b2540" strokeWidth="1" />
              ))}
              <motion.path
                key={`fill-${d.id}`}
                d={fillD}
                fill={`url(#grad-${d.id})`}
                initial={{ opacity: 0 }}
                animate={{ opacity: inView ? 1 : 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
              <motion.path
                key={`line-${d.id}`}
                d={lineD}
                fill="none"
                stroke="#5b97fb"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease }}
              />
              {linePts.map((p, i) => (
                <motion.circle
                  key={`${d.id}-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r="2.5"
                  fill="#8ebcff"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                />
              ))}
            </svg>
          </div>

          {/* scatter + regression */}
          <div className="rounded-lg border border-edge/60 bg-elevated/30 p-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <GitCompare className="h-3 w-3 text-violet-400" /> {d.xLabel} × {d.yLabel}
              </span>
              <span className="font-mono text-slate-300">r = {r.toFixed(2)}</span>
            </div>
            <svg viewBox={`0 0 ${SCATTER_W} ${SCATTER_H}`} className="h-[150px] w-full">
              {d.scatter.map((p, i) => (
                <motion.circle
                  key={`${d.id}-pt-${i}`}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r="2.5"
                  className="fill-violet-400/70"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + (i % 20) * 0.015, duration: 0.3 }}
                />
              ))}
              <motion.line
                key={`reg-${d.id}`}
                x1={regFrom.x}
                y1={regFrom.y}
                x2={regTo.x}
                y2={regTo.y}
                stroke="#a78bfa"
                strokeWidth="2"
                strokeDasharray="4 3"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 0.5, ease }}
              />
            </svg>
          </div>
        </div>

        {/* computed insight readout */}
        <div className="flex items-center gap-2 border-t border-edge/50 px-4 py-2.5">
          <Circle className={`h-2 w-2 shrink-0 fill-current ${d.accent}`} />
          <p className="font-mono text-[11px] text-slate-400">
            <span className="text-slate-300">{d.provider}</span> · {Math.abs(r) > 0.6 ? 'strong' : 'moderate'} {r > 0 ? 'positive' : 'negative'}{' '}
            correlation between <span className={d.accent}>{d.xLabel}</span> and <span className={d.accent}>{d.yLabel}</span> —{' '}
            <span className="text-slate-300">r = {r.toFixed(2)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
