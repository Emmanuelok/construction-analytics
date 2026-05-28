import type { Accent } from '@/lib/nav'

/* ============================================================ Domain areas = */
export type DomainArea = {
  name: string
  categories: string
  purpose: string
  capabilities: string
  accent: Accent
}

export const DOMAIN_AREAS: DomainArea[] = [
  { name: 'Project Identity & Master Data', categories: 'Profiles, clients, type, phase, delivery method, stakeholders', purpose: 'Unified project record & cross-project comparison', capabilities: 'Benchmarking, portfolio analytics, similarity search', accent: 'blue' },
  { name: 'BIM & Digital Model Data', categories: '3D models, IFC, Revit, COBie, object metadata, versions', purpose: 'Structure model-based data for design, build & AI training', capabilities: 'Clash prediction, quantity extraction, object recognition', accent: 'sky' },
  { name: 'Drawings, Documents & Specs', categories: '2D drawings, PDFs, specifications, submittals, reports', purpose: 'Centralize & make unstructured data machine-readable', capabilities: 'Document intelligence, spec search, drawing comparison', accent: 'amber' },
  { name: 'Engineering & Design Data', categories: 'Structural, civil, MEP, geotech, energy, fire, façade', purpose: 'Capture engineering information across disciplines', capabilities: 'Design risk detection, code compliance, optimization', accent: 'violet' },
  { name: 'Cost, Estimating & Quantity', categories: 'Takeoffs, cost plans, unit rates, BOQs, budgets', purpose: 'Cost intelligence & estimating automation', capabilities: 'Cost prediction, quantity-cost correlation, overrun forecast', accent: 'rose' },
  { name: 'Procurement & Supply Chain', categories: 'POs, supplier data, bids, long-lead items, logistics', purpose: 'Procurement intelligence & supplier marketplace', capabilities: 'Supplier recommendation, lead-time prediction', accent: 'lime' },
  { name: 'Contracts & Commercial', categories: 'Contracts, variations, claims, payment applications', purpose: 'Manage commercial risk & contract intelligence', capabilities: 'Claim prediction, change impact, contract risk scoring', accent: 'amber' },
  { name: 'Schedule & Project Controls', categories: 'Baselines, milestones, critical path, earned value', purpose: 'Connect time, cost, scope & delivery performance', capabilities: 'Delay prediction, critical-path analytics, EVA', accent: 'rose' },
  { name: 'Construction Field Data', categories: 'Daily reports, manpower, equipment, inspections', purpose: 'Capture real-time construction execution data', capabilities: 'Productivity analytics, delay root-cause analysis', accent: 'amber' },
  { name: 'Quality Data', categories: 'Inspections, test results, NCRs, punch lists, QA/QC', purpose: 'Improve construction quality & handover readiness', capabilities: 'Defect prediction, contractor performance scoring', accent: 'cyan' },
  { name: 'Health, Safety & Risk', categories: 'Incidents, near misses, permits, hazards, risk registers', purpose: 'Safer construction & risk management', capabilities: 'Safety risk prediction, high-risk activity detection', accent: 'rose' },
  { name: 'Reality Capture & Visual', categories: 'Drone imagery, laser scans, point clouds, 360° walks', purpose: 'Convert site conditions into analyzable records', capabilities: 'Computer vision, progress verification, as-built compare', accent: 'cyan' },
  { name: 'Geospatial, Survey & Infra', categories: 'GIS layers, boundaries, surveys, utilities, zoning', purpose: 'Link AEC data to physical location & infrastructure', capabilities: 'Site suitability, utility conflict detection', accent: 'teal' },
  { name: 'Sustainability & ESG', categories: 'Embodied/operational carbon, energy, waste, EPDs, LCA', purpose: 'Sustainable design, reporting & procurement', capabilities: 'Carbon optimization, lifecycle cost, ESG reporting', accent: 'emerald' },
  { name: 'Handover, Asset & Facilities', categories: 'Asset registers, warranties, O&M manuals, as-builts', purpose: 'Building handover & long-term asset management', capabilities: 'Predictive maintenance, lifecycle analytics', accent: 'violet' },
  { name: 'Operations & Building Performance', categories: 'BMS, IoT sensors, occupancy, energy meters, work orders', purpose: 'Connect design & build to real-world performance', capabilities: 'Building performance analytics, fault detection', accent: 'sky' },
  { name: 'Financial & Enterprise', categories: 'Budgets, actuals, cash flow, invoices, margins, HR, CRM', purpose: 'Corporate visibility across projects & portfolios', capabilities: 'Margin analysis, cash-flow forecasting, portfolio risk', accent: 'emerald' },
  { name: 'Communications & Collaboration', categories: 'RFIs, emails, minutes, approvals, transmittals, decisions', purpose: 'Extract knowledge & preserve decision history', capabilities: 'Knowledge search, decision tracking, action extraction', accent: 'blue' },
  { name: 'Regulatory, Legal & Compliance', categories: 'Codes, permits, approvals, regulations, audit logs', purpose: 'Meet legal, statutory & contractual requirements', capabilities: 'Compliance checking, permit tracking, legal risk', accent: 'amber' },
  { name: 'Market, External & Benchmark', categories: 'Market prices, labor rates, inflation, weather, indices', purpose: 'Enrich project data with external context', capabilities: 'Price escalation forecasting, weather delay analysis', accent: 'cyan' },
  { name: 'Historical Project Benchmark', categories: 'Completed outcomes, cost/schedule history, productivity', purpose: 'High-value training dataset & corporate benchmarking', capabilities: 'Predictive modeling, project comparison, AI training', accent: 'fuchsia' },
  { name: 'AI Training & ML Datasets', categories: 'Structured/semi/unstructured data prepared for AI', purpose: 'Curated datasets for organizations training AI models', capabilities: 'Model training, evaluation, synthetic data, RAG', accent: 'fuchsia' },
  { name: 'Data Governance, Security & Licensing', categories: 'Ownership, consent, access, anonymization, lineage', purpose: 'Protect contributors & buyers while enabling exchange', capabilities: 'Data quality scoring, privacy, permission management', accent: 'teal' },
  { name: 'Platform Analytics & Decision Engines', categories: 'Dashboards, AI agents, forecasting & recommendation engines', purpose: 'Help stakeholders make better decisions', capabilities: 'Predictive analytics, NL querying, scenario modeling', accent: 'blue' },
]

