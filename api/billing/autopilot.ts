import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security'
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body) }

async function prepareWaveCheckout(admin:any, cycles:any[]) {
  if (!process.env.WAVE_API_KEY) return { prepared: 0, skipped: cycles.length, reason: 'WAVE_API_KEY missing' }
  const base = process.env.APP_URL
  if (!base) return { prepared: 0, skipped: cycles.length, reason: 'APP_URL missing' }
  let prepared = 0
  let skipped = 0
  for (const cycle of cycles) {
    if (cycle.provider_checkout_id) { skipped++; continue }
    try {
      const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.WAVE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(cycle.amount_xof),
          currency: 'XOF',
          client_reference: `billing-cycle:${cycle.id}`,
          success_url: `${base}/?payment=success`,
          error_url: `${base}/?payment=error`,
        }),
      })
      const wave = await response.json()
      if (!response.ok || !wave?.id || !wave?.wave_launch_url) throw new Error(wave?.message || 'Wave checkout error')
      const { error } = await admin.from('billing_cycles').update({ provider_checkout_id: wave.id, provider_checkout_url: wave.wave_launch_url, updated_at: new Date().toISOString() }).eq('id', cycle.id)
      if (error) throw error
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return json(res, 503, { error: 'Supabase serveur non configuré.' })

  const auth = String(req.headers.authorization || '')
  const cronOk = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`
  if (!cronOk) return json(res, 401, { error: 'Unauthorized' })

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
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
