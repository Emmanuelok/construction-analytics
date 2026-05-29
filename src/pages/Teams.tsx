import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Users, Plus, ArrowRight, FolderKanban, UserPlus, X, Sparkles, Mail } from 'lucide-react'
import { Card, PageHeader, StatTile, Badge } from '@/components/ui'
import { useTeams, initials } from '@/store/teams'
import { useAuth } from '@/store/auth'
import { ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useTeams()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  if (!open) return null

  function submit() {
    const id = create({ name: name.trim() || 'Untitled team', description })
    onClose()
    navigate(`/teams/${id}`)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-8 w-full max-w-md overflow-hidden rounded-2xl border border-edge/70 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-500 text-white">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-100">New team</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-elevated hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Team name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Carbon Strike Team"
              className="w-full rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this team work on?"
              className="w-full resize-none rounded-xl border border-edge/70 bg-elevated/50 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-edge/60 px-5 py-4">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={submit} className="btn-primary"><Sparkles className="h-4 w-4" /> Create team</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function Teams() {
  const { myTeams, teams } = useTeams()
  const { user } = useAuth()
  const [modal, setModal] = useState(false)

  // Pending invites addressed to the current user across all teams.
  const myInvites = teams.flatMap((t) =>
    t.invites.filter((i) => i.email === user?.email?.toLowerCase()).map((i) => ({ team: t, invite: i })),
  )
  const totalMembers = new Set(myTeams.flatMap((t) => t.members.map((m) => m.email))).size
  const sharedWorkspaces = myTeams.reduce((s, t) => s + t.workspaceIds.length, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Users}
        accent="violet"
        eyebrow="Collaborate"
        title="Teams"
        description="Work on problems together — create a team, invite members, share workspaces, and follow a live activity feed of what everyone's doing."
        actions={
          <button onClick={() => setModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New team
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Your teams" value={String(myTeams.length)} icon={Users} accent="violet" />
        <StatTile label="People" value={String(totalMembers)} icon={UserPlus} accent="cyan" />
        <StatTile label="Shared workspaces" value={String(sharedWorkspaces)} icon={FolderKanban} accent="emerald" />
        <StatTile label="Pending invites" value={String(myInvites.length)} icon={Mail} accent="amber" />
      </div>

      {myInvites.length > 0 && (
        <div>
          <h2 className="mb-3 text-[15px] font-semibold text-slate-100">Invitations</h2>
          <div className="space-y-2">
            {myInvites.map(({ team }) => (
              <Card key={team.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className={cn('grid h-10 w-10 place-items-center rounded-xl text-sm font-bold', ACCENT[team.accent].bg, ACCENT[team.accent].text)}>
                    {initials(team.name)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{team.name}</div>
                    <div className="text-xs text-slate-500">You've been invited to join</div>
                  </div>
                </div>
                <Link to={`/teams/${team.id}`} className="btn-primary !px-3 !py-1.5 !text-xs">
                  Review <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-[15px] font-semibold text-slate-100">Your teams</h2>
        {myTeams.length === 0 ? (
          <Card className="grid place-items-center p-14 text-center text-slate-400">
            <Users className="h-8 w-8 text-slate-600" />
            <p className="mt-3">No teams yet — create one and invite your collaborators.</p>
            <button onClick={() => setModal(true)} className="btn-primary mt-4"><Plus className="h-4 w-4" /> New team</button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myTeams.map((t) => {
              const a = ACCENT[t.accent]
              return (
                <Link key={t.id} to={`/teams/${t.id}`}>
                  <Card className="group flex h-full flex-col p-5" hover>
                    <div className="flex items-center justify-between">
                      <span className={cn('grid h-11 w-11 place-items-center rounded-xl text-sm font-bold ring-1', a.bg, a.text, a.ring)}>
                        {initials(t.name)}
                      </span>
                      {t.ownerId === (user?.id ?? '') && <Badge variant="violet">Owner</Badge>}
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold text-slate-100 group-hover:text-white">{t.name}</h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-400">{t.description || 'No description.'}</p>
                    <div className="mt-3 flex items-center gap-3 border-t border-edge/50 pt-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.members.length}</span>
                      <span className="inline-flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {t.workspaceIds.length}</span>
                      <div className="ml-auto flex -space-x-2">
                        {t.members.slice(0, 4).map((m) => (
                          <span key={m.id} className={cn('grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold ring-2 ring-surface', a.bg, a.text)} title={m.name || m.email}>
                            {initials(m.name || m.email)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <CreateModal open={modal} onClose={() => setModal(false)} />
    </div>
  )
}