/* =========================================================== Core modules = */
export type CoreModule = { name: string; what: string; path: string; accent: Accent }
export const CORE_MODULES: CoreModule[] = [
  { name: 'Data Lakehouse / Warehouse', what: 'Store structured, semi-structured & unstructured AEC data at scale', path: '/lakehouse', accent: 'sky' },
  { name: 'AEC Data Marketplace', what: 'Publish, license, buy & access curated datasets', path: '/marketplace', accent: 'emerald' },
  { name: 'BIM Data Engine', what: 'Parse, classify, compare & analyze BIM / IFC / Revit data', path: '/bim', accent: 'blue' },
  { name: 'Document Intelligence Engine', what: 'Extract from drawings, specs, contracts, RFIs & submittals', path: '/documents', accent: 'amber' },
  { name: 'Cost & Schedule Intelligence', what: 'Analyze estimates, budgets, schedules, productivity & delays', path: '/cost-schedule', accent: 'rose' },
  { name: 'Procurement Intelligence', what: 'Supplier performance, bids, lead times, delivery risk', path: '/procurement', accent: 'lime' },
  { name: 'Construction Analytics Engine', what: 'Field progress, manpower, equipment, safety & quality', path: '/field', accent: 'amber' },
  { name: 'Reality Capture / Computer Vision', what: 'Photos, videos, drones, point clouds & 360° captures', path: '/reality-capture', accent: 'cyan' },
  { name: 'Sustainability & ESG Engine', what: 'Carbon, energy, waste, water, materials & lifecycle', path: '/sustainability', accent: 'emerald' },
  { name: 'Digital Twin / Asset Intelligence', what: 'Connect design, build, handover & operations data', path: '/digital-twin', accent: 'violet' },
  { name: 'AI Training Dataset Engine', what: 'Curate, label, anonymize, version & license datasets', path: '/ai-studio', accent: 'fuchsia' },
  { name: 'Governance, Privacy & Compliance', what: 'Permissions, anonymization, ownership, lineage & audit', path: '/governance', accent: 'teal' },
  { name: 'Natural Language Analytics', what: 'Ask “which projects exceeded budget and why?”', path: '/ask', accent: 'violet' },
  { name: 'Executive Decision Dashboard', what: 'High-level insight for owners, contractors & investors', path: '/insights', accent: 'cyan' },
]

