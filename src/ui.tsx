import React from 'react'
import {ChevronRight} from 'lucide-react'
import {shortDate, Empty} from './shared'
import {money, orderLabels, Order} from './appModel'

export function Panel({title,children,action,onAction}:{title:string;children:React.ReactNode;action?:string;onAction?:()=>void}){
  return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action&&<button onClick={onAction}>{action}<ChevronRight size={16}/></button>}</div>{children}</section>
}

export function OrdersTable({orders}:{orders:Order[]}){
  return orders.length?<div>{orders.map(o=><div className="payment-row orders" key={o.id}><span>#{o.id.slice(0,8)}</span><b>{money(o.total_xof)}</b><small className={o.status==='paid'||o.status==='completed'?'ok':'pending'}>{orderLabels[o.status]||o.status}</small><small>{o.pickup_date?shortDate(o.pickup_date):'—'} · {o.pickup_slot||'—'}</small></div>)}</div>:<Empty text="Aucune commande"/>
}
