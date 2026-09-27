import { createClient } from '@supabase/supabase-js'

// Public client configuration. The publishable key is intended for browser use.
// Environment variables override the fallback so local/Vercel deployments can use their own project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://dhotksdwaswavtwpwagw.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_IxTojTB354o4pHnMv3Is6A_vImPyaOP'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
