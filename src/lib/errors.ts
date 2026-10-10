/**
 * Traduction des erreurs techniques en messages compréhensibles.
 *
 * Règle du produit : un élève, un parent ou un directeur ne doit JAMAIS lire un message
 * de PostgreSQL, de PostgREST ou de Supabase Auth (« permission denied for table … »,
 * « new row violates row-level security policy … », « Invalid login credentials »).
 * Ces messages révèlent le schéma de la base et n'aident personne.
 *
 * `describeError()` renvoie donc deux choses :
 *  - `message`    : une phrase en français, sûre à afficher à tout le monde ;
 *  - `technical`  : le détail brut, conservé mais affiché uniquement aux administrateurs
 *                   de la plateforme (ou en développement) via <ErrorNotice/>.
 */

export type ErrorKind =
  | 'auth'
  | 'permission'
  | 'missing_schema'
  | 'network'
  | 'server'
  | 'validation'
  | 'stale_version'
  | 'unknown'

export type DescribedError = {
  /** Message affiché à l'utilisateur final. Toujours en français, jamais technique. */
  message: string
  /** Détail brut, réservé au support / aux administrateurs de la plateforme. */
  technical: string
  kind: ErrorKind
  /** Vrai quand l'erreur est probablement transitoire : afficher un bouton « Réessayer » a du sens. */
  retryable: boolean
}

const STALE_CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
const MISSING_SCHEMA = /does not exist|could not find the (?:table|function|column)|relation \"|PGRST205|PGRST202|42P01|42703|42883/i

type Rule = { match: RegExp; kind: ErrorKind; message: string; retryable?: boolean }

/**
 * Ordre important : les règles les plus précises d'abord.
 */
const RULES: Rule[] = [
  // --- Version de l'application obsolète après un déploiement ---
  { match: STALE_CHUNK, kind: 'stale_version', message: 'Une nouvelle version d’ScholaSync est disponible. Rechargez la page pour continuer.', retryable: true },

  // --- Réseau ---
  { match: /Failed to fetch|NetworkError when attempting to fetch|Load failed|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|net::/i, kind: 'network', message: 'Connexion Internet indisponible. Vérifiez votre réseau puis réessayez.', retryable: true },
  { match: /timeout|timed out|AbortError/i, kind: 'network', message: 'Le serveur met trop de temps à répondre. Vérifiez votre connexion puis réessayez.', retryable: true },

  // --- Authentification Supabase ---
  { match: /Invalid login credentials/i, kind: 'auth', message: 'Email ou mot de passe incorrect.' },
  { match: /Email not confirmed/i, kind: 'auth', message: 'Votre adresse email n’est pas encore confirmée. Consultez votre boîte de réception.' },
  { match: /User already registered|already been registered/i, kind: 'auth', message: 'Un compte existe déjà avec cette adresse email.' },
  { match: /User not found/i, kind: 'auth', message: 'Aucun compte ne correspond à cette adresse email.' },
  { match: /New password should be different/i, kind: 'auth', message: 'Choisissez un mot de passe différent de l’actuel.' },
  { match: /Password should be at least|password.*too short/i, kind: 'auth', message: 'Le mot de passe est trop court pour être accepté.' },
  { match: /Auth session missing|Session expired|refresh_token_not_found|JWT expired|token has expired/i, kind: 'auth', message: 'Votre session a expiré. Reconnectez-vous pour continuer.', retryable: true },
  { match: /rate limit|too many requests|For security purposes, you can only request/i, kind: 'auth', message: 'Trop de tentatives ont été effectuées. Patientez quelques minutes puis réessayez.', retryable: true },
  { match: /Email rate limit/i, kind: 'auth', message: 'Trop d’emails ont été envoyés récemment. Réessayez dans quelques minutes.', retryable: true },

  // --- Droits / RLS ---
  { match: /row-level security|row level security|permission denied|access denied|unauthorized|JWT claims|new row violates/i, kind: 'permission', message: 'Votre compte n’a pas le droit d’accéder à cette information. Si vous pensez que c’est une erreur, contactez l’administration de votre établissement.' },

  // --- Schéma / migrations non appliquées : cas très fréquent en démo ou après un import partiel ---
  { match: MISSING_SCHEMA, kind: 'missing_schema', message: 'Cette fonctionnalité n’est pas encore activée sur ce serveur. L’administrateur doit appliquer la migration de base de données correspondante.', retryable: true },

  // --- Contraintes ---
  { match: /duplicate key value|unique constraint|23505/i, kind: 'validation', message: 'Cet élément existe déjà.' },
  { match: /null value in column|not-null constraint|23502/i, kind: 'validation', message: 'Certaines informations obligatoires sont manquantes.' },
  { match: /value too long|22001/i, kind: 'validation', message: 'Le texte saisi est trop long.' },
  { match: /invalid input syntax|22P02/i, kind: 'validation', message: 'Le format d’une information saisie n’est pas reconnu.' },

  // --- Serveur ---
  { match: /\b50[0-9]\b|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout/i, kind: 'server', message: 'Le serveur ScholaSync rencontre un problème. Réessayez dans un instant.', retryable: true },
  { match: /\b404\b|Not Found/i, kind: 'server', message: 'Ce service est introuvable sur le serveur. Vérifiez que le déploiement est à jour.', retryable: true },
  { match: /\b(401|403)\b/i, kind: 'permission', message: 'Accès refusé. Reconnectez-vous si nécessaire.' },
]

