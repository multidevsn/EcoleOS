import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Mode, fr, shortMoney, frToday, shortDate, Empty, KpiStrip, MiniBar, Card} from './shared'
import {Panel, OrdersTable} from './ui'
import {createRoot} from 'react-dom/client'
import {supabase} from './lib/supabase'
const TechnicalOpsScreen=React.lazy(()=>import('./TechnicalOpsScreen').then(m=>({default:m.TechnicalOps})))
const FoodScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.Food})))
const ScheduleScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.Schedule})))
const GradesScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.Grades})))
const MembersScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.SchoolMembers})))
const PilotageScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.DirectorPilotage})))
const PaymentsScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.Payments})))
const AccountScreen=React.lazy(()=>import('./screens-core').then(m=>({default:m.Account})))
const RewardsScreen=React.lazy(()=>import('./screens-engagement').then(m=>({default:m.Rewards})))
const AgoraScreen=React.lazy(()=>import('./screens-engagement').then(m=>({default:m.Agora})))
const CommunityScreen=React.lazy(()=>import('./screens-engagement').then(m=>({default:m.Community})))
function ScreenFallback(){return <div className="panel"><div className="skeleton"><i/><i/></div></div>}
import {Analytics} from '@vercel/analytics/react'
import {SpeedInsights} from '@vercel/speed-insights/react'
import {applyOwnerParam,isOwnerDevice,setOwnerDevice,skipOwnerVisits} from './lib/ownerTraffic'
import {BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Gift, GraduationCap, KeyRound, Landmark, LogOut, Mail, Menu, Package, Save, School, ShieldCheck, ShoppingCart, FileUp, UserPlus, RefreshCw, Check, AlertTriangle, Sparkles, Star, UserRound, Users, UtensilsCrossed, WalletCards, X, Lightbulb, MessageSquarePlus, ThumbsUp, BarChart3, Palette, ListChecks, Gauge, Activity, ServerCog, MessageCircle, Megaphone, Send, Flag, ShieldAlert, Search, Info, UsersRound, LockKeyhole} from 'lucide-react'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import '@fontsource/caveat/600.css'
import './styles.css'

type Role='student'|'parent'|'teacher'|'admin'|'director'|'cafeteria'
type Tab='home'|'food'|'schedule'|'grades'|'payments'|'rewards'|'members'|'agora'|'community'|'pilotage'|'ops'|'account'
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
const isRole=(value:unknown):value is Role=>typeof value==='string' && Object.prototype.hasOwnProperty.call(roleLabels,value)
const roleLabel=(value:unknown)=>isRole(value)?roleLabels[value]:String(value??'—')
const nav:[Tab,string,React.ElementType][]=[['home','Accueil',School],['food','Food',ShoppingCart],['schedule','Emploi du temps',CalendarDays],['grades','Notes',GraduationCap],['payments','Paiements',WalletCards],['rewards','Récompenses',Gift],['members','Membres',Users],['agora','Agora',Lightbulb],['community','Communauté',MessageCircle],['pilotage','Pilotage',BarChart3],['ops','Ops',ServerCog],['account','Mon compte',UserRound]]
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
const navContextLabel:Record<Tab,string>={home:'Votre journée',food:'Services du quotidien',schedule:'Votre planning',grades:'Scolarité',payments:'Finances',rewards:'Points & avantages',members:'Équipe & membres',agora:'Évolution d’École OS',community:'Espaces de confiance',pilotage:'Pilotage établissement',ops:'Système & coûts',account:'Préférences'}
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
function avg(grades:Grade[]){const den=grades.reduce((s,g)=>s+Number(g.coefficient),0);return den?grades.reduce((s,g)=>s+Number(g.value)*Number(g.coefficient),0)/den:0}
function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d}
function isoDate(d:Date){return d.toISOString().slice(0,10)}
function nextClass(schedule:ScheduleRow[]){const now=new Date();const day=((now.getDay()+6)%7)+1;const today=schedule.filter(s=>s.weekday===day).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));const time=now.toTimeString().slice(0,5);return today.find(s=>s.ends_at>=time)||today[0]||null}
function firstLetters(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'EO'}
function mention(avg:number){return avg>=16?'Excellent !':avg>=14?'Très bien':avg>=12?'Bien':avg>=10?'Assez bien':'Peut mieux faire'}


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

