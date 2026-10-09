import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'

export const config = { api: { bodyParser: false } }
const reply = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)
type DbResult<T = any> = { data: T; error: any }

async function rawBody(req: VercelRequest): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk))
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged)
}
function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }
function constantTimeHexEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function validSignature(body: string, header: string, secret: string) {
  const timestampMatch = header.match(/(?:^|,)\s*t=(\d+)/)
  const signatures = [...header.matchAll(/(?:^|,)\s*v1=([a-f0-9]{64})(?=,|$)/g)].map(m => m[1])
  if (!timestampMatch || signatures.length === 0) return false
  const timestampText = timestampMatch[1]
  const timestamp = Number(timestampText)
  const now = Math.floor(Date.now() / 1000)
  // Wave allows up to 5 minutes of age and only 30 seconds of future clock skew.
  if (!Number.isSafeInteger(timestamp) || now - timestamp > 300 || timestamp - now > 30) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestampText + body))
  const expected = bytesToHex(new Uint8Array(signature))
  return signatures.some(candidate => constantTimeHexEqual(expected, candidate))
}
async function checked<T = any>(query: PromiseLike<DbResult<T>>): Promise<DbResult<T>> {
  const result = await query
  if (result?.error) throw result.error
  return result
}
const safeAmount = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

type Resource = {
  kind: 'food' | 'school_payment' | 'billing_cycle' | 'school_subscription'
  id: string
  status: string
  checkoutId: string
  expectedAmount: number
  schoolId?: string | null
  periodEnd?: string | null
  referralId?: string | null
}

async function loadResource(admin: any, data: any, reference: string): Promise<Resource | null> {
  const checkoutId = String(data?.id || '')
  if (!checkoutId) return null
  const prefix = reference.split(':', 1)[0]
  const refId = reference.includes(':') ? reference.slice(reference.indexOf(':') + 1) : ''
  const readById = async (kind: Resource['kind'], id: string): Promise<Resource | null> => {
    if (!id || id.length > 160) return null
    if (kind === 'food') {
      const { data: row } = await checked(admin.from('food_orders').select('id,status,wave_checkout_id,total_xof,user_id').eq('id', id).maybeSingle())
      return row ? { kind, id: row.id, status: String(row.status), checkoutId: String(row.wave_checkout_id || ''), expectedAmount: Number(row.total_xof) } : null
    }
    if (kind === 'school_payment') {
      const { data: row } = await checked(admin.from('school_payments').select('id,status,wave_checkout_id,amount_xof,user_id').eq('id', id).maybeSingle())
      return row ? { kind, id: row.id, status: String(row.status), checkoutId: String(row.wave_checkout_id || ''), expectedAmount: Number(row.amount_xof) } : null
    }
    if (kind === 'school_subscription') {
      const { data: row } = await checked(admin.from('school_subscriptions').select('id,school_id,status,wave_checkout_id,billing_price_xof,referral_id').eq('id', id).maybeSingle())
      return row ? { kind, id: row.id, status: String(row.status), checkoutId: String(row.wave_checkout_id || ''), expectedAmount: Number(row.billing_price_xof), schoolId: row.school_id, referralId: row.referral_id } : null
    }
    const { data: row } = await checked(admin.from('billing_cycles').select('id,school_id,status,period_end,amount_xof,provider_checkout_id,provider_checkout_amount_xof').eq('id', id).maybeSingle())
    if (!row) return null
    let expected = Number(row.provider_checkout_amount_xof)
    if (!Number.isSafeInteger(expected) || expected <= 0) {
      const { data: sub } = await checked(admin.from('school_subscriptions').select('billing_provider,billing_price_xof').eq('school_id', row.school_id).order('created_at', { ascending: false }).limit(1).maybeSingle())
      expected = Math.max(0, Number(row.amount_xof) - (sub?.billing_provider === 'paddle' ? Number(sub.billing_price_xof || 0) : 0))
    }
    return { kind, id: row.id, status: String(row.status), checkoutId: String(row.provider_checkout_id || ''), expectedAmount: expected, schoolId: row.school_id, periodEnd: row.period_end }
  }

  // Prefer the client reference only as a locator; provider checkout ID and amount are
  // independently checked below, so a mismatched/malformed reference cannot settle a bill.
  const byRef: Record<string, Resource['kind']> = {
    'food-order': 'food',
    'school-payment': 'school_payment',
    'billing-cycle': 'billing_cycle',
    subscription: 'school_subscription',
  }
  let resource: Resource | null = byRef[prefix] && refId ? await readById(byRef[prefix], refId) : null
  if (resource) return resource

  // Wave can send client_reference=null; map through the server-stored checkout ID instead.
  const checks: Array<[Resource['kind'], string]> = [
    ['food', 'food_orders'], ['school_payment', 'school_payments'],
    ['billing_cycle', 'billing_cycles'], ['school_subscription', 'school_subscriptions'],
  ]
  for (const [kind, table] of checks) {
    const field = kind === 'billing_cycle' ? 'provider_checkout_id' : 'wave_checkout_id'
    const { data: row } = await checked(admin.from(table).select('id').eq(field, checkoutId).maybeSingle())
    if (row?.id) {
      resource = await readById(kind, String(row.id))
      if (resource) return resource
    }
  }
  return null
}

