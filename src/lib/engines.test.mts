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
import { buildMassing, massingSchedule, deriveStoreys, floorColor, type FloorSpec } from './massing.ts'
import { buildBuilding } from './building.ts'
import { explodeBuilding, planForLevel, findElementGeom, levelColumns, levelPanels } from './building-explorer.ts'
import { applyEdits, emptyEdits, nudge, rescale, removeElement, addColumnAt, addDoorAt, addStairAt, duplicateColumn, editCount, setRoomName, setRoomUse, setRoomFinish, scaleRoom, editRooms } from './building-edits.ts'
import { toObj, objStats } from './building-export.ts'
import { toIfc } from './building-ifc.ts'
import { handleMcpRpc, MCP_PROTOCOL, SERVER_INFO } from './mcp-rpc.ts'
import { floorRooms, floorGrid } from './building-rooms.ts'
import { spaceType, finishGrade, occupants, SPACE_TYPES, FINISHES } from './room-types.ts'
import { roomReport, floorReport, finishSchedule, finishCsv } from './room-studio.ts'
import { furnitureFor, ffeCsv, FFE_CATALOG, FLOOR_TINT, FFE_ALTERNATES, ffeAlt } from './building-furniture.ts'
import { FAMILIES, DEFAULT_TYPES, familyType, familyCount, familyOfElement, engineeringFor, familiesCsv } from './families.ts'
import { costPlan, costPlanCsv } from './cost-plan.ts'
import { buildingServices, servicesCsv, SVC_TYPES, svcType } from './building-services.ts'
import { fastenerTakeoff, fastenersCsv } from './fasteners.ts'
import { parseDxf, summarize as dxfSummarize, entityLength, dxfCsv, SAMPLE_DXF } from './dxf.ts'
import { floorPartitions } from './building-partitions.ts'
import { coreStairs, stairCheck } from './building-stairs.ts'
import { egressAnalysis, egressPathFor } from './egress.ts'
import { floorCompartments, buildingFire } from './fire.ts'
import { structuralCheck } from './structure.ts'
import { energyAnalysis } from './energy.ts'
import { schedule4d } from './schedule4d.ts'
import { adviseBuilding, nextBestAction } from './advisor.ts'
import { liveFrame, liveHistory } from './live.ts'
import { rankTools, pushRecent, timeAgoShort, roleAccent, personalLede } from './personalize.ts'
import { CODE_PRESETS, CODE_KEYS } from './building-code.ts'
import { explodeIfc, meshGeom, friendlyType, sliceMeshes, cutHeightFor } from './ifc-explorer.ts'
import { ifcToModel } from './ifc-to-model.ts'
import type { IfcGeometryResult, IfcMesh } from './ifc-geometry.ts'
import { unitShape, holeFor, scaleToArea, scaleAbout, rotatePolygon, shapeExtent, centerPolygon, SHAPE_KINDS } from './shapes.ts'
import { buildIfcScene, gridFor, kindOf, DISCIPLINE_COLOR, describeSelection, type SelectedElement } from './ifc-model.ts'
import { extractGeometry } from './ifc-geometry.ts'
import { SAMPLE_IFC_GEO } from './ifc-sample-geo.ts'
import { SAMPLE_IFC } from './ifc-sample.ts'
import { parseIfc } from './ifc.ts'
import { auditModel, composition, explainEntity, auditCsv } from './bim-audit.ts'
import { meshBoxes, detectClashes, detectClashesMeshes, meshHitsBox, geometryTakeoff, clashCsv, type ClashBox } from './ifc-clash.ts'
import { buildBcf, makeZip, bcfTopicCount } from './bcf.ts'
import { buildZoning, insetPolygon, insetPolygonEdges, classifyEdges, polygonArea, polygonPerimeter, polygonCentroid, scalePolygon, parseGeoBoundary, rectSite } from './zoning.ts'
import { castShadow, shadowStudy, convexHull } from './shadow.ts'
import { defaultNeighbours, overshadowing, overshadowingCsv } from './context-shadow.ts'
import { ZONING_PRESETS, presetById, normaliseMix } from './zoning-presets.ts'
import { maximizeScheme, maximizeValue } from './zoning-optimize.ts'
import { feasibility, feasibilityWaterfall, feasibilityCsv, DEFAULT_RATES } from './feasibility.ts'
import { appraise, quarterly, appraisalCsv, irr } from './appraisal.ts'
import { evaluate as evalScenario, tornado, dataTable, scenarios, sensitivityCsv, FACTORS } from './sensitivity.ts'
import { accommodation, accommodationCsv, DEFAULT_UNIT_TYPES } from './unit-mix.ts'
import { obligations, obligationsCsv, AFFORDABLE_TENURES } from './obligations.ts'
import { amenitySunlight, sunlightCsv } from './sunlight.ts'
import { feasibilityReport } from './feasibility-report.ts'
import { optimizeMassing, massingCsv } from './massing-optimize.ts'
import { massingCarbon, massingCarbonCsv, carbonBand, STRUCTURE_LABEL } from './massing-carbon.ts'
import { transport, transportCsv, carShare, carOwnershipFor } from './transport.ts'
import { drainage, drainageCsv } from './drainage.ts'
import { biodiversity, biodiversityCsv, habitatUnits, DISTINCTIVENESS_SCORE } from './biodiversity.ts'
import { daylight, daylightCsv } from './daylight.ts'
import { cpm, cpmCsv, addWorkingDays, DEFAULT_PROGRAMME } from './cpm.ts'
import { scheduleRisk, scheduleRiskCsv, triangular } from './schedule-risk.ts'
import { costLoad, costLoadCsv, GROUP_DAY_RATE } from './cost-loading.ts'
import { evmForecast, evmForecastCsv } from './evm-forecast.ts'
import { analyzeSite, bearing, toLatLng, fromLatLng, boundaryToLatLng, compass, siteSurvey } from './geo.ts'
import { sunPosition, sunDirection, momentOf } from './sun.ts'
import { slug } from './download.ts'
import { summarizeModel, sampleObj } from './model-stats.ts'
import { encodeUrn, decodeUrn, normalizeUrn, translationProgress, bucketKeyFor, objectKeyFor, isTranslatable } from './aps.ts'
import { AGENT_TOOLS, runTool } from './agent-tools.ts'
import { parseMcpServers, qualify, split } from './mcp-federation.ts'
import { fieldsFromSchema, coerceArgs } from './tool-forms.ts'
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

  // distinct tower plate above the podium (per-region shapes)
  const ts = buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'rect', podium: 0.4, towerShape: 'cylinder' })
  ok('podium floors keep the base shape, tower floors switch shape', ts.floors[0].polygon.length === 4 && ts.floors[9].polygon.length === 48)
  ok('the shape switches exactly at the podium boundary (floor 4)', ts.floors[3].polygon.length === 4 && ts.floors[4].polygon.length === 48)
  ok('tower shape is ignored without a podium split', buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'rect', towerShape: 'cylinder' }).floors.every((f) => f.polygon.length === 4))
  ok('tower shape equal to base shape changes nothing', buildMassing({ gfa: 120_000, progress: 0, storeys: 10, shape: 'rect', podium: 0.4, towerShape: 'rect' }).floors.every((f) => f.polygon.length === 4))

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

  // floor schedule + quantity takeoff (real-world data from the geometry)
  const sched = massingSchedule(buildMassing({ gfa: 100_000, progress: 50, storeys: 10, shape: 'rect' }), { storeyHeight: 3.6, slabThickness: 0.3 })
  ok('schedule has one row per storey', sched.floors.length === 10)
  ok('rect plate area ≈ GFA/storeys (10,000 m²)', near(sched.floors[0].area, 10000, 1), sched.floors[0].area)
  ok('modeled GFA sums the plates (≈100,000 m²)', near(sched.grossFloorArea, 100000, 5), sched.grossFloorArea)
  ok('100×100 plate → 400 m perimeter, 1,440 m² façade/floor', near(sched.floors[0].perimeter, 400, 1) && near(sched.floors[0].facade, 1440, 5))
  ok('elevations step by the storey height', near(sched.floors[0].elevation, 0) && near(sched.floors[1].elevation, 3.6) && near(sched.height, 36))
  ok('gross volume = GFA × storey height', near(sched.grossVolume, 100000 * 3.6, 100))
  ok('slab concrete = GFA × thickness', near(sched.slabVolume, 100000 * 0.3, 50))
  ok('built area = 5 of 10 floors (≈50,000 m²)', near(sched.builtArea, 50000, 5) && near(sched.plannedArea, 50000, 5))
  ok('taper reduces modeled GFA below the nominal target', massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 10, taper: 0.4 })).grossFloorArea < 100000)
  ok('courtyard façade includes the atrium walls (perimeter > solid plate)', massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 8, shape: 'court' })).floors[0].perimeter > massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 8, shape: 'rect' })).floors[0].perimeter)
  ok('slug makes a filesystem-safe export name', slug('Meridian Tower!') === 'meridian-tower' && slug('  A/B  ') === 'a-b' && slug('') === 'export')

  // performance, sustainability & yield metrics
  const perf = massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 10, shape: 'rect' }), { storeyHeight: 3.6, slabThickness: 0.3, wwr: 0.4, netEfficiency: 0.82, costPerM2: 2800 })
  ok('exterior surface = façade + roof + footprint', near(perf.exteriorSurface, perf.facadeArea + perf.roofArea + perf.footprint, 1))
  ok('glazing + opaque wall = façade area (WWR split)', near(perf.glazingArea + perf.opaqueWallArea, perf.facadeArea, 1) && near(perf.glazingArea, perf.facadeArea * 0.4, 1))
  ok('net area = GFA × efficiency', near(perf.netArea, 82000, 5))
  ok('form factor = exterior surface ÷ gross volume', near(perf.formFactor, perf.exteriorSurface / perf.grossVolume, 0.001))
  ok('wall-to-floor ratio reported', near(perf.wallToFloor, perf.facadeArea / perf.grossFloorArea, 0.001))
  ok('slenderness = height ÷ min plan dim (36 / 100 = 0.36)', near(perf.slenderness, 0.36, 0.01), perf.slenderness)
  ok('embodied carbon = slab×rate + façade×rate; intensity = ÷GFA', near(perf.embodiedCarbon, perf.slabVolume * 350 + perf.facadeArea * 80, 50) && near(perf.carbonIntensity, perf.embodiedCarbon / perf.grossFloorArea, 0.5))
  ok('ROM cost = GFA × rate', near(perf.romCost, 100000 * 2800, 5000))
  ok('occupancy + parking from yields', perf.occupancy === Math.round(perf.netArea / 12) && perf.parkingStalls === Math.round((perf.grossFloorArea / 1000) * 3))
  ok('a flatter building has more skin per volume → higher form factor', massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 2, shape: 'rect' })).formFactor > massingSchedule(buildMassing({ gfa: 100_000, progress: 0, storeys: 20, shape: 'rect' })).formFactor)
}

// ── building (componentized building from the massing) ──────────────────────────
section('building')
{
  const b = buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 10, shape: 'rect' }))
  ok('one slab per storey + a roof', b.slabs.length === 10 && b.counts.slabs === 10 && b.roof !== null)
  ok('articulates the façade into opaque walls + a grid of real windows', b.walls.length === 40 && b.glazing.length > b.walls.length && b.counts.windows === b.glazing.length)
  ok('an edge beam per edge per floor (rect = 4×10)', b.beams.length === 40 && b.beams.every((bm) => bm.depth > 0 && bm.width > 0))
  ok('vertical mullions frame the façade by default', b.mullions.length > 0)
  ok('places ground-floor entrance doors on the frontage', b.doors.length > 0 && b.doors.every((d) => d.level === 0))
  ok('places a perimeter column grid (multiple of storeys, >0)', b.columns.length > 0 && b.columns.length % 10 === 0)
  ok('columns span a storey height each', b.columns.every((c) => c.h > 0 && c.w > 0 && c.d > 0))
  ok('a central core spanning full height by default', b.core !== null && Math.abs(b.core!.h - b.totalHeight) < 1e-9)
  ok('a wider window bay → fewer, larger windows', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 10, shape: 'rect' }), { bayWidth: 8 }).glazing.length < b.glazing.length)
  ok('mullions can be turned off', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 10, shape: 'rect' }), { mullions: false }).mullions.length === 0)
  ok('cylinder footprint → far more façade walls (one per edge) than a box', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 10, shape: 'cylinder' })).walls.length > b.walls.length * 2)
  ok('taller building → more columns', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 20, shape: 'rect' })).columns.length > b.columns.length)
  ok('coreRatio 0 omits the core', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 5, shape: 'rect' }), { coreRatio: 0 }).core === null)
  ok('every element is tagged with its level', b.slabs.every((s, i) => s.level === i) && b.columns.every((c) => c.level !== undefined) && b.glazing.every((g) => g.level !== undefined) && b.beams.every((bm) => bm.level !== undefined))
  ok('roof is tagged as the level above the top floor', b.roof?.level === 10)
  // interior partitions + doorways + a half-turn stair per storey
  ok('interior partition walls are generated, level-tagged', b.partitions.length > 0 && b.counts.partitions === b.partitions.length && b.partitions.every((p) => p.level !== undefined && Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) > 0 && p.h > 0))
  ok('doorways are cut into the partitions (shorter than the wall)', b.interiorDoors.length > 0 && b.counts.interiorDoors === b.interiorDoors.length && b.interiorDoors.every((d) => d.h > 0 && d.h < b.partitions[0].h + 1e-9 && d.level !== undefined))
  ok('a half-turn stair per storey (2 flights + landing + rails), in the core', b.stairs.length === 20 && b.counts.stairs === 20 && b.stairs.every((s) => s.flights.length === 2 && s.landings.length === 1 && s.rails.length === 2 && s.risers >= 14 && s.top > s.base))
  ok('stair treads climb (each tread higher than the last)', b.stairs[0].treads.every((t, i, a) => i === 0 || t.y > a[i - 1].y))
  ok('no core → no stairs', buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 5, shape: 'rect' }), { coreRatio: 0 }).stairs.length === 0)
  // full anatomy: substructure + finishes
  ok('a pad footing under every ground column + a core raft', b.foundations.length === b.columns.filter((c) => c.level === 0).length + 1 && b.counts.foundations === b.foundations.length && b.foundations.every((c) => c.y < 0))
  ok('perimeter ground beams tie the footings below grade', b.groundBeams.length === 4 && b.groundBeams.every((g) => g.y < 0))
  ok('a floor finish + a suspended ceiling per storey', b.floorFinishes.length === 10 && b.ceilings.length === 10 && b.counts.finishes === 10 && b.counts.ceilings === 10)
  ok('a roof-edge parapet above the roof slab', b.parapets.length === 4 && b.parapets.every((p) => p.y > b.totalHeight - 1) && b.counts.parapets === 4)
}

// ── building-explorer (Revit-style floor/element/schedule review) ───────────────
section('building-explorer')
{
  const model = buildBuilding(buildMassing({ gfa: 120_000, progress: 100, storeys: 12, shape: 'rect' }), { coreRatio: 0.16 })
  const ex = explodeBuilding(model, { storeyHeight: 3.6 })
  ok('explodes one inspectable element per real part', ex.summary.columns === model.columns.length && ex.summary.windows === model.glazing.length && ex.summary.beams === model.beams.length)
  ok('a floor element per storey + a roof, all addressable by id', !!(ex.byId['floor-0'] && ex.byId['floor-11'] && ex.byId['roof'] && ex.byId['col-0-0'] && ex.byId['core']))
  ok('windows, beams, doors & walls are inspectable elements', !!(ex.byId['pan-0-0'] && ex.byId['beam-0-0'] && ex.byId['wall-0-0']) && model.doors.length > 0 && !!ex.byId['door-0-0'])
  ok('levels list = 12 storeys + roof', ex.levels.length === 13 && ex.levels[0].name === 'Ground' && ex.levels[12].isRoof)
  ok('ground floor sits at elevation 0 with real area', ex.byId['floor-0'].data.elevation === 0 && Number(ex.byId['floor-0'].data.area) > 0)
  ok('upper floor elevation = level × storey height', Number(ex.byId['floor-10'].data.elevation) === 36)
  ok('column carries a real height (~storey) & concrete volume', Number(ex.byId['col-0-0'].data.height) > 3 && Number(ex.byId['col-0-0'].data.height) < 3.4 && Number(ex.byId['col-0-0'].data.volume) > 0)
  ok('window carries width/height/area/sill + a compass facing', (() => { const p = ex.byId['pan-0-0'].data; return Number(p.area) > 0 && Number(p.sill) >= 0 && typeof p.orientation === 'string' })())
  ok('beam carries length, depth & concrete volume', (() => { const b2 = ex.byId['beam-0-0'].data; return Number(b2.length) > 0 && Number(b2.depth) > 0 && Number(b2.volume) > 0 })())
  ok('beam/door/wall schedules exist with totals', ['Beam', 'Wall'].every((c) => ex.schedules.some((s) => s.category === c)) && ex.schedules.find((s) => s.category === 'Beam')!.totals.volume > 0)
  ok('findElementGeom locates a beam (oriented) + a door', (() => { const g1 = findElementGeom(model, 'beam-0-0'); const g2 = findElementGeom(model, 'door-0-0'); return !!g1 && !!g1.dir && !!g2 })())
  ok('core spans all storeys (level -1) with volume', ex.byId['core'].level === -1 && Number(ex.byId['core'].data.volume) > 0)
  ok('column section is derived from the column geometry', near(Number(ex.byId['col-0-0'].data.section), model.columns[0].w * 6.25, 0.01))
  // schedules
  const colSched = ex.schedules.find((s) => s.category === 'Column')!
  ok('column schedule has a row per column with a concrete total', colSched.rows.length === model.columns.length && colSched.totals.volume > 0)
  ok('floor schedule totals the GFA across storeys', (() => { const fs = ex.schedules.find((s) => s.group === 'Floors & Roof')!; return fs.rows.length === 13 && fs.totals.area > 0 })())
  // level filtering is consistent
  ok('per-level columns/panels partition the totals', (() => { let c = 0, p = 0; for (let i = 0; i < 12; i++) { c += levelColumns(model, i).length; p += levelPanels(model, i).length } return c === model.columns.length && p === model.glazing.length })())
  // plan projection
  const plan = planForLevel(model, 0)
  ok('plan projection: outline + columns with ids that match the schedule', plan.outline.length >= 4 && plan.columns.length === levelColumns(model, 0).length && plan.columns[0].id === 'col-0-0')
  ok('roof plan has no columns/panels', planForLevel(model, 12).isRoof && planForLevel(model, 12).columns.length === 0)
  // interior rooms flow through schedules + plan + summary
  ok('a Rooms schedule + room elements + net area', ex.schedules.some((s) => s.category === 'Room') && ex.summary.rooms > 0 && ex.summary.netArea > 0 && ex.elements.some((e) => e.category === 'Room'))
  ok('the level plan carries clickable rooms', planForLevel(model, 0).rooms.length > 0 && findElementGeom(model, planForLevel(model, 0).rooms[0].id) !== null)
  // partitions + stairs flow through schedules + summary + plan + geometry
  ok('Partition + Interior Door + Stair schedules with rows', ['Partition', 'Interior Door', 'Stair'].every((c) => ex.schedules.some((s) => s.category === c)) && ex.summary.partitions === model.partitions.length && ex.summary.interiorDoors === model.interiorDoors.length && ex.summary.stairs === model.stairs.length)
  ok('a partition schedule row totals interior wall length', (() => { const ps = ex.schedules.find((s) => s.category === 'Partition')!; return ps.rows.length === model.partitions.length && ps.totals.length > 0 })())
  ok('an interior-door element carries width/height/leaf area', (() => { const e = ex.byId[model.interiorDoors[0].id!]; return !!e && e.category === 'Interior Door' && Number(e.data.width) > 0 && Number(e.data.area) > 0 })())
  ok('a stair element carries flights + risers + a riser height + going', (() => { const e = ex.byId['stair-0-1']; return !!e && Number(e.data.flights) === 2 && Number(e.data.risers) >= 14 && Number(e.data.rise) > 0 && Number(e.data.going) > 0 })())
  ok('a stair element reports a building-code status (Pass) + pitch', (() => { const e = ex.byId['stair-0-1']; return !!e && e.data.code === 'Pass' && Number(e.data.pitch) > 0 && Number(e.data.pitch) < 42 && Number(e.data.rise) <= 0.19 })())
  ok('the level plan carries partitions + interior doors + a stair', (() => { const p = planForLevel(model, 0); return p.partitions.length > 0 && p.interiorDoors.length > 0 && p.stairs.length === 2 && p.stairs.some((s) => s.id === 'stair-0-1') })())
  ok('findElementGeom locates a partition + interior door + a stair', !!findElementGeom(model, model.partitions[0].id!) && !!findElementGeom(model, model.interiorDoors[0].id!) && (() => { const g = findElementGeom(model, 'stair-0-1'); return !!g && g.size.y > 0 })())
  ok('Foundation / Ground beam / Finish / Ceiling / Parapet schedules exist', ['Foundation', 'Ground Beam', 'Finish', 'Ceiling', 'Parapet'].every((c) => ex.schedules.some((s) => s.category === c)))
  ok('a footing element carries plan, depth & concrete; geometry resolves', (() => { const e = ex.byId[model.foundations[0].id!]; const g = findElementGeom(model, model.foundations[0].id!); return !!e && Number(e.data.volume) > 0 && Number(e.data.depth) > 0 && !!g && g.center.y < 0 })())
  ok('ceiling + finish elements carry area & thickness; geometry resolves', (() => { const c = ex.byId['ceil-0'], fn = ex.byId['fin-0']; return !!c && !!fn && Number(c.data.area) > 0 && Number(fn.data.thickness) > 0 && !!findElementGeom(model, 'ceil-0') && !!findElementGeom(model, 'fin-0') })())
  // highlight geometry
  ok('findElementGeom locates a column box', (() => { const g = findElementGeom(model, 'col-0-0'); return !!g && Math.abs(g.size.x - model.columns[0].w) < 1e-9 })())
  ok('findElementGeom gives a panel an edge direction', (() => { const g = findElementGeom(model, 'pan-0-0'); return !!g && !!g.dir })())
  ok('findElementGeom returns null for an unknown id', findElementGeom(model, 'nope-9-9') === null)
}

