import React, {useEffect, useMemo, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {supabase} from './lib/supabase'
import {trackUsage} from './lib/telemetry'
import {BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Gift, GraduationCap, KeyRound, Landmark, LogOut, Mail, Menu, Package, Save, School, ShieldCheck, ShoppingCart, FileUp, UserPlus, RefreshCw, Check, AlertTriangle, Sparkles, Star, UserRound, Users, UtensilsCrossed, WalletCards, X, Lightbulb, MessageSquarePlus, ThumbsUp, BarChart3, Palette, ListChecks, Gauge, Activity, ServerCog, MessageCircle, Megaphone, Send, Flag, ShieldAlert, Search, Info, UsersRound, LockKeyhole} from 'lucide-react'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import '@fontsource/caveat/600.css'
import './styles.css'

type Role='student'|'parent'|'teacher'|'admin'|'director'|'cafeteria'
type Tab='home'|'food'|'schedule'|'grades'|'payments'|'rewards'|'members'|'agora'|'community'|'pilotage'|'ops'|'account'
type Mode='demo'|'live'
type Theme='cahier'|'epure'|'brume'
type IdeaStatus='new'|'review'|'planned'|'building'|'done'

type CommunityIdea={id:string;title:string;description:string;author_name:string;role:Role;status:IdeaStatus;votes:number;created_at:string;voted?:boolean}
type CommunitySurveyOption={id:string;label:string;votes:number}
type CommunitySurvey={id:string;question:string;description:string;expires_at?:string|null;options:CommunitySurveyOption[];answer?:string|null}
type CommunitySpace={id:string;name:string;description:string;kind:'announcement'|'community';created_at:string;scope_type?:'school'|'role'|'class';scope_key?:string|null;priority?:number;unread_count?:number;latest_body?:string|null;latest_at?:string|null}
type CommunityMessage={id:string;space_id:string;sender_id:string;sender_name:string;sender_role:Role;body:string;created_at:string;mine?:boolean}

type Profile={id:string;full_name:string;role:Role;class_name?:string|null;child_name?:string|null;email:string;school_id?:string|null;student_code?:string|null}
type Grade={id:string;subject:string;value:number;coefficient:number;term:string}
type ScheduleRow={id:string;weekday:number;starts_at:string;ends_at:string;subject:string;room:string;class_name:string}
type Payment={id:string;description:string;amount_xof:number;status:'pending'|'succeeded'|'failed'|'expired';due_date:string}
type PointEvent={id:string;points:number;reason:string;created_at:string}
type FoodItem={id:string;name:string;price_xof:number;active:boolean}
type Order={id:string;total_xof:number;status:string;pickup_date?:string|null;pickup_slot?:string|null;created_at:string}
type Reward={id:string;name:string;points_cost:number;active:boolean;audience_role?:Role|null}
type SchoolInfo={id:string;name:string;city:string;director_id:string}
type SubscriptionInfo={id:string;plan:'simple'|'extra';status:string;billing_price_xof:number;current_period_end?:string|null}
type ReferralInfo={code:string;status?:string}

type AppData={profile:Profile|null;studentId:string|null;school:SchoolInfo|null;subscription:SubscriptionInfo|null;referral:ReferralInfo|null;grades:Grade[];schedule:ScheduleRow[];payments:Payment[];points:PointEvent[];foodItems:FoodItem[];orders:Order[];rewards:Reward[];loading:boolean;error:string|null}

const roleLabels:Record<Role,string>={student:'Élève',parent:'Parent',teacher:'Professeur',admin:'Administration',director:'Directeur',cafeteria:'Cantine'}
const nav:[Tab,string,React.ElementType][]=[['home','Accueil',School],['food','Food',ShoppingCart],['schedule','Emploi du temps',CalendarDays],['grades','Notes',GraduationCap],['payments','Paiements',WalletCards],['rewards','Impact',Gift],['members','Membres',Users],['agora','Agora',Lightbulb],['community','Communauté',MessageCircle],['pilotage','Pilotage',BarChart3],['ops','Ops',ServerCog],['account','Mon compte',UserRound]]
const roleTabs:Record<Role,Tab[]>={student:['home','food','schedule','grades','payments','rewards','agora','community','account'],parent:['home','food','schedule','grades','payments','rewards','agora','community','account'],teacher:['home','schedule','grades','rewards','agora','community','account'],admin:['home','food','schedule','grades','payments','members','rewards','agora','community','account'],director:['home','payments','members','rewards','agora','community','pilotage','account'],cafeteria:['home','food','rewards','agora','community','account']}
const canAccess=(role:Role,tab:Tab)=>roleTabs[role].includes(tab)
const primaryTabs:Record<Role,Tab[]>={
  student:['home','schedule','grades','community','food','payments'],
  parent:['home','schedule','grades','community','food','payments'],
  teacher:['home','schedule','grades','community'],
  admin:['home','community','food','payments','members'],
  director:['home','community','pilotage','payments'],
  cafeteria:['home','food','community'],
}
const navContextLabel:Record<Tab,string>={home:'Votre journée',food:'Services du quotidien',schedule:'Votre planning',grades:'Scolarité',payments:'Finances',rewards:'Contribution & avantages',members:'Équipe & membres',agora:'Évolution d’École OS',community:'Espaces de confiance',pilotage:'Pilotage établissement',ops:'Système & coûts',account:'Préférences'}
const foodCapabilities:Record<Role,{order:boolean;manageMenu:boolean}>={student:{order:true,manageMenu:false},parent:{order:true,manageMenu:false},teacher:{order:false,manageMenu:false},admin:{order:false,manageMenu:true},director:{order:false,manageMenu:false},cafeteria:{order:false,manageMenu:true}}


const demoRoleIds:Record<Role,string>={
  student:'00000000-0000-0000-0000-000000000101',
  parent:'00000000-0000-0000-0000-000000000102',
  teacher:'00000000-0000-0000-0000-000000000103',
  admin:'00000000-0000-0000-0000-000000000104',
  cafeteria:'00000000-0000-0000-0000-000000000105',
  director:'00000000-0000-0000-0000-000000000106',
}

function money(n:number){return new Intl.NumberFormat('fr-FR').format(n)+' FCFA'}
function shortMoney(n:number){return new Intl.NumberFormat('fr-FR').format(n)+' F'}
function avg(grades:Grade[]){const den=grades.reduce((s,g)=>s+Number(g.coefficient),0);return den?grades.reduce((s,g)=>s+Number(g.value)*Number(g.coefficient),0)/den:0}
function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d}
function isoDate(d:Date){return d.toISOString().slice(0,10)}
function nextClass(schedule:ScheduleRow[]){const now=new Date();const day=((now.getDay()+6)%7)+1;const today=schedule.filter(s=>s.weekday===day).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));const time=now.toTimeString().slice(0,5);return today.find(s=>s.ends_at>=time)||today[0]||null}
function firstLetters(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'EO'}
const fr=(n:number,min=0,max=2)=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:min,maximumFractionDigits:max}).format(n)
function mention(avg:number){return avg>=16?'Excellent !':avg>=14?'Très bien':avg>=12?'Bien':avg>=10?'Assez bien':'Peut mieux faire'}
function frToday(){const t=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());return t.charAt(0).toUpperCase()+t.slice(1)}
function shortDate(d:string){const x=new Date(d.length===10?d+'T12:00:00':d);return isNaN(x.getTime())?d:new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(x)}


type CommunityIdeaSuggestion={intent:'idea';confidence:number;title:string;description:string;fingerprint:string}

function detectCommunityIntent(text:string):CommunityIdeaSuggestion|null{
  const normalized=text.trim().replace(/\s+/g,' ')
  if(normalized.length<20)return null
  const lower=normalized.toLowerCase()
  if(/^(j'ai ajouté|je viens d'ajouter|a été ajouté|j’ai ajouté|je viens d’ajouter)/i.test(normalized))return null
  const ideaPatterns=[
    /\bil faudrait\b/,/\bon devrait\b/,/\bon pourrait\b/,/\bce serait (?:bien|utile|possible)\b/,/\bça serait (?:bien|utile|possible)\b/,/\bserait[- ]il possible\b/,/\bpourrait[- ]on\b/,/\bj['’]aimerais (?:qu|que)\b/,/\bje (?:propose|suggère)\b/,/\b(proposition|suggestion|idée)\b/,/\baméliorer(?:ait|er)?\s+(?:la|le|les|une|un|notre|nos)\b/,/\bajouter(?:ait|er)?\s+(?:la|le|les|une|un|des|du|de|à)\b/,/\bpermettre(?:ait)?\s+(?:de|au|aux|à)\b/,/\bmodifier(?:ait|er)?\s+(?:la|le|les|une|un|des|ce|cette)\b/,/\bretirer(?:ait|er)?\s+(?:la|le|les|une|un|des)\b/,/\bmanque(?:nt)?\s+(?:une|un|de|des)\b/
  ]
  const questionOnly=/^(pourquoi|comment|quand|où|qui|est[- ]ce que)\b/i.test(normalized) && !ideaPatterns.some((r)=>r.test(lower))
  if(questionOnly)return null
  const hits=ideaPatterns.reduce((n,r)=>n+(r.test(lower)?1:0),0)
  if(hits===0)return null
  const confidence=Math.min(0.98,0.66+(Math.min(hits,3)-1)*0.1+(normalized.length>55?0.04:0))
  const cleaned=normalized.replace(/^(idée|suggestion|proposition|je propose|je suggère)\s*[:,-]?\s*/i,'')
  const first=(cleaned.split(/[.!?\n]/)[0]||cleaned).trim()
  const title=(first.length>84?first.slice(0,81).trimEnd()+'…':first) || 'Amélioration proposée'
  return {intent:'idea',confidence,title,description:normalized,fingerprint:lower.slice(0,220)}
}
const orderLabels:Record<string,string>={pending:'En attente',paid:'Payée',preparing:'En préparation',ready:'Prête',completed:'Retirée',cancelled:'Annulée'}
const demoBlurb:Record<Role,string>={student:'Cours, notes, Food, points',parent:'Suivi de votre enfant',teacher:'Planning et carnet de notes',admin:'Paiements, Food, notes',director:'Abonnement de l’école',cafeteria:'Menu et commandes'}
const demoIcons:Record<Role,React.ElementType>={student:GraduationCap,parent:Users,teacher:BookOpen,admin:ClipboardList,director:Landmark,cafeteria:UtensilsCrossed}
const readDemoRole=():Role|null=>{try{const r=sessionStorage.getItem('ecole-os-demo-role') as Role|null;return r&&r in roleLabels?r:null}catch{return null}}

const demoCredentials:Record<Role,{email:string;password:string}>= {
  student:{email:'eleve@demo.ecole-os.local',password:'demo1234'},
  parent:{email:'parent@demo.ecole-os.local',password:'demo1234'},
  teacher:{email:'prof@demo.ecole-os.local',password:'demo1234'},
  admin:{email:'admin@demo.ecole-os.local',password:'demo1234'},
  director:{email:'directeur@demo.ecole-os.local',password:'demo1234'},
  cafeteria:{email:'cantine@demo.ecole-os.local',password:'demo1234'},
}

function LogoMark({size=38}:{size?:number}){return <svg className="logo-mark-svg" width={size} height={size} viewBox="0 0 38 38" aria-hidden="true"><rect x="4.5" y="4.5" width="29" height="29" rx="8" fill="none" stroke="currentColor" strokeWidth="2.2"/><path d="M12 13.5h14M12 19h9M12 24.5h14" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/><circle cx="27" cy="19" r="2.15" fill="currentColor"/><path d="M25.2 9.3h3.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>}
function Brand({sub}:{sub?:string}){return <div className="brand"><div className="brand-mark" aria-hidden="true"><LogoMark/></div><div><b>École OS</b>{sub&&<span>{sub}</span>}</div></div>}

class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{
  state:{error:Error|null}={error:null}
  static getDerivedStateFromError(error:Error){return {error}}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('École OS — erreur d’affichage',error,info.componentStack)}
  render(){
    if(!this.state.error)return this.props.children
    return <main className="crash"><div className="auth-card"><Brand/><h1>Une erreur est survenue</h1><p className="muted">Cet écran n’a pas pu s’afficher. Rechargez la page, ou revenez à la connexion.</p><pre>{this.state.error.message}</pre><div className="actions"><button className="primary" onClick={()=>location.reload()}>Recharger la page</button><button className="outline" onClick={()=>{try{sessionStorage.removeItem('ecole-os-demo-role')}catch{}location.href='/'}}>Retour à la connexion</button></div></div></main>
  }
}

function Login({onSchool,onDemo}:{onSchool:()=>void,onDemo:(r:Role)=>void}){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  async function submit(e:React.FormEvent){
    e.preventDefault()
    setLoading(true)
    setError('')
    // Les identifiants de démonstration ouvrent l’espace démo : aucun compte Auth n’est nécessaire.
    const demoRole=(Object.keys(demoCredentials) as Role[]).find(r=>demoCredentials[r].email===email.trim().toLowerCase()&&demoCredentials[r].password===password)
    if(demoRole){setLoading(false);onDemo(demoRole);return}

    const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
    if(error){
      setError(error.message==='Invalid login credentials'?'Email ou mot de passe incorrect.':error.message)
      setLoading(false)
      return
    }

    const pendingRaw=localStorage.getItem('ecole-os-pending-school')
    if(data.session&&pendingRaw){
      try{
        const pending=JSON.parse(pendingRaw)
        const res=await fetch('/api/onboarding/school',{
          method:'POST',
          headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},
          body:JSON.stringify(pending.school)
        })
        const result=await res.json()
        if(!res.ok) throw new Error(result.error||'Impossible de finaliser l’inscription de l’école.')
        localStorage.removeItem('ecole-os-pending-school')
      }catch(e:any){
        setError(e?.message||'Le compte est connecté mais l’inscription de l’école reste à finaliser.')
      }
    }
    setLoading(false)
  }

  return <main className="os-login">
    <header className="os-login-top">
      <Brand sub="système scolaire"/>
      <div className="os-top-status">
        <span><i className="os-status-dot"/>SYSTÈME EN SERVICE</span>
        <b>ACCÈS · 01</b>
      </div>
    </header>

    <div className="os-login-frame">
      <section className="os-command">
        <div className="os-kicker">
          <span><i className="os-status-dot"/>ÉCOLE OS / SYSTÈME SCOLAIRE</span>
          <span className="os-kicker-code">DOSSIER 01</span>
        </div>

        <div className="os-title-row">
          <div className="os-title-copy">
            <div className="os-hand-note">Cahier de vie scolaire</div>
            <h1>Le quotidien de l’école,<br/><em>réuni.</em></h1>
            <p>Cours, notes, cantine, frais et vie scolaire sont regroupés dans un même système. Chaque personne ouvre directement son propre espace.</p>
          </div>
          <div className="os-system-mark" aria-label="École OS, six espaces">
            <span>6 ESPACES</span>
            <b>1 système</b>
            <small>Une seule porte d’entrée.</small>
          </div>
        </div>

        <div className="os-map" aria-label="Espaces de démonstration">
          <div className="os-map-center">
            <div className="os-core-mark"><LogoMark size={46}/></div>
            <span>ÉCOLE OS</span>
            <small>noyau scolaire</small>
          </div>
          <div className="os-map-line os-map-line-a"/>
          <div className="os-map-line os-map-line-b"/>
          <div className="os-map-line os-map-line-c"/>
          <div className="os-map-list">
            {(Object.keys(demoCredentials) as Role[]).map((r,index)=>{
              const I=demoIcons[r]
              return <button type="button" key={r} className="os-space" onClick={()=>onDemo(r)}>
                <span className="os-space-index">{String(index+1).padStart(2,'0')}</span>
                <span className="os-space-icon"><I size={17}/></span>
                <span className="os-space-copy"><b>{roleLabels[r]}</b><small>{demoBlurb[r]}</small></span>
                <ChevronRight size={16} className="os-space-arrow"/>
              </button>
            })}
          </div>
        </div>
      </section>

      <section className="os-access">
        <div className="os-access-head">
          <span>OUVRIR UNE SESSION</span>
          <i>AUTH / 01</i>
        </div>
        <h2>Bienvenue.</h2>
        <p className="os-access-sub">Votre rôle est déterminé par votre compte établissement.</p>

        <form onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@ecole.sn"/></label>
          <label>Mot de passe<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          {error&&<div className="alert error" role="alert">{error}</div>}
          <button className="primary full os-login-submit" disabled={loading}>{loading?'Ouverture…':'Ouvrir mon espace'}<ChevronRight size={18}/></button>
        </form>

        <div className="os-demo-intro">
          <span>APERÇU</span>
          <p>Ouvrir un espace de démonstration sans compte</p>
        </div>

        <button type="button" className="school-signup os-school-signup" onClick={onSchool}><School size={18}/>Inscrire mon école<ChevronRight size={16}/></button>
        <p className="demo-note">La démo utilise des données fictives, en lecture seule. Pour un compte réel, le rôle provient de votre profil établissement.</p>
      </section>
    </div>

    <footer className="os-login-footer">
      <span>ÉCOLE OS · SYSTÈME D’EXPLOITATION SCOLAIRE</span>
      <span>PAIEMENTS PAR WAVE</span>
    </footer>
  </main>
}

