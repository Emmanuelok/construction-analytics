import type { Accent } from '@/lib/nav'

/* =============================================================== Types === */
export type FileFormat = 'CSV' | 'JSON' | 'GeoJSON' | 'IFC' | 'XLSX' | 'PDF' | 'PNG' | 'ZIP'
export type License = 'Open' | 'Research' | 'Commercial' | 'Enterprise'
export type Modality = 'Tabular' | 'BIM Model' | 'Imagery' | 'Document' | 'Time-series' | 'Point Cloud' | 'Geospatial'

export type DatasetFile = {
  id: string
  name: string
  format: FileFormat
  size: string
  rows?: number
  free: boolean
  /** Generates real downloadable text content (CSV/JSON/IFC/GeoJSON). */
  generate?: () => string
  /** Stored content for seller-uploaded files (used when there is no generator). */
  content?: string
}

export type CatalogDataset = {
  id: string
  name: string
  provider: string
  category: string
  modality: Modality
  license: License
  price: number | null
  quality: number
  rating: number
  downloads: number
  records: number
  sizeGB: number
  anonymized: boolean
  updated: string
  tags: string[]
  accent: Accent
  description: string
  files: DatasetFile[]
}

/* ========================================================= Generators === */
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)]
const round = (n: number, d = 0) => Number(n.toFixed(d))
function csv(headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}
const isoDate = (start: number, days: number) => new Date(start + days * 86400000).toISOString().slice(0, 10)

const SECTORS = ['Commercial', 'Residential', 'Healthcare', 'Data Center', 'Industrial', 'Aviation', 'Education', 'Infrastructure']
const REGIONS = ['North America', 'Europe', 'Middle East', 'APAC', 'LATAM']
const DELIVERY = ['Design-Build', 'Design-Bid-Build', 'CM at Risk', 'IPD', 'EPC', 'PPP']

export function genCostBenchmarks(n = 48): string {
  const r = rng(7)
  const rows = Array.from({ length: n }, (_, i) => {
    const sector = pick(r, SECTORS)
    const gfa = round(8000 + r() * 180000)
    const perM2 = round(1400 + r() * 5200)
    const total = gfa * perM2
    const struct = round(18 + r() * 12)
    const mep = round(22 + r() * 16)
    return [
      `PRJ-${4000 + i}`,
      sector,
      pick(r, REGIONS),
      gfa,
      total,
      perM2,
      struct,
      mep,
      round(100 - struct - mep - 20),
      2019 + Math.floor(r() * 7),
      pick(r, DELIVERY),
    ]
  })
  return csv(
    ['project_id', 'sector', 'region', 'gfa_m2', 'cost_total_usd', 'cost_per_m2_usd', 'structure_pct', 'mep_pct', 'finishes_pct', 'completion_year', 'delivery_method'],
    rows,
  )
}

export function genSchedule(n = 60): string {
  const r = rng(11)
  const base = Date.parse('2025-01-06')
  const trades = ['Substructure', 'Superstructure', 'Envelope', 'MEP Rough-in', 'Fit-out', 'Commissioning']
  const rows = Array.from({ length: n }, (_, i) => {
    const dur = 5 + Math.floor(r() * 60)
    const startD = Math.floor(r() * 540)
    const delay = Math.floor((r() - 0.55) * 30)
    const pct = Math.min(100, Math.floor(r() * 110))
    return [
      `A${1000 + i}`,
      `${pick(r, trades)} - zone ${1 + Math.floor(r() * 6)}`,
      `WBS.${1 + Math.floor(r() * 8)}.${1 + Math.floor(r() * 9)}`,
      isoDate(base, startD),
      isoDate(base, startD + dur),
      isoDate(base, startD + Math.max(0, delay)),
      isoDate(base, startD + dur + Math.max(0, delay)),
      dur,
      Math.floor(r() * 15),
      pct,
      Math.max(0, delay),
    ]
  })
  return csv(
    ['activity_id', 'activity_name', 'wbs', 'baseline_start', 'baseline_finish', 'actual_start', 'forecast_finish', 'original_duration_d', 'total_float_d', 'pct_complete', 'delay_days'],
    rows,
  )
}

