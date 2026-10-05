import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'
export const config={api:{bodyParser:false}}

async function rawBody(req:VercelRequest){
  const chunks:Uint8Array[]=[]
  for await(const chunk of req as AsyncIterable<Uint8Array|string>)chunks.push(typeof chunk==='string'?new TextEncoder().encode(chunk):new Uint8Array(chunk))
  const size=chunks.reduce((n,x)=>n+x.byteLength,0),merged=new Uint8Array(size)
  let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder().decode(merged)
}
function hex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function validSignature(body:string,header:string,secret:string){
  const parsed=header.match(/(?:^|;)\s*ts=(\d+);\s*h1=([a-f0-9]+)/)
  if(!parsed)return false
  const timestamp=Number(parsed[1]);if(!Number.isFinite(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)return false
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}:${body}`))
  return safeEqual(hex(new Uint8Array(signature)),parsed[2])
}
async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return res.status(405).end()
  const body=await rawBody(req),secret=env('PADDLE_WEBHOOK_SECRET')
  if(!secret||!(await validSignature(body,String(req.headers['paddle-signature']||''),secret)))return res.status(401).json({error:'Invalid signature'})
  let event:any;try{event=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid JSON'})}
  if(!event?.event_id||!event?.event_type)return res.status(400).json({error:'Invalid Paddle event'})
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))return res.status(503).json({error:'Supabase serveur non configuré.'})
  const admin=createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'))
  try{
    const {error:insertError}=await admin.from('paddle_events').insert({id:event.event_id,event_type:event.event_type,payload:event})
    if(insertError){if(insertError.code==='23505'){const {data:seen,error:seenError}=await admin.from('paddle_events').select('processed_at').eq('id',event.event_id).maybeSingle();if(seenError)throw seenError;if(seen?.processed_at)return res.status(200).json({received:true,duplicate:true,event_id:event.event_id})}else throw insertError}
    const data=event.data||{},custom=data.custom_data||{}
    const subscriptionId=String(custom.school_subscription_id||'')
    const schoolId=String(custom.school_id||'')
    const paddleSubscriptionId=String(data.id||data.subscription_id||'')
    const customerId=String(data.customer_id||'')
    const rawStatus=String(data.status||'')
    const mappedStatus=rawStatus==='active'||event.event_type==='subscription.activated'?'active':rawStatus==='past_due'||event.event_type==='subscription.past_due'?'past_due':rawStatus==='canceled'||event.event_type==='subscription.canceled'?'cancelled':null
    const supported=/^subscription\.(created|activated|updated|past_due|canceled)$/.test(event.event_type)
    if(supported&&mappedStatus){
      let query=admin.from('school_subscriptions').update({billing_provider:'paddle',paddle_subscription_id:paddleSubscriptionId||null,paddle_customer_id:/^ctm_[A-Za-z0-9]+$/.test(customerId)?customerId:null,current_period_end:data.current_billing_period?.ends_at?String(data.current_billing_period.ends_at).slice(0,10):undefined,status:mappedStatus,updated_at:new Date().toISOString()})
      if(subscriptionId&&schoolId)query=query.eq('id',subscriptionId).eq('school_id',schoolId)
      else if(paddleSubscriptionId)query=query.eq('paddle_subscription_id',paddleSubscriptionId)
      else return res.status(200).json({received:true,ignored:true,event_id:event.event_id})
      const {error}=await query;if(error)throw error
    }
    await admin.from('paddle_events').update({processed_at:new Date().toISOString()}).eq('id',event.event_id)
    return res.status(200).json({received:true,event_id:event.event_id})
  }catch(error:any){return res.status(500).json({error:error?.message||'Paddle webhook processing error'})}
}
export default withSecurity('/api/paddle/webhook',handler)


