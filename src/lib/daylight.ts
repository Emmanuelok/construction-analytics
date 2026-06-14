/* Interior daylight (Average Daylight Factor) — pure, unit-tested. Implements the
 * BRE ADF formula for a representative habitable room:
 *   ADF = (M · T · Aw · θ) / (A · (1 − R²))
 * where M is the maintenance factor, T the diffuse glazing transmittance, Aw the
 * net glazed area, θ the angle of visible sky (reduced by facing obstructions —
 * derived from the opposite building height and the distance to it), A the total
 * area of the room's surfaces, and R the area-weighted mean reflectance. Reports
 * the ADF, the sky angle, a verdict against the BRE/BS EN 17037 targets, a
 * room-depth (no-sky-line) check, and an ADF-vs-glazing sensitivity. No DOM. */

export type DaylightInput = {
  roomWidth: number      // m (façade width of the room)
  roomDepth: number      // m (back from the window)
  roomHeight: number     // m (floor to ceiling)
  wwr: number            // window-to-wall ratio of the façade (0..1)
  transmittance?: number // diffuse visible transmittance of glazing (default 0.68)
  maintenance?: number   // maintenance factor (default 0.9)
  reflectance?: number   // area-weighted mean surface reflectance (default 0.5)
  facingDistance?: number // m to the opposite obstruction (default 21)
  oppositeHeight?: number // m height of the opposite obstruction above the window (default 18)
  target?: number        // ADF % considered good (default 2)
}

export type Daylight = {
  adf: number             // average daylight factor, %
  glazedArea: number      // Aw, m²
  skyAngle: number        // θ, degrees of visible sky
  obstructionAngle: number // degrees subtended by the facing obstruction
  surfaceArea: number     // A, m²
  meanReflectance: number
  verdict: 'Good' | 'Adequate' | 'Poor'
  target: number
  depthRatio: number      // roomDepth ÷ roomHeight
  depthAdequate: boolean  // daylight penetrates the room depth
  sensitivity: { wwr: number; adf: number }[] // ADF vs glazing ratio
  note: string
}

const r2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const deg = (rad: number) => (rad * 180) / Math.PI

/** Core ADF for a glazed area + geometry (shared by the headline + sensitivity). */
function adfFor(glazed: number, skyAngle: number, surfaceArea: number, reflectance: number, maintenance: number, transmittance: number): number {
  const denom = surfaceArea * (1 - reflectance * reflectance)
  if (denom <= 0) return 0
  return (maintenance * transmittance * glazed * skyAngle) / denom
}

/** Run the daylight (ADF) assessment for a representative room. */
export function daylight(input: DaylightInput): Daylight {
  const w = Math.max(0.5, input.roomWidth)
  const d = Math.max(0.5, input.roomDepth)
  const h = Math.max(0.5, input.roomHeight)
  const wwr = clamp(input.wwr, 0, 0.95)
  const T = input.transmittance ?? 0.68
  const M = input.maintenance ?? 0.9
  const R = clamp(input.reflectance ?? 0.5, 0, 0.9)
  const facing = Math.max(1, input.facingDistance ?? 21)
  const oppH = Math.max(0, input.oppositeHeight ?? 18)
  const target = input.target ?? 2

  const facadeArea = w * h
  const glazed = facadeArea * wwr
  const obstructionAngle = deg(Math.atan2(oppH, facing))
  const skyAngle = clamp(90 - obstructionAngle, 0, 90)
  const surfaceArea = 2 * (w * d + w * h + d * h)

  const adf = r2(adfFor(glazed, skyAngle, surfaceArea, R, M, T))
  const verdict: Daylight['verdict'] = adf >= target ? 'Good' : adf >= target * 0.5 ? 'Adequate' : 'Poor'
  const depthRatio = r2(d / h)
  // BRE limiting-depth rule of thumb: daylight reaches ~2–2.5× the window head height
  const depthAdequate = d <= 2.5 * h

  const sensitivity = [0.2, 0.3, 0.4, 0.5, 0.6].map((r) => ({ wwr: r, adf: r2(adfFor(facadeArea * r, skyAngle, surfaceArea, R, M, T)) }))

  const note = `${adf}% ADF (${verdict.toLowerCase()}) with a ${Math.round(wwr * 100)}% glazed façade and ${Math.round(skyAngle)}° of visible sky — the opposite obstruction subtends ${Math.round(obstructionAngle)}°. ${adf >= target ? 'Meets the ' + target + '% target.' : `Below the ${target}% target — increase glazing, widen the gap to facing buildings, or lighten the room finishes.`}${depthAdequate ? '' : ' The room is deep relative to its height; the back may feel gloomy.'}`

  return { adf, glazedArea: r2(glazed), skyAngle: Math.round(skyAngle), obstructionAngle: Math.round(obstructionAngle), surfaceArea: r2(surfaceArea), meanReflectance: R, verdict, target, depthRatio, depthAdequate, sensitivity, note }
}

/** Daylight CSV. */
export function daylightCsv(d: Daylight): string {
  const meta = [
    'Metric,Value',
    `Average daylight factor,${d.adf}%`, `Verdict,${d.verdict}`, `Target,${d.target}%`,
    `Glazed area (m²),${d.glazedArea}`, `Visible sky angle,${d.skyAngle}°`, `Obstruction angle,${d.obstructionAngle}°`,
    `Room surface area (m²),${d.surfaceArea}`, `Mean reflectance,${d.meanReflectance}`,
    `Room depth ÷ height,${d.depthRatio}`, `Depth adequate,${d.depthAdequate ? 'yes' : 'no'}`,
    '', 'Glazing ratio,ADF %', ...d.sensitivity.map((s) => `${Math.round(s.wwr * 100)}%,${s.adf}`),
  ]
  return meta.join('\n')
}