export function genEpdCarbon(n = 50): string {
  const r = rng(17)
  const mats = [
    ['Ready-mix concrete C32/40', 'm3', 280, 380],
    ['Reinforcing steel', 'kg', 0.7, 1.9],
    ['Structural steel (EAF)', 'kg', 0.6, 1.4],
    ['Float glass', 'm2', 25, 55],
    ['Aluminium extrusion', 'kg', 6, 14],
    ['Gypsum board', 'm2', 2, 6],
    ['Mineral wool insulation', 'm2', 1, 4],
    ['CLT timber panel', 'm3', -200, 120],
  ]
  const rows = Array.from({ length: n }, (_, i) => {
    const m = pick(r, mats)
    const gwp = round((m[2] as number) + r() * ((m[3] as number) - (m[2] as number)), 2)
    return [
      `EPD-${10000 + i}`,
      m[0],
      pick(r, ['Holcim', 'ArcelorMittal', 'Saint-Gobain', 'Hydro', 'Knauf', 'Stora Enso']),
      m[1],
      gwp,
      pick(r, REGIONS),
      pick(r, ['EN 15804', 'ISO 14025', 'ISO 21930']),
      isoDate(Date.parse('2027-01-01'), Math.floor(r() * 700)),
    ]
  })
  return csv(['epd_number', 'material', 'manufacturer', 'declared_unit', 'gwp_a1a3_kgco2e', 'region', 'standard', 'valid_until'], rows)
}

export function genSuppliers(n = 40): string {
  const r = rng(23)
  const cats = ['Structural Steel', 'MEP Equipment', 'Façade', 'Concrete', 'Electrical', 'Vertical Transport', 'HVAC', 'Glazing']
  const rows = Array.from({ length: n }, (_, i) => {
    const onTime = round(55 + r() * 44)
    const bids = 10 + Math.floor(r() * 90)
    return [
      `SUP-${2000 + i}`,
      `${pick(r, ['Nord', 'Apex', 'Vertex', 'Terra', 'Lumina', 'Pioneer', 'Cascade', 'Orient'])} ${pick(r, ['Systems', 'Works', 'Industries', 'Group', 'Co'])}`,
      pick(r, cats),
      pick(r, REGIONS),
      onTime,
      round(70 + r() * 29),
      7 + Math.floor(r() * 150),
      round(85 + r() * 25),
      onTime > 85 ? 'Low' : onTime > 70 ? 'Medium' : 'High',
      bids,
      Math.floor(bids * r() * 0.6),
    ]
  })
  return csv(
    ['supplier_id', 'name', 'category', 'region', 'on_time_rate_pct', 'quality_rate_pct', 'avg_lead_time_days', 'price_index', 'risk_level', 'bids_submitted', 'bids_won'],
    rows,
  )
}

export function genFieldDaily(n = 45): string {
  const r = rng(29)
  const base = Date.parse('2026-03-01')
  const trades = ['Concrete', 'Steel', 'MEP', 'Electrical', 'Finishing', 'Earthworks']
  const weather = ['Clear', 'Cloudy', 'Rain', 'Windy', 'Hot']
  const rows = Array.from({ length: n }, (_, i) => [
    isoDate(base, Math.floor(i / 3)),
    `Site-${1 + (i % 3)}`,
    pick(r, weather),
    round(8 + r() * 30),
    20 + Math.floor(r() * 180),
    pick(r, trades),
    round(r() * 100),
    pick(r, ['m3', 'm2', 'lm', 'units', 't']),
    round(70 + r() * 50),
    pick(r, ['None', 'Material delay', 'Weather', 'RFI pending', 'Access']),
  ])
  return csv(['date', 'site', 'weather', 'temp_c', 'crew_size', 'trade', 'installed_qty', 'unit', 'productivity_index', 'blocker'], rows)
}