/* ============================================================ Stakeholders = */
export type Stakeholder = { name: string; value: string; accent: Accent }
export const STAKEHOLDERS: Stakeholder[] = [
  { name: 'AI companies', value: 'Access high-quality AEC datasets for model training & evaluation', accent: 'fuchsia' },
  { name: 'Construction companies', value: 'Benchmark cost, schedule, productivity, quality & safety', accent: 'amber' },
  { name: 'Design firms', value: 'Improve design intelligence, BIM quality & code compliance', accent: 'blue' },
  { name: 'Owners & developers', value: 'Better investment, procurement, cost, risk & delivery decisions', accent: 'cyan' },
  { name: 'Suppliers & manufacturers', value: 'Understand demand, pricing, procurement trends & performance', accent: 'lime' },
  { name: 'Facility managers', value: 'Use asset & operational data for maintenance & optimization', accent: 'violet' },
  { name: 'Insurers & financiers', value: 'Analyze project risk, claims history & asset reliability', accent: 'rose' },
  { name: 'Government & regulators', value: 'Understand delivery, compliance, safety & sustainability trends', accent: 'teal' },
]

/* ================================================================ Projects = */
export type Phase = 'Design' | 'Procurement' | 'Construction' | 'Handover' | 'Operations'
export type Project = {
  id: string
  name: string
  sector: string
  location: string
  value: number
  gfa: number
  phase: Phase
  delivery: string
  progress: number
  costVariance: number // %
  scheduleVariance: number // days, + = late
  risk: number // 0-100
  safety: number // 0-100
  quality: number // 0-100
  carbon: number // kgCO2e/m2
  rfis: number
  clashes: number
}

export const PROJECTS: Project[] = [
  { id: 'PRJ-1042', name: 'Meridian Tower', sector: 'Commercial High-Rise', location: 'Dubai, UAE', value: 820_000_000, gfa: 142_000, phase: 'Construction', delivery: 'Design-Build', progress: 64, costVariance: 4.2, scheduleVariance: 18, risk: 62, safety: 91, quality: 88, carbon: 612, rfis: 1240, clashes: 38 },
  { id: 'PRJ-0987', name: 'Harbour Point Mixed-Use', sector: 'Mixed-Use', location: 'Singapore', value: 540_000_000, gfa: 98_000, phase: 'Construction', delivery: 'Construction Mgmt', progress: 47, costVariance: 1.1, scheduleVariance: -6, risk: 38, safety: 95, quality: 92, carbon: 540, rfis: 870, clashes: 21 },
  { id: 'PRJ-1135', name: 'Northgate Hospital', sector: 'Healthcare', location: 'Manchester, UK', value: 410_000_000, gfa: 76_000, phase: 'Construction', delivery: 'IPD', progress: 58, costVariance: 7.8, scheduleVariance: 42, risk: 74, safety: 87, quality: 84, carbon: 690, rfis: 1610, clashes: 64 },
  { id: 'PRJ-0771', name: 'Aurora Data Center', sector: 'Data Center', location: 'Phoenix, USA', value: 1_200_000_000, gfa: 64_000, phase: 'Procurement', delivery: 'EPC', progress: 22, costVariance: -2.4, scheduleVariance: -12, risk: 31, safety: 97, quality: 90, carbon: 480, rfis: 290, clashes: 9 },
  { id: 'PRJ-1290', name: 'Riverside Transit Hub', sector: 'Infrastructure', location: 'Toronto, Canada', value: 980_000_000, gfa: 54_000, phase: 'Construction', delivery: 'PPP', progress: 71, costVariance: 11.5, scheduleVariance: 96, risk: 83, safety: 82, quality: 79, carbon: 820, rfis: 2240, clashes: 102 },
  { id: 'PRJ-1018', name: 'Cedar Park Residences', sector: 'Residential', location: 'Austin, USA', value: 220_000_000, gfa: 61_000, phase: 'Handover', delivery: 'Design-Bid-Build', progress: 96, costVariance: 2.9, scheduleVariance: 8, risk: 28, safety: 94, quality: 91, carbon: 430, rfis: 540, clashes: 12 },
  { id: 'PRJ-0640', name: 'Helix Research Campus', sector: 'Education / Science', location: 'Boston, USA', value: 670_000_000, gfa: 89_000, phase: 'Design', delivery: 'IPD', progress: 14, costVariance: 0.4, scheduleVariance: 0, risk: 22, safety: 98, quality: 93, carbon: 510, rfis: 120, clashes: 47 },
  { id: 'PRJ-1201', name: 'Solano Logistics Park', sector: 'Industrial', location: 'Valencia, Spain', value: 310_000_000, gfa: 130_000, phase: 'Construction', delivery: 'Design-Build', progress: 52, costVariance: 5.6, scheduleVariance: 24, risk: 55, safety: 89, quality: 86, carbon: 360, rfis: 700, clashes: 28 },
  { id: 'PRJ-0512', name: 'Lumen Airport T4', sector: 'Aviation', location: 'Doha, Qatar', value: 2_400_000_000, gfa: 210_000, phase: 'Construction', delivery: 'EPCM', progress: 39, costVariance: 9.3, scheduleVariance: 71, risk: 78, safety: 85, quality: 81, carbon: 740, rfis: 3120, clashes: 158 },
  { id: 'PRJ-1330', name: 'Greenfield Civic Center', sector: 'Public / Civic', location: 'Melbourne, Australia', value: 180_000_000, gfa: 38_000, phase: 'Operations', delivery: 'Design-Build', progress: 100, costVariance: -1.2, scheduleVariance: -3, risk: 19, safety: 96, quality: 94, carbon: 395, rfis: 410, clashes: 6 },
]

