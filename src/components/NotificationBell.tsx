import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AtSign, Share2, AlertTriangle, Check, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useNotifications } from '@/store/notifications'
import { isUnread, timeAgo, type NotifKind } from '@/lib/notifications'

const KIND_ICON: Record<NotifKind, typeof AtSign> = { mention: AtSign, share: Share2, alert: AlertTriangle }
const KIND_COLOR: Record<NotifKind, string> = { mention: 'text-blue-300', share: 'text-violet-300', alert: 'text-rose-300' }

/* The topbar bell: a live unread badge + a dropdown of the newest notifications
 * (mentions, shares, alert breaches). Clicking one marks it read and deep-links
 * to its subject; "Mark all read" clears the badge. Full list at /notifications. */
export function NotificationBell() {
  const navigate = useNavigate()
  const { feed, unread, readIds, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (subject: string, id: string) => {
    markRead(id)
    setOpen(false)
    navigate(subject.startsWith('project:') ? '/project' : `/${subject}`)
  }

  const recent = feed.slice(0, 8)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => { if (!o) refresh(); return !o }) }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        title={`${unread} unread notification${unread === 1 ? '' : 's'}`}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-edge/70 bg-elevated/50 text-slate-400 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className={cn('absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold text-white', feed.some((n) => isUnread(n, readIds) && n.severity === 'High') ? 'bg-rose-500' : 'bg-blue-500')}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-edge/70 bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-edge/60 px-3.5 py-2.5">
            <span className="text-sm font-semibold text-slate-200">Notifications</span>
            {unread > 0 && <button onClick={markAllRead} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"><Check className="h-3 w-3" /> Mark all read</button>}
          </div>

          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-slate-500">
              <Inbox className="h-6 w-6 text-slate-600" />
              You're all caught up. Mentions, shares and alert breaches show up here.
            </div>
          ) : (
            <ul className="max-h-[360px] divide-y divide-edge/40 overflow-y-auto">
              {recent.map((n) => {
                const Icon = KIND_ICON[n.kind]
                const fresh = isUnread(n, readIds)
                return (
                  <li key={n.id}>
                    <button onClick={() => go(n.subject, n.id)} className={cn('flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-elevated/50', fresh && 'bg-blue-500/[0.04]')}>
                      <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-elevated/60', KIND_COLOR[n.kind])}><Icon className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('truncate text-xs font-semibold', fresh ? 'text-slate-100' : 'text-slate-300')}>{n.title}</span>
                          {fresh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
                          <span className="ml-auto shrink-0 text-[10px] text-slate-500">{timeAgo(n.at)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">{n.body}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <button onClick={() => { setOpen(false); navigate('/notifications') }} className="block w-full border-t border-edge/60 px-3.5 py-2.5 text-center text-xs font-medium text-slate-300 hover:bg-elevated/50 hover:text-white">
            View all notifications
          </button>
        </div>
      )}
    </div>
  )
}
