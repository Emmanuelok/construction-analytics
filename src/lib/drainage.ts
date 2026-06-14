/* Drainage & flood (SuDS) strategy — pure, unit-tested. Estimates the surface-water
 * runoff a scheme generates and the attenuation it must provide. Splits the site
 * into impervious (building + hardstanding) and pervious area, computes a composite
 * runoff coefficient, the developed peak runoff by the rational method (Q = 2.78·C·i·A),
 * the greenfield runoff it must be limited to, and the storage volume needed to hold
 * back the difference over the critical storm — plus the betterment achieved and SuDS
 * components to suit. The core of a planning drainage strategy. Indicative factors,
 * tunable. No DOM. */

export type DrainageInput = {
  siteArea: number          // m²
  footprint: number         // m² (impervious building)
  hardstandingFrac?: number // 0..1 of the non-built area that is paved (default 0.4)
  intensity?: number        // design rainfall intensity mm/hr (default 50)
  climateFactor?: number    // climate-change uplift (default 1.4)
  greenfieldRate?: number   // l/s/ha allowable discharge (default 7)
  stormDurationHr?: number  // critical storm duration for storage (default 2)
}

export type Drainage = {
  imperviousArea: number; perviousArea: number; imperviousPct: number
  compositeC: number
  effectiveIntensity: number     // mm/hr incl. climate uplift
  peakRunoff: number             // developed, l/s
  greenfieldRunoff: number       // allowable, l/s
  allowableDischarge: number     // l/s (≥ a practical minimum)
  bettermentPct: number          // reduction vs developed peak
  attenuationVolume: number      // m³ of storage required
  suds: string[]                 // recommended components
  verdict: string
}

const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

const C_IMPERVIOUS = 0.9
const C_PERVIOUS = 0.3
const MIN_DISCHARGE = 5 // l/s — practical minimum a control can reliably pass

/** Run the drainage / SuDS assessment. */
export function drainage(input: DrainageInput): Drainage {
  const site = Math.max(0, input.siteArea)
  const footprint = clamp(input.footprint, 0, site)
  const hardFrac = clamp(input.hardstandingFrac ?? 0.4, 0, 1)
  const openArea = Math.max(0, site - footprint)
  const hardstanding = openArea * hardFrac
  const imperviousArea = footprint + hardstanding
  const perviousArea = Math.max(0, site - imperviousArea)
  const imperviousPct = site > 0 ? Math.round((imperviousArea / site) * 100) : 0

  const compositeC = site > 0 ? (C_IMPERVIOUS * imperviousArea + C_PERVIOUS * perviousArea) / site : 0
  const intensity = input.intensity ?? 50
  const climate = input.climateFactor ?? 1.4
  const effectiveIntensity = r1(intensity * climate)
  const ha = site / 10000

  // rational method: Q (l/s) = 2.78 × C × i (mm/hr) × A (ha)
  const peakRunoff = r1(2.78 * compositeC * effectiveIntensity * ha)
  const greenfieldRate = input.greenfieldRate ?? 7
  const greenfieldRunoff = r1(greenfieldRate * ha)
  const allowableDischarge = r1(Math.max(MIN_DISCHARGE, greenfieldRunoff))

  // storage to hold the developed runoff above the allowable discharge over the storm
  const durationS = (input.stormDurationHr ?? 2) * 3600
  const attenuationVolume = r0(Math.max(0, (peakRunoff - allowableDischarge)) * durationS / 1000)
  const bettermentPct = peakRunoff > 0 ? Math.round((1 - allowableDischarge / peakRunoff) * 100) : 0

  const suds: string[] = []
  if (perviousArea / Math.max(1, site) >= 0.2) suds.push('Permeable paving & rain gardens on the landscaped area')
  if (perviousArea / Math.max(1, site) >= 0.1) suds.push('Bio-retention / swales for treatment')
  suds.push(footprint / Math.max(1, site) > 0.4 ? 'Blue/green or attenuation roofs on the large footprint' : 'Green roofs to slow roof runoff')
  if (attenuationVolume > 0) suds.push(`Below-ground attenuation tank/crates (~${attenuationVolume.toLocaleString()} m³) with a flow control to ${allowableDischarge} l/s`)
  if (imperviousPct < 50) suds.push('Infiltration feasible — soakaways if ground conditions allow')

  const verdict = `${imperviousPct}% impervious generates a ${peakRunoff} l/s peak; discharge is limited to ${allowableDischarge} l/s (greenfield), a ${bettermentPct}% betterment needing ~${attenuationVolume.toLocaleString()} m³ of attenuation. ${imperviousPct > 75 ? 'A highly sealed site — maximise green roofs and permeable surfaces.' : 'Surface SuDS can deliver much of the storage.'}`

  return {
    imperviousArea: r0(imperviousArea), perviousArea: r0(perviousArea), imperviousPct,
    compositeC: Math.round(compositeC * 100) / 100, effectiveIntensity,
    peakRunoff, greenfieldRunoff, allowableDischarge, bettermentPct, attenuationVolume, suds, verdict,
  }
}

/** Drainage CSV. */
export function drainageCsv(d: Drainage): string {
  return [
    'Metric,Value',
    `Impervious area (m²),${d.imperviousArea}`, `Pervious area (m²),${d.perviousArea}`, `Impervious share,${d.imperviousPct}%`,
    `Composite runoff coefficient,${d.compositeC}`, `Design intensity (mm/hr incl. climate),${d.effectiveIntensity}`,
    `Developed peak runoff (l/s),${d.peakRunoff}`, `Greenfield runoff (l/s),${d.greenfieldRunoff}`, `Allowable discharge (l/s),${d.allowableDischarge}`,
    `Betterment,${d.bettermentPct}%`, `Attenuation storage (m³),${d.attenuationVolume}`,
    '', 'SuDS components', ...d.suds.map((s) => `,${s}`),
  ].join('\n')
}
