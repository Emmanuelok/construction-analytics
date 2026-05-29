import type { CatalogDataset } from '@/data/catalog'
import { CATEGORIES } from '@/data/catalog'
import { NAV, type Accent } from '@/lib/nav'

/* ============================================================================
 * The platform's intelligence layer — a dependency-free, deterministic engine
 * that personalizes the experience to each user. It builds an interest model
 * from the user's profile + behavior, scores every dataset for them with
 * human-readable reasons, finds similar datasets, derives insights, and parses
 * natural-language intent for the agentic command palette. Pure functions only.
 * ========================================================================== */

export type ExperienceLevel = 'Explorer' | 'Practitioner' | 'Expert'

export type UserProfile = {
  name: string
  role: string
  disciplines: string[]
  sectors: string[]
  goals: string[]
  experience: ExperienceLevel
  onboarded: boolean
}

export type Signals = {
  views: Record<string, number>
  lastViewed: string[]
  searches: string[]
  tagAffinity: Record<string, number>
  catAffinity: Record<string, number>
  actions: number
}

export const EMPTY_PROFILE: UserProfile = {
  name: '',
  role: '',
  disciplines: [],
  sectors: [],
  goals: [],
  experience: 'Practitioner',
  onboarded: false,
}
export const EMPTY_SIGNALS: Signals = { views: {}, lastViewed: [], searches: [], tagAffinity: {}, catAffinity: {}, actions: 0 }

/* ----------------------------------------------------------- onboarding vocab */
export const ROLES = [
  'Architect',
  'Structural Engineer',
  'MEP Engineer',
  'Contractor',
  'Developer',
  'Cost Manager',
  'Sustainability Lead',
  'Data Scientist',
  'Researcher',
  'Facilities / Owner',
]
export const DISCIPLINES = ['Architecture', 'Structural', 'MEP', 'Civil & Site', 'Fire', 'Façade', 'Geotechnical']
export const SECTORS = ['Commercial', 'Residential', 'Healthcare', 'Data Center', 'Industrial', 'Aviation', 'Education', 'Infrastructure']
export const GOALS = [
  'Benchmark costs',
  'Reduce embodied carbon',
  'Train AI models',
  'Win more bids',
  'Improve schedules',
  'Research & academia',
  'Operate & maintain assets',
  'Quality & safety',
]

/* role / goal → weighted interest tokens (categories + tags, lowercased later) */
const ROLE_AFFINITY: Record<string, string[]> = {
  Architect: ['BIM & Models', 'Geospatial', 'Sustainability', 'IFC', 'zoning', 'objects'],
  'Structural Engineer': ['BIM & Models', 'Schedule & Controls', 'IFC', 'clash', 'rebar'],
  'MEP Engineer': ['BIM & Models', 'Operations', 'BMS', 'IoT', 'energy'],
  Contractor: ['Construction Field', 'Schedule & Controls', 'Procurement', 'productivity', 'delays'],
  Developer: ['Cost & Estimating', 'Geospatial', 'Sustainability', 'benchmarking'],
  'Cost Manager': ['Cost & Estimating', 'Procurement', 'benchmarking', 'cost/m²', 'unit-rates'],
  'Sustainability Lead': ['Sustainability', 'EPD', 'GWP', 'LCA', 'ESG'],
  'Data Scientist': ['AI Training', 'Quality', 'Reality Capture', 'LLM', 'computer-vision'],
  Researcher: ['AI Training', 'Quality', 'Geospatial', 'NLP', 'fine-tuning'],
  'Facilities / Owner': ['Operations', 'Handover & Assets', 'COBie', 'BMS', 'IoT'],
}
const GOAL_AFFINITY: Record<string, string[]> = {
  'Benchmark costs': ['Cost & Estimating', 'benchmarking', 'cost/m²', 'unit-rates'],
  'Reduce embodied carbon': ['Sustainability', 'EPD', 'GWP', 'LCA', 'ESG'],
  'Train AI models': ['AI Training', 'Quality', 'Reality Capture', 'LLM', 'computer-vision', 'fine-tuning'],
  'Win more bids': ['Procurement', 'Cost & Estimating', 'suppliers', 'lead-time'],
  'Improve schedules': ['Schedule & Controls', 'Construction Field', 'delays', 'critical-path'],
  'Research & academia': ['AI Training', 'Geospatial', 'NLP', 'objects'],
  'Operate & maintain assets': ['Operations', 'Handover & Assets', 'COBie', 'BMS', 'IoT'],
  'Quality & safety': ['Quality', 'defects', 'NCR', 'computer-vision'],
}