/* ============================================================= Marketplace = */
export type Modality = 'Tabular' | 'BIM Model' | 'Imagery' | 'Document' | 'Time-series' | 'Point Cloud' | 'Geospatial'
export type LicenseTier = 'Open' | 'Research' | 'Commercial' | 'Enterprise'
export type Dataset = {
  id: string
  name: string
  provider: string
  category: string
  modality: Modality
  records: number
  sizeGB: number
  quality: number // 0-100
  license: LicenseTier
  price: number | null // null = on request
  rating: number // 0-5
  downloads: number
  anonymized: boolean
  updated: string
  tags: string[]
  accent: Accent
}

export const DATASETS: Dataset[] = [
  { id: 'DS-001', name: 'Labeled Structural Drawings Corpus', provider: 'Apex Engineering Group', category: 'Document Intelligence', modality: 'Imagery', records: 482_000, sizeGB: 1240, quality: 96, license: 'Commercial', price: 48_000, rating: 4.9, downloads: 312, anonymized: true, updated: '2026-05-09', tags: ['drawings', 'classification', 'CV'], accent: 'amber' },
  { id: 'DS-002', name: 'Global Cost Benchmarks — Commercial', provider: 'Meridian Cost Consultancy', category: 'Cost & Estimating', modality: 'Tabular', records: 92_000, sizeGB: 14, quality: 98, license: 'Enterprise', price: null, rating: 4.8, downloads: 188, anonymized: true, updated: '2026-05-21', tags: ['benchmarking', 'unit-rates', 'BOQ'], accent: 'rose' },
  { id: 'DS-003', name: 'IFC Object Library (classified)', provider: 'OpenBIM Collective', category: 'BIM & Models', modality: 'BIM Model', records: 2_100_000, sizeGB: 880, quality: 94, license: 'Research', price: 0, rating: 4.7, downloads: 1450, anonymized: false, updated: '2026-04-30', tags: ['IFC', 'objects', 'OmniClass'], accent: 'blue' },
  { id: 'DS-004', name: 'Schedule Outcomes — 38k Projects', provider: 'Continuum Controls', category: 'Schedule & Controls', modality: 'Tabular', records: 38_000, sizeGB: 22, quality: 97, license: 'Commercial', price: 62_000, rating: 5.0, downloads: 96, anonymized: true, updated: '2026-05-18', tags: ['P6', 'delays', 'critical-path'], accent: 'rose' },
  { id: 'DS-005', name: 'Site Progress Imagery (geotagged)', provider: 'VantagePoint Capture', category: 'Reality Capture', modality: 'Imagery', records: 5_900_000, sizeGB: 9400, quality: 92, license: 'Commercial', price: 75_000, rating: 4.6, downloads: 204, anonymized: true, updated: '2026-05-24', tags: ['drone', 'progress', 'segmentation'], accent: 'cyan' },
  { id: 'DS-006', name: 'EPD & Embodied-Carbon Factors', provider: 'CarbonLedger', category: 'Sustainability', modality: 'Tabular', records: 410_000, sizeGB: 8, quality: 95, license: 'Commercial', price: 29_000, rating: 4.8, downloads: 540, anonymized: false, updated: '2026-05-11', tags: ['EPD', 'LCA', 'ESG'], accent: 'emerald' },
  { id: 'DS-007', name: 'RFI → Response Pairs (NLP)', provider: 'BuildCorp Data Trust', category: 'AI Training', modality: 'Document', records: 1_280_000, sizeGB: 46, quality: 93, license: 'Commercial', price: 54_000, rating: 4.7, downloads: 277, anonymized: true, updated: '2026-05-15', tags: ['RFI', 'LLM', 'fine-tuning'], accent: 'fuchsia' },
  { id: 'DS-008', name: 'Supplier Performance Index — MEP', provider: 'SupplyGraph', category: 'Procurement', modality: 'Tabular', records: 64_000, sizeGB: 6, quality: 91, license: 'Commercial', price: 38_000, rating: 4.5, downloads: 142, anonymized: true, updated: '2026-05-19', tags: ['suppliers', 'lead-time', 'risk'], accent: 'lime' },
  { id: 'DS-009', name: 'Point Cloud — As-Built Interiors', provider: 'ScanWorks', category: 'Reality Capture', modality: 'Point Cloud', records: 24_000, sizeGB: 18_200, quality: 90, license: 'Enterprise', price: null, rating: 4.4, downloads: 58, anonymized: true, updated: '2026-04-22', tags: ['LiDAR', 'as-built', 'registration'], accent: 'cyan' },
  { id: 'DS-010', name: 'Building Operations Telemetry', provider: 'TwinStream', category: 'Operations', modality: 'Time-series', records: 920_000_000, sizeGB: 3100, quality: 89, license: 'Commercial', price: 44_000, rating: 4.6, downloads: 119, anonymized: true, updated: '2026-05-25', tags: ['BMS', 'IoT', 'energy'], accent: 'sky' },
  { id: 'DS-011', name: 'Defect & NCR Image Set', provider: 'QualityVision', category: 'Quality', modality: 'Imagery', records: 760_000, sizeGB: 2200, quality: 94, license: 'Commercial', price: 41_000, rating: 4.7, downloads: 233, anonymized: true, updated: '2026-05-13', tags: ['defects', 'NCR', 'CV'], accent: 'cyan' },
  { id: 'DS-012', name: 'Site Boundary & Zoning GIS', provider: 'GeoFrame', category: 'Geospatial', modality: 'Geospatial', records: 1_800_000, sizeGB: 64, quality: 92, license: 'Open', price: 0, rating: 4.5, downloads: 2100, anonymized: false, updated: '2026-03-28', tags: ['GIS', 'zoning', 'parcels'], accent: 'teal' },
]

