import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/store/auth'
import {
  adoptScenario,
  forModule,
  importBundle,
  makeScenario,
  parseScenarios,
  removeById,
  renameScenario,
  upsert,
  type KPI,
  type Scenario,
} from '@/lib/scenarios'

/* Per-account persistence for saved workbench scenarios. Stored in localStorage
 * keyed by signed-in identity (so each user keeps their own), and ready to sync
 * to Supabase later. Reads are defensive; writes survive quota errors. */

const KEY = 'aec-scenarios-v1'

function readAll(key: string): Scenario[] {
  try {
    return parseScenarios(localStorage.getItem(key))
  } catch {
    return []
  }
}
function writeAll(key: string, list: Scenario[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota — ignore */
  }
}

export function useScenarios(module: string) {
  const { user } = useAuth()
  const key = useMemo(() => (user ? `${KEY}::${user.id}` : KEY), [user])
  const [all, setAll] = useState<Scenario[]>(() => readAll(key))

  // Re-read when the signed-in identity changes.
  useEffect(() => { setAll(readAll(key)) }, [key])

  // Always mutate from the freshest persisted list to avoid stale-closure loss.
  const persist = useCallback((mutate: (cur: Scenario[]) => Scenario[]) => {
    const next = mutate(readAll(key))
    writeAll(key, next)
    setAll(next)
  }, [key])

  const scenarios = useMemo(() => forModule(all, module), [all, module])

  const save = useCallback((name: string, data: unknown, summary: KPI[]) => {
    persist((cur) => upsert(cur, makeScenario(module, name, data, summary)))
  }, [persist, module])
  const remove = useCallback((id: string) => persist((cur) => removeById(cur, id)), [persist])
  const rename = useCallback((id: string, name: string) => persist((cur) => renameScenario(cur, id, name)), [persist])

  /** Adopt scenarios from a raw bundle/token-decoded payload into THIS module.
   *  Returns the number imported (0 = nothing valid). */
  const importRaw = useCallback((raw: string): number => {
    const incoming = importBundle(raw)
    if (!incoming.length) return 0
    persist((cur) => incoming.reduce((acc, s) => upsert(acc, adoptScenario(s, { module })), cur))
    return incoming.length
  }, [persist, module])

  /** Adopt a single scenario object (e.g. from a decoded share token). */
  const importScenario = useCallback((s: Scenario): void => {
    persist((cur) => upsert(cur, adoptScenario(s, { module })))
  }, [persist, module])

  return { scenarios, save, remove, rename, importRaw, importScenario }
}
