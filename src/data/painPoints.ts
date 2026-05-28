import type { Accent } from '@/lib/nav'

/** Headline macro statistics that frame the opportunity (all sourced). */
export type MacroStat = {
  value: string
  label: string
  source: string
  sourceUrl: string
  accent: Accent
}

export const MACRO_STATS: MacroStat[] = [
  {
    value: '$1.85T',
    label: 'Lost globally in a single year to "bad data" and the rework it causes across construction.',
    source: 'Autodesk + FMI, 2020',
    sourceUrl:
      'https://adsknews.autodesk.com/en/pressrelease/study-from-autodesk-and-fmi-finds-better-data-strategies-could-save-the-global-construction-industry-1-85-trillion/',
    accent: 'rose',
  },
  {
    value: '95.5%',
    label: 'Of all data captured in the engineering & construction industry is never used again.',
    source: 'FMI Corp study',
    sourceUrl:
      'https://www.forconstructionpros.com/business/press-release/21031884/fmi-corp-study-95-of-all-data-captured-goes-unused-in-the-ec-industry',
    accent: 'amber',
  },
  {
    value: '$15.8B',
    label: 'Lost every year in the US alone to inadequate interoperability — two-thirds borne by owners.',
    source: 'NIST GCR 04-867',
    sourceUrl: 'https://nvlpubs.nist.gov/nistpubs/gcr/2004/nist.gcr.04-867.pdf',
    accent: 'violet',
  },
  {
    value: '$1.6T',
    label: 'Annual value opportunity from closing construction’s productivity & digitization gap.',
    source: 'McKinsey Global Institute',
    sourceUrl:
      'https://www.mckinsey.com/capabilities/operations/our-insights/reinventing-construction-through-a-productivity-revolution',
    accent: 'cyan',
  },
  {
    value: '74%',
    label: 'Of US contractors rate their own data quality as poor or only moderate.',
    source: 'Dodge Data & Analytics',
    sourceUrl: 'https://www.constructiondive.com/news/data-standardization-AI-construction/810053/',
    accent: 'emerald',
  },
  {
    value: '~90%',
    label: 'Of large infrastructure projects exceed budget, averaging ~28% overrun.',
    source: 'Cost overrun meta-analyses',
    sourceUrl: 'https://www.contimod.com/construction-cost-overrun-statistics/',
    accent: 'blue',
  },
]

export const OWNER_QUOTE = {
  text: "We’ve been building plants in this country for 65 years and there’s not one single place I can go to see what it took to do the work.",
  attribution: 'Capital-program owner, on the impossibility of cross-project benchmarking',
  sourceUrl: 'https://www.getclue.com/blog/benchmarking-in-construction-industry',
}

export type PainPoint = {
  id: string
  rank?: number
  title: string
  category: string
  accent: Accent
  headlineStat?: string
  problem: string
  who: string[]
  whyUnsolved: string
  ourSolution: string
  modules: string[]
  sources: { label: string; url: string }[]
}

