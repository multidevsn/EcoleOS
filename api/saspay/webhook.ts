import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'
import { finalizeSasPayPayment, type SasPayResourceType } from '../../server/saspay-payments.js'

export const config = { api: { bodyParser: false } }
const API = 'https://api.saspay.me/api/v1'
type ResourceType = SasPayResourceType
const supported = new Set<ResourceType>(['food', 'school_payment', 'billing_cycle', 'school_subscription'])

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Uint8Array[] = []
  for await (const chunk of req as AsyncIterable<Uint8Array | string>) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk))
  const length = chunks.reduce((n, chunk) => n + chunk.byteLength, 0)
  const merged = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged)
}
function hex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
async function signatureValid(body: string, timestamp: string, signature: string, secret: string) {
  const ts = Number(timestamp)
  if (!/^\d{10}$/.test(timestamp) || !Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))
  return safeEqual(hex(new Uint8Array(digest)), signature)
}
const unwrap = (v: any) => v?.data && typeof v.data === 'object' ? v.data : v

async function locateResource(apiKey: string, data: any): Promise<{ type: ResourceType; id: string; checkoutId: string } | null> {
  const metadata = data?.metadata || data?.checkout_metadata || {}
  const directType = String(metadata.ecoleos_resource_type || metadata.resource_type || '') as ResourceType
  const directId = String(metadata.ecoleos_resource_id || metadata.resource_id || '')
  const directCheckout = String(data?.checkout_session_id || data?.checkout_id || data?.session_id || metadata.checkout_session_id || '')
  const directIsValid = supported.has(directType) && !!directId
  // Prefer an explicit session reference, but never apply a transaction using only
  // caller-controlled metadata when it cannot be tied to the session stored in our DB.
  if (directIsValid && directCheckout) return { type: directType, id: directId, checkoutId: directCheckout }
  if (!data?.id) return null

  // Events don't always carry checkout_session_id. Search recent sessions by the
  // provider transaction id, then use the session's server-side metadata.
  for (let page = 1; page <= 3; page++) {
    const response = await fetch(`${API}/checkout-sessions/?page=${page}&page_size=100`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(3500) })
    if (!response.ok) return null
    const body = await response.json().catch(() => ({}))
    const result = unwrap(body)
    const sessions = Array.isArray(result?.results) ? result.results : Array.isArray(result) ? result : []
    const found = sessions.find((session: any) => String(session?.transaction?.id || session?.transaction_id || '') === String(data.id))
    if (found) {
      const meta = found.metadata || {}
      const resourceType = String(meta.ecoleos_resource_type || '') as ResourceType
      const resourceId = String(meta.ecoleos_resource_id || '')
      if (!supported.has(resourceType) || !resourceId || !found.id) return null
      if (directIsValid && (directType !== resourceType || directId !== resourceId)) return null
      return { type: resourceType, id: resourceId, checkoutId: String(found.id) }
    }
    if (!result?.next || !sessions.length) break
  }
  return null
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const secret = env('SASPAY_WEBHOOK_SECRET')
  if (!env('SASPAY_API_KEY')) return res.status(503).json({ error: 'SASPAY_API_KEY non configurée.' })
  if (!secret) return res.status(503).json({ error: 'SASPAY_WEBHOOK_SECRET non configuré.' })
  const raw = await readRawBody(req)
  const signature = String(req.headers['x-webhook-signature'] || '')
  const timestamp = String(req.headers['x-webhook-timestamp'] || '')
  if (!(await signatureValid(raw, timestamp, signature, secret))) return res.status(401).json({ error: 'Invalid SasPay webhook signature.' })
  let event: any
  try { event = JSON.parse(raw) } catch { return res.status(400).json({ error: 'Invalid JSON.' }) }
  const eventType = String(event?.event || req.headers['x-webhook-event'] || '')
  if (req.headers['x-webhook-event'] && String(req.headers['x-webhook-event']) !== eventType) return res.status(400).json({ error: 'Event header/body mismatch.' })
  if (!['transaction.success', 'transaction.failed', 'transaction.cancelled', 'transaction.created', 'webhook.test'].includes(eventType)) return res.status(200).json({ received: true, ignored: true, event: eventType })
  if (!env('SUPABASE_URL') || !env('SUPABASE_SECRET_KEY')) return res.status(503).json({ error: 'Supabase server key not configured.' })
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const data = event?.data || {}
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${eventType}:${data.id || 'none'}:${data.status || ''}`))
    const eventId = hex(new Uint8Array(digest))
    const { data: prior, error: priorError } = await admin.from('saspay_events').select('id,processed_at').eq('id', eventId).maybeSingle()
    if (priorError) throw priorError
    if (prior?.processed_at) return res.status(200).json({ received: true, duplicate: true })
    if (!prior) {
      // Minimisation des données : ne pas conserver le numéro mobile (msisdn) ni un payload
      // complet contenant des données personnelles dont le rapprochement n'a pas besoin.
      const auditPayload = {
        event: eventType,
        data: {
          id: data?.id || null,
          reference: data?.reference || null,
          type: data?.type || null,
          status: data?.status || null,
          amount: data?.amount || null,
          currency: data?.currency || null,
          country: data?.country || null,
          network: data?.network || null,
        },
      }
      const { error } = await admin.from('saspay_events').insert({ id: eventId, event_type: eventType, payload: auditPayload })
      if (error && !String(error.code || '').includes('23505')) throw error
    }
    const retryLater = async (message: string) => {
      await admin.from('saspay_events').update({ last_error: message.slice(0, 1000) }).eq('id', eventId)
      return res.status(503).json({ error: message, retryable: true })
    }
    if (eventType === 'transaction.success' || eventType === 'transaction.failed' || eventType === 'transaction.cancelled') {
      const located = await locateResource(env('SASPAY_API_KEY'), data)
      // Ne jamais acquitter une transaction finale inconnue : elle pourrait être un vrai paiement
      // EcoleOS dont le rapprochement a échoué ou a dépassé la fenêtre de recherche.
      if (!located) return await retryLater('Transaction SasPay non rapprochée avec une ressource EcoleOS.')
      const sessionId = String(located.checkoutId || data?.checkout_session_id || data?.checkout_id || data?.session_id || '')
      if (!sessionId) return await retryLater('Référence de session SasPay absente.')
      const sessionResponse = await fetch(`${API}/checkout-sessions/${encodeURIComponent(sessionId)}/`, { headers: { Authorization: `Bearer ${env('SASPAY_API_KEY')}` }, signal: AbortSignal.timeout(4000) })
      if (!sessionResponse.ok) return await retryLater(`Lecture de la session SasPay impossible (HTTP ${sessionResponse.status}).`)
      const session = unwrap(await sessionResponse.json().catch(() => ({})))
      const sessionMetadata = session?.metadata || {}
      const resourceType = located.type
      const resourceId = located.id
      const sessionTransactionId = String(session?.transaction?.id || session?.transaction_id || '')
      // La session, récupérée côté serveur, doit confirmer le rattachement et la transaction.
      const metadataAgrees = !!session && String(session.id || '') === sessionId &&
        String(sessionMetadata.ecoleos_resource_type || '') === resourceType &&
        String(sessionMetadata.ecoleos_resource_id || '') === resourceId &&
        !!data?.id && !!sessionTransactionId && sessionTransactionId === String(data.id)
      if (!metadataAgrees || !supported.has(resourceType) || !resourceId) {
        return await retryLater('La session SasPay ne correspond pas à la transaction et aux métadonnées EcoleOS.')
      }
      const eventTransactionStatus = String(data.status || '').toUpperCase()
      const sessionStatus = String(session.status || '').toUpperCase()
      const providerTransactionStatus = String(session.transaction?.status || '').toUpperCase()
      if (eventType === 'transaction.success' && eventTransactionStatus !== 'SUCCESS') {
        return await retryLater('Événement succès SasPay sans statut de transaction SUCCESS.')
      }
      if (eventType === 'transaction.success' && (sessionStatus !== 'PAID' || providerTransactionStatus !== 'SUCCESS')) {
        return await retryLater('Statut de la session SasPay pas encore cohérent avec le succès.')
      }
      // Ignorer un événement d'échec arrivé en retard si la source de vérité confirme déjà le succès.
      if (eventType !== 'transaction.success' && sessionStatus === 'PAID' && providerTransactionStatus === 'SUCCESS') {
        const { error: processedError } = await admin.from('saspay_events').update({ processed_at: new Date().toISOString(), last_error: 'Événement d’échec ancien ignoré : session déjà payée.' }).eq('id', eventId)
        if (processedError) throw processedError
        return res.status(200).json({ received: true, ignored: 'stale_failure_after_success' })
      }
      if (eventType !== 'transaction.success' && !['FAILED', 'CANCELLED', 'EXPIRED'].includes(sessionStatus) && !['FAILED', 'CANCELLED', 'EXPIRED'].includes(providerTransactionStatus)) {
        return await retryLater('Événement d’échec avant état final confirmé par SasPay.')
      }
      const outcome = eventType === 'transaction.success' ? 'success' : 'failed'
      const result = await finalizeSasPayPayment(admin, resourceType, resourceId, outcome, {
        id: sessionTransactionId, status: providerTransactionStatus || eventTransactionStatus,
        amount: data.amount ?? session?.amount, currency: data.currency ?? session?.currency,
        type: data.type || session?.transaction?.type, metadata: sessionMetadata, checkoutSessionId: sessionId,
      })
      if (!result.applied && result.reason === 'checkout_mismatch' && outcome === 'failed') {
        // Failure from an older, superseded session is safe to record as stale; it must
        // not poison provider retries or change the currently-linked resource. A stale
        // success remains unacknowledged for manual reconciliation.
        const { error: staleProcessedError } = await admin.from('saspay_events').update({ processed_at: new Date().toISOString(), last_error: 'Ancienne session SasPay échouée ignorée : la ressource référence un autre checkout.' }).eq('id', eventId)
        if (staleProcessedError) throw staleProcessedError
        return res.status(200).json({ received: true, ignored: 'stale_checkout_failure' })
      }
      if (!result.applied && result.reason !== 'already_final') {
        return await retryLater(`Paiement SasPay non appliqué : ${result.reason || 'état inchangé sans motif'}.`)
      }
    }
    const { error: processedError } = await admin.from('saspay_events').update({ processed_at: new Date().toISOString(), last_error: null }).eq('id', eventId)
    if (processedError) throw processedError
    return res.status(200).json({ received: true, event: eventType })
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Webhook processing error.' })
  }
}
export default withSecurity('/api/saspay/webhook', handler)
