'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Small, reusable scroll-reveal primitives so every section animates in
   consistently. Respects prefers-reduced-motion, and — importantly — never
   traps content invisible: if the IntersectionObserver hasn't fired shortly
   after mount (offscreen, slow load, or a tool that resizes instead of
   scrolling), we reveal anyway. */

const ease = [0.16, 1, 0.3, 1] as const

/** Returns true once the element should be shown: when scrolled into view, or
 *  after a safety timeout, whichever comes first. */
function useReveal(margin = '-80px') {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    // Safety net: never leave content hidden if the observer never fires.
    const t = setTimeout(() => setShow(true), 1200)
    return () => {
      io.disconnect()
      clearTimeout(t)
    }
  }, [show, margin])
  return { ref, show }
}

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const { ref, show } = useReveal()
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      animate={show ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, show } = useReveal('-60px')
  return (
    <motion.div ref={ref} className={className} variants={containerVariants} initial="hidden" animate={show ? 'show' : 'hidden'}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={reduce ? { hidden: { opacity: 0 }, show: { opacity: 1 } } : itemVariants}>
      {children}
    </motion.div>
  )
}

export { motion }
