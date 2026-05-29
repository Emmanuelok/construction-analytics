import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Accent } from '@/lib/nav'
import { useAuth } from '@/store/auth'

/* Teams let people collaborate on Workspaces — invite members, share a workspace
 * with a team, and follow an activity feed. Persisted locally per the signed-in
 * account today; the same shape maps cleanly onto Supabase tables + RLS when a
 * backend is configured (a follow-up). */

export type TeamRole = 'owner' | 'admin' | 'member'
export type Member = { id: string; email: string; name?: string; role: TeamRole; joinedAt: string }
export type Invite = { id: string; email: string; role: TeamRole; invitedAt: string }

export type ActivityKind =
  | 'team_created'
  | 'member_joined'
  | 'member_invited'
  | 'workspace_shared'
  | 'workspace_unshared'
  | 'hypothesis_validated'
  | 'hypothesis_rejected'
  | 'dataset_added'
  | 'note_added'
  | 'stage_changed'
export type Activity = {
  id: string
  kind: ActivityKind
  actor: string // display name or email
  summary: string
  at: string
  workspaceId?: string
}

export type Team = {
  id: string
  name: string
  description: string
  accent: Accent
  ownerId: string
  members: Member[]
  invites: Invite[]
  workspaceIds: string[]
  activity: Activity[]
  createdAt: string
}

const ACCENTS: Accent[] = ['violet', 'blue', 'emerald', 'amber', 'rose', 'cyan', 'teal', 'fuchsia']
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Human-readable label per activity kind (icon chosen in the UI). */
export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  team_created: 'created the team',
  member_joined: 'joined the team',
  member_invited: 'invited a member',
  workspace_shared: 'shared a workspace',
  workspace_unshared: 'removed a workspace',
  hypothesis_validated: 'validated a hypothesis',
  hypothesis_rejected: 'rejected a hypothesis',
  dataset_added: 'added a dataset',
  note_added: 'logged a decision',
  stage_changed: 'advanced a stage',
}

type TeamsValue = {
  teams: Team[]
  get: (id: string) => Team | undefined
  /** Teams the current user owns or is a member of. */
  myTeams: Team[]
  create: (input: { name: string; description?: string }) => string
  remove: (id: string) => void
  rename: (id: string, name: string, description?: string) => void
  invite: (id: string, email: string, role?: TeamRole) => void
  cancelInvite: (id: string, inviteId: string) => void
  /** Accept a pending invite as the current user (demo: same browser). */
  acceptInvite: (teamId: string, inviteId: string) => void
  removeMember: (id: string, memberId: string) => void
  shareWorkspace: (teamId: string, workspaceId: string, title: string) => void
  unshareWorkspace: (teamId: string, workspaceId: string, title: string) => void
  /** Record an activity event against any team that owns the workspace. */
  logWorkspaceActivity: (workspaceId: string, kind: ActivityKind, summary: string) => void
  /** Team ids (if any) a workspace is shared with. */
  teamsForWorkspace: (workspaceId: string) => Team[]
}

const Ctx = createContext<TeamsValue | null>(null)
const KEY = 'aec-teams'

