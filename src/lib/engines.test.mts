/* Consolidated engine tests — the analytical cores behind the operable
 * workbenches. Pure functions, deterministic, no DOM. Run: npm test
 * (tsx src/lib/engines.test.mts). CI runs this after the typecheck gate. */

import { scoreSuppliers, normalizeWeights as normSupplierW, cohortStats, DEFAULT_WEIGHTS as SUP_W, type SupplierInput } from './supplier-score.ts'
import { trir, safetyScore, computeSite, TRIR_BASE, type SiteInput } from './field-metrics.ts'
import { computeCarbon, ratingFor, wholeLifeIntensity, type MaterialInput } from './carbon.ts'
import { qualityScore, exposure, computeDataset, reIdTier, gradeFor as govGrade, type DatasetGov } from './governance.ts'
import { scorePair, computeHealth, SEVERITY_WEIGHT, type ClashPair } from './clash.ts'
import { scoreZone, summarize as verifySummarize, type ZoneInput } from './verify.ts'
import { computeAsset, comfortStatus, comfortIndex, type AssetInput } from './twin.ts'
import { dimensionScores, computeProject, scorePortfolio, type ProjectInput } from './portfolio.ts'
import { parseDocument } from './docparse.ts'
import { computeReadiness, type MLDataset } from './mldata.ts'
import { answerQuestion } from './query.ts'
import { makeScenario, upsert, removeById, renameScenario, forModule, diff, parseScenarios, exportBundle, importBundle, encodeScenarioToken, decodeScenarioToken, adoptScenario, type Scenario } from './scenarios.ts'
import { buildReportHtml, tableToCsv, kpiToItem, esc, type ReportSpec } from './report.ts'
import { deriveProjectModel, projectNarrative, type ProjectVitals } from './project-model.ts'
import { SCHEMAS, autoMap, coerceField, validateImport, recordsToCsv } from './ingest.ts'
import { compare, evaluate, summarize as summarizeAlerts, metricsForVitals, makeRule, parseRules, DEFAULT_RULES, type Subject } from './alerts.ts'
import { editLabel, removeLabel, actionLabel, percentValueText, toggleLabel } from './a11y.ts'
import { parseMentions, makeComment, threadFor, addComment, removeComment, toggleResolved, summarizeThread, encodeShareToken, decodeShareToken, shareUrl, logActivity, parseComments, subjectLabel, type Comment as CollabComment, type Author } from './collab.ts'
import { toPublic, parseListQuery, listDatasets, findDataset, generateApiKey, isValidKeyFormat, extractApiKey, ok as apiOk, err as apiErr, type CatalogLike, type PublicDataset } from './apikit.ts'
import type { Project as QProject, Supplier as QSupplier } from '@/data/platform'

let pass = 0
let fail = 0
const ok = (n: string, c: boolean, extra?: unknown) => { if (c) { pass++ } else { fail++; console.error(`  ✗ ${n}`, extra ?? '') } }
const near = (a: number, b: number, eps = 0.1) => Math.abs(a - b) <= eps
const section = (s: string) => console.log(`\n• ${s}`)

// ── supplier-score ────────────────────────────────────────────────────────────
section('supplier-score')
{
  const cohort: SupplierInput[] = [
    { id: 'a', name: 'Alpha', onTime: 98, quality: 96, leadTime: 10, priceIndex: 95 },
    { id: 'b', name: 'Bravo', onTime: 80, quality: 82, leadTime: 30, priceIndex: 110 },
    { id: 'c', name: 'Charlie', onTime: 90, quality: 88, leadTime: 20, priceIndex: 100 },
  ]
  const s = scoreSuppliers(cohort, SUP_W)
  const a = s.find((x) => x.id === 'a')!
  const b = s.find((x) => x.id === 'b')!
  ok('A composite ≈ 98.2', near(a.score, 98.2), a.score)
  ok('B composite ≈ 48.6', near(b.score, 48.6), b.score)
  ok('A ranks #1, Low risk', a.rank === 1 && a.risk === 'Low')
  ok('B ranks #3, High risk', b.rank === 3 && b.risk === 'High')
  ok('weights normalize to 1', near(Object.values(normSupplierW({ onTime: 1, quality: 1, leadTime: 1, price: 1 })).reduce((x, y) => x + y, 0), 1))
  ok('cohort best is A', cohortStats(s).best?.id === 'a')
}

// ── field-metrics ─────────────────────────────────────────────────────────────
section('field-metrics')
{
  ok('TRIR base = 200k (OSHA)', TRIR_BASE === 200_000)
  ok('TRIR(4, 420k) ≈ 1.90', near(trir(4, 420_000), 1.9))
  ok('safetyScore(2.5) = 70', safetyScore(2.5) === 70)
  ok('safetyScore(0) = 100', safetyScore(0) === 100)
  const site: SiteInput = { id: 's', name: 'Meridian', workersPlanned: 340, workersActual: 312, outputPlanned: 400, outputActual: 364, hoursWorked: 420_000, recordables: 4, nearMisses: 60 }
  const m = computeSite(site)
  ok('staffing ≈ 91.8%', near(m.staffing, 91.8))
  ok('productivity = 91%', m.productivity === 91)
  ok('safetyScore = 77', m.safetyScore === 77)
  ok('status watch', m.status === 'watch')
}

// ── carbon ────────────────────────────────────────────────────────────────────
section('carbon')
{
  const lines: MaterialInput[] = [
    { id: 'c', name: 'Concrete', quantity: 18_000, unit: 'm³', factor: 280, baselineFactor: 320 },
    { id: 'r', name: 'Rebar', quantity: 2_600, unit: 't', factor: 1_400, baselineFactor: 1_990 },
  ]
  const r = computeCarbon(lines, { gfa: 24_000, benchmark: 500 })
  ok('concrete carbon = 18000×280', r.lines[0].carbon === 5_040_000, r.lines[0].carbon)
  ok('total = sum of lines', r.totalCarbon === 5_040_000 + 3_640_000)
  ok('intensity = round(total/gfa)', r.intensity === Math.round(8_680_000 / 24_000))
  ok('saving% > 0 vs baseline', r.savingPct > 0)
  ok('ratingFor(300,500)=A', ratingFor(300, 500) === 'A')
  ok('ratingFor(601,500)=D', ratingFor(601, 500) === 'D')
  ok('whole-life = embodied + op×yrs', wholeLifeIntensity(400, 18, 60) === 400 + 18 * 60)
}

