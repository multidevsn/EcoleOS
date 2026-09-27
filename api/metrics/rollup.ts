import type {VercelRequest,VercelResponse} from '@vercel/node'
import {createClient} from '@supabase/supabase-js'

import { withSecurity } from '../../server/security'
async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'})
  const auth=req.headers.authorization
  if(auth!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'})
  const url=process.env.SUPABASE_URL
  const serviceKey=process.env.SUPABASE_SECRET_KEY
  if(!url||!serviceKey)return res.status(500).json({error:'Missing server configuration'})
  const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const day=new Date(Date.now()-86400000).toISOString().slice(0,10)
  const {error}=await supabase.rpc('rollup_usage',{p_day:day})
  if(error)return res.status(500).json({error:error.message})
  return res.status(200).json({ok:true,day})
}

export default withSecurity('/api/metrics/rollup', handler)
