# Quels services externes ScholaSync utilise-t-il, et lesquels supprimer ?

Réponse courte : **Resend et Twilio ne servaient à rien** (aucun email, aucun SMS n'est
envoyé par le produit) — ils sont supprimés. **Vercel Analytics / Speed Insights /
Web Analytics** étaient de la télémétrie pure et cassaient la console de l'APK — supprimés
aussi. **Supabase ne peut pas être supprimé** : c'est la base, l'authentification et les
droits. **Vercel** peut être remplacé, mais ce n'est pas gratuit en travail. **Wave et
Paddle font doublon** : gardez-en un.

---

## 1. Ce qui a été supprimé dans ce correctif

| Service | Ce qu'il faisait réellement | Verdict |
|---|---|---|
| **Resend** | `server/provider-costs.ts` lisait `GET /emails` (jusqu'à 1 000 pages d'historique) **uniquement pour estimer un coût**. Aucun email n'est envoyé par Resend. | **Supprimé.** Le seul email du produit passe par `admin.auth.admin.inviteUserByEmail()` (`api/members/provision.ts`), donc par le SMTP intégré de Supabase Auth. |
| **Twilio** | `syncTwilio()` lisait l'API Usage **uniquement pour estimer un coût**. Aucun SMS n'est envoyé. | **Supprimé.** |
| **Vercel Analytics** (`@vercel/analytics`) | Injectait `/ _vercel/insights/script.js`. Dans le WebView Android, le shell répondait `404` à `/_vercel/*` → erreur console à chaque lancement, aucune donnée récupérable. | **Supprimé** (dépendance retirée de `package.json`). |
| **Vercel Speed Insights** (`@vercel/speed-insights`) | Idem, pour les Core Web Vitals. | **Supprimé.** |
| **Vercel Web Analytics (lecture)** | `/api/admin/traffic` + le panneau « Trafic du site » de l'écran Ops interrogeaient `api.vercel.com/v1/query/web-analytics`. | **Supprimé.** Sans collecteur, le panneau n'aurait plus affiché que du vide. |
| **`src/lib/ownerTraffic.ts`** | Existait uniquement pour exclure vos propres visites des statistiques Vercel (`beforeSend`). | **Supprimé** avec Vercel Analytics. |
| **`src/lib/telemetry.ts`** | File d'attente d'événements vers `/api/metrics/event`. **Jamais importé par aucun fichier** — code mort. | **Supprimé.** |

Variables d'environnement devenues inutiles, à retirer de Vercel :

```
RESEND_API_KEY  RESEND_PLAN  RESEND_MONTHLY_USD  RESEND_INCLUDED_EMAILS  RESEND_OVERAGE_USD_PER_1000
TWILIO_ACCOUNT_SID  TWILIO_AUTH_TOKEN
VERCEL_API_TOKEN  VERCEL_PROJECT_ID  VERCEL_ANALYTICS_TEAM_ID
```

---

## 2. Ce qui reste, et pourquoi

### Supabase — **à garder, non remplaçable à court terme**

C'est le cœur : authentification, PostgreSQL, règles RLS, Realtime (messagerie),
fonctions `SECURITY DEFINER`, stockage des membres, notes, paiements, communauté.
Le retirer, c'est réécrire l'application.

Ce qui est *optionnel* dans Supabase :

- `SUPABASE_MGMT_TOKEN` / `SUPABASE_ORG_SLUG` / `SUPABASE_PROJECT_REFS` /
  `SUPABASE_PLAN_USD_MONTHLY` — ne servent qu'à l'estimation de coût de l'écran Ops.
  Sans elles, la ligne de coût affiche « non configuré » et rien ne casse.
- Le SMTP de Supabase Auth : gratuit en volume limité, avec une adresse d'envoi
  `noreply@mail.app.supabase.io`. Pour un vrai domaine d'envoi, c'est là (et seulement
  là) qu'un Resend/Postmark aurait un rôle.

### Vercel — **remplaçable, mais ce n'est pas anodin**

