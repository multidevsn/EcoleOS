import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'
function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}
async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
  const apiKey=env('PADDLE_API_KEY')
  if(!apiKey)return json(res,503,{error:'Paddle API non configurée : ajoute PADDLE_API_KEY dans les secrets serveur.'})
  if(!env('SUPABASE_URL')||!env('SUPABASE_PUBLISHABLE_KEY')||!env('SUPABASE_SECRET_KEY'))return json(res,503,{error:'Supabase serveur non configuré.'})
  const auth=String(req.headers.authorization||''),token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})
  try{
    const userClient=createClient(env('SUPABASE_URL'),env('SUPABASE_PUBLISHABLE_KEY'),{global:{headers:{Authorization:'Bearer '+token}}})
    const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'))
    const {data:{user},error:userError}=await userClient.auth.getUser(token)
    if(userError||!user)return json(res,401,{error:'Session invalide ou expirée.'})
    const {data:profile,error:profileError}=await admin.from('profiles').select('role,school_id').eq('id',user.id).single()
    if(profileError||profile?.role!=='director'||!profile.school_id)return json(res,403,{error:'Réservé au directeur de l’établissement.'})
    const {data:sub,error:subError}=await admin.from('school_subscriptions').select('paddle_customer_id,paddle_subscription_id,billing_provider').eq('school_id',profile.school_id).eq('billing_provider','paddle').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(subError||!sub)return json(res,404,{error:'Abonnement Paddle introuvable.'})
    const customerId=String(sub.paddle_customer_id||''),subscriptionId=String(sub.paddle_subscription_id||'')
    if(!/^ctm_[a-z0-9]{26}$/.test(customerId)||!/^sub_[a-z0-9]{26}$/.test(subscriptionId))return json(res,409,{error:'Les identifiants client et abonnement Paddle ne sont pas encore synchronisés.'})
    const base=env('PADDLE_ENV')==='live'?'https://api.paddle.com':'https://sandbox-api.paddle.com'
    const response=await fetch(base+'/customers/'+encodeURIComponent(customerId)+'/portal-sessions',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({subscription_ids:[subscriptionId]})})
    const result=await response.json()
    if(!response.ok)return json(res,response.status,{error:result?.error?.detail||result?.error?.message||'Impossible de créer la session du portail Paddle.'})
    const link=result?.data?.urls?.subscriptions?.find((x:any)=>x.id===subscriptionId)?.view_subscription||result?.data?.urls?.general?.overview
    if(!link)return json(res,502,{error:'Paddle n’a pas retourné de lien de portail.'})
    return json(res,200,{url:link})
  }catch(error:any){return json(res,500,{error:error?.message||'Impossible d’ouvrir le portail Paddle.'})}
}
export default withSecurity('/api/paddle/director-portal',handler)
