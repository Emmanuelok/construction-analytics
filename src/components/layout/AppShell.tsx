import { Suspense, useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from '@/components/CommandPalette'
import { Onboarding } from '@/components/Onboarding'
import { useProfile } from '@/store/profile'

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
        Loading module…
      </div>
    </div>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [onbOpen, setOnbOpen] = useState(false)
  const { pathname } = useLocation()
  // Routes that take over the full viewport (canvas-style), no max-width/footer.
  const fullBleed = pathname === '/flow' || pathname === '/workbench'
  const { profile } = useProfile()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // First-visit onboarding (once per session) + open on demand via event.
  useEffect(() => {
    if (!profile.onboarded && !sessionStorage.getItem('aec-onb-seen')) {
      sessionStorage.setItem('aec-onb-seen', '1')
      const t = setTimeout(() => setOnbOpen(true), 600)
      return () => clearTimeout(t)
    }
  }, [profile.onboarded])

  useEffect(() => {
    const onOnb = () => setOnbOpen(true)
    window.addEventListener('aec:onboarding', onOnb)
    return () => window.removeEventListener('aec:onboarding', onOnb)
  }, [])

  return (
    <div className="min-h-screen">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 grid-bg opacity-[0.5] mask-fade-b" />
      </div>

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="lg:pl-[270px]">
        <Topbar onMenu={() => setOpen(true)} />
        {fullBleed ? (
          /* Full-bleed routes (e.g. Flow Studio) own the whole viewport below the
             topbar — no max-width, padding or footer, so the canvas is the studio. */
          <main key={pathname} className="h-[calc(100vh-4rem)] animate-fadeup overflow-hidden">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        ) : (
          <>
            <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
              <div key={pathname} className="animate-fadeup">
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                </Suspense>
              </div>
            </main>
            <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
              <div className="hairline flex flex-col items-center justify-between gap-3 pt-6 text-xs text-slate-600 sm:flex-row">
                <span>AEC Data & Intelligence Studio — a unified lakehouse, marketplace & analytics platform for the built environment.</span>
                <span className="data-mono">v0.1 · concept studio · {new Date().getFullYear()}</span>
              </div>
            </footer>
          </>
        )}
      </div>

      <CommandPalette />
      <Onboarding open={onbOpen} onClose={() => setOnbOpen(false)} />
      <ScrollRestoration />
    </div>
  )
}
