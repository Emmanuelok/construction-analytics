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
import { compare, evaluate, summarize as summarizeAlerts, metricsForVitals, makeRule, parseRules, DEFAULT_RULES, type Subject, type Alert } from './alerts.ts'
import { editLabel, removeLabel, actionLabel, percentValueText, toggleLabel } from './a11y.ts'
import { parseMentions, makeComment, threadFor, addComment, removeComment, toggleResolved, summarizeThread, encodeShareToken, decodeShareToken, shareUrl, logActivity, parseComments, subjectLabel, type Comment as CollabComment, type Author, type Activity } from './collab.ts'
import { toPublic, parseListQuery, listDatasets, findDataset, generateApiKey, isValidKeyFormat, extractApiKey, ok as apiOk, err as apiErr, type CatalogLike, type PublicDataset } from './apikit.ts'
import { mentionNotifications, shareNotifications, alertNotifications, buildFeed, unreadCount, isUnread, timeAgo, parseReadIds, subjectName, type Notification } from './notifications.ts'
import { buildMassing, deriveStoreys, floorColor, type FloorSpec } from './massing.ts'
import { unitShape, holeFor, scaleToArea, scaleAbout, rotatePolygon, shapeExtent, centerPolygon, SHAPE_KINDS } from './shapes.ts'
import { buildIfcScene, gridFor, kindOf, DISCIPLINE_COLOR, describeSelection, type SelectedElement } from './ifc-model.ts'
import { extractGeometry } from './ifc-geometry.ts'
import { SAMPLE_IFC_GEO } from './ifc-sample-geo.ts'
import { buildZoning, insetPolygon, polygonArea, polygonPerimeter, polygonCentroid, scalePolygon, parseGeoBoundary, rectSite } from './zoning.ts'
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

// ── notifications (unified inbox) ────────────────────────────────────────────
section('notifications')
{
  const alice: Author = { id: 'u1', name: 'Alice' }
  const bob: Author = { id: 'u2', name: 'Bob' }
  const comments: CollabComment[] = [
    makeComment('cost-schedule', alice, 'CPI off — @bob take a look'),
    makeComment('procurement', bob, 'no mention here'),
    makeComment('bim', alice, 'clashes spiking, @bob @carol'),
  ]
  // mentions for bob
  const mentions = mentionNotifications(comments, 'bob')
  ok('mentionNotifications finds @bob comments', mentions.length === 2 && mentions.every((m) => m.kind === 'mention'))
  ok('mention title names the author', mentions[0].title === 'Alice mentioned you')
  ok('mention carries subject for deep-link', mentions.some((m) => m.subject === 'cost-schedule'))
  ok('mention id is stable', mentions[0].id.startsWith('mention:'))
  ok('no mentions for unknown handle', mentionNotifications(comments, 'zoe').length === 0)

  // shares (from others only)
  const activity: Activity[] = [
    logActivity([], bob, 'shared', 'insights')[0],
    logActivity([], alice, 'shared', 'cost-schedule')[0],
    logActivity([], bob, 'commented on', 'bim')[0],
  ]
  const shares = shareNotifications(activity, 'u1') // self = alice
  ok('shareNotifications excludes self + non-shares', shares.length === 1 && shares[0].kind === 'share' && /Bob shared/.test(shares[0].title))

  // alerts
  const alerts: Alert[] = [
    { ruleId: 'r-cpi', ruleName: 'Cost overrun', severity: 'High', subjectId: 'PRJ-1290', subjectName: 'Riverside', metric: 'cpi', metricLabel: 'CPI', value: 0.81, op: '<', threshold: 0.9 },
    { ruleId: 'r-slip', ruleName: 'Major delay', severity: 'High', subjectId: 'PRJ-1290', subjectName: 'Riverside', metric: 'scheduleSlip', metricLabel: 'Schedule slip', value: 96, op: '>', threshold: 30 },
  ]
  const an = alertNotifications(alerts, '2026-06-01T00:00:00.000Z')
  ok('alertNotifications maps breaches', an.length === 2 && an[0].kind === 'alert' && an[0].severity === 'High')
  ok('alert subject deep-links to the project', an[0].subject === 'project:PRJ-1290')
  ok('alert id dedupes per rule×subject', an[0].id === 'alert:r-cpi:PRJ-1290')

  // feed merge + dedup + sort
  const feed = buildFeed([mentions, shares, an])
  ok('buildFeed merges all sources', feed.length === mentions.length + shares.length + an.length)
  ok('buildFeed dedups by id', buildFeed([an, an]).length === an.length)
  ok('buildFeed newest-first', feed.every((n, i) => i === 0 || feed[i - 1].at >= n.at))

  // unread tracking
  ok('unreadCount all unread', unreadCount(feed, []) === feed.length)
  const someRead = [feed[0].id, feed[1].id]
  ok('unreadCount subtracts read', unreadCount(feed, someRead) === feed.length - 2)
  ok('isUnread reflects read set', !isUnread(feed[0], someRead) && isUnread(feed[2], someRead))
  ok('parseReadIds round-trips', parseReadIds(JSON.stringify(['a', 'b'])).length === 2)
  ok('parseReadIds bad → []', parseReadIds('nope').length === 0 && parseReadIds(null).length === 0)

  // helpers
  ok('subjectName labels slug', subjectName('cost-schedule') === 'Cost & Schedule')
  ok('subjectName labels project', subjectName('project:PRJ-1042') === 'Project PRJ-1042')
  ok('timeAgo minutes', timeAgo(new Date(Date.now() - 5 * 60000).toISOString()) === '5m')
  ok('timeAgo hours', timeAgo(new Date(Date.now() - 3 * 3600000).toISOString()) === '3h')
  ok('timeAgo seconds', /\ds$/.test(timeAgo(new Date(Date.now() - 5000).toISOString())))
}