export function genTelemetry(n = 72): string {
  const r = rng(31)
  const base = Date.parse('2026-05-25T00:00:00Z')
  const rows = Array.from({ length: n }, (_, i) => {
    const hr = i % 24
    const occ = hr > 7 && hr < 19 ? Math.floor(r() * 90) : Math.floor(r() * 8)
    return [
      new Date(base + i * 3600000).toISOString(),
      `L${1 + (i % 12)}`,
      round(20 + r() * 6, 1),
      round(420 + occ * 6 + r() * 80),
      occ,
      round(40 + occ * 0.8 + r() * 30, 1),
      round(22 + r() * 2, 1),
    ]
  })
  return csv(['timestamp', 'zone', 'temp_c', 'co2_ppm', 'occupancy', 'energy_kwh', 'setpoint_c'], rows)
}

export function genRfiPairs(n = 36): string {
  const r = rng(37)
  const disc = ['Structural', 'MEP', 'Architectural', 'Civil', 'Fire']
  const arr = Array.from({ length: n }, (_, i) => ({
    rfi_id: `RFI-${500 + i}`,
    discipline: pick(r, disc),
    subject: pick(r, ['Beam penetration conflict', 'Door schedule mismatch', 'Slab edge detail', 'Duct routing clash', 'Rebar congestion', 'Fire-rating clarification']),
    question: 'Drawing reference does not match the specification. Please confirm the governing requirement.',
    response: 'Refer to the updated detail; specification governs. Coordinate with the model revision issued.',
    status: pick(r, ['Open', 'Answered', 'Closed']),
    days_open: Math.floor(r() * 28),
    cost_impact_usd: Math.floor(r() * 40000),
  }))
  return JSON.stringify(arr, null, 2)
}

export function genDefects(n = 36): string {
  const r = rng(41)
  const arr = Array.from({ length: n }, (_, i) => ({
    image_id: `IMG-${9000 + i}`,
    capture_date: isoDate(Date.parse('2026-04-01'), Math.floor(r() * 50)),
    trade: pick(r, ['Concrete', 'MEP', 'Finishes', 'Envelope', 'Structure']),
    defect_type: pick(r, ['crack', 'spalling', 'water_ingress', 'misalignment', 'exposed_rebar', 'incomplete_seal']),
    severity: pick(r, ['low', 'medium', 'high']),
    bbox: [Math.floor(r() * 800), Math.floor(r() * 600), Math.floor(50 + r() * 200), Math.floor(50 + r() * 200)],
    confidence: round(0.6 + r() * 0.39, 2),
    status: pick(r, ['open', 'in_review', 'closed']),
  }))
  return JSON.stringify(arr, null, 2)
}

export function genCobie(n = 40): string {
  const r = rng(43)
  const types = ['AHU', 'Chiller', 'Pump', 'VAV', 'Fan', 'Luminaire', 'Sensor', 'Valve']
  const rows = Array.from({ length: n }, (_, i) => {
    const t = pick(r, types)
    return [
      `${t}-${String(i + 1).padStart(3, '0')}`,
      'modelteam@studio.aec',
      isoDate(Date.parse('2026-02-01'), Math.floor(r() * 90)),
      `${t} Type ${1 + Math.floor(r() * 4)}`,
      `L${1 + Math.floor(r() * 12)}-Room-${100 + Math.floor(r() * 60)}`,
      `${t} unit serving zone ${1 + Math.floor(r() * 8)}`,
      `SN-${Math.floor(r() * 9_000_000) + 1_000_000}`,
      isoDate(Date.parse('2026-06-01'), Math.floor(r() * 30)),
      `${1 + Math.floor(r() * 5)} years`,
    ]
  })
  return csv(['Name', 'CreatedBy', 'CreatedOn', 'TypeName', 'Space', 'Description', 'SerialNumber', 'InstallationDate', 'WarrantyDuration'], rows)
}

