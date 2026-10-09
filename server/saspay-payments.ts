import type { SupabaseClient } from '@supabase/supabase-js'

export type SasPayResourceType = 'food' | 'school_payment' | 'billing_cycle' | 'school_subscription'
export type SasPayOutcome = 'success' | 'failed'

type SasPayTransaction = {
  id?: string
  status?: string
  amount?: string | number
  currency?: string
  type?: string
  metadata?: Record<string, unknown> | null
  checkoutSessionId?: string
}

function amountMatches(value: unknown, expected: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && Math.abs(parsed - expected) < 0.011
}

async function rewardReferral(admin: SupabaseClient, referralId: string | null | undefined) {
  if (!referralId) return
  await admin.from('referrals').update({ status: 'qualified', qualified_at: new Date().toISOString() })
    .eq('id', referralId).eq('status', 'pending')
  const { data: referral } = await admin.from('referrals').select('id,referrer_id').eq('id', referralId).maybeSingle()
  if (!referral) return
  const { data: profile } = await admin.from('profiles').select('school_id').eq('id', referral.referrer_id).maybeSingle()
  const { data: simplePlan } = await admin.from('subscription_plans').select('price_xof').eq('id', 'simple').maybeSingle()
  if (profile?.school_id && simplePlan) {
    await admin.from('school_subscriptions')
      .update({ plan: 'extra', billing_price_xof: Number(simplePlan.price_xof), updated_at: new Date().toISOString() })
      .eq('school_id', profile.school_id).eq('status', 'active')
    await admin.from('referrals').update({ status: 'rewarded', rewarded_at: new Date().toISOString() }).eq('id', referral.id)
  }
}

