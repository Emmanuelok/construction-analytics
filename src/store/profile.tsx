import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EMPTY_PROFILE, EMPTY_SIGNALS, type Signals, type UserProfile } from '@/lib/intelligence'
import { useAuth } from '@/store/auth'

type Viewable = { id: string; category: string; tags: string[] }

type ProfileValue = {
  profile: UserProfile
  signals: Signals
  saveProfile: (p: UserProfile) => void
  updateProfile: (patch: Partial<UserProfile>) => void
  recordView: (d: Viewable) => void
  recordSearch: (q: string) => void
  resetLearning: () => void
}

const ProfileContext = createContext<ProfileValue | null>(null)
const PKEY = 'aec-profile'
const SKEY = 'aec-signals'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback
  } catch {
    return fallback
  }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const suffix = user ? `::${user.id}` : ''
  const pKey = PKEY + suffix
  const sKey = SKEY + suffix

  const [profile, setProfile] = useState<UserProfile>(() => read(PKEY, EMPTY_PROFILE))
  const [signals, setSignals] = useState<Signals>(() => read(SKEY, EMPTY_SIGNALS))

  // Re-hydrate when the signed-in identity changes.
  useEffect(() => {
    setProfile(read(pKey, EMPTY_PROFILE))
    setSignals(read(sKey, EMPTY_SIGNALS))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(pKey, JSON.stringify(profile))
    } catch {
      /* ignore */
    }
  }, [profile, pKey])
  useEffect(() => {
    try {
      localStorage.setItem(sKey, JSON.stringify(signals))
    } catch {
      /* ignore */
    }
  }, [signals, sKey])

  const value = useMemo<ProfileValue>(
    () => ({
      profile,
      signals,
      saveProfile: (p) => setProfile({ ...p, onboarded: true }),
      updateProfile: (patch) => setProfile((prev) => ({ ...prev, ...patch })),
      recordView: (d) =>
        setSignals((s) => {
          const tagAffinity = { ...s.tagAffinity }
          d.tags.forEach((t) => (tagAffinity[t.toLowerCase()] = (tagAffinity[t.toLowerCase()] ?? 0) + 1))
          return {
            views: { ...s.views, [d.id]: (s.views[d.id] ?? 0) + 1 },
            lastViewed: [d.id, ...s.lastViewed.filter((id) => id !== d.id)].slice(0, 12),
            searches: s.searches,
            tagAffinity,
            catAffinity: { ...s.catAffinity, [d.category]: (s.catAffinity[d.category] ?? 0) + 1 },
            actions: s.actions + 1,
          }
        }),
      recordSearch: (q) =>
        setSignals((s) => ({
          ...s,
          searches: [q, ...s.searches.filter((x) => x !== q)].slice(0, 12),
          actions: s.actions + 1,
        })),
      resetLearning: () => setSignals(EMPTY_SIGNALS),
    }),
    [profile, signals],
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
