import React from 'react'
import {AlertTriangle, ChevronRight, RefreshCw} from 'lucide-react'
import {shortDate, Empty} from './shared'
import {money, orderLabels, Order} from './appModel'
import {canSeeTechnicalErrors, describeError} from './lib/errors'

export function Panel({title,children,action,onAction}:{title:string;children:React.ReactNode;action?:string;onAction?:()=>void}){
  return <section className="panel"><div className="panel-head"><h3>{title}</h3>{action&&<button onClick={onAction}>{action}<ChevronRight size={16}/></button>}</div>{children}</section>
}

export function OrdersTable({orders}:{orders:Order[]}){
  return orders.length?<div>{orders.map(o=><div className="payment-row orders" key={o.id}><span>#{o.id.slice(0,8)}</span><b>{money(o.total_xof)}</b><small className={o.status==='paid'||o.status==='completed'?'ok':'pending'}>{orderLabels[o.status]||o.status}</small><small>{o.pickup_date?shortDate(o.pickup_date):'—'} · {o.pickup_slot||'—'}</small></div>)}</div>:<Empty text="Aucune commande"/>
}

/**
 * Affichage unique d'une erreur, utilisé partout dans l'application.
 *
 * L'utilisateur final voit une phrase claire et, si l'erreur est probablement transitoire,
 * un bouton « Réessayer ». Le détail technique (message Postgres, PostgREST, Auth) n'apparaît
 * que derrière un repli, et uniquement pour les administrateurs de la plateforme.
 */
export function ErrorNotice({error,fallback,onRetry,variant='error',className}:{
  error:unknown
  fallback?:string
  onRetry?:()=>void
  variant?:'error'|'notice'
  className?:string
}){
  if(!error)return null
  const described=describeError(error,fallback)
  const showTechnical=canSeeTechnicalErrors()&&described.technical.length>0
  return <div className={'alert '+(variant==='error'?'error':'')+(className?' '+className:'')} role={variant==='error'?'alert':undefined}>
    <div className="alert-body">
      <AlertTriangle size={17} aria-hidden="true"/>
      <span>{described.message}</span>
    </div>
    {onRetry&&described.retryable&&<button type="button" className="alert-retry" onClick={onRetry}><RefreshCw size={14}/>Réessayer</button>}
    {showTechnical&&<details className="alert-technical"><summary>Détails techniques</summary><code>{described.technical}</code><small>Catégorie : {described.kind}</small></details>}
  </div>
}
