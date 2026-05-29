import type { CatalogDataset } from '@/data/catalog'

/* Practical, category-tailored guidance shown on each dataset: how & where to
 * use it, which studio modules it pairs with, and the results to expect. */

export type Guidance = {
  howTo: string
  worksWith: { label: string; to: string }[]
  useCases: string[]
  outcomes: string[]
}

const BY_CATEGORY: Record<string, Guidance> = {
  'Cost & Estimating': {
    howTo: 'Load the sample in Analysis Studio to profile cost/m² distributions, then benchmark your project against the cohort and feed the rates into Cost & Schedule.',
    worksWith: [
      { label: 'Cost & Schedule', to: '/cost-schedule' },
      { label: 'Analysis Studio', to: '/analyze' },
      { label: 'Ask AEC', to: '/ask' },
    ],
    useCases: ['Benchmark cost/m² across sectors & regions', 'Sanity-check an estimate against real outcomes', 'Build parametric early-stage cost models'],
    outcomes: ['A defensible cost benchmark range', 'Outlier projects flagged for review', 'Trade-level cost splits for value engineering'],
  },
  'Schedule & Controls': {
    howTo: 'Profile baseline-vs-actual activity data in Analysis Studio, then calibrate delay-risk forecasts in Cost & Schedule.',
    worksWith: [
      { label: 'Cost & Schedule', to: '/cost-schedule' },
      { label: 'Construction Analytics', to: '/field' },
    ],
    useCases: ['Calibrate delay-risk models', 'Find the trades that drive critical-path slip', 'Benchmark float & % complete'],
    outcomes: ['A delay-driver ranking', 'Schedule-risk hotspots', 'Recovery-planning priorities'],
  },
  'BIM & Models': {
    howTo: 'Open an IFC in BIM Intelligence to parse entities and run a quantity takeoff, or use the classified objects to train model-analysis pipelines.',
    worksWith: [
      { label: 'BIM Intelligence', to: '/bim' },
      { label: 'Digital Twin', to: '/digital-twin' },
    ],
    useCases: ['Quantity takeoff from geometry', 'Train object-classification models', 'Clash & coordination analysis'],
    outcomes: ['BOQ-ready quantities', 'Classified, queryable model data', 'Coordination insight before federation'],
  },
  Sustainability: {
    howTo: 'Join these factors to your model quantities (from BIM Intelligence) to estimate whole-life carbon, and track against targets in Sustainability & ESG.',
    worksWith: [
      { label: 'Sustainability & ESG', to: '/sustainability' },
      { label: 'BIM Intelligence', to: '/bim' },
    ],
    useCases: ['Estimate embodied carbon early', 'Compare low-carbon material options', 'Report against net-zero targets'],
    outcomes: ['A whole-life carbon baseline', 'Material substitution savings', 'Audit-ready ESG reporting'],
  },
  Procurement: {
    howTo: 'Score suppliers in Analysis Studio, then surface lead-time and on-time risk inside Procurement before you award.',
    worksWith: [
      { label: 'Procurement', to: '/procurement' },
      { label: 'Analysis Studio', to: '/analyze' },
    ],
    useCases: ['Rank suppliers on reliability', 'Predict lead-time risk on long-lead items', 'Inform dual-sourcing decisions'],
    outcomes: ['A supplier scorecard', 'Lead-time risk flags', 'Lower supply-chain exposure'],
  },
  'AI Training': {
    howTo: 'Curate, label and anonymize in the AI Training Studio, then export a versioned, license-clean corpus for fine-tuning.',
    worksWith: [
      { label: 'AI Training Studio', to: '/ai-studio' },
      { label: 'Analysis Studio', to: '/analyze' },
    ],
    useCases: ['Fine-tune construction-domain LLMs', 'Train CV models on labeled imagery', 'Build retrieval corpora'],
    outcomes: ['A versioned training dataset', 'Higher eval accuracy', 'License-clean provenance'],
  },
  Quality: {
    howTo: 'Use the annotations to train or validate defect-detection models in Reality Capture, and track NCR trends in Construction Analytics.',
    worksWith: [
      { label: 'Reality Capture', to: '/reality-capture' },
      { label: 'Construction Analytics', to: '/field' },
    ],
    useCases: ['Train defect-detection CV models', 'Benchmark NCR rates by trade', 'Prioritize high-severity issues'],
    outcomes: ['A defect-detection baseline', 'Quality hotspots by trade', 'Fewer escaped defects'],
  },
  'Handover & Assets': {
    howTo: 'Validate the registers, then import to your CMMS or connect them to a live asset model in Digital Twin.',
    worksWith: [
      { label: 'Digital Twin', to: '/digital-twin' },
      { label: 'Governance & Trust', to: '/governance' },
    ],
    useCases: ['CMMS-ready asset import', 'Close the handover data drop', 'Drive O&M planning'],
    outcomes: ['Validated COBie registers', 'A clean operations handover', 'Faster facility mobilization'],
  },
  Operations: {
    howTo: 'Profile the telemetry in Analysis Studio for fault patterns, then connect live feeds in Digital Twin.',
    worksWith: [
      { label: 'Digital Twin', to: '/digital-twin' },
      { label: 'Sustainability & ESG', to: '/sustainability' },
    ],
    useCases: ['Detect equipment faults', 'Model building energy & comfort', 'Benchmark operational performance'],
    outcomes: ['Fault-detection signals', 'Energy-saving opportunities', 'A performance baseline'],
  },
  Geospatial: {
    howTo: 'Visualize the GeoJSON, then link site constraints to your project data in BIM Intelligence and Analysis Studio.',
    worksWith: [
      { label: 'BIM Intelligence', to: '/bim' },
      { label: 'Analysis Studio', to: '/analyze' },
    ],
    useCases: ['Site & zoning constraint analysis', 'Link projects to location', 'Feasibility & massing studies'],
    outcomes: ['Constraint-aware site data', 'Location-linked analytics', 'Faster feasibility screening'],
  },
  'Construction Field': {
    howTo: 'Profile daily reports in Analysis Studio to model productivity and root-cause delays, then track in Construction Analytics.',
    worksWith: [
      { label: 'Construction Analytics', to: '/field' },
      { label: 'Cost & Schedule', to: '/cost-schedule' },
    ],
    useCases: ['Model crew productivity', 'Root-cause delays & blockers', 'Correlate weather with output'],
    outcomes: ['Productivity benchmarks', 'Delay root-cause insight', 'Better look-ahead planning'],
  },
  'Reality Capture': {
    howTo: 'Run the imagery through Reality Capture for progress and as-built comparison, and compare against your BIM model.',
    worksWith: [
      { label: 'Reality Capture', to: '/reality-capture' },
      { label: 'BIM Intelligence', to: '/bim' },
    ],
    useCases: ['Automated progress verification', 'As-built vs as-designed comparison', 'Train segmentation models'],
    outcomes: ['Objective progress %', 'As-built deviation flags', 'Reality-grounded reporting'],
  },
}

const DEFAULT: Guidance = {
  howTo: 'Preview the sample, then open it in Analysis Studio to profile and chart it, or ask questions in Ask AEC.',
  worksWith: [
    { label: 'Analysis Studio', to: '/analyze' },
    { label: 'Ask AEC', to: '/ask' },
  ],
  useCases: ['Exploratory analysis', 'Benchmarking', 'Feeding downstream models'],
  outcomes: ['Actionable insight', 'A reusable baseline', 'Better decisions'],
}

export function datasetGuidance(d: CatalogDataset): Guidance {
  return BY_CATEGORY[d.category] ?? DEFAULT
}
