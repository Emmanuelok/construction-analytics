import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useAlerts } from '@/store/alerts'
import { parseComments, type Comment, type Activity } from '@/lib/collab'
import {
  alertNotifications,
  buildFeed,
  mentionNotifications,
  parseReadIds,
  shareNotifications,
  unreadCount as countUnread,
  type Notification,
} from '@/lib/notifications'

/* Assembles one notification feed from the collaboration comments/activity and
 * the live alert breaches, and tracks per-account "read" state in localStorage.
 * Reads the same keys the collab store writes, so a new @mention or share shows
 * up here without extra plumbing. */

const CKEY = 'aec-collab-comments-v1'
const AKEY = 'aec-collab-activity-v1'
const RKEY = 'aec-notif-read-v1'

function read<T>(key: string, fallback: T, parse: (raw: string | null) => T): T {
  try { return parse(localStorage.getItem(key)) } catch { return fallback }
}
const readComments = (k: string): Comment[] => read(k, [], parseComments)
const readActivity = (k: string): Activity[] => read(k, [] as Activity[], (raw) => { try { const v = JSON.parse(raw ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } })

/** Derive the current user's mention handle from name/email (matches collab's @-handles). */
function handleOf(user: { name?: string; email: string } | null): string {
  const base = user?.name?.trim() || user?.email?.split('@')[0] || 'you'
  return base.toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

export function useNotifications() {
  const { user } = useAuth()
  const { alerts } = useAlerts()
  const ckey = useMemo(() => (user ? `${CKEY}::${user.id}` : CKEY), [user])
  const akey = useMemo(() => (user ? `${AKEY}::${user.id}` : AKEY), [user])
  const rkey = useMemo(() => (user ? `${RKEY}::${user.id}` : RKEY), [user])

  const [readIds, setReadIds] = useState<string[]>(() => read(rkey, [], parseReadIds))
  const [tick, setTick] = useState(0) // re-read comments/activity on focus/refresh

  useEffect(() => { setReadIds(read(rkey, [], parseReadIds)) }, [rkey])
  // Pick up comments/activity written elsewhere (other tabs, other pages).
  useEffect(() => {
    const refresh = () => setTick((t) => t + 1)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])

  const feed: Notification[] = useMemo(() => {
    void tick
    const handle = handleOf(user)
    const selfId = user?.id ?? 'demo'
    const comments = readComments(ckey)
    const activity = readActivity(akey)
    return buildFeed([
      mentionNotifications(comments, handle),
      shareNotifications(activity, selfId),
      alertNotifications(alerts, new Date().toISOString()),
    ])
  }, [ckey, akey, alerts, user, tick])

  const unread = useMemo(() => countUnread(feed, readIds), [feed, readIds])

  const persistRead = useCallback((ids: string[]) => {
    try { localStorage.setItem(rkey, JSON.stringify(ids)) } catch { /* quota */ }
    setReadIds(ids)
  }, [rkey])

  const markRead = useCallback((id: string) => { if (!readIds.includes(id)) persistRead([...readIds, id]) }, [readIds, persistRead])
  const markAllRead = useCallback(() => persistRead([...new Set([...readIds, ...feed.map((n) => n.id)])]), [readIds, feed, persistRead])
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return { feed, unread, readIds, markRead, markAllRead, refresh }
}