// Un chunk chargé à la demande (React.lazy, ex. l’onglet Ops) peut avoir un nom qui change à chaque
// déploiement. Si le navigateur a gardé une ancienne page en mémoire au moment du clic, il peut tenter de
// charger un fichier qui n’existe plus sur le serveur : ce n’est pas une vraie erreur d’application, juste
// une version obsolète. On la détecte par son message caractéristique et on recharge une seule fois pour
// récupérer la dernière version, avant d’afficher l’écran d’erreur.
function isStaleChunkError(error:Error){
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(error?.message||'')
}
const STALE_RELOAD_KEY='eos-stale-chunk-reload'

class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{
  state:{error:Error|null}={error:null}
  static getDerivedStateFromError(error:Error){
    if(isStaleChunkError(error)){
      let alreadyTried=false
      try{alreadyTried=sessionStorage.getItem(STALE_RELOAD_KEY)==='1'}catch{/* stockage indisponible */}
      if(!alreadyTried){
        try{sessionStorage.setItem(STALE_RELOAD_KEY,'1')}catch{/* pas grave, on tente quand même */}
        window.location.reload()
        return {error:null} // le rechargement est en cours : pas la peine d’afficher l’écran d’erreur
      }
    }
    return {error}
  }
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
    // ÉTAPE 1 : identité et relation élève/parent.
    const {data:profileRow,error:profileError}=await supabase
      .from('profiles')
      .select('id,full_name,role,student_code,school_id')
      .eq('id',userId)
      .single()
    if(profileError)throw profileError

    const effectiveRole=profileRow.role as Role
    let studentId:string|null=effectiveRole==='student'?userId:null

    if(effectiveRole==='parent'){
      const {data:links,error}=await supabase.from('parent_students').select('student_id').eq('parent_id',userId).limit(1)
      if(error)throw error
      studentId=links?.[0]?.student_id||null
    }

    // Une seule lecture de class_members sert à la fois au libellé de classe et au planning.
    let className:string|null=null
    let classIds:string[]=[]
    if(studentId){
      const {data:members,error}=await supabase.from('class_members').select('class_id').eq('student_id',studentId)
      if(error)throw error
      classIds=(members||[]).map((m:any)=>String(m.class_id)).filter(Boolean)
      const classId=classIds[0]
      if(classId){
        const {data:classRow,error:classError}=await supabase.from('classes').select('name').eq('id',classId).maybeSingle()
        if(classError)throw classError
        className=classRow?.name||null
      }
    }

    const needsAcademic=['student','parent','teacher','admin'].includes(effectiveRole)
    const needsGrades=effectiveRole==='student'||effectiveRole==='parent'||effectiveRole==='teacher'||effectiveRole==='admin'
    const needsSchedule=needsGrades
    const needsPayments=!!studentId||effectiveRole==='admin'
    const needsOrders=effectiveRole==='student'||effectiveRole==='parent'||effectiveRole==='admin'||effectiveRole==='cafeteria'
    const needsPoints=true