/** Applies a SasPay result only to an existing resource with a recorded SasPay checkout. */
export async function finalizeSasPayPayment(
  admin: SupabaseClient,
  resourceType: SasPayResourceType,
  resourceId: string,
  outcome: SasPayOutcome,
  transaction: SasPayTransaction = {},
) {
  const now = new Date().toISOString()
  const transactionId = String(transaction.id || '').trim() || null
  let row: any = null
  let expectedAmount = 0

  if (resourceType === 'food') {
    const result = await admin.from('food_orders')
      .select('id,total_xof,status,saspay_checkout_id,saspay_amount_xof,user_id')
      .eq('id', resourceId).maybeSingle()
    if (result.error) throw result.error
    row = result.data
    expectedAmount = Number(row?.saspay_amount_xof ?? row?.total_xof ?? 0)
  } else if (resourceType === 'school_payment') {
    const result = await admin.from('school_payments')
      .select('id,amount_xof,status,saspay_checkout_id,saspay_amount_xof,user_id')
      .eq('id', resourceId).maybeSingle()
    if (result.error) throw result.error
    row = result.data
    expectedAmount = Number(row?.saspay_amount_xof ?? row?.amount_xof ?? 0)
  } else if (resourceType === 'school_subscription') {
    const result = await admin.from('school_subscriptions')
      .select('id,school_id,billing_price_xof,status,saspay_checkout_id,saspay_amount_xof,referral_id')
      .eq('id', resourceId).maybeSingle()
    if (result.error) throw result.error
    row = result.data
    expectedAmount = Number(row?.saspay_amount_xof ?? row?.billing_price_xof ?? 0)
  } else {
    const result = await admin.from('billing_cycles')
      .select('id,school_id,amount_xof,status,saspay_checkout_id,saspay_amount_xof,period_end')
      .eq('id', resourceId).maybeSingle()
    if (result.error) throw result.error
    row = result.data
    expectedAmount = Number(row?.saspay_amount_xof ?? row?.amount_xof ?? 0)
    if (row?.saspay_amount_xof == null && row?.school_id) {
      const { data: subscription, error } = await admin.from('school_subscriptions')
        .select('billing_provider,billing_price_xof')
        .eq('school_id', row.school_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      if (subscription?.billing_provider === 'paddle') {
        expectedAmount = Math.max(0, expectedAmount - Number(subscription.billing_price_xof || 0))
      }
    }
  }

  if (!row || !row.saspay_checkout_id) return { applied: false, reason: 'checkout_not_linked' }
  if (!transaction.checkoutSessionId) return { applied: false, reason: 'checkout_reference_missing' }
  if (String(row.saspay_checkout_id) !== transaction.checkoutSessionId) return { applied: false, reason: 'checkout_mismatch' }
  if (transaction.currency && String(transaction.currency).toUpperCase() !== 'XOF') return { applied: false, reason: 'currency_mismatch' }
  if (transaction.amount !== undefined && !amountMatches(transaction.amount, expectedAmount)) {
    return { applied: false, reason: 'amount_mismatch' }
  }
  if (transaction.type && !['PAYIN', 'PAIEMENT'].includes(String(transaction.type).toUpperCase())) {
    return { applied: false, reason: 'not_a_payin' }
  }
  // Une confirmation positive doit contenir tous les attributs financiers essentiels :
  // pas de paiement comptabilisé si montant, devise, transaction ou statut manquent.
  if (outcome === 'success') {
    if (!transactionId) return { applied: false, reason: 'transaction_id_missing' }
    if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0 || transaction.amount === undefined || !amountMatches(transaction.amount, expectedAmount)) {
      return { applied: false, reason: 'amount_mismatch' }
    }
    if (String(transaction.currency || '').toUpperCase() !== 'XOF') return { applied: false, reason: 'currency_mismatch' }
    if (!['PAYIN', 'PAIEMENT'].includes(String(transaction.type || '').toUpperCase())) return { applied: false, reason: 'not_a_payin' }
    if (String(transaction.status || '').toUpperCase() !== 'SUCCESS') return { applied: false, reason: 'transaction_not_successful' }
  }

  const isAlreadyFinal = resourceType === 'food'
    ? ['paid', 'preparing', 'ready', 'completed', 'cancelled'].includes(row.status)
    : resourceType === 'school_payment'
      ? ['succeeded', 'failed', 'expired'].includes(row.status)
      : resourceType === 'school_subscription'
        ? ['active', 'cancelled'].includes(row.status)
        : ['paid', 'cancelled'].includes(row.status)
  if (resourceType === 'billing_cycle' && outcome === 'success' && row.status === 'paid' && row.school_id) {
    // Reprise idempotente : la première requête peut avoir marqué le cycle payé puis échoué
    // avant de réactiver l'abonnement. Ne laisser qu'un seul abonnement (le plus récent) actif.
    const { data: latest, error: latestError } = await admin.from('school_subscriptions')
      .select('id,referral_id').eq('school_id', row.school_id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (latestError) throw latestError
    if (!latest) return { applied: false, reason: 'subscription_not_found_after_paid_cycle', status: row.status }
    const { error: repairError } = await admin.from('school_subscriptions').update({
      status: 'active', current_period_end: row.period_end, saspay_transaction_id: transactionId, updated_at: now,
    }).eq('id', latest.id)
    if (repairError) throw repairError
    return { applied: false, reason: 'already_final', status: row.status }
  }
  if (isAlreadyFinal) return { applied: false, reason: 'already_final', status: row.status }

  if (outcome === 'success') {
    if (resourceType === 'food') {
      const { data, error } = await admin.from('food_orders').update({ status: 'paid', saspay_transaction_id: transactionId })
        .eq('id', resourceId).eq('saspay_checkout_id', row.saspay_checkout_id).eq('status', 'pending').select('id').maybeSingle()
      if (error) throw error
      return { applied: !!data, status: data ? 'paid' : row.status }
    }
    if (resourceType === 'school_payment') {
      const { data, error } = await admin.from('school_payments').update({ status: 'succeeded', saspay_transaction_id: transactionId })
        .eq('id', resourceId).eq('saspay_checkout_id', row.saspay_checkout_id).eq('status', 'pending').select('id').maybeSingle()
      if (error) throw error
      return { applied: !!data, status: data ? 'succeeded' : row.status }
    }
    if (resourceType === 'billing_cycle') {
      const { data, error } = await admin.from('billing_cycles').update({
        status: 'paid', paid_at: now, saspay_transaction_id: transactionId,
        provider: 'saspay_checkout', provider_checkout_id: row.saspay_checkout_id,
        updated_at: now,
      }).eq('id', resourceId).eq('saspay_checkout_id', row.saspay_checkout_id).in('status', ['due', 'past_due']).select('id,school_id,period_end,amount_xof').maybeSingle()
      if (error) throw error
      if (!data) return { applied: false, reason: 'already_final_or_not_due', status: row.status }
      const { data: subForReferral, error: latestSubError } = await admin.from('school_subscriptions').select('id,referral_id')
        .eq('school_id', data.school_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (latestSubError) throw latestSubError
      if (!subForReferral) throw new Error('Abonnement introuvable après règlement du cycle.')
      const { error: subError } = await admin.from('school_subscriptions').update({
        status: 'active', current_period_end: data.period_end, saspay_transaction_id: transactionId, updated_at: now,
      }).eq('id', subForReferral.id)
      if (subError) throw subError
      if (subForReferral.referral_id) await rewardReferral(admin, subForReferral.referral_id)
      await admin.from('autopilot_events').insert({
        school_id: data.school_id, event_type: 'payment_received', severity: 'info',
        message: 'Cycle de facturation réglé via SasPay.',
        metadata: { cycle_id: resourceId, amount_xof: data.amount_xof, transaction_id: transactionId },
      })
      return { applied: true, status: 'paid' }
    }

    const { data, error } = await admin.from('school_subscriptions').update({
      status: 'active', billing_provider: 'saspay', saspay_transaction_id: transactionId,
      current_period_end: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), updated_at: now,
    }).eq('id', resourceId).eq('saspay_checkout_id', row.saspay_checkout_id).in('status', ['pending', 'past_due']).select('id,referral_id').maybeSingle()
    if (error) throw error
    if (data?.referral_id) await rewardReferral(admin, data.referral_id)
    return { applied: !!data, status: data ? 'active' : row.status }
  }

  // A failed/cancelled provider transaction is an attempt outcome, not proof that
  // the underlying invoice/order must become terminal. Keep the resource retryable;
  // a later checkout can replace the provider session ID. This also avoids trapping
  // school_payments in a `failed` state that the checkout route cannot retry.
  if (resourceType === 'billing_cycle' && row.school_id) {
    const { error } = await admin.from('autopilot_events').insert({
      school_id: row.school_id, event_type: 'payment_attempt_failed', severity: 'warning',
      message: 'Une tentative de paiement SasPay a échoué; le cycle reste payable.',
      metadata: { cycle_id: resourceId, transaction_id: transactionId },
    })
    if (error) throw error
  }
  return { applied: true, status: row.status }

}
