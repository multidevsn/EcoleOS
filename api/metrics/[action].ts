import type { VercelRequest, VercelResponse } from '@vercel/node'

import event from './_event.js'
import rollup from './_rollup.js'

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown

const handlers: Record<string, ApiHandler> = { event, rollup }

export default function handler(req: VercelRequest, res: VercelResponse) {
  const pathname = new URL(String(req.url || '/'), 'http://localhost').pathname
  const match = pathname.match(/^\/api\/metrics\/([^/]+)$/)
  const action = match?.[1] || ''
  const selected = handlers[action]
  if (!selected) return res.status(404).json({ error: 'Route API introuvable.' })
  return selected(req, res)
}
