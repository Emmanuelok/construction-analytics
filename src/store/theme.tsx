import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

type ThemeValue = { mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (m: ThemeMode) => void }

const Ctx = createContext<ThemeValue | null>(null)
const KEY = 'aec-theme'

function systemTheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
function apply(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemeMode) || 'system'
    } catch {
      return 'system'
    }
  })
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => (mode === 'system' ? systemTheme() : mode))

  useEffect(() => {
    const r = mode === 'system' ? systemTheme() : mode
    setResolved(r)
    apply(r)
    try {
      localStorage.setItem(KEY, mode)
    } catch {
      /* ignore */
    }
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const onChange = () => {
        const rr = systemTheme()
        setResolved(rr)
        apply(rr)
      }
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
  }, [mode])

  const value = useMemo<ThemeValue>(() => ({ mode, resolved, setMode }), [mode, resolved])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
