import { useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 grid-bg opacity-[0.5] mask-fade-b" />
      </div>

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[270px]">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
          <div key={pathname} className="animate-fadeup">
            <Outlet />
          </div>
        </main>
        <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <div className="hairline flex flex-col items-center justify-between gap-3 pt-6 text-xs text-slate-600 sm:flex-row">
            <span>AEC Data & Intelligence Studio — a unified lakehouse, marketplace & analytics platform for the built environment.</span>
            <span className="data-mono">v0.1 · concept studio · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
      <ScrollRestoration />
    </div>
  )
}
