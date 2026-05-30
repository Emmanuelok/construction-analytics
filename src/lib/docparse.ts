/* Document intelligence — a deterministic, dependency-free extraction engine
 * that operates on real pasted text (specs, RFIs, contracts, submittals). It
 * classifies the document, pulls structured entities (money, dates, durations,
 * standards, spec sections, references, measurements, parties), extracts
 * shall/must requirements, and flags risk clauses. Pure and unit-tested — the
 * analytical core of an operable Document Intelligence workbench. */

export type DocType = 'RFI' | 'Specification' | 'Contract' | 'Submittal' | 'Report' | 'Drawing Note' | 'Unknown'
export type EntityKind = 'money' | 'date' | 'duration' | 'standard' | 'section' | 'reference' | 'measurement' | 'party'
export type Entity = { kind: EntityKind; value: string }
export type Modal = 'shall' | 'must' | 'required' | 'will'
export type Requirement = { text: string; modal: Modal }
export type Severity = 'High' | 'Medium' | 'Low'
export type RiskFlag = { term: string; severity: Severity; sentence: string }

export type ParsedDoc = {
  docType: DocType
  confidence: number // 0–100
  wordCount: number
  sentenceCount: number
  entities: Entity[]
  entityCounts: { kind: EntityKind; count: number }[]
  requirements: Requirement[]
  risks: RiskFlag[]
  references: string[] // standards + reference codes + sections, deduped
  summary: string
}

const KIND_ORDER: EntityKind[] = ['money', 'date', 'duration', 'standard', 'section', 'reference', 'measurement', 'party']

/* Extraction patterns, run in this order; a value already captured (case-
 * insensitive) is not double-counted under a later kind. */
const PATTERNS: { kind: EntityKind; re: RegExp }[] = [
  { kind: 'money', re: /(?:USD|US\$|\$|€|£|EUR|GBP)\s?\d[\d,]*(?:\.\d+)?\s?(?:million|billion|bn|m|k)?\b/gi },
  { kind: 'date', re: /\b\d{4}-\d{2}-\d{2}\b/g },
  { kind: 'date', re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi },
  { kind: 'date', re: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g },
  { kind: 'duration', re: /\b\d+(?:\.\d+)?[-\s](?:calendar day|working day|business day|hour|hr|day|week|month|year)s?\b/gi },
  { kind: 'duration', re: /\b(?:calendar|working|business)\s(?:day|week|month)s?\b/gi },
  { kind: 'standard', re: /\b(?:ASTM|EN|ISO|UL|BS|AS\/NZS|ACI|AISC|AWS|BHMA|ANSI|NFPA|IEC|IBC|ASHRAE|DIN)\s?[A-Z]?-?\d[\w.\/-]*\b/g },
  { kind: 'section', re: /§\s?\d{2}\s?\d{2}\s?\d{2}(?:\s?\d{2})?\b/g },
  { kind: 'section', re: /\b\d{2}\s\d{2}\s\d{2}\b/g },
  { kind: 'section', re: /\bSection\s\d+(?:\.\d+)?\b/gi },
  { kind: 'reference', re: /\b(?:RFI|NCR|PCO|ASI|EWN|CVI|FCR|CO|SI|IR)[-\s]?\d+\b/gi },
  { kind: 'measurement', re: /\bC\d{2}\/\d{2}\b/g },
  { kind: 'measurement', re: /±\s?\d+(?:\.\d+)?\s?(?:mm|cm|m)\b/g },
  { kind: 'measurement', re: /\bSTC\s?\d+\b/gi },
  // longest units first (kg/m³ before kg); no trailing \b — unit symbols (³, ², %, °) are non-word chars
  { kind: 'measurement', re: /\b\d+(?:\.\d+)?\s?(?:kg\/m³|kg\/m3|kWh\/m²|MPa|kPa|GPa|kN|mm|cm|km|kg|m²|m³|°C|ppm|%|dB|lux|lm)/gi },
  { kind: 'party', re: /\bthe\s(?:Contractor|Engineer|Architect|Employer|Owner|Sub-?contractor|Supplier|Consultant|Client)\b/gi },
  { kind: 'party', re: /\b[A-Z][A-Za-z&.]+(?:\s[A-Z][A-Za-z&.]+){0,3}\s(?:Ltd|LLC|Inc|Co|Corporation|Group|Partners|Associates|Consultancy|Engineering)\b/g },
]

/* Document-type classification signals (case-insensitive substring counts). */
const SIGNALS: Record<Exclude<DocType, 'Unknown'>, RegExp[]> = {
  RFI: [/request for information/i, /\bRFI\b/i, /please confirm/i, /clarification/i, /seeking direction/i, /awaiting response/i],
  Specification: [/shall conform/i, /in accordance with/i, /\bASTM\b|\bEN \d|\bISO\b/i, /minimum .* strength/i, /\bsection \d/i, /tolerance/i, /\bC\d{2}\/\d{2}\b/],
  Contract: [/liquidated damages/i, /the Contractor shall/i, /termination/i, /\bagreement\b/i, /indemnif/i, /per calendar day/i, /\bparty\b|\bparties\b/i],
  Submittal: [/submittal/i, /for approval/i, /shop drawing/i, /product data/i, /\bresubmit/i, /samples? for review/i],
  Report: [/\breport\b/i, /\bsummary\b/i, /findings/i, /as of/i, /progress/i, /inspection/i, /observed/i],
  'Drawing Note': [/\bdetail\b/i, /\btyp\.?\b/i, /U\.?N\.?O\.?/i, /see drawing/i, /grid\s?[A-Z]?\d/i, /refer to/i],
}

