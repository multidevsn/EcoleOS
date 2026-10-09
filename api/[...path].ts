import type { VercelRequest, VercelResponse } from '@vercel/node'

import adminAction from './admin/_action.js'
import billingAutopilot from './billing/_autopilot.js'
import directorStats from './director/_stats.js'
import membersIndex from './members/_index.js'
import membersProvision from './members/_provision.js'
import membersValidate from './members/_validate.js'
import metricsAction from './metrics/_action.js'
import onboardingSchool from './onboarding/_school.js'
import paddleAction from './paddle/_action.js'
import saspayCheckout from './saspay/_checkout.js'
import saspayVerify from './saspay/_verify.js'
import waveCheckout from './wave/_checkout.js'

// Catch-all unique : le forfait Vercel Hobby limite a 12 fonctions serverless.
// Toutes les routes API passent par ici, SAUF les 3 webhooks prestataires
// (paddle/saspay/wave) qui restent des fichiers dedies avec bodyParser:false
// pour verifier leur signature HMAC sur le corps brut. Les fichiers renommes
// en "_*" ne sont pas comptes comme fonctions par Vercel. Les URLs publiques
// ne changent pas : un fichier statique (ex. /api/saspay/webhook) a priorite
// sur ce catch-all, et chaque handler retrouve son action via req.url.
// Resultat : 15 fonctions -> 4.
export default function handler(req: VercelRequest, res: VercelResponse) {
  const pathname = new URL(String(req.url || '/'), 'http://localhost').pathname

  if (pathname.startsWith('/api/admin/')) return adminAction(req, res)
  if (pathname.startsWith('/api/metrics/')) return metricsAction(req, res)
  if (pathname.startsWith('/api/paddle/')) return paddleAction(req, res)

  switch (pathname) {
    case '/api/billing/autopilot': return billingAutopilot(req, res)
    case '/api/director/stats': return directorStats(req, res)
    case '/api/members': return membersIndex(req, res)
    case '/api/members/provision': return membersProvision(req, res)
    case '/api/members/validate': return membersValidate(req, res)
    case '/api/onboarding/school': return onboardingSchool(req, res)
    case '/api/saspay/checkout': return saspayCheckout(req, res)
    case '/api/saspay/verify': return saspayVerify(req, res)
    case '/api/wave/checkout': return waveCheckout(req, res)
    default: return res.status(404).json({ error: 'Route API introuvable.' })
  }
}