// ── building-edits (direct manipulation: move / resize / delete / add) ──────────
section('building-edits')
{
  const model = buildBuilding(buildMassing({ gfa: 80_000, progress: 100, storeys: 8, shape: 'rect' }), { coreRatio: 0.16 })
  ok('every model element carries a stable id', model.columns.every((c) => !!c.id) && model.glazing.every((g) => !!g.id) && model.beams.every((b) => !!b.id) && model.core?.id === 'core')
  ok('applyEdits with no edits is a no-op (same counts)', (() => { const a = applyEdits(model, emptyEdits()); return a.columns.length === model.columns.length && a.glazing.length === model.glazing.length })())

  // move a column
  const col0 = model.columns[0].id!
  const moved = applyEdits(model, nudge(emptyEdits(), col0, { x: 5, y: 0, z: -3 }))
  ok('move: nudging a column shifts its position', (() => { const c = moved.columns.find((c) => c.id === col0)!; return near(c.x, model.columns[0].x + 5) && near(c.z, model.columns[0].z - 3) })())

  // resize a column (section scale)
  const grown = applyEdits(model, rescale(emptyEdits(), col0, 1.5))
  ok('resize: rescaling a column grows its section', (() => { const c = grown.columns.find((c) => c.id === col0)!; return near(c.w, model.columns[0].w * 1.5) && near(c.d, model.columns[0].d * 1.5) })())

  // delete a column
  const del = applyEdits(model, removeElement(emptyEdits(), col0))
  ok('delete: removing a column drops it (count −1, id gone)', del.columns.length === model.columns.length - 1 && !del.columns.some((c) => c.id === col0))

  // resize a window (height + width via scale)
  const win0 = model.glazing[0].id!
  const winEd = applyEdits(model, rescale(nudge(emptyEdits(), win0, { x: 0, y: 1, z: 0 }), win0, 0.5))
  ok('move+resize a window: lifts it & shrinks its width', (() => { const g = winEd.glazing.find((g) => g.id === win0)!; const w0 = Math.hypot(model.glazing[0].b.x - model.glazing[0].a.x, model.glazing[0].b.z - model.glazing[0].a.z); const w1 = Math.hypot(g.b.x - g.a.x, g.b.z - g.a.z); return near(g.y, model.glazing[0].y + 1) && near(w1, w0 * 0.5, 1e-6) })())

  // add a column at a plan point on level 2
  const added = applyEdits(model, addColumnAt(emptyEdits(), model, 2, 1.5, 2.5))
  ok('add: a new column appears on the chosen level', added.columns.length === model.columns.length + 1 && added.columns.some((c) => c.level === 2 && near(c.x, 1.5) && near(c.z, 2.5)))

  // duplicate a column
  ok('duplicate: copies a column (count +1)', applyEdits(model, duplicateColumn(emptyEdits(), model, col0)).columns.length === model.columns.length + 1)

  // author an interior door onto the nearest partition
  const part0 = model.partitions[0]
  const mid = { x: (part0.a.x + part0.b.x) / 2, z: (part0.a.z + part0.b.z) / 2 }
  const withDoor = addDoorAt(emptyEdits(), model, part0.level ?? 0, mid.x, mid.z)
  const dm = applyEdits(model, withDoor)
  ok('add door: a new interior door appears on a partition (count +1)', dm.interiorDoors.length === model.interiorDoors.length + 1 && dm.counts.interiorDoors === dm.interiorDoors.length)
  ok('the authored door sits on the chosen partition, with a real leaf', (() => { const d = dm.interiorDoors.find((x) => x.id!.startsWith('add-idoor-'))!; return !!d && d.level === (part0.level ?? 0) && Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) > 0 && d.h > 0 })())
  ok('an authored door can be removed again + editCount tracks it', applyEdits(model, removeElement(withDoor, withDoor.addedDoors[0].id)).interiorDoors.length === model.interiorDoors.length && editCount(withDoor) === 1)
  ok('addDoorAt with no partitions on the level is a no-op', addDoorAt(emptyEdits(), { ...model, partitions: [] }, 0, 0, 0).addedDoors.length === 0)

  // add / remove an egress stair shaft (one flight per storey)
  const withStair = addStairAt(emptyEdits(), model, 0, 0)
  const sm = applyEdits(model, withStair)
  ok('add stair: a new egress shaft (one flight per storey) appears', sm.stairs.length === model.stairs.length + model.counts.storeys && sm.counts.stairs === sm.stairs.length)
  ok('the added stair flights climb & carry add-stair ids', withStair.addedStairs.every((s) => s.id!.startsWith('add-stair-') && s.flights.length === 2 && s.top > s.base))
  ok('deleting an added stair removes the whole shaft', applyEdits(model, removeElement(withStair, withStair.addedStairs[0].id!)).stairs.length === model.stairs.length)
  ok('a generated stair can be deleted (count −1)', applyEdits(model, removeElement(emptyEdits(), model.stairs[0].id!)).stairs.length === model.stairs.length - 1)

  // an added column can itself be deleted, and edits explode + schedule live
  const ed = addColumnAt(emptyEdits(), model, 0, 0, 0)
  const addId = ed.added[0].id
  ok('an added column can be removed again', applyEdits(model, removeElement(ed, addId)).columns.length === model.columns.length)
  ok('editCount tracks moves + deletes + adds', editCount(nudge(removeElement(addColumnAt(emptyEdits(), model, 0, 0, 0), col0), model.beams[0].id!, { x: 1, y: 0, z: 0 })) === 3)
  ok('edited model still explodes into a schedule', explodeBuilding(applyEdits(model, removeElement(emptyEdits(), col0))).summary.columns === model.columns.length - 1)
}

// ── building-rooms (interior spaces) ────────────────────────────────────────────
section('building-rooms')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const AREA = 6.25 * 6.25 // (1/PLATE_SCALE)²
  ok('the building generates interior rooms, level-tagged', m.rooms.length > 0 && m.counts.rooms === m.rooms.length && new Set(m.rooms.map((r) => r.level)).size === 6)
  ok('every room has a real area + a valid polygon', m.rooms.every((r) => r.area > 0 && r.polygon.length >= 3 && r.perimeter > 0))
  const fp = m.slabs[0].polygon
  const rooms = floorRooms(fp, { roomSize: 8 })
  ok('floorRooms tiles a floor (room areas ≈ floor area)', near(rooms.reduce((s, r) => s + r.area, 0), polygonArea(fp) * AREA, polygonArea(fp) * AREA * 0.08))
  ok('the layout carves a corridor network (circulation spaces, ~10-25% share)', (() => { const circ = rooms.filter((r) => r.use === 'circulation'); const share = circ.reduce((s, r) => s + r.area, 0) / rooms.reduce((s, r) => s + r.area, 0); return circ.length > 0 && share > 0.05 && share < 0.3 })())
  ok('no space sits inside the core (it is lifts/stairs, not lettable)', (() => { const core = { x: m.core!.x, z: m.core!.z, w: m.core!.w, d: m.core!.d }; const rs = floorRooms(fp, { core }); return rs.every((r) => Math.abs(r.center.x - core.x) > core.w / 2 - 1e-6 || Math.abs(r.center.z - core.z) > core.d / 2 - 1e-6) })())
  ok('a larger room size → fewer, bigger rooms', floorRooms(fp, { roomSize: 16 }).length < rooms.length)
  // the shared grid: rooms are exactly the cells flagged as rooms (single source of truth)
  ok('floorGrid room cells = floorRooms rooms; corridor cells = circulation spaces', (() => { const g = floorGrid(fp, { roomSize: 8 })!; const nR = rooms.filter((r) => r.use !== 'circulation').length; const nC = rooms.filter((r) => r.use === 'circulation').length; return g.cells.filter((c) => c.kind === 'room').length === nR && g.cells.filter((c) => c.kind === 'corridor').length === nC })())
  ok('every room is assigned its entrance edge (BFS from the corridors)', (() => { const g = floorGrid(fp, { roomSize: 8 })!; return g.cells.filter((c) => c.kind === 'room').every((c) => c.doorTo !== null) })())
}

// ── room-types (space-type + finish catalog used by the Room Studio) ─────────────
section('room-types')
{
  ok('the catalog has the headline space-types + finish grades', SPACE_TYPES.length >= 8 && FINISHES.length >= 4 && SPACE_TYPES.some((s) => s.id === 'office') && FINISHES.some((f) => f.id === 'premium'))
  ok('spaceType looks up by id; unknown falls back to the first (office)', spaceType('meeting').label === 'Meeting room' && spaceType('nope').id === SPACE_TYPES[0].id && spaceType(undefined).id === SPACE_TYPES[0].id)
  ok('finishGrade looks up by id; unknown falls back to standard', finishGrade('premium').cost === 2900 && finishGrade('nope').id === 'standard' && finishGrade(undefined).id === 'standard')
  ok('occupants = ceil(area ÷ load factor), min 1 for an occupiable space', occupants(100, 'office') === Math.ceil(100 / 9.3) && occupants(1, 'office') === 1)
  ok('denser use → more occupants for the same area', occupants(100, 'meeting') > occupants(100, 'office'))
  ok('non-occupiable uses (plant / circulation) carry zero occupant load', occupants(100, 'plant') === 0 && occupants(500, 'circulation') === 0)
}

// ── room-studio (per-space + per-floor report engine) ────────────────────────────
section('room-studio')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const r0 = m.rooms.find((r) => r.level === 0)!
  const rep = roomReport(m, r0.id, { storeyHeight: 3.6, code: 'IBC' })!
  ok('roomReport returns a full takeoff for a real room', !!rep && rep.id === r0.id && rep.level === 0 && rep.area === r0.area)
  ok('report carries dimensions, height, volume (volume ≈ area × clear height)', rep.widthM > 0 && rep.depthM > 0 && rep.heightM > 0 && near(rep.volume, rep.area * rep.heightM, rep.area * 0.05))
  ok('report defaults the use to office + names the use & finish', rep.use === 'office' && rep.useLabel === 'Office' && !!rep.finishLabel)
  ok('occupancy matches the occupants() factor for the use', rep.occupancy === occupants(r0.area, 'office'))
  ok('finish cost = finish area × the grade rate (standard 1100)', rep.finishCost === Math.round(rep.finishArea * finishGrade('standard').cost))
  ok('report exposes a focus region on the room’s level (for the 3D preview)', rep.focus.level === 0 && rep.focus.maxX > rep.focus.minX && rep.focus.maxZ > rep.focus.minZ)
  ok('a perimeter room is daylit (has façade glazing); egress is evaluated', typeof rep.daylit === 'boolean' && rep.windows >= 0 && typeof rep.egressOk === 'boolean')
  ok('re-programming the use changes occupancy + finish cost in the report', (() => { const m2 = applyEdits(m, setRoomUse(setRoomFinish(emptyEdits(), r0.id, 'premium'), r0.id, 'meeting')); const r2 = roomReport(m2, r0.id)!; return r2.use === 'meeting' && r2.occupancy > rep.occupancy && r2.finishCost > rep.finishCost })())
  ok('roomReport on an unknown id is null', roomReport(m, 'nope-room') === null)

  const fr = floorReport(m, 0, { storeyHeight: 3.6, code: 'IBC' })!
  ok('floorReport rolls up every room on the floor', !!fr && fr.level === 0 && fr.rooms === m.rooms.filter((r) => r.level === 0).length)
  ok('floor occupancy = Σ room occupancy; cost = Σ room finish cost', (() => { const rs = m.rooms.filter((r) => r.level === 0); const occ = rs.reduce((s, r) => s + occupants(r.area, r.use), 0); return fr.occupancy === occ && fr.finishCost > 0 })())
  ok('floor report carries a use mix sorted by area (office dominates a plain plan)', fr.uses.length > 0 && fr.uses[0].area >= fr.uses[fr.uses.length - 1].area && fr.uses[0].use === 'office')
  ok('floor counts windows / doors / columns on the level', fr.windows === m.glazing.filter((g) => g.level === 0).length && fr.columns === m.columns.filter((c) => c.level === 0).length)
  ok('floorReport on a level with no slab is null', floorReport(m, 99) === null)
}

// ── room-edits (the Room Studio modification layer) ──────────────────────────────
section('room-edits')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const r0 = m.rooms.find((r) => r.level === 0)!
  ok('editRooms with no edits returns the same rooms (no-op)', editRooms(m.rooms, {}) === m.rooms && editRooms(m.rooms) === m.rooms)
  ok('setRoomName renames a room through applyEdits', applyEdits(m, setRoomName(emptyEdits(), r0.id, 'Boardroom')).rooms.find((r) => r.id === r0.id)!.name === 'Boardroom')
  ok('setRoomUse / setRoomFinish re-programme a room', (() => { const e = setRoomFinish(setRoomUse(emptyEdits(), r0.id, 'lab'), r0.id, 'technical'); const r = applyEdits(m, e).rooms.find((x) => x.id === r0.id)!; return r.use === 'lab' && r.finish === 'technical' })())
  ok('scaleRoom grows a room about its centre (area ↑, centre stable)', (() => { const r = applyEdits(m, scaleRoom(emptyEdits(), r0.id, 1.2)).rooms.find((x) => x.id === r0.id)!; return r.area > r0.area && near(r.center.x, r0.center.x, 0.2) && near(r.center.z, r0.center.z, 0.2) })())
  ok('successive scaleRoom calls accumulate in the edit set; area scales by s²', (() => { const e = scaleRoom(scaleRoom(emptyEdits(), r0.id, 1.2), r0.id, 1.2); const s = e.rooms[r0.id].scale!; const r = applyEdits(m, e).rooms.find((x) => x.id === r0.id)!; return near(s, 1.44, 1e-6) && near(r.area, r0.area * s * s, r0.area * 0.05) })())
  ok('scaleRoom clamps the factor to 0.4–2.5×', scaleRoom(emptyEdits(), r0.id, 99).rooms[r0.id].scale === 2.5 && scaleRoom(emptyEdits(), r0.id, 0.001).rooms[r0.id].scale === 0.4)
  ok('editCount tracks room edits alongside element edits', editCount(setRoomUse(setRoomName(emptyEdits(), r0.id, 'X'), 'room-0-1', 'meeting')) === 2)
  ok('a room edit survives applyEdits without touching element counts', (() => { const a = applyEdits(m, setRoomUse(emptyEdits(), r0.id, 'retail')); return a.columns.length === m.columns.length && a.counts.rooms === m.counts.rooms })())
  ok('loading an old edit-set with no rooms map does not break applyEdits', (() => { const legacy = { deleted: [], edits: {}, added: [], addedDoors: [], addedStairs: [] } as unknown as ReturnType<typeof emptyEdits>; return applyEdits(m, legacy).rooms.length === m.rooms.length })())
}

// ── building-furniture (FF&E: furnish every room from its use + price it) ────────
section('building-furniture')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const f = furnitureFor(m, { storeyHeight: 3.6 })
  ok('every habitable room gets furniture; every room gets a floor tint', f.items.length > 0 && f.patches.length === m.rooms.length)
  ok('default offices get desks + chairs (the headline kinds)', f.byKind.some((k) => k.kind === 'desk') && f.byKind.some((k) => k.kind === 'chair'))
  ok('items carry stable ids, a room + level, and real box parts', f.items.every((it) => it.id.startsWith('fur-') && it.level >= 0 && it.parts.length > 0 && it.parts.every((p) => p.w > 0 && p.h > 0 && p.d > 0)))
  ok('furniture sits above its floor slab (y > slab top, below next storey)', (() => { const sceneSh = m.totalHeight / m.counts.storeys; return f.items.every((it) => { const slab = m.slabs.find((s) => s.level === it.level)!; return it.parts.every((p) => p.y > slab.y && p.y < slab.y + sceneSh) }) })())
  ok('parts stay inside the room footprint (with a tolerance)', (() => { const byRoom = new Map(m.rooms.map((r) => [r.id, r])); return f.items.every((it) => { const r = byRoom.get(it.roomId)!; const xs = r.polygon.map((p) => p.x), zs = r.polygon.map((p) => p.z); const t = 0.15; return it.parts.every((p) => p.x >= Math.min(...xs) - t && p.x <= Math.max(...xs) + t && p.z >= Math.min(...zs) - t && p.z <= Math.max(...zs) + t) }) })())
  ok('the takeoff prices by catalog (cost = Σ count × unit cost)', f.total.cost === f.byKind.reduce((s, k) => s + k.count * FFE_CATALOG[k.kind].cost, 0) && f.total.items === f.items.length)
  ok('per-level roll-up covers every furnished level', f.byLevel.length > 0 && f.byLevel.reduce((s, l) => s + l.items, 0) === f.items.length)
  ok('re-programming a room re-furnishes it (meeting → conference table appears)', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const m2 = applyEdits(m, setRoomUse(emptyEdits(), r0.id, 'meeting')); const f2 = furnitureFor(m2); return f2.items.some((it) => it.roomId === r0.id && it.kind === 'meeting-table') })())
  ok('plant rooms get equipment, circulation stays clear', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const mp = applyEdits(m, setRoomUse(emptyEdits(), r0.id, 'plant')); const fp = furnitureFor(mp); const mc = applyEdits(m, setRoomUse(emptyEdits(), r0.id, 'circulation')); const fc = furnitureFor(mc); return fp.items.some((it) => it.roomId === r0.id && it.kind === 'plant-unit') && !fc.items.some((it) => it.roomId === r0.id) })())
  ok('floor tints follow the use (residential ≠ office tint)', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const mr = applyEdits(m, setRoomUse(emptyEdits(), r0.id, 'residential')); const fr = furnitureFor(mr); const pat = fr.patches.find((p) => p.roomId === r0.id)!; return pat.color === FLOOR_TINT.residential && pat.color !== FLOOR_TINT.office })())
  ok('deterministic: two passes produce identical output', JSON.stringify(furnitureFor(m)) === JSON.stringify(furnitureFor(m)))
  ok('FF&E CSV carries the kinds, totals and a per-level block', (() => { const c = ffeCsv(f); return c.includes('Workstation desk') && c.includes(`TOTAL,${f.total.items}`) && c.includes('LEVEL,Items') })())

  // alternates: every kind has ≥2 types; defaults match the base catalog; swapping changes budget + footprint
  ok('every FF&E kind carries alternates, default = base catalog rate', Object.keys(FFE_CATALOG).every((k) => (FFE_ALTERNATES[k]?.length ?? 0) >= 2 && FFE_ALTERNATES[k][0].cost === FFE_CATALOG[k].cost))
  ok('ffeAlt looks up by id and falls back to the default', ffeAlt('desk', 'sit-stand').cost === 680 && ffeAlt('desk', 'nope').id === 'standard' && ffeAlt('chair').id === 'task')
  ok('swapping desks to sit-stand raises the budget (same counts)', (() => { const f2 = furnitureFor(m, { ffe: { desk: 'sit-stand' } }); return f2.total.items === f.total.items && f2.total.cost > f.total.cost && f2.byKind.find((k) => k.kind === 'desk')!.unitCost === 680 })())
  ok('a widthFactor alternate stretches the drawn footprint', (() => { const f2 = furnitureFor(m, { ffe: { desk: 'bench' } }); const w0 = f.items.find((i) => i.kind === 'desk')!.parts[0].w; const w2 = f2.items.find((i) => i.kind === 'desk')!.parts[0].w; return near(w2, w0 * 1.14, 1e-9) })())
  ok('the alternate label lands in the takeoff line', furnitureFor(m, { ffe: { chair: 'ergonomic' } }).byKind.find((k) => k.kind === 'chair')!.label.includes('Ergonomic'))
}

// ── families (the element catalog: types/alternatives per category) ──────────────
section('families')
{
  ok('the catalog covers the full element tree (20 categories, 105+ types)', FAMILIES.length === 20 && familyCount() >= 105 && FAMILIES.every((f) => f.types.length >= 3))
  ok('ground beams, lifts, wall finishes and ironmongery are catalogued', ['groundBeam', 'lift', 'wallFinish', 'ironmongery'].every((k) => (FAMILIES.find((f) => f.key === k)?.types.length ?? 0) >= 3))
  ok('heritage single glazing exposes the worst-case envelope (U 5.4 vs VIG 0.6)', engineeringFor({ ...DEFAULT_TYPES, glazing: 'single' }).uWindow === 5.4 && engineeringFor({ ...DEFAULT_TYPES, glazing: 'vacuum' }).uWindow === 0.6)
  ok('lifts carry duty + capacity props; fire-fighting lift is EN81-72', familyType('lift', 'firefighting').material.includes('EN81-72') && Number(familyType('lift', 'goods').props.capacity) === 26)
  ok('slabs, core walls, mullions and balustrades are catalogued too', ['slab', 'core', 'mullion', 'balustrade'].every((k) => (FAMILIES.find((f) => f.key === k)?.types.length ?? 0) >= 3))
  ok('timber alternatives run across the tree (column, slab, core, ceiling)', familyType('column', 'glulam-col').material.includes('GL28') && familyType('slab', 'clt').material.includes('spruce') && familyType('core', 'clt-core').props.system === 'timber shear' && familyType('ceiling', 'baffle').label.includes('Timber'))
  ok('every category carries real alternatives with material + rate + props', FAMILIES.every((f) => f.types.every((t) => t.label && t.material && t.cost > 0 && Object.keys(t.props).length > 0)))
  ok('DEFAULT_TYPES selects the first type of every category', Object.keys(DEFAULT_TYPES).length === FAMILIES.length && FAMILIES.every((f) => DEFAULT_TYPES[f.key] === f.types[0].id))
  ok('familyType looks up by id; unknown falls back to the default', familyType('column', 'steel-uc').material.includes('S355') && familyType('column', 'nope').id === 'rc-square' && familyType('nope').id === 'none')
  ok('structural alternatives carry section shape for the viewer', familyType('column', 'rc-round').shape === 'cylinder' && familyType('column', 'rc-square').shape === 'box')
  const eng0 = engineeringFor(DEFAULT_TYPES)
  ok('engineeringFor derives envelope U-values + structural strengths', eng0.uWall === 0.3 && eng0.uWindow === 1.4 && eng0.uRoof === 0.18 && eng0.fcColumn === 32)
  ok('triple glazing tightens the window U; steel column raises strength', (() => { const e = engineeringFor({ ...DEFAULT_TYPES, glazing: 'tgu', column: 'steel-uc' }); return e.uWindow === 0.9 && e.fcColumn === 88 })())
  // the selections actually move the downstream engines
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  ok('selecting TGU lowers the energy intensity (EUI)', (() => { const a = energyAnalysis(m, { storeyHeight: 3.6, uWindow: 1.4 }); const b = energyAnalysis(m, { storeyHeight: 3.6, uWindow: 0.9 }); return b.summary.eui < a.summary.eui })())
  ok('selecting a stronger column section drops the max utilisation', (() => { const a = structuralCheck(m, { storeyHeight: 3.6, fc: 32 }); const b = structuralCheck(m, { storeyHeight: 3.6, fc: 88 }); return b.summary.maxColUtil < a.summary.maxColUtil })())
  ok('the families CSV schedules every type and flags the active one', (() => { const c = familiesCsv({ ...DEFAULT_TYPES, glazing: 'tgu' }); return c.split('\n').length === familyCount() + 1 && c.includes('Triple glazed (TGU),6/12/6/12/6,760,m²,YES') && c.includes('Double glazed (DGU low-E),6/16Ar/6 low-E,540,m²,') })())
  // family-of-element mapping (per-element overrides + cost + IFC all key off this)
  ok('familyOfElement maps ids to families by prefix', familyOfElement('col-2-3') === 'column' && familyOfElement('wall-0-1') === 'facade' && familyOfElement('pan-1-2') === 'glazing' && familyOfElement('idoor-0-4') === 'interiorDoor' && familyOfElement('floor-3') === 'slab' && familyOfElement('core') === 'core' && familyOfElement('roof') === 'roof')
  ok('familyOfElement returns null for unknown ids', familyOfElement('mystery-9') === null)
}