const CAT_SET = new Set(CATEGORIES.map((c) => c.toLowerCase()))

/** Weighted interest vector (token → weight) derived from the user's profile. */
export function profileVector(p: UserProfile): Map<string, number> {
  const v = new Map<string, number>()
  const add = (tok: string, w: number) => {
    const k = tok.toLowerCase()
    v.set(k, (v.get(k) ?? 0) + w)
  }
  if (p.role) (ROLE_AFFINITY[p.role] ?? []).forEach((t) => add(t, 3))
  p.goals.forEach((g) => (GOAL_AFFINITY[g] ?? []).forEach((t) => add(t, 2.5)))
  p.disciplines.forEach((d) => add(d, 1.4))
  p.sectors.forEach((s) => add(s, 1))
  return v
}

export function datasetTokens(d: CatalogDataset): string[] {
  const cat = d.category.toLowerCase()
  const catWords = cat.split(/[^a-z0-9]+/).filter((w) => w.length > 2)
  return [cat, d.modality.toLowerCase(), ...catWords, ...d.tags.map((t) => t.toLowerCase())]
}

/** Token-overlap similarity in [0,1]; category/modality matches weigh double. */
export function similarity(a: CatalogDataset, b: CatalogDataset): number {
  const sa = new Set(datasetTokens(a))
  const sb = new Set(datasetTokens(b))
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter += t === a.category.toLowerCase() || t === a.modality.toLowerCase() ? 2 : 1
  const union = sa.size + sb.size - Array.from(sa).filter((t) => sb.has(t)).length
  return union > 0 ? Math.min(1, inter / union) : 0
}

export function similarTo(d: CatalogDataset, all: CatalogDataset[], limit = 4): CatalogDataset[] {
  return all
    .filter((x) => x.id !== d.id)
    .map((x) => ({ x, s: similarity(d, x) }))
    .filter((r) => r.s > 0.08)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.x)
}

export type Recommendation = { dataset: CatalogDataset; score: number; reasons: string[] }

const minMax = (vals: number[]) => {
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  return (x: number) => (x - min) / span
}

