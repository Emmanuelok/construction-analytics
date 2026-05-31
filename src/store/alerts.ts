import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/store/auth'
import { PROJECTS, type Project } from '@/data/platform'
import type { ProjectVitals } from '@/lib/project-model'
import {
  DEFAULT_RULES,
  evaluate,
  makeRule,
  metricsForVitals,
  parseRules,
  summarize,
  type AlertRule,
  type Subject,
} from '@/lib/alerts'

/* Per-account threshold rules, evaluated live across the project portfolio.
 * Rules persist in localStorage (Supabase-ready); breaches are recomputed from
 * the same project model the workbenches use. */

const KEY = 'aec-alerts-v1'

const toVitals = (p: Project): ProjectVitals => ({
  id: p.id, name: p.name, sector: p.sector, location: p.location,
  value: p.value, gfa: p.gfa, progress: p.progress,
  costVariance: p.costVariance, scheduleVariance: p.scheduleVariance,
  risk: p.risk, safety: p.safety, quality: p.quality, carbon: p.carbon,
  rfis: p.rfis, clashes: p.clashes,
})

function readRules(key: string): AlertRule[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return DEFAULT_RULES.map((r) => ({ ...r })) // first run → seed defaults
    return parseRules(raw)
  } catch {
    return DEFAULT_RULES.map((r) => ({ ...r }))
  }
}
function writeRules(key: string, rules: AlertRule[]) {
  try { localStorage.setItem(key, JSON.stringify(rules)) } catch { /* quota */ }
}

export function useAlerts() {
  const { user } = useAuth()
  const key = useMemo(() => (user ? `${KEY}::${user.id}` : KEY), [user])
  const [rules, setRules] = useState<AlertRule[]>(() => readRules(key))
  useEffect(() => { setRules(readRules(key)) }, [key])

  const persist = useCallback((next: AlertRule[]) => { writeRules(key, next); setRules(next) }, [key])

  // Subjects (projects) and their metrics are static demo data — compute once.
  const subjects: Subject[] = useMemo(() => PROJECTS.map((p) => ({ id: p.id, name: p.name, metrics: metricsForVitals(toVitals(p)) })), [])
  const alerts = useMemo(() => evaluate(rules, subjects), [rules, subjects])
  const summary = useMemo(() => summarize(alerts), [alerts])

  const addRule = useCallback(() => persist([...readRules(key), makeRule({ name: 'New rule' })]), [persist, key])
  const updateRule = useCallback((id: string, patch: Partial<AlertRule>) => persist(readRules(key).map((r) => (r.id === id ? { ...r, ...patch } : r))), [persist, key])
  const removeRule = useCallback((id: string) => persist(readRules(key).filter((r) => r.id !== id)), [persist, key])
  const resetRules = useCallback(() => persist(DEFAULT_RULES.map((r) => ({ ...r }))), [persist])

  return { rules, alerts, summary, subjects, addRule, updateRule, removeRule, resetRules }
}
