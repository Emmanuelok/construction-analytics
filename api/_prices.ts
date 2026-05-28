import type { SupabaseClient } from '@supabase/supabase-js'

/* Server-trusted prices for the seed catalog (USD). Client-supplied amounts are
 * never trusted; listing prices are read from Supabase. Keep in sync with
 * src/data/catalog.ts. Files prefixed with "_" are not exposed as routes. */
export const SEED_PRICES: Record<string, number> = {
  'global-cost-benchmarks': 4800,
  'schedule-outcomes': 6200,
  'ifc-object-library': 0,
  'epd-carbon-factors': 2900,
  'supplier-performance': 3800,
  'rfi-response-pairs': 5400,
  'defect-annotations': 4100,
  'cobie-handover': 3300,
  'building-telemetry': 4400,
  'site-gis-zoning': 0,
  'field-daily-productivity': 0,
}

export async function resolvePrice(
  supabase: SupabaseClient | null,
  id: string,
): Promise<{ price: number; name: string } | null> {
  if (id in SEED_PRICES) return { price: SEED_PRICES[id], name: id }
  if (supabase) {
    const { data } = await supabase.from('datasets').select('name,price').eq('id', id).maybeSingle()
    if (data) return { price: Number(data.price ?? 0), name: (data.name as string) ?? id }
  }
  return null
}
