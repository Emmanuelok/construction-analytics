'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { LiveConsole } from './LiveConsole'

const ease = [0.16, 1, 0.3, 1] as const

export function Hero({ appUrl }: { appUrl: string }) {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease, delay },
  })

  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* ambient grid + glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-bg mask-fade-b absolute inset-0 opacity-60" />
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[120px]"
          animate={reduce ? {} : { opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <motion.a
          {...rise(0)}
          href="#problem"
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-edge/70 bg-elevated/50 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur transition-colors hover:border-brand-500/50"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          The built environment is the world&apos;s least-digitized major industry
          <ArrowRight className="h-3 w-3" />
        </motion.a>

        <motion.h1
          {...rise(0.08)}
          className="mx-auto mt-6 max-w-4xl text-center text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          One studio for <span className="text-gradient">all AEC data</span>, analytics &amp; AI.
        </motion.h1>

        <motion.p {...rise(0.16)} className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-slate-400">
          Not a dashboard you read — an instrument you operate. Query 4.7B records, compute{' '}
          <span className="text-slate-200">real correlations, trends and outliers</span> on any dataset, and turn a
          finding into a tracked decision. The live terminal below is the actual product.
        </motion.p>

        <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={appUrl}
            className="group inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-12px_rgba(59,130,246,0.6)] transition-all hover:bg-brand-400"
          >
            Enter the studio
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#pillars"
            className="inline-flex items-center gap-2 rounded-xl border border-edge/70 bg-elevated/40 px-5 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition-colors hover:border-brand-500/40"
          >
            <Sparkles className="h-4 w-4 text-violet-400" /> See what it does
          </a>
        </motion.div>

        {/* live analytics console — the actual instrument, not a brochure */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease, delay: 0.32 }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <LiveConsole />
        </motion.div>
      </div>
    </section>
  )
}
