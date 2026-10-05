# École OS — optimisation de chargement

## Changements appliqués

- Découpage du gros `src/main.tsx` en écrans chargés à la demande avec `React.lazy`.
- Le premier écran conserve uniquement le shell + Accueil ; les écrans secondaires sont téléchargés lors de leur ouverture.
- Le chargement initial Supabase a été parallélisé avec `Promise.all` pour éviter la chaîne de requêtes séquentielles.
- `food_items` et `rewards` ne sont plus chargés au démarrage : ils sont hydratés à la première ouverture de leur onglet.
- Suppression de l'appel client systématique à `/api/admin/tech` pour afficher ou masquer Ops. La sécurité serveur reste en place ; la variable `VITE_PLATFORM_ADMIN_EMAILS` ne sert qu'à l'affichage client.
- Suppression des appels de télémétrie `page_view` maison : la navigation n'a pas besoin d'une Function Vercel par vue et Vercel Analytics gère déjà les page views.
- Vérification PWA espacée à 15 minutes et suppression du double `fetch(service-worker)+update()`.
- Découpage Rollup pour React et Supabase ; CSS séparé.
- Correction des libellés internes `Impact` visibles en faveur de `Points` / `Récompenses`.
- Le correctif Supabase pour `private.is_staff()` reste présent dans `20260927_security_hardening.sql`.

## Vérification locale (mise à jour 2026-10-04)

Le problème historique d'installation partielle est résolu. Après une installation propre, `npm run build` passe en local, avec vérification TypeScript du frontend et des API. Contrôler encore les journaux Vercel et les métriques réelles après déploiement en staging.

## Vercel — navigation et événements

La navigation entre onglets est principalement côté client : elle ne consomme pas à elle seule une Vercel Function. Les fonctionnalités qui appellent `/api/*` consomment en revanche des invocations de Functions.

Les événements Analytics ne sont pas un compteur de navigation de l'application. Leur épuisement affecte la collecte / facturation Analytics, pas le routage React.

Les 3 Cron Jobs actuels (`provider-costs`, `rollup`, `autopilot`) sont très en dessous de la limite actuelle de 100 Cron Jobs par projet.

## Build fix + second-pass performance correction (2026-10-03)

### Build fixes
- Moved shared `IdeaStatus` labels/classes and demo Agora seeds into `src/appModel.ts` so the lazy engagement module can import them without undefined module scope errors.
- Added the missing `roleLabel` and `IdeaStatus` imports in `src/screens-core.tsx`.
- Added the missing `Reward` and shared demo seed/status imports in `src/screens-engagement.tsx`.
- Removed duplicated local seed/status declarations from `src/screens-core.tsx`.

### Runtime/loading correction
- The initial data loader previously depended on the whole `role` state plus the complete `session` object. When the live profile returned its role, this could trigger a second complete `fetchLiveData()` pass. The loader now keys off `mode` + authenticated user id, avoiding that duplicate initial fetch.
- Food/Rewards tab hydration no longer flips the global `data.loading` flag. This prevents the whole application shell from disappearing while a secondary tab fetch is running; only the target tab shows its fallback.
- Hydration state is reset when the authenticated user/mode changes, preventing stale per-tab hydration flags from leaking between users.

### Vercel events
- Normal navigation is client-side React navigation and does not inherently require a Vercel Function invocation per click.
- The project also contains a legacy `src/lib/telemetry.ts` + `/api/metrics/event` batching path, but it is not imported by the current client. It therefore does not generate calls in the current code path.
- Vercel Web Analytics is separate from application navigation. Current pricing includes Web Analytics events in the platform quota/usage model; exhausting Web Analytics events affects analytics collection/billing, not static page delivery itself.

## Optimisation V3 — bootstrap et Supabase
- Le client Supabase n'est plus importé statiquement par `main.tsx` : chargement dynamique après le premier rendu / seulement en live.
- Le mode démo n'initialise plus Supabase Auth au démarrage.
- Le bootstrap live ne récupère plus les tables inutiles pour le rôle courant.
- `subjects` et `classes` sont récupérées via les relations PostgREST dans les requêtes grades/planning au lieu de requêtes séparées.
- L'accueil utilise un aperçu : planning du jour, commandes du jour, derniers éléments nécessaires.
- Notes / Emploi du temps / Paiements sont hydrates à l'ouverture de leur onglet et leurs écrans affichent un skeleton pendant la récupération.
- Food et Récompenses restent chargés à la demande.
- Les historiques détaillés sont plafonnés à 500 lignes pour éviter les payloads massifs ; pour une très grande école, la prochaine étape est la pagination `range()`.
- Ajout de `performance.mark/measure` autour du chargement de données (`eos:data-load`) pour mesurer le gain sur le déploiement réel.

## Passe mesurée — 2026-10-04

- L'onglet Notes des élèves/parents réutilise les 500 notes déjà chargées pour l'accueil au lieu de refaire la même requête.
- Les statistiques indépendantes du tableau directeur sont chargées en parallèle après le contrôle d'accès.
- Une conversation charge maintenant les 80 messages les plus récents, puis les remet dans l'ordre chronologique.
- Les polices sont limitées aux sous-ensembles Latin/Latin-ext nécessaires au français. Le précache PWA est passé de 1 047,43 KiB à 780,73 KiB dans les deux compilations locales ; le CSS de 14,26 à 13,98 KiB gzip. Le JS d'entrée reste à 278,39 KiB (86,15 KiB gzip), et Supabase est dans un chunk distinct.
- Vérification : `npm run build` passe, TypeScript frontend et API compris.
- Limite : aucune mesure RUM/Lighthouse représentative n'est disponible ici ; vérifier LCP/INP/CLS et les temps Supabase sur staging avant d'optimiser davantage.
- Agora charge maintenant les idées et sondages par pages de 40, avec tri stable et boutons de continuation ; le contrôle des votes ne cherche que les idées visibles. L'ajout d'une idée relit uniquement la ligne créée.
- Le tableau technique ne lit plus l'historique complet `school_subscriptions`, qui n'était pas affiché. Il conserve les cycles du mois nécessaires aux KPI.
- La répartition des réponses aux sondages lit encore toutes les réponses des sondages chargés. La vraie optimisation est une fonction SQL agrégée respectant RLS ; elle reste à faire avec la CLI Supabase disponible et une vérification contre le schéma réel.