    // ÉTAPE 2 : toutes les lectures indépendantes partent ensemble.
    const [subjectsRes,gradesRes,scheduleRes,paymentsRes,pointsRes,ordersRes,schoolRes,subRes,refRes]=await Promise.all([
      needsAcademic
        ? supabase.from('subjects').select('id,name,coefficient')
        : Promise.resolve({data:[],error:null} as any),
      needsGrades
        ? (studentId
            ? supabase.from('grades').select('id,subject_id,value,term,created_at').eq('student_id',studentId).order('created_at',{ascending:false})
            : effectiveRole==='teacher'||effectiveRole==='admin'
              ? supabase.from('grades').select('id,subject_id,value,term,created_at').order('created_at',{ascending:false}).limit(50)
              : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),
      needsSchedule
        ? (effectiveRole==='teacher'
            ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').eq('teacher_id',userId).order('weekday').order('starts_at')
            : studentId && classIds.length
              ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').in('class_id',classIds).order('weekday').order('starts_at')
              : effectiveRole==='admin'
                ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id').order('weekday').order('starts_at')
                : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),
      needsPayments
        ? (studentId
            ? supabase.from('school_payments').select('id,description,amount_xof,status,due_date').eq('user_id',studentId).order('due_date',{ascending:false})
            : effectiveRole==='admin'
              ? supabase.from('school_payments').select('id,description,amount_xof,status,due_date').order('due_date',{ascending:false}).limit(30)
              : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),
      needsPoints
        ? supabase.from('point_ledger').select('id,points,reason,created_at').eq('user_id',profileRow.id).order('created_at',{ascending:false}).limit(50)
        : Promise.resolve({data:[],error:null} as any),
      needsOrders
        ? (effectiveRole==='admin'||effectiveRole==='cafeteria'
            ? supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40)
            : supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(20))
        : Promise.resolve({data:[],error:null} as any),
      profileRow.school_id
        ? supabase.from('schools').select('id,name,city,director_id').eq('id',profileRow.school_id).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),
      profileRow.school_id&&effectiveRole==='director'
        ? supabase.from('school_subscriptions').select('id,plan,status,billing_price_xof,current_period_end').eq('school_id',profileRow.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),
      profileRow.school_id
        ? supabase.from('referral_codes').select('code').eq('owner_id',userId).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),
    ])

    for(const result of [subjectsRes,gradesRes,scheduleRes,paymentsRes,pointsRes,ordersRes,schoolRes,subRes,refRes]){
      if(result?.error)throw result.error
    }

    const subjectMap=Object.fromEntries((subjectsRes.data||[]).map((sub:any)=>[sub.id,sub]))
    const grades:Grade[]=(gradesRes.data||[]).map((g:any)=>({
      id:g.id,
      subject:subjectMap[g.subject_id]?.name||'Matière',
      value:Number(g.value),
      coefficient:Number(subjectMap[g.subject_id]?.coefficient||1),
      term:g.term,
    }))
    const schedule:ScheduleRow[]=(scheduleRes.data||[]).map((x:any)=>({
      id:x.id,
      weekday:Number(x.weekday),
      starts_at:x.starts_at,
      ends_at:x.ends_at,
      subject:subjectMap[x.subject_id]?.name||'Cours',
      room:x.room,
      class_name:studentId?className||'Classe':'Classe',
    }))

    return {
      profile:{id:profileRow.id,full_name:profileRow.full_name,role:effectiveRole,email:'',school_id:profileRow.school_id,student_code:profileRow.student_code,class_name:className},
      studentId,
      school:(schoolRes.data||null) as SchoolInfo|null,
      subscription:(subRes.data||null) as SubscriptionInfo|null,
      referral:(refRes.data||null) as ReferralInfo|null,
      grades,
      schedule,
      payments:(paymentsRes.data||[]) as Payment[],
      points:(pointsRes.data||[]) as PointEvent[],
      foodItems:[],
      orders:(ordersRes.data||[]) as Order[],
      rewards:[],
      loading:false,
      error:null,
    }
  }catch(e:any){return {...empty,error:e?.message||'Impossible de charger les données.'}}
}

