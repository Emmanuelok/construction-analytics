import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when real backend credentials are present; otherwise the app runs in
 *  local "demo" mode (localStorage), so the static deploy still works. */
export const isSupabaseEnabled = Boolean(url && anon)

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

/** Name of the Storage bucket that holds seller-uploaded dataset files. */
export const DATASET_BUCKET = 'datasets'