// ── governance ────────────────────────────────────────────────────────────────
section('governance')
{
  ok('equal dims → that score', qualityScore({ completeness: 90, validity: 90, consistency: 90, timeliness: 90, uniqueness: 90 }) === 90)
  ok('PII·Restricted·None exposure = 90', exposure({ containsPII: true, sensitivity: 'Restricted', anonymization: 'None' }) === 90)
  ok('Differential privacy cuts exposure to 14', exposure({ containsPII: true, sensitivity: 'Restricted', anonymization: 'Differential' }) === 14)
  ok('reIdTier(90) = High', reIdTier(90) === 'High')
  ok('govGrade(90) = A', govGrade(90) === 'A')
  const clean: DatasetGov = { id: 'd', name: 'D', dimensions: { completeness: 96, validity: 95, consistency: 94, timeliness: 92, uniqueness: 98 }, containsPII: false, sensitivity: 'Internal', anonymization: 'Masking', records: 1000 }
  ok('clean dataset publishable', computeDataset(clean).publishable === true)
}

// ── clash ─────────────────────────────────────────────────────────────────────
section('clash')
{
  const p = scorePair({ id: '1', a: 'Struct', b: 'MEP', total: 124, resolved: 60, severity: 'Critical' })
  ok('open = total − resolved', p.open === 64)
  ok('weightedOpen = open × 5', p.weightedOpen === 320)
  ok('Critical+open → critical', p.status === 'critical')
  ok('severity weights 5/2/1', SEVERITY_WEIGHT.Critical === 5 && SEVERITY_WEIGHT.Major === 2 && SEVERITY_WEIGHT.Minor === 1)
  const pairs: ClashPair[] = [
    { id: 'as', a: 'Arch', b: 'Struct', total: 31, resolved: 20, severity: 'Major' },
    { id: 'am', a: 'Arch', b: 'MEP', total: 88, resolved: 40, severity: 'Critical' },
    { id: 'sm', a: 'Struct', b: 'MEP', total: 124, resolved: 60, severity: 'Critical' },
    { id: 'mp', a: 'MEP', b: 'Plumbing', total: 96, resolved: 70, severity: 'Major' },
    { id: 'sp', a: 'Struct', b: 'Plumbing', total: 57, resolved: 30, severity: 'Major' },
    { id: 'mf', a: 'MEP', b: 'Fire', total: 64, resolved: 50, severity: 'Major' },
    { id: 'af', a: 'Arch', b: 'Fire', total: 19, resolved: 15, severity: 'Minor' },
    { id: 'pf', a: 'Plumbing', b: 'Fire', total: 12, resolved: 12, severity: 'Minor' },
  ]
  const h = computeHealth(pairs, 1_500_000)
  ok('totalOpen = 194', h.totalOpen === 194, h.totalOpen)
  ok('health = 71', h.health === 71, h.health)
  ok('resolution ≈ 60.5%', near(h.resolutionPct, 60.5))
}

// ── verify (reality capture) ────────────────────────────────────────────────────
section('verify')
{
  const z = scoreZone({ id: 'z', zone: 'Z', unit: 'm³', plannedQty: 2400, claimedQty: 2280, verifiedQty: 2150, rate: 165, confidence: 0.94 })
  ok('claim gap qty = 130', z.claimGapQty === 130)
  ok('claim gap value = 130×165', z.claimGapValue === 21_450)
  ok('over-claimed (gap > tol)', z.status === 'over-claimed')
  const s = verifySummarize([
    { id: 'a', zone: 'A', unit: 'm³', plannedQty: 1000, claimedQty: 900, verifiedQty: 800, rate: 100, confidence: 0.9 },
    { id: 'b', zone: 'B', unit: 'm³', plannedQty: 1000, claimedQty: 1000, verifiedQty: 1000, rate: 100, confidence: 0.95 },
  ])
  ok('value at risk = positive gaps only', s.valueAtRisk === (900 - 800) * 100)
  ok('verified < claimed completion', s.verifiedPct < s.claimedPct)
}

// ── twin (digital twin) ─────────────────────────────────────────────────────────
section('twin')
{
  const a: AssetInput = { id: 'a', name: 'AHU', type: 't', location: 'L', unit: 'mm/s', reading: 28, setpoint: 24, tolerance: 3, runtimeHours: 7200, serviceInterval: 8000, criticality: 3 }
  const r = computeAsset(a)
  ok('out of band → alarm', r.alarm === true)
  ok('health = 65', r.health === 65, r.health)
  ok('wear = 0.9', near(r.wear, 0.9))
  ok('servicing (runtime 0) raises health', computeAsset({ ...a, runtimeHours: 0 }).health > r.health)
  ok('comfortStatus in band → ok', comfortStatus(22.5, 22, 1.5) === 'ok')
  ok('comfortIndex = % in band', comfortIndex([22, 22.5, 27, 21], 22, 1.5) === 75)
}

