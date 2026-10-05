import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Mode, fr, shortMoney, frToday, shortDate, Empty, KpiStrip, MiniBar, Card} from './shared'
import {Panel, OrdersTable} from './ui'
import {createRoot} from 'react-dom/client'

let supabaseModulePromise: Promise<typeof import('./lib/supabase')> | null = null
const loadSupabase = async () => {
  supabaseModulePromise ??= import('./lib/supabase')
  const mod = await supabaseModulePromise
  return mod.supabase
}

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
import './fonts.css'
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

type AppData={profile:Profile|null;studentId:string|null;school:SchoolInfo|null;subscription:SubscriptionInfo|null;referral:ReferralInfo|null;grades:Grade[];schedule:ScheduleRow[];payments:Payment[];points:PointEvent[];foodItems:FoodItem[];orders:Order[];rewards:Reward[];loading:boolean;homeDataLoading?:boolean;homePending?:string[];error:string|null}

const roleLabels:Record<Role,string>={student:'Ã‰lÃ¨ve',parent:'Parent',teacher:'Professeur',admin:'Administration',director:'Directeur',cafeteria:'Cantine'}
const isRole=(value:unknown):value is Role=>typeof value==='string' && Object.prototype.hasOwnProperty.call(roleLabels,value)
const roleLabel=(value:unknown)=>isRole(value)?roleLabels[value]:String(value??'â€”')
const nav:[Tab,string,React.ElementType][]=[['home','Accueil',School],['food','Food',ShoppingCart],['schedule','Emploi du temps',CalendarDays],['grades','Notes',GraduationCap],['payments','Paiements',WalletCards],['rewards','RÃ©compenses',Gift],['members','Membres',Users],['agora','Agora',Lightbulb],['community','CommunautÃ©',MessageCircle],['pilotage','Pilotage',BarChart3],['ops','Ops',ServerCog],['account','Mon compte',UserRound]]
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
const navContextLabel:Record<Tab,string>={home:'Votre journÃ©e',food:'Services du quotidien',schedule:'Votre planning',grades:'ScolaritÃ©',payments:'Finances',rewards:'Points & avantages',members:'Ã‰quipe & membres',agora:'Ã‰volution dâ€™Ã‰cole OS',community:'Espaces de confiance',pilotage:'Pilotage Ã©tablissement',ops:'SystÃ¨me & coÃ»ts',account:'PrÃ©fÃ©rences'}
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
function mention(avg:number){return avg>=16?'Excellent !':avg>=14?'TrÃ¨s bien':avg>=12?'Bien':avg>=10?'Assez bien':'Peut mieux faire'}


type CommunityIdeaSuggestion={intent:'idea';confidence:number;title:string;description:string;fingerprint:string}