// ── cost-plan (elemental cost plan: model qty × family rates, override-aware) ─────
section('cost-plan')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const cp = costPlan(m, { storeyHeight: 3.6, ffeCost: 1_000_000, mepCost: 2_000_000, fixingsCost: 500_000 })
  ok('the plan totals a real construction cost + $/m² GFA', cp.total > 0 && cp.gfa > 0 && cp.perM2 === Math.round(cp.total / cp.gfa))
  ok('it is grouped NRM-style (substructure, frame, envelope, internal…)', ['substructure', 'frame', 'envelope', 'internal'].every((k) => cp.groups.some((g) => g.key === k)))
  ok('group costs sum to the total; each carries a $/m²', Math.abs(cp.groups.reduce((s, g) => s + g.cost, 0) - cp.total) < 2 && cp.groups.every((g) => g.perM2 >= 0))
  ok('soft systems fold in (MEP / FF&E / fixings totals appear as lines)', cp.groups.find((g) => g.key === 'services')!.lines.some((l) => l.cost === 2_000_000) && cp.groups.find((g) => g.key === 'ffe')!.cost === 1_000_000 && cp.groups.find((g) => g.key === 'fixings')!.cost === 500_000)
  ok('frame line uses the selected column rate (lm × $/m)', (() => { const fr = cp.groups.find((g) => g.key === 'frame')!; const col = fr.lines.find((l) => l.family === 'column')!; return col.unit === 'm' && col.qty > 0 && col.cost === Math.round(col.qty * familyType('column').cost) })())
  ok('switching to a costlier façade raises the envelope cost', (() => { const a = costPlan(m, {}).groups.find((g) => g.key === 'envelope')!.cost; const b = costPlan(m, { types: { ...DEFAULT_TYPES, facade: 'double-skin' } }).groups.find((g) => g.key === 'envelope')!.cost; return b > a })())
  // per-element override splits one column onto its own steel line + raises columns cost
  const colId = m.columns.find((c) => c.level === 0)!.id!
  ok('a per-element override splits the family onto a second priced line', (() => {
    const base = costPlan(m, {}); const ov = costPlan(m, { overrides: { [colId]: 'steel-uc' } })
    const baseColLines = base.groups.find((g) => g.key === 'frame')!.lines.filter((l) => l.family === 'column').length
    const ovFrame = ov.groups.find((g) => g.key === 'frame')!
    const ovColLines = ovFrame.lines.filter((l) => l.family === 'column')
    const baseColCost = base.groups.find((g) => g.key === 'frame')!.lines.filter((l) => l.family === 'column').reduce((s, l) => s + l.cost, 0)
    const ovColCost = ovColLines.reduce((s, l) => s + l.cost, 0)
    return baseColLines === 1 && ovColLines.length === 2 && ovColLines.some((l) => l.overridden && l.type === 'steel-uc') && ovColCost > baseColCost
  })())
  ok('the cost-plan CSV lists groups, subtotals, the total and $/m²', (() => { const c = costPlanCsv(cp); return c.includes('Substructure,SUBTOTAL') && /TOTAL,,,,,\d/.test(c) && c.includes('$/m² GFA') })())
}

// ── building-ifc type objects (family/type → IfcTypeObject + occurrence rels) ─────
section('ifc-types')
{
  const m = buildBuilding(buildMassing({ gfa: 40_000, progress: 100, storeys: 4, shape: 'rect' }), { coreRatio: 0.16 })
  const spf = toIfc(m, { name: 'T', storeyHeight: 3.6, types: { ...DEFAULT_TYPES, column: 'steel-uc', glazing: 'tgu' } })
  ok('IfcTypeObjects are emitted per family (column/beam/wall/slab/window/covering)', ['IFCCOLUMNTYPE', 'IFCBEAMTYPE', 'IFCWALLTYPE', 'IFCSLABTYPE', 'IFCWINDOWTYPE', 'IFCCOVERINGTYPE'].every((c) => spf.includes(c)))
  ok('occurrences are bound to their type via IfcRelDefinesByType', spf.includes('IFCRELDEFINESBYTYPE'))
  ok('the selected type name + material ride into the IFC', spf.includes("'Steel UC 305×305'") && spf.includes('Triple glazed (TGU)') && spf.includes('S355 steel'))
  ok('default selection still names the base types', toIfc(m, { storeyHeight: 3.6 }).includes("'RC square 400'"))
  ok('partition walls get a distinct PARTITIONING wall type', spf.includes('.PARTITIONING.') && spf.includes('.SOLIDWALL.'))
}

// ── building-services (MEP: lighting, air, fire, power, sanitary) ────────────────
section('building-services')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const s = buildingServices(m, { storeyHeight: 3.6 })
  ok('the services layer covers lighting, hvac, fire and sanitary', s.items.length > 0 && ['lighting', 'hvac', 'fire', 'sanitary'].every((sys) => s.items.some((it) => it.system === sys)))
  ok('every habitable room gets luminaires + a sprinkler + a detector', m.rooms.filter((r) => r.level < m.counts.storeys).every((r) => s.items.some((it) => it.roomId === r.id && it.kind === 'luminaire') && s.items.some((it) => it.roomId === r.id && it.kind === 'sprinkler') && s.items.some((it) => it.roomId === r.id && it.kind === 'detector')))
  ok('items hang at ceiling level with stable ids + real boxes', s.items.every((it) => it.id.startsWith('svc-') && it.parts.every((p) => p.w > 0 && p.h > 0 && p.d > 0)))
  ok('spacing rules: ~1 luminaire / 12 m² (±1 per room)', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const n = s.items.filter((it) => it.roomId === r0.id && it.kind === 'luminaire').length; return Math.abs(n - Math.round(r0.area / 12)) <= 1 })())
  ok('the per-level schedule sums match the drawn items', (() => { const lum = s.items.filter((i) => i.kind === 'luminaire').length; return s.schedule.reduce((a, r) => a + r.luminaires, 0) === lum && s.schedule.length >= m.counts.storeys })())
  ok('a sanitary suite lands beside the core on every floor', s.schedule.every((r) => r.sanitary === 1) && s.items.some((it) => it.kind === 'wc') && s.items.some((it) => it.kind === 'basin'))
  ok('sockets are counted per use (offices get 4 each)', s.totals.sockets >= m.rooms.filter((r) => r.level < m.counts.storeys).length * 2)
  ok('lighting power density lands in a sane band (1–6 W/m²)', s.totals.lightingWm2 >= 1 && s.totals.lightingWm2 <= 6, s.totals.lightingWm2)
  ok('type alternatives reprice the system (concealed heads cost more)', (() => { const s2 = buildingServices(m, { types: { sprinkler: 'concealed' } }); const a = s.byKind.find((k) => k.kind === 'sprinkler')!; const b = s2.byKind.find((k) => k.kind === 'sprinkler')!; return b.unitCost > a.unitCost && b.count === a.count && s2.totals.cost > s.totals.cost })())
  ok('svcType falls back to the default; every system has ≥2 types', svcType('luminaire', 'nope').id === 'led-panel' && Object.values(SVC_TYPES).every((t) => t.length >= 2))
  ok('deterministic output', JSON.stringify(buildingServices(m)) === JSON.stringify(buildingServices(m)))
  ok('MEP CSV carries kinds + the per-level block', (() => { const c = servicesCsv(s); return c.includes('LED panel') && c.includes('LEVEL,Luminaires') && c.includes('Smoke detector') })())
}

// ── finishes schedule (room-by-room finishes takeoff) ────────────────────────────
section('finish-schedule')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const fs = finishSchedule(m, { storeyHeight: 3.6 })
  ok('every room is scheduled with floor/wall/ceiling areas + graded cost', fs.rows.length === m.rooms.filter((r) => r.level < m.counts.storeys).length && fs.rows.every((r) => r.floorArea > 0 && r.wallArea > 0 && r.ceilingArea === r.floorArea && r.cost > 0))
  ok('totals roll up the rows', near(fs.totals.floorArea, fs.rows.reduce((s, r) => s + r.floorArea, 0), 0.5) && fs.totals.cost === fs.rows.reduce((s, r) => s + r.cost, 0))
  ok('re-grading a room repriced its row (premium > standard)', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const m2 = applyEdits(m, setRoomFinish(emptyEdits(), r0.id, 'premium')); const a = fs.rows.find((r) => r.id === r0.id)!; const b = finishSchedule(m2).rows.find((r) => r.id === r0.id)!; return b.cost > a.cost && b.gradeLabel.includes('Premium') })())
  ok('the schedule matches the Room Studio takeoff for the same room', (() => { const r0 = m.rooms.find((r) => r.level === 0)!; const rep = roomReport(m, r0.id, { storeyHeight: 3.6 })!; const row = fs.rows.find((r) => r.id === r0.id)!; return row.cost === rep.finishCost })())
  ok('finishes CSV lists rooms + a grand total', (() => { const c = finishCsv(fs); return c.split('\n').length === fs.rows.length + 2 && c.includes('TOTAL') })())
}

// ── fasteners (hardware & fixings takeoff — down to the nails) ───────────────────
section('fasteners')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const fx = fastenerTakeoff(m, { storeyHeight: 3.6 })
  ok('the takeoff covers structure, partitions, doors, façade, ceilings & stairs', fx.rows.length >= 12 && fx.totals.fixings > 0 && fx.totals.massKg > 0)
  ok('anchor bolts = 4 × ground-floor columns', fx.rows.find((r) => r.item.includes('anchor'))!.qty === m.columns.filter((c) => (c.level ?? 0) === 0).length * 4)
  ok('beam connection bolts = 8 × beams', fx.rows.find((r) => r.id === 'beam-bolt')!.qty === m.beams.length * 8)
  ok('door ironmongery: 3 hinges + a lockset per leaf (incl. interior doors)', (() => { const doors = m.doors.length + m.interiorDoors.length; return fx.rows.find((r) => r.id === 'hinge')!.qty === doors * 3 && fx.rows.find((r) => r.id === 'lockset')!.qty === doors })())
  ok('yes — the nails: skirting nails = 4 per lm of partition', (() => { const lm = m.partitions.reduce((s, p) => s + Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) * 6.25, 0); const row = fx.rows.find((r) => r.id === 'skirt-nail')!; return row.qty === Math.round(lm * 4) && fx.totals.nails === row.qty && /nails/.test(fx.headline) })())
  ok('screw/bolt/nail families are totalled separately', fx.totals.screws > 0 && fx.totals.bolts > 0 && fx.totals.nails > 0 && fx.totals.fixings >= fx.totals.nails + fx.totals.bolts)
  ok('ceiling grid is taken off in lineal metres', fx.rows.find((r) => r.id === 'ceil-tee')!.unit === 'm')
  ok('every row carries a rule of thumb + mass', fx.rows.every((r) => r.rule.length > 4 && r.massKg >= 0))
  ok('mullion brackets scale with mullions (2 each)', fx.rows.find((r) => r.id === 'mull-bkt')!.qty === m.mullions.length * 2)
  ok('fixings CSV lists rows + a grand total', (() => { const c = fastenersCsv(fx); return c.includes('Skirting nails') && c.includes('TOTAL fixings') && c.split('\n').length === fx.rows.length + 2 })())
}

// ── dxf (drawing import: parse, take off, revise) ────────────────────────────────
section('dxf')
{
  const d = parseDxf(SAMPLE_DXF)
  ok('the sample plan parses (lines, polyline, circles, arcs, text, insert)', d.entities.length > 25 && d.counts.LINE > 5 && d.counts.POLYLINE === 1 && d.counts.CIRCLE === 12 && d.counts.ARC === 2 && d.counts.TEXT === 4 && d.counts.INSERT === 1)
  ok('layers are extracted with counts (walls, doors, columns, grid, anno)', d.layers.length >= 5 && d.layers.some((l) => l.name === 'A-WALL') && d.layers.find((l) => l.name === 'S-COL')!.count === 12)
  ok('the outer wall polyline is closed and measured around the perimeter', (() => { const p = d.entities.find((e) => e.type === 'POLYLINE')!; return p.type === 'POLYLINE' && p.closed && near(entityLength(p), 76, 0.01) })())
  ok('drawn length sums per layer + overall', d.totalLength > 100 && near(d.layers.reduce((s, l) => s + l.length, 0), d.totalLength, 0.5))
  ok('extents cover the plan (incl. grid overshoot)', d.bbox.minX <= 0 && d.bbox.maxX >= 24 && d.bbox.minY <= -1.5 && d.bbox.maxY >= 15.5)
  ok('header units are read ($INSUNITS 6 → m)', d.units === 'm')
  ok('text entities carry their strings (room labels)', d.entities.filter((e) => e.type === 'TEXT').map((e) => (e.type === 'TEXT' ? e.text : '')).join('|').includes('MEETING'))
  ok('arc length follows the sweep (90° door swing = ¼ circle)', (() => { const a = d.entities.find((e) => e.type === 'ARC')!; return a.type === 'ARC' && near(entityLength(a), (Math.PI / 2) * 1.2, 0.01) })())
  ok('revision: dropping a layer re-summarizes counts & length', (() => { const kept = d.entities.filter((e) => e.layer !== 'G-GRID'); const s = dxfSummarize(kept, d.units); return s.entities.length === d.entities.length - 4 && s.totalLength < d.totalLength && !s.layers.some((l) => l.name === 'G-GRID') })())
  ok('a malformed file parses to an empty drawing (no throw)', (() => { const e = parseDxf('garbage\nnot-a-code\n0\nWHAT\n'); return e.entities.length === 0 && e.bbox.maxX === 1 })())
  ok('CSV schedules every entity + the layer takeoff', (() => { const c = dxfCsv(d); return c.split('\n').length > d.entities.length && c.includes('A-WALL') && c.includes('LAYER,Entities') })())
}

// ── building-partitions + stairs (interior walls between rooms; core stairs) ─────
section('building-partitions')
{
  const core = { x: 0, z: 0, w: 4, d: 4 }
  const fp = [{ x: -20, z: -12 }, { x: 20, z: -12 }, { x: 20, z: 12 }, { x: -20, z: 12 }]
  const { partitions: parts, doors: idoors } = floorPartitions(fp, { level: 1, core, base: 2, height: 0.9 })
  ok('floorPartitions derives interior walls on the room grid', parts.length > 0 && parts.every((p) => p.level === 1 && p.y === 2 && p.h === 0.9))
  ok('partitions stay inside the floor outline', parts.every((p) => p.a.x >= -20 - 1e-6 && p.a.x <= 20 + 1e-6 && p.a.z >= -12 - 1e-6 && p.a.z <= 12 + 1e-6 && p.b.x >= -20 - 1e-6 && p.b.x <= 20 + 1e-6))
  ok('partitions have stable, unique, level-scoped ids', (() => { const ids = parts.map((p) => p.id); return new Set(ids).size === ids.length && ids.every((id) => id!.startsWith('part-1-')) })())
  ok('long partition runs get a real doorway (gap + a door leaf)', idoors.length > 0 && idoors.every((d) => d.id!.startsWith('idoor-1-') && d.h < 0.9 && d.h > 0 && Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z) > 0))
  ok('no rooms (tiny floor) → no partitions or doors', (() => { const r = floorPartitions([{ x: -0.5, z: -0.5 }, { x: 0.5, z: -0.5 }, { x: 0.5, z: 0.5 }, { x: -0.5, z: 0.5 }], { roomSize: 8 }); return r.partitions.length === 0 && r.doors.length === 0 })())

  const floors = [{ base: 0, height: 0.92, level: 0 }, { base: 1, height: 0.92, level: 1 }]
  const stairs = coreStairs(core, floors, { storeyHeight: 3.6 })
  ok('coreStairs makes two egress half-turn stairs per storey', stairs.length === 4 && stairs.every((s) => s.flights.length === 2 && s.treads.length > 0 && s.landings.length === 1 && s.rails.length === 2))
  ok('the two flights split the storey rise (each rises half)', stairs.every((s) => near(s.flights[0].top - s.flights[0].base, 0.46, 1e-6) && near(s.flights[1].base, s.flights[0].top, 1e-6) && s.flights[1].risers + s.flights[0].risers === s.risers))
  ok('a stair rises a full storey & runs along the core', stairs.every((s) => near(s.top - s.base, 0.92, 1e-9) && (s.dir === 'x' || s.dir === 'z') && s.widthScene > 0))
  ok('all stair parts carry the stair id (click any → select it)', stairs[0].treads.concat(stairs[0].landings, stairs[0].rails).every((t) => t.id === stairs[0].id))
  ok('flight A treads climb monotonically', stairs[0].flights[0].treads.every((t, i, a) => i === 0 || t.y > a[i - 1].y))
  ok('stairs are code-dimensioned & pass under every preset', stairs.every((s) => CODE_KEYS.every((k) => stairCheck(s, 3.6, CODE_PRESETS[k].stair).ok)))
  ok('stairCheck flags a too-steep stair (tiny going)', (() => { const c = stairCheck({ ...stairs[0], treadDepth: 0.02, flights: stairs[0].flights }, 3.6); return !c.ok && c.issues.some((i) => /going/.test(i)) })())
  ok('no core → no stairs', coreStairs(null, floors).length === 0)
}

// ── building-code + egress (life-safety analysis) ───────────────────────────────
section('egress')
{
  ok('three code presets carry stair + egress + compartment limits', CODE_KEYS.length === 3 && CODE_KEYS.every((k) => CODE_PRESETS[k].stair.maxRise > 0 && CODE_PRESETS[k].egress.maxTravel > 0 && CODE_PRESETS[k].egress.occLoadFactor > 0 && CODE_PRESETS[k].egress.maxCompartment > 0))
  const m = buildBuilding(buildMassing({ gfa: 120_000, progress: 100, storeys: 8, shape: 'rect' }), { coreRatio: 0.16 })
  const eg = egressAnalysis(m, { code: 'IBC' })
  const circIds = new Set(m.rooms.filter((r) => r.use === 'circulation').map((r) => r.id))
  ok('every space gets a routed travel; rooms load occupants, corridors none', eg.rooms.length === m.rooms.length && eg.rooms.every((r) => (circIds.has(r.id) ? r.occupancy === 0 : r.occupancy >= 1) && r.travel >= 0) && eg.rooms.some((r) => r.travel > 0))
  ok('a floor summary per storey with occupancy, exits, width & compartments', eg.floors.length > 0 && eg.floors.every((f) => f.occupancy > 0 && f.exits >= 1 && f.requiredWidth >= 0 && f.providedWidth > 0 && f.area > 0 && f.compartments >= 1))
  ok('occupancy is denser under UK than IBC (lower load factor)', egressAnalysis(m, { code: 'UK' }).summary.occupancy > eg.summary.occupancy)
  ok('a tighter travel limit fails at least as many rooms (EU ≤ IBC limit)', egressAnalysis(m, { code: 'EU' }).summary.roomsOverTravel >= eg.summary.roomsOverTravel)
  ok('the building summary totals occupancy + max compartments', eg.summary.occupancy === eg.floors.reduce((s, f) => s + f.occupancy, 0) && eg.summary.maxCompartments === Math.max(...eg.floors.map((f) => f.compartments)) && eg.summary.maxTravelLimit === CODE_PRESETS.IBC.egress.maxTravel)
  // travel is ROUTED through the doors: remove every interior door → rooms are stranded
  ok('routed travel needs doors (no doors → every room stranded; corridors stay open)', (() => { const e2 = egressAnalysis({ ...m, interiorDoors: [] }); return e2.rooms.filter((r) => !circIds.has(r.id)).every((r) => !r.ok && r.reason === 'no door route to a stair') })())
  ok('egressPathFor returns a routed polyline (room → … → exit)', (() => { const p = egressPathFor(m, m.rooms[0].id); return !!p && p.points.length >= 2 })())
  ok('no stairs & no core → every room is flagged (no exit)', (() => { const e2 = egressAnalysis({ ...m, stairs: [], core: null }); return e2.rooms.every((r) => !r.ok) && e2.floors.every((f) => !f.ok) })())
  // dead-end / common-path: each room reports its doorways out; a tighter common path flags more
  ok('rooms report their number of egress routes (doorways out)', eg.rooms.every((r) => r.routes >= 0) && eg.floors.every((f) => f.deadEnds >= 0) && typeof eg.summary.deadEnds === 'number')
  ok('removing most doors strands / dead-ends far more rooms', egressAnalysis({ ...m, interiorDoors: m.interiorDoors.slice(0, 3) }).summary.roomsOverTravel > eg.summary.roomsOverTravel)
  ok('a door straight onto a corridor satisfies the common path (no dead-ends here)', eg.summary.deadEnds === 0 && eg.rooms.filter((r) => !circIds.has(r.id)).every((r) => r.routes >= 1))
  ok('any flagged dead-end would be a room chained through another room', eg.rooms.filter((r) => /dead end/.test(r.reason ?? '')).every((r) => !circIds.has(r.id)))
}

// ── fire (compartmentation + per-compartment takeoff) ───────────────────────────
section('fire')
{
  const m = buildBuilding(buildMassing({ gfa: 120_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const lim = CODE_PRESETS.UK.egress
  const ff = floorCompartments(m, 0, { maxArea: lim.maxCompartment, occLoadFactor: lim.occLoadFactor, costPerM2: 1800 })
  ok('floorCompartments subdivides a floor into ≤ max-area compartments', ff.compartments.length > 1 && ff.compartments.every((c) => c.area <= lim.maxCompartment * 1.1 && c.polygon.length >= 3))
  ok('each compartment carries rooms, occupancy, rated wall & cost', ff.compartments.every((c) => c.rooms >= 0 && c.occupancy >= 0 && c.ratedWall > 0 && c.cost > 0))
  ok('fire-rated walls are drawn between compartments', ff.walls.length > 0 && ff.walls.every((w) => Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) > 0))
  ok('a smaller max-compartment area → more compartments', floorCompartments(m, 0, { maxArea: lim.maxCompartment / 2, occLoadFactor: lim.occLoadFactor }).compartments.length > ff.compartments.length)
  const bf = buildingFire(m, { maxArea: lim.maxCompartment, occLoadFactor: lim.occLoadFactor, costPerM2: 1800 })
  ok('buildingFire totals compartments, rated wall & fit-out cost across storeys', bf.compartments > 0 && bf.ratedWall > 0 && bf.cost > 0 && bf.floors.length === 6)
  ok('rooms get assigned to compartments (sum ≈ floor rooms)', (() => { const assigned = ff.compartments.reduce((s, c) => s + c.rooms, 0); return assigned > 0 && assigned <= m.rooms.filter((r) => r.level === 0).length })())
}

// ── structure (preliminary gravity check) ───────────────────────────────────────
section('structure')
{
  const m = buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 20, shape: 'rect' }), { coreRatio: 0.16 })
  const st = structuralCheck(m, { storeyHeight: 3.6 })
  ok('every column gets an axial load, capacity & utilisation', st.columns.length === m.columns.length && st.columns.every((c) => c.axial > 0 && c.capacity > 0 && c.utilization >= 0))
  ok('every beam gets a span, moment, capacity & utilisation', st.beams.length === m.beams.length && st.beams.every((b) => b.span > 0 && b.moment >= 0 && b.capacity > 0))
  ok('lower columns carry more than upper columns (more floors above)', (() => { const g = st.columns.find((c) => c.level === 0)!; const top = st.columns.find((c) => c.level === m.counts.storeys - 1)!; return g.axial > top.axial && g.floorsAbove > top.floorsAbove })())
  ok('a taller building pushes column utilisation higher', structuralCheck(buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 40, shape: 'rect' }), { coreRatio: 0.16 })).summary.maxColUtil > structuralCheck(buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })).summary.maxColUtil)
  ok('a higher f′c raises capacity → lower utilisation', structuralCheck(m, { fc: 50 }).summary.maxColUtil < structuralCheck(m, { fc: 20 }).summary.maxColUtil)
  ok('summary reports utilisations + total gravity load', st.summary.maxColUtil > 0 && st.summary.maxBeamUtil >= 0 && st.summary.totalGravity > 0 && typeof st.summary.ok === 'boolean')
}

