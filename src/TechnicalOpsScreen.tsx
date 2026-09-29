import React, {useEffect, useState} from 'react'
import {Activity, BarChart3, CircleDollarSign, Gauge, RefreshCw, School, ServerCog, ShieldCheck, Users, WalletCards} from 'lucide-react'
import {Mode, KpiStrip, MiniBar, Empty, shortMoney, frToday, fr, shortDate} from './shared'
import {isOwnerDevice, setOwnerDevice} from './lib/ownerTraffic'

export function TechnicalOps({mode,session}:{mode:Mode,session:any}){
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
      <TrafficPanel mode={mode} session={session}/>
    </>}
  </>
}

function TrafficPanel({mode,session}:{mode:Mode,session:any}){
  const [owner,setOwner]=useState(isOwnerDevice())
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[data,setData]=useState<any|null>(null),[days,setDays]=useState(7)
  useEffect(()=>{
    let alive=true
    async function load(){
      if(mode==='demo'){
        const daily=Array.from({length:days},(_,i)=>{const d=new Date(Date.now()-(days-1-i)*86400000);return{timestamp:d.toISOString(),pageviews:120+((i*37)%90),visitors:70+((i*23)%50)}})
        setData({configured:true,totals:{pageviews:daily.reduce((a,x)=>a+x.pageviews,0),visitors:daily.reduce((a,x)=>a+x.visitors,0)},daily,pages:[{route:'/',pageviews:420,visitors:260},{route:'/cantine',pageviews:210,visitors:150}],countries:[{country:'SN',pageviews:610,visitors:340},{country:'FR',pageviews:120,visitors:70}],devices:[{deviceType:'mobile',pageviews:640,visitors:360},{deviceType:'desktop',pageviews:210,visitors:120}],referrers:[{referrerHostname:'(direct)',pageviews:500,visitors:300}]})
        setLoading(false);return
      }
      if(!session?.access_token){setLoading(false);return}
      setLoading(true);setError('')
      try{
        const res=await fetch('/api/admin/traffic?days='+days,{headers:{Authorization:`Bearer ${session.access_token}`}})
        const json=await res.json()
        if(!res.ok)throw new Error(json.error||'Trafic indisponible.')
        if(alive)setData(json)
      }catch(e:any){if(alive)setError(e?.message||'Erreur de chargement du trafic.')}finally{if(alive)setLoading(false)}
    }
    load()
    return()=>{alive=false}
  },[mode,session?.access_token,days])
  const nf=(n:number)=>new Intl.NumberFormat('fr-FR').format(n||0)
  const daily:any[]=data?.daily||[]
  const maxDay=Math.max(1,...daily.map(d=>Number(d.pageviews||0)))
  const countOf=(r:any)=>Number(r?.pageviews??r?.visits??r?.count??r?.visitors??0)
  const list=(rows:any[],key:string,name:string,empty='(inconnu)')=>{
    if(!rows?.length){
      const why=data?.diagnostics?.[name]
      return <p className="traffic-empty">Aucune donnée{why?.startsWith('ÉCHEC')?' — '+why:''}</p>
    }
    const max=Math.max(1,...rows.map(countOf))
    return rows.map((r:any,i:number)=><MiniBar key={i} value={countOf(r)} max={max} label={String(r[key]||empty)} meta={nf(countOf(r))+' vues'+(Number(r?.visitors)?' · '+nf(Number(r.visitors))+' vis.':'')}/>)
  }
  return <section className="panel">
    <div className="panel-head"><div><h3>Trafic du site</h3><span className="panel-subtitle">Visiteurs et pages vues (Vercel Web Analytics, sans cookies). Dernière mise à jour : à l’ouverture de la page.</span></div><BarChart3 size={18}/></div>
    <div className="traffic-range">{[7,14,30].map(n=><button key={n} className={days===n?'active':''} onClick={()=>setDays(n)}>{n} jours</button>)}</div>
    <div className="traffic-owner"><span>{owner?'Cet appareil est exclu des statistiques : vos visites et tests ne sont plus comptés.':'Cet appareil est compté dans les statistiques.'}</span><button onClick={()=>{setOwnerDevice(!owner);setOwner(!owner)}}>{owner?'Recompter cet appareil':'Exclure cet appareil'}</button></div>
    {error&&<div className="alert error">{error}</div>}
    {loading?<div className="skeleton"><i/><i/></div>:data&&data.configured===false?<div className="alert">{data.message}</div>:data&&<>
      <div className="autopilot-grid"><div><span>Visiteurs</span><b>{nf(data.totals?.visitors)}</b></div><div><span>Pages vues</span><b>{nf(data.totals?.pageviews)}</b></div></div>
      <div className="traffic-chart" aria-label="Pages vues par jour">{daily.map((d,i)=><div key={i} className="traffic-col" title={new Date(d.timestamp).toLocaleDateString('fr-FR')+' : '+nf(d.pageviews)+' vues'}><i style={{height:`${Math.max(4,Number(d.pageviews||0)/maxDay*100)}%`}}/></div>)}</div>
      {!daily.length&&<div className="alert">Aucune donnée pour cette période. Vérifiez que Web Analytics est activé et que le site a reçu des visites.</div>}
      {data.diagnostics&&['pages','countries','devices','referrers'].some(k=>!data[k]?.length)&&<details className="traffic-diag"><summary>Diagnostic des listes vides</summary>{Object.entries(data.diagnostics).map(([k,v])=><div key={k}><b>{k}</b> : {String(v)}</div>)}</details>}
      <div className="grid two">
        <div><h4 className="traffic-h">Pages les plus vues</h4>{list(data.pages,'requestPath','pages','/')}</div>
        <div><h4 className="traffic-h">Pays</h4>{list(data.countries,'country','countries')}</div>
        <div><h4 className="traffic-h">Appareils</h4>{list(data.devices,'deviceType','devices')}</div>
        <div><h4 className="traffic-h">Sources</h4>{list(data.referrers,'referrerHostname','referrers','(direct)')}</div>
      </div>
    </>}
  </section>
}
