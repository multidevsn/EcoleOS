import { describe, it, expect, afterEach } from 'vitest'
import handler from '../api/saspay/_sandbox.js'

const ENV = ['SASPAY_API_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']
afterEach(() => { for (const k of ENV) delete (process.env as any)[k] })

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: unknown) => { res.body = b; return res }
  res.end = () => res
  return res
}

describe('sandbox SasPay (/api/saspay/sandbox/approve)', () => {
  it('exige une session (401)', async () => {
    process.env.SUPABASE_URL = 'https://exemple.supabase.co'
    process.env.SUPABASE_PUBLISHABLE_KEY = 'anon'
    process.env.SUPABASE_SECRET_KEY = 'service'
    const res = mockRes()
    await handler({ method: 'POST', headers: {}, body: { type: 'school_payment', resource_id: 'x', checkout_id: 'sbx_1' } } as any, res)
    expect(res.statusCode).toBe(401)
  })
  it('se désactive dès que la clé SasPay réelle existe (409)', async () => {
    process.env.SASPAY_API_KEY = 'cle-reelle'
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: {} } as any, res)
    expect(res.statusCode).toBe(409)
  })
  it('rejette une référence sandbox malformée (400)', async () => {
    process.env.SUPABASE_URL = 'https://exemple.supabase.co'
    process.env.SUPABASE_PUBLISHABLE_KEY = 'anon'
    process.env.SUPABASE_SECRET_KEY = 'service'
    const res = mockRes()
    await handler({ method: 'POST', headers: { authorization: 'Bearer x' }, body: { type: 'school_payment', resource_id: 'x', checkout_id: 'pas-sbx' } } as any, res)
    expect(res.statusCode).toBe(400)
  })
})
