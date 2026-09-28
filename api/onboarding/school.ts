import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security'
function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function makeCode(name: string) {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'ECOLE'
  return `EO-${base.slice(0, 2)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY) {
    return json(res, 503, { error: 'Supabase serveur non configuré.' })
  }

  const auth = String(req.headers.authorization || '')
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json(res, 401, { error: 'Authentification requise.' })

  const body = req.body || {}
  const schoolName = String(body.name || '').trim()
  const city = String(body.city || '').trim()
  const plan = body.plan === 'extra' ? 'extra' : 'simple'
  const referralCode = String(body.referral || '').trim().toUpperCase()
  if (!schoolName || !city) return json(res, 400, { error: 'Nom de l’école et ville requis.' })

  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json(res, 401, { error: 'Session invalide.' })
    const user = userData.user

    const { data: existing } = await admin.from('schools').select('id,name').eq('director_id', user.id).maybeSingle()
    if (existing) return json(res, 409, { error: `Vous avez déjà l’école « ${existing.name} ».` })

    const { data: profile, error: profileError } = await admin.from('profiles').select('id,role,full_name').eq('id', user.id).single()
    if (profileError || !profile) return json(res, 400, { error: 'Profil introuvable. Rechargez la page puis réessayez.' })

    const { data: selectedPlan, error: planError } = await admin.from('subscription_plans').select('id,price_xof').eq('id', plan).single()
    if (planError || !selectedPlan) return json(res, 400, { error: 'Plan indisponible.' })

    let referrerId: string | null = null
    if (referralCode) {
      const { data: ref } = await admin.from('referral_codes').select('owner_id').eq('code', referralCode).maybeSingle()
      if (!ref) return json(res, 400, { error: 'Code de parrainage invalide.' })
      if (ref.owner_id === user.id) return json(res, 400, { error: 'Vous ne pouvez pas vous parrainer vous-même.' })
      referrerId = ref.owner_id
    }

    const { data: school, error: schoolError } = await admin.from('schools').insert({ name: schoolName, city, director_id: user.id }).select('id,name,city').single()
    if (schoolError) return json(res, 400, { error: schoolError.message })

    await admin.from('profiles').update({ role: 'director', school_id: school.id, updated_at: new Date().toISOString() }).eq('id', user.id)

    const code = makeCode(schoolName)
    const { error: codeError } = await admin.from('referral_codes').insert({ owner_id: user.id, code })
    if (codeError) {
      await admin.from('schools').delete().eq('id', school.id)
      return json(res, 500, { error: 'Impossible de créer le code de parrainage.' })
    }

    let referralId: string | null = null
    if (referrerId && referralCode) {
      const { data: refRow, error: refError } = await admin.from('referrals').insert({ referrer_id: referrerId, referred_school_id: school.id, referral_code: referralCode }).select('id').single()
      if (refError) {
        await admin.from('referral_codes').delete().eq('owner_id', user.id)
        await admin.from('schools').delete().eq('id', school.id)
        return json(res, 400, { error: 'Le parrainage n’a pas pu être enregistré.' })
      }
      referralId = refRow.id
    }

    const { error: subError } = await admin.from('school_subscriptions').insert({
      school_id: school.id,
      plan,
      status: 'pending',
      billing_price_xof: Number(selectedPlan.price_xof),
      referral_id: referralId,
    })
    if (subError) return json(res, 500, { error: subError.message })

    await admin.from('school_billing_settings').upsert({school_id:school.id,autopilot_enabled:true,auto_scaling_enabled:true,usage_pricing_enabled:true},{onConflict:'school_id'})
    await admin.rpc('ensure_school_billing_cycle',{p_school_id:school.id,p_period_start:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10)})

    return json(res, 200, { ok: true, school_id: school.id, school_name: school.name, plan, price_xof: Number(selectedPlan.price_xof), referral_code: code })
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Erreur de création de l’école.' })
  }
}

export default withSecurity('/api/onboarding/school', handler)
