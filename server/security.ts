import { env } from './env.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function adminClient(){
  const url=env('SUPABASE_URL')
  const key=env('SUPABASE_SECRET_KEY')
  if(!url||!key)return null
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}

async function hash(value:string){
  const salt=env('SECURITY_HASH_SALT')||'ecole-os-security-default-salt'
  const input=new TextEncoder().encode(`${salt}:${value}`)
  const digest=await crypto.subtle.digest('SHA-256',input)
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}

export function requestId(req:VercelRequest){
  const incoming=String(req.headers['x-request-id']||'').trim()
  return incoming.slice(0,120)||crypto.randomUUID()
}

export async function securityHashes(req:VercelRequest){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim()
  const real=String(req.headers['x-real-ip']||'').trim()
  const ip=forwarded||real||'unknown'
  const ua=String(req.headers['user-agent']||'unknown')
  return {ipHash:await hash(ip),userAgentHash:await hash(ua)}
}

export async function recordSecurityEvent(req:VercelRequest,input:{eventType:string;severity?:'info'|'warning'|'critical';actorUserId?:string|null;schoolId?:string|null;statusCode?:number;route?:string;metadata?:Record<string,unknown>;requestId?:string}){
  try{
    const admin=adminClient(); if(!admin)return
    const {ipHash,userAgentHash}=await securityHashes(req)
    const severity=input.severity||'info'
    await admin.rpc('security_record_event',{
      p_event_type:input.eventType,
      p_severity:severity,
      p_actor:input.actorUserId||null,
      p_school:input.schoolId||null,
      p_ip_hash:ipHash,
      p_user_agent_hash:userAgentHash,
      p_route:(input.route||'').slice(0,180),
      p_method:String(req.method||'').slice(0,12),
      p_status:input.statusCode||null,
      p_request_id:(input.requestId||requestId(req)).slice(0,120),
      p_metadata:input.metadata||{},
    })
    if(input.eventType==='auth_denied'||input.eventType==='access_denied'||input.eventType==='api_error'){
      const threshold=input.eventType==='auth_denied'?8:6
      const since=new Date(Date.now()-10*60*1000).toISOString()
      const {count}=await admin.from('security_events').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).eq('event_type',input.eventType).gte('created_at',since)
      if((count||0)>=threshold){
        const signature=`${input.eventType}:${ipHash}`
        const {data:existing}=await admin.from('security_alerts').select('id,occurrences').eq('signature',signature).eq('status','open').maybeSingle()
        const evidence={count_10m:count,route:input.route||null,ip_hash:ipHash,request_id:input.requestId||null}
        if(existing?.id){
          await admin.from('security_alerts').update({occurrences:Number(existing.occurrences||0)+1,last_seen_at:new Date().toISOString(),updated_at:new Date().toISOString(),evidence}).eq('id',existing.id)
        }else{
          await admin.from('security_alerts').insert({severity:'warning',alert_type:input.eventType,signature,summary:'Répétition anormale détectée depuis une même source.',evidence})
        }
      }
    }
  }catch{
    // Security telemetry must never break the product request.
  }
}

type Handler=(req:VercelRequest,res:VercelResponse,meta:{requestId:string;route:string})=>Promise<void>|void

export function withSecurity(route:string,handler:Handler){
  return async (req:VercelRequest,res:VercelResponse)=>{
    const rid=requestId(req)
    const started=Date.now()
    let finalized=false
    const originalEnd=res.end.bind(res)
    ;(res as any).end=(...args:any[])=>{
      if(!finalized){
        finalized=true
        void recordSecurityEvent(req,{eventType:res.statusCode>=500?'api_error':res.statusCode===401?'auth_denied':res.statusCode===403?'access_denied':'api_response',severity:res.statusCode>=500?'critical':(res.statusCode===401||res.statusCode===403)?'warning':'info',statusCode:res.statusCode,route,requestId:rid,metadata:{duration_ms:Date.now()-started}})
      }
      return originalEnd(...args)
    }
    try{
      await handler(req,res,{requestId:rid,route})
    }finally{
      if(!finalized){
        finalized=true
        void recordSecurityEvent(req,{eventType:res.statusCode>=500?'api_error':res.statusCode===401?'auth_denied':res.statusCode===403?'access_denied':'api_response',severity:res.statusCode>=500?'critical':(res.statusCode===401||res.statusCode===403)?'warning':'info',statusCode:res.statusCode,route,requestId:rid,metadata:{duration_ms:Date.now()-started}})
      }
    }
  }
}
