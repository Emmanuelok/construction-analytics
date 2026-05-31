import { NavLink } from 'react-router-dom'
import { Database, Sparkles, X } from 'lucide-react'
import { NAV, NAV_GROUPS, ACCENT } from '@/lib/nav'
import { cn } from '@/lib/cn'
import { Wordmark } from './Logo'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-edge/60 bg-panel/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-edge/60 px-5">
          <NavLink to="/welcome" onClick={onClose} aria-label="AEC Studio — landing page">
            <Wordmark />
          </NavLink>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-elevated hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {group}
              </div>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
                  const a = ACCENT[item.accent]
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                          isActive
                            ? 'bg-elevated/80 text-white shadow-sm ring-1 ring-edge/80'
                            : 'text-slate-400 hover:bg-elevated/50 hover:text-slate-200',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
                              isActive ? cn(a.bg, a.text) : 'text-slate-500 group-hover:text-slate-300',
                            )}
                          >
                            <item.icon className="h-[17px] w-[17px]" />
                          </span>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.tag && (
                            <span
                              className={cn(
                                'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                                item.tag === 'AI' ? 'bg-violet-500/15 text-violet-300' : 'bg-rose-500/15 text-rose-300',
                              )}
                            >
                              {item.tag}
                            </span>
                          )}
                          {isActive && <span className={cn('absolute -left-3 h-5 w-1 rounded-full', a.dot)} />}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-edge/60 p-3">
          <div className="rounded-xl border border-edge/60 bg-gradient-to-br from-brand-500/10 to-violet-500/5 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" /> Studio Copilot
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              Ask anything across 4.7B records in natural language.
            </p>
            <NavLink to="/ask" onClick={onClose} className="btn-primary mt-2.5 w-full !py-1.5 !text-xs">
              Open Ask AEC
            </NavLink>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1 text-[11px] text-slate-500">
            <Database className="h-3.5 w-3.5" />
            <span>18.4 PB lakehouse · </span>
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Operational
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
