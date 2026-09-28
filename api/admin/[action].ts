import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { env } from '../../server/env.js'
import { syncProviderCosts } from '../../server/provider-costs.js'
import { withSecurity } from '../../server/security.js'

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function allowedEmails() {
  return String(env('PLATFORM_ADMIN_EMAILS') || '')
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean)
}

function adminClient() {
  const supabaseUrl = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !serviceKey) return null
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function routeFromRequest(req: VercelRequest) {
  const url = new URL(String(req.url || '/'), 'http://localhost')
  const match = url.pathname.match(/^\/api\/admin\/([^/]+)$/)
  return match ? `/api/admin/${match[1]}` : '/api/admin'
}

function actionFromRequest(req: VercelRequest) {
  const route = routeFromRequest(req)
  return route.startsWith('/api/admin/') ? route.slice('/api/admin/'.length) : ''
}

async function providerCosts(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed' })
  const supabaseUrl = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !serviceKey) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  async function auth() {
    const header = String(req.headers.authorization || '')
    const cronOk = !!env('CRON_SECRET') && header === `Bearer ${env('CRON_SECRET')}`
    if (cronOk) return { cron: true, email: null as string | null }
    const token = header.replace(/^Bearer\s+/i, '')
    if (!token) throw Object.assign(new Error('Authentification requise.'), { status: 401 })
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) throw Object.assign(new Error('Session invalide.'), { status: 401 })
    const email = String(data.user.email || '').toLowerCase()
    if (!allowedEmails().includes(email)) throw Object.assign(new Error('Accès réservé à l’administrateur technique.'), { status: 403 })
    return { cron: false, email }
  }

  function monthStart() {
    return new Date().toISOString().slice(0, 8) + '01'
  }
  function monthEnd() {
    const d = new Date()
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return x.toISOString().slice(0, 10)
  }

  try {
    const access = await auth()
    if (req.method === 'POST' || access.cron) {
      const { results, period } = await syncProviderCosts()
      for (const item of results) {
        const { error } = await admin.from('provider_cost_snapshots').upsert({
          provider: item.provider, period_start: item.period_start, period_end: item.period_end,
          currency: item.currency, amount: item.amount, amount_xof: item.amount_xof,
          basis: item.basis, status: item.status, units: item.units, breakdown: item.breakdown,
          source_ref: item.source_ref || null, error_message: item.error_message || null,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'provider,period_start,period_end' })
        if (error) throw error

        const reference = `${item.provider}:${item.period_start}`
        await admin.from('platform_expenses').delete().eq('source', 'provider_sync').eq('service', item.provider).eq('period_start', item.period_start).eq('reference', reference)
        const expense = await admin.from('platform_expenses').insert({
          service: item.provider, period_start: item.period_start, amount_xof: item.amount_xof ?? 0,
          source: 'provider_sync', reference,
          metadata: { currency: item.currency, amount: item.amount, basis: item.basis, status: item.status, units: item.units },
        })
        if (expense.error) throw expense.error
      }
      return json(res, 200, { ok: true, period, results })
    }

    const { data, error } = await admin.from('provider_cost_snapshots')
      .select('provider,period_start,period_end,currency,amount,amount_xof,basis,status,units,breakdown,source_ref,error_message,fetched_at')
      .eq('period_start', monthStart()).eq('period_end', monthEnd()).order('provider')
    if (error) throw error
    const actualXof = (data || []).reduce((sum: number, row: any) => sum + Number(row.amount_xof || 0), 0)
    return json(res, 200, {
      ok: true,
      snapshots: data || [],
      actual_provider_cost_xof: actualXof,
      fx: { usd_to_xof: Number(env('COST_USD_TO_XOF') || 0), eur_to_xof: Number(env('COST_EUR_TO_XOF') || 0) },
    })
  } catch (error: any) {
    return json(res, error?.status || 500, { error: error?.message || 'Impossible de synchroniser les coûts fournisseurs.' })
  }
}

async function securitySummary(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  const admin = adminClient()
  if (!admin) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json(res, 401, { error: 'Authentification requise.' })
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })
  const emails = allowedEmails()
  if (!emails.includes(String(userData.user.email || '').toLowerCase())) return json(res, 403, { error: 'Accès réservé à l’admin technique.' })
  const { data, error } = await admin.rpc('security_get_summary', { p_hours: 24 })
  if (error) return json(res, 500, { error: error.message })
  return json(res, 200, { ok: true, ...data })
}

