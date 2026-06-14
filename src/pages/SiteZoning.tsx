import { lazy, Suspense, useMemo, useState } from 'react'
import { Map as MapIcon, Maximize2, Building2, Layers, CheckCircle2, XCircle, RotateCcw, Upload, AlertTriangle, Download, FileJson, MousePointerClick, Crosshair, Landmark, Wand2, DollarSign, Car, Sun, GitCompare, Pin, Building, TrendingUp, LineChart, CalendarClock, Activity, Home, Scale, Sunrise } from 'lucide-react'
import { PageHeader, StatTile, Card, CardHeader, Badge, Tabs } from '@/components/ui'
import { SitePlan } from '@/components/SitePlan'
import { cn } from '@/lib/cn'
import { formatNumber, formatCurrency } from '@/lib/format'
import { PolygonEditor } from '@/components/PolygonEditor'
import { ScrollableTable } from '@/components/ScrollableTable'
import { downloadText } from '@/lib/download'
import { tableToCsv, type ReportTable } from '@/lib/report'
import {
  buildZoning, rectSite, parseGeoBoundary, scalePolygon, polygonArea, polygonCentroid,
  type Pt, type Zoning,
} from '@/lib/zoning'
import { analyzeSite, siteSurvey, compass, type LatLng, type SiteSurvey } from '@/lib/geo'
import { ZONING_PRESETS, presetById, type ProgrammeMix } from '@/lib/zoning-presets'
import { maximizeScheme, maximizeValue } from '@/lib/zoning-optimize'
import { feasibility, feasibilityWaterfall, feasibilityCsv, DEFAULT_RATES, type Use, type Feasibility } from '@/lib/feasibility'
import { shadowStudy } from '@/lib/shadow'
import { defaultNeighbours, overshadowing, overshadowingCsv, type Neighbour, type ContextStudy } from '@/lib/context-shadow'
import { appraise, quarterly, appraisalCsv } from '@/lib/appraisal'
import { tornado, dataTable, scenarios, sensitivityCsv, METRIC_LABEL, type Metric, type ScenarioBase, type TornadoBar, type DataTable as SensDataTable } from '@/lib/sensitivity'
import { accommodation, accommodationCsv, DEFAULT_UNIT_TYPES, type UnitMix } from '@/lib/unit-mix'
import { obligations, obligationsCsv, AFFORDABLE_TENURES, TENURE_LABEL, type AffordableTenure } from '@/lib/obligations'
import { amenitySunlight, sunlightCsv, type SunObstacle, type AmenitySunlight } from '@/lib/sunlight'
import { LineTrend } from '@/components/charts'
const SiteMap = lazy(() => import('@/components/SiteMap').then((m) => ({ default: m.SiteMap })))

const SiteZoningViewer = lazy(() => import('@/components/SiteZoningViewer').then((m) => ({ default: m.SiteZoningViewer })))

const ACC = 'teal' as const

/* Preset site boundaries (metres, centred on origin). */
const PRESETS: { id: string; label: string; pts: Pt[] }[] = [
  { id: 'rect', label: 'Rectangular lot', pts: rectSite(60, 45) },
  { id: 'corner', label: 'Corner lot', pts: [{ x: -35, z: -25 }, { x: 35, z: -25 }, { x: 35, z: 10 }, { x: 5, z: 10 }, { x: 5, z: 25 }, { x: -35, z: 25 }] },
  { id: 'wedge', label: 'Wedge / through-lot', pts: [{ x: -40, z: -20 }, { x: 40, z: -28 }, { x: 30, z: 26 }, { x: -30, z: 22 }] },
]

const DEFAULTS = { far: 4, heightLimit: 60, setback: 6, maxCoverage: 55, storeyHeight: 3.6, proposedGFA: 9000, proposedStoreys: 14, podium: 0.3, towerSetback: 0.35, skyBase: 24, skyStep: 0.3 }