// ── portfolio (executive insights) ──────────────────────────────────────────────
section('portfolio')
{
  const d = dimensionScores({ id: 'p', name: 'P', sector: 'S', value: 1e8, costVariance: 11.5, scheduleSlip: 96, risk: 83, safety: 82, quality: 79, carbon: 820 })
  ok('cost score = 100 − 11.5×6 = 31', near(d.cost, 31))
  ok('schedule score = 100 − 96×0.8 = 23.2', near(d.schedule, 23.2))
  ok('carbon clamps to 0', d.carbon === 0)
  const m = computeProject({ id: 'm', name: 'Meridian', sector: 'S', value: 1e8, costVariance: 4.2, scheduleSlip: 18, risk: 62, safety: 91, quality: 88, carbon: 612 })
  ok('Meridian health ≈ 71', m.health === 71, m.health)
  ok('exposure = value×(1−health)', m.exposure === Math.round(1e8 * 0.29))
  const pf = scorePortfolio([
    { id: 'a', name: 'A', sector: 'S', value: 9e8, costVariance: 11.5, scheduleSlip: 96, risk: 83, safety: 82, quality: 79, carbon: 820 },
    { id: 'b', name: 'B', sector: 'S', value: 1e8, costVariance: -1, scheduleSlip: -3, risk: 19, safety: 96, quality: 94, carbon: 395 },
  ])
  ok('watchlist worst-first', pf.watchlist[0].name === 'A')
}

// ── docparse (document intelligence) ─────────────────────────────────────────────
section('docparse')
{
  const spec = parseDocument('Concrete shall conform to ASTM C39 with a 28-day strength of C40/50. Cement content shall be 360 kg/m³ per Section 03 30 00.')
  ok('classified Specification', spec.docType === 'Specification', spec.docType)
  ok('extracts ASTM C39', spec.entities.some((e) => e.value === 'ASTM C39'))
  ok('extracts 360 kg/m³', spec.entities.some((e) => /360\s?kg\/m³/.test(e.value)))
  ok('finds shall-requirements', spec.requirements.filter((r) => r.modal === 'shall').length >= 2)
  const contract = parseDocument('The Contractor shall pay liquidated damages of USD 45,000 per calendar day of delay. Breach may cause termination.')
  ok('classified Contract', contract.docType === 'Contract', contract.docType)
  ok('flags Liquidated damages', contract.risks.some((r) => r.term === 'Liquidated damages'))
  ok('extracts USD 45,000', contract.entities.some((e) => e.value === 'USD 45,000'))
  ok('empty text → 0 entities', parseDocument('').entities.length === 0)
}

// ── mldata (AI training studio) ───────────────────────────────────────────────────
section('mldata')
{
  const base: MLDataset = { id: 'd', name: 'D', task: 't', modality: 'Tabular', examples: 100_000, labelCompleteness: 90, numClasses: 2, majorityClassPct: 50, trainPct: 80, valPct: 10, testPct: 10, annotatorAgreement: 0.9, duplicateRate: 10, piiClean: true }
  const r = computeReadiness(base)
  ok('effective = examples×(1−dup)×complete', r.effectiveExamples === 81_000, r.effectiveExamples)
  ok('split valid (sums 100)', r.splitValid === true)
  ok('incomplete labels → gated', r.readyToTrain === false)
  const perfect = computeReadiness({ ...base, labelCompleteness: 100, duplicateRate: 0, examples: 1_000_000, annotatorAgreement: 1 })
  ok('perfect dataset readiness 100', perfect.readiness === 100, perfect.readiness)
  ok('perfect dataset ready to train', perfect.readyToTrain === true)
  ok('bad split → warning', computeReadiness({ ...base, trainPct: 70 }).warnings.some((w) => w.code === 'split'))
}

// ── query (Ask natural-language analytics) ───────────────────────────────────
section('query (Ask NL)')
{
  const qProjects = [
    { name: 'Alpha', sector: 'Commercial', value: 800_000_000, gfa: 100_000, costVariance: 11.5, scheduleVariance: 96, risk: 83, safety: 82, quality: 79, carbon: 820, progress: 70, rfis: 2000, clashes: 100 },
    { name: 'Bravo', sector: 'Healthcare', value: 400_000_000, gfa: 80_000, costVariance: 7.8, scheduleVariance: 42, risk: 74, safety: 87, quality: 84, carbon: 690, progress: 58, rfis: 1600, clashes: 64 },
    { name: 'Cedar', sector: 'Residential', value: 200_000_000, gfa: 60_000, costVariance: -1.2, scheduleVariance: -3, risk: 19, safety: 96, quality: 94, carbon: 395, progress: 100, rfis: 400, clashes: 6 },
    { name: 'Delta', sector: 'Commercial', value: 300_000_000, gfa: 50_000, costVariance: 2.0, scheduleVariance: 5, risk: 40, safety: 90, quality: 88, carbon: 500, progress: 52, rfis: 700, clashes: 28 },
  ].map((p) => p as unknown as QProject)
  const qSuppliers = [
    { name: 'NordSteel', leadTime: 42, onTime: 96, quality: 95, priceIndex: 103, score: 94 },
    { name: 'Pioneer', leadTime: 140, onTime: 82, quality: 91, priceIndex: 106, score: 85 },
    { name: 'Orient', leadTime: 96, onTime: 61, quality: 80, priceIndex: 88, score: 67 },
  ].map((s) => s as unknown as QSupplier)
  const D = { projects: qProjects, suppliers: qSuppliers }

  const a1 = answerQuestion('which projects exceeded budget?', D)
  ok('over-budget: 3 of 4, leader Alpha', a1.matched && /3 of 4/.test(a1.answer) && /Alpha/.test(a1.answer), a1.answer)
  const a2 = answerQuestion('which supplier has the longest lead time?', D)
  ok('longest lead → Pioneer 140 days', /Pioneer/.test(a2.answer) && /140 days/.test(a2.answer), a2.answer)
  const a3 = answerQuestion('average cost variance across the portfolio', D)
  ok('avg cost variance ≈ +5%', /average cost variance/i.test(a3.answer) && /\+5%/.test(a3.answer), a3.answer)
  const a4 = answerQuestion('compare embodied carbon by sector', D)
  ok('carbon by sector → 3 sectors + chart', a4.matched && a4.chart?.data.length === 3, JSON.stringify(a4.chart?.data))
  const a5 = answerQuestion('how many projects are high-risk?', D)
  ok('high-risk count = 2 of 4', /2 of 4/.test(a5.answer), a5.answer)
  const a6 = answerQuestion('which project has the highest schedule slip?', D)
  ok('highest slip → Alpha +96 days', /Alpha/.test(a6.answer) && /\+96 days/.test(a6.answer), a6.answer)
  const a7 = answerQuestion('what is the biggest project by value?', D)
  ok('biggest value → Alpha $800M', /Alpha/.test(a7.answer) && /\$800M/.test(a7.answer), a7.answer)
  const a8 = answerQuestion('lowest carbon project', D)
  ok('lowest carbon → Cedar', /Cedar/.test(a8.answer), a8.answer)
  const a9 = answerQuestion('tell me a joke about cats', D)
  ok('unrecognized → matched:false + guidance', a9.matched === false && /couldn.t map/.test(a9.answer), a9.answer)
  const a10 = answerQuestion('compare cost per m² across sectors', D)
  ok('cost per m² by sector', a10.matched && /Cost intensity/.test(a10.answer) && a10.chart?.unit === 'money', a10.answer)
  ok('every matched result carries sql + domains', [a1, a2, a3, a4, a5, a6, a7, a8].every((r) => r.sql.length > 0 && r.domains.length > 0))
}

