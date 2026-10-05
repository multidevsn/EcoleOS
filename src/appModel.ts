export type Role='student'|'parent'|'teacher'|'admin'|'director'|'cafeteria'
export type Tab='home'|'food'|'schedule'|'grades'|'payments'|'rewards'|'members'|'agora'|'community'|'pilotage'|'ops'|'account'
export type Theme='cahier'|'epure'|'brume'
export type IdeaStatus='new'|'review'|'planned'|'building'|'done'

export type CommunityIdea={id:string;title:string;description:string;author_name:string;role:Role;status:IdeaStatus;votes:number;created_at:string;voted?:boolean}
export type CommunitySurveyOption={id:string;label:string;votes:number}
export type CommunitySurvey={id:string;question:string;description:string;expires_at?:string|null;options:CommunitySurveyOption[];answer?:string|null}
export type CommunitySpace={id:string;name:string;description:string;kind:'announcement'|'community';created_at:string;scope_type?:'school'|'role'|'class';scope_key?:string|null;priority?:number;unread_count?:number;latest_body?:string|null;latest_at?:string|null}
export type CommunityMessage={id:string;space_id:string;sender_id:string;sender_name:string;sender_role:Role;body:string;created_at:string;mine?:boolean}

export type Profile={id:string;full_name:string;role:Role;class_name?:string|null;child_name?:string|null;email:string;school_id?:string|null;student_code?:string|null}
export type Grade={id:string;subject:string;value:number;coefficient:number;term:string}
export type ScheduleRow={id:string;weekday:number;starts_at:string;ends_at:string;subject:string;room:string;class_name:string}
export type Payment={id:string;description:string;amount_xof:number;status:'pending'|'succeeded'|'failed'|'expired';due_date:string}
export type PointEvent={id:string;points:number;reason:string;created_at:string}
export type FoodItem={id:string;name:string;price_xof:number;active:boolean}
export type Order={id:string;total_xof:number;status:string;pickup_date?:string|null;pickup_slot?:string|null;created_at:string}
export type Reward={id:string;name:string;points_cost:number;active:boolean;audience_role?:Role|null}
export type SchoolInfo={id:string;name:string;city:string;director_id:string}
export type SubscriptionInfo={id:string;plan:'simple'|'extra';status:string;billing_price_xof:number;current_period_end?:string|null;billing_provider?:'wave'|'paddle';paddle_customer_id?:string|null;paddle_subscription_id?:string|null}
export type ReferralInfo={code:string;status?:string}
export type AppData={profile:Profile|null;studentId:string|null;school:SchoolInfo|null;subscription:SubscriptionInfo|null;referral:ReferralInfo|null;grades:Grade[];schedule:ScheduleRow[];payments:Payment[];points:PointEvent[];foodItems:FoodItem[];orders:Order[];rewards:Reward[];loading:boolean;error:string|null}

export const roleLabels:Record<Role,string>={student:'Élève',parent:'Parent',teacher:'Professeur',admin:'Administration',director:'Directeur',cafeteria:'Cantine'}

export const ideaStatusLabel:Record<IdeaStatus,string>={new:'Nouvelle',review:'En étude',planned:'Planifiée',building:'En développement',done:'Disponible'}
export const ideaStatusClass:Record<IdeaStatus,string>={new:'new',review:'review',planned:'planned',building:'building',done:'done'}

