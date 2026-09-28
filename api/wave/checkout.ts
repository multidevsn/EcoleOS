import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security'
function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'})
  if(!process.env.WAVE_API_KEY) return json(res,503,{error:'Wave non configuré : ajoute WAVE_API_KEY côté serveur.'})
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY||!process.env.SUPABASE_SECRET_KEY) return json(res,503,{error:'Supabase serveur non configuré : renseigne SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY et SUPABASE_SECRET_KEY.'})

  const auth=String(req.headers.authorization||'')
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})

  try{
    const userClient=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:`Bearer ${token}`}}})
    const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY)
    const {data:{user},error:userError}=await userClient.auth.getUser(token)
    if(userError||!user)return json(res,401,{error:'Session invalide ou expirée.'})

    const type=req.body?.type
    let amount=0
    let clientReference=''
    let resource:'food_orders'|'school_payments'|'school_subscriptions'
    let resourceId=''

    if(type==='food'){
      const items=Array.isArray(req.body?.items)?req.body.items:[]
      if(!items.length)return json(res,400,{error:'Panier vide.'})
      const normalized=items.map((x:any)=>({id:String(x.id),quantity:Math.floor(Number(x.quantity||0))})).filter(x=>x.quantity>0)
      const ids=[...new Set(normalized.map(x=>x.id))]
      const {data:foods,error:foodsError}=await userClient.from('food_items').select('id,name,price_xof,active').in('id',ids).eq('active',true)
      if(foodsError)throw foodsError
      const byId=Object.fromEntries((foods||[]).map((x:any)=>[x.id,x]))
      const orderItems=[]
      for(const item of normalized){
        const food=byId[item.id]
        if(!food)return json(res,400,{error:`Article Food invalide : ${item.id}`})
        amount+=Number(food.price_xof)*item.quantity
        orderItems.push({food_item_id:item.id,quantity:item.quantity,unit_price_xof:Number(food.price_xof)})
      }
      if(!amount)return json(res,400,{error:'Panier vide.'})

      const {data:order,error:orderError}=await admin.from('food_orders').insert({
        user_id:user.id,
        total_xof:amount,
        status:'pending',
        pickup_date:req.body?.pickup_date||null,
        pickup_slot:req.body?.pickup_slot||null
      }).select('id').single()
      if(orderError)throw orderError
      resource='food_orders';resourceId=order.id;clientReference=`food-order:${order.id}`
      const {error:itemError}=await admin.from('food_order_items').insert(orderItems.map(x=>({...x,order_id:order.id})))
      if(itemError)throw itemError
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
      const {data:cycle,error:cycleError}=await admin.from('billing_cycles').select('id,school_id,amount_xof,status,provider_checkout_id').eq('id',cycleId).eq('school_id',profile.school_id).in('status',['due','past_due']).single()
      if(cycleError||!cycle)return json(res,403,{error:'Cycle introuvable ou déjà réglé.'})
      amount=Number(cycle.amount_xof)
      resource='billing_cycles';resourceId=cycle.id;clientReference=`billing-cycle:${cycle.id}`
    }else if(type==='school_subscription'){
      const subscriptionId=String(req.body?.subscription_id||'')
      if(!subscriptionId)return json(res,400,{error:'Abonnement manquant.'})
      const {data:profile,error:profileError}=await admin.from('profiles').select('id,role,school_id').eq('id',user.id).single()
      if(profileError||!profile||profile.role!=='director'||!profile.school_id)return json(res,403,{error:'Seul le directeur de l’école peut payer cet abonnement.'})
      const {data:sub,error:subError}=await admin.from('school_subscriptions').select('id,school_id,plan,billing_price_xof,status').eq('id',subscriptionId).eq('school_id',profile.school_id).eq('status','pending').single()
      if(subError||!sub)return json(res,403,{error:'Abonnement introuvable ou déjà payé.'})
      amount=Number(sub.billing_price_xof)
      resource='school_subscriptions';resourceId=sub.id;clientReference=`subscription:${sub.id}`
    }else{
      return json(res,400,{error:'Type de paiement inconnu.'})
    }

    const base=process.env.APP_URL||`https://${req.headers.host}`
    const waveResponse=await fetch('https://api.wave.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${process.env.WAVE_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({amount:String(amount),currency:'XOF',client_reference:clientReference,success_url:`${base}/?payment=success`,error_url:`${base}/?payment=error`})
    })
    const wave=await waveResponse.json()
    if(!waveResponse.ok)return json(res,waveResponse.status,{error:wave?.message||'Wave checkout error'})

    const update=resource==='food_orders'
      ?await admin.from('food_orders').update({wave_checkout_id:wave.id}).eq('id',resourceId).eq('user_id',user.id)
      :resource==='school_payments'
        ?await admin.from('school_payments').update({wave_checkout_id:wave.id}).eq('id',resourceId).eq('user_id',user.id)
        :resource==='billing_cycles'
          ?await admin.from('billing_cycles').update({provider_checkout_id:wave.id,provider_checkout_url:wave.wave_launch_url,updated_at:new Date().toISOString()}).eq('id',resourceId)
          :await admin.from('school_subscriptions').update({wave_checkout_id:wave.id,updated_at:new Date().toISOString()}).eq('id',resourceId)
    if(update.error)throw update.error

    return json(res,200,{wave_launch_url:wave.wave_launch_url,checkout_id:wave.id,reference:clientReference})
  }catch(error:any){return json(res,500,{error:error?.message||'Impossible de créer le paiement.'})}
}

export default withSecurity('/api/wave/checkout', handler)
