import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AtSign, Share2, AlertTriangle, Check, Inbox, ArrowRight } from 'lucide-react'
import { PageHeader, Card, Badge, StatTile } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useNotifications } from '@/store/notifications'
import { isUnread, timeAgo, subjectName, type NotifKind } from '@/lib/notifications'

const KIND_ICON: Record<NotifKind, typeof AtSign> = { mention: AtSign, share: Share2, alert: AlertTriangle }
const KIND_ACCENT: Record<NotifKind, string> = { mention: 'text-blue-300', share: 'text-violet-300', alert: 'text-rose-300' }
const KIND_LABEL: Record<NotifKind, string> = { mention: 'Mentions', share: 'Shared', alert: 'Alerts' }

export default function Notifications() {
  const navigate = useNavigate()
  const { feed, unread, readIds, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState<NotifKind | 'all'>('all')

  const counts = useMemo(() => ({
    mention: feed.filter((n) => n.kind === 'mention').length,
    share: feed.filter((n) => n.kind === 'share').length,
    alert: feed.filter((n) => n.kind === 'alert').length,
  }), [feed])

  const shown = filter === 'all' ? feed : feed.filter((n) => n.kind === filter)
  const go = (subject: string, id: string) => { markRead(id); navigate(subject.startsWith('project:') ? '/project' : `/${subject}`) }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Bell}
        accent="blue"
        eyebrow="Studio"
        title="Notifications"
        description="Everything that needs your attention in one place — @mentions in comments, scenarios and workbenches shared with you, and project alert breaches. Click any item to jump straight to it."
        actions={unread > 0 ? <button onClick={markAllRead} className="btn-ghost"><Check className="h-4 w-4" /> Mark all read</button> : <Badge variant="success" dot>All caught up</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Unread" value={String(unread)} icon={Bell} accent={unread > 0 ? 'blue' : 'emerald'} sub="Across all sources" />
        <StatTile label="Mentions" value={String(counts.mention)} icon={AtSign} accent="blue" sub="In comments" />
        <StatTile label="Shared with you" value={String(counts.share)} icon={Share2} accent="violet" sub="Workbenches & scenarios" />
        <StatTile label="Alert breaches" value={String(counts.alert)} icon={AlertTriangle} accent="rose" sub="Projects over threshold" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'mention', 'share', 'alert'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors', filter === f ? 'bg-blue-500/15 text-blue-200 ring-blue-500/40' : 'text-slate-400 ring-edge/60 hover:bg-elevated/50 hover:text-slate-200')}
          >
            {f === 'all' ? 'All' : KIND_LABEL[f]} {f !== 'all' && <span className="text-slate-500">{counts[f]}</span>}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-slate-500">
            <Inbox className="h-8 w-8 text-slate-600" />
            {feed.length === 0 ? 'No notifications yet — @mention a teammate or set an alert threshold to see them here.' : 'Nothing in this filter.'}
          </div>
        ) : (
          <ul className="divide-y divide-edge/40">
            {shown.map((n) => {
              const Icon = KIND_ICON[n.kind]
              const fresh = isUnread(n, readIds)
              return (
                <li key={n.id}>
                  <button onClick={() => go(n.subject, n.id)} className={cn('flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-elevated/40', fresh && 'bg-blue-500/[0.04]')}>
                    <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-elevated/60', KIND_ACCENT[n.kind])}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('truncate text-sm font-semibold', fresh ? 'text-slate-100' : 'text-slate-300')}>{n.title}</span>
                        {n.severity && <Badge variant={n.severity === 'High' ? 'danger' : n.severity === 'Medium' ? 'warn' : 'neutral'}>{n.severity}</Badge>}
                        {fresh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
                        <span className="ml-auto shrink-0 text-[11px] text-slate-500">{timeAgo(n.at)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.body}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-600">{subjectName(n.subject)} <ArrowRight className="h-3 w-3" /></span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