async function tech(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  const supabaseUrl = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SECRET_KEY')
  if (!supabaseUrl || !serviceKey) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Authentification requise.' })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
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
      admin.from('billing_cycles').select('school_id,amount_xof,estimated_cost_xof,provider_cost_xof,cost_basis,margin_xof,active_users,status,period_start').eq('period_start', new Date().toISOString().slice(0, 8) + '01'),
      admin.from('platform_service_cost_rules').select('service,metric,label,fixed_monthly_xof,included_units,unit_cost_xof,active').eq('active', true).order('service'),
      admin.from('provider_cost_snapshots').select('provider,period_start,period_end,currency,amount,amount_xof,basis,status,units,error_message,fetched_at').eq('period_start', new Date().toISOString().slice(0, 8) + '01').order('provider'),
      admin.from('autopilot_events').select('id,school_id,event_type,severity,message,metadata,created_at').order('created_at', { ascending: false }).limit(12),
      admin.rpc('security_get_summary', { p_hours: 24 }),
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
    const avgUsers = (currentCycles.data || []).length ? (currentCycles.data || []).reduce((s: number, x: any) => s + Number(x.active_users || 0), 0) / (currentCycles.data || []).length : 0
    const pastDue = (currentCycles.data || []).filter((x: any) => x.status === 'past_due').length

    return json(res, 200, {
      ok: true,
      admin_email: email,
      kpis: { schools: schools || 0, users: users || 0, active_subscriptions: activeSubs || 0, projected_revenue_xof: projectedRevenue, estimated_cost_xof: estimatedCost, actual_provider_cost_xof: actualProviderCost, projected_margin_xof: margin, avg_users_per_school: Math.round(avgUsers), past_due_cycles: pastDue },
      subscriptions: subs.data || [],
      cycles: currentCycles.data || [],
      cost_rules: costRules.data || [],
      provider_costs: providerCosts.data || [],
      events: recentEvents.data || [],
      security: securitySummary.data || { events: 0, warnings: 0, critical: 0, open_alerts: 0, alerts: [] },
      autopilot: { enabled: true, mode: 'usage-aware', policy: 'prepare_invoice_and_payment_checkout; auto-debit only when a supported mandate provider is connected' },
    })
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Impossible de charger le dashboard technique.' })
  }
}

type TrafficRow = { pageviews?: number; visitors?: number; [key: string]: unknown }

async function vercelAnalytics(dataset: 'visits', endpoint: 'aggregate', params: Record<string, string>) {
  const token = env('VERCEL_API_TOKEN')
  const projectId = env('VERCEL_PROJECT_ID')
  const teamId = env('VERCEL_ANALYTICS_TEAM_ID')
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${dataset}/${endpoint}`)
  url.searchParams.set('projectId', projectId)
  if (teamId) url.searchParams.set('teamId', teamId)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
    const body: any = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = body?.error?.message || body?.message || `Vercel API ${response.status}`
      throw Object.assign(new Error(message), { status: response.status })
    }
    return (Array.isArray(body?.data) ? body.data : []) as TrafficRow[]
  } finally {
    clearTimeout(timer)
  }
}

function dayString(offsetDays: number) {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)
}

async function traffic(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  const admin = adminClient()
  if (!admin) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(res, 401, { error: 'Authentification requise.' })
  try {
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })
    if (!allowedEmails().includes(String(userData.user.email || '').toLowerCase())) return json(res, 403, { error: 'Accès réservé à l’administrateur technique.' })

    if (!env('VERCEL_API_TOKEN') || !env('VERCEL_PROJECT_ID')) {
      return json(res, 200, { ok: true, configured: false, message: 'Ajoutez VERCEL_API_TOKEN et VERCEL_PROJECT_ID dans les variables d’environnement Vercel.' })
    }

    const days = Math.min(30, Math.max(1, Number(new URL(String(req.url || '/'), 'http://localhost').searchParams.get('days')) || 7))
    const range = { since: dayString(days - 1), until: dayString(0) }
    const groupings: Array<[string, string, string]> = [
      ['pages', 'route', '8'],
      ['countries', 'country', '6'],
      ['devices', 'deviceType', '4'],
      ['referrers', 'referrerHostname', '6'],
    ]
    const daily = await vercelAnalytics('visits', 'aggregate', { ...range, by: 'day' })
    const settled = await Promise.allSettled(groupings.map(([, by, limit]) => vercelAnalytics('visits', 'aggregate', { ...range, by, limit })))
    const grouped: Record<string, TrafficRow[]> = {}
    const diagnostics: Record<string, string> = {}
    settled.forEach((result, index) => {
      const [name, by] = groupings[index]
      if (result.status === 'fulfilled') {
        grouped[name] = result.value
        diagnostics[name] = `${result.value.length} ligne(s)` + (result.value[0] ? ` — champs: ${Object.keys(result.value[0]).join(', ')}` : '')
      } else {
        grouped[name] = []
        diagnostics[name] = `ÉCHEC (${by}) : ${result.reason?.message || 'erreur inconnue'}`
      }
    })
    const { pages, countries, devices, referrers } = grouped
    const sum = (rows: TrafficRow[], key: 'pageviews' | 'visitors') => rows.reduce((total, row) => total + Number(row[key] || 0), 0)
    return json(res, 200, {
      ok: true,
      configured: true,
      range: { ...range, days },
      totals: { pageviews: sum(daily, 'pageviews'), visitors: sum(daily, 'visitors') },
      daily, pages, countries, devices, referrers, diagnostics,
    })
  } catch (error: any) {
    const status = Number(error?.status) || 500
    const message = status === 401 || status === 403
      ? 'Token Vercel refusé : vérifiez VERCEL_API_TOKEN et son périmètre.'
      : status === 404 ? 'Projet introuvable : vérifiez VERCEL_PROJECT_ID.'
      : error?.name === 'AbortError' ? 'L’API Vercel ne répond pas (délai dépassé).'
      : error?.message || 'Impossible de charger le trafic.'
    return json(res, 502, { error: message })
  }
}

export default async function adminRouter(req: VercelRequest, res: VercelResponse) {
  const route = routeFromRequest(req)
  const action = actionFromRequest(req)
  const handlers: Record<string, (req: VercelRequest, res: VercelResponse, meta?: { requestId: string; route: string }) => Promise<unknown> | unknown> = {
    'provider-costs': providerCosts,
    security: securitySummary,
    tech,
    traffic,
  }
  const handler = handlers[action]
  if (!handler) return json(res, 404, { error: 'Route admin inconnue.' })
  return withSecurity(route, handler)(req, res)
}
