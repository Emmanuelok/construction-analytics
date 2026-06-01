import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  X,
  Check,
  Trash2,
  FolderKanban,
  Plus,
  Activity as ActivityIcon,
  ArrowRight,
  Crown,
  Sparkles,
  GitBranch,
  Lightbulb,
  Database as DatabaseIcon,
  FlaskConical,
  Layers,
} from 'lucide-react'
import { Card, CardHeader, Badge, IconBadge } from '@/components/ui'
import { useTeams, initials, type ActivityKind } from '@/store/teams'
import { useWorkspaces } from '@/store/workspaces'
import { useAuth } from '@/store/auth'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

const ACTIVITY_ICON: Record<ActivityKind, typeof Sparkles> = {
  team_created: Sparkles,
  member_joined: UserPlus,
  member_invited: Mail,
  workspace_shared: FolderKanban,
  workspace_unshared: Trash2,
  hypothesis_validated: FlaskConical,
  hypothesis_rejected: FlaskConical,
  dataset_added: DatabaseIcon,
  note_added: Lightbulb,
  stage_changed: GitBranch,
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function TeamDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const teams = useTeams()
  const { workspaces } = useWorkspaces()
  const { user } = useAuth()
  const team = teams.get(id)

  const [email, setEmail] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const isOwner = team?.ownerId === (user?.id ?? '')
  const myPendingInvite = useMemo(
    () => team?.invites.find((i) => i.email === user?.email?.toLowerCase()),
    [team, user],
  )
  const sharedWorkspaces = useMemo(
    () => (team ? workspaces.filter((w) => team.workspaceIds.includes(w.id)) : []),
    [team, workspaces],
  )
  const shareable = useMemo(
    () => (team ? workspaces.filter((w) => !team.workspaceIds.includes(w.id)) : []),
    [team, workspaces],
  )

  if (!team) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-slate-400">Team not found.</p>
          <Link to="/teams" className="btn-primary mt-4 inline-flex"><ArrowLeft className="h-4 w-4" /> Back to Teams</Link>
        </div>
      </div>
    )
  }

  const a = ACCENT[team.accent]

  return (
    <div className="space-y-7">
      <Link to="/teams" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Teams
      </Link>

      {myPendingInvite && (
        <Card className="flex flex-col items-start gap-3 border-violet-500/30 bg-violet-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <Mail className="h-4 w-4 text-violet-300" /> You've been invited to join <span className="font-semibold">{team.name}</span>.
          </div>
          <div className="flex gap-2">
            <button onClick={() => teams.cancelInvite(team.id, myPendingInvite.id)} className="btn-ghost !px-3 !py-1.5 !text-xs">Decline</button>
            <button onClick={() => teams.acceptInvite(team.id, myPendingInvite.id)} className="btn-primary !px-3 !py-1.5 !text-xs"><Check className="h-3.5 w-3.5" /> Accept invite</button>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge/60 pb-6">
        <div className="flex items-start gap-4">
          <span className={cn('grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold ring-1', a.bg, a.text, a.ring)}>
            {initials(team.name)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">{team.name}</h1>
              {isOwner && <Badge variant="violet" dot>Owner</Badge>}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{team.description || 'No description.'}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {team.members.length} members</span>
              <span className="inline-flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {team.workspaceIds.length} workspaces</span>
            </div>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              if (confirm('Delete this team? This cannot be undone.')) {
                teams.remove(team.id)
                navigate('/teams')
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" /> Delete team
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: members + workspaces */}
        <div className="space-y-6 lg:col-span-2">
          {/* Members */}
          <Card>
            <CardHeader icon={Users} accent={team.accent} title="Members" subtitle={`${team.members.length} member${team.members.length !== 1 ? 's' : ''}`} />
            <div className="divide-y divide-edge/40 border-t border-edge/50">
              {team.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={cn('grid h-9 w-9 place-items-center rounded-full text-xs font-bold', a.bg, a.text)}>{initials(m.name || m.email)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-200">{m.name || m.email}</div>
                    <div className="truncate text-xs text-slate-500">{m.email}</div>
                  </div>
                  <Badge variant={m.role === 'owner' ? 'violet' : 'neutral'}>
                    {m.role === 'owner' && <Crown className="mr-1 inline h-3 w-3" />}{m.role}
                  </Badge>
                  {isOwner && m.role !== 'owner' && (
                    <button onClick={() => teams.removeMember(team.id, m.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-rose-300"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite */}
            <div className="border-t border-edge/50 p-5">
              <div className="flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-3 py-2 focus-within:border-violet-500/50">
                <Mail className="h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) { teams.invite(team.id, email); setEmail('') } }}
                  placeholder="Invite by email…"
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
                <button onClick={() => { if (email.trim()) { teams.invite(team.id, email); setEmail('') } }} className="btn-primary !px-3 !py-1.5 !text-xs">
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              </div>
              {team.invites.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {team.invites.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 rounded-lg border border-edge/50 bg-elevated/30 px-3 py-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                      <span className="flex-1 truncate text-slate-300">{i.email}</span>
                      <Badge variant="warn">pending</Badge>
                      <button onClick={() => teams.cancelInvite(team.id, i.id)} className="text-slate-500 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Shared workspaces */}
          <Card>
            <CardHeader
              icon={FolderKanban}
              accent="emerald"
              title="Shared workspaces"
              subtitle="Problem spaces this team works on together"
              action={
                <button onClick={() => setShareOpen((o) => !o)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                  <Plus className="h-3.5 w-3.5" /> Share
                </button>
              }
            />
            {shareOpen && (
              <div className="border-t border-edge/50 bg-elevated/20 p-4">
                {shareable.length === 0 ? (
                  <p className="text-sm text-slate-500">All your workspaces are already shared, or you have none yet. <Link to="/workspaces" className="text-brand-300 hover:underline">Create one →</Link></p>
                ) : (
                  <div className="space-y-1.5">
                    {shareable.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => { teams.shareWorkspace(team.id, w.id, w.title); setShareOpen(false) }}
                        className="flex w-full items-center gap-2 rounded-lg border border-edge/60 bg-surface/60 px-3 py-2 text-left hover:border-emerald-500/40"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                        <span className="flex-1 truncate text-sm text-slate-200">{w.title}</span>
                        <span className="text-xs text-slate-500">{w.stage}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="divide-y divide-edge/40 border-t border-edge/50">
              {sharedWorkspaces.length === 0 && !shareOpen && (
                <p className="px-5 py-4 text-sm text-slate-500">No shared workspaces yet. Click “Share” to add one.</p>
              )}
              {sharedWorkspaces.map((w) => {
                const wa = ACCENT[w.accent]
                return (
                  <div key={w.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', wa.bg, wa.text)}><Layers className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/workspaces/${w.id}`} className="truncate text-sm font-medium text-slate-200 hover:text-white">{w.title}</Link>
                      <div className="truncate text-xs text-slate-500">{w.problem || 'No problem statement'}</div>
                    </div>
                    <Badge variant="neutral">{w.stage}</Badge>
                    <Link to={`/workspaces/${w.id}`} className="btn-ghost !px-2 !py-1.5 !text-xs" title="Open"><ArrowRight className="h-3.5 w-3.5" /></Link>
                    <button onClick={() => teams.unshareWorkspace(team.id, w.id, w.title)} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-rose-300" title="Remove from team"><X className="h-4 w-4" /></button>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right: activity feed */}
        <div>
          <Card>
            <CardHeader icon={ActivityIcon} accent="violet" title="Activity" subtitle="What the team's been doing" />
            <div className="space-y-1 border-t border-edge/50 p-4">
              {team.activity.length === 0 && <p className="px-1 py-3 text-sm text-slate-500">No activity yet.</p>}
              {team.activity.map((ev) => {
                const Icon = ACTIVITY_ICON[ev.kind] ?? Sparkles
                return (
                  <div key={ev.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-elevated/40">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-elevated text-slate-400"><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-300">
                        <span className="font-medium text-slate-200">{ev.actor}</span> {ev.summary}
                      </p>
                      <p className="text-[11px] text-slate-500">{timeAgo(ev.at)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