// ── massing (3D building geometry) ───────────────────────────────────────────
section('massing')
{
  ok('deriveStoreys scales with GFA', deriveStoreys(30000) === 12) // 30000/2500
  ok('deriveStoreys clamps low', deriveStoreys(500) === 3)
  ok('deriveStoreys clamps high', deriveStoreys(5_000_000) === 40)
  ok('deriveStoreys zero → 1', deriveStoreys(0) === 1)

  const m = buildMassing({ gfa: 142_000, progress: 64, storeys: 25 })
  ok('respects explicit storeys', m.storeys === 25 && m.floors.length === 25)
  ok('floors stack upward (increasing y)', m.floors.every((f, i) => i === 0 || f.y > m.floors[i - 1].y))
  ok('ground floor labelled G', m.floors[0].label === 'G' && m.floors[1].label === 'L1')
  ok('totalHeight = storeys × storeyHeight', m.totalHeight === 25 * m.storeyHeight)
  ok('built floors are bottom-up = round(progress×storeys)', m.builtCount === Math.round(0.64 * 25))
  ok('built flag matches builtCount', m.floors.filter((f) => f.built).length === m.builtCount)
  ok('lowest floors are the built ones', m.floors.slice(0, m.builtCount).every((f) => f.built) && m.floors.slice(m.builtCount).every((f) => !f.built))
  ok('footprint > 0 for real GFA', m.footprint > 0)
  ok('builtPct reflects whole floors', m.builtPct === Math.round((m.builtCount / 25) * 1000) / 10)

  // taper shrinks upper plates (by polygon area now)
  const tap = buildMassing({ gfa: 100_000, progress: 50, storeys: 10, taper: 0.5 })
  ok('taper shrinks top vs bottom plate', polygonArea(tap.floors[9].polygon) < polygonArea(tap.floors[0].polygon))
  ok('no taper → uniform plate', buildMassing({ gfa: 100_000, progress: 50, storeys: 10 }).floors.every((f, _i, arr) => Math.abs(polygonArea(f.polygon) - polygonArea(arr[0].polygon)) < 1e-6))

  // sophisticated forms: shape, podium/tower setback, twist
  ok('default shape is a rectangle (4-pt plate)', m.floors[0].polygon.length === 4)
  ok('shape selection changes the plate (cross = 12 pts, cylinder = 48)', buildMassing({ gfa: 80_000, progress: 0, storeys: 8, shape: 'cross' }).floors[0].polygon.length === 12 && buildMassing({ gfa: 80_000, progress: 0, storeys: 8, shape: 'cylinder' }).floors[0].polygon.length === 48)
  const pt = buildMassing({ gfa: 120_000, progress: 0, storeys: 12, podium: 0.5, towerSetback: 0.4 })
  ok('podium floors keep the base plate', Math.abs(polygonArea(pt.floors[0].polygon) - polygonArea(pt.floors[5].polygon)) < 1e-6)
  ok('tower steps in above the podium (smaller plate)', polygonArea(pt.floors[6].polygon) < polygonArea(pt.floors[5].polygon))
  const tw = buildMassing({ gfa: 90_000, progress: 0, storeys: 10, shape: 'rect', twist: 6 })
  ok('twist rotates upper floors (plate orientation differs, area preserved)', Math.abs(tw.floors[5].polygon[0].x - tw.floors[0].polygon[0].x) > 1e-3 && Math.abs(polygonArea(tw.floors[5].polygon) - polygonArea(tw.floors[0].polygon)) < 1e-6)
  // user-drawn custom footprint
  const customPts = [{ x: 0, z: 0 }, { x: 6, z: 0 }, { x: 6, z: 2 }, { x: 3, z: 4 }, { x: 0, z: 2 }] // off-origin 5-gon
  const cm = buildMassing({ gfa: 80_000, progress: 0, storeys: 8, shape: 'custom', customShape: customPts })
  ok('custom shape uses the drawn polygon (5 pts, centred, scaled to plate area)', cm.floors[0].polygon.length === 5 && near(buildMassing({ gfa: 80_000, progress: 0, storeys: 8 }).floors[0].polygon.length, 4, 0))
  ok('custom plate is centred on the origin', (() => { const ct = polygonCentroid(cm.floors[0].polygon); return near(ct.x, 0, 1e-6) && near(ct.z, 0, 1e-6) })())
  ok('custom shape falls back to preset when fewer than 3 points', buildMassing({ gfa: 80_000, progress: 0, storeys: 8, shape: 'custom', customShape: [{ x: 0, z: 0 }] }).floors[0].polygon.length === 5)

  // courtyard (true atrium hole)
  ok('holeFor returns a void only for the courtyard', holeFor('court')!.length === 4 && holeFor('rect') === null)
  const court = buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'court' })
  ok('courtyard floors carry an inner hole smaller than the outer plate', !!court.floors[0].hole && polygonArea(court.floors[0].hole!) > 0 && polygonArea(court.floors[0].hole!) < polygonArea(court.floors[0].polygon))
  ok('solid shapes have no hole', buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'rect' }).floors[0].hole === undefined)
  ok('courtyard scales to the GFA net of the void (vs a solid rect of same GFA)', polygonArea(court.floors[0].polygon) > polygonArea(buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'rect' }).floors[0].polygon))

  // progress extremes
  ok('0% → nothing built', buildMassing({ gfa: 50_000, progress: 0, storeys: 12 }).builtCount === 0)
  ok('100% → all built', buildMassing({ gfa: 50_000, progress: 100, storeys: 12 }).builtCount === 12)
  ok('zero GFA safe (no NaN)', (() => { const z = buildMassing({ gfa: 0, progress: 50 }); return z.floors.every((f) => f.polygon.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)) && Number.isFinite(f.y)) })())

  // colour mapping
  const f0 = m.floors[0], fTop = m.floors[24]
  ok('progress mode: built green, planned slate', floorColor('progress', f0, 0) === '#22c55e' && floorColor('progress', fTop, 0) === '#334155')
  ok('risk mode: low risk green', floorColor('risk', f0, 20) === '#22c55e')
  ok('risk mode: high risk red', floorColor('risk', f0, 85) === '#ef4444')
  ok('safety mode: high safety green', floorColor('safety', f0, 96) === '#22c55e')
  ok('carbon mode: high carbon red', floorColor('carbon', f0, 800) === '#ef4444')
  ok('status mode: high health green', floorColor('status', f0, 90) === '#22c55e')
}

