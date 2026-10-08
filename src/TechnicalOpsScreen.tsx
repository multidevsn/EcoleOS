import React, {useEffect, useState} from 'react'
import {Activity, BarChart3, CircleDollarSign, Gauge, RefreshCw, School, ServerCog, ShieldCheck, Users, WalletCards} from 'lucide-react'
import {Mode, KpiStrip, MiniBar, Empty, shortMoney, frToday, fr, shortDate} from './shared'
import {ErrorNotice} from './ui'

export function TechnicalOps({mode,session}:{mode:Mode,session:any}){
  const [loading,setLoading]=useState(true),[syncing,setSyncing]=useState(false),[error,setError]=useState<unknown>(null),[retry,setRetry]=useState<(() => void)|null>(null),[notice,setNotice]=useState(''),[payload,setPayload]=useState<any|null>(null)
  async function load(){
    setError(null);setRetry(null)
    if(mode==='demo'){
      setPayload({kpis:{schools:12,users:1860,active_subscriptions:10,projected_revenue_xof:75000,estimated_cost_xof:28600,actual_provider_cost_xof:31450,projected_margin_xof:43550,avg_users_per_school:155,past_due_cycles:1},cycles:[{school_id:'demo',amount_xof:12500,estimated_cost_xof:4200,provider_cost_xof:4360,cost_basis:'provider_allocation',margin_xof:8140,active_users:230,status:'due'}],cost_rules:[{service:'Supabase',metric:'active_users',label:'Infrastructure / utilisateur actif',fixed_monthly_xof:0,included_units:100,unit_cost_xof:20},{service:'Vercel',metric:'deployments',label:'Hébergement / déploiement',fixed_monthly_xof:0,included_units:20,unit_cost_xof:50},{service:'Notifications',metric:'messages',label:'Emails / SMS',fixed_monthly_xof:0,included_units:1000,unit_cost_xof:2}],provider_costs:[{provider:'vercel',amount:8.42,currency:'USD',amount_xof:5200,status:'ok',basis:'provider_reported',units:{charge_records:18},fetched_at:new Date().toISOString()},{provider:'supabase',amount:18.4,currency:'USD',amount_xof:11200,status:'partial',basis:'usage_derived',units:{projects:1,plan:'pro'},fetched_at:new Date().toISOString()},],events:[{severity:'info',event_type:'provider_cost_sync',message:'Coûts fournisseurs synchronisés automatiquement.',created_at:new Date().toISOString()},{severity:'warning',event_type:'usage_threshold',message:'1 établissement approche de son plafond.',created_at:new Date(Date.now()-3600000).toISOString()}],autopilot:{enabled:true,mode:'usage-aware',policy:'Simulation démo'}})
      setLoading(false);return
    }
    if(!session?.access_token){setLoading(false);return}
    setLoading(true)
    try{const res=await fetch('/api/admin/tech',{headers:{Authorization:`Bearer ${session.access_token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'Dashboard technique indisponible.');setPayload(json)}catch(e){setError(e);setRetry(()=>load)}finally{setLoading(false)}
  }
  async function syncProviders(){
    if(mode==='demo'){setNotice('Mode démo : synchronisation fournisseur simulée.');return}
    if(!session?.access_token)return
    setSyncing(true);setError(null);setRetry(null);setNotice('Synchronisation des coûts fournisseurs…')
    try{
      const res=await fetch('/api/admin/provider-costs',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
      const json=await res.json()
      if(!res.ok)throw new Error(json.error||'Synchronisation impossible.')
      setNotice('Coûts fournisseurs actualisés.')
      await load()
    }catch(e){setError(e);setRetry(()=>syncProviders)}finally{setSyncing(false)}
  }
  useEffect(()=>{load()},[mode,session?.access_token])
  const k=payload?.kpis
  const providerCosts=payload?.provider_costs||[]
  const providerNames:Record<string,string>={vercel:'Vercel',supabase:'Supabase'}
  const providerMeta=(p:any)=>{
    const status=p?.status||'not_configured'
    const label=status==='ok'?'Réel fournisseur':status==='partial'?'Dérivé / partiel':status==='error'?'Erreur':'Non configuré'
    return label
  }
  return <>
    <div className="section-intro"><div><span className="eyebrow">ÉCOLE OS / CONTROL PLANE</span><h1>Ops & Autopilot.</h1><p>Surveillez la croissance, les coûts, les usages et le moteur de facturation sans piloter chaque école manuellement.</p></div><div className="ops-toolbar"><div className="ops-live-pill"><i/><span>Autopilot {payload?.autopilot?.enabled?'actif':'arrêté'}</span></div><button className="outline" onClick={syncProviders} disabled={syncing||mode==='live'&&!session?.access_token}><RefreshCw size={15} className={syncing?'spin':''}/>{syncing?'Synchronisation…':'Synchroniser les coûts'}</button></div></div>
    {error?<ErrorNotice error={error} onRetry={retry||undefined}/>:null}{notice&&<div className="alert">{notice}</div>}
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
