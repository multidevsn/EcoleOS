import { createClient } from '@supabase/supabase-js'

// Public client configuration. The publishable key is intended for browser use.
// Environment variables override the fallback so local/Vercel deployments can use their own project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://gieszwmztjrutzkfuwqz.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Td20BfaFLt5qplcwp2HfUQ_Qw12ghgr'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
