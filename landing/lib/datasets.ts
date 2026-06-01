/* Compact, deterministic sample datasets the landing "live console" cycles
 * through. Each carries a real series so the charts and the computed r/σ on
 * screen are genuine, not decorative. */

export type LiveDataset = {
  id: string
  name: string
  provider: string
  category: string
  rows: number
  unit: string
  series: number[] // the headline metric over time/records
  scatter: { x: number; y: number }[] // a real relationship to plot + correlate
  xLabel: string
  yLabel: string
  accent: string // tailwind text color class
}

// seeded pseudo-random so SSR and client agree
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function makeScatter(seed: number, n: number, slope: number, noise: number, base = 50) {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    const x = Math.round(r() * 100)
    const y = Math.round(base + slope * x + (r() - 0.5) * noise)
    return { x, y }
  })
}

export const DATASETS: LiveDataset[] = [
  {
    id: 'cost',
    name: 'Global Cost Benchmarks',
    provider: 'Meridian Cost Consultancy',
    category: 'Cost & Estimating',
    rows: 92000,
    unit: '$/m²',
    series: [2400, 2520, 2680, 2610, 2890, 3050, 3180, 3120, 3340, 3510, 3460, 3620],
    scatter: makeScatter(7, 40, 4.2, 120, 800),
    xLabel: 'gfa_m2',
    yLabel: 'cost_per_m2',
    accent: 'text-emerald-400',
  },
  {
    id: 'carbon',
    name: 'EPD & Embodied-Carbon Factors',
    provider: 'CarbonLedger',
    category: 'Sustainability',
    rows: 410000,
    unit: 'kgCO₂e/m²',
    series: [560, 548, 521, 505, 489, 470, 452, 441, 423, 408, 396, 380],
    scatter: makeScatter(17, 40, -2.8, 90, 520),
    xLabel: 'recycled_pct',
    yLabel: 'gwp_a1a3',
    accent: 'text-teal-400',
  },
  {
    id: 'schedule',
    name: 'Schedule Outcomes — 38k Projects',
    provider: 'Continuum Controls',
    category: 'Schedule & Controls',
    rows: 38000,
    unit: 'days slip',
    series: [12, 18, 15, 22, 28, 24, 31, 29, 35, 33, 41, 38],
    scatter: makeScatter(23, 40, 3.5, 140, 40),
    xLabel: 'mep_density',
    yLabel: 'delay_days',
    accent: 'text-amber-400',
  },
  {
    id: 'supplier',
    name: 'Supplier Performance Index',
    provider: 'SupplyGraph',
    category: 'Procurement',
    rows: 64000,
    unit: 'lead days',
    series: [86, 82, 90, 78, 74, 81, 69, 72, 65, 70, 61, 58],
    scatter: makeScatter(31, 40, -1.9, 110, 180),
    xLabel: 'on_time_rate',
    yLabel: 'lead_time',
    accent: 'text-sky-400',
  },
]