// ── ifc-model (3D reconstruction from IFC counts) ────────────────────────────
section('ifc-model')
{
  ok('gridFor: 12 → 4×3 (≥12)', (() => { const g = gridFor(12); return g.cols * g.rows >= 12 && g.cols === 4 })())
  ok('gridFor: 9 → 3×3', (() => { const g = gridFor(9); return g.cols === 3 && g.rows === 3 })())
  ok('gridFor: 0 → empty', gridFor(0).cols === 0)
  ok('kindOf maps column/wall/slab/beam/mep', kindOf('IFCCOLUMN') === 'column' && kindOf('IFCWALLSTANDARDCASE') === 'wall' && kindOf('IFCSLAB') === 'slab' && kindOf('IFCBEAM') === 'beam' && kindOf('IFCPIPESEGMENT') === 'mep')
  ok('kindOf unknown → null', kindOf('IFCPROJECT') === null)

  // the bundled sample's real counts: 8 walls, 4 slabs, 12 columns, 8 beams, 3 duct + 4 pipe = 7 MEP, across 4 storeys
  const counts = [
    { type: 'IFCWALLSTANDARDCASE', count: 8 },
    { type: 'IFCSLAB', count: 4 },
    { type: 'IFCCOLUMN', count: 12 },
    { type: 'IFCBEAM', count: 8 },
    { type: 'IFCDUCTSEGMENT', count: 3 },
    { type: 'IFCPIPESEGMENT', count: 4 },
    { type: 'IFCDOOR', count: 5 }, // not placed (no geometry archetype) but counted as source? no
  ]
  const scene = buildIfcScene({ entityCounts: counts, storeys: 4 })
  ok('reconstructs across the real storeys', scene.storeys === 4 && scene.totalHeight === 4 * scene.storeyHeight)
  ok('places columns = file count (12)', scene.instances.filter((i) => i.kind === 'column').length === 12, scene.instances.filter((i) => i.kind === 'column').length)
  ok('places beams = file count (8)', scene.instances.filter((i) => i.kind === 'beam').length === 8)
  ok('places walls = file count (8)', scene.instances.filter((i) => i.kind === 'wall').length === 8)
  ok('places one slab per storey (4)', scene.instances.filter((i) => i.kind === 'slab').length === 4)
  ok('places MEP = duct+pipe (7)', scene.instances.filter((i) => i.kind === 'mep').length === 7, scene.instances.filter((i) => i.kind === 'mep').length)
  ok('sourceElements counts real elements', scene.sourceElements === 8 + 4 + 12 + 8 + 7)
  ok('every instance has a real ifcType + storey in range', scene.instances.every((i) => i.ifcType && i.storey >= 0 && i.storey < 4))
  ok('columns carry struct discipline', scene.instances.filter((i) => i.kind === 'column').every((i) => i.discipline === 'struct'))
  ok('walls carry arch discipline', scene.instances.filter((i) => i.kind === 'wall').every((i) => i.discipline === 'arch'))
  ok('byDiscipline aggregates', scene.byDiscipline.find((d) => d.discipline === 'struct')!.count === 12 + 8 + 4)
  ok('footprint > 0', scene.footprint > 0)
  ok('instances within footprint bounds', scene.instances.filter((i) => i.kind !== 'beam').every((i) => Math.abs(i.x) <= scene.footprint && Math.abs(i.z) <= scene.footprint))

  // empty / degenerate
  const empty = buildIfcScene({ entityCounts: [], storeys: 1 })
  ok('empty counts → no instances, no crash', empty.placed === 0 && empty.sourceElements === 0 && empty.footprint > 0)
  ok('storeys floored to ≥1', buildIfcScene({ entityCounts: counts, storeys: 0 }).storeys === 1)

  ok('discipline colours defined', DISCIPLINE_COLOR.struct.startsWith('#') && DISCIPLINE_COLOR.mep.startsWith('#'))

  // selected-element summary (inspector panel / aria-label)
  const geoSel: SelectedElement = { key: 'g0', source: 'geometry', ifcType: 'IFCCOLUMN', discipline: 'struct', expressID: 42, size: { x: 0.6, y: 3.2, z: 0.6 }, triangles: 12 }
  ok('describeSelection summarises real geometry', describeSelection(geoSel) === 'IFCCOLUMN · Structural · #42 · 0.6 × 3.2 × 0.6 m · 12 triangles', describeSelection(geoSel))
  const reconSel: SelectedElement = { key: 'e3', source: 'reconstruction', ifcType: 'IFCWALL', discipline: 'arch', storey: 2, size: { x: 4, y: 3, z: 0.2 } }
  ok('describeSelection summarises reconstruction', describeSelection(reconSel) === 'IFCWALL · Architectural · storey 2 · 4.0 × 3.0 × 0.2 m', describeSelection(reconSel))
}

