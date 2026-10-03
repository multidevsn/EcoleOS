import React,{useEffect,useMemo,useState} from 'react'
import {supabase} from './lib/supabase'
import {fr,shortDate,Empty} from './shared'
import {Mode} from './shared'
import {Role,AppData,Profile,CommunityIdea,CommunityMessage,CommunitySpace,CommunitySurvey,CommunitySurveyOption,IdeaStatus,addDemoPoints,demoRoleIds,demoStorage,detectCommunityIntent,firstLetters,roleLabels,saveDemoStorage} from './appModel'
import {BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Gift, GraduationCap, KeyRound, Landmark, LogOut, Mail, Menu, Package, Save, School, ShieldCheck, ShoppingCart, FileUp, UserPlus, RefreshCw, Check, AlertTriangle, Sparkles, Star, UserRound, Users, UtensilsCrossed, WalletCards, X, Lightbulb, MessageSquarePlus, ThumbsUp, BarChart3, Palette, ListChecks, Gauge, Activity, ServerCog, MessageCircle, Megaphone, Send, Flag, ShieldAlert, Search, Info, UsersRound, LockKeyhole} from 'lucide-react'
import {Panel} from './ui'

export function Rewards({role,mode,data}:{role:Role,mode:Mode,data:AppData}){
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
        addDemoPoints(userId,-reward.points_cost,`Échange : ${reward.name}`);
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
  return <><div className="points-hero"><div><span>Mes points</span><strong>{fr(balance)}</strong><small>Points de contribution · {roleLabels[role].toLowerCase()}</small></div><Star size={44}/></div>
    {msg&&<div className="alert">{msg}</div>}
    <div className="points-note"><Sparkles size={17}/><div><b>Tout le monde contribue.</b><span>Élève, parent, professeur, administration, direction ou cantine : le même moteur de points, des récompenses adaptées au rôle.</span></div></div>
    <Panel title="Récompenses disponibles"><div className="reward-grid">{roleRewards.length?roleRewards.map(x=><div className="reward" key={x.id}><div className="reward-icon">{role==='director'?'◈':x.points_cost<800?'☕':x.points_cost<2000?'✦':'🎁'}</div><div><b>{x.name}</b><span>{fr(x.points_cost)} points{x.points_cost>balance?` · il vous manque ${fr(x.points_cost-balance)}`:''}</span></div><button className="outline" disabled={balance<x.points_cost||!!busy} onClick={()=>redeem(x)}>{busy===x.id?'…':'Échanger'}</button></div>):<Empty text="Aucune récompense disponible pour votre rôle."/>}</div></Panel>
    <Panel title="Activité récente">{[...data.points,...demoStorage<any[]>(`eos-demo-impact-events-${userId}`,[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,8).map((x:any)=><div className="row" key={x.id}><b>{Number(x.points)>0?`+${x.points}`:x.points}</b><span>{x.reason}</span><small>{new Intl.DateTimeFormat('fr-FR').format(new Date(x.created_at))}</small></div>)}</Panel>
  </>
}

export function Agora({role,mode,session,profile,schoolId}:{role:Role,mode:Mode,session:any,profile:Profile|null,schoolId:string|null}){
  const [section,setSection]=useState<'ideas'|'surveys'|'roadmap'>('ideas')
  const [ideas,setIdeas]=useState<CommunityIdea[]>([])
  const [surveys,setSurveys]=useState<CommunitySurvey[]>([])
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false)
  const userId=mode==='live'?session?.user?.id:(profile?.id||`demo-${role}`)
  const authorName=profile?.full_name||roleLabels[role]
  useEffect(()=>{let alive=true;async function load(){setMsg('');if(mode==='demo'){const storedIdeas=demoStorage('eos-demo-agora-ideas',demoIdeaSeed).map((x:any)=>({...x,voted:!!demoStorage<string[]>(`eos-demo-votes-${userId}`,[]).includes(x.id)}));const storedSurveys=demoStorage('eos-demo-agora-surveys',demoSurveySeed);const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{});setIdeas(storedIdeas);setSurveys(storedSurveys.map((x:any)=>({...x,answer:answers[x.id]||null})));return}if(!schoolId||!userId){return}try{const [ir,sr]=await Promise.all([supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}),supabase.from('community_surveys').select('id,question,description,expires_at').eq('school_id',schoolId).eq('active',true).order('created_at',{ascending:false})]);if(ir.error)throw ir.error;if(sr.error)throw sr.error;const ids=(sr.data||[]).map((x:any)=>x.id);const [vr,or,allrr,myrr]=await Promise.all([supabase.from('community_idea_votes').select('idea_id').eq('user_id',userId),ids.length?supabase.from('community_survey_options').select('id,survey_id,label').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').eq('user_id',userId).in('survey_id',ids):Promise.resolve({data:[],error:null} as any)]);if(vr.error)throw vr.error;if(or.error)throw or.error;if(allrr.error)throw allrr.error;if(myrr.error)throw myrr.error;const voted=new Set((vr.data||[]).map((x:any)=>x.idea_id));const optionRows=(or.data||[]) as any[];const responseMap=new Map((myrr.data||[]).map((x:any)=>[x.survey_id,x.option_id]));const optionCounts=new Map<string,number>();(allrr.data||[]).forEach((x:any)=>optionCounts.set(x.option_id,(optionCounts.get(x.option_id)||0)+1));const grouped=(sr.data||[]).map((q:any)=>{const opts=optionRows.filter(o=>o.survey_id===q.id).map(o=>({id:o.id,label:o.label,votes:optionCounts.get(o.id)||0}));return {...q,options:opts,answer:responseMap.get(q.id)||null}});setIdeas((ir.data||[]).map((x:any)=>({id:x.id,title:x.title,description:x.description,author_name:x.author_name,role:x.role,status:x.status,votes:Number(x.vote_count||0),created_at:x.created_at,voted:voted.has(x.id)})));setSurveys(grouped)}catch(e:any){if(alive)setMsg(e?.message||'Agora indisponible pour le moment. Appliquez la migration Supabase dédiée.')}}load();return()=>{alive=false}},[mode,schoolId,userId])
  async function submitIdea(e:React.FormEvent){e.preventDefault();const t=title.trim(),d=description.trim();if(t.length<8||d.length<12){setMsg('Donnez un titre clair et une description utile.');return}setBusy(true);setMsg('');try{if(mode==='demo'){const next:CommunityIdea={id:`idea-${Date.now()}`,title:t,description:d,author_name:authorName,role,status:'new',votes:0,created_at:new Date().toISOString()};const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed);saveDemoStorage('eos-demo-agora-ideas',[next,...stored]);setIdeas((x)=>[next,...x]);addDemoPoints(userId,10,'Idée proposée dans Agora');}else{const {error}=await supabase.rpc('submit_community_idea',{p_title:t,p_description:d});if(error)throw error;const {data:rows,error:readError}=await supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('school_id',schoolId).order('created_at',{ascending:false});if(readError)throw readError;setIdeas((rows||[]).map((x:any)=>({...x,votes:Number(x.vote_count||0)})));window.dispatchEvent(new Event('eos-points-updated'))}setTitle('');setDescription('');setMsg('Idée envoyée. +10 points pour votre contribution.')}catch(e:any){setMsg(e?.message||'Impossible d’envoyer cette idée.')}finally{setBusy(false)}}
  async function vote(id:string){const current=ideas.find(x=>x.id===id);if(!current||current.voted)return;try{if(mode==='demo'){const votes=demoStorage<string[]>(`eos-demo-votes-${userId}`,[]);if(votes.includes(id))return;saveDemoStorage(`eos-demo-votes-${userId}`,[id,...votes]);const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed).map(x=>x.id===id?{...x,votes:x.votes+1,voted:true}:x);saveDemoStorage('eos-demo-agora-ideas',stored);setIdeas(stored);addDemoPoints(userId,2,'Vote utile dans Agora');}else{const {error}=await supabase.rpc('vote_community_idea',{p_idea_id:id});if(error)throw error;setIdeas(x=>x.map(i=>i.id===id?{...i,votes:i.votes+1,voted:true}:i));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(e?.message||'Vote impossible.')}}
  async function answerSurvey(surveyId:string,optionId:string){const survey=surveys.find(x=>x.id===surveyId);if(!survey||survey.answer)return;try{if(mode==='demo'){const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{});answers[surveyId]=optionId;saveDemoStorage(`eos-demo-survey-answers-${userId}`,answers);const stored=demoStorage<CommunitySurvey[]>('eos-demo-agora-surveys',demoSurveySeed).map(s=>s.id===surveyId?{...s,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o),answer:optionId}:s);saveDemoStorage('eos-demo-agora-surveys',stored);setSurveys(stored);addDemoPoints(userId,2,'Participation à un sondage');}else{const {error}=await supabase.rpc('respond_community_survey',{p_survey_id:surveyId,p_option_id:optionId});if(error)throw error;setSurveys(x=>x.map(s=>s.id===surveyId?{...s,answer:optionId,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o)}:s));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(e?.message||'Réponse impossible.')}}
  return <><div className="section-intro"><div><span className="eyebrow">ÉCOLE OS / COMMUNAUTÉ</span><h1>Agora.</h1><p>Les idées qui améliorent l'école passent par ici : proposer, voter, voir ce qui avance.</p></div><span className="pill"><Sparkles size={15}/> +10 points par idée retenue</span></div><div className="agora-tabs"><button className={section==='ideas'?'active':''} onClick={()=>setSection('ideas')}><Lightbulb size={16}/>Idées</button><button className={section==='surveys'?'active':''} onClick={()=>setSection('surveys')}><BarChart3 size={16}/>Sondages</button><button className={section==='roadmap'?'active':''} onClick={()=>setSection('roadmap')}><ListChecks size={16}/>Feuille de route</button></div>{msg&&<div className="alert">{msg}</div>}{section==='ideas'&&<div className="agora-layout"><section className="panel"><div className="panel-head"><div><h3>Proposer une amélioration</h3><span className="panel-subtitle">Une idée courte, concrète et utile.</span></div><MessageSquarePlus size={18}/></div><form className="agora-form" onSubmit={submitIdea}><label>Titre<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={110} placeholder="Ex. Calendrier commun parents / professeurs"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={420} placeholder="Pourquoi cette amélioration aiderait l'école ?" rows={4}/></label><button className="primary" disabled={busy}><Lightbulb size={16}/>{busy?'Envoi…':'Proposer mon idée'}</button></form></section><section className="panel"><div className="panel-head"><div><h3>Les idées de la communauté</h3><span className="panel-subtitle">Un vote par idée. Pas de classement des personnes.</span></div><ThumbsUp size={18}/></div><div className="idea-list">{ideas.length?ideas.map(x=><article className="idea-card" key={x.id}><div className="idea-head"><div><b>{x.title}</b><span>{x.description}</span></div><button className={`vote-btn${x.voted?' voted':''}`} disabled={x.voted} onClick={()=>vote(x.id)}><ThumbsUp size={15}/>{x.votes}</button></div><div className="idea-meta"><span className={`idea-status ${ideaStatusClass[x.status]}`}>{ideaStatusLabel[x.status]}</span><span>{roleLabels[x.role]} · {x.author_name}</span><span>{shortDate(x.created_at)}</span></div></article>):<Empty text="Aucune idée pour le moment."/>}</div></section></div>}{section==='surveys'&&<div className="survey-list">{surveys.length?surveys.map(s=>{const total=s.options.reduce((n,o)=>n+o.votes,0);return <section className="panel survey-card" key={s.id}><div className="panel-head"><div><h3>{s.question}</h3><span className="panel-subtitle">{s.description}</span></div><BarChart3 size={18}/></div><div className="survey-options">{s.options.map(o=>{const pct=total?Math.round(o.votes/total*100):0;const selected=s.answer===o.id;return <button key={o.id} className={`survey-option${selected?' selected':''}`} disabled={!!s.answer} onClick={()=>answerSurvey(s.id,o.id)}><span className="survey-option-top"><b>{o.label}</b><small>{pct}%</small></span><span className="survey-bar"><i style={{width:`${pct}%`}}/></span></button>})}</div>{s.answer?<small className="survey-done"><CheckCircle2 size={15}/> Merci. Votre réponse compte.</small>:<small className="survey-hint">1 réponse · +2 points</small>}</section>}) : <div className="panel"><Empty text="Aucun sondage actif."/></div>}</div>}{section==='roadmap'&&<div className="roadmap-grid">{(['new','review','planned','building','done'] as IdeaStatus[]).map(status=><section className="panel roadmap-col" key={status}><div className="roadmap-title"><span className={`idea-status ${ideaStatusClass[status]}`}>{ideaStatusLabel[status]}</span><b>{ideas.filter(x=>x.status===status).length}</b></div>{ideas.filter(x=>x.status===status).map(x=><article className="roadmap-item" key={x.id}><b>{x.title}</b><small>{x.votes} votes</small></article>)}{!ideas.some(x=>x.status===status)&&<small className="muted">Rien pour l'instant.</small>}</section>)}</div>}</>}


export function Community({role,mode,session,profile,schoolId}:{role:Role,mode:Mode,session:any,profile:Profile|null,schoolId:string|null}){
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
        addDemoPoints(userId,10,'Suggestion ajoutée à Evolution depuis la Communauté')
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

