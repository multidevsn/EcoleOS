import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'

const API = 'https://api.saspay.me/api/v1'
type Table = 'food_orders' | 'school_payments' | 'school_subscriptions' | 'billing_cycles'
const reply = (res: VercelResponse, status: number, body: unknown) => res.status(status).json(body)
const unwrap = (v: any) => v?.data && typeof v.data === 'object' ? v.data : v
async function cleanupFoodOrder(admin: any, orderId: string, userId: string) {
  await admin.from('food_order_items').delete().eq('order_id', orderId)
  await admin.from('food_orders').delete().eq('id', orderId).eq('user_id', userId).eq('status', 'pending')
}

async function reusableCheckout(apiKey: string, id: string, url: string) {
  // Never return a URL read from the database without revalidating the provider origin.
  let safeUrl: URL
  try { safeUrl = new URL(url) } catch { return null }
  if (safeUrl.protocol !== 'https:' || safeUrl.hostname !== 'pay.saspay.me' || safeUrl.username || safeUrl.password || safeUrl.port) return null
  try {
    const response = await fetch(`${API}/checkout-sessions/${encodeURIComponent(id)}/status/`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(4000) })
    if (!response.ok) return { checkout_url: safeUrl.toString(), checkout_id: id, reused: true }
    const body = await response.json().catch(() => ({}))
    const status = String(unwrap(body)?.status || '').toUpperCase()
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status)) return null
    return { checkout_url: safeUrl.toString(), checkout_id: id, reused: true }
  } catch {
    // Do not create an extra payable checkout because of a transient SasPay outage.
    return { checkout_url: safeUrl.toString(), checkout_id: id, reused: true }
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Méthode non autorisée.' })
  const apiKey = env('SASPAY_API_KEY')
  if (!apiKey) return reply(res, 503, { error: 'SasPay non configuré : ajoute SASPAY_API_KEY dans Vercel.' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_PUBLISHABLE_KEY') || !env('SUPABASE_SECRET_KEY')) return reply(res, 503, { error: 'Supabase serveur non configuré.' })
  const configuredAppUrl = env('APP_URL').trim()
  if (!configuredAppUrl) return reply(res, 503, { error: 'APP_URL doit être configurée avec l’URL HTTPS canonique du site.' })
  let appUrl: URL
  try { appUrl = new URL(configuredAppUrl) } catch { return reply(res, 503, { error: 'APP_URL est invalide.' }) }
  if (appUrl.protocol !== 'https:' || appUrl.username || appUrl.password || appUrl.search || appUrl.hash || ['localhost', '127.0.0.1', '::1'].includes(appUrl.hostname)) {
    return reply(res, 503, { error: 'APP_URL doit être une URL HTTPS publique, sans identifiants, paramètres ni fragment.' })
  }
  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return reply(res, 401, { error: 'Authentification requise.' })
  let pendingFoodOrderId = ''
  let pendingFoodUserId = ''
  let adminForCleanup: any = null
  try {
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    adminForCleanup = admin
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return reply(res, 401, { error: 'Session invalide ou expirée.' })
    if (!user.email) return reply(res, 400, { error: 'Un email est nécessaire pour créer un paiement SasPay.' })
    const type = String(req.body?.type || '')
    const { data: profile, error: profileError } = await admin.from('profiles').select('full_name,role,school_id').eq('id', user.id).maybeSingle()
    if (profileError) throw profileError
    const customerName = String(profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0] || 'Client').trim()
    let amount = 0, description = 'Paiement École OS', resourceId = '', table: Table

    if (type === 'food') {
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
      const items = rawItems.map((x: any) => ({ id: String(x?.id || ''), quantity: Number(x?.quantity) }))
      if (!items.length || items.some((x: any) => !x.id || !Number.isSafeInteger(x.quantity) || x.quantity < 1 || x.quantity > 99)) return reply(res, 400, { error: 'Panier vide ou quantités invalides (1 à 99 par article).' })
      const ids = [...new Set(items.map((x: any) => x.id))]
      const { data: foods, error } = await userClient.from('food_items').select('id,name,price_xof,active').in('id', ids).eq('active', true)
      if (error) throw error
      const byId = Object.fromEntries((foods || []).map((x: any) => [x.id, x]))
      const orderItems: any[] = []
      for (const item of items) {
        const food = byId[item.id]
        if (!food) return reply(res, 400, { error: `Article Food invalide : ${item.id}` })
        amount += Number(food.price_xof) * item.quantity
        orderItems.push({ food_item_id: item.id, quantity: item.quantity, unit_price_xof: Number(food.price_xof) })
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) return reply(res, 400, { error: 'Montant de commande invalide.' })
      const { data: order, error: orderError } = await admin.from('food_orders').insert({ user_id: user.id, total_xof: amount, status: 'pending', pickup_date: req.body?.pickup_date || null, pickup_slot: req.body?.pickup_slot || null }).select('id').single()
      if (orderError) throw orderError
      resourceId = order.id; table = 'food_orders'; description = `Commande cantine ${order.id}`; pendingFoodOrderId = order.id; pendingFoodUserId = user.id
      const { error: itemError } = await admin.from('food_order_items').insert(orderItems.map(x => ({ ...x, order_id: order.id })))
      if (itemError) {
        await admin.from('food_orders').delete().eq('id', order.id).eq('user_id', user.id).eq('status', 'pending')
        throw itemError
      }
    } else if (type === 'school_payment') {
      const id = String(req.body?.payment_id || '')
      const { data: payment, error } = await userClient.from('school_payments').select('id,user_id,description,amount_xof,status,saspay_checkout_id,saspay_checkout_url').eq('id', id).eq('status', 'pending').maybeSingle()
      if (error || !payment || payment.user_id !== user.id) return reply(res, 403, { error: 'Paiement introuvable ou déjà traité.' })
      if (payment.saspay_checkout_id && payment.saspay_checkout_url) { const reuse = await reusableCheckout(apiKey, payment.saspay_checkout_id, payment.saspay_checkout_url); if (reuse) return reply(res, 200, reuse) }
      amount = Number(payment.amount_xof); description = String(payment.description || 'Frais scolaires'); resourceId = payment.id; table = 'school_payments'
    } else if (type === 'billing_cycle') {
      if (profile?.role !== 'director' || !profile.school_id) return reply(res, 403, { error: 'Seul le directeur peut régler le cycle de facturation.' })
      const id = String(req.body?.billing_cycle_id || '')
      const { data: cycle, error } = await admin.from('billing_cycles').select('id,school_id,amount_xof,status,saspay_checkout_id,saspay_checkout_url').eq('id', id).eq('school_id', profile.school_id).in('status', ['due', 'past_due']).maybeSingle()
      if (error || !cycle) return reply(res, 403, { error: 'Cycle introuvable ou déjà réglé.' })
      if (cycle.saspay_checkout_id && cycle.saspay_checkout_url) { const reuse = await reusableCheckout(apiKey, cycle.saspay_checkout_id, cycle.saspay_checkout_url); if (reuse) return reply(res, 200, reuse) }
      const { data: sub, error: subError } = await admin.from('school_subscriptions').select('billing_provider,billing_price_xof').eq('school_id', profile.school_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (subError) throw subError
      amount = Math.max(0, Number(cycle.amount_xof) - (sub?.billing_provider === 'paddle' ? Number(sub.billing_price_xof || 0) : 0))
      if (amount <= 0) return reply(res, 400, { error: 'Aucun frais d’usage à payer sur ce cycle.' })
      resourceId = cycle.id; table = 'billing_cycles'; description = `Cycle de facturation École OS ${cycle.id}`
    } else if (type === 'school_subscription') {
      if (profile?.role !== 'director' || !profile.school_id) return reply(res, 403, { error: 'Seul le directeur peut payer cet abonnement.' })
      const id = String(req.body?.subscription_id || '')
      const { data: sub, error } = await admin.from('school_subscriptions').select('id,school_id,plan,billing_price_xof,status,saspay_checkout_id,saspay_checkout_url').eq('id', id).eq('school_id', profile.school_id).eq('status', 'pending').maybeSingle()
      if (error || !sub) return reply(res, 403, { error: 'Abonnement introuvable ou déjà payé.' })
      if (sub.saspay_checkout_id && sub.saspay_checkout_url) { const reuse = await reusableCheckout(apiKey, sub.saspay_checkout_id, sub.saspay_checkout_url); if (reuse) return reply(res, 200, reuse) }
      amount = Number(sub.billing_price_xof); resourceId = sub.id; table = 'school_subscriptions'; description = `Abonnement École OS ${sub.plan}`
    } else return reply(res, 400, { error: 'Type de paiement inconnu.' })

    if (!Number.isFinite(amount) || amount <= 0) return reply(res, 400, { error: 'Montant invalide.' })
    // Ne jamais construire l'URL de retour depuis l'en-tête Host fourni par le client.
    const returnUrl = new URL('/', appUrl.origin)
    returnUrl.searchParams.set('payment', 'saspay-return'); returnUrl.searchParams.set('type', type); returnUrl.searchParams.set('resource_id', resourceId)
    const apiRes = await fetch(`${API}/checkout-sessions/`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ amount: amount.toFixed(2), currency: 'XOF', description, country: env('SASPAY_COUNTRY_CODE') || 'SN', customer_email: user.email, customer_name: customerName, return_url: returnUrl.toString(), metadata: { ecoleos_resource_type: type, ecoleos_resource_id: resourceId, ecoleos_source: 'ecoleos' } }) })
    const body = await apiRes.json().catch(() => ({})); const checkout = unwrap(body)
    if (!apiRes.ok) { if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' } return reply(res, apiRes.status, { error: body?.message || body?.error || `SasPay checkout refusé (HTTP ${apiRes.status}).`, code: body?.code }) }
    if (typeof checkout?.id !== 'string' || !checkout.id.trim() || typeof checkout?.checkout_url !== 'string' || checkout.currency !== 'XOF' || !Number.isSafeInteger(Number(checkout.amount)) || Math.abs(Number(checkout.amount) - amount) > 0.001) {
      if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' }
      return reply(res, 502, { error: 'Réponse SasPay incomplète ou montant/devise inattendus.' })
    }
    let checkoutUrl: URL
    try { checkoutUrl = new URL(checkout.checkout_url) } catch { if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' } return reply(res, 502, { error: 'URL de paiement SasPay invalide.' }) }
    if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'pay.saspay.me' || checkoutUrl.username || checkoutUrl.password || checkoutUrl.port) {
      if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' }
      return reply(res, 502, { error: 'SasPay a retourné un domaine de paiement non approuvé.' })
    }
    const now = new Date().toISOString()
    let update: any
    if (table === 'food_orders') update = await admin.from('food_orders').update({ saspay_checkout_id: checkout.id, saspay_checkout_url: checkoutUrl.toString(), saspay_amount_xof: amount }).eq('id', resourceId).eq('user_id', user.id).eq('status', 'pending').select('id').maybeSingle()
    else if (table === 'school_payments') update = await admin.from('school_payments').update({ saspay_checkout_id: checkout.id, saspay_checkout_url: checkoutUrl.toString(), saspay_amount_xof: amount }).eq('id', resourceId).eq('user_id', user.id).eq('status', 'pending').select('id').maybeSingle()
    else if (table === 'billing_cycles') update = await admin.from('billing_cycles').update({ saspay_checkout_id: checkout.id, saspay_checkout_url: checkoutUrl.toString(), saspay_amount_xof: amount, provider: 'saspay_checkout', provider_checkout_id: checkout.id, provider_checkout_url: checkoutUrl.toString(), updated_at: now }).eq('id', resourceId).eq('school_id', profile?.school_id).in('status', ['due', 'past_due']).select('id').maybeSingle()
    else update = await admin.from('school_subscriptions').update({ saspay_checkout_id: checkout.id, saspay_checkout_url: checkoutUrl.toString(), saspay_amount_xof: amount, updated_at: now }).eq('id', resourceId).eq('school_id', profile?.school_id).eq('status', 'pending').select('id').maybeSingle()
    if (update.error) { if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' } throw update.error }
    if (!update.data?.id) { if (table === 'food_orders') { await cleanupFoodOrder(admin, resourceId, user.id); pendingFoodOrderId = '' } return reply(res, 409, { error: 'La ressource a changé pendant la création du checkout. Aucun lien de paiement n’a été remis.' }) }
    pendingFoodOrderId = ''
    return reply(res, 200, { checkout_url: checkoutUrl.toString(), checkout_id: checkout.id })
  } catch (error: any) { if (adminForCleanup && pendingFoodOrderId && pendingFoodUserId) await cleanupFoodOrder(adminForCleanup, pendingFoodOrderId, pendingFoodUserId).catch(() => {}); return reply(res, 500, { error: error?.message || 'Impossible de créer le paiement SasPay.' }) }
}
export default withSecurity('/api/saspay/checkout', handler)