async function fetchLiveData(userId:string):Promise<AppData>{
  const empty:AppData={profile:null,studentId:null,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],points:[],foodItems:[],orders:[],rewards:[],loading:false,error:null}
  try{
    const {data:profileRow,error:profileError}=await supabase.from('profiles').select('id,full_name,role,student_code,school_id').eq('id',userId).single()
    if(profileError)throw profileError
    const effectiveRole=profileRow.role as Role
    let studentId: string|null=effectiveRole==='student'?userId:null
    if(effectiveRole==='parent'){
      const {data:links,error}=await supabase.from('parent_students').select('student_id').eq('parent_id',userId).limit(1)
      if(error)throw error
      studentId=links?.[0]?.student_id||null
    }
    let className:string|null=null
    if(studentId){
      const {data:members,error}=await supabase.from('class_members').select('class_id').eq('student_id',studentId).limit(1)
      if(error)throw error
      const classId=members?.[0]?.class_id
      if(classId){
        const {data:classRow,error:classError}=await supabase.from('classes').select('name').eq('id',classId).maybeSingle()
        if(classError)throw classError
        className=classRow?.name||null
      }
    }
    const [subjectsRes,foodRes,rewardRes]=await Promise.all([
      supabase.from('subjects').select('id,name,coefficient'),
      supabase.from('food_items').select('id,name,price_xof,active').eq('active',true).order('name'),
      supabase.from('rewards').select('id,name,points_cost,active,audience_role').eq('active',true).order('points_cost')
    ])
    if(subjectsRes.error)throw subjectsRes.error
    if(foodRes.error)throw foodRes.error
    const subjectMap=Object.fromEntries((subjectsRes.data||[]).map((s:any)=>[s.id,s]))
    // Une panne de lecture des récompenses ne doit jamais bloquer toute l'application.
    // L'écran Impact peut alors afficher un état vide en attendant la correction RLS.
    const rewards=(rewardRes.error?[]:(rewardRes.data||[])) as Reward[]
    let grades:Grade[]=[]
    if(studentId){
      const {data,error}=await supabase.from('grades').select('id,subject_id,value,term,created_at').eq('student_id',studentId).order('created_at',{ascending:false})
      if(error)throw error
      grades=(data||[]).map((g:any)=>({id:g.id,subject:subjectMap[g.subject_id]?.name||'Matière',value:Number(g.value),coefficient:Number(subjectMap[g.subject_id]?.coefficient||1),term:g.term}))
    } else if(effectiveRole==='teacher' || effectiveRole==='admin'){
      const {data,error}=await supabase.from('grades').select('id,subject_id,value,term,created_at').order('created_at',{ascending:false}).limit(50)
      if(error)throw error
      grades=(data||[]).map((g:any)=>({id:g.id,subject:subjectMap[g.subject_id]?.name||'Matière',value:Number(g.value),coefficient:Number(subjectMap[g.subject_id]?.coefficient||1),term:g.term}))
    }
    let schedule:ScheduleRow[]=[]
    if(effectiveRole==='teacher'){
      const {data,error}=await supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').eq('teacher_id',userId).order('weekday').order('starts_at')
      if(error)throw error
      schedule=(data||[]).map((s:any)=>({id:s.id,weekday:s.weekday,starts_at:s.starts_at,ends_at:s.ends_at,subject:subjectMap[s.subject_id]?.name||'Cours',room:s.room,class_name:'Classe'}))
    } else if(studentId){
      const {data:members,error:memberError}=await supabase.from('class_members').select('class_id').eq('student_id',studentId)
      if(memberError)throw memberError
      const classIds=(members||[]).map((m:any)=>m.class_id)
      if(classIds.length){
        const {data,error}=await supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').in('class_id',classIds).order('weekday').order('starts_at')
        if(error)throw error
        schedule=(data||[]).map((s:any)=>({id:s.id,weekday:s.weekday,starts_at:s.starts_at,ends_at:s.ends_at,subject:subjectMap[s.subject_id]?.name||'Cours',room:s.room,class_name:'Classe'}))
      }
    } else {
      const {data,error}=await supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').order('weekday').order('starts_at')
      if(error)throw error
      schedule=(data||[]).map((s:any)=>({id:s.id,weekday:s.weekday,starts_at:s.starts_at,ends_at:s.ends_at,subject:subjectMap[s.subject_id]?.name||'Cours',room:s.room,class_name:'Classe'}))
    }
    let payments:Payment[]=[]
    if(studentId){
      const {data,error}=await supabase.from('school_payments').select('id,description,amount_xof,status,due_date').eq('user_id',studentId).order('due_date',{ascending:false})
      if(error)throw error
      payments=(data||[]) as Payment[]
    } else if(effectiveRole==='admin'){
      const {data,error}=await supabase.from('school_payments').select('id,description,amount_xof,status,due_date').order('due_date',{ascending:false}).limit(30)
      if(error)throw error
      payments=(data||[]) as Payment[]
    }
    let points:PointEvent[]=[]
    {
      const {data,error}=await supabase.from('point_ledger').select('id,points,reason,created_at').eq('user_id',profileRow.id).order('created_at',{ascending:false})
      if(error)throw error
      points=(data||[]) as PointEvent[]
    }
    let orders:Order[]=[]
    if(effectiveRole==='cafeteria'||effectiveRole==='admin'){
      const {data,error}=await supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40)
      if(error)throw error
      orders=(data||[]) as Order[]
    } else {
      const {data,error}=await supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(20)
      if(error)throw error
      orders=(data||[]) as Order[]
    }
    let school:SchoolInfo|null=null; let subscription:SubscriptionInfo|null=null; let referral:ReferralInfo|null=null
    if(effectiveRole==='director' || profileRow.school_id){
      if(profileRow.school_id){
        const [{data:schoolRow},{data:subRow},{data:refRow}]=await Promise.all([
          supabase.from('schools').select('id,name,city,director_id').eq('id',profileRow.school_id).maybeSingle(),
          supabase.from('school_subscriptions').select('id,plan,status,billing_price_xof,current_period_end').eq('school_id',profileRow.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
          supabase.from('referral_codes').select('code').eq('owner_id',userId).maybeSingle()
        ])
        school=schoolRow as SchoolInfo|null; subscription=subRow as SubscriptionInfo|null; referral=refRow as ReferralInfo|null
      }
    }
    return {profile:{id:profileRow.id,full_name:profileRow.full_name,role:effectiveRole,email:'',school_id:profileRow.school_id,student_code:profileRow.student_code,class_name:className},studentId,school,subscription,referral,grades,schedule,payments,points,foodItems:(foodRes.data||[]) as FoodItem[],orders,rewards,loading:false,error:null}
  }catch(e:any){return {...empty,error:e?.message||'Impossible de charger les données.'}}
}

async function fetchDemoData(role:Role):Promise<AppData>{
  const profileId=demoRoleIds[role]
  const studentId=demoRoleIds.student
  try{
    const gradeOwner=(role==='student'||role==='parent'||role==='teacher'||role==='admin')?studentId:profileId
    const scheduleOwner=(role==='teacher')?demoRoleIds.teacher:role==='student'||role==='parent'||role==='admin'?studentId:profileId
    const paymentOwner=(role==='student'||role==='parent')?studentId:role==='admin'?studentId:profileId
    const orderOwner=(role==='student'||role==='parent')?studentId:role==='cafeteria'||role==='admin'?null:profileId
    const pointsOwner=profileId
    const queries=[
      supabase.from('demo_profiles').select('id,full_name,role,class_name,child_name,email').eq('id',profileId).single(),
      supabase.from('demo_grades').select('id,subject,value,coefficient,term').eq('profile_id',gradeOwner).order('value',{ascending:false}),
      supabase.from('demo_schedule').select('id,weekday,starts_at,ends_at,subject,room,class_name').eq('profile_id',scheduleOwner).order('weekday').order('starts_at'),
      supabase.from('demo_payments').select('id,description,amount_xof,status,due_date').eq('profile_id',paymentOwner).order('due_date',{ascending:false}),
      supabase.from('demo_points').select('id,points,reason,created_at').eq('profile_id',pointsOwner).order('created_at',{ascending:false}),
      supabase.from('food_items').select('id,name,price_xof,active').eq('active',true).order('name'),
      orderOwner?supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('profile_id',orderOwner).order('created_at',{ascending:false}):supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}),
      supabase.from('rewards').select('id,name,points_cost,active,audience_role').eq('active',true).order('points_cost'),
      supabase.from('demo_school_accounts').select('school_name,city,plan,status,price_xof,period_end,referral_code').eq('profile_id',profileId).maybeSingle()
    ] as any[]
    const [p,g,s,pa,pt,fi,o,r,ds]=await Promise.all(queries)
    const firstError=[p,g,s,pa,pt,fi,o,ds].find(x=>x.error)
    if(firstError?.error)throw firstError.error
    const demoSchool=ds.data as any
    const demoProfile=p.data as Profile
    return {
      profile:demoProfile,
      studentId:role==='student'||role==='parent'?studentId:null,
      school:demoSchool?{id:'demo-school',name:demoSchool.school_name,city:demoSchool.city,director_id:profileId}:null,
      subscription:demoSchool?{id:'demo-sub',plan:demoSchool.plan,status:demoSchool.status,billing_price_xof:Number(demoSchool.price_xof),current_period_end:demoSchool.period_end}:null,
      referral:demoSchool?.referral_code?{code:demoSchool.referral_code}:null,
      grades:(g.data||[]).map((x:any)=>({...x,value:Number(x.value),coefficient:Number(x.coefficient)})),
      schedule:(s.data||[]) as ScheduleRow[],
      payments:(pa.data||[]) as Payment[],
      points:(pt.data||[]) as PointEvent[],
      foodItems:(fi.data||[]) as FoodItem[],
      orders:(o.data||[]) as Order[],
      rewards:((r?.error?[]:r?.data)||[]) as Reward[],
      loading:false,error:null
    }
  }catch(e:any){return {profile:null,studentId:null,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],points:[],foodItems:[],orders:[],rewards:[],loading:false,error:e?.message||'Les données de démo sont indisponibles.'}}
}

function SchoolOnboarding({onBack}:{onBack:()=>void}){
  const [step,setStep]=useState<1|2>(1)
  const [director,setDirector]=useState({name:'',email:'',password:''})
  const [school,setSchool]=useState({name:'',city:'',plan:'simple' as 'simple'|'extra',referral:''})
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMsg('')
    const {data,error}=await supabase.auth.signUp({email:director.email,password:director.password,options:{data:{full_name:director.name}}})
    if(error){setBusy(false);setMsg(error.message);return}
    if(!data.session){
      localStorage.setItem('ecole-os-pending-school',JSON.stringify({email:director.email,school}))
      setBusy(false);setMsg('Compte créé. Vérifiez votre email puis connectez-vous : l’inscription de l’école sera finalisée automatiquement.');return
    }
    const res=await fetch('/api/onboarding/school',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(school)})
    const result=await res.json();setBusy(false)
    if(!res.ok){setMsg(result.error||'Impossible de créer l’école.');return}
    localStorage.removeItem('ecole-os-pending-school')
    setMsg(`École créée : ${result.school_name}. Abonnement ${result.plan} préparé. Code parrainage : ${result.referral_code}`)
  }
  return <main className="auth"><div className="auth-card wide-card">
    <Brand sub="Créer l’espace de votre établissement"/>
    <div className="onboarding-head"><div><h1>Votre école, votre espace</h1><p className="muted">Un directeur crée son établissement, choisit un plan puis invite son équipe.</p></div><div className="stepper"><span className={step===1?'active':''}>1. Compte</span><span className={step===2?'active':''}>2. École & plan</span></div></div>
    {step===1?<form onSubmit={e=>{e.preventDefault();if(!director.name||!director.email||director.password.length<6)return setMsg('Renseignez les champs et utilisez un mot de passe d’au moins 6 caractères.');setMsg('');setStep(2)}}><label>Nom du directeur<input required value={director.name} onChange={e=>setDirector({...director,name:e.target.value})} placeholder="Awa Ndiaye"/></label><label>Email<input required type="email" value={director.email} onChange={e=>setDirector({...director,email:e.target.value})} placeholder="direction@ecole.sn"/></label><label>Mot de passe<input required type="password" minLength={6} value={director.password} onChange={e=>setDirector({...director,password:e.target.value})}/></label>{msg&&<div className="alert error">{msg}</div>}<button className="primary full">Continuer</button><button type="button" className="link-btn" onClick={onBack}>← Retour connexion</button></form>:
    <form onSubmit={submit}><label>Nom de l’école<input required value={school.name} onChange={e=>setSchool({...school,name:e.target.value})} placeholder="Lycée Horizon Dakar"/></label><label>Ville<input required value={school.city} onChange={e=>setSchool({...school,city:e.target.value})} placeholder="Dakar"/></label><div className="plan-picker"><button type="button" className={school.plan==='simple'?'selected':''} onClick={()=>setSchool({...school,plan:'simple'})}><b>Simple</b><strong>5 000 F / mois</strong><small>Fonctionnalités essentielles · annonces internes</small></button><button type="button" className={school.plan==='extra'?'selected':''} onClick={()=>setSchool({...school,plan:'extra'})}><b>Extra</b><strong>10 000 F / mois</strong><small>Modules avancés · sans pubs · automatisations</small></button></div><label>Code de parrainage (optionnel)<input value={school.referral} onChange={e=>setSchool({...school,referral:e.target.value.trim().toUpperCase()})} placeholder="EO-AB12CD"/></label><div className="referral-note">Parrainage : lorsqu’un autre directeur inscrit son école avec votre code et règle son premier abonnement, votre établissement peut bénéficier du plan Extra au prix du plan Simple selon les conditions du programme.</div>{msg&&<div className="alert">{msg}</div>}<button className="primary full" disabled={busy}>{busy?'Création…':'Créer mon école'}</button><button type="button" className="link-btn" onClick={()=>{setStep(1);setMsg('')}}>← Modifier le compte</button></form>}
  </div></main>
}

