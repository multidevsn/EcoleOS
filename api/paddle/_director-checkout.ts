import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'

function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
  if(!env('VITE_PADDLE_CLIENT_TOKEN'))return json(res,503,{error:'Paddle n’est pas configuré : ajoute VITE_PADDLE_CLIENT_TOKEN.'})
  if(!env('SUPABASE_URL')||!env('SUPABASE_PUBLISHABLE_KEY')||!env('SUPABASE_SECRET_KEY'))return json(res,503,{error:'Supabase serveur non configuré.'})
  const auth=String(req.headers.authorization||'')
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})
  try{
    const userClient=createClient(env('SUPABASE_URL'),env('SUPABASE_PUBLISHABLE_KEY'),{global:{headers:{Authorization:`Bearer ${token}`}}})
    const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'))
    const {data:{user},error:userError}=await userClient.auth.getUser(token)
    if(userError||!user)return json(res,401,{error:'Session invalide ou expirée.'})
    const {data:profile,error:profileError}=await admin.from('profiles').select('id,role,school_id').eq('id',user.id).single()
    if(profileError||profile?.role!=='director'||!profile.school_id)return json(res,403,{error:'Réservé au directeur de l’établissement.'})
    const {data:sub,error:subError}=await admin.from('school_subscriptions').select('id,school_id,plan,status,billing_provider,paddle_customer_id').eq('school_id',profile.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(subError||!sub)return json(res,404,{error:'Abonnement introuvable.'})
    if(sub.status!=='pending')return json(res,409,{error:'Paddle est proposé uniquement pour un abonnement en attente. Les abonnements existants ne sont pas migrés automatiquement.'})
    const priceId=env(sub.plan==='extra'?'PADDLE_PRICE_EXTRA':'PADDLE_PRICE_SIMPLE')
    if(!/^pri_[A-Za-z0-9]+$/.test(priceId))return json(res,503,{error:`Prix Paddle ${sub.plan} manquant ou invalide côté serveur.`})
    const {data:school,error:schoolError}=await admin.from('schools').select('id,name').eq('id',profile.school_id).single()
    if(schoolError||!school)return json(res,404,{error:'Établissement introuvable.'})
    return json(res,200,{price_id:priceId,customer_id:/^ctm_[A-Za-z0-9]+$/.test(sub.paddle_customer_id||'')?sub.paddle_customer_id:null,email:user.email||undefined,custom_data:{school_id:school.id,school_subscription_id:sub.id,plan:sub.plan},environment:env('PADDLE_ENV')==='live'?'live':'sandbox',school_name:school.name})
  }catch(error:any){return json(res,500,{error:error?.message||'Impossible de préparer Paddle Checkout.'})}
}
export default withSecurity('/api/paddle/director-checkout',handler)