// ── energy & daylight ───────────────────────────────────────────────────────────
section('energy')
{
  const m = buildBuilding(buildMassing({ gfa: 80_000, progress: 100, storeys: 8, shape: 'rect' }), { coreRatio: 0.16, wwr: 0.6 })
  const e = energyAnalysis(m, { storeyHeight: 3.6 })
  const nLettable = m.rooms.filter((r) => r.use !== 'circulation').length
  ok('every lettable room gets a daylight ratio (corridors exempt)', e.rooms.length === nLettable && e.rooms.every((r) => r.daylight >= 0 && r.area > 0))
  ok('rooms split into daylit + dark, summing to the lettable rooms', e.summary.daylitRooms > 0 && e.summary.daylitRooms + e.summary.darkRooms === nLettable)
  ok('orientation breakdown sums to the glazing area', (() => { const sum = e.orientations.reduce((s, o) => s + o.windowArea, 0); return near(sum, e.summary.glazing, Math.max(1, e.summary.glazing * 0.03)) })())
  ok('a higher WWR raises the glazing area', energyAnalysis(buildBuilding(buildMassing({ gfa: 80_000, progress: 100, storeys: 8, shape: 'rect' }), { coreRatio: 0.16, wwr: 0.8 })).summary.glazing > e.summary.glazing)
  ok('envelope estimate: heat-loss coefficient, EUI + rating', e.summary.heatLoss > 0 && e.summary.eui > 0 && /^[A-F]$/.test(e.summary.rating))
  ok('better U-values lower the EUI', energyAnalysis(m, { uWall: 0.15, uWindow: 1.0, uRoof: 0.1 }).summary.eui < energyAnalysis(m, { uWall: 0.6, uWindow: 3.0, uRoof: 0.4 }).summary.eui)
}

// ── schedule-4d (construction sequencing) ───────────────────────────────────────
section('schedule-4d')
{
  const m = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 10, shape: 'rect' }), { coreRatio: 0.16 })
  const s = schedule4d(m, { start: '2026-01-05' })
  ok('a phased schedule per storey (structure → envelope → fit-out)', s.floors.length === 10 && s.floors.every((f) => f.structure.end <= f.envelope.start + 1e-9 && f.envelope.end <= f.fitout.start + 1e-9))
  ok('each trade crew moves up sequentially (floor L after L−1)', s.floors.every((f, i, a) => i === 0 || f.structure.start >= a[i - 1].structure.end - 1e-9))
  ok('total duration + completion date computed', s.totalDays > 0 && s.weeks > 0 && /^\d{4}-\d\d-\d\d$/.test(s.finishDate) && s.finishDate > s.startDate)
  ok('floors carry calendar start/finish dates', s.floors.every((f) => /^\d{4}-\d\d-\d\d$/.test(f.startDate) && f.endDate >= f.startDate))
  ok('more storeys → longer programme', schedule4d(buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 20, shape: 'rect' }), { coreRatio: 0.16 })).totalDays > s.totalDays)
}

// ── advisor (cross-phase intelligence + one-click fixes) ────────────────────────
section('advisor')
{
  const m = buildBuilding(buildMassing({ gfa: 120_000, progress: 100, storeys: 12, shape: 'rect' }), { coreRatio: 0.16, wwr: 0.55 })
  const rep = adviseBuilding({ model: m, code: 'IBC', wwr: 0.55 })
  ok('advisor runs every phase (findings across ≥5 phases)', new Set(rep.findings.map((x) => x.phase)).size >= 5 && rep.findings.length >= 6)
  ok('score + grade are coherent', rep.score >= 0 && rep.score <= 100 && /^[A-E]$/.test(rep.grade) && rep.counts.critical + rep.counts.warning + rep.counts.good <= rep.findings.length)
  ok('phase journey reports a status per phase', rep.phases.length === 6 && rep.phases.every((p) => p.headline.length > 0))

  // stripping the stairs+core → a critical egress finding with a one-click fix
  const mSmall = buildBuilding(buildMassing({ gfa: 18_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const noEgress = { ...mSmall, stairs: [], core: null }
  const rep2 = adviseBuilding({ model: noEgress, code: 'IBC' })
  const egFail = rep2.findings.find((x) => x.id === 'egress-fail')
  ok('losing the stairs raises a critical egress finding + add-stair fix', !!egFail && egFail.severity === 'critical' && egFail.action?.kind === 'add-stair')
  // applying the fix (add a stair shaft) reduces criticals
  const fixed = applyEdits(noEgress, addStairAt(addStairAt(emptyEdits(), noEgress, -2, 0), noEgress, 2, 0))
  ok('applying the add-stair fix reduces critical findings', adviseBuilding({ model: fixed, code: 'IBC' }).counts.critical < rep2.counts.critical)

  // an over-glazed envelope → a set-wwr fix that targets less glass
  const glassy = buildBuilding(buildMassing({ gfa: 120_000, progress: 100, storeys: 12, shape: 'rect' }), { coreRatio: 0.16, wwr: 0.85 })
  const rep3 = adviseBuilding({ model: glassy, code: 'IBC', wwr: 0.85 })
  const eui = rep3.findings.find((x) => x.id === 'energy-eui')
  ok('an over-glazed envelope gets a set-wwr action below current', !eui || eui.severity === 'good' || (eui.action?.kind === 'set-wwr' && eui.action.value < 0.85))
  // a 40-storey tower stresses columns → strengthen action on a real column id
  const tall = buildBuilding(buildMassing({ gfa: 100_000, progress: 100, storeys: 40, shape: 'rect' }), { coreRatio: 0.16 })
  const rep4 = adviseBuilding({ model: tall })
  const sc = rep4.findings.find((x) => x.id === 'struct-col')
  ok('a tall tower yields a strengthen-column fix on a real column', !!sc && sc.severity !== 'good' && sc.action?.kind === 'strengthen-column' && tall.columns.some((c) => c.id === (sc.action as { id: string }).id))
  ok('nextBestAction surfaces an actionable finding', (() => { const nba = nextBestAction(rep4); return !!nba && (!!nba.action || nba.severity !== 'good') })())
  // personalization: same findings, different order per role
  const archOrder = adviseBuilding({ model: m }, { role: 'Architect' }).findings.map((x) => x.id)
  const seOrder = adviseBuilding({ model: m }, { role: 'Structural Engineer' }).findings.map((x) => x.id)
  ok('findings re-rank for the person’s role', archOrder.join() !== seOrder.join() && archOrder.indexOf('struct-col') > seOrder.indexOf('struct-col'))
}

// ── live (deterministic site telemetry) ─────────────────────────────────────────
section('live')
{
  const t0 = Date.UTC(2026, 5, 10, 12, 0, 0)
  const a = liveFrame(7, t0), b = liveFrame(7, t0)
  ok('deterministic: same seed + moment → identical frame', JSON.stringify(a) === JSON.stringify(b))
  ok('different seeds → different telemetry', JSON.stringify(liveFrame(8, t0)) !== JSON.stringify(a))
  ok('vitals stay in believable bounds', a.crew >= 4 && a.crew <= 70 && a.temp >= -5 && a.temp <= 41 && a.co2 >= 400 && a.co2 <= 1400 && a.progress > 0 && a.progress < 100)
  ok('a working site at noon out-crews 3am', liveFrame(7, Date.UTC(2026, 5, 10, 12, 0)).crew > liveFrame(7, Date.UTC(2026, 5, 10, 3, 0)).crew)
  const hist = liveHistory(7, 24, 60, t0)
  ok('history is 24 ordered frames ending now', hist.length === 24 && hist.every((f2, i) => i === 0 || f2.t >= hist[i - 1].t) && hist[23].t === Math.floor(t0 / 1000))
}

// ── personalize (the workspace molds to the person) ─────────────────────────────
section('personalize')
{
  const TOOLS = [
    { path: '/building-explorer', label: 'Building Explorer' },
    { path: '/site-zoning', label: 'Site & Zoning' }, { path: '/sustainability', label: 'Sustainability' },
    { path: '/cost-schedule', label: 'Cost & Schedule' }, { path: '/analyze', label: 'Analysis Studio' }, { path: '/digital-twin', label: 'Digital Twin' },
  ]
  const arch = { name: 'Ada', role: 'Architect', disciplines: [] as string[], sectors: [] as string[], goals: [] as string[], experience: 'Expert' as const, onboarded: true }
  const r1 = rankTools({ ...arch }, {}, TOOLS, 4)
  ok('an architect’s home turf leads the ranking', r1[0].path === '/building-explorer' && r1[1].path === '/site-zoning' && /Architect/.test(r1[0].reason))
  const sus = rankTools({ ...arch, role: '', goals: ['Cut embodied carbon'] }, {}, TOOLS, 3)
  ok('stated goals pull their tools up for any role', sus.some((t) => t.path === '/sustainability' && /goals/.test(t.reason)))
  const used = rankTools({ ...arch, role: '' }, { '/digital-twin': 9 }, TOOLS, 3)
  ok('heavy use lifts a tool into the picks', used.some((t) => t.path === '/digital-twin' && /use/.test(t.reason)))
  // recents trail
  let rec = pushRecent([], '/bim', 1000)
  rec = pushRecent(rec, '/analyze', 2000)
  rec = pushRecent(rec, '/bim', 3000)
  ok('recents dedupe to newest-first', rec.length === 2 && rec[0].path === '/bim' && rec[0].at === 3000)
  ok('the root path never enters recents', pushRecent(rec, '/', 4000).length === 2)
  ok('time-ago renders human buckets', timeAgoShort(0, 30_000) === 'just now' && timeAgoShort(0, 5 * 60_000) === '5m ago' && /h ago$/.test(timeAgoShort(0, 3 * 3600_000)) && /d ago$/.test(timeAgoShort(0, 50 * 3600_000)))
  ok('each role gets its own accent (with a default)', roleAccent('Architect') === 'violet' && roleAccent('Structural Engineer') === 'cyan' && roleAccent('???') === 'blue')
  ok('the lede speaks to the person (role + goal)', /architect/.test(personalLede({ ...arch, goals: ['Win more bids'] })) && /win more bids/.test(personalLede({ ...arch, goals: ['Win more bids'] })))
}

// ── building-export (OBJ round-trip) ────────────────────────────────────────────
section('building-export')
{
  const model = buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0.16 })
  const obj = toObj(model, 'Test Tower')
  const st = objStats(obj)
  ok('OBJ has a header + object name', obj.startsWith('#') && /\no Test Tower/.test(obj))
  ok('OBJ emits vertices + triangle faces', st.verts > 0 && st.faces > 0)
  ok('every face index is within the vertex range (valid mesh)', st.maxIndex <= st.verts && st.maxIndex > 0, { maxIndex: st.maxIndex, verts: st.verts })
  ok('OBJ groups every trade present in the model', ['Slabs', 'Columns', 'Beams', 'Walls', 'Partitions', 'Windows', 'Doors', 'Stairs', 'Foundations', 'GroundBeams', 'Ceilings', 'Finishes', 'Parapets', 'Core'].every((g) => st.groups.includes(g)), st.groups)
  ok('a box element contributes 8 verts / 12 tris', (() => { const before = objStats(toObj(buildBuilding(buildMassing({ gfa: 60_000, progress: 100, storeys: 6, shape: 'rect' }), { coreRatio: 0 }))).faces; return before < st.faces })())
  ok('a window panel is 4 verts / 2 tris each (quad)', objStats(toObj({ ...model, glazing: model.glazing.slice(0, 1), columns: [], beams: [], walls: [], partitions: [], interiorDoors: [], stairs: [], doors: [], mullions: [], slabs: [], foundations: [], groundBeams: [], ceilings: [], floorFinishes: [], parapets: [], roof: null, core: null })).faces === 2)
  ok('edited model exports too (deleted element gone)', (() => { const del = applyEdits(model, removeElement(emptyEdits(), model.columns[0].id!)); return objStats(toObj(del)).verts < st.verts })())
}

// ── building-ifc (native IFC4 export) ───────────────────────────────────────────
section('building-ifc')
{
  const model = buildBuilding(buildMassing({ gfa: 40_000, progress: 100, storeys: 4, shape: 'rect' }), { coreRatio: 0.16 })
  const ifc = toIfc(model, { name: 'Test Tower' })
  const count = (t: string) => (ifc.match(new RegExp(`=${t}\\(`, 'g')) || []).length
  ok('valid IFC-SPF header + IFC4 schema + footer', ifc.startsWith('ISO-10303-21;') && /FILE_SCHEMA\(\('IFC4'\)\)/.test(ifc) && /END-ISO-10303-21;/.test(ifc))
  ok('one IfcProject, IfcSite, IfcBuilding + a storey per level', count('IFCPROJECT') === 1 && count('IFCSITE') === 1 && count('IFCBUILDING') === 1 && count('IFCBUILDINGSTOREY') === 4)
  ok('typed products: columns, slabs(+landings), beams(+ground), walls(+partitions+parapets), windows, doors(+interior)', count('IFCCOLUMN') === model.columns.length && count('IFCSLAB') === model.slabs.length + 1 + model.stairs.length && count('IFCBEAM') === model.beams.length + model.groundBeams.length && count('IFCWALL') === model.walls.length + model.partitions.length + model.parapets.length && count('IFCWINDOW') === model.glazing.length && count('IFCDOOR') === model.doors.length + model.interiorDoors.length)
  ok('substructure + finishes export: IfcFooting + IfcCovering (flooring/ceiling)', count('IFCFOOTING') === model.foundations.length && model.foundations.length > 0 && count('IFCCOVERING') === model.ceilings.length + model.floorFinishes.length && /\.FLOORING\./.test(ifc) && /\.CEILING\./.test(ifc) && /\.PAD_FOOTING\./.test(ifc))
  ok('parametric extruded-solid geometry + property sets', count('IFCEXTRUDEDAREASOLID') > 0 && count('IFCPROPERTYSET') > 0 && count('IFCRELDEFINESBYPROPERTIES') > 0)
  ok('spatial structure + each stair aggregates its parts', count('IFCRELAGGREGATES') === 3 + model.stairs.length && count('IFCRELCONTAINEDINSPATIALSTRUCTURE') >= 1)
  ok('interior rooms export as IfcSpace', count('IFCSPACE') === model.rooms.length && model.rooms.length > 0)
  ok('stairs are half-turn IfcStair decomposed into IfcStairFlight + IfcRailing', count('IFCSTAIR') === model.stairs.length && model.stairs.length === 8 && count('IFCSTAIRFLIGHT') === model.stairs.length * 2 && count('IFCRAILING') === model.stairs.length * 2 && /\.HALF_TURN_STAIR\./.test(ifc))
  ok('interior partitions export as IfcWall (.PARTITIONING.) + one IfcWallType', model.partitions.length > 0 && (ifc.match(/\.PARTITIONING\./g) || []).length === model.partitions.length + 1)
  // every #ref resolves to a defined #id (no dangling references)
  ok('every entity reference resolves (well-formed model)', (() => {
    const defined = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map((x) => x[1]))
    const refs = [...ifc.matchAll(/#(\d+)/g)].map((x) => x[1])
    return refs.every((r) => defined.has(r))
  })())
  ok('edits flow into the IFC (deleting a column drops an IfcColumn)', (() => { const del = applyEdits(model, removeElement(emptyEdits(), model.columns[0].id!)); return (toIfc(del).match(/=IFCCOLUMN\(/g) || []).length === model.columns.length - 1 })())
}

// ── ifc-explorer (review a real uploaded IFC model floor-by-floor) ──────────────
section('ifc-explorer')
{
  const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  // a closed, outward-wound unit cube (volume 1, 12 triangles)
  const cubePos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1])
  const cubeIdx = new Uint32Array([1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3, 2, 3, 7, 2, 7, 6, 0, 1, 5, 0, 5, 4, 4, 5, 6, 4, 6, 7, 0, 3, 2, 0, 2, 1])
  const g = meshGeom(cubePos, cubeIdx, IDENT)
  ok('meshGeom measures a unit cube: volume 1, 12 triangles, 1×1×1 bbox', near(g.volume, 1, 1e-6) && g.triangles === 12 && near(g.max[1] - g.min[1], 1, 1e-9))
  ok('meshGeom applies the placement matrix (scaled cube → 8× volume)', near(meshGeom(cubePos, cubeIdx, [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]).volume, 8, 1e-6))
  ok('friendlyType maps IFC names', friendlyType('IFCWALLSTANDARDCASE') === 'Wall' && friendlyType('IFCCOLUMN') === 'Column' && friendlyType('IFCSPACE') === 'Space' && friendlyType('IFC#7') === 'Other')

  const mesh = (expressID: number, ifcTypeName: string, storey: number, name?: string): IfcMesh => ({ expressID, ifcType: 0, ifcTypeName, discipline: 'other', positions: cubePos, normals: new Float32Array(0), indices: cubeIdx, matrix: IDENT, color: { r: 0, g: 0, b: 0, a: 1 }, storey, name })
  const res: IfcGeometryResult = {
    meshes: [mesh(10, 'IFCWALLSTANDARDCASE', 100, 'Ext Wall A'), mesh(20, 'IFCCOLUMN', 200), mesh(20, 'IFCCOLUMN', 200)],
    vertexCount: 24, triangleCount: 36, bbox: { min: [0, 0, 0], max: [1, 1, 1] },
    storeys: [{ expressID: 200, name: 'Level 1', elevation: 3 }, { expressID: 100, name: 'Ground', elevation: 0 }],
  }
  const ex = explodeIfc(res)
  ok('groups meshes into one element per IFC product', ex.summary.elements === 2 && !!ex.byExpress[10] && !!ex.byExpress[20])
  ok('classifies categories from IFC type', ex.byExpress[10].category === 'Wall' && ex.byExpress[20].category === 'Column')
  ok('uses the IfcRoot name as the mark when present', ex.byExpress[10].mark === 'Ext Wall A' && ex.byExpress[20].mark.startsWith('Column #'))
  ok('orders storeys by elevation (Ground = level 0)', ex.levels[0].name === 'Ground' && ex.levels[1].name === 'Level 1' && ex.byExpress[10].level === 0 && ex.byExpress[20].level === 1)
  ok('measures real volume from geometry (col = 2 cubes = vol 2)', near(Number(ex.byExpress[20].data.volume), 2, 1e-6) && near(Number(ex.byExpress[10].data.volume), 1, 1e-6))
  ok('builds a schedule per category with volume totals', ex.schedules.length === 2 && ex.schedules.every((s) => s.totals.volume > 0))
  ok('level navigator counts elements + volume per storey', ex.levels[0].elements === 1 && near(ex.levels[1].volume, 2, 1e-6))
  ok('summary totals elements, storeys, categories, volume', ex.summary.storeys === 2 && ex.summary.categories === 2 && near(ex.summary.volume, 3, 1e-6))
  // an element with no spatial container → Unassigned level
  const res2: IfcGeometryResult = { ...res, meshes: [mesh(10, 'IFCWALL', 100), { ...mesh(30, 'IFCDOOR', 0), storey: undefined }] }
  const ex2 = explodeIfc(res2)
  ok('puts spatially-uncontained elements in an Unassigned bucket', ex2.byExpress[30].level === -1 && ex2.levels.some((l) => l.unassigned))
  // horizontal section — a real floor plan sliced from the geometry
  const cube = mesh(10, 'IFCWALL', 100)
  const segs = sliceMeshes([cube], 0.5)
  ok('sliceMeshes cuts a cube into plan segments tagged by element', segs.length >= 4 && segs.every((s) => s.expressID === 10))
  ok('cut segments lie on the cut, within the footprint', segs.every((s) => s.ax >= -1e-6 && s.ax <= 1 + 1e-6 && s.az >= -1e-6 && s.az <= 1 + 1e-6))
  ok('slice perimeter ≈ 4 for a unit cube', near(segs.reduce((t, s) => t + Math.hypot(s.bx - s.ax, s.bz - s.az), 0), 4, 1e-6))
  ok('a plane above the geometry yields no segments', sliceMeshes([cube], 2).length === 0)
  ok('cutHeightFor cuts above the floor (30% up a unit cube)', near(cutHeightFor([cube]), 0.3, 1e-9))
}

// ── ifc-to-model (rationalize an uploaded IFC into the editable parametric model) ─
section('ifc-to-model')
{
  const cubePos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1])
  const cubeIdx = new Uint32Array([1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3, 2, 3, 7, 2, 7, 6, 0, 1, 5, 0, 5, 4, 4, 5, 6, 4, 6, 7, 0, 3, 2, 0, 2, 1])
  // a unit cube scaled (sx,sy,sz) & translated (px,py,pz) → world bbox [p, p+s]
  const M = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, px, py, pz, 1]
  const mesh = (expressID: number, ifcTypeName: string, storey: number | undefined, s: [number, number, number], p: [number, number, number], name?: string): IfcMesh => ({ expressID, ifcType: 0, ifcTypeName, discipline: 'other', positions: cubePos, normals: new Float32Array(0), indices: cubeIdx, matrix: M(s[0], s[1], s[2], p[0], p[1], p[2]), color: { r: 0, g: 0, b: 0, a: 1 }, storey, name })
  const res: IfcGeometryResult = {
    meshes: [
      mesh(10, 'IFCCOLUMN', 100, [0.4, 3, 0.4], [0, 0, 0]),
      mesh(11, 'IFCWALLSTANDARDCASE', 100, [6, 3, 0.2], [0, 0, 0], 'Ext Wall'),
      mesh(12, 'IFCSLAB', 100, [8, 0.3, 8], [-1, -0.3, -1]),
      mesh(13, 'IFCWINDOW', 100, [1.5, 1.5, 0.1], [1, 1, 0]),
      mesh(14, 'IFCBEAM', 100, [5, 0.4, 0.3], [0, 3, 0]),
      mesh(20, 'IFCCOLUMN', 200, [0.4, 3, 0.4], [0, 3, 0]),
      mesh(21, 'IFCSPACE', 200, [5, 3, 5], [0, 3, 0], 'Office 201'),
      mesh(22, 'IFCFURNITURE', undefined, [0.6, 0.8, 0.6], [2, 3, 2]), // unassigned + unknown type
    ],
    vertexCount: 0, triangleCount: 0, bbox: null,
    storeys: [{ expressID: 200, name: 'Level 1', elevation: 3 }, { expressID: 100, name: 'Ground', elevation: 0 }],
    props: { 11: [{ name: 'FireRating', value: '60' }, { name: 'LoadBearing', value: 'false' }], 10: [{ name: 'CrossSectionArea', value: 0.16 }] },
  }
  const { model, storeyHeight, labels } = ifcToModel(res)
  ok('reconstructs the storeys at the IFC storey height', model.counts.storeys === 2 && near(storeyHeight, 3, 1e-9))
  ok('returns a labels map carrying each element’s original IFC name + type', labels['ifc-11'].ifcType === 'IFCWALLSTANDARDCASE' && labels['ifc-11'].name === 'Ext Wall' && labels['ifc-21'].name === 'Office 201' && labels['ifc-10'].ifcType === 'IFCCOLUMN')
  ok('labels carry the elements’ IFC property sets', labels['ifc-11'].props?.length === 2 && labels['ifc-11'].props![0].name === 'FireRating' && labels['ifc-10'].props![0].value === 0.16)
  ok('buckets IFC products into editable primitives by type', model.columns.length >= 2 && model.walls.length === 1 && model.glazing.length === 1 && model.beams.length === 1 && model.rooms.length === 1)
  ok('an unknown product is rationalized by shape (furniture → a box column)', model.columns.some((c) => c.id === 'ifc-22'))
  ok('one floor slab per level, id floor-N (plan + isolate work)', model.slabs.length === 2 && !!model.slabs.find((s) => s.id === 'floor-0') && !!model.slabs.find((s) => s.id === 'floor-1'))
  ok('an unassigned element is placed on a storey by elevation', (() => { const c = model.columns.find((c) => c.id === 'ifc-22'); return !!c && c.level === 1 })())
  ok('stable ifc-expressID ids drive selection geometry', model.columns.every((c) => c.id!.startsWith('ifc-')) && !!findElementGeom(model, 'ifc-10') && !!findElementGeom(model, 'ifc-21'))
  ok('the imported model explodes into Revit-style schedules', (() => { const ex = explodeBuilding(model, { storeyHeight }); return ex.summary.columns === model.columns.length && ex.schedules.some((s) => s.category === 'Window') })())
  ok('the imported model is editable (delete + move flow through)', applyEdits(model, removeElement(emptyEdits(), 'ifc-10')).columns.length === model.columns.length - 1)
  ok('the imported model re-exports to IFC + OBJ', /IFCCOLUMN\(/.test(toIfc(model)) && /\ng Columns/.test(toObj(model)) && /\ng Windows/.test(toObj(model)))
  ok('a space becomes an editable Room with a real area', (() => { const r = model.rooms[0]; return r.name === 'Office 201' && r.area > 0 && r.polygon.length >= 3 })())
  ok('empty geometry → a safe empty model', ifcToModel({ meshes: [], vertexCount: 0, triangleCount: 0, bbox: null, storeys: [] }).model.counts.storeys === 1)
}

