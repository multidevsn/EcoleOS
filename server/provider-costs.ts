export type ProviderSnapshot = {
  provider: string
  period_start: string
  period_end: string
  currency: string
  amount: number
  amount_xof: number | null
  basis: 'provider_reported' | 'usage_derived'
  status: 'ok' | 'partial' | 'error' | 'not_configured'
  units: Record<string, unknown>
  breakdown: Record<string, unknown>
  source_ref?: string | null
  error_message?: string | null
}

function numberEnv(name: string, fallback = 0) {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function fxToXof(currency: string) {
  const c = currency.toUpperCase()
  if (c === 'XOF') return 1
  if (c === 'USD') return numberEnv('COST_USD_TO_XOF', 0)
  if (c === 'EUR') return numberEnv('COST_EUR_TO_XOF', 0)
  return 0
}

export function normalizeXof(amount: number, currency: string) {
  const fx = fxToXof(currency)
  return fx > 0 ? Math.round(amount * fx) : null
}

function monthBounds(periodStart = new Date()) {
  const start = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1)
  const end = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59, 999)
  return {
    start,
    end,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init)
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!response.ok) {
    const message = body?.message || body?.error || `${response.status} ${response.statusText}`
    throw new Error(message)
  }
  return body
}

function extractNumber(record: any, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  }
  return 0
}

async function syncVercel(period: ReturnType<typeof monthBounds>): Promise<ProviderSnapshot> {
  const token = process.env.VERCEL_BILLING_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  if (!token || !teamId) {
    return { provider: 'vercel', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'provider_reported', status: 'not_configured', units: {}, breakdown: {}, error_message: 'VERCEL_BILLING_TOKEN et VERCEL_TEAM_ID requis.' }
  }

  const url = new URL('https://api.vercel.com/v1/billing/charges')
  url.searchParams.set('teamId', teamId)
  url.searchParams.set('from', period.start.toISOString())
  url.searchParams.set('to', period.end.toISOString())
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' } })
    const text = await response.text()
    if (!response.ok) throw new Error(text || `${response.status} ${response.statusText}`)
    const records = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line))
    const currency = String(records.find((x: any) => x?.BillingCurrency)?.BillingCurrency || 'USD').toUpperCase()
    const amount = records.reduce((sum: number, row: any) => sum + extractNumber(row, ['BilledCost', 'EffectiveCost', 'NetAmount', 'ListCost', 'amount']), 0)
    return {
      provider: 'vercel', period_start: period.startDate, period_end: period.endDate, currency,
      amount, amount_xof: normalizeXof(amount, currency), basis: 'provider_reported', status: 'ok',
      units: { charge_records: records.length },
      breakdown: { records: records.slice(0, 100) },
      source_ref: teamId,
    }
  } catch (error: any) {
    return { provider: 'vercel', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'provider_reported', status: 'error', units: {}, breakdown: {}, source_ref: teamId, error_message: error?.message || 'Vercel billing API error' }
  }
}

function supabasePlanUsd(plan: string) {
  const override = process.env.SUPABASE_PLAN_USD_MONTHLY
  if (override && Number.isFinite(Number(override))) return Number(override)
  if (plan === 'pro') return 25
  if (plan === 'team') return 599
  return 0
}

