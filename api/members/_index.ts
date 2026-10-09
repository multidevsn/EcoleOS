import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}

function server(){
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))throw new Error('Supabase serveur non configuré.')
  return createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
}

async function actor(req:VercelRequest){
  const auth=String(req.headers.authorization||'')
  const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)throw Object.assign(new Error('Authentification requise.'),{status:401})
  const admin=server()
  const {data,error}=await admin.auth.getUser(token)
  if(error||!data.user)throw Object.assign(new Error('Session invalide.'),{status:401})
  const {data:profile,error:profileError}=await admin.from('profiles').select('id,school_id,role,full_name').eq('id',data.user.id).single()
  if(profileError||!profile)throw Object.assign(new Error('Profil introuvable.'),{status:400})
  if(!['admin','director'].includes(profile.role)||!profile.school_id)throw Object.assign(new Error('Accès réservé à la direction et à l’administration.'),{status:403})
  return {admin,user:data.user,profile}
}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='GET')return json(res,405,{error:'Method not allowed'})
  try{
    const {admin,profile}=await actor(req)
    const {data,error}=await admin
      .from('school_enrollments')
      .select('id,role,full_name,email,phone,student_code,external_ref,status,linked_user_id,created_at,updated_at,invited_at,linked_at,metadata')
      .eq('school_id',profile.school_id)
      .order('created_at',{ascending:false})
    if(error)return json(res,500,{error:error.message})
    const rows=Array.isArray(data)?data:[]
    const counts=rows.reduce<Record<string,number>>((acc,row:{role:string})=>{acc[row.role]=(acc[row.role]||0)+1;return acc},{})
    return json(res,200,{school_id:profile.school_id,counts,rows})
  }catch(error:any){
    return json(res,error?.status||500,{error:error?.message||'Erreur serveur.'})
  }
}

export default withSecurity('/api/members', handler)