async function fetchDemoData(role:Role):Promise<AppData>{
  const profileId=demoRoleIds[role]
  const studentId=demoRoleIds.student
  try{
    const gradeOwner=(role==='student'||role==='parent'||role==='teacher'||role==='admin')?studentId:profileId
    const scheduleOwner=(role==='teacher')?demoRoleIds.teacher:(role==='student'||role==='parent'||role==='admin')?studentId:profileId
    const paymentOwner=(role==='student'||role==='parent'||role==='admin')?studentId:profileId
    const orderOwner=(role==='student'||role==='parent')?studentId:(role==='cafeteria'||role==='admin')?null:profileId

    const profilePromise=supabase.from('demo_profiles').select('id,full_name,role,class_name,child_name,email').eq('id',profileId).single()
    const gradesPromise=(role==='student'||role==='parent'||role==='teacher'||role==='admin')
      ?supabase.from('demo_grades').select('id,subject,value,coefficient,term').eq('profile_id',gradeOwner).order('value',{ascending:false})
      :Promise.resolve({data:[],error:null} as any)
    const schedulePromise=(role==='student'||role==='parent'||role==='teacher'||role==='admin')
      ?supabase.from('demo_schedule').select('id,weekday,starts_at,ends_at,subject,room,class_name').eq('profile_id',scheduleOwner).order('weekday').order('starts_at')
      :Promise.resolve({data:[],error:null} as any)
    const paymentsPromise=(role==='student'||role==='parent'||role==='admin')
      ?supabase.from('demo_payments').select('id,description,amount_xof,status,due_date').eq('profile_id',paymentOwner).order('due_date',{ascending:false})
      :Promise.resolve({data:[],error:null} as any)
    const pointsPromise=supabase.from('demo_points').select('id,points,reason,created_at').eq('profile_id',profileId).order('created_at',{ascending:false}).limit(50)
    const ordersPromise=(role==='student'||role==='parent'||role==='admin'||role==='cafeteria')
      ?(orderOwner
        ?supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('profile_id',orderOwner).order('created_at',{ascending:false}).limit(20)
        :supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40))
      :Promise.resolve({data:[],error:null} as any)
    const schoolPromise=role==='director'
      ?supabase.from('demo_school_accounts').select('school_name,city,plan,status,price_xof,period_end,referral_code').eq('profile_id',profileId).maybeSingle()
      :Promise.resolve({data:null,error:null} as any)

    const [p,g,s,pa,pt,o,ds]=await Promise.all([profilePromise,gradesPromise,schedulePromise,paymentsPromise,pointsPromise,ordersPromise,schoolPromise])
    const firstError=[p,g,s,pa,pt,o,ds].find(x=>x?.error)
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
      foodItems:[],
      orders:(o.data||[]) as Order[],
      rewards:[],
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
    if(mode==='demo'){
      setPlatformAdmin(role==='admin')
      return()=>{alive=false}
    }
    if(!session?.user){
      setPlatformAdmin(false)
      return()=>{alive=false}
    }
    // Le contrôle serveur de /api/admin/[action] reste la vraie barrière de sécurité.
    // Côté client, on évite toutefois d'appeler le très lourd /api/admin/tech à chaque connexion :
    // la liste d'emails de plateforme n'est pas un secret et ne sert qu'à afficher/masquer le menu Ops.
    const configured=String(import.meta.env.VITE_PLATFORM_ADMIN_EMAILS||'')
      .split(',')
      .map((x:string)=>x.trim().toLowerCase())
      .filter(Boolean)
    const email=String(session.user.email||'').trim().toLowerCase()
    const allowed=!!email&&configured.includes(email)
    if(alive){
      setPlatformAdmin(allowed)
      if(allowed)setOwnerDevice(true)
    }
    return()=>{alive=false}
  },[mode,role,session?.user?.email])
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
  const hydratedTabs=useRef<Set<string>>(new Set())
  useEffect(()=>{
    if(!session?.user?.id&&mode==='live')return
    const needsFood=tab==='food'&&!hydratedTabs.current.has('food')
    const needsRewards=tab==='rewards'&&!hydratedTabs.current.has('rewards')
    if(!needsFood&&!needsRewards)return
    const key=needsFood?'food':'rewards'
    hydratedTabs.current.add(key)
    let alive=true
    setData(d=>({...d,loading:true,error:null}))
    ;(async()=>{
      try{
        if(needsFood){
          if(mode==='demo'){
            const roleNow=role
            const orderOwner=(roleNow==='student'||roleNow==='parent')?demoRoleIds.student:(roleNow==='cafeteria'||roleNow==='admin')?null:demoRoleIds[roleNow]
            const [foodRes,ordersRes]=await Promise.all([
              supabase.from('food_items').select('id,name,price_xof,active').eq('active',true).order('name'),
              orderOwner
                ?supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('profile_id',orderOwner).order('created_at',{ascending:false}).limit(20)
                :supabase.from('demo_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40),
            ])
            if(foodRes.error)throw foodRes.error
            if(ordersRes.error)throw ordersRes.error
            if(alive)setData(d=>({...d,foodItems:(foodRes.data||[]) as FoodItem[],orders:(ordersRes.data||[]) as Order[],loading:false}))
          }else{
            const roleNow=data.profile?.role||role
            const isManager=roleNow==='admin'||roleNow==='cafeteria'
            const [foodRes,ordersRes]=await Promise.all([
              supabase.from('food_items').select('id,name,price_xof,active').eq('active',true).order('name'),
              isManager
                ?supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40)
                :supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(20)
            ])
            if(foodRes.error)throw foodRes.error
            if(ordersRes.error)throw ordersRes.error
            if(alive)setData(d=>({...d,foodItems:(foodRes.data||[]) as FoodItem[],orders:(ordersRes.data||[]) as Order[],loading:false}))
          }
        }else if(needsRewards){
          const rewardsRes=await supabase.from('rewards').select('id,name,points_cost,active,audience_role').eq('active',true).order('points_cost')
          if(rewardsRes.error)throw rewardsRes.error
          if(alive)setData(d=>({...d,rewards:(rewardsRes.data||[]) as Reward[],loading:false}))
        }
      }catch(error:any){
        hydratedTabs.current.delete(key)
        if(alive)setData(d=>({...d,loading:false,error:error?.message||`Impossible de charger ${key}.`}))
      }
    })()
    return()=>{alive=false}
  },[mode,tab,session?.user?.id,role,data.profile?.role])
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
          {tab==='food'&&<React.Suspense fallback={<ScreenFallback/>}><FoodScreen role={role} mode={mode} data={data} cart={cart} setCart={setCart} checkout={checkout} message={orderMsg}/></React.Suspense>} 
          {tab==='schedule'&&<React.Suspense fallback={<ScreenFallback/>}><ScheduleScreen role={role} mode={mode} data={data}/></React.Suspense>} 
          {tab==='grades'&&<React.Suspense fallback={<ScreenFallback/>}><GradesScreen role={role} data={data}/></React.Suspense>} 
          {tab==='payments'&&<React.Suspense fallback={<ScreenFallback/>}><PaymentsScreen role={role} mode={mode} data={data} session={session}/></React.Suspense>} 
          {tab==='rewards'&&<React.Suspense fallback={<ScreenFallback/>}><RewardsScreen role={role} mode={mode} data={data}/></React.Suspense>}
          {tab==='members'&&<React.Suspense fallback={<ScreenFallback/>}><MembersScreen role={role} session={session} mode={mode}/></React.Suspense>}
          {tab==='agora'&&<React.Suspense fallback={<ScreenFallback/>}><AgoraScreen role={role} mode={mode} session={session} profile={data.profile} schoolId={data.school?.id||null}/></React.Suspense>}
          {tab==='community'&&<React.Suspense fallback={<ScreenFallback/>}><CommunityScreen role={role} mode={mode} session={session} profile={data.profile} schoolId={data.school?.id||null}/></React.Suspense>}
          {tab==='pilotage'&&role==='director'&&<React.Suspense fallback={<ScreenFallback/>}><PilotageScreen mode={mode} session={session} data={data}/></React.Suspense>}
          {tab==='ops'&&platformAdmin&&<React.Suspense fallback={<ScreenFallback/>}><TechnicalOpsScreen mode={mode} session={session}/></React.Suspense>}
          {tab==='account'&&<React.Suspense fallback={<ScreenFallback/>}><AccountScreen role={role} mode={mode} data={data} session={session} theme={theme} onThemeChange={setTheme} onSaved={(profile)=>setData(d=>({...d,profile:{...d.profile,...profile} as Profile}))}/></React.Suspense>}
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


