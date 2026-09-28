import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))return json(res,500,{error:'Supabase serveur non configuré.'})
  const auth=String(req.headers.authorization||'');const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})
  try{
    const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await admin.auth.getUser(token)
    if(error||!data.user)return json(res,401,{error:'Session invalide.'})
    const body=req.body||{};const metric=String(body.metric||'').trim();const quantity=Number(body.quantity??1)
    const metadata=body.metadata&&typeof body.metadata==='object'?body.metadata:{}
    if(!metric||metric.length>80||!Number.isFinite(quantity)||quantity<0||quantity>1000000)return json(res,400,{error:'Métrique invalide.'})
    const {data:profile}=await admin.from('profiles').select('school_id').eq('id',data.user.id).maybeSingle()
    const {error:insertError}=await admin.from('usage_events').insert({
      school_id:profile?.school_id||null,
      service:'ecole-os',
      metric,
      quantity,
      unit:'event',
      source:'app',
      measured_at:new Date().toISOString(),
      metadata:{...metadata,user_id:data.user.id}
    })
    if(insertError)return json(res,500,{error:insertError.message})
    return json(res,204,null)
  }catch(error:any){return json(res,500,{error:error?.message||'Erreur télémétrie.'})}
}

export default withSecurity('/api/metrics/event', handler)