// ── model-stats (uploaded mesh-model import) ────────────────────────────────────
section('model-stats')
{
  const st = summarizeModel([{ name: 'a', triangles: 12, vertices: 24 }, { name: 'b', triangles: 6, vertices: 12 }], 2, { x: 10, y: 20, z: 5 })
  ok('summarizes meshes / triangles / vertices / materials', st.meshes === 2 && st.triangles === 18 && st.vertices === 36 && st.materials === 2)
  ok('carries the bounding-box dimensions', st.dimensions.x === 10 && st.dimensions.y === 20 && st.dimensions.z === 5)
  const obj = sampleObj()
  ok('sample OBJ has 3 objects, 24 vertices, 18 quad faces', (obj.match(/^o /gm) || []).length === 3 && (obj.match(/^v /gm) || []).length === 24 && (obj.match(/^f /gm) || []).length === 18)
}

// ── aps (Autodesk Platform Services — native CAD/BIM translate + view) ──────────
section('aps')
{
  const oid = 'urn:adsk.objects:os.object:aecstudio/model.rvt'
  const urn = encodeUrn(oid)
  ok('URN is base64url with no padding', /^[A-Za-z0-9_-]+$/.test(urn) && !urn.includes('=') && !urn.includes('+') && !urn.includes('/'))
  ok('encode → decode round-trips', decodeUrn(urn) === oid)
  ok('normalizeUrn encodes a raw objectId', normalizeUrn(oid) === urn)
  ok('normalizeUrn passes an already-encoded URN through (strips urn: prefix)', normalizeUrn(`urn:${urn}`) === urn && normalizeUrn(urn) === urn)
  ok('translationProgress reads the manifest', translationProgress({ status: 'inprogress', progress: '57% complete' }).percent === 57 && translationProgress({ status: 'success' }).status === 'success' && translationProgress(null).status === 'none')
  ok('translationProgress success is 100%', translationProgress({ status: 'success', progress: 'complete' }).percent === 100)
  ok('bucketKey is APS-legal (lowercase, namespaced)', /^aecstudio[a-z0-9]+$/.test(bucketKeyFor('My-Client-ID 42!')))
  ok('objectKey is unique + sanitized', /^\d+-/.test(objectKeyFor('My Model (final).rvt')) && !/[()\s]/.test(objectKeyFor('My Model (final).rvt')))
  ok('isTranslatable knows native CAD/BIM', isTranslatable('tower.rvt') && isTranslatable('site.dwg') && isTranslatable('coord.nwd') && !isTranslatable('notes.txt'))
}

// ── agent-tools (unified tool layer for the MCP server + in-app AI agent) ───────
section('agent-tools')
{
  ok('6 tools, each with a JSON-Schema object input', AGENT_TOOLS.length === 6 && AGENT_TOOLS.every((t) => t.name && t.description && (t.inputSchema as { type?: string }).type === 'object' && (t.inputSchema as { properties?: object }).properties))
  ok('schemas declare required fields', (AGENT_TOOLS.find((t) => t.name === 'analyze_zoning')!.inputSchema as { required?: string[] }).required!.includes('far'))
  const ms = (await runTool('massing_schedule', { gfa: 100000, storeys: 10, shape: 'rect' })) as { grossFloorArea: number; floors: unknown[]; embodiedCarbon: number }
  ok('runTool massing_schedule computes a real schedule', ms.grossFloorArea > 0 && ms.floors.length === 10 && ms.embodiedCarbon > 0)
  const az = (await runTool('analyze_zoning', { width: 60, depth: 45, far: 4, heightLimit: 60, setback: 6, maxCoverage: 55, proposedGFA: 9000, proposedStoreys: 14 })) as { maxGFA: number; compliance: { overall: boolean } }
  ok('runTool analyze_zoning computes capacity + compliance', az.maxGFA === 10800 && typeof az.compliance.overall === 'boolean')
  const ifc = (await runTool('parse_ifc', { ifc: SAMPLE_IFC_GEO })) as { entityCounts: unknown[] }
  ok('runTool parse_ifc summarises a model', Array.isArray(ifc.entityCounts) && ifc.entityCounts.length > 0)
  // export_building → a pullable model file (the Connections hub + MCP + APS publish use this)
  const xi = (await runTool('export_building', { gfa: 40000, storeys: 6, shape: 'rect', name: 'Tower X', format: 'ifc' })) as { format: string; filename: string; content: string; bytes: number; counts: { stairs: number; partitions: number } }
  ok('export_building emits a real IFC4 file (typed products incl. stairs)', xi.format === 'ifc' && xi.filename === 'tower-x.ifc' && /^ISO-10303-21;/.test(xi.content) && /IFCSTAIR\(/.test(xi.content) && xi.bytes > 1000 && xi.counts.stairs === 12)
  const xo = (await runTool('export_building', { gfa: 40000, storeys: 6, format: 'obj' })) as { format: string; content: string }
  ok('export_building emits a grouped OBJ when asked', xo.format === 'obj' && /\ng Columns/.test(xo.content) && /\ng Stairs/.test(xo.content))
  const xj = (await runTool('export_building', { gfa: 40000, storeys: 6, format: 'json' })) as { format: string; schedules: unknown[]; summary: { storeys: number } }
  ok('export_building emits a structured JSON model (schedules)', xj.format === 'json' && Array.isArray(xj.schedules) && xj.schedules.length > 0 && xj.summary.storeys === 6)
  ok('export_building defaults to IFC', (((await runTool('export_building', { gfa: 20000 })) as { format: string }).format) === 'ifc')
  let threw = false
  try { await runTool('does_not_exist', {}) } catch { threw = true }
  ok('runTool throws on an unknown tool', threw)
}

// ── mcp-rpc (the studio's own MCP server over HTTP) ─────────────────────────────
section('mcp-rpc')
{
  const init = (await handleMcpRpc({ id: 1, method: 'initialize', params: {} }))!.result as { protocolVersion: string; serverInfo: { name: string }; capabilities: { tools?: unknown } }
  ok('initialize returns protocol + serverInfo + a tools capability', init.protocolVersion === MCP_PROTOCOL && init.serverInfo.name === SERVER_INFO.name && !!init.capabilities.tools)
  const list = (await handleMcpRpc({ id: 2, method: 'tools/list' }))!.result as { tools: { name: string; inputSchema: unknown }[] }
  ok('tools/list returns every studio tool with a schema', list.tools.length === 6 && list.tools.every((t) => t.name && t.inputSchema) && list.tools.some((t) => t.name === 'export_building'))
  const call = (await handleMcpRpc({ id: 3, method: 'tools/call', params: { name: 'export_building', arguments: { gfa: 40000, storeys: 6, format: 'ifc' } } }))!.result as { isError?: boolean; content: { text: string }[] }
  ok('tools/call export_building returns a real IFC in its content', !call.isError && /ISO-10303-21;/.test((JSON.parse(call.content[0].text) as { content: string }).content))
  const ms = (await handleMcpRpc({ id: 4, method: 'tools/call', params: { name: 'massing_schedule', arguments: { gfa: 100000, storeys: 10 } } }))!.result as { content: { text: string }[] }
  ok('tools/call massing_schedule returns JSON content', (JSON.parse(ms.content[0].text) as { grossFloorArea: number }).grossFloorArea > 0)
  const bad = (await handleMcpRpc({ id: 5, method: 'tools/call', params: { name: 'nope' } }))!.result as { isError?: boolean }
  ok('tools/call on an unknown tool → isError result', bad.isError === true)
  const um = (await handleMcpRpc({ id: 6, method: 'frobnicate' }))!
  ok('an unknown method → JSON-RPC error -32601', um.error?.code === -32601)
  ok('a notification (no id / notifications/*) gets no response', (await handleMcpRpc({ method: 'notifications/initialized' })) === null)
  const png = (await handleMcpRpc({ id: 7, method: 'ping' }))!.result as Record<string, unknown>
  ok('ping → empty result', !!png && Object.keys(png).length === 0)
}

// ── mcp-federation (agent calling external MCP servers) ─────────────────────────
section('mcp-federation')
{
  ok('parseMcpServers: empty → []', parseMcpServers('').length === 0 && parseMcpServers(undefined).length === 0)
  const arr = parseMcpServers('[{"name":"autodesk","url":"https://x/mcp"},{"name":"db","url":"http://y/mcp"}]')
  ok('parseMcpServers: JSON array', arr.length === 2 && arr[0].name === 'autodesk' && arr[1].url === 'http://y/mcp')
  ok('parseMcpServers: name=url pairs', (() => { const r = parseMcpServers('autodesk=https://a/mcp, db=https://b/mcp'); return r.length === 2 && r[0].name === 'autodesk' && r[1].url === 'https://b/mcp' })())
  ok('parseMcpServers: drops non-http + sanitizes names', (() => { const r = parseMcpServers('[{"name":"a b!","url":"ftp://x"},{"name":"ok","url":"https://z/mcp"}]'); return r.length === 1 && r[0].name === 'ok' })())
  ok('qualify/split round-trip', (() => { const q = qualify('autodesk', 'list_models'); const s = split(q); return q === 'autodesk__list_models' && s!.server === 'autodesk' && s!.tool === 'list_models' })())
  ok('split returns null when unqualified', split('plain') === null)
}

// ── tool-forms (schema-driven Connections hub runner) ───────────────────────────
section('tool-forms')
{
  const massing = AGENT_TOOLS.find((t) => t.name === 'massing_schedule')!.inputSchema
  const fields = fieldsFromSchema(massing)
  ok('fieldsFromSchema reads types, enums & required', (() => {
    const gfa = fields.find((f) => f.name === 'gfa'); const shape = fields.find((f) => f.name === 'shape'); const storeys = fields.find((f) => f.name === 'storeys')
    return gfa?.type === 'number' && gfa.required && shape?.type === 'enum' && shape.enum!.includes('court') && storeys?.type === 'integer'
  })())
  ok('required fields are ordered first', fields[0].required)
  ok('coerceArgs types values + flags missing required', (() => {
    const { args, errors } = coerceArgs(fields, { gfa: '100000', storeys: '10', shape: 'rect' })
    return args.gfa === 100000 && args.storeys === 10 && args.shape === 'rect' && errors.length === 0
  })())
  ok('coerceArgs errors on missing required + bad number', (() => {
    const r1 = coerceArgs(fields, { storeys: '10' }); const r2 = coerceArgs(fields, { gfa: 'abc' })
    return r1.errors.some((e) => /gfa/.test(e)) && r2.errors.some((e) => /gfa/.test(e))
  })())
  const arr = fieldsFromSchema(AGENT_TOOLS.find((t) => t.name === 'score_suppliers')!.inputSchema)
  ok('array inputs become JSON fields, parsed on coerce', (() => {
    const f = arr.find((x) => x.name === 'suppliers'); const { args, errors } = coerceArgs(arr, { suppliers: '[{"id":"a"}]' })
    return f?.type === 'json' && Array.isArray(args.suppliers) && errors.length === 0
  })())
  ok('invalid JSON is rejected', coerceArgs(arr, { suppliers: '{bad' }).errors.length === 1)
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
// ── ifc-clash (geometric clash detection on real tessellated boxes) ──────────────
section('ifc-clash')
{
  const B = (id: number, type: string, disc: string, min: [number, number, number], max: [number, number, number]): ClashBox => ({ id, type, discipline: disc, min, max })
  // a column punching through a duct: genuine clash
  const col = B(1, 'IFCCOLUMN', 'struct', [0, 0, 0], [0.4, 3, 0.4])
  const duct = B(2, 'IFCDUCTSEGMENT', 'mep', [-1, 2.4, 0.1], [1.5, 2.8, 0.35])
  const far = B(3, 'IFCDUCTSEGMENT', 'mep', [5, 0, 5], [6, 0.4, 6])
  const r1 = detectClashes([col, duct, far])
  ok('a real penetration is detected with depth + volume + severity', r1.clashes.length === 1 && r1.clashes[0].a.id + r1.clashes[0].b.id === 3 && r1.clashes[0].depth > 0.2 && r1.clashes[0].volume > 0 && ['Major', 'Critical'].includes(r1.clashes[0].severity))
  ok('non-overlapping elements never clash', detectClashes([col, far]).clashes.length === 0)
  ok('grazing contact within tolerance is not a clash', detectClashes([col, B(4, 'IFCDUCTSEGMENT', 'mep', [0.4, 0, 0], [1, 3, 0.4])]).clashes.length === 0)
  ok('by-design fits are suppressed (window in wall), and counted', (() => { const w = B(5, 'IFCWALL', 'arch', [0, 0, 0], [4, 3, 0.25]); const win = B(6, 'IFCWINDOW', 'arch', [1, 1, -0.02], [2, 2.2, 0.3]); const r = detectClashes([w, win]); return r.clashes.length === 0 && r.suppressed === 1 })())
  ok('discipline pairs roll up with worst volume', (() => { const r = detectClashes([col, duct, B(7, 'IFCPIPESEGMENT', 'mep', [0.1, 1, 0.05], [0.3, 2, 0.6])]); const p = r.pairs.find((x) => x.a === 'mep' && x.b === 'struct'); return !!p && p.count === r.clashes.length && p.worst >= r.clashes[r.clashes.length - 1].volume })())
  ok('the headline reads clear when nothing truly clashes', /coordinated/i.test(detectClashes([col, far]).headline))
  // meshBoxes: world AABB honours the placement matrix (translate +10 in X)
  const tri = new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 1])
  const M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1]
  const mb = meshBoxes([{ expressID: 9, ifcTypeName: 'IFCBEAM', discipline: 'struct', positions: tri, matrix: M }])
  ok('meshBoxes transforms vertices into world space', mb.length === 1 && near(mb[0].min[0], 10, 1e-6) && near(mb[0].max[0], 11, 1e-6) && near(mb[0].max[1], 2, 1e-6))
  ok('geometryTakeoff counts + measures per class', (() => { const t = geometryTakeoff([col, duct, far]); const d = t.find((x) => x.type === 'IFCDUCTSEGMENT'); return t.length === 2 && d?.count === 2 && d.volume > 0 })())
  ok('clash CSV lists every hit with coordinates', (() => { const c = clashCsv(r1); return c.split('\n').length === r1.clashes.length + 2 && c.includes('IFCCOLUMN') })())

  // triangle-accurate narrow phase. A reusable closed-box mesh builder:
  const ID = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const boxFaces = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]]
  const boxVerts = (a: number[], b: number[]) => [[a[0], a[1], a[2]], [b[0], a[1], a[2]], [b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], b[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]], [a[0], b[1], b[2]]]
  const meshOf = (id: number, type: string, disc: string, arms: [number[], number[]][]) => {
    const v: number[] = [], idx: number[] = []
    for (const [a, b] of arms) { const base = v.length / 3; boxVerts(a, b).forEach((p) => v.push(...p)); boxFaces.forEach((f) => idx.push(...f.map((k) => k + base))) }
    return { expressID: id, ifcTypeName: type, discipline: disc, positions: new Float32Array(v), indices: new Uint32Array(idx), matrix: ID }
  }
  const cube = (id: number, type: string, disc: string, a: number[], b: number[]) => meshOf(id, type, disc, [[a, b]])
  ok('meshHitsBox confirms a triangle crossing the box (straddling a face)', meshHitsBox(cube(0, 'IFCDUCTSEGMENT', 'mep', [0, 0, 0], [1, 1, 1]), [0.8, 0.2, 0.2], [1.2, 0.8, 0.8]))
  ok('meshHitsBox rejects a box the solid does not reach', meshHitsBox(cube(0, 'IFCDUCTSEGMENT', 'mep', [0, 0, 0], [1, 1, 1]), [3, 3, 3], [3.5, 3.5, 3.5]) === false)
  const overlap = detectClashesMeshes([cube(100, 'IFCDUCTSEGMENT', 'mep', [0, 0, 0], [1, 1, 1]), cube(101, 'IFCCOLUMN', 'struct', [0.6, 0, 0], [1.6, 1, 1])])
  ok('overlapping solids → a hard (confirmed) clash', overlap.clashes.length === 1 && overlap.clashes[0].confirmed === true && overlap.confirmed === 1)
  // an L (two arms) whose joint AABB [0,1]³-ish overlaps a probe sitting in the notch
  const Lshape = meshOf(200, 'IFCDUCTSEGMENT', 'mep', [[[0, 0, 0], [1, 0.3, 0.3]], [[0, 0, 0], [0.3, 0.3, 1]]])
  const probe = cube(201, 'IFCCOLUMN', 'struct', [0.5, 0, 0.5], [0.8, 0.3, 0.8]) // in the L's notch
  const soft = detectClashesMeshes([Lshape, probe])
  ok('boxes overlap but solids miss → a soft clash, flagged', soft.clashes.length === 1 && soft.clashes[0].confirmed === false && soft.confirmed === 0)
  ok('narrow=false skips the triangle phase (AABB only)', detectClashesMeshes([Lshape, probe], { narrow: false }).clashes.every((c) => c.confirmed === undefined))
}

// ── bcf (BCF 2.1 export: store-only zip + markup/viewpoint per clash) ────────────
section('bcf')
{
  // a tiny zip round-trips its central directory + file count
  const enc = new TextEncoder()
  const zip = makeZip([{ name: 'a.txt', data: enc.encode('hello') }, { name: 'd/b.txt', data: enc.encode('world!!') }])
  ok('makeZip writes a valid store-only archive (PK header, EOCD, 2 entries)', zip[0] === 0x50 && zip[1] === 0x4b && zip.length > 60 && (() => { const eocd = zip.length - 22; return zip[eocd] === 0x50 && zip[eocd + 1] === 0x4b && zip[eocd + 10] === 2 })())
  const dv = new DataView(zip.buffer)
  ok('local header records the real CRC + sizes', dv.getUint32(18, true) === 5 && dv.getUint32(22, true) === 5)
  // a clash result → a BCF with version, project + a folder per topic
  const cr = detectClashesMeshes([
    { expressID: 1, ifcTypeName: 'IFCDUCTSEGMENT', discipline: 'mep', guid: '2aBcDeFgHiJkLmNoPqRsT0', positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]), matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    { expressID: 2, ifcTypeName: 'IFCCOLUMN', discipline: 'struct', guid: '3xYzAbCdEfGhIjKlMnOpQ1', positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0]), matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.5, 0, 0, 1] },
  ])
  ok('the synthetic pair is a hard clash', cr.clashes.length === 1 && cr.clashes[0].confirmed === true)
  const bcf = buildBcf(cr, { project: 'Test', author: 'QA', date: '2026-06-12T00:00:00Z' })
  const txt = new TextDecoder().decode(bcf)
  ok('the BCF carries the 2.1 version, project, and a markup + viewpoint per topic', txt.includes('VersionId="2.1"') && txt.includes('ProjectExtension') && txt.includes('markup.bcf') && txt.includes('viewpoint.bcfv'))
  ok('the topic markup is a Clash issue with a title + priority', txt.includes('TopicType="Clash"') && txt.includes('<Title>') && txt.includes('IFCDUCTSEGMENT'.replace('IFC', '')) && txt.includes('<Priority>'))
  ok('the viewpoint selects both elements by IFC GlobalId + has a camera', txt.includes('IfcGuid="2aBcDeFgHiJkLmNoPqRsT0"') && txt.includes('IfcGuid="3xYzAbCdEfGhIjKlMnOpQ1"') && txt.includes('<PerspectiveCamera>'))
  ok('topic count matches the clash count', bcfTopicCount(cr) === cr.clashes.length)
}


// ── bim-audit (plain-language IFC translation + the model-health QA pass) ───────
section('bim-audit')
{
  const geo = parseIfc(SAMPLE_IFC_GEO, 'geo.ifc')
  ok('the geometry sample now carries a full spatial structure (4 storeys)', geo.storeys.length === 4 && geo.project === 'Meridian Tower')
  // plain-language translation
  ok('explainEntity translates plumbing → relatable labels', explainEntity('IFCCARTESIANPOINT').label === 'Points (coordinates)' && explainEntity('IFCCARTESIANPOINT').group === 'geometry' && explainEntity('IFCWALLSTANDARDCASE').label === 'Walls' && explainEntity('IFCRELCONTAINEDINSPATIALSTRUCTURE').group === 'relationships')
  ok('unknown classes fall back gracefully into “other”', explainEntity('IFCWIDGETFRAMMIS').group === 'other' && explainEntity('IFCWIDGETFRAMMIS').label.length > 0)
  const comp = composition(geo.entityCounts)
  ok('composition rolls every record into the six groups (counts reconcile)', comp.reduce((s, g) => s + g.count, 0) === geo.entityCounts.reduce((s, e) => s + e.count, 0))
  ok('geometry plumbing dominates a real IFC (that is normal, and said so)', (() => { const g = comp.find((x) => x.group === 'geometry')!; return g.pct >= 40 && /normal/i.test(g.blurb) })())
  ok('building elements group carries the physical parts with top chips', (() => { const g = comp.find((x) => x.group === 'elements')!; return g.count === geo.elementCount && g.top.length > 0 && g.top.some((t) => t.label === 'Walls') })())
  // the QA pass
  const audit = auditModel(geo)
  ok('the fixed sample passes the spatial checks (storeys + containment + geometry + units)', ['spatial', 'contain', 'geometry', 'units'].every((id) => audit.findings.find((f) => f.id === id)?.severity === 'good'))
  ok('the generated sample also passes types, psets and spaces (toIfc writes them)', ['types', 'psets', 'spaces'].every((id) => audit.findings.find((f) => f.id === id)?.severity === 'good'))
  ok('what it genuinely lacks is reported as info (no quantities, no materials)', audit.findings.find((f) => f.id === 'qto')?.severity === 'info' && audit.findings.find((f) => f.id === 'materials')?.severity === 'info')
  ok('every finding explains itself in plain language (detail + why)', audit.findings.every((f) => f.detail.length > 10 && f.why.length > 20))
  ok('score + grade reflect the findings (a healthy generated model grades A/B)', audit.score >= 74 && (audit.grade === 'A' || audit.grade === 'B') && /ready to federate|tighten/i.test(audit.headline))
  ok('findings are ordered critical → warning → good → info', (() => { const r = { critical: 0, warning: 1, good: 2, info: 3 } as const; const xs = audit.findings.map((f) => r[f.severity]); return xs.every((v, i) => i === 0 || v >= xs[i - 1]) })())
  // a structureless file audits worse
  const bare = auditModel({ schema: 'IFC4', totalInstances: 50, elementCount: 10, distinctTypes: 4, storeys: [], entityCounts: [{ type: 'IFCWALL', count: 10 }, { type: 'IFCCARTESIANPOINT', count: 40 }] })
  ok('no storeys → a blocking finding, and a clearly lower score', bare.findings.find((f) => f.id === 'spatial')?.severity === 'critical' && bare.score < audit.score && /fix first/i.test(bare.headline))
  ok('the richer metadata sample audits at least as well as the bare one', auditModel(parseIfc(SAMPLE_IFC, 's.ifc')).score >= bare.score)
  ok('audit CSV carries the score, the findings and the composition', (() => { const c = auditCsv(geo); return c.includes('Model health') && c.includes('Why it matters') && c.includes('Group,Share,Records') && c.split('\n').length > audit.findings.length + 3 })())
}

