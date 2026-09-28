import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security'
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function allowedEmails() { return String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean) }

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Authentification requise.' })
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })
    const email = String(userData.user.email || '').toLowerCase()
    if (!allowedEmails().includes(email)) return json(res, 403, { error: 'Accès réservé à l’administrateur technique.' })

    const [{ count: schools }, { count: users }, { count: activeSubs }, subs, currentCycles, costRules, providerCosts, recentEvents, securitySummary] = await Promise.all([
      admin.from('schools').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('school_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      admin.from('school_subscriptions').select('id,school_id,plan,billing_price_xof,status'),
      admin.from('billing_cycles').select('school_id,amount_xof,estimated_cost_xof,provider_cost_xof,cost_basis,margin_xof,active_users,status,period_start').eq('period_start', new Date().toISOString().slice(0,8)+'01'),
      admin.from('platform_service_cost_rules').select('service,metric,label,fixed_monthly_xof,included_units,unit_cost_xof,active').eq('active', true).order('service'),
      admin.from('provider_cost_snapshots').select('provider,period_start,period_end,currency,amount,amount_xof,basis,status,units,error_message,fetched_at').eq('period_start', new Date().toISOString().slice(0,8)+'01').order('provider'),
      admin.from('autopilot_events').select('id,school_id,event_type,severity,message,metadata,created_at').order('created_at', { ascending: false }).limit(12),
      admin.rpc('security_get_summary',{p_hours:24}),
    ])
    if (subs.error) throw subs.error
    if (currentCycles.error) throw currentCycles.error
    if (costRules.error) throw costRules.error
    if (providerCosts.error) throw providerCosts.error
    if (recentEvents.error) throw recentEvents.error
    if (securitySummary.error) throw securitySummary.error
    const projectedRevenue = (currentCycles.data || []).reduce((s: number, x: any) => s + Number(x.amount_xof || 0), 0)
    const estimatedCost = (currentCycles.data || []).reduce((s: number, x: any) => s + Number(x.estimated_cost_xof || 0), 0)
    const actualProviderCost = (providerCosts.data || []).reduce((s: number, x: any) => s + Number(x.amount_xof || 0), 0)
    const margin = projectedRevenue - estimatedCost
    const avgUsers = (currentCycles.data || []).length ? (currentCycles.data || []).reduce((s:number,x:any)=>s+Number(x.active_users||0),0)/(currentCycles.data||[]).length : 0
    const pastDue = (currentCycles.data || []).filter((x:any)=>x.status==='past_due').length

    return json(res, 200, {
      ok: true,
      admin_email: email,
      kpis: { schools: schools || 0, users: users || 0, active_subscriptions: activeSubs || 0, projected_revenue_xof: projectedRevenue, estimated_cost_xof: estimatedCost, actual_provider_cost_xof: actualProviderCost, projected_margin_xof: margin, avg_users_per_school: Math.round(avgUsers), past_due_cycles: pastDue },
      subscriptions: subs.data || [],
      cycles: currentCycles.data || [],
      cost_rules: costRules.data || [],
      provider_costs: providerCosts.data || [],
      events: recentEvents.data || [],
      security: securitySummary.data || {events:0,warnings:0,critical:0,open_alerts:0,alerts:[]},
      autopilot: { enabled: true, mode: 'usage-aware', policy: 'prepare_invoice_and_payment_checkout; auto-debit only when a supported mandate provider is connected' }
    })
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Impossible de charger le dashboard technique.' })
  }
}

export default withSecurity('/api/admin/tech', handler)