/** Rank datasets for a user from interest model + behavior + similarity. */
export function recommend(
  all: CatalogDataset[],
  profile: UserProfile,
  signals: Signals,
  opts: { excludeIds?: Set<string>; limit?: number } = {},
): Recommendation[] {
  const exclude = opts.excludeIds ?? new Set<string>()
  const vec = profileVector(profile)
  const recentViewed = signals.lastViewed.slice(0, 4).map((id) => all.find((d) => d.id === id)).filter(Boolean) as CatalogDataset[]

  const profileCats = new Set(Array.from(vec.keys()).filter((k) => CAT_SET.has(k)))
  const profileTags = new Set(Array.from(vec.keys()).filter((k) => !CAT_SET.has(k)))

  const candidates = all.filter((d) => !exclude.has(d.id))
  if (!candidates.length) return []

  const raw = candidates.map((d) => {
    const tokens = new Set(datasetTokens(d))
    let interest = 0
    for (const t of tokens) interest += vec.get(t) ?? 0
    let behavior = (signals.catAffinity[d.category] ?? 0) * 2
    for (const t of d.tags) behavior += signals.tagAffinity[t.toLowerCase()] ?? 0
    let simViewed = 0
    let simName = ''
    for (const rv of recentViewed) {
      if (rv.id === d.id) continue
      const s = similarity(d, rv)
      if (s > simViewed) {
        simViewed = s
        simName = rv.name
      }
    }
    const popularity = Math.log10(d.downloads + 1)
    return { d, interest, behavior, simViewed, simName, popularity }
  })

  const nInterest = minMax(raw.map((r) => r.interest))
  const nBehavior = minMax(raw.map((r) => r.behavior))
  const nPop = minMax(raw.map((r) => r.popularity))

  const scored: Recommendation[] = raw.map((r) => {
    const quality = (r.d.quality / 100) * 0.6 + (r.d.rating / 5) * 0.4
    const score =
      0.42 * nInterest(r.interest) +
      0.28 * nBehavior(r.behavior) +
      0.16 * r.simViewed +
      0.08 * quality +
      0.06 * nPop(r.popularity)

    const reasons: string[] = []
    if (profileCats.has(r.d.category.toLowerCase())) reasons.push(`Fits your focus on ${r.d.category}`)
    const matchedTag = r.d.tags.find((t) => profileTags.has(t.toLowerCase()))
    if (matchedTag && reasons.length < 2) reasons.push(`Matches your interest in “${matchedTag}”`)
    if (r.simViewed > 0.34 && r.simName && reasons.length < 2) reasons.push(`Similar to ${r.simName}`)
    if (r.behavior > 0 && reasons.length < 2) reasons.push('Based on your recent activity')
    if (r.d.price === 0 && reasons.length < 2) reasons.push('Free to download')
    if (r.d.quality >= 96 && reasons.length < 2) reasons.push(`Top quality · ${r.d.quality}%`)
    if (!reasons.length) reasons.push('Popular across the marketplace')

    return { dataset: r.d, score, reasons: reasons.slice(0, 2) }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 6)
}

/* ----------------------------------------------------------------- insights */
export type Insight = { id: string; title: string; body: string; accent: Accent; to?: string; cta?: string }

export function insightsFor(
  all: CatalogDataset[],
  profile: UserProfile,
  signals: Signals,
  ownedIds: Set<string>,
): Insight[] {
  const out: Insight[] = []
  const recs = recommend(all, profile, signals, { excludeIds: ownedIds, limit: 6 })

  // Top explored category → next best step
  const cats = Object.entries(signals.catAffinity).sort((a, b) => b[1] - a[1])
  if (cats.length && cats[0][1] >= 2) {
    const [cat] = cats[0]
    const next = recs.find((r) => r.dataset.category === cat) ?? recs[0]
    if (next)
      out.push({
        id: 'explored',
        title: `You're deep in ${cat}`,
        body: `Based on what you've opened, “${next.dataset.name}” is your most relevant next dataset.`,
        accent: 'cyan',
        to: `/data/${next.dataset.id}`,
        cta: 'Open dataset',
      })
  }

  // Free matches for the profile
  const free = recs.filter((r) => r.dataset.price === 0 && !ownedIds.has(r.dataset.id))
  if (free.length)
    out.push({
      id: 'free',
      title: `${free.length} free dataset${free.length > 1 ? 's' : ''} match your profile`,
      body: `Including “${free[0].dataset.name}”. License-free and ready to download or analyze.`,
      accent: 'emerald',
      to: '/data',
      cta: 'Browse Data Center',
    })

  // Goal-driven nudges
  if (profile.goals.includes('Reduce embodied carbon'))
    out.push({
      id: 'carbon',
      title: 'On a net-zero path',
      body: 'Pair EPD & embodied-carbon factors with your IFC quantities to estimate whole-life carbon early.',
      accent: 'teal',
      to: '/sustainability',
      cta: 'Open Sustainability',
    })
  if (profile.goals.includes('Train AI models'))
    out.push({
      id: 'ai',
      title: 'Build training-grade corpora',
      body: 'Curate, label and anonymize multi-modal AEC data — RFI pairs, defect imagery and classified IFC.',
      accent: 'fuchsia',
      to: '/ai-studio',
      cta: 'Open AI Studio',
    })

  // Cold-start: encourage profile completion
  if (signals.actions < 3 && out.length < 3)
    out.push({
      id: 'start',
      title: 'Your studio is learning',
      body: 'Open a few datasets and the platform will tailor recommendations, insights and search to you.',
      accent: 'violet',
      to: '/data',
      cta: 'Explore data',
    })

  return out.slice(0, 3)
}

/* greeting helper */
export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ----------------------------------------------------- command-palette intent */
export type Command = {
  id: string
  title: string
  subtitle?: string
  group: 'Recommended' | 'Datasets' | 'Navigate' | 'Answers' | 'Actions'
  accent: Accent
  to?: string
  datasetId?: string
  action?: 'addToCart' | 'license' | 'analyze'
  answerId?: string
}

const ANSWER_TOPICS: { id: string; kw: string[]; label: string }[] = [
  { id: 'budget', kw: ['budget', 'overrun', 'over budget', 'cost variance'], label: 'Which projects exceeded budget, and why?' },
  { id: 'suppliers', kw: ['supplier', 'lead time', 'procurement', 'vendor'], label: 'Which suppliers had the longest lead times?' },
  { id: 'carbon', kw: ['carbon', 'net zero', 'embodied', 'esg', 'emissions'], label: 'Are we on track for net-zero embodied carbon?' },
  { id: 'cost-m2', kw: ['cost per', 'm2', 'm²', 'cost intensity', 'unit cost'], label: 'Compare cost per m² across sectors.' },
  { id: 'risk', kw: ['risk', 'delay', 'schedule', 'slip', 'late'], label: 'Where is schedule risk highest right now?' },
]

function datasetMatchScore(d: CatalogDataset, q: string): number {
  const hay = `${d.name} ${d.provider} ${d.category} ${d.modality} ${d.tags.join(' ')}`.toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)
  let s = 0
  for (const t of terms) {
    if (hay.includes(t)) s += 1
    if (d.name.toLowerCase().includes(t)) s += 1.5
  }
  return s
}

