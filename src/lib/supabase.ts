import { createClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from './net'

// Public client configuration. The publishable key is intended for browser use.
// Environment variables override the fallback so local/Vercel deployments can use their own project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://gieszwmztjrutzkfuwqz.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Td20BfaFLt5qplcwp2HfUQ_Qw12ghgr'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: {
    // Sans délai, une requête Supabase sur un réseau mobile dégradé pouvait rester
    // « en attente » indéfiniment : l'écran affichait « Chargement… » pour toujours,
    // sans erreur ni bouton de relance. 20 s couvre largement un aller-retour normal.
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetchWithTimeout(input, init),
  },
})

export { fetchWithTimeout, withTimeout } from './net'