// ── ifc-geometry (real web-ifc tessellation of the bundled sample) ──────────────
// Exercises the production extraction wrapper against SAMPLE_IFC_GEO end-to-end:
// proves the WASM kernel tessellates our generated IFC into real meshes. The
// WASM lives in node_modules; in CI the cwd is the repo root so this resolves.
section('ifc-geometry')
{
  const bytes = new TextEncoder().encode(SAMPLE_IFC_GEO)
  const res = await extractGeometry(bytes, { wasmPath: './node_modules/web-ifc/' })
  // 4 storeys × (1 slab + 6 columns + 2 beams) + 2 walls on the lower 3 = 42 elements.
  ok('tessellates every sample element (42 meshes)', res.meshes.length === 42, res.meshes.length)
  ok('produces real vertices', res.vertexCount > 1000, res.vertexCount)
  ok('produces real triangles', res.triangleCount > 300, res.triangleCount)
  ok('every mesh has positions, normals and indices', res.meshes.every((m) => m.positions.length > 0 && m.normals.length === m.positions.length && m.indices.length > 0))
  ok('positions and normals are xyz triples', res.meshes.every((m) => m.positions.length % 3 === 0))
  ok('indices form whole triangles', res.meshes.every((m) => m.indices.length % 3 === 0))
  ok('each mesh carries a 4x4 placement matrix', res.meshes.every((m) => m.matrix.length === 16))
  ok('each mesh carries an RGBA colour', res.meshes.every((m) => 'r' in m.color && 'a' in m.color))
  ok('classifies discipline from real IFC type (36 struct, 6 arch)',
    res.meshes.filter((m) => m.discipline === 'struct').length === 36 && res.meshes.filter((m) => m.discipline === 'arch').length === 6,
    res.meshes.reduce<Record<string, number>>((a, m) => ({ ...a, [m.discipline]: (a[m.discipline] ?? 0) + 1 }), {}))
  const names = new Set(res.meshes.map((m) => m.ifcTypeName))
  ok('resolves readable IFC type names for the inspector', names.has('IFCCOLUMN') && names.has('IFCSLAB') && names.has('IFCBEAM') && names.has('IFCWALLSTANDARDCASE'), [...names])
  ok('bbox spans the four storeys vertically (~14m, Y-up)', !!res.bbox && near(res.bbox.max[1] - res.bbox.min[1], 14, 0.5), res.bbox)
  ok('bbox plan width ~16m', !!res.bbox && near(res.bbox.max[0] - res.bbox.min[0], 16, 0.5), res.bbox)
  // Robustness: garbage / empty bytes never throw, just yield an empty result.
  const junk = await extractGeometry(new TextEncoder().encode('not an ifc file'))
  ok('invalid input → empty result, no throw', junk.meshes.length === 0 && junk.bbox === null)
}

