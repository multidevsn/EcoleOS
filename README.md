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

### Resend
Le serveur lit `RESEND_API_KEY` uniquement côté serveur, notamment pour la synchronisation des coûts Resend. La clé réelle est stockée localement dans `.env.local` (ignoré par Git) et **n'est pas embarquée dans le ZIP distribué**. Pour Vercel, elle doit être ajoutée comme variable d'environnement serveur.
