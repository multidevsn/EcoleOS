import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
export const config={api:{bodyParser:false}}
async function rawBody(req:VercelRequest){
  const chunks:Uint8Array[]=[]
  for await(const chunk of req as AsyncIterable<Uint8Array|string>){
    chunks.push(typeof chunk==='string'?new TextEncoder().encode(chunk):new Uint8Array(chunk))
  }
  const total=chunks.reduce((sum,chunk)=>sum+chunk.byteLength,0)
  const merged=new Uint8Array(total)
  let offset=0
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder().decode(merged)
}

function bytesToHex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function constantTimeHexEqual(a:string,b:string){
  if(a.length!==b.length)return false
  let diff=0
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i)
  return diff===0
}

async function validSignature(body:string,header:string,secret:string){
  const m=header.match(/t=(\d+),v1=([a-f0-9]+)/);if(!m)return false
  const ts=Number(m[1]);if(!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>300)return false
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(ts)+body))
  return constantTimeHexEqual(bytesToHex(new Uint8Array(signature)),m[2])
}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return res.status(405).end()
  const body=await rawBody(req)
  const signature=String(req.headers['wave-signature']||'')
  if(!process.env.WAVE_WEBHOOK_SECRET||!(await validSignature(body,signature,process.env.WAVE_WEBHOOK_SECRET)))return res.status(401).json({error:'Invalid signature'})
  let event:any
  try{event=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid JSON'})}

  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY)return res.status(503).json({error:'Supabase secret server key non configurée.'})
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY)

  try{
    // Idempotence : le même événement Wave ne doit pas être appliqué deux fois.
    const {data:existing}=await admin.from('wave_events').select('id').eq('id',event.id).maybeSingle()
    if(existing)return res.status(200).json({received:true,event_id:event.id,duplicate:true})
    await admin.from('wave_events').insert({id:event.id,event_type:event.type,payload:event})

    const data=event.data||{}
    const reference=String(data.client_reference||'')
    if(reference.startsWith('food-order:')){
      const orderId=reference.slice('food-order:'.length)
      const status=event.type==='checkout.session.completed'&&data.payment_status==='succeeded'?'paid':event.type==='checkout.session.payment_failed'?'cancelled':null
      if(status)await admin.from('food_orders').update({status,wave_transaction_id:data.transaction_id||null}).eq('id',orderId)
    }else if(reference.startsWith('school-payment:')){
      const paymentId=reference.slice('school-payment:'.length)
      let status:'succeeded'|'failed'='failed'
      if(event.type==='checkout.session.completed'&&data.payment_status==='succeeded')status='succeeded'
      else if(event.type!=='checkout.session.payment_failed')status='failed'
      await admin.from('school_payments').update({status,wave_transaction_id:data.transaction_id||null}).eq('id',paymentId)
    }else if(reference.startsWith('billing-cycle:')){
      const cycleId=reference.slice('billing-cycle:'.length)
      if(event.type==='checkout.session.completed'&&data.payment_status==='succeeded'){
        const {data:cycle}=await admin.from('billing_cycles').select('id,school_id,period_end,amount_xof').eq('id',cycleId).maybeSingle()
        if(cycle){
          await admin.from('billing_cycles').update({status:'paid',paid_at:new Date().toISOString(),provider_checkout_id:data.id||null,updated_at:new Date().toISOString()}).eq('id',cycleId)
          await admin.from('school_subscriptions').update({status:'active',current_period_end:cycle.period_end,wave_transaction_id:data.transaction_id||null,updated_at:new Date().toISOString()}).eq('school_id',cycle.school_id)
          const {data:subForReferral}=await admin.from('school_subscriptions').select('id,referral_id').eq('school_id',cycle.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
          if(subForReferral?.referral_id){
            await admin.from('referrals').update({status:'qualified',qualified_at:new Date().toISOString()}).eq('id',subForReferral.referral_id).eq('status','pending')
            const {data:referral}=await admin.from('referrals').select('id,referrer_id').eq('id',subForReferral.referral_id).maybeSingle()
            if(referral){
              const {data:refProfile}=await admin.from('profiles').select('school_id').eq('id',referral.referrer_id).maybeSingle()
              const {data:simple}=await admin.from('subscription_plans').select('price_xof').eq('id','simple').single()
              if(refProfile?.school_id&&simple){
                await admin.from('school_subscriptions').update({plan:'extra',billing_price_xof:Number(simple.price_xof),updated_at:new Date().toISOString()}).eq('school_id',refProfile.school_id).eq('status','active')
                await admin.from('referrals').update({status:'rewarded',rewarded_at:new Date().toISOString()}).eq('id',referral.id)
              }
            }
          }
          await admin.from('autopilot_events').insert({school_id:cycle.school_id,event_type:'payment_received',severity:'info',message:'Cycle de facturation réglé via Wave.',metadata:{cycle_id:cycleId,amount_xof:cycle.amount_xof}})
        }
      }else if(event.type==='checkout.session.payment_failed'){
        const {data:cycle}=await admin.from('billing_cycles').select('school_id').eq('id',cycleId).maybeSingle()
        await admin.from('billing_cycles').update({status:'past_due',updated_at:new Date().toISOString()}).eq('id',cycleId)
        if(cycle?.school_id)await admin.from('autopilot_events').insert({school_id:cycle.school_id,event_type:'payment_failed',severity:'warning',message:'Le paiement du cycle a échoué. Le système le maintient en attente.',metadata:{cycle_id:cycleId}})
      }
    }else if(reference.startsWith('subscription:')){
      const subscriptionId=reference.slice('subscription:'.length)
      if(event.type==='checkout.session.completed'&&data.payment_status==='succeeded'){
        const {data:sub}=await admin.from('school_subscriptions').select('id,school_id,referral_id').eq('id',subscriptionId).maybeSingle()
        await admin.from('school_subscriptions').update({status:'active',wave_transaction_id:data.transaction_id||null,current_period_end:new Date(Date.now()+31*24*60*60*1000).toISOString().slice(0,10),updated_at:new Date().toISOString()}).eq('id',subscriptionId)
        if(sub?.referral_id){
          await admin.from('referrals').update({status:'qualified',qualified_at:new Date().toISOString()}).eq('id',sub.referral_id).eq('status','pending')
          const {data:referral}=await admin.from('referrals').select('id,referrer_id').eq('id',sub.referral_id).maybeSingle()
          if(referral){
            const {data:refProfile}=await admin.from('profiles').select('school_id').eq('id',referral.referrer_id).maybeSingle()
            const {data:simple}=await admin.from('subscription_plans').select('price_xof').eq('id','simple').single()
            if(refProfile?.school_id&&simple){
              await admin.from('school_subscriptions').update({plan:'extra',billing_price_xof:Number(simple.price_xof),updated_at:new Date().toISOString()}).eq('school_id',refProfile.school_id).eq('status','active')
              await admin.from('referrals').update({status:'rewarded',rewarded_at:new Date().toISOString()}).eq('id',referral.id)
            }
          }
        }
      }else if(event.type==='checkout.session.payment_failed'){
        await admin.from('school_subscriptions').update({status:'past_due',wave_transaction_id:data.transaction_id||null,updated_at:new Date().toISOString()}).eq('id',subscriptionId)
      }
    }else if(data.id){
      // Filet de sécurité si une référence personnalisée n'est pas présente.
      await admin.from('food_orders').update({status:'paid',wave_transaction_id:data.transaction_id||null}).eq('wave_checkout_id',data.id).eq('status','pending')
      await admin.from('school_payments').update({status:'succeeded',wave_transaction_id:data.transaction_id||null}).eq('wave_checkout_id',data.id).eq('status','pending')
      await admin.from('school_subscriptions').update({status:'active',wave_transaction_id:data.transaction_id||null,updated_at:new Date().toISOString()}).eq('wave_checkout_id',data.id).eq('status','pending')
    }
    return res.status(200).json({received:true,event_id:event.id})
  }catch(error:any){return res.status(500).json({error:error?.message||'Webhook processing error'})}
}

export default withSecurity('/api/wave/webhook', handler)