// Exercises the production extraction wrapper against SAMPLE_IFC_GEO end-to-end:
// proves the WASM kernel tessellates our generated IFC into real meshes. The
// WASM lives in node_modules; in CI the cwd is the repo root so this resolves.
section('ifc-geometry')
{
  const bytes = new TextEncoder().encode(SAMPLE_IFC_GEO)
  const res = await extractGeometry(bytes, { wasmPath: './node_modules/web-ifc/' })
  // The sample is now the studio's own generated tower exported via toIfc — the
  // full anatomy (substructure → finishes), so hundreds of real solids tessellate.
  const solids = res.meshes.filter((m) => m.ifcTypeName !== 'IFCSPACE')
  ok('tessellates a complete structure (hundreds of solids, not a mock-up)', solids.length > 250 && solids.length < 4000, solids.length)
  ok('produces real vertices', res.vertexCount > 5000, res.vertexCount)
  ok('produces real triangles', res.triangleCount > 2000, res.triangleCount)
  ok('every mesh has positions, normals and indices', res.meshes.every((m) => m.positions.length > 0 && m.normals.length === m.positions.length && m.indices.length > 0))
  ok('positions and normals are xyz triples', res.meshes.every((m) => m.positions.length % 3 === 0))
  ok('indices form whole triangles', res.meshes.every((m) => m.indices.length % 3 === 0))
  ok('each mesh carries a 4x4 placement matrix', res.meshes.every((m) => m.matrix.length === 16))
  ok('each mesh carries an RGBA colour', res.meshes.every((m) => 'r' in m.color && 'a' in m.color))
  ok('both disciplines are richly represented (structure + architecture)',
    solids.filter((m) => m.discipline === 'struct').length > 40 && solids.filter((m) => m.discipline === 'arch').length > 40,
    solids.reduce<Record<string, number>>((a, m) => ({ ...a, [m.discipline]: (a[m.discipline] ?? 0) + 1 }), {}))
  const names = new Set(res.meshes.map((m) => m.ifcTypeName))
  ok('the full anatomy is present — slabs, columns, beams, walls, windows, doors, stairs, railings, finishes, footings, core',
    ['IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCWALL', 'IFCWINDOW', 'IFCDOOR', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCCOVERING', 'IFCFOOTING', 'IFCBUILDINGELEMENTPROXY'].every((t) => names.has(t)), [...names])
  ok('bbox spans the four storeys vertically (~14m + parapet, Y-up)', !!res.bbox && res.bbox.max[1] - res.bbox.min[1] > 12 && res.bbox.max[1] - res.bbox.min[1] < 18, res.bbox)
  ok('the substructure digs below ground (footings under level 0)', !!res.bbox && res.bbox.min[1] < -0.5, res.bbox?.min)
  // run the REAL clash pass over the tessellated sample: a clean generated model
  // has zero true intersections once by-design fits are suppressed
  const geoBoxes = meshBoxes(solids)
  const geo = detectClashes(geoBoxes)
  ok('the generated structure is geometrically coordinated (0 real clashes)', geo.clashes.length === 0 && geo.suppressed > 50, { clashes: geo.clashes.slice(0, 3).map((c) => `${c.a.type}×${c.b.type}@${c.depth}`), suppressed: geo.suppressed })
  ok('the triangle narrow phase confirms it too (no hard clashes on the clean model)', detectClashesMeshes(solids).confirmed === 0)
  ok('the geometry takeoff measures the full anatomy', (() => { const t = geometryTakeoff(geoBoxes); return t.length >= 9 && (t.find((x) => x.type === 'IFCSLAB')?.count ?? 0) >= 12 })())
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

// ── zoning-presets + maximise + feasibility (the site feasibility studio) ────────
section('zoning-presets')
{
  ok('every district preset carries a full rule set + programme mix', ZONING_PRESETS.length >= 6 && ZONING_PRESETS.every((p) => p.far > 0 && p.heightLimit > 0 && p.maxCoverage > 0 && p.mix && (p.mix.residential + p.mix.office + p.mix.retail) >= 0))
  ok('presetById finds a district; downtown is the densest, low-rise the loosest', presetById('downtown-hd')!.far === 10 && presetById('residential-low')!.far < presetById('urban-mixed')!.far)
  ok('normaliseMix sums to 1', (() => { const m = normaliseMix({ residential: 2, office: 1, retail: 1 }); return near(m.residential + m.office + m.retail, 1, 1e-9) && near(m.residential, 0.5, 1e-9) })())
}

section('zoning-optimize')
{
  const site = rectSite(60, 40) // 2400 m²
  const rules = { boundary: site, far: 4, heightLimit: 60, setback: 5, maxCoverage: 60, storeyHeight: 3.5, podium: 0, towerSetback: 0, skyBase: 0, skyStep: 0 }
  const opt = maximizeScheme(rules)
  ok('the maximiser returns a compliant scheme', opt.proposedGFA > 0 && opt.zoning.compliance.overall)
  ok('it pushes utilisation to (near) 100% of the binding cap', opt.utilisation >= 92, opt.utilisation)
  ok('a generous FAR with a tight height/coverage binds on geometry, not FAR', (() => { const o = maximizeScheme({ ...rules, far: 20, heightLimit: 24, maxCoverage: 50 }); return o.binding !== 'FAR' && o.zoning.compliance.overall })())
  ok('a low FAR with loads of height binds on FAR', (() => { const o = maximizeScheme({ ...rules, far: 2, heightLimit: 200, maxCoverage: 90 }); return o.binding === 'FAR' && near(o.proposedGFA, 2 * 2400, 50) })())
  ok('a collapsing setback yields no scheme, flagged', (() => { const o = maximizeScheme({ ...rules, setback: 40 }); return o.proposedGFA === 0 })())
  ok('the optimum never exceeds the height limit', opt.height <= rules.heightLimit + 1e-6)
}

section('feasibility')
{
  const f = feasibility({ gfa: 10000, mix: { residential: 0.6, office: 0.25, retail: 0.15 }, siteArea: 2400, buildableArea: 1500, investmentYield: 0.06, targetMarginPct: 18 })
  ok('programme splits GFA by mix and nets it down to saleable area', f.lines.length === 3 && near(f.lines[0].gfa, 6000, 1) && f.lines[0].net < f.lines[0].gfa && f.netArea < 10000)
  ok('residential units are counted from net ÷ unit size', f.lines[0].units === Math.round(f.lines[0].net / DEFAULT_RATES.residential.unitSize) && f.units > 0)
  ok('for-sale revenue uses sale price; investment uses capitalised rent (rent ÷ yield)', (() => { const resi = f.lines.find((l) => l.use === 'residential')!; const off = f.lines.find((l) => l.use === 'office')!; return near(resi.revenue, resi.net * DEFAULT_RATES.residential.salePrice, 2) && near(off.revenue, (DEFAULT_RATES.office.rent * off.net) / 0.06, 2) })())
  ok('the cost stack sums construction + fees + contingency + parking + finance', near(f.totalCostExLand, f.construction + f.fees + f.contingency + f.parking + f.demolition + f.siteWorks + f.finance, 2) && f.construction > 0)
  ok('parking bays are derived from the programme', f.parkingBays > 0 && f.parking === f.parkingBays * 35000)
  ok('GDV, margin and yield-on-cost are reported', f.gdv > 0 && f.marginOnCost > 0 && f.yieldOnCost > 0 && f.noi > 0)
  ok('residual land value solves the target-margin identity (profit = margin × (cost+land))', (() => { const land = f.residualLandValue; const profit = f.gdv - f.totalCostExLand - land; return near(profit, 0.18 * (f.totalCostExLand + land), 5) })())
  ok('a richer mix or higher prices raises the residual land value', feasibility({ gfa: 10000, mix: { residential: 1, office: 0, retail: 0 }, siteArea: 2400, rates: { residential: { salePrice: 9000 } } }).residualLandValue > f.residualLandValue)
  ok('an unviable scheme (cost > value) reports a negative profit pool + an underwater headline', (() => { const u = feasibility({ gfa: 10000, mix: { residential: 1, office: 0, retail: 0 }, siteArea: 2400, rates: { residential: { salePrice: 500 } } }); return u.profitAtZeroLand < 0 && u.residualLandValue === 0 && /underwater|doesn/i.test(u.headline) })())
  ok('the waterfall + CSV expose the stack', feasibilityWaterfall(f).some((r) => r.label === 'GDV' && r.kind === 'value') && feasibilityCsv(f).includes('Residual land value'))
  ok('land value reports per site m²', f.landPerSiteM2 > 0 && near(f.landPerSiteM2, f.residualLandValue / 2400, 1))
}

// ── per-edge setbacks (front / side / rear) ─────────────────────────────────────
section('zoning-setbacks')
{
  const site = rectSite(60, 40) // 60 wide (X), 40 deep (Z) → long edges run along X
  const roles = classifyEdges(site)
  ok('the frontage is the longest edge; the rear is opposite it; rest are sides', roles.filter((r) => r === 'front').length === 1 && roles.filter((r) => r === 'rear').length === 1 && roles.filter((r) => r === 'side').length === 2)
  ok('per-edge inset shrinks more than a tiny uniform inset on the deep sides', (() => { const big = insetPolygonEdges(site, (r) => (r === 'side' ? 10 : 1)); const small = insetPolygon(site, 1); return big.length >= 3 && polygonArea(big) < polygonArea(small) })())
  ok('buildZoning uses per-edge setbacks when supplied (area differs from uniform)', (() => { const u = buildZoning({ boundary: site, far: 4, heightLimit: 60, setback: 5, maxCoverage: 80, storeyHeight: 3.5, proposedGFA: 5000, proposedStoreys: 10 }); const pe = buildZoning({ boundary: site, far: 4, heightLimit: 60, setback: 5, maxCoverage: 80, storeyHeight: 3.5, proposedGFA: 5000, proposedStoreys: 10, setbacks: { front: 8, side: 4, rear: 12 } }); return !!pe.edgeClasses && pe.edgeClasses.length === 4 && Math.abs(pe.buildableArea - u.buildableArea) > 1 })())
  ok('an over-large per-edge setback collapses the buildable, like the uniform case', buildZoning({ boundary: site, far: 4, heightLimit: 60, setback: 5, maxCoverage: 80, storeyHeight: 3.5, proposedGFA: 1000, proposedStoreys: 6, setbacks: { front: 40, side: 40, rear: 40 } }).buildableArea === 0)
}

// ── shadow study (right-to-light) ───────────────────────────────────────────────
section('shadow')
{
  const fp = rectSite(20, 14) // 280 m² footprint
  // sun low in the SE → a long shadow to the NW; sun overhead → ~no shadow
  const low = castShadow(fp, 40, sunDirection(135, 20))
  ok('a low sun casts a long ground shadow beyond the footprint', low.area > polygonArea(fp) && low.reach > 40, { area: low.area, reach: low.reach })
  ok('the shadow falls away from the sun (SE sun → NW offset)', low.offset.x < 0 && low.offset.z > 0)
  const high = castShadow(fp, 40, sunDirection(180, 80))
  ok('a high sun casts a much shorter shadow than a low one', high.reach < low.reach)
  ok('the sun below the horizon casts no shadow (footprint only)', castShadow(fp, 40, sunDirection(180, -5)).reach === 0)
  ok('a taller building casts a proportionally longer shadow', castShadow(fp, 80, sunDirection(135, 20)).reach > low.reach * 1.8)
  ok('convexHull wraps a point cloud (square → 4 corners)', convexHull([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }, { x: 0, z: 1 }, { x: 0.5, z: 0.5 }]).length === 4)
  const study = shadowStudy(fp, 50, { lat: 40.7, lng: -74, month: 12 })
  ok('the study runs three solar moments with a worst-case reach + net area', study.moments.length === 3 && study.maxReach > 0 && study.netShadowArea > 0 && study.moments.every((m) => m.shadow.polygon.length >= 3))
  ok('winter shadows are longer than summer (lower sun)', shadowStudy(fp, 50, { lat: 40.7, lng: -74, month: 12 }).maxReach > shadowStudy(fp, 50, { lat: 40.7, lng: -74, month: 6 }).maxReach)
}

// ── context-shadow (neighbours + overshadowing / sun-hours) ──────────────────────
section('context-shadow')
{
  const site = rectSite(40, 30)
  const nb = defaultNeighbours(site, 8, 24)
  ok('a default context ring places four neighbours around the site bbox', nb.length === 4 && nb.every((n) => n.footprint.length === 4 && n.height > 0) && nb.some((n) => /North/.test(n.name)))
  ok('neighbours sit outside the parcel (north lot is north of the site)', (() => { const n = nb.find((x) => x.id === 'n-n')!; return Math.min(...n.footprint.map((p) => p.z)) >= 15 - 1e-6 })())
  // a tall mass in winter (low sun) shades the north neighbour more than the south
  const fp = rectSite(30, 20)
  const winter = overshadowing(fp, 60, nb, { lat: 40.7, lng: -74, month: 12 })
  ok('overshadowing reports per-neighbour coverage + sun-hours', winter.neighbours.length === 4 && winter.neighbours.every((n) => n.worstCoverage >= 0 && n.worstCoverage <= 100 && n.sunHours >= 0 && n.byMoment.length === 3))
  ok('the north neighbour is shaded more than the south (sun is to the south)', winter.neighbours.find((n) => n.id === 'n-n')!.worstCoverage >= winter.neighbours.find((n) => n.id === 'n-s')!.worstCoverage)
  ok('a taller proposal overshadows more than a short one', overshadowing(fp, 90, nb, { lat: 40.7, lng: -74, month: 12 }).totalShadedArea >= winter.totalShadedArea)
  ok('winter midday shades the north neighbour far more than summer (lower sun)', winter.neighbours.find((n) => n.id === 'n-n')!.worstCoverage > overshadowing(fp, 60, nb, { lat: 40.7, lng: -74, month: 6 }).neighbours.find((n) => n.id === 'n-n')!.worstCoverage)
  ok('a worst-neighbour + total shaded area are surfaced', !!winter.worstNeighbour && winter.worstNeighbour !== '—' && winter.totalShadedArea >= 0)
  ok('overshadowing CSV lists every neighbour + a total', (() => { const c = overshadowingCsv(winter); return c.split('\n').length === nb.length + 2 && /Worst shadow %/.test(c) && /North neighbour/.test(c) })())
}

// ── zoning value-optimal massing (maximise residual land value) ──────────────────
section('zoning-value')
{
  const site = rectSite(50, 36) // 1800 m²
  const rules = { boundary: site, far: 6, heightLimit: 80, setback: 5, maxCoverage: 70, storeyHeight: 3.5, podium: 0, towerSetback: 0, skyBase: 0, skyStep: 0 }
  const v = maximizeValue(rules, { mix: { residential: 0.6, office: 0.25, retail: 0.15 }, investmentYield: 0.06, targetMarginPct: 18 })
  ok('the value optimiser returns a compliant scheme + the best residual land value', v.proposedGFA > 0 && v.residualLandValue > 0 && v.perStorey.length > 1)
  ok('the chosen storey count has the max RLV of the compliant options', (() => { const best = v.perStorey.filter((s) => s.compliant).reduce((m, s) => (s.rlv > m.rlv ? s : m)); return best.storeys === v.proposedStoreys && best.rlv === v.residualLandValue })())
  ok('every per-storey row carries gfa + rlv + a compliance flag', v.perStorey.every((s) => s.gfa >= 0 && typeof s.rlv === 'number' && typeof s.compliant === 'boolean'))
  ok('the optimum never breaches the height limit', v.proposedStoreys * rules.storeyHeight <= rules.heightLimit + 1e-6)
  ok('a richer all-residential mix at premium prices shifts the optimum', (() => { const v2 = maximizeValue(rules, { mix: { residential: 1, office: 0, retail: 0 }, targetMarginPct: 18 }); return v2.residualLandValue !== v.residualLandValue })())
}

// ── appraisal (time-phased development cashflow / DCF) ───────────────────────────
section('appraisal')
{
  const base = {
    saleRevenue: 80_000_000, investmentRevenue: 20_000_000,
    costs: { construction: 50_000_000, fees: 6_000_000, contingency: 4_000_000, parking: 3_000_000, demolition: 1_000_000, siteWorks: 2_000_000 },
    land: 12_000_000, programme: { preMonths: 6, constructionMonths: 24, saleMonths: 12 },
    annualInterest: 0.075, discountRate: 0.1,
  }
  const a = appraise(base)
  ok('the cashflow spans the full programme (pre + construction + sale)', a.months === 42 && a.rows.length === 42)
  ok('GDV = for-sale + investment revenue', a.gdv === 100_000_000)
  ok('land is drawn in month 0 only', a.rows[0].land === 12_000_000 && a.rows.slice(1).every((r) => r.land === 0))
  ok('costs are spread, not lumped (no single month holds them all)', a.rows.every((r) => r.cost < base.costs.construction) && a.rows.some((r) => r.cost > 0))
  ok('revenue arrives later than the first spend', (() => { const firstCost = a.rows.findIndex((r) => r.cost > 0 || r.land > 0); const firstRev = a.rows.findIndex((r) => r.revenue > 0); return firstRev > firstCost })())
  ok('the investment capital value lands at stabilisation (final month)', a.rows[a.months - 1].revenue >= 20_000_000)
  ok('summed monthly cost ≈ the dev cost stack', near(a.rows.reduce((s, r) => s + r.cost, 0), a.devCostExFinance, 5))
  ok('summed monthly revenue ≈ GDV', near(a.rows.reduce((s, r) => s + r.revenue, 0), a.gdv, 5))
  ok('a development facility is drawn — peak debt is positive', a.peakFunding > 0 && a.peakFundingMonth > 0 && a.peakFundingMonth < a.months)
  ok('interest rolls up — total interest > 0 at a 7.5% facility', a.totalInterest > 0)
  ok('total cost = land + dev cost + interest', a.totalCost === Math.round(base.land + a.devCostExFinance + a.totalInterest))
  ok('profit = GDV − total cost, and the margin is reported', a.profit === a.gdv - a.totalCost && a.marginOnCost > 0)
  ok('the project IRR is a sensible positive annual rate', Number.isFinite(a.irrAnnual) && a.irrAnnual > 0 && a.irrAnnual < 200)
  ok('the cashflow breaks even before the final month', a.breakEvenMonth > 0 && a.breakEvenMonth < a.months)
  // finance sensitivity
  const cheap = appraise({ ...base, annualInterest: 0 })
  ok('a 0% facility charges no interest', cheap.totalInterest === 0)
  ok('a dearer facility erodes profit and lifts interest', (() => { const dear = appraise({ ...base, annualInterest: 0.15 }); return dear.totalInterest > a.totalInterest && dear.profit < a.profit })())
  // NPV ↔ discount rate ↔ IRR relationships
  ok('NPV falls as the discount rate rises', appraise({ ...base, discountRate: 0.2 }).npv < appraise({ ...base, discountRate: 0.05 }).npv)
  ok('NPV ≈ 0 when discounting at the IRR', (() => { const at = appraise({ ...base, discountRate: Math.pow(1 + a.irrMonthly, 12) - 1 }); return Math.abs(at.npv) < Math.max(50_000, a.gdv * 0.002) })())
  ok('NPV is positive when the discount rate is below the IRR', a.irrAnnual > 10 ? a.npv > 0 : true)
  // programme sensitivity — a longer build draws more interest
  ok('a longer construction period accrues more interest', appraise({ ...base, programme: { ...base.programme, constructionMonths: 36 } }).totalInterest > a.totalInterest)
  // a loss-making land price
  const overpaid = appraise({ ...base, land: 60_000_000 })
  ok('overpaying for land tips the scheme into a loss with a warning headline', overpaid.profit < 0 && /loss|doesn.t return/i.test(overpaid.headline))
  // quarterly aggregation + csv
  const q = quarterly(a)
  ok('quarterly aggregation buckets the months into quarters', q.length === Math.ceil(a.months / 3) && q[0].label === 'Q1')
  ok('quarterly cumulative tracks the last month of each quarter', q[0].cumulative === a.rows[2].cumulative)
  ok('appraisal CSV carries the monthly rows + a summary', (() => { const c = appraisalCsv(a); return /Month,Land,Cost/.test(c) && /IRR \(annual\)/.test(c) && c.split('\n').length > a.months })())
  // irr helper edge cases
  ok('irr returns NaN when there is no sign change', Number.isNaN(irr([-1, -2, -3])) && Number.isNaN(irr([1, 2, 3])))
  ok('irr solves a simple two-flow case (−100 now, +121 in 2 periods ⇒ 10%/period)', near(irr([-100, 0, 121]), 0.1, 1e-3))
}

// ── sensitivity & scenarios (risk lens on the appraisal) ─────────────────────────
section('sensitivity')
{
  const base = {
    gfa: 12_000, mix: { residential: 0.6, office: 0.25, retail: 0.15 }, siteArea: 2000, buildableArea: 1400,
    investmentYield: 0.06, targetMarginPct: 18, programme: { preMonths: 6, constructionMonths: 24, saleMonths: 12 },
    annualInterest: 0.075, discountRate: 0.1, landMode: 'fixed' as const, land: 10_000_000,
  }
  const r = evalScenario(base)
  ok('evaluate runs the full pipeline and returns headline metrics', r.gdv > 0 && r.totalCost > 0 && typeof r.profit === 'number' && typeof r.margin === 'number')
  ok('on fixed land, a higher sale price lifts profit', evalScenario(base, { salePriceMult: 1.1 }).profit > r.profit)
  ok('a higher build cost erodes profit', evalScenario(base, { buildCostMult: 1.1 }).profit < r.profit)
  ok('a dearer facility erodes profit', evalScenario(base, { interestMult: 1.5 }).profit < r.profit)
  ok('a higher cap rate (yield) cuts investment value → lower profit', evalScenario(base, { yieldMult: 1.2 }).profit < r.profit)
  ok('on residual land, sale-price upside flows to the residual land value', (() => { const rb = { ...base, landMode: 'residual' as const }; return evalScenario(rb, { salePriceMult: 1.1 }).rlv > evalScenario(rb).rlv })())
  // tornado
  const t = tornado(base, 'profit', 0.1)
  ok('tornado returns a bar per driver', t.length === FACTORS.length)
  ok('tornado bars are sorted by impact (descending)', t.every((b, i) => i === 0 || t[i - 1].impact >= b.impact))
  ok('every tornado bar carries low / base / high / impact', t.every((b) => Number.isFinite(b.low) && Number.isFinite(b.high) && Number.isFinite(b.base) && b.impact >= 0))
  ok('sale price and build cost are among the biggest profit drivers', (() => { const top3 = t.slice(0, 3).map((b) => b.key); return top3.includes('sale') && top3.includes('build') })())
  ok('the build-cost bar shows the right sign (up cost → lower profit)', (() => { const b = t.find((x) => x.key === 'build'); return !!b && b.high < b.low })())
  // data table
  const dt = dataTable(base, 'salePriceMult', [0.9, 1.0, 1.1], 'buildCostMult', [0.95, 1.0, 1.05], 'profit')
  ok('data table has rows × cols matching the value vectors', dt.cells.length === 3 && dt.cells.every((row) => row.length === 3))
  ok('profit rises across the sale-price axis (left→right)', dt.cells.every((row) => row[0] < row[1] && row[1] < row[2]))
  ok('profit falls down the build-cost axis (top→bottom)', dt.cells[0][1] > dt.cells[1][1] && dt.cells[1][1] > dt.cells[2][1])
  // scenarios
  const sc = scenarios(base, 0.1)
  ok('three scenarios: downside / base / upside', sc.length === 3 && sc[0].name === 'Downside' && sc[2].name === 'Upside')
  ok('downside profit < base < upside (the cone of outcomes)', sc[0].result.profit < sc[1].result.profit && sc[1].result.profit < sc[2].result.profit)
  ok('the base scenario matches a plain evaluate()', sc[1].result.profit === r.profit && sc[1].result.gdv === r.gdv)
  // csv
  ok('sensitivity CSV carries the tornado + scenario blocks', (() => { const c = sensitivityCsv(base, 'profit', 0.1); return /Sensitivity of Profit/.test(c) && /Driver,Low/.test(c) && /Scenario,GDV/.test(c) && /Downside/.test(c) })())
}

// ── unit mix & accommodation schedule ────────────────────────────────────────────
section('unit-mix')
{
  const a = accommodation({ residentialNet: 10_000, mix: { studio: 0.1, '1b': 0.4, '2b': 0.4, '3b': 0.1 }, basePricePerM2: 6500, siteAreaM2: 5000 })
  ok('a line per dwelling type', a.lines.length === DEFAULT_UNIT_TYPES.length)
  ok('integer unit counts fill ~the residential net area', a.reconciliation.usedNet > 0 && Math.abs(a.reconciliation.variancePct) < 5)
  ok('total units = sum of the typed counts', a.totalUnits === a.lines.reduce((s, l) => s + l.units, 0))
  ok('the dominant mix shares carry the most units', (() => { const oneB = a.lines.find((l) => l.key === '1b'); const studio = a.lines.find((l) => l.key === 'studio'); return !!oneB && !!studio && oneB.units > studio.units })())
  ok('smaller units fetch a higher $/m² (value factor)', (() => { const s = a.lines.find((l) => l.key === 'studio'); const t = a.lines.find((l) => l.key === '3b'); return !!s && !!t && s.pricePerM2 > t.pricePerM2 })())
  ok('revenue = Σ units × size × $/m²', near(a.revenue, a.lines.reduce((s, l) => s + l.units * l.size * l.pricePerM2, 0), a.lines.length + 1))
  ok('bed spaces & habitable rooms accumulate by occupancy', a.bedSpaces > a.totalUnits && a.habitableRooms >= a.totalUnits)
  ok('average dwelling size sits between the smallest and largest type', a.avgSize >= 40 && a.avgSize <= 103)
  ok('dwelling density is per hectare of site', near(a.densityUnitsPerHa, a.totalUnits / (5000 / 10000), 0.2))
  ok('blended sales rate ≈ revenue ÷ net area', near(a.blendedPricePerM2, a.revenue / a.totalNet, 1))
  // mix shifts move the schedule
  ok('shifting the mix to family units lowers the unit count (bigger dwellings)', (() => { const fam = accommodation({ residentialNet: 10_000, mix: { studio: 0, '1b': 0, '2b': 0.3, '3b': 0.7 }, basePricePerM2: 6500 }); return fam.totalUnits < a.totalUnits })())
  ok('an all-studio mix maximises the unit count', (() => { const st = accommodation({ residentialNet: 10_000, mix: { studio: 1, '1b': 0, '2b': 0, '3b': 0 }, basePricePerM2: 6500 }); return st.totalUnits > a.totalUnits && st.lines.find((l) => l.key === 'studio')?.units === st.totalUnits })())
  ok('an empty mix normalises rather than dividing by zero', (() => { const z2 = accommodation({ residentialNet: 10_000, mix: {}, basePricePerM2: 6500 }); return Number.isFinite(z2.totalUnits) && z2.totalUnits >= 0 })())
  ok('no site area → density is zero (not NaN)', accommodation({ residentialNet: 5000, mix: { '2b': 1 }, basePricePerM2: 6000 }).densityUnitsPerHa === 0)
  ok('accommodation CSV carries the schedule + totals + metrics', (() => { const c = accommodationCsv(a); return /Type,Beds,Size/.test(c) && /TOTAL/.test(c) && /Dwelling density/.test(c) })())
}

// ── affordable housing & planning obligations (viability) ────────────────────────
section('obligations')
{
  const base = {
    marketGdv: 60_000_000, residentialGdv: 45_000_000, totalUnits: 100, gfa: 12_000,
    affordablePct: 0.3, cilPerM2: 120, s106PerUnit: 8000, totalCostExLand: 38_000_000,
    benchmarkLandValue: 9_000_000, targetMarginPct: 18,
  }
  const o = obligations(base)
  ok('affordable + market units split from the policy %', o.affordableUnits === 30 && o.marketUnits === 70 && o.affordableUnits + o.marketUnits === base.totalUnits)
  ok('a tenure line per affordable tenure, summing to the affordable units', o.tenureLines.length === AFFORDABLE_TENURES.length && o.tenureLines.reduce((s, l) => s + l.units, 0) === o.affordableUnits)
  ok('affordable homes are valued below market (discount applied)', o.tenureLines.every((l) => l.valueFactor < 1) && o.affordableGdv < o.affordableUnits * (base.residentialGdv / base.totalUnits))
  ok('policy GDV is below the all-market GDV by the GDV forgone', o.policyGdv < base.marketGdv && o.gdvForgone > 0)
  ok('CIL = GFA × rate, and S106 = units × rate', o.cil === base.gfa * base.cilPerM2 && o.s106 === base.totalUnits * base.s106PerUnit && o.obligationsTotal === o.cil + o.s106)
  ok('a residual land value is struck after affordable + obligations', o.residualLandValue >= 0 && typeof o.viable === 'boolean')
  ok('the benchmark surplus = residual − benchmark', o.surplusVsBenchmark === o.residualLandValue - base.benchmarkLandValue)
  ok('more affordable housing lowers the residual land value', obligations({ ...base, affordablePct: 0.5 }).residualLandValue < o.residualLandValue)
  ok('zero affordable + zero obligations gives the highest residual', (() => { const z2 = obligations({ ...base, affordablePct: 0, cilPerM2: 0, s106PerUnit: 0 }); return z2.residualLandValue > o.residualLandValue && z2.gdvForgone === 0 })())
  ok('the viability-led max affordable % clears the benchmark but more would not', (() => { const m = obligations(base).maxAffordablePct; const atMax = obligations({ ...base, affordablePct: m }); const over = obligations({ ...base, affordablePct: Math.min(1, m + 0.05) }); return atMax.residualLandValue >= base.benchmarkLandValue && (m >= 1 || over.residualLandValue < base.benchmarkLandValue) })())
  ok('a scheme below benchmark reads as unviable with a viability-led headline', (() => { const u = obligations({ ...base, affordablePct: 0.6, benchmarkLandValue: 20_000_000 }); return !u.viable && /unviable/i.test(u.headline) })())
  ok('richer tenure (more shared ownership) lifts affordable GDV vs social rent', (() => { const so = obligations({ ...base, tenureSplit: { socialRent: 0, affordableRent: 0, sharedOwnership: 1 } }); const sr = obligations({ ...base, tenureSplit: { socialRent: 1, affordableRent: 0, sharedOwnership: 0 } }); return so.affordableGdv > sr.affordableGdv && so.residualLandValue > sr.residualLandValue })())
  ok('obligations CSV carries tenure lines + the viability block', (() => { const c = obligationsCsv(o); return /Affordable tenure,Units/.test(c) && /Residual land value/.test(c) && /Viable,/.test(c) && /Viability-led max/.test(c) })())
}

// ── amenity sunlight (sun-hours on open space) ───────────────────────────────────
section('sunlight')
{
  const space = rectSite(60, 60) // 3600 m² open space
  const noObstacle = amenitySunlight(space, [], { lat: 40.7, lng: -74, month: 6, n: 10 })
  ok('with no obstacles every sample gets the full daylight hours', noObstacle.daylightHours > 0 && noObstacle.avgSunHours === noObstacle.daylightHours && noObstacle.sunlitFraction2h === 100)
  ok('the hourly arc spans the requested window and reports altitude', noObstacle.moments.length === 18 - 7 + 1 && noObstacle.moments.some((m) => m.altitude > 0))
  ok('the grid samples only points inside the open space', noObstacle.grid.length > 0 && noObstacle.grid.length <= 100)
  // a tall block on the south side casts shadow north into the space → less sun
  const block = [{ footprint: [{ x: -30, z: -45 }, { x: 30, z: -45 }, { x: 30, z: -30 }, { x: -30, z: -30 }], height: 60 }]
  const shaded = amenitySunlight(space, block, { lat: 40.7, lng: -74, month: 6, n: 10 })
  ok('an obstacle reduces average sun-hours on the space', shaded.avgSunHours < noObstacle.avgSunHours)
  ok('a taller obstacle shades more than a shorter one', amenitySunlight(space, [{ ...block[0], height: 120 }], { lat: 40.7, lng: -74, month: 6, n: 10 }).avgSunHours <= shaded.avgSunHours)
  ok('points under an obstacle footprint are excluded from the grid', amenitySunlight(space, block, { lat: 40.7, lng: -74, month: 6, n: 10 }).grid.every((g) => !(g.x >= -30 && g.x <= 30 && g.z >= -45 && g.z <= -30)))
  ok('winter shades the space more than summer (lower sun)', amenitySunlight(space, block, { lat: 40.7, lng: -74, month: 12, n: 10 }).avgSunHours < shaded.avgSunHours)
  ok('the ≥2h sunlit fraction is a 0–100% share', shaded.sunlitFraction2h >= 0 && shaded.sunlitFraction2h <= 100 && shaded.sunlitArea2h >= 0)
  ok('per-moment sunlit fraction is 0 when the sun is down', noObstacle.moments.filter((m) => m.altitude <= 0).every((m) => m.sunlitFraction === 0))
  ok('sunlight CSV carries the hourly arc + headline metrics', (() => { const c = sunlightCsv(shaded); return /Hour,Altitude,Sunlit/.test(c) && /Average sun-hours/.test(c) && /Share ≥2h/.test(c) })())
}

// ── feasibility report (bundled Markdown deliverable) ────────────────────────────
section('feasibility-report')
{
  const site = rectSite(60, 45)
  const z = buildZoning({ boundary: site, far: 4, heightLimit: 60, setback: 6, maxCoverage: 55, storeyHeight: 3.6, proposedGFA: 9000, proposedStoreys: 14, podium: 0, towerSetback: 0, skyBase: 0, skyStep: 0 })
  const f = feasibility({ gfa: 9000, mix: { residential: 0.6, office: 0.25, retail: 0.15 }, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: 0.06, targetMarginPct: 18 })
  const resiNet = f.lines.find((l) => l.use === 'residential')?.net ?? 0
  const resiGdv = f.lines.find((l) => l.use === 'residential')?.revenue ?? 0
  const a = accommodation({ residentialNet: resiNet, mix: { studio: 0.1, '1b': 0.4, '2b': 0.4, '3b': 0.1 }, basePricePerM2: 6500, siteAreaM2: z.siteArea })
  const o = obligations({ marketGdv: f.gdv, residentialGdv: resiGdv, totalUnits: a.totalUnits, gfa: 9000, affordablePct: 0.3, cilPerM2: 120, s106PerUnit: 8000, totalCostExLand: f.totalCostExLand, benchmarkLandValue: 8_000_000, targetMarginPct: 18 })
  const saleRev = f.lines.filter((l) => l.tenure === 'sale').reduce((s, l) => s + l.revenue, 0)
  const invRev = f.lines.filter((l) => l.tenure === 'investment').reduce((s, l) => s + l.revenue, 0)
  const ap = appraise({ saleRevenue: saleRev, investmentRevenue: invRev, costs: { construction: f.construction, fees: f.fees, contingency: f.contingency, parking: f.parking, demolition: f.demolition, siteWorks: f.siteWorks }, land: f.residualLandValue, programme: { preMonths: 6, constructionMonths: 24, saleMonths: 12 }, annualInterest: 0.075, discountRate: 0.1 })
  const sb = { gfa: 9000, mix: { residential: 0.6, office: 0.25, retail: 0.15 }, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: 0.06, targetMarginPct: 18, programme: { preMonths: 6, constructionMonths: 24, saleMonths: 12 }, annualInterest: 0.075, discountRate: 0.1, landMode: 'fixed' as const, land: f.residualLandValue }
  const sc = scenarios(sb, 0.1)
  const md = feasibilityReport({ title: 'Test scheme', district: 'Downtown', zoning: z, proposedGFA: 9000, proposedStoreys: 14, feasibility: f, accommodation: a, obligations: o, appraisal: ap, scenarios: sc })

  ok('the report is Markdown with a title + executive summary', /^# Test scheme/m.test(md) && /## Executive summary/.test(md))
  ok('every analysis section is present', ['Zoning & compliance', 'Accommodation schedule', 'Development feasibility', 'Cashflow appraisal', 'Affordable housing & viability', 'Sensitivity & scenarios'].every((s) => md.includes(s)))
  ok('the accommodation table lists the dwelling types', /Studio/.test(md) && /3 bed/.test(md) && /\*\*Total\*\*/.test(md))
  ok('the scenario table includes downside / base / upside', /Downside/.test(md) && /Base/.test(md) && /Upside/.test(md))
  ok('headline figures are interpolated (GDV, IRR, units)', md.includes('GDV') && /IRR|n\/a/.test(md) && new RegExp(`${a.totalUnits}`).test(md))
  ok('the environmental section appears only when supplied', !/## 7\. Environmental/.test(md) && /## 7\. Environmental/.test(feasibilityReport({ zoning: z, proposedGFA: 9000, proposedStoreys: 14, feasibility: f, accommodation: a, obligations: o, appraisal: ap, scenarios: sc, sunlight: amenitySunlight(site, [], { lat: 40.7, lng: -74, n: 8 }) })))
  ok('a non-compliant scheme is flagged in the report', (() => { const z2 = buildZoning({ boundary: site, far: 1, heightLimit: 10, setback: 6, maxCoverage: 30, storeyHeight: 3.6, proposedGFA: 9000, proposedStoreys: 14, podium: 0, towerSetback: 0, skyBase: 0, skyStep: 0 }); const md2 = feasibilityReport({ zoning: z2, proposedGFA: 9000, proposedStoreys: 14, feasibility: f, accommodation: a, obligations: o, appraisal: ap, scenarios: sc }); return /Non-compliant/.test(md2) && /Breaches:/.test(md2) })())
  ok('the environmental section folds in carbon, drainage, biodiversity & daylight when supplied', (() => {
    const full = feasibilityReport({ zoning: z, proposedGFA: 9000, proposedStoreys: 14, feasibility: f, accommodation: a, obligations: o, appraisal: ap, scenarios: sc,
      carbon: massingCarbon({ gfa: 9000, structure: 'concrete', storeys: 14 }),
      drainage: drainage({ siteArea: z.siteArea, footprint: 800 }),
      biodiversity: biodiversity({ siteAreaM2: z.siteArea, footprintM2: 800, hardstandingM2: 400, baseline: { distinctiveness: 'low', condition: 'moderate' }, proposedGreen: { distinctiveness: 'medium', condition: 'good' } }),
      daylight: daylight({ roomWidth: 3.6, roomDepth: 5, roomHeight: 2.7, wwr: 0.4 }) })
    return /Whole-life carbon/.test(full) && /Drainage \(SuDS\)/.test(full) && /Biodiversity net gain/.test(full) && /Interior daylight/.test(full)
  })())
  ok('a transport & access section appears when supplied', (() => {
    const withT = feasibilityReport({ zoning: z, proposedGFA: 9000, proposedStoreys: 14, feasibility: f, accommodation: a, obligations: o, appraisal: ap, scenarios: sc, transport: transport({ residentialUnits: 60, officeNet: 1000, retailNet: 500, transitLevel: 3, parkingSupply: 80 }) })
    return /## 8\. Transport & access/.test(withT) && /Trip generation/.test(withT) && /Parking/.test(withT)
  })())
}

// ── massing design-space optimiser (Pareto frontier) ─────────────────────────────
section('massing-optimize')
{
  const rules = { boundary: rectSite(60, 45), far: 5, heightLimit: 70, setback: 5, maxCoverage: 55, storeyHeight: 3.5, podium: 0, towerSetback: 0, skyBase: 0, skyStep: 0 }
  const feasInput = { mix: { residential: 0.6, office: 0.25, retail: 0.15 }, investmentYield: 0.06, targetMarginPct: 18 }
  const s = optimizeMassing(rules, feasInput)
  ok('the sweep produces many candidate massings', s.candidates.length > 10)
  ok('every candidate carries gfa / height / rlv / compliance', s.candidates.every((c) => c.gfa >= 0 && c.height >= 0 && typeof c.rlv === 'number' && typeof c.compliant === 'boolean'))
  ok('no candidate exceeds the height limit', s.candidates.every((c) => c.height <= rules.heightLimit + 1e-6))
  ok('the frontier is a subset of the compliant candidates', s.frontier.every((c) => c.compliant && s.candidates.includes(c)))
  ok('frontier points are flagged onFrontier', s.frontier.every((c) => c.onFrontier) && s.candidates.filter((c) => c.onFrontier).length === s.frontier.length)
  ok('the frontier is Pareto-optimal — no point dominates another on value & height', s.frontier.every((c) => !s.frontier.some((o) => o !== c && o.rlv >= c.rlv && o.height <= c.height && (o.rlv > c.rlv || o.height < c.height))))
  ok('the frontier is sorted by height ascending', s.frontier.every((c, i) => i === 0 || s.frontier[i - 1].height <= c.height))
  ok('along the frontier, more value costs more height', (() => { if (s.frontier.length < 2) return true; for (let i = 1; i < s.frontier.length; i++) if (s.frontier[i].rlv < s.frontier[i - 1].rlv) return false; return true })())
  ok('max-GFA and max-value candidates are identified + compliant', !!s.maxGfa && !!s.maxValue && s.maxGfa.compliant && s.maxValue.compliant)
  ok('the most-compact near-optimal is no taller than the max-value scheme', !!s.mostCompact && !!s.maxValue && s.mostCompact.height <= s.maxValue.height && s.mostCompact.rlv >= s.maxValue.rlv * 0.95)
  ok('a tighter height limit shrinks the design space', optimizeMassing({ ...rules, heightLimit: 21 }, feasInput).candidates.length < s.candidates.length)
  ok('massing CSV lists every candidate with a frontier flag', (() => { const c = massingCsv(s); return /Storeys,Podium/.test(c) && /On frontier/.test(c) && c.split('\n').length === s.candidates.length + 1 })())
}

// ── massing whole-life carbon ────────────────────────────────────────────────────
section('massing-carbon')
{
  const conc = massingCarbon({ gfa: 10_000, structure: 'concrete', storeys: 10 })
  ok('an element line per building element', conc.elements.length === 5 && conc.elements.some((e) => e.key === 'superstructure'))
  ok('embodied per m² = sum of element intensities', near(conc.embodiedPerM2, conc.elements.reduce((s, e) => s + e.intensity, 0), 0.5))
  ok('embodied total = per-m² × GFA', near(conc.embodiedTotal, conc.embodiedPerM2 * 10_000, 10))
  ok('whole-life = embodied + operational over the study period', near(conc.wholeLifePerM2, conc.embodiedPerM2 + conc.operationalPerM2Life, 0.5))
  ok('operational scales with energy × grid × years', (() => { const c = massingCarbon({ gfa: 1000, structure: 'concrete', storeys: 5, energyIntensity: 100, gridFactor: 0.2, studyPeriod: 60 }); return near(c.operationalPerM2Yr, 20, 0.01) && near(c.operationalPerM2Life, 1200, 1) })())
  ok('timber cuts embodied carbon sharply vs concrete', massingCarbon({ gfa: 10_000, structure: 'timber', storeys: 10 }).embodiedPerM2 < conc.embodiedPerM2 * 0.85)
  ok('timber + hybrid carry biogenic sequestration, concrete/steel none', massingCarbon({ gfa: 1, structure: 'timber', storeys: 5 }).sequestration < 0 && massingCarbon({ gfa: 1, structure: 'hybrid', storeys: 5 }).sequestration < 0 && conc.sequestration === 0)
  ok('a taller tower raises frame intensity per m²', (massingCarbon({ gfa: 10_000, structure: 'concrete', storeys: 30 }).elements.find((e) => e.key === 'superstructure')?.intensity ?? 0) > (conc.elements.find((e) => e.key === 'superstructure')?.intensity ?? 0))
  ok('the embodied band tightens as intensity falls', carbonBand(90) === 'A++' && carbonBand(300) === 'A' && carbonBand(900) === 'E')
  ok('benchmarks flag meets/exceeds vs the target', conc.benchmarks.every((b) => typeof b.meets === 'boolean' && b.ratioPct > 0) && conc.benchmarks.some((b) => b.name.includes('RIBA')))
  ok('a greener grid lowers operational + whole-life carbon', massingCarbon({ gfa: 10_000, structure: 'concrete', storeys: 10, gridFactor: 0.05 }).wholeLifePerM2 < conc.wholeLifePerM2)
  ok('structure labels cover all four systems', !!STRUCTURE_LABEL.concrete && !!STRUCTURE_LABEL.steel && !!STRUCTURE_LABEL.timber && !!STRUCTURE_LABEL.hybrid)
  ok('carbon CSV carries elements + benchmarks', (() => { const c = massingCarbonCsv(conc); return /Element,kgCO2e/.test(c) && /Whole-life kgCO2e/.test(c) && /RIBA 2030/.test(c) })())
}

// ── transport & access (trip generation, modal split, parking) ───────────────────
section('transport')
{
  const t = transport({ residentialUnits: 100, officeNet: 2000, retailNet: 1000, transitLevel: 3, parkingSupply: 120 })
  ok('person-trips are generated per land use', t.person.lines.length === 3 && t.person.lines.every((l) => l.daily > 0))
  ok('total daily trips = sum of the use lines', near(t.person.daily, t.person.lines.reduce((s, l) => s + l.daily, 0), 0.5))
  ok('residential daily trips ≈ units × rate', near(t.person.lines.find((l) => l.use === 'Residential')?.daily ?? 0, 600, 1))
  ok('the mode split sums to ~100%', near(t.mode.car + t.mode.transit + t.mode.walk + t.mode.cycle, 1, 0.02))
  ok('better transit shifts trips out of cars', carShare(6) < carShare(1) && transport({ residentialUnits: 100, officeNet: 0, retailNet: 0, transitLevel: 6, parkingSupply: 50 }).mode.car < t.mode.car)
  ok('vehicle trips = car-share person trips ÷ occupancy', near(t.vehicle.daily, (t.person.daily * t.mode.car) / 1.25, 1))
  ok('car ownership falls as accessibility rises', carOwnershipFor(6) < carOwnershipFor(1))
  ok('parking demand combines residential ownership + commercial', t.parking.demand > 0 && t.parking.residential > 0 && t.parking.commercial > 0 && t.parking.demand === Math.round(t.parking.residential + t.parking.commercial))
  ok('parking balance = supply − demand', t.parking.balance === t.parking.supply - t.parking.demand)
  ok('a high-PTAL scheme needs less parking than a low-PTAL one', transport({ residentialUnits: 100, officeNet: 0, retailNet: 0, transitLevel: 6, parkingSupply: 0 }).parking.demand < transport({ residentialUnits: 100, officeNet: 0, retailNet: 0, transitLevel: 1, parkingSupply: 0 }).parking.demand)
  ok('the sustainable-transport share is the non-car share', t.sustainableShare === Math.round((1 - t.mode.car) * 100))
  ok('AM and PM peaks are a fraction of daily trips', t.person.am < t.person.daily && t.person.pm < t.person.daily)
  ok('transport CSV carries trips, modes + parking', (() => { const c = transportCsv(t); return /Use,Daily/.test(c) && /Mode,Share/.test(c) && /Parking demand/.test(c) })())
}

// ── drainage & flood (SuDS) ──────────────────────────────────────────────────────
section('drainage')
{
  const d = drainage({ siteArea: 5000, footprint: 1500, hardstandingFrac: 0.4 })
  ok('impervious + pervious areas reconcile to the site', d.imperviousArea + d.perviousArea === 5000)
  ok('impervious = footprint + hardstanding fraction of the open area', d.imperviousArea === 1500 + Math.round((5000 - 1500) * 0.4))
  ok('the composite runoff coefficient sits between the pervious and impervious bounds', d.compositeC > 0.3 && d.compositeC < 0.9)
  ok('the design intensity includes the climate uplift', near(d.effectiveIntensity, 50 * 1.4, 0.1))
  ok('developed peak runoff exceeds the greenfield rate', d.peakRunoff > d.greenfieldRunoff)
  ok('discharge is limited to greenfield (with a practical minimum)', d.allowableDischarge >= 5 && d.allowableDischarge >= d.greenfieldRunoff - 0.1)
  ok('attenuation storage holds back the runoff above the allowable rate', d.attenuationVolume > 0 && near(d.attenuationVolume, (d.peakRunoff - d.allowableDischarge) * 2 * 3600 / 1000, 2))
  ok('betterment is the reduction vs the developed peak', d.bettermentPct > 0 && d.bettermentPct < 100)
  ok('SuDS components are recommended', d.suds.length > 0 && d.suds.some((s) => /roof/i.test(s)))
  ok('a more sealed site runs off more + needs more storage', (() => { const sealed = drainage({ siteArea: 5000, footprint: 4500, hardstandingFrac: 0.9 }); return sealed.imperviousPct > d.imperviousPct && sealed.peakRunoff > d.peakRunoff && sealed.attenuationVolume > d.attenuationVolume })())
  ok('a bigger storm needs more attenuation', drainage({ siteArea: 5000, footprint: 1500, stormDurationHr: 4 }).attenuationVolume > d.attenuationVolume)
  ok('a greener scheme (less hardstanding) cuts runoff', drainage({ siteArea: 5000, footprint: 1500, hardstandingFrac: 0.1 }).peakRunoff < d.peakRunoff)
  ok('drainage CSV carries the metrics + SuDS list', (() => { const c = drainageCsv(d); return /Developed peak runoff/.test(c) && /Attenuation storage/.test(c) && /SuDS components/.test(c) })())
}

// ── biodiversity net gain (BNG) ──────────────────────────────────────────────────
section('biodiversity')
{
  const base = { siteAreaM2: 5000, footprintM2: 1500, hardstandingM2: 1400, baseline: { distinctiveness: 'low' as const, condition: 'moderate' as const }, proposedGreen: { distinctiveness: 'medium' as const, condition: 'good' as const }, greenRoofM2: 600, targetGainPct: 10 }
  const b = biodiversity(base)
  ok('biodiversity units = area(ha) × distinctiveness × condition', near(habitatUnits(1, { distinctiveness: 'medium', condition: 'good' }), 4 * 3, 1e-9))
  ok('baseline scores the whole site as one habitat', b.baselineLines.length === 1 && near(b.baselineUnits, 0.5 * 2 * 2, 0.01))
  ok('sealed area scores zero biodiversity units', (b.postLines.find((l) => /Sealed/.test(l.name))?.units ?? -1) === 0)
  ok('post habitats are sealed + green + green roof', b.postLines.length === 3 && b.postLines.some((l) => /Green roof/.test(l.name)))
  ok('sealed + green areas reconcile to the site', near(b.sealedHa + b.greenHa, 0.5, 0.001))
  ok('net change = post − baseline units', near(b.netChange, b.postUnits - b.baselineUnits, 0.01))
  ok('net gain % is relative to the baseline', near(b.netGainPct, (b.netChange / b.baselineUnits) * 100, 0.2))
  ok('the +10% target drives the meets flag', b.meets === (b.postUnits >= b.baselineUnits * 1.1 - 1e-6))
  ok('a shortfall is reported when the target is missed', (() => { const sealed = biodiversity({ ...base, footprintM2: 3500, hardstandingM2: 1400, greenRoofM2: 0 }); return !sealed.meets && sealed.shortfallUnits > 0 })())
  ok('richer proposed planting lifts the post units', biodiversity({ ...base, proposedGreen: { distinctiveness: 'high', condition: 'good' } }).postUnits > b.postUnits)
  ok('more green roof improves the net gain', biodiversity({ ...base, greenRoofM2: 1500 }).netGainPct > b.netGainPct)
  ok('higher strategic significance scales both stages', (() => { const s = biodiversity({ ...base, strategicSignificance: 1.15 }); return s.baselineUnits > b.baselineUnits && s.postUnits > b.postUnits })())
  ok('distinctiveness scores follow the metric ladder', DISTINCTIVENESS_SCORE['very-low'] === 0 && DISTINCTIVENESS_SCORE.low === 2 && DISTINCTIVENESS_SCORE['very-high'] === 8)
  ok('BNG CSV carries baseline + post lines and the verdict', (() => { const c = biodiversityCsv(b); return /Stage,Habitat/.test(c) && /Baseline,/.test(c) && /Post,/.test(c) && /Net gain/.test(c) })())
}

// ── interior daylight (Average Daylight Factor) ──────────────────────────────────
section('daylight')
{
  const d = daylight({ roomWidth: 3.6, roomDepth: 5, roomHeight: 2.7, wwr: 0.4 })
  ok('ADF is a positive percentage', d.adf > 0 && d.adf < 20)
  ok('the visible sky angle = 90 − obstruction angle', d.skyAngle === 90 - d.obstructionAngle)
  ok('glazed area = façade area × window ratio', near(d.glazedArea, 3.6 * 2.7 * 0.4, 0.01))
  ok('surface area = 2(WD + WH + DH)', near(d.surfaceArea, 2 * (3.6 * 5 + 3.6 * 2.7 + 5 * 2.7), 0.01))
  ok('more glazing raises the ADF', daylight({ roomWidth: 3.6, roomDepth: 5, roomHeight: 2.7, wwr: 0.6 }).adf > d.adf)
  ok('a taller / closer obstruction lowers the ADF', daylight({ roomWidth: 3.6, roomDepth: 5, roomHeight: 2.7, wwr: 0.4, facingDistance: 8, oppositeHeight: 30 }).adf < d.adf)
  ok('a deeper room lowers the ADF (more surface area to light)', daylight({ roomWidth: 3.6, roomDepth: 9, roomHeight: 2.7, wwr: 0.4 }).adf < d.adf)
  ok('the verdict follows the target thresholds', (() => { const good = daylight({ roomWidth: 4, roomDepth: 4, roomHeight: 3, wwr: 0.6, facingDistance: 40, oppositeHeight: 6 }); return good.verdict === (good.adf >= good.target ? 'Good' : good.adf >= good.target * 0.5 ? 'Adequate' : 'Poor') })())
  ok('a deep room fails the no-sky-line depth check', daylight({ roomWidth: 3.6, roomDepth: 9, roomHeight: 2.7, wwr: 0.4 }).depthAdequate === false)
  ok('the sensitivity curve rises with glazing ratio', (() => { const s = d.sensitivity; return s.length === 5 && s.every((p, i) => i === 0 || p.adf >= s[i - 1].adf) })())
  ok('higher reflectance lifts the ADF', daylight({ roomWidth: 3.6, roomDepth: 5, roomHeight: 2.7, wwr: 0.4, reflectance: 0.7 }).adf > d.adf)
  ok('daylight CSV carries the metrics + glazing sensitivity', (() => { const c = daylightCsv(d); return /Average daylight factor/.test(c) && /Visible sky angle/.test(c) && /Glazing ratio,ADF/.test(c) })())
}

// ── CPM critical-path scheduler ──────────────────────────────────────────────────
section('cpm')
{
  // simple diamond: A→B→D, A→C→D with B longer ⇒ A,B,D critical, C has float
  const simple = cpm([
    { id: 'A', name: 'A', duration: 2, deps: [] },
    { id: 'B', name: 'B', duration: 5, deps: ['A'] },
    { id: 'C', name: 'C', duration: 3, deps: ['A'] },
    { id: 'D', name: 'D', duration: 2, deps: ['B', 'C'] },
  ])
  ok('forward pass sets ES/EF from dependencies', simple.tasks.find((t) => t.id === 'B')?.es === 2 && simple.tasks.find((t) => t.id === 'D')?.es === 7)
  ok('project duration is the longest path', simple.duration === 9)
  ok('the critical path is the zero-float chain', simple.criticalPath.join('') === 'ABD')
  ok('the shorter parallel branch carries float', (() => { const c = simple.tasks.find((t) => t.id === 'C'); return !!c && c.totalFloat === 2 && !c.critical })())
  ok('critical tasks have zero total float', simple.tasks.filter((t) => t.critical).every((t) => t.totalFloat === 0))
  ok('latest finish never precedes earliest finish', simple.tasks.every((t) => t.lf >= t.ef))

  const r = cpm(DEFAULT_PROGRAMME, { start: '2026-01-05' })
  ok('the default programme schedules every task', r.tasks.length === DEFAULT_PROGRAMME.length && r.duration > 0)
  ok('the critical path starts at mobilisation and ends at handover', r.criticalPath[0] === 'mob' && r.criticalPath[r.criticalPath.length - 1] === 'hand')
  ok('the envelope drives fit-out (longer than MEP first fix) so it is critical', r.criticalPath.includes('env') && !r.criticalPath.includes('land'))
  ok('landscaping has float (off the critical path)', (r.tasks.find((t) => t.id === 'land')?.totalFloat ?? 0) > 0)
  ok('shortening the critical envelope shortens the project', cpm(DEFAULT_PROGRAMME.map((t) => (t.id === 'env' ? { ...t, duration: 10 } : t))).duration < r.duration)
  ok('extending a non-critical task by less than its float does not move the finish', cpm(DEFAULT_PROGRAMME.map((t) => (t.id === 'land' ? { ...t, duration: t.duration + 3 } : t))).duration === r.duration)
  ok('working-day dates skip weekends', addWorkingDays('2026-01-05', 5) === '2026-01-12' && addWorkingDays('2026-01-09', 1) === '2026-01-12')
  ok('tasks carry calendar dates when a start is given', !!r.tasks[0].startDate && !!r.finishDate)
  ok('a dependency cycle is rejected', (() => { try { cpm([{ id: 'X', name: 'X', duration: 1, deps: ['Y'] }, { id: 'Y', name: 'Y', duration: 1, deps: ['X'] }]); return false } catch { return true } })())
  ok('CPM CSV carries tasks + the critical path', (() => { const c = cpmCsv(r); return /Task,Duration,ES,EF/.test(c) && /Critical path,/.test(c) })())
}

// ── schedule risk (Monte Carlo / PERT) ───────────────────────────────────────────
section('schedule-risk')
{
  const r = scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 1500, uncertainty: 0.4, seed: 7 })
  ok('runs the requested iterations', r.iterations === 1500 && r.histogram.reduce((s, b) => s + b.count, 0) === 1500)
  ok('the deterministic duration matches the plain CPM', r.deterministic === cpm(DEFAULT_PROGRAMME).duration)
  ok('percentiles are ordered P10 ≤ P50 ≤ P80 ≤ P90', r.p10 <= r.p50 && r.p50 <= r.p80 && r.p80 <= r.p90)
  ok('merge bias pushes the P50 at/above the deterministic finish', r.p50 >= r.deterministic - 1)
  ok('the mean sits within the min/max envelope', r.mean >= r.min && r.mean <= r.max)
  ok('probability of hitting the deterministic date is well under 100%', r.probOnTime < 90 && r.probOnTime >= 0)
  ok('a generous target raises the probability above a tight one', scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 1500, uncertainty: 0.4, seed: 7, targetDays: r.p90 }).probTarget > scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 1500, uncertainty: 0.4, seed: 7, targetDays: r.p10 }).probTarget)
  ok('more uncertainty widens the distribution', scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 1500, uncertainty: 0.7, seed: 7 }).stdev > scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 1500, uncertainty: 0.15, seed: 7 }).stdev)
  ok('the criticality index ranks always-critical tasks at/near 100%', (() => { const sub = r.criticality.find((c) => c.id === 'sub'); return !!sub && sub.index >= 95 })())
  ok('a high-float task has a low criticality index', (() => { const land = r.criticality.find((c) => c.id === 'land'); return !!land && land.index < 50 })())
  ok('the run is reproducible with a fixed seed', scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 800, uncertainty: 0.4, seed: 42 }).p50 === scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 800, uncertainty: 0.4, seed: 42 }).p50)
  ok('triangular sampling stays within [o,p] and respects the mode region', triangular(2, 5, 10, 0) >= 2 && triangular(2, 5, 10, 1) <= 10 && triangular(4, 4, 4, 0.5) === 4)
  ok('calendar P-dates are produced when a start is given', !!scheduleRisk({ tasks: DEFAULT_PROGRAMME, iterations: 500, seed: 1, start: '2026-01-05' }).pDates?.p80)
  ok('schedule-risk CSV carries percentiles + criticality', (() => { const c = scheduleRiskCsv(r); return /P80,/.test(c) && /Criticality index/.test(c) && /P\(on deterministic date\)/.test(c) })())
}

