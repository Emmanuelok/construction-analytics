import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/* A keyboard-focusable, screen-reader-announced horizontal scroll region for the
 * studio's wide editable tables. On narrow viewports it shows a "swipe to see
 * more" hint and a right-edge fade while the table can scroll further, so the
 * off-screen columns are discoverable on a phone. Keyboard users can focus the
 * region and scroll it with the arrow keys (native behaviour for tabindex=0
 * scroll containers). */
export function ScrollableTable({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', update); ro.disconnect() }
  }, [children])

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={`${label} (scroll horizontally to see more)`}
        tabIndex={0}
        className={cn('overflow-x-auto focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-500/50', className)}
      >
        {children}
      </div>
      {/* right-edge fade + swipe hint while more columns remain off-screen */}
      <div className={cn('pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-base to-transparent transition-opacity', more ? 'opacity-100' : 'opacity-0')} />
      <div
        aria-hidden
        className={cn('pointer-events-none absolute bottom-1 right-2 rounded-full bg-elevated/90 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-edge/60 transition-opacity sm:hidden', more ? 'opacity-100' : 'opacity-0')}
      >
        swipe →
      </div>
    </div>
  )
}
