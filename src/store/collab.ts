import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/store/auth'
import {
  addComment,
  logActivity,
  makeComment,
  parseComments,
  removeComment,
  summarizeThread,
  threadFor,
  toggleResolved,
  type Activity,
  type Author,
  type Comment,
} from '@/lib/collab'

/* Per-account collaboration store: comment threads keyed by subject + an
 * activity log, persisted in localStorage (Supabase-ready). Comments are shared
 * across a browser/account; in a real deployment these become rows others see. */

const CKEY = 'aec-collab-comments-v1'
const AKEY = 'aec-collab-activity-v1'

function readComments(key: string): Comment[] {
  try { return parseComments(localStorage.getItem(key)) } catch { return [] }
}
function readActivity(key: string): Activity[] {
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* quota */ }
}

const authorOf = (user: { id: string; name?: string; email: string } | null): Author =>
  user ? { id: user.id, name: user.name || user.email.split('@')[0], email: user.email } : { id: 'demo', name: 'You' }

export function useCollab(subject: string) {
  const { user } = useAuth()
  const ckey = useMemo(() => (user ? `${CKEY}::${user.id}` : CKEY), [user])
  const akey = useMemo(() => (user ? `${AKEY}::${user.id}` : AKEY), [user])
  const [comments, setComments] = useState<Comment[]>(() => readComments(ckey))
  const [activity, setActivity] = useState<Activity[]>(() => readActivity(akey))

  useEffect(() => { setComments(readComments(ckey)); setActivity(readActivity(akey)) }, [ckey, akey])

  const thread = useMemo(() => threadFor(comments, subject), [comments, subject])
  const summary = useMemo(() => summarizeThread(comments, subject), [comments, subject])

  const post = useCallback((body: string) => {
    if (!body.trim()) return
    const author = authorOf(user)
    const next = addComment(readComments(ckey), makeComment(subject, author, body))
    write(ckey, next); setComments(next)
    const log = logActivity(readActivity(akey), author, 'commented on', subject)
    write(akey, log); setActivity(log)
  }, [ckey, akey, subject, user])

  const remove = useCallback((id: string) => { const next = removeComment(readComments(ckey), id); write(ckey, next); setComments(next) }, [ckey])
  const resolve = useCallback((id: string) => { const next = toggleResolved(readComments(ckey), id); write(ckey, next); setComments(next) }, [ckey])

  const recordShare = useCallback(() => {
    const log = logActivity(readActivity(akey), authorOf(user), 'shared', subject)
    write(akey, log); setActivity(log)
  }, [akey, subject, user])

  return { thread, summary, activity, post, remove, resolve, recordShare }
}
