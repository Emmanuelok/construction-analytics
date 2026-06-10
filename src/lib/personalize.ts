/* Personal workspace engine — pure, unit-tested. Everything that makes the studio
 * feel built for one person: a role-tuned tool ranking (each role has a home turf,
 * boosted by stated goals and by what they actually open), a recents trail with
 * human "time ago" labels, a per-role accent so even the chrome matches the person,
 * and the phase journey their role walks through. The components only render what
 * these functions return — all the judgement lives here, testable. No DOM. */

import type { UserProfile } from './intelligence'
import type { Accent } from './nav'

export type ToolRef = { path: string; label: string }
export type RankedTool = ToolRef & { score: number; reason: string }

// each role's home-turf tools, strongest first
const ROLE_TOOLS: Record<string, string[]> = {
  Architect: ['/model-studio', '/building-explorer', '/site-zoning', '/bim'],
  'Structural Engineer': ['/building-explorer', '/model-studio', '/bim', '/cost-schedule'],
  'MEP Engineer': ['/building-explorer', '/sustainability', '/digital-twin', '/bim'],
  Contractor: ['/cost-schedule', '/field', '/building-explorer', '/procurement'],
  Developer: ['/site-zoning', '/overview', '/cost-schedule', '/marketplace'],
  'Cost Manager': ['/cost-schedule', '/procurement', '/building-explorer', '/marketplace'],
  'Sustainability Lead': ['/sustainability', '/building-explorer', '/site-zoning', '/insights'],
  'Data Scientist': ['/analyze', '/data-workbench', '/lakehouse', '/ai-studio'],
  Researcher: ['/library', '/analyze', '/marketplace', '/insights'],
  'Facilities / Owner': ['/digital-twin', '/building-explorer', '/documents', '/alerts'],
}
// goal keywords → tools that serve them
const GOAL_TOOLS: [RegExp, string[]][] = [
  [/carbon|sustain|energy/i, ['/sustainability', '/building-explorer']],
  [/cost|budget|estimat/i, ['/cost-schedule', '/procurement']],
  [/model|bim|design/i, ['/model-studio', '/building-explorer', '/bim']],
  [/site|zoning|feasib/i, ['/site-zoning']],
  [/schedule|programme|4d|construction/i, ['/cost-schedule', '/building-explorer']],
  [/safety|risk/i, ['/field', '/building-explorer']],
  [/data|analytic|ml|ai/i, ['/analyze', '/ai-studio', '/data-workbench']],
  [/operate|facilit|twin/i, ['/digital-twin']],
]

/** Rank the studio's tools for a person: role turf first, goal boosts, then what
 *  they actually open (usage), with sensible defaults for a blank profile. */
export function rankTools(profile: UserProfile, usage: Record<string, number>, all: ToolRef[], limit = 6): RankedTool[] {
  const roleList = ROLE_TOOLS[profile.role] ?? []
  const goalSet = new Map<string, number>()
  for (const g of profile.goals ?? []) for (const [re, tools] of GOAL_TOOLS) if (re.test(g)) tools.forEach((t, i) => goalSet.set(t, Math.max(goalSet.get(t) ?? 0, 3 - i)))
  const ranked = all.map((t) => {
    const ri = roleList.indexOf(t.path)
    const roleScore = ri === -1 ? 0 : (roleList.length - ri) * 10
    const goalScore = (goalSet.get(t.path) ?? 0) * 4
    const useScore = Math.min(12, (usage[t.path] ?? 0) * 2)
    const reason = ri !== -1 ? `core to ${profile.role || 'your role'}` : goalSet.has(t.path) ? 'serves your goals' : useScore > 0 ? 'you use this often' : 'popular in the studio'
    return { ...t, score: roleScore + goalScore + useScore, reason }
  })
  return ranked.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit)
}

export type Recent = { path: string; at: number }
/** Append a visit to the recents trail (deduped, newest first, capped). Pure. */
export function pushRecent(recents: Recent[], path: string, at: number, cap = 8): Recent[] {
  if (!path || path === '/') return recents
  const next = [{ path, at }, ...recents.filter((r) => r.path !== path)]
  return next.slice(0, cap)
}
/** Human "time ago" label. */
export function timeAgoShort(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** Per-role accent — the chrome subtly recolours to the person. */
export function roleAccent(role: string): Accent {
  const map: Record<string, Accent> = {
    Architect: 'violet', 'Structural Engineer': 'cyan', 'MEP Engineer': 'teal', Contractor: 'amber',
    Developer: 'sky', 'Cost Manager': 'emerald', 'Sustainability Lead': 'lime', 'Data Scientist': 'fuchsia',
    Researcher: 'blue', 'Facilities / Owner': 'rose',
  }
  return map[role] ?? 'blue'
}

/** First-person framing of the day's focus, from the profile. */
export function personalLede(profile: UserProfile): string {
  const role = profile.role || 'builder'
  const goal = profile.goals?.[0]
  const sector = profile.sectors?.[0]
  if (goal && sector) return `Your ${sector.toLowerCase()} ${role.toLowerCase()} workspace, tuned for “${goal.toLowerCase()}”.`
  if (goal) return `Your ${role.toLowerCase()} workspace, tuned for “${goal.toLowerCase()}”.`
  if (sector) return `Your ${sector.toLowerCase()} ${role.toLowerCase()} workspace — engines live and learning.`
  return `Your ${role.toLowerCase()} workspace — engines live and learning what you need.`
}
