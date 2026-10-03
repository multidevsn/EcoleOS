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