function App(){
  const initialDemo=useMemo(readDemoRole,[])
  const [mode,setMode]=useState<Mode>(initialDemo?'demo':'live')
  const [session,setSession]=useState<any>(null)
  const [platformAdmin,setPlatformAdmin]=useState(false)
  const [role,setRole]=useState<Role>(initialDemo||'student')
  const [tab,setTab]=useState<Tab>('home')
  const [theme,setTheme]=useState<Theme>(()=>{try{return (localStorage.getItem('ecole-os-theme') as Theme)||'cahier'}catch{return 'cahier'}})
  const [menuOpen,setMenuOpen]=useState(false)
  const [moreOpen,setMoreOpen]=useState(false)
  const [schoolSignup,setSchoolSignup]=useState(false)
  const [cart,setCart]=useState<Record<string,number>>({})
  const [orderMsg,setOrderMsg]=useState('')
  const [data,setData]=useState<AppData>({profile:null,studentId:null,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],points:[],foodItems:[],orders:[],rewards:[],loading:true,error:null})

  useEffect(()=>{localStorage.setItem('ecole-os-mode',mode)},[mode])
  useEffect(()=>{try{localStorage.setItem('ecole-os-theme',theme)}catch{};document.documentElement.dataset.theme=theme},[theme])
  useEffect(()=>{
    supabase.auth.getSession().then(({data}:any)=>setSession(data.session))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e:any,s:any)=>setSession(s))
    return()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{
    if(mode==='live'&&data.profile?.role&&role!==data.profile.role)setRole(data.profile.role)
  },[mode,data.profile?.role,role])
  useEffect(()=>{
    let alive=true
    async function detect(){
      if(mode==='demo'){if(alive)setPlatformAdmin(role==='admin');return}
      if(!session?.access_token){if(alive)setPlatformAdmin(false);return}
      try{const res=await fetch('/api/admin/tech',{headers:{Authorization:`Bearer ${session.access_token}`}});if(alive)setPlatformAdmin(res.ok)}catch{if(alive)setPlatformAdmin(false)}
    }
    detect()
    return()=>{alive=false}
  },[mode,role,session?.access_token])
  useEffect(()=>{
    let alive=true
    async function load(){
      setData(d=>({...d,loading:true,error:null}))
      if(mode==='live'&&!session){setData(d=>({...d,loading:false}));return}
      const next=mode==='demo'?await fetchDemoData(role):await fetchLiveData(session.user.id)
      if(alive){
        setData(next)
        if(mode==='live'&&next.profile?.role)setRole(next.profile.role)
      }
    }
    load()
    return()=>{alive=false}
  },[mode,role,session])

  // ⚠ Tous les hooks doivent être appelés AVANT le moindre `return` : sinon React plante
  // (« Rendered more hooks than during the previous render ») dès que la session change → page blanche.
  useEffect(()=>{if(!canAccess(role,tab) && !(tab==='ops'&&platformAdmin))setTab('home')},[role,tab,platformAdmin])
  useEffect(()=>{if(mode==='live'&&session?.user?.id)trackUsage('page_view',1,{tab})},[mode,session?.user?.id,tab])
  function enterDemo(r:Role){try{sessionStorage.setItem('ecole-os-demo-role',r)}catch{}setCart({});setOrderMsg('');setTab('home');setRole(r);setMode('demo')}
  if(schoolSignup)return <SchoolOnboarding onBack={()=>setSchoolSignup(false)}/>
  if(mode==='live'&&!session)return <Login onSchool={()=>setSchoolSignup(true)} onDemo={enterDemo}/>
  const profileName=data.profile?.full_name||session?.user?.user_metadata?.full_name||session?.user?.email?.split('@')[0]||'Utilisateur'
  const count=Object.values(cart).reduce<number>((a,b)=>a+Number(b),0)
  const availableNav=nav.filter(([id])=>canAccess(role,id) || (id==='ops'&&platformAdmin))
  const primaryItems=availableNav.filter(([id])=>primaryTabs[role].includes(id))
  const secondaryItems=availableNav.filter(([id])=>!primaryTabs[role].includes(id) && id!=='account')
  async function logout(){await supabase.auth.signOut();setMode('live')}
  async function checkout(){
    const items=Object.entries(cart).filter(([,q])=>q).map(([id,quantity])=>({id,quantity}))
    if(!items.length)return
    if(mode==='demo'){setOrderMsg('Mode démo : commande enregistrée localement pour la simulation.');return}
    setOrderMsg('Création du paiement Wave…')
    const token=session?.access_token
    const res=await fetch('/api/wave/checkout',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({type:'food',items,pickup_date:isoDate(new Date()),pickup_slot:'12:30–12:40'})})
    const result=await res.json()
    if(!res.ok){setOrderMsg(result.error||'Erreur de paiement');return}
    window.location.href=result.wave_launch_url
  }
  function switchMode(next:Mode){if(next==='live'){try{sessionStorage.removeItem('ecole-os-demo-role')}catch{}}setMode(next);setTab('home');setCart({});setOrderMsg('');setPlatformAdmin(next==='demo'&&role==='admin');if(next==='live')setRole('student')}
  return <div className="app">
    <div className={'scrim'+(menuOpen?' on':'')} onClick={()=>setMenuOpen(false)}/>
    <aside className={'sidebar'+(menuOpen?' open':'')}>
      <Brand/>
      <div className="role-chip"><small>{roleLabels[role]}{data.profile?.class_name?` · ${data.profile.class_name}`:''}</small><b>{profileName}</b></div>
      {mode==='live'&&<div className="session-badge"><span className="session-dot"/>Session sécurisée</div>}
      {mode==='demo'&&<div className="demo-mode"><span>Mode démo</span>Données fictives, lecture seule.<button onClick={()=>switchMode('live')}>Quitter la démo</button></div>}
      <nav aria-label="Navigation principale">
        {primaryItems.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} title={navContextLabel[id]} onClick={()=>{setTab(id);setMenuOpen(false)}}><Icon size={19}/><span>{label}</span>{id==='food'&&count>0&&<em>{String(count)}</em>}</button>)}
        {secondaryItems.length>0&&<div className="nav-more-group"><button className="nav-more" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><ListChecks size={19}/><span>Evolution</span><ChevronRight size={15} className={moreOpen?'turn':''}/></button>
          {moreOpen&&<div className="nav-secondary">{secondaryItems.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} title={navContextLabel[id]} onClick={()=>{setTab(id);setMenuOpen(false)}}><Icon size={17}/><span>{label}</span></button>)}</div>}
        </div>}
        {availableNav.some(([id])=>id==='account')&&<button key="account" className={tab==='account'?'active':''} aria-current={tab==='account'?'page':undefined} title={navContextLabel.account} onClick={()=>{setTab('account');setMenuOpen(false)}}><UserRound size={19}/><span>Mon compte</span></button>}
      </nav>
      <button className="logout" onClick={mode==='demo'?()=>switchMode('live'):logout}><LogOut size={18}/>{mode==='demo'?'Quitter la démo':'Se déconnecter'}</button>
    </aside>
    <section className="main">
      <header className="topbar"><button className="mobile-menu" aria-label="Ouvrir le menu" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X/>:<Menu/>}</button><h2>{nav.find(n=>n[0]===tab)?.[1]}</h2><time className="today">{frToday()}</time><div className="avatar" aria-hidden="true">{firstLetters(profileName)}</div></header>
      <div className="content">
        {data.loading&&<div className="skeleton" role="status" aria-label="Chargement de votre espace"><i/><i/><i/></div>}
        {data.error&&<div className="alert error">{data.error}</div>}
        {!data.loading&&<>
          {tab==='home'&&<Home role={role} mode={mode} name={profileName} data={data} setTab={setTab}/>} 
          {tab==='food'&&<Food role={role} mode={mode} data={data} cart={cart} setCart={setCart} checkout={checkout} message={orderMsg}/>} 
          {tab==='schedule'&&<Schedule role={role} mode={mode} data={data}/>} 
          {tab==='grades'&&<Grades role={role} data={data}/>} 
          {tab==='payments'&&<Payments role={role} mode={mode} data={data} session={session}/>} 
          {tab==='rewards'&&<Rewards role={role} mode={mode} data={data}/>}
          {tab==='members'&&<SchoolMembers role={role} session={session} mode={mode}/>}
          {tab==='agora'&&<Agora role={role} mode={mode} session={session} profile={data.profile} schoolId={data.school?.id||null}/>}
          {tab==='community'&&<Community role={role} mode={mode} session={session} profile={data.profile} schoolId={data.school?.id||null}/>}
          {tab==='pilotage'&&role==='director'&&<DirectorPilotage mode={mode} session={session} data={data}/>}
          {tab==='ops'&&platformAdmin&&<TechnicalOps mode={mode} session={session}/>}
          {tab==='account'&&<Account role={role} mode={mode} data={data} session={session} theme={theme} onThemeChange={setTheme} onSaved={(profile)=>setData(d=>({...d,profile:{...d.profile,...profile} as Profile}))}/>}
        </>}
      </div>
    </section>
  </div>
}

function Home({role,mode,name,data,setTab}:{role:Role,mode:Mode,name:string,data:AppData,setTab:(t:Tab)=>void}){
  const average=avg(data.grades)
  const points=data.points.reduce((s,p)=>s+Number(p.points),0)
  const due=data.payments.filter(p=>p.status==='pending').reduce((s,p)=>s+Number(p.amount_xof),0)
  const todayNo=((new Date().getDay()+6)%7)+1
  const today=data.schedule.filter(s=>s.weekday===todayNo).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,5)
  const upcoming=nextClass(data.schedule)
  const todayOrders=data.orders.filter(o=>o.pickup_date===isoDate(new Date()))

  if(role==='student') return <>
    <div className="hero"><span className="eyebrow">Espace élève · {data.profile?.class_name||'classe à renseigner'}</span><h1>Bonjour {name}</h1><p>{mode==='demo'?'Vous explorez l’espace élève avec des données fictives.':'Voici votre journée et l’essentiel de votre scolarité.'}</p></div>
    <div className="grid stats"><Card icon={<Clock3/>} tone="hl" title="Prochain cours" value={upcoming?.starts_at?.slice(0,5)||'—'} meta={upcoming?`${upcoming.subject} · ${upcoming.room}`:'Aucun cours'}/><Card icon={<GraduationCap/>} tone="red" title="Moyenne générale" value={`${fr(average,2,2)} / 20`} meta="Moyenne pondérée"/><Card icon={<Star/>} title="Points" value={new Intl.NumberFormat('fr-FR').format(points)} meta="Solde récompenses"/><Card icon={<CircleDollarSign/>} title="À payer" value={shortMoney(due)} meta={due?'Échéances en attente':'Tout est réglé'}/></div>
    <div className="grid two"><Panel title="Ma journée" action="Tout voir" onAction={()=>setTab('schedule')}>{today.length?today.map(x=><div className="row" key={x.id}><b>{x.starts_at.slice(0,5)}</b><span>{x.subject}</span><small>{x.room}</small></div>):<Empty text="Pas de cours aujourd'hui"/>}</Panel><Panel title="Accès rapides"><div className="quick"><button onClick={()=>setTab('food')}><ShoppingCart/>Précommander Food</button><button onClick={()=>setTab('grades')}><GraduationCap/>Voir mes notes</button><button onClick={()=>setTab('payments')}><WalletCards/>Payer une mensualité</button><button onClick={()=>setTab('rewards')}><Gift/>Mes récompenses</button></div></Panel></div>
  </>

  if(role==='parent') return <>
    <div className="hero"><span className="eyebrow">Espace parent · suivi de la famille</span><h1>Bonjour {name}</h1><p>Suivez la scolarité de <b>{data.profile?.child_name||'votre enfant'}</b> depuis un seul espace.</p></div>
    <div className="grid stats"><Card icon={<GraduationCap/>} tone="red" title="Moyenne de l'enfant" value={`${fr(average,2,2)} / 20`} meta="Bulletin actuel"/><Card icon={<CircleDollarSign/>} title="Échéances" value={shortMoney(due)} meta={due?'À régler':'À jour'}/><Card icon={<CalendarDays/>} title="Cours aujourd'hui" value={String(today.length)} meta="Planning de l'enfant"/><Card icon={<ShoppingCart/>} title="Commandes Food" value={String(todayOrders.length)} meta="Aujourd'hui"/></div>
    <div className="grid two"><Panel title="Dernières notes">{data.grades.slice(0,5).map(g=><div className="row" key={g.id}><b>{g.value}/20</b><span>{g.subject}</span><small>Coef. {g.coefficient}</small></div>)}</Panel><Panel title="Suivi rapide"><div className="quick"><button onClick={()=>setTab('grades')}><GraduationCap/>Bulletin</button><button onClick={()=>setTab('payments')}><WalletCards/>Frais scolaires</button><button onClick={()=>setTab('schedule')}><CalendarDays/>Emploi du temps</button><button onClick={()=>setTab('food')}><ShoppingCart/>Food</button></div></Panel></div>
  </>

  if(role==='teacher') return <>
    <div className="hero"><span className="eyebrow">Espace professeur</span><h1>Bonjour {name}</h1><p>Votre journée de cours, vos classes et votre carnet de notes.</p></div>
    <div className="grid stats"><Card icon={<CalendarDays/>} title="Cours aujourd'hui" value={String(today.length)} meta="Votre planning"/><Card icon={<Clock3/>} tone="hl" title="Prochain cours" value={upcoming?.starts_at?.slice(0,5)||'—'} meta={upcoming?upcoming.subject:'Aucun cours'}/><Card icon={<School/>} title="Classes suivies" value={String(new Set(data.schedule.map(s=>s.class_name)).size)} meta="Planning"/><Card icon={<GraduationCap/>} title="Notes visibles" value={String(data.grades.length)} meta="Carnet de notes"/></div>
    <div className="grid two"><Panel title="Mes cours du jour">{today.length?today.map(x=><div className="row" key={x.id}><b>{x.starts_at.slice(0,5)}</b><span>{x.subject}</span><small>{x.class_name} · {x.room}</small></div>):<Empty text="Pas de cours aujourd'hui"/>}</Panel><Panel title="Actions enseignant"><div className="quick"><button onClick={()=>setTab('grades')}><GraduationCap/>Saisir / consulter les notes</button><button onClick={()=>setTab('schedule')}><CalendarDays/>Planning</button></div></Panel></div>
  </>

  if(role==='admin') return <>
    <div className="hero"><span className="eyebrow">Administration</span><h1>Bonjour {name}</h1><p>Une vue opérationnelle de l'activité de l'établissement.</p></div>
    <div className="grid stats"><Card icon={<School/>} title="Élèves suivis" value={String(1)} meta="Établissement"/><Card icon={<WalletCards/>} title="Impayés" value={shortMoney(due)} meta="Montant en attente"/><Card icon={<ShoppingCart/>} title="Commandes aujourd'hui" value={String(todayOrders.length)} meta="Food"/><Card icon={<CalendarDays/>} title="Cours planifiés" value={String(data.schedule.length)} meta="Planning"/></div>
    <div className="grid two"><Panel title="Alertes à traiter">{data.payments.filter(p=>p.status==='pending').slice(0,4).map(p=><div className="payment-row" key={p.id}><span>{p.description}</span><b>{money(p.amount_xof)}</b><small className="pending">À traiter</small></div>)}{!data.payments.filter(p=>p.status==='pending').length&&<Empty text="Aucune alerte paiement"/>}</Panel><Panel title="Commandes Food"><OrdersTable orders={data.orders.slice(0,6)}/></Panel></div>
  </>

  if(role==='director') return <>
    <div className="hero"><span className="eyebrow">Direction</span><h1>{data.school?.name||name}</h1><p>{data.school?.city||'Dakar'} · Gérez votre abonnement, votre école et votre programme de recommandation.</p></div>
    <div className="grid stats"><Card icon={<CalendarDays/>} title="Prochaine échéance" value={data.subscription?.current_period_end?shortDate(data.subscription.current_period_end):'—'} meta="Renouvellement de l’abonnement"/><Card icon={<WalletCards/>} title="Plan" value={data.subscription?.plan==='extra'?'Extra':'Simple'} meta={data.subscription?.status==='active'?'Actif':'À activer'}/><Card icon={<CircleDollarSign/>} title="Tarif mensuel" value={shortMoney(Number(data.subscription?.billing_price_xof||0))} meta="Facturation école"/><Card icon={<Gift/>} title="Code parrainage" value={data.referral?.code||'—'} meta="Votre avantage"/></div>
    <div className="grid two"><Panel title="Votre abonnement"><div className="plan-summary"><strong>{data.subscription?.plan==='extra'?'Extra':'Simple'}</strong><b>{shortMoney(Number(data.subscription?.billing_price_xof||0))} / mois</b><span>{data.subscription?.plan==='extra'?'Sans publicité · fonctions avancées':'Fonctions essentielles · publicité interne possible'}</span>{data.subscription?.current_period_end&&<small>Prochaine échéance : {new Intl.DateTimeFormat('fr-FR').format(new Date(data.subscription.current_period_end))}</small>}</div><button className="primary" onClick={()=>setTab('payments')}>Gérer mon abonnement</button></Panel><Panel title="Programme de recommandation"><div className="referral-banner"><b>{data.referral?.code||'—'}</b><span>Partagez ce code à un autre directeur. Une inscription qualifiée peut débloquer l'avantage Extra selon les conditions du programme.</span><button className="outline" onClick={()=>navigator.clipboard?.writeText(data.referral?.code||'')}>Copier</button></div></Panel></div>
  </>

  const ready=todayOrders.filter(o=>o.status==='ready').length
  const preparing=todayOrders.filter(o=>o.status==='preparing').length
  const revenue=todayOrders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total_xof),0)
  return <>
    <div className="hero"><span className="eyebrow">Cantine</span><h1>Bonjour {name}</h1><p>Préparez les commandes et gardez le flux de retrait sous contrôle.</p></div>
    <div className="grid stats"><Card icon={<Package/>} title="Commandes aujourd'hui" value={String(todayOrders.length)} meta="Tous créneaux"/><Card icon={<Clock3/>} title="En préparation" value={String(preparing)} meta="À cuisiner / assembler"/><Card icon={<Package/>} title="Prêtes" value={String(ready)} meta="À remettre"/><Card icon={<CircleDollarSign/>} title="Ventes" value={shortMoney(revenue)} meta="Aujourd'hui"/></div>
    <div className="grid two"><Panel title="File de retrait"><OrdersTable orders={todayOrders.slice(0,8)}/></Panel><Panel title="Gestion rapide"><div className="quick"><button onClick={()=>setTab('food')}><ShoppingCart/>Gérer le menu</button><button onClick={()=>setTab('food')}><Package/>Voir toutes les commandes</button></div></Panel></div>
  </>
}