export const PAIN_POINTS: PainPoint[] = [
  {
    id: 'training-data-gap',
    rank: 1,
    title: 'Data-rich, AI-poor — and no neutral marketplace exists',
    category: 'AI Training Data',
    accent: 'fuchsia',
    headlineStat: 'AEC visual datasets rarely exceed 100k images vs. the millions used elsewhere',
    problem:
      'The industry generates petabytes yet lacks the large, labeled, structured datasets that power AI everywhere else. Most data is trapped in PDFs, emails and paper. Critically, no dominant vendor-neutral "data lakehouse + marketplace for AI training" exists — incumbents each build proprietary lakes to feed their own models, re-siloing data at the platform layer.',
    who: ['AI companies', 'Researchers', 'Contractors adopting AI', 'Investors'],
    whyUnsolved:
      'Incumbents are structurally disincentivized from neutrality; labeling is expensive and domain-specialized; nobody aggregates licensed, cleaned, labeled data at scale.',
    ourSolution:
      'This is the platform’s core thesis: a lakehouse that standardizes, cleans and labels AEC data, plus a marketplace that licenses it for training — occupying the neutral ground incumbents cannot.',
    modules: ['AI Training Studio', 'Data Lakehouse', 'Data Marketplace'],
    sources: [
      { label: 'ConstructionDive — data standardization & AI', url: 'https://www.constructiondive.com/news/data-standardization-AI-construction/810053/' },
      { label: 'AEC Magazine — views from the AEC data lake', url: 'https://aecmag.com/data-management/views-from-the-aec-data-lake/' },
      { label: 'arXiv — construction vision datasets', url: 'https://arxiv.org/pdf/2507.13221' },
    ],
  },
  {
    id: 'data-sharing-deadlock',
    rank: 2,
    title: 'The data-sharing deadlock: confidentiality & "who owns it?"',
    category: 'Governance & Trust',
    accent: 'teal',
    headlineStat: 'The keystone blocker behind benchmarking, forecasting & the training-data desert',
    problem:
      'Firms won’t pool data. Performance data is confidential, sharing cost/productivity figures feels like surrendering advantage, and ownership is contractually contested across owner/architect/EPC/sub layers — with ill-drafted contracts causing firms to unintentionally give away IP or take on liability.',
    who: ['Owners', 'General contractors', 'Subcontractors', 'Consultants', 'Suppliers'],
    whyUnsolved:
      'SaaS tools assume single-tenant data; none provide a trusted neutral mechanism — legal plus technical — to share without leaking competitive secrets.',
    ourSolution:
      'Data clean rooms, privacy-preserving aggregation and clear licensing that pays contributors let firms benefit from pooled insight and AI without exposing raw competitive data.',
    modules: ['Governance & Trust', 'Data Marketplace', 'AI Training Studio'],
    sources: [
      { label: 'BCIS — six data-sharing challenges', url: 'https://bcis.co.uk/insight/six-data-sharing-challenges-for-the-construction-industry/' },
      { label: 'Decentriq — data clean rooms for benchmarking', url: 'https://www.decentriq.com/article/data-clean-rooms-a-new-approach-to-confidential-benchmarking' },
      { label: 'Clark Hill — IP in construction law', url: 'https://www.clarkhill.com/news-events/news/3-things-to-know-about-intellectual-property-in-construction-law/' },
    ],
  },
  {
    id: 'benchmarking-impossible',
    rank: 3,
    title: 'Cross-project benchmarking is effectively impossible',
    category: 'Benchmarking',
    accent: 'cyan',
    headlineStat: '"Not one single place I can go to see what it took to do the work"',
    problem:
      'Owners and contractors cannot reliably compare cost, schedule or productivity across projects because data is non-standardized, confidential, and every project is treated as a one-off. There is no centralized, professionally managed way to collect, normalize and store estimated-vs-actual data.',
    who: ['Owners', 'Capital-program directors', 'Estimators', 'Cost consultants', 'Lenders'],
    whyUnsolved:
      'It compounds the schema problem and the sharing deadlock. Existing "benchmark" tools rely on a single firm’s own small, patchy job history, each walled to its own customer base.',
    ourSolution:
      'Normalized, pooled, privacy-preserved cost/schedule/productivity data enables true cross-project, cross-region benchmarking — the repository owners say does not exist.',
    modules: ['Executive Insights', 'Cost & Schedule', 'Data Lakehouse'],
    sources: [
      { label: 'Clue — benchmarking in construction', url: 'https://www.getclue.com/blog/benchmarking-in-construction-industry' },
      { label: 'PMI — benchmarking project performance', url: 'https://www.pmi.org/learning/library/improving-project-system-performance-benchmarking-8160' },
    ],
  },
  {
    id: 'forecasting-fails',
    rank: 4,
    title: 'Cost & schedule forecasting still fails — projects still overrun',
    category: 'Predictive Analytics',
    accent: 'rose',
    headlineStat: '~90% of large infrastructure projects exceed budget (avg ~28%)',
    problem:
      'Forecasts fail partly because planners lack large historical outcome datasets to calibrate against. Scheduling tools model the plan but never learn from outcomes; Monte Carlo tools rely on subjective inputs and optimism bias.',
    who: ['Owners', 'Investors', 'Lenders', 'Insurers', 'Governments', 'GCs'],
    whyUnsolved:
      'Data-driven forecasting needs cross-firm historical data the industry won’t pool. The barrier is data scale — the moat of the few players who have it.',
    ourSolution:
      'Pooled actuals (cost, duration, logic, outcomes) across many firms let forecasting models calibrate on reality, feeding empirical risk ranges to estimators and underwriters.',
    modules: ['Cost & Schedule', 'AI Training Studio', 'Executive Insights'],
    sources: [
      { label: 'Construction cost overrun statistics', url: 'https://www.contimod.com/construction-cost-overrun-statistics/' },
      { label: 'strategy+business — why large projects go over budget', url: 'https://www.strategy-business.com/article/Why-do-large-projects-go-over-budget' },
    ],
  },
  {
    id: 'handover-data-loss',
    rank: 5,
    title: 'Handover data loss — the COBie "data drop" failure',
    category: 'Asset & Operations',
    accent: 'violet',
    headlineStat: 'Up to 30% of lifecycle data is lost at construction→operations handover',
    problem:
      'Owners receive geometry-heavy, data-light models and COBie spreadsheets their FM teams can’t use, then re-key asset inventories by hand. ~80% of building cost occurs after handover — exactly where the data evaporates.',
    who: ['Owners', 'Facility managers', 'Maintenance teams', 'Operators'],
    whyUnsolved:
      'COBie is a brittle spreadsheet exchange, not a living data model; design/build tools optimize for delivery, not operations. No continuous data thread runs from design through FM/CMMS.',
    ourSolution:
      'A continuous asset-data thread from design to operations, validated against the owner’s information requirements before handover and fed directly into CMMS and digital twins.',
    modules: ['Digital Twin', 'Data Lakehouse', 'Governance & Trust'],
    sources: [
      { label: 'Adyantrix — COBie-compliant handover data', url: 'https://www.adyantrix.com/blogs/handover-documentation-bim-cobie-compliant-data-owners' },
      { label: 'Catenda — COBie glossary', url: 'https://catenda.com/glossary/construction-operations-and-building-information-exchange-cobie/' },
    ],
  },
  {
    id: 'interoperability',
    title: 'No durable interoperability — data dies crossing tool boundaries',
    category: 'Interoperability',
    accent: 'blue',
    headlineStat: '20+ years of vendor pledges; the problem persists',
    problem:
      'Moving a model between authoring tools via "neutral" IFC routinely strips parametrics, relationships and metadata. Vendors have signed repeated interoperability pledges (2008, 2016, 2025/26) yet the loss persists — evidence the fix is structural, not a feature.',
    who: ['Owners', 'Architects', 'Engineers', 'Contractors', 'Fabricators'],
    whyUnsolved:
      'Major vendors compete on lock-in; even "open" stacks retain proprietary geometry kernels.',
    ourSolution:
      'A vendor-neutral lakehouse ingests native, IFC and tabular exports into one open, queryable model graph — preserving relationships once at ingest instead of re-translating per boundary.',
    modules: ['Data Lakehouse', 'BIM Intelligence'],
    sources: [
      { label: 'NIST GCR 04-867', url: 'https://nvlpubs.nist.gov/nistpubs/gcr/2004/nist.gcr.04-867.pdf' },
      { label: 'AEC Magazine — towards open AEC systems', url: 'https://aecmag.com/features/towards-open-aec-systems/' },
    ],
  },
  {
    id: 'integration-fatigue',
    title: 'Integration & "tech-stack" fatigue',
    category: 'Interoperability',
    accent: 'sky',
    headlineStat: '~35% redundant data entry; 13% of hours spent hunting for data',
    problem:
      'Firms run 4+ disconnected apps per project; "integrations" are shallow directory syncs while the deep operational data teams need is rarely available. The result is duplicate entry, manual reconciliation and burnout.',
    who: ['GCs', 'Subcontractors', 'Project managers', 'Field staff', 'IT leaders'],
    whyUnsolved:
      'Each vendor wants to be the system of record; "integration" is a marketing checkbox, not a deep data contract.',
    ourSolution:
      'A lakehouse with bidirectional connectors normalizes into a common schema so tools read/write one shared layer instead of N² brittle point-to-point links.',
    modules: ['Data Lakehouse', 'Governance & Trust'],
    sources: [
      { label: 'Bridgit — tech fatigue in construction', url: 'https://gobridgit.com/blog/tech-fatigue-construction/' },
      { label: 'Viewpoint — disconnected software', url: 'https://www.viewpoint.com/blog/the-interconnected-construction-organization-part-1-downfalls-of-disconnected-software' },
    ],
  },
  {
    id: 'schema-fragmentation',
    title: 'No common schema — classification-system fragmentation',
    category: 'Standardization',
    accent: 'amber',
    headlineStat: 'OmniClass ~6,887 classes vs CoClass ~750 — no shared backbone',
    problem:
      'There is no single classification backbone. North America uses MasterFormat/OmniClass/UniFormat, the UK uses Uniclass 2015, Sweden uses CoClass — with wildly different structures. Without a shared schema, data can’t be aggregated, compared or fed to models.',
    who: ['Estimators', 'BIM managers', 'International owners', 'Data & AI teams'],
    whyUnsolved:
      'Standards are regional and entrenched; vendors support several but enforce none, leaving lossy mapping to the user.',
    ourSolution:
      'Host canonical crosswalk mappings and auto-classify incoming data to a unified internal ontology, exposing it back in whichever standard a consumer needs.',
    modules: ['Data Lakehouse', 'Data Marketplace'],
    sources: [
      { label: 'DataDrivenConstruction — classification systems', url: 'https://datadrivenconstruction.io/2025/06/061-masterformat-omniclass-uniclass-and-coclass-the-evolution-of-classification-systems/' },
      { label: 'WBDG — OmniClass', url: 'https://www.wbdg.org/resources/omniclass' },
    ],
  },
  {
    id: 'spec-document-gaps',
    title: 'Specification & document intelligence gaps',
    category: 'Document Intelligence',
    accent: 'amber',
    headlineStat: '2–4 hours per drawing set in manual QA/QC review',
    problem:
      'Specs are long, dense, cross-referenced and inconsistent with drawings. Reviewers spend hours per set; spec misreads occur in 3–5% of items, often caught only at fabrication. Gaps between documents drive most disputes, RFIs and rework.',
    who: ['GCs', 'Subs', 'Architects', 'Engineers', 'Estimators', 'Legal/claims'],
    whyUnsolved:
      'Point tools read documents in isolation; they don’t reconcile specs against the model, schedule, submittals and as-builts because that cross-domain data isn’t unified.',
    ourSolution:
      'With specs, drawings, models, submittals and RFIs in one lakehouse, AI cross-checks documents against each other and the model — catching conflicts before they become RFIs.',
    modules: ['Document Intelligence', 'BIM Intelligence'],
    sources: [
      { label: 'Document Crunch — spec review', url: 'https://www.documentcrunch.com/construction-specification-review' },
      { label: 'Datagrid — automated constructability review', url: 'https://datagrid.com/blog/ai-agents-automate-constructability-review-documentation' },
    ],
  },
  {
    id: 'procurement-opacity',
    title: 'Procurement & supply-chain opacity',
    category: 'Procurement',
    accent: 'lime',
    headlineStat: 'Inefficient logistics can add up to 15% to project cost',
    problem:
      'Low transparency across suppliers, subs and logistics; poor visibility into long-lead items and deliveries; international sourcing adds price and lead-time uncertainty. No consolidated view across all parties’ procurement status.',
    who: ['GCs', 'Owners', 'Subs', 'Suppliers', 'Logistics providers'],
    whyUnsolved:
      'Procurement data sits in ERPs, supplier portals, emails and spreadsheets that don’t connect; PM platforms don’t reach upstream into the supply chain.',
    ourSolution:
      'A shared layer linking BOMs, POs, supplier feeds and site progress gives real-time material/lead-time visibility and predictive shortage alerts across the whole chain.',
    modules: ['Procurement', 'Data Lakehouse'],
    sources: [
      { label: 'Frontiers — construction supply chain', url: 'https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2021.651294/full' },
      { label: 'CMiC — global supply chain challenges', url: 'https://cmicglobal.com/resources/article/Global-Supply-Chain-Management-in-Construction-Challenges-and-Solutions' },
    ],
  },
  {
    id: 'reality-capture-graveyard',
    title: 'Reality capture becomes a data graveyard',
    category: 'Reality Capture',
    accent: 'cyan',
    headlineStat: 'Most scans are captured once, stored, and never used again',
    problem:
      'Laser scans, drone photogrammetry and 360° walks generate massive point clouds that become data graveyards. High storage cost, format incompatibility and heavy processing keep reality data disconnected from models, schedules and decisions.',
    who: ['Owners', 'GCs', 'VDC/BIM teams', 'Surveyors'],
    whyUnsolved:
      'Capture tools excel at capture but the data stays siloed in their apps; tying it into a queryable record that drives downstream decisions is rare.',
    ourSolution:
      'Ingest reality-capture outputs, register them against model/schedule/cost, and make them a persistent, queryable layer — progress %, as-built deltas, quantity verification.',
    modules: ['Reality Capture', 'Digital Twin', 'BIM Intelligence'],
    sources: [
      { label: 'Cintoo — 3D reality capture', url: 'https://cintoo.com/en/blog/3d-reality-capture' },
      { label: 'OpenSpace — reality capture 101', url: 'https://www.openspace.ai/blog/reality-capture-101/' },
    ],
  },
  {
    id: 'embodied-carbon-data',
    title: 'Embodied-carbon & ESG data gaps',
    category: 'Sustainability',
    accent: 'emerald',
    headlineStat: 'Most material EPDs aren’t comparable across products',
    problem:
      'Embodied-carbon accounting rests on poor EPD data — inconsistent functional units, cut-off rules and impact categories, often generic datasets. Whole-building LCA and ESG disclosures sit on shaky, non-comparable foundations.',
    who: ['Owners with ESG mandates', 'Sustainability consultants', 'Regulators', 'Investors', 'Manufacturers'],
    whyUnsolved:
      'EPD data is scattered across regional databases with no harmonized schema; no neutral, trusted, comparable carbon-data repository exists at scale.',
    ourSolution:
      'Host normalized, quality-scored EPD/carbon data with consistent functional units, enabling comparable embodied-carbon analysis and auditable ESG reporting tied to project quantities.',
    modules: ['Sustainability & ESG', 'Data Marketplace'],
    sources: [
      { label: 'Carbon Leadership Forum — embodied carbon data', url: 'https://carbonleadershipforum.org/international-embodied-carbon-data-availability/' },
      { label: 'RMI — environmental impact of materials', url: 'https://rmi.org/improving-the-data-and-disclosure-of-the-environmental-impact-of-building-materials/' },
    ],
  },
  {
    id: 'ai-trust-liability',
    title: 'Trust, explainability & liability block AI adoption',
    category: 'Governance & Trust',
    accent: 'teal',
    headlineStat: '~50% of contractors lack confidence in AI; only ~25% use it meaningfully',
    problem:
      'Builders reject black-box outputs and face real liability — a bad AI schedule that misses a dependency costs real money, and infringing AI output can expose both user and vendor. This makes firms wary of both using AI and contributing data to train it.',
    who: ['Contractors', 'Owners', 'Design firms', 'Insurers', 'Legal teams', 'AI vendors'],
    whyUnsolved:
      'Many AEC AI tools don’t expose reasoning or provenance; liability and data-provenance frameworks are immature.',
    ourSolution:
      'A governed lakehouse provides data lineage and provenance so AI outputs are traceable and explainable, and licensed training data with clear provenance reduces IP/liability exposure.',
    modules: ['Governance & Trust', 'AI Training Studio'],
    sources: [
      { label: 'Builder — why builders hesitate on AI', url: 'https://www.builderonline.com/builder-100/it-technology/four-reasons-builders-are-hesitant-about-ai/' },
      { label: 'Norton Rose Fulbright — GenAI training infringement risk', url: 'https://www.nortonrosefulbright.com/en/knowledge/publications/ef8d8cce/infringement-risk-relating-to-training-a-generative-ai-system' },
    ],
  },
  {
    id: 'owner-silos',
    title: 'Owner-side silos — no portfolio-level view of the asset',
    category: 'Asset & Operations',
    accent: 'blue',
    headlineStat: 'Siloed data costs organizations ~$15M/year on average',
    problem:
      'Owners’ spatial, asset and model data sit in separate systems, so they can’t form a unified view across a building or portfolio. Most digital-twin efforts fail because data is trapped in silos with unresolved governance.',
    who: ['Owners', 'Asset/portfolio managers', 'Facility managers', 'Capital planning'],
    whyUnsolved:
      'Owners must adopt whatever systems each vendor uses per project; there’s no owner-controlled, persistent data layer spanning projects and operations.',
    ourSolution:
      'An owner-controlled lakehouse persists data across projects and into operations, giving a queryable portfolio view that survives changing contractors and tools.',
    modules: ['Digital Twin', 'Executive Insights', 'Data Lakehouse'],
    sources: [
      { label: 'dRofus — breaking down AEC data silos', url: 'https://blog.drofus.com/en/news/breaking-down-aec-data-silos-why-centralized-information-is-key-for-owners' },
      { label: 'ASCE — digital twins in civil engineering', url: 'https://www.asce.org/publications-and-news/civil-engineering-source/article/2025/11/10/digital-twins-show-great-promise-in-civil-engineering-but-whats-next' },
    ],
  },
]