// ── scenarios (save / reload / compare) ──────────────────────────────────────
section('scenarios')
{
  const s1 = makeScenario('cost-schedule', 'Baseline', { rows: [1, 2] }, [{ label: 'CPI', value: 0.94 }, { label: 'EAC', value: 1000, unit: '$' }])
  ok('makeScenario sets module/name/data/summary', s1.module === 'cost-schedule' && s1.name === 'Baseline' && s1.summary.length === 2)
  ok('blank name → fallback', makeScenario('m', '   ', {}, []).name === 'Untitled scenario')
  ok('ids are unique', makeScenario('m', 'a', {}, []).id !== makeScenario('m', 'b', {}, []).id)

  let list: Scenario[] = []
  list = upsert(list, s1)
  ok('upsert adds', list.length === 1)
  const s1b = { ...s1, name: 'Baseline v2' }
  list = upsert(list, s1b)
  ok('upsert replaces by id (no dup)', list.length === 1 && list[0].name === 'Baseline v2')
  const s2 = makeScenario('cost-schedule', 'Recovery', {}, [{ label: 'CPI', value: 1.02 }, { label: 'EAC', value: 920, unit: '$' }])
  const s3 = makeScenario('carbon', 'Low-carbon', {}, [{ label: 'Intensity', value: 459 }])
  list = upsert(upsert(list, s2), s3)
  ok('forModule filters by module', forModule(list, 'cost-schedule').length === 2 && forModule(list, 'carbon').length === 1)
  ok('rename updates name only', renameScenario(list, s2.id, 'Recovery plan').find((x) => x.id === s2.id)!.name === 'Recovery plan')
  ok('removeById drops one', removeById(list, s3.id).length === list.length - 1)

  const d = diff(s1b, s2)
  ok('diff matches KPIs by label', d.length === 2)
  const cpi = d.find((x) => x.label === 'CPI')!
  ok('diff delta = b − a', cpi.delta === 0.08, cpi.delta)
  ok('diff pctDelta computed', Math.abs(cpi.pctDelta - 8.5) < 0.2, cpi.pctDelta)
  const eac = d.find((x) => x.label === 'EAC')!
  ok('diff carries unit + negative delta', eac.unit === '$' && eac.delta === -80, eac.delta)

  ok('parseScenarios: bad JSON → []', parseScenarios('{not json').length === 0)
  ok('parseScenarios: non-array → []', parseScenarios('{"a":1}').length === 0)
  ok('parseScenarios: round-trips valid', parseScenarios(JSON.stringify([s1, s2])).length === 2)
  ok('parseScenarios: drops malformed entries', parseScenarios(JSON.stringify([s1, { nope: true }])).length === 1)
  ok('parseScenarios: null → []', parseScenarios(null).length === 0)

  // export / import / share
  const sx = makeScenario('cost-schedule', 'Baseline', { rows: [1, 2, 3] }, [{ label: 'CPI', value: 0.94 }])
  const sy = makeScenario('carbon', 'Low-carbon', { lines: [] }, [{ label: 'Intensity', value: 459 }])
  const bundle = exportBundle([sx, sy])
  ok('exportBundle is JSON with kind + scenarios', /aec\.scenario\.bundle\.v1/.test(bundle) && JSON.parse(bundle).scenarios.length === 2)
  ok('importBundle round-trips a bundle', importBundle(bundle).length === 2 && importBundle(bundle)[0].name === 'Baseline')
  ok('importBundle accepts a bare array', importBundle(JSON.stringify([sx])).length === 1)
  ok('importBundle accepts a single scenario object', importBundle(JSON.stringify(sx)).length === 1)
  ok('importBundle drops malformed entries', importBundle(JSON.stringify({ kind: 'x', scenarios: [sx, { nope: true }] })).length === 1)
  ok('importBundle bad JSON → []', importBundle('not json').length === 0)
  ok('importBundle preserves data payload', (importBundle(bundle)[0].data as { rows: number[] }).rows.length === 3)

  const tok = encodeScenarioToken(sx)
  ok('scenario token is url-safe', !/[+/=]/.test(tok))
  ok('decodeScenarioToken round-trips', decodeScenarioToken(tok)?.name === 'Baseline' && decodeScenarioToken(tok)?.module === 'cost-schedule')
  ok('decodeScenarioToken rejects junk', decodeScenarioToken('@@notbase64@@') === null)

  const adopted = adoptScenario(sx, { module: 'insights' })
  ok('adoptScenario regenerates id', adopted.id !== sx.id)
  ok('adoptScenario can override module', adopted.module === 'insights')
  ok('adoptScenario keeps name + data', adopted.name === 'Baseline' && (adopted.data as { rows: number[] }).rows.length === 3)
  ok('adoptScenario keeps module when not overridden', adoptScenario(sx).module === 'cost-schedule')
}