/* ================================================================ Suppliers = */
export type Supplier = {
  id: string
  name: string
  category: string
  region: string
  score: number
  onTime: number
  quality: number
  leadTime: number // days
  priceIndex: number // 100 = market
  risk: 'Low' | 'Medium' | 'High'
}
export const SUPPLIERS: Supplier[] = [
  { id: 'SUP-01', name: 'NordSteel Fabrication', category: 'Structural Steel', region: 'EU', score: 94, onTime: 96, quality: 95, leadTime: 42, priceIndex: 103, risk: 'Low' },
  { id: 'SUP-02', name: 'Apex MEP Systems', category: 'MEP Equipment', region: 'NA', score: 88, onTime: 89, quality: 92, leadTime: 68, priceIndex: 98, risk: 'Low' },
  { id: 'SUP-03', name: 'Vertex Curtain Wall', category: 'Façade', region: 'APAC', score: 79, onTime: 74, quality: 88, leadTime: 110, priceIndex: 92, risk: 'Medium' },
  { id: 'SUP-04', name: 'Terra Concrete Co.', category: 'Concrete / Ready-mix', region: 'NA', score: 91, onTime: 93, quality: 90, leadTime: 7, priceIndex: 101, risk: 'Low' },
  { id: 'SUP-05', name: 'Lumina Electrical', category: 'Electrical', region: 'EU', score: 72, onTime: 68, quality: 84, leadTime: 55, priceIndex: 95, risk: 'High' },
  { id: 'SUP-06', name: 'Pioneer Elevators', category: 'Vertical Transport', region: 'APAC', score: 85, onTime: 82, quality: 91, leadTime: 140, priceIndex: 106, risk: 'Medium' },
  { id: 'SUP-07', name: 'Cascade HVAC', category: 'HVAC', region: 'NA', score: 90, onTime: 91, quality: 89, leadTime: 49, priceIndex: 99, risk: 'Low' },
  { id: 'SUP-08', name: 'Orient Glass Works', category: 'Glazing', region: 'APAC', score: 67, onTime: 61, quality: 80, leadTime: 96, priceIndex: 88, risk: 'High' },
]

/* ============================================================= Time series = */
export const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']

export const INGESTION_SERIES = MONTHS.map((m, i) => ({
  month: m,
  structured: Math.round(180 + i * 42 + Math.sin(i) * 30),
  unstructured: Math.round(120 + i * 64 + Math.cos(i) * 40),
  models: Math.round(40 + i * 18 + (i % 3) * 12),
}))

export const PLATFORM_KPIS = {
  datasets: 1842,
  records: 4.7e9,
  projects: 12860,
  organizations: 640,
  modelsHosted: 38400,
  dataVolumePB: 18.4,
  avgQuality: 93.6,
  aiModelsTrained: 312,
}
