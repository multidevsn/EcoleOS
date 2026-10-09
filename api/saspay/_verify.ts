import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'
import { finalizeSasPayPayment, type SasPayResourceType } from '../../server/saspay-payments.js'

const API = 'https://api.saspay.me/api/v1'
const reply = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)
const unwrap = (v: any) => v?.data && typeof v.data === 'object' ? v.data : v
const allowed = new Set<SasPayResourceType>(['food', 'school_payment', 'billing_cycle', 'school_subscription'])

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Méthode non autorisée.' })
  if (!env('SASPAY_API_KEY')) return reply(res, 503, { error: 'SASPAY_API_KEY n’est pas configurée.' })
  const token = String(req.headers.authorization || '').startsWith('Bearer ') ? String(req.headers.authorization).slice(7) : ''
  if (!token) return reply(res, 401, { error: 'Authentification requise.' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_PUBLISHABLE_KEY') || !env('SUPABASE_SECRET_KEY')) return reply(res, 503, { error: 'Supabase serveur non configuré.' })
  try {
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return reply(res, 401, { error: 'Session invalide ou expirée.' })
    const type = String(req.body?.type || '') as SasPayResourceType
    const resourceId = String(req.body?.resource_id || '')
    if (!allowed.has(type) || !resourceId) return reply(res, 400, { error: 'Type ou référence de paiement invalide.' })

    let checkoutId = ''
    if (type === 'food') {
      const { data, error } = await admin.from('food_orders').select('saspay_checkout_id').eq('id', resourceId).eq('user_id', user.id).maybeSingle()
      if (error) throw error; checkoutId = String(data?.saspay_checkout_id || '')
    } else if (type === 'school_payment') {
      const { data, error } = await admin.from('school_payments').select('saspay_checkout_id').eq('id', resourceId).eq('user_id', user.id).maybeSingle()
      if (error) throw error; checkoutId = String(data?.saspay_checkout_id || '')
    } else {
      const { data: profile, error: profileError } = await admin.from('profiles').select('role,school_id').eq('id', user.id).maybeSingle()
      if (profileError) throw profileError
      if (profile?.role !== 'director' || !profile.school_id) return reply(res, 403, { error: 'Réservé au directeur de l’école.' })
      if (type === 'billing_cycle') {
        const { data, error } = await admin.from('billing_cycles').select('saspay_checkout_id').eq('id', resourceId).eq('school_id', profile.school_id).maybeSingle()
        if (error) throw error; checkoutId = String(data?.saspay_checkout_id || '')
      } else {
        const { data, error } = await admin.from('school_subscriptions').select('saspay_checkout_id').eq('id', resourceId).eq('school_id', profile.school_id).maybeSingle()
        if (error) throw error; checkoutId = String(data?.saspay_checkout_id || '')
      }
    }
    if (!checkoutId) return reply(res, 404, { error: 'Session SasPay associée introuvable.' })
    const headers = { Authorization: `Bearer ${env('SASPAY_API_KEY')}` }
    const [statusRes, detailRes] = await Promise.all([
      fetch(`${API}/checkout-sessions/${encodeURIComponent(checkoutId)}/status/`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`${API}/checkout-sessions/${encodeURIComponent(checkoutId)}/`, { headers, signal: AbortSignal.timeout(5000) }),
    ])
    const [statusBody, detailBody] = await Promise.all([statusRes.json().catch(() => ({})), detailRes.json().catch(() => ({}))])
    if (!statusRes.ok || !detailRes.ok) return reply(res, 502, { error: 'SasPay n’a pas pu confirmer le statut du paiement.' })
    const status = unwrap(statusBody)
    const detail = unwrap(detailBody)
    const sessionStatus = String(status?.status || detail?.status || 'UNKNOWN').toUpperCase()
    const transactionStatus = String(status?.transaction_status || detail?.transaction?.status || '').toUpperCase()
    if (String(detail?.id || checkoutId) !== checkoutId || String(detail?.currency || '').toUpperCase() !== 'XOF') return reply(res, 409, { error: 'La session retournée par SasPay ne correspond pas à la devise ou à la référence attendue.' })
    const txn = detail?.transaction || {}
    if (sessionStatus !== 'PAID' || transactionStatus !== 'SUCCESS') {
      const failed = ['FAILED', 'CANCELLED', 'EXPIRED'].includes(sessionStatus) || ['FAILED', 'CANCELLED', 'EXPIRED'].includes(transactionStatus)
      if (failed) {
        await finalizeSasPayPayment(admin, type, resourceId, 'failed', { id: String(status?.transaction_id || txn?.id || '') || undefined, status: transactionStatus || sessionStatus, amount: detail?.amount, currency: detail?.currency, type: String(txn?.type || 'PAYIN'), checkoutSessionId: checkoutId })
      }
      return reply(res, 200, { confirmed: false, pending: !failed, status: sessionStatus, message: failed ? 'Le paiement SasPay a échoué ou a été annulé.' : 'SasPay n’a pas encore confirmé un paiement réussi.' })
    }
    const result = await finalizeSasPayPayment(admin, type, resourceId, 'success', {
      id: String(status?.transaction_id || txn?.id || '').trim() || undefined,
      status: 'SUCCESS', amount: detail?.amount, currency: detail?.currency,
      type: String(txn?.type || ''), metadata: detail?.metadata || null, checkoutSessionId: checkoutId,
    })
    if (!result.applied && result.reason !== 'already_final') {
      return reply(res, 409, { error: 'Paiement vérifié, mais la mise à jour a été bloquée par un contrôle de cohérence.', reason: result.reason })
    }
    return reply(res, 200, { confirmed: true, applied: !!result.applied, status: result.status || 'PAID', message: result.applied ? 'Paiement confirmé par SasPay.' : 'Paiement déjà enregistré.' })
  } catch (error: any) {
    return reply(res, 500, { error: error?.message || 'Impossible de vérifier le paiement SasPay.' })
  }
}
export default withSecurity('/api/saspay/verify', handler)