function detectCommunityIntent(text:string):CommunityIdeaSuggestion|null{
  const normalized=text.trim().replace(/\s+/g,' ')
  if(normalized.length<20)return null
  const lower=normalized.toLowerCase()
  if(/^(j'ai ajoutÃ©|je viens d'ajouter|a Ã©tÃ© ajoutÃ©|jâ€™ai ajoutÃ©|je viens dâ€™ajouter)/i.test(normalized))return null
  const ideaPatterns=[
    /\bil faudrait\b/,/\bon devrait\b/,/\bon pourrait\b/,/\bce serait (?:bien|utile|possible)\b/,/\bÃ§a serait (?:bien|utile|possible)\b/,/\bserait[- ]il possible\b/,/\bpourrait[- ]on\b/,/\bj['â€™]aimerais (?:qu|que)\b/,/\bje (?:propose|suggÃ¨re)\b/,/\b(proposition|suggestion|idÃ©e)\b/,/\bamÃ©liorer(?:ait|er)?\s+(?:la|le|les|une|un|notre|nos)\b/,/\bajouter(?:ait|er)?\s+(?:la|le|les|une|un|des|du|de|Ã )\b/,/\bpermettre(?:ait)?\s+(?:de|au|aux|Ã )\b/,/\bmodifier(?:ait|er)?\s+(?:la|le|les|une|un|des|ce|cette)\b/,/\bretirer(?:ait|er)?\s+(?:la|le|les|une|un|des)\b/,/\bmanque(?:nt)?\s+(?:une|un|de|des)\b/
  ]
  const questionOnly=/^(pourquoi|comment|quand|oÃ¹|qui|est[- ]ce que)\b/i.test(normalized) && !ideaPatterns.some((r)=>r.test(lower))
  if(questionOnly)return null
  const hits=ideaPatterns.reduce((n,r)=>n+(r.test(lower)?1:0),0)
  if(hits===0)return null
  const confidence=Math.min(0.98,0.66+(Math.min(hits,3)-1)*0.1+(normalized.length>55?0.04:0))
  const cleaned=normalized.replace(/^(idÃ©e|suggestion|proposition|je propose|je suggÃ¨re)\s*[:,-]?\s*/i,'')
  const first=(cleaned.split(/[.!?\n]/)[0]||cleaned).trim()
  const title=(first.length>84?first.slice(0,81).trimEnd()+'â€¦':first) || 'AmÃ©lioration proposÃ©e'
  return {intent:'idea',confidence,title,description:normalized,fingerprint:lower.slice(0,220)}
}
const orderLabels:Record<string,string>={pending:'En attente',paid:'PayÃ©e',preparing:'En prÃ©paration',ready:'PrÃªte',completed:'RetirÃ©e',cancelled:'AnnulÃ©e'}
const demoBlurb:Record<Role,string>={student:'Cours, notes, Food, points',parent:'Suivi de votre enfant',teacher:'Planning et carnet de notes',admin:'Paiements, Food, notes',director:'Abonnement de lâ€™Ã©cole',cafeteria:'Menu et commandes'}
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
function Brand({sub}:{sub?:string}){return <div className="brand"><div className="brand-mark" aria-hidden="true"><LogoMark/></div><div><b>Ã‰cole OS</b>{sub&&<span>{sub}</span>}</div></div>}

// Un chunk chargÃ© Ã  la demande (React.lazy, ex. lâ€™onglet Ops) peut avoir un nom qui change Ã  chaque
// dÃ©ploiement. Si le navigateur a gardÃ© une ancienne page en mÃ©moire au moment du clic, il peut tenter de
// charger un fichier qui nâ€™existe plus sur le serveur : ce nâ€™est pas une vraie erreur dâ€™application, juste
// une version obsolÃ¨te. On la dÃ©tecte par son message caractÃ©ristique et on recharge une seule fois pour
// rÃ©cupÃ©rer la derniÃ¨re version, avant dâ€™afficher lâ€™Ã©cran dâ€™erreur.
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
        try{sessionStorage.setItem(STALE_RELOAD_KEY,'1')}catch{/* pas grave, on tente quand mÃªme */}
        window.location.reload()
        return {error:null} // le rechargement est en cours : pas la peine dâ€™afficher lâ€™Ã©cran dâ€™erreur
      }
    }
    return {error}
  }
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('Ã‰cole OS â€” erreur dâ€™affichage',error,info.componentStack)}
  render(){
    if(!this.state.error)return this.props.children
    return <main className="crash"><div className="auth-card"><Brand/><h1>Une erreur est survenue</h1><p className="muted">Cet Ã©cran nâ€™a pas pu sâ€™afficher. Rechargez la page, ou revenez Ã  la connexion.</p><pre>{this.state.error.message}</pre><div className="actions"><button className="primary" onClick={()=>location.reload()}>Recharger la page</button><button className="outline" onClick={()=>{try{sessionStorage.removeItem('ecole-os-demo-role')}catch{}location.href='/'}}>Retour Ã  la connexion</button></div></div></main>
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
    // Les identifiants de dÃ©monstration ouvrent lâ€™espace dÃ©mo : aucun compte Auth nâ€™est nÃ©cessaire.
    const demoRole=(Object.keys(demoCredentials) as Role[]).find(r=>demoCredentials[r].email===email.trim().toLowerCase()&&demoCredentials[r].password===password)
    if(demoRole){setLoading(false);onDemo(demoRole);return}

    const supabase=await loadSupabase()
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
        if(!res.ok) throw new Error(result.error||'Impossible de finaliser lâ€™inscription de lâ€™Ã©cole.')
        localStorage.removeItem('ecole-os-pending-school')
      }catch(e:any){
        setError(e?.message||'Le compte est connectÃ© mais lâ€™inscription de lâ€™Ã©cole reste Ã  finaliser.')
      }
    }
    setLoading(false)
  }

  return <main className="os-login">
    <header className="os-login-top">
      <Brand sub="systÃ¨me scolaire"/>
      <div className="os-top-status">
        <span><i className="os-status-dot"/>SYSTÃˆME EN SERVICE</span>
        <b>ACCÃˆS Â· 01</b>
      </div>
    </header>

    <div className="os-login-frame">
      <section className="os-command">
        <div className="os-kicker">
          <span><i className="os-status-dot"/>Ã‰COLE OS / SYSTÃˆME SCOLAIRE</span>
          <span className="os-kicker-code">DOSSIER 01</span>
        </div>

        <div className="os-title-row">
          <div className="os-title-copy">
            <div className="os-hand-note">Cahier de vie scolaire</div>
            <h1>Le quotidien de lâ€™Ã©cole,<br/><em>rÃ©uni.</em></h1>
            <p>Cours, notes, cantine, frais et vie scolaire sont regroupÃ©s dans un mÃªme systÃ¨me. Chaque personne ouvre directement son propre espace.</p>
          </div>
          <div className="os-system-mark" aria-label="Ã‰cole OS, six espaces">
            <span>6 ESPACES</span>
            <b>1 systÃ¨me</b>
            <small>Une seule porte dâ€™entrÃ©e.</small>
          </div>
        </div>

        <div className="os-map" aria-label="Espaces de dÃ©monstration">
          <div className="os-map-center">
            <div className="os-core-mark"><LogoMark size={46}/></div>
            <span>Ã‰COLE OS</span>
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
        <p className="os-access-sub">Votre rÃ´le est dÃ©terminÃ© par votre compte Ã©tablissement.</p>

        <form onSubmit={submit}>
          <label>Email<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@ecole.sn"/></label>
          <label>Mot de passe<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          {error&&<div className="alert error" role="alert">{error}</div>}
          <button className="primary full os-login-submit" disabled={loading}>{loading?'Ouvertureâ€¦':'Ouvrir mon espace'}<ChevronRight size={18}/></button>
        </form>

        <div className="os-demo-intro">
          <span>APERÃ‡U</span>
          <p>Ouvrir un espace de dÃ©monstration sans compte</p>
        </div>

        <button type="button" className="school-signup os-school-signup" onClick={onSchool}><School size={18}/>Inscrire mon Ã©cole<ChevronRight size={16}/></button>
        <p className="demo-note">La dÃ©mo utilise des donnÃ©es fictives, en lecture seule. Pour un compte rÃ©el, le rÃ´le provient de votre profil Ã©tablissement.</p>
      </section>
    </div>

    <footer className="os-login-footer">
      <span>Ã‰COLE OS Â· SYSTÃˆME Dâ€™EXPLOITATION SCOLAIRE</span>
      <span>PAIEMENTS PAR WAVE</span>
    </footer>
  </main>
}

