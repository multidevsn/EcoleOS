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
    const body=req.body||{}
    // Compatibilité : un seul événement ({metric,...}) OU un lot groupé ({events:[{metric,...}, ...]}).
    // Le regroupement côté client (voir src/lib/telemetry.ts) réduit le nombre d'appels réseau sans changer
    // le nombre de lignes enregistrées : chaque événement du lot est toujours inséré individuellement.
    const rawEvents:any[]=Array.isArray(body.events)?body.events:[body]
    if(!rawEvents.length||rawEvents.length>50)return json(res,400,{error:'Lot d’événements invalide.'})
    const parsed=rawEvents.map(e=>({
      metric:String(e?.metric||'').trim(),
      quantity:Number(e?.quantity??1),
      metadata:e?.metadata&&typeof e.metadata==='object'?e.metadata:{},
    }))
    if(parsed.some(e=>!e.metric||e.metric.length>80||!Number.isFinite(e.quantity)||e.quantity<0||e.quantity>1000000))
      return json(res,400,{error:'Métrique invalide.'})
    const {data:profile}=await admin.from('profiles').select('school_id').eq('id',data.user.id).maybeSingle()
    const now=new Date().toISOString()
    const {error:insertError}=await admin.from('usage_events').insert(parsed.map(e=>({
      school_id:profile?.school_id||null,
      service:'ecole-os',
      metric:e.metric,
      quantity:e.quantity,
      unit:'event',
      source:'app',
      measured_at:now,
      metadata:{...e.metadata,user_id:data.user.id}
    })))
    if(insertError)return json(res,500,{error:insertError.message})
    return json(res,204,null)
  }catch(error:any){return json(res,500,{error:error?.message||'Erreur télémétrie.'})}
}

export default withSecurity('/api/metrics/event', handler)
