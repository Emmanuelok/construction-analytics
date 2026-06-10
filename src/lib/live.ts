/* Live telemetry engine — pure, unit-tested. A deterministic, seeded simulator that
 * streams believable site vitals (crew on site, % progress, concrete pours, sensor
 * readings, spend) as smooth functions of wall-clock time, so every dashboard ticks
 * like a connected jobsite. Deterministic: the same (seed, t) always yields the same
 * frame — testable, and honest in the UI as a simulated feed until real integrations
 * (IoT / ERP) are wired. No DOM. */

export type LiveFrame = {
  t: number // epoch seconds the frame was computed for
  progress: number // 0–100 %, creeps upward through the day
  crew: number // people on site now
  pours: number // m³ concrete placed today
  spend: number // $ committed today
  temp: number // °C site sensor
  co2: number // ppm indoor sensor
  vibration: number // mm/s peak particle velocity
  alerts: number // open live alerts
}

const TAU = Math.PI * 2
// deterministic pseudo-noise: layered sines keyed by the seed — smooth + bounded
const n1 = (seed: number, t: number, f: number) => Math.sin((t / f + seed * 7.31) * TAU) * 0.5 + Math.sin((t / (f * 0.37) + seed * 3.7) * TAU) * 0.3 + Math.sin((t / (f * 0.11) + seed * 1.9) * TAU) * 0.2
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const r1 = (v: number) => Math.round(v * 10) / 10

/** Compute the live frame for a seed at a moment (epoch ms or Date). */
export function liveFrame(seed: number, at: number | Date = Date.now()): LiveFrame {
  const ms = at instanceof Date ? at.getTime() : at
  const t = Math.floor(ms / 1000)
  const day = (t % 86400) / 86400 // 0–1 through the UTC day
  const workday = clamp(Math.sin(clamp((day - 0.27) / 0.45, 0, 1) * Math.PI), 0, 1) // ramps 6:30→17:30
  // progress creeps monotonically: base from the epoch day + intra-day gain
  const dayIndex = Math.floor(t / 86400)
  const base = (dayIndex * 37 + seed * 13) % 60
  const progress = clamp(28 + base * 0.6 + day * 0.8 + seed % 7, 0, 99.5)
  const crew = Math.round(clamp(8 + workday * (46 + n1(seed, t, 1800) * 10) + n1(seed + 1, t, 600) * 3, 4, 70))
  const pours = r1(clamp(workday * (38 + n1(seed + 2, t, 3600) * 14) * day * 2.2, 0, 160))
  const spend = Math.round(clamp(workday * (92_000 + n1(seed + 3, t, 2700) * 28_000) * day * 2.1, 0, 320_000))
  const temp = r1(clamp(16 + Math.sin((day - 0.2) * TAU) * 7 + n1(seed + 4, t, 1200) * 1.4, -5, 41))
  const co2 = Math.round(clamp(520 + workday * 260 + n1(seed + 5, t, 900) * 90, 400, 1400))
  const vibration = r1(clamp(0.4 + workday * (1.9 + n1(seed + 6, t, 240) * 1.2), 0, 6))
  const alerts = Math.max(0, Math.round(1.6 + n1(seed + 7, t, 5400) * 2))
  return { t, progress: r1(progress), crew, pours, spend, temp, co2, vibration, alerts }
}

/** A short trailing history (oldest → newest) for sparkline-style charts. */
export function liveHistory(seed: number, points = 24, stepS = 60, at: number | Date = Date.now()): LiveFrame[] {
  const ms = at instanceof Date ? at.getTime() : at
  const out: LiveFrame[] = []
  for (let i = points - 1; i >= 0; i--) out.push(liveFrame(seed, ms - i * stepS * 1000))
  return out
}
