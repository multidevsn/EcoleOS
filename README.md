# École OS — V1 multi-utilisateurs

V1 React/Vite reliée à Supabase/PostgreSQL avec mode démo, authentification réelle, permissions par rôle et préparation de l’intégration Wave côté serveur.

## Démarrer en local

```bash
npm install
npm run dev
```

`.env.local` contient l’URL Supabase et la clé publishable du projet de test. Aucune clé secrète Supabase/Wave ne doit être placée dans une variable `VITE_*`.

## Comptes démo

La page de connexion propose 6 tuiles de démo : un clic ouvre l'espace du rôle, **sans compte Auth**, en lisant les tables `demo_*` (lecture seule). Saisir à la main les identifiants ci-dessous ouvre aussi la démo. Exécutez `supabase/demo-anon-fix.sql` pour que les récompenses s'affichent en démo.

| Rôle | Email | Mot de passe |
|---|---|---|
| Élève | `eleve@demo.ecole-os.local` | `demo1234` |
| Parent | `parent@demo.ecole-os.local` | `demo1234` |
| Professeur | `prof@demo.ecole-os.local` | `demo1234` |
| Administration | `admin@demo.ecole-os.local` | `demo1234` |
| Directeur | `directeur@demo.ecole-os.local` | `demo1234` |
| Cantine | `cantine@demo.ecole-os.local` | `demo1234` |

Un compte démo ne permet pas de modifier les données métier. « Changer de compte » revient à l’écran de connexion et n’expose pas un sélecteur de rôle dans l’application.

## Compte réel de test V1

Le compte Auth déjà présent dans le projet de test est configuré comme **Élève**. Le script `supabase/live-account-seed.sql` rattache des données réelles à son UUID : classe, matières, emploi du temps, notes, paiements, points, commande Food et lignes de commande.

L’application ne fait plus confiance à `app_metadata.role` pour choisir les données métier : elle lit le rôle depuis `public.profiles`, puis charge les données correspondantes.

## Agora + Impact

La version v2 ajoute une section **Agora** : idées proposées par les membres, votes, sondages actifs et feuille de route. Une idée envoyée vaut +10 Impact et une participation communautaire utile vaut +2 Impact. Le système ne classe pas les personnes entre elles : il suit la contribution de chaque compte.

L'onglet **Impact** est disponible pour tous les rôles (élève, parent, professeur, administration, directeur et cantine). Les récompenses peuvent être universelles ou ciblées par rôle ; le catalogue inclut notamment une récompense de réduction d'abonnement pour le directeur. Les échanges réels passent par `redeem_reward` côté Supabase.

L'onglet **Mon compte → Apparence** propose trois ambiances très légères — Cahier, Épuré, Brume — sans modifier la structure de navigation.

Migration à appliquer : `supabase/migrations/20260925_agora_impact.sql`.

## Mon compte

Chaque rôle dispose maintenant d’une section **Mon compte**. Elle affiche l’identité, l’email Auth, le rôle, le code élève, la classe, l’établissement lorsqu’il est rattaché, ainsi qu’un résumé des données déjà présentes dans PostgreSQL.

Sur un compte réel, le nom complet peut être modifié et le mot de passe peut être mis à jour via Supabase Auth. En mode démo, la page reste en lecture seule.

## Permissions par rôle

La navigation est filtrée côté interface et les principales actions sensibles sont protégées côté Supabase.

- Élève / Parent : Accueil, Food, Emploi du temps, Notes, Paiements, Points, Mon compte.
- Professeur : Accueil, Emploi du temps, Notes, Mon compte.
- Administration : Accueil, Food (gestion), Emploi du temps, Notes, Paiements, Mon compte.
- Directeur : Accueil, Paiements / abonnement, Mon compte.
- Cantine : Accueil, Food (gestion), Mon compte.

Dans Food, seuls `admin` et `cafeteria` peuvent gérer le menu et voir les commandes globales. Les élèves et parents ne voient que leur espace de commande.

## Correctif `permission denied for function is_food_staff`

Les fonctions internes `private.is_food_staff()`, `private.is_staff()` et `private.is_parent_of(uuid)` ont été sécurisées avec `search_path=''`, puis leur usage du schéma `private` et leur exécution pour `authenticated` ont été explicitement accordés. La politique Food peut donc évaluer les droits d’un utilisateur authentifié sans provoquer l’erreur de permission.

`profiles_self_update` permet aussi à un utilisateur de modifier uniquement son propre profil. Les privilèges de colonne empêchent le navigateur de modifier `role`, `school_id` ou `student_code` via l’API Data.

## Inscription d’une école

Un directeur peut créer son compte, saisir son école et sa ville, choisir Simple ou Extra et utiliser un code de parrainage. `/api/onboarding/school` prépare l’école, l’abonnement et le parrainage.

## Plans de test

- Simple : 5 000 FCFA/mois, fonctionnalités essentielles.
- Extra : 10 000 FCFA/mois, fonctions avancées et sans publicité.

Les montants restent configurables dans `subscription_plans`.

## Wave