export function genSiteGeoJSON(): string {
  const fc = {
    type: 'FeatureCollection',
    name: 'site_boundary_and_zoning',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    features: [
      { type: 'Feature', properties: { id: 'PARCEL-001', use: 'site_boundary', zoning: 'C-3 Commercial', area_m2: 14200, far: 8.5 }, geometry: { type: 'Polygon', coordinates: [[[-0.1278, 51.5074], [-0.1262, 51.5074], [-0.1262, 51.5086], [-0.1278, 51.5086], [-0.1278, 51.5074]]] } },
      { type: 'Feature', properties: { id: 'FOOTPRINT-001', use: 'building_footprint', floors: 32, height_m: 142 }, geometry: { type: 'Polygon', coordinates: [[[-0.1274, 51.5077], [-0.1266, 51.5077], [-0.1266, 51.5083], [-0.1274, 51.5083], [-0.1274, 51.5077]]] } },
      { type: 'Feature', properties: { id: 'EASEMENT-001', use: 'utility_easement', width_m: 4 }, geometry: { type: 'LineString', coordinates: [[-0.1278, 51.508], [-0.1262, 51.508]] } },
    ],
  }
  return JSON.stringify(fc, null, 2)
}

export function genIfcSnippet(): string {
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('MeridianTower-STR.ifc','2026-05-20T09:14:00',('Apex Engineering'),('AEC Studio'),'IFC4X3','Revit 2026','');
FILE_SCHEMA(('IFC4X3'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvhhKNkz0kP$Aex3$Vd2P',#2,'Meridian Tower',$,$,$,$,(#20),#7);
#2=IFCOWNERHISTORY(#3,#6,$,.ADDED.,$,$,$,1747724040);
#11=IFCSITE('1xS3BCkdj5wQ3FbX',#2,'Site',$,$,#30,$,$,.ELEMENT.,(51,30,26),(0,7,40),0.,$,$);
#41=IFCBUILDING('2Gk3Dl5jb5wA8u',#2,'Tower',$,$,#31,$,$,.ELEMENT.,$,$,$);
#101=IFCWALLSTANDARDCASE('3Df9Gk2mn0bQ',#2,'Core Wall C-12',$,'RC 400mm',#110,#120,'wall-0112');
#102=IFCSLAB('4Hg2Lp9kq1cR',#2,'Slab L12',$,'PT 250mm',#111,#121,'slab-1201',.FLOOR.);
#103=IFCCOLUMN('5Jk1Mn8lr2dS',#2,'Column B-7',$,'RC 800x800',#112,#122,'col-0807');
#104=IFCBEAM('6Lm0No7ms3eT',#2,'Transfer Beam',$,'Steel UC356',#113,#123,'beam-0042');
#201=IFCPROPERTYSINGLEVALUE('FireRating',$,IFCLABEL('120min'),$);
#202=IFCPROPERTYSINGLEVALUE('LoadBearing',$,IFCBOOLEAN(.T.),$);
ENDSEC;
END-ISO-10303-21;
`
}

/* ========================================================== Catalog === */
export const CATALOG: CatalogDataset[] = [
  {
    id: 'global-cost-benchmarks',
    name: 'Global Cost Benchmarks — Multi-Sector',
    provider: 'Meridian Cost Consultancy',
    category: 'Cost & Estimating',
    modality: 'Tabular',
    license: 'Commercial',
    price: 4800,
    quality: 98,
    rating: 4.9,
    downloads: 1880,
    records: 92000,
    sizeGB: 0.6,
    anonymized: true,
    updated: '2026-05-21',
    tags: ['benchmarking', 'cost/m²', 'unit-rates', 'BOQ'],
    accent: 'rose',
    description: 'Normalized cost outcomes across sectors and regions — cost per m², trade splits and delivery method — for cross-project benchmarking.',
    files: [
      { id: 'f1', name: 'cost_benchmarks_sample.csv', format: 'CSV', size: '12 KB', rows: 48, free: true, generate: () => genCostBenchmarks(48) },
      { id: 'f2', name: 'cost_benchmarks_full.csv', format: 'CSV', size: '8.4 MB', rows: 92000, free: false },
      { id: 'f3', name: 'methodology.pdf', format: 'PDF', size: '320 KB', free: false },
    ],
  },
  {
    id: 'schedule-outcomes',
    name: 'Schedule Outcomes — 38k Projects',
    provider: 'Continuum Controls',
    category: 'Schedule & Controls',
    modality: 'Tabular',
    license: 'Commercial',
    price: 6200,
    quality: 97,
    rating: 5.0,
    downloads: 960,
    records: 38000,
    sizeGB: 1.1,
    anonymized: true,
    updated: '2026-05-18',
    tags: ['P6', 'delays', 'critical-path', 'float'],
    accent: 'amber',
    description: 'Baseline-vs-actual activity data with float, % complete and delay drivers — the calibration set for delay-risk forecasting.',
    files: [
      { id: 'f1', name: 'schedule_activities_sample.csv', format: 'CSV', size: '9 KB', rows: 60, free: true, generate: () => genSchedule(60) },
      { id: 'f2', name: 'schedule_full.csv', format: 'CSV', size: '14 MB', rows: 38000, free: false },
    ],
  },
  {
    id: 'ifc-object-library',
    name: 'IFC Object Library (classified)',
    provider: 'OpenBIM Collective',
    category: 'BIM & Models',
    modality: 'BIM Model',
    license: 'Research',
    price: 0,
    quality: 94,
    rating: 4.7,
    downloads: 5240,
    records: 2100000,
    sizeGB: 0.9,
    anonymized: false,
    updated: '2026-04-30',
    tags: ['IFC', 'IFC4.3', 'OmniClass', 'objects'],
    accent: 'blue',
    description: 'Classified IFC building objects with geometry and property sets — open for research and model-analysis training.',
    files: [
      { id: 'f1', name: 'sample_model.ifc', format: 'IFC', size: '4 KB', free: true, generate: () => genIfcSnippet() },
      { id: 'f2', name: 'object_index.json', format: 'JSON', size: '2 KB', free: true, generate: () => genRfiPairs(8) },
      { id: 'f3', name: 'ifc_library_full.zip', format: 'ZIP', size: '880 MB', free: false },
    ],
  },
  {
    id: 'epd-carbon-factors',
    name: 'EPD & Embodied-Carbon Factors',
    provider: 'CarbonLedger',
    category: 'Sustainability',
    modality: 'Tabular',
    license: 'Commercial',
    price: 2900,
    quality: 95,
    rating: 4.8,
    downloads: 3120,
    records: 410000,
    sizeGB: 0.3,
    anonymized: false,
    updated: '2026-05-11',
    tags: ['EPD', 'GWP', 'LCA', 'ESG'],
    accent: 'emerald',
    description: 'Normalized environmental product declarations with consistent declared units — comparable embodied-carbon factors across materials and regions.',
    files: [
      { id: 'f1', name: 'epd_factors_sample.csv', format: 'CSV', size: '7 KB', rows: 50, free: true, generate: () => genEpdCarbon(50) },
      { id: 'f2', name: 'epd_factors_full.csv', format: 'CSV', size: '36 MB', rows: 410000, free: false },
    ],
  },
  {
    id: 'supplier-performance',
    name: 'Supplier Performance Index',
    provider: 'SupplyGraph',
    category: 'Procurement',
    modality: 'Tabular',
    license: 'Commercial',
    price: 3800,
    quality: 91,
    rating: 4.5,
    downloads: 740,
    records: 64000,
    sizeGB: 0.2,
    anonymized: true,
    updated: '2026-05-19',
    tags: ['suppliers', 'lead-time', 'on-time', 'risk'],
    accent: 'lime',
    description: 'Anonymized supplier scorecards — on-time and quality rates, lead times, price indices and risk tiers across categories and regions.',
    files: [
      { id: 'f1', name: 'supplier_index_sample.csv', format: 'CSV', size: '6 KB', rows: 40, free: true, generate: () => genSuppliers(40) },
      { id: 'f2', name: 'supplier_index_full.csv', format: 'CSV', size: '5.1 MB', rows: 64000, free: false },
    ],
  },
  {
    id: 'rfi-response-pairs',
    name: 'RFI → Response Pairs (NLP)',
    provider: 'BuildCorp Data Trust',
    category: 'AI Training',
    modality: 'Document',
    license: 'Commercial',
    price: 5400,
    quality: 93,
    rating: 4.7,
    downloads: 1270,
    records: 1280000,
    sizeGB: 0.5,
    anonymized: true,
    updated: '2026-05-15',
    tags: ['RFI', 'LLM', 'fine-tuning', 'NLP'],
    accent: 'fuchsia',
    description: 'Question/response pairs from real RFIs with discipline labels and cost impact — a fine-tuning corpus for construction-domain language models.',
    files: [
      { id: 'f1', name: 'rfi_pairs_sample.json', format: 'JSON', size: '8 KB', rows: 36, free: true, generate: () => genRfiPairs(36) },
      { id: 'f2', name: 'rfi_pairs_full.json', format: 'JSON', size: '46 MB', rows: 1280000, free: false },
    ],
  },
  {
    id: 'defect-annotations',
    name: 'Defect & NCR Annotations (CV)',
    provider: 'QualityVision',
    category: 'Quality',
    modality: 'Imagery',
    license: 'Commercial',
    price: 4100,
    quality: 94,
    rating: 4.7,
    downloads: 980,
    records: 760000,
    sizeGB: 2.2,
    anonymized: true,
    updated: '2026-05-13',
    tags: ['defects', 'NCR', 'bbox', 'computer-vision'],
    accent: 'cyan',
    description: 'Bounding-box defect annotations (cracks, spalling, water ingress…) with trade, severity and confidence — for computer-vision QA models.',
    files: [
      { id: 'f1', name: 'defect_annotations_sample.json', format: 'JSON', size: '9 KB', rows: 36, free: true, generate: () => genDefects(36) },
      { id: 'f2', name: 'images_full.zip', format: 'ZIP', size: '2.2 GB', free: false },
    ],
  },
  {
    id: 'cobie-handover',
    name: 'COBie Handover Asset Registers',
    provider: 'TwinStream',
    category: 'Handover & Assets',
    modality: 'Tabular',
    license: 'Commercial',
    price: 3300,
    quality: 90,
    rating: 4.6,
    downloads: 540,
    records: 120000,
    sizeGB: 0.4,
    anonymized: true,
    updated: '2026-05-09',
    tags: ['COBie', 'assets', 'O&M', 'FM'],
    accent: 'violet',
    description: 'Validated COBie component registers ready for CMMS import — closing the handover "data drop" between construction and operations.',
    files: [
      { id: 'f1', name: 'cobie_components_sample.csv', format: 'CSV', size: '8 KB', rows: 40, free: true, generate: () => genCobie(40) },
      { id: 'f2', name: 'cobie_full.xlsx', format: 'XLSX', size: '3.8 MB', free: false },
    ],
  },
  {
    id: 'building-telemetry',
    name: 'Building Operations Telemetry',
    provider: 'TwinStream',
    category: 'Operations',
    modality: 'Time-series',
    license: 'Commercial',
    price: 4400,
    quality: 89,
    rating: 4.6,
    downloads: 610,
    records: 920000000,
    sizeGB: 3.1,
    anonymized: true,
    updated: '2026-05-25',
    tags: ['BMS', 'IoT', 'energy', 'occupancy'],
    accent: 'sky',
    description: 'Time-series sensor telemetry — temperature, CO₂, occupancy and energy by zone — for building-performance and fault-detection models.',
    files: [
      { id: 'f1', name: 'telemetry_sample.csv', format: 'CSV', size: '11 KB', rows: 72, free: true, generate: () => genTelemetry(72) },
      { id: 'f2', name: 'telemetry_full.csv', format: 'CSV', size: '3.1 GB', free: false },
    ],
  },
  {
    id: 'site-gis-zoning',
    name: 'Site Boundary & Zoning GIS',
    provider: 'GeoFrame',
    category: 'Geospatial',
    modality: 'Geospatial',
    license: 'Open',
    price: 0,
    quality: 92,
    rating: 4.5,
    downloads: 4100,
    records: 1800000,
    sizeGB: 0.1,
    anonymized: false,
    updated: '2026-03-28',
    tags: ['GIS', 'GeoJSON', 'zoning', 'parcels'],
    accent: 'teal',
    description: 'Open site boundaries, building footprints and zoning overlays as GeoJSON — link project data to physical location and constraints.',
    files: [
      { id: 'f1', name: 'site_boundary.geojson', format: 'GeoJSON', size: '3 KB', free: true, generate: () => genSiteGeoJSON() },
    ],
  },
  {
    id: 'field-daily-productivity',
    name: 'Field Daily Reports & Productivity',
    provider: 'BuildCorp Data Trust',
    category: 'Construction Field',
    modality: 'Tabular',
    license: 'Research',
    price: 0,
    quality: 90,
    rating: 4.4,
    downloads: 2240,
    records: 540000,
    sizeGB: 0.2,
    anonymized: true,
    updated: '2026-05-22',
    tags: ['daily-reports', 'productivity', 'manpower', 'weather'],
    accent: 'amber',
    description: 'Daily site logs with crew sizes, installed quantities, weather and blockers — for productivity analytics and delay root-cause modeling.',
    files: [
      { id: 'f1', name: 'daily_reports_sample.csv', format: 'CSV', size: '6 KB', rows: 45, free: true, generate: () => genFieldDaily(45) },
      { id: 'f2', name: 'daily_reports_full.csv', format: 'CSV', size: '4.6 MB', rows: 540000, free: false },
    ],
  },
  {
    id: 'progress-imagery',
    name: 'Site Progress Imagery (geotagged)',
    provider: 'VantagePoint Capture',
    category: 'Reality Capture',
    modality: 'Imagery',
    license: 'Enterprise',
    price: null,
    quality: 92,
    rating: 4.6,
    downloads: 204,
    records: 5900000,
    sizeGB: 9400,
    anonymized: true,
    updated: '2026-05-24',
    tags: ['drone', 'progress', 'segmentation', '360'],
    accent: 'cyan',
    description: 'Geotagged, time-sequenced site imagery with progress labels — for progress-verification and as-built comparison models.',
    files: [
      { id: 'f1', name: 'capture_manifest_sample.json', format: 'JSON', size: '9 KB', rows: 36, free: true, generate: () => genDefects(36) },
      { id: 'f2', name: 'imagery_full.zip', format: 'ZIP', size: '9.4 TB', free: false },
    ],
  },
]

export const CATEGORIES = Array.from(new Set(CATALOG.map((d) => d.category)))
export const MODALITIES: Modality[] = ['Tabular', 'BIM Model', 'Imagery', 'Document', 'Time-series', 'Point Cloud', 'Geospatial']
export const LICENSES: License[] = ['Open', 'Research', 'Commercial', 'Enterprise']

export function getDataset(id: string): CatalogDataset | undefined {
  return CATALOG.find((d) => d.id === id)
}
