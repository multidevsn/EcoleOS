import React,{useEffect,useMemo,useState} from 'react'
import {supabase} from './lib/supabase'
import {fr,shortMoney,shortDate,Empty,KpiStrip,MiniBar,Card} from './shared'
import {Panel,OrdersTable} from './ui'
import {Mode} from './shared'
import {Role,Theme,AppData,Profile,ScheduleRow,CommunityIdea,CommunitySurvey,IdeaStatus,avg,firstLetters,mention,money,roleLabels,roleLabel,foodCapabilities} from './appModel'
import {BookOpen, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Clock3, Gift, GraduationCap, KeyRound, Landmark, LogOut, Mail, Menu, Package, Save, School, ShieldCheck, ShoppingCart, FileUp, UserPlus, RefreshCw, Check, AlertTriangle, Sparkles, Star, UserRound, Users, UtensilsCrossed, WalletCards, X, Lightbulb, MessageSquarePlus, ThumbsUp, BarChart3, Palette, ListChecks, Gauge, Activity, ServerCog, MessageCircle, Megaphone, Send, Flag, ShieldAlert, Search, Info, UsersRound, LockKeyhole} from 'lucide-react'

export function Food({role,mode,data,cart,setCart,checkout,message}:{role:Role,mode:Mode,data:AppData,cart:Record<string,number>,setCart:React.Dispatch<React.SetStateAction<Record<string,number>>>,checkout:()=>void,message:string}){
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

export function Schedule({role,mode,data}:{role:Role,mode:Mode,data:AppData}){const todayNo=((new Date().getDay()+6)%7)+1;const byDay=useMemo(()=>{const grouped:Record<number,ScheduleRow[]>={};for(const row of data.schedule)(grouped[row.weekday]??=[]).push(row);return grouped},[data.schedule]);const days=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];return <><div className="section-intro"><div><h1>{role==='teacher'?'Vos cours de la semaine':'Votre semaine'}</h1><p>{role==='teacher'?'Les cours qui vous sont affectés, jour par jour.':'Vos cours et leurs salles, jour par jour.'}</p></div></div><div className="schedule-week">{days.map((day,i)=><section className={'panel'+(i+1===todayNo?' today-col':'')} key={day}><div className="panel-head"><h3>{day}</h3><small>{i+1===todayNo?'Aujourd’hui · ':''}{(byDay[i+1]||[]).length} cours</small></div>{(byDay[i+1]||[]).length?(byDay[i+1]||[]).map(x=><div className="slot" key={x.id}><div className="time">{x.starts_at.slice(0,5)}</div><div><b>{x.subject}</b><span>{role==='teacher'?`${x.class_name} · `:''}jusqu’à {x.ends_at.slice(0,5)}</span></div><span className="status">{x.room}</span></div>):<Empty text="Aucun cours"/>}</section>)}</div>{mode==='demo'&&<div className="free"><b>Salles indicatives libres</b><span>A03 · A07 · C12 · Lab 1</span></div>}</>}

export function Grades({role,data}:{role:Role,data:AppData}){const average=avg(data.grades);return <><div className="grade-summary"><span>Moyenne générale</span><strong>{fr(average,2,2)}<i>/ 20</i></strong><small>Pondérée par les coefficients</small>{data.grades.length>0&&<em className="appreciation">{mention(average)}</em>}</div><Panel title={role==='parent'?`Résultats de ${data.profile?.child_name||'votre enfant'}`:role==='teacher'?'Carnet de notes':'Mes résultats'}>{data.grades.length?data.grades.map(g=><div className="grade-row" key={g.id} style={{'--v':g.value/20} as React.CSSProperties}><span>{g.subject}</span><small>Coef. {g.coefficient} · {g.term}</small><b>{fr(g.value)}/20</b></div>):<Empty text="Aucune note disponible"/>}</Panel></>}


export function SchoolMembers({role,session,mode}:{role:Role,session:any,mode:Mode}){
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
      {loading?<div className="skeleton mini"><i/><i/></div>:rows.length?<div>{rows.slice(0,100).map((r:any)=><div className="member-row" key={r.id}><div className="member-avatar">{firstLetters(r.full_name)}</div><div><b>{r.full_name}</b><span>{roleLabel(r.role)}{r.student_code?' · '+r.student_code:''}</span></div><small>{r.email||'Pas d’email'}</small><em className={r.status==='linked'?'ok':r.status==='invited'?'pending':''}>{r.status}</em></div>)}</div>:<Empty text="Aucun membre enregistré pour le moment."/>}
    </section>
  </>
}

export function DirectorPilotage({mode,session,data}:{mode:Mode,session:any,data:AppData}){
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

export function DirectorBilling({mode,data,session}:{mode:Mode,data:AppData,session:any}){
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

export function Payments({role,mode,data,session}:{role:Role,mode:Mode,data:AppData,session:any}){
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


export function Account({role,mode,data,session,theme,onThemeChange,onSaved}:{role:Role,mode:Mode,data:AppData,session:any,theme:Theme,onThemeChange:(theme:Theme)=>void,onSaved:(profile:Partial<Profile>)=>void}){
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

