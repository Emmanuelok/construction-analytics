import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

export type AppUser = { id: string; email: string; name?: string }
export type AuthResult = { error?: string; info?: string }

type AuthValue = {
  user: AppUser | null
  loading: boolean
  /** 'supabase' when real backend creds are configured, otherwise 'demo'. */
  mode: 'supabase' | 'demo'
  signUp: (email: string, password: string, name?: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const DEMO_KEY = 'aec-demo-user'

function loadDemoUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as AppUser) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const mode: 'supabase' | 'demo' = isSupabaseEnabled ? 'supabase' : 'demo'
  const [user, setUser] = useState<AppUser | null>(() => (mode === 'demo' ? loadDemoUser() : null))
  const [loading, setLoading] = useState(mode === 'supabase')

  // Hydrate + subscribe to the real Supabase session when configured.
  useEffect(() => {
    if (mode !== 'supabase' || !supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const u = data.session?.user
      setUser(u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata as any)?.name } : null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email ?? '', name: (u.user_metadata as any)?.name } : null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [mode])

  const signUp = useCallback(
    async (email: string, password: string, name?: string): Promise<AuthResult> => {
      if (mode === 'supabase' && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) return { error: error.message }
        if (data.user && !data.session) return { info: 'Check your inbox to confirm your email, then sign in.' }
        return {}
      }
      const u: AppUser = { id: `demo-${email.toLowerCase()}`, email, name }
      localStorage.setItem(DEMO_KEY, JSON.stringify(u))
      setUser(u)
      return {}
    },
    [mode],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (mode === 'supabase' && supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? { error: error.message } : {}
      }
      const u: AppUser = { id: `demo-${email.toLowerCase()}`, email }
      localStorage.setItem(DEMO_KEY, JSON.stringify(u))
      setUser(u)
      return {}
    },
    [mode],
  )

  const signOut = useCallback(async () => {
    if (mode === 'supabase' && supabase) await supabase.auth.signOut()
    else {
      localStorage.removeItem(DEMO_KEY)
      setUser(null)
    }
  }, [mode])

  const value = useMemo<AuthValue>(
    () => ({ user, loading, mode, signUp, signIn, signOut }),
    [user, loading, mode, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
