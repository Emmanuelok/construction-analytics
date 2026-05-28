import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, Globe, Menu, Search, Sparkles } from 'lucide-react'
import { NAV } from '@/lib/nav'

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = NAV.find((n) => n.path === pathname) ?? NAV[0]

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
          onClick={() => navigate('/ask')}
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
          onClick={() => navigate('/ask')}
          className="grid h-9 w-9 place-items-center rounded-xl border border-edge/70 bg-elevated/50 text-violet-400 hover:border-violet-500/40 md:hidden"
        >
          <Sparkles className="h-4 w-4" />
        </button>

        <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-edge/70 bg-elevated/50 text-slate-400 hover:text-white">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-400" />
        </button>

        <div className="flex items-center gap-2.5 rounded-xl border border-edge/70 bg-elevated/50 py-1 pl-1 pr-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white">
            EK
          </span>
          <div className="hidden leading-tight sm:block">
            <div className="text-xs font-semibold text-slate-200">Emmanuel K.</div>
            <div className="text-[10px] text-slate-500">Platform Owner</div>
          </div>
        </div>
      </div>
    </header>
  )
}
