// Exclusion de ses propres visites des statistiques Vercel (Web Analytics + Speed Insights).
// Vercel n'enregistre pas les adresses IP : un filtre par IP n'existe pas. Le seul levier officiel est
// `beforeSend`, qui doit répondre de façon SYNCHRONE. On s'appuie donc sur une marque locale à l'appareil,
// écrite une fois quand le serveur confirme que le compte est administrateur de la plateforme.
// Ce n'est pas un mécanisme de sécurité : il n'agit que sur les statistiques de l'appareil concerné.

const KEY = 'va-disable' // clé documentée par Vercel pour l'opt-out

export function isOwnerDevice(): boolean {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

export function setOwnerDevice(on: boolean): void {
  try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* stockage bloqué : la visite sera comptée */ }
}

// Pour un appareil ou une fenêtre privée où tu n'es pas connecté en admin :
// ouvre l'adresse du site avec ?notrack=1 (exclure) ou ?notrack=0 (recompter).
// À appeler AVANT le rendu React, pour que la toute première visite soit déjà prise en compte.
export function applyOwnerParam(): void {
  try {
    const url = new URL(window.location.href)
    const value = url.searchParams.get('notrack')
    if (value === null) return
    if (value === '1' || value === 'on') setOwnerDevice(true)
    if (value === '0' || value === 'off') setOwnerDevice(false)
    url.searchParams.delete('notrack') // le paramètre ne doit pas voyager dans un lien partagé
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch { /* ignore */ }
}

// Retourne null pour annuler l'envoi de l'événement. Par défaut (stockage illisible), la visite est comptée.
export function skipOwnerVisits<T>(event: T): T | null {
  return isOwnerDevice() ? null : event
}
