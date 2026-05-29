'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'

export function Nav({ appUrl }: { appUrl: string }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-edge/60 bg-base/80 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-white">
            AEC Studio <span className="hidden text-slate-500 sm:inline">· Data &amp; Intelligence</span>
          </span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-slate-400 md:flex">
          <a href="#analyze" className="inline-flex items-center gap-1.5 text-brand-300 transition-colors hover:text-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> Analyze live
          </a>
          <a href="#pillars" className="transition-colors hover:text-white">Studio</a>
          <a href="#problem" className="transition-colors hover:text-white">Why</a>
        </div>
        <a
          href={appUrl}
          className="group inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-400"
        >
          Launch <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </a>
      </nav>
    </motion.header>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-edge/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-slate-600 sm:flex-row">
        <span>AEC Data &amp; Intelligence Studio — a unified lakehouse, marketplace &amp; analytics platform for the built environment.</span>
        <span className="font-mono">v0.1 · concept studio · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