const RISK_TERMS: { re: RegExp; term: string; severity: Severity }[] = [
  { re: /liquidated damages/i, term: 'Liquidated damages', severity: 'High' },
  { re: /\btermination\b/i, term: 'Termination', severity: 'High' },
  { re: /\bpenalt(?:y|ies)\b/i, term: 'Penalty', severity: 'High' },
  { re: /indemnif/i, term: 'Indemnity', severity: 'High' },
  { re: /\bbreach\b/i, term: 'Breach', severity: 'High' },
  { re: /non-?compliance|non-?conform/i, term: 'Non-compliance', severity: 'High' },
  { re: /\bdefault\b/i, term: 'Default', severity: 'High' },
  { re: /\bdelay\b/i, term: 'Delay', severity: 'Medium' },
  { re: /\bdeadline\b|completion milestone|by no later than/i, term: 'Deadline', severity: 'Medium' },
  { re: /\bdispute\b|\bclaim\b/i, term: 'Dispute / claim', severity: 'Medium' },
  { re: /\bdeviat/i, term: 'Deviation', severity: 'Medium' },
  { re: /\bdeficien/i, term: 'Deficiency', severity: 'Medium' },
  { re: /\boverdue\b/i, term: 'Overdue', severity: 'Medium' },
]

function uniqPush(seen: Set<string>, out: Entity[], kind: EntityKind, value: string) {
  const key = value.trim().toLowerCase()
  if (!key || seen.has(key)) return
  seen.add(key)
  out.push({ kind, value: value.trim() })
}

/** Split text into trimmed sentence-ish segments (on . ! ? and ;). */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Parse a document's text into structured intelligence. */
export function parseDocument(text: string): ParsedDoc {
  const clean = text ?? ''
  const words = clean.trim().length ? clean.trim().split(/\s+/) : []
  const segs = sentences(clean)

  // entities (dedup across kinds by value)
  const seen = new Set<string>()
  const entities: Entity[] = []
  for (const { kind, re } of PATTERNS) {
    const matches = clean.match(re)
    if (matches) for (const m of matches) uniqPush(seen, entities, kind, m)
  }
  const entityCounts = KIND_ORDER.map((kind) => ({ kind, count: entities.filter((e) => e.kind === kind).length })).filter((c) => c.count > 0)

  // requirements: sentences with a normative modal
  const requirements: Requirement[] = []
  for (const s of segs) {
    let modal: Modal | null = null
    if (/\bshall\b/i.test(s)) modal = 'shall'
    else if (/\bmust\b/i.test(s)) modal = 'must'
    else if (/\bis required to\b|\bare required to\b|\brequired\b/i.test(s)) modal = 'required'
    else if (/\bwill\b/i.test(s)) modal = 'will'
    if (modal) requirements.push({ text: s, modal })
  }

  // risk flags: first sentence containing each risk term
  const risks: RiskFlag[] = []
  const seenRisk = new Set<string>()
  for (const { re, term, severity } of RISK_TERMS) {
    if (seenRisk.has(term)) continue
    const hit = segs.find((s) => re.test(s)) ?? (re.test(clean) ? clean.slice(0, 160) : undefined)
    if (hit) { seenRisk.add(term); risks.push({ term, severity, sentence: hit }) }
  }

  // classification
  let docType: DocType = 'Unknown'
  let confidence = 0
  const scores = (Object.keys(SIGNALS) as Exclude<DocType, 'Unknown'>[]).map((t) => ({ t, score: SIGNALS[t].reduce((n, re) => n + (re.test(clean) ? 1 : 0), 0) }))
  const total = scores.reduce((n, s) => n + s.score, 0)
  if (total > 0) {
    const top = scores.sort((a, b) => b.score - a.score)[0]
    docType = top.t
    confidence = Math.min(98, Math.round((top.score / total) * 100 * (top.score >= 2 ? 1 : 0.7)))
  }

  const references = entities.filter((e) => e.kind === 'standard' || e.kind === 'reference' || e.kind === 'section').map((e) => e.value)

  const summary =
    words.length === 0
      ? 'Paste or type document text to extract entities, requirements and risk flags.'
      : `${docType === 'Unknown' ? 'Document' : docType}${confidence ? ` (${confidence}% confidence)` : ''} · ${words.length} words, ${segs.length} sentences. Extracted ${entities.length} entit${entities.length === 1 ? 'y' : 'ies'}, ${requirements.length} requirement${requirements.length === 1 ? '' : 's'} and ${risks.length} risk flag${risks.length === 1 ? '' : 's'}.`

  return {
    docType,
    confidence,
    wordCount: words.length,
    sentenceCount: segs.length,
    entities,
    entityCounts,
    requirements,
    risks,
    references,
    summary,
  }
}

export const KIND_LABEL: Record<EntityKind, string> = {
  money: 'Money', date: 'Date', duration: 'Duration', standard: 'Standard',
  section: 'Spec section', reference: 'Reference', measurement: 'Measurement', party: 'Party',
}
