import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { syncProviderCosts } from '../../server/provider-costs.js'

import { withSecurity } from '../../server/security.js'
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }
function allowedEmails() { return String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean) }
function monthStart() { return new Date().toISOString().slice(0, 8) + '01' }
function monthEnd() { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); return x.toISOString().slice(0, 10) }

async function auth(req: VercelRequest, admin: any) {
  const header = String(req.headers.authorization || '')
  const cronOk = !!process.env.CRON_SECRET && header === `Bearer ${process.env.CRON_SECRET}`
  if (cronOk) return { cron: true, email: null as string | null }
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Authentification requise.'), { status: 401 })
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw Object.assign(new Error('Session invalide.'), { status: 401 })
  const email = String(data.user.email || '').toLowerCase()
  if (!allowedEmails().includes(email)) throw Object.assign(new Error('Accès réservé à l’administrateur technique.'), { status: 403 })
  return { cron: false, email }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) return json(res, 405, { error: 'Method not allowed' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return json(res, 503, { error: 'Supabase serveur non configuré.' })
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const access = await auth(req, admin)
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
        await admin.from('platform_expenses').delete().eq('source','provider_sync').eq('service',item.provider).eq('period_start',item.period_start).eq('reference',reference)
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
    return json(res, 200, { ok: true, snapshots: data || [], actual_provider_cost_xof: actualXof, fx: { usd_to_xof: Number(process.env.COST_USD_TO_XOF || 0), eur_to_xof: Number(process.env.COST_EUR_TO_XOF || 0) } })
  } catch (error: any) {
    return json(res, error?.status || 500, { error: error?.message || 'Impossible de synchroniser les coûts fournisseurs.' })
  }
}

export default withSecurity('/api/admin/provider-costs', handler)
