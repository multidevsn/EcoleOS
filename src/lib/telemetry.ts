import {supabase} from './supabase'

type UsageMetadata=Record<string,unknown>
type QueuedEvent={metric:string,quantity:number,metadata:UsageMetadata}

// File d'attente en mémoire : les événements s'accumulent ici au lieu de partir un par un.
// Un seul appel réseau les envoie groupés, ce qui réduit directement le nombre d'invocations
// de la fonction serverless /api/metrics/event sur Vercel, sans perdre un seul événement.
const queue:QueuedEvent[]=[]
let flushTimer:ReturnType<typeof setTimeout>|null=null
const FLUSH_DELAY_MS=15000  // regroupe les événements sur 15s avant envoi
const MAX_QUEUE=50          // doit rester égal à la limite acceptée par le serveur (voir api/metrics/_event.ts)

async function sendBatch(events:QueuedEvent[]){
  if(!events.length)return
  try{
    const {data:{session}}=await supabase.auth.getSession()
    if(!session?.user?.id)return
    const send=(keepalive:boolean)=>fetch('/api/metrics/event',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({events}),
      keepalive, // permet à la requête de survivre à une fermeture d'onglet (fermeture, changement de page)
    })
    await send(true)
  }catch{
    // La télémétrie ne doit jamais bloquer ni perturber le produit.
  }
}

function scheduleFlush(){
  if(flushTimer)return
  flushTimer=setTimeout(()=>{
    flushTimer=null
    const batch=queue.splice(0,queue.length)
    void sendBatch(batch)
  },FLUSH_DELAY_MS)
}

export function trackUsage(metric:string,quantity=1,metadata:UsageMetadata={}){
  queue.push({metric,quantity,metadata})
  if(queue.length>=MAX_QUEUE){
    if(flushTimer){clearTimeout(flushTimer);flushTimer=null}
    const batch=queue.splice(0,queue.length)
    void sendBatch(batch)
    return
  }
  scheduleFlush()
}

// Envoie immédiatement ce qui reste en attente. À appeler quand la page se ferme ou passe en arrière-plan,
// pour ne pas perdre les derniers événements accumulés depuis le dernier envoi groupé.
export function flushUsageQueue(){
  if(!queue.length)return
  if(flushTimer){clearTimeout(flushTimer);flushTimer=null}
  const batch=queue.splice(0,queue.length)
  void sendBatch(batch)
}

if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushUsageQueue()})
  window.addEventListener('pagehide',flushUsageQueue)
}