function rawMessage(error: unknown): string {
  if (error == null) return ''
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || String(error)
  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; error_description?: unknown; details?: unknown; hint?: unknown; error?: unknown }
    const parts = [candidate.message, candidate.error_description, candidate.details, candidate.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    if (parts.length) return parts.join(' — ')
    if (typeof candidate.error === 'string') return candidate.error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Distinguishes missing database objects from network and permission failures for safe fallbacks. */
export function isMissingSchemaError(error: unknown): boolean {
  return MISSING_SCHEMA.test(rawMessage(error))
}

const GENERIC: Record<ErrorKind, string> = {
  auth: 'L’authentification a échoué. Réessayez.',
  permission: 'Cette action n’est pas autorisée pour votre compte.',
  missing_schema: 'Ce service n’est pas encore activé sur ce serveur.',
  network: 'Connexion impossible avec le serveur ScholaSync.',
  server: 'Le serveur ScholaSync rencontre un problème. Réessayez dans un instant.',
  validation: 'Les informations saisies ne sont pas acceptées.',
  stale_version: 'Une nouvelle version d’ScholaSync est disponible. Rechargez la page.',
  unknown: 'Une erreur est survenue. Réessayez, et prévenez l’administration si le problème persiste.',
}

/**
 * Marques qui trahissent un message technique : schéma SQL, code d'erreur Postgres,
 * stack trace, chemin de fichier, en-tête HTTP brut… Un message qui n'en contient aucune
 * et qui ressemble à une phrase peut être montré tel quel — c'est le cas des messages déjà
 * rédigés par nos propres routes `/api/*` (« Code de parrainage invalide. »).
 */
const TECHNICAL_MARKERS =
  /relation "|row-level|row level|permission denied|schema cache|constraint|violates|JWT |token |PGRST\d|^\d{5}$|\b42\d{3}\b|\b2350\d\b|\b2202\d\b|\bat [A-Za-z0-9_$.]+ \([^)]*:\d+:\d+\)|\bat \/?[A-Za-z0-9_.-]+\.(?:ts|tsx|js|jsx|mjs)\b|^\s*at\s|HTTP \d{3}|undefined|null is not|TypeError|ReferenceError|SyntaxError|fetch failed|ECONN|ENOTFOUND|::|\{\s*"|supabase|postgrest|postgres/i

function looksSafeToDisplay(raw: string): boolean {
  const text = raw.trim()
  if (!text || text.length > 200) return false
  if (TECHNICAL_MARKERS.test(text)) return false
  // Une phrase destinée à un humain commence par une majuscule et ne ressemble pas à un identifiant.
  if (!/^[A-ZÀ-Ý0-9«(]/.test(text)) return false
  return true
}

/**
 * Convertit n'importe quelle erreur (Supabase, fetch, JSON, JS) en message présentable.
 * `fallback` remplace le message générique quand l'appel a un contexte métier précis.
 */
export function describeError(error: unknown, fallback?: string): DescribedError {
  const technical = rawMessage(error).slice(0, 600)
  const rule = RULES.find(candidate => candidate.match.test(technical))
  const kind: ErrorKind = rule?.kind ?? 'unknown'
  // Priorité : règle reconnue > message déjà rédigé et sûr (nos routes API) > repli métier > générique.
  const message = rule?.message
    ?? (looksSafeToDisplay(technical) ? technical : undefined)
    ?? fallback
    ?? GENERIC[kind]
  return {
    message,
    technical,
    kind,
    retryable: rule?.retryable ?? false,
  }
}

/** Version courte, pour les `setState(string)` déjà en place dans les écrans. */
export function errorMessage(error: unknown, fallback?: string): string {
  return describeError(error, fallback).message
}

/** Vrai si l'erreur vient d'un chunk obsolète : un rechargement suffit. */
export function isStaleChunkError(error: unknown): boolean {
  return describeError(error).kind === 'stale_version'
}

/**
 * Les détails techniques ne sont visibles que par les administrateurs de la plateforme
 * (et en développement). L'application positionne ce drapeau à la connexion ; les écrans
 * n'ont donc pas besoin de se le transmettre de prop en prop.
 */
let technicalErrorsVisible = false
export function setTechnicalErrorsVisible(value: boolean): void {
  technicalErrorsVisible = value
}
export function canSeeTechnicalErrors(): boolean {
  return technicalErrorsVisible || import.meta.env.DEV
}
