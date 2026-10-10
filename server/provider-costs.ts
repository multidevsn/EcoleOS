import { env } from './env.js'
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
  const value = Number(env(name))
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
  const token = env('VERCEL_BILLING_TOKEN')
  const teamId = env('VERCEL_TEAM_ID')
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
  const override = env('SUPABASE_PLAN_USD_MONTHLY')
  if (override && Number.isFinite(Number(override))) return Number(override)
  if (plan === 'pro') return 25
  if (plan === 'team') return 599
  return 0
}

async function syncSupabase(period: ReturnType<typeof monthBounds>): Promise<ProviderSnapshot> {
  const token = env('SUPABASE_MGMT_TOKEN')
  const orgSlug = env('SUPABASE_ORG_SLUG')
  const refs = String(env('SUPABASE_PROJECT_REFS') || env('SUPABASE_PROJECT_REF') || '').split(',').map(x => x.trim()).filter(Boolean)
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

// Resend et Twilio ont été retirés : ScholaSync n'envoie ni email ni SMS. Ces deux
// intégrations ne servaient qu'à lire un coût fournisseur (et Resend paginait jusqu'à
// 1 000 pages d'historique pour ça). Elles sont réactivables en réintroduisant un
// ProviderSnapshot dans syncProviderCosts le jour où une vraie notification est ajoutée.

export async function syncProviderCosts(periodDate = new Date()) {
  const period = monthBounds(periodDate)
  const results = await Promise.all([syncVercel(period), syncSupabase(period)])
  return { period, results }
}