Routes serveur prévues :

- `/api/wave/checkout`
- `/api/wave/webhook`

Variables Vercel : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET`, `APP_URL`.

Le paiement doit être confirmé côté serveur via webhook et non simplement à partir de l’URL de retour.

## Base Supabase

Scripts utiles :

- `supabase/schema.sql`
- `supabase/multiuser-patch.sql`
- `supabase/demo.sql`
- `supabase/schools-billing-referrals.sql`
- `supabase/role-permissions.sql`
- `supabase/live-account-seed.sql`
- `supabase/migrations/20261008_food_catalog_bootstrap.sql` — répare le catalogue Food, ses règles de lecture et les plats de démonstration.

Pour corriger un serveur qui affiche « Cette fonctionnalité n’est pas encore activée » dans Food, exécutez cette migration dans le SQL Editor Supabase. Le mode démo utilise désormais un petit menu local si le catalogue ou l’historique de démo manque, sans bloquer l’interface.

RLS est activé sur les tables exposées. Les vues de dashboard utilisent `security_invoker=true`.

## Design (v2)

Identité « cahier d'écolier » : feuille Seyès, marge rouge, encre bleue, stylo rouge, surligneur. Une seule feuille de style (`src/styles.css`), polices auto-hébergées (Bricolage Grotesque, Caveat). Un `ErrorBoundary` évite les pages blanches.

Règle React à respecter dans `App` : tous les hooks avant les `return` anticipés (sinon page blanche après connexion).

## 2026-09-26 — AutoPilot billing & dashboards

### New migration
Apply `supabase/migrations/20260926_autopilot_billing.sql` after the previous migrations.

### Required environment
- `PLATFORM_ADMIN_EMAILS` — comma-separated platform-owner emails allowed to open **Ops & Autopilot**.
- `CRON_SECRET` — already used for protected scheduled server jobs; required by `/api/billing/autopilot`.
- Existing Supabase and Wave secrets remain server-only.

### New server endpoints
- `GET /api/admin/tech` — technical control plane for the platform owner.
- `GET /api/director/stats` — per-school statistical dashboard for directors.
- `GET|POST /api/billing/autopilot` — scheduled billing/usage recalculation.

### Billing model
Each school receives a monthly billing cycle. The cycle adapts to active-user mass and configurable overage rules. Platform service cost rules are stored in `platform_service_cost_rules`, so concrete provider costs can be changed without rewriting the frontend.

Wave currently uses Checkout Sessions + webhooks in this project. The autopilot can prepare the invoice/cycle and the Wave checkout automatically, but it does **not** silently debit a customer without a supported recurring mandate. A future mandate-capable provider can be plugged into the same cycle model.

## 2026-09-26 — Messagerie / Communauté sereine

La v2 ajoute l'onglet **Communauté** pour remplacer la dispersion entre groupes de messagerie :
- espace **Annonces de l'établissement** : messages du personnel autorisé (administration, direction, professeurs) ;
- espace **Communauté École OS** : échanges utiles entre membres d'une même école ;
- lecture en temps réel via Supabase Realtime ;
- compteur de lecture par espace côté base ;
- limitation des messages à 2 000 caractères ;
- signalement d'un message sans casser le fil ;
- RLS + fonctions `SECURITY DEFINER` pour contrôler les envois ;
- mode démo avec stockage local pour essayer l'expérience sans backend.

Migration : `supabase/migrations/20260926_community_messaging.sql`.

Le parti-pris UX est volontairement calme : pas de flux infini, pas de classement social, pas de pluie de notifications. Les annonces restent séparées de la conversation générale.

## 2026-10-07 — Correctifs APK, erreurs, rôle directeur, services

Six problèmes remontés ont été corrigés. Le détail du nettoyage des services est dans
[`SERVICES.md`](SERVICES.md).

### 1. L'APK affichait une page blanche en mode connecté

`MainActivity.getTrustedServerOrigin()` « obfusquait » l'adresse du serveur par XOR.
La table d'octets était corrompue : elle se décodait en `httpw8//egole-ow.vefgel.app`
au lieu de `https://ecole-os.vercel.app`. WebView refusait cette base URL invalide et
n'affichait rien — tandis que le mode démo, lui, utilisait une URL valide
(`https://demo.ecole-os.invalid`) : d'où le symptôme « la démo marche, la connexion non ».

- L'origine est maintenant une constante lisible, injectée au build
  (`./gradlew assembleRelease -PecoleosServerOrigin=https://mon-ecole.vercel.app`).
- `normalizeOrigin()` valide le schéma, l'hôte, l'absence de chemin ; une origine
  invalide affiche un écran natif explicite au lieu d'un WebView vide.
- `onReceivedError` / `onReceivedHttpError` / `onReceivedSslError` affichent cet écran
  natif avec un bouton « Réessayer » (avant : un simple Toast, page blanche).
