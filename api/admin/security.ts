import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security'

function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}

export default withSecurity('/api/admin/security', async (req,res)=>{
  if(req.method!=='GET') return json(res,405,{error:'Method not allowed'})
  const supabaseUrl=process.env.SUPABASE_URL
  const serviceKey=process.env.SUPABASE_SECRET_KEY
  if(!supabaseUrl||!serviceKey)return json(res,503,{error:'Supabase serveur non configuré.'})
  const auth=String(req.headers.authorization||'')
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)return json(res,401,{error:'Authentification requise.'})
  const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:userData,error:userError}=await admin.auth.getUser(token)
  if(userError||!userData.user)return json(res,401,{error:'Session invalide.'})
  const emails=(process.env.PLATFORM_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
  if(!emails.includes(String(userData.user.email||'').toLowerCase())) return json(res,403,{error:'Accès réservé à l’admin technique.'})
  const {data,error}=await admin.rpc('security_get_summary',{p_hours:24})
  if(error)return json(res,500,{error:error.message})
  return json(res,200,{ok:true,...data})
})