// ── shapes (footprint geometry library) ─────────────────────────────────────────
section('shapes')
{
  ok('all SHAPE_KINDS generate ≥3-point polygons', SHAPE_KINDS.every((s) => unitShape(s.id).length >= 3))
  ok('rect=4, l=6, u=8, cross=12, cylinder=48 points', unitShape('rect').length === 4 && unitShape('l').length === 6 && unitShape('u').length === 8 && unitShape('cross').length === 12 && unitShape('cylinder').length === 48)
  ok('scaleToArea hits the target area', near(polygonArea(scaleToArea(unitShape('l'), 500)), 500, 0.01))
  ok('scaleAbout shrinks area by k²', near(polygonArea(scaleAbout(unitShape('rect'), 0.5)), polygonArea(unitShape('rect')) * 0.25, 1e-6))
  ok('rotatePolygon preserves area', near(polygonArea(rotatePolygon(unitShape('cross'), 0.7)), polygonArea(unitShape('cross')), 1e-9))
  ok('aspect stretches width but holds area ~constant', (() => { const a = polygonArea(unitShape('rect', 2)), b = polygonArea(unitShape('rect', 1)); return near(a, b, 0.02) && shapeExtent(unitShape('rect', 2)).width > shapeExtent(unitShape('rect', 1)).width })())
  ok('cross is non-convex (extent wider than a same-area rect arm)', shapeExtent(unitShape('cross')).width > 0)
  ok('custom preset is an editable 5-point default', unitShape('custom').length === 5)
  ok('centerPolygon moves the centroid to the origin', (() => { const c = centerPolygon([{ x: 10, z: 10 }, { x: 14, z: 10 }, { x: 14, z: 13 }, { x: 10, z: 13 }]); const ct = polygonCentroid(c); return near(ct.x, 0, 1e-9) && near(ct.z, 0, 1e-9) })())
}

