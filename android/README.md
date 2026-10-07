# École OS pour Android

Coquille WebView native (Java, aucune dépendance AndroidX) qui embarque le build web de
l'application dans les `assets` de l'APK. L'interface vient du paquet local ; seules
l'authentification Supabase et les routes `/api/...` passent par le réseau.

> Ce dossier est la source de référence du module Android. L'archive
> `EcoleOS_android_security_fixes.7z` à la racine du dépôt est un instantané antérieur,
> antérieur aux correctifs du 2026-10-07 : ne pas la reconstruire à partir d'elle.

## Construire l'APK

```bash
# 1. Bundle web destiné au WebView — PAS `npm run build`
npm ci
npm run build:android

# 2. APK
cd android
./gradlew assembleDebug          # pour test local
./gradlew assembleRelease        # pour distribution (voir RELEASE_SIGNING.md)
```

`syncWebAssets` copie `dist/` dans `app/src/main/assets/www/` avant la compilation et
**échoue** si :

- `dist/index.html` est absent (bundle web non construit) ;
- le bundle contient `sw.js`, `workbox-*.js` ou un chunk `virtual_pwa-register-*`.

Ce second garde-fou existe parce que l'APK distribué dans l'archive `.7z` avait été
construit avec `npm run build` : il embarquait le service worker PWA et Vercel Analytics,
que le shell WebView bloque en 404.

## Changer l'adresse du serveur

L'origine par défaut est injectée au build, sans modifier le code Java :

```bash
./gradlew assembleRelease -PecoleosServerOrigin=https://mon-ecole.vercel.app
```

Valeur par défaut : `https://ecole-os.vercel.app` (voir `app/build.gradle`).

Cette adresse est **publique** : elle part en clair dans chaque requête HTTPS et apparaît
dans les journaux du serveur. L'ancienne « obfuscation » par XOR ne protégeait rien et a
surtout provoqué une page blanche quand la table d'octets a été corrompue — elle décodait
`httpw8//egole-ow.vefgel.app`, que WebView refusait comme base URL.

`normalizeOrigin()` valide maintenant l'origine avant usage (schéma `https`, hôte présent,
ni chemin ni query ni fragment). Une origine invalide affiche un écran natif explicite au
lieu d'un WebView vide.

## Comportement en cas d'échec

| Situation | Avant | Maintenant |
|---|---|---|
| Origine invalide | Page blanche, aucun message | Écran natif « École OS n'a pas pu s'ouvrir » + Réessayer |
| Erreur réseau sur le document principal | Toast, page blanche | Écran natif + Réessayer |
| Réponse HTTP en erreur | Rien | Écran natif avec le code |
| Certificat TLS invalide | Chargement annulé en silence | Écran natif expliquant l'arrêt |
| Chargement en cours | Écran figé | Pourcentage dans la barre du haut |
| Fermeture de l'activité | WebView conservé en mémoire | `onDestroy()` le détruit |

## Sécurité

Inchangée et toujours en place : HTTPS uniquement, contenus mixtes bloqués, Safe Browsing,
accès fichiers interdit, débogage WebView désactivé, sauvegarde Android désactivée, aucun
pont JavaScript natif, CSP injectée dans le document embarqué, ressources externes limitées
à Supabase / Wave / Paddle. Seule permission déclarée : `INTERNET`.
