import React,{useEffect,useMemo,useState} from 'react'
import {supabase} from './lib/supabase'
import {fr,shortDate,Empty} from './shared'
import {Mode} from './shared'
import {Role,AppData,Profile,CommunityIdea,CommunityMessage,CommunitySpace,CommunitySurvey,IdeaStatus,Reward,addDemoPoints,demoRoleIds,demoStorage,firstLetters,roleLabels,saveDemoStorage,demoIdeaSeed,demoSurveySeed,ideaStatusLabel,ideaStatusClass} from './appModel'
import {errorMessage} from './lib/errors'
import {BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Gift, GraduationCap, KeyRound, Landmark, LogOut, Mail, Menu, Package, Save, School, ShieldCheck, ShoppingCart, FileUp, UserPlus, RefreshCw, Check, AlertTriangle, Sparkles, Star, UserRound, Users, UtensilsCrossed, WalletCards, X, Lightbulb, MessageSquarePlus, ThumbsUp, BarChart3, Palette, ListChecks, Gauge, Activity, ServerCog, MessageCircle, Megaphone, Send, Flag, ShieldAlert, Search, Info, UsersRound, LockKeyhole} from 'lucide-react'
import {Panel,ErrorNotice} from './ui'

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
      setMsg(errorMessage(e,'Impossible d’échanger cette récompense.'));
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
  const [ideasOffset,setIdeasOffset]=useState(0)
  const [surveysOffset,setSurveysOffset]=useState(0)
  const [hasMoreIdeas,setHasMoreIdeas]=useState(false)
  const [hasMoreSurveys,setHasMoreSurveys]=useState(false)
  const [loadingMoreIdeas,setLoadingMoreIdeas]=useState(false)
  const [loadingMoreSurveys,setLoadingMoreSurveys]=useState(false)
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false)
  const userId=mode==='live'?session?.user?.id:(profile?.id||`demo-${role}`)
  const authorName=profile?.full_name||roleLabels[role]
  const pageSize=40
  async function loadLiveIdeaPage(offset:number,append:boolean,activeSchoolId:string,activeUserId:string){
    const {data,error}=await supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('school_id',activeSchoolId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize)
    if(error)throw error
    const rows=(data||[]) as any[]
    const pageRows=rows.slice(0,pageSize)
    const pageIds=pageRows.map(x=>x.id)
    const votesResult=pageIds.length
      ?await supabase.from('community_idea_votes').select('idea_id').eq('user_id',activeUserId).in('idea_id',pageIds)
      :{data:[],error:null} as any
    if(votesResult.error)throw votesResult.error
    const voted=new Set((votesResult.data||[]).map((x:any)=>x.idea_id))
    const mapped:CommunityIdea[]=pageRows.map((x:any)=>({id:x.id,title:x.title,description:x.description,author_name:x.author_name,role:x.role,status:x.status,votes:Number(x.vote_count||0),created_at:x.created_at,voted:voted.has(x.id)}))
    setIdeas(current=>append?[...current,...mapped.filter(x=>!current.some(existing=>existing.id===x.id))]:mapped)
    setHasMoreIdeas(rows.length>pageSize)
    setIdeasOffset(offset+pageRows.length)
  }
  async function loadLiveSurveyPage(offset:number,append:boolean,activeSchoolId:string,activeUserId:string){
    const {data,error}=await supabase.from('community_surveys').select('id,question,description,expires_at').eq('school_id',activeSchoolId).eq('active',true).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize)
    if(error)throw error
    const rows=(data||[]) as any[]
    const pageRows=rows.slice(0,pageSize)
    const ids=pageRows.map(x=>x.id)
    const [optionsResult,allResponsesResult,myResponsesResult]=await Promise.all([
      ids.length?supabase.from('community_survey_options').select('id,survey_id,label').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),
      ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').in('survey_id',ids):Promise.resolve({data:[],error:null} as any),
      ids.length?supabase.from('community_survey_responses').select('survey_id,option_id').eq('user_id',activeUserId).in('survey_id',ids):Promise.resolve({data:[],error:null} as any),
    ])
    if(optionsResult.error)throw optionsResult.error
    if(allResponsesResult.error)throw allResponsesResult.error
    if(myResponsesResult.error)throw myResponsesResult.error
    const optionsBySurvey=new Map<string,any[]>()
    for(const option of (optionsResult.data||[]) as any[]){const group=optionsBySurvey.get(option.survey_id)||[];group.push(option);optionsBySurvey.set(option.survey_id,group)}
    const responseMap=new Map((myResponsesResult.data||[]).map((x:any)=>[x.survey_id,x.option_id]))
    const optionCounts=new Map<string,number>()
    for(const response of (allResponsesResult.data||[]) as any[])optionCounts.set(response.option_id,(optionCounts.get(response.option_id)||0)+1)
    const grouped:CommunitySurvey[]=pageRows.map((survey:any)=>({
      ...survey,
      options:(optionsBySurvey.get(survey.id)||[]).map(option=>({id:option.id,label:option.label,votes:optionCounts.get(option.id)||0})),
      answer:responseMap.get(survey.id)||null,
    }))
    setSurveys(current=>append?[...current,...grouped.filter(x=>!current.some(existing=>existing.id===x.id))]:grouped)
    setHasMoreSurveys(rows.length>pageSize)
    setSurveysOffset(offset+pageRows.length)
  }
  useEffect(()=>{
    let alive=true
    async function load(){
      setMsg('');setIdeasOffset(0);setSurveysOffset(0);setHasMoreIdeas(false);setHasMoreSurveys(false)
      if(mode==='demo'){
        const storedIdeas=demoStorage('eos-demo-agora-ideas',demoIdeaSeed).map((x:any)=>({...x,voted:!!demoStorage<string[]>(`eos-demo-votes-${userId}`,[]).includes(x.id)}))
        const storedSurveys=demoStorage('eos-demo-agora-surveys',demoSurveySeed)
        const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{})
        setIdeas(storedIdeas);setSurveys(storedSurveys.map((x:any)=>({...x,answer:answers[x.id]||null})));return
      }
      if(!schoolId||!userId){setIdeas([]);setSurveys([]);return}
      try{await Promise.all([loadLiveIdeaPage(0,false,schoolId,userId),loadLiveSurveyPage(0,false,schoolId,userId)])}
      catch(e:any){if(alive)setMsg(errorMessage(e,'Agora indisponible pour le moment.'))}
    }
    void load();return()=>{alive=false}
  },[mode,schoolId,userId])
  async function loadMoreIdeas(){if(loadingMoreIdeas||!hasMoreIdeas||mode!=='live'||!schoolId||!userId)return;setLoadingMoreIdeas(true);try{await loadLiveIdeaPage(ideasOffset,true,schoolId,userId)}catch(e:any){setMsg(errorMessage(e,'Impossible de charger les idées suivantes.'))}finally{setLoadingMoreIdeas(false)}}
  async function loadMoreSurveys(){if(loadingMoreSurveys||!hasMoreSurveys||mode!=='live'||!schoolId||!userId)return;setLoadingMoreSurveys(true);try{await loadLiveSurveyPage(surveysOffset,true,schoolId,userId)}catch(e:any){setMsg(errorMessage(e,'Impossible de charger les sondages suivants.'))}finally{setLoadingMoreSurveys(false)}}
  async function submitIdea(e:React.FormEvent){e.preventDefault();const t=title.trim(),d=description.trim();if(t.length<8||d.length<12){setMsg('Donnez un titre clair et une description utile.');return}setBusy(true);setMsg('');try{if(mode==='demo'){const next:CommunityIdea={id:`idea-${Date.now()}`,title:t,description:d,author_name:authorName,role,status:'new',votes:0,created_at:new Date().toISOString()};const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed);saveDemoStorage('eos-demo-agora-ideas',[next,...stored]);setIdeas((x)=>[next,...x]);addDemoPoints(userId,10,'Idée proposée dans Agora');}else{const {data:ideaId,error}=await supabase.rpc('submit_community_idea',{p_title:t,p_description:d});if(error)throw error;if(!ideaId)throw new Error('Idée créée, mais impossible de récupérer son identifiant.');const {data:row,error:readError}=await supabase.from('community_ideas').select('id,title,description,author_name,role,status,vote_count,created_at').eq('id',ideaId).single();if(readError)throw readError;const created:CommunityIdea={id:row.id,title:row.title,description:row.description,author_name:row.author_name,role:row.role,status:row.status,votes:Number(row.vote_count||0),created_at:row.created_at,voted:false};setIdeas(current=>[created,...current.filter(x=>x.id!==created.id)]);setIdeasOffset(offset=>offset+1);window.dispatchEvent(new Event('eos-points-updated'))}setTitle('');setDescription('');setMsg('Idée envoyée. +10 points pour votre contribution.')}catch(e:any){setMsg(errorMessage(e,'Impossible d’envoyer cette idée.'))}finally{setBusy(false)}}
  async function vote(id:string){const current=ideas.find(x=>x.id===id);if(!current||current.voted)return;try{if(mode==='demo'){const votes=demoStorage<string[]>(`eos-demo-votes-${userId}`,[]);if(votes.includes(id))return;saveDemoStorage(`eos-demo-votes-${userId}`,[id,...votes]);const stored=demoStorage<CommunityIdea[]>('eos-demo-agora-ideas',demoIdeaSeed).map(x=>x.id===id?{...x,votes:x.votes+1,voted:true}:x);saveDemoStorage('eos-demo-agora-ideas',stored);setIdeas(stored);addDemoPoints(userId,2,'Vote utile dans Agora');}else{const {error}=await supabase.rpc('vote_community_idea',{p_idea_id:id});if(error)throw error;setIdeas(x=>x.map(i=>i.id===id?{...i,votes:i.votes+1,voted:true}:i));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(errorMessage(e,'Vote impossible.'))}}
  async function answerSurvey(surveyId:string,optionId:string){const survey=surveys.find(x=>x.id===surveyId);if(!survey||survey.answer)return;try{if(mode==='demo'){const answers=demoStorage<Record<string,string>>(`eos-demo-survey-answers-${userId}`,{});answers[surveyId]=optionId;saveDemoStorage(`eos-demo-survey-answers-${userId}`,answers);const stored=demoStorage<CommunitySurvey[]>('eos-demo-agora-surveys',demoSurveySeed).map(s=>s.id===surveyId?{...s,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o),answer:optionId}:s);saveDemoStorage('eos-demo-agora-surveys',stored);setSurveys(stored);addDemoPoints(userId,2,'Participation à un sondage');}else{const {error}=await supabase.rpc('respond_community_survey',{p_survey_id:surveyId,p_option_id:optionId});if(error)throw error;setSurveys(x=>x.map(s=>s.id===surveyId?{...s,answer:optionId,options:s.options.map(o=>o.id===optionId?{...o,votes:o.votes+1}:o)}:s));window.dispatchEvent(new Event('eos-points-updated'))}}catch(e:any){setMsg(errorMessage(e,'Réponse impossible.'))}}
  return <><div className="section-intro"><div><span className="eyebrow">ÉCOLE OS / COMMUNAUTÉ</span><h1>Agora.</h1><p>Les idées qui améliorent l'école passent par ici : proposer, voter, voir ce qui avance.</p></div><span className="pill"><Sparkles size={15}/> +10 points par idée retenue</span></div><div className="agora-tabs"><button className={section==='ideas'?'active':''} onClick={()=>setSection('ideas')}><Lightbulb size={16}/>Idées</button><button className={section==='surveys'?'active':''} onClick={()=>setSection('surveys')}><BarChart3 size={16}/>Sondages</button><button className={section==='roadmap'?'active':''} onClick={()=>setSection('roadmap')}><ListChecks size={16}/>Feuille de route</button></div>{msg&&<div className="alert">{msg}</div>}{section==='ideas'&&<div className="agora-layout"><section className="panel"><div className="panel-head"><div><h3>Proposer une amélioration</h3><span className="panel-subtitle">Une idée courte, concrète et utile.</span></div><MessageSquarePlus size={18}/></div><form className="agora-form" onSubmit={submitIdea}><label>Titre<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={110} placeholder="Ex. Calendrier commun parents / professeurs"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={420} placeholder="Pourquoi cette amélioration aiderait l'école ?" rows={4}/></label><button className="primary" disabled={busy}><Lightbulb size={16}/>{busy?'Envoi…':'Proposer mon idée'}</button></form></section><section className="panel"><div className="panel-head"><div><h3>Les idées de la communauté</h3><span className="panel-subtitle">Un vote par idée. Pas de classement des personnes.</span></div><ThumbsUp size={18}/></div><div className="idea-list">{ideas.length?ideas.map(x=><article className="idea-card" key={x.id}><div className="idea-head"><div><b>{x.title}</b><span>{x.description}</span></div><button className={`vote-btn${x.voted?' voted':''}`} disabled={x.voted} onClick={()=>vote(x.id)}><ThumbsUp size={15}/>{x.votes}</button></div><div className="idea-meta"><span className={`idea-status ${ideaStatusClass[x.status]}`}>{ideaStatusLabel[x.status]}</span><span>{roleLabels[x.role]} · {x.author_name}</span><span>{shortDate(x.created_at)}</span></div></article>):<Empty text="Aucune idée pour le moment."/>}</div></section><div className="agora-more">{hasMoreIdeas&&<button className="outline" type="button" onClick={()=>void loadMoreIdeas()} disabled={loadingMoreIdeas}>{loadingMoreIdeas?'Chargement…':'Charger plus d’idées'}</button>}</div></div>}{section==='surveys'&&<><div className="survey-list">{surveys.length?surveys.map(s=>{const total=s.options.reduce((n,o)=>n+o.votes,0);return <section className="panel survey-card" key={s.id}><div className="panel-head"><div><h3>{s.question}</h3><span className="panel-subtitle">{s.description}</span></div><BarChart3 size={18}/></div><div className="survey-options">{s.options.map(o=>{const pct=total?Math.round(o.votes/total*100):0;const selected=s.answer===o.id;return <button key={o.id} className={`survey-option${selected?' selected':''}`} disabled={!!s.answer} onClick={()=>answerSurvey(s.id,o.id)}><span className="survey-option-top"><b>{o.label}</b><small>{pct}%</small></span><span className="survey-bar"><i style={{width:`${pct}%`}}/></span></button>})}</div>{s.answer?<small className="survey-done"><CheckCircle2 size={15}/> Merci. Votre réponse compte.</small>:<small className="survey-hint">1 réponse · +2 points</small>}</section>}) : <div className="panel"><Empty text="Aucun sondage actif."/></div>}</div><div className="agora-more">{hasMoreSurveys&&<button className="outline" type="button" onClick={()=>void loadMoreSurveys()} disabled={loadingMoreSurveys}>{loadingMoreSurveys?'Chargement…':'Charger plus de sondages'}</button>}</div></>}{section==='roadmap'&&<><div className="roadmap-grid">{(['new','review','planned','building','done'] as IdeaStatus[]).map(status=><section className="panel roadmap-col" key={status}><div className="roadmap-title"><span className={`idea-status ${ideaStatusClass[status]}`}>{ideaStatusLabel[status]}</span><b>{ideas.filter(x=>x.status===status).length}</b></div>{ideas.filter(x=>x.status===status).map(x=><article className="roadmap-item" key={x.id}><b>{x.title}</b><small>{x.votes} votes</small></article>)}{!ideas.some(x=>x.status===status)&&<small className="muted">Rien pour l'instant.</small>}</section>)}</div><div className="agora-more">{hasMoreIdeas&&<button className="outline" type="button" onClick={()=>void loadMoreIdeas()} disabled={loadingMoreIdeas}>{loadingMoreIdeas?'Chargement…':'Charger plus d’idées'}</button>}</div></>}</>}


