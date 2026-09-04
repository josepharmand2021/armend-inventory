import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configOk = Boolean(url && anonKey && !url.includes('xxxx'))
export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey

export const supabase = configOk
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

// A throwaway client that never touches storage or the main session — used to
// sign up a new staff account without logging the current admin out.
export function makeSignupClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
