import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Authentification requise.' })
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,role,school_id').eq('id', userData.user.id).single()
    if (profileError || !profile || profile.role !== 'director' || !profile.school_id) return json(res, 403, { error: 'Accès réservé à la direction.' })
    const { data: stats, error } = await admin.from('v_director_autopilot_stats').select('*').eq('school_id', profile.school_id).single()
    if (error) throw error
    const { data: settings, error: settingsError } = await admin.from('school_billing_settings').select('*').eq('school_id', profile.school_id).maybeSingle()
    if (settingsError) throw settingsError
    const { data: events, error: eventsError } = await admin.from('autopilot_events').select('event_type,severity,message,created_at').eq('school_id', profile.school_id).order('created_at',{ascending:false}).limit(8)
    if (eventsError) throw eventsError
    return json(res, 200, { ok: true, stats, settings, events: events || [] })
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Impossible de charger les statistiques.' })
  }
}

export default withSecurity('/api/director/stats', handler)
