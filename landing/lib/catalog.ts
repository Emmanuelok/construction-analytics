/* Browsable dataset catalog for the landing "Data Center" — mirrors the studio's
 * real catalog. Filter/sort logic is pure and unit-tested before any UI. */

export type Modality = 'Tabular' | 'BIM Model' | 'Imagery' | 'Document' | 'Time-series' | 'Geospatial'
export type License = 'Open' | 'Research' | 'Commercial' | 'Enterprise'

export type Dataset = {
  id: string
  name: string
  provider: string
  category: string
  modality: Modality
  license: License
  price: number | null // null = on request, 0 = free
  quality: number
  rating: number
  downloads: number
  records: number
  tags: string[]
  description: string
  accent: string // tailwind text-color class
}

export const DATASETS: Dataset[] = [
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
    tags: ['benchmarking', 'cost/m²', 'unit-rates', 'BOQ'],
    description: 'Normalized cost outcomes across sectors and regions — cost per m², trade splits and delivery method.',
    accent: 'text-rose-400',
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
    tags: ['P6', 'delays', 'critical-path', 'float'],
    description: 'Baseline-vs-actual activity data with float, % complete and delay drivers — calibration for delay-risk forecasting.',
    accent: 'text-amber-400',
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
    tags: ['IFC', 'IFC4.3', 'OmniClass', 'objects'],
    description: 'Classified IFC building objects with geometry and property sets — open for research and model-analysis training.',
    accent: 'text-blue-400',
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
    tags: ['EPD', 'GWP', 'LCA', 'ESG'],
    description: 'Normalized environmental product declarations with consistent declared units — comparable embodied-carbon factors.',
    accent: 'text-teal-400',
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
    tags: ['suppliers', 'lead-time', 'on-time', 'risk'],
    description: 'Anonymized supplier scorecards — on-time and quality rates, lead times, price indices and risk tiers.',
    accent: 'text-emerald-400',
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
    tags: ['RFI', 'LLM', 'fine-tuning', 'NLP'],
    description: 'Question/response pairs from real RFIs with discipline labels and cost impact — a construction-domain fine-tuning corpus.',
    accent: 'text-fuchsia-400',
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
    tags: ['defects', 'NCR', 'bbox', 'computer-vision'],
    description: 'Bounding-box defect annotations (cracks, spalling, water ingress) with trade, severity and confidence.',
    accent: 'text-cyan-400',
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
    tags: ['COBie', 'assets', 'O&M', 'FM'],
    description: 'Validated COBie component registers ready for CMMS import — closing the handover data drop.',
    accent: 'text-violet-400',
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
    tags: ['BMS', 'IoT', 'energy', 'occupancy'],
    description: 'Time-series sensor telemetry — temperature, CO₂, occupancy and energy by zone — for performance & fault-detection models.',
    accent: 'text-sky-400',
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
    tags: ['GIS', 'GeoJSON', 'zoning', 'parcels'],
    description: 'Open site boundaries, building footprints and zoning overlays as GeoJSON — link project data to location.',
    accent: 'text-teal-400',
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
    tags: ['daily-reports', 'productivity', 'manpower', 'weather'],
    description: 'Daily site logs with crew sizes, installed quantities, weather and blockers — for productivity analytics.',
    accent: 'text-amber-400',
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
    tags: ['drone', 'progress', 'segmentation', '360'],
    description: 'Geotagged, time-sequenced site imagery with progress labels — for progress-verification and as-built models.',
    accent: 'text-cyan-400',
  },
]

export const CATEGORIES = Array.from(new Set(DATASETS.map((d) => d.category)))
export const LICENSES: License[] = ['Open', 'Research', 'Commercial', 'Enterprise']
export type SortKey = 'popular' | 'quality' | 'records' | 'price-low'

export type CatalogFilter = { q?: string; category?: string; license?: string; sort?: SortKey }

/** Pure filter + sort over the catalog — the searchable Data Center logic. */
export function filterDatasets(all: Dataset[], f: CatalogFilter): Dataset[] {
  const q = (f.q ?? '').trim().toLowerCase()
  let r = all.filter((d) => {
    if (f.category && f.category !== 'All' && d.category !== f.category) return false
    if (f.license && f.license !== 'All' && d.license !== f.license) return false
    if (q) {
      const hay = `${d.name} ${d.provider} ${d.category} ${d.tags.join(' ')} ${d.description}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const sort = f.sort ?? 'popular'
  r = [...r].sort((a, b) => {
    if (sort === 'quality') return b.quality - a.quality
    if (sort === 'records') return b.records - a.records
    if (sort === 'price-low') return (a.price ?? Infinity) - (b.price ?? Infinity)
    return b.downloads - a.downloads // popular
  })
  return r
}

export function priceLabel(price: number | null): string {
  if (price === null) return 'On request'
  if (price === 0) return 'Free'
  return `$${price.toLocaleString()}`
}

export function compactNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
