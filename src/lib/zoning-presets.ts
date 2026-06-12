/* Zoning district presets — pure data, like a planner's rulebook. Each loads a
 * complete set of entitlement rules (FAR, height, setback, coverage, sky-exposure
 * plane) plus a default programme split, so picking a district reshapes the whole
 * envelope + feasibility the way choosing a real zoning designation would.
 * Indicative figures distilled from common district families — tunable, not legal
 * advice. No DOM. */

export type ProgrammeMix = { residential: number; office: number; retail: number } // shares, sum ≈ 1

export type ZoningPreset = {
  id: string
  label: string
  blurb: string
  far: number
  heightLimit: number // m
  setback: number // m
  maxCoverage: number // %
  skyBase: number // m (0 = no sky plane)
  skyStep: number // 0–0.6
  mix: ProgrammeMix
}

export const ZONING_PRESETS: ZoningPreset[] = [
  { id: 'downtown-hd', label: 'Downtown high-density (CBD)', blurb: 'Dense commercial core — high FAR, tall towers, sky-exposure step-back.', far: 10, heightLimit: 180, setback: 3, maxCoverage: 80, skyBase: 30, skyStep: 0.3, mix: { residential: 0.2, office: 0.65, retail: 0.15 } },
  { id: 'urban-mixed', label: 'Urban mixed-use', blurb: 'Mid-rise mixed-use streets — moderate FAR, active ground floor.', far: 5, heightLimit: 75, setback: 4, maxCoverage: 70, skyBase: 24, skyStep: 0.3, mix: { residential: 0.55, office: 0.25, retail: 0.2 } },
  { id: 'residential-md', label: 'Residential medium-density', blurb: 'Apartment neighbourhoods — generous setbacks, podium-and-tower.', far: 3.5, heightLimit: 50, setback: 6, maxCoverage: 50, skyBase: 18, skyStep: 0.35, mix: { residential: 0.9, office: 0, retail: 0.1 } },
  { id: 'residential-low', label: 'Residential low-rise', blurb: 'Townhouse / low-rise — low FAR, deep setbacks, no tower.', far: 1.2, heightLimit: 18, setback: 8, maxCoverage: 40, skyBase: 0, skyStep: 0, mix: { residential: 1, office: 0, retail: 0 } },
  { id: 'commercial-corr', label: 'Commercial corridor', blurb: 'Arterial commercial — broad plates, retail + office, modest height.', far: 4, heightLimit: 40, setback: 3, maxCoverage: 75, skyBase: 0, skyStep: 0, mix: { residential: 0.1, office: 0.5, retail: 0.4 } },
  { id: 'industrial-flex', label: 'Industrial / flex', blurb: 'Light-industrial & logistics — low FAR, big single-storey footprints.', far: 1, heightLimit: 16, setback: 5, maxCoverage: 65, skyBase: 0, skyStep: 0, mix: { residential: 0, office: 0.2, retail: 0, /* balance is industrial */ } },
]

export const presetById = (id: string): ZoningPreset | undefined => ZONING_PRESETS.find((p) => p.id === id)

/** Normalise a mix to sum 1 (industrial = the unallocated remainder is handled by callers). */
export function normaliseMix(mix: ProgrammeMix): ProgrammeMix {
  const s = mix.residential + mix.office + mix.retail
  if (s <= 0) return { residential: 0, office: 0, retail: 0 }
  return { residential: mix.residential / s, office: mix.office / s, retail: mix.retail / s }
}
