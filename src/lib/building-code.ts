/* Building-code presets — pure data + types shared by the stair check (building-stairs)
 * and the egress / life-safety analysis (egress). Three indicative jurisdictions (IBC,
 * UK Approved Documents, Eurocode-style) with stair geometry limits and means-of-escape
 * limits. These are simplified, tunable assumptions for a design-stage check — not a
 * certified code compliance tool. No DOM, no engines. */

export type CodeKey = 'IBC' | 'UK' | 'EU'

export type StairLimits = { maxRise: number; minGoing: number; minWidth: number; maxPitch: number; rgLo: number; rgHi: number; maxRisersPerFlight: number }
export type EgressLimits = { maxTravel: number; occLoadFactor: number; widthPerOccupantMm: number; twoExitsAbove: number; minExitWidth: number; maxCompartment: number }
export type CodePreset = { key: CodeKey; label: string; note: string; stair: StairLimits; egress: EgressLimits }

export const CODE_PRESETS: Record<CodeKey, CodePreset> = {
  IBC: {
    key: 'IBC', label: 'IBC (US)', note: 'Business, sprinklered — IBC 1011/1017 (indicative).',
    stair: { maxRise: 0.178, minGoing: 0.279, minWidth: 1.118, maxPitch: 37.5, rgLo: 0.55, rgHi: 0.7, maxRisersPerFlight: 16 },
    egress: { maxTravel: 91, occLoadFactor: 9.3, widthPerOccupantMm: 5.1, twoExitsAbove: 49, minExitWidth: 1.118, maxCompartment: 4600 },
  },
  UK: {
    key: 'UK', label: 'UK (ADB / ADK)', note: 'Office, sprinklered — Approved Documents B & K (indicative).',
    stair: { maxRise: 0.17, minGoing: 0.25, minWidth: 1.1, maxPitch: 38, rgLo: 0.55, rgHi: 0.7, maxRisersPerFlight: 16 },
    egress: { maxTravel: 45, occLoadFactor: 6, widthPerOccupantMm: 5.0, twoExitsAbove: 60, minExitWidth: 1.05, maxCompartment: 2000 },
  },
  EU: {
    key: 'EU', label: 'Eurocode-style', note: 'Office — EN/typical European practice (indicative).',
    stair: { maxRise: 0.18, minGoing: 0.25, minWidth: 1.2, maxPitch: 38, rgLo: 0.55, rgHi: 0.7, maxRisersPerFlight: 16 },
    egress: { maxTravel: 40, occLoadFactor: 7, widthPerOccupantMm: 5.0, twoExitsAbove: 50, minExitWidth: 1.2, maxCompartment: 1600 },
  },
}

export const CODE_KEYS: CodeKey[] = ['IBC', 'UK', 'EU']
