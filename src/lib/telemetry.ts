import {supabase} from './supabase'

type UsageMetadata=Record<string,unknown>

export async function trackUsage(metric:string,quantity=1,metadata:UsageMetadata={}){
  try{
    const {data:{session}}=await supabase.auth.getSession()
    if(!session?.user?.id)return
    await fetch('/api/metrics/event',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({metric,quantity,metadata})
    })
  }catch{
    // Telemetry must never block the product UI.
  }
}
