import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
import { finalizeSasPayPayment, type SasPayResourceType } from '../../server/saspay-payments.js'

const reply = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)

/**
 * POST /api/saspay/sandbox/approve
 *
 * Confirme un paiement créé en mode sandbox (aucune SASPAY_API_KEY configurée) :
 * le parent voit le parcours complet (push -> validation -> reçu) et la ressource
 * est réellement marquée payée dans Supabase via finalizeSasPayPayment, comme le
 * ferait le webhook SasPay. Dès que la clé API réelle existe, cette route est
 * désactivée : le prestataire redevient la seule source de vérité.
 */
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Méthode non autorisée.' })
  if (env('SASPAY_API_KEY')) return reply(res, 409, { error: 'SasPay réel configuré : la sandbox est désactivée.' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_PUBLISHABLE_KEY') || !env('SUPABASE_SECRET_KEY')) {
    return reply(res, 503, { error: 'Supabase serveur non configuré.' })
  }

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return reply(res, 401, { error: 'Authentification requise.' })

  const type = String(req.body?.type || '') as SasPayResourceType
  const resourceId = String(req.body?.resource_id || '')
  const checkoutId = String(req.body?.checkout_id || '')
  const amount = Number(req.body?.amount_xof)
  if (!['food', 'school_payment', 'billing_cycle', 'school_subscription'].includes(type) || !resourceId || !checkoutId.startsWith('sbx_')) {
    return reply(res, 400, { error: 'Référence sandbox invalide.' })
  }

  try {
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return reply(res, 401, { error: 'Session invalide ou expirée.' })

    // Le demandeur doit être propriétaire de la ressource (ou directeur de l'école).
    if (type === 'food' || type === 'school_payment') {
      const table = type === 'food' ? 'food_orders' : 'school_payments'
      const { data, error } = await admin.from(table).select('user_id').eq('id', resourceId).maybeSingle()
      if (error) throw error
      if (!data || data.user_id !== user.id) return reply(res, 403, { error: 'Ressource rattachée à un autre compte.' })
    } else {
      const { data: profile } = await admin.from('profiles').select('role,school_id').eq('id', user.id).maybeSingle()
      const table = type === 'billing_cycle' ? 'billing_cycles' : 'school_subscriptions'
      const { data, error } = await admin.from(table).select('school_id').eq('id', resourceId).maybeSingle()
      if (error) throw error
      if (profile?.role !== 'director' || !profile.school_id || data?.school_id !== profile.school_id) {
        return reply(res, 403, { error: "Seul le directeur de l'établissement peut confirmer ce paiement." })
      }
    }

    const result: any = await finalizeSasPayPayment(admin, type, resourceId, 'success', {
      id: `tx_${checkoutId.slice(4)}`,
      status: 'SUCCESS',
      amount,
      currency: 'XOF',
      type: 'PAYIN',
      checkoutSessionId: checkoutId,
    })
    if (!result?.applied) return reply(res, 409, { error: `Confirmation sandbox refusée : ${result?.reason || 'état incohérent'}.` })
    return reply(res, 200, { approved: true, type, resource_id: resourceId })
  } catch (error: any) {
    return reply(res, 500, { error: error?.message || 'Confirmation sandbox impossible.' })
  }
}

export default withSecurity('/api/saspay/sandbox/approve', handler)
