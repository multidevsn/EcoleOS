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

## Limitation de vérification locale

`npm run build` n'a pas pu être validé dans l'environnement courant : l'installation des dépendances reste incomplète et TypeScript signale l'absence de `vite/client` et `vite-plugin-pwa/client`. Les fichiers TypeScript/TSX modifiés ont toutefois été contrôlés par transpilation syntaxique.

Avant mise en production, exécuter un `npm ci` propre puis `npm run build` sur la machine/CI de déploiement et vérifier les logs Vercel.

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
