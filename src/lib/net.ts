/**
 * Utilitaires réseau partagés.
 *
 * Ce module n'importe volontairement aucune dépendance lourde : il reste dans le chunk
 * principal pendant que `@supabase/supabase-js` reste chargé à la demande.
 */

export const DEFAULT_TIMEOUT_MS = 20_000

/** `fetch` avec un délai maximal. Lève une `Error('timeout: …')` quand le délai est dépassé. */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  const signal = init?.signal
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

/** Encadre une promesse quelconque par un délai. */
export function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS, label = 'operation'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), timeoutMs)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

/**
 * Appelle une route `/api/...` et renvoie toujours un objet, avec un message d'erreur déjà
 * présentable. Évite les `res.json()` non protégés qui produisaient des erreurs JSON brutes.
 */
export async function apiRequest<T = any>(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<{ ok: boolean; status: number; data: T | null; error: unknown }> {
  try {
    const response = await fetchWithTimeout(path, init, timeoutMs)
    const text = await response.text()
    let data: T | null = null
    if (text) {
      try { data = JSON.parse(text) as T } catch { data = null }
    }
    if (response.ok) return { ok: true, status: response.status, data, error: null }
    const message = data && typeof (data as any).error === 'string' ? (data as any).error : `HTTP ${response.status}`
    return { ok: false, status: response.status, data, error: new Error(message) }
  } catch (error) {
    return { ok: false, status: 0, data: null, error }
  }
}