function load(): Team[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Team[]) : []
  } catch {
    return []
  }
}

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>(() => load())

  // Teams are a shared registry (not per-account namespaced) so an invited
  // member signed into a different account in the same browser can accept.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setTeams(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(teams))
    } catch {
      /* ignore */
    }
  }, [teams])

  const actorName = user?.name || user?.email || 'You'

  const value = useMemo<TeamsValue>(() => {
    const mutate = (id: string, fn: (t: Team) => Team) => setTeams((list) => list.map((t) => (t.id === id ? fn(t) : t)))
    const pushActivity = (t: Team, kind: ActivityKind, summary: string, workspaceId?: string): Team => ({
      ...t,
      activity: [{ id: uid('a'), kind, actor: actorName, summary, at: new Date().toISOString(), workspaceId }, ...t.activity].slice(0, 60),
    })

    return {
      teams,
      get: (id) => teams.find((t) => t.id === id),
      myTeams: teams.filter((t) => t.ownerId === (user?.id ?? '') || t.members.some((m) => m.id === (user?.id ?? '') || m.email === user?.email)),
      create: (input) => {
        const now = new Date().toISOString()
        const owner: Member = { id: user?.id ?? 'demo-owner', email: user?.email ?? 'you@studio.com', name: user?.name, role: 'owner', joinedAt: now }
        const team: Team = {
          id: uid('team'),
          name: input.name.trim() || 'Untitled team',
          description: input.description?.trim() ?? '',
          accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
          ownerId: owner.id,
          members: [owner],
          invites: [],
          workspaceIds: [],
          activity: [{ id: uid('a'), kind: 'team_created', actor: actorName, summary: `created “${input.name.trim() || 'Untitled team'}”`, at: now }],
          createdAt: now,
        }
        setTeams((list) => [team, ...list])
        return team.id
      },
      remove: (id) => setTeams((list) => list.filter((t) => t.id !== id)),
      rename: (id, name, description) => mutate(id, (t) => ({ ...t, name: name.trim() || t.name, description: description ?? t.description })),
      invite: (id, email, role = 'member') =>
        mutate(id, (t) => {
          const e = email.trim().toLowerCase()
          if (!e || t.members.some((m) => m.email === e) || t.invites.some((i) => i.email === e)) return t
          const withInvite = { ...t, invites: [...t.invites, { id: uid('inv'), email: e, role, invitedAt: new Date().toISOString() }] }
          return pushActivity(withInvite, 'member_invited', `invited ${e}`)
        }),
      cancelInvite: (id, inviteId) => mutate(id, (t) => ({ ...t, invites: t.invites.filter((i) => i.id !== inviteId) })),
      acceptInvite: (teamId, inviteId) =>
        mutate(teamId, (t) => {
          const inv = t.invites.find((i) => i.id === inviteId)
          if (!inv) return t
          const member: Member = { id: user?.id ?? `demo-${inv.email}`, email: user?.email ?? inv.email, name: user?.name, role: inv.role, joinedAt: new Date().toISOString() }
          const joined = { ...t, members: [...t.members, member], invites: t.invites.filter((i) => i.id !== inviteId) }
          return pushActivity(joined, 'member_joined', `joined the team`)
        }),
      removeMember: (id, memberId) => mutate(id, (t) => (t.ownerId === memberId ? t : { ...t, members: t.members.filter((m) => m.id !== memberId) })),
      shareWorkspace: (teamId, workspaceId, title) =>
        mutate(teamId, (t) => {
          if (t.workspaceIds.includes(workspaceId)) return t
          const shared = { ...t, workspaceIds: [...t.workspaceIds, workspaceId] }
          return pushActivity(shared, 'workspace_shared', `shared “${title}”`, workspaceId)
        }),
      unshareWorkspace: (teamId, workspaceId, title) =>
        mutate(teamId, (t) => {
          if (!t.workspaceIds.includes(workspaceId)) return t
          const unshared = { ...t, workspaceIds: t.workspaceIds.filter((w) => w !== workspaceId) }
          return pushActivity(unshared, 'workspace_unshared', `removed “${title}”`, workspaceId)
        }),
      logWorkspaceActivity: (workspaceId, kind, summary) =>
        setTeams((list) => list.map((t) => (t.workspaceIds.includes(workspaceId) ? pushActivity(t, kind, summary, workspaceId) : t))),
      teamsForWorkspace: (workspaceId) => teams.filter((t) => t.workspaceIds.includes(workspaceId)),
    }
  }, [teams, user, actorName])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTeams(): TeamsValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTeams must be used within TeamsProvider')
  return ctx
}

export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || nameOrEmail.slice(0, 2).toUpperCase()
}
