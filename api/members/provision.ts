import { env } from '../../server/env.js'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { withSecurity } from '../../server/security.js'
type MemberRole='student'|'parent'|'teacher'|'admin'|'cafeteria'
type MemberInput={role:MemberRole;full_name:string;email?:string;phone?:string;student_code?:string;external_ref?:string;parent?:{full_name:string;email:string;phone?:string};metadata?:Record<string,unknown>}

function json(res:VercelResponse,status:number,body:unknown){return res.status(status).json(body)}
function normalizeEmail(value?:string){const v=String(value||'').trim().toLowerCase();return v||null}
function server(){
  if(!env('SUPABASE_URL')||!env('SUPABASE_SECRET_KEY'))throw new Error('Supabase serveur non configuré.')
  return createClient(env('SUPABASE_URL'),env('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
}
async function context(req:VercelRequest){
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
async function findUserId(admin:any,email:string){
  const {data,error}=await admin.rpc('find_auth_user_by_email',{p_email:email})
  if(error)throw error
  return data as string|null
}
async function upsertEnrollment(admin:any,schoolId:string,createdBy:string,input:MemberInput){
  const email=normalizeEmail(input.email)
  const payload={
    school_id:schoolId,role:input.role,full_name:String(input.full_name||'').trim(),email,
    phone:String(input.phone||'').trim()||null,student_code:String(input.student_code||'').trim()||null,
    external_ref:String(input.external_ref||'').trim()||null,created_by:createdBy,metadata:input.metadata||{},
    updated_at:new Date().toISOString()
  }
  if(!payload.full_name)throw new Error('Nom complet requis.')
  let existing:any=null
  if(payload.student_code){
    const q=await admin.from('school_enrollments').select('*').eq('school_id',schoolId).eq('student_code',payload.student_code).maybeSingle()
    if(q.error)throw q.error
    existing=q.data
  }
  if(!existing&&email){
    const q=await admin.from('school_enrollments').select('*').eq('school_id',schoolId).ilike('email',email).maybeSingle()
    if(q.error)throw q.error
    existing=q.data
  }
  if(existing){
    if(existing.linked_user_id&&existing.role!==input.role)throw new Error('Cette personne possède déjà un compte lié avec un autre rôle.')
    const q=await admin.from('school_enrollments').update(payload).eq('id',existing.id).select('*').single()
    if(q.error)throw q.error
    return q.data
  }
  const q=await admin.from('school_enrollments').insert(payload).select('*').single()
  if(q.error)throw q.error
  return q.data
}
async function inviteAndLink(admin:any,enrollment:any){
  if(!enrollment.email)return {invited:false,linked:false,user_id:null as string|null}
  const existingUser=await findUserId(admin,enrollment.email)
  let userId=existingUser
  let invited=false
  if(existingUser){
    const profile=await admin.from('profiles').select('id,school_id,role').eq('id',existingUser).maybeSingle()
    if(profile.error)throw profile.error
    if(profile.data?.school_id&&profile.data.school_id!==enrollment.school_id)throw new Error('Ce compte appartient déjà à un autre établissement.')
    if(profile.data?.role&&profile.data.role!==enrollment.role)throw new Error('Ce compte existe déjà avec le rôle '+profile.data.role+'.')
  }
  if(!userId){
    const base=String(env('APP_URL')||'').replace(/\/$/,'')
    const options:any={data:{full_name:enrollment.full_name,role:enrollment.role,school_id:enrollment.school_id,enrollment_id:enrollment.id}}
    if(base)options.redirectTo=base+'/'
    const invite=await admin.auth.admin.inviteUserByEmail(enrollment.email,options)
    if(invite.error)throw invite.error
    userId=invite.data.user?.id||null
    invited=true
  }
  if(!userId)throw new Error('Le compte Auth n’a pas pu être préparé.')
  const {error:linkError}=await admin.rpc('link_profile_to_enrollment',{p_enrollment_id:enrollment.id,p_user_id:userId})
  if(linkError)throw linkError
  if(invited)await admin.from('school_enrollments').update({status:'invited',invited_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',enrollment.id).eq('linked_user_id',userId)
  return {invited,linked:true,user_id:userId}
}
async function ensureParent(admin:any,schoolId:string,createdBy:string,parent:NonNullable<MemberInput['parent']>){
  return upsertEnrollment(admin,schoolId,createdBy,{role:'parent',full_name:parent.full_name,email:parent.email,phone:parent.phone,metadata:{source:'student_import'}})
}

async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
  try{
    const {admin,profile}=await context(req)
    const body=req.body||{}
    const invite=body.invite!==false
    const importId=String(body.import_id||'').trim()||null
    const members=Array.isArray(body.members)?body.members:[body]
    if(!members.length||members.length>200)return json(res,400,{error:'Entre 1 et 200 personnes par opération.'})

    if(importId){
      const job=await admin.from('school_member_imports').select('id,school_id,status').eq('id',importId).maybeSingle()
      if(job.error)throw job.error
      if(!job.data||job.data.school_id!==profile.school_id)return json(res,404,{error:'Import introuvable pour cet établissement.'})
      await admin.from('school_member_imports').update({status:'processing'}).eq('id',importId)
    }

    const allowed:MemberRole[]=['student','parent','teacher','admin','cafeteria']
    const results:any[]=[]
    for(let idx=0;idx<members.length;idx++){
      const raw=members[idx]||{}
      const input=raw as MemberInput
      const line=Number(raw.line||raw.line_number||idx+2)
      try{
        if(!allowed.includes(input.role))throw new Error('Rôle non autorisé pour cet endpoint.')
        const cleanName=String(input.full_name||'').trim()
        if(cleanName.length<2||cleanName.length>140)throw new Error('Nom complet invalide.')
        const email=normalizeEmail(input.email)
        if(input.email&&!email)throw new Error('Adresse email invalide.')
        if(email&&email.length>180)throw new Error('Adresse email trop longue.')
        const code=String(input.student_code||'').trim()
        if(code.length>80)throw new Error('Code élève trop long.')
        if(input.role==='student'&&input.parent){
          const parentEmail=normalizeEmail(input.parent.email)
          if(!parentEmail)throw new Error('Email du parent requis pour créer le rattachement.')
          if(!input.parent.full_name||String(input.parent.full_name).trim().length<2)throw new Error('Nom du parent invalide.')
        }

        const normalized:MemberInput={
          ...input,
          full_name:cleanName,
          email:email||undefined,
          phone:String(input.phone||'').trim()||undefined,
          student_code:code||undefined,
          parent:input.parent?{
            full_name:String(input.parent.full_name||'').trim(),
            email:normalizeEmail(input.parent.email)||'',
            phone:String(input.parent.phone||'').trim()||undefined
          }:undefined
        }

        const enrollment=await upsertEnrollment(admin,profile.school_id,profile.id,normalized)
        let parentEnrollment:any=null
        if(normalized.role==='student'&&normalized.parent?.email){
          parentEnrollment=await ensureParent(admin,profile.school_id,profile.id,normalized.parent)
          const link=await admin.from('school_enrollment_links').upsert({
            school_id:profile.school_id,
            parent_enrollment_id:parentEnrollment.id,
            student_enrollment_id:enrollment.id
          },{onConflict:'parent_enrollment_id,student_enrollment_id'})
          if(link.error)throw link.error
        }

        let account={invited:false,linked:false,user_id:null as string|null}
        if(invite&&enrollment.email)account=await inviteAndLink(admin,enrollment)
        if(parentEnrollment?.email&&invite)await inviteAndLink(admin,parentEnrollment)
        if(parentEnrollment?.linked_user_id&&enrollment.linked_user_id){
          const family=await admin.rpc('sync_enrollment_family_links',{p_enrollment_id:enrollment.id})
          if(family.error)throw family.error
        }

        const rowStatus=account.invited?'invited':account.linked?'linked':'created'
        if(importId){
          await admin.from('school_member_import_rows').update({
            status:rowStatus,enrollment_id:enrollment.id,user_id:account.user_id||enrollment.linked_user_id||null,
            processed_at:new Date().toISOString(),errors:[],warnings:[]
          }).eq('import_id',importId).eq('line_number',line)
        }
        results.push({ok:true,line,id:enrollment.id,role:enrollment.role,full_name:enrollment.full_name,email:enrollment.email,status:rowStatus,invited:account.invited,linked:account.linked,parent_enrollment_id:parentEnrollment?.id||null})
      }catch(error:any){
        const message=error?.message||'Erreur d’enregistrement.'
        if(importId)await admin.from('school_member_import_rows').update({status:'error',errors:[message],processed_at:new Date().toISOString()}).eq('import_id',importId).eq('line_number',line)
        results.push({ok:false,line,error:message,input:raw})
      }
    }

    if(importId){
      const successCount=results.filter(x=>x.ok).length
      const failureCount=results.length-successCount
      await admin.from('school_member_imports').update({
        status:'completed',
        success_count:successCount,
        failure_count:failureCount,
        completed_at:new Date().toISOString()
      }).eq('id',importId).eq('school_id',profile.school_id)
    }

    return json(res,200,{school_id:profile.school_id,import_id:importId,results})
  }catch(error:any){return json(res,error?.status||500,{error:error?.message||'Erreur serveur.'})}
}

export default withSecurity('/api/members/provision', handler)
