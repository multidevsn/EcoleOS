import { env } from '../../server/env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}
async function adminCleanupFoodOrder(orderId:string,userId:string){
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))return
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
  await admin.from('food_order_items').delete().eq('order_id',orderId)
  await admin.from('food_orders').delete().eq('id',orderId).eq('user_id',userId).eq('status','pending')
}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'})
  if(!env('WAVE_API_KEY')) return json(res,503,{error:'Wave non configuré : ajoute WAVE_API_KEY côté serveur.'})
  if(!env('SUPABASE_URL')||!env('SUPABASE_PUBLISHABLE_KEY')||!env('SUPABASE_SECRET_KEY')) return json(res,503,{error:'Supabase serveur non configuré : renseigne SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY et SUPABASE_SECRET_KEY.'})
  const configuredAppUrl=env('APP_URL').trim()
  if(!configuredAppUrl)return json(res,503,{error:'APP_URL doit contenir l’URL HTTPS canonique du site.'})
  let appUrl:URL
  try{appUrl=new URL(configuredAppUrl)}catch{return json(res,503,{error:'APP_URL est invalide.'})}
  if(appUrl.protocol!=='https:'||appUrl.username||appUrl.password||appUrl.search||appUrl.hash||['localhost','127.0.0.1','::1'].includes(appUrl.hostname))return json(res,503,{error:'APP_URL doit être une URL HTTPS publique sans identifiants, paramètres ni fragment.'})

  const auth=String(req.headers.authorization||'')
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})

  let pendingFoodOrder: { id: string; userId: string } | null = null
  try{
    const userClient=createClient(env('SUPABASE_URL'),env('SUPABASE_PUBLISHABLE_KEY'),{global:{headers:{Authorization:`Bearer ${token}`}}})
    const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'))
    const {data:{user},error:userError}=await userClient.auth.getUser(token)
    if(userError||!user)return json(res,401,{error:'Session invalide ou expirée.'})

    const type=req.body?.type
    let amount=0
    let clientReference=''
    let resource:'food_orders'|'school_payments'|'school_subscriptions'|'billing_cycles'
    let resourceId=''
    let actorSchoolId=''

    if(type==='food'){
      const items=Array.isArray(req.body?.items)?req.body.items:[]
      if(!items.length)return json(res,400,{error:'Panier vide.'})
      const normalized:{id:string;quantity:number}[]=items.map((x:any)=>({id:String(x?.id||''),quantity:Number(x?.quantity)}))
      if(normalized.some(x=>!x.id||!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>99))return json(res,400,{error:'Article ou quantité invalide (1 à 99 par article).'})
      const ids=[...new Set(normalized.map((x:{id:string;quantity:number})=>x.id))]
      const {data:foods,error:foodsError}=await userClient.from('food_items').select('id,name,price_xof,active').in('id',ids).eq('active',true)
      if(foodsError)throw foodsError
      const byId=Object.fromEntries((foods||[]).map((x:any)=>[x.id,x]))
      const orderItems:{food_item_id:string;quantity:number;unit_price_xof:number}[]=[]
      for(const item of normalized){
        const food=byId[item.id]
        if(!food)return json(res,400,{error:`Article Food invalide : ${item.id}`})
        const unitPrice=Number(food.price_xof)
        if(!Number.isSafeInteger(unitPrice)||unitPrice<=0)return json(res,400,{error:`Prix invalide pour l’article ${item.id}.`})
        amount+=unitPrice*item.quantity
        if(!Number.isSafeInteger(amount))return json(res,400,{error:'Montant total invalide.'})
        orderItems.push({food_item_id:item.id,quantity:item.quantity,unit_price_xof:unitPrice})
      }
      if(!Number.isSafeInteger(amount)||amount<=0)return json(res,400,{error:'Montant total invalide.'})

      const {data:order,error:orderError}=await admin.from('food_orders').insert({
        user_id:user.id,
        total_xof:amount,
        status:'pending',
        pickup_date:req.body?.pickup_date||null,
        pickup_slot:req.body?.pickup_slot||null
      }).select('id').single()
      if(orderError)throw orderError
      resource='food_orders';resourceId=order.id;clientReference=`food-order:${order.id}`;pendingFoodOrder={id:order.id,userId:user.id}
      const {error:itemError}=await admin.from('food_order_items').insert(orderItems.map(x=>({...x,order_id:order.id})))
      if(itemError){await admin.from('food_orders').delete().eq('id',order.id).eq('user_id',user.id).eq('status','pending');throw itemError}
    }else if(type==='school_payment'){
      const paymentId=String(req.body?.payment_id||'')
      if(!paymentId)return json(res,400,{error:'Paiement scolaire manquant.'})
      const {data:payment,error:paymentError}=await userClient.from('school_payments').select('id,user_id,amount_xof,status').eq('id',paymentId).eq('status','pending').single()
      if(paymentError||!payment||payment.user_id!==user.id)return json(res,403,{error:'Paiement introuvable ou déjà traité.'})
      amount=Number(payment.amount_xof)
      resource='school_payments';resourceId=payment.id;clientReference=`school-payment:${payment.id}`
    }else if(type==='billing_cycle'){
      const cycleId=String(req.body?.billing_cycle_id||'')
      if(!cycleId)return json(res,400,{error:'Cycle de facturation manquant.'})
      const {data:profile,error:profileError}=await admin.from('profiles').select('id,role,school_id').eq('id',user.id).single()
      if(profileError||!profile||profile.role!=='director'||!profile.school_id)return json(res,403,{error:'Seul le directeur peut régler le cycle de facturation.'})
      actorSchoolId=profile.school_id
      const {data:cycle,error:cycleError}=await admin.from('billing_cycles').select('id,school_id,amount_xof,status,provider_checkout_id').eq('id',cycleId).eq('school_id',profile.school_id).in('status',['due','past_due']).single()
      if(cycleError||!cycle)return json(res,403,{error:'Cycle introuvable ou déjà réglé.'})
      const {data:schoolSub,error:schoolSubError}=await admin.from('school_subscriptions').select('billing_provider,billing_price_xof').eq('school_id',profile.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(schoolSubError)throw schoolSubError
      amount=Math.max(0,Number(cycle.amount_xof)-(schoolSub?.billing_provider==='paddle'?Number(schoolSub.billing_price_xof||0):0))
      if(amount<=0)return json(res,400,{error:'Aucun frais d’usage à payer sur ce cycle.'})
      resource='billing_cycles';resourceId=cycle.id;clientReference=`billing-cycle:${cycle.id}`
    }else if(type==='school_subscription'){
      const subscriptionId=String(req.body?.subscription_id||'')
      if(!subscriptionId)return json(res,400,{error:'Abonnement manquant.'})
      const {data:profile,error:profileError}=await admin.from('profiles').select('id,role,school_id').eq('id',user.id).single()
      if(profileError||!profile||profile.role!=='director'||!profile.school_id)return json(res,403,{error:'Seul le directeur de l’école peut payer cet abonnement.'})
      actorSchoolId=profile.school_id
      const {data:sub,error:subError}=await admin.from('school_subscriptions').select('id,school_id,plan,billing_price_xof,status').eq('id',subscriptionId).eq('school_id',profile.school_id).eq('status','pending').single()
      if(subError||!sub)return json(res,403,{error:'Abonnement introuvable ou déjà payé.'})
      amount=Number(sub.billing_price_xof)
      resource='school_subscriptions';resourceId=sub.id;clientReference=`subscription:${sub.id}`
    }else{
      return json(res,400,{error:'Type de paiement inconnu.'})
    }

    if(!Number.isSafeInteger(amount)||amount<=0)return json(res,400,{error:'Le montant doit être un entier positif en XOF.'})
    const base=appUrl.origin
    const waveResponse=await fetch('https://api.wave.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${env('WAVE_API_KEY')}`,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(8000),
      body:JSON.stringify({amount:String(amount),currency:'XOF',client_reference:clientReference,success_url:`${base}/?payment=success`,error_url:`${base}/?payment=error`})
    })
    const wave=await waveResponse.json().catch(()=>({}))
    if(!waveResponse.ok)return json(res,waveResponse.status,{error:wave?.message||'Wave checkout error'})
    if(typeof wave?.id!=='string'||!wave.id.trim()||typeof wave?.wave_launch_url!=='string')return json(res,502,{error:'Réponse Wave incomplète.'})
    let waveLaunchUrl:URL
    try{waveLaunchUrl=new URL(wave.wave_launch_url)}catch{return json(res,502,{error:'URL de paiement Wave invalide.'})}
    if(waveLaunchUrl.protocol!=='https:'||waveLaunchUrl.hostname!=='pay.wave.com'||waveLaunchUrl.username||waveLaunchUrl.password||waveLaunchUrl.port)return json(res,502,{error:'Wave a retourné un domaine de paiement non approuvé.'})

    const now=new Date().toISOString()
    const update=resource==='food_orders'
      ?await admin.from('food_orders').update({wave_checkout_id:wave.id}).eq('id',resourceId).eq('user_id',user.id).eq('status','pending').select('id').maybeSingle()
      :resource==='school_payments'
        ?await admin.from('school_payments').update({wave_checkout_id:wave.id}).eq('id',resourceId).eq('user_id',user.id).eq('status','pending').select('id').maybeSingle()
        :resource==='billing_cycles'
          ?await admin.from('billing_cycles').update({provider_checkout_id:wave.id,provider_checkout_url:waveLaunchUrl.toString(),provider_checkout_amount_xof:amount,updated_at:now}).eq('id',resourceId).eq('school_id',actorSchoolId).in('status',['due','past_due']).select('id').maybeSingle()
          :await admin.from('school_subscriptions').update({wave_checkout_id:wave.id,updated_at:now}).eq('id',resourceId).eq('school_id',actorSchoolId).eq('status','pending').select('id').maybeSingle()
    if(update.error){
      if(resource==='food_orders'){
        await admin.from('food_order_items').delete().eq('order_id',resourceId)
        await admin.from('food_orders').delete().eq('id',resourceId).eq('user_id',user.id).eq('status','pending')
      }
      throw update.error
    }
    if(!update.data?.id){
      if(resource==='food_orders'){
        await admin.from('food_order_items').delete().eq('order_id',resourceId)
        await admin.from('food_orders').delete().eq('id',resourceId).eq('user_id',user.id).eq('status','pending')
        pendingFoodOrder = null
      }
      return json(res,409,{error:'La ressource a changé pendant la création du checkout. Aucun lien de paiement n’a été remis.'})
    }

    pendingFoodOrder = null
    return json(res,200,{wave_launch_url:waveLaunchUrl.toString(),checkout_id:wave.id,reference:clientReference})
  }catch(error:any){
    if(pendingFoodOrder){
      await adminCleanupFoodOrder(pendingFoodOrder.id, pendingFoodOrder.userId).catch(()=>{})
    }
    return json(res,500,{error:error?.message||'Impossible de créer le paiement.'})
  }
}

export default withSecurity('/api/wave/checkout', handler)