applyOwnerParam()
try{sessionStorage.removeItem(STALE_RELOAD_KEY)}catch{/* stockage indisponible */}

// Enregistre le service worker et vérifie régulièrement les mises à jour. Sans cet appel explicite,
// le worker s'enregistre passivement mais le rythme de vérification n'est pas maîtrisé : un déploiement
// peut rester invisible longtemps pour un onglet resté ouvert, avec le risque observé ci-dessus (un chunk
// chargé à la demande qui n'existe plus sur le serveur). registerType:'autoUpdate' fait déjà recharger la
// page dès qu'une mise à jour est détectée ; ce sondage périodique déclenche la détection elle-même.
import('virtual:pwa-register').then(({registerSW})=>{
  const intervalMs=15*60*1000 // Une seule vérification périodique : pas de double fetch du service worker.
  registerSW({
    onRegisteredSW(_swUrl,registration){
      if(!registration)return
      setInterval(()=>{
        if(!registration.installing&&navigator.onLine)void registration.update()
      },intervalMs)
    },
  })
}).catch(()=>{/* PWA indisponible (ex. hors production) : l'app fonctionne normalement sans elle */})

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/><Analytics beforeSend={skipOwnerVisits}/><SpeedInsights beforeSend={skipOwnerVisits}/></ErrorBoundary>)
