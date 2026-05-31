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
import { makeScenario, upsert, removeById, renameScenario, forModule, diff, parseScenarios, type Scenario } from './scenarios.ts'
import { buildReportHtml, tableToCsv, kpiToItem, esc, type ReportSpec } from './report.ts'
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

console.log(`\nengines: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)