- `onProgressChanged` affiche la progression dans la barre du haut.
- Le WebView est désormais détruit dans `onDestroy()` (fuite de l'activité entière).
- L'APK livré contenait un build **web** (`sw.js`, `workbox-*`, `virtual_pwa-register-*`)
  au lieu d'un build Android. `syncWebAssets` refuse maintenant de compiler dans ce cas.

### 2. Chargements trop longs

- Toutes les requêtes Supabase passent par un `fetch` borné à 20 s (`src/lib/net.ts`) :
  plus d'écran figé sur « Chargement… » sans fin ni erreur.
- Une section d'accueil en échec n'annule plus les autres (`track()` capture l'erreur au
  lieu de la propager) ; l'accueil reste utilisable.
- Vercel Analytics et Speed Insights ne sont plus chargés ni exécutés.
- L'effet de chargement par onglet ne se relance plus à chaque publication de données
  (il dépendait de l'identité du tableau `homePending`).
- CSS réduit de 69,1 Ko à 59,6 Ko (137 règles mortes supprimées).

### 3. Gestion des erreurs

Les messages bruts de PostgreSQL, PostgREST et Supabase Auth étaient affichés tels quels
à tous les utilisateurs (`{data.error&&<div className="alert error">{data.error}</div>}`,
`<pre>{this.state.error.message}</pre>` dans l'ErrorBoundary, `setMsg(error.message)` dans
l'inscription).

- `src/lib/errors.ts` traduit toute erreur en phrase française non technique et conserve
  le détail brut séparément.
- `<ErrorNotice/>` (`src/ui.tsx`) est l'affichage unique : message clair, bouton
  « Réessayer » quand l'erreur est transitoire, et détail technique **uniquement** pour les
  administrateurs de la plateforme (ou en développement).
- Tous les `setError(e?.message)` / `setMsg(error.message)` ont été remplacés.

### 4. Un directeur qui inscrit son école n'est plus créé « Élève »

`handle_new_user()` créait toujours le profil avec le rôle par défaut `student` ; la
promotion en `director` dépendait de la réussite de `/api/onboarding/school`, repoussée à
la première connexion quand la confirmation d'email est activée. Tout échec laissait le
directeur définitivement Élève.

- `signUp` transmet `role: 'director'`, et `handle_new_user()` l'honore — pour `director`
  uniquement, seul rôle accessible par auto-inscription.
- La demande d'école est enregistrée **avant** l'inscription et conservée jusqu'à ce que la
  finalisation ait réellement réussi (elle est rejouée à la connexion suivante).
- `create_school_onboarding()` répare un profil désaligné au lieu de lever
  `ONBOARDING_INCOMPLETE`, et renvoie `repaired` / `role`.
- Après une inscription réussie, l'application ouvre directement l'espace Directeur.

Migration : `supabase/migrations/20261007_director_role_fix.sql` (elle réaligne aussi les
comptes déjà créés).

### 5. Mon compte et Communauté ramenés au socle SLC

- **Mon compte** : suppression de la grille de 4 compteurs (Notes / Cours / Paiements /
  Commandes — déjà sur l'accueil), du bloc « Session sécurisée », de l'encart « À savoir »
  et des champs en lecture seule dispersés. Il reste : identité, rattachements compacts,
  mot de passe, apparence.
- **Communauté** : suppression du bloc explicatif « Un espace = un contexte », du champ de
  recherche (inutile avec 3 espaces), de la note de bas de liste, du bandeau de statut, de
  la détection d'intention « vous semblez proposer une amélioration » et de son bouton
  « Ajouter à Evolution » (l'onglet Agora existe déjà), et de la mention légale sous le
  champ de saisie. Il reste : la liste des espaces, le fil, le signalement, la composition.
- 137 règles CSS mortes supprimées au passage (messagerie v1, panneaux retirés).

### 6. La barre latérale bleue était coupée

`.sidebar` est en `position:fixed` sur toute la hauteur de l'écran, sans zone de défilement
interne : tout ce qui dépassait (onglet « Mon compte », « Se déconnecter ») sortait de
l'écran et devenait inaccessible, puisque la page principale ne fait pas défiler un élément
fixe. La barre défile maintenant verticalement, et un palier `max-height:760px` resserre
les espacements sur les écrans courts.

### 7. Services supprimés

Resend, Twilio, Vercel Analytics, Vercel Speed Insights, la lecture Vercel Web Analytics,
et deux modules morts (`src/lib/telemetry.ts`, `src/lib/ownerTraffic.ts`).
Détail et variables à retirer : [`SERVICES.md`](SERVICES.md).

### À traiter séparément

`keyPublish/keyPath` (un keystore PKCS#12 de 2 676 octets) et `keyPublish/2Password.txt`
(son mot de passe, en clair) sont **committés dans ce dépôt**. C'est la clé de signature de
l'application. `android/RELEASE_SIGNING.md` dit explicitement qu'elle ne doit exister que
sur votre machine. À faire : sortir ces fichiers du dépôt, purger l'historique Git, et
générer une nouvelle clé — toute clé déjà poussée sur un dépôt public doit être considérée
comme compromise. `.gitignore` couvre désormais `keyPublish/`, mais cela n'efface pas
l'historique.