async function fetchLiveData(userId:string,onProgress?:(update:Partial<AppData>)=>void):Promise<AppData>{
  const supabase=await loadSupabase()
  const empty:AppData={profile:null,studentId:null,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],points:[],foodItems:[],orders:[],rewards:[],loading:false,error:null}
  let partial:AppData=empty
  let settled=false
  const publish=(update:Partial<AppData>)=>{
    partial={...partial,...update}
    onProgress?.(update)
  }
  try{
    // Bootstrap lÃ©ger : on ne charge que ce dont l'accueil a besoin. Les Ã©crans
    // lourds (Notes / Planning / Paiements / Food / RÃ©compenses) complÃ¨tent Ã  l'ouverture.
    performance.mark('eos:profile-query:start')
    const {data:profileRow,error:profileError}=await supabase
      .from('profiles')
      .select('id,full_name,role,student_code,school_id,class_members(class_id,classes(name)),parent_students!parent_students_parent_id_fkey(student_id,profiles!parent_students_student_id_fkey(class_members(class_id,classes(name))))')
      .eq('id',userId)
      .single()
    performance.mark('eos:profile-query:end')
    performance.measure('eos:profile-query','eos:profile-query:start','eos:profile-query:end')
    if(profileError)throw profileError

    const effectiveRole=profileRow.role as Role
    let studentId:string|null=effectiveRole==='student'?userId:null
    let memberships:any[]=effectiveRole==='student'?(profileRow as any).class_members||[]:[]
    if(effectiveRole==='parent'){
      const parentLink=(profileRow as any).parent_students?.[0]
      studentId=parentLink?.student_id||null
      memberships=parentLink?.profiles?.class_members||[]
    }

    let className:string|null=null
    const classIds=(memberships||[]).map((m:any)=>String(m.class_id)).filter(Boolean)
    className=(memberships?.[0] as any)?.classes?.name||null

    const todayNo=((new Date().getDay()+6)%7)+1
    const todayDate=isoDate(new Date())
    const wantsGrades=['student','parent','teacher'].includes(effectiveRole)
    const wantsSchedule=['student','parent','teacher','admin'].includes(effectiveRole)
    const wantsPayments=['student','parent','admin'].includes(effectiveRole)
    const wantsOrders=['parent','admin','cafeteria'].includes(effectiveRole)
    const wantsPoints=effectiveRole==='student'
    const isDirector=effectiveRole==='director'
    const pendingSections=[
      ...(wantsGrades?['grades']:[]),...(wantsSchedule?['schedule']:[]),
      ...(wantsPayments?['payments']:[]),...(wantsPoints?['points']:[]),
      ...(wantsOrders?['orders']:[]),...(isDirector&&profileRow.school_id?['school','subscription','referral']:[]),
    ]
    // Affiche l'accueil dès le profil prêt, puis complète chaque carte à son arrivée.
    publish({
      profile:{id:profileRow.id,full_name:profileRow.full_name,role:effectiveRole,email:'',school_id:profileRow.school_id,student_code:profileRow.student_code,class_name:className},
      studentId,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],
      points:[],foodItems:[],orders:[],rewards:[],loading:false,homePending:pendingSections,
      homeDataLoading:pendingSections.length>0,error:null,
    })

    const mapGrades=(rows:any[]):Grade[]=>rows.map((g:any)=>({
      id:g.id,subject:g.subjects?.name||'Matière',value:Number(g.value),
      coefficient:Number(g.subjects?.coefficient||1),term:g.term,
    }))
    const mapSchedule=(rows:any[]):ScheduleRow[]=>rows.map((x:any)=>({
      id:x.id,weekday:Number(x.weekday),starts_at:x.starts_at,ends_at:x.ends_at,
      subject:x.subjects?.name||'Cours',room:x.room,class_name:x.classes?.name||className||'Classe',
    }))
    const track=(section:string,request:any,apply:(result:any)=>Partial<AppData>)=>Promise.resolve(request).then((result:any)=>{
      if(result?.error)throw result.error
      if(!settled){
        const homePending=(partial.homePending||[]).filter(item=>item!==section)
        publish({...apply(result),homePending,homeDataLoading:homePending.length>0})
      }
      return result
    })
    performance.mark('eos:home-queries:start')
    const [gradesRes,scheduleRes,paymentsRes,pointsRes,ordersRes,schoolRes,subRes,refRes]=await Promise.all([
      track('grades',wantsGrades
        ? (studentId
            ? supabase.from('grades').select('id,subject_id,value,term,created_at,subjects(name,coefficient)').eq('student_id',studentId).order('created_at',{ascending:false}).limit(500)
            : effectiveRole==='teacher'
              ? supabase.from('grades').select('id,subject_id,value,term,created_at,subjects(name,coefficient)').order('created_at',{ascending:false}).limit(10)
              : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),r=>({grades:mapGrades(r.data||[])})),
      track('schedule',wantsSchedule
        ? (effectiveRole==='teacher'
            ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id,subjects(name),classes(name)').eq('teacher_id',userId).eq('weekday',todayNo).order('starts_at').limit(20)
            : studentId && classIds.length
              ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id,subjects(name),classes(name)').in('class_id',classIds).eq('weekday',todayNo).order('starts_at').limit(20)
              : effectiveRole==='admin'
                ? supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id,subjects(name),classes(name)').eq('weekday',todayNo).order('starts_at').limit(30)
                : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),r=>({schedule:mapSchedule(r.data||[])})),
      track('payments',wantsPayments
        ? (studentId
            ? supabase.from('school_payments').select('id,description,amount_xof,status,due_date').eq('user_id',studentId).eq('status','pending').order('due_date',{ascending:false}).limit(50)
            : effectiveRole==='admin'
              ? supabase.from('school_payments').select('id,description,amount_xof,status,due_date').eq('status','pending').order('due_date',{ascending:false}).limit(20)
              : Promise.resolve({data:[],error:null} as any))
        : Promise.resolve({data:[],error:null} as any),r=>({payments:(r.data||[]) as Payment[]})),
      track('points',wantsPoints
        ? supabase.from('point_ledger').select('id,points,reason,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(50)
        : Promise.resolve({data:[],error:null} as any),r=>({points:(r.data||[]) as PointEvent[]})),
      track('orders',wantsOrders
        ? (effectiveRole==='admin'||effectiveRole==='cafeteria'
            ? supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('pickup_date',todayDate).order('created_at',{ascending:false}).limit(40)
            : supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('user_id',userId).eq('pickup_date',todayDate).order('created_at',{ascending:false}).limit(20))
        : Promise.resolve({data:[],error:null} as any),r=>({orders:(r.data||[]) as Order[]})),
      track('school',isDirector && profileRow.school_id
        ? supabase.from('schools').select('id,name,city,director_id').eq('id',profileRow.school_id).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),r=>({school:(r.data||null) as SchoolInfo|null})),
      track('subscription',isDirector && profileRow.school_id
        ? supabase.from('school_subscriptions').select('id,plan,status,billing_price_xof,current_period_end,billing_provider,paddle_customer_id,paddle_subscription_id').eq('school_id',profileRow.school_id).order('created_at',{ascending:false}).limit(1).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),r=>({subscription:(r.data||null) as SubscriptionInfo|null})),
      track('referral',isDirector && profileRow.school_id
        ? supabase.from('referral_codes').select('code').eq('owner_id',userId).maybeSingle()
        : Promise.resolve({data:null,error:null} as any),r=>({referral:(r.data||null) as ReferralInfo|null})),
    ])
    performance.mark('eos:home-queries:end')
    performance.measure('eos:home-queries','eos:home-queries:start','eos:home-queries:end')

    for(const result of [gradesRes,scheduleRes,paymentsRes,pointsRes,ordersRes,schoolRes,subRes,refRes]){
      if(result?.error)throw result.error
    }

    const grades=mapGrades(gradesRes.data||[])
    const schedule=mapSchedule(scheduleRes.data||[])

    // Anti-surprise UX : l'accueil travaille volontairement avec un aperÃ§u.
    // Les onglets dÃ©taillÃ©s rechargent leur historique complet Ã  l'ouverture.
    settled=true
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
      homeDataLoading:false,
      homePending:[],
      error:null,
    }
  }catch(e:any){
    settled=true
    const failed={...partial,loading:false,homeDataLoading:false,homePending:[],error:e?.message||'Impossible de charger les donnÃ©es.'}
    onProgress?.({loading:false,homeDataLoading:false,homePending:[],error:failed.error})
    return failed
  }
}
async function fetchDemoData(role:Role):Promise<AppData>{
  const supabase=await loadSupabase()
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
  }catch(e:any){return {profile:null,studentId:null,school:null,subscription:null,referral:null,grades:[],schedule:[],payments:[],points:[],foodItems:[],orders:[],rewards:[],loading:false,error:e?.message||'Les donnÃ©es de dÃ©mo sont indisponibles.'}}
}

