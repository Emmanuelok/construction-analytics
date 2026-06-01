/* Notifications — pure, unit-tested. Unifies three signal sources into one feed:
 *   - @mentions of the current user in comments
 *   - "shared with you" activity (someone shared a subject)
 *   - alert breaches (a project crossed a threshold)
 * Each becomes a Notification with a stable id, so read/seen state can be tracked
 * per user. The bell badge counts unread; the inbox lists them newest-first. */

import type { Comment, Activity } from './collab'
import type { Alert } from './alerts'

export type NotifKind = 'mention' | 'share' | 'alert'
export type Notification = {
  id: string // stable & deterministic, so the same event de-dupes across rebuilds
  kind: NotifKind
  title: string
  body: string
  subject: string // deep-link target (workbench slug / 'project:<id>')
  at: string // ISO
  severity?: 'High' | 'Medium' | 'Low'
}

const SUBJECT_LABEL: Record<string, string> = {
  'cost-schedule': 'Cost & Schedule', procurement: 'Procurement', field: 'Construction Analytics',
  sustainability: 'Sustainability & ESG', governance: 'Governance & Trust', bim: 'BIM Intelligence',
  'reality-capture': 'Reality Capture', 'digital-twin': 'Digital Twin', insights: 'Executive Insights',
  'ai-studio': 'AI Training Studio',
}
export function subjectName(subject: string): string {
  if (subject.startsWith('project:')) return `Project ${subject.slice(8)}`
  return SUBJECT_LABEL[subject] ?? subject.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

/** Comments that @mention `handle` (case-insensitive) become 'mention' notifications. */
export function mentionNotifications(comments: Comment[], handle: string): Notification[] {
  const h = handle.toLowerCase()
  return comments
    .filter((c) => c.mentions.includes(h))
    .map((c) => ({
      id: `mention:${c.id}`,
      kind: 'mention' as const,
      title: `${c.authorName} mentioned you`,
      body: c.body.length > 120 ? c.body.slice(0, 119) + '…' : c.body,
      subject: c.subject,
      at: c.at,
    }))
}

/** 'shared' activity by *other* users becomes 'share' notifications. */
export function shareNotifications(activity: Activity[], selfId: string): Notification[] {
  return activity
    .filter((a) => a.verb === 'shared' && a.actorId !== selfId)
    .map((a) => ({
      id: `share:${a.id}`,
      kind: 'share' as const,
      title: `${a.actorName} shared ${subjectName(a.subject)}`,
      body: `Open ${subjectName(a.subject)} to see it.`,
      subject: a.subject,
      at: a.at,
    }))
}

/** Open alert breaches become 'alert' notifications (deduped per rule×subject). */
export function alertNotifications(alerts: Alert[], at: string): Notification[] {
  return alerts.map((a) => ({
    id: `alert:${a.ruleId}:${a.subjectId}`,
    kind: 'alert' as const,
    title: `${a.severity} · ${a.ruleName}`,
    body: `${a.subjectName}: ${a.metricLabel} ${a.op} ${a.threshold} (now ${a.value})`,
    subject: a.subjectId.startsWith('PRJ') ? `project:${a.subjectId}` : 'insights',
    at,
    severity: a.severity,
  }))
}

/** Merge all sources, newest-first, de-duplicated by id. */
export function buildFeed(parts: Notification[][]): Notification[] {
  const seen = new Set<string>()
  const out: Notification[] = []
  for (const list of parts) for (const n of list) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    out.push(n)
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Count notifications whose id is not in the read set. */
export function unreadCount(feed: Notification[], readIds: Set<string> | string[]): number {
  const read = readIds instanceof Set ? readIds : new Set(readIds)
  return feed.reduce((n, x) => n + (read.has(x.id) ? 0 : 1), 0)
}

export function isUnread(n: Notification, readIds: Set<string> | string[]): boolean {
  const read = readIds instanceof Set ? readIds : new Set(readIds)
  return !read.has(n.id)
}

/** A short relative-time string, e.g. "3m", "2h", "5d". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, Math.floor((now - t) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
}

export function parseReadIds(raw: string | null): string[] {
  if (!raw) return []
  try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [] } catch { return [] }
}