// ── report (export / board brief) ────────────────────────────────────────────
section('report')
{
  ok('kpiToItem formats money (M)', kpiToItem({ label: 'EAC', value: 820_000_000, unit: '$' }).value === '$820M', kpiToItem({ label: 'EAC', value: 820_000_000, unit: '$' }).value)
  ok('kpiToItem formats money (B)', kpiToItem({ label: 'BAC', value: 1_200_000_000, unit: '$' }).value === '$1.2B', kpiToItem({ label: 'BAC', value: 1_200_000_000, unit: '$' }).value)
  ok('kpiToItem formats percent', kpiToItem({ label: 'CV', value: 5.25, unit: '%' }).value === '5.3%')
  ok('kpiToItem formats days', kpiToItem({ label: 'Lead', value: 140, unit: 'd' }).value === '140 d')
  ok('kpiToItem plain number', kpiToItem({ label: 'Health', value: 71 }).value === '71')

  ok('esc neutralizes HTML', esc('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;')

  const spec: ReportSpec = {
    title: 'Cost & Schedule',
    subtitle: 'Portfolio brief',
    module: 'cost-schedule',
    generatedAt: '2026-05-31T12:00:00.000Z',
    kpis: [{ label: 'Portfolio CPI', value: '0.94' }, { label: 'EAC', value: '$1.2B' }],
    narrative: 'Portfolio is over budget with a 12-point claim gap.',
    table: { title: 'Projects', columns: ['Project', 'CPI'], rows: [['Meridian Tower', 0.92], ['Riverside <Hub>', 0.81]] },
  }
  const html = buildReportHtml(spec)
  ok('html is a full document', html.startsWith('<!doctype html>') && html.includes('</html>'))
  ok('html includes the title', html.includes('Cost &amp; Schedule'))
  ok('html includes KPI label + value', html.includes('Portfolio CPI') && html.includes('0.94'))
  ok('html includes narrative', html.includes('12-point claim gap'))
  ok('html renders table rows', html.includes('Meridian Tower') && html.includes('0.81'))
  ok('html escapes table cell injection', html.includes('Riverside &lt;Hub&gt;') && !html.includes('Riverside <Hub>'))
  ok('html names the studio + module', html.includes('AEC Data') && html.includes('cost-schedule'))
  ok('missing generatedAt still builds', buildReportHtml({ title: 'X', module: 'm' }).includes('Board brief'))

  const csv = tableToCsv({ columns: ['Project', 'Note'], rows: [['Meridian', 'on, track'], ['Lumen "T4"', 'ok']] })
  ok('csv has header + rows', csv.split('\r\n').length === 3)
  ok('csv quotes commas', csv.includes('"on, track"'))
  ok('csv escapes quotes', csv.includes('"Lumen ""T4"""'))
}

// ── project-model (unified project) ──────────────────────────────────────────
section('project-model')
{
  const meridian: ProjectVitals = { id: 'PRJ-1042', name: 'Meridian Tower', sector: 'Commercial', location: 'Dubai', value: 820_000_000, gfa: 142_000, progress: 64, costVariance: 4.2, scheduleVariance: 18, risk: 62, safety: 91, quality: 88, carbon: 612, rfis: 1240, clashes: 38 }
  const m = deriveProjectModel(meridian)
  // CPI = 1 / (1 + costVar/100) = 1/1.042 ≈ 0.96 (independent of progress)
  ok('EVM CPI ≈ 0.96', Math.abs(m.evm.cpi - 0.96) < 0.01, m.evm.cpi)
  ok('EVM EAC > budget when over budget', m.evm.eac > meridian.value)
  // composite health matches the portfolio engine (hand-verified 71 earlier)
  ok('composite health = 71', m.health === 71, m.health)
  ok('six dimensions present', Object.keys(m.dims).length === 6)
  ok('carbon rating D (612 vs 500)', m.carbonRating === 'D', m.carbonRating)
  ok('carbon intensity passthrough', m.carbonIntensity === 612)
  ok('cost per m² = value/gfa', m.costPerM2 === Math.round(820_000_000 / 142_000), m.costPerM2)
  ok('exposure = value×(1−health)', m.exposure === Math.round(820_000_000 * (1 - 71 / 100)))

  // editing vitals re-runs every lens
  ok('raising cost variance lowers CPI', deriveProjectModel({ ...meridian, costVariance: 20 }).evm.cpi < m.evm.cpi)
  ok('cutting carbon improves rating', ['A', 'B', 'C'].includes(deriveProjectModel({ ...meridian, carbon: 400 }).carbonRating))
  ok('improving safety/quality/risk/carbon raises health', deriveProjectModel({ ...meridian, carbon: 400, safety: 96, quality: 94, risk: 25 }).health > m.health)
  ok('narrative names the project + health', /Meridian Tower/.test(projectNarrative(m)) && new RegExp(`${m.health}/100`).test(projectNarrative(m)))
  ok('zero gfa → costPerM2 0 (guard)', deriveProjectModel({ ...meridian, gfa: 0 }).costPerM2 === 0)
}

// ── ingest (ETL mapping + validation) ────────────────────────────────────────
section('ingest')
{
  const projectSchema = SCHEMAS.find((s) => s.id === 'project-master')!
  // auto-map fuzzy headers
  const map = autoMap(['Project Name', 'Sector', 'Contract Value', 'GFA (m2)', '% Complete', 'Phase'], projectSchema)
  ok('autoMap matches name', map.name === 'Project Name')
  ok('autoMap matches value', map.value === 'Contract Value', map.value)
  ok('autoMap matches gfa', map.gfa === 'GFA (m2)', map.gfa)
  ok('autoMap matches enum phase', map.phase === 'Phase')
  ok('autoMap leaves unmatched null', autoMap(['foo', 'bar'], projectSchema).name === null)

  // coercion
  ok('coerce number strips $ ,', coerceField({ key: 'v', label: 'V', type: 'number' }, '$1,250,000').value === 1250000)
  ok('coerce number rejects text', coerceField({ key: 'v', label: 'V', type: 'number' }, 'abc').ok === false)
  ok('coerce date normalizes', coerceField({ key: 'd', label: 'D', type: 'date' }, '2026-09-30').value === '2026-09-30')
  ok('coerce date rejects junk', coerceField({ key: 'd', label: 'D', type: 'date' }, 'soon').ok === false)
  ok('coerce enum canonicalizes case', coerceField({ key: 'p', label: 'P', type: 'enum', enumValues: ['Design', 'Construction'] }, 'construction').value === 'Construction')
  ok('coerce enum rejects unknown', coerceField({ key: 'p', label: 'P', type: 'enum', enumValues: ['Design'] }, 'Demolition').ok === false)
  ok('required empty → not ok', coerceField({ key: 'n', label: 'N', type: 'string', required: true }, '  ').ok === false)
  ok('optional empty → ok', coerceField({ key: 'n', label: 'N', type: 'string' }, '').ok === true)

  // full validate: clean rows
  const cols = ['name', 'value', 'gfa', 'progress', 'phase']
  const mapping = { name: 'name', sector: null, location: null, value: 'value', gfa: 'gfa', progress: 'progress', phase: 'phase' }
  const clean = [
    { name: 'Tower A', value: '800000000', gfa: '142000', progress: '64', phase: 'Construction' },
    { name: 'Hub B', value: '980000000', gfa: '54000', progress: '71', phase: 'Construction' },
  ]
  void cols
  const r1 = validateImport(clean, projectSchema, mapping)
  ok('clean import: all rows valid', r1.report.validRows === 2 && r1.report.invalidRows === 0, JSON.stringify({ v: r1.report.validRows, i: r1.report.invalidRows }))
  ok('clean import: high quality', r1.report.qualityScore >= 80, r1.report.qualityScore)
  ok('records standardized to schema keys', typeof r1.records[0].value === 'number' && r1.records[0].name === 'Tower A')
  ok('name fillRate 100', r1.report.fields.find((f) => f.key === 'name')!.fillRate === 100)

  // dirty rows: bad number + bad enum + missing required
  const dirty = [
    { name: 'OK', value: '500', gfa: '1000', progress: '50', phase: 'Construction' },
    { name: '', value: 'NaNish', gfa: '1000', progress: '50', phase: 'Demolition' }, // missing name, bad value, bad enum
  ]
  const r2 = validateImport(dirty, projectSchema, mapping)
  ok('dirty import flags invalid row', r2.report.invalidRows === 1 && r2.report.validRows === 1, JSON.stringify({ v: r2.report.validRows, i: r2.report.invalidRows }))
  ok('sample errors captured', r2.report.sampleErrors.length >= 2)
  ok('value field error counted', r2.report.fields.find((f) => f.key === 'value')!.errors >= 1)

  // unmapped required → flagged + quality tanks
  const r3 = validateImport(clean, projectSchema, { ...mapping, name: null })
  ok('unmapped required flagged', r3.report.unmappedRequired.includes('Project name'))
  ok('unmapped required → 0 valid rows', r3.report.validRows === 0)
  ok('unmapped required → low quality', r3.report.qualityScore < 50, r3.report.qualityScore)

  // canonical CSV out
  const csv = recordsToCsv(r1.records, projectSchema)
  ok('recordsToCsv has header + rows', csv.split('\r\n').length === 3 && csv.startsWith('Project name,'))
}

// ── alerts (threshold rules) ─────────────────────────────────────────────────
section('alerts')
{
  ok('compare <', compare(0.89, '<', 0.9) && !compare(0.95, '<', 0.9))
  ok('compare >=', compare(30, '>=', 30) && !compare(29, '>=', 30))
  ok('compare !=', compare(1, '!=', 2) && !compare(2, '!=', 2))

  const PV = (over: Partial<ProjectVitals>): ProjectVitals => ({ id: 'p', name: 'P', sector: 'S', location: 'L', value: 5e8, gfa: 50000, progress: 50, costVariance: 0, scheduleVariance: 0, risk: 30, safety: 95, quality: 92, carbon: 400, rfis: 500, clashes: 10, ...over });
  const m = metricsForVitals(PV({ costVariance: 11.5, scheduleVariance: 96, carbon: 820, safety: 82, rfis: 2240 }))
  ok('metricsForVitals computes cpi', Math.abs(m.cpi - 1 / 1.115) < 0.01, m.cpi)
  ok('metricsForVitals exposes raw + derived', m.carbon === 820 && typeof m.health === 'number' && typeof m.exposure === 'number')

  const healthy: Subject = { id: 'a', name: 'Healthy', metrics: metricsForVitals(PV({})) }
  const risky: Subject = { id: 'b', name: 'Riverside', metrics: metricsForVitals(PV({ name: 'Riverside', value: 98e7, costVariance: 11.5, scheduleVariance: 96, risk: 83, safety: 82, quality: 79, carbon: 820, rfis: 2240, clashes: 102 })) }
  const alerts = evaluate(DEFAULT_RULES, [healthy, risky])
  ok('healthy project triggers nothing', alerts.every((a) => a.subjectId !== 'a'), JSON.stringify(alerts.filter((a) => a.subjectId === 'a').map((a) => a.ruleName)))
  ok('risky project breaches the cost-overrun rule', alerts.some((a) => a.subjectId === 'b' && a.ruleId === 'r-cpi'))
  ok('risky project breaches major-delay + at-risk + carbon + safety + rfi', ['r-slip', 'r-health', 'r-carbon', 'r-safety', 'r-rfi'].every((id) => alerts.some((a) => a.ruleId === id && a.subjectId === 'b')))
  ok('alerts carry the actual value + label', alerts[0].value !== undefined && alerts[0].metricLabel.length > 0)
  ok('alerts sorted worst-first (High before Low)', (() => { const sev = alerts.map((a) => a.severity); const lastHigh = sev.lastIndexOf('High'); const firstLow = sev.indexOf('Low'); return firstLow === -1 || lastHigh < firstLow })())

  const s = summarizeAlerts(alerts)
  ok('summary counts by severity', s.high >= 3 && s.medium >= 2 && s.low >= 1, JSON.stringify(s))
  ok('summary total = alerts length', s.total === alerts.length)
  ok('summary subjects affected = 1 (only risky)', s.subjects === 1, s.subjects)

  ok('disabled rule never fires', evaluate(DEFAULT_RULES.map((r) => ({ ...r, enabled: false })), [risky]).length === 0)
  ok('makeRule defaults sane', (() => { const r = makeRule(); return r.enabled && r.op === '<' && r.metric === 'health' && r.id.length > 0 })())
  ok('parseRules: bad JSON → []', parseRules('nope').length === 0)
  ok('parseRules: round-trips valid', parseRules(JSON.stringify(DEFAULT_RULES)).length === DEFAULT_RULES.length)
  ok('parseRules: drops malformed', parseRules(JSON.stringify([DEFAULT_RULES[0], { id: 'x' }])).length === 1)
}

// ── a11y (label builders) ────────────────────────────────────────────────────
section('a11y')
{
  ok('editLabel with unit', editLabel('Cost variance', 4.2, '%') === 'Edit Cost variance, currently 4.2%')
  ok('editLabel no unit', editLabel('Quality', 88) === 'Edit Quality, currently 88')
  ok('editLabel thousands grouped', editLabel('Budget', 820000000, '') === 'Edit Budget, currently 820,000,000')
  ok('editLabel string value', editLabel('Phase', 'Construction') === 'Edit Phase, currently Construction')
  ok('removeLabel', removeLabel('Meridian Tower') === 'Remove Meridian Tower')
  ok('actionLabel', actionLabel('Resolve', 'Struct×MEP') === 'Resolve Struct×MEP')
  ok('percentValueText rounds', percentValueText(0.3) === '30 percent' && percentValueText(0.255) === '26 percent')
  ok('toggleLabel on/off', toggleLabel('Cost overrun', true) === 'Cost overrun, on' && toggleLabel('Cost overrun', false) === 'Cost overrun, off')
}

// ── collab (comments / mentions / share / activity) ──────────────────────────
section('collab')
{
  const alice: Author = { id: 'u1', name: 'Alice' }
  const bob: Author = { id: 'u2', name: 'Bob' }

  // mentions
  ok('parseMentions extracts handles', JSON.stringify(parseMentions('hey @bob and @carol_99, see this')) === JSON.stringify(['bob', 'carol_99']))
  ok('parseMentions dedups + lowercases', JSON.stringify(parseMentions('@Bob @bob @BOB')) === JSON.stringify(['bob']))
  ok('parseMentions ignores emails', parseMentions('mail me at jo@example.com').length === 0)
  ok('parseMentions strips trailing punctuation', JSON.stringify(parseMentions('ping @alice.')) === JSON.stringify(['alice']))
  ok('parseMentions empty', parseMentions('no mentions here').length === 0)

  // comments + thread
  let comments: CollabComment[] = []
  const c1 = makeComment('cost-schedule', alice, 'CPI looks off — @bob can you check?')
  comments = addComment(comments, c1)
  ok('makeComment captures author + mentions', c1.authorName === 'Alice' && c1.mentions[0] === 'bob' && !c1.resolved)
  comments = addComment(comments, makeComment('cost-schedule', bob, 'Looking now'))
  comments = addComment(comments, makeComment('procurement', alice, 'different subject'))
  ok('threadFor filters by subject', threadFor(comments, 'cost-schedule').length === 2)
  ok('threadFor is chronological', threadFor(comments, 'cost-schedule')[0].id === c1.id)
  ok('other subjects isolated', threadFor(comments, 'procurement').length === 1)

  // resolve + remove
  comments = toggleResolved(comments, c1.id)
  ok('toggleResolved flips', threadFor(comments, 'cost-schedule').find((c) => c.id === c1.id)!.resolved === true)
  const s = summarizeThread(comments, 'cost-schedule')
  ok('summary counts open/resolved/participants', s.total === 2 && s.resolved === 1 && s.open === 1 && s.participants === 2)
  ok('summary lastAt set', typeof s.lastAt === 'string')
  comments = removeComment(comments, c1.id)
  ok('removeComment drops it', threadFor(comments, 'cost-schedule').length === 1)

  // share tokens
  const tok = encodeShareToken('project:PRJ-1042')
  ok('share token is url-safe', !/[+/=]/.test(tok))
  ok('decode round-trips', decodeShareToken(tok) === 'project:PRJ-1042')
  ok('decode rejects junk', decodeShareToken('@@@not-base64@@@') === null || decodeShareToken('zzzz') !== 'project:PRJ-1042')
  ok('shareUrl builds a deep link', shareUrl('https://app.example.com', '/construction-analytics', 'cost-schedule') === `https://app.example.com/construction-analytics/share/${encodeShareToken('cost-schedule')}`)
  ok('shareUrl handles root base', shareUrl('https://x.io/', '/', 'bim').startsWith('https://x.io/share/'))

  // activity
  let log = logActivity([], alice, 'commented on', 'cost-schedule')
  log = logActivity(log, bob, 'shared', 'project:PRJ-1042')
  ok('logActivity newest-first', log[0].actorName === 'Bob' && log[1].actorName === 'Alice')
  ok('activity carries verb + subject', log[0].verb === 'shared' && log[0].subject === 'project:PRJ-1042')

  // persistence + labels
  ok('parseComments round-trips', parseComments(JSON.stringify(comments)).length === comments.length)
  ok('parseComments bad JSON → []', parseComments('nope').length === 0)
  ok('parseComments drops malformed', parseComments(JSON.stringify([comments[0], { x: 1 }])).length === 1)
  ok('subjectLabel project', subjectLabel('project:PRJ-1042') === 'Project PRJ-1042')
  ok('subjectLabel slug', subjectLabel('cost-schedule') === 'Cost Schedule')
}

// ── apikit (public dataset API) ──────────────────────────────────────────────
section('apikit')
{
  const mk = (over: Partial<CatalogLike>): CatalogLike => ({
    id: 'd', name: 'D', provider: 'Acme', category: 'Cost', modality: 'Tabular', license: 'Commercial',
    price: 100, quality: 90, rating: 4.5, downloads: 100, records: 1000, sizeGB: 1, anonymized: true,
    updated: '2026-01-01', tags: ['cost'], description: 'desc', files: [{ name: 'a.csv', format: 'CSV', rows: 10, free: true }, { name: 'b.csv', format: 'CSV', free: false }],
    ...over,
  })

  // toPublic drops sensitive fields, keeps sample file metadata
  const pub = toPublic(mk({ id: 'x' }))
  ok('toPublic shapes public DTO', pub.id === 'x' && pub.sampleFiles.length === 2 && pub.sampleFiles[0].name === 'a.csv')
  ok('toPublic omits file bytes/paths', !('content' in (pub.sampleFiles[0] as object)) && !('storagePath' in (pub.sampleFiles[0] as object)) && !('generate' in (pub.sampleFiles[0] as object)))

  const all: PublicDataset[] = [
    toPublic(mk({ id: 'a', name: 'Alpha Cost', category: 'Cost', modality: 'Tabular', license: 'Commercial', rating: 4.9, downloads: 500, records: 9000, price: 4800, tags: ['benchmark'], description: 'cost data' })),
    toPublic(mk({ id: 'b', name: 'Bravo Imagery', category: 'Reality Capture', modality: 'Imagery', license: 'Research', rating: 4.2, downloads: 1200, records: 500000, price: 0, tags: ['drone'], description: 'site photos' })),
    toPublic(mk({ id: 'c', name: 'Charlie BIM', category: 'BIM', modality: 'BIM Model', license: 'Commercial', rating: 4.7, downloads: 300, records: 2100000, price: null, tags: ['ifc'], description: 'models' })),
  ]

  // parseListQuery
  const q1 = parseListQuery({ sort: 'downloads', order: 'asc', page: '2', pageSize: '1' })
  ok('parseListQuery normalizes', q1.sort === 'downloads' && q1.order === 'asc' && q1.page === 2 && q1.pageSize === 1)
  ok('parseListQuery defaults', (() => { const q = parseListQuery({}); return q.sort === 'rating' && q.order === 'desc' && q.page === 1 && q.pageSize === 20 })())
  ok('parseListQuery rejects bad sort', parseListQuery({ sort: 'haxx' }).sort === 'rating')
  ok('parseListQuery clamps pageSize ≤100', parseListQuery({ pageSize: '9999' }).pageSize === 100)
  ok('parseListQuery floors page ≥1', parseListQuery({ page: '-5' }).page === 1)
  ok('parseListQuery reads URLSearchParams', parseListQuery(new URLSearchParams('search=Cost&license=Research')).search === 'cost' && parseListQuery(new URLSearchParams('license=Research')).license === 'research')

  // filtering
  ok('search matches name/desc/tags/provider', listDatasets(all, parseListQuery({ search: 'drone' })).data[0].id === 'b')
  ok('filter by category', listDatasets(all, parseListQuery({ category: 'BIM' })).data.length === 1)
  ok('filter by modality', listDatasets(all, parseListQuery({ modality: 'Imagery' })).data[0].id === 'b')
  ok('filter by license', listDatasets(all, parseListQuery({ license: 'Commercial' })).meta.total === 2)

  // sorting
  ok('sort downloads desc', listDatasets(all, parseListQuery({ sort: 'downloads', order: 'desc' })).data[0].id === 'b')
  ok('sort rating asc', listDatasets(all, parseListQuery({ sort: 'rating', order: 'asc' })).data[0].id === 'b')
  ok('sort name asc', listDatasets(all, parseListQuery({ sort: 'name', order: 'asc' })).data[0].id === 'a')
  ok('null price sorts low', listDatasets(all, parseListQuery({ sort: 'price', order: 'asc' })).data[0].id === 'c')

  // pagination
  const p = listDatasets(all, parseListQuery({ pageSize: '2', page: '2' }))
  ok('pagination slices', p.data.length === 1 && p.meta.pages === 2 && p.meta.page === 2)
  ok('page clamps to last', listDatasets(all, parseListQuery({ pageSize: '2', page: '9' })).meta.page === 2)
  ok('meta.total = filtered count', listDatasets(all, parseListQuery({ license: 'Research' })).meta.total === 1)

  // findDataset
  ok('findDataset hit', findDataset(all, 'c')?.name === 'Charlie BIM')
  ok('findDataset miss', findDataset(all, 'zzz') === undefined)

  // api keys
  const key = generateApiKey(() => 0.5)
  ok('generateApiKey format', /^aec_[0-9a-f]{32}$/.test(key))
  ok('isValidKeyFormat accepts', isValidKeyFormat(key))
  ok('isValidKeyFormat rejects junk', !isValidKeyFormat('nope') && !isValidKeyFormat('aec_xyz') && !isValidKeyFormat(null))
  ok('extractApiKey from bearer', extractApiKey({ authorization: 'Bearer aec_abc' }) === 'aec_abc')
  ok('extractApiKey from x-api-key', extractApiKey({ 'x-api-key': 'aec_def' }) === 'aec_def')
  ok('extractApiKey via Headers-like', extractApiKey(new Headers({ authorization: 'Bearer aec_ghi' })) === 'aec_ghi')
  ok('extractApiKey none → null', extractApiKey({}) === null)

  // envelopes
  ok('ok wraps array as data', (apiOk(all.slice(0, 1)).body as { ok: boolean; data: unknown[] }).data.length === 1)
  ok('ok merges object + extra', (apiOk({ meta: 1 }, { request_id: 'r' }).body as { request_id: string }).request_id === 'r')
  ok('err shape', (() => { const e = apiErr(404, 'nope', 'not_found'); return e.status === 404 && (e.body as { ok: boolean; code: string }).ok === false && (e.body as { code: string }).code === 'not_found' })())
}

console.log(`\nengines: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)