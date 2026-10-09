import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

const onboardingErrors: Record<string, { status: number; message: string }> = {
  ONBOARDING_INVALID_INPUT: { status: 400, message: 'Vérifiez les informations de l’école.' },
  ONBOARDING_PROFILE_NOT_FOUND: { status: 400, message: 'Profil introuvable. Rechargez la page puis réessayez.' },
  ONBOARDING_PLAN_UNAVAILABLE: { status: 400, message: 'Plan indisponible.' },
  ONBOARDING_REFERRAL_INVALID: { status: 400, message: 'Code de parrainage invalide.' },
  ONBOARDING_REFERRAL_SELF: { status: 400, message: 'Vous ne pouvez pas vous parrainer vous-même.' },
  ONBOARDING_SCHOOL_ALREADY_EXISTS: { status: 409, message: 'Cette demande ne correspond pas à l’école déjà créée.' },
  ONBOARDING_PROFILE_ALREADY_LINKED: { status: 409, message: 'Ce profil est déjà rattaché à un établissement.' },
  ONBOARDING_INCOMPLETE: { status: 409, message: 'Une inscription précédente est incomplète. Contactez le support pour la faire vérifier.' },
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!env('SUPABASE_URL') || !env('SUPABASE_PUBLISHABLE_KEY') || !env('SUPABASE_SECRET_KEY')) {
    return json(res, 503, { error: 'Supabase serveur non configuré.' })
  }

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json(res, 401, { error: 'Authentification requise.' })

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {}
  const schoolName = typeof body.name === 'string' ? body.name.trim() : ''
  const city = typeof body.city === 'string' ? body.city.trim() : ''
  const plan = body.plan
  const referralCode = typeof body.referral === 'string' ? body.referral.trim().toUpperCase() : ''

  if (!schoolName || schoolName.length > 120 || !city || city.length > 100) {
    return json(res, 400, { error: 'Nom de l’école et ville requis (120 et 100 caractères maximum).' })
  }
  if (plan !== 'simple' && plan !== 'extra') return json(res, 400, { error: 'Plan invalide.' })
  if (typeof body.referral !== 'undefined' && typeof body.referral !== 'string') {
    return json(res, 400, { error: 'Code de parrainage invalide.' })
  }
  if (referralCode.length > 40) return json(res, 400, { error: 'Code de parrainage invalide.' })

  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'))

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })

    const { data, error } = await admin.rpc('create_school_onboarding', {
      p_director_id: userData.user.id,
      p_school_name: schoolName,
      p_city: city,
      p_plan: plan,
      p_referral_code: referralCode || null,
    })

    if (error) {
      const known = onboardingErrors[error.message]
      if (known) return json(res, known.status, { error: known.message })
      if (error.code === '23505') {
        return json(res, 409, { error: 'Une école est déjà associée à ce compte.' })
      }
      console.error('[onboarding/school] Transaction failed', { code: error.code, message: error.message })
      return json(res, 500, { error: 'Erreur lors de la création de l’école. Réessayez dans un instant.' })
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      console.error('[onboarding/school] RPC returned an unexpected result')
      return json(res, 500, { error: 'Réponse inattendue lors de la création de l’école.' })
    }

    return json(res, 200, { ok: true, ...data })
  } catch (error: unknown) {
    console.error('[onboarding/school] Request failed', error)
    return json(res, 500, { error: 'Erreur lors de la création de l’école.' })
  }
}

export default withSecurity('/api/onboarding/school', handler)