function Card({icon,title,value,meta,tone}:{icon:React.ReactNode,title:string,value:string,meta:string,tone?:'hl'|'red'}){return <div className={'card'+(tone?' '+tone:'')}><small>{icon}{title}</small><strong>{value}</strong><span>{meta}</span></div>}
function Panel({title,children,action,onAction}:{title:string,children:React.ReactNode,action?:string,onAction?:()=>void}){return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action&&<button onClick={onAction}>{action}<ChevronRight size={16}/></button>}</div>{children}</section>}
function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

function Food({role,mode,data,cart,setCart,checkout,message}:{role:Role,mode:Mode,data:AppData,cart:Record<string,number>,setCart:React.Dispatch<React.SetStateAction<Record<string,number>>>,checkout:()=>void,message:string}){
  const caps=foodCapabilities[role]
  const total=data.foodItems.reduce((sum,item)=>sum+item.price_xof*(cart[item.id]||0),0)
  if(caps.manageMenu) return <>
    <div className="section-intro"><div><h1>Gestion Food</h1><p>Cette interface est réservée à la cantine et à l'administration.</p></div><div className="pill">Personnel autorisé</div></div>
    <div className="grid stats"><Card icon={<Package/>} title="Commandes" value={String(data.orders.length)} meta="Commandes visibles"/><Card icon={<Clock3/>} title="En préparation" value={String(data.orders.filter(o=>o.status==='preparing').length)} meta="À traiter"/><Card icon={<ShoppingCart/>} title="Prêtes" value={String(data.orders.filter(o=>o.status==='ready').length)} meta="Retrait"/><Card icon={<CircleDollarSign/>} title="Ventes" value={shortMoney(data.orders.reduce((sum,o)=>sum+Number(o.total_xof),0))} meta="Commandes non annulées"/></div>
    <div className="grid two"><Panel title="Commandes à traiter"><OrdersTable orders={data.orders.slice(0,20)}/></Panel><Panel title="Menu actuel"><div className="food-grid">{data.foodItems.map(item=><div className="food-card" key={item.id}><div className="food-img">{item.id==='burger'?'🍔':item.id==='sandwich'?'🥪':item.id==='pizza'?'🍕':'🥤'}</div><div><h3>{item.name}</h3><b>{money(item.price_xof)}</b><small>{item.active?'Disponible':'Indisponible'}</small></div><button className="outline" onClick={()=>alert('Action de gestion du menu à brancher au serveur.')}>Modifier</button></div>)}</div></Panel></div>
  </>
  if(!caps.order) return <div className="panel"><div className="empty">Food n'est pas disponible pour votre rôle.</div></div>
  return <><div className="section-intro"><div><h1>Précommande Food</h1><p>Commandez avant la pause et récupérez le repas au créneau choisi.</p></div><div className="pill">Retrait · 12:30–12:40</div></div><div className="food-layout"><div><div className="food-grid">{data.foodItems.map(item=><div className="food-card" key={item.id}><div className="food-img">{item.id==='burger'?'🍔':item.id==='sandwich'?'🥪':item.id==='pizza'?'🍕':'🥤'}</div><div><h3>{item.name}</h3><b>{money(item.price_xof)}</b></div><div className="qty"><button onClick={()=>setCart(c=>({...c,[item.id]:Math.max(0,(c[item.id]||0)-1)}))}>−</button><span>{cart[item.id]||0}</span><button onClick={()=>setCart(c=>({...c,[item.id]:(c[item.id]||0)+1}))}>+</button></div></div>)}</div><Panel title="Mes commandes"><OrdersTable orders={data.orders.slice(0,8)}/></Panel></div><aside className="cart"><h3>{role==='parent'?'Commande de votre enfant':'Ma commande'}</h3>{data.foodItems.filter(item=>cart[item.id]).map(item=><div className="row" key={item.id}><span>{item.name} × {cart[item.id]}</span><b>{money(item.price_xof*cart[item.id])}</b></div>)}{!total&&<p className="muted">Ajoutez un plat pour commencer.</p>}<div className="total"><span>Total</span><strong>{money(total)}</strong></div><button className="primary full" disabled={!total} onClick={checkout}>{mode==='demo'?'Simuler la commande':'Payer avec Wave'}</button>{message&&<div className="alert">{message}</div>}<small className="muted">{mode==='demo'?'Simulation sans débit réel.':'La commande est validée dès que Wave confirme le paiement.'}</small></aside></div></>
}
function OrdersTable({orders}:{orders:Order[]}){return orders.length?<div>{orders.map(o=><div className="payment-row orders" key={o.id}><span>#{o.id.slice(0,8)}</span><b>{money(o.total_xof)}</b><small className={o.status==='paid'||o.status==='completed'?'ok':'pending'}>{orderLabels[o.status]||o.status}</small><small>{o.pickup_date?shortDate(o.pickup_date):'—'} · {o.pickup_slot||'—'}</small></div>)}</div>:<Empty text="Aucune commande"/>}

function Schedule({role,mode,data}:{role:Role,mode:Mode,data:AppData}){const todayNo=((new Date().getDay()+6)%7)+1;const byDay=useMemo(()=>{const grouped:Record<number,ScheduleRow[]>={};for(const row of data.schedule)(grouped[row.weekday]??=[]).push(row);return grouped},[data.schedule]);const days=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];return <><div className="section-intro"><div><h1>{role==='teacher'?'Vos cours de la semaine':'Votre semaine'}</h1><p>{role==='teacher'?'Les cours qui vous sont affectés, jour par jour.':'Vos cours et leurs salles, jour par jour.'}</p></div></div><div className="schedule-week">{days.map((day,i)=><section className={'panel'+(i+1===todayNo?' today-col':'')} key={day}><div className="panel-head"><h3>{day}</h3><small>{i+1===todayNo?'Aujourd’hui · ':''}{(byDay[i+1]||[]).length} cours</small></div>{(byDay[i+1]||[]).length?(byDay[i+1]||[]).map(x=><div className="slot" key={x.id}><div className="time">{x.starts_at.slice(0,5)}</div><div><b>{x.subject}</b><span>{role==='teacher'?`${x.class_name} · `:''}jusqu’à {x.ends_at.slice(0,5)}</span></div><span className="status">{x.room}</span></div>):<Empty text="Aucun cours"/>}</section>)}</div>{mode==='demo'&&<div className="free"><b>Salles indicatives libres</b><span>A03 · A07 · C12 · Lab 1</span></div>}</>}

function Grades({role,data}:{role:Role,data:AppData}){const average=avg(data.grades);return <><div className="grade-summary"><span>Moyenne générale</span><strong>{fr(average,2,2)}<i>/ 20</i></strong><small>Pondérée par les coefficients</small>{data.grades.length>0&&<em className="appreciation">{mention(average)}</em>}</div><Panel title={role==='parent'?`Résultats de ${data.profile?.child_name||'votre enfant'}`:role==='teacher'?'Carnet de notes':'Mes résultats'}>{data.grades.length?data.grades.map(g=><div className="grade-row" key={g.id} style={{'--v':g.value/20} as React.CSSProperties}><span>{g.subject}</span><small>Coef. {g.coefficient} · {g.term}</small><b>{fr(g.value)}/20</b></div>):<Empty text="Aucune note disponible"/>}</Panel></>}


function SchoolMembers({role,session,mode}:{role:Role,session:any,mode:Mode}){
  const canManage=role==='admin'||role==='director'
  const [rows,setRows]=useState<any[]>([])
  const [counts,setCounts]=useState<Record<string,number>>({})
  const [loading,setLoading]=useState(mode==='live')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [preview,setPreview]=useState<any[]>([])
  const [importResults,setImportResults]=useState<any[]>([])
  const [importId,setImportId]=useState<string|null>(null)
  const [validating,setValidating]=useState(false)
  const [fileName,setFileName]=useState('')
  const [form,setForm]=useState({role:'student' as 'student'|'parent'|'teacher'|'admin'|'cafeteria',full_name:'',email:'',phone:'',student_code:'',parent_name:'',parent_email:'',parent_phone:''})
  async function load(){
    if(mode==='demo'){setLoading(false);setRows([]);setCounts({});return}
    const token=session?.access_token;if(!token){setLoading(false);return}
    setLoading(true);setError('')
    try{const res=await fetch('/api/members',{headers:{Authorization:'Bearer '+token}});const result=await res.json();if(!res.ok)throw new Error(result.error||'Impossible de charger les membres.');setRows(result.rows||[]);setCounts(result.counts||{})}
    catch(e:any){setError(e?.message||'Erreur de chargement.')}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[mode,session?.access_token])
  function parseCsv(text:string){
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());if(lines.length<2)throw new Error('Le CSV doit contenir une ligne d’en-têtes et au moins une ligne de données.')
    const delimiter=(lines[0].split(';').length>lines[0].split(',').length)?';':','
    const parseLine=(line:string)=>{const cells:string[]=[];let current='';let quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++}else quoted=!quoted}else if(ch===delimiter&&!quoted){cells.push(current.trim());current=''}else current+=ch}cells.push(current.trim());return cells}
    const headers=parseLine(lines[0]).map(x=>x.toLowerCase().replace(/\s+/g,'_'));const idx=(name:string)=>headers.indexOf(name);const value=(cells:string[],name:string)=>{const i=idx(name);return i>=0?cells[i]:''}
    return lines.slice(1).map(line=>{const cells=parseLine(line);const role=(value(cells,'role')||'student').toLowerCase();return {role,full_name:value(cells,'full_name')||value(cells,'nom')||value(cells,'nom_complet'),email:value(cells,'email'),phone:value(cells,'phone')||value(cells,'telephone'),student_code:value(cells,'student_code')||value(cells,'code_eleve'),parent:((value(cells,'parent_email')||value(cells,'email_parent'))?{full_name:value(cells,'parent_name')||value(cells,'nom_parent'),email:value(cells,'parent_email')||value(cells,'email_parent'),phone:value(cells,'parent_phone')||value(cells,'telephone_parent')}:undefined)}}).filter(x=>x.full_name)
  }
  async function validateRows(rows:any[],sourceName=fileName){
    if(mode==='demo'){setPreview(rows);return}
    const token=session?.access_token;if(!token){setError('Session expirée.');return}
    setValidating(true);setError('');setMessage('')
    try{
      const res=await fetch('/api/members/validate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({source_name:sourceName,members:rows})})
      const result=await res.json();if(!res.ok)throw new Error(result.error||'Impossible de valider le fichier.')
      setImportId(result.import_id||null);setPreview(result.results||[])
      setMessage(String(result.valid_count||0)+' ligne(s) valide(s) · '+String(result.invalid_count||0)+' à corriger avant import.')
    }catch(e:any){setPreview([]);setImportId(null);setError(e?.message||'Erreur de validation.')}finally{setValidating(false)}
  }
  function onFile(file:File){
    setError('');setMessage('');setImportResults([]);setImportId(null);setFileName(file.name)
    const reader=new FileReader()
    reader.onload=()=>{try{const rows=parseCsv(String(reader.result||''));void validateRows(rows,file.name)}catch(e:any){setPreview([]);setError(e?.message||'CSV invalide.')}}
    reader.onerror=()=>setError('Impossible de lire le fichier.')
    reader.readAsText(file,'utf-8')
  }
  async function provision(members:any[],label:string,forcedImportId:string|null|undefined=undefined){
    if(!members.length){setError('Aucune personne à enregistrer.');return}
    if(mode==='demo'){setMessage('Mode démo : l’import est désactivé.');return}
    const token=session?.access_token;if(!token){setError('Session expirée.');return}
    const outbound=members.map((x:any)=>x.payload?{...x.payload,line:x.line}:x)
    setBusy(true);setError('');setMessage('')
    try{
      const res=await fetch('/api/members/provision',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({members:outbound,invite:true,import_id:forcedImportId===undefined?importId:forcedImportId,source_name:fileName})})
      const result=await res.json();if(!res.ok)throw new Error(result.error||'Impossible de provisionner les membres.')
      const ok=(result.results||[]).filter((x:any)=>x.ok).length;const failed=(result.results||[]).length-ok
      setImportResults(result.results||[])
      setPreview(prev=>prev.filter((x:any)=>!x.valid))
      setMessage(label+' : '+ok+' traité(s)'+(failed?' · '+failed+' erreur(s)':'')+'.')
      setForm({role:'student',full_name:'',email:'',phone:'',student_code:'',parent_name:'',parent_email:'',parent_phone:''})
      await load()
    }catch(e:any){setError(e?.message||'Erreur de provisioning.')}finally{setBusy(false)}
  }

  async function submitSingle(e:React.FormEvent){e.preventDefault();const member:any={role:form.role,full_name:form.full_name,email:form.email,phone:form.phone,student_code:form.student_code};if(form.role==='student'&&form.parent_email)member.parent={full_name:form.parent_name,email:form.parent_email,phone:form.parent_phone};await provision([member],'Création')}
  if(!canManage)return <div className="panel"><div className="empty">La gestion des membres est réservée à la direction et à l’administration.</div></div>
  const roleOrder:[string,string][]=[['student','Élèves'],['parent','Parents'],['teacher','Professeurs'],['admin','Administration'],['cafeteria','Cantine']]
  return <>
    <div className="section-intro"><div><span className="eyebrow">Annuaire établissement</span><h1>Membres</h1><p>Créez les personnes une fois, puis laissez École OS gérer leur compte, leur rôle et les relations familiales.</p></div><button className="outline" onClick={load} disabled={loading||busy}><RefreshCw size={16}/>{loading?'Actualisation…':'Actualiser'}</button></div>
    {error&&<div className="alert error">{error}</div>}{message&&<div className="alert">{message}</div>}
    <div className="grid stats members-stats">{roleOrder.map(([key,label],i)=><Card key={key} icon={i<2?<Users/>:i===2?<School/>:i===3?<ShieldCheck/>:<ShoppingCart/>} title={label} value={String(counts[key]||0)} meta="Dans l’annuaire"/>)}</div>
    <div className="grid two members-grid">
      <section className="panel"><div className="panel-head"><div><h3>Ajouter une personne</h3><span className="panel-subtitle">Compte et rattachement créés automatiquement.</span></div><UserPlus size={19}/></div>
        <form className="account-form" onSubmit={submitSingle}>
          <div className="account-fields-2"><label>Rôle<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as any}))}><option value="student">Élève</option><option value="parent">Parent</option><option value="teacher">Professeur</option><option value="admin">Administration</option><option value="cafeteria">Cantine</option></select></label><label>Nom complet<input required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Prénom Nom"/></label></div>
          <div className="account-fields-2"><label>Email<input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="personne@ecole.sn"/></label><label>Téléphone<input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+221 …"/></label></div>
          {form.role==='student'&&<><label>Code élève<input value={form.student_code} onChange={e=>setForm(f=>({...f,student_code:e.target.value}))} placeholder="ETU-2026-042"/></label><div className="member-family-note"><b>Parent à rattacher</b><span>Renseignez l’email du parent pour créer la relation automatiquement.</span></div><div className="account-fields-2"><label>Nom du parent<input value={form.parent_name} onChange={e=>setForm(f=>({...f,parent_name:e.target.value}))} placeholder="Prénom Nom"/></label><label>Email du parent<input type="email" value={form.parent_email} onChange={e=>setForm(f=>({...f,parent_email:e.target.value}))} placeholder="parent@exemple.sn"/></label></div><label>Téléphone du parent<input value={form.parent_phone} onChange={e=>setForm(f=>({...f,parent_phone:e.target.value}))} placeholder="+221 …"/></label></>}
          <button className="primary" disabled={busy||mode==='demo'}><UserPlus size={16}/>{busy?'Création…':'Créer et inviter'}</button>
        </form>
      </section>
      <section className="panel"><div className="panel-head"><div><h3>Import CSV en masse</h3><span className="panel-subtitle">Jusqu’à 200 personnes par opération.</span></div><FileUp size={19}/></div>
        <div className="member-import-actions"><label className="dropzone"><input type="file" accept=".csv,text/csv" onChange={e=>e.target.files?.[0]&&onFile(e.target.files[0])}/><FileUp size={24}/><b>{fileName||'Choisir un fichier CSV'}</b><small>CSV séparé par virgule ou point-virgule · Colonnes : role, full_name, email, phone, student_code, parent_name, parent_email, parent_phone</small></label><button type="button" className="outline" onClick={()=>{const csv=['role,full_name,email,phone,student_code,parent_name,parent_email,parent_phone','student,Awa Ndiaye,awa@example.com,+221770000000,ETU-2026-001,Mamadou Ndiaye,parent@example.com,+221771111111','teacher,Cheikh Fall,cheikh@example.com,+221772222222,,,,'].join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ecole-os-membres-modele.csv';a.click();URL.revokeObjectURL(url)}}><FileUp size={16}/>Télécharger le modèle</button></div>
        {validating&&<div className="validation-bar"><RefreshCw size={16}/><span>Validation serveur du fichier…</span></div>}
        {preview.length>0&&<><div className="import-preview-head"><div><b>{preview.length} ligne(s) analysées</b><span>{preview.filter((x:any)=>x.valid).length} valide(s) · {preview.filter((x:any)=>!x.valid).length} à corriger</span></div><span>{importId?'Import '+importId.slice(0,8):''}</span></div><div className="import-preview">{preview.slice(0,40).map((x,i)=><div className={'import-row '+(x.valid?'valid':'invalid')} key={x.line||i}><span className="import-line">L{x.line||i+2}</span><div><b>{x.payload?.full_name||x.full_name}</b><span>{(x.payload?.role||x.role)+' · '+((x.payload?.email||x.email)||'sans email')}</span></div><small>{x.errors?.length?'❌ '+x.errors.join(' · '):x.warnings?.length?'⚠ '+x.warnings.join(' · '):'✓ Prête'}</small></div>)}{preview.length>40&&<small className="muted">+ {preview.length-40} autre(s)…</small>}</div><button className="primary" disabled={busy||validating||!preview.some((x:any)=>x.valid)} onClick={()=>provision(preview.filter((x:any)=>x.valid),'Import CSV')}><Check size={16}/>Provisionner {preview.filter((x:any)=>x.valid).length} personne(s) valides</button></>}
        {importResults.length>0&&<div className="import-results"><div className="import-preview-head"><div><b>Résultats du provisioning</b><span>{importResults.filter((x:any)=>x.ok).length} succès · {importResults.filter((x:any)=>!x.ok).length} erreur(s)</span></div></div>{importResults.map((x:any,i)=><div className={'import-result '+(x.ok?'success':'error')} key={x.line||i}><b>L{x.line||i+2}</b><span>{x.ok?'✓ '+x.full_name+' · '+(x.status||'traité'):'✕ '+(x.error||'Erreur')}</span></div>)}</div>}
        <div className="csv-hint"><AlertTriangle size={16}/><div><b>Recommandation</b><span>Utilisez un code élève stable et un email unique par personne. Un compte déjà présent est relié au lieu d’être recréé.</span></div></div>
      </section>
    </div>
    <section className="panel members-list"><div className="panel-head"><div><h3>Annuaire actuel</h3><span className="panel-subtitle">{rows.length} personne(s) enregistrée(s) dans l’établissement.</span></div></div>
      {loading?<div className="skeleton mini"><i/><i/></div>:rows.length?<div>{rows.slice(0,100).map((r:any)=><div className="member-row" key={r.id}><div className="member-avatar">{firstLetters(r.full_name)}</div><div><b>{r.full_name}</b><span>{roleLabels[r.role]||r.role}{r.student_code?' · '+r.student_code:''}</span></div><small>{r.email||'Pas d’email'}</small><em className={r.status==='linked'?'ok':r.status==='invited'?'pending':''}>{r.status}</em></div>)}</div>:<Empty text="Aucun membre enregistré pour le moment."/>}
    </section>
  </>
}

function KpiStrip({items}:{items:{label:string,value:string,meta?:string,icon:React.ReactNode}[]}){
  return <div className="grid stats ops-kpis">{items.map((x,i)=><Card key={i} icon={x.icon} title={x.label} value={x.value} meta={x.meta||''}/>)}</div>
}
function MiniBar({value,max,label,meta}:{value:number;max:number;label:string;meta:string}){
  const pct=max>0?Math.min(100,Math.max(0,value/max*100)):0
  return <div className="ops-bar"><div className="ops-bar-head"><b>{label}</b><span>{meta}</span></div><div className="ops-bar-track"><i style={{width:`${pct}%`}}/></div></div>
}
function TechnicalOps({mode,session}:{mode:Mode,session:any}){
  const [loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[payload,setPayload]=useState<any|null>(null)
  async function load(){
    if(mode==='demo'){
      setPayload({kpis:{schools:12,users:1860,active_subscriptions:10,projected_revenue_xof:75000,estimated_cost_xof:28600,actual_provider_cost_xof:31450,projected_margin_xof:43550,avg_users_per_school:155,past_due_cycles:1},cycles:[{school_id:'demo',amount_xof:12500,estimated_cost_xof:4200,provider_cost_xof:4360,cost_basis:'provider_allocation',margin_xof:8140,active_users:230,status:'due'}],cost_rules:[{service:'Supabase',metric:'active_users',label:'Infrastructure / utilisateur actif',fixed_monthly_xof:0,included_units:100,unit_cost_xof:20},{service:'Vercel',metric:'deployments',label:'Hébergement / déploiement',fixed_monthly_xof:0,included_units:20,unit_cost_xof:50},{service:'Notifications',metric:'messages',label:'Emails / SMS',fixed_monthly_xof:0,included_units:1000,unit_cost_xof:2}],provider_costs:[{provider:'vercel',amount:8.42,currency:'USD',amount_xof:5200,status:'ok',basis:'provider_reported',units:{charge_records:18},fetched_at:new Date().toISOString()},{provider:'supabase',amount:18.4,currency:'USD',amount_xof:11200,status:'partial',basis:'usage_derived',units:{projects:1,plan:'pro'},fetched_at:new Date().toISOString()},{provider:'resend',amount:4.2,currency:'USD',amount_xof:2600,status:'partial',basis:'usage_derived',units:{sent_emails:7120,plan:'pro'},fetched_at:new Date().toISOString()},{provider:'twilio',amount:20.1,currency:'USD',amount_xof:12450,status:'ok',basis:'provider_reported',units:{categories:4},fetched_at:new Date().toISOString()}],events:[{severity:'info',event_type:'provider_cost_sync',message:'Coûts fournisseurs synchronisés automatiquement.',created_at:new Date().toISOString()},{severity:'warning',event_type:'usage_threshold',message:'1 établissement approche de son plafond.',created_at:new Date(Date.now()-3600000).toISOString()}],autopilot:{enabled:true,mode:'usage-aware',policy:'Simulation démo'}})
      setLoading(false);return
    }
    if(!session?.access_token){setLoading(false);return}
    setLoading(true);setError('')
    try{const res=await fetch('/api/admin/tech',{headers:{Authorization:`Bearer ${session.access_token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'Dashboard technique indisponible.');setPayload(json)}catch(e:any){setError(e?.message||'Erreur de chargement.')}finally{setLoading(false)}
  }
  async function syncProviders(){
    if(mode==='demo'){setNotice('Mode démo : synchronisation fournisseur simulée.');return}
    if(!session?.access_token)return
    setSyncing(true);setError('');setNotice('Synchronisation des coûts fournisseurs…')
    try{
      const res=await fetch('/api/admin/provider-costs',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
      const json=await res.json()
      if(!res.ok)throw new Error(json.error||'Synchronisation impossible.')
      setNotice('Coûts fournisseurs actualisés.')
      await load()
    }catch(e:any){setError(e?.message||'Erreur de synchronisation.')}finally{setSyncing(false)}
  }
  useEffect(()=>{load()},[mode,session?.access_token])
  const k=payload?.kpis
  const providerCosts=payload?.provider_costs||[]
  const providerNames:Record<string,string>={vercel:'Vercel',supabase:'Supabase',resend:'Resend',twilio:'Twilio'}
  const providerMeta=(p:any)=>{
    const status=p?.status||'not_configured'
    const label=status==='ok'?'Réel fournisseur':status==='partial'?'Dérivé / partiel':status==='error'?'Erreur':'Non configuré'
    return label
  }
  return <>
    <div className="section-intro"><div><span className="eyebrow">ÉCOLE OS / CONTROL PLANE</span><h1>Ops & Autopilot.</h1><p>Surveillez la croissance, les coûts, les usages et le moteur de facturation sans piloter chaque école manuellement.</p></div><div className="ops-toolbar"><div className="ops-live-pill"><i/><span>Autopilot {payload?.autopilot?.enabled?'actif':'arrêté'}</span></div><button className="outline" onClick={syncProviders} disabled={syncing||mode==='live'&&!session?.access_token}><RefreshCw size={15} className={syncing?'spin':''}/>{syncing?'Synchronisation…':'Synchroniser les coûts'}</button></div></div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert">{notice}</div>}
    {loading?<div className="skeleton"><i/><i/><i/></div>:<>
      <KpiStrip items={[
        {label:'Écoles',value:String(k?.schools||0),meta:'établissements onboardés',icon:<School/>},
        {label:'Utilisateurs',value:new Intl.NumberFormat('fr-FR').format(k?.users||0),meta:`≈ ${k?.avg_users_per_school||0} / école`,icon:<Users/>},
        {label:'Revenu projeté',value:shortMoney(k?.projected_revenue_xof||0),meta:'cycle courant',icon:<WalletCards/>},
        {label:'Coût fournisseur',value:shortMoney(k?.actual_provider_cost_xof||0),meta:'données synchronisées',icon:<CircleDollarSign/>},
        {label:'Marge projetée',value:shortMoney(k?.projected_margin_xof||0),meta:'revenu − coût appliqué',icon:<Gauge/>}
      ]}/>
      <div className="grid two">
        <section className="panel"><div className="panel-head"><div><h3>Coûts réels des fournisseurs</h3><span className="panel-subtitle">Chaque ligne indique si le montant vient directement du fournisseur ou d'un calcul d'usage.</span></div><Activity size={18}/></div><div className="provider-cost-grid">{providerCosts.map((p:any)=><div className="provider-cost-card" key={p.provider}><div className="provider-cost-head"><b>{providerNames[p.provider]||p.provider}</b><span className={`cost-basis ${p.status}`}>{providerMeta(p)}</span></div><strong>{p.amount_xof!=null?shortMoney(Number(p.amount_xof)):`${fr(Number(p.amount||0),2)} ${String(p.currency||'').toUpperCase()}`}</strong><small>{p.status==='not_configured'?'Ajoutez les identifiants du fournisseur.':p.basis==='provider_reported'?'Montant retourné par l’API fournisseur.':'Montant dérivé du plan + usage réellement observé.'}</small>{p.fetched_at&&<em>Sync {shortDate(String(p.fetched_at))}</em>}{p.error_message&&<em className="cost-error">{p.error_message}</em>}</div>)}{!providerCosts.length&&<Empty text="Aucun snapshot fournisseur pour ce mois."/>}</div></section>
        <section className="panel"><div className="panel-head"><div><h3>Moteur auto-évolutif</h3><span className="panel-subtitle">La facturation suit automatiquement la masse active et les métriques de service.</span></div><Activity size={18}/></div><div className="autopilot-grid"><div><span>Mode</span><b>{payload?.autopilot?.mode||'—'}</b></div><div><span>Cycles en retard</span><b>{k?.past_due_cycles||0}</b></div><div><span>Règles de coût</span><b>{payload?.cost_rules?.length||0}</b></div><div><span>Paiement</span><b>Wave checkout</b></div></div><div className="alert">Le moteur peut préparer automatiquement le montant, le cycle et le checkout. Le débit automatique permanent dépend d’un moyen de paiement avec mandat récurrent pris en charge par le fournisseur.</div></section>
      </div>
      <div className="grid two">
        <section className="panel"><div className="panel-head"><div><h3>Règles de coûts</h3><span className="panel-subtitle">Modifiables sans toucher au frontend.</span></div><ServerCog size={18}/></div>{(payload?.cost_rules||[]).map((r:any)=><div className="ops-rule" key={r.service+r.metric}><div><b>{r.label}</b><span>{r.service} · {r.metric}</span></div><strong>{fr(Number(r.unit_cost_xof||0))} F / unité</strong></div>)}</section>
        <section className="panel"><div className="panel-head"><div><h3>Cycles courants</h3><span className="panel-subtitle">Projection par établissement et base de coût.</span></div></div>{(payload?.cycles||[]).slice(0,8).map((c:any)=><div className="ops-cycle" key={c.school_id}><div><b>{c.school_id==='demo'?'École Horizon':'Établissement '+String(c.school_id).slice(0,8)}</b><span>{c.active_users} utilisateurs · {c.status} · {c.cost_basis||'rules_estimate'}</span></div><strong>{shortMoney(Number(c.amount_xof||0))}</strong></div>)}{!(payload?.cycles||[]).length&&<Empty text="Le moteur n’a pas encore généré de cycle pour ce mois."/>}</section>
      </div>
      <div className="grid two">
        <section className="panel"><div className="panel-head"><div><h3>Journal Autopilot</h3><span className="panel-subtitle">Les exceptions remontent ici ; le reste continue seul.</span></div></div>{(payload?.events||[]).map((e:any)=><div className="ops-event" key={e.id||e.created_at}><span className={`severity ${e.severity}`}/><div><b>{e.event_type}</b><span>{e.message}</span></div><small>{shortDate(String(e.created_at))}</small></div>)}</section>
        <section className="panel"><div className="panel-head"><div><h3>Prévision vs réel</h3><span className="panel-subtitle">Écart entre le moteur de règles et les coûts fournisseurs disponibles.</span></div><Gauge size={18}/></div><div className="finance-rail"><div><span>Coût par règles</span><b>{shortMoney(k?.estimated_cost_xof||0)}</b></div><div><span>Coût fournisseur</span><b>{shortMoney(k?.actual_provider_cost_xof||0)}</b></div><div><span>Écart</span><b>{shortMoney(Number(k?.actual_provider_cost_xof||0)-Number(k?.estimated_cost_xof||0))}</b></div><div><span>Cycles hors échéance</span><b>{k?.past_due_cycles||0}</b></div></div></section>
      </div>
      <section className="panel"><div className="panel-head"><div><h3>Surveillance sécurité</h3><span className="panel-subtitle">Observabilité serveur : répétitions de refus, erreurs API et anomalies d’accès. Les adresses sont pseudonymisées côté serveur.</span></div><ShieldCheck size={18}/></div><div className="autopilot-grid"><div><span>Événements · 24 h</span><b>{payload?.security?.events||0}</b></div><div><span>Avertissements</span><b>{payload?.security?.warnings||0}</b></div><div><span>Critiques</span><b>{payload?.security?.critical||0}</b></div><div><span>Alertes ouvertes</span><b>{payload?.security?.open_alerts||0}</b></div></div><div className="ops-event-list">{(payload?.security?.alerts||[]).slice(0,6).map((a:any)=><div className="ops-event" key={a.id}><span className={`severity ${a.severity}`}/><div><b>{a.alert_type}</b><span>{a.summary}</span></div><small>{a.occurrences||1}×</small></div>)}{!(payload?.security?.alerts||[]).length&&<div className="alert">Aucune anomalie ouverte sur les dernières 24 heures.</div>}</div></section>
    </>}
  </>
}
function DirectorPilotage({mode,session,data}:{mode:Mode,session:any,data:AppData}){
  const [loading,setLoading]=useState(mode==='live'),[error,setError]=useState(''),[payload,setPayload]=useState<any|null>(null)
  async function load(){
    if(mode==='demo'){setPayload({stats:{school_name:'École Démo Horizon',city:'Dakar',plan:'simple',subscription_status:'active',contract_price_xof:5000,active_users:168,included_users:100,overage_users:68,projected_bill_xof:6360,estimated_cost_xof:3150,provider_cost_xof:3380,cost_basis:'provider_allocation',projected_margin_xof:2980,students:112,parents:38,teachers:14,admins:4,events_this_month:4820,collected_this_month_xof:125000,pending_collections_xof:18000,food_orders_this_month:428},settings:{autopilot_enabled:true,auto_scaling_enabled:true,usage_pricing_enabled:true,auto_upgrade_enabled:false,spending_cap_xof:null},events:[{severity:'info',message:'Facturation recalculée automatiquement.',event_type:'billing_cycle_ready',created_at:new Date().toISOString()}]});setLoading(false);return}
    if(!session?.access_token)return
    setLoading(true);setError('')
    try{const res=await fetch('/api/director/stats',{headers:{Authorization:`Bearer ${session.access_token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'Statistiques indisponibles.');setPayload(json)}catch(e:any){setError(e?.message||'Erreur de chargement.')}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[mode,session?.access_token])
  const s=payload?.stats
  return <>
    <div className="section-intro"><div><span className="eyebrow">PILOTAGE · ÉTABLISSEMENT</span><h1>{s?.school_name||data.school?.name||'Mon école'}</h1><p>{s?.city||data.school?.city||'—'} · Une lecture statistique de l'activité, de l'usage et de la trajectoire des coûts.</p></div><div className="ops-live-pill"><i/><span>Auto-pilotage {payload?.settings?.autopilot_enabled?'actif':'manuel'}</span></div></div>
    {error&&<div className="alert error">{error}</div>}
    {loading?<div className="skeleton"><i/><i/><i/></div>:<>
      <KpiStrip items={[
        {label:'Utilisateurs actifs',value:String(s?.active_users||0),meta:`${s?.overage_users||0} au-dessus du quota`,icon:<Users/>},
        {label:'Élèves',value:String(s?.students||0),meta:'effectif',icon:<GraduationCap/>},
        {label:'Activité',value:new Intl.NumberFormat('fr-FR').format(s?.events_this_month||0),meta:'événements ce mois',icon:<Activity/>},
        {label:'Encaissements',value:shortMoney(s?.collected_this_month_xof||0),meta:'ce mois',icon:<WalletCards/>},
        {label:'Projection',value:shortMoney(s?.projected_bill_xof||0),meta:`${s?.cost_basis==='provider_allocation'?'coût fournisseur':'coût estimé'}`,icon:<CircleDollarSign/>}
      ]}/>
      <div className="grid two">
        <section className="panel"><div className="panel-head"><div><h3>Population</h3><span className="panel-subtitle">Répartition actuelle des membres.</span></div><Users size={18}/></div><MiniBar value={Number(s?.students||0)} max={Math.max(1,Number(s?.active_users||0))} label="Élèves" meta={String(s?.students||0)}/><MiniBar value={Number(s?.parents||0)} max={Math.max(1,Number(s?.active_users||0))} label="Parents" meta={String(s?.parents||0)}/><MiniBar value={Number(s?.teachers||0)} max={Math.max(1,Number(s?.active_users||0))} label="Professeurs" meta={String(s?.teachers||0)}/><MiniBar value={Number(s?.admins||0)} max={Math.max(1,Number(s?.active_users||0))} label="Administration" meta={String(s?.admins||0)}/></section>
        <section className="panel"><div className="panel-head"><div><h3>Trajectoire financière</h3><span className="panel-subtitle">Le montant s'adapte à la masse et aux règles de coût actives.</span></div><Gauge size={18}/></div><div className="finance-rail"><div><span>Plan contractuel</span><b>{shortMoney(s?.contract_price_xof||0)}</b></div><div><span>Usage / dépassement</span><b>{shortMoney(Math.max(0,Number(s?.projected_bill_xof||0)-Number(s?.contract_price_xof||0)))}</b></div><div><span>Coût plateforme appliqué</span><b>{shortMoney(s?.provider_cost_xof||s?.estimated_cost_xof||0)}</b></div><div><span>Base du coût</span><b>{s?.cost_basis==='provider_allocation'?'Fournisseurs':'Règles'}</b></div><div><span>Marge projetée</span><b>{shortMoney(s?.projected_margin_xof||0)}</b></div></div><div className="alert">Votre école n’a pas besoin d’attendre une intervention manuelle pour que le moteur recalcule son cycle selon le nombre d’utilisateurs.</div></section>
      </div>
      <div className="grid two">
        <section className="panel"><div className="panel-head"><div><h3>Flux école</h3><span className="panel-subtitle">Activité métier qui explique l’usage.</span></div></div><div className="row"><b>{s?.food_orders_this_month||0}</b><span>Commandes Food ce mois</span><small>activité</small></div><div className="row"><b>{shortMoney(s?.pending_collections_xof||0)}</b><span>Paiements élèves / familles en attente</span><small>à suivre</small></div><div className="row"><b>{s?.overage_users||0}</b><span>Utilisateurs en dépassement</span><small>facturation</small></div></section>
        <section className="panel"><div className="panel-head"><div><h3>Événements d’autopilotage</h3><span className="panel-subtitle">Ce que le système a fait à votre place.</span></div></div>{(payload?.events||[]).map((e:any)=><div className="ops-event" key={e.event_type+e.created_at}><span className={`severity ${e.severity}`}/><div><b>{e.event_type}</b><span>{e.message}</span></div><small>{shortDate(String(e.created_at))}</small></div>)}{!(payload?.events||[]).length&&<Empty text="Aucun événement à signaler."/>}</section>
      </div>
    </>}
  </>
}

function DirectorBilling({mode,data,session}:{mode:Mode,data:AppData,session:any}){
  const [msg,setMsg]=useState('')
  const [cycle,setCycle]=useState<any|null>(null)
  const sub=data.subscription
  async function loadCycle(){
    if(mode==='demo'){setCycle({status:'due',amount_xof:6360,active_users:168,included_users:100,overage_users:68,period_start:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10)});return}
    if(!data.school?.id)return
    const {data:rows,error}=await supabase.from('billing_cycles').select('id,status,amount_xof,active_users,included_users,overage_users,period_start,period_end,provider_checkout_url').eq('school_id',data.school.id).order('period_start',{ascending:false}).limit(1)
    if(!error)setCycle(rows?.[0]||null)
  }
  useEffect(()=>{loadCycle()},[mode,data.school?.id])
  async function pay(){
    if(mode==='demo'){setMsg('Mode démo : paiement de cycle simulé, aucun débit réel.');return}
    const token=session?.access_token;if(!token){setMsg('Session expirée.');return}
    setMsg('Création du paiement Wave…')
    const body=cycle?.id?{type:'billing_cycle',billing_cycle_id:cycle.id}:{type:'school_subscription',subscription_id:sub?.id}
    const res=await fetch('/api/wave/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)})
    const result=await res.json();if(!res.ok){setMsg(result.error||'Erreur Wave');return}window.location.href=result.wave_launch_url
  }
  const base=Number(sub?.billing_price_xof||0)
  const projected=Number(cycle?.amount_xof||base)
  const canPay=!!cycle&&['due','past_due'].includes(cycle.status)
  return <><div className="section-intro"><div><span className="eyebrow">Abonnement de l’école</span><h1>{data.school?.name||'Mon établissement'}</h1><p>Le moteur recalcule le cycle selon les utilisateurs actifs et les règles d'usage.</p></div><div className="pill">{sub?.plan==='extra'?'Extra':'Simple'}</div></div><div className="grid two"><div className="panel"><div className="panel-head"><h3>Cycle courant</h3><span className="status">{cycle?.status||sub?.status||'—'}</span></div><div className="plan-summary"><strong>{shortMoney(projected)} / mois projeté</strong><b>{cycle?.active_users||0} utilisateurs actifs</b><span>{cycle?.overage_users||0} utilisateur(s) au-dessus du quota · base {shortMoney(base)}</span>{cycle?.period_end&&<small>Période : {shortDate(cycle.period_start)} → {shortDate(cycle.period_end)}</small>}</div><button className="primary" disabled={!canPay||!sub} onClick={pay}>{cycle?.status==='past_due'?'Régler le cycle en retard':'Payer le cycle avec Wave'}</button>{cycle?.provider_checkout_url&&<small className="muted">Un checkout Wave a déjà été préparé pour ce cycle.</small>}</div><div className="panel"><div className="panel-head"><h3>Programme de parrainage</h3><Gift size={18}/></div><div className="referral-banner"><b>{data.referral?.code||'Code généré après inscription'}</b><span>Partagez votre code à un autre directeur. La récompense est déclenchée après inscription et premier abonnement payé.</span></div><div className="feature-list"><b>Automatisation</b><span>• recalcul de masse utilisateur</span><span>• cycle de facturation préparé automatiquement</span><span>• coût d'infrastructure estimé</span><span>• paiement Wave préparé en cas d'échéance</span></div></div></div>{msg&&<div className="alert">{msg}</div>}</>
}

function Payments({role,mode,data,session}:{role:Role,mode:Mode,data:AppData,session:any}){
  const [msg,setMsg]=useState('')
  if(!['student','parent','admin','director'].includes(role))return <div className="panel"><div className="empty">Les paiements ne sont pas disponibles pour ce rôle.</div></div>
  if(role==='director') return <DirectorBilling mode={mode} data={data} session={session}/>
  const due=data.payments.filter(p=>p.status==='pending').sort((a,b)=>a.due_date.localeCompare(b.due_date))[0]
  async function pay(paymentId:string){
    if(mode==='demo'){setMsg('Mode démo : ce paiement est fictif, aucun débit Wave ne sera effectué.');return}
    const token=session?.access_token;if(!token){setMsg('Session expirée.');return}
    setMsg('Création du paiement Wave…')
    const res=await fetch('/api/wave/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({type:'school_payment',payment_id:paymentId})})
    const result=await res.json();if(!res.ok){setMsg(result.error||'Erreur Wave');return}window.location.href=result.wave_launch_url
  }
  return <><div className="payment-banner"><CircleDollarSign size={30}/><div><b>Échéancier scolaire</b><span>{due?`Prochaine échéance · ${new Intl.DateTimeFormat('fr-FR').format(new Date(due.due_date))}`:'Aucune échéance en attente'}</span></div><strong>{shortMoney(due?.amount_xof||0)}</strong></div><Panel title={role==='parent'?'Paiements de votre enfant':'Mes paiements'}>{data.payments.length?data.payments.map(p=><div className="payment-row" key={p.id}><span>{p.description}</span><b>{money(p.amount_xof)}</b><small className={p.status==='succeeded'?'ok':'pending'}>{p.status==='succeeded'?'Payé':p.status==='failed'?'Échec':p.status==='expired'?'Expiré':'À payer'}</small><button className="text-btn" disabled={p.status!=='pending'} onClick={()=>pay(p.id)}>{p.status==='succeeded'?'Reçu':p.status==='pending'?'Payer':'—'}</button></div>):<Empty text="Aucun paiement"/>}</Panel>{msg&&<div className="alert">{msg}</div>}</>}


function Account({role,mode,data,session,theme,onThemeChange,onSaved}:{role:Role,mode:Mode,data:AppData,session:any,theme:Theme,onThemeChange:(theme:Theme)=>void,onSaved:(profile:Partial<Profile>)=>void}){
  const p=data.profile
  const [name,setName]=useState(p?.full_name||'')
  const [newPassword,setNewPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [msg,setMsg]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>setName(p?.full_name||''),[p?.id,p?.full_name])
  const email=mode==='live'?(session?.user?.email||''):(p?.email||'')
  const profileClass=p?.class_name||'Non renseignée'
  const schoolName=data.school?.name||'Aucune école liée'
  const dataCards=[
    {label:'Notes',value:data.grades.length,icon:GraduationCap},
    {label:'Cours',value:data.schedule.length,icon:CalendarDays},
    {label:'Paiements',value:data.payments.length,icon:CircleDollarSign},
    {label:'Commandes',value:data.orders.length,icon:ShoppingCart},
  ]
  async function saveProfile(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');setMsg('')
    const clean=name.trim()
    if(clean.length<2){setError('Le nom doit contenir au moins 2 caractères.');setBusy(false);return}
    if(mode==='demo'){
      setMsg('Mode démo : le profil est consultable mais reste en lecture seule.')
      setBusy(false);return
    }
    const {error:dbError}=await supabase.from('profiles').update({full_name:clean}).eq('id',session.user.id)
    if(dbError){setError(dbError.message);setBusy(false);return}
    const {error:authError}=await supabase.auth.updateUser({data:{full_name:clean}})
    if(authError){setError(authError.message);setBusy(false);return}
    onSaved({full_name:clean})
    setMsg('Profil enregistré.')
    setBusy(false)
  }
  async function changePassword(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');setMsg('')
    if(mode==='demo'){setError('Le changement de mot de passe est disponible uniquement sur un compte réel.');setBusy(false);return}
    if(newPassword.length<8){setError('Utilisez au moins 8 caractères pour le nouveau mot de passe.');setBusy(false);return}
    if(newPassword!==confirmPassword){setError('Les deux mots de passe ne correspondent pas.');setBusy(false);return}
    const {error:updateError}=await supabase.auth.updateUser({password:newPassword})
    if(updateError){setError(updateError.message);setBusy(false);return}
    setNewPassword('');setConfirmPassword('');setMsg('Mot de passe mis à jour.')
    setBusy(false)
  }
  return <>
    <div className="account-hero">
      <div className="account-avatar">{firstLetters(p?.full_name||'Utilisateur')}</div>
      <div className="account-identity"><h1>{p?.full_name||'Mon compte'}</h1><p>Gérez votre identité, votre sécurité et les données rattachées à votre compte {roleLabels[role].toLowerCase()}.</p></div>
      <div className="account-role"><ShieldCheck size={16}/><span>{roleLabels[role]}</span></div>
    </div>
    <div className="account-data-grid">{dataCards.map(({label,value,icon:Icon})=><div className="account-data-card" key={label}><span><Icon size={17}/>{label}</span><strong>{value}</strong><small>Enregistré</small></div>)}</div>
    <div className="account-grid">
      <section className="panel account-panel">
        <div className="panel-head"><div><h3>Informations personnelles</h3><span className="panel-subtitle">Les informations utilisées dans École OS.</span></div><Sparkles size={18}/></div>
        <form className="account-form" onSubmit={saveProfile}>
          <label>Nom complet<div className="input-with-icon"><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom et prénom"/></div></label>
          <label>Email<div className="input-with-icon disabled"><Mail size={16}/><input value={email} readOnly/></div></label>
          <div className="account-fields-2"><label>Rôle<div className="readonly-field"><ShieldCheck size={16}/>{roleLabels[role]}</div></label><label>Code élève<div className="readonly-field"><BookOpen size={16}/>{p?.student_code||'—'}</div></label></div>
          <div className="account-fields-2"><label>Classe<div className="readonly-field">{profileClass}</div></label><label>Établissement<div className="readonly-field">{schoolName}</div></label></div>
          {error&&<div className="alert error">{error}</div>}{msg&&<div className="alert">{msg}</div>}
          <button className="primary" disabled={busy}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer les modifications'}</button>
        </form>
      </section>
      <section className="panel account-panel appearance-panel">
        <div className="panel-head"><div><h3>Apparence</h3><span className="panel-subtitle">Trois ambiances, même École OS. Rien de plus.</span></div><Palette size={18}/></div>
        <div className="theme-picker">
          <button className={theme==='cahier'?'selected':''} onClick={()=>onThemeChange('cahier')}><span className="theme-swatch cahier"/><b>Cahier</b><small>Identité actuelle</small></button>
          <button className={theme==='epure'?'selected':''} onClick={()=>onThemeChange('epure')}><span className="theme-swatch epure"/><b>Épuré</b><small>Plus sobre</small></button>
          <button className={theme==='brume'?'selected':''} onClick={()=>onThemeChange('brume')}><span className="theme-swatch brume"/><b>Brume</b><small>Doux & calme</small></button>
        </div>
      </section>
      <section className="panel account-panel">
        <div className="panel-head"><div><h3>Sécurité</h3><span className="panel-subtitle">Gardez votre accès protégé.</span></div><KeyRound size={18}/></div>
        <div className="security-note"><CheckCircle2 size={17}/><div><b>Session sécurisée</b><span>{mode==='live'?'Vous êtes connecté à votre compte.':'Compte de démonstration.'}</span></div></div>
        <form className="account-form" onSubmit={changePassword}>
          <label>Nouveau mot de passe<div className="input-with-icon"><KeyRound size={16}/><input type="password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="8 caractères minimum"/></div></label>
          <label>Confirmer<div className="input-with-icon"><KeyRound size={16}/><input type="password" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Répétez le nouveau mot de passe"/></div></label>
          <button className="outline full" disabled={busy}>Mettre à jour le mot de passe</button>
          <div className="account-tip"><b>À savoir</b><span>Votre adresse email sert à vous connecter. Sa modification peut demander une confirmation.</span></div>
        </form>
      </section>
    </div>
  </>
}

const ideaStatusLabel:Record<IdeaStatus,string>={new:'Nouvelle',review:'En étude',planned:'Planifiée',building:'En développement',done:'Disponible'}
const ideaStatusClass:Record<IdeaStatus,string>={new:'new',review:'review',planned:'planned',building:'building',done:'done'}
const demoIdeaSeed:CommunityIdea[]=[
  {id:'demo-idea-1',title:'Un calendrier commun parents / professeurs',description:'Réunir devoirs, réunions et événements dans une vue unique.',author_name:'Fatou Ndiaye',role:'parent',status:'review',votes:28,created_at:'2026-09-21T10:00:00Z'},
  {id:'demo-idea-2',title:'Notifier avant la fermeture de la cantine',description:'Prévenir automatiquement quand la fenêtre de commande approche.',author_name:'Cheikh Ba',role:'cafeteria',status:'planned',votes:19,created_at:'2026-09-20T08:30:00Z'},
  {id:'demo-idea-3',title:'Ajouter un mode hors-ligne léger',description:'Consulter les données essentielles même avec une connexion instable.',author_name:'Moussa Diop',role:'teacher',status:'new',votes:14,created_at:'2026-09-19T15:20:00Z'}
]
const demoSurveySeed:CommunitySurvey[]=[
  {id:'demo-survey-1',question:'Quel service devrait être amélioré ensuite ?',description:'Un vote simple. Les résultats servent à prioriser la feuille de route.',expires_at:'2026-10-02',options:[{id:'s1-a',label:'Messagerie',votes:38},{id:'s1-b',label:'Cantine',votes:24},{id:'s1-c',label:'Emploi du temps',votes:21},{id:'s1-d',label:'Paiements',votes:17}]}
]
function demoStorage<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function saveDemoStorage<T>(key:string,value:T){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function addDemoImpact(userId:string,points:number,reason:string){const key=`eos-demo-impact-events-${userId}`;const current=demoStorage<any[]>(key,[]);current.unshift({id:`local-${Date.now()}`,points,reason,created_at:new Date().toISOString()});saveDemoStorage(key,current);const totalKey=`eos-demo-impact-extra-${userId}`;const total=Number(localStorage.getItem(totalKey)||0)+points;try{localStorage.setItem(totalKey,String(total))}catch{};window.dispatchEvent(new Event('eos-points-updated'))}

function Rewards({role,mode,data}:{role:Role,mode:Mode,data:AppData}){
  const userId=data.profile?.id||'anonymous';
  const [extra,setExtra]=useState(0);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState('');
  useEffect(()=>{
    const key=`eos-demo-impact-extra-${userId}`;
    const read=()=>setExtra(Number(localStorage.getItem(key)||0));
    read();
    const on=()=>read();
    window.addEventListener('eos-points-updated',on);
    return()=>window.removeEventListener('eos-points-updated',on);
  },[userId]);
  const balance=data.points.reduce((s,p)=>s+Number(p.points),0)+extra;
  const roleRewards=data.rewards.filter(x=>!x.audience_role||x.audience_role===role);
  async function redeem(reward:Reward){
    if(balance<reward.points_cost)return;
    setBusy(reward.id);
    setMsg('');
    try{
      if(mode==='demo'){
        addDemoImpact(userId,-reward.points_cost,`Échange : ${reward.name}`);
        setExtra(Number(localStorage.getItem(`eos-demo-impact-extra-${userId}`)||0));
        setMsg(`Récompense demandée : ${reward.name}.`);
      }else{
        const {error}=await supabase.rpc('redeem_reward',{p_reward_id:reward.id});
        if(error)throw error;
        setMsg(`Échange enregistré : ${reward.name}.`);
        window.dispatchEvent(new Event('eos-points-updated'));
      }
    }catch(e:any){
      setMsg(e?.message||'Impossible d’échanger cette récompense.');
    }finally{setBusy('')}
  }
  return <><div className="points-hero"><div><span>Mon Impact</span><strong>{fr(balance)}</strong><small>Points de contribution · {roleLabels[role].toLowerCase()}</small></div><Star size={44}/></div>
    {msg&&<div className="alert">{msg}</div>}
    <div className="impact-note"><Sparkles size={17}/><div><b>Tout le monde contribue.</b><span>Élève, parent, professeur, administration, direction ou cantine : le même moteur de points, des récompenses adaptées au rôle.</span></div></div>
    <Panel title="Récompenses disponibles"><div className="reward-grid">{roleRewards.length?roleRewards.map(x=><div className="reward" key={x.id}><div className="reward-icon">{role==='director'?'◈':x.points_cost<800?'☕':x.points_cost<2000?'✦':'🎁'}</div><div><b>{x.name}</b><span>{fr(x.points_cost)} Impact{x.points_cost>balance?` · il vous manque ${fr(x.points_cost-balance)}`:''}</span></div><button className="outline" disabled={balance<x.points_cost||!!busy} onClick={()=>redeem(x)}>{busy===x.id?'…':'Échanger'}</button></div>):<Empty text="Aucune récompense disponible pour votre rôle."/>}</div></Panel>
    <Panel title="Activité récente">{[...data.points,...demoStorage<any[]>(`eos-demo-impact-events-${userId}`,[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,8).map((x:any)=><div className="row" key={x.id}><b>{Number(x.points)>0?`+${x.points}`:x.points}</b><span>{x.reason}</span><small>{new Intl.DateTimeFormat('fr-FR').format(new Date(x.created_at))}</small></div>)}</Panel>
  </>
}

function Agora({role,mode,session,profile,schoolId}:{role:Role,mode:Mode,session:any,profile:Profile|null,schoolId:string|null}){
  const [section,setSection]=useState<'ideas'|'surveys'|'roadmap'>('ideas')
  const [ideas,setIdeas]=useState<CommunityIdea[]>([])
  const [surveys,setSurveys]=useState<CommunitySurvey[]>([])
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false)
  const userId=mode==='live'?session?.user?.id:(profile?.id||`demo-${role}`)
  const authorName=profile?.full_name||roleLabels[role]
  useEffect(()=>{let alive=true;async function load(){setMsg('');if(mode==='demo'){const storedIdeas=demoStorage('eos-demo-agora-ideas',demoIdeaSeed).map((x:any)=>({...x,voted:!!demoStorage<string[]>(`eos-demo-votes-${userId}`,[]).includes(x.id)}));const storedSurveys=demoStorage('eos-demo-agora-surveys',demoSurveySeed);const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{});setIdeas(storedIdeas);setSurveys(storedSurveys.map((x:any)=>({...x,answer:answers[x.id]||null})));return}if(!schoolId||!userId){return}try{const [ir,sr]=await Promise.all([supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}),supabase.from('community_surveys').select('id,question,description,expires_at').eq('school_id',schoolId).eq('active',true).order('created_at',{ascending:false})]);if(ir.error)throw ir.error;if(sr.error)throw sr.error;const ids=(sr.data||[]).map((x:any)=>x.id);const [vr,or,allrr,myrr]=await Promise.all([supabase.from('community_idea_votes').select('idea_id').eq('user_id',userId),ids.length?supabase.from('community_survey_options').select('id,survey_id,label').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').eq('user_id',userId).in('survey_id',ids):Promise.resolve({data:[],error:null} as any)]);if(vr.error)throw vr.error;if(or.error)throw or.error;if(allrr.error)throw allrr.error;if(myrr.error)throw myrr.error;const voted=new Set((vr.data||[]).map((x:any)=>x.idea_id));const optionRows=(or.data||[]) as any[];const responseMap=new Map((myrr.data||[]).map((x:any)=>[x.survey_id,x.option_id]));const optionCounts=new Map<string,number>();(allrr.data||[]).forEach((x:any)=>optionCounts.set(x.option_id,(optionCounts.get(x.option_id)||0)+1));const grouped=(sr.data||[]).map((q:any)=>{const opts=optionRows.filter(o=>o.survey_id===q.id).map(o=>({id:o.id,label:o.label,votes:optionCounts.get(o.id)||0}));return {...q,options:opts,answer:responseMap.get(q.id)||null}});setIdeas((ir.data||[]).map((x:any)=>({id:x.id,title:x.title,description:x.description,author_name:x.author_name,role:x.role,status:x.status,votes:Number(x.vote_count||0),created_at:x.created_at,voted:voted.has(x.id)})));setSurveys(grouped)}catch(e:any){if(alive)setMsg(e?.message||'Agora indisponible pour le moment. Appliquez la migration Supabase dédiée.')}}load();return()=>{alive=false}},[mode,schoolId,userId])
  async function submitIdea(e:React.FormEvent){e.preventDefault();const t=title.trim(),d=description.trim();if(t.length<8||d.length<12){setMsg('Donnez un titre clair et une description utile.');return}setBusy(true);setMsg('');try{if(mode==='demo'){const next:CommunityIdea={id:`idea-${Date.now()}`,title:t,description:d,author_name:authorName,role,status:'new',votes:0,created_at:new Date().toISOString()};const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed);saveDemoStorage('eos-demo-agora-ideas',[next,...stored]);setIdeas((x)=>[next,...x]);addDemoImpact(userId,10,'Idée proposée dans Agora');}else{const {error}=await supabase.rpc('submit_community_idea',{p_title:t,p_description:d});if(error)throw error;const {data:rows,error:readError}=await supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('school_id',schoolId).order('created_at',{ascending:false});if(readError)throw readError;setIdeas((rows||[]).map((x:any)=>({...x,votes:Number(x.vote_count||0)})));window.dispatchEvent(new Event('eos-points-updated'))}setTitle('');setDescription('');setMsg('Idée envoyée. +10 Impact pour votre contribution.')}catch(e:any){setMsg(e?.message||'Impossible d’envoyer cette idée.')}finally{setBusy(false)}}
  async function vote(id:string){const current=ideas.find(x=>x.id===id);if(!current||current.voted)return;try{if(mode==='demo'){const votes=demoStorage<string[]>(`eos-demo-votes-${userId}`,[]);if(votes.includes(id))return;saveDemoStorage(`eos-demo-votes-${userId}`,[id,...votes]);const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed).map(x=>x.id===id?{...x,votes:x.votes+1,voted:true}:x);saveDemoStorage('eos-demo-agora-ideas',stored);setIdeas(stored);addDemoImpact(userId,2,'Vote utile dans Agora');}else{const {error}=await supabase.rpc('vote_community_idea',{p_idea_id:id});if(error)throw error;setIdeas(x=>x.map(i=>i.id===id?{...i,votes:i.votes+1,voted:true}:i));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(e?.message||'Vote impossible.')}}
  async function answerSurvey(surveyId:string,optionId:string){const survey=surveys.find(x=>x.id===surveyId);if(!survey||survey.answer)return;try{if(mode==='demo'){const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{});answers[surveyId]=optionId;saveDemoStorage(`eos-demo-survey-answers-${userId}`,answers);const stored=demoStorage<CommunitySurvey[]>('eos-demo-agora-surveys',demoSurveySeed).map(s=>s.id===surveyId?{...s,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o),answer:optionId}:s);saveDemoStorage('eos-demo-agora-surveys',stored);setSurveys(stored);addDemoImpact(userId,2,'Participation à un sondage');}else{const {error}=await supabase.rpc('respond_community_survey',{p_survey_id:surveyId,p_option_id:optionId});if(error)throw error;setSurveys(x=>x.map(s=>s.id===surveyId?{...s,answer:optionId,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o)}:s));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(e?.message||'Réponse impossible.')}}
  return <><div className="section-intro"><div><span className="eyebrow">ÉCOLE OS / COMMUNAUTÉ</span><h1>Agora.</h1><p>Les idées qui améliorent l'école passent par ici : proposer, voter, voir ce qui avance.</p></div><span className="pill"><Sparkles size={15}/> +10 Impact par idée retenue</span></div><div className="agora-tabs"><button className={section==='ideas'?'active':''} onClick={()=>setSection('ideas')}><Lightbulb size={16}/>Idées</button><button className={section==='surveys'?'active':''} onClick={()=>setSection('surveys')}><BarChart3 size={16}/>Sondages</button><button className={section==='roadmap'?'active':''} onClick={()=>setSection('roadmap')}><ListChecks size={16}/>Feuille de route</button></div>{msg&&<div className="alert">{msg}</div>}{section==='ideas'&&<div className="agora-layout"><section className="panel"><div className="panel-head"><div><h3>Proposer une amélioration</h3><span className="panel-subtitle">Une idée courte, concrète et utile.</span></div><MessageSquarePlus size={18}/></div><form className="agora-form" onSubmit={submitIdea}><label>Titre<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={110} placeholder="Ex. Calendrier commun parents / professeurs"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={420} placeholder="Pourquoi cette amélioration aiderait l'école ?" rows={4}/></label><button className="primary" disabled={busy}><Lightbulb size={16}/>{busy?'Envoi…':'Proposer mon idée'}</button></form></section><section className="panel"><div className="panel-head"><div><h3>Les idées de la communauté</h3><span className="panel-subtitle">Un vote par idée. Pas de classement des personnes.</span></div><ThumbsUp size={18}/></div><div className="idea-list">{ideas.length?ideas.map(x=><article className="idea-card" key={x.id}><div className="idea-head"><div><b>{x.title}</b><span>{x.description}</span></div><button className={`vote-btn${x.voted?' voted':''}`} disabled={x.voted} onClick={()=>vote(x.id)}><ThumbsUp size={15}/>{x.votes}</button></div><div className="idea-meta"><span className={`idea-status ${ideaStatusClass[x.status]}`}>{ideaStatusLabel[x.status]}</span><span>{roleLabels[x.role]} · {x.author_name}</span><span>{shortDate(x.created_at)}</span></div></article>):<Empty text="Aucune idée pour le moment."/>}</div></section></div>}{section==='surveys'&&<div className="survey-list">{surveys.length?surveys.map(s=>{const total=s.options.reduce((n,o)=>n+o.votes,0);return <section className="panel survey-card" key={s.id}><div className="panel-head"><div><h3>{s.question}</h3><span className="panel-subtitle">{s.description}</span></div><BarChart3 size={18}/></div><div className="survey-options">{s.options.map(o=>{const pct=total?Math.round(o.votes/total*100):0;const selected=s.answer===o.id;return <button key={o.id} className={`survey-option${selected?' selected':''}`} disabled={!!s.answer} onClick={()=>answerSurvey(s.id,o.id)}><span className="survey-option-top"><b>{o.label}</b><small>{pct}%</small></span><span className="survey-bar"><i style={{width:`${pct}%`}}/></span></button>})}</div>{s.answer?<small className="survey-done"><CheckCircle2 size={15}/> Merci. Votre réponse compte.</small>:<small className="survey-hint">1 réponse · +2 Impact</small>}</section>}) : <div className="panel"><Empty text="Aucun sondage actif."/></div>}</div>}{section==='roadmap'&&<div className="roadmap-grid">{(['new','review','planned','building','done'] as IdeaStatus[]).map(status=><section className="panel roadmap-col" key={status}><div className="roadmap-title"><span className={`idea-status ${ideaStatusClass[status]}`}>{ideaStatusLabel[status]}</span><b>{ideas.filter(x=>x.status===status).length}</b></div>{ideas.filter(x=>x.status===status).map(x=><article className="roadmap-item" key={x.id}><b>{x.title}</b><small>{x.votes} votes</small></article>)}{!ideas.some(x=>x.status===status)&&<small className="muted">Rien pour l'instant.</small>}</section>)}</div>}</>}


function Community({role,mode,session,profile,schoolId}:{role:Role,mode:Mode,session:any,profile:Profile|null,schoolId:string|null}){
  const userId=profile?.id||session?.user?.id||'anonymous'
  const demoSpaces:CommunitySpace[]=[
    {id:'demo-class',name:profile?.class_name?`Classe ${profile.class_name}`:'Mon groupe',description:'Votre espace de classe : devoirs, entraide et informations liées à votre groupe.',kind:'community',scope_type:'class',scope_key:profile?.class_name||'4e B',priority:10,created_at:'2026-09-24T07:55:00Z'},
    {id:'demo-announcements',name:'Annonces de l’établissement',description:'Informations officielles de l’établissement. Les publications sont encadrées.',kind:'announcement',scope_type:'school',priority:20,created_at:'2026-09-24T08:00:00Z'},
    {id:'demo-community',name:'Vie de l’établissement',description:'Échanges entre membres sur la vie scolaire. Ce n’est pas un espace d’annonces officielles.',kind:'community',scope_type:'school',priority:50,created_at:'2026-09-24T08:05:00Z'},
  ]
  const demoMessages:CommunityMessage[]=[
    {id:'dm1',space_id:'demo-announcements',sender_id:demoRoleIds.director,sender_name:'Ibrahima Sarr',sender_role:'director',body:'Réunion parents-professeurs : jeudi à 17 h, salle polyvalente. Cette information est officielle et reste disponible pour les nouveaux arrivants.',created_at:'2026-09-24T08:12:00Z'},
    {id:'dm2',space_id:'demo-class',sender_id:demoRoleIds.teacher,sender_name:'Cheikh Fall',sender_role:'teacher',body:'Devoir de maths : exercices 4 à 8. La correction sera partagée après la séance de vendredi.',created_at:'2026-09-24T09:30:00Z'},
    {id:'dm3',space_id:'demo-class',sender_id:demoRoleIds.parent,sender_name:'Aminata Ndiaye',sender_role:'parent',body:'Merci pour la précision. Je l’ai bien noté pour cette semaine.',created_at:'2026-09-24T10:02:00Z'},
    {id:'dm4',space_id:'demo-community',sender_id:demoRoleIds.student,sender_name:'Awa Diop',sender_role:'student',body:'Pour les révisions de vendredi, la salle 3 est disponible de 16 h à 18 h.',created_at:'2026-09-24T10:40:00Z'},
  ]
  const [spaces,setSpaces]=useState<CommunitySpace[]>([])
  const [selected,setSelected]=useState('')
  const [messages,setMessages]=useState<CommunityMessage[]>([])
  const [overview,setOverview]=useState<CommunitySpace[]>([])
  const [draft,setDraft]=useState('')
  const [spaceFilter,setSpaceFilter]=useState('')
  const [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const [ideaAssistDismissed,setIdeaAssistDismissed]=useState(false)

  const selectedSpace=spaces.find(x=>x.id===selected)||spaces[0]||null
  const isDemo=mode==='demo'
  const detectedIdea=useMemo(()=>detectCommunityIntent(draft),[draft])
  const totalUnread=overview.reduce((s,x)=>s+Number(x.unread_count||0),0)
  const filteredSpaces=useMemo(()=>{
    const q=spaceFilter.trim().toLowerCase()
    if(!q)return spaces
    return spaces.filter(s=>`${s.name} ${s.description}`.toLowerCase().includes(q))
  },[spaces,spaceFilter])
  const visibleMessages=messages.filter(x=>x.space_id===selectedSpace?.id)
  const canAnnounce=['admin','director','teacher'].includes(role)
  const scopeLabel=(space:CommunitySpace)=>space.scope_type==='class'?'Votre classe':space.kind==='announcement'?'Annonce officielle':'Vie de l’établissement'
  const scopeIcon=(space:CommunitySpace)=>space.scope_type==='class'?<UsersRound size={16}/>:space.kind==='announcement'?<Megaphone size={16}/>:<MessageCircle size={16}/>
  const timeOnly=(d:string)=>{const x=new Date(d);return isNaN(x.getTime())?'':new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(x)}

  function sortSpaces(rows:CommunitySpace[]){return [...rows].sort((a,b)=>(Number(a.priority??50)-Number(b.priority??50))||a.name.localeCompare(b.name))}
  function sanitizeDemoMessages(rows:CommunityMessage[]){return rows.filter(m=>!m.body.startsWith('Idée utile : un résumé hebdomadaire des annonces et discussions importantes'))}
  function readDemoSpaces(){
    const stored=demoStorage<CommunitySpace[]>('eos-demo-community-spaces',demoSpaces)
    const visibleDemoMessages=sanitizeDemoMessages(demoMessages)
    const enriched=sortSpaces(stored.map(s=>{const all=visibleDemoMessages.filter(m=>m.space_id===s.id);return {...s,unread_count:all.length,latest_body:all.at(-1)?.body||null,latest_at:all.at(-1)?.created_at||null}}))
    saveDemoStorage('eos-demo-community-spaces',enriched)
    setSpaces(enriched);setOverview(enriched)
    setSelected(current=>current||enriched[0]?.id||'')
  }
  function demoKey(spaceId:string){return `eos-demo-community-messages-${spaceId}`}
  function loadDemoMessages(spaceId:string){
    const seed=demoMessages.filter(m=>m.space_id===spaceId)
    const stored=sanitizeDemoMessages(demoStorage<CommunityMessage[]>(demoKey(spaceId),seed))
    saveDemoStorage(demoKey(spaceId),stored)
    setMessages(stored)
    const fresh=spaces.map(s=>s.id===spaceId?{...s,unread_count:0,latest_body:stored.at(-1)?.body||null,latest_at:stored.at(-1)?.created_at||null}:s)
    setSpaces(fresh);setOverview(fresh);saveDemoStorage('eos-demo-community-spaces',fresh)
  }
  async function loadLiveSpaces(){
    if(!schoolId||!userId)return
    setLoading(true);setError('')
    try{
      const {error:ensureError}=await supabase.rpc('ensure_default_community_spaces')
      if(ensureError)throw ensureError
      const {data,error}=await supabase.rpc('get_community_overview')
      if(error)throw error
      const rows=sortSpaces((data||[]) as CommunitySpace[])
      setOverview(rows);setSpaces(rows);setSelected(current=>current||String(rows[0]?.id||''))
    }catch(e:any){setError(e?.message||'La Communauté est momentanément indisponible.')}finally{setLoading(false)}
  }
  async function loadLiveMessages(spaceId:string){
    if(!spaceId)return
    try{
      const {data,error}=await supabase.from('community_messages').select('id,space_id,sender_id,sender_name,sender_role,body,created_at').eq('space_id',spaceId).is('deleted_at',null).order('created_at',{ascending:true}).limit(80)
      if(error)throw error
      setMessages((data||[]).map((x:any)=>({id:x.id,space_id:x.space_id,sender_id:x.sender_id,sender_name:x.sender_name||'Membre',sender_role:(x.sender_role||'student') as Role,body:x.body,created_at:x.created_at,mine:x.sender_id===userId})))
      await supabase.rpc('mark_community_space_read',{p_space_id:spaceId})
      setOverview(prev=>prev.map(s=>s.id===spaceId?{...s,unread_count:0}:s))
    }catch(e:any){setError(e?.message||'Impossible de charger cette conversation.')} 
  }
  useEffect(()=>{if(isDemo){setLoading(false);readDemoSpaces();return}loadLiveSpaces()},[mode,schoolId,userId,role,profile?.class_name])
  useEffect(()=>{if(!selectedSpace)return;if(isDemo){loadDemoMessages(selectedSpace.id);return}loadLiveMessages(selectedSpace.id)},[selectedSpace?.id,isDemo])
  useEffect(()=>{
    if(isDemo||!schoolId)return
    const channel=supabase.channel(`eos-community-${schoolId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages',filter:`school_id=eq.${schoolId}`},payload=>{
      const row:any=payload.new
      setOverview(prev=>prev.map(s=>s.id===row.space_id?{...s,unread_count:(s.unread_count||0)+(row.sender_id===userId?0:1),latest_body:row.body,latest_at:row.created_at}:s))
      if(row.space_id===selectedSpace?.id){
        setMessages(prev=>prev.some(x=>x.id===row.id)?prev:[...prev,{id:row.id,space_id:row.space_id,sender_id:row.sender_id,sender_name:row.sender_id===userId?'Vous':'Membre',sender_role:'student',body:row.body,created_at:row.created_at,mine:row.sender_id===userId}])
        if(row.sender_id!==userId)void supabase.rpc('mark_community_space_read',{p_space_id:row.space_id})
      }
    }).subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[isDemo,schoolId,selectedSpace?.id,userId])

  async function sendToEvolution(){
    if(!detectedIdea||sending)return
    setSending(true);setNotice('');setError('')
    try{
      if(isDemo){
        const next:CommunityIdea={id:`idea-${Date.now()}`,title:detectedIdea.title,description:detectedIdea.description,author_name:profile?.full_name||roleLabels[role],role,status:'new',votes:0,created_at:new Date().toISOString()}
        const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed)
        saveDemoStorage('eos-demo-agora-ideas',[next,...stored])
        addDemoImpact(userId,10,'Suggestion ajoutée à Evolution depuis la Communauté')
      }else{
        const {error}=await supabase.rpc('submit_community_idea',{p_title:detectedIdea.title,p_description:detectedIdea.description})
        if(error)throw error
        window.dispatchEvent(new Event('eos-points-updated'))
      }
      setIdeaAssistDismissed(true)
      setNotice('La suggestion a été copiée dans Evolution. Votre message reste inchangé dans cette conversation.')
    }catch(e:any){setError(e?.message||'Impossible d’ajouter cette suggestion à Evolution.')}finally{setSending(false)}
  }
  async function sendMessage(e:React.FormEvent){
    e.preventDefault()
    const body=draft.trim();if(!body||!selectedSpace||sending)return
    if(body.length>2000){setNotice('Votre message dépasse la limite de 2 000 caractères.');return}
    setSending(true);setNotice('');setError('')
    try{
      if(isDemo){
        const local:CommunityMessage={id:`local-${Date.now()}`,space_id:selectedSpace.id,sender_id:userId,sender_name:profile?.full_name||roleLabels[role],sender_role:role,body,created_at:new Date().toISOString(),mine:true}
        const next=[...messages,local];saveDemoStorage(demoKey(selectedSpace.id),next);setMessages(next);setOverview(prev=>prev.map(s=>s.id===selectedSpace.id?{...s,latest_body:body,latest_at:local.created_at,unread_count:0}:s));setDraft('');return
      }
      const {error}=await supabase.rpc('send_community_message',{p_space_id:selectedSpace.id,p_body:body})
      if(error)throw error
      setDraft(''); await loadLiveMessages(selectedSpace.id)
    }catch(e:any){setError(e?.message||'Message non envoyé.')}finally{setSending(false)}
  }
  async function reportMessage(messageId:string){
    const reason=window.prompt('Expliquez brièvement pourquoi vous signalez ce message. S’il s’agit d’une urgence, contactez directement l’établissement.')?.trim();if(!reason)return
    try{if(isDemo){setNotice('Signalement démo enregistré localement.');return}const {error}=await supabase.rpc('report_community_message',{p_message_id:messageId,p_reason:reason});if(error)throw error;setNotice('Signalement reçu. Il sera examiné séparément de la discussion.')}catch(e:any){setError(e?.message||'Impossible de signaler ce message.')}  
  }

  return <div className="community-page">
    <div className="section-intro community-page-intro">
      <div><span className="eyebrow">ÉCOLE OS / COMMUNAUTÉ</span><h1>Vos conversations, au bon endroit.</h1><p>Choisissez un espace, puis écrivez dans le fil correspondant. Chaque espace a un objectif clair ; les annonces officielles restent séparées des discussions.</p></div>
      <div className="community-status"><ShieldCheck size={16}/><span>{totalUnread?`${totalUnread} nouveau${totalUnread>1?'x':''} message${totalUnread>1?'s':''}`:'Tout est à jour'}</span></div>
    </div>
    {error&&<div className="alert error">{error}</div>}{notice&&<div className="alert">{notice}</div>}
    <div className="community-shell-v2">
      <aside className="community-inbox panel" aria-label="Vos conversations">
        <div className="community-inbox-head"><div><span className="eyebrow">VOS ESPACES</span><h3>Conversations</h3></div><span className="community-count">{spaces.length}</span></div>
        <label className="community-search"><Search size={16}/><input value={spaceFilter} onChange={e=>setSpaceFilter(e.target.value)} placeholder="Rechercher un espace…" aria-label="Rechercher un espace"/></label>
        <div className="community-clarity"><Info size={15}/><div><b>Un espace = un contexte.</b><span>Les messages restent dans l’espace où ils ont été publiés. Les idées d’amélioration se proposent dans <strong>Evolution</strong>.</span></div></div>
        <div className="community-room-list-v2">
          {loading?<div className="skeleton"><i/><i/><i/></div>:filteredSpaces.map(space=>{
            const unread=Number(space.unread_count||0)>0
            return <button key={space.id} className={`community-conversation-item${selectedSpace?.id===space.id?' active':''}`} onClick={()=>setSelected(space.id)} aria-current={selectedSpace?.id===space.id?'true':undefined}>
              <span className={`community-avatar ${space.kind}`} aria-hidden="true">{scopeIcon(space)}</span>
              <span className="community-conversation-copy"><span className="community-conversation-line"><b>{space.name}</b>{unread&&<em>{space.unread_count}</em>}</span><small>{scopeLabel(space)}</small><span>{space.latest_body||'Aucun message pour le moment.'}</span></span>
              <time>{space.latest_at?timeOnly(space.latest_at):''}</time>
            </button>
          })}
          {!loading&&!filteredSpaces.length&&<Empty text="Aucun espace ne correspond à votre recherche."/>}
        </div>
        <div className="community-inbox-note"><LockKeyhole size={14}/><span>Les espaces accessibles dépendent de votre compte et de votre établissement.</span></div>
      </aside>
      <section className="community-chat-v2 panel">
        {selectedSpace?<>
          <header className="community-chat-head-v2">
            <div className="community-chat-title-v2"><span className={`community-avatar large ${selectedSpace.kind}`}>{scopeIcon(selectedSpace)}</span><div><div className="community-title-line"><h3>{selectedSpace.name}</h3><span>{scopeLabel(selectedSpace)}</span></div><p>{selectedSpace.description}</p></div></div>
          </header>
          <div className="community-messages-v2" aria-live="polite">
            {!visibleMessages.length&&<div className="community-empty-chat"><span className={`community-avatar large ${selectedSpace.kind}`}>{scopeIcon(selectedSpace)}</span><h3>Début de cette conversation</h3><p>{selectedSpace.kind==='announcement'?'Les annonces officielles publiées ici restent visibles pour les nouveaux arrivants.':'Les membres de cet espace peuvent écrire ici. Choisissez un autre espace si votre message concerne un autre sujet.'}</p></div>}
            {visibleMessages.map((m,index)=><article className={`community-message-v2${m.mine?' mine':''}`} key={m.id}>
              {!m.mine&&<div className="community-message-avatar-v2">{firstLetters(m.sender_name)}</div>}
              <div className="community-message-wrap-v2"><div className="community-message-meta-v2"><b>{m.mine?'Vous':m.sender_name}</b><span>{roleLabels[m.sender_role]}</span><time>{timeOnly(m.created_at)}</time>{!m.mine&&<button className="icon-btn community-report" title="Signaler ce message" aria-label="Signaler ce message" onClick={()=>reportMessage(m.id)}><Flag size={13}/></button>}</div><div className="community-bubble-v2">{m.body}</div></div>
            </article>)}
          </div>
          {detectedIdea&&!ideaAssistDismissed&&selectedSpace.kind==='community'&&<div className="community-idea-hint" role="status"><Lightbulb size={16}/><div><b>Vous semblez proposer une amélioration.</b><span>Le message peut rester ici. Si vous souhaitez aussi le soumettre à <strong>Evolution</strong>, vous pouvez le faire ; rien n’est déplacé ni supprimé automatiquement.</span></div><button type="button" className="outline" onClick={()=>void sendToEvolution()} disabled={sending}>Ajouter à Evolution</button><button type="button" className="icon-btn" title="Ne plus proposer" aria-label="Ne plus proposer" onClick={()=>setIdeaAssistDismissed(true)}><X size={15}/></button></div>}
          <form className="community-composer-v2" onSubmit={sendMessage}>
            <div className="community-composer-label"><span>{selectedSpace.kind==='announcement'?'Publier une annonce officielle':'Écrire dans '+selectedSpace.name}</span><small>{selectedSpace.kind==='announcement'?(canAnnounce?'Publication réservée au personnel autorisé.':'Lecture seule pour votre compte.'):'Votre message sera visible par les membres de cet espace.'}</small></div>
            <div className="community-composer-row"><textarea value={draft} onChange={e=>{setDraft(e.target.value);setIdeaAssistDismissed(false)}} maxLength={2000} rows={3} placeholder={selectedSpace.kind==='announcement'&&!canAnnounce?'Vous pouvez consulter les annonces, mais ce compte ne peut pas en publier.':'Écrivez un message clair et directement lié à cet espace…'} disabled={selectedSpace.kind==='announcement'&&!canAnnounce} aria-label="Votre message"/><button className="primary community-send" disabled={sending||!draft.trim()||selectedSpace.kind==='announcement'&&!canAnnounce}>{sending?'Envoi…':<><Send size={15}/>Envoyer</>}</button></div>
            <div className="community-compose-legal"><span>{draft.length}/2000</span><span>Un message reste dans cet espace.</span></div>
          </form>
        </>:<div className="community-no-selection"><MessageCircle size={26}/><h3>Sélectionnez une conversation</h3><p>Choisissez un espace à gauche pour lire les messages et participer à la discussion.</p></div>}
      </section>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>)
