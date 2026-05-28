import {
  LayoutDashboard,
  Gauge,
  Sparkles,
  Database,
  Store,
  BrainCircuit,
  ShieldCheck,
  Boxes,
  FileText,
  CalendarClock,
  Truck,
  HardHat,
  ScanEye,
  Leaf,
  Building2,
  Flame,
  type LucideIcon,
} from 'lucide-react'

export type Accent =
  | 'blue'
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'teal'
  | 'fuchsia'
  | 'lime'

export type NavItem = {
  path: string
  label: string
  blurb: string
  icon: LucideIcon
  accent: Accent
  group: string
  tag?: string
}

export const NAV: NavItem[] = [
  // Core
  {
    path: '/',
    label: 'Overview',
    blurb: 'The unified studio for the built environment',
    icon: LayoutDashboard,
    accent: 'blue',
    group: 'Core',
  },
  {
    path: '/insights',
    label: 'Executive Insights',
    blurb: 'Portfolio KPIs, risk & cross-project decisions',
    icon: Gauge,
    accent: 'cyan',
    group: 'Core',
  },
  {
    path: '/ask',
    label: 'Ask AEC',
    blurb: 'Natural-language analytics over every dataset',
    icon: Sparkles,
    accent: 'violet',
    group: 'Core',
    tag: 'AI',
  },
  // Data platform
  {
    path: '/lakehouse',
    label: 'Data Lakehouse',
    blurb: 'Ingest, ETL, standardize, score & store',
    icon: Database,
    accent: 'sky',
    group: 'Data Platform',
  },
  {
    path: '/marketplace',
    label: 'Data Marketplace',
    blurb: 'Discover, license & exchange AEC datasets',
    icon: Store,
    accent: 'emerald',
    group: 'Data Platform',
  },
  {
    path: '/ai-studio',
    label: 'AI Training Studio',
    blurb: 'Curate, label, anonymize & version datasets',
    icon: BrainCircuit,
    accent: 'fuchsia',
    group: 'Data Platform',
    tag: 'AI',
  },
  {
    path: '/governance',
    label: 'Governance & Trust',
    blurb: 'Permissions, lineage, licensing & audit',
    icon: ShieldCheck,
    accent: 'teal',
    group: 'Data Platform',
  },
  // Intelligence engines
  {
    path: '/bim',
    label: 'BIM Intelligence',
    blurb: 'Parse, classify, clash & quantify models',
    icon: Boxes,
    accent: 'blue',
    group: 'Intelligence Engines',
  },
  {
    path: '/documents',
    label: 'Document Intelligence',
    blurb: 'Drawings, specs, contracts, RFIs & submittals',
    icon: FileText,
    accent: 'amber',
    group: 'Intelligence Engines',
  },
  {
    path: '/cost-schedule',
    label: 'Cost & Schedule',
    blurb: 'Forecast overruns, delays & earned value',
    icon: CalendarClock,
    accent: 'rose',
    group: 'Intelligence Engines',
  },
  {
    path: '/procurement',
    label: 'Procurement',
    blurb: 'Supplier scoring, bids & lead-time risk',
    icon: Truck,
    accent: 'lime',
    group: 'Intelligence Engines',
  },
  {
    path: '/field',
    label: 'Construction Analytics',
    blurb: 'Field progress, productivity, safety & quality',
    icon: HardHat,
    accent: 'amber',
    group: 'Intelligence Engines',
  },
  {
    path: '/reality-capture',
    label: 'Reality Capture',
    blurb: 'Computer vision over photos, drones & scans',
    icon: ScanEye,
    accent: 'cyan',
    group: 'Intelligence Engines',
  },
  {
    path: '/sustainability',
    label: 'Sustainability & ESG',
    blurb: 'Embodied carbon, energy, waste & lifecycle',
    icon: Leaf,
    accent: 'emerald',
    group: 'Intelligence Engines',
  },
  {
    path: '/digital-twin',
    label: 'Digital Twin',
    blurb: 'Connect design, build & operations data',
    icon: Building2,
    accent: 'violet',
    group: 'Intelligence Engines',
  },
  // Research
  {
    path: '/pain-points',
    label: 'Unsolved Pain Points',
    blurb: 'The industry gaps we exist to close',
    icon: Flame,
    accent: 'rose',
    group: 'Research',
    tag: 'NEW',
  },
]

export const NAV_GROUPS = ['Core', 'Data Platform', 'Intelligence Engines', 'Research'] as const

/** Tailwind class fragments keyed by accent for consistent theming. */
export const ACCENT: Record<
  Accent,
  { text: string; bg: string; ring: string; from: string; to: string; dot: string; hex: string }
> = {
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30', from: 'from-blue-500', to: 'to-blue-300', dot: 'bg-blue-400', hex: '#60a5fa' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', ring: 'ring-cyan-500/30', from: 'from-cyan-500', to: 'to-cyan-300', dot: 'bg-cyan-400', hex: '#22d3ee' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/30', from: 'from-violet-500', to: 'to-violet-300', dot: 'bg-violet-400', hex: '#a78bfa' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30', from: 'from-emerald-500', to: 'to-emerald-300', dot: 'bg-emerald-400', hex: '#34d399' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', from: 'from-amber-500', to: 'to-amber-300', dot: 'bg-amber-400', hex: '#fbbf24' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', ring: 'ring-rose-500/30', from: 'from-rose-500', to: 'to-rose-300', dot: 'bg-rose-400', hex: '#fb7185' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', ring: 'ring-sky-500/30', from: 'from-sky-500', to: 'to-sky-300', dot: 'bg-sky-400', hex: '#38bdf8' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/10', ring: 'ring-teal-500/30', from: 'from-teal-500', to: 'to-teal-300', dot: 'bg-teal-400', hex: '#2dd4bf' },
  fuchsia: { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-500/30', from: 'from-fuchsia-500', to: 'to-fuchsia-300', dot: 'bg-fuchsia-400', hex: '#e879f9' },
  lime: { text: 'text-lime-400', bg: 'bg-lime-500/10', ring: 'ring-lime-500/30', from: 'from-lime-500', to: 'to-lime-300', dot: 'bg-lime-400', hex: '#a3e635' },
}