/** Parse a query into executable commands across the whole platform. */
export function interpret(
  query: string,
  ctx: { datasets: CatalogDataset[]; profile: UserProfile; signals: Signals; ownedIds: Set<string> },
): Command[] {
  const q = query.trim().toLowerCase()
  const out: Command[] = []

  // Empty query → personal launchpad
  if (!q) {
    recommend(ctx.datasets, ctx.profile, ctx.signals, { excludeIds: ctx.ownedIds, limit: 3 }).forEach((r) =>
      out.push({ id: `rec-${r.dataset.id}`, title: r.dataset.name, subtitle: r.reasons[0], group: 'Recommended', accent: r.dataset.accent, datasetId: r.dataset.id }),
    )
    out.push({ id: 'a-data', title: 'Browse the Data Center', group: 'Actions', accent: 'emerald', to: '/data' })
    out.push({ id: 'a-ws', title: 'Start a workspace', subtitle: 'Frame a problem → ship', group: 'Actions', accent: 'violet', to: '/workspaces' })
    out.push({ id: 'a-analyze', title: 'Open Analysis Studio', group: 'Actions', accent: 'violet', to: '/analyze' })
    out.push({ id: 'a-sell', title: 'Sell your data', group: 'Actions', accent: 'lime', to: '/sell' })
    out.push({ id: 'a-profile', title: 'Edit your profile & interests', group: 'Actions', accent: 'cyan', to: '/?profile=1' })
    return out
  }

  const wantsRecs = /recommend|for me|suggest|what should|best for/.test(q)
  const wantsFree = /\bfree\b|no cost|open data/.test(q)
  const priceMatch = q.match(/under \$?([\d,]+)|cheaper than \$?([\d,]+)|below \$?([\d,]+)/)
  const priceCap = priceMatch ? Number((priceMatch[1] || priceMatch[2] || priceMatch[3]).replace(/,/g, '')) : null

  // Recommendations
  if (wantsRecs) {
    recommend(ctx.datasets, ctx.profile, ctx.signals, { excludeIds: ctx.ownedIds, limit: 4 }).forEach((r) =>
      out.push({ id: `rec-${r.dataset.id}`, title: r.dataset.name, subtitle: r.reasons.join(' · '), group: 'Recommended', accent: r.dataset.accent, datasetId: r.dataset.id }),
    )
  }

  // Dataset matches (with price/free filters)
  let matches = ctx.datasets
    .map((d) => ({ d, s: datasetMatchScore(d, q) }))
    .filter((r) => r.s > 0 || wantsFree || priceCap != null)
  if (wantsFree) matches = matches.filter((r) => r.d.price === 0)
  if (priceCap != null) matches = matches.filter((r) => (r.d.price ?? Infinity) <= priceCap)
  matches
    .sort((a, b) => b.s - a.s || b.d.downloads - a.d.downloads)
    .slice(0, 6)
    .forEach(({ d }) => {
      out.push({ id: `ds-${d.id}`, title: d.name, subtitle: `${d.category} · ${d.modality} · ${d.price === 0 ? 'Free' : d.price == null ? 'On request' : '$' + d.price.toLocaleString()}`, group: 'Datasets', accent: d.accent, datasetId: d.id })
      if (/add .*cart|buy|license|get /.test(q) && !ctx.ownedIds.has(d.id))
        out.push({ id: `cart-${d.id}`, title: `${d.price ? 'Add to cart' : 'Get'}: ${d.name}`, group: 'Actions', accent: 'emerald', datasetId: d.id, action: d.price ? 'addToCart' : 'license' })
      if (/analyze|analyse|profile|chart/.test(q))
        out.push({ id: `an-${d.id}`, title: `Analyze: ${d.name}`, group: 'Actions', accent: 'violet', action: 'analyze', datasetId: d.id })
    })

  // Pages
  NAV.filter((n) => `${n.label} ${n.blurb} ${n.path}`.toLowerCase().includes(q))
    .slice(0, 4)
    .forEach((n) => out.push({ id: `nav-${n.path}`, title: n.label, subtitle: n.blurb, group: 'Navigate', accent: n.accent, to: n.path }))

  // Analytics answers
  ANSWER_TOPICS.filter((t) => t.kw.some((k) => q.includes(k)))
    .slice(0, 2)
    .forEach((t) => out.push({ id: `ans-${t.id}`, title: t.label, subtitle: 'Answer in Ask AEC', group: 'Answers', accent: 'violet', answerId: t.id }))

  // Fallback: send to Ask
  if (!out.length) out.push({ id: 'ask-fallback', title: `Ask AEC: “${query.trim()}”`, subtitle: 'Natural-language analytics', group: 'Answers', accent: 'violet', to: `/ask?q=${encodeURIComponent(query.trim())}` })

  return out
}