async function syncSupabase(period: ReturnType<typeof monthBounds>): Promise<ProviderSnapshot> {
  const token = process.env.SUPABASE_MGMT_TOKEN
  const orgSlug = process.env.SUPABASE_ORG_SLUG
  const refs = String(process.env.SUPABASE_PROJECT_REFS || process.env.SUPABASE_PROJECT_REF || '').split(',').map(x => x.trim()).filter(Boolean)
  if (!token || !orgSlug || !refs.length) {
    return { provider: 'supabase', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'usage_derived', status: 'not_configured', units: {}, breakdown: {}, error_message: 'SUPABASE_MGMT_TOKEN, SUPABASE_ORG_SLUG et SUPABASE_PROJECT_REFS requis.' }
  }

  try {
    const auth = { Authorization: `Bearer ${token}` }
    const org = await fetchJson(`https://api.supabase.com/v1/organizations/${encodeURIComponent(orgSlug)}`, { headers: auth })
    const plan = String(org?.plan || 'free').toLowerCase()
    let addonUsd = 0
    const projects: any[] = []
    for (const ref of refs) {
      const billing = await fetchJson(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/billing/addons`, { headers: auth })
      const selected = Array.isArray(billing?.selected_addons) ? billing.selected_addons : []
      const projectAddon = selected.reduce((sum: number, addon: any) => sum + Number(addon?.variant?.price?.amount || 0), 0)
      addonUsd += projectAddon
      projects.push({ ref, selected_addons: selected })
    }
    const planUsd = supabasePlanUsd(plan)
    const computeCredit = plan === 'pro' || plan === 'team' ? numberEnv('SUPABASE_COMPUTE_CREDIT_USD', 10) : 0
    const amount = Math.max(0, planUsd + addonUsd - computeCredit)
    return {
      provider: 'supabase', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount,
      amount_xof: normalizeXof(amount, 'USD'), basis: 'usage_derived', status: 'partial',
      units: { projects: refs.length, plan, plan_monthly_usd: planUsd, addon_monthly_usd: addonUsd, compute_credit_usd: computeCredit },
      breakdown: { projects }, source_ref: orgSlug,
      error_message: 'Coût Supabase dérivé du plan et des add-ons exposés par la Management API ; les surcoûts variables d usage peuvent nécessiter la page de facturation officielle.',
    }
  } catch (error: any) {
    return { provider: 'supabase', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'usage_derived', status: 'error', units: {}, breakdown: {}, source_ref: orgSlug, error_message: error?.message || 'Supabase Management API error' }
  }
}

function resendPlanConfig() {
  const plan = String(process.env.RESEND_PLAN || 'free').toLowerCase()
  const table: Record<string, { monthly: number; included: number; overagePer1000: number }> = {
    free: { monthly: 0, included: 3000, overagePer1000: 0 },
    pro: { monthly: 20, included: 50000, overagePer1000: 0.90 },
    scale: { monthly: 90, included: 100000, overagePer1000: 0.90 },
  }
  const config = table[plan] || table.free
  return {
    monthly: numberEnv('RESEND_MONTHLY_USD', config.monthly),
    included: Math.max(0, Math.floor(numberEnv('RESEND_INCLUDED_EMAILS', config.included))),
    overagePer1000: numberEnv('RESEND_OVERAGE_USD_PER_1000', config.overagePer1000),
    plan,
  }
}

async function syncResend(period: ReturnType<typeof monthBounds>): Promise<ProviderSnapshot> {
  const token = process.env.RESEND_API_KEY
  if (!token) {
    return { provider: 'resend', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'usage_derived', status: 'not_configured', units: {}, breakdown: {}, error_message: 'RESEND_API_KEY requis.' }
  }
  try {
    let after: string | undefined
    let count = 0
    let pages = 0
    let safety = 0
    let stop = false
    while (!stop && safety < 1000) {
      safety++
      const url = new URL('https://api.resend.com/emails')
      url.searchParams.set('limit', '100')
      if (after) url.searchParams.set('after', after)
      const body = await fetchJson(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
      const items = Array.isArray(body?.data) ? body.data : []
      pages++
      for (const email of items) {
        const created = new Date(email?.created_at || 0)
        if (created >= period.start && created <= period.end) count++
        if (created < period.start) { stop = true; break }
      }
      if (stop || !body?.has_more || !items.length) break
      after = items[items.length - 1]?.id
      if (!after) break
    }
    const cfg = resendPlanConfig()
    const overage = Math.max(0, count - cfg.included)
    const amount = cfg.monthly + (overage / 1000) * cfg.overagePer1000
    return {
      provider: 'resend', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount,
      amount_xof: normalizeXof(amount, 'USD'), basis: 'usage_derived', status: 'partial',
      units: { sent_emails: count, pages_scanned: pages, plan: cfg.plan, included_emails: cfg.included, overage_emails: overage },
      breakdown: { monthly_plan_usd: cfg.monthly, overage_usd_per_1000: cfg.overagePer1000 },
      source_ref: 'resend-account', error_message: 'Resend expose les emails envoyés par API ; le coût est dérivé du plan configuré et des volumes réels. Les taxes/add-ons éventuels peuvent différer de la facture finale.',
    }
  } catch (error: any) {
    return { provider: 'resend', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'usage_derived', status: 'error', units: {}, breakdown: {}, source_ref: 'resend-account', error_message: error?.message || 'Resend API error' }
  }
}

async function syncTwilio(period: ReturnType<typeof monthBounds>): Promise<ProviderSnapshot> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    return { provider: 'twilio', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'provider_reported', status: 'not_configured', units: {}, breakdown: {}, error_message: 'TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN requis.' }
  }
  try {
    const basic = Buffer.from(`${sid}:${token}`).toString('base64')
    const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Usage/Records.json`)
    url.searchParams.set('StartDate', period.startDate)
    url.searchParams.set('EndDate', period.endDate)
    url.searchParams.set('Category', 'totalprice')
    const body = await fetchJson(url.toString(), { headers: { Authorization: `Basic ${basic}` } })
    const records = Array.isArray(body?.usage_records) ? body.usage_records : []
    const amount = records.reduce((sum: number, row: any) => sum + Number(row?.price || 0), 0)
    const currency = String(records[0]?.price_unit || 'USD').toUpperCase()
    return {
      provider: 'twilio', period_start: period.startDate, period_end: period.endDate, currency, amount,
      amount_xof: normalizeXof(amount, currency), basis: 'provider_reported', status: 'ok',
      units: { categories: records.length }, breakdown: { records }, source_ref: sid,
    }
  } catch (error: any) {
    return { provider: 'twilio', period_start: period.startDate, period_end: period.endDate, currency: 'USD', amount: 0, amount_xof: null, basis: 'provider_reported', status: 'error', units: {}, breakdown: {}, source_ref: sid, error_message: error?.message || 'Twilio Usage API error' }
  }
}

export async function syncProviderCosts(periodDate = new Date()) {
  const period = monthBounds(periodDate)
  const results = await Promise.all([syncVercel(period), syncSupabase(period), syncResend(period), syncTwilio(period)])
  return { period, results }
}