export default function SiteZoning() {
  const [boundary, setBoundary] = useState<Pt[]>(PRESETS[0].pts)
  const [far, setFar] = useState(DEFAULTS.far)
  const [heightLimit, setHeightLimit] = useState(DEFAULTS.heightLimit)
  const [setback, setSetback] = useState(DEFAULTS.setback)
  const [maxCoverage, setMaxCoverage] = useState(DEFAULTS.maxCoverage)
  const [storeyHeight, setStoreyHeight] = useState(DEFAULTS.storeyHeight)
  const [proposedGFA, setProposedGFA] = useState(DEFAULTS.proposedGFA)
  const [proposedStoreys, setProposedStoreys] = useState(DEFAULTS.proposedStoreys)
  const [podium, setPodium] = useState(DEFAULTS.podium)
  const [towerSetback, setTowerSetback] = useState(DEFAULTS.towerSetback)
  const [skyBase, setSkyBase] = useState(DEFAULTS.skyBase)
  const [skyStep, setSkyStep] = useState(DEFAULTS.skyStep)
  const [geoText, setGeoText] = useState('')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<LatLng>({ lat: 40.7128, lng: -74.006 }) // where to place the parcel on the basemap
  // bumping this remounts the boundary editor so it refits its view after a
  // preset / import / reset; plain drags keep the same key (no jump).
  const [boundaryKey, setBoundaryKey] = useState(0)
  const applyBoundary = (pts: Pt[]) => { setBoundary(pts); setBoundaryKey((k) => k + 1) }
  const [presetId, setPresetId] = useState<string>('')
  const [mix, setMix] = useState<ProgrammeMix>({ residential: 0.6, office: 0.25, retail: 0.15 })
  const [targetMargin, setTargetMargin] = useState(18)
  const [investYield, setInvestYield] = useState(6)
  const [perEdge, setPerEdge] = useState(false)
  const [frontSb, setFrontSb] = useState(6)
  const [sideSb, setSideSb] = useState(4)
  const [rearSb, setRearSb] = useState(8)
  const [shadowMonth, setShadowMonth] = useState(6)
  const [schemeA, setSchemeA] = useState<null | { label: string; gfa: number; storeys: number; height: number; compliant: boolean; gdv: number; rlv: number; margin: number }>(null)
  const [neighbours, setNeighbours] = useState<Neighbour[] | null>(null) // null = auto from boundary
  const [contextOn, setContextOn] = useState(false)
  // development cashflow appraisal (DCF) programme + finance
  const [preMonths, setPreMonths] = useState(6)
  const [constructionMonths, setConstructionMonths] = useState(24)
  const [saleMonths, setSaleMonths] = useState(12)
  const [facilityRate, setFacilityRate] = useState(7.5)
  const [discountRate, setDiscountRate] = useState(10)
  const [useResidualLand, setUseResidualLand] = useState(true)
  const [landPrice, setLandPrice] = useState(12_000_000)
  const [sensMetric, setSensMetric] = useState<Metric>('profit')
  const [sensSwing, setSensSwing] = useState(0.1)
  const [unitMix, setUnitMix] = useState<UnitMix>({ studio: 0.1, '1b': 0.4, '2b': 0.4, '3b': 0.1 })
  const [affordablePct, setAffordablePct] = useState(0.3)
  const [tenureSplit, setTenureSplit] = useState<Record<AffordableTenure, number>>({ socialRent: 0.3, affordableRent: 0.3, sharedOwnership: 0.4 })
  const [cilPerM2, setCilPerM2] = useState(120)
  const [s106PerUnit, setS106PerUnit] = useState(8000)
  const [benchmarkLand, setBenchmarkLand] = useState(8_000_000)
  // apply a zoning district: load its rules + programme split
  const applyPreset = (id: string) => {
    const p = presetById(id); if (!p) return
    setPresetId(id)
    setFar(p.far); setHeightLimit(p.heightLimit); setSetback(p.setback); setMaxCoverage(p.maxCoverage); setSkyBase(p.skyBase); setSkyStep(p.skyStep)
    setMix({ residential: p.mix.residential, office: p.mix.office, retail: p.mix.retail })
  }

  const z: Zoning = useMemo(
    () => buildZoning({ boundary, far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep, setbacks: perEdge ? { front: frontSb, side: sideSb, rear: rearSb } : undefined }),
    [boundary, far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep, perEdge, frontSb, sideSb, rearSb],
  )
  const geo = useMemo(() => analyzeSite(boundary, anchor), [boundary, anchor])
  const survey = useMemo(() => siteSurvey(boundary, anchor), [boundary, anchor])
  const [siteSel, setSiteSel] = useState<string | null>(null)
  const [surveyTab, setSurveyTab] = useState('vertices')
  const selVertex = siteSel?.startsWith('v-') ? survey.vertices[Number(siteSel.slice(2))] : undefined
  const selEdge = siteSel?.startsWith('e-') ? survey.edges[Number(siteSel.slice(2))] : undefined
  const footprintPoly = useMemo(() => {
    const base = z.buildable.length >= 3 ? z.buildable : boundary
    const baseArea = polygonArea(base)
    const k = baseArea > 0 ? Math.sqrt(Math.min(1, z.proposed.footprint / baseArea)) : 0
    return k > 0 ? scalePolygon(base, k, polygonCentroid(base)) : []
  }, [z.buildable, z.proposed.footprint, boundary])

  // as-of-right maximiser: the GFA-maximal compliant scheme + binding constraint
  const optimum = useMemo(() => maximizeScheme({ boundary, far, heightLimit, setback, maxCoverage, storeyHeight, podium, towerSetback, skyBase, skyStep, setbacks: perEdge ? { front: frontSb, side: sideSb, rear: rearSb } : undefined }), [boundary, far, heightLimit, setback, maxCoverage, storeyHeight, podium, towerSetback, skyBase, skyStep, perEdge, frontSb, sideSb, rearSb])
  const maximize = () => { setProposedGFA(optimum.proposedGFA); setProposedStoreys(optimum.proposedStoreys) }
  // development feasibility / residual-land pro forma
  const feas = useMemo(() => feasibility({ gfa: proposedGFA, mix, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: investYield / 100, targetMarginPct: targetMargin }), [proposedGFA, mix, z.siteArea, z.buildableArea, investYield, targetMargin])
  // accommodation schedule — refine the residential line into a typed unit mix
  const residentialNet = useMemo(() => feas.lines.find((l) => l.use === 'residential')?.net ?? 0, [feas])
  const accom = useMemo(() => accommodation({ residentialNet, mix: unitMix, basePricePerM2: DEFAULT_RATES.residential.salePrice, siteAreaM2: z.siteArea }), [residentialNet, unitMix, z.siteArea])
  // affordable housing & planning obligations — apply policy, re-strike residual, test viability
  const residentialGdv = useMemo(() => feas.lines.find((l) => l.use === 'residential')?.revenue ?? 0, [feas])
  const oblig = useMemo(() => obligations({ marketGdv: feas.gdv, residentialGdv, totalUnits: accom.totalUnits, gfa: proposedGFA, affordablePct, tenureSplit, cilPerM2, s106PerUnit, totalCostExLand: feas.totalCostExLand, benchmarkLandValue: benchmarkLand, targetMarginPct: targetMargin }), [feas.gdv, residentialGdv, accom.totalUnits, proposedGFA, affordablePct, tenureSplit, cilPerM2, s106PerUnit, feas.totalCostExLand, benchmarkLand, targetMargin])
  // development cashflow appraisal — phase the static pro forma over a programme
  const saleRevenue = useMemo(() => feas.lines.filter((l) => l.tenure === 'sale').reduce((s, l) => s + l.revenue, 0), [feas])
  const investmentRevenue = useMemo(() => feas.lines.filter((l) => l.tenure === 'investment').reduce((s, l) => s + l.revenue, 0), [feas])
  const appraisalLand = useResidualLand ? feas.residualLandValue : landPrice
  const appraisal = useMemo(() => appraise({
    saleRevenue, investmentRevenue,
    costs: { construction: feas.construction, fees: feas.fees, contingency: feas.contingency, parking: feas.parking, demolition: feas.demolition, siteWorks: feas.siteWorks },
    land: appraisalLand, programme: { preMonths, constructionMonths, saleMonths }, annualInterest: facilityRate / 100, discountRate: discountRate / 100,
  }), [saleRevenue, investmentRevenue, feas.construction, feas.fees, feas.contingency, feas.parking, feas.demolition, feas.siteWorks, appraisalLand, preMonths, constructionMonths, saleMonths, facilityRate, discountRate])
  // sensitivity & scenarios — the risk lens on the appraisal (land held fixed so revenue/cost swings hit profit)
  const sensBase = useMemo<ScenarioBase>(() => ({ gfa: proposedGFA, mix, siteArea: z.siteArea, buildableArea: z.buildableArea, investmentYield: investYield / 100, targetMarginPct: targetMargin, programme: { preMonths, constructionMonths, saleMonths }, annualInterest: facilityRate / 100, discountRate: discountRate / 100, landMode: 'fixed', land: appraisalLand }), [proposedGFA, mix, z.siteArea, z.buildableArea, investYield, targetMargin, preMonths, constructionMonths, saleMonths, facilityRate, discountRate, appraisalLand])
  const sensValues = useMemo(() => [0.9, 0.95, 1, 1.05, 1.1], [])
  const torn = useMemo(() => tornado(sensBase, sensMetric, sensSwing), [sensBase, sensMetric, sensSwing])
  const dtable = useMemo(() => dataTable(sensBase, 'salePriceMult', sensValues, 'buildCostMult', sensValues, sensMetric), [sensBase, sensValues, sensMetric])
  const scen = useMemo(() => scenarios(sensBase, sensSwing), [sensBase, sensSwing])
  const shadow = useMemo(() => (footprintPoly.length >= 3 ? shadowStudy(footprintPoly, z.proposed.height, { lat: anchor.lat, lng: anchor.lng, month: shadowMonth }) : null), [footprintPoly, z.proposed.height, anchor.lat, anchor.lng, shadowMonth])
  const nbList = useMemo(() => neighbours ?? defaultNeighbours(boundary, 8, 24), [neighbours, boundary])
  const context = useMemo(() => (contextOn && footprintPoly.length >= 3 ? overshadowing(footprintPoly, z.proposed.height, nbList, { lat: anchor.lat, lng: anchor.lng, month: shadowMonth }) : null), [contextOn, footprintPoly, z.proposed.height, nbList, anchor.lat, anchor.lng, shadowMonth])
  // amenity sunlight — sun-hours on the open ground, shadowed by the proposal (+ neighbours when context is on)
  const sunObstacles = useMemo<SunObstacle[]>(() => {
    const obs: SunObstacle[] = footprintPoly.length >= 3 ? [{ footprint: footprintPoly, height: z.proposed.height }] : []
    if (contextOn) obs.push(...nbList.map((nb) => ({ footprint: nb.footprint, height: nb.height })))
    return obs
  }, [footprintPoly, z.proposed.height, contextOn, nbList])
  const sunlight = useMemo<AmenitySunlight | null>(() => { const space = z.buildable.length >= 3 ? z.buildable : boundary; return space.length >= 3 ? amenitySunlight(space, sunObstacles, { lat: anchor.lat, lng: anchor.lng, month: shadowMonth }) : null }, [z.buildable, boundary, sunObstacles, anchor.lat, anchor.lng, shadowMonth])
  const valueOpt = useMemo(() => maximizeValue({ boundary, far, heightLimit, setback, maxCoverage, storeyHeight, podium, towerSetback, skyBase, skyStep, setbacks: perEdge ? { front: frontSb, side: sideSb, rear: rearSb } : undefined }, { mix, investmentYield: investYield / 100, targetMarginPct: targetMargin }), [boundary, far, heightLimit, setback, maxCoverage, storeyHeight, podium, towerSetback, skyBase, skyStep, perEdge, frontSb, sideSb, rearSb, mix, investYield, targetMargin])
  const maximizeValueScheme = () => { setProposedGFA(valueOpt.proposedGFA); setProposedStoreys(valueOpt.proposedStoreys) }
  const setNbHeight = (id: string, h: number) => setNeighbours(nbList.map((n) => (n.id === id ? { ...n, height: h } : n)))
  const pinA = () => setSchemeA({ label: 'A', gfa: Math.round(proposedGFA), storeys: proposedStoreys, height: Math.round(z.proposed.height), compliant: z.compliance.overall, gdv: feas.gdv, rlv: feas.residualLandValue, margin: feas.marginOnCost })
  const schemeB = { label: 'B', gfa: Math.round(proposedGFA), storeys: proposedStoreys, height: Math.round(z.proposed.height), compliant: z.compliance.overall, gdv: feas.gdv, rlv: feas.residualLandValue, margin: feas.marginOnCost }

  const reset = () => {
    applyBoundary(PRESETS[0].pts); setFar(DEFAULTS.far); setHeightLimit(DEFAULTS.heightLimit); setSetback(DEFAULTS.setback)
    setMaxCoverage(DEFAULTS.maxCoverage); setStoreyHeight(DEFAULTS.storeyHeight); setProposedGFA(DEFAULTS.proposedGFA)
    setProposedStoreys(DEFAULTS.proposedStoreys); setPodium(DEFAULTS.podium); setTowerSetback(DEFAULTS.towerSetback)
    setSkyBase(DEFAULTS.skyBase); setSkyStep(DEFAULTS.skyStep); setGeoText(''); setGeoError(null)
    setPresetId(''); setMix({ residential: 0.6, office: 0.25, retail: 0.15 }); setTargetMargin(18); setInvestYield(6); setPerEdge(false); setFrontSb(6); setSideSb(4); setRearSb(8); setShadowMonth(6); setSchemeA(null); setNeighbours(null); setContextOn(false)
    setPreMonths(6); setConstructionMonths(24); setSaleMonths(12); setFacilityRate(7.5); setDiscountRate(10); setUseResidualLand(true); setLandPrice(12_000_000)
    setSensMetric('profit'); setSensSwing(0.1); setUnitMix({ studio: 0.1, '1b': 0.4, '2b': 0.4, '3b': 0.1 })
    setAffordablePct(0.3); setTenureSplit({ socialRent: 0.3, affordableRent: 0.3, sharedOwnership: 0.4 }); setCilPerM2(120); setS106PerUnit(8000); setBenchmarkLand(8_000_000)
  }
  const importGeo = () => {
    const pts = parseGeoBoundary(geoText)
    if (!pts) { setGeoError('Could not find a polygon ring. Paste a GeoJSON Polygon/Feature or a [[x,y],…] ring.'); return }
    setGeoError(null); applyBoundary(pts)
  }

  // structured data extracted from the zoning model — tier schedule + exports
  const tierRows = (): (string | number)[][] => [
    ...z.tiers.map((t, i) => [z.tiers.length > 1 ? (i === 0 ? 'Proposed podium' : 'Proposed tower') : 'Proposed mass', Math.round(t.footprint), Math.round(t.base), Math.round(t.top)]),
    ...z.envelopeTiers.map((t, i) => [z.envelopeTiers.length > 1 ? (i === 0 ? 'Envelope base' : 'Envelope upper') : 'Envelope', Math.round(t.footprint), Math.round(t.base), Math.round(t.top)]),
  ]
  const zoningCsv = (): string => {
    const summary: ReportTable = {
      title: 'Site & Zoning summary',
      columns: ['Metric', 'Value', 'Unit', 'Status / note'],
      rows: [
        ['Site area', Math.round(z.siteArea), 'm2', ''],
        ['Site perimeter', Math.round(z.sitePerimeter), 'm', ''],
        ['Buildable area', Math.round(z.buildableArea), 'm2', `${setback} m setback`],
        ['Max GFA', Math.round(z.maxGFA), 'm2', `FAR ${far}`],
        ['Proposed GFA', Math.round(proposedGFA), 'm2', z.compliance.far ? 'OK' : 'OVER'],
        ['Capacity used', Math.round(z.utilisation), '%', ''],
        ['Proposed height', Math.round(z.proposed.height), 'm', `${z.compliance.height ? 'OK' : 'OVER'} (limit ${z.maxHeight})`],
        ['Site coverage', Math.round(z.proposed.coverage), '%', `${z.compliance.coverage ? 'OK' : 'OVER'} (max ${maxCoverage})`],
        ['Footprint', Math.round(z.proposed.footprint), 'm2', z.compliance.setback ? 'OK' : 'OVER'],
        ['Sky-exposure plane', skyBase > 0 ? skyBase : 'off', skyBase > 0 ? 'm' : '', skyBase > 0 ? (z.compliance.skyPlane ? 'OK' : 'OVER') : ''],
        ['Compliance', z.compliance.overall ? 'COMPLIANT' : 'NON-COMPLIANT', '', ''],
      ],
    }
    const tiers: ReportTable = { title: 'Tiers', columns: ['Tier', 'Footprint (m2)', 'From (m)', 'To (m)'], rows: tierRows() }
    return `${tableToCsv(summary)}\n\n${tableToCsv(tiers)}`
  }
  const zoningJson = (): string => JSON.stringify({
    inputs: { far, heightLimit, setback, maxCoverage, storeyHeight, proposedGFA, proposedStoreys, podium, towerSetback, skyBase, skyStep },
    boundary, zoning: z,
  }, null, 2)

  return (
    <div className="space-y-8">
      <PageHeader
        icon={MapIcon}
        accent={ACC}
        eyebrow="Intelligence"
        title="Site & Zoning"
        description="A site feasibility studio: draw or import a boundary, load a zoning district (or set FAR / height / setback / coverage / sky-plane by hand), and the buildable area, legal massing envelope and live compliance recompute instantly. One click maximizes the as-of-right scheme; a development pro forma turns the GFA into revenue, costs and the residual land value the site supports. Real planning + feasibility math, not a static diagram."
        actions={<button onClick={reset} className="btn-ghost"><RotateCcw className="h-4 w-4" /> Reset</button>}
      />

      {/* compliance + capacity KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Site area" value={`${formatNumber(Math.round(z.siteArea))} m²`} icon={Maximize2} accent="teal" sub={`${formatNumber(Math.round(z.sitePerimeter))} m perimeter`} />
        <StatTile label="Max GFA (FAR)" value={`${formatNumber(Math.round(z.maxGFA))} m²`} icon={Layers} accent="sky" sub={`FAR ${far} · buildable ${formatNumber(Math.round(z.buildableArea))} m²`} />
        <StatTile label="Proposed GFA" value={`${formatNumber(Math.round(proposedGFA))} m²`} icon={Building2} accent="blue" sub={`${proposedStoreys} storeys · ${Math.round(z.proposed.height)} m`} />
        <StatTile label="Capacity used" value={`${Math.round(z.utilisation)}%`} icon={Layers} accent={z.utilisation > 100 ? 'rose' : z.utilisation > 90 ? 'amber' : 'emerald'} sub="Proposed ÷ max GFA" />
        <StatTile label="Zoning" value={z.compliance.overall ? 'Compliant' : 'Non-compliant'} icon={z.compliance.overall ? CheckCircle2 : XCircle} accent={z.compliance.overall ? 'emerald' : 'rose'} sub={z.compliance.overall ? 'Within all limits' : 'Exceeds a limit'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 3D envelope */}
        <Card className="lg:col-span-3">
          <CardHeader icon={MapIcon} accent={ACC} title="Massing envelope" subtitle="White = boundary · amber dashed = setback · blue = legal envelope (stepped at the sky plane) · solid = proposed podium + tower (green fits, red busts)" />
          <div className="border-t border-edge/50">
            <Suspense fallback={<div style={{ height: 460 }} className="grid place-items-center text-sm text-slate-500">Loading 3D model…</div>}>
              <SiteZoningViewer boundary={boundary} buildable={z.buildable} maxHeight={z.maxHeight} tiers={z.tiers} envelopeTiers={z.envelopeTiers} proposedHeight={z.proposed.height} compliant={z.compliance.overall} neighbours={contextOn ? nbList : []} height={460} />
            </Suspense>
            <p className="border-t border-edge/50 px-4 py-2 text-[11px] text-slate-500">Drag or arrow-keys to orbit · scroll to zoom. The proposed mass is sized to its footprint (GFA ÷ storeys) and nested in the setback line.</p>
          </div>
        </Card>

        {/* controls */}
        <Card className="lg:col-span-2">
          <CardHeader icon={Building2} accent="blue" title="Zoning & scheme — editable" subtitle="Tune the rules and the proposal; everything recomputes live" />
          <div className="space-y-4 border-t border-edge/50 p-5">
            <div data-zoning-district>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"><Landmark className="h-3.5 w-3.5" /> Zoning district — load a rulebook</div>
              <select value={presetId} onChange={(e) => applyPreset(e.target.value)} aria-label="Zoning district preset" className="w-full rounded-lg border border-edge/60 bg-elevated/50 px-2.5 py-1.5 text-sm text-slate-100 focus:border-teal-500/50 focus:outline-none">
                <option value="">Custom rules…</option>
                {ZONING_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {presetId && <p className="mt-1 text-[11px] text-slate-500">{presetById(presetId)?.blurb}</p>}
            </div>
            <div data-zoning-maximize className="flex items-center justify-between gap-2 rounded-lg border border-teal-500/25 bg-teal-500/[0.06] px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-teal-100">As-of-right maximum</div>
                <div className="truncate text-[11px] text-slate-400">{formatNumber(optimum.proposedGFA)} m² · {optimum.proposedStoreys} storeys · binds on <span className="text-teal-200">{optimum.binding}</span></div>
              </div>
              <button onClick={maximize} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-500/20 px-2.5 py-1 text-xs font-medium text-teal-100 ring-1 ring-inset ring-teal-500/40 hover:bg-teal-500/30"><Wand2 className="h-3.5 w-3.5" /> Maximize</button>
            </div>
            <div data-value-maximize className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-emerald-100">Value-optimal massing</div>
                <div className="truncate text-[11px] text-slate-400">{formatNumber(valueOpt.proposedGFA)} m² · {valueOpt.proposedStoreys} storeys · land {formatCurrency(valueOpt.residualLandValue, { compact: true })}</div>
              </div>
              <button onClick={maximizeValueScheme} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100 ring-1 ring-inset ring-emerald-500/40 hover:bg-emerald-500/30"><TrendingUp className="h-3.5 w-3.5" /> Max value</button>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Site boundary — draw your own</div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const active = boundary === p.pts
                  return (
                    <button key={p.id} onClick={() => applyBoundary(p.pts)} aria-pressed={active} className={cn('rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors', active ? 'bg-teal-500/15 text-teal-200 ring-teal-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <PolygonEditor key={boundaryKey} value={boundary} onChange={setBoundary} accent="#2dd4bf" height={220} />
            </div>
            <Range label="FAR (floor area ratio)" value={far} min={0.5} max={15} step={0.1} onChange={setFar} fmt={(v) => v.toFixed(1)} />
            <Range label="Height limit" unit="m" value={heightLimit} min={10} max={300} step={1} onChange={setHeightLimit} />
            <div data-peredge>
              <label className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-300">Setback</span>
                <button onClick={() => setPerEdge((v) => !v)} aria-pressed={perEdge} className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors', perEdge ? 'bg-teal-500/20 text-teal-100 ring-teal-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50')}>{perEdge ? 'Per-edge (front/side/rear)' : 'Uniform'}</button>
              </label>
              {perEdge ? (
                <div className="space-y-2.5 rounded-lg bg-elevated/20 p-2.5 ring-1 ring-inset ring-edge/40">
                  <Range label="Front (frontage)" unit="m" value={frontSb} min={0} max={20} step={0.5} onChange={setFrontSb} fmt={(v) => v.toFixed(1)} />
                  <Range label="Sides" unit="m" value={sideSb} min={0} max={20} step={0.5} onChange={setSideSb} fmt={(v) => v.toFixed(1)} />
                  <Range label="Rear" unit="m" value={rearSb} min={0} max={20} step={0.5} onChange={setRearSb} fmt={(v) => v.toFixed(1)} />
                  <p className="text-[11px] text-slate-500">The longest edge is the frontage; the most-opposite edge is the rear. The buildable envelope insets each edge by its own setback.</p>
                </div>
              ) : (
                <input type="range" min={0} max={20} step={0.5} value={setback} onChange={(e) => setSetback(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-teal-500" aria-label="Setback" />
              )}
            </div>
            <Range label="Max site coverage" unit="%" value={maxCoverage} min={10} max={100} step={1} onChange={setMaxCoverage} />
            <div className="grid grid-cols-2 gap-3 border-t border-edge/40 pt-4">
              <Num label="Proposed GFA" unit="m²" value={proposedGFA} step={1000} onChange={(v) => setProposedGFA(Math.max(0, v))} />
              <Num label="Storeys" value={proposedStoreys} step={1} onChange={(v) => setProposedStoreys(Math.max(1, Math.round(v)))} />
              <Num label="Storey height" unit="m" value={storeyHeight} step={0.1} onChange={(v) => setStoreyHeight(Math.max(2, v))} />
            </div>
            <Range label="Podium" value={podium} min={0} max={0.8} step={0.05} onChange={setPodium} fmt={(v) => (v === 0 ? 'none' : `${Math.round(v * 100)}% of storeys`)} />
            <Range label="Tower setback" value={towerSetback} min={0} max={0.6} step={0.02} onChange={setTowerSetback} fmt={(v) => `${Math.round(v * 100)}%`} />
            <Range label="Sky-exposure base" unit="m" value={skyBase} min={0} max={120} step={2} onChange={setSkyBase} fmt={(v) => (v === 0 ? 'off' : `${v} m`)} />
            <Range label="Sky-plane step-in" value={skyStep} min={0} max={0.6} step={0.02} onChange={setSkyStep} fmt={(v) => `${Math.round(v * 100)}%`} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* plan diagram */}
        <Card className="lg:col-span-3">
          <CardHeader icon={Maximize2} accent="amber" title="Site plan" subtitle="Top-down — boundary, setback and the proposed footprint" />
          <div className="border-t border-edge/50 p-5">
            <PlanDiagram z={z} boundary={boundary} />
          </div>
        </Card>

        {/* compliance breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader icon={z.compliance.overall ? CheckCircle2 : AlertTriangle} accent={z.compliance.overall ? 'emerald' : 'rose'} title="Compliance" subtitle="Each zoning test against the proposal" />
          <div className="space-y-2.5 border-t border-edge/50 p-5">
            <CheckRow ok={z.compliance.far} label="FAR / GFA" detail={`${formatNumber(Math.round(proposedGFA))} ≤ ${formatNumber(Math.round(z.maxGFA))} m²`} />
            <CheckRow ok={z.compliance.height} label="Height" detail={`${Math.round(z.proposed.height)} ≤ ${Math.round(z.maxHeight)} m`} />
            <CheckRow ok={z.compliance.coverage} label="Site coverage" detail={`${z.proposed.coverage.toFixed(0)}% ≤ ${maxCoverage}%`} />
            <CheckRow ok={z.compliance.setback} label="Footprint within setback" detail={`${formatNumber(Math.round(z.proposed.footprint))} ≤ ${formatNumber(Math.round(z.buildableArea))} m²`} />
            {skyBase > 0 && z.envelopeTiers.length > 1 && (
              <CheckRow ok={z.compliance.skyPlane} label={`Sky-exposure plane (${skyBase} m)`} detail={`${formatNumber(Math.round(z.tiers.reduce((m, t) => (t.top > skyBase ? Math.max(m, t.footprint) : m), 0)))} ≤ ${formatNumber(Math.round(z.envelopeTiers[1].footprint))} m² above`} />
            )}
            <p className="pt-1 text-[13px] leading-relaxed text-slate-300">{narrative(z, proposedGFA)}</p>
          </div>
        </Card>
      </div>

      {/* actual site on a basemap + geospatial analytics */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={MapIcon} accent="emerald" title="Site map — place & draw your parcel" subtitle="Search an address (or click the map) to place the site, drag its vertices to reshape it on the imagery, or draw a brand-new boundary. Amber dashed = setback · green = proposed footprint." />
          <div className="space-y-3 border-t border-edge/50 p-4">
            <Suspense fallback={<div style={{ height: 420 }} className="grid place-items-center text-sm text-slate-500">Loading map…</div>}>
              <SiteMap
                anchor={anchor}
                editable
                boundary={boundary}
                onBoundaryChange={applyBoundary}
                onAnchorChange={setAnchor}
                overlays={[...(z.buildable.length >= 3 ? [{ points: z.buildable, color: '#fbbf24', dashed: true }] : []), ...(footprintPoly.length >= 3 ? [{ points: footprintPoly, color: '#22c55e', fill: 0.5 }] : [])]}
                height={440}
              />
            </Suspense>
            <div className="flex flex-wrap items-end gap-3 border-t border-edge/40 pt-3">
              <label className="block"><span className="mb-1 block text-xs text-slate-400">Latitude</span><input type="number" step={0.0005} value={anchor.lat} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAnchor((a) => ({ ...a, lat: v })) }} className="w-32 rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" /></label>
              <label className="block"><span className="mb-1 block text-xs text-slate-400">Longitude</span><input type="number" step={0.0005} value={anchor.lng} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setAnchor((a) => ({ ...a, lng: v })) }} className="w-32 rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" /></label>
              <p className="text-[11px] text-slate-500">Precise coordinates — or just use the map above.</p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Maximize2} accent="teal" title="Geospatial analytics" subtitle="Computed from the boundary" />
          <div className="space-y-4 border-t border-edge/50 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Area" value={`${formatNumber(geo.area.m2)} m²`} sub={`${geo.area.ha} ha · ${geo.area.acres} ac`} />
              <Metric label="Perimeter" value={`${formatNumber(geo.perimeter.m)} m`} sub={`${formatNumber(geo.perimeter.ft)} ft`} />
              <Metric label="Frontage" value={`${formatNumber(geo.frontage.length)} m`} sub={`${compass(geo.frontage.bearing)} · ${geo.frontage.bearing}°`} />
              <Metric label="Compactness" value={`${geo.compactness}`} sub="1.0 = circle" />
              <Metric label="Extent" value={`${geo.bbox.width} × ${geo.bbox.depth} m`} sub="bounding box" />
              <Metric label="Centroid" value={geo.centroidLatLng ? `${geo.centroidLatLng.lat}` : '—'} sub={geo.centroidLatLng ? `${geo.centroidLatLng.lng}` : 'lat / lng'} />
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Edges</div>
              <div className="max-h-40 space-y-1 overflow-auto pr-1">
                {geo.edges.map((e) => (
                  <div key={e.index} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Edge {e.index + 1}</span>
                    <span className="data-mono text-slate-300">{formatNumber(e.length)} m</span>
                    <span className="data-mono text-slate-400">{compass(e.bearing)} {e.bearing}°</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* site survey — clickable parcel coordinates, edges & bearings */}
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader icon={Crosshair} accent="teal" title="Site survey & coordinates" subtitle="The actual parcel — click a numbered vertex or an edge to read its coordinates, length & bearing. White = boundary · amber dashed = setback · green = proposed footprint." />
          <div className="border-t border-edge/50 p-4">
            <SitePlan boundary={boundary} buildable={z.buildable.length >= 3 ? z.buildable : undefined} footprint={footprintPoly.length >= 3 ? footprintPoly : undefined} selected={siteSel} onSelect={setSiteSel} height={360} />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" /> Vertex (V#)</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-slate-200" /> Boundary edge (E#)</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> Selected</span>
              {anchor && <span className="ml-auto data-mono text-slate-500">centroid {survey.centroid.lat}, {survey.centroid.lng}</span>}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col lg:col-span-2">
          <CardHeader icon={MousePointerClick} accent="violet" title="Survey inspector" subtitle="Coordinates & bearing of the selected vertex or edge." />
          <div className="border-t border-edge/50 p-5">
            {selVertex ? (
              <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                <SiteRow k="Vertex" v={selVertex.label} />
                <SiteRow k="Local E (x)" v={`${selVertex.x} m`} />
                <SiteRow k="Local N (z)" v={`${selVertex.z} m`} />
                <SiteRow k="Latitude" v={selVertex.lat !== undefined ? `${selVertex.lat}°` : '— set location'} />
                <SiteRow k="Longitude" v={selVertex.lng !== undefined ? `${selVertex.lng}°` : '—'} />
              </dl>
            ) : selEdge ? (
              <dl className="divide-y divide-edge/40 rounded-lg ring-1 ring-edge/50">
                <SiteRow k="Edge" v={`${selEdge.label} (${selEdge.from}→${selEdge.to})`} />
                <SiteRow k="Length" v={`${formatNumber(selEdge.length)} m`} />
                <SiteRow k="Bearing" v={`${selEdge.bearing}°`} />
                <SiteRow k="Direction" v={`${selEdge.compass}`} />
                <SiteRow k="Frontage" v={selEdge.index === survey.frontage.index ? 'Yes — longest edge' : 'No'} />
              </dl>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <MousePointerClick className="h-7 w-7 text-slate-600" />
                <p className="text-sm text-slate-400">Click any vertex or edge on the plan — or a row below — to read its survey data.</p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-edge/40 pt-4 text-center">
              <div><div className="data-mono text-lg text-slate-100">{formatNumber(survey.area.m2)}</div><div className="text-[11px] text-slate-500">m² · {survey.area.acres} ac</div></div>
              <div><div className="data-mono text-lg text-slate-100">{formatNumber(survey.perimeter.m)}</div><div className="text-[11px] text-slate-500">m perimeter</div></div>
            </div>
          </div>
        </Card>
      </div>

      {/* survey tables — vertices & edges, exportable */}
      <Card>
        <CardHeader
          icon={Layers} accent="teal" title="Survey schedule" subtitle="Every boundary vertex (local metres + lat/lng) and edge (length, bearing, compass). Click a row to locate it; export for CAD/GIS."
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => downloadText('site-survey-vertices.csv', vertCsv(survey), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> Vertices</button>
              <button onClick={() => downloadText('site-survey-edges.csv', edgeCsv(survey), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> Edges</button>
              <button onClick={() => downloadText('site-survey.json', JSON.stringify(survey, null, 2), 'JSON')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-3.5 w-3.5" /> JSON</button>
            </div>
          }
        />
        <div className="border-t border-edge/50 p-4">
          <Tabs tabs={[{ id: 'vertices', label: `Vertices (${survey.vertices.length})` }, { id: 'edges', label: `Edges (${survey.edges.length})` }]} active={surveyTab} onChange={setSurveyTab} className="mb-3" />
          <ScrollableTable label={`Site ${surveyTab}`}>
            {surveyTab === 'vertices' ? (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-3 py-2 font-medium">Vertex</th><th className="px-3 py-2 text-right font-medium">E / x (m)</th><th className="px-3 py-2 text-right font-medium">N / z (m)</th><th className="px-3 py-2 text-right font-medium">Latitude</th><th className="px-3 py-2 text-right font-medium">Longitude</th></tr></thead>
                <tbody>
                  {survey.vertices.map((v) => {
                    const on = siteSel === `v-${v.index}`
                    return (
                      <tr key={v.index} onClick={() => setSiteSel(`v-${v.index}`)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', on ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                        <td className="px-3 py-1.5 font-medium text-slate-200">{v.label}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-300">{v.x}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-300">{v.z}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-400">{v.lat ?? '—'}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-400">{v.lng ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-3 py-2 font-medium">Edge</th><th className="px-3 py-2 font-medium">From→To</th><th className="px-3 py-2 text-right font-medium">Length (m)</th><th className="px-3 py-2 text-right font-medium">Bearing</th><th className="px-3 py-2 text-right font-medium">Compass</th></tr></thead>
                <tbody>
                  {survey.edges.map((e) => {
                    const on = siteSel === `e-${e.index}`
                    return (
                      <tr key={e.index} onClick={() => setSiteSel(`e-${e.index}`)} className={cn('cursor-pointer border-b border-edge/30 transition-colors', on ? 'bg-amber-500/10' : 'hover:bg-elevated/40')}>
                        <td className="px-3 py-1.5 font-medium text-slate-200">{e.label}{e.index === survey.frontage.index ? ' ★' : ''}</td>
                        <td className="data-mono px-3 py-1.5 text-slate-400">{e.from}→{e.to}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(e.length)}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-300">{e.bearing}°</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-400">{e.compass}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </ScrollableTable>
          <p className="mt-2 text-[11px] text-slate-500">★ = frontage (longest edge). Local coordinates are metres about the parcel origin; lat/lng appear once a map location is set.</p>
        </div>
      </Card>

      {/* development feasibility — residual-land pro forma */}
      <Card data-feasibility>
        <CardHeader
          icon={DollarSign} accent="emerald" title="Development feasibility — residual land value"
          subtitle="The proposed GFA, split by programme, run as a developer's pro forma: net saleable/lettable area and unit counts, revenue (sales + capitalised rent), the construction/fees/finance/parking cost stack, and the land value the scheme supports at your target margin. Indicative design-stage rates — a feasibility model, not an appraisal."
          action={<button onClick={() => downloadText('site-feasibility.csv', feasibilityCsv(feas), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="GDV (value)" value={formatCurrency(feas.gdv, { compact: true })} sub={`$${formatNumber(feas.perM2.gdv)}/m²`} />
          <Metric label="Total cost (ex land)" value={formatCurrency(feas.totalCostExLand, { compact: true })} sub={`$${formatNumber(feas.perM2.cost)}/m²`} />
          <Metric label="Residual land value" value={formatCurrency(feas.residualLandValue, { compact: true })} sub={`at ${targetMargin}% margin`} />
          <Metric label="Land $/site m²" value={formatCurrency(feas.landPerSiteM2, { compact: true })} sub={`${formatNumber(Math.round(z.siteArea))} m² site`} />
          <Metric label="Margin (land-free)" value={`${feas.marginOnCost}%`} sub="profit ÷ cost" />
          <Metric label="Net area · units" value={`${formatNumber(feas.netArea)} m²`} sub={`${formatNumber(feas.units)} units · ${formatNumber(feas.parkingBays)} bays`} />
        </div>
        {/* programme mix sliders */}
        <div className="grid gap-4 border-t border-edge/50 p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Programme mix</div>
            {(['residential', 'office', 'retail'] as Use[]).map((u) => (
              <Range key={u} label={u.charAt(0).toUpperCase() + u.slice(1)} value={mix[u]} min={0} max={1} step={0.05} onChange={(v) => setMix((m) => ({ ...m, [u]: v }))} fmt={(v) => `${Math.round(v * 100)}%`} />
            ))}
            <Range label="Target margin" unit="%" value={targetMargin} min={5} max={35} step={1} onChange={setTargetMargin} />
            <Range label="Investment yield (cap rate)" unit="%" value={investYield} min={3} max={10} step={0.25} onChange={setInvestYield} fmt={(v) => v.toFixed(2)} />
          </div>
          {/* cost / value waterfall */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Cost stack vs value</div>
            <div className="space-y-1.5">
              {feasibilityWaterfall(feas).map((row) => {
                const max = Math.max(feas.gdv, feas.totalCostExLand + feas.residualLandValue, 1)
                const col = row.kind === 'value' ? 'bg-emerald-500/70' : row.label === 'Residual land' ? 'bg-teal-500/60' : 'bg-slate-500/60'
                return (
                  <div key={row.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 truncate text-slate-400">{row.label}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded bg-base/60 ring-1 ring-inset ring-edge/40"><div className={cn('h-3 rounded', col)} style={{ width: `${(row.value / max) * 100}%` }} /></div>
                    <span className="data-mono w-16 shrink-0 text-right text-slate-300">{formatCurrency(row.value, { compact: true })}</span>
                  </div>
                )
              })}
            </div>
            <p className={cn('mt-3 rounded-lg px-3 py-2 text-[13px] leading-relaxed ring-1 ring-inset', feas.profitAtZeroLand > 0 ? 'bg-emerald-500/[0.06] text-slate-300 ring-emerald-500/25' : 'bg-rose-500/[0.06] text-rose-200 ring-rose-500/30')}>{feas.headline}</p>
          </div>
        </div>
        <div className="border-t border-edge/50 p-4">
          <ScrollableTable label="Programme by use">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Use', 'GFA (m²)', 'Net (m²)', 'Units', 'Tenure', 'Build cost', 'Revenue'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i !== 4 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {feas.lines.filter((l) => l.gfa > 0).map((l) => (
                  <tr key={l.use} className="border-b border-edge/30 hover:bg-elevated/40">
                    <td className="px-3 py-1.5 font-medium capitalize text-slate-200">{l.use}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(l.gfa)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(l.net)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(l.units)}</td>
                    <td className="px-3 py-1.5"><Badge variant={l.tenure === 'sale' ? 'success' : 'cyan'}>{l.tenure}</Badge></td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-400">{formatCurrency(l.buildCost, { compact: true })}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatCurrency(l.revenue, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><Car className="h-3.5 w-3.5 shrink-0" /> {formatNumber(feas.parkingBays)} parking bays required from the programme ({formatCurrency(feas.parking, { compact: true })}). Default rates: resi ${DEFAULT_RATES.residential.buildCost}/m² build · ${DEFAULT_RATES.residential.salePrice}/m² sale; office/retail capitalised at {investYield}%. Tune the mix, margin and yield above.</p>
        </div>
      </Card>

      {/* accommodation schedule — unit mix */}
      <Card data-accommodation>
        <CardHeader
          icon={Home} accent="cyan" title="Accommodation schedule — unit mix"
          subtitle="The residential floorspace broken into a typed dwelling mix — studio / 1–3 bed — solved so the integer unit counts fill the net area. Reports the planning numbers a submission needs: bed spaces, habitable rooms, average dwelling size, density per hectare and a blended sales rate. Tune the mix and the schedule re-solves."
          action={<button onClick={() => downloadText('site-accommodation.csv', accommodationCsv(accom), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Dwellings" value={formatNumber(accom.totalUnits)} sub={`${formatNumber(accom.totalNet)} m² net`} />
          <Metric label="Avg size" value={`${accom.avgSize} m²`} sub="net per dwelling" />
          <Metric label="Bed spaces" value={formatNumber(accom.bedSpaces)} sub="design occupancy" />
          <Metric label="Habitable rooms" value={formatNumber(accom.habitableRooms)} sub={`${accom.densityHrPerHa}/ha`} />
          <Metric label="Density" value={`${accom.densityUnitsPerHa}`} sub="dwellings/ha" />
          <Metric label="Blended rate" value={`$${formatNumber(accom.blendedPricePerM2)}`} sub="per m² net" />
        </div>
        <div className="grid gap-5 border-t border-edge/50 p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Mix by dwelling count</div>
            {DEFAULT_UNIT_TYPES.map((t) => (
              <Range key={t.key} label={`${t.label} · ${t.size} m²`} value={unitMix[t.key] ?? 0} min={0} max={1} step={0.05} onChange={(v) => setUnitMix((m) => ({ ...m, [t.key]: v }))} fmt={(v) => `${Math.round(v * 100)}%`} />
            ))}
            <div className="mt-1 flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-edge/50">
              {accom.lines.map((l, i) => {
                const cols = ['bg-cyan-500/70', 'bg-sky-500/70', 'bg-teal-500/70', 'bg-emerald-500/70']
                const pct = accom.totalUnits > 0 ? (l.units / accom.totalUnits) * 100 : 0
                return pct > 0 ? <div key={l.key} className={cols[i % cols.length]} style={{ width: `${pct}%` }} title={`${l.label}: ${l.units}`} /> : null
              })}
            </div>
            <p className={cn('rounded-lg px-3 py-2 text-[12px] leading-relaxed ring-1 ring-inset', Math.abs(accom.reconciliation.variancePct) <= 3 ? 'bg-elevated/40 text-slate-400 ring-edge/50' : 'bg-amber-500/[0.06] text-amber-200 ring-amber-500/25')}>
              Integer unit counts use {formatNumber(accom.reconciliation.usedNet)} m² of the {formatNumber(accom.reconciliation.targetNet)} m² residential net area ({accom.reconciliation.variancePct > 0 ? '+' : ''}{accom.reconciliation.variancePct}%). Smaller dwellings raise the count and the blended $/m²; family units cut density.
            </p>
          </div>
          {/* schedule */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Schedule by type</div>
            <ScrollableTable label="Accommodation schedule by type">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Type', 'Size', 'Mix', 'Units', 'Net', '$/m²', 'Revenue'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
                <tbody>
                  {accom.lines.map((l) => (
                    <tr key={l.key} className="border-b border-edge/30 hover:bg-elevated/40">
                      <td className="px-3 py-1.5 font-medium text-slate-200">{l.label}</td>
                      <td className="data-mono px-3 py-1.5 text-right text-slate-400">{l.size} m²</td>
                      <td className="data-mono px-3 py-1.5 text-right text-slate-400">{Math.round(l.share * 100)}%</td>
                      <td className="data-mono px-3 py-1.5 text-right text-slate-200">{formatNumber(l.units)}</td>
                      <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatNumber(l.netArea)}</td>
                      <td className="data-mono px-3 py-1.5 text-right text-slate-400">${formatNumber(l.pricePerM2)}</td>
                      <td className="data-mono px-3 py-1.5 text-right text-emerald-300/90">{formatCurrency(l.revenue, { compact: true })}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-edge/60 font-medium">
                    <td className="px-3 py-1.5 text-slate-200">Total</td>
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5" />
                    <td className="data-mono px-3 py-1.5 text-right text-slate-100">{formatNumber(accom.totalUnits)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-100">{formatNumber(accom.totalNet)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">${formatNumber(accom.blendedPricePerM2)}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-emerald-300">{formatCurrency(accom.revenue, { compact: true })}</td>
                  </tr>
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      </Card>

      {/* affordable housing & planning obligations (viability) */}
      <Card data-obligations>
        <CardHeader
          icon={Scale} accent="violet" title="Affordable housing & viability"
          subtitle="The policy layer: a share of the homes is delivered affordable (let/sold below market by tenure), and the scheme carries a community infrastructure levy and Section 106 contributions. Both shrink the residual land value — which is then tested against a benchmark (existing use + premium). If the policy-compliant scheme falls short, the viability-led affordable percentage the site can actually support is solved."
          action={<button onClick={() => downloadText('site-viability.csv', obligationsCsv(oblig), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <div className={cn('rounded-lg p-2.5 ring-1 ring-inset', oblig.viable ? 'bg-emerald-500/[0.08] ring-emerald-500/30' : 'bg-rose-500/[0.08] ring-rose-500/30')}>
            <div className="text-[11px] text-slate-400">Viability</div>
            <div className={cn('text-sm font-semibold', oblig.viable ? 'text-emerald-300' : 'text-rose-300')}>{oblig.viable ? 'Viable' : 'Unviable'}</div>
            <div className="text-[10px] text-slate-500">{Math.round(affordablePct * 100)}% affordable</div>
          </div>
          <Metric label="Residual (policy)" value={formatCurrency(oblig.residualLandValue, { compact: true })} sub="after affordable + obligations" />
          <Metric label="Benchmark" value={formatCurrency(benchmarkLand, { compact: true })} sub="existing use + premium" />
          <Metric label="Surplus" value={formatCurrency(oblig.surplusVsBenchmark, { compact: true })} sub={oblig.surplusVsBenchmark >= 0 ? 'headroom' : 'shortfall'} />
          <Metric label="Affordable units" value={`${formatNumber(oblig.affordableUnits)} / ${formatNumber(oblig.affordableUnits + oblig.marketUnits)}`} sub={`${formatCurrency(oblig.gdvForgone, { compact: true })} GDV forgone`} />
          <Metric label="Viability-led max" value={`${Math.round(oblig.maxAffordablePct * 100)}%`} sub="affordable supportable" />
        </div>
        <div className="grid gap-5 border-t border-edge/50 p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <Range label="Affordable housing" unit="%" value={Math.round(affordablePct * 100)} min={0} max={60} step={5} onChange={(v) => setAffordablePct(v / 100)} />
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tenure split (within affordable)</div>
            {AFFORDABLE_TENURES.map((t) => (
              <Range key={t} label={TENURE_LABEL[t]} value={tenureSplit[t]} min={0} max={1} step={0.05} onChange={(v) => setTenureSplit((s) => ({ ...s, [t]: v }))} fmt={(v) => `${Math.round(v * 100)}%`} />
            ))}
            <div className="grid gap-3 sm:grid-cols-3">
              <Num label="CIL" unit="$/m²" value={cilPerM2} step={10} onChange={setCilPerM2} />
              <Num label="S106" unit="$/unit" value={s106PerUnit} step={1000} onChange={setS106PerUnit} />
              <Num label="Benchmark land" unit="$" value={benchmarkLand} step={500_000} onChange={setBenchmarkLand} />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Affordable tenure</div>
              <ScrollableTable label="Affordable tenure breakdown">
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Tenure', 'Units', '% market', 'GDV'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
                  <tbody>
                    {oblig.tenureLines.map((l) => (
                      <tr key={l.tenure} className="border-b border-edge/30">
                        <td className="px-3 py-1.5 text-slate-200">{l.label}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-200">{formatNumber(l.units)}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-400">{Math.round(l.valueFactor * 100)}%</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-300">{formatCurrency(l.gdv, { compact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-elevated/40 p-2"><div className="text-[10px] text-slate-400">CIL</div><div className="data-mono text-xs font-semibold text-slate-200">{formatCurrency(oblig.cil, { compact: true })}</div></div>
              <div className="rounded-lg bg-elevated/40 p-2"><div className="text-[10px] text-slate-400">Section 106</div><div className="data-mono text-xs font-semibold text-slate-200">{formatCurrency(oblig.s106, { compact: true })}</div></div>
              <div className="rounded-lg bg-elevated/40 p-2"><div className="text-[10px] text-slate-400">Obligations</div><div className="data-mono text-xs font-semibold text-slate-200">{formatCurrency(oblig.obligationsTotal, { compact: true })}</div></div>
            </div>
            {/* residual vs benchmark */}
            <div className="space-y-1.5">
              {([['Residual (policy)', oblig.residualLandValue, oblig.viable ? 'bg-emerald-500/70' : 'bg-rose-500/70'], ['Benchmark', benchmarkLand, 'bg-slate-500/60']] as [string, number, string][]).map(([label, val, col]) => {
                const max = Math.max(oblig.residualLandValue, benchmarkLand, 1)
                return (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 truncate text-slate-400">{label}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded bg-base/60 ring-1 ring-inset ring-edge/40"><div className={cn('h-3 rounded', col)} style={{ width: `${(val / max) * 100}%` }} /></div>
                    <span className="data-mono w-16 shrink-0 text-right text-slate-300">{formatCurrency(val, { compact: true })}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="border-t border-edge/50 px-5 pb-5 pt-4">
          <p className={cn('rounded-lg px-3 py-2 text-[13px] leading-relaxed ring-1 ring-inset', oblig.viable ? 'bg-emerald-500/[0.06] text-slate-300 ring-emerald-500/25' : 'bg-rose-500/[0.06] text-rose-200 ring-rose-500/30')}>{oblig.headline}</p>
        </div>
      </Card>

      {/* development cashflow appraisal (DCF) */}
      <Card data-appraisal>
        <CardHeader
          icon={LineChart} accent="emerald" title="Development cashflow & returns (DCF)"
          subtitle="The static pro forma phased over a development programme: land at close, construction spend on an S-curve, fees front-loaded, for-sale settlements on an absorption curve and the investment asset realised at stabilisation. A facility funds the negative cashflow with interest rolling up monthly — so the appraisal reports peak debt, the project NPV and IRR, not just a residual."
          action={<button onClick={() => downloadText('site-appraisal.csv', appraisalCsv(appraisal), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Profit" value={formatCurrency(appraisal.profit, { compact: true })} sub={`${appraisal.profitOnGdv}% on GDV`} />
          <Metric label="Margin on cost" value={`${appraisal.marginOnCost}%`} sub="incl. land + finance" />
          <Metric label="IRR (project)" value={Number.isFinite(appraisal.irrAnnual) ? `${appraisal.irrAnnual}%` : 'n/a'} sub="annualised" />
          <Metric label="NPV" value={formatCurrency(appraisal.npv, { compact: true })} sub={`at ${discountRate}% discount`} />
          <Metric label="Peak debt" value={formatCurrency(appraisal.peakFunding, { compact: true })} sub={`month ${appraisal.peakFundingMonth} · ${formatCurrency(appraisal.totalInterest, { compact: true })} interest`} />
          <Metric label="Break-even" value={appraisal.breakEvenMonth >= 0 ? `M${appraisal.breakEvenMonth}` : '—'} sub={`of ${appraisal.months} months`} />
        </div>
        <div className="grid gap-5 border-t border-edge/50 p-5 lg:grid-cols-2">
          {/* programme + finance controls */}
          <div className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Programme &amp; finance</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Range label="Pre-construction" unit="mo" value={preMonths} min={0} max={24} step={1} onChange={setPreMonths} />
              <Range label="Construction" unit="mo" value={constructionMonths} min={6} max={48} step={1} onChange={setConstructionMonths} />
              <Range label="Sales / lease-up" unit="mo" value={saleMonths} min={0} max={36} step={1} onChange={setSaleMonths} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Range label="Facility interest rate" unit="%" value={facilityRate} min={0} max={18} step={0.25} onChange={setFacilityRate} fmt={(v) => v.toFixed(2)} />
              <Range label="Discount rate" unit="%" value={discountRate} min={0} max={20} step={0.5} onChange={setDiscountRate} fmt={(v) => v.toFixed(1)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={useResidualLand} onChange={(e) => setUseResidualLand(e.target.checked)} aria-label="Price land at the residual" className="h-4 w-4 rounded border-edge bg-elevated accent-emerald-500" />
              Price land at the residual ({formatCurrency(feas.residualLandValue, { compact: true })})
            </label>
            {!useResidualLand && <Num label="Land price" unit="$" value={landPrice} step={250_000} onChange={setLandPrice} />}
            <p className={cn('rounded-lg px-3 py-2 text-[13px] leading-relaxed ring-1 ring-inset', appraisal.profit > 0 ? 'bg-emerald-500/[0.06] text-slate-300 ring-emerald-500/25' : 'bg-rose-500/[0.06] text-rose-200 ring-rose-500/30')}>{appraisal.headline}</p>
          </div>
          {/* cashflow J-curve */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> Cumulative cashflow vs outstanding debt</div>
            <LineTrend
              data={appraisal.rows.map((r) => ({ m: r.label, Cumulative: r.cumulative, Debt: Math.max(0, r.funding) }))}
              xKey="m"
              height={250}
              series={[{ key: 'Cumulative', name: 'Cumulative cashflow', accent: 'emerald' }, { key: 'Debt', name: 'Outstanding debt', accent: 'rose' }]}
              dashedKeys={['Debt']}
              valueFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <p className="mt-1 text-[11px] text-slate-500">The cashflow dips into debt through construction (the J-curve) and recovers as sales settle and the asset is realised. Peak debt sets the facility size; the deeper and longer the valley, the more interest rolls up.</p>
          </div>
        </div>
        {/* quarterly cashflow table */}
        <div className="border-t border-edge/50 p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Quarterly cashflow</div>
          <ScrollableTable label="Quarterly development cashflow">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Quarter', 'Cost out', 'Revenue in', 'Net', 'Cumulative', 'Interest', 'Debt'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {quarterly(appraisal).map((q) => (
                  <tr key={q.label} className="border-b border-edge/30 hover:bg-elevated/40">
                    <td className="px-3 py-1.5 font-medium text-slate-200">{q.label}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-400">{q.cost ? formatCurrency(q.cost, { compact: true }) : '—'}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-emerald-300/90">{q.revenue ? formatCurrency(q.revenue, { compact: true }) : '—'}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', q.net >= 0 ? 'text-emerald-300' : 'text-slate-300')}>{formatCurrency(q.net, { compact: true })}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', q.cumulative >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatCurrency(q.cumulative, { compact: true })}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-amber-300/80">{q.interest ? formatCurrency(q.interest, { compact: true }) : '—'}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-rose-300/80">{q.funding > 0 ? formatCurrency(q.funding, { compact: true }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Total cost {formatCurrency(appraisal.totalCost)} = land {formatCurrency(appraisalLand, { compact: true })} + dev cost {formatCurrency(appraisal.devCostExFinance, { compact: true })} + rolled-up interest {formatCurrency(appraisal.totalInterest, { compact: true })}. Return on peak funding {appraisal.returnOnFunding}%. A feasibility-stage cashflow — programme, absorption and finance are simplified; tune them above.</p>
        </div>
      </Card>

      {/* sensitivity & scenarios — risk lens on the appraisal */}
      <Card data-sensitivity>
        <CardHeader
          icon={Activity} accent="fuchsia" title="Sensitivity & scenarios"
          subtitle="The risk lens on the appraisal: swing each driver on its own to rank what moves the return most (the tornado), read a two-way sale-price × build-cost grid, and compare combined downside / base / upside cases. Land is held at the current price, so revenue and cost swings flow straight to profit."
          action={<button onClick={() => downloadText('site-sensitivity.csv', sensitivityCsv(sensBase, sensMetric, sensSwing), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
        />
        <div className="flex flex-wrap items-center gap-4 border-t border-edge/50 p-4">
          <label className="flex items-center gap-2 text-xs text-slate-400">Metric
            <select value={sensMetric} onChange={(e) => setSensMetric(e.target.value as Metric)} aria-label="Sensitivity metric" className="rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1 text-xs text-slate-100 focus:border-fuchsia-500/50 focus:outline-none">
              {(['profit', 'npv', 'irr', 'margin', 'rlv', 'peakDebt'] as Metric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">Swing
            <select value={sensSwing} onChange={(e) => setSensSwing(Number(e.target.value))} aria-label="Sensitivity swing" className="rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1 text-xs text-slate-100 focus:border-fuchsia-500/50 focus:outline-none">
              {[0.05, 0.1, 0.15, 0.2].map((s) => <option key={s} value={s}>±{Math.round(s * 100)}%</option>)}
            </select>
          </label>
          <span className="text-[11px] text-slate-500">vs base {METRIC_LABEL[sensMetric]} <span className="data-mono text-slate-300">{fmtMetric(torn[0]?.base ?? 0, sensMetric)}</span></span>
        </div>
        <div className="grid gap-5 border-t border-edge/50 p-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Tornado — drivers of {METRIC_LABEL[sensMetric]} (±{Math.round(sensSwing * 100)}%)</div>
            <TornadoChart bars={torn} metric={sensMetric} />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Each bar swings one driver ±{Math.round(sensSwing * 100)}% with all else held. The widest bars are the assumptions to firm up first — the return lives or dies on them.</p>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Sale price × build cost → {METRIC_LABEL[sensMetric]}</div>
            <DataGrid table={dtable} metric={sensMetric} values={sensValues} />
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Rows = build cost, columns = sale price (both ±10% about base). Green is stronger, red is weaker; the outlined cell is today's assumption.</p>
          </div>
        </div>
        <div className="border-t border-edge/50 p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Scenario cases (revenue, cost, finance &amp; yield move together ±{Math.round(sensSwing * 100)}%)</div>
          <ScrollableTable label="Scenario cases">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Scenario', 'Profit', 'Margin', 'IRR', 'NPV', 'Peak debt', 'Residual land'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && 'text-right')}>{h}</th>)}</tr></thead>
              <tbody>
                {scen.map((s) => (
                  <tr key={s.name} className="border-b border-edge/30 hover:bg-elevated/40">
                    <td className="px-3 py-1.5"><Badge variant={s.name === 'Downside' ? 'danger' : s.name === 'Upside' ? 'success' : 'neutral'}>{s.name}</Badge></td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', s.result.profit >= 0 ? 'text-slate-200' : 'text-rose-300')}>{formatCurrency(s.result.profit, { compact: true })}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{s.result.margin}%</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-300">{Number.isFinite(s.result.irr) ? `${s.result.irr}%` : 'n/a'}</td>
                    <td className={cn('data-mono px-3 py-1.5 text-right', s.result.npv >= 0 ? 'text-emerald-300/90' : 'text-rose-300')}>{formatCurrency(s.result.npv, { compact: true })}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-rose-300/80">{formatCurrency(s.result.peakDebt, { compact: true })}</td>
                    <td className="data-mono px-3 py-1.5 text-right text-slate-400">{formatCurrency(s.result.rlv, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </Card>

      {/* shadow / right-to-light study */}
      {shadow && (
        <Card data-shadow>
          <CardHeader
            icon={Sun} accent="amber" title="Shadow study — right to light"
            subtitle={`Where the proposed mass casts shadow through the day at this latitude. Reaches up to ${formatNumber(shadow.maxReach)} m and shades ~${formatNumber(shadow.netShadowArea)} m² beyond its own footprint at the worst moment. Indicative — true overshadowing needs neighbouring context.`}
            action={
              <label className="flex items-center gap-2 text-xs text-slate-400">Month
                <select value={shadowMonth} onChange={(e) => setShadowMonth(Number(e.target.value))} aria-label="Shadow study month" className="rounded-lg border border-edge/60 bg-elevated/50 px-2 py-1 text-xs text-slate-100 focus:border-amber-500/50 focus:outline-none">
                  {[['Jun (summer)', 6], ['Mar/Sep (equinox)', 3], ['Dec (winter)', 12]].map(([l, v]) => <option key={v as number} value={v as number}>{l}</option>)}
                </select>
              </label>
            }
          />
          <div className="grid gap-4 border-t border-edge/50 p-5 lg:grid-cols-3">
            {shadow.moments.map((m) => (
              <div key={m.label} className="rounded-xl border border-edge/60 bg-base/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">{m.label}</span>
                  <span className="data-mono text-[11px] text-slate-500">alt {m.altitude}° · {compass(m.azimuth)}</span>
                </div>
                <ShadowDiagram footprint={footprintPoly} shadow={m.shadow.polygon} />
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Reach <span className="data-mono text-slate-300">{formatNumber(m.shadow.reach)} m</span></span>
                  <span>Shadow <span className="data-mono text-slate-300">{formatNumber(m.shadow.area)} m²</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* context & overshadowing — neighbouring buildings */}
      <Card data-context>
        <CardHeader
          icon={Building} accent="sky" title="Context & overshadowing — neighbours"
          subtitle="Drop a ring of neighbouring buildings around the parcel and measure how much the proposed mass shades them through the day — worst-moment shadow coverage, sunlit moments kept, and a sun-hours-retained proxy per neighbour. Right-to-light, in context. Set each neighbour's height and the study re-runs live."
          action={
            <button onClick={() => setContextOn((v) => !v)} aria-pressed={contextOn} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset', contextOn ? 'bg-sky-500/20 text-sky-100 ring-sky-500/40 hover:bg-sky-500/30' : 'bg-elevated/60 text-slate-300 ring-edge/70 hover:text-white')}>
              <Building className="h-3.5 w-3.5" /> {contextOn ? 'Context on' : 'Add context'}
            </button>
          }
        />
        {contextOn && context ? (
          <>
            <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-4">
              <Metric label="Neighbours" value={String(context.neighbours.length)} sub="context lots" />
              <Metric label="Worst affected" value={context.worstNeighbour} sub={`${Math.max(0, ...context.neighbours.map((n) => n.worstCoverage))}% shaded`} />
              <Metric label="Total shaded" value={`${formatNumber(context.totalShadedArea)} m²`} sub="at each worst moment" />
              <Metric label="Study month" value={shadowMonth === 6 ? 'June (summer)' : shadowMonth === 12 ? 'Dec (winter)' : 'Equinox'} sub="solar path" />
            </div>
            <div className="grid gap-4 border-t border-edge/50 p-5 lg:grid-cols-2">
              <ContextDiagram boundary={boundary} footprint={footprintPoly} neighbours={nbList} study={context} shadows={shadow ? shadow.moments.map((m) => m.shadow.polygon) : []} />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Neighbour heights</div>
                  <button onClick={() => setNeighbours(null)} className="text-[11px] text-slate-400 hover:text-white">Reset to auto</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {nbList.map((nb) => (
                    <Range key={nb.id} label={nb.name} unit="m" value={nb.height} min={3} max={120} step={3} onChange={(v) => setNbHeight(nb.id, v)} />
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">Heights drive the grey context blocks in the 3D model above. Each footprint is sampled on a grid against the proposal's cast shadow at 09:00 / noon / 15:00 — worst shadow is the peak coverage across those moments; sun-hours is a proxy from the share of moments the neighbour's centre stays sunlit (× a 10h day). Change the month in the shadow card to test winter, the binding case for right-to-light.</p>
              </div>
            </div>
            <div className="border-t border-edge/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Overshadowing by neighbour</div>
                <button onClick={() => downloadText('site-overshadowing.csv', overshadowingCsv(context), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
              </div>
              <ScrollableTable label="Overshadowing by neighbour">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500">{['Neighbour', 'Height (m)', 'Area (m²)', 'Worst shadow', 'Avg', 'Sunlit', 'Sun-hrs', 'Verdict'].map((h, i) => <th key={h} className={cn('px-3 py-2 font-medium', i >= 1 && i <= 6 && 'text-right')}>{h}</th>)}</tr></thead>
                  <tbody>
                    {context.neighbours.map((n) => {
                      const v = n.worstCoverage >= 50 ? { t: 'Significant', b: 'danger' as const } : n.worstCoverage >= 20 ? { t: 'Moderate', b: 'warn' as const } : { t: 'Minor', b: 'success' as const }
                      return (
                        <tr key={n.id} className="border-b border-edge/30 hover:bg-elevated/40">
                          <td className="px-3 py-1.5 font-medium text-slate-200">{n.name}</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-300">{n.height}</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-400">{formatNumber(n.area)}</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-200">{n.worstCoverage}%</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-400">{n.avgCoverage}%</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-400">{n.sunlitMoments}/{n.totalMoments}</td>
                          <td className="data-mono px-3 py-1.5 text-right text-slate-300">{n.sunHours}</td>
                          <td className="px-3 py-1.5"><Badge variant={v.b}>{v.t}</Badge></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </>
        ) : (
          <div className="border-t border-edge/50 p-5">
            <p className="grid h-24 place-items-center text-center text-sm text-slate-500">No context yet —<button onClick={() => setContextOn(true)} className="mx-1 text-sky-300 hover:underline">add a ring of neighbours</button>to study how the proposed mass overshadows them through the day.</p>
          </div>
        )}
      </Card>

      {/* amenity sunlight — sun-hours on open space */}
      {sunlight && (
        <Card data-sunlight>
          <CardHeader
            icon={Sunrise} accent="lime" title="Sunlight on open space (amenity)"
            subtitle={`How much sun reaches the open ground at this latitude — the proposal's own massing${contextOn ? ' and the context neighbours' : ''} cast shadow across the day. Averages ${sunlight.avgSunHours}h of sun, with ${sunlight.sunlitFraction2h}% of the amenity meeting a ≥2h target. BRE assesses amenity sunlight on 21 March — switch the month in the shadow card to test it.`}
            action={<button onClick={() => downloadText('site-amenity-sunlight.csv', sunlightCsv(sunlight), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>}
          />
          <div className="grid grid-cols-2 gap-3 border-t border-edge/50 p-5 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Amenity area" value={`${formatNumber(sunlight.area)} m²`} sub="open ground" />
            <Metric label="Avg sun-hours" value={`${sunlight.avgSunHours}h`} sub={`of ${sunlight.daylightHours}h daylight`} />
            <Metric label="≥2h sunlit" value={`${sunlight.sunlitFraction2h}%`} sub={`${formatNumber(sunlight.sunlitArea2h)} m²`} />
            <Metric label="Best spot" value={`${sunlight.maxSunHours}h`} sub="max sun-hours" />
            <Metric label="Study month" value={shadowMonth === 6 ? 'June' : shadowMonth === 12 ? 'Dec' : 'Equinox'} sub="solar path" />
          </div>
          <div className="grid gap-5 border-t border-edge/50 p-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Sun-hours map</div>
              <SunlightDiagram space={z.buildable.length >= 3 ? z.buildable : boundary} footprint={footprintPoly} grid={sunlight.grid} maxH={Math.max(1, sunlight.daylightHours)} />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Sunlit share through the day</div>
              <div className="space-y-1">
                {sunlight.moments.map((m) => (
                  <div key={m.label} className="flex items-center gap-2 text-[11px]">
                    <span className="w-10 shrink-0 text-right text-slate-400">{m.label}</span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded bg-base/60 ring-1 ring-inset ring-edge/40">
                      <div className={cn('h-3 rounded', m.altitude <= 0 ? 'bg-slate-700' : 'bg-lime-500/70')} style={{ width: `${m.altitude <= 0 ? 100 : m.sunlitFraction}%` }} />
                    </div>
                    <span className="w-16 shrink-0 text-right data-mono text-slate-400">{m.altitude <= 0 ? 'sun down' : `${m.sunlitFraction}%`}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Each bar is the share of the open space in sun at that hour; the map left accumulates these into sun-hours per point (red = overshadowed, green = open). Turn on context in the card above to include the neighbours' shadows.</p>
            </div>
          </div>
        </Card>
      )}

      {/* A/B scheme comparison */}
      <Card data-compare>
        <CardHeader
          icon={GitCompare} accent="violet" title="Scheme comparison — A / B"
          subtitle="Pin the current scheme as A, then change the rules or proposal to explore B. Compliance, capacity and the feasibility return are compared side by side."
          action={<button onClick={pinA} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-200 ring-1 ring-inset ring-violet-500/40 hover:bg-violet-500/25"><Pin className="h-3.5 w-3.5" /> Pin current as A</button>}
        />
        <div className="border-t border-edge/50 p-4">
          {schemeA ? (
            <ScrollableTable label="Scheme A vs B">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="border-b border-edge/60 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-3 py-2 font-medium">Metric</th><th className="px-3 py-2 text-right font-medium">A (pinned)</th><th className="px-3 py-2 text-right font-medium">B (current)</th><th className="px-3 py-2 text-right font-medium">Δ</th></tr></thead>
                <tbody>
                  {([
                    ['GFA (m²)', schemeA.gfa, schemeB.gfa, true],
                    ['Storeys', schemeA.storeys, schemeB.storeys, true],
                    ['Height (m)', schemeA.height, schemeB.height, true],
                    ['GDV', schemeA.gdv, schemeB.gdv, true],
                    ['Residual land', schemeA.rlv, schemeB.rlv, true],
                    ['Margin (land-free) %', schemeA.margin, schemeB.margin, true],
                  ] as [string, number, number, boolean][]).map(([k, a, b]) => {
                    const d = b - a
                    return (
                      <tr key={k} className="border-b border-edge/30">
                        <td className="px-3 py-1.5 text-slate-300">{k}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-400">{formatNumber(a)}</td>
                        <td className="data-mono px-3 py-1.5 text-right text-slate-200">{formatNumber(b)}</td>
                        <td className={cn('data-mono px-3 py-1.5 text-right', d > 0 ? 'text-emerald-300' : d < 0 ? 'text-rose-300' : 'text-slate-500')}>{d > 0 ? '+' : ''}{formatNumber(d)}</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td className="px-3 py-1.5 text-slate-300">Compliant</td>
                    <td className="px-3 py-1.5 text-right">{schemeA.compliant ? <span className="text-emerald-300">Yes</span> : <span className="text-rose-300">No</span>}</td>
                    <td className="px-3 py-1.5 text-right">{schemeB.compliant ? <span className="text-emerald-300">Yes</span> : <span className="text-rose-300">No</span>}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500">—</td>
                  </tr>
                </tbody>
              </table>
            </ScrollableTable>
          ) : (
            <p className="grid h-24 place-items-center text-sm text-slate-500">Pin the current scheme as <span className="mx-1 text-slate-300">A</span>, then adjust the rules or proposal to compare a <span className="mx-1 text-slate-300">B</span> against it.</p>
          )}
        </div>
      </Card>

      {/* tier schedule + data export */}
      <Card>
        <CardHeader
          icon={Layers}
          accent="sky"
          title="Scheme & envelope tiers"
          subtitle="Footprints and height bands from the model — proposed massing vs the legal envelope. Export the full analysis as CSV or JSON."
          action={
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => downloadText('site-zoning-analysis.csv', zoningCsv(), 'CSV')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><Download className="h-3.5 w-3.5" /> CSV</button>
              <button onClick={() => downloadText('site-zoning-analysis.json', zoningJson(), 'JSON')} className="inline-flex items-center gap-1.5 rounded-lg border border-edge/70 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-elevated/60 hover:text-white"><FileJson className="h-3.5 w-3.5" /> JSON</button>
            </div>
          }
        />
        <ScrollableTable label="Scheme and envelope tiers" className="border-t border-edge/50">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-edge/50 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Tier</th>
                <th className="px-3 py-2.5 text-right font-medium">Footprint (m²)</th>
                <th className="px-3 py-2.5 text-right font-medium">From (m)</th>
                <th className="px-3 py-2.5 text-right font-medium">To (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/40">
              {tierRows().map((r, i) => (
                <tr key={i} className={cn('hover:bg-elevated/30', String(r[0]).startsWith('Envelope') && 'text-slate-400')}>
                  <td className="px-4 py-2 font-medium text-slate-200">{r[0]}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-300">{formatNumber(r[1] as number)}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(r[2] as number)}</td>
                  <td className="px-3 py-2 text-right data-mono text-slate-400">{formatNumber(r[3] as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </Card>

      {/* GIS import */}
      <Card>
        <CardHeader icon={Upload} accent="cyan" title="Import site boundary (GIS)" subtitle="Paste a GeoJSON Polygon/Feature, or a bare [[x,y],…] ring — lon/lat is projected to metres" />
        <div className="space-y-3 border-t border-edge/50 p-5">
          <textarea
            value={geoText}
            onChange={(e) => setGeoText(e.target.value)}
            rows={4}
            placeholder='{"type":"Polygon","coordinates":[[[ -0.0006,-0.0004],[0.0006,-0.0004],[0.0006,0.0004],[-0.0006,0.0004],[-0.0006,-0.0004]]]}'
            aria-label="GeoJSON site boundary"
            className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
          {geoError && <p className="flex items-center gap-1.5 text-xs text-rose-300"><AlertTriangle className="h-3.5 w-3.5" /> {geoError}</p>}
          <button onClick={importGeo} disabled={!geoText.trim()} className="btn-primary disabled:opacity-50"><Upload className="h-4 w-4" /> Import boundary</button>
        </div>
      </Card>
    </div>
  )
}

function narrative(z: Zoning, proposedGFA: number): string {
  if (z.compliance.overall) {
    const head = Math.round(z.maxGFA - proposedGFA)
    return `The scheme is within the envelope, using ${Math.round(z.utilisation)}% of the allowable GFA${head > 0 ? ` — about ${formatNumber(head)} m² of unused entitlement remains` : ''}.`
  }
  const fails: string[] = []
  if (!z.compliance.far) fails.push(`GFA exceeds the FAR cap by ${formatNumber(Math.round(proposedGFA - z.maxGFA))} m²`)
  if (!z.compliance.height) fails.push(`height is ${Math.round(z.proposed.height - z.maxHeight)} m over the limit`)
  if (!z.compliance.coverage) fails.push('footprint exceeds the coverage cap')
  if (!z.compliance.setback) fails.push('footprint spills past the setback line')
  if (!z.compliance.skyPlane) fails.push('the upper storeys breach the sky-exposure plane')
  return `Non-compliant: ${fails.join('; ')}. Reduce GFA, add storeys to shrink the plate, set the podium to the sky-plane height, or relax the rule that binds.`
}

/* Top-down SVG plan: site boundary, setback polygon, proposed footprint. */
function PlanDiagram({ z, boundary }: { z: Zoning; boundary: Pt[] }) {
  const W = 640, H = 360, pad = 28
  const xs = boundary.map((p) => p.x), zs = boundary.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const spanX = Math.max(1, maxX - minX), spanZ = Math.max(1, maxZ - minZ)
  const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ)
  const ox = (W - spanX * s) / 2, oz = (H - spanZ * s) / 2
  const map = (p: Pt) => `${(ox + (p.x - minX) * s).toFixed(1)},${(oz + (p.z - minZ) * s).toFixed(1)}`
  const path = (pts: Pt[]) => pts.map(map).join(' ')

  const base = z.buildable.length >= 3 ? z.buildable : boundary
  const baseArea = polygonArea(base)
  const k = baseArea > 0 ? Math.sqrt(Math.min(1, z.proposed.footprint / baseArea)) : 0
  const footprint = k > 0 ? scalePolygon(base, k, polygonCentroid(base)) : []

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Site plan: ${Math.round(z.siteArea)} m² site, proposed footprint ${Math.round(z.proposed.footprint)} m²`}>
      <rect x={0} y={0} width={W} height={H} fill="#0a0f1c" rx={10} />
      <polygon points={path(boundary)} fill="#1e293b" fillOpacity={0.35} stroke="#e2e8f0" strokeWidth={1.5} />
      {z.buildable.length >= 3 && <polygon points={path(z.buildable)} fill="none" stroke="#fbbf24" strokeWidth={1.3} strokeDasharray="6 4" />}
      {footprint.length >= 3 && <polygon points={path(footprint)} fill={z.compliance.overall ? '#22c55e' : '#ef4444'} fillOpacity={0.5} stroke={z.compliance.overall ? '#22c55e' : '#ef4444'} strokeWidth={1.5} />}
      <g fontSize={11} fill="#94a3b8">
        <text x={12} y={H - 28}>■ <tspan fill="#e2e8f0">Site</tspan></text>
        <text x={12} y={H - 14}>▦ <tspan fill="#fbbf24">Setback</tspan> · <tspan fill={z.compliance.overall ? '#22c55e' : '#ef4444'}>Proposed footprint</tspan></text>
      </g>
    </svg>
  )
}

function ShadowDiagram({ footprint, shadow }: { footprint: Pt[]; shadow: Pt[] }) {
  const all = [...footprint, ...shadow]
  if (all.length < 3) return <div className="grid h-28 place-items-center text-[11px] text-slate-600">no shadow</div>
  const xs = all.map((p) => p.x), zs = all.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const W = 200, H = 120, pad = 10
  const s = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxZ - minZ))
  const ox = (W - (maxX - minX) * s) / 2, oz = (H - (maxZ - minZ) * s) / 2
  const map = (p: Pt) => `${(ox + (p.x - minX) * s).toFixed(1)},${(oz + (maxZ - p.z) * s).toFixed(1)}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full rounded-lg bg-[#0a0f1c]" role="img" aria-label="Shadow cast diagram">
      <polygon points={shadow.map(map).join(' ')} fill="#1e293b" stroke="#475569" strokeWidth={1} />
      <polygon points={footprint.map(map).join(' ')} fill="#f59e0b55" stroke="#f59e0b" strokeWidth={1.2} />
    </svg>
  )
}

/* Context plan: site + neighbours (tinted by worst overshadowing) under the day's
 * cast shadows (layered, so overlaps darken) + the proposed footprint. */
function ContextDiagram({ boundary, footprint, neighbours, study, shadows }: { boundary: Pt[]; footprint: Pt[]; neighbours: Neighbour[]; study: ContextStudy; shadows: Pt[][] }) {
  const all = [...boundary, ...footprint, ...neighbours.flatMap((n) => n.footprint), ...shadows.flat()]
  if (all.length < 3) return <div className="grid h-64 place-items-center rounded-xl bg-[#0a0f1c] text-[11px] text-slate-600">no context</div>
  const xs = all.map((p) => p.x), zs = all.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const W = 480, H = 360, pad = 22
  const s = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxZ - minZ))
  const ox = (W - (maxX - minX) * s) / 2, oz = (H - (maxZ - minZ) * s) / 2
  const map = (p: Pt) => `${(ox + (p.x - minX) * s).toFixed(1)},${(oz + (maxZ - p.z) * s).toFixed(1)}` // z up → screen up
  const cov = (id: string) => study.neighbours.find((n) => n.id === id)?.worstCoverage ?? 0
  const tint = (c: number) => (c >= 50 ? '#ef4444' : c >= 20 ? '#f59e0b' : '#64748b')
  const centre = (pts: Pt[]) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl" role="img" aria-label="Context overshadowing plan">
      <rect x={0} y={0} width={W} height={H} fill="#0a0f1c" rx={10} />
      {shadows.map((sh, i) => sh.length >= 3 && <polygon key={i} points={sh.map(map).join(' ')} fill="#38bdf8" fillOpacity={0.1} stroke="#38bdf8" strokeOpacity={0.18} strokeWidth={0.8} />)}
      {neighbours.map((nb) => {
        const c = cov(nb.id), col = tint(c), m = centre(nb.footprint)
        return (
          <g key={nb.id}>
            <polygon points={nb.footprint.map(map).join(' ')} fill={col} fillOpacity={0.28} stroke={col} strokeWidth={1.2} />
            <text x={ox + (m.x - minX) * s} y={oz + (maxZ - m.z) * s} fontSize={10} fill="#e2e8f0" textAnchor="middle" dominantBaseline="middle">{c}%</text>
          </g>
        )
      })}
      <polygon points={boundary.map(map).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth={1.4} strokeDasharray="2 3" />
      {footprint.length >= 3 && <polygon points={footprint.map(map).join(' ')} fill="#14b8a6" fillOpacity={0.55} stroke="#2dd4bf" strokeWidth={1.5} />}
      <g fontSize={10} fill="#94a3b8">
        <text x={12} y={H - 24}>▣ <tspan fill="#2dd4bf">Proposed</tspan> · ▢ <tspan fill="#e2e8f0">Site</tspan> · <tspan fill="#38bdf8">day shadow</tspan></text>
        <text x={12} y={H - 10}>Neighbour shading: <tspan fill="#64748b">minor</tspan> · <tspan fill="#f59e0b">moderate</tspan> · <tspan fill="#ef4444">significant</tspan></text>
      </g>
    </svg>
  )
}

/* Sun-hours heat map: the open space outline, the building footprint, and the
 * grid sample points coloured red (overshadowed) → amber → green (full sun). */
function SunlightDiagram({ space, footprint, grid, maxH }: { space: Pt[]; footprint: Pt[]; grid: { x: number; z: number; sunHours: number }[]; maxH: number }) {
  if (space.length < 3) return <div className="grid h-64 place-items-center rounded-xl bg-[#0a0f1c] text-[11px] text-slate-600">no open space</div>
  const xs = space.map((p) => p.x), zs = space.map((p) => p.z)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  const W = 460, H = 320, pad = 18
  const s = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxZ - minZ))
  const ox = (W - (maxX - minX) * s) / 2, oz = (H - (maxZ - minZ) * s) / 2
  const sx = (x: number) => ox + (x - minX) * s, sy = (z: number) => oz + (maxZ - z) * s
  const path = (pts: Pt[]) => pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.z).toFixed(1)}`).join(' ')
  const cell = Math.max(4, (s * Math.max(1, maxX - minX)) / Math.sqrt(Math.max(1, grid.length)) * 0.8)
  const colour = (h: number) => { const t = Math.max(0, Math.min(1, h / maxH)); const r = t < 0.5 ? 244 : Math.round(244 - (t - 0.5) * 2 * (244 - 16)); const g = t < 0.5 ? Math.round(63 + t * 2 * (185 - 63)) : 185; const b = t < 0.5 ? 94 - Math.round(t * 2 * 30) : Math.round(64 + (t - 0.5) * 2 * 65); return `rgb(${r},${g},${b})` }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl bg-[#0a0f1c]" role="img" aria-label="Amenity sun-hours heat map">
      <polygon points={path(space)} fill="#0e1626" stroke="#475569" strokeWidth={1.2} />
      {grid.map((p, i) => <rect key={i} x={sx(p.x) - cell / 2} y={sy(p.z) - cell / 2} width={cell} height={cell} rx={1} fill={colour(p.sunHours)} fillOpacity={0.85} />)}
      {footprint.length >= 3 && <polygon points={path(footprint)} fill="#0a0f1c" fillOpacity={0.85} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="3 2" />}
      <g fontSize={10} fill="#94a3b8">
        <text x={12} y={H - 12}><tspan fill="#f43f5e">■</tspan> overshadowed · <tspan fill="#10b981">■</tspan> full sun ({maxH}h) · ▢ building</text>
      </g>
    </svg>
  )
}

function fmtMetric(v: number, m: Metric): string {
  if (m === 'margin' || m === 'irr') return Number.isFinite(v) ? `${Math.round(v)}%` : 'n/a'
  return formatCurrency(v, { compact: true })
}

/* Horizontal diverging tornado: one bar per driver, split at the base value
 * (worse side rose, better side emerald), with the absolute impact at the end. */
function TornadoChart({ bars, metric }: { bars: TornadoBar[]; metric: Metric }) {
  if (!bars.length) return <div className="grid h-40 place-items-center rounded-xl bg-[#0a0f1c] text-[11px] text-slate-600">no data</div>
  const base = bars[0].base
  const vals = bars.flatMap((b) => [b.low, b.high, base]).filter((v) => Number.isFinite(v))
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (lo === hi) { lo -= 1; hi += 1 }
  const span = hi - lo; lo -= span * 0.06; hi += span * 0.06
  const W = 460, labelW = 102, rightGutter = 60, rowH = 30, padTop = 6
  const chartW = W - labelW - rightGutter
  const H = bars.length * rowH + padTop + 16
  const X = (v: number) => labelW + ((v - lo) / (hi - lo)) * chartW
  const baseX = X(base)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-xl bg-[#0a0f1c]" role="img" aria-label={`Tornado sensitivity of ${METRIC_LABEL[metric]}`}>
      <line x1={baseX} y1={padTop} x2={baseX} y2={H - 16} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
      {bars.map((b, i) => {
        const y = padTop + i * rowH
        const left = Math.min(b.low, b.high), right = Math.max(b.low, b.high)
        const xl = X(left), xr = X(right)
        return (
          <g key={b.key}>
            <text x={6} y={y + rowH / 2} fontSize={11} fill="#cbd5e1" dominantBaseline="middle">{b.label}</text>
            <rect x={xl} y={y + 5} width={Math.max(0, baseX - xl)} height={rowH - 12} fill="#f43f5e" fillOpacity={0.5} rx={1.5} />
            <rect x={baseX} y={y + 5} width={Math.max(0, xr - baseX)} height={rowH - 12} fill="#10b981" fillOpacity={0.6} rx={1.5} />
            <text x={W - 6} y={y + rowH / 2} fontSize={9.5} fill="#e2e8f0" textAnchor="end" dominantBaseline="middle">{fmtMetric(b.impact, metric)}</text>
          </g>
        )
      })}
      <text x={baseX} y={H - 4} fontSize={9} fill="#64748b" textAnchor="middle">base {fmtMetric(base, metric)}</text>
    </svg>
  )
}

/* Two-way data table: a metric across sale price (columns) × build cost (rows),
 * cells heat-mapped (green strong / red weak) with the base assumption outlined. */
function DataGrid({ table, metric, values }: { table: SensDataTable; metric: Metric; values: number[] }) {
  const flat = table.cells.flat().filter((v) => Number.isFinite(v))
  const lo = Math.min(...flat), hi = Math.max(...flat)
  const color = (v: number) => {
    if (!Number.isFinite(v) || hi === lo) return 'transparent'
    const t = (v - lo) / (hi - lo)
    return t >= 0.5 ? `rgba(16,185,129,${(t - 0.5) * 2 * 0.5 + 0.04})` : `rgba(244,63,94,${(0.5 - t) * 2 * 0.5 + 0.04})`
  }
  const pct = (m: number) => `${m > 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`
  const baseXi = values.indexOf(1), baseYi = values.indexOf(1)
  return (
    <div className="overflow-x-auto rounded-xl border border-edge/50">
      <table className="w-full min-w-[340px] border-collapse text-center text-[11px]">
        <thead>
          <tr className="bg-base/40 text-slate-500"><th className="p-1.5 text-left font-medium">cost↓ price→</th>{table.xVals.map((xv) => <th key={xv} className="p-1.5 font-medium text-slate-400">{pct(xv)}</th>)}</tr>
        </thead>
        <tbody>
          {table.cells.map((row, yi) => (
            <tr key={yi}>
              <td className="p-1.5 text-right font-medium text-slate-400">{pct(table.yVals[yi])}</td>
              {row.map((v, xi) => (
                <td key={xi} className={cn('data-mono p-1.5 text-slate-100', xi === baseXi && yi === baseYi && 'ring-2 ring-inset ring-fuchsia-400/80')} style={{ background: color(v) }}>{fmtMetric(v, metric)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SiteRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <dt className="text-xs text-slate-400">{k}</dt>
      <dd className="data-mono text-sm font-medium text-slate-200">{v}</dd>
    </div>
  )
}

const csvCell = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
function vertCsv(s: SiteSurvey): string {
  return ['Vertex,X_E_m,Z_N_m,Latitude,Longitude', ...s.vertices.map((v) => [v.label, v.x, v.z, v.lat ?? '', v.lng ?? ''].map(csvCell).join(','))].join('\n')
}
function edgeCsv(s: SiteSurvey): string {
  return ['Edge,From,To,Length_m,Bearing_deg,Compass,Frontage', ...s.edges.map((e) => [e.label, e.from, e.to, e.length, e.bearing, e.compass, e.index === s.frontage.index ? 'yes' : ''].map(csvCell).join(','))].join('\n')
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-elevated/40 p-2.5">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="data-mono text-sm font-semibold text-slate-100">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-rose-400" />}
        <span className="text-slate-200">{label}</span>
      </span>
      <span className={cn('data-mono text-xs', ok ? 'text-slate-400' : 'text-rose-300')}>{detail}</span>
    </div>
  )
}

function Range({ label, unit, value, min, max, step, onChange, fmt }: { label: string; unit?: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="data-mono text-slate-200">{fmt ? fmt(value) : value}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-teal-500" aria-label={label} />
    </label>
  )
}

function Num({ label, unit, value, step, onChange }: { label: string; unit?: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" step={step} value={value} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(n) }} className="w-full rounded-lg border border-edge/60 bg-elevated/40 px-2.5 py-1.5 text-sm text-slate-100 data-mono focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
    </label>
  )
}
