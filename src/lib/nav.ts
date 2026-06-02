import {
  Home,
  LayoutDashboard,
  FolderKanban,
  Workflow,
  Table2,
  Users,
  Gauge,
  Sparkles,
  Database,
  Store,
  Microscope,
  UploadCloud,
  Library,
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
  Building,
  Bell,
  Code2,
  Map,
  Cable,
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
  // Studio — the three functional pillars + entry points
  { path: '/', label: 'For You', blurb: 'Your personalized home — picks, insights & shortcuts', icon: Home, accent: 'blue', group: 'Studio', tag: 'NEW' },
  { path: '/overview', label: 'Platform Overview', blurb: 'The unified studio for the built environment', icon: LayoutDashboard, accent: 'sky', group: 'Studio' },
  { path: '/project', label: 'Project Workspace', blurb: 'One project, every lens — edit vitals, watch all engines recompute', icon: Building, accent: 'blue', group: 'Studio', tag: 'NEW' },
  { path: '/data', label: 'Data Center', blurb: 'Browse, preview & download AEC datasets', icon: Store, accent: 'emerald', group: 'Studio' },
  { path: '/workbench', label: 'Data Workbench', blurb: 'Open data in a grid — edit, sort, filter & derive', icon: Table2, accent: 'cyan', group: 'Studio', tag: 'NEW' },
  { path: '/analyze', label: 'Analysis Studio', blurb: 'Bring data, profile it, chart & ask AI', icon: Microscope, accent: 'violet', group: 'Studio', tag: 'AI' },
  { path: '/workspaces', label: 'Workspaces', blurb: 'Frame a problem → assemble, analyze, decide & ship', icon: FolderKanban, accent: 'violet', group: 'Studio', tag: 'NEW' },
  { path: '/flow', label: 'Flow Studio', blurb: 'Node canvas — wire & run a data flow, agent-diagrammed', icon: Workflow, accent: 'fuchsia', group: 'Studio', tag: 'NEW' },
  { path: '/teams', label: 'Teams', blurb: 'Collaborate — invite members & share workspaces', icon: Users, accent: 'cyan', group: 'Studio', tag: 'NEW' },
  { path: '/sell', label: 'Seller Studio', blurb: 'Upload, auto-tag, price & publish data', icon: UploadCloud, accent: 'lime', group: 'Studio' },
  { path: '/library', label: 'My Library', blurb: 'Cart, licenses & downloads', icon: Library, accent: 'cyan', group: 'Studio' },
  { path: '/ask', label: 'Ask AEC', blurb: 'Natural-language analytics over everything', icon: Sparkles, accent: 'violet', group: 'Studio', tag: 'AI' },
  { path: '/alerts', label: 'Alerts', blurb: 'Set thresholds; get notified when projects cross the line', icon: Bell, accent: 'rose', group: 'Studio', tag: 'NEW' },

  // Intelligence engines (supporting analytics)
  { path: '/insights', label: 'Executive Insights', blurb: 'Portfolio KPIs, risk & decisions', icon: Gauge, accent: 'cyan', group: 'Intelligence' },
  { path: '/bim', label: 'BIM Intelligence', blurb: 'Parse, classify, clash & quantify models', icon: Boxes, accent: 'blue', group: 'Intelligence' },
  { path: '/site-zoning', label: 'Site & Zoning', blurb: 'Site boundary, FAR/height/setback envelope & live compliance', icon: Map, accent: 'teal', group: 'Intelligence', tag: 'NEW' },
  { path: '/documents', label: 'Document Intelligence', blurb: 'Drawings, specs, contracts, RFIs', icon: FileText, accent: 'amber', group: 'Intelligence' },
  { path: '/cost-schedule', label: 'Cost & Schedule', blurb: 'Forecast overruns, delays & earned value', icon: CalendarClock, accent: 'rose', group: 'Intelligence' },
  { path: '/procurement', label: 'Procurement', blurb: 'Supplier scoring, bids & lead-time risk', icon: Truck, accent: 'lime', group: 'Intelligence' },
  { path: '/field', label: 'Construction Analytics', blurb: 'Field progress, productivity & safety', icon: HardHat, accent: 'amber', group: 'Intelligence' },
  { path: '/reality-capture', label: 'Reality Capture', blurb: 'Computer vision over photos & scans', icon: ScanEye, accent: 'cyan', group: 'Intelligence' },
  { path: '/sustainability', label: 'Sustainability & ESG', blurb: 'Embodied carbon, energy & lifecycle', icon: Leaf, accent: 'emerald', group: 'Intelligence' },
  { path: '/digital-twin', label: 'Digital Twin', blurb: 'Connect design, build & operations data', icon: Building2, accent: 'violet', group: 'Intelligence' },

  // Platform infrastructure
  { path: '/lakehouse', label: 'Data Lakehouse', blurb: 'Ingest, ETL, standardize, score & store', icon: Database, accent: 'sky', group: 'Platform' },
  { path: '/ai-studio', label: 'AI Training Studio', blurb: 'Curate, label, anonymize & version', icon: BrainCircuit, accent: 'fuchsia', group: 'Platform', tag: 'AI' },
  { path: '/governance', label: 'Governance & Trust', blurb: 'Permissions, lineage, licensing & audit', icon: ShieldCheck, accent: 'teal', group: 'Platform' },
  { path: '/developer', label: 'Developer & API', blurb: 'Public dataset API — keys, docs & a live playground', icon: Code2, accent: 'violet', group: 'Platform', tag: 'NEW' },
  { path: '/connections', label: 'Connections', blurb: 'Pull data + run tools across Autodesk, MCP servers & the studio engines', icon: Cable, accent: 'cyan', group: 'Platform', tag: 'NEW' },

  // Research
  { path: '/pain-points', label: 'Unsolved Pain Points', blurb: 'The industry gaps we exist to close', icon: Flame, accent: 'rose', group: 'Research', tag: 'NEW' },
]

export const NAV_GROUPS = ['Studio', 'Intelligence', 'Platform', 'Research'] as const

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
