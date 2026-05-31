/* Collaboration model — pure, unit-tested. A lightweight comment-thread + share
 * layer keyed by a "subject" (any workbench, project, or scenario). Comments
 * thread under a subject; @mentions are parsed out for notification; a share
 * token encodes a deep link to the subject; and an activity log records who did
 * what. Persistence lives in the store; this module is the data model + ops. */

export type Author = { id: string; name: string; email?: string }
export type Comment = {
  id: string
  subject: string // e.g. 'cost-schedule' or 'project:PRJ-1042'
  authorId: string
  authorName: string
  body: string
  at: string // ISO
  mentions: string[] // bare handles parsed from @name
  resolved: boolean
}

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** Parse @mentions (handles: letters, digits, _ . -), de-duplicated, lower-cased. */
export function parseMentions(body: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9._-]{2,30})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const h = m[2].toLowerCase().replace(/[.\-_]+$/, '')
    if (h && !seen.has(h)) { seen.add(h); out.push(h) }
  }
  return out
}

export function makeComment(subject: string, author: Author, body: string): Comment {
  return {
    id: uid('c'),
    subject,
    authorId: author.id,
    authorName: author.name,
    body: body.trim(),
    at: new Date().toISOString(),
    mentions: parseMentions(body),
    resolved: false,
  }
}

/** Comments for one subject, oldest-first (thread reads top→bottom). */
export function threadFor(comments: Comment[], subject: string): Comment[] {
  return comments.filter((c) => c.subject === subject).sort((a, b) => a.at.localeCompare(b.at))
}

export function addComment(comments: Comment[], c: Comment): Comment[] {
  return [...comments, c]
}
export function removeComment(comments: Comment[], id: string): Comment[] {
  return comments.filter((c) => c.id !== id)
}
export function toggleResolved(comments: Comment[], id: string): Comment[] {
  return comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))
}

export type ThreadSummary = { total: number; open: number; resolved: number; participants: number; lastAt: string | null }
export function summarizeThread(comments: Comment[], subject: string): ThreadSummary {
  const t = threadFor(comments, subject)
  return {
    total: t.length,
    open: t.filter((c) => !c.resolved).length,
    resolved: t.filter((c) => c.resolved).length,
    participants: new Set(t.map((c) => c.authorId)).size,
    lastAt: t.length ? t[t.length - 1].at : null,
  }
}

/* ---- share links ---- */

/** Encode a subject into an opaque, URL-safe share token. */
export function encodeShareToken(subject: string): string {
  // base64url of "v1:<subject>" — stable, reversible, no PII.
  const raw = `v1:${subject}`
  const b64 = (typeof btoa === 'function' ? btoa(raw) : Buffer.from(raw, 'utf8').toString('base64'))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeShareToken(token: string): string | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8')
    return raw.startsWith('v1:') ? raw.slice(3) : null
  } catch {
    return null
  }
}

/** Build a shareable URL for a subject given an app origin + base path. */
export function shareUrl(origin: string, basePath: string, subject: string): string {
  const base = `${origin.replace(/\/$/, '')}${basePath.replace(/\/$/, '')}`
  return `${base}/share/${encodeShareToken(subject)}`
}

/* ---- activity log ---- */

export type Activity = { id: string; actorId: string; actorName: string; verb: string; subject: string; at: string }
export function logActivity(log: Activity[], actor: Author, verb: string, subject: string): Activity[] {
  const ev: Activity = { id: uid('a'), actorId: actor.id, actorName: actor.name, verb, subject, at: new Date().toISOString() }
  return [ev, ...log].slice(0, 200)
}

/* ---- defensive persistence ---- */

function isComment(x: unknown): x is Comment {
  const c = x as Comment
  return !!c && typeof c.id === 'string' && typeof c.subject === 'string' && typeof c.body === 'string'
}
export function parseComments(raw: string | null): Comment[] {
  if (!raw) return []
  try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.filter(isComment) : [] } catch { return [] }
}

/** A friendly label for a subject key, e.g. 'project:PRJ-1042' → 'Project PRJ-1042'. */
export function subjectLabel(subject: string): string {
  if (subject.startsWith('project:')) return `Project ${subject.slice(8)}`
  return subject.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}