// ── zoning (site boundary + envelope + compliance) ──────────────────────────────
section('zoning')
{
  const site = rectSite(40, 30)
  ok('rect site area / perimeter / centroid', polygonArea(site) === 1200 && polygonPerimeter(site) === 140 && near(polygonCentroid(site).x, 0) && near(polygonCentroid(site).z, 0))
  const inset = insetPolygon(site, 5)
  ok('inset by 5 → 30×20 (area 600)', inset.length === 4 && near(polygonArea(inset), 600, 0.001), polygonArea(inset))
  ok('inset larger than the site collapses to empty', insetPolygon(site, 25).length === 0)
  ok('scalePolygon halves area by k²', near(polygonArea(scalePolygon(site, 0.5)), 300, 0.001))

  const z = buildZoning({ boundary: site, far: 3, heightLimit: 40, setback: 5, maxCoverage: 50, storeyHeight: 3.5, proposedGFA: 3000, proposedStoreys: 10 })
  ok('site area 1200, maxGFA = FAR×area = 3600', z.siteArea === 1200 && z.maxGFA === 3600)
  ok('buildable = inset area 600; coverage cap 600 → maxFootprint 600', near(z.buildableArea, 600, 0.001) && near(z.maxFootprint, 600, 0.001))
  ok('proposed footprint = GFA/storeys = 300, height = 35', near(z.proposed.footprint, 300) && near(z.proposed.height, 35))
  ok('compliant scheme passes all checks', z.compliance.overall && z.compliance.far && z.compliance.height && z.compliance.coverage && z.compliance.setback)
  ok('utilisation = 3000/3600 ≈ 83.3%', near(z.utilisation, 83.33, 0.1), z.utilisation)

  const over = buildZoning({ boundary: site, far: 3, heightLimit: 40, setback: 5, maxCoverage: 50, storeyHeight: 3.5, proposedGFA: 5000, proposedStoreys: 10 })
  ok('over-FAR scheme fails FAR + overall', !over.compliance.far && !over.compliance.overall)
  const tall = buildZoning({ boundary: site, far: 10, heightLimit: 20, setback: 5, maxCoverage: 90, storeyHeight: 3.5, proposedGFA: 4000, proposedStoreys: 10 })
  ok('over-height scheme fails height (35 > 20)', !tall.compliance.height && !tall.compliance.overall)

  // podium + tower massing (GFA-conserving, stepped)
  ok('no podium → a single tier spanning the full height', z.tiers.length === 1 && z.tiers[0].base === 0 && near(z.tiers[0].top, 35))
  const pod = buildZoning({ boundary: site, far: 3, heightLimit: 40, setback: 5, maxCoverage: 90, storeyHeight: 3.5, proposedGFA: 3000, proposedStoreys: 10, podium: 0.4, towerSetback: 0.4 })
  ok('podium → two tiers, podium plate larger than tower', pod.tiers.length === 2 && pod.tiers[0].footprint > pod.tiers[1].footprint)
  ok('tiers stack base→top to the full height', pod.tiers[0].base === 0 && near(pod.tiers[0].top, 14) && near(pod.tiers[1].top, 35))
  ok('podium+tower conserves GFA', near(pod.tiers[0].footprint * 4 + pod.tiers[1].footprint * 6, 3000, 1))
  ok('coverage binds on the larger podium plate', near(pod.proposed.footprint, pod.tiers[0].footprint, 1e-6))

  // sky-exposure plane (stepped legal envelope)
  ok('no sky plane → a single envelope tier to the height limit', z.envelopeTiers.length === 1 && z.compliance.skyPlane)
  const sky = buildZoning({ boundary: site, far: 3, heightLimit: 40, setback: 5, maxCoverage: 90, storeyHeight: 3.5, proposedGFA: 3000, proposedStoreys: 10, skyBase: 10, skyStep: 0.4 })
  ok('sky plane → two envelope tiers, upper stepped in above skyBase', sky.envelopeTiers.length === 2 && sky.envelopeTiers[1].base === 10 && sky.envelopeTiers[1].footprint < sky.envelopeTiers[0].footprint)
  ok('upper envelope = buildable × (1−step)²', near(sky.envelopeTiers[1].footprint, 600 * 0.6 * 0.6, 0.01), sky.envelopeTiers[1].footprint)
  ok('scheme busting the upper envelope fails the sky-plane check', !sky.compliance.skyPlane && !sky.compliance.overall) // 300 m² plate above 10 m > 216 m² upper env
  const skyOk = buildZoning({ boundary: site, far: 3, heightLimit: 40, setback: 5, maxCoverage: 90, storeyHeight: 3.5, proposedGFA: 3000, proposedStoreys: 10, skyBase: 10, skyStep: 0.1 })
  ok('a scheme within the upper envelope passes the sky-plane check', skyOk.compliance.skyPlane) // upper env 600×0.81=486 ≥ 300

  // GeoJSON import — metre ring + lon/lat ring + Feature wrapper
  const metres = parseGeoBoundary('[[0,0],[200,0],[200,150],[0,150]]')
  ok('parses a bare metre ring (area 30000)', !!metres && near(polygonArea(metres!), 30000, 1), metres && polygonArea(metres))
  const feat = parseGeoBoundary(JSON.stringify({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[0, 0], [300, 0], [300, 200], [0, 200], [0, 0]]] } }))
  ok('parses a GeoJSON Feature polygon, drops closing vertex (4 pts, area 60000)', !!feat && feat!.length === 4 && near(polygonArea(feat!), 60000, 1))
  const ll = parseGeoBoundary('[[-0.0005,-0.0005],[0.0005,-0.0005],[0.0005,0.0005],[-0.0005,0.0005]]')
  ok('projects a lon/lat ring to metres (~12,300 m²)', !!ll && polygonArea(ll!) > 11000 && polygonArea(ll!) < 13500, ll && polygonArea(ll))
  ok('rejects non-JSON input', parseGeoBoundary('not json') === null)
}

console.log(`\nengines: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)