/* ============================================ problem-driven workspace copilot */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'our', 'we', 'with', 'by', 'at', 'is', 'are', 'be',
  'that', 'this', 'it', 'how', 'can', 'do', 'does', 'need', 'want', 'using', 'use', 'data', 'dataset', 'datasets',
  'across', 'from', 'into', 'more', 'less', 'project', 'projects', 'build', 'building', 'buildings', 'help', 'find', 'should',
])

export function tokenizeProblem(text: string): string[] {
  const toks = text
    .toLowerCase()
    .split(/[^a-z0-9µ²]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  return Array.from(new Set(toks))
}

/** Rank datasets by relevance to a free-text problem + sectors, with reasons. */
export function recommendForProblem(problem: string, sectors: string[], all: CatalogDataset[], limit = 6): Recommendation[] {
  const ptoks = tokenizeProblem(problem)
  const secToks = sectors.map((s) => s.toLowerCase())
  const scored = all.map((d) => {
    const hay = `${d.name} ${d.provider} ${d.category} ${d.modality} ${d.tags.join(' ')} ${d.description}`.toLowerCase()
    const matched: string[] = []
    let s = 0
    for (const t of ptoks) if (hay.includes(t)) { s += 1; matched.push(t) }
    let secMatch = ''
    for (const sec of secToks) if (hay.includes(sec)) { s += 0.8; secMatch = sec }
    s += ((d.quality / 100) * 0.6 + (d.rating / 5) * 0.4) * 0.8
    const reasons: string[] = []
    if (matched.length) reasons.push(`Relevant to ${matched.slice(0, 3).map((m) => `“${m}”`).join(', ')}`)
    if (secMatch) reasons.push(`Covers ${sectors.find((x) => x.toLowerCase() === secMatch) ?? secMatch}`)
    if (d.quality >= 95 && reasons.length < 2) reasons.push(`Top quality · ${d.quality}%`)
    if (!reasons.length) reasons.push(`${d.category} · ${d.modality}`)
    return { dataset: d, score: s, reasons: reasons.slice(0, 2) }
  })
  return scored.filter((r) => r.score > 0.4).sort((a, b) => b.score - a.score).slice(0, limit)
}

const HYPOTHESIS_BANK: { kw: string[]; items: string[] }[] = [
  { kw: ['carbon', 'embodied', 'co2', 'net-zero', 'esg', 'sustainab'], items: ['Switching to lower-carbon concrete mixes cuts A1–A3 embodied carbon by ≥15%.', 'Structural frame + substructure drive >50% of embodied carbon on this typology.', 'EAF structural steel closes most of the net-zero gap on in-design projects.'] },
  { kw: ['cost', 'budget', 'overrun', 'estimat', 'benchmark', 'price'], items: ['MEP density explains most of the cost-per-m² variance across sectors.', 'PPP/EPCM delivery shows systematically higher cost variance.', 'Design change orders correlate with >60% of forecast overruns.'] },
  { kw: ['schedule', 'delay', 'critical', 'time', 'slip'], items: ['MEP rough-in is the dominant critical-path constraint.', 'Late material deliveries account for most slip beyond 30 days.', 'Float erosion concentrates in envelope and fit-out trades.'] },
  { kw: ['supplier', 'procure', 'bid', 'vendor', 'lead'], items: ['Dual-sourcing glazing materially reduces façade lead-time risk.', 'On-time delivery rate predicts schedule slip better than price.'] },
  { kw: ['defect', 'quality', 'safety', 'ncr', 'rework'], items: ['Concrete and envelope trades generate most high-severity defects.', 'CV defect detection reaches usable precision above 0.85 confidence.'] },
  { kw: ['model', 'train', 'machine', 'llm', 'nlp', 'vision'], items: ['A multi-modal corpus (RFI pairs + classified IFC + defect imagery) lifts domain-model accuracy.', 'Anonymized, license-clean data suffices to fine-tune a useful construction model.'] },
]

export function suggestHypotheses(problem: string): string[] {
  const p = problem.toLowerCase()
  const out: string[] = []
  for (const b of HYPOTHESIS_BANK) if (b.kw.some((k) => p.includes(k))) out.push(...b.items)
  if (!out.length) out.push('The available data is sufficient to answer the core question.', 'A measurable baseline can be established from benchmark datasets.', 'The biggest lever sits in one or two dominant drivers.')
  return Array.from(new Set(out)).slice(0, 4)
}

export function suggestTasks(stage: string): string[] {
  switch (stage) {
    case 'frame':
      return ['Write a one-line problem statement', 'Define the target metric & baseline', 'List stakeholders & constraints']
    case 'assemble':
      return ['Attach 2–3 relevant datasets', 'Check licenses & coverage', 'Note the data gaps to fill']
    case 'analyze':
      return ['Profile each dataset in Analysis Studio', 'Test the top hypothesis', 'Quantify the dominant driver']
    case 'decide':
      return ['Validate or reject each hypothesis', 'Record the decision & rationale', 'Estimate impact on the target metric']
    case 'produce':
      return ['Draft the output (report / model / takeoff)', 'Review with stakeholders', 'Ship & log the artifact']
    default:
      return ['Define the next concrete step']
  }
}
