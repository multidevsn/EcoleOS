import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

import { withSecurity } from '../../server/security.js'
type Member={
  role?:string
  full_name?:string
  email?:string
  phone?:string
  student_code?:string
  parent?:{full_name?:string;email?:string;phone?:string}
}

const allowedRoles=new Set(['student','parent','teacher','admin','cafeteria'])
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}
function server(){
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))throw new Error('Supabase serveur non configuré.')
  return createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
}
async function actor(req:VercelRequest){
  const auth=String(req.headers.authorization||'');const token=auth.startsWith('Bearer ')?auth.slice(7):''
  if(!token)throw Object.assign(new Error('Authentification requise.'),{status:401})
  const admin=server();const {data,error}=await admin.auth.getUser(token)
  if(error||!data.user)throw Object.assign(new Error('Session invalide.'),{status:401})
  const {data:profile,error:profileError}=await admin.from('profiles').select('id,school_id,role').eq('id',data.user.id).single()
  if(profileError||!profile)throw Object.assign(new Error('Profil introuvable.'),{status:400})
  if(!['admin','director'].includes(profile.role)||!profile.school_id)throw Object.assign(new Error('Accès réservé à la direction et à l’administration.'),{status:403})
  return {admin,user:data.user,profile}
}
function normalizeEmail(v?:string){const x=String(v||'').trim().toLowerCase();return x||null}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
  try{
    const {admin,profile,user}=await actor(req)
    const body=req.body||{}
    const members=Array.isArray(body.members)?body.members:[]
    const sourceName=String(body.source_name||'').trim().slice(0,180)||null
    if(!members.length||members.length>200)return json(res,400,{error:'Entre 1 et 200 lignes sont acceptées.'})

    const emails=members.map((x:Member)=>normalizeEmail(x.email)).filter(Boolean) as string[]
    const studentCodes=members.map((x:Member)=>String(x.student_code||'').trim()).filter(Boolean)
    const existingByEmail=new Set<string>()
    const existingByCode=new Set<string>()
    if(emails.length){
      const q=await admin.from('school_enrollments').select('email').eq('school_id',profile.school_id).in('email',emails)
      if(q.error)throw q.error
      ;(q.data||[]).forEach((r:any)=>r.email&&existingByEmail.add(String(r.email).toLowerCase()))
    }
    if(studentCodes.length){
      const q=await admin.from('school_enrollments').select('student_code').eq('school_id',profile.school_id).in('student_code',studentCodes)
      if(q.error)throw q.error
      ;(q.data||[]).forEach((r:any)=>r.student_code&&existingByCode.add(String(r.student_code)))
    }

    const emailSeen=new Map<string,number>()
    const codeSeen=new Map<string,number>()
    const results:any[]=[]
    for(let idx=0;idx<members.length;idx++){
      const m=members[idx]||{}
      const line=Number(m.line_number||idx+2)
      const errors:string[]=[];const warnings:string[]=[]
      const role=String(m.role||'student').trim().toLowerCase()
      const name=String(m.full_name||'').trim()
      const email=normalizeEmail(m.email)
      const code=String(m.student_code||'').trim()
      if(!allowedRoles.has(role))errors.push('Rôle invalide.')
      if(name.length<2||name.length>140)errors.push('Nom complet invalide.')
      if(email&&(!emailRe.test(email)||email.length>180))errors.push('Adresse email invalide.')
      if(role==='student'&&!code)warnings.push('Code élève absent : un code stable est recommandé.')
      if(code.length>80)errors.push('Code élève trop long.')
      if(role!=='student'&&code)warnings.push('Le code élève sera ignoré pour ce rôle.')
      if(role==='student'&&m.parent){
        const parentName=String(m.parent.full_name||'').trim()
        const parentEmail=normalizeEmail(m.parent.email)
        if(!parentEmail)errors.push('Email du parent requis pour créer le rattachement.')
        else if(!emailRe.test(parentEmail)||parentEmail.length>180)errors.push('Email du parent invalide.')
        if(parentName.length<2)warnings.push('Nom du parent non renseigné.')
        if(email&&parentEmail===email)errors.push('L’élève et son parent ne peuvent pas utiliser le même email.')
      }
      if(email){
        const prev=emailSeen.get(email)
        if(prev)errors.push('Doublon email dans le fichier (ligne '+prev+').')
        else emailSeen.set(email,line)
        if(existingByEmail.has(email))warnings.push('Cette adresse existe déjà dans cet établissement : le compte sera réconcilié, pas recréé.')
      }
      if(code){
        const prev=codeSeen.get(code)
        if(prev)errors.push('Doublon code élève dans le fichier (ligne '+prev+').')
        else codeSeen.set(code,line)
        if(existingByCode.has(code))warnings.push('Ce code élève existe déjà : l’enregistrement sera mis à jour.')
      }
      results.push({line,valid:errors.length===0,errors,warnings,payload:{role,full_name:name,email,phone:String(m.phone||'').trim(),student_code:code,parent:m.parent?{full_name:String(m.parent.full_name||'').trim(),email:normalizeEmail(m.parent.email)||'',phone:String(m.parent.phone||'').trim()}:undefined}})
    }

    const validCount=results.filter(x=>x.valid).length
    const {data:job,error:jobError}=await admin.from('school_member_imports').insert({
      school_id:profile.school_id,created_by:user.id,source_name:sourceName,row_count:results.length,valid_count:validCount,
      status:'ready',metadata:{validation:'server',invalid_count:results.length-validCount}
    }).select('id').single()
    if(jobError)throw jobError

    const rows=results.map(x=>({
      import_id:job.id,line_number:x.line_number,payload:x.payload,status:x.valid?'valid':'error',
      errors:x.errors,warnings:x.warnings
    }))
    const {error:rowsError}=await admin.from('school_member_import_rows').insert(rows)
    if(rowsError)throw rowsError

    return json(res,200,{import_id:job.id,row_count:results.length,valid_count:validCount,invalid_count:results.length-validCount,results})
  }catch(error:any){return json(res,error?.status||500,{error:error?.message||'Erreur de validation.'})}
}

export default withSecurity('/api/members/validate', handler)