export const demoIdeaSeed:CommunityIdea[]=[
  {id:'demo-idea-1',title:'Un calendrier commun parents / professeurs',description:'Réunir devoirs, réunions et événements dans une vue unique.',author_name:'Fatou Ndiaye',role:'parent',status:'review',votes:28,created_at:'2026-09-21T10:00:00Z'},
  {id:'demo-idea-2',title:'Notifier avant la fermeture de la cantine',description:'Prévenir automatiquement quand la fenêtre de commande approche.',author_name:'Cheikh Ba',role:'cafeteria',status:'planned',votes:19,created_at:'2026-09-20T08:30:00Z'},
  {id:'demo-idea-3',title:'Ajouter un mode hors-ligne léger',description:'Consulter les données essentielles même avec une connexion instable.',author_name:'Moussa Diop',role:'teacher',status:'new',votes:14,created_at:'2026-09-19T15:20:00Z'}
]
export const demoSurveySeed:CommunitySurvey[]=[
  {id:'demo-survey-1',question:'Quel service devrait être amélioré ensuite ?',description:'Un vote simple. Les résultats servent à prioriser la feuille de route.',expires_at:'2026-10-02',options:[{id:'s1-a',label:'Messagerie',votes:38},{id:'s1-b',label:'Cantine',votes:24},{id:'s1-c',label:'Emploi du temps',votes:21},{id:'s1-d',label:'Paiements',votes:17}]}
]
export const isRole=(value:unknown):value is Role=>typeof value==='string' && Object.prototype.hasOwnProperty.call(roleLabels,value)
export const roleLabel=(value:unknown)=>isRole(value)?roleLabels[value]:String(value??'—')
export const foodCapabilities:Record<Role,{order:boolean;manageMenu:boolean}>={student:{order:true,manageMenu:false},parent:{order:true,manageMenu:false},teacher:{order:false,manageMenu:false},admin:{order:false,manageMenu:true},director:{order:false,manageMenu:false},cafeteria:{order:false,manageMenu:true}}

export const demoRoleIds:Record<Role,string>={
  student:'00000000-0000-0000-0000-000000000101',
  parent:'00000000-0000-0000-0000-000000000102',
  teacher:'00000000-0000-0000-0000-000000000103',
  admin:'00000000-0000-0000-0000-000000000104',
  cafeteria:'00000000-0000-0000-0000-000000000105',
  director:'00000000-0000-0000-0000-000000000106',
}

export function money(n:number){return new Intl.NumberFormat('fr-FR').format(n)+' FCFA'}
export function avg(grades:Grade[]){const den=grades.reduce((s,g)=>s+Number(g.coefficient),0);return den?grades.reduce((s,g)=>s+Number(g.value)*Number(g.coefficient),0)/den:0}
export function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d}
export function isoDate(d:Date){return d.toISOString().slice(0,10)}
export function nextClass(schedule:ScheduleRow[]){const now=new Date();const day=((now.getDay()+6)%7)+1;const today=schedule.filter(s=>s.weekday===day).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));const time=now.toTimeString().slice(0,5);return today.find(s=>s.ends_at>=time)||today[0]||null}
export function firstLetters(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'EO'}
export function mention(value:number){return value>=16?'Excellent !':value>=14?'Très bien':value>=12?'Bien':value>=10?'Assez bien':'Peut mieux faire'}

export type CommunityIdeaSuggestion={intent:'idea';confidence:number;title:string;description:string;fingerprint:string}
export function detectCommunityIntent(text:string):CommunityIdeaSuggestion|null{
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
  const title=(first.length>84?first.slice(0,81).trimEnd()+'…':first)||'Amélioration proposée'
  return {intent:'idea',confidence,title,description:normalized,fingerprint:lower.slice(0,220)}
}

export const orderLabels:Record<string,string>={pending:'En attente',paid:'Payée',preparing:'En préparation',ready:'Prête',completed:'Retirée',cancelled:'Annulée'}

export function demoStorage<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
export function saveDemoStorage<T>(key:string,value:T){try{localStorage.setItem(key,JSON.stringify(value))}catch{/* stockage local indisponible */}}
export function addDemoPoints(userId:string,points:number,reason:string){
  const key=`eos-demo-impact-events-${userId}`
  const current=demoStorage<any[]>(key,[])
  current.unshift({id:`local-${Date.now()}`,points,reason,created_at:new Date().toISOString()})
  saveDemoStorage(key,current)
  const totalKey=`eos-demo-impact-extra-${userId}`
  const total=Number(localStorage.getItem(totalKey)||0)+points
  try{localStorage.setItem(totalKey,String(total))}catch{/* stockage local indisponible */}
  window.dispatchEvent(new Event('eos-points-updated'))
}


