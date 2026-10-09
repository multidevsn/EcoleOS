import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }

async function prepareWaveCheckout(admin:any, cycles:any[]) {
  if (!env('WAVE_API_KEY')) return { prepared: 0, skipped: cycles.length, reason: 'WAVE_API_KEY missing' }
  const configuredBase = env('APP_URL').trim()
  if (!configuredBase) return { prepared: 0, skipped: cycles.length, reason: 'APP_URL missing' }
  let baseUrl: URL
  try { baseUrl = new URL(configuredBase) } catch { return { prepared: 0, skipped: cycles.length, reason: 'APP_URL invalid' } }
  if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || ['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) return { prepared: 0, skipped: cycles.length, reason: 'APP_URL must be a public HTTPS origin' }
  const base = baseUrl.origin
  let prepared = 0
  let skipped = 0
  for (const cycle of cycles) {
    if (cycle.provider_checkout_id) { skipped++; continue }
    try {
      const {data:subscription,error:subscriptionError}=await admin.from('school_subscriptions').select('billing_provider,billing_price_xof').eq('school_id',cycle.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(subscriptionError)throw subscriptionError
      const amount=Math.max(0,Number(cycle.amount_xof)-(subscription?.billing_provider==='paddle'?Number(subscription.billing_price_xof||0):0))
      if(amount<=0){skipped++;continue}
      const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('WAVE_API_KEY')}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          amount: String(amount),
          currency: 'XOF',
          client_reference: `billing-cycle:${cycle.id}`,
          success_url: `${base}/?payment=success`,
          error_url: `${base}/?payment=error`,
        }),
      })
      const wave = await response.json().catch(() => ({}))
      if (!response.ok || typeof wave?.id !== 'string' || !wave.id.trim() || typeof wave?.wave_launch_url !== 'string') throw new Error(wave?.message || 'Wave checkout error')
      let launchUrl: URL
      try { launchUrl = new URL(wave.wave_launch_url) } catch { throw new Error('Invalid Wave checkout URL') }
      if (launchUrl.protocol !== 'https:' || launchUrl.hostname !== 'pay.wave.com' || launchUrl.username || launchUrl.password || launchUrl.port) throw new Error('Unapproved Wave checkout domain')
      const { data: updated, error } = await admin.from('billing_cycles').update({ provider_checkout_id: wave.id, provider_checkout_url: launchUrl.toString(), provider_checkout_amount_xof: amount, updated_at: new Date().toISOString() }).eq('id', cycle.id).eq('status', cycle.status).is('provider_checkout_id', null).select('id').maybeSingle()
      if (error) throw error
      if (!updated?.id) { skipped++; continue }
      prepared++
    } catch (e:any) {
      skipped++
      await admin.from('autopilot_events').insert({ school_id: cycle.school_id, event_type: 'payment_checkout_prepare_failed', severity: 'warning', message: 'Le checkout Wave n’a pas pu être préparé automatiquement.', metadata: { cycle_id: cycle.id, error: e?.message || 'unknown' } })
    }
  }
  return { prepared, skipped }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_SECRET_KEY')) return json(res, 503, { error: 'Supabase serveur non configuré.' })

  const auth = String(req.headers.authorization || '')
  const cronOk = !!env('CRON_SECRET') && auth === `Bearer ${env('CRON_SECRET')}`
  if (!cronOk) return json(res, 401, { error: 'Unauthorized' })

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const requested = typeof req.query.period === 'string' ? req.query.period : ''
    const period = /^\d{4}-\d{2}-01$/.test(requested) ? requested : new Date().toISOString().slice(0, 8) + '01'
    const { data, error } = await admin.rpc('autopilot_billing_run', { p_period_start: period })
    if (error) return json(res, 500, { error: error.message })

    const { data: dueCycles, error: cycleError } = await admin
      .from('billing_cycles')
      .select('id,school_id,amount_xof,provider_checkout_id,status')
      .eq('period_start', period)
      .in('status', ['due', 'past_due'])
    if (cycleError) return json(res, 500, { error: cycleError.message })

    const checkout = await prepareWaveCheckout(admin, dueCycles || [])
    return json(res, 200, { ok: true, autopilot: data, checkout })
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Autopilot billing error' })
  }
}

export default withSecurity('/api/billing/autopilot', handler)

