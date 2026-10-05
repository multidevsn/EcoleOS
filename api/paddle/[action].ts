import type { VercelRequest, VercelResponse } from '@vercel/node'

import directorCheckout from './_director-checkout.js'
import directorPortal from './_director-portal.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown

const handlers: Record<string, ApiHandler> = {
  'director-checkout': directorCheckout,
  'director-portal': directorPortal,
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const pathname = new URL(String(req.url || '/'), 'http://localhost').pathname
  const match = pathname.match(/^\/api\/paddle\/([^/]+)$/)
  const action = match?.[1] || ''
  const selected = handlers[action]
  if (!selected) return res.status(404).json({ error: 'Route API introuvable.' })
  return selected(req, res)
}
