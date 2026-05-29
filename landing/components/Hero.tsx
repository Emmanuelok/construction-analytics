'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles, Boxes, GitCompare, TrendingUp } from 'lucide-react'

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
          Collect, standardize, license and analyze data across the entire project lifecycle. Frame a problem, assemble
          the right datasets, compute <span className="text-slate-200">real statistical findings</span>, and decide as a
          team — from brainstorm to full-scale production.
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

        {/* floating product preview */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, ease, delay: 0.32 }}
          className="relative mx-auto mt-16 max-w-4xl"
          style={{ perspective: 1200 }}
        >
          <div className="card overflow-hidden p-2 shadow-2xl">
            <div className="rounded-xl border border-edge/60 bg-base/80">
              {/* faux window chrome */}
              <div className="flex items-center gap-2 border-b border-edge/50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[11px] text-slate-500">studio · Analysis · Insight report</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {[
                  { icon: GitCompare, label: 'Correlation', stat: 'r = 0.82', tint: 'text-emerald-400', desc: 'cost rises with GFA' },
                  { icon: TrendingUp, label: 'Trend', stat: 'R² = 0.74', tint: 'text-sky-400', desc: 'carbon ↑ over time' },
                  { icon: Boxes, label: 'Segment gap', stat: '1.8σ', tint: 'text-violet-400', desc: 'Healthcare leads cost/m²' },
                ].map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.5 + i * 0.12 }}
                    className="rounded-lg border border-edge/60 bg-elevated/40 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${f.tint}`}>
                        <f.icon className="h-3 w-3" /> {f.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{f.stat}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{f.desc}</p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-edge">
                      <motion.div
                        className={`h-full rounded-full ${i === 0 ? 'bg-emerald-400' : i === 1 ? 'bg-sky-400' : 'bg-violet-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${70 + i * 8}%` }}
                        transition={{ duration: 1, ease, delay: 0.7 + i * 0.12 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          {/* floating chip */}
          <motion.div
            aria-hidden
            className="absolute -right-4 -top-4 hidden rounded-xl border border-violet-500/30 bg-surface/90 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur sm:block"
            animate={reduce ? {} : { y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" /> Pinned as hypothesis
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