Vercel héberge le front **et** les 12 fonctions serverless de `api/` **et** les 3 crons
de `vercel.json`. Vous ne pouvez pas le retirer sans déplacer ces fonctions.

- **Garder Vercel** = zéro travail. Les variables `VERCEL_BILLING_TOKEN` / `VERCEL_TEAM_ID`
  ne servent qu'à l'estimation de coût (optionnel).
- **Passer aux Supabase Edge Functions** = supprimer un fournisseur et un coût, mais
  réécrire `api/*` en Deno, déplacer les 3 crons vers `pg_cron`, et rebrancher les
  webhooks Wave/Paddle. À faire seulement si la facture Vercel devient un sujet.
- `@vercel/node` reste en `devDependencies` : ce ne sont que des types TypeScript,
  aucune dépendance runtime.

### Wave **et** Paddle — **doublon, choisissez-en un**

| | Wave | Paddle |
|---|---|---|
| Usage actuel | Frais de scolarité, cantine, cycle d'usage | Abonnement récurrent du directeur |
| Moyen | Mobile money (Sénégal) | Carte bancaire |
| Routes | `/api/wave/checkout`, `/api/wave/webhook` | `/api/paddle/*` |

Deux fournisseurs de paiement, deux jeux de webhooks, deux réconciliations. C'est le
poste le plus coûteux à maintenir. Recommandation : **garder Wave** (vos clients sont au
Sénégal) et faire passer l'abonnement directeur par un cycle Wave comme le reste,
ou l'inverse — mais pas les deux.

### vite-plugin-pwa — **à garder, mais uniquement pour le web**

Désactivé en build Android (`disable: androidBuild` dans `vite.config.ts`). L'APK livré
dans `EcoleOS_android_security_fixes.7z` contenait pourtant `sw.js` et
`virtual_pwa-register-*.js` : il avait été construit avec `npm run build` au lieu de
`npm run build:android`. Le garde-fou ajouté dans `android/app/build.gradle` refuse
maintenant de compiler un APK à partir d'un bundle web.

---

## 3. Récapitulatif après nettoyage

**Services externes réellement appelés par le produit :**

1. **Supabase** — données, auth, RLS, Realtime (+ SMTP Auth pour les invitations)
2. **Vercel** — hébergement du front et des fonctions `api/`, crons
3. **Wave** — paiements mobile money
4. **Paddle** — abonnement récurrent *(doublon avec Wave)*

**Dépendances npm runtime restantes :**

```
@fontsource-variable/bricolage-grotesque  @fontsource/caveat   (polices auto-hébergées)
@supabase/supabase-js
lucide-react
react  react-dom
```

**Variables serveur encore lues :**

```
APP_URL  CRON_SECRET  PLATFORM_ADMIN_EMAILS  SECURITY_HASH_SALT
SUPABASE_URL  SUPABASE_PUBLISHABLE_KEY  SUPABASE_SECRET_KEY
WAVE_API_KEY  WAVE_WEBHOOK_SECRET
PADDLE_API_KEY  PADDLE_ENV  PADDLE_WEBHOOK_SECRET          (à retirer si Paddle est abandonné)
COST_USD_TO_XOF  COST_EUR_TO_XOF
VERCEL_BILLING_TOKEN  VERCEL_TEAM_ID                        (optionnel : estimation de coût)
SUPABASE_MGMT_TOKEN  SUPABASE_ORG_SLUG  SUPABASE_PROJECT_REF(S)  SUPABASE_PLAN_USD_MONTHLY
                                                            (optionnel : estimation de coût)
```

**Variables client (`VITE_*`) :**

```
VITE_SUPABASE_URL  VITE_SUPABASE_PUBLISHABLE_KEY
VITE_PLATFORM_ADMIN_EMAILS     (masque/affiche l'onglet Ops ; la vraie barrière est serveur)
VITE_PADDLE_CLIENT_TOKEN       (à retirer si Paddle est abandonné)
```