function SchoolOnboarding({onBack}:{onBack:()=>void}){
  const [step,setStep]=useState<1|2>(1)
  const [director,setDirector]=useState({name:'',email:'',password:''})
  const [school,setSchool]=useState({name:'',city:'',plan:'simple' as 'simple'|'extra',referral:''})
  const [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMsg('')
    const supabase=await loadSupabase()
    const {data,error}=await supabase.auth.signUp({email:director.email,password:director.password,options:{data:{full_name:director.name}}})
    if(error){setBusy(false);setMsg(error.message);return}
    if(!data.session){
      localStorage.setItem('ecole-os-pending-school',JSON.stringify({email:director.email,school}))
      setBusy(false);setMsg('Compte crÃ©Ã©. VÃ©rifiez votre email puis connectez-vous : lâ€™inscription de lâ€™Ã©cole sera finalisÃ©e automatiquement.');return
    }
    const res=await fetch('/api/onboarding/school',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(school)})
    const result=await res.json();setBusy(false)
    if(!res.ok){setMsg(result.error||'Impossible de crÃ©er lâ€™Ã©cole.');return}
    localStorage.removeItem('ecole-os-pending-school')
    setMsg(result.replayed
      ? `Votre école est déjà configurée : ${result.school_name}. Code de parrainage : ${result.referral_code}`
      : `École créée : ${result.school_name}. Abonnement ${result.plan} préparé. Code de parrainage : ${result.referral_code}`)
  }
  return <main className="auth"><div className="auth-card wide-card">
    <Brand sub="CrÃ©er lâ€™espace de votre Ã©tablissement"/>
    <div className="onboarding-head"><div><h1>Votre Ã©cole, votre espace</h1><p className="muted">Un directeur crÃ©e son Ã©tablissement, choisit un plan puis invite son Ã©quipe.</p></div><div className="stepper"><span className={step===1?'active':''}>1. Compte</span><span className={step===2?'active':''}>2. Ã‰cole & plan</span></div></div>
    {step===1?<form onSubmit={e=>{e.preventDefault();if(!director.name||!director.email||director.password.length<6)return setMsg('Renseignez les champs et utilisez un mot de passe dâ€™au moins 6 caractÃ¨res.');setMsg('');setStep(2)}}><label>Nom du directeur<input required value={director.name} onChange={e=>setDirector({...director,name:e.target.value})} placeholder="Awa Ndiaye"/></label><label>Email<input required type="email" value={director.email} onChange={e=>setDirector({...director,email:e.target.value})} placeholder="direction@ecole.sn"/></label><label>Mot de passe<input required type="password" minLength={6} value={director.password} onChange={e=>setDirector({...director,password:e.target.value})}/></label>{msg&&<div className="alert error">{msg}</div>}<button className="primary full">Continuer</button><button type="button" className="link-btn" onClick={onBack}>â† Retour connexion</button></form>:
    <form onSubmit={submit}><label>Nom de lâ€™Ã©cole<input required value={school.name} onChange={e=>setSchool({...school,name:e.target.value})} placeholder="LycÃ©e Horizon Dakar"/></label><label>Ville<input required value={school.city} onChange={e=>setSchool({...school,city:e.target.value})} placeholder="Dakar"/></label><div className="plan-picker"><button type="button" className={school.plan==='simple'?'selected':''} onClick={()=>setSchool({...school,plan:'simple'})}><b>Simple</b><strong>5 000 F / mois</strong><small>FonctionnalitÃ©s essentielles Â· annonces internes</small></button><button type="button" className={school.plan==='extra'?'selected':''} onClick={()=>setSchool({...school,plan:'extra'})}><b>Extra</b><strong>10 000 F / mois</strong><small>Modules avancÃ©s Â· sans pubs Â· automatisations</small></button></div><label>Code de parrainage (optionnel)<input value={school.referral} onChange={e=>setSchool({...school,referral:e.target.value.trim().toUpperCase()})} placeholder="EO-AB12CD"/></label><div className="referral-note">Parrainage : lorsquâ€™un autre directeur inscrit son Ã©cole avec votre code et rÃ¨gle son premier abonnement, votre Ã©tablissement peut bÃ©nÃ©ficier du plan Extra au prix du plan Simple selon les conditions du programme.</div>{msg&&<div className="alert">{msg}</div>}<button className="primary full" disabled={busy}>{busy?'CrÃ©ationâ€¦':'CrÃ©er mon Ã©cole'}</button><button type="button" className="link-btn" onClick={()=>{setStep(1);setMsg('')}}>â† Modifier le compte</button></form>}
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
  const hydratedTabs=useRef<Set<string>>(new Set())
  const [hydratingTab,setHydratingTab]=useState<'food'|'rewards'|'grades'|'schedule'|'payments'|null>(null)

  useEffect(()=>{localStorage.setItem('ecole-os-mode',mode)},[mode])
  useEffect(()=>{try{localStorage.setItem('ecole-os-theme',theme)}catch{};document.documentElement.dataset.theme=theme},[theme])
  useEffect(()=>{
    let alive=true
    let unsubscribe:undefined|(()=>void)
    if(mode==='demo'){
      setSession(null)
      return()=>{alive=false}
    }
    ;(async()=>{
      try{
        performance.mark('eos:auth-bootstrap:start')
        const supabase=await loadSupabase()
        const {data:{session:dataSession}}=await supabase.auth.getSession()
        performance.mark('eos:auth-bootstrap:end')
        performance.measure('eos:auth-bootstrap','eos:auth-bootstrap:start','eos:auth-bootstrap:end')
        const {data:{subscription}}=supabase.auth.onAuthStateChange((_e:any,s:any)=>{if(alive)setSession(s)})
        unsubscribe=()=>subscription.unsubscribe()
        if(alive)setSession(dataSession)
      }catch(error){
        console.error('Ã‰cole OS â€” initialisation Auth impossible',error)
        if(alive)setSession(null)
      }
    })()
    return()=>{alive=false;unsubscribe?.()}
  },[mode])
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
    // Le contrÃ´le serveur de /api/admin/[action] reste la vraie barriÃ¨re de sÃ©curitÃ©.
    // CÃ´tÃ© client, on Ã©vite toutefois d'appeler le trÃ¨s lourd /api/admin/tech Ã  chaque connexion :
    // la liste d'emails de plateforme n'est pas un secret et ne sert qu'Ã  afficher/masquer le menu Ops.
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
      hydratedTabs.current.clear()
      setHydratingTab(null)
      setData(d=>({...d,loading:true,error:null}))
      if(mode==='live'&&!session){setData(d=>({...d,loading:false}));return}
      performance.mark('eos:data-load:start')
      let liveRole:Role|null=null
      const next=mode==='demo'
        ?await fetchDemoData(role)
        :await fetchLiveData(session.user.id,(update)=>{
            if(!alive)return
            if(update.profile?.role)liveRole=update.profile.role
            if(update.grades&&(liveRole==='student'||liveRole==='parent'))hydratedTabs.current.add('grades')
            setData(current=>({...current,...update}))
            if(update.profile?.role)setRole(update.profile.role)
            if(update.profile){
              performance.mark('eos:home-shell:ready')
              performance.measure('eos:home-shell','eos:data-load:start','eos:home-shell:ready')
            }
          })
      performance.mark('eos:data-load:end')
      performance.measure('eos:data-load','eos:data-load:start','eos:data-load:end')
      if(alive){
        setData(next)
        // Les élèves et parents ont déjà leurs 500 notes les plus récentes
        // dans le bootstrap (l'accueil calcule sa moyenne dessus). Réutiliser
        // cette tranche dans l'onglet Notes évite une seconde requête identique.
        if(mode==='live'&&(next.profile?.role==='student'||next.profile?.role==='parent'))hydratedTabs.current.add('grades')
        if(mode==='live'&&next.profile?.role)setRole(next.profile.role)
      }
    }
    load()
    return()=>{alive=false}
  },[mode,session?.user?.id])

  // âš  Tous les hooks doivent Ãªtre appelÃ©s AVANT le moindre `return` : sinon React plante
  // (Â« Rendered more hooks than during the previous render Â») dÃ¨s que la session change â†’ page blanche.
  useEffect(()=>{if(!canAccess(role,tab) && !(tab==='ops'&&platformAdmin))setTab('home')},[role,tab,platformAdmin])
  useEffect(()=>{
    if(!session?.user?.id&&mode==='live')return
    const needsFood=tab==='food'&&!hydratedTabs.current.has('food')
    const needsRewards=tab==='rewards'&&!hydratedTabs.current.has('rewards')
    const needsGrades=tab==='grades'&&!hydratedTabs.current.has('grades')&&!data.homePending?.includes('grades')
    const needsSchedule=tab==='schedule'&&!hydratedTabs.current.has('schedule')&&!data.homePending?.includes('schedule')
    const needsPayments=tab==='payments'&&!hydratedTabs.current.has('payments')&&!data.homePending?.includes('payments')
    if(!needsFood&&!needsRewards&&!needsGrades&&!needsSchedule&&!needsPayments)return
    const key=(needsFood?'food':needsRewards?'rewards':needsGrades?'grades':needsSchedule?'schedule':'payments') as 'food'|'rewards'|'grades'|'schedule'|'payments'
    hydratedTabs.current.add(key)
    let alive=true
    setHydratingTab(key)
    ;(async()=>{
      try{
        const supabase=await loadSupabase()
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
            if(alive)setData(d=>({...d,foodItems:(foodRes.data||[]) as FoodItem[],orders:(ordersRes.data||[]) as Order[]}))
          }else{
            const roleNow=data.profile?.role||role
            const isManager=roleNow==='admin'||roleNow==='cafeteria'
            const [foodRes,ordersRes]=await Promise.all([
              supabase.from('food_items').select('id,name,price_xof,active').order('name'),
              isManager
                ?supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').order('created_at',{ascending:false}).limit(40)
                :supabase.from('food_orders').select('id,total_xof,status,pickup_date,pickup_slot,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(20)
            ])
            if(foodRes.error)throw foodRes.error
            if(ordersRes.error)throw ordersRes.error
            if(alive)setData(d=>({...d,foodItems:(foodRes.data||[]) as FoodItem[],orders:(ordersRes.data||[]) as Order[]}))
          }
        }else if(needsRewards){
          const promises:any[]=[supabase.from('rewards').select('id,name,points_cost,active,audience_role').eq('active',true).order('points_cost')]
          if(mode==='live' && (role==='student'||role==='parent')) promises.push(supabase.from('point_ledger').select('id,points,reason,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(100))
          else if(mode==='demo') promises.push(supabase.from('demo_points').select('id,points,reason,created_at').eq('profile_id',demoRoleIds[role]).order('created_at',{ascending:false}).limit(100))
          const [rewardsRes,pointsRes]=await Promise.all(promises)
          if(rewardsRes.error)throw rewardsRes.error
          if(pointsRes?.error)throw pointsRes.error
          if(alive)setData(d=>({...d,rewards:(rewardsRes.data||[]) as Reward[],...(pointsRes?{points:(pointsRes.data||[]) as PointEvent[]}: {})}))
        }else if(needsGrades){
          if(mode==='demo'){
            if(alive)setHydratingTab(null)
          }else{
            const owner=(role==='student'||role==='parent')?data.studentId:role==='teacher'?session.user.id:null
            let gradesRes:any
            if(owner) gradesRes=await supabase.from('grades').select('id,subject_id,value,term,created_at,subjects(name,coefficient)').eq('student_id',owner).order('created_at',{ascending:false}).limit(500)
            else if(role==='admin') gradesRes=await supabase.from('grades').select('id,subject_id,value,term,created_at,subjects(name,coefficient)').order('created_at',{ascending:false}).limit(500)
            else gradesRes={data:[],error:null}
            if(gradesRes.error)throw gradesRes.error
            const grades=(gradesRes.data||[]).map((g:any)=>({id:g.id,subject:g.subjects?.name||'MatiÃ¨re',value:Number(g.value),coefficient:Number(g.subjects?.coefficient||1),term:g.term})) as Grade[]
            if(alive)setData(d=>({...d,grades}))
          }
        }else if(needsSchedule){
          if(mode==='demo'){
            if(alive)setHydratingTab(null)
          }else{
            let q:any=supabase.from('schedule').select('id,weekday,starts_at,ends_at,room,teacher_id,class_id,subject_id,subjects(name),classes(name)').order('weekday').order('starts_at').limit(500)
            if(role==='teacher')q=q.eq('teacher_id',session.user.id)
            else if(data.studentId){
              const {data:members,error}=await supabase.from('class_members').select('class_id').eq('student_id',data.studentId)
              if(error)throw error
              const ids=(members||[]).map((m:any)=>m.class_id).filter(Boolean)
              q=ids.length?q.in('class_id',ids):q.eq('id','00000000-0000-0000-0000-000000000000')
            }else if(role!=='admin'){
              q=q.eq('id','00000000-0000-0000-0000-000000000000')
            }
            const scheduleRes=await q
            if(scheduleRes.error)throw scheduleRes.error
            const schedule=(scheduleRes.data||[]).map((x:any)=>({id:x.id,weekday:Number(x.weekday),starts_at:x.starts_at,ends_at:x.ends_at,subject:x.subjects?.name||'Cours',room:x.room,class_name:x.classes?.name||data.profile?.class_name||'Classe'})) as ScheduleRow[]
            if(alive)setData(d=>({...d,schedule}))
          }
        }else if(needsPayments){
          if(mode==='demo'){
            if(alive)setHydratingTab(null)
          }else{
            let q:any=supabase.from('school_payments').select('id,description,amount_xof,status,due_date').order('due_date',{ascending:false}).limit(500)
            if(data.studentId)q=q.eq('user_id',data.studentId)
            else if(role!=='admin')q=q.eq('id','00000000-0000-0000-0000-000000000000')
            const paymentsRes=await q
            if(paymentsRes.error)throw paymentsRes.error
            if(alive)setData(d=>({...d,payments:(paymentsRes.data||[]) as Payment[]}))
          }
        }
      }catch(error:any){
        hydratedTabs.current.delete(key)
        if(alive){setHydratingTab(null);setData(d=>({...d,error:error?.message||`Impossible de charger ${key}.`}))}
      } finally {
        if(alive)setHydratingTab(current=>current===key?null:current)
      }
    })()
    return()=>{alive=false}
  },[mode,tab,session?.user?.id,role,data.profile?.role,data.studentId,data.homePending])
  function enterDemo(r:Role){try{sessionStorage.setItem('ecole-os-demo-role',r)}catch{}setCart({});setOrderMsg('');setTab('home');setRole(r);setMode('demo')}
  if(schoolSignup)return <SchoolOnboarding onBack={()=>setSchoolSignup(false)}/>
  if(mode==='live'&&!session)return <Login onSchool={()=>setSchoolSignup(true)} onDemo={enterDemo}/>
  const profileName=data.profile?.full_name||session?.user?.user_metadata?.full_name||session?.user?.email?.split('@')[0]||'Utilisateur'
  const count=Object.values(cart).reduce<number>((a,b)=>a+Number(b),0)
  const availableNav=nav.filter(([id])=>canAccess(role,id) || (id==='ops'&&platformAdmin))
  const primaryItems=availableNav.filter(([id])=>primaryTabs[role].includes(id))
  const secondaryItems=availableNav.filter(([id])=>!primaryTabs[role].includes(id) && id!=='account')
  async function logout(){const supabase=await loadSupabase();await supabase.auth.signOut();setMode('live')}
  async function checkout(){
    const items=Object.entries(cart).filter(([,q])=>q).map(([id,quantity])=>({id,quantity}))
    if(!items.length)return
    if(mode==='demo'){setOrderMsg('Mode dÃ©mo : commande enregistrÃ©e localement pour la simulation.');return}
    setOrderMsg('CrÃ©ation du paiement Waveâ€¦')
    const token=session?.access_token
    const res=await fetch('/api/wave/checkout',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({type:'food',items,pickup_date:isoDate(new Date()),pickup_slot:'12:30â€“12:40'})})
    const result=await res.json()
    if(!res.ok){setOrderMsg(result.error||'Erreur de paiement');return}
    window.location.href=result.wave_launch_url
  }
  function switchMode(next:Mode){if(next==='live'){try{sessionStorage.removeItem('ecole-os-demo-role')}catch{}}setMode(next);setTab('home');setCart({});setOrderMsg('');setPlatformAdmin(next==='demo'&&role==='admin');if(next==='live')setRole('student')}
  return <div className="app">
    <div className={'scrim'+(menuOpen?' on':'')} onClick={()=>setMenuOpen(false)}/>
    <aside className={'sidebar'+(menuOpen?' open':'')}>
      <Brand/>
      <div className="role-chip"><small>{roleLabels[role]}{data.profile?.class_name?` Â· ${data.profile.class_name}`:''}</small><b>{profileName}</b></div>
      {mode==='live'&&<div className="session-badge"><span className="session-dot"/>Session sÃ©curisÃ©e</div>}
      {mode==='demo'&&<div className="demo-mode"><span>Mode dÃ©mo</span>DonnÃ©es fictives, lecture seule.<button onClick={()=>switchMode('live')}>Quitter la dÃ©mo</button></div>}
      <nav aria-label="Navigation principale">
        {primaryItems.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} title={navContextLabel[id]} onClick={()=>{setTab(id);setMenuOpen(false)}}><Icon size={19}/><span>{label}</span>{id==='food'&&count>0&&<em>{String(count)}</em>}</button>)}
        {secondaryItems.length>0&&<div className="nav-more-group"><button className="nav-more" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><ListChecks size={19}/><span>Evolution</span><ChevronRight size={15} className={moreOpen?'turn':''}/></button>
          {moreOpen&&<div className="nav-secondary">{secondaryItems.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} aria-current={tab===id?'page':undefined} title={navContextLabel[id]} onClick={()=>{setTab(id);setMenuOpen(false)}}><Icon size={17}/><span>{label}</span></button>)}</div>}
        </div>}
        {availableNav.some(([id])=>id==='account')&&<button key="account" className={tab==='account'?'active':''} aria-current={tab==='account'?'page':undefined} title={navContextLabel.account} onClick={()=>{setTab('account');setMenuOpen(false)}}><UserRound size={19}/><span>Mon compte</span></button>}
      </nav>
      <button className="logout" onClick={mode==='demo'?()=>switchMode('live'):logout}><LogOut size={18}/>{mode==='demo'?'Quitter la dÃ©mo':'Se dÃ©connecter'}</button>
    </aside>
    <section className="main">
      <header className="topbar"><button className="mobile-menu" aria-label="Ouvrir le menu" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X/>:<Menu/>}</button><h2>{nav.find(n=>n[0]===tab)?.[1]}</h2><time className="today">{frToday()}</time><div className="avatar" aria-hidden="true">{firstLetters(profileName)}</div></header>
      <div className="content">
        {data.loading&&<div className="skeleton" role="status" aria-label="Chargement de votre espace"><i/><i/><i/></div>}
        {data.error&&<div className="alert error">{data.error}</div>}
        {!data.loading&&<>
          {tab==='home'&&<Home role={role} mode={mode} name={profileName} data={data} setTab={setTab}/>} 
          {tab==='food'&&hydratingTab==='food'&&<ScreenFallback/>}{tab==='food'&&hydratingTab!=='food'&&<React.Suspense fallback={<ScreenFallback/>}><FoodScreen role={role} mode={mode} data={data} cart={cart} setCart={setCart} checkout={checkout} message={orderMsg}/></React.Suspense>} 
          {tab==='schedule'&&hydratingTab==='schedule'&&<ScreenFallback/>}{tab==='schedule'&&hydratingTab!=='schedule'&&<React.Suspense fallback={<ScreenFallback/>}><ScheduleScreen role={role} mode={mode} data={data}/></React.Suspense>} 
          {tab==='grades'&&hydratingTab==='grades'&&<ScreenFallback/>}{tab==='grades'&&hydratingTab!=='grades'&&<React.Suspense fallback={<ScreenFallback/>}><GradesScreen role={role} data={data}/></React.Suspense>} 
          {tab==='payments'&&hydratingTab==='payments'&&<ScreenFallback/>}{tab==='payments'&&hydratingTab!=='payments'&&<React.Suspense fallback={<ScreenFallback/>}><PaymentsScreen role={role} mode={mode} data={data} session={session}/></React.Suspense>} 
          {tab==='rewards'&&hydratingTab==='rewards'&&<ScreenFallback/>}{tab==='rewards'&&hydratingTab!=='rewards'&&<React.Suspense fallback={<ScreenFallback/>}><RewardsScreen role={role} mode={mode} data={data}/></React.Suspense>}
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
  const pending=(section:string)=>Boolean(data.homePending?.includes(section))

  if(role==='student') return <>
    <div className="hero"><span className="eyebrow">Espace Ã©lÃ¨ve Â· {data.profile?.class_name||'classe Ã  renseigner'}</span><h1>Bonjour {name}</h1><p>{mode==='demo'?'Vous explorez lâ€™espace Ã©lÃ¨ve avec des donnÃ©es fictives.':'Voici votre journÃ©e et lâ€™essentiel de votre scolaritÃ©.'}</p></div>
    <div className="grid stats"><Card icon={<Clock3/>} tone="hl" title="Prochain cours" value={pending('schedule')?'…':upcoming?.starts_at?.slice(0,5)||'â€”'} meta={pending('schedule')?'Chargement…':upcoming?`${upcoming.subject} Â· ${upcoming.room}`:'Aucun cours'}/><Card icon={<GraduationCap/>} tone="red" title="Moyenne gÃ©nÃ©rale" value={pending('grades')?'…':`${fr(average,2,2)} / 20`} meta={pending('grades')?'Chargement…':'Moyenne pondÃ©rÃ©e'}/><Card icon={<Star/>} title="Points" value={pending('points')?'…':new Intl.NumberFormat('fr-FR').format(points)} meta={pending('points')?'Chargement…':'Solde rÃ©compenses'}/><Card icon={<CircleDollarSign/>} title="Ã€ payer" value={pending('payments')?'…':shortMoney(due)} meta={pending('payments')?'Chargement…':due?'Ã‰chÃ©ances en attente':'Tout est rÃ©glÃ©'}/></div>
    <div className="grid two"><Panel title="Ma journÃ©e" action="Tout voir" onAction={()=>setTab('schedule')}>{today.length?today.map(x=><div className="row" key={x.id}><b>{x.starts_at.slice(0,5)}</b><span>{x.subject}</span><small>{x.room}</small></div>):<Empty text="Pas de cours aujourd'hui"/>}</Panel><Panel title="AccÃ¨s rapides"><div className="quick"><button onClick={()=>setTab('food')}><ShoppingCart/>PrÃ©commander Food</button><button onClick={()=>setTab('grades')}><GraduationCap/>Voir mes notes</button><button onClick={()=>setTab('payments')}><WalletCards/>Payer une mensualitÃ©</button><button onClick={()=>setTab('rewards')}><Gift/>Mes rÃ©compenses</button></div></Panel></div>
  </>

  if(role==='parent') return <>
    <div className="hero"><span className="eyebrow">Espace parent Â· suivi de la famille</span><h1>Bonjour {name}</h1><p>Suivez la scolaritÃ© de <b>{data.profile?.child_name||'votre enfant'}</b> depuis un seul espace.</p></div>
    <div className="grid stats"><Card icon={<GraduationCap/>} tone="red" title="Moyenne de l'enfant" value={pending('grades')?'…':`${fr(average,2,2)} / 20`} meta={pending('grades')?'Chargement…':'Bulletin actuel'}/><Card icon={<CircleDollarSign/>} title="Ã‰chÃ©ances" value={pending('payments')?'…':shortMoney(due)} meta={pending('payments')?'Chargement…':due?'Ã€ rÃ©gler':'Ã€ jour'}/><Card icon={<CalendarDays/>} title="Cours aujourd'hui" value={pending('schedule')?'…':String(today.length)} meta={pending('schedule')?'Chargement…':"Planning de l'enfant"}/><Card icon={<ShoppingCart/>} title="Commandes Food" value={pending('orders')?'…':String(todayOrders.length)} meta={pending('orders')?'Chargement…':"Aujourd'hui"}/></div>
    <div className="grid two"><Panel title="DerniÃ¨res notes">{data.grades.length?data.grades.slice(0,5).map(g=><div className="row" key={g.id}><b>{g.value}/20</b><span>{g.subject}</span><small>Coef. {g.coefficient}</small></div>):<Empty text={pending('grades')?'Chargement…':'Aucune note'}/>}</Panel><Panel title="Suivi rapide"><div className="quick"><button onClick={()=>setTab('grades')}><GraduationCap/>Bulletin</button><button onClick={()=>setTab('payments')}><WalletCards/>Frais scolaires</button><button onClick={()=>setTab('schedule')}><CalendarDays/>Emploi du temps</button><button onClick={()=>setTab('food')}><ShoppingCart/>Food</button></div></Panel></div>
  </>

  if(role==='teacher') return <>
    <div className="hero"><span className="eyebrow">Espace professeur</span><h1>Bonjour {name}</h1><p>Votre journÃ©e de cours, vos classes et votre carnet de notes.</p></div>
    <div className="grid stats"><Card icon={<CalendarDays/>} title="Cours aujourd'hui" value={pending('schedule')?'…':String(today.length)} meta={pending('schedule')?'Chargement…':'Votre planning'}/><Card icon={<Clock3/>} tone="hl" title="Prochain cours" value={pending('schedule')?'…':upcoming?.starts_at?.slice(0,5)||'â€”'} meta={pending('schedule')?'Chargement…':upcoming?upcoming.subject:'Aucun cours'}/><Card icon={<School/>} title="Classes suivies" value={pending('schedule')?'…':String(new Set(data.schedule.map(s=>s.class_name)).size)} meta="Planning"/><Card icon={<GraduationCap/>} title="Notes visibles" value={pending('grades')?'…':String(data.grades.length)} meta={pending('grades')?'Chargement…':'Carnet de notes'}/></div>
    <div className="grid two"><Panel title="Mes cours du jour">{today.length?today.map(x=><div className="row" key={x.id}><b>{x.starts_at.slice(0,5)}</b><span>{x.subject}</span><small>{x.class_name} Â· {x.room}</small></div>):<Empty text="Pas de cours aujourd'hui"/>}</Panel><Panel title="Actions enseignant"><div className="quick"><button onClick={()=>setTab('grades')}><GraduationCap/>Saisir / consulter les notes</button><button onClick={()=>setTab('schedule')}><CalendarDays/>Planning</button></div></Panel></div>
  </>

  if(role==='admin') return <>
    <div className="hero"><span className="eyebrow">Administration</span><h1>Bonjour {name}</h1><p>Une vue opÃ©rationnelle de l'activitÃ© de l'Ã©tablissement.</p></div>
    <div className="grid stats"><Card icon={<School/>} title="Ã‰lÃ¨ves suivis" value={String(1)} meta="Ã‰tablissement"/><Card icon={<WalletCards/>} title="ImpayÃ©s" value={pending('payments')?'…':shortMoney(due)} meta="Montant en attente"/><Card icon={<ShoppingCart/>} title="Commandes aujourd'hui" value={pending('orders')?'…':String(todayOrders.length)} meta="Food"/><Card icon={<CalendarDays/>} title="Cours planifiÃ©s" value={pending('schedule')?'…':String(data.schedule.length)} meta="Planning"/></div>
    <div className="grid two"><Panel title="Alertes Ã  traiter">{data.payments.filter(p=>p.status==='pending').slice(0,4).map(p=><div className="payment-row" key={p.id}><span>{p.description}</span><b>{money(p.amount_xof)}</b><small className="pending">Ã€ traiter</small></div>)}{!data.payments.filter(p=>p.status==='pending').length&&<Empty text="Aucune alerte paiement"/>}</Panel><Panel title="Commandes Food"><OrdersTable orders={data.orders.slice(0,6)}/></Panel></div>
  </>

  if(role==='director') return <>
    <div className="hero"><span className="eyebrow">Direction</span><h1>{data.school?.name||name}</h1><p>{data.school?.city||'Dakar'} Â· GÃ©rez votre abonnement, votre Ã©cole et votre programme de recommandation.</p></div>
    <div className="grid stats"><Card icon={<CalendarDays/>} title="Prochaine Ã©chÃ©ance" value={pending('subscription')?'…':data.subscription?.current_period_end?shortDate(data.subscription.current_period_end):'â€”'} meta="Renouvellement de lâ€™abonnement"/><Card icon={<WalletCards/>} title="Plan" value={pending('subscription')?'…':data.subscription?.plan==='extra'?'Extra':'Simple'} meta={pending('subscription')?'Chargement…':data.subscription?.status==='active'?'Actif':'Ã€ activer'}/><Card icon={<CircleDollarSign/>} title="Tarif mensuel" value={pending('subscription')?'…':shortMoney(Number(data.subscription?.billing_price_xof||0))} meta="Facturation Ã©cole"/><Card icon={<Gift/>} title="Code parrainage" value={pending('referral')?'…':data.referral?.code||'â€”'} meta="Votre avantage"/></div>
    <div className="grid two"><Panel title="Votre abonnement"><div className="plan-summary"><strong>{data.subscription?.plan==='extra'?'Extra':'Simple'}</strong><b>{shortMoney(Number(data.subscription?.billing_price_xof||0))} / mois</b><span>{data.subscription?.plan==='extra'?'Sans publicitÃ© Â· fonctions avancÃ©es':'Fonctions essentielles Â· publicitÃ© interne possible'}</span>{data.subscription?.current_period_end&&<small>Prochaine Ã©chÃ©ance : {new Intl.DateTimeFormat('fr-FR').format(new Date(data.subscription.current_period_end))}</small>}</div><button className="primary" onClick={()=>setTab('payments')}>GÃ©rer mon abonnement</button></Panel><Panel title="Programme de recommandation"><div className="referral-banner"><b>{data.referral?.code||'â€”'}</b><span>Partagez ce code Ã  un autre directeur. Une inscription qualifiÃ©e peut dÃ©bloquer l'avantage Extra selon les conditions du programme.</span><button className="outline" onClick={()=>navigator.clipboard?.writeText(data.referral?.code||'')}>Copier</button></div></Panel></div>
  </>

  const ready=todayOrders.filter(o=>o.status==='ready').length
  const preparing=todayOrders.filter(o=>o.status==='preparing').length
  const revenue=todayOrders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+Number(o.total_xof),0)
  return <>
    <div className="hero"><span className="eyebrow">Cantine</span><h1>Bonjour {name}</h1><p>PrÃ©parez les commandes et gardez le flux de retrait sous contrÃ´le.</p></div>
    <div className="grid stats"><Card icon={<Package/>} title="Commandes aujourd'hui" value={pending('orders')?'…':String(todayOrders.length)} meta="Tous crÃ©neaux"/><Card icon={<Clock3/>} title="En prÃ©paration" value={pending('orders')?'…':String(preparing)} meta="Ã€ cuisiner / assembler"/><Card icon={<Package/>} title="PrÃªtes" value={pending('orders')?'…':String(ready)} meta="Ã€ remettre"/><Card icon={<CircleDollarSign/>} title="Ventes" value={pending('orders')?'…':shortMoney(revenue)} meta="Aujourd'hui"/></div>
    <div className="grid two"><Panel title="File de retrait"><OrdersTable orders={todayOrders.slice(0,8)}/></Panel><Panel title="Gestion rapide"><div className="quick"><button onClick={()=>setTab('food')}><ShoppingCart/>GÃ©rer le menu</button><button onClick={()=>setTab('food')}><Package/>Voir toutes les commandes</button></div></Panel></div>
  </>
}


applyOwnerParam()
try{sessionStorage.removeItem(STALE_RELOAD_KEY)}catch{/* stockage indisponible */}

// Enregistre le service worker et vÃ©rifie rÃ©guliÃ¨rement les mises Ã  jour. Sans cet appel explicite,
// le worker s'enregistre passivement mais le rythme de vÃ©rification n'est pas maÃ®trisÃ© : un dÃ©ploiement
// peut rester invisible longtemps pour un onglet restÃ© ouvert, avec le risque observÃ© ci-dessus (un chunk
// chargÃ© Ã  la demande qui n'existe plus sur le serveur). registerType:'autoUpdate' fait dÃ©jÃ  recharger la
// page dÃ¨s qu'une mise Ã  jour est dÃ©tectÃ©e ; ce sondage pÃ©riodique dÃ©clenche la dÃ©tection elle-mÃªme.
import('virtual:pwa-register').then(({registerSW})=>{
  const intervalMs=15*60*1000 // Une seule vÃ©rification pÃ©riodique : pas de double fetch du service worker.
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


