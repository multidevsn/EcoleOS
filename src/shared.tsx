import React from 'react'

export type Mode='demo'|'live'
export const fr=(n:number,min=0,max=2)=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:min,maximumFractionDigits:max}).format(n)

export function Card({icon,title,value,meta,tone}:{icon:React.ReactNode,title:string,value:string,meta:string,tone?:'hl'|'red'}){return <div className={'card'+(tone?' '+tone:'')}><small>{icon}{title}</small><strong>{value}</strong><span>{meta}</span></div>}

export function shortMoney(n:number){return new Intl.NumberFormat('fr-FR').format(n)+' F'}

export function frToday(){const t=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());return t.charAt(0).toUpperCase()+t.slice(1)}

export function shortDate(d:string){const x=new Date(d.length===10?d+'T12:00:00':d);return isNaN(x.getTime())?d:new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(x)}

export function Empty({text}:{text:string}){return <div className="empty">{text}</div>}

export function KpiStrip({items}:{items:{label:string,value:string,meta?:string,icon:React.ReactNode}[]}){
  return <div className="grid stats ops-kpis">{items.map((x,i)=><Card key={i} icon={x.icon} title={x.label} value={x.value} meta={x.meta||''}/>)}</div>
}

export function MiniBar({value,max,label,meta}:{value:number;max:number;label:string;meta:string}){
  const pct=max>0?Math.min(100,Math.max(0,value/max*100)):0
  return <div className="ops-bar"><div className="ops-bar-head"><b>{label}</b><span>{meta}</span></div><div className="ops-bar-track"><i style={{width:`${pct}%`}}/></div></div>
}

export function saspaySleep(ms:number){return new Promise<void>(resolve=>{setTimeout(resolve,ms)})}
export async function saspaySandboxApprove(token:string,result:any){
  const res=await fetch('/api/saspay/sandbox/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({type:result.type,resource_id:result.resource_id,checkout_id:result.checkout_id,amount_xof:result.amount_xof})})
  const body=await res.json().catch(()=>null)
  if(!res.ok)throw new Error(body?.error||`HTTP ${res.status}`)
  return body
}
/** Parcours sandbox visible : push simulée, validation, puis confirmation serveur. */
export async function runSaspaySandbox(result:any,token:string,setMsg:(m:string)=>void){
  setMsg('Sandbox SasPay : push de paiement envoyée sur le téléphone…')
  await saspaySleep(900)
  setMsg('Sandbox SasPay : validation de la transaction…')
  await saspaySleep(900)
  await saspaySandboxApprove(token,result)
}