export function Community({role,mode,session,profile,schoolId}:{role:Role,mode:Mode,session:any,profile:Profile|null,schoolId:string|null}){
  const userId=profile?.id||session?.user?.id||'anonymous'
  const demoSpaces:CommunitySpace[]=[
    {id:'demo-announcements',name:'Annonces de l’établissement',description:'Informations officielles de l’établissement.',kind:'announcement',scope_type:'school',priority:20,created_at:'2026-09-24T08:00:00Z'},
    {id:'demo-class',name:profile?.class_name?`Classe ${profile.class_name}`:'Mon groupe',description:'Votre espace de classe : devoirs et entraide.',kind:'community',scope_type:'class',scope_key:profile?.class_name||'4e B',priority:10,created_at:'2026-09-24T07:55:00Z'},
    {id:'demo-community',name:'Vie de l’établissement',description:'Échanges entre membres sur la vie scolaire.',kind:'community',scope_type:'school',priority:50,created_at:'2026-09-24T08:05:00Z'},
  ]
  const demoMessages:CommunityMessage[]=[
    {id:'dm1',space_id:'demo-announcements',sender_id:demoRoleIds.director,sender_name:'Ibrahima Sarr',sender_role:'director',body:'Réunion parents-professeurs : jeudi à 17 h, salle polyvalente.',created_at:'2026-09-24T08:12:00Z'},
    {id:'dm2',space_id:'demo-class',sender_id:demoRoleIds.teacher,sender_name:'Cheikh Fall',sender_role:'teacher',body:'Devoir de maths : exercices 4 à 8. La correction sera partagée vendredi.',created_at:'2026-09-24T09:30:00Z'},
    {id:'dm3',space_id:'demo-class',sender_id:demoRoleIds.parent,sender_name:'Aminata Ndiaye',sender_role:'parent',body:'Merci pour la précision, c’est noté.',created_at:'2026-09-24T10:02:00Z'},
    {id:'dm4',space_id:'demo-community',sender_id:demoRoleIds.student,sender_name:'Awa Diop',sender_role:'student',body:'Pour les révisions de vendredi, la salle 3 est libre de 16 h à 18 h.',created_at:'2026-09-24T10:40:00Z'},
  ]
  const [spaces,setSpaces]=useState<CommunitySpace[]>([])
  const [selected,setSelected]=useState('')
  const [messages,setMessages]=useState<CommunityMessage[]>([])
  const [overview,setOverview]=useState<CommunitySpace[]>([])
  const [draft,setDraft]=useState('')
  const [loading,setLoading]=useState(true)
  const [sending,setSending]=useState(false)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState<unknown>(null)

  const selectedSpace=spaces.find(x=>x.id===selected)||spaces[0]||null
  const isDemo=mode==='demo'
  const visibleMessages=messages.filter(x=>x.space_id===selectedSpace?.id)
  const canAnnounce=['admin','director','teacher'].includes(role)
  const scopeIcon=(space:CommunitySpace)=>space.scope_type==='class'?<UsersRound size={16}/>:space.kind==='announcement'?<Megaphone size={16}/>:<MessageCircle size={16}/>
  const timeOnly=(d:string)=>{const x=new Date(d);return isNaN(x.getTime())?'':new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(x)}

  function sortSpaces(rows:CommunitySpace[]){return [...rows].sort((a,b)=>(Number(a.priority??50)-Number(b.priority??50))||a.name.localeCompare(b.name))}
  function readDemoSpaces(){
    const stored=demoStorage<CommunitySpace[]>('eos-demo-community-spaces',demoSpaces)
    const enriched=sortSpaces(stored.filter(s=>demoSpaces.some(d=>d.id===s.id)).map(s=>{const all=demoMessages.filter(m=>m.space_id===s.id);return {...s,name:demoSpaces.find(d=>d.id===s.id)!.name,unread_count:all.length,latest_body:all.at(-1)?.body||null,latest_at:all.at(-1)?.created_at||null}}))
    saveDemoStorage('eos-demo-community-spaces',enriched)
    setSpaces(enriched);setOverview(enriched)
    setSelected(current=>current||enriched[0]?.id||'')
  }
  function demoKey(spaceId:string){return `eos-demo-community-messages-${spaceId}`}
  function loadDemoMessages(spaceId:string){
    const stored=demoStorage<CommunityMessage[]>(demoKey(spaceId),demoMessages.filter(m=>m.space_id===spaceId))
    saveDemoStorage(demoKey(spaceId),stored)
    setMessages(stored)
    const fresh=spaces.map(s=>s.id===spaceId?{...s,unread_count:0,latest_body:stored.at(-1)?.body||null,latest_at:stored.at(-1)?.created_at||null}:s)
    setSpaces(fresh);setOverview(fresh);saveDemoStorage('eos-demo-community-spaces',fresh)
  }
  async function loadLiveSpaces(){
    if(!schoolId||!userId)return
    setLoading(true);setError(null)
    try{
      const {error:ensureError}=await supabase.rpc('ensure_default_community_spaces')
      if(ensureError)throw ensureError
      const {data,error}=await supabase.rpc('get_community_overview')
      if(error)throw error
      const rows=sortSpaces((data||[]) as CommunitySpace[])
      setOverview(rows);setSpaces(rows);setSelected(current=>current||String(rows[0]?.id||''))
    }catch(e:any){setError(e)}finally{setLoading(false)}
  }
  async function loadLiveMessages(spaceId:string){
    if(!spaceId)return
    try{
      // Les 80 messages les plus récents, remis dans l'ordre de lecture.
      const {data,error}=await supabase.from('community_messages').select('id,space_id,sender_id,sender_name,sender_role,body,created_at').eq('space_id',spaceId).is('deleted_at',null).order('created_at',{ascending:false}).limit(80)
      if(error)throw error
      setMessages([...(data||[])].reverse().map((x:any)=>({id:x.id,space_id:x.space_id,sender_id:x.sender_id,sender_name:x.sender_name||'Membre',sender_role:(x.sender_role||'student') as Role,body:x.body,created_at:x.created_at,mine:x.sender_id===userId})))
      await supabase.rpc('mark_community_space_read',{p_space_id:spaceId})
      setOverview(prev=>prev.map(s=>s.id===spaceId?{...s,unread_count:0}:s))
    }catch(e:any){setError(e)}
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

  async function sendMessage(e:React.FormEvent){
    e.preventDefault()
    const body=draft.trim();if(!body||!selectedSpace||sending)return
    if(body.length>2000){setNotice('Votre message dépasse la limite de 2 000 caractères.');return}
    setSending(true);setNotice('');setError(null)
    try{
      if(isDemo){
        const local:CommunityMessage={id:`local-${Date.now()}`,space_id:selectedSpace.id,sender_id:userId,sender_name:profile?.full_name||roleLabels[role],sender_role:role,body,created_at:new Date().toISOString(),mine:true}
        const next=[...messages,local];saveDemoStorage(demoKey(selectedSpace.id),next);setMessages(next);setOverview(prev=>prev.map(s=>s.id===selectedSpace.id?{...s,latest_body:body,latest_at:local.created_at,unread_count:0}:s));setDraft('');return
      }
      const {error}=await supabase.rpc('send_community_message',{p_space_id:selectedSpace.id,p_body:body})
      if(error)throw error
      setDraft(''); await loadLiveMessages(selectedSpace.id)
    }catch(e:any){setError(e)}finally{setSending(false)}
  }
  async function reportMessage(messageId:string){
    const reason=window.prompt('Expliquez brièvement pourquoi vous signalez ce message.')?.trim();if(!reason)return
    try{if(isDemo){setNotice('Signalement démo enregistré localement.');return}const {error}=await supabase.rpc('report_community_message',{p_message_id:messageId,p_reason:reason});if(error)throw error;setNotice('Signalement reçu. Il sera examiné séparément de la discussion.')}catch(e:any){setError(e)}
  }

  return <div className="community-page">
    <div className="section-intro community-page-intro">
      <div><span className="eyebrow">Communauté</span><h1>Conversations</h1><p>Les annonces officielles d’un côté, les échanges entre membres de l’autre.</p></div>
    </div>
    {error?<ErrorNotice error={error} onRetry={()=>{setError(null);isDemo?readDemoSpaces():loadLiveSpaces()}}/>:null}
    {notice&&<div className="alert success">{notice}</div>}
    <div className="community-shell-v2">
      <aside className="community-inbox panel" aria-label="Vos conversations">
        <div className="community-inbox-head"><div><span className="eyebrow">VOS ESPACES</span><h3>Conversations</h3></div><span className="community-count">{spaces.length}</span></div>
        <div className="community-room-list-v2">
          {loading?<div className="skeleton"><i/><i/><i/></div>:spaces.map(space=>{
            const unread=Number(space.unread_count||0)>0
            return <button key={space.id} className={`community-conversation-item${selectedSpace?.id===space.id?' active':''}`} onClick={()=>setSelected(space.id)} aria-current={selectedSpace?.id===space.id?'true':undefined}>
              <span className={`community-avatar ${space.kind}`} aria-hidden="true">{scopeIcon(space)}</span>
              <span className="community-conversation-copy"><span className="community-conversation-line"><b>{space.name}</b>{unread&&<em>{space.unread_count}</em>}</span><span>{space.latest_body||'Aucun message pour le moment.'}</span></span>
              <time>{space.latest_at?timeOnly(space.latest_at):''}</time>
            </button>
          })}
          {!loading&&!spaces.length&&<Empty text="Aucun espace disponible."/>}
        </div>
      </aside>
      <section className="community-chat-v2 panel">
        {selectedSpace?<>
          <header className="community-chat-head-v2">
            <div className="community-chat-title-v2"><span className={`community-avatar large ${selectedSpace.kind}`}>{scopeIcon(selectedSpace)}</span><div><div className="community-title-line"><h3>{selectedSpace.name}</h3><span>{selectedSpace.kind==='announcement'?'Annonce officielle':'Discussion'}</span></div><p>{selectedSpace.description}</p></div></div>
          </header>
          <div className="community-messages-v2" aria-live="polite">
            {!visibleMessages.length&&<div className="community-empty-chat"><span className={`community-avatar large ${selectedSpace.kind}`}>{scopeIcon(selectedSpace)}</span><h3>Début de cette conversation</h3><p>{selectedSpace.kind==='announcement'?'Les annonces publiées ici restent visibles pour les nouveaux arrivants.':'Les membres de cet espace peuvent écrire ici.'}</p></div>}
            {visibleMessages.map(m=><article className={`community-message-v2${m.mine?' mine':''}`} key={m.id}>
              {!m.mine&&<div className="community-message-avatar-v2">{firstLetters(m.sender_name)}</div>}
              <div className="community-message-wrap-v2"><div className="community-message-meta-v2"><b>{m.mine?'Vous':m.sender_name}</b><span>{roleLabels[m.sender_role]}</span><time>{timeOnly(m.created_at)}</time>{!m.mine&&<button className="icon-btn community-report" title="Signaler ce message" aria-label="Signaler ce message" onClick={()=>reportMessage(m.id)}><Flag size={13}/></button>}</div><div className="community-bubble-v2">{m.body}</div></div>
            </article>)}
          </div>
          <form className="community-composer-v2" onSubmit={sendMessage}>
            <div className="community-composer-label"><span>{selectedSpace.kind==='announcement'?'Publier une annonce officielle':'Écrire dans '+selectedSpace.name}</span><small>{selectedSpace.kind==='announcement'&&!canAnnounce?'Lecture seule pour votre compte.':'2 000 caractères maximum.'}</small></div>
            <div className="community-composer-row"><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} rows={3} placeholder={selectedSpace.kind==='announcement'&&!canAnnounce?'Vous pouvez consulter les annonces, mais ce compte ne peut pas en publier.':'Écrivez un message clair…'} disabled={selectedSpace.kind==='announcement'&&!canAnnounce} aria-label="Votre message"/><button className="primary community-send" disabled={sending||!draft.trim()||selectedSpace.kind==='announcement'&&!canAnnounce}>{sending?'Envoi…':<><Send size={15}/>Envoyer</>}</button></div>
          </form>
        </>:<div className="community-no-selection"><MessageCircle size={26}/><h3>Sélectionnez une conversation</h3><p>Choisissez un espace à gauche pour lire les messages et participer.</p></div>}
      </section>
    </div>
  </div>
}