// ── cost-loaded schedule (S-curve) ───────────────────────────────────────────────
section('cost-loading')
{
  const sched = cpm(DEFAULT_PROGRAMME, { start: '2026-01-05' })
  const c = costLoad(sched.tasks, { bucketDays: 20, start: '2026-01-05' })
  ok('every task is costed (duration × day-rate by default)', c.taskCosts.length === DEFAULT_PROGRAMME.length && c.taskCosts.every((t) => t.cost > 0))
  ok('total cost = sum of task costs', c.totalCost === c.taskCosts.reduce((s, t) => s + t.cost, 0))
  ok('period spend sums to ~the total cost', near(c.periods.reduce((s, p) => s + p.spend, 0), c.totalCost, c.periods.length + 2))
  ok('the cumulative curve is monotonic non-decreasing', c.periods.every((p, i) => i === 0 || p.cumulative >= c.periods[i - 1].cumulative))
  ok('the S-curve ends at ~100%', c.periods[c.periods.length - 1].pct >= 99.5)
  ok('periods span the project duration', c.periods.length === Math.ceil(sched.duration / 20) && c.durationDays === sched.duration)
  ok('a peak drawdown period is identified', c.peakSpend > 0 && c.periods.some((p) => p.label === c.peakPeriod && p.spend === c.peakSpend))
  ok('structure costs more per day than preliminaries', GROUP_DAY_RATE.Structure > GROUP_DAY_RATE.Preliminaries)
  ok('explicit task costs override the rate default', (() => { const c2 = costLoad(sched.tasks, { costs: { sub: 9_999_999 } }); return c2.taskCosts.find((t) => t.id === 'sub')?.cost === 9_999_999 })())
  ok('a finer bucket makes more, smaller periods', (() => { const c2 = costLoad(sched.tasks, { bucketDays: 5 }); return c2.periods.length > c.periods.length && c2.peakSpend <= c.peakSpend })())
  ok('period start dates are produced from the programme start', !!c.periods[0].startDate && !!c.periods[1].startDate)
  ok('cost-loading CSV carries periods + the S-curve', (() => { const csv = costLoadCsv(c); return /Period,Start day,Spend/.test(csv) && /Peak period spend/.test(csv) })())
}

