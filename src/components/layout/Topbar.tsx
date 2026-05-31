import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, Globe, Menu, Search, Sparkles, LogOut, Library, UploadCloud, ChevronDown, LogIn, Sun, Moon, Monitor, Users } from 'lucide-react'
import { NAV } from '@/lib/nav'
import { useAuth } from '@/store/auth'
import { useAlerts } from '@/store/alerts'
import { useTheme, type ThemeMode } from '@/store/theme'
import { AuthModal } from '@/components/AuthModal'
import { cn } from '@/lib/cn'

function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const opts: { m: ThemeMode; icon: typeof Sun; label: string }[] = [
    { m: 'light', icon: Sun, label: 'Light' },
    { m: 'dark', icon: Moon, label: 'Dark' },
    { m: 'system', icon: Monitor, label: 'System' },
  ]
  return (
    <div className="hidden items-center gap-0.5 rounded-xl border border-edge/70 bg-elevated/50 p-0.5 sm:flex">
      {opts.map((o) => (
        <button
          key={o.m}
          onClick={() => setMode(o.m)}
          title={`${o.label} theme`}
          className={cn('grid h-7 w-7 place-items-center rounded-lg transition-colors', mode === o.m ? 'bg-surface text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-200')}
        >
          <o.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

function initials(user: { name?: string; email: string }) {
  const base = user.name?.trim() || user.email
  const parts = base.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || base.slice(0, 2).toUpperCase()
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const current = NAV.find((n) => n.path === pathname) ?? NAV[0]
  const openPalette = () => window.dispatchEvent(new CustomEvent('aec:command'))
  const { user, signOut, mode } = useAuth()
  const { summary } = useAlerts()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-edge/60 bg-base/80 px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-400 hover:bg-elevated hover:text-white lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden items-center gap-1.5 text-sm sm:flex">
        <span className="text-slate-500">Studio</span>
        <ChevronRight className="h-4 w-4 text-slate-700" />
        <span className="font-medium text-slate-200">{current.label}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={openPalette}
          className="hidden items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-brand-500/40 hover:text-slate-200 md:flex"
        >
          <Search className="h-4 w-4" />
          <span>Search or ask anything…</span>
          <kbd className="ml-6 rounded border border-edge bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">⌘K</kbd>
        </button>

        <button className="hidden items-center gap-2 rounded-xl border border-edge/70 bg-elevated/50 px-3 py-2 text-sm text-slate-300 hover:text-white lg:flex">
          <Globe className="h-4 w-4 text-slate-400" />
          <span>EU-West</span>
        </button>

        <button
          onClick={openPalette}
          className="grid h-9 w-9 place-items-center rounded-xl border border-edge/70 bg-elevated/50 text-violet-400 hover:border-violet-500/40 md:hidden"
        >
          <Sparkles className="h-4 w-4" />
        </button>

        <ThemeToggle />

        <Link to="/alerts" aria-label={`Alerts (${summary.total})`} title={`${summary.total} active alerts`} className="relative grid h-9 w-9 place-items-center rounded-xl border border-edge/70 bg-elevated/50 text-slate-400 hover:text-white">
          <Bell className="h-4 w-4" />
          {summary.total > 0 && (
            <span className={cn('absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold text-white', summary.high > 0 ? 'bg-rose-500' : 'bg-amber-500')}>
              {summary.total}
            </span>
          )}
        </Link>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl border border-edge/70 bg-elevated/50 py-1 pl-1 pr-2.5 hover:border-brand-500/40"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white">
                {initials(user)}
              </span>
              <div className="hidden max-w-[140px] leading-tight sm:block">
                <div className="truncate text-xs font-semibold text-slate-200">{user.name || user.email}</div>
                <div className="text-[10px] text-slate-500">{mode === 'supabase' ? 'Member' : 'Demo account'}</div>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:block" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-edge/70 bg-surface py-1 shadow-2xl">
                <div className="border-b border-edge/50 px-3 py-2">
                  <div className="truncate text-xs font-semibold text-slate-200">{user.name || 'Member'}</div>
                  <div className="truncate text-[11px] text-slate-500">{user.email}</div>
                </div>
                <MenuLink to="/library" icon={Library} label="My Library" />
                <MenuLink to="/teams" icon={Users} label="Teams" />
                <MenuLink to="/sell" icon={UploadCloud} label="Seller Studio" />
                <button
                  onClick={() => { setMenuOpen(false); void signOut() }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-elevated hover:text-rose-300"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="btn-primary !px-3 !py-2 !text-sm">
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </header>
  )
}

function MenuLink({ to, icon: Icon, label }: { to: string; icon: typeof Library; label: string }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-elevated hover:text-white')}>
      <Icon className="h-4 w-4 text-slate-500" /> {label}
    </Link>
  )
}