async function rewardReferral(admin: any, referralId: string | null | undefined) {
  if (!referralId) return
  // Only move a pending referral forward once; duplicate webhook deliveries cannot pay twice.
  await checked(admin.from('referrals').update({ status: 'qualified', qualified_at: new Date().toISOString() }).eq('id', referralId).eq('status', 'pending'))
  const { data: referral } = await checked(admin.from('referrals').select('id,referrer_id,status').eq('id', referralId).maybeSingle())
  if (!referral?.referrer_id || !['qualified', 'rewarded'].includes(String(referral.status))) return
  if (referral.status === 'rewarded') return
  const { data: refProfile } = await checked(admin.from('profiles').select('school_id').eq('id', referral.referrer_id).maybeSingle())
  const { data: simple } = await checked(admin.from('subscription_plans').select('price_xof').eq('id', 'simple').maybeSingle())
  if (!refProfile?.school_id || !simple) return
  const { data: targetSub } = await checked(admin.from('school_subscriptions').select('id,status').eq('school_id', refProfile.school_id).order('created_at', { ascending: false }).limit(1).maybeSingle())
  if (!targetSub?.id || targetSub.status !== 'active') return
  await checked(admin.from('school_subscriptions').update({ plan: 'extra', billing_price_xof: Number(simple.price_xof), updated_at: new Date().toISOString() }).eq('id', targetSub.id).eq('status', 'active'))
  await checked(admin.from('referrals').update({ status: 'rewarded', rewarded_at: new Date().toISOString() }).eq('id', referral.id).eq('status', 'qualified'))
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const body = await rawBody(req)
  const secret = env('WAVE_WEBHOOK_SECRET')
  const signature = String(req.headers['wave-signature'] || '')
  if (!secret || !(await validSignature(body, signature, secret))) return reply(res, 401, { error: 'Invalid signature' })
  let event: any
  try { event = JSON.parse(body) } catch { return reply(res, 400, { error: 'Invalid JSON' }) }
  if (typeof event?.id !== 'string' || !event.id.trim() || typeof event?.type !== 'string') return reply(res, 400, { error: 'Invalid Wave event envelope' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_SECRET_KEY')) return reply(res, 503, { error: 'Supabase server key non configurée.' })
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    const { data: existing } = await checked(admin.from('wave_events').select('id,processed_at').eq('id', event.id).maybeSingle())
    if (existing?.processed_at) return reply(res, 200, { received: true, event_id: event.id, duplicate: true })
    if (!existing) {
      // Store the minimum needed for troubleshooting, not a full customer payload.
      const storedEvent = { id: event.id, type: event.type, data: { id: event.data?.id || null, client_reference: event.data?.client_reference || null, payment_status: event.data?.payment_status || null, amount: event.data?.amount || null, currency: event.data?.currency || null, transaction_id: event.data?.transaction_id || null } }
      const inserted = await admin.from('wave_events').insert({ id: event.id, event_type: event.type, payload: storedEvent })
      if (inserted.error && inserted.error.code !== '23505') throw inserted.error
    }

    const retryLater = async (message: string) => {
      await admin.from('wave_events').update({ last_error: message.slice(0, 1000) }).eq('id', event.id)
      return reply(res, 503, { error: message, retryable: true })
    }
    const data = event.data || {}
    const isSuccess = event.type === 'checkout.session.completed' && data.payment_status === 'succeeded'
    const isFailure = event.type === 'checkout.session.payment_failed'
    if (!isSuccess && !isFailure) {
      await checked(admin.from('wave_events').update({ processed_at: new Date().toISOString(), last_error: null }).eq('id', event.id))
      return reply(res, 200, { received: true, ignored: true, event_id: event.id })
    }
    const amount = safeAmount(data.amount)
    if (!data.id || !amount || String(data.currency || '').toUpperCase() !== 'XOF' || (isSuccess && (typeof data.transaction_id !== 'string' || !data.transaction_id.trim()))) return await retryLater('Le checkout Wave ne contient pas un identifiant, un montant XOF, une devise ou une transaction valide.')

    const reference = String(data.client_reference || '')
    const resource = await loadResource(admin, data, reference)
    if (!resource) return await retryLater('Checkout Wave non rapproché avec une ressource École OS.')
    if (resource.checkoutId !== String(data.id)) {
      // A stale failure for a checkout superseded by a newer attempt must not block
      // delivery retries forever or mutate the currently linked checkout. A stale
      // success is not auto-ignored: it needs manual reconciliation to avoid hiding
      // a possible double payment.
      if (isFailure) {
        await checked(admin.from('wave_events').update({ processed_at: new Date().toISOString(), last_error: 'Ancien checkout échoué ignoré : la ressource utilise une autre session.' }).eq('id', event.id))
        return reply(res, 200, { received: true, ignored: 'stale_checkout_failure', event_id: event.id })
      }
      return await retryLater('Le checkout Wave reçu ne correspond pas au checkout enregistré sur la ressource; vérifier manuellement toute transaction réussie ancienne.')
    }
    if (!safeAmount(resource.expectedAmount) || resource.expectedAmount !== amount) return await retryLater('Le montant Wave ne correspond pas au montant attendu dans École OS.')

    const now = new Date().toISOString()
    if (isSuccess) {
      if (resource.kind === 'food') {
        if (resource.status !== 'paid') {
          const result = await checked(admin.from('food_orders').update({ status: 'paid', wave_transaction_id: data.transaction_id || null }).eq('id', resource.id).eq('status', 'pending').select('id').maybeSingle())
          if (!result.data?.id) {
            const { data: latest } = await checked(admin.from('food_orders').select('status,wave_checkout_id').eq('id', resource.id).maybeSingle())
            if (latest?.status !== 'paid' || latest?.wave_checkout_id !== data.id) return await retryLater('La commande cantine n’a pas pu être confirmée.')
          }
        }
      } else if (resource.kind === 'school_payment') {
        if (resource.status !== 'succeeded') {
          const result = await checked(admin.from('school_payments').update({ status: 'succeeded', wave_transaction_id: data.transaction_id || null }).eq('id', resource.id).eq('status', 'pending').select('id').maybeSingle())
          if (!result.data?.id) {
            const { data: latest } = await checked(admin.from('school_payments').select('status,wave_checkout_id').eq('id', resource.id).maybeSingle())
            if (latest?.status !== 'succeeded' || latest?.wave_checkout_id !== data.id) return await retryLater('Le paiement scolaire n’a pas pu être confirmé.')
          }
        }
      } else if (resource.kind === 'billing_cycle') {
        const wasPaid = ['paid', 'succeeded'].includes(resource.status)
        const { data: currentSub } = await checked(admin.from('school_subscriptions').select('id,referral_id,status').eq('school_id', resource.schoolId).order('created_at', { ascending: false }).limit(1).maybeSingle())
        if (!currentSub?.id) return await retryLater('Aucun abonnement associé à ce cycle de facturation.')
        if (!wasPaid) {
          const result = await checked(admin.from('billing_cycles').update({ status: 'paid', paid_at: now, updated_at: now }).eq('id', resource.id).in('status', ['due', 'past_due']).select('id').maybeSingle())
          if (!result.data?.id) {
            const { data: latestCycle } = await checked(admin.from('billing_cycles').select('status,provider_checkout_id').eq('id', resource.id).maybeSingle())
            if (latestCycle?.status !== 'paid' || latestCycle?.provider_checkout_id !== data.id) return await retryLater('Le cycle de facturation n’a pas pu être confirmé.')
          }
        }
        const subUpdate = await checked(admin.from('school_subscriptions').update({ status: 'active', current_period_end: resource.periodEnd, wave_transaction_id: data.transaction_id || null, updated_at: now }).eq('id', currentSub.id).select('id').maybeSingle())
        if (!subUpdate.data?.id) {
          const { data: latestSub } = await checked(admin.from('school_subscriptions').select('status,current_period_end').eq('id', currentSub.id).maybeSingle())
          if (latestSub?.status !== 'active' || String(latestSub?.current_period_end || '') !== String(resource.periodEnd || '')) return await retryLater('L’abonnement courant n’a pas pu être activé après le paiement du cycle.')
        }
        await rewardReferral(admin, currentSub.referral_id)
        if (!wasPaid) await checked(admin.from('autopilot_events').insert({ school_id: resource.schoolId, event_type: 'payment_received', severity: 'info', message: 'Cycle de facturation réglé via Wave.', metadata: { cycle_id: resource.id, amount_xof: amount } }))
      } else {
        const newEndDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        if (resource.status !== 'active') {
          const result = await checked(admin.from('school_subscriptions').update({ status: 'active', wave_transaction_id: data.transaction_id || null, current_period_end: newEndDate, updated_at: now }).eq('id', resource.id).eq('status', 'pending').select('id').maybeSingle())
          if (!result.data?.id) {
            const { data: latest } = await checked(admin.from('school_subscriptions').select('status,wave_checkout_id').eq('id', resource.id).maybeSingle())
            if (latest?.status !== 'active' || latest?.wave_checkout_id !== data.id) return await retryLater('L’abonnement scolaire n’a pas pu être confirmé.')
          }
        }
        await rewardReferral(admin, resource.referralId)
      }
    } else {
      // checkout.session.payment_failed describes this checkout attempt, not a terminal
      // business-resource state. Keep unpaid resources retryable. A later successful event
      // for this checkout is still accepted, and the user can request a new checkout after
      // this attempt is over. Never overwrite a success with a stale failure event.
      if (resource.kind === 'billing_cycle') {
        await checked(admin.from('autopilot_events').insert({
          school_id: resource.schoolId,
          event_type: 'payment_attempt_failed',
          severity: 'warning',
          message: 'Une tentative de paiement Wave a échoué; le cycle reste payable.',
          metadata: { cycle_id: resource.id, checkout_id: data.id, amount_xof: amount },
        }))
      }
    }

    await checked(admin.from('wave_events').update({ processed_at: new Date().toISOString(), last_error: null }).eq('id', event.id))
    return reply(res, 200, { received: true, event_id: event.id })
  } catch (error: any) {
    return reply(res, 500, { error: error?.message || 'Webhook processing error' })
  }
}

export default withSecurity('/api/wave/webhook', handler)