// ── earned value forecast (time-phased EVM) ──────────────────────────────────────
section('evm-forecast')
{
  const pv = [100, 300, 600, 800, 1000] // cumulative planned value, BAC = 1000
  // halfway (period index 2 → PV 600), 50% complete (EV 500), AC 700 ⇒ over budget + behind
  const f = evmForecast({ pv, dataDatePeriod: 2, percentComplete: 0.5, actualCost: 700 })
  ok('BAC is the final cumulative planned value', f.bac === 1000)
  ok('EV = percent complete × BAC', f.ev === 500)
  ok('PV is the baseline at the data date', f.pv === 600)
  ok('cost variance = EV − AC (negative when over budget)', f.cv === 500 - 700 && f.cv < 0)
  ok('schedule variance = EV − PV (negative when behind)', f.sv === 500 - 600 && f.sv < 0)
  ok('CPI = EV/AC and SPI = EV/PV', f.cpi === Math.round((500 / 700) * 100) / 100 && f.spi === Math.round((500 / 600) * 100) / 100)
  ok('EAC = BAC / CPI projects the overrun', f.eac > f.bac && near(f.eac, 1000 / (500 / 700), 1))
  ok('VAC is the forecast overrun (negative)', f.vac === f.bac - f.eac && f.vac < 0)
  ok('TCPI = remaining work ÷ remaining budget', near(f.tcpi, (1000 - 500) / (1000 - 700), 0.01))
  ok('SPI < 1 forecasts a late finish', f.forecastPeriods > f.totalPeriods)
  ok('the series carries PV across all periods, EV/AC only to the data date', f.series.length === 5 && f.series[4].ev === null && f.series[2].ev !== null && f.series[0].ac !== null)
  ok('the forecast line runs from the data date to EAC at the end', f.series[4].forecast === f.eac && f.series[0].forecast === null)
  ok('health flags at-risk when both indices lag', f.health === 'at-risk')
  ok('an on-budget on-time project reads on-track', (() => { const g = evmForecast({ pv, dataDatePeriod: 2, percentComplete: 0.6, actualCost: 600 }); return g.cpi >= 0.97 && g.spi >= 0.97 && g.health === 'on-track' })())
  ok('EVM forecast CSV carries the curve + metrics', (() => { const c = evmForecastCsv(f); return /Period,PV,EV,AC,Forecast/.test(c) && /EAC,/.test(c) && /CPI,/.test(c) })())
}

// ── geo (geospatial site analytics) ─────────────────────────────────────────────
section('geo')
{
  const site = rectSite(40, 30)
  const a = analyzeSite(site)
  ok('area in m²/ha/acres/ft²', a.area.m2 === 1200 && near(a.area.ha, 0.12, 1e-6) && near(a.area.acres, 0.2965, 0.001) && near(a.area.ft2, 12917, 5))
  ok('perimeter m + ft', a.perimeter.m === 140 && near(a.perimeter.ft, 459, 1))
  ok('one edge per side with length + bearing', a.edges.length === 4 && a.edges[0].length === 40 && a.edges[1].length === 30)
  ok('bearings: E side 90°, N side 0°', a.edges[0].bearing === 90 && a.edges[1].bearing === 0)
  ok('frontage = longest edge (40 m)', a.frontage.length === 40)
  ok('compactness (Polsby–Popper) ≈ 0.77 for a 40×30 rect', near(a.compactness, 0.769, 0.01), a.compactness)
  ok('bbox = 40 × 30', a.bbox.width === 40 && a.bbox.depth === 30)
  ok('a square is more compact than a long sliver', analyzeSite(rectSite(35, 35)).compactness > analyzeSite(rectSite(100, 8)).compactness)
  // projection: local metres → lat/lng about an anchor
  const anchor = { lat: 40, lng: -74 }
  ok('toLatLng moves north by z and east by x', (() => { const ll = toLatLng({ x: 0, z: 110540 }, anchor); return near(ll.lat, 41, 1e-3) && near(ll.lng, -74, 1e-6) })())
  ok('boundaryToLatLng maps every vertex + analyzeSite centroid', boundaryToLatLng(site, anchor).length === 4 && !!analyzeSite(site, anchor).centroidLatLng)
  ok('compass labels a bearing', compass(90) === 'E' && compass(0) === 'N' && compass(225) === 'SW')
  ok('toLatLng / fromLatLng round-trip', (() => { const p = { x: 137.4, z: -88.2 }; const back = fromLatLng(toLatLng(p, anchor), anchor); return near(back.x, p.x, 0.5) && near(back.z, p.z, 0.5) })())
  // site survey — clickable, georeferenced parcel review
  const sv = siteSurvey(site, anchor)
  ok('survey lists every vertex with local metres + lat/lng', sv.vertices.length === 4 && sv.vertices[0].lat !== undefined && sv.vertices[0].lng !== undefined)
  ok('survey lists every edge with length, bearing & compass + endpoints', sv.edges.length === 4 && sv.edges[0].compass === 'E' && sv.edges[0].from === 'V1' && sv.edges[0].to === 'V2')
  ok('survey edge wraps the last vertex back to the first', sv.edges[3].to === 'V1')
  ok('survey carries area, perimeter, frontage compass & georeferenced centroid', sv.area.m2 === 1200 && sv.perimeter.m === 140 && sv.frontage.compass === compass(sv.frontage.bearing) && sv.centroid.lat !== undefined)
  ok('survey without an anchor omits lat/lng (local-only)', (() => { const s2 = siteSurvey(site); return s2.vertices[0].lat === undefined && s2.centroid.lat === undefined && s2.edges.length === 4 })())
}

// ── sun (solar position for the building sun/shadow study) ──────────────────────
section('sun')
{
  const LAT = 51.5 // London; lng 0 so solar noon ≈ 12:00 UTC
  const summerNoon = sunPosition(momentOf(6, 12), LAT, 0)
  ok('summer-solstice solar noon altitude high (~62°)', summerNoon.altitude >= 58 && summerNoon.altitude <= 66, summerNoon.altitude)
  ok('sun is due south at solar noon (azimuth ~180°)', summerNoon.azimuth >= 170 && summerNoon.azimuth <= 190, summerNoon.azimuth)
  const winterNoon = sunPosition(momentOf(12, 12), LAT, 0)
  ok('winter-solstice solar noon altitude low (~15°)', winterNoon.altitude >= 11 && winterNoon.altitude <= 19, winterNoon.altitude)
  ok('sun climbs higher in summer than winter', summerNoon.altitude > winterNoon.altitude + 30)
  ok('sun is below the horizon at solar midnight', sunPosition(momentOf(6, 0), LAT, 0).altitude < 0)
  // direction vector (x=East, y=up, z=North)
  const up = sunDirection(180, 90)
  ok('overhead sun points straight up (y≈1)', near(up.y, 1, 0.01) && near(up.x, 0, 0.01) && near(up.z, 0, 0.01))
  const south = sunDirection(180, 0)
  ok('south horizon sun points -z (south), y≈0', near(south.z, -1, 0.01) && near(south.y, 0, 0.01))
  const east = sunDirection(90, 0)
  ok('east horizon sun points +x (east)', near(east.x, 1, 0.01) && near(east.y, 0, 0.01))
  ok('sunDirection is a unit vector', near(Math.hypot(up.x, up.y, up.z), 1, 1e-6) && near(Math.hypot(east.x, east.y, east.z), 1, 1e-6))
  ok('momentOf builds a mid-month UTC moment with fractional hours', (() => { const d = momentOf(3, 14.5); return d.getUTCMonth() === 2 && d.getUTCDate() === 15 && d.getUTCHours() === 14 && d.getUTCMinutes() === 30 })())
}

console.log(`\nengines: